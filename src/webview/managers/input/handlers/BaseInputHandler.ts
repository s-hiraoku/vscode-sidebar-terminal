/**
 * BaseInputHandler - Base class for all input handlers
 * Eliminates code duplication identified by similarity analysis
 * Provides common functionality for event management, state tracking, and disposal
 */

import { BaseManager } from '../../BaseManager';
import { EventHandlerRegistry } from '../../../utils/EventHandlerRegistry';
import { IInputHandler } from '../interfaces/IInputHandlers';

/**
 * Common input handler configuration
 */
export interface InputHandlerConfig {
  enableDebouncing?: boolean;
  debounceDelay?: number;
  enableStateTracking?: boolean;
  enableEventPrevention?: boolean;
}

/**
 * Event handler entry for centralized management
 */
interface EventHandlerEntry {
  id: string;
  element: EventTarget;
  eventType: string;
  handler: EventListener;
  options?: AddEventListenerOptions;
  debounced?: boolean;
}

/**
 * Base input handler class that provides common functionality
 * Identified patterns: 92% similarity in event registration and state management
 */
export abstract class BaseInputHandler extends BaseManager implements IInputHandler {
  // Event handler registry for centralized event management
  protected readonly eventRegistry = new EventHandlerRegistry();

  // Configuration for this handler
  protected readonly config: Required<InputHandlerConfig>;

  // Event debounce timers (shared reference from parent)
  protected eventDebounceTimers: Map<string, number>;

  // Registered event handlers for tracking and cleanup
  private registeredHandlers = new Map<string, EventHandlerEntry>();

  // Handler state for debugging and validation
  protected handlerState = new Map<string, unknown>();

  // Handler-specific metrics
  protected metrics = {
    eventsRegistered: 0,
    eventsProcessed: 0,
    eventsDebounced: 0,
    lastEventTimestamp: 0,
  };

