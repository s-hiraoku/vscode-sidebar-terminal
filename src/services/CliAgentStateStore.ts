import * as vscode from 'vscode';
import { terminal as log } from '../utils/logger';
import type { AgentType } from '../types/shared';

export type AgentStatus = 'connected' | 'disconnected' | 'none';

export interface AgentState {
  terminalId: string;
  status: AgentStatus;
  agentType: AgentType | null;
  terminalName?: string;
  preserveScrollPosition: boolean;
  isDisplayingChoices: boolean;
  lastChoiceDetected?: number;
  startTime?: Date;
}

export interface DisconnectedAgentInfo {
  type: AgentType;
  startTime: Date;
  terminalName?: string;
}

export interface StateChangeEvent {
  terminalId: string;
  status: AgentStatus;
  type: AgentType | null;
  terminalName?: string;
}

export type StateChangeObserver = (event: StateChangeEvent) => void;

export class CliAgentStateStore {
  private readonly agentStates = new Map<string, AgentState>();
  private connectedAgentTerminalId: string | null = null;
  private connectedAgentType: AgentType | null = null;
  private readonly disconnectedAgents = new Map<string, DisconnectedAgentInfo>();

  private readonly statusChangeEmitter = new vscode.EventEmitter<StateChangeEvent>();
  public readonly onStatusChange: vscode.Event<StateChangeEvent> = this.statusChangeEmitter.event;

  private readonly observers = new Set<StateChangeObserver>();
  private readonly DISCONNECT_GRACE_PERIOD_MS = 2000;

  public subscribe(observer: StateChangeObserver): vscode.Disposable {
    this.observers.add(observer);

    return {
      dispose: () => {
        this.observers.delete(observer);
      },
    };
  }

  private notifyObservers(event: StateChangeEvent): void {
    this.statusChangeEmitter.fire(event);
    this.observers.forEach((observer) => {
      try {
        observer(event);
      } catch (error) {
        log('ERROR: Observer notification failed:', error);
      }
    });
  }

  public setConnectedAgent(terminalId: string, agentType: AgentType, terminalName?: string): void {
    // Prevent unnecessary state changes
    if (this.connectedAgentTerminalId === terminalId && this.connectedAgentType === agentType) {
      return;
    }

    // Check for recent disconnect (prevent old output re-processing)
    if (this.disconnectedAgents.has(terminalId)) {
      const disconnectedInfo = this.disconnectedAgents.get(terminalId)!;
      const timeSinceDisconnect = Date.now() - disconnectedInfo.startTime.getTime();

      if (timeSinceDisconnect < this.DISCONNECT_GRACE_PERIOD_MS) {
        return;
      }
    }

    // Handle previous connected agent
    const previousConnectedId = this.connectedAgentTerminalId;
    const previousType = this.connectedAgentType;

    // Set new connected agent
    this.connectedAgentTerminalId = terminalId;
    this.connectedAgentType = agentType;

    // Update agent state
    this.updateAgentState(terminalId, {
      terminalId,
      status: 'connected',
      agentType,
      terminalName,
      preserveScrollPosition: true,
      isDisplayingChoices: false,
    });

    // Remove from disconnected list
    this.disconnectedAgents.delete(terminalId);

    // Emit connected event
    const event: StateChangeEvent = {
      terminalId,
      status: 'connected',
      type: agentType,
      terminalName,
    };

    this.notifyObservers(event);

    // Handle previous connected agent (move to disconnected)
    if (previousConnectedId && previousConnectedId !== terminalId && previousType) {
      this.disconnectedAgents.set(previousConnectedId, {
        type: previousType,
        startTime: new Date(),
        terminalName,
      });

      this.updateAgentState(previousConnectedId, {
        terminalId: previousConnectedId,
        status: 'disconnected',
        agentType: previousType,
        preserveScrollPosition: false,
        isDisplayingChoices: false,
      });

      this.notifyObservers({
        terminalId: previousConnectedId,
        status: 'disconnected',
        type: previousType,
        terminalName,
      });
    }
  }

  public setAgentTerminated(terminalId: string): void {
    let wasConnected = false;
    let wasDisconnected = false;

    // Handle connected agent termination
    if (this.connectedAgentTerminalId === terminalId) {
      this.connectedAgentTerminalId = null;
      this.connectedAgentType = null;
      wasConnected = true;
    }

    // Handle disconnected agent termination
    if (this.disconnectedAgents.has(terminalId)) {
      this.disconnectedAgents.delete(terminalId);
      wasDisconnected = true;
    }

    // Update agent state to 'none'
    if (wasConnected || wasDisconnected) {
      this.updateAgentState(terminalId, {
        terminalId,
        status: 'none',
        agentType: null,
        preserveScrollPosition: false,
        isDisplayingChoices: false,
      });

      this.notifyObservers({
        terminalId,
        status: 'none',
        type: null,
      });

      // Promote latest disconnected agent if connected agent was terminated
      if (wasConnected) {
        this.promoteLatestDisconnectedAgent();
      }
    }
  }

  public removeTerminalCompletely(terminalId: string): void {
    let wasConnected = false;
    let wasDisconnected = false;

    if (this.connectedAgentTerminalId === terminalId) {
      this.connectedAgentTerminalId = null;
      this.connectedAgentType = null;
      wasConnected = true;
    }

    if (this.disconnectedAgents.has(terminalId)) {
      this.disconnectedAgents.delete(terminalId);
      wasDisconnected = true;
    }

    // Remove agent state
    this.agentStates.delete(terminalId);

    if (wasConnected || wasDisconnected) {
      this.notifyObservers({
        terminalId,
        status: 'none',
        type: null,
      });

      // Promote latest disconnected agent if needed
      if (wasConnected) {
        this.promoteLatestDisconnectedAgent();
      }
    }
  }

