/**
 * ResizeManager Utility
 *
 * Centralized debounced resize logic to eliminate code duplication
 * across TerminalLifecycleCoordinator, PerformanceManager, and SplitManager
 */

import { webview as log } from '../../utils/logger';

export interface ResizeCallback {
  (): void | Promise<void>;
}

export interface ResizeOptions {
  delay?: number;
  immediate?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
}

/**
 * Centralized resize management utility
 * Provides debounced resize functionality with comprehensive cleanup
 */
export class ResizeManager {
  private static timers = new Map<string, number>();
  private static observers = new Map<string, ResizeObserver>();
  private static observerCallbacks = new Map<string, (entry: ResizeObserverEntry) => void>();
  private static firstCallbackSkip = new Map<string, boolean>();
  private static DEFAULT_DELAY = 100;
  private static paused = false;

  /**
   * Execute a resize callback with debouncing
   * @param key Unique identifier for this resize operation
   * @param callback The resize function to execute
   * @param options Resize configuration options
   */
  static debounceResize(key: string, callback: ResizeCallback, options: ResizeOptions = {}): void {
    const { delay = this.DEFAULT_DELAY, immediate = false, onStart, onComplete } = options;

    // Clear existing timer for this key
    this.clearResize(key);

    // Execute immediately if requested
    if (immediate) {
      this.executeResize(key, callback, onStart, onComplete);
      return;
    }

    // Call onStart callback if provided
    if (onStart) {
      try {
        onStart();
      } catch (error) {
        log(`❌ ResizeManager onStart error for ${key}:`, error);
      }
    }

    // Set up debounced execution
    const timer = window.setTimeout(() => {
      this.timers.delete(key);
      this.executeResize(key, callback, undefined, onComplete);
    }, delay);

    this.timers.set(key, timer);
    log(`⏱️ ResizeManager: Debounced resize scheduled for ${key} (${delay}ms)`);
  }

  /**
   * Execute resize callback immediately
   */
  private static async executeResize(
    key: string,
    callback: ResizeCallback,
    onStart?: () => void,
    onComplete?: () => void
  ): Promise<void> {
    try {
      if (onStart) {
        onStart();
      }

      await callback();

      if (onComplete) {
        onComplete();
      }

      log(`✅ ResizeManager: Resize completed for ${key}`);
    } catch (error) {
      log(`❌ ResizeManager: Resize failed for ${key}:`, error);
    }
  }

  /**
   * Clear pending resize operation for specific key
   * @param key The resize operation key to clear
   */
  static clearResize(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(key);
      log(`🧹 ResizeManager: Cleared resize timer for ${key}`);
    }
  }

  /**
   * Setup ResizeObserver for element with centralized management
   * @param key Unique identifier for this observer
   * @param element Element to observe
   * @param callback Callback to execute on resize
   * @param options Resize configuration options
   */
  static observeResize(
    key: string,
    element: Element,
    callback: (entry: ResizeObserverEntry) => void,
    options: ResizeOptions = {}
  ): void {
    // Clean up existing observer
    this.unobserveResize(key);

    try {
      // Store callback for potential resume
      this.observerCallbacks.set(key, callback);

      // Mark to skip first callback (common pattern to avoid initial resize)
      this.firstCallbackSkip.set(key, true);

      const observer = new ResizeObserver((entries) => {
        // Skip if globally paused
        if (this.paused) {
          log(`⏸️ ResizeManager: Observer ${key} paused, skipping callback`);
          return;
        }

        for (const entry of entries) {
          // Skip first callback to avoid initial resize during creation
          if (this.firstCallbackSkip.get(key)) {
            this.firstCallbackSkip.set(key, false);
            log(`⏭️ ResizeManager: Skipped first callback for ${key}`);
            continue;
          }

          this.debounceResize(`observer-${key}`, () => callback(entry), options);
        }
      });

      observer.observe(element);
      this.observers.set(key, observer);

      log(`👁️ ResizeManager: Observer setup for ${key}`);
    } catch (error) {
      log(`❌ ResizeManager: Failed to setup observer for ${key}:`, error);
    }
  }

  /**
   * Remove ResizeObserver for specific key
   * @param key The observer key to remove
   */
  static unobserveResize(key: string): void {
    const observer = this.observers.get(key);
    if (observer) {
      observer.disconnect();
      this.observers.delete(key);
      this.observerCallbacks.delete(key);
      this.firstCallbackSkip.delete(key);
      log(`🧹 ResizeManager: Observer removed for ${key}`);
    }
  }

  /**
   * Pause all ResizeObservers temporarily
   * Useful during terminal creation to prevent premature resize triggers
   */
  static pauseObservers(): void {
    if (!this.paused) {
      this.paused = true;
      log(`⏸️ ResizeManager: All observers paused (${this.observers.size} active)`);
    }
  }

  /**
   * Resume all ResizeObservers
   */
  static resumeObservers(): void {
    if (this.paused) {
      this.paused = false;
      log(`▶️ ResizeManager: All observers resumed (${this.observers.size} active)`);
    }
  }

  /**
   * Check if observers are currently paused
   */
  static isPaused(): boolean {
    return this.paused;
  }

  /**
   * Check if a resize operation is pending
   * @param key The resize operation key to check
   */
  static isPending(key: string): boolean {
    return this.timers.has(key);
  }

  /**
   * Get all pending resize operation keys
   */
  static getPendingKeys(): string[] {
    return Array.from(this.timers.keys());
  }

  /**
   * Get all active observer keys
   */
  static getObserverKeys(): string[] {
    return Array.from(this.observers.keys());
  }

  /**
   * Force execute all pending resize operations immediately
   */
  static flushAll(): void {
    const pendingKeys = this.getPendingKeys();
    log(`🚀 ResizeManager: Flushing ${pendingKeys.length} pending operations`);

    for (const key of pendingKeys) {
      const timer = this.timers.get(key);
      if (timer) {
        window.clearTimeout(timer);
        this.timers.delete(key);
      }
    }
  }

  /**
   * Clean up all resize operations and observers
   * Call this on disposal to prevent memory leaks
   */
  static dispose(): void {
    // Clear all timers
    for (const [, timer] of this.timers) {
      window.clearTimeout(timer);
    }
    this.timers.clear();

    // Disconnect all observers
    for (const [, observer] of this.observers) {
      observer.disconnect();
    }
    this.observers.clear();
    this.observerCallbacks.clear();
    this.firstCallbackSkip.clear();
    this.paused = false;

    log('🧹 ResizeManager: Disposed all resources');
  }

  /**
   * Get current status for debugging
   */
  static getStatus(): {
    pendingTimers: number;
    activeObservers: number;
    pendingKeys: string[];
    observerKeys: string[];
  } {
    return {
      pendingTimers: this.timers.size,
      activeObservers: this.observers.size,
      pendingKeys: this.getPendingKeys(),
      observerKeys: this.getObserverKeys(),
    };
  }
}

// ResizeObserverEntry is available as a global type
