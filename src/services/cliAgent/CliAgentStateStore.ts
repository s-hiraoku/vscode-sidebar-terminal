/**
 * CLI Agent State Store
 *
 * Centralized state management for CLI Agents with observer pattern.
 * Single source of truth for agent connection states.
 *
 * Responsibilities:
 * - Track connected and disconnected agents
 * - Manage state transitions
 * - Notify observers of state changes
 * - Support persistence
 */

import * as vscode from 'vscode';
import { AgentType } from './CliAgentPatternRegistry';
import { terminal as log } from '../../utils/logger';

/**
 * Agent state type
 */
export type AgentState = 'connected' | 'disconnected' | 'none';

/**
 * Agent info for disconnected agents
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
  status: AgentState;
  type: AgentType | null;
  terminalName?: string;
}

/**
 * State observer interface
 */
export interface StateObserver {
  /**
   * Called when an agent state changes
   */
  onStateChange(event: StateChangeEvent): void;
}

/**
 * Full state snapshot for persistence
 */
export interface StateSnapshot {
  connectedAgentTerminalId: string | null;
  connectedAgentType: AgentType | null;
  disconnectedAgents: Map<string, DisconnectedAgentInfo>;
  timestamp: number;
}

/**
 * CLI Agent State Store
 * Central state management with observer pattern
 */
export class CliAgentStateStore {
  private static instance: CliAgentStateStore;

  /**
   * Connected agent tracking
   */
  private connectedAgentTerminalId: string | null = null;
  private connectedAgentType: AgentType | null = null;

  /**
   * Disconnected agents tracking
   */
  private disconnectedAgents = new Map<string, DisconnectedAgentInfo>();

  /**
   * Event emitter for state changes
   */
  private readonly stateChangeEmitter = new vscode.EventEmitter<StateChangeEvent>();

  /**
   * Observer list
   */
  private observers: StateObserver[] = [];

  /**
   * State transition lock (prevent race conditions)
   */
  private transitionLock = false;

  /**
   * Minimum time between state changes (prevent rapid flipping)
   */
  private readonly DEBOUNCE_MS = 500;
  private lastStateChange = new Map<string, number>();

  private constructor() {
    // Subscribe to own event emitter to notify observers
    this.stateChangeEmitter.event((event: StateChangeEvent) => {
      this.notifyObservers(event);
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CliAgentStateStore {
    if (!CliAgentStateStore.instance) {
      CliAgentStateStore.instance = new CliAgentStateStore();
    }
    return CliAgentStateStore.instance;
  }

  /**
   * Add state observer
   */
  public addObserver(observer: StateObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      log(`🔔 [STATE-STORE] Observer added (total: ${this.observers.length})`);
    }
  }

  /**
   * Remove state observer
   */
  public removeObserver(observer: StateObserver): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
      log(`🔔 [STATE-STORE] Observer removed (total: ${this.observers.length})`);
    }
  }

  /**
   * Get VSCode event for state changes
   */
  public get onStateChange(): vscode.Event<StateChangeEvent> {
    return this.stateChangeEmitter.event;
  }

