/**
 * BaseInputHandler TDD Test Suite
 * Following t-wada's TDD methodology for comprehensive input handler testing
 * RED-GREEN-REFACTOR cycles with clear arrange-act-assert patterns
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  BaseInputHandler,
  InputHandlerConfig,
} from '../../../../../../../webview/managers/input/handlers/BaseInputHandler';
import { EventHandlerRegistry as _EventHandlerRegistry } from '../../../../../../../webview/utils/EventHandlerRegistry';

// Test implementation of BaseInputHandler for testing abstract methods
class TestInputHandler extends BaseInputHandler {
  private initializeCalled = false;

  constructor(
    handlerName: string = 'TestHandler',
    eventDebounceTimers: Map<string, number> = new Map(),
    config?: InputHandlerConfig
  ) {
    super(handlerName, eventDebounceTimers, config);
  }

  protected doInitialize(): void {
    this.initializeCalled = true;
  }

  public wasInitializeCalled(): boolean {
    return this.initializeCalled;
  }

  // Expose protected methods for testing
  public testRegisterEventHandler(
    id: string,
    element: EventTarget,
    eventType: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
    enableDebounce = false
  ): void {
    this.registerEventHandler(id, element, eventType, handler, options, enableDebounce);
  }

  public testUnregisterEventHandler(id: string): void {
    this.unregisterEventHandler(id);
  }

  public testIsHandlerHealthy(): boolean {
    return this.isHandlerHealthy();
  }

  public testClearAllDebounceTimers(): void {
    this.clearAllDebounceTimers();
  }

  // Implement missing BaseManager methods
  public getManagerName(): string {
    return this.managerName;
  }

  public isInitialized(): boolean {
    return this.isReady;
  }
}

/**
 * SKIP REASON: These tests rely on timer/debounce behavior that doesn't work correctly
 * with Vitest fake timers + JSDOM event dispatch. The debounce implementation uses
 * real setTimeout calls that don't interact correctly with vi.useFakeTimers().
 * TODO: Investigate using real timers or mocking the debounce implementation directly.
 */
