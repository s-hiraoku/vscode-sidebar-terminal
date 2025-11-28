import * as vscode from 'vscode';

/**
 * DisposableStore - A utility class to manage multiple disposables
 *
 * This class follows VS Code's DisposableStore pattern to prevent memory leaks
 * by ensuring all event subscriptions and resources are properly disposed.
 *
 * Usage:
 * ```typescript
 * class MyClass {
 *   private readonly _disposables = new DisposableStore();
 *
 *   constructor() {
 *     this._disposables.add(vscode.workspace.onDidChangeConfiguration(...));
 *     this._disposables.add(vscode.window.onDidChangeActiveTerminal(...));
 *   }
 *
 *   dispose(): void {
 *     this._disposables.dispose();
 *   }
 * }
 * ```
 */
export class DisposableStore implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  /**
   * Add a disposable to the store
   * @param disposable The disposable to add
   * @returns The disposable that was added (for chaining)
   */
  public add<T extends vscode.Disposable>(disposable: T): T {
    if (this._isDisposed) {
      console.warn('[DisposableStore] Attempting to add disposable to already disposed store');
      disposable.dispose();
      return disposable;
    }

    this._disposables.push(disposable);
    return disposable;
  }

  /**
   * Remove and dispose a specific disposable from the store
   * @param disposable The disposable to remove
   */
  public remove(disposable: vscode.Disposable): void {
    const index = this._disposables.indexOf(disposable);
    if (index !== -1) {
      this._disposables.splice(index, 1);
      disposable.dispose();
    }
  }

  /**
   * Clear all disposables without disposing them
   * This is useful when you want to remove all disposables but they're managed elsewhere
   */
  public clear(): void {
    this._disposables = [];
  }

  /**
   * Dispose all disposables in the store
   */
  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;

    // Dispose all disposables in reverse order (LIFO)
    // This ensures proper cleanup order (last added, first disposed)
    for (let i = this._disposables.length - 1; i >= 0; i--) {
      const disposable = this._disposables[i];
      if (disposable) {
        try {
          disposable.dispose();
        } catch (error) {
          console.error('[DisposableStore] Error disposing item:', error);
        }
      }
    }

    this._disposables = [];
  }

  /**
   * Get the number of disposables in the store
   */
  public get size(): number {
    return this._disposables.length;
  }

  /**
   * Check if the store has been disposed
   */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }
}

/**
 * Helper function to create a disposable from a cleanup function
 * @param cleanup The cleanup function to run when disposed
 * @returns A disposable object
 */
export function toDisposable(cleanup: () => void): vscode.Disposable {
  return {
    dispose: cleanup,
  };
}

/**
 * Helper function to combine multiple disposables into one
 * @param disposables The disposables to combine
 * @returns A single disposable that disposes all the input disposables
 */
export function combineDisposables(...disposables: vscode.Disposable[]): vscode.Disposable {
  return {
    dispose: () => {
      for (const disposable of disposables) {
        if (disposable) {
          try {
            disposable.dispose();
          } catch (error) {
            console.error('[combineDisposables] Error disposing item:', error);
          }
        }
      }
    },
  };
}
