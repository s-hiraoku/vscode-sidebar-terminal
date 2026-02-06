/**
 * TerminalKillService
 *
 * Terminal kill operations extracted from SecondaryTerminalProvider.
 * Handles confirmation dialogs, kill execution, and state synchronization.
 */

import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { WebviewMessage } from '../../types/common';

/**
 * Dependencies required by TerminalKillService
 */
export interface ITerminalKillDependencies {
  getActiveTerminalId(): string | null;
  getTerminal(terminalId: string): { name?: string } | undefined;
  killTerminal(terminalId: string): Promise<void>;
  getCurrentState(): unknown;
  sendMessage(message: WebviewMessage): Promise<void>;
}

export class TerminalKillService {
  private readonly inFlightKills = new Set<string>();

  constructor(private readonly deps: ITerminalKillDependencies) {}

  /**
   * Kill the active terminal with optional confirmation
   */
  public async killTerminal(): Promise<void> {
    const activeTerminalId = this.deps.getActiveTerminalId();
    if (!activeTerminalId) {
      log('⚠️ [PROVIDER] No active terminal to kill');
      return;
    }

    if (this.inFlightKills.has(activeTerminalId)) {
      return;
    }

    this.inFlightKills.add(activeTerminalId);
    try {
      if (await this.shouldConfirmKill(activeTerminalId)) {
        return;
      }

      await this.performKill(activeTerminalId);
    } finally {
      this.inFlightKills.delete(activeTerminalId);
    }
  }

  /**
   * Kill a specific terminal by ID with optional confirmation
   */
  public async killSpecificTerminal(terminalId: string): Promise<void> {
    if (this.inFlightKills.has(terminalId)) {
      return;
    }

    this.inFlightKills.add(terminalId);
    try {
      if (await this.shouldConfirmKill(terminalId)) {
        return;
      }

      await this.performKill(terminalId);
    } finally {
      this.inFlightKills.delete(terminalId);
    }
  }

  /**
   * Check confirmation setting and show dialog if needed.
   * Returns true if user cancelled, false to proceed.
   */
  private async shouldConfirmKill(terminalId: string): Promise<boolean> {
    const confirmBeforeKill = vscode.workspace
      .getConfiguration('secondaryTerminal')
      .get<boolean>('confirmBeforeKill', false);

    if (!confirmBeforeKill) {
      return false;
    }

    const terminal = this.deps.getTerminal(terminalId);
    const terminalName = terminal?.name || `Terminal ${terminalId}`;
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to kill "${terminalName}"?`,
      { modal: true },
      'Kill Terminal'
    );

    if (result !== 'Kill Terminal') {
      log('⚠️ [PROVIDER] Terminal kill cancelled by user');
      return true;
    }

    return false;
  }

  /**
   * Execute the kill operation with proper state synchronization
   */
  private async performKill(terminalId: string): Promise<void> {
    log(`🗑️ [PROVIDER] Killing terminal: ${terminalId}`);

    try {
      await this.deps.killTerminal(terminalId);
    } catch (error) {
      log(`❌ [PROVIDER] Error killing terminal: ${error}`);
      await this.deps.sendMessage({
        command: 'deleteTerminalResponse',
        terminalId: terminalId,
        success: false,
        reason: error instanceof Error ? error.message : 'Terminal deletion failed',
      });
      return;
    }

    // Send terminalRemoved message first (only on successful deletion)
    await this.deps.sendMessage({
      command: 'terminalRemoved',
      terminalId: terminalId,
    });

    // Small delay to ensure WebView processes terminalRemoved before stateUpdate
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Then send the updated state
    await this.deps.sendMessage({
      command: 'stateUpdate',
      state: this.deps.getCurrentState(),
    });

    log(`✅ [PROVIDER] Terminal killed: ${terminalId}`);
  }
}
