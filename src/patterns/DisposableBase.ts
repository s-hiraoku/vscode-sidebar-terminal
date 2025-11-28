/**
 * DisposableBase Class
 *
 * Provides a consistent disposal pattern implementation across the extension.
 * This base class ensures:
 * - LIFO (Last-In-First-Out) disposal order for proper dependency cleanup
 * - Double-disposal protection
 * - Separation of disposables and cleanup actions
 * - Memory leak prevention with Map/Set clearing
 *
 * Usage:
 * ```typescript
 * export class MyManager extends DisposableBase {
 *   private readonly cache = new Map<string, unknown>();
 *
 *   constructor() {
 *     super();
 *
 *     // Register disposable (e.g., event listeners)
 *     this.registerDisposable(
 *       vscode.workspace.onDidChangeConfiguration(this.handleChange)
 *     );
 *
 *     // Register cleanup action for collections
 *     this.registerCleanup(() => this.cache.clear());
 *   }
 *
 *   protected doDispose(): void {
 *     // Additional custom cleanup if needed
 *   }
 * }
 * ```
 */

import * as vscode from 'vscode';

/**
 * Interface for objects that can be disposed
 */
export interface IDisposable {
  dispose(): void;
}

/**
 * Abstract base class for managing disposal of resources.
 * Implements the Disposable pattern with enhanced features.
 */
export abstract class DisposableBase implements vscode.Disposable {
  private _disposed = false;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _cleanupActions: Array<() => void> = [];

  protected constructor() {
    // Protected constructor to ensure proper inheritance
  }

  /**
   * Register a disposable resource to be disposed when this object is disposed.
   * Disposables are disposed in reverse order (LIFO).
   *
   * @param disposable - The disposable resource to register
   * @returns The registered disposable (for chaining)
   */
  protected registerDisposable<T extends vscode.Disposable>(disposable: T): T {
    if (this._disposed) {
      // If already disposed, dispose immediately
      try {
        disposable.dispose();
      } catch {
        // Ignore errors during immediate disposal
      }
      return disposable;
    }
    this._disposables.push(disposable);
    return disposable;
  }

  /**
   * Register multiple disposables at once.
   *
   * @param disposables - Array of disposables to register
   */
  protected registerDisposables(...disposables: vscode.Disposable[]): void {
    for (const disposable of disposables) {
      this.registerDisposable(disposable);
    }
  }

  /**
   * Register a cleanup action to be executed during disposal.
   * Cleanup actions are executed after all disposables are disposed.
   * Use this for clearing Maps, Sets, arrays, and other non-disposable resources.
   *
   * @param cleanup - The cleanup function to register
   */
  protected registerCleanup(cleanup: () => void): void {
    if (this._disposed) {
      // If already disposed, execute immediately
      try {
        cleanup();
      } catch {
        // Ignore errors during immediate cleanup
      }
      return;
    }
    this._cleanupActions.push(cleanup);
  }

  /**
   * Check if this object has been disposed.
   *
   * @returns true if disposed
   */
  public isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Throw an error if this object has been disposed.
   * Use this at the start of methods that shouldn't be called after disposal.
   *
   * @param methodName - The name of the method being called (for error message)
   */
  protected throwIfDisposed(methodName?: string): void {
    if (this._disposed) {
      const message = methodName
        ? `Cannot call ${methodName} on disposed ${this.constructor.name}`
        : `${this.constructor.name} has been disposed`;
      throw new Error(message);
    }
  }

  /**
   * Dispose of all registered resources and run cleanup actions.
   * Safe to call multiple times - subsequent calls are no-ops.
   */
  public dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Dispose in reverse order (LIFO) for proper dependency cleanup
    for (let i = this._disposables.length - 1; i >= 0; i--) {
      try {
        this._disposables[i].dispose();
      } catch (error) {
        // Log but don't throw - we want to dispose everything
        console.error(`Error disposing resource in ${this.constructor.name}:`, error);
      }
    }

    // Run cleanup actions
    for (const cleanup of this._cleanupActions) {
      try {
        cleanup();
      } catch (error) {
        // Log but don't throw
        console.error(`Error during cleanup in ${this.constructor.name}:`, error);
      }
    }

    // Clear internal arrays
    this._disposables.length = 0;
    this._cleanupActions.length = 0;

    // Allow subclasses to perform additional cleanup
    try {
      this.doDispose();
    } catch (error) {
      console.error(`Error in doDispose for ${this.constructor.name}:`, error);
    }
  }

  /**
   * Override this method in subclasses to perform additional cleanup.
   * Called after all registered disposables and cleanup actions have been processed.
   * This method is guaranteed to only be called once.
   */
  protected abstract doDispose(): void;

  /**
   * Get the number of registered disposables (for debugging).
   */
  protected get disposableCount(): number {
    return this._disposables.length;
  }

  /**
   * Get the number of registered cleanup actions (for debugging).
   */
  protected get cleanupActionCount(): number {
    return this._cleanupActions.length;
  }
}

/**
 * A simple disposable implementation for cleanup functions.
 * Useful for creating disposables from arbitrary cleanup logic.
 */
export class DisposableCallback implements vscode.Disposable {
  private _disposed = false;
  private _callback: (() => void) | null;

  constructor(callback: () => void) {
    this._callback = callback;
  }

  public dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;

    if (this._callback) {
      try {
        this._callback();
      } finally {
        this._callback = null;
      }
    }
  }

  public isDisposed(): boolean {
    return this._disposed;
  }
}

/**
 * Create a disposable from a cleanup function.
 *
 * @param cleanup - The cleanup function
 * @returns A Disposable that will call the cleanup function when disposed
 */
export function toDisposable(cleanup: () => void): vscode.Disposable {
  return new DisposableCallback(cleanup);
}
