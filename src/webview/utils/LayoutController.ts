/**
 * Layout Controller - VS Code GridView Pattern
 *
 * Controls when layout operations are enabled to prevent premature
 * layout calculations during initialization.
 *
 * Based on VS Code: src/vs/base/browser/ui/grid/gridview.ts
 */

/**
 * Layout Controller
 *
 * Manages layout initialization state to ensure layout operations
 * only execute after proper initialization is complete.
 *
 * Usage:
 * ```typescript
 * class MyManager {
 *   private layoutController = new LayoutController();
 *
 *   initialize() {
 *     // Do initialization work...
 *     this.layoutController.enableLayout();
 *   }
 *
 *   layout() {
 *     if (!this.layoutController.isLayoutEnabled) {
 *       return; // Skip layout during initialization
 *     }
 *     // Perform layout operations...
 *   }
 * }
 * ```
 */
export class LayoutController {
  private _isLayoutEnabled: boolean;

  /**
   * Create a new LayoutController
   *
   * @param initialState Initial state (default: false = disabled)
   */
  constructor(initialState: boolean = false) {
    this._isLayoutEnabled = initialState;
  }

  /**
   * Enable layout operations
   *
   * Call this after initialization is complete to allow layout
   * operations to execute.
   */
  public enableLayout(): void {
    this._isLayoutEnabled = true;
  }

  /**
   * Disable layout operations
   *
   * Temporarily disable layout (useful for batch operations)
   */
  public disableLayout(): void {
    this._isLayoutEnabled = false;
  }

  /**
   * Check if layout operations are currently enabled
   */
  public get isLayoutEnabled(): boolean {
    return this._isLayoutEnabled;
  }

  /**
   * Execute a callback only if layout is enabled
   *
   * Convenience method that checks state before execution.
   *
   * @param callback Function to execute if layout enabled
   * @returns Result of callback if executed, undefined otherwise
   */
  public executeIfEnabled<T>(callback: () => T): T | undefined {
    if (this._isLayoutEnabled) {
      return callback();
    }
    return undefined;
  }

  /**
   * Temporarily disable layout, execute callback, then restore state
   *
   * Useful for batch operations that should not trigger layout.
   *
   * @param callback Function to execute with layout disabled
   * @returns Result of callback
   */
  public withLayoutDisabled<T>(callback: () => T): T {
    const previousState = this._isLayoutEnabled;
    this._isLayoutEnabled = false;

    try {
      return callback();
    } finally {
      this._isLayoutEnabled = previousState;
    }
  }

  /**
   * Reset controller to initial state (disabled)
   */
  public reset(): void {
    this._isLayoutEnabled = false;
  }
}
