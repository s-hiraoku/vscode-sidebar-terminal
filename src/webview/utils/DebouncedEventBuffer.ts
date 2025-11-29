/**
 * DebouncedEventBuffer - Generic Debounced Event/Data Buffering Utility
 *
 * Consolidates common debouncing and buffering patterns used across the codebase.
 * Provides type-safe, reusable implementations for:
 * - Simple debouncing (delay execution until input stops)
 * - Throttling (limit execution rate)
 * - Event buffering with batch processing
 *
 * @example
 * ```typescript
 * // Simple debounce
 * const debouncedResize = new Debouncer(() => {
 *   refitTerminals();
 * }, { delay: 100 });
 *
 * window.addEventListener('resize', () => debouncedResize.trigger());
 *
 * // Event buffer with batch processing
 * const outputBuffer = new EventBuffer<string>({
 *   flushInterval: 16,
 *   maxBufferSize: 100,
 *   onFlush: (items) => terminal.write(items.join('')),
 * });
 *
 * outputBuffer.add(data);
 * ```
 */

import { webview as log } from '../../utils/logger';

/**
 * Debouncer - Simple debounce utility
 */
export interface DebouncerOptions {
  /** Delay in milliseconds before executing */
  delay: number;
  /** If true, execute immediately on first call, then debounce */
  leading?: boolean;
  /** If true, execute after the delay (default: true) */
  trailing?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Name for debug logging */
  name?: string;
}

/**
 * Simple debouncer for delaying execution
 */
export class Debouncer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastCallTime = 0;
  private isLeadingExecuted = false;

  constructor(
    private readonly callback: () => void,
    private readonly options: DebouncerOptions
  ) {
    // Default trailing to true
    if (this.options.trailing === undefined) {
      this.options.trailing = true;
    }
  }

  /**
   * Trigger the debounced callback
   */
  public trigger(): void {
    const now = Date.now();

    // Handle leading edge execution
    if (this.options.leading && !this.isLeadingExecuted) {
      this.isLeadingExecuted = true;
      this.log('Executing (leading edge)');
      this.callback();
    }

    // Clear existing timer
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    // Set up trailing edge execution
    if (this.options.trailing) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.isLeadingExecuted = false;
        this.log('Executing (trailing edge)');
        this.callback();
      }, this.options.delay);
    }

    this.lastCallTime = now;
  }

  /**
   * Cancel any pending execution
   */
  public cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isLeadingExecuted = false;
    this.log('Cancelled');
  }

  /**
   * Execute immediately and cancel any pending execution
   */
  public flush(): void {
    this.cancel();
    this.log('Flushing immediately');
    this.callback();
  }

  /**
   * Check if there's a pending execution
   */
  public isPending(): boolean {
    return this.timer !== null;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.cancel();
    this.log('Disposed');
  }

  private log(message: string): void {
    if (this.options.debug) {
      const prefix = this.options.name ? `[Debouncer:${this.options.name}]` : '[Debouncer]';
      log(`${prefix} ${message}`);
    }
  }
}

/**
 * Throttler - Limit execution rate
 */
export interface ThrottlerOptions {
  /** Minimum interval between executions in milliseconds */
  interval: number;
  /** If true, execute on leading edge (default: true) */
  leading?: boolean;
  /** If true, execute on trailing edge (default: true) */
  trailing?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Name for debug logging */
  name?: string;
}

/**
 * Throttler for limiting execution rate
 */
export class Throttler {
  private lastExecuteTime = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingArgs: unknown[] | null = null;

  constructor(
    private readonly callback: (...args: unknown[]) => void,
    private readonly options: ThrottlerOptions
  ) {
    // Default leading and trailing to true
    if (this.options.leading === undefined) this.options.leading = true;
    if (this.options.trailing === undefined) this.options.trailing = true;
  }

