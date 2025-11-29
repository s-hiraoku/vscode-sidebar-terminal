/**
 * StateTracker - Generic State Tracking Utility
 *
 * Provides a type-safe, reusable state tracking mechanism
 * that consolidates common Set-based tracking patterns.
 *
 * Key Features:
 * - Type-safe generic implementation
 * - Optional TTL (Time-To-Live) for auto-expiring entries
 * - Event callbacks for state changes
 * - Statistics and debugging support
 *
 * @example
 * ```typescript
 * // Simple usage
 * const restoredTerminals = new StateTracker<string>();
 * restoredTerminals.add('terminal-1');
 * restoredTerminals.has('terminal-1'); // true
 *
 * // With TTL (auto-expire after 5 seconds)
 * const tempStates = new StateTracker<string>({ ttlMs: 5000 });
 * tempStates.add('temp-item');
 * // Item auto-expires after 5 seconds
 *
 * // With callbacks
 * const tracked = new StateTracker<string>({
 *   onAdd: (item) => console.log(`Added: ${item}`),
 *   onRemove: (item) => console.log(`Removed: ${item}`),
 * });
 * ```
 */

import { webview as log } from '../../utils/logger';

/**
 * Configuration options for StateTracker
 */
export interface StateTrackerOptions<T> {
  /** Time-to-live in milliseconds. If set, items auto-expire after this duration */
  ttlMs?: number;
  /** Callback when an item is added */
  onAdd?: (item: T) => void;
  /** Callback when an item is removed */
  onRemove?: (item: T) => void;
  /** Enable debug logging */
  debug?: boolean;
  /** Name for debug logging */
  name?: string;
}

/**
 * Entry with timestamp for TTL tracking
 */
interface TrackedEntry<T> {
  item: T;
  addedAt: number;
  expiresAt?: number;
}

/**
 * StateTracker - Generic state tracking with optional TTL and callbacks
 */
export class StateTracker<T> {
  private readonly entries = new Map<T, TrackedEntry<T>>();
  private readonly options: StateTrackerOptions<T>;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options: StateTrackerOptions<T> = {}) {
    this.options = options;

    // Start cleanup timer if TTL is enabled
    if (options.ttlMs && options.ttlMs > 0) {
      this.startCleanupTimer();
    }

    this.log('StateTracker initialized');
  }

  /**
   * Add an item to the tracker
   * @returns true if item was newly added, false if already existed
   */
  public add(item: T): boolean {
    if (this.entries.has(item)) {
      // Update expiry time if TTL is set
      if (this.options.ttlMs) {
        const entry = this.entries.get(item);
        if (entry) {
          entry.expiresAt = Date.now() + this.options.ttlMs;
        }
      }
      return false;
    }

    const entry: TrackedEntry<T> = {
      item,
      addedAt: Date.now(),
      expiresAt: this.options.ttlMs ? Date.now() + this.options.ttlMs : undefined,
    };

    this.entries.set(item, entry);
    this.log(`Added: ${this.itemToString(item)}`);
    this.options.onAdd?.(item);
    return true;
  }

  /**
   * Check if an item is in the tracker
   */
  public has(item: T): boolean {
    const entry = this.entries.get(item);
    if (!entry) return false;

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.remove(item);
      return false;
    }

    return true;
  }

  /**
   * Remove an item from the tracker
   * @returns true if item was removed, false if not found
   */
  public remove(item: T): boolean {
    if (!this.entries.has(item)) {
      return false;
    }

    this.entries.delete(item);
    this.log(`Removed: ${this.itemToString(item)}`);
    this.options.onRemove?.(item);
    return true;
  }

  /**
   * Get all tracked items
   */
  public getAll(): T[] {
    this.cleanupExpired();
    return Array.from(this.entries.keys());
  }

  /**
   * Get the number of tracked items
   */
  public get size(): number {
    this.cleanupExpired();
    return this.entries.size;
  }

  /**
   * Clear all tracked items
   */
  public clear(): void {
    const items = Array.from(this.entries.keys());
    this.entries.clear();
    this.log('Cleared all entries');

    // Call onRemove for each item
    if (this.options.onRemove) {
      for (const item of items) {
        this.options.onRemove(item);
      }
    }
  }

  /**
   * Get statistics about tracked items
   */
  public getStats(): {
    total: number;
    oldest?: { item: T; age: number };
    newest?: { item: T; age: number };
  } {
    this.cleanupExpired();

    if (this.entries.size === 0) {
      return { total: 0 };
    }

    const now = Date.now();
    let oldest: { item: T; age: number } | undefined;
    let newest: { item: T; age: number } | undefined;

    for (const [item, entry] of this.entries) {
      const age = now - entry.addedAt;

      if (!oldest || age > oldest.age) {
        oldest = { item, age };
      }
      if (!newest || age < newest.age) {
        newest = { item, age };
      }
    }

    return {
      total: this.entries.size,
      oldest,
      newest,
    };
  }

  /**
   * Add multiple items at once
   */
  public addAll(items: T[]): number {
    let addedCount = 0;
    for (const item of items) {
      if (this.add(item)) {
        addedCount++;
      }
    }
    return addedCount;
  }

  /**
   * Remove multiple items at once
   */
  public removeAll(items: T[]): number {
    let removedCount = 0;
    for (const item of items) {
      if (this.remove(item)) {
        removedCount++;
      }
    }
    return removedCount;
  }

  /**
   * Check if any of the given items are tracked
   */
  public hasAny(items: T[]): boolean {
    return items.some((item) => this.has(item));
  }

  /**
   * Check if all of the given items are tracked
   */
  public hasAll(items: T[]): boolean {
    return items.every((item) => this.has(item));
  }

  /**
   * Dispose the tracker and cleanup resources
   */
  public dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.entries.clear();
    this.log('StateTracker disposed');
  }

  /**
   * Start the cleanup timer for TTL-based expiration
   */
  private startCleanupTimer(): void {
    // Run cleanup at half the TTL interval for responsive expiration
    const interval = Math.max(1000, (this.options.ttlMs ?? 0) / 2);
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, interval);
  }

  /**
   * Remove expired entries
   */
  private cleanupExpired(): void {
    if (!this.options.ttlMs) return;

    const now = Date.now();
    const expired: T[] = [];

    for (const [item, entry] of this.entries) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expired.push(item);
      }
    }

    for (const item of expired) {
      this.remove(item);
    }
  }

  /**
   * Convert item to string for logging
   */
  private itemToString(item: T): string {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }

  /**
   * Log message if debug is enabled
   */
  private log(message: string): void {
    if (this.options.debug) {
      const prefix = this.options.name ? `[StateTracker:${this.options.name}]` : '[StateTracker]';
      log(`${prefix} ${message}`);
    }
  }
}

/**
 * Create a simple boolean state tracker (like a Set<string> for IDs)
 */
export function createIdTracker(
  options?: Omit<StateTrackerOptions<string>, 'name'> & { name?: string }
): StateTracker<string> {
  return new StateTracker<string>(options);
}

/**
 * Create a state tracker with automatic expiration
 */
export function createExpiringTracker<T>(
  ttlMs: number,
  options?: Omit<StateTrackerOptions<T>, 'ttlMs'>
): StateTracker<T> {
  return new StateTracker<T>({ ...options, ttlMs });
}