  /**
   * Set agent as connected
   */
  public setConnectedAgent(
    terminalId: string,
    type: AgentType,
    terminalName?: string
  ): void {
    // Debounce check
    if (this.shouldDebounce(terminalId)) {
      log(`⏳ [STATE-STORE] Debouncing state change for terminal ${terminalId}`);
      return;
    }

    // Lock check
    if (this.transitionLock) {
      log(`🔒 [STATE-STORE] State transition locked, queuing change for terminal ${terminalId}`);
      setTimeout(() => this.setConnectedAgent(terminalId, type, terminalName), 100);
      return;
    }

    this.transitionLock = true;

    try {
      // Check if already connected
      if (this.connectedAgentTerminalId === terminalId && this.connectedAgentType === type) {
        log(
          `ℹ️ [STATE-STORE] Agent ${type} in terminal ${terminalId} is already connected, skipping`
        );
        return;
      }

      // Prevent promotion of recently disconnected agents
      if (this.disconnectedAgents.has(terminalId)) {
        const disconnectedInfo = this.disconnectedAgents.get(terminalId)!;
        const timeSinceDisconnect = Date.now() - disconnectedInfo.startTime.getTime();

        if (timeSinceDisconnect < 2000) {
          log(
            `🚨 [STATE-STORE] BLOCKED: Attempt to reconnect recently disconnected agent ${type} in terminal ${terminalId} (${timeSinceDisconnect}ms since disconnect)`
          );
          return;
        }
      }

      // Handle previous connected agent
      const previousConnectedId = this.connectedAgentTerminalId;
      const previousType = this.connectedAgentType;

      // Set new connected agent
      this.connectedAgentTerminalId = terminalId;
      this.connectedAgentType = type;

      // Remove from disconnected if it was there
      this.disconnectedAgents.delete(terminalId);

      // Emit connected event
      this.emitStateChange({
        terminalId,
        status: 'connected',
        type,
        terminalName,
      });

      log(`🎯 [STATE-STORE] Set terminal ${terminalId} as CONNECTED (${type})`);

      // Handle previous connected agent
      if (previousConnectedId && previousConnectedId !== terminalId && previousType) {
        this.disconnectedAgents.set(previousConnectedId, {
          type: previousType,
          startTime: new Date(),
          terminalName,
        });

        this.emitStateChange({
          terminalId: previousConnectedId,
          status: 'disconnected',
          type: previousType,
          terminalName,
        });

        log(`📝 [STATE-STORE] Moved terminal ${previousConnectedId} to DISCONNECTED`);
      }

      log(
        `✅ [STATE-STORE] State update complete. Disconnected agents: ${this.disconnectedAgents.size}`
      );
    } finally {
      this.transitionLock = false;
    }
  }