  /**
   * Trigger the throttled callback
   */
  public trigger(...args: unknown[]): void {
    const now = Date.now();
    const timeSinceLastExecute = now - this.lastExecuteTime;

    if (timeSinceLastExecute >= this.options.interval) {
      // Can execute immediately
      if (this.options.leading) {
        this.lastExecuteTime = now;
        this.log('Executing (leading)');
        this.callback(...args);
      } else {
        // Schedule trailing execution
        this.pendingArgs = args;
        this.scheduleTrailing();
      }
    } else {
      // Within throttle window - schedule trailing if enabled
      if (this.options.trailing) {
        this.pendingArgs = args;
        this.scheduleTrailing();
      }
    }
  }

  private scheduleTrailing(): void {
    if (this.timer !== null) return;

    const delay = this.options.interval - (Date.now() - this.lastExecuteTime);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.pendingArgs !== null) {
        this.lastExecuteTime = Date.now();
        const args = this.pendingArgs;
        this.pendingArgs = null;
        this.log('Executing (trailing)');
        this.callback(...args);
      }
    }, Math.max(0, delay));
  }

  /**
   * Cancel any pending execution
   */
  public cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingArgs = null;
    this.log('Cancelled');
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.cancel();
    this.log('Disposed');
  }

  private log(message: string): void {
    if (this.options.debug) {
      const prefix = this.options.name ? `[Throttler:${this.options.name}]` : '[Throttler]';
      log(`${prefix} ${message}`);
    }
  }
}

/**
 * EventBuffer - Buffer events and flush in batches
 */
export interface EventBufferOptions<T> {
  /** Interval to flush buffer in milliseconds */
  flushInterval: number;
  /** Maximum buffer size before forced flush */
  maxBufferSize?: number;
  /** Callback when buffer is flushed */
  onFlush: (items: T[]) => void;
  /** If true, flush immediately when maxBufferSize is reached */
  flushOnMax?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Name for debug logging */
  name?: string;
}

/**
 * EventBuffer for batch processing of events
 */
export class EventBuffer<T> {
  private buffer: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: EventBufferOptions<T>) {
    // Default flushOnMax to true
    if (this.options.flushOnMax === undefined) {
      this.options.flushOnMax = true;
    }
  }

  /**
   * Add an item to the buffer
   */
  public add(item: T): void {
    this.buffer.push(item);
    this.log(`Added item (buffer size: ${this.buffer.length})`);

    // Check if we should flush due to max size
    if (
      this.options.flushOnMax &&
      this.options.maxBufferSize &&
      this.buffer.length >= this.options.maxBufferSize
    ) {
      this.log('Max buffer size reached, flushing');
      this.flush();
      return;
    }

    // Schedule flush if not already scheduled
    this.scheduleFlush();
  }

  /**
   * Add multiple items to the buffer
   */
  public addAll(items: T[]): void {
    for (const item of items) {
      this.add(item);
    }
  }

  /**
   * Flush the buffer immediately
   */
  public flush(): void {
    this.cancelTimer();

    if (this.buffer.length === 0) {
      return;
    }

    const items = this.buffer;
    this.buffer = [];

    this.log(`Flushing ${items.length} items`);
    this.options.onFlush(items);
  }

  /**
   * Clear the buffer without flushing
   */
  public clear(): void {
    this.cancelTimer();
    const count = this.buffer.length;
    this.buffer = [];
    this.log(`Cleared ${count} items`);
  }

  /**
   * Get current buffer size
   */
  public get size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is empty
   */
  public get isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Check if flush is scheduled
   */
  public get isFlushScheduled(): boolean {
    return this.timer !== null;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.flush(); // Flush remaining items
    this.cancelTimer();
    this.log('Disposed');
  }

  private scheduleFlush(): void {
    if (this.timer !== null) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.options.flushInterval);
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private log(message: string): void {
    if (this.options.debug) {
      const prefix = this.options.name ? `[EventBuffer:${this.options.name}]` : '[EventBuffer]';
      log(`${prefix} ${message}`);
    }
  }
}

/**
 * KeyedEventBuffer - Buffer events by key with individual flush handling
 */
export interface KeyedEventBufferOptions<T> {
  /** Interval to flush buffer in milliseconds */
  flushInterval: number;
  /** Maximum buffer size per key before forced flush */
  maxBufferSize?: number;
  /** Callback when a key's buffer is flushed */
  onFlush: (key: string, items: T[]) => void;
  /** If true, flush immediately when maxBufferSize is reached */
  flushOnMax?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Name for debug logging */
  name?: string;
}

