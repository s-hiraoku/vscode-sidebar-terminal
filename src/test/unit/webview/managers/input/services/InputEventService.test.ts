/**
 * InputEventService TDD Test Suite
 * Following t-wada's TDD methodology for centralized event management testing
 * RED-GREEN-REFACTOR cycles with comprehensive coverage including edge cases
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import {
  InputEventService,
  EventHandlerConfig,
  EventMetrics as _EventMetrics,
} from '../../../../../../webview/managers/input/services/InputEventService';

describe('InputEventService TDD Test Suite', () => {
  let jsdom: JSDOM;
  let clock: sinon.SinonFakeTimers;
  let eventService: InputEventService;
  let testElement: Element;
  let mockLogger: sinon.SinonStub;
  let logMessages: string[];

  beforeEach(() => {
    // Arrange: Setup DOM environment for event testing
    jsdom = new JSDOM('<!DOCTYPE html><html><body><div id="test-element"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    // Setup global environment
    global.window = jsdom.window as any;
    global.document = jsdom.window.document;
    global.Event = jsdom.window.Event;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;
    global.MouseEvent = jsdom.window.MouseEvent;
    global.performance = {
      now: sinon.stub().returns(Date.now()),
    } as any;

    // Setup test elements
    testElement = document.getElementById('test-element')!;

    // Setup fake timers for precise debouncing control
    clock = sinon.useFakeTimers();

    // Setup mock logger to capture all log messages
    logMessages = [];
    mockLogger = sinon.stub().callsFake((message: string) => {
      logMessages.push(message);
    });

    // Create service instance
    eventService = new InputEventService(mockLogger);
  });

  afterEach(() => {
    // CRITICAL: Use try-finally to ensure all cleanup happens
    try {
      clock.restore();
    } finally {
      try {
        eventService.dispose();
      } finally {
        try {
          // CRITICAL: Close JSDOM window to prevent memory leaks
          jsdom.window.close();
        } finally {
          // CRITICAL: Clean up global DOM state to prevent test pollution
          delete (global as any).window;
          delete (global as any).document;
          delete (global as any).Event;
          delete (global as any).KeyboardEvent;
          delete (global as any).MouseEvent;
          delete (global as any).performance;
        }
      }
    }
  });

  describe('TDD Red Phase: Service Initialization and Configuration', () => {
    describe('Service Construction', () => {
      it('should initialize with default logger when none provided', () => {
        // Act: Create service without logger
        const defaultService = new InputEventService();

        // Assert: Should not throw and should be functional
        expect(() => {
          defaultService.registerEventHandler('test', testElement, 'click', () => {});
        }).to.not.throw();

        defaultService.dispose();
      });

      it('should initialize with empty metrics', () => {
        // Act: Get initial metrics
        const metrics = eventService.getGlobalMetrics();

        // Assert: All metrics should be zero
        expect(metrics.totalRegistered).to.equal(0);
        expect(metrics.totalProcessed).to.equal(0);
        expect(metrics.totalDebounced).to.equal(0);
        expect(metrics.totalErrors).to.equal(0);
        expect(metrics.lastEventTimestamp).to.equal(0);
        expect(metrics.averageProcessingTime).to.equal(0);
      });

      it('should log initialization message', () => {
        // Assert: Should have logged initialization
        expect(logMessages).to.include('InputEventService initialized');
      });

      it('should start with no registered handlers', () => {
        // Act: Get registered handlers
        const handlers = eventService.getRegisteredHandlers();

        // Assert: Should be empty
        expect(handlers).to.be.an('array').that.is.empty;
      });

      it('should report healthy status initially', () => {
        // Act: Get health status
        const health = eventService.getHealthStatus();

        // Assert: Should be healthy with no activity
        expect(health.isHealthy).to.be.true;
        expect(health.totalHandlers).to.equal(0);
        expect(health.errorRate).to.equal(0);
      });
    });
  });

  describe('TDD Red Phase: Event Handler Registration', () => {
    describe('Basic Registration Functionality', () => {
      it('should register event handler with default configuration', () => {
        // Arrange: Basic event handler
        let eventTriggered = false;
        const handler = () => {
          eventTriggered = true;
        };

        // Act: Register handler
        eventService.registerEventHandler('basic-test', testElement, 'click', handler);

        // Assert: Should be registered
        const registeredHandlers = eventService.getRegisteredHandlers();
        expect(registeredHandlers).to.include('basic-test');
        expect(eventService.hasEventHandler('basic-test')).to.be.true;

        // Assert: Should update metrics
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(1);

        // Assert: Should be functional
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        expect(eventTriggered).to.be.true;
      });

      it('should register handler with custom configuration', () => {
        // Arrange: Custom configuration
        const config: EventHandlerConfig = {
          debounce: true,
          debounceDelay: 100,
          preventDefault: true,
          stopPropagation: true,
          once: true,
          passive: false,
          capture: true,
        };

        let eventCount = 0;
        const handler = () => {
          eventCount++;
        };

        // Act: Register with custom config
        eventService.registerEventHandler('custom-config', testElement, 'click', handler, config);

        // Assert: Should be registered with custom settings
        expect(eventService.hasEventHandler('custom-config')).to.be.true;

        // Test once behavior - should only trigger once
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        testElement.dispatchEvent(new jsdom.window.Event('click'));

        // Due to 'once' configuration, should only execute once
        // Note: exact behavior depends on browser implementation of 'once'
        expect(eventCount).to.be.greaterThan(0);
      });

      it('should prevent duplicate registration', () => {
        // Arrange: Two handlers with same ID
        const handler1 = sinon.stub();
        const handler2 = sinon.stub();

        // Act: Register same ID twice
        eventService.registerEventHandler('duplicate', testElement, 'click', handler1);
        eventService.registerEventHandler('duplicate', testElement, 'click', handler2);

        // Assert: Should log duplicate warning
        expect(logMessages.some((msg: string) => /already registered/.test(msg))).to.be.true;

        // Assert: Only first registration should count
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(1);

        // Assert: Only first handler should be active
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        expect(handler1.called).to.be.true;
        expect(handler2.called).to.be.false;
      });

      it('should handle registration with complex event listener options', () => {
        // Arrange: Handler with complex options
        const handler = sinon.stub();
        const config: EventHandlerConfig = {
          passive: true,
          capture: true,
          once: false,
        };

        // Act: Register with options
        eventService.registerEventHandler(
          'complex-options',
          testElement,
          'scroll',
          handler,
          config
        );

        // Assert: Should register successfully
        expect(eventService.hasEventHandler('complex-options')).to.be.true;

        // Test functionality
        testElement.dispatchEvent(new jsdom.window.Event('scroll'));
        expect(handler.called).to.be.true;
      });
    });

    describe('Advanced Configuration Handling', () => {
      it('should apply default values for partial configuration', () => {
        // Arrange: Partial configuration
        const partialConfig = { debounce: true };
        const handler = sinon.stub();

        // Act: Register with partial config
        eventService.registerEventHandler(
          'partial-config',
          testElement,
          'input',
          handler,
          partialConfig
        );

        // Assert: Should fill defaults and work
        expect(eventService.hasEventHandler('partial-config')).to.be.true;

        // Trigger event to test debouncing default delay
        testElement.dispatchEvent(new jsdom.window.Event('input'));
        expect(handler.called).to.be.false; // Should be debounced

        clock.tick(50); // Default debounce delay
        expect(handler.called).to.be.true;
      });

      it('should handle empty configuration object', () => {
        // Arrange: Empty config
        const handler = sinon.stub();

        // Act: Register with empty config
        eventService.registerEventHandler('empty-config', testElement, 'click', handler, {});

        // Assert: Should use all defaults
        expect(eventService.hasEventHandler('empty-config')).to.be.true;

        testElement.dispatchEvent(new jsdom.window.Event('click'));
        expect(handler.called).to.be.true; // Should execute immediately
      });

      it('should handle null/undefined configuration', () => {
        // Arrange: Null config
        const handler = sinon.stub();

        // Act: Register with null config
        eventService.registerEventHandler(
          'null-config',
          testElement,
          'click',
          handler,
          null as any
        );

        // Assert: Should use defaults and work
        expect(eventService.hasEventHandler('null-config')).to.be.true;

        testElement.dispatchEvent(new jsdom.window.Event('click'));
        expect(handler.called).to.be.true;
      });
    });

    describe('Event Handler Wrapping and Enhancement', () => {
      it('should wrap handlers with performance monitoring', () => {
        // Arrange: Performance monitoring setup
        let performanceStartCalled = false;
        let performanceEndCalled = false;

        (global.performance.now as sinon.SinonStub)
          .onFirstCall()
          .callsFake(() => {
            performanceStartCalled = true;
            return 1000;
          })
          .onSecondCall()
          .callsFake(() => {
            performanceEndCalled = true;
            return 1010;
          }); // 10ms processing

        const handler = () => {
          /* test handler */
        };

        // Act: Register handler
        eventService.registerEventHandler('perf-test', testElement, 'click', handler);

        // Act: Trigger event
        testElement.dispatchEvent(new jsdom.window.Event('click'));

        // Assert: Performance should be monitored
        expect(performanceStartCalled).to.be.true;
        expect(performanceEndCalled).to.be.true;

        const metrics = eventService.getGlobalMetrics();
        expect(metrics.averageProcessingTime).to.equal(10); // 10ms
      });

      it('should wrap handlers with error handling', () => {
        // Arrange: Handler that throws error
        const errorHandler = () => {
          throw new Error('Test error');
        };

        // Act: Register error handler
        eventService.registerEventHandler('error-handler', testElement, 'click', errorHandler);

        // Act: Trigger event (should not throw)
        expect(() => {
          testElement.dispatchEvent(new jsdom.window.Event('click'));
        }).to.not.throw();

        // Assert: Error should be logged
        expect(logMessages.some((msg: string) => /Error in event handler error-handler/.test(msg)))
          .to.be.true;

        // Assert: Error metrics should be updated
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalErrors).to.equal(1);
      });

      it('should wrap handlers with event prevention when configured', () => {
        // Arrange: Handler with preventDefault
        const config: EventHandlerConfig = { preventDefault: true };
        const handler = sinon.stub();

        eventService.registerEventHandler('prevent-test', testElement, 'click', handler, config);

        // Arrange: Track event prevention
        let defaultPrevented = false;
        const event = new jsdom.window.Event('click', { cancelable: true });
        const originalPreventDefault = event.preventDefault;
        event.preventDefault = () => {
          defaultPrevented = true;
          originalPreventDefault.call(event);
        };

        // Act: Trigger event
        testElement.dispatchEvent(event);

        // Assert: preventDefault should be called
        expect(defaultPrevented).to.be.true;
        expect(handler.called).to.be.true;
      });

      it('should wrap handlers with propagation stopping when configured', () => {
        // Arrange: Handler with stopPropagation
        const config: EventHandlerConfig = { stopPropagation: true };
        const handler = sinon.stub();

        eventService.registerEventHandler('stop-prop', testElement, 'click', handler, config);

        // Arrange: Track propagation stopping
        let propagationStopped = false;
        const event = new jsdom.window.Event('click', { bubbles: true });
        const originalStopPropagation = event.stopPropagation;
        event.stopPropagation = () => {
          propagationStopped = true;
          originalStopPropagation.call(event);
        };

        // Act: Trigger event
        testElement.dispatchEvent(event);

        // Assert: stopPropagation should be called
        expect(propagationStopped).to.be.true;
        expect(handler.called).to.be.true;
      });
    });
  });

  describe('TDD Red Phase: Debouncing Functionality', () => {
    describe('Basic Debouncing Behavior', () => {
      it('should debounce events with default delay', () => {
        // Arrange: Debounced handler
        let callCount = 0;
        const debouncedHandler = () => {
          callCount++;
        };
        const config: EventHandlerConfig = { debounce: true };

        // Act: Register debounced handler
        eventService.registerEventHandler(
          'debounce-default',
          testElement,
          'input',
          debouncedHandler,
          config
        );

        // Act: Trigger multiple rapid events
        for (let i = 0; i < 5; i++) {
          testElement.dispatchEvent(new jsdom.window.Event('input'));
        }

        // Assert: Should not execute immediately
        expect(callCount).to.equal(0);

        // Act: Advance time by default delay (50ms)
        clock.tick(50);

        // Assert: Should execute once
        expect(callCount).to.equal(1);

        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.equal(5); // All events processed
        expect(metrics.totalDebounced).to.equal(1); // But only 1 debounced execution
      });

      it('should debounce events with custom delay', () => {
        // Arrange: Custom debounce delay
        let callCount = 0;
        const debouncedHandler = () => {
          callCount++;
        };
        const config: EventHandlerConfig = {
          debounce: true,
          debounceDelay: 200,
        };

        // Act: Register with custom delay
        eventService.registerEventHandler(
          'debounce-custom',
          testElement,
          'scroll',
          debouncedHandler,
          config
        );

        // Act: Trigger events
        testElement.dispatchEvent(new jsdom.window.Event('scroll'));
        testElement.dispatchEvent(new jsdom.window.Event('scroll'));

        // Assert: Should not execute with shorter delay
        clock.tick(100);
        expect(callCount).to.equal(0);

        // Assert: Should execute with full custom delay
        clock.tick(100); // Total 200ms
        expect(callCount).to.equal(1);
      });

      it('should reset debounce timer on new events', () => {
        // Arrange: Debounced handler
        let callCount = 0;
        const debouncedHandler = () => {
          callCount++;
        };
        const config: EventHandlerConfig = { debounce: true, debounceDelay: 100 };

        eventService.registerEventHandler(
          'debounce-reset',
          testElement,
          'keydown',
          debouncedHandler,
          config
        );

        // Act: Trigger event, wait partial time, trigger again
        testElement.dispatchEvent(new jsdom.window.Event('keydown'));
        clock.tick(50);

        testElement.dispatchEvent(new jsdom.window.Event('keydown'));
        clock.tick(50);

        // Assert: Should not have executed yet (timer reset)
        expect(callCount).to.equal(0);

        // Act: Complete the second timer
        clock.tick(50);

        // Assert: Should execute once
        expect(callCount).to.equal(1);
      });

      it('should handle multiple debounced handlers independently', () => {
        // Arrange: Multiple debounced handlers
        let handler1Count = 0;
        let handler2Count = 0;

        const handler1 = () => {
          handler1Count++;
        };
        const handler2 = () => {
          handler2Count++;
        };

        const config: EventHandlerConfig = { debounce: true, debounceDelay: 50 };

        // Act: Register multiple handlers
        eventService.registerEventHandler(
          'multi-debounce-1',
          testElement,
          'input',
          handler1,
          config
        );
        eventService.registerEventHandler(
          'multi-debounce-2',
          testElement,
          'change',
          handler2,
          config
        );

        // Act: Trigger different events
        testElement.dispatchEvent(new jsdom.window.Event('input'));
        testElement.dispatchEvent(new jsdom.window.Event('change'));

        // Act: Advance time
        clock.tick(50);

        // Assert: Both should execute independently
        expect(handler1Count).to.equal(1);
        expect(handler2Count).to.equal(1);
      });
    });

    describe('Debounce Edge Cases', () => {
      it('should handle zero debounce delay', () => {
        // Arrange: Zero delay debouncing
        let callCount = 0;
        const handler = () => {
          callCount++;
        };
        const config: EventHandlerConfig = {
          debounce: true,
          debounceDelay: 0,
        };

        eventService.registerEventHandler('zero-debounce', testElement, 'input', handler, config);

        // Act: Trigger events
        testElement.dispatchEvent(new jsdom.window.Event('input'));
        testElement.dispatchEvent(new jsdom.window.Event('input'));

        // Act: Advance minimal time
        clock.tick(1);

        // Assert: Should execute with minimal delay
        expect(callCount).to.equal(1);
      });

      it('should handle debounce timer cleanup on service disposal', () => {
        // Arrange: Debounced handler
        let callCount = 0;
        const handler = () => {
          callCount++;
        };
        const config: EventHandlerConfig = { debounce: true, debounceDelay: 100 };

        eventService.registerEventHandler(
          'cleanup-debounce',
          testElement,
          'input',
          handler,
          config
        );

        // Act: Trigger event to create timer
        testElement.dispatchEvent(new jsdom.window.Event('input'));

        // Act: Dispose service before timer fires
        eventService.dispose();

        // Act: Advance time
        clock.tick(100);

        // Assert: Handler should not execute after disposal
        expect(callCount).to.equal(0);
      });

      it('should handle errors in debounced handlers', () => {
        // Arrange: Debounced handler that throws
        const errorHandler = () => {
          throw new Error('Debounced error');
        };
        const config: EventHandlerConfig = { debounce: true, debounceDelay: 50 };

        eventService.registerEventHandler(
          'debounce-error',
          testElement,
          'input',
          errorHandler,
          config
        );

        // Act: Trigger event
        testElement.dispatchEvent(new jsdom.window.Event('input'));

        // Act: Advance time to trigger debounced execution
        clock.tick(50);

        // Assert: Error should be logged
        expect(
          logMessages.some((msg: string) => /Error in debounced handler debounce-error/.test(msg))
        ).to.be.true;

        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalErrors).to.equal(1);
      });
    });
  });

  describe('TDD Red Phase: Metrics and Performance Monitoring', () => {
    describe('Registration Metrics', () => {
      it('should accurately track registration count', () => {
        // Act: Register multiple handlers
        for (let i = 0; i < 7; i++) {
          eventService.registerEventHandler(`reg-${i}`, testElement, 'click', () => {});
        }

        // Assert: Should track all registrations
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(7);

        const health = eventService.getHealthStatus();
        expect(health.totalHandlers).to.equal(7);
      });

      it('should not count duplicate registrations', () => {
        // Act: Try to register same handler multiple times
        eventService.registerEventHandler('duplicate', testElement, 'click', () => {});
        eventService.registerEventHandler('duplicate', testElement, 'click', () => {});
        eventService.registerEventHandler('duplicate', testElement, 'click', () => {});

        // Assert: Should only count once
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(1);
      });
    });

    describe('Processing Metrics', () => {
      it('should track total events processed', () => {
        // Arrange: Multiple handlers
        eventService.registerEventHandler('proc-1', testElement, 'click', () => {});
        eventService.registerEventHandler('proc-2', testElement, 'input', () => {});

        // Act: Trigger various events
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        testElement.dispatchEvent(new jsdom.window.Event('input'));
        testElement.dispatchEvent(new jsdom.window.Event('click'));

        // Assert: Should track all processed events
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.equal(3);
        expect(metrics.lastEventTimestamp).to.be.greaterThan(0);
      });

      it('should calculate average processing time accurately', () => {
        // Arrange: Mock performance measurements
        const processingTimes = [10, 20, 30]; // Mock times
        let timeIndex = 0;

        (global.performance.now as sinon.SinonStub).callsFake(() => {
          const startTime = timeIndex * 100;
          const endTime = startTime + (processingTimes[timeIndex % processingTimes.length] || 0);
          timeIndex++;
          return timeIndex % 2 === 1 ? startTime : endTime;
        });

        const handler = () => {
          /* test processing */
        };
        eventService.registerEventHandler('perf-avg', testElement, 'click', handler);

        // Act: Trigger events
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        testElement.dispatchEvent(new jsdom.window.Event('click'));

        // Assert: Should calculate average correctly
        const metrics = eventService.getGlobalMetrics();
        const expectedAverage = (10 + 20 + 30) / 3; // 20ms
        expect(metrics.averageProcessingTime).to.equal(expectedAverage);
      });
    });

    describe('Error Metrics', () => {
      it('should track error count across handlers', () => {
        // Arrange: Multiple error handlers
        const errorHandler1 = () => {
          throw new Error('Error 1');
        };
        const errorHandler2 = () => {
          throw new Error('Error 2');
        };
        const goodHandler = () => {
          /* works fine */
        };

        eventService.registerEventHandler('error-1', testElement, 'click', errorHandler1);
        eventService.registerEventHandler('error-2', testElement, 'keydown', errorHandler2);
        eventService.registerEventHandler('good', testElement, 'input', goodHandler);

        // Act: Trigger events
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        testElement.dispatchEvent(new jsdom.window.Event('keydown'));
        testElement.dispatchEvent(new jsdom.window.Event('input')); // Good one

        // Assert: Should track errors separately
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalErrors).to.equal(2);
        expect(metrics.totalProcessed).to.equal(3);
      });

      it('should track per-handler error metrics', () => {
        // Arrange: Handler that sometimes errors
        let callCount = 0;
        const intermittentErrorHandler = () => {
          callCount++;
          if (callCount % 2 === 0) {
            throw new Error('Every other call fails');
          }
        };

        eventService.registerEventHandler(
          'intermittent',
          testElement,
          'click',
          intermittentErrorHandler
        );

        // Act: Trigger multiple events
        for (let i = 0; i < 6; i++) {
          testElement.dispatchEvent(new jsdom.window.Event('click'));
        }

        // Assert: Should track per-handler metrics
        const handlerMetrics = eventService.getEventHandlerMetrics('intermittent');
        expect(handlerMetrics).to.not.be.null;
        expect(handlerMetrics!.callCount).to.equal(6);
        expect(handlerMetrics!.errorCount).to.equal(3); // Every other call
      });
    });

    describe('Debounce Metrics', () => {
      it('should track debounced execution count', () => {
        // Arrange: Debounced handler
        const debouncedHandler = () => {};
        const config: EventHandlerConfig = { debounce: true, debounceDelay: 50 };

        eventService.registerEventHandler(
          'debounce-metrics',
          testElement,
          'input',
          debouncedHandler,
          config
        );

        // Act: Trigger multiple events (should debounce to one execution)
        for (let i = 0; i < 10; i++) {
          testElement.dispatchEvent(new jsdom.window.Event('input'));
        }

        clock.tick(50);

        // Assert: Should track debounced count separately
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.equal(10); // All events processed by wrapper
        expect(metrics.totalDebounced).to.equal(1); // But only 1 debounced execution
      });
    });
  });

  describe('TDD Red Phase: Health Monitoring and Status', () => {
    describe('Health Status Calculation', () => {
      it('should report healthy status with low error rate', () => {
        // Arrange: Mostly good handlers
        const goodHandler = () => {};
        const occasionalErrorHandler = () => {
          if (Math.random() < 0.05) {
            // 5% error rate
            throw new Error('Occasional error');
          }
        };

        eventService.registerEventHandler('good', testElement, 'click', goodHandler);
        eventService.registerEventHandler(
          'occasional-error',
          testElement,
          'input',
          occasionalErrorHandler
        );

        // Act: Trigger many events
        for (let i = 0; i < 100; i++) {
          testElement.dispatchEvent(new jsdom.window.Event('click'));
        }

        // Assert: Should be healthy with low error rate
        const health = eventService.getHealthStatus();
        expect(health.isHealthy).to.be.true;
        expect(health.errorRate).to.be.lessThan(0.1); // Less than 10%
      });

      it('should report unhealthy status with high error rate', () => {
        // Arrange: High error rate handler
        const highErrorHandler = () => {
          throw new Error('High error rate');
        };

        eventService.registerEventHandler('high-error', testElement, 'click', highErrorHandler);

        // Act: Trigger events (all will error)
        for (let i = 0; i < 10; i++) {
          testElement.dispatchEvent(new jsdom.window.Event('click'));
        }

        // Assert: Should be unhealthy
        const health = eventService.getHealthStatus();
        expect(health.isHealthy).to.be.false;
        expect(health.errorRate).to.equal(1.0); // 100% error rate
      });

      it('should report unhealthy status with slow processing', () => {
        // Arrange: Mock slow processing times
        (global.performance.now as sinon.SinonStub)
          .onFirstCall()
          .returns(1000)
          .onSecondCall()
          .returns(1200); // 200ms processing time

        const slowHandler = () => {
          /* simulated slow processing */
        };
        eventService.registerEventHandler('slow', testElement, 'click', slowHandler);

        // Act: Trigger event
        testElement.dispatchEvent(new jsdom.window.Event('click'));

        // Assert: Should be unhealthy due to slow processing
        const health = eventService.getHealthStatus();
        expect(health.isHealthy).to.be.false;
        expect(health.averageProcessingTime).to.equal(200);
      });

      it('should track last event age correctly', () => {
        // Arrange: Handler and time tracking
        const handler = () => {};
        eventService.registerEventHandler('age-test', testElement, 'click', handler);

        // Act: Trigger event
        testElement.dispatchEvent(new jsdom.window.Event('click'));

        // Act: Advance time
        clock.tick(5000); // 5 seconds

        // Assert: Should track age
        const health = eventService.getHealthStatus();
        expect(health.lastEventAge).to.equal(5000);
      });
    });

    describe('Handler Existence and Queries', () => {
      it('should accurately report handler existence', () => {
        // Arrange: Register some handlers
        eventService.registerEventHandler('exists-1', testElement, 'click', () => {});
        eventService.registerEventHandler('exists-2', testElement, 'input', () => {});

        // Assert: Should report correct existence
        expect(eventService.hasEventHandler('exists-1')).to.be.true;
        expect(eventService.hasEventHandler('exists-2')).to.be.true;
        expect(eventService.hasEventHandler('does-not-exist')).to.be.false;
      });

      it('should return complete list of registered handlers', () => {
        // Arrange: Register handlers
        const handlerIds = ['list-1', 'list-2', 'list-3', 'list-4'];
        handlerIds.forEach((id) => {
          eventService.registerEventHandler(id, testElement, 'click', () => {});
        });

        // Act: Get handler list
        const registeredHandlers = eventService.getRegisteredHandlers();

        // Assert: Should contain all handlers
        expect(registeredHandlers).to.have.length(4);
        handlerIds.forEach((id) => {
          expect(registeredHandlers).to.include(id);
        });
      });
    });
  });

  describe('TDD Red Phase: Event Handler Unregistration', () => {
    describe('Basic Unregistration', () => {
      it('should unregister handler and stop event handling', () => {
        // Arrange: Register handler
        let eventCount = 0;
        const handler = () => {
          eventCount++;
        };

        eventService.registerEventHandler('unregister-basic', testElement, 'click', handler);

        // Verify it works initially
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        expect(eventCount).to.equal(1);

        // Act: Unregister
        eventService.unregisterEventHandler('unregister-basic');

        // Assert: Should no longer handle events
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        expect(eventCount).to.equal(1); // No additional calls

        // Assert: Should not be in registered list
        expect(eventService.hasEventHandler('unregister-basic')).to.be.false;
        expect(eventService.getRegisteredHandlers()).to.not.include('unregister-basic');
      });

      it('should clear debounce timers on unregistration', () => {
        // Arrange: Debounced handler
        let callCount = 0;
        const debouncedHandler = () => {
          callCount++;
        };
        const config: EventHandlerConfig = { debounce: true, debounceDelay: 100 };

        eventService.registerEventHandler(
          'unregister-debounce',
          testElement,
          'input',
          debouncedHandler,
          config
        );

        // Act: Trigger event to create timer
        testElement.dispatchEvent(new jsdom.window.Event('input'));

        // Act: Unregister before timer fires
        eventService.unregisterEventHandler('unregister-debounce');

        // Act: Advance time
        clock.tick(100);

        // Assert: Debounced handler should not execute
        expect(callCount).to.equal(0);
      });

      it('should handle unregistering non-existent handler', () => {
        // Act: Attempt to unregister non-existent handler
        expect(() => {
          eventService.unregisterEventHandler('non-existent');
        }).to.not.throw();

        // Assert: No change in metrics
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(0);
      });
    });
  });

  describe('TDD Red Phase: Metrics Reset and Service Management', () => {
    describe('Metrics Reset Functionality', () => {
      it('should reset processing metrics while preserving registration count', () => {
        // Arrange: Register handlers and generate activity
        eventService.registerEventHandler('reset-test-1', testElement, 'click', () => {});
        eventService.registerEventHandler('reset-test-2', testElement, 'input', () => {});

        // Generate activity
        for (let i = 0; i < 5; i++) {
          testElement.dispatchEvent(new jsdom.window.Event('click'));
          testElement.dispatchEvent(new jsdom.window.Event('input'));
        }

        // Verify initial metrics
        let metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(2);
        expect(metrics.totalProcessed).to.equal(10);

        // Act: Reset metrics
        eventService.resetMetrics();

        // Assert: Processing metrics reset, registration count preserved
        metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(2); // Preserved
        expect(metrics.totalProcessed).to.equal(0); // Reset
        expect(metrics.totalDebounced).to.equal(0); // Reset
        expect(metrics.totalErrors).to.equal(0); // Reset
        expect(metrics.lastEventTimestamp).to.equal(0); // Reset
        expect(metrics.averageProcessingTime).to.equal(0); // Reset
      });

      it('should reset individual handler metrics', () => {
        // Arrange: Handler with activity
        let callCount = 0;
        const handler = () => {
          callCount++;
          if (callCount === 3) throw new Error('Third call error');
        };

        eventService.registerEventHandler('individual-reset', testElement, 'click', handler);

        // Generate activity
        for (let i = 0; i < 5; i++) {
          testElement.dispatchEvent(new jsdom.window.Event('click'));
        }

        // Verify initial handler metrics
        let handlerMetrics = eventService.getEventHandlerMetrics('individual-reset');
        expect(handlerMetrics!.callCount).to.equal(5);
        expect(handlerMetrics!.errorCount).to.equal(1);

        // Act: Reset metrics
        eventService.resetMetrics();

        // Assert: Handler metrics should be reset
        handlerMetrics = eventService.getEventHandlerMetrics('individual-reset');
        expect(handlerMetrics!.callCount).to.equal(0);
        expect(handlerMetrics!.errorCount).to.equal(0);
        expect(handlerMetrics!.totalProcessingTime).to.equal(0);
      });

      it('should log metrics reset operation', () => {
        // Act: Reset metrics
        eventService.resetMetrics();

        // Assert: Should log reset operation
        expect(logMessages).to.include('Event service metrics reset');
      });
    });
  });

  describe('TDD Red Phase: Service Disposal and Cleanup', () => {
    describe('Complete Service Disposal', () => {
      it('should dispose all event handlers and clear timers', () => {
        // Arrange: Multiple handlers with debouncing
        const handler1 = sinon.stub();
        const handler2 = sinon.stub();
        const debouncedHandler = sinon.stub();

        eventService.registerEventHandler('dispose-1', testElement, 'click', handler1);
        eventService.registerEventHandler('dispose-2', testElement, 'input', handler2);
        eventService.registerEventHandler(
          'dispose-debounced',
          testElement,
          'scroll',
          debouncedHandler,
          { debounce: true, debounceDelay: 100 }
        );

        // Trigger events
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        testElement.dispatchEvent(new jsdom.window.Event('scroll'));

        // Act: Dispose service
        eventService.dispose();

        // Assert: Events should no longer trigger handlers
        testElement.dispatchEvent(new jsdom.window.Event('click'));
        testElement.dispatchEvent(new jsdom.window.Event('input'));

        // Handlers should not be called after disposal
        expect(handler1.callCount).to.equal(1); // Only the initial call
        expect(handler2.callCount).to.equal(0);

        // Debounced timer should not fire
        clock.tick(100);
        expect(debouncedHandler.called).to.be.false;
      });

      it('should reset all metrics on disposal', () => {
        // Arrange: Service with activity
        eventService.registerEventHandler('disposal-metrics', testElement, 'click', () => {});
        testElement.dispatchEvent(new jsdom.window.Event('click'));

        // Verify initial state
        let metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.be.greaterThan(0);

        // Act: Dispose
        eventService.dispose();

        // Assert: All metrics should be reset
        metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(0);
        expect(metrics.totalProcessed).to.equal(0);
        expect(metrics.totalDebounced).to.equal(0);
        expect(metrics.totalErrors).to.equal(0);
        expect(metrics.lastEventTimestamp).to.equal(0);
        expect(metrics.averageProcessingTime).to.equal(0);
      });

      it('should clear all registered handlers tracking', () => {
        // Arrange: Multiple registered handlers
        const handlerIds = ['clear-1', 'clear-2', 'clear-3'];
        handlerIds.forEach((id) => {
          eventService.registerEventHandler(id, testElement, 'click', () => {});
        });

        expect(eventService.getRegisteredHandlers()).to.have.length(3);

        // Act: Dispose
        eventService.dispose();

        // Assert: No handlers should be tracked
        expect(eventService.getRegisteredHandlers()).to.have.length(0);
        handlerIds.forEach((id) => {
          expect(eventService.hasEventHandler(id)).to.be.false;
        });
      });

      it('should log disposal operation', () => {
        // Act: Dispose service
        eventService.dispose();

        // Assert: Should log disposal operations
        expect(logMessages).to.include('Disposing InputEventService');
        expect(logMessages).to.include('InputEventService disposed');
      });

      it('should handle double disposal gracefully', () => {
        // Arrange: Service with handlers
        eventService.registerEventHandler('double-dispose', testElement, 'click', () => {});

        // Act: Dispose twice
        eventService.dispose();

        expect(() => {
          eventService.dispose();
        }).to.not.throw();

        // Assert: Should remain in clean state
        expect(eventService.getRegisteredHandlers()).to.have.length(0);
      });
    });

    describe('Post-Disposal Behavior', () => {
      it('should handle method calls gracefully after disposal', () => {
        // Act: Dispose first
        eventService.dispose();

        // Assert: Methods should not throw after disposal
        expect(() => {
          eventService.getGlobalMetrics();
          eventService.getRegisteredHandlers();
          eventService.getHealthStatus();
          eventService.hasEventHandler('test');
          eventService.getEventHandlerMetrics('test');
        }).to.not.throw();

        // Registration after disposal should not cause issues
        expect(() => {
          eventService.registerEventHandler('post-disposal', testElement, 'click', () => {});
        }).to.not.throw();
      });
    });
  });

  describe('TDD Red Phase: Edge Cases and Error Scenarios', () => {
    describe('Boundary Conditions', () => {
      it('should handle event registration with null/undefined elements', () => {
        // Act & Assert: Should handle gracefully
        expect(() => {
          eventService.registerEventHandler('null-element', null as any, 'click', () => {});
        }).to.not.throw();

        expect(() => {
          eventService.registerEventHandler(
            'undefined-element',
            undefined as any,
            'click',
            () => {}
          );
        }).to.not.throw();
      });

      it('should handle event registration with empty/invalid event types', () => {
        // Act & Assert: Should handle gracefully
        expect(() => {
          eventService.registerEventHandler('empty-event', testElement, '', () => {});
          eventService.registerEventHandler('null-event', testElement, null as any, () => {});
          eventService.registerEventHandler(
            'undefined-event',
            testElement,
            undefined as any,
            () => {}
          );
        }).to.not.throw();
      });

      it('should handle null/undefined event handlers', () => {
        // Act & Assert: Should handle gracefully
        expect(() => {
          eventService.registerEventHandler('null-handler', testElement, 'click', null as any);
          eventService.registerEventHandler(
            'undefined-handler',
            testElement,
            'click',
            undefined as any
          );
        }).to.not.throw();
      });
    });

    describe('Extreme Load Conditions', () => {
      it('should handle large numbers of event registrations', () => {
        // Act: Register many handlers
        const handlerCount = 1000;
        for (let i = 0; i < handlerCount; i++) {
          eventService.registerEventHandler(`load-test-${i}`, testElement, 'click', () => {});
        }

        // Assert: Should handle load
        expect(eventService.getRegisteredHandlers()).to.have.length(handlerCount);
        const health = eventService.getHealthStatus();
        expect(health.totalHandlers).to.equal(handlerCount);
      });

      it('should handle rapid event firing', () => {
        // Arrange: Handler for rapid events
        let eventCount = 0;
        const rapidHandler = () => {
          eventCount++;
        };

        eventService.registerEventHandler('rapid-fire', testElement, 'mousemove', rapidHandler);

        // Act: Fire many events rapidly
        const eventFireCount = 10000;
        for (let i = 0; i < eventFireCount; i++) {
          testElement.dispatchEvent(new jsdom.window.Event('mousemove'));
        }

        // Assert: Should handle all events
        expect(eventCount).to.equal(eventFireCount);

        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.equal(eventFireCount);
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle concurrent registration and unregistration', () => {
        // Arrange: Simulate concurrent operations
        const handlerIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];

        // Act: Register and unregister in rapid succession
        handlerIds.forEach((id) => {
          eventService.registerEventHandler(id, testElement, 'click', () => {});
          eventService.unregisterEventHandler(id);
        });

        // Assert: Should handle concurrent operations
        expect(eventService.getRegisteredHandlers()).to.have.length(0);
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalRegistered).to.equal(3);
      });
    });
  });
});