  /**
   * Set agent as terminated
   */
  public setAgentTerminated(terminalId: string): void {
    if (this.transitionLock) {
      log(`🔒 [STATE-STORE] State transition locked, queuing termination for terminal ${terminalId}`);
      setTimeout(() => this.setAgentTerminated(terminalId), 100);
      return;
    }

    this.transitionLock = true;

    try {
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

        log(`🔻 [STATE-STORE] Disconnected agent ${agentInfo.type} in terminal ${terminalId} terminated`);
      }

      // Emit status change to 'none'
      if ((wasConnected || wasDisconnected) && agentType) {
        this.emitStateChange({
          terminalId,
          status: 'none',
          type: null,
        });

        log(`❌ [STATE-STORE] Terminal ${terminalId} (${agentType}) status set to NONE`);
      }

      // Auto-promote latest disconnected agent if connected was terminated
      if (wasConnected) {
        this.promoteLatestDisconnectedAgent();
      }
    } finally {
      this.transitionLock = false;
    }
  }

  /**
   * Remove terminal completely (when terminal is deleted)
   */
  public removeTerminalCompletely(terminalId: string): void {
    if (this.transitionLock) {
      setTimeout(() => this.removeTerminalCompletely(terminalId), 100);
      return;
    }

    this.transitionLock = true;

    try {
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

      if (wasConnected || wasDisconnected) {
        this.emitStateChange({
          terminalId,
          status: 'none',
          type: null,
        });

        log(`🗑️ [STATE-STORE] Terminal ${terminalId} completely removed (${agentType} agent)`);

        if (wasConnected) {
          this.promoteLatestDisconnectedAgent();
        }
      }

      // Clear last state change timestamp
      this.lastStateChange.delete(terminalId);
    } finally {
      this.transitionLock = false;
    }
  }

  /**
   * Promote a disconnected agent to connected
   */
  public promoteDisconnectedAgent(terminalId: string): boolean {
    const disconnectedAgent = this.disconnectedAgents.get(terminalId);
    if (!disconnectedAgent) {
      log(`⚠️ [STATE-STORE] Cannot promote terminal ${terminalId}: not in disconnected state`);
      return false;
    }

    log(
      `🎯 [STATE-STORE] Promoting disconnected agent ${disconnectedAgent.type} in terminal ${terminalId} to connected`
    );

    this.setConnectedAgent(terminalId, disconnectedAgent.type, disconnectedAgent.terminalName);
    return true;
  }

  /**
   * Promote latest disconnected agent to connected
   */
  private promoteLatestDisconnectedAgent(): void {
    if (this.disconnectedAgents.size === 0) {
      log('ℹ️ [STATE-STORE] No disconnected agents to promote');
      return;
    }

    let latestAgent: { terminalId: string; info: DisconnectedAgentInfo } | null = null;

    for (const [terminalId, info] of this.disconnectedAgents.entries()) {
      if (!latestAgent || info.startTime > latestAgent.info.startTime) {
        latestAgent = { terminalId, info };
      }
    }

    if (latestAgent) {
      const { terminalId, info } = latestAgent;

      this.disconnectedAgents.delete(terminalId);

      this.connectedAgentTerminalId = terminalId;
      this.connectedAgentType = info.type;

      this.emitStateChange({
        terminalId,
        status: 'connected',
        type: info.type,
        terminalName: info.terminalName,
      });

      log(
        `🚀 [STATE-STORE] Auto-promoted terminal ${terminalId} (${info.type}) from disconnected to connected`
      );
      log(`📊 [STATE-STORE] Remaining disconnected agents: ${this.disconnectedAgents.size}`);
    }
  }

  /**
   * Get connected agent info
   */
  public getConnectedAgent(): { terminalId: string; type: AgentType } | null {
    if (this.connectedAgentTerminalId && this.connectedAgentType) {
      return {
        terminalId: this.connectedAgentTerminalId,
        type: this.connectedAgentType,
      };
    }
    return null;
  }

  /**
   * Get disconnected agents
   */
  public getDisconnectedAgents(): Map<string, DisconnectedAgentInfo> {
    return new Map(this.disconnectedAgents);
  }

  /**
   * Get agent state for a specific terminal
   */
  public getAgentState(terminalId: string): AgentState {
    if (this.connectedAgentTerminalId === terminalId) {
      return 'connected';
    }

    if (this.disconnectedAgents.has(terminalId)) {
      return 'disconnected';
    }

    return 'none';
  }

  /**
   * Check if terminal has connected agent
   */
  public isAgentConnected(terminalId: string): boolean {
    return this.connectedAgentTerminalId === terminalId;
  }

  /**
   * Clear all state
   */
  public clearAllState(): void {
    this.connectedAgentTerminalId = null;
    this.connectedAgentType = null;
    this.disconnectedAgents.clear();
    this.lastStateChange.clear();
    log('🧹 [STATE-STORE] All state cleared');
  }

  /**
   * Get state snapshot for persistence
   */
  public getStateSnapshot(): StateSnapshot {
    return {
      connectedAgentTerminalId: this.connectedAgentTerminalId,
      connectedAgentType: this.connectedAgentType,
      disconnectedAgents: new Map(this.disconnectedAgents),
      timestamp: Date.now(),
    };
  }

  /**
   * Restore state from snapshot
   */
  public restoreStateSnapshot(snapshot: StateSnapshot): void {
    this.connectedAgentTerminalId = snapshot.connectedAgentTerminalId;
    this.connectedAgentType = snapshot.connectedAgentType;
    this.disconnectedAgents = new Map(snapshot.disconnectedAgents);

    log(
      `🔄 [STATE-STORE] State restored from snapshot (timestamp: ${snapshot.timestamp})`
    );
  }

  /**
   * Emit state change event
   */
  private emitStateChange(event: StateChangeEvent): void {
    this.stateChangeEmitter.fire(event);
    this.lastStateChange.set(event.terminalId, Date.now());
  }

  /**
   * Notify all observers of state change
   */
  private notifyObservers(event: StateChangeEvent): void {
    for (const observer of this.observers) {
      try {
        observer.onStateChange(event);
      } catch (error) {
        log(`❌ [STATE-STORE] Observer notification failed:`, error);
      }
    }
  }

  /**
   * Check if state change should be debounced
   */
  private shouldDebounce(terminalId: string): boolean {
    const lastChange = this.lastStateChange.get(terminalId);
    if (!lastChange) {
      return false;
    }

    const timeSinceLastChange = Date.now() - lastChange;
    return timeSinceLastChange < this.DEBOUNCE_MS;
  }

  /**
   * Dispose state store
   */
  public dispose(): void {
    this.clearAllState();
    this.observers = [];
    this.stateChangeEmitter.dispose();
    log('🧹 [STATE-STORE] Disposed');
  }
}
