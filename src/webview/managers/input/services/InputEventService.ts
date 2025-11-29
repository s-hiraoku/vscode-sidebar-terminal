/**
 * InputEventService - Centralized event management for input handlers
 * Based on similarity analysis showing 400+ lines of duplicate event handling
 * Provides unified event registration, debouncing, and state management
 */

import { EventHandlerRegistry } from '../../../utils/EventHandlerRegistry';
import { webview as log } from '../../../../utils/logger';

/**
 * Event handler configuration
 */
export interface EventHandlerConfig {
  debounce?: boolean;
  debounceDelay?: number;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  once?: boolean;
  passive?: boolean;
  capture?: boolean;
}

/**
 * Event metrics for monitoring and debugging
 */
export interface EventMetrics {
  totalRegistered: number;
  totalProcessed: number;
  totalDebounced: number;
  totalErrors: number;
  lastEventTimestamp: number;
  averageProcessingTime: number;
}

/**
 * Registered event entry
 */
interface RegisteredEvent {
  id: string;
  element: EventTarget;
  eventType: string;
  originalHandler: EventListener;
  wrappedHandler: EventListener;
  config: Required<EventHandlerConfig>;
  registeredAt: number;
  metrics: {
    callCount: number;
    errorCount: number;
    totalProcessingTime: number;
  };
}

/**
 * Centralized input event service
 * Eliminates duplicate event handling patterns across input managers
 */
export class InputEventService {
  // Core event registry
  private readonly eventRegistry = new EventHandlerRegistry();

  // Debounce timers management
  private debounceTimers = new Map<string, number>();

  // Registered events tracking
  private registeredEvents = new Map<string, RegisteredEvent>();

  // Global metrics
  private metrics: EventMetrics = {
    totalRegistered: 0,
    totalProcessed: 0,
    totalDebounced: 0,
    totalErrors: 0,
    lastEventTimestamp: 0,
    averageProcessingTime: 0,
  };

  // Logger function (injected)
  private logger: (message: string) => void;

  constructor(logger: (message: string) => void = log) {
    this.logger = logger;
    this.logger('InputEventService initialized');
  }

  /**
   * Register event handler with advanced configuration
   * Centralizes event registration patterns found in multiple handlers
   */
  public registerEventHandler(
    id: string,
    element: EventTarget,
    eventType: string,
    handler: EventListener,
    config: EventHandlerConfig = {}
  ): void {
    // Check for duplicate registration
    if (this.registeredEvents.has(id)) {
      this.logger(`Event handler ${id} already registered, skipping`);
      return;
    }

    // Set default configuration
    const finalConfig: Required<EventHandlerConfig> = {
      debounce: false,
      debounceDelay: 50,
      preventDefault: false,
      stopPropagation: false,
      once: false,
      passive: false,
      capture: false,
      ...config,
    };

    // Create wrapped handler with all features
    const wrappedHandler = this.createWrappedHandler(id, handler, finalConfig);

    // Create event listener options
    const options: AddEventListenerOptions = {
      once: finalConfig.once,
      passive: finalConfig.passive,
      capture: finalConfig.capture,
    };

    // Register with EventHandlerRegistry
    this.eventRegistry.register(id, element, eventType, wrappedHandler, options);

    // Track registration
    const registeredEvent: RegisteredEvent = {
      id,
      element,
      eventType,
      originalHandler: handler,
      wrappedHandler,
      config: finalConfig,
      registeredAt: Date.now(),
      metrics: {
        callCount: 0,
        errorCount: 0,
        totalProcessingTime: 0,
      },
    };

    this.registeredEvents.set(id, registeredEvent);
    this.metrics.totalRegistered++;

    this.logger(
      `Registered event handler: ${id} (${eventType}) - ` +
        `debounced: ${finalConfig.debounce}, passive: ${finalConfig.passive}`
    );
  }

  /**
   * Create wrapped event handler with all features
   * Eliminates duplicate wrapper creation patterns (92% similarity)
   */
  private createWrappedHandler(
    id: string,
    originalHandler: EventListener,
    config: Required<EventHandlerConfig>
  ): EventListener {
    return (event: Event): void => {
      const startTime = performance.now();
      const registeredEvent = this.registeredEvents.get(id);

      if (!registeredEvent) {
        this.logger(`Registered event not found for ${id}`);
        return;
      }

      try {
        // Handle event prevention
        if (config.preventDefault) {
          event.preventDefault();
        }

        if (config.stopPropagation) {
          event.stopPropagation();
        }

        // Call original handler
        if (config.debounce) {
          this.handleDebouncedEvent(id, originalHandler, event, config.debounceDelay);
        } else {
          originalHandler(event);
        }

        // Update metrics
        const endTime = performance.now();
        const processingTime = endTime - startTime;

        registeredEvent.metrics.callCount++;
        registeredEvent.metrics.totalProcessingTime += processingTime;

        this.metrics.totalProcessed++;
        this.metrics.lastEventTimestamp = Date.now();
        this.updateAverageProcessingTime(processingTime);
      } catch (error) {
        // Handle errors
        registeredEvent.metrics.errorCount++;
        this.metrics.totalErrors++;

        this.logger(`Error in event handler ${id}: ${error}`);

        // Prevent further propagation on error
        event.preventDefault();
        event.stopPropagation();
      }
    };
  }

