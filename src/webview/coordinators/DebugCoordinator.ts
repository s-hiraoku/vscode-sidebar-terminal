/**
 * DebugCoordinator
 *
 * Debug and diagnostics methods extracted from LightweightTerminalWebviewManager.
 * Handles debug panel, diagnostics export, and manager stats aggregation.
 */

import { webview as log } from '../../utils/logger';
import { TerminalState } from '../../types/shared';
import { SystemDiagnostics } from '../managers/DebugPanelManager';

/**
 * Minimal interface for DebugPanelManager dependency
 */
export interface IDebugPanelManagerLike {
  updateDisplay(state: TerminalState, operation?: string): void;
  toggle(state?: TerminalState): void;
  isActive(): boolean;
  exportDiagnostics(systemStatus: unknown, maxTerminals: unknown): SystemDiagnostics;
  dispose(): void;
}

/**
 * Dependencies required by DebugCoordinator
 */
export interface IDebugCoordinatorDependencies {
  debugPanelManager: IDebugPanelManagerLike;
  getSystemStatus(): unknown;
  requestLatestState(): void;

  // Stats aggregation
  getTerminalStats(): unknown;
  getAgentStats(): unknown;
  getEventStats(): unknown;
  getApiDiagnostics(): unknown;

  // Notifications
  showWarning(message: string): void;
  notificationManager: { showWarning(message: string): void };
}

export class DebugCoordinator {
  constructor(private readonly deps: IDebugCoordinatorDependencies) {}

  /**
   * Update debug display with current state information
   */
  public updateDebugDisplay(state: TerminalState, operation?: string): void {
    if (operation) {
      log(`🔍 [DEBUG] Display update triggered by: ${operation}`);
    }
    this.deps.debugPanelManager.updateDisplay(state, operation);
  }

  /**
   * Toggle debug panel visibility
   */
  public toggleDebugPanel(currentState: TerminalState | undefined): void {
    this.deps.debugPanelManager.toggle(currentState);
    if (this.deps.debugPanelManager.isActive() && !currentState) {
      this.deps.requestLatestState();
    }
  }

  /**
   * Export system diagnostics for troubleshooting
   */
  public exportSystemDiagnostics(
    maxTerminals: number | string
  ): SystemDiagnostics {
    const diagnostics = this.deps.debugPanelManager.exportDiagnostics(
      this.deps.getSystemStatus(),
      maxTerminals
    );
    log('🔧 [DIAGNOSTICS] System diagnostics exported:', diagnostics);
    return diagnostics;
  }

  /**
   * Get aggregated manager statistics
   */
  public getManagerStats(): {
    terminals: unknown;
    cliAgents: unknown;
    events: unknown;
    api: unknown;
  } {
    return {
      terminals: this.deps.getTerminalStats(),
      cliAgents: this.deps.getAgentStats(),
      events: this.deps.getEventStats(),
      api: this.deps.getApiDiagnostics(),
    };
  }

  /**
   * Show terminal limit reached message
   */
  public showTerminalLimitMessage(current: number, max: number): void {
    const message = `Terminal limit reached (${current}/${max}). Delete a terminal to create new ones.`;
    this.deps.showWarning(message);
  }
}
