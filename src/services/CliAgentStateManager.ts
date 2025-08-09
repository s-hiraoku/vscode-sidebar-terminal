import * as vscode from 'vscode';
import { ICliAgentStateManager, DisconnectedAgentInfo } from '../interfaces/CliAgentService';
import { terminal as log } from '../utils/logger';

/**
 * Manages CLI Agent state transitions and tracking
 */
export class CliAgentStateManager implements ICliAgentStateManager {
  private _connectedAgentTerminalId: string | null = null;
  private _connectedAgentType: 'claude' | 'gemini' | null = null;
  private _disconnectedAgents = new Map<string, DisconnectedAgentInfo>();

  private readonly _onStatusChange = new vscode.EventEmitter<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }>();

  setConnectedAgent(terminalId: string, type: 'claude' | 'gemini', terminalName?: string): void {
    // 🚨 FIX: Prevent unnecessary state changes for already connected agent
    if (this._connectedAgentTerminalId === terminalId && this._connectedAgentType === type) {
      log(
        `ℹ️ [STATE-MANAGER] Agent ${type} in terminal ${terminalId} is already CONNECTED, skipping state change`
      );
      return;
    }

    // 🚨 CRITICAL FIX: Prevent promotion of DISCONNECTED agents to CONNECTED via old output re-processing
    // But allow legitimate state changes when the agent is actually restarted
    if (this._disconnectedAgents.has(terminalId)) {
      const disconnectedInfo = this._disconnectedAgents.get(terminalId)!;
      const timeSinceDisconnect = Date.now() - disconnectedInfo.startTime.getTime();

      // If less than 2 seconds since disconnect, this is likely old output re-processing
      if (timeSinceDisconnect < 2000) {
        log(
          `🚨 [STATE-MANAGER] BLOCKED: Attempt to promote DISCONNECTED agent ${type} in terminal ${terminalId} to CONNECTED (old output re-processing, ${timeSinceDisconnect}ms since disconnect)`
        );
        return;
      }

      // If more than 2 seconds, this could be a legitimate restart of the agent
      log(
        `🔄 [STATE-MANAGER] Allowing state change for terminal ${terminalId} from DISCONNECTED to CONNECTED (${timeSinceDisconnect}ms since disconnect, likely legitimate restart)`
      );
    }

    // Handle previous connected agent
    const previousConnectedId = this._connectedAgentTerminalId;
    const previousType = this._connectedAgentType;

    // Set new connected agent
    this._connectedAgentTerminalId = terminalId;
    this._connectedAgentType = type;

    // Remove from disconnected if it was there (shouldn't happen due to check above, but safety measure)
    this._disconnectedAgents.delete(terminalId);

    // Move previous connected agent to disconnected (only if different terminal)
    if (previousConnectedId && previousConnectedId !== terminalId && previousType) {
      this._disconnectedAgents.set(previousConnectedId, {
        type: previousType,
        startTime: new Date(),
        terminalName,
      });

      this._onStatusChange.fire({
        terminalId: previousConnectedId,
        status: 'disconnected',
        type: previousType,
        terminalName,
      });

      log(
        `📝 [STATE-MANAGER] Moved previous CONNECTED terminal ${previousConnectedId} to DISCONNECTED tracking`
      );
    }

    // Emit connected event for new agent
    this._onStatusChange.fire({
      terminalId,
      status: 'connected',
      type,
      terminalName,
    });

    log(
      `🎯 [STATE-MANAGER] Set terminal ${terminalId} as CONNECTED (${type}). DISCONNECTED agents: ${this._disconnectedAgents.size}`
    );
  }

  /**
   * 🔧 Promote a DISCONNECTED agent to CONNECTED (for legitimate user actions like toggle button)
   * This bypasses the blocking logic in setConnectedAgent for explicit user operations
   */
  promoteDisconnectedAgentToConnected(terminalId: string): void {
    const disconnectedAgent = this._disconnectedAgents.get(terminalId);
    if (!disconnectedAgent) {
      log(`⚠️ [STATE-MANAGER] Cannot promote terminal ${terminalId}: not in DISCONNECTED state`);
      return;
    }

    log(
      `🎯 [STATE-MANAGER] LEGITIMATE PROMOTION: User explicitly promoted DISCONNECTED agent ${disconnectedAgent.type} in terminal ${terminalId} to CONNECTED`
    );

    // Handle previous connected agent (move to disconnected)
    const previousConnectedId = this._connectedAgentTerminalId;
    const previousType = this._connectedAgentType;

    // Set new connected agent
    this._connectedAgentTerminalId = terminalId;
    this._connectedAgentType = disconnectedAgent.type;

    // Remove from disconnected
    this._disconnectedAgents.delete(terminalId);

    // Move previous connected agent to disconnected (if exists and different)
    if (previousConnectedId && previousConnectedId !== terminalId && previousType) {
      this._disconnectedAgents.set(previousConnectedId, {
        type: previousType,
        startTime: new Date(),
        terminalName: disconnectedAgent.terminalName,
      });

      this._onStatusChange.fire({
        terminalId: previousConnectedId,
        status: 'disconnected',
        type: previousType,
        terminalName: disconnectedAgent.terminalName,
      });
    }

    // Fire status change for newly connected agent
    this._onStatusChange.fire({
      terminalId,
      status: 'connected',
      type: disconnectedAgent.type,
      terminalName: disconnectedAgent.terminalName,
    });

    log(
      `✅ [STATE-MANAGER] Legitimate promotion completed: Terminal ${terminalId} (${disconnectedAgent.type}) is now CONNECTED`
    );
  }

  setAgentTerminated(terminalId: string): void {
    log(`🔄 [STATE-MANAGER-DEBUG] setAgentTerminated called for terminal ${terminalId}`);
    log(
      `🔄 [STATE-MANAGER-DEBUG] Current connected: ${this._connectedAgentTerminalId}, disconnected count: ${this._disconnectedAgents.size}`
    );

    let wasConnected = false;
    let wasDisconnected = false;
    let agentType: string | null = null;

    // Handle connected agent termination
    if (this._connectedAgentTerminalId === terminalId) {
      agentType = this._connectedAgentType;
      this._connectedAgentTerminalId = null;
      this._connectedAgentType = null;
      wasConnected = true;

      log(`🔄 [STATE-MANAGER] Connected terminal ${terminalId} (${agentType}) terminated`);
    }

    // Handle disconnected agent termination
    if (this._disconnectedAgents.has(terminalId)) {
      const agentInfo = this._disconnectedAgents.get(terminalId)!;
      agentType = agentInfo.type;
      this._disconnectedAgents.delete(terminalId);
      wasDisconnected = true;

      log(
        `🔻 [STATE-MANAGER] Disconnected agent ${agentInfo.type} in terminal ${terminalId} terminated`
      );
    }

    // Fire status change to 'none' for the terminated agent
    if ((wasConnected || wasDisconnected) && agentType) {
      log(
        `🚨 [STATE-MANAGER-DEBUG] About to fire status change to NONE for terminal ${terminalId}`
      );
      log(
        `🚨 [STATE-MANAGER-DEBUG] Event details: terminalId=${terminalId}, status=none, type=${agentType}`
      );

      this._onStatusChange.fire({
        terminalId,
        status: 'none',
        type: null,  // 🔧 FIX: Set type to null when status is 'none' as per specification
      });

      log(
        `❌ [STATE-MANAGER] Terminal ${terminalId} (${agentType}) status set to NONE (agent terminated)`
      );
      log(`✅ [STATE-MANAGER-DEBUG] Status change event fired successfully`);
    } else {
      log(
        `⚠️ [STATE-MANAGER-DEBUG] NO status change fired - wasConnected: ${wasConnected}, wasDisconnected: ${wasDisconnected}, agentType: ${agentType}`
      );
    }

    // Only promote disconnected agents when a CONNECTED agent terminates
    // (not when a DISCONNECTED agent terminates)
    if (wasConnected) {
      this.promoteLatestDisconnectedAgent();
    }
  }

  /**
   * 🔧 NEW: Completely remove CLI Agent state when terminal is actually deleted
   * (not just when CLI Agent session ends)
   */
  removeTerminalCompletely(terminalId: string): void {
    let wasConnected = false;
    let wasDisconnected = false;
    let agentType: string | null = null;

    if (this._connectedAgentTerminalId === terminalId) {
      agentType = this._connectedAgentType;
      this._connectedAgentTerminalId = null;
      this._connectedAgentType = null;
      wasConnected = true;
    }

    if (this._disconnectedAgents.has(terminalId)) {
      const agentInfo = this._disconnectedAgents.get(terminalId);
      agentType = agentInfo?.type || agentType;
      this._disconnectedAgents.delete(terminalId);
      wasDisconnected = true;
    }

    if (wasConnected || wasDisconnected) {
      // Fire status change to 'none' when terminal is actually removed
      this._onStatusChange.fire({
        terminalId,
        status: 'none',
        type: null,
      });

      log(`🗑️ [STATE-MANAGER] Terminal ${terminalId} completely removed (${agentType} agent)`);

      // Promote latest disconnected agent if needed
      if (wasConnected) {
        this.promoteLatestDisconnectedAgent();
      }
    }
  }

  promoteLatestDisconnectedAgent(): void {
    if (this._disconnectedAgents.size === 0) {
      log('ℹ️ [AUTO-PROMOTION] No DISCONNECTED agents to promote');
      return;
    }

    // Find the most recently started DISCONNECTED agent
    let latestAgent: {
      terminalId: string;
      info: DisconnectedAgentInfo;
    } | null = null;

    for (const [terminalId, info] of this._disconnectedAgents.entries()) {
      if (!latestAgent || info.startTime > latestAgent.info.startTime) {
        latestAgent = { terminalId, info };
      }
    }

    if (latestAgent) {
      const { terminalId, info } = latestAgent;

      // Remove from disconnected tracking
      this._disconnectedAgents.delete(terminalId);

      // Set as new CONNECTED agent
      this._connectedAgentTerminalId = terminalId;
      this._connectedAgentType = info.type;

      // Fire status change to 'connected'
      this._onStatusChange.fire({
        terminalId,
        status: 'connected',
        type: info.type,
        terminalName: info.terminalName,
      });

      log(
        `🚀 [AUTO-PROMOTION] Promoted terminal ${terminalId} (${info.type}) from DISCONNECTED to CONNECTED (specification compliance)`
      );
      log(`📊 [AUTO-PROMOTION] Remaining DISCONNECTED agents: ${this._disconnectedAgents.size}`);
    }
  }

  getConnectedAgentTerminalId(): string | null {
    return this._connectedAgentTerminalId;
  }

  getConnectedAgentType(): 'claude' | 'gemini' | null {
    return this._connectedAgentType;
  }

  isAgentConnected(terminalId: string): boolean {
    return this._connectedAgentTerminalId === terminalId;
  }

  clearAllState(): void {
    this._connectedAgentTerminalId = null;
    this._connectedAgentType = null;
    this._disconnectedAgents.clear();
  }

  getDisconnectedAgents(): Map<string, DisconnectedAgentInfo> {
    return new Map(this._disconnectedAgents);
  }

  get onStatusChange(): vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }> {
    return this._onStatusChange.event;
  }

  dispose(): void {
    this.clearAllState();
    this._onStatusChange.dispose();
  }

  /**
   * 🚨 NEW: Heartbeat mechanism to validate connected agent state
   * This helps prevent state loss during extended usage
   */
  validateConnectedAgentState(): void {
    if (!this._connectedAgentTerminalId) {
      return; // No connected agent to validate
    }

    const terminalId = this._connectedAgentTerminalId;
    const agentType = this._connectedAgentType;

    log(`💓 [HEARTBEAT] Validating connected agent state: terminal ${terminalId} (${agentType})`);

    // For now, we just log the validation
    // In the future, this could include more sophisticated checks
    // like checking if the terminal process is still alive
  }

  /**
   * 🚨 NEW: Force refresh connected agent state
   * This can be used as fallback when file reference fails
   */
  refreshConnectedAgentState(): boolean {
    const disconnectedAgents = this._disconnectedAgents;

    if (disconnectedAgents.size > 0) {
      log(
        `🔄 [REFRESH] Attempting to refresh state from ${disconnectedAgents.size} disconnected agents`
      );

      // Try to promote the most recent disconnected agent if no connected agent exists
      if (!this._connectedAgentTerminalId) {
        this.promoteLatestDisconnectedAgent();
        return this._connectedAgentTerminalId !== null;
      }
    }

    return this._connectedAgentTerminalId !== null;
  }
}
