/**
 * CliAgentCoordinator
 *
 * CLI Agent management methods extracted from LightweightTerminalWebviewManager.
 * Handles AI agent toggle, status updates, and state delegation.
 */

import { webview as log } from '../../utils/logger';
import { TerminalInstance } from '../interfaces/ManagerInterfaces';

/**
 * Dependencies required by CliAgentCoordinator
 */
export interface ICliAgentCoordinatorDependencies {
  // CliAgentStateManager delegation
  getAgentState(terminalId: string): { status: string; agentType: string | null } | null;
  setAgentConnected(terminalId: string, agentType: string, terminalName?: string): void;
  setAgentDisconnected(terminalId: string): void;
  setAgentState(
    terminalId: string,
    state: { status: string; terminalName?: string; agentType: string | null }
  ): void;
  removeTerminalState(terminalId: string): void;

  // Manager coordination
  getActiveTerminalId(): string | null;
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  postMessageToExtension(message: unknown): void;

  // UI updates
  updateCliAgentStatusUI(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void;
}

export class CliAgentCoordinator {
  constructor(private readonly deps: ICliAgentCoordinatorDependencies) {}

  public getCliAgentState(terminalId: string) {
    return this.deps.getAgentState(terminalId);
  }

  public setCliAgentConnected(
    terminalId: string,
    agentType: string,
    terminalName?: string
  ): void {
    this.deps.setAgentConnected(terminalId, agentType, terminalName);
  }

  public setCliAgentDisconnected(terminalId: string): void {
    this.deps.setAgentDisconnected(terminalId);
  }

  /**
   * Handle AI Agent toggle button click
   * Properly switches connected agents and moves previous connected to disconnected
   */
  public handleAiAgentToggle(terminalId: string): void {
    log(`⏻ AI Agent toggle clicked for terminal: ${terminalId}`);

    try {
      const agentState = this.deps.getAgentState(terminalId);
      const currentStatus = agentState?.status || 'none';

      log(`⏻ Current AI Agent state: ${currentStatus} for terminal: ${terminalId}`);

      if (currentStatus === 'connected') {
        log(
          `🔄 [MANUAL-RESET] Agent already connected, treating as manual reset for terminal: ${terminalId}`
        );
        this.deps.postMessageToExtension({
          command: 'switchAiAgent',
          terminalId,
          action: 'force-reconnect',
          forceReconnect: true,
          agentType: agentState?.agentType || 'claude',
          timestamp: Date.now(),
        });
      } else if (currentStatus === 'disconnected') {
        this.deps.postMessageToExtension({
          command: 'switchAiAgent',
          terminalId,
          action: 'activate',
          timestamp: Date.now(),
        });

        log(
          `✅ Sent AI Agent activation request for terminal: ${terminalId} (status: ${currentStatus})`
        );
      } else {
        // None state: force-reconnect to create a new agent connection
        log(
          `⏻ No agent detected, sending force-reconnect for terminal: ${terminalId}`
        );
        this.deps.postMessageToExtension({
          command: 'switchAiAgent',
          terminalId,
          action: 'force-reconnect',
          forceReconnect: true,
          agentType: 'claude',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      log(`❌ Error handling AI Agent toggle for terminal ${terminalId}:`, error);

      this.deps.postMessageToExtension({
        command: 'switchAiAgent',
        terminalId,
        action: 'activate',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Update Claude status (legacy compatibility)
   */
  public updateClaudeStatus(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void {
    log(
      `🔄 [REFACTORED] UpdateClaudeStatus called: ${activeTerminalName}, ${status}, ${agentType}`
    );

    let targetTerminalId = this.deps.getActiveTerminalId();

    if (activeTerminalName) {
      const allInstances = this.deps.getAllTerminalInstances();
      for (const [terminalId, instance] of allInstances) {
        if (instance.name === activeTerminalName) {
          targetTerminalId = terminalId;
          break;
        }
      }
    }

    if (targetTerminalId) {
      this.deps.setAgentState(targetTerminalId, {
        status,
        terminalName: activeTerminalName || `Terminal ${targetTerminalId}`,
        agentType,
      });

      this.deps.updateCliAgentStatusUI(targetTerminalId, status, agentType);

      log(`✅ [REFACTORED] Claude status updated for terminal: ${targetTerminalId}`);
    } else {
      log(`❌ [REFACTORED] Could not find terminal for: ${activeTerminalName}`);
    }
  }

  /**
   * Update CLI Agent status by terminal ID
   */
  public updateCliAgentStatus(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void {
    log(
      `🔄 [REFACTORED] UpdateCliAgentStatus called: ${terminalId}, ${status}, ${agentType}`
    );

    this.deps.setAgentState(terminalId, {
      status,
      agentType,
    });

    this.deps.updateCliAgentStatusUI(terminalId, status, agentType);

    log(`✅ [REFACTORED] CLI Agent status updated for terminal: ${terminalId}`);
  }
}