  /**
   * Handle debounced event execution
   * Centralizes debouncing logic found across multiple handlers
   */
  private handleDebouncedEvent(
    id: string,
    handler: EventListener,
    event: Event,
    delay: number
  ): void {
    const debounceKey = `${id}-debounce`;

    // Clear existing timer
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!);
    }

    // Set new timer
    const timer = window.setTimeout(() => {
      try {
        handler(event);
        this.metrics.totalDebounced++;
      } catch (error) {
        this.logger(`Error in debounced handler ${id}: ${error}`);
        this.metrics.totalErrors++;
      } finally {
        this.debounceTimers.delete(debounceKey);
      }
    }, delay);

    this.debounceTimers.set(debounceKey, timer);
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(newTime: number): void {
    if (this.metrics.totalProcessed === 1) {
      this.metrics.averageProcessingTime = newTime;
    } else {
      // Running average calculation
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1) + newTime) /
        this.metrics.totalProcessed;
    }
  }

  /**
   * Unregister specific event handler
   */
  public unregisterEventHandler(id: string): void {
    const registeredEvent = this.registeredEvents.get(id);
    if (registeredEvent) {
      // Clear any pending debounce timers
      this.clearDebounceTimer(id);

      // Unregister from EventHandlerRegistry
      this.eventRegistry.unregister(id);

      // Remove tracking
      this.registeredEvents.delete(id);

      this.logger(`Unregistered event handler: ${id}`);
    }
  }

  /**
   * Clear debounce timer for specific handler
   */
  private clearDebounceTimer(id: string): void {
    const debounceKey = `${id}-debounce`;
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!);
      this.debounceTimers.delete(debounceKey);
    }
  }

  /**
   * Clear all debounce timers
   */
  public clearAllDebounceTimers(): void {
    for (const [, timer] of this.debounceTimers) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Get metrics for specific event handler
   */
  public getEventHandlerMetrics(id: string): RegisteredEvent['metrics'] | null {
    const registeredEvent = this.registeredEvents.get(id);
    return registeredEvent ? { ...registeredEvent.metrics } : null;
  }

  /**
   * Get global event service metrics
   */
  public getGlobalMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all registered event handlers (for debugging)
   */
  public getRegisteredHandlers(): string[] {
    return Array.from(this.registeredEvents.keys());
  }

  /**
   * Check if event handler exists
   */
  public hasEventHandler(id: string): boolean {
    return this.registeredEvents.has(id);
  }

  /**
   * Get health status of event service
   */
  public getHealthStatus(): {
    isHealthy: boolean;
    totalHandlers: number;
    averageProcessingTime: number;
    errorRate: number;
    lastEventAge: number;
  } {
    const now = Date.now();
    const lastEventAge = now - this.metrics.lastEventTimestamp;
    const errorRate =
      this.metrics.totalProcessed > 0 ? this.metrics.totalErrors / this.metrics.totalProcessed : 0;

    return {
      isHealthy: errorRate < 0.1 && this.metrics.averageProcessingTime < 100, // < 10% error rate, < 100ms avg
      totalHandlers: this.registeredEvents.size,
      averageProcessingTime: this.metrics.averageProcessingTime,
      errorRate,
      lastEventAge,
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRegistered: this.registeredEvents.size, // Keep current registration count
      totalProcessed: 0,
      totalDebounced: 0,
      totalErrors: 0,
      lastEventTimestamp: 0,
      averageProcessingTime: 0,
    };

    // Reset individual handler metrics
    for (const registeredEvent of this.registeredEvents.values()) {
      registeredEvent.metrics = {
        callCount: 0,
        errorCount: 0,
        totalProcessingTime: 0,
      };
    }

    this.logger('Event service metrics reset');
  }

  /**
   * Dispose of all event handlers and cleanup resources
   */
  public dispose(): void {
    this.logger('Disposing InputEventService');

    // Clear all debounce timers
    this.clearAllDebounceTimers();

    // Dispose EventHandlerRegistry
    this.eventRegistry.dispose();

    // Clear tracking
    this.registeredEvents.clear();

    // Reset metrics
    this.metrics = {
      totalRegistered: 0,
      totalProcessed: 0,
      totalDebounced: 0,
      totalErrors: 0,
      lastEventTimestamp: 0,
      averageProcessingTime: 0,
    };

    this.logger('InputEventService disposed');
  }
}