  private promoteLatestDisconnectedAgent(): void {
    if (this.disconnectedAgents.size === 0) {
      return;
    }

    // Find most recently disconnected agent
    let latestAgent: { terminalId: string; info: DisconnectedAgentInfo } | null = null;

    for (const [terminalId, info] of this.disconnectedAgents.entries()) {
      if (!latestAgent || info.startTime > latestAgent.info.startTime) {
        latestAgent = { terminalId, info };
      }
    }

    if (latestAgent) {
      const { terminalId, info } = latestAgent;

      // Remove from disconnected
      this.disconnectedAgents.delete(terminalId);

      // Set as connected
      this.connectedAgentTerminalId = terminalId;
      this.connectedAgentType = info.type;

      // Update state
      this.updateAgentState(terminalId, {
        terminalId,
        status: 'connected',
        agentType: info.type,
        terminalName: info.terminalName,
        preserveScrollPosition: true,
        isDisplayingChoices: false,
      });

      this.notifyObservers({
        terminalId,
        status: 'connected',
        type: info.type,
        terminalName: info.terminalName,
      });
    }
  }

  private updateAgentState(terminalId: string, updates: Partial<AgentState>): void {
    const currentState = this.agentStates.get(terminalId);
    const newState: AgentState = {
      terminalId,
      status: 'none',
      agentType: null,
      preserveScrollPosition: false,
      isDisplayingChoices: false,
      ...currentState,
      ...updates,
    };

    this.agentStates.set(terminalId, newState);
  }

  public getAgentState(terminalId: string): AgentState | null {
    return this.agentStates.get(terminalId) || null;
  }

  public getAllAgentStates(): Map<string, AgentState> {
    return new Map(this.agentStates);
  }

  public isAgentConnected(terminalId: string): boolean {
    return this.connectedAgentTerminalId === terminalId;
  }

  public getConnectedAgentTerminalId(): string | null {
    return this.connectedAgentTerminalId;
  }

  public getConnectedAgentType(): AgentType | null {
    return this.connectedAgentType;
  }

  public getDisconnectedAgents(): Map<string, DisconnectedAgentInfo> {
    return new Map(this.disconnectedAgents);
  }

  public forceReconnectAgent(
    terminalId: string,
    agentType: AgentType,
    terminalName?: string
  ): boolean {
    const previousConnectedId = this.connectedAgentTerminalId;
    const previousType = this.connectedAgentType;
    const previousState = previousConnectedId ? this.agentStates.get(previousConnectedId) : null;

    // Clear existing state
    this.disconnectedAgents.delete(terminalId);

    // Set as connected (bypassing grace period check)
    this.connectedAgentTerminalId = terminalId;
    this.connectedAgentType = agentType;

    this.updateAgentState(terminalId, {
      terminalId,
      status: 'connected',
      agentType,
      terminalName,
      preserveScrollPosition: true,
      isDisplayingChoices: false,
    });

    this.notifyObservers({
      terminalId,
      status: 'connected',
      type: agentType,
      terminalName,
    });

    // If another terminal was previously CONNECTED, it is still running but no longer globally active.
    // Move it to DISCONNECTED instead of clearing to NONE.
    if (previousConnectedId && previousConnectedId !== terminalId && previousType) {
      const previousTerminalName = previousState?.terminalName;
      this.disconnectedAgents.set(previousConnectedId, {
        type: previousType,
        startTime: new Date(),
        terminalName: previousTerminalName,
      });

      this.updateAgentState(previousConnectedId, {
        terminalId: previousConnectedId,
        status: 'disconnected',
        agentType: previousType,
        terminalName: previousTerminalName,
        preserveScrollPosition: false,
        isDisplayingChoices: false,
      });

      this.notifyObservers({
        terminalId: previousConnectedId,
        status: 'disconnected',
        type: previousType,
        terminalName: previousTerminalName,
      });
    }
    return true;
  }

  public clearDetectionError(terminalId: string): boolean {
    let hadState = false;

    // Clear connected state
    if (this.connectedAgentTerminalId === terminalId) {
      this.connectedAgentTerminalId = null;
      this.connectedAgentType = null;
      hadState = true;
    }

    // Clear disconnected state
    if (this.disconnectedAgents.has(terminalId)) {
      this.disconnectedAgents.delete(terminalId);
      hadState = true;
    }

    // Update state to 'none'
    if (hadState) {
      this.updateAgentState(terminalId, {
        terminalId,
        status: 'none',
        agentType: null,
        preserveScrollPosition: false,
        isDisplayingChoices: false,
      });

      this.notifyObservers({
        terminalId,
        status: 'none',
        type: null,
      });
      return true;
    }
    return false;
  }

  public clearAllState(): void {
    this.connectedAgentTerminalId = null;
    this.connectedAgentType = null;
    this.disconnectedAgents.clear();
    this.agentStates.clear();
  }

  public getStateStats(): {
    totalAgents: number;
    connectedAgents: number;
    disconnectedAgents: number;
    currentConnectedId: string | null;
    agentTypes: AgentType[];
  } {
    const states = Array.from(this.agentStates.values());
    const agentTypes = Array.from(
      new Set(
        states.map((state) => state.agentType).filter((type): type is AgentType => type !== null)
      )
    );

    return {
      totalAgents: this.agentStates.size,
      connectedAgents: states.filter((state) => state.status === 'connected').length,
      disconnectedAgents: states.filter((state) => state.status === 'disconnected').length,
      currentConnectedId: this.connectedAgentTerminalId,
      agentTypes,
    };
  }

  public dispose(): void {
    this.clearAllState();
    this.observers.clear();
    this.statusChangeEmitter.dispose();
  }
}
