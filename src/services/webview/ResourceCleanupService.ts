import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';

/**
 * Manages resource cleanup and disposal
 *
 * This service extracts resource management from SecondaryTerminalProvider
 * to provide a clean separation of concerns and ensure proper cleanup.
 */
export class ResourceCleanupService {
  private disposables: vscode.Disposable[] = [];
  private terminalEventDisposables: vscode.Disposable[] = [];

  constructor() {
    log('🧹 [CleanupService] Resource cleanup service created');
  }

  /**
   * Add a disposable to be managed
   */
  addDisposable(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }

  /**
   * Add a terminal event disposable
   */
  addTerminalEventDisposable(disposable: vscode.Disposable): void {
    this.terminalEventDisposables.push(disposable);
  }

  /**
   * Clear terminal event listeners
   */
  clearTerminalEventListeners(): void {
    log('🧹 [CleanupService] Clearing terminal event listeners...');

    for (const disposable of this.terminalEventDisposables) {
      try {
        disposable.dispose();
      } catch (error) {
        log('⚠️ [CleanupService] Error disposing terminal event listener:', error);
      }
    }

    this.terminalEventDisposables = [];
    log('✅ [CleanupService] Terminal event listeners cleared');
  }

  /**
   * Get all disposables for external management
   */
  getDisposables(): vscode.Disposable[] {
    return this.disposables;
  }

  /**
   * Get terminal event disposables
   */
  getTerminalEventDisposables(): vscode.Disposable[] {
    return this.terminalEventDisposables;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    log('🧹 [CleanupService] Disposing all resources...');

    // Clear terminal event listeners first
    this.clearTerminalEventListeners();

    // Dispose all other disposables
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        log('⚠️ [CleanupService] Error disposing resource:', error);
      }
    }

    this.disposables = [];
    log('✅ [CleanupService] All resources disposed');
  }
}
