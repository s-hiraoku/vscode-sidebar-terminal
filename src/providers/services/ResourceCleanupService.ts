import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { WebviewMessage } from '../../types/common';

/**
 * ResourceCleanupService
 *
 * Manages the lifecycle of disposable resources in the SecondaryTerminalProvider.
 * This service implements the Disposable pattern and ensures proper cleanup
 * of all resources when the provider is disposed.
 *
 * Responsibilities:
 * - Track all disposable resources
 * - Dispose of resources in proper order
 * - Clear references to prevent memory leaks
 * - Send cleanup notifications to WebView
 *
 * Part of Issue #214 refactoring to apply Facade pattern
 */
export class ResourceCleanupService implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  /**
   * Callbacks for cleanup operations
   */
  private _cleanupCallbacks: Array<() => void | Promise<void>> = [];

  /**
   * Add a disposable resource to be cleaned up later
   *
   * @param disposable The disposable resource to track
   */
  public addDisposable(disposable: vscode.Disposable): void {
    if (this._isDisposed) {
      log('⚠️ [CLEANUP] Cannot add disposable, service already disposed');
      disposable.dispose();
      return;
    }
    this._disposables.push(disposable);
  }

  /**
   * Add multiple disposable resources at once
   *
   * @param disposables Array of disposable resources to track
   */
  public addDisposables(...disposables: vscode.Disposable[]): void {
    disposables.forEach((d) => this.addDisposable(d));
  }

  /**
   * Register a cleanup callback to be executed during disposal
   *
   * Callbacks are executed in LIFO order (last registered, first executed)
   * to ensure proper cleanup of dependent resources
   *
   * @param callback Function to execute during cleanup
   */
  public registerCleanupCallback(callback: () => void | Promise<void>): void {
    if (this._isDisposed) {
      log('⚠️ [CLEANUP] Cannot register callback, service already disposed');
      return;
    }
    this._cleanupCallbacks.push(callback);
  }

  /**
   * Get the number of tracked disposables
   */
  public getDisposableCount(): number {
    return this._disposables.length;
  }

  /**
   * Check if the service has been disposed
   */
  public isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of all tracked resources
   *
   * This method:
   * 1. Executes all registered cleanup callbacks
   * 2. Disposes all tracked disposable resources
   * 3. Clears all references
   * 4. Marks the service as disposed
   */
  public dispose(): void {
    if (this._isDisposed) {
      log('⚠️ [CLEANUP] Service already disposed, skipping');
      return;
    }

    log('🔧 [CLEANUP] ResourceCleanupService disposing resources...');
    log(`🔧 [CLEANUP] Disposing ${this._disposables.length} disposables`);
    log(`🔧 [CLEANUP] Executing ${this._cleanupCallbacks.length} cleanup callbacks`);

    // Execute cleanup callbacks in LIFO order
    const callbacks = [...this._cleanupCallbacks].reverse();
    for (const callback of callbacks) {
      try {
        const result = callback();
        if (result instanceof Promise) {
          // Fire and forget for async callbacks
          result.catch((error) => log(`⚠️ [CLEANUP] Async cleanup callback failed: ${error}`));
        }
      } catch (error) {
        log(`⚠️ [CLEANUP] Cleanup callback failed: ${error}`);
      }
    }

    // Dispose all tracked disposables
    for (const disposable of this._disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        log(`⚠️ [CLEANUP] Failed to dispose resource: ${error}`);
      }
    }

    // Clear all arrays
    this._disposables.length = 0;
    this._cleanupCallbacks.length = 0;

    // Mark as disposed
    this._isDisposed = true;

    log('✅ [CLEANUP] ResourceCleanupService disposed successfully');
  }

  /**
   * Create a cleanup message for the WebView
   *
   * This message instructs the WebView to save terminal sessions
   * before the provider is disposed
   */
  public createWebViewCleanupMessage(): WebviewMessage {
    return {
      command: 'saveAllTerminalSessions',
      timestamp: Date.now(),
    };
  }
}