/**
 * KeyedEventBuffer for buffering events by key
 */
export class KeyedEventBuffer<T> {
  private buffers = new Map<string, { items: T[]; timer: ReturnType<typeof setTimeout> | null }>();

  constructor(private readonly options: KeyedEventBufferOptions<T>) {
    if (this.options.flushOnMax === undefined) {
      this.options.flushOnMax = true;
    }
  }

  /**
   * Add an item to a specific key's buffer
   */
  public add(key: string, item: T): void {
    let entry = this.buffers.get(key);
    if (!entry) {
      entry = { items: [], timer: null };
      this.buffers.set(key, entry);
    }

    entry.items.push(item);
    this.log(`Added to ${key} (buffer size: ${entry.items.length})`);

    // Check if we should flush due to max size
    if (
      this.options.flushOnMax &&
      this.options.maxBufferSize &&
      entry.items.length >= this.options.maxBufferSize
    ) {
      this.log(`Max buffer size reached for ${key}, flushing`);
      this.flushKey(key);
      return;
    }

    // Schedule flush if not already scheduled
    this.scheduleFlush(key, entry);
  }

  /**
   * Flush a specific key's buffer
   */
  public flushKey(key: string): void {
    const entry = this.buffers.get(key);
    if (!entry || entry.items.length === 0) return;

    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    const items = entry.items;
    entry.items = [];

    this.log(`Flushing ${items.length} items for ${key}`);
    this.options.onFlush(key, items);
  }

  /**
   * Flush all buffers
   */
  public flushAll(): void {
    for (const key of this.buffers.keys()) {
      this.flushKey(key);
    }
  }

  /**
   * Clear a specific key's buffer without flushing
   */
  public clearKey(key: string): void {
    const entry = this.buffers.get(key);
    if (entry) {
      if (entry.timer !== null) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      entry.items = [];
      this.log(`Cleared ${key}`);
    }
  }

  /**
   * Clear all buffers without flushing
   */
  public clearAll(): void {
    for (const [, entry] of this.buffers) {
      if (entry.timer !== null) {
        clearTimeout(entry.timer);
      }
    }
    this.buffers.clear();
    this.log('Cleared all');
  }

  /**
   * Get buffer size for a specific key
   */
  public getSize(key: string): number {
    return this.buffers.get(key)?.items.length ?? 0;
  }

  /**
   * Get all keys with buffers
   */
  public getKeys(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.flushAll();
    this.clearAll();
    this.log('Disposed');
  }

  private scheduleFlush(key: string, entry: { items: T[]; timer: ReturnType<typeof setTimeout> | null }): void {
    if (entry.timer !== null) return;

    entry.timer = setTimeout(() => {
      entry.timer = null;
      this.flushKey(key);
    }, this.options.flushInterval);
  }

  private log(message: string): void {
    if (this.options.debug) {
      const prefix = this.options.name ? `[KeyedEventBuffer:${this.options.name}]` : '[KeyedEventBuffer]';
      log(`${prefix} ${message}`);
    }
  }
}

/**
 * Factory functions for common use cases
 */

/**
 * Create a simple debouncer
 */
export function createDebouncer(callback: () => void, delay: number, options?: Partial<DebouncerOptions>): Debouncer {
  return new Debouncer(callback, { delay, ...options });
}

/**
 * Create a resize debouncer (common pattern)
 */
export function createResizeDebouncer(callback: () => void, delay = 100): Debouncer {
  return new Debouncer(callback, { delay, trailing: true, name: 'resize' });
}

/**
 * Create an output buffer (common pattern)
 */
export function createOutputBuffer<T>(
  onFlush: (items: T[]) => void,
  options?: Partial<EventBufferOptions<T>>
): EventBuffer<T> {
  return new EventBuffer<T>({
    flushInterval: 16, // ~60fps
    maxBufferSize: 100,
    onFlush,
    ...options,
  });
}
