/**
 * CLI Agent State Store
 *
 * Centralized state management for CLI Agents with Observer pattern support.
 * Consolidates state management from:
 * - services/CliAgentStateManager
 * - webview/managers/CliAgentStateManager
 *
 * Benefits:
 * - Single source of truth for agent state
 * - Observer pattern for reactive state updates
 * - Reduced code duplication
 * - Improved maintainability and consistency
 */

import * as vscode from 'vscode';
import { terminal as log } from '../utils/logger';
import { AgentType } from './CliAgentPatternRegistry';

/**
 * Agent state status
 */
export type AgentStatus = 'connected' | 'disconnected' | 'none';

/**
 * Agent state information
 */
export interface AgentState {
  /** Terminal ID */
  terminalId: string;

  /** Agent status */
  status: AgentStatus;

  /** Agent type */
  agentType: AgentType | null;

  /** Terminal name (optional) */
  terminalName?: string;

  /** Whether to preserve scroll position */
  preserveScrollPosition: boolean;

  /** Whether agent is displaying choices */
  isDisplayingChoices: boolean;

  /** Timestamp of last choice detection */
  lastChoiceDetected?: number;

  /** Start time for disconnected agents */
  startTime?: Date;
}

/**
 * Disconnected agent information
 */
export interface DisconnectedAgentInfo {
  type: AgentType;
  startTime: Date;
  terminalName?: string;
}

/**
 * State change event
 */
export interface StateChangeEvent {
  terminalId: string;
  status: AgentStatus;
  type: AgentType | null;
  terminalName?: string;
}

/**
 * Observer callback for state changes
 */
export type StateChangeObserver = (event: StateChangeEvent) => void;

/**
 * Centralized CLI Agent State Store
 */
export class CliAgentStateStore {
  // State storage
  private readonly agentStates = new Map<string, AgentState>();
  private connectedAgentTerminalId: string | null = null;
  private connectedAgentType: AgentType | null = null;
  private readonly disconnectedAgents = new Map<string, DisconnectedAgentInfo>();

  // Event emitters for VS Code integration
  private readonly statusChangeEmitter = new vscode.EventEmitter<StateChangeEvent>();
  public readonly onStatusChange: vscode.Event<StateChangeEvent> = this.statusChangeEmitter.event;

  // Observer pattern support
  private readonly observers: Set<StateChangeObserver> = new Set();

  // Configuration
  private readonly DISCONNECT_GRACE_PERIOD_MS = 2000;

  constructor() {
    log('🏪 [STATE-STORE] Initialized CLI Agent State Store');
  }

  /**
   * Register an observer for state changes
   * @param observer Callback function to be called on state changes
   * @returns Disposable to unregister the observer
   */
  public subscribe(observer: StateChangeObserver): vscode.Disposable {
    this.observers.add(observer);
    log(`👀 [STATE-STORE] Observer registered (total: ${this.observers.size})`);

    return {
      dispose: () => {
        this.observers.delete(observer);
        log(`👋 [STATE-STORE] Observer unregistered (total: ${this.observers.size})`);
      },
    };
  }

  /**
   * Notify all observers of a state change
   * @param event State change event
   */
  private notifyObservers(event: StateChangeEvent): void {
    // Emit VS Code event
    this.statusChangeEmitter.fire(event);

    // Notify observers
    this.observers.forEach((observer) => {
      try {
        observer(event);
      } catch (error) {
        log('ERROR: Observer notification failed:', error);
      }
    });
  }

