/**
 * Typed Event Bus for decoupled component communication
 *
 * Provides publish-subscribe pattern with type safety, automatic cleanup,
 * and debugging support through event replay.
 *
 * @example
 * ```typescript
 * const eventBus = new EventBus();
 * const TerminalCreated = createEventType<{id: string}>('terminal.created');
 *
 * const subscription = eventBus.subscribe(TerminalCreated, (event) => {
 *   console.log('Terminal created:', event.data.id);
 * });
 *
 * eventBus.publish(TerminalCreated, {id: '1'});
 * subscription.dispose();
 * ```
 */

import * as vscode from 'vscode';

/**
 * Event type identifier with associated data type
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class EventType<T> {
  constructor(public readonly name: string) {}
}

/**
 * Event handler function
 */
export type EventHandler<T> = (event: Event<T>) => void | Promise<void>;

/**
 * Event with metadata
 */
export interface Event<T> {
  /** Event type */
  readonly type: EventType<T>;
  /** Event data */
  readonly data: T;
  /** Timestamp when event was published */
  readonly timestamp: Date;
  /** Unique event ID */
  readonly id: string;
}

/**
 * Internal subscription record
 */
interface Subscription<T> {
  handler: EventHandler<T>;
  disposed: boolean;
}

/**
 * Event history entry for replay
 */
interface EventHistoryEntry {
  event: Event<unknown>;
  error?: Error;
}

/**
 * Create a typed event type identifier
 *
 * @param name Event type name (use dot notation for namespacing, e.g., 'terminal.created')
 * @returns Event type identifier
 *
 * @example
 * ```typescript
 * const TerminalCreatedEvent = createEventType<{id: string}>('terminal.created');
 * ```
 */
export function createEventType<T>(name: string): EventType<T> {
  return new EventType<T>(name);
}

/**
 * Typed Event Bus implementation
 */
export class EventBus implements vscode.Disposable {
  private readonly _subscriptions = new Map<string, Subscription<unknown>[]>();
  private readonly _eventHistory: EventHistoryEntry[] = [];
  private readonly _maxHistorySize: number;
  private _eventIdCounter = 0;
  private _isDisposed = false;

  constructor(options: { maxHistorySize?: number } = {}) {
    this._maxHistorySize = options.maxHistorySize ?? 1000;
  }

  /**
   * Subscribe to an event type
   *
   * @param eventType Event type to subscribe to
   * @param handler Event handler function
   * @returns Disposable subscription
   *
   * @example
   * ```typescript
   * const subscription = eventBus.subscribe(TerminalCreated, (event) => {
   *   console.log(event.data);
   * });
   * // Later...
   * subscription.dispose();
   * ```
   */
  subscribe<T>(eventType: EventType<T>, handler: EventHandler<T>): vscode.Disposable {
    this._ensureNotDisposed();

    const subscription: Subscription<T> = {
      handler,
      disposed: false,
    };

    // Get or create subscription list for this event type
    let subscriptions = this._subscriptions.get(eventType.name);
    if (!subscriptions) {
      subscriptions = [];
      this._subscriptions.set(eventType.name, subscriptions);
    }

    subscriptions.push(subscription as Subscription<unknown>);

    // Return disposable to unsubscribe
    return {
      dispose: () => {
        if (subscription.disposed) {
          return;
        }
        subscription.disposed = true;

        const subs = this._subscriptions.get(eventType.name);
        if (subs) {
          const index = subs.indexOf(subscription as Subscription<unknown>);
          if (index !== -1) {
            subs.splice(index, 1);
          }

          // Cleanup empty subscription lists
          if (subs.length === 0) {
            this._subscriptions.delete(eventType.name);
          }
        }
      },
    };
  }

  /**
   * Publish an event to all subscribers
   *
   * @param eventType Event type to publish
   * @param data Event data
   *
   * @example
   * ```typescript
   * eventBus.publish(TerminalCreated, {id: '1', name: 'Terminal 1'});
   * ```
   */
  publish<T>(eventType: EventType<T>, data: T): void {
    this._ensureNotDisposed();

    const event: Event<T> = {
      type: eventType,
      data,
      timestamp: new Date(),
      id: this._generateEventId(),
    };

    // Add to history
    this._addToHistory(event);

    // Get subscribers for this event type
    const subscriptions = this._subscriptions.get(eventType.name);
    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    // Notify all subscribers
    // Use slice() to avoid issues if handlers modify subscription list
    for (const subscription of subscriptions.slice()) {
      if (subscription.disposed) {
        continue;
      }

      try {
        const result = (subscription.handler as EventHandler<T>)(event);
        // Handle async handlers
        if (result && typeof result.then === 'function') {
          result.catch((error: Error) => {
            this._handleHandlerError(event, error);
          });
        }
      } catch (error) {
        this._handleHandlerError(event, error as Error);
      }
    }
  }

  /**
   * Get event history since a specific timestamp
   *
   * @param since Optional timestamp to filter events (defaults to all events)
   * @returns Array of events
   *
   * @example
   * ```typescript
   * const lastMinute = new Date(Date.now() - 60000);
   * const recentEvents = eventBus.replay(lastMinute);
   * ```
   */
  replay(since?: Date): Event<unknown>[] {
    this._ensureNotDisposed();

    if (!since) {
      return this._eventHistory.map((entry) => entry.event);
    }

    return this._eventHistory
      .filter((entry) => entry.event.timestamp >= since)
      .map((entry) => entry.event);
  }

  /**
   * Get the number of subscribers for an event type
   *
   * @param eventType Event type to check
   * @returns Number of subscribers
   */
  getSubscriberCount<T>(eventType: EventType<T>): number {
    const subscriptions = this._subscriptions.get(eventType.name);
    return subscriptions ? subscriptions.filter((s) => !s.disposed).length : 0;
  }

  /**
   * Get total number of active subscriptions
   */
  get totalSubscriptions(): number {
    let count = 0;
    for (const subscriptions of this._subscriptions.values()) {
      count += subscriptions.filter((s) => !s.disposed).length;
    }
    return count;
  }

  /**
   * Get event history size
   */
  get historySize(): number {
    return this._eventHistory.length;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this._eventHistory.length = 0;
  }

  /**
   * Dispose the event bus and cleanup all subscriptions
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    // Mark all subscriptions as disposed
    for (const subscriptions of this._subscriptions.values()) {
      for (const subscription of subscriptions) {
        subscription.disposed = true;
      }
    }

    this._subscriptions.clear();
    this._eventHistory.length = 0;
    this._isDisposed = true;
  }

  private _generateEventId(): string {
    return `evt_${++this._eventIdCounter}_${Date.now()}`;
  }

  private _addToHistory<T>(event: Event<T>): void {
    this._eventHistory.push({ event });

    // Maintain max history size (FIFO)
    if (this._eventHistory.length > this._maxHistorySize) {
      this._eventHistory.shift();
    }
  }

  private _handleHandlerError<T>(event: Event<T>, error: Error): void {
    // Log error but don't prevent other handlers from running
    console.error(`Error in event handler for ${event.type.name}:`, error);

    // Add error to history for debugging
    const historyEntry = this._eventHistory.find((entry) => entry.event.id === event.id);
    if (historyEntry) {
      historyEntry.error = error;
    }
  }

  private _ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('Cannot use disposed EventBus');
    }
  }
}