  constructor(
    handlerName: string,
    eventDebounceTimers: Map<string, number>,
    config: InputHandlerConfig = {}
  ) {
    super(handlerName, {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.eventDebounceTimers = eventDebounceTimers;

    // Set default configuration
    this.config = {
      enableDebouncing: true,
      debounceDelay: 50,
      enableStateTracking: true,
      enableEventPrevention: false,
      ...config,
    };

    this.logger('initialization', 'starting');
  }

  /**
   * Register event handler with centralized management and debouncing
   * Eliminates duplicate event registration patterns (85% similarity)
   */
  protected registerEventHandler(
    id: string,
    element: EventTarget,
    eventType: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
    enableDebounce = false
  ): void {
    // Check for duplicate registration
    if (this.registeredHandlers.has(id)) {
      this.logger(`Event handler ${id} already registered, skipping`);
      return;
    }

    let finalHandler = handler;

    // Use unique ID per manager to avoid collisions in shared timers map
    const uniqueId = `${this.managerName}-${id}`;

    // Add debouncing if enabled
    if (enableDebounce && this.config.enableDebouncing) {
      finalHandler = this.createDebouncedHandler(uniqueId, handler);
    }

    // Add state tracking wrapper
    if (this.config.enableStateTracking) {
      finalHandler = this.createStateTrackingHandler(uniqueId, finalHandler);
    }

    // Add error handling wrapper
    finalHandler = this.createErrorHandlingWrapper(uniqueId, finalHandler);

    // Register with EventHandlerRegistry
    this.eventRegistry.register(id, element, eventType, finalHandler, options);

    // Track registration
    this.registeredHandlers.set(id, {
      id,
      element,
      eventType,
      handler: finalHandler,
      options,
      debounced: enableDebounce,
    });

    this.metrics.eventsRegistered++;
    this.logger(`Registered event handler: ${id} (${eventType}) - debounced: ${enableDebounce}`);
  }

  /**
   * Create debounced event handler
   * Eliminates duplicate debouncing logic (88% similarity)
   */
  private createDebouncedHandler(id: string, handler: EventListener): EventListener {
    return (event: Event): void => {
      const debounceKey = `${id}-debounce`;

      // Clear existing timer
      if (this.eventDebounceTimers.has(debounceKey)) {
        clearTimeout(this.eventDebounceTimers.get(debounceKey)!);
      }

      // Set new timer
      const timer = window.setTimeout(() => {
        handler(event);
        this.eventDebounceTimers.delete(debounceKey);
        this.metrics.eventsDebounced++;
      }, this.config.debounceDelay);

      this.eventDebounceTimers.set(debounceKey, timer);
    };
  }

  /**
   * Create state tracking wrapper for event handlers
   */
  private createStateTrackingHandler(id: string, handler: EventListener): EventListener {
    return (event: Event): void => {
      // Track event processing
      this.handlerState.set(`${id}-lastEvent`, {
        type: event.type,
        timestamp: Date.now(),
        target: event.target,
      });

      this.metrics.eventsProcessed++;
      this.metrics.lastEventTimestamp = Date.now();

      // Call original handler
      handler(event);
    };
  }

  /**
   * Create error handling wrapper
   * Eliminates duplicate error handling patterns (90% similarity)
   */
  private createErrorHandlingWrapper(id: string, handler: EventListener): EventListener {
    return (event: Event): void => {
      try {
        handler(event);
      } catch (error) {
        this.logger(`Error in event handler ${id}: ${error}`);

        // Prevent event propagation on error if configured
        if (this.config.enableEventPrevention) {
          event.preventDefault();
          event.stopPropagation();
        }

        // Track error state
        if (this.config.enableStateTracking) {
          this.handlerState.set(`${id}-lastError`, {
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
            eventType: event.type,
          });
        }
      }
    };
  }

  /**
   * Unregister specific event handler
   */
  protected unregisterEventHandler(id: string): void {
    const entry = this.registeredHandlers.get(id);
    if (entry) {
      // Clear any pending debounce timers
      const uniqueId = `${this.managerName}-${id}`;
      const debounceKey = `${uniqueId}-debounce`;
      if (this.eventDebounceTimers.has(debounceKey)) {
        clearTimeout(this.eventDebounceTimers.get(debounceKey)!);
        this.eventDebounceTimers.delete(debounceKey);
      }

      this.eventRegistry.unregister(id);
      this.registeredHandlers.delete(id);
      this.logger(`Unregistered event handler: ${id}`);
    }
  }

  /**
   * Check if handler is in a valid state
   */
  protected isHandlerHealthy(): boolean {
    const now = Date.now();
    const timeSinceLastEvent = now - this.metrics.lastEventTimestamp;

    // Consider healthy if events processed recently or no events expected
    return this.metrics.eventsProcessed === 0 || timeSinceLastEvent < 30000; // 30 seconds
  }

  /**
   * Get handler metrics for debugging
   */
  public getHandlerMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get handler state for debugging
   */
  public getHandlerState(): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (const [key, value] of this.handlerState) {
      // Return a deep copy to prevent external modification
      state[key] = typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value;
    }
    return state;
  }

  /**
   * Clear all debounce timers for this handler
   */
  protected clearAllDebounceTimers(): void {
    for (const [key, timer] of this.eventDebounceTimers) {
      if (key.includes(this.managerName)) {
        clearTimeout(timer);
        this.eventDebounceTimers.delete(key);
      }
    }
  }

  /**
   * Initialize the handler (abstract - must be implemented by subclasses)
   */
  protected abstract override doInitialize(): void;

  /**
   * Dispose handler resources (enhanced base implementation)
   */
  protected doDispose(): void {
    this.logger('disposal', 'starting');

    // Clear all debounce timers
    this.clearAllDebounceTimers();

    // Clear state tracking
    this.handlerState.clear();

    // Clear registered handlers tracking
    this.registeredHandlers.clear();

    // Reset metrics
    this.metrics = {
      eventsRegistered: 0,
      eventsProcessed: 0,
      eventsDebounced: 0,
      lastEventTimestamp: 0,
    };

    this.logger('disposal', 'completed');
  }

  /**
   * Dispose of all event listeners and cleanup resources
   */
  public override dispose(): void {
    this.logger(`Disposing ${this.managerName}`);

    // Dispose EventHandlerRegistry - this will clean up all registered event listeners
    this.eventRegistry.dispose();

    // Call parent dispose which will call doDispose()
    super.dispose();

    this.logger(`${this.managerName}`, 'completed');
  }
}