  /**
   * Set agent as connected
   * @param terminalId Terminal ID
   * @param agentType Agent type
   * @param terminalName Terminal name (optional)
   */
  public setConnectedAgent(terminalId: string, agentType: AgentType, terminalName?: string): void {
    // Prevent unnecessary state changes
    if (this.connectedAgentTerminalId === terminalId && this.connectedAgentType === agentType) {
      log(
        `ℹ️ [STATE-STORE] Agent ${agentType} in terminal ${terminalId} already CONNECTED, skipping`
      );
      return;
    }

    // Check for recent disconnect (prevent old output re-processing)
    if (this.disconnectedAgents.has(terminalId)) {
      const disconnectedInfo = this.disconnectedAgents.get(terminalId)!;
      const timeSinceDisconnect = Date.now() - disconnectedInfo.startTime.getTime();

      if (timeSinceDisconnect < this.DISCONNECT_GRACE_PERIOD_MS) {
        log(
          `🚨 [STATE-STORE] BLOCKED: Attempt to promote DISCONNECTED agent ${agentType} in terminal ${terminalId} (old output, ${timeSinceDisconnect}ms)`
        );
        return;
      }

      log(
        `🔄 [STATE-STORE] Allowing promotion from DISCONNECTED to CONNECTED (${timeSinceDisconnect}ms since disconnect)`
      );
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
    log(`🎯 [STATE-STORE] Set terminal ${terminalId} as CONNECTED (${agentType})`);

    // Handle previous connected agent (move to disconnected)
    if (previousConnectedId && previousConnectedId !== terminalId && previousType) {
      log(
        `📝 [STATE-STORE] Moving previous CONNECTED agent ${previousType} in terminal ${previousConnectedId} to DISCONNECTED`
      );

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

      log(`📝 [STATE-STORE] Terminal ${previousConnectedId} moved to DISCONNECTED`);
    }
  }

  /**
   * Set agent as terminated
   * @param terminalId Terminal ID
   */
  public setAgentTerminated(terminalId: string): void {
    let wasConnected = false;
    let wasDisconnected = false;
    let agentType: AgentType | null = null;

    // Handle connected agent termination
    if (this.connectedAgentTerminalId === terminalId) {
      agentType = this.connectedAgentType;
      this.connectedAgentTerminalId = null;
      this.connectedAgentType = null;
      wasConnected = true;

      log(`🔄 [STATE-STORE] Connected terminal ${terminalId} (${agentType}) terminated`);
    }

    // Handle disconnected agent termination
    if (this.disconnectedAgents.has(terminalId)) {
      const agentInfo = this.disconnectedAgents.get(terminalId)!;
      agentType = agentInfo.type;
      this.disconnectedAgents.delete(terminalId);
      wasDisconnected = true;

      log(
        `🔻 [STATE-STORE] Disconnected agent ${agentInfo.type} in terminal ${terminalId} terminated`
      );
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

      log(`❌ [STATE-STORE] Terminal ${terminalId} (${agentType}) status set to NONE`);

      // Promote latest disconnected agent if connected agent was terminated
      if (wasConnected) {
        this.promoteLatestDisconnectedAgent();
      }
    }
  }

  /**
   * Completely remove terminal state
   * @param terminalId Terminal ID
   */
  public removeTerminalCompletely(terminalId: string): void {
    let wasConnected = false;
    let wasDisconnected = false;
    let agentType: AgentType | null = null;

    if (this.connectedAgentTerminalId === terminalId) {
      agentType = this.connectedAgentType;
      this.connectedAgentTerminalId = null;
      this.connectedAgentType = null;
      wasConnected = true;
    }

    if (this.disconnectedAgents.has(terminalId)) {
      const agentInfo = this.disconnectedAgents.get(terminalId);
      agentType = agentInfo?.type || agentType;
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

      log(`🗑️ [STATE-STORE] Terminal ${terminalId} completely removed (${agentType} agent)`);

      // Promote latest disconnected agent if needed
      if (wasConnected) {
        this.promoteLatestDisconnectedAgent();
      }
    }
  }

  /**
   * Promote latest disconnected agent to connected
   */
  private promoteLatestDisconnectedAgent(): void {
    if (this.disconnectedAgents.size === 0) {
      log('ℹ️ [STATE-STORE] No DISCONNECTED agents to promote');
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

      log(
        `🚀 [STATE-STORE] Promoted terminal ${terminalId} (${info.type}) from DISCONNECTED to CONNECTED`
      );
    }
  }

  /**
   * Update agent state in the store
   * @param terminalId Terminal ID
   * @param updates Partial state updates
   */
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

  /**
   * Get agent state for a terminal
   * @param terminalId Terminal ID
   * @returns Agent state or null if not found
   */
  public getAgentState(terminalId: string): AgentState | null {
    return this.agentStates.get(terminalId) || null;
  }

  /**
   * Get all agent states
   * @returns Map of all agent states
   */
  public getAllAgentStates(): Map<string, AgentState> {
    return new Map(this.agentStates);
  }

  /**
   * Check if agent is connected in terminal
   * @param terminalId Terminal ID
   * @returns True if agent is connected
   */
  public isAgentConnected(terminalId: string): boolean {
    return this.connectedAgentTerminalId === terminalId;
  }

  /**
   * Get connected agent terminal ID
   * @returns Terminal ID or null
   */
  public getConnectedAgentTerminalId(): string | null {
    return this.connectedAgentTerminalId;
  }

  /**
   * Get connected agent type
   * @returns Agent type or null
   */
  public getConnectedAgentType(): AgentType | null {
    return this.connectedAgentType;
  }

  /**
   * Get disconnected agents
   * @returns Map of disconnected agents
   */
  public getDisconnectedAgents(): Map<string, DisconnectedAgentInfo> {
    return new Map(this.disconnectedAgents);
  }

  /**
   * Force reconnect an agent (for manual user actions)
   * @param terminalId Terminal ID
   * @param agentType Agent type
   * @param terminalName Terminal name (optional)
   * @returns True if successful
   */
  public forceReconnectAgent(
    terminalId: string,
    agentType: AgentType,
    terminalName?: string
  ): boolean {
    log(`🔄 [STATE-STORE] Force reconnecting ${agentType} in terminal ${terminalId}`);

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

    log(`🚀 [STATE-STORE] Successfully force-reconnected ${agentType} in terminal ${terminalId}`);
    return true;
  }

  /**
   * Clear detection error for a terminal
   * @param terminalId Terminal ID
   * @returns True if error was cleared
   */
  public clearDetectionError(terminalId: string): boolean {
    log(`🧹 [STATE-STORE] Clearing detection error for terminal ${terminalId}`);

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

      log(`✅ [STATE-STORE] Reset terminal ${terminalId} to 'none' state`);
      return true;
    }

    log(`⚠️ [STATE-STORE] No state to clear for terminal ${terminalId}`);
    return false;
  }

  /**
   * Clear all state
   */
  public clearAllState(): void {
    this.connectedAgentTerminalId = null;
    this.connectedAgentType = null;
    this.disconnectedAgents.clear();
    this.agentStates.clear();

    log('🧹 [STATE-STORE] All state cleared');
  }

  /**
   * Get state statistics
   * @returns State statistics
   */
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

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.clearAllState();
    this.observers.clear();
    this.statusChangeEmitter.dispose();

    log('🧹 [STATE-STORE] Disposed');
  }
}