describe('BaseInputHandler TDD Test Suite', () => {
  let handler: TestInputHandler;
  let sharedDebounceTimers: Map<string, number>;
  let testElement: HTMLElement;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();

    // Set up DOM elements in the existing environment
    document.body.innerHTML = '<div id="test-element"></div>';

    // Setup test elements
    testElement = document.getElementById('test-element') as HTMLElement;

    // Setup shared state
    sharedDebounceTimers = new Map<string, number>();

    // Spy on console.log for testing log output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create handler instance
    handler = new TestInputHandler('TestHandler', sharedDebounceTimers);
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleLogSpy.mockRestore();
    handler?.dispose();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('TDD Red Phase: Initialization and Configuration', () => {
    describe('Handler Construction and Default Configuration', () => {
      it('should initialize with default configuration values', () => {
        // Arrange: Default configuration expectations
        const expectedDefaults = {
          enableDebouncing: true,
          debounceDelay: 50,
          enableStateTracking: true,
          enableEventPrevention: false,
        };

        // Act: Handler is created in beforeEach

        // Assert: Configuration should match defaults
        const config = (handler as any).config;
        expect(config.enableDebouncing).toBe(expectedDefaults.enableDebouncing);
        expect(config.debounceDelay).toBe(expectedDefaults.debounceDelay);
        expect(config.enableStateTracking).toBe(expectedDefaults.enableStateTracking);
        expect(config.enableEventPrevention).toBe(expectedDefaults.enableEventPrevention);
      });

      it('should override default configuration with provided values', () => {
        // Arrange: Custom configuration
        const customConfig: InputHandlerConfig = {
          enableDebouncing: false,
          debounceDelay: 100,
          enableStateTracking: false,
          enableEventPrevention: true,
        };

        // Act: Create handler with custom config
        const customHandler = new TestInputHandler(
          'CustomHandler',
          sharedDebounceTimers,
          customConfig
        );

        // Assert: Configuration should match custom values
        const config = (customHandler as any).config;
        expect(config.enableDebouncing).toBe(false);
        expect(config.debounceDelay).toBe(100);
        expect(config.enableStateTracking).toBe(false);
        expect(config.enableEventPrevention).toBe(true);

        // Cleanup
        customHandler.dispose();
      });

      it('should initialize with empty metrics and state', () => {
        // Act: Handler is created in beforeEach

        // Assert: Initial metrics should be zero
        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsRegistered).toBe(0);
        expect(metrics.eventsProcessed).toBe(0);
        expect(metrics.eventsDebounced).toBe(0);
        expect(metrics.lastEventTimestamp).toBe(0);

        // Assert: Initial state should be empty
        const state = handler.getHandlerState();
        expect(Object.keys(state).length).toBe(0);
      });

      it('should share debounce timers reference with external map', () => {
        // Arrange: Add timer to shared map
        sharedDebounceTimers.set('external-timer', 12345 as any);

        // Act: Access handler's timer map
        const handlerTimers = (handler as any).eventDebounceTimers;

        // Assert: Should be same reference
        expect(handlerTimers).toBe(sharedDebounceTimers);
        expect(handlerTimers.get('external-timer')).toBe(12345);
      });
    });

    describe('BaseManager Integration', () => {
      it('should inherit logging capabilities from BaseManager', () => {
        // Act: Initialize handler (triggers logging)
        handler.initialize();

        // Assert: Should have logged initialization
        expect(consoleLogSpy).toHaveBeenCalled();
        expect(handler.wasInitializeCalled()).toBe(true);
      });

      it('should properly implement manager name functionality', () => {
        // Act: Get manager name
        const managerName = handler.getManagerName();

        // Assert: Should match constructor name
        expect(managerName).toBe('TestHandler');
      });
    });
  });

  describe('TDD Red Phase: Event Registration and Management', () => {
    describe('Basic Event Registration', () => {
      it('should register event handler and update metrics', () => {
        // Arrange: Event handler function
        let eventCalled = false;
        const testHandler = () => {
          eventCalled = true;
        };

        // Act: Register event handler
        handler.testRegisterEventHandler('test-click', testElement, 'click', testHandler);

        // Assert: Metrics should be updated
        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsRegistered).toBe(1);

        // Assert: Event should be registered and functional
        testElement.dispatchEvent(new Event('click'));
        expect(eventCalled).toBe(true);
      });

      it('should prevent duplicate event registration', () => {
        // Arrange: Two identical registrations
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        // Act: Register same handler ID twice
        handler.testRegisterEventHandler('duplicate-test', testElement, 'click', handler1);
        handler.testRegisterEventHandler('duplicate-test', testElement, 'click', handler2);

        // Assert: Only first registration should count
        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsRegistered).toBe(1);

        // Assert: Only first handler should be active
        testElement.dispatchEvent(new Event('click'));
        expect(handler1).toHaveBeenCalled();
        expect(handler2).not.toHaveBeenCalled();
      });

      it('should track registered handlers internally', () => {
        // Arrange: Multiple handlers
        const handlers = ['handler1', 'handler2', 'handler3'];

        // Act: Register multiple handlers
        handlers.forEach((id) => {
          handler.testRegisterEventHandler(id, testElement, 'click', () => {});
        });

        // Assert: All handlers should be tracked
        const registeredHandlers = (handler as any).registeredHandlers;
        expect(registeredHandlers.size).toBe(3);

        handlers.forEach((id) => {
          expect(registeredHandlers.has(id)).toBe(true);
        });
      });
    });

    describe('Debouncing Functionality', () => {
      it('should create debounced handler when enableDebounce is true', () => {
        // Arrange: Debounced handler
        let callCount = 0;
        const debouncedHandler = () => {
          callCount++;
        };

        // Act: Register with debouncing enabled
        handler.testRegisterEventHandler(
          'debounced-test',
          testElement,
          'input',
          debouncedHandler,
          undefined,
          true
        );

        // Act: Trigger multiple rapid events
        for (let i = 0; i < 5; i++) {
          testElement.dispatchEvent(new Event('input'));
        }

        // Assert: Should not execute immediately
        expect(callCount).toBe(0);

        // Act: Advance time by debounce delay
        vi.advanceTimersByTime(50);

        // Assert: Should execute once after delay
        expect(callCount).toBe(1);

        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsDebounced).toBe(1);
      });

      it('should execute immediately when enableDebounce is false', () => {
        // Arrange: Non-debounced handler
        let callCount = 0;
        const immediateHandler = () => {
          callCount++;
        };

        // Act: Register without debouncing
        handler.testRegisterEventHandler(
          'immediate-test',
          testElement,
          'input',
          immediateHandler,
          undefined,
          false
        );

        // Act: Trigger multiple events
        for (let i = 0; i < 3; i++) {
          testElement.dispatchEvent(new Event('input'));
        }

        // Assert: Should execute immediately for each event
        expect(callCount).toBe(3);

        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsDebounced).toBe(0);
      });

      it('should clear previous debounce timer on new events', () => {
        // Arrange: Debounced handler
        let callCount = 0;
        const debouncedHandler = () => {
          callCount++;
        };

        handler.testRegisterEventHandler(
          'debounce-clear-test',
          testElement,
          'input',
          debouncedHandler,
          undefined,
          true
        );

        // Act: Trigger event, wait partial time, trigger again
        testElement.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(25); // Half the debounce delay

        testElement.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(25); // Another half delay

        // Assert: Should not have executed yet
        expect(callCount).toBe(0);

        // Act: Complete the second debounce cycle
        vi.advanceTimersByTime(25);

        // Assert: Should execute only once
        expect(callCount).toBe(1);
      });
    });

    describe('State Tracking Functionality', () => {
      it('should track event processing when state tracking is enabled', () => {
        // Arrange: Handler with state tracking enabled
        const config: InputHandlerConfig = { enableStateTracking: true };
        const stateTrackingHandler = new TestInputHandler(
          'StateTracker',
          sharedDebounceTimers,
          config
        );

        const testHandler = () => {};
        stateTrackingHandler.testRegisterEventHandler(
          'state-test',
          testElement,
          'click',
          testHandler
        );

        // Act: Trigger event
        testElement.dispatchEvent(new Event('click'));

        // Assert: State should be tracked
        const state = stateTrackingHandler.getHandlerState();
        const stateKey = 'StateTracker-state-test-lastEvent';
        expect(state).toHaveProperty(stateKey);

        const lastEvent = state[stateKey] as any;
        expect(lastEvent.type).toBe('click');
        expect(lastEvent.target).toBeDefined(); // happy-dom target behavior
        expect(typeof lastEvent.timestamp).toBe('number');

        // Assert: Metrics should be updated
        const metrics = stateTrackingHandler.getHandlerMetrics();
        expect(metrics.eventsProcessed).toBe(1);
        expect(metrics.lastEventTimestamp).toBeGreaterThan(0);

        stateTrackingHandler.dispose();
      });

      it('should not track state when state tracking is disabled', () => {
        // Arrange: Handler with state tracking disabled
        const config: InputHandlerConfig = { enableStateTracking: false };
        const noStateHandler = new TestInputHandler('NoStateTracker', sharedDebounceTimers, config);

        const testHandler = () => {};
        noStateHandler.testRegisterEventHandler('no-state-test', testElement, 'click', testHandler);

        // Act: Trigger event
        testElement.dispatchEvent(new Event('click'));

        // Assert: State should not be tracked
        const state = noStateHandler.getHandlerState();
        expect(Object.keys(state).length).toBe(0);

        noStateHandler.dispose();
      });
    });

    describe('Error Handling and Recovery', () => {
      it('should handle errors in event handlers gracefully', () => {
        // Arrange: Handler that throws error
        const errorHandler = () => {
          throw new Error('Test error');
        };

        // Act: Register error handler
        handler.testRegisterEventHandler('error-test', testElement, 'click', errorHandler);

        // Act: Trigger event (should not throw)
        expect(() => {
          testElement.dispatchEvent(new Event('click'));
        }).not.toThrow();

        // Assert: Error should be logged
        expect(consoleLogSpy).toHaveBeenCalled();
        const logCalls = consoleLogSpy.mock.calls;
        const errorLogs = logCalls.some(
          (call) => call.some(arg => typeof arg === 'string' && arg.includes('Error in event handler TestHandler-error-test'))
        );
        expect(errorLogs).toBe(true);
      });

      it('should track error state when state tracking is enabled', () => {
        // Arrange: Handler with state tracking and error prevention
        const config: InputHandlerConfig = {
          enableStateTracking: true,
          enableEventPrevention: true,
        };
        const errorTrackingHandler = new TestInputHandler(
          'ErrorTracker',
          sharedDebounceTimers,
          config
        );

        const errorHandler = () => {
          throw new Error('Tracked error');
        };
        errorTrackingHandler.testRegisterEventHandler(
          'error-state-test',
          testElement,
          'click',
          errorHandler
        );

        // Act: Trigger error
        testElement.dispatchEvent(new Event('click'));

        // Assert: Error state should be tracked
        const state = errorTrackingHandler.getHandlerState();
        const errorStateKey = 'ErrorTracker-error-state-test-lastError';
        expect(state).toHaveProperty(errorStateKey);

        const lastError = state[errorStateKey] as any;
        expect(lastError.error).toBe('Tracked error');
        expect(typeof lastError.timestamp).toBe('number');
        expect(lastError.eventType).toBe('click');

        errorTrackingHandler.dispose();
      });

      it('should prevent event propagation on error when configured', () => {
        // Arrange: Handler with event prevention enabled
        const config: InputHandlerConfig = { enableEventPrevention: true };
        const preventionHandler = new TestInputHandler(
          'PreventionHandler',
          sharedDebounceTimers,
          config
        );

        const errorHandler = () => {
          throw new Error('Prevention test');
        };
        preventionHandler.testRegisterEventHandler(
          'prevention-test',
          testElement,
          'click',
          errorHandler
        );

        // Arrange: Event with propagation tracking
        let propagationStopped = false;
        let defaultPrevented = false;

        const event = new Event('click', { bubbles: true, cancelable: true });
        
        // Mock stopPropagation and preventDefault on the event instance
        const originalStopPropagation = event.stopPropagation.bind(event);
        const originalPreventDefault = event.preventDefault.bind(event);

        event.stopPropagation = () => {
          propagationStopped = true;
          originalStopPropagation();
        };

        event.preventDefault = () => {
          defaultPrevented = true;
          originalPreventDefault();
        };

        // Act: Trigger error event
        testElement.dispatchEvent(event);

        // Assert: Event propagation should be stopped
        expect(propagationStopped).toBe(true);
        expect(defaultPrevented).toBe(true);

        preventionHandler.dispose();
      });
    });

    describe('Event Unregistration', () => {
      it('should unregister event handler and remove tracking', () => {
        // Arrange: Register handler
        let eventCalled = false;
        const testHandler = () => {
          eventCalled = true;
        };

        handler.testRegisterEventHandler('unregister-test', testElement, 'click', testHandler);
        expect(handler.getHandlerMetrics().eventsRegistered).toBe(1);

        // Act: Unregister handler
        handler.testUnregisterEventHandler('unregister-test');

        // Assert: Handler should be removed from tracking
        const registeredHandlers = (handler as any).registeredHandlers;
        expect(registeredHandlers.has('unregister-test')).toBe(false);

        // Assert: Event should no longer trigger
        testElement.dispatchEvent(new Event('click'));
        expect(eventCalled).toBe(false);
      });

      it('should handle unregistering non-existent handler gracefully', () => {
        // Act: Attempt to unregister non-existent handler
        expect(() => {
          handler.testUnregisterEventHandler('non-existent');
        }).not.toThrow();

        // Assert: No changes to metrics
        expect(handler.getHandlerMetrics().eventsRegistered).toBe(0);
      });
    });
  });

  describe('TDD Red Phase: Health Monitoring and Diagnostics', () => {
    describe('Handler Health Status', () => {
      it('should report healthy status for recently active handler', () => {
        // Arrange: Register and trigger handler
        const activeHandler = () => {};
        handler.testRegisterEventHandler('health-test', testElement, 'click', activeHandler);

        // Act: Trigger recent event
        testElement.dispatchEvent(new Event('click'));

        // Assert: Should be healthy
        expect(handler.testIsHandlerHealthy()).toBe(true);
      });

      it('should report healthy status for handler with no events', () => {
        // Act: Check health of unused handler
        const isHealthy = handler.testIsHandlerHealthy();

        // Assert: Should be healthy (no events expected)
        expect(isHealthy).toBe(true);
      });

      it('should report unhealthy status for stale handler', () => {
        // Arrange: Register and trigger handler
        const staleHandler = () => {};
        handler.testRegisterEventHandler('stale-test', testElement, 'click', staleHandler);

        // Act: Trigger event and advance time beyond threshold
        testElement.dispatchEvent(new Event('click'));
        vi.advanceTimersByTime(35000); // 35 seconds (beyond 30 second threshold)

        // Assert: Should be unhealthy
        expect(handler.testIsHandlerHealthy()).toBe(false);
      });
    });

    describe('Metrics Collection', () => {
      it('should accurately track event registration metrics', () => {
        // Act: Register multiple handlers
        for (let i = 0; i < 5; i++) {
          handler.testRegisterEventHandler(`test-${i}`, testElement, 'click', () => {});
        }

        // Assert: Metrics should reflect registrations
        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsRegistered).toBe(5);
        expect(metrics.eventsProcessed).toBe(0);
        expect(metrics.eventsDebounced).toBe(0);
      });

      it('should track event processing metrics accurately', () => {
        // Arrange: Register handler
        let processCount = 0;
        const processingHandler = () => {
          processCount++;
        };

        handler.testRegisterEventHandler(
          'processing-test',
          testElement,
          'click',
          processingHandler
        );

        // Act: Trigger multiple events
        for (let i = 0; i < 3; i++) {
          testElement.dispatchEvent(new Event('click'));
        }

        // Assert: Processing metrics should be accurate
        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsProcessed).toBe(3);
        expect(processCount).toBe(3);
        expect(metrics.lastEventTimestamp).toBeGreaterThan(0);
      });

      it('should track debounce metrics separately from processing', () => {
        // Arrange: Register debounced handler
        let callCount = 0;
        const debouncedHandler = () => {
          callCount++;
        };

        handler.testRegisterEventHandler(
          'debounce-metrics',
          testElement,
          'input',
          debouncedHandler,
          undefined,
          true
        );

        // Act: Trigger multiple rapid events
        for (let i = 0; i < 4; i++) {
          testElement.dispatchEvent(new Event('input'));
        }

        // Act: Advance time to trigger debounced execution
        vi.advanceTimersByTime(50);

        // Assert: Debounce metrics should be tracked
        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsProcessed).toBe(4); // All events processed
        expect(metrics.eventsDebounced).toBe(1); // But only 1 debounced execution
        expect(callCount).toBe(1); // Actual handler called once
      });
    });

    describe('State Inspection', () => {
      it('should provide deep copy of handler state for debugging', () => {
        // Arrange: Handler with state tracking
        const config: InputHandlerConfig = { enableStateTracking: true };
        const stateHandler = new TestInputHandler('StateInspector', sharedDebounceTimers, config);

        const testHandler = () => {};
        stateHandler.testRegisterEventHandler('state-inspect', testElement, 'click', testHandler);

        // Act: Trigger event to create state
        testElement.dispatchEvent(new Event('click'));

        // Act: Get state and modify it
        const state = stateHandler.getHandlerState();
        const stateKey = 'StateInspector-state-inspect-lastEvent';
        const originalTimestamp = (state[stateKey] as any).timestamp;
        (state[stateKey] as any).timestamp = 999999;

        // Act: Get state again
        const freshState = stateHandler.getHandlerState();

        // Assert: Original state should be unchanged (deep copy)
        expect((freshState[stateKey] as any).timestamp).toBe(originalTimestamp);

        stateHandler.dispose();
      });

      it('should return empty object when no state is tracked', () => {
        // Arrange: Handler with state tracking disabled
        const config: InputHandlerConfig = { enableStateTracking: false };
        const noStateHandler = new TestInputHandler('NoStateHandler', sharedDebounceTimers, config);

        // Act: Get state
        const state = noStateHandler.getHandlerState();

        // Assert: Should be empty
        expect(Object.keys(state).length).toBe(0);
        expect(state).toEqual({});

        noStateHandler.dispose();
      });
    });
  });

  describe('TDD Red Phase: Resource Management and Cleanup', () => {
    describe('Debounce Timer Management', () => {
      it('should clear specific handler debounce timers', () => {
        // Arrange: Multiple handlers with different names
        const handler1 = new TestInputHandler('Handler1', sharedDebounceTimers);
        const handler2 = new TestInputHandler('Handler2', sharedDebounceTimers);

        // Add timers for both handlers
        sharedDebounceTimers.set('Handler1-debounce-1', 111 as any);
        sharedDebounceTimers.set('Handler1-debounce-2', 222 as any);
        sharedDebounceTimers.set('Handler2-debounce-1', 333 as any);
        sharedDebounceTimers.set('other-timer', 444 as any);

        expect(sharedDebounceTimers.size).toBe(4);

        // Act: Clear handler1 timers
        handler1.testClearAllDebounceTimers();

        // Assert: Only Handler1 timers should be cleared
        expect(sharedDebounceTimers.size).toBe(2);
        expect(sharedDebounceTimers.has('Handler2-debounce-1')).toBe(true);
        expect(sharedDebounceTimers.has('other-timer')).toBe(true);

        handler1.dispose();
        handler2.dispose();
      });

      it('should clear active debounce timers on disposal', () => {
        // Arrange: Register debounced handlers
        const debouncedHandler = vi.fn();
        handler.testRegisterEventHandler(
          'cleanup-test',
          testElement,
          'input',
          debouncedHandler,
          undefined,
          true
        );

        // Act: Trigger events to create active timers
        for (let i = 0; i < 3; i++) {
          testElement.dispatchEvent(new Event('input'));
        }

        // Verify timer exists
        expect(sharedDebounceTimers.size).toBeGreaterThan(0);

        // Act: Dispose handler
        handler.dispose();

        // Assert: Debounce timers should be cleared
        // (Remaining timers should be cleared by dispose)

        // Advance time to ensure debounced handlers don't execute
        vi.advanceTimersByTime(100);
        expect(debouncedHandler).not.toHaveBeenCalled();
      });
    });

    describe('Complete Resource Disposal', () => {
      it('should reset all internal state on disposal', () => {
        // Arrange: Populate handler with state
        const stateHandler = () => {};
        handler.testRegisterEventHandler('disposal-test', testElement, 'click', stateHandler);

        // Trigger some events to populate metrics and state
        testElement.dispatchEvent(new Event('click'));

        // Verify initial state
        expect(handler.getHandlerMetrics().eventsRegistered).toBeGreaterThan(0);
        expect(handler.getHandlerMetrics().eventsProcessed).toBeGreaterThan(0);

        // Act: Dispose handler
        handler.dispose();

        // Assert: All metrics should be reset
        const metrics = handler.getHandlerMetrics();
        expect(metrics.eventsRegistered).toBe(0);
        expect(metrics.eventsProcessed).toBe(0);
        expect(metrics.eventsDebounced).toBe(0);
        expect(metrics.lastEventTimestamp).toBe(0);

        // Assert: State should be cleared
        const state = handler.getHandlerState();
        expect(Object.keys(state).length).toBe(0);
      });

      it('should dispose EventHandlerRegistry and cleanup all listeners', () => {
        // Arrange: Register multiple event handlers
        const handlers = ['handler1', 'handler2', 'handler3'];
        handlers.forEach((id) => {
          handler.testRegisterEventHandler(id, testElement, 'click', () => {});
        });

        // Verify handlers are registered
        let eventsCaught = 0;
        testElement.addEventListener('click', () => eventsCaught++);
        testElement.dispatchEvent(new Event('click'));

        expect(eventsCaught).toBeGreaterThan(0); // Baseline check

        // Act: Dispose handler
        handler.dispose();

        // Assert: EventHandlerRegistry should be disposed
        // New events should not trigger disposed handlers
        eventsCaught = 0;
        testElement.dispatchEvent(new Event('click'));

        // The original listener we added should still work, but handler's listeners should be gone
        expect(eventsCaught).toBe(1); // Only our test listener
      });

      it('should handle double disposal gracefully', () => {
        // Arrange: Register some handlers
        handler.testRegisterEventHandler('double-disposal', testElement, 'click', () => {});

        // Act: Dispose twice
        handler.dispose();

        expect(() => {
          handler.dispose();
        }).not.toThrow();

        // Assert: Second disposal should be safe
        expect(handler.getHandlerMetrics().eventsRegistered).toBe(0);
      });
    });

    describe('Memory Leak Prevention', () => {
      it('should not retain references after disposal', () => {
        // Arrange: Create handler with references
        const config: InputHandlerConfig = { enableStateTracking: true };
        const memoryTestHandler = new TestInputHandler('MemoryTest', sharedDebounceTimers, config);

        memoryTestHandler.testRegisterEventHandler('memory-test', testElement, 'click', () => {});
        testElement.dispatchEvent(new Event('click'));

        // Verify initial state exists
        expect(Object.keys(memoryTestHandler.getHandlerState()).length).toBeGreaterThan(0);

        // Act: Dispose
        memoryTestHandler.dispose();

        // Assert: Internal maps should be cleared
        const registeredHandlers = (memoryTestHandler as any).registeredHandlers;
        const handlerState = (memoryTestHandler as any).handlerState;

        expect(registeredHandlers.size).toBe(0);
        expect(handlerState.size).toBe(0);
      });

      it('should clear validation rules on disposal', () => {
        // Arrange: Add some validation rules (if any exist in base class)
        // This tests the disposal completeness

        // Act: Dispose
        handler.dispose();

        // Assert: Should not throw when accessing after disposal
        expect(() => {
          handler.getHandlerMetrics();
          handler.getHandlerState();
        }).not.toThrow();
      });
    });
  });

  describe('TDD Red Phase: Edge Cases and Error Scenarios', () => {
    describe('Boundary Conditions', () => {
      it('should handle zero debounce delay', () => {
        // Arrange: Handler with zero debounce delay
        const config: InputHandlerConfig = { debounceDelay: 0 };
        const zeroDelayHandler = new TestInputHandler('ZeroDelay', sharedDebounceTimers, config);

        let callCount = 0;
        const testHandler = () => {
          callCount++;
        };

        // Act: Register with debouncing enabled but zero delay
        zeroDelayHandler.testRegisterEventHandler(
          'zero-delay',
          testElement,
          'input',
          testHandler,
          undefined,
          true
        );

        // Trigger events
        testElement.dispatchEvent(new Event('input'));
        testElement.dispatchEvent(new Event('input'));

        // Act: Advance minimal time
        vi.advanceTimersByTime(1);

        // Assert: Should execute with minimal delay
        expect(callCount).toBe(1);

        zeroDelayHandler.dispose();
      });

      it('should handle extremely high debounce delay', () => {
        // Arrange: Handler with very high debounce delay
        const config: InputHandlerConfig = { debounceDelay: 10000 };
        const highDelayHandler = new TestInputHandler('HighDelay', sharedDebounceTimers, config);

        let callCount = 0;
        const testHandler = () => {
          callCount++;
        };

        // Act: Register with high delay
        highDelayHandler.testRegisterEventHandler(
          'high-delay',
          testElement,
          'input',
          testHandler,
          undefined,
          true
        );

        testElement.dispatchEvent(new Event('input'));

        // Act: Advance time less than delay
        vi.advanceTimersByTime(5000);
        expect(callCount).toBe(0);

        // Act: Complete the delay
        vi.advanceTimersByTime(5000);
        expect(callCount).toBe(1);

        highDelayHandler.dispose();
      });

      it('should handle null event targets gracefully', () => {
        // Arrange: Mock event with null target
        const mockEvent = {
          type: 'click',
          target: null,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        };

        let handlerCalled = false;
        const nullTargetHandler = () => {
          handlerCalled = true;
        };

        // Act: Register handler (this should work)
        handler.testRegisterEventHandler('null-target', testElement, 'click', nullTargetHandler);

        // Simulate event dispatch with null target (manual trigger)
        const registeredHandlers = (handler as any).registeredHandlers;
        const handlerEntry = registeredHandlers.get('null-target');

        // Act: Call handler directly with null target event
        expect(() => {
          handlerEntry.handler(mockEvent as any);
        }).not.toThrow();

        // Assert: Handler should still execute
        expect(handlerCalled).toBe(true);
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle rapid registration and unregistration', () => {
        // Arrange: Prepare multiple handlers
        const handlerIds = ['rapid1', 'rapid2', 'rapid3', 'rapid4', 'rapid5'];

        // Act: Rapidly register and unregister
        handlerIds.forEach((id) => {
          handler.testRegisterEventHandler(id, testElement, 'click', () => {});
          handler.testUnregisterEventHandler(id);
        });

        // Assert: Should not cause issues
        expect(handler.getHandlerMetrics().eventsRegistered).toBe(5);

        const registeredHandlers = (handler as any).registeredHandlers;
        expect(registeredHandlers.size).toBe(0);
      });

      it('should handle events during disposal process', () => {
        // Arrange: Register handler
        let eventDuringDisposal = false;
        const testHandler = () => {
          eventDuringDisposal = true;
        };

        handler.testRegisterEventHandler('disposal-event', testElement, 'click', testHandler);

        // Act: Start disposal and trigger event (simulating race condition)
        // This tests the robustness of the disposal process
        handler.dispose();

        // Event after disposal should not cause errors
        expect(() => {
          testElement.dispatchEvent(new Event('click'));
        }).not.toThrow();

        // Handler should not execute after disposal
        expect(eventDuringDisposal).toBe(false);
      });
    });

    describe('Configuration Edge Cases', () => {
      it('should handle invalid configuration values gracefully', () => {
        // Arrange: Invalid configuration (negative values)
        const invalidConfig = {
          debounceDelay: -100,
          enableDebouncing: null as any,
          enableStateTracking: undefined as any,
        };

        // Act: Create handler with invalid config (should not throw)
        expect(() => {
          const invalidHandler = new TestInputHandler(
            'InvalidConfig',
            sharedDebounceTimers,
            invalidConfig
          );
          invalidHandler.dispose();
        }).not.toThrow();
      });

      it('should handle partial configuration objects', () => {
        // Arrange: Minimal config
        const partialConfig = { enableDebouncing: false };

        // Act: Create handler with partial config
        const partialHandler = new TestInputHandler(
          'PartialConfig',
          sharedDebounceTimers,
          partialConfig
        );

        // Assert: Should fill in defaults for missing values
        const config = (partialHandler as any).config;
        expect(config.enableDebouncing).toBe(false);
        expect(typeof config.debounceDelay).toBe('number');
        expect(typeof config.enableStateTracking).toBe('boolean');

        partialHandler.dispose();
      });
    });
  });

  describe('TDD Red Phase: Integration with BaseManager', () => {
    describe('Lifecycle Management', () => {
      it('should properly integrate with BaseManager lifecycle', async () => {
        // Act: Initialize handler
        await handler.initialize();

        // Assert: Should have called derived implementation
        expect(handler.wasInitializeCalled()).toBe(true);

        // Assert: Should be in initialized state
        expect(handler.isInitialized()).toBe(true);
      });

      it('should handle initialization errors gracefully', async () => {
        // Arrange: Handler that throws during initialization
        class ErrorInitHandler extends BaseInputHandler {
          protected doInitialize(): void {
            throw new Error('Initialization failed');
          }
        }

        const errorHandler = new ErrorInitHandler('ErrorInit', sharedDebounceTimers);

        // Act & Assert: Should handle initialization error (initialize is async)
        await expect(errorHandler.initialize()).rejects.toThrow('Initialization failed');

        errorHandler.dispose();
      });
    });

    describe('Manager Name and Identity', () => {
      it('should maintain consistent manager identity', () => {
        // Assert: Manager name should be consistent
        expect(handler.getManagerName()).toBe('TestHandler');

        // Act: After operations, name should remain the same
        handler.testRegisterEventHandler('identity-test', testElement, 'click', () => {});
        expect(handler.getManagerName()).toBe('TestHandler');

        // After disposal, name should still be accessible
        handler.dispose();
        expect(handler.getManagerName()).toBe('TestHandler');
      });
    });
  });
});
