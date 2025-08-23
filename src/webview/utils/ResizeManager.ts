/**
 * ResizeManager Utility
 * 
 * Centralized debounced resize logic to eliminate code duplication
 * across TerminalLifecycleManager, PerformanceManager, and SplitManager
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
  private static DEFAULT_DELAY = 100;

  /**
   * Execute a resize callback with debouncing
   * @param key Unique identifier for this resize operation
   * @param callback The resize function to execute
   * @param options Resize configuration options
   */
  static debounceResize(
    key: string,
    callback: ResizeCallback,
    options: ResizeOptions = {}
  ): void {
    const { 
      delay = this.DEFAULT_DELAY, 
      immediate = false, 
      onStart, 
      onComplete 
    } = options;

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
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.debounceResize(
            `observer-${key}`,
            () => callback(entry),
            options
          );
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
      log(`🧹 ResizeManager: Observer removed for ${key}`);
    }
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
      observerKeys: this.getObserverKeys()
    };
  }
}

// ResizeObserverEntry is available as a global type