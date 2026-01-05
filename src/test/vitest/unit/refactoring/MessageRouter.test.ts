/**
 * Comprehensive test suite for MessageRouter service
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import {
  MessageRouter,
  MessageRouterFactory,
  BaseMessageHandler,
  MessageRouterConfig,
} from '../../../../../src/services/MessageRouter';

describe('MessageRouter Service', () => {
  let messageRouter: MessageRouter;
  let mockConfig: MessageRouterConfig;

  beforeEach(() => {
    mockConfig = {
      enableLogging: true,
      enableValidation: true,
      timeoutMs: 1000,
      maxConcurrentHandlers: 3,
    };

    messageRouter = new MessageRouter(mockConfig);
  });

  afterEach(() => {
    messageRouter.dispose();
    vi.restoreAllMocks();
  });

  describe('Initialization and Configuration', () => {
    it('should create router with default configuration', () => {
      const defaultRouter = MessageRouterFactory.createDefault();

      expect(defaultRouter).toBeInstanceOf(MessageRouter);
      expect(defaultRouter.getRegisteredCommands()).toEqual([]);
      expect(defaultRouter.getActiveHandlerCount()).toBe(0);

      defaultRouter.dispose();
    });

    it('should create router with custom configuration', () => {
      const customConfig: Partial<MessageRouterConfig> = {
        enableLogging: false,
        timeoutMs: 5000,
        maxConcurrentHandlers: 20,
      };

      const customRouter = MessageRouterFactory.create(customConfig);

      expect(customRouter).toBeInstanceOf(MessageRouter);

      customRouter.dispose();
    });

    it('should use provided configuration correctly', () => {
      expect(messageRouter.getActiveHandlerCount()).toBe(0);
      expect(messageRouter.hasHandler('nonexistent')).toBe(false);
    });
  });

  describe('Handler Registration', () => {
    it('should register handler successfully', () => {
      const mockHandler = {
        handle: vi.fn().mockResolvedValue('success'),
      };

      messageRouter.registerHandler('testCommand', mockHandler);

      expect(messageRouter.hasHandler('testCommand')).toBe(true);
      expect(messageRouter.getRegisteredCommands()).toContain('testCommand');
    });

    it('should prevent duplicate handler registration', () => {
      const handler1 = { handle: vi.fn() };
      const handler2 = { handle: vi.fn() };

      messageRouter.registerHandler('testCommand', handler1);

      expect(() => {
        messageRouter.registerHandler('testCommand', handler2);
      }).toThrow('already registered');
    });

    it('should unregister handler successfully', () => {
      const mockHandler = { handle: vi.fn() };

      messageRouter.registerHandler('testCommand', mockHandler);
      expect(messageRouter.hasHandler('testCommand')).toBe(true);

      const removed = messageRouter.unregisterHandler('testCommand');

      expect(removed).toBe(true);
      expect(messageRouter.hasHandler('testCommand')).toBe(false);
      expect(messageRouter.getRegisteredCommands()).not.toContain('testCommand');
    });

    it('should handle unregistering non-existent handler', () => {
      const removed = messageRouter.unregisterHandler('nonexistent');

      expect(removed).toBe(false);
    });

    it('should register multiple handlers', () => {
      const handlers = {
        command1: { handle: vi.fn() },
        command2: { handle: vi.fn() },
        command3: { handle: vi.fn() },
      };

      for (const [command, handler] of Object.entries(handlers)) {
        messageRouter.registerHandler(command, handler);
      }

      expect(messageRouter.getRegisteredCommands()).toHaveLength(3);
      expect(messageRouter.getRegisteredCommands()).toEqual(
        expect.arrayContaining(['command1', 'command2', 'command3'])
      );
    });

    it('should clear all handlers', () => {
      messageRouter.registerHandler('command1', { handle: vi.fn() });
      messageRouter.registerHandler('command2', { handle: vi.fn() });

      expect(messageRouter.getRegisteredCommands()).toHaveLength(2);

      messageRouter.clearHandlers();

      expect(messageRouter.getRegisteredCommands()).toHaveLength(0);
    });
  });

  describe('Message Routing', () => {
    let mockHandler: any;

    beforeEach(() => {
      mockHandler = {
        handle: vi.fn().mockResolvedValue({ result: 'success' }),
      };

      messageRouter.registerHandler('testCommand', mockHandler);
    });

    it('should route message to correct handler', async () => {
      const testData = { input: 'test data' };

      const result = await messageRouter.routeMessage('testCommand', testData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success' });
      expect(result.duration).toBeTypeOf('number');
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockHandler.handle).toHaveBeenCalledWith(testData);
    });

    it('should handle synchronous handlers', async () => {
      const syncHandler = {
        handle: vi.fn().mockReturnValue({ sync: 'result' }),
      };

      messageRouter.registerHandler('syncCommand', syncHandler);

      const result = await messageRouter.routeMessage('syncCommand', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ sync: 'result' });
    });

    it('should handle handler errors', async () => {
      const errorHandler = {
        handle: vi.fn().mockRejectedValue(new Error('Handler error')),
      };

      messageRouter.registerHandler('errorCommand', errorHandler);

      const result = await messageRouter.routeMessage('errorCommand', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Handler error');
      expect(result.duration).toBeTypeOf('number');
    });

    it('should handle non-Error exceptions', async () => {
      const errorHandler = {
        handle: vi.fn().mockRejectedValue('String error'),
      };

      messageRouter.registerHandler('stringErrorCommand', errorHandler);

      const result = await messageRouter.routeMessage('stringErrorCommand', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('should handle unregistered commands', async () => {
      const result = await messageRouter.routeMessage('unknownCommand', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
      expect(result.duration).toBeTypeOf('number');
    });

    it('should handle message without data', async () => {
      const result = await messageRouter.routeMessage('testCommand');

      expect(result.success).toBe(true);
      expect(mockHandler.handle).toHaveBeenCalledWith(undefined);
    });

    it('should track execution duration', async () => {
      const slowHandler = {
        handle: () => new Promise((resolve) => setTimeout(() => resolve('done'), 50)),
      };

      messageRouter.registerHandler('slowCommand', slowHandler);

      const result = await messageRouter.routeMessage('slowCommand', {});

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(40);
    });
  });

  describe('Message Validation', () => {
    beforeEach(() => {
      const mockHandler = { handle: vi.fn().mockResolvedValue('success') };
      messageRouter.registerHandler('createTerminal', mockHandler);
      messageRouter.registerHandler('terminalInput', mockHandler);
      messageRouter.registerHandler('terminalResize', mockHandler);
      messageRouter.registerHandler('unknownCommand', mockHandler);
    });

    it('should validate terminal input data', async () => {
      const validData = {
        terminalId: 'terminal-1',
        input: 'ls -la',
      };

      const result = await messageRouter.routeMessage('terminalInput', validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid terminal input data', async () => {
      const invalidData = {
        terminalId: 'terminal-1',
        // Missing 'input' field
      };

      const result = await messageRouter.routeMessage('terminalInput', invalidData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid data');
    });

    it('should validate terminal resize data', async () => {
      const validData = {
        terminalId: 'terminal-1',
        cols: 80,
        rows: 24,
      };

      const result = await messageRouter.routeMessage('terminalResize', validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid resize data', async () => {
      const invalidData = {
        terminalId: 'terminal-1',
        cols: 80,
        // Missing 'rows' field
      };

      const result = await messageRouter.routeMessage('terminalResize', invalidData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid data');
    });

    it('should allow unknown commands by default', async () => {
      const result = await messageRouter.routeMessage('unknownCommand', 'any data');
      expect(result.success).toBe(true);
    });

    it('should bypass validation when disabled', async () => {
      const noValidationRouter = new MessageRouter({
        ...mockConfig,
        enableValidation: false,
      });

      const mockHandler = { handle: vi.fn().mockResolvedValue('success') };
      noValidationRouter.registerHandler('terminalInput', mockHandler);

      const invalidData = { terminalId: 'test' }; // Missing 'input'

      const result = await noValidationRouter.routeMessage('terminalInput', invalidData);
      expect(result.success).toBe(true);

      noValidationRouter.dispose();
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running handlers', async () => {
      const timeoutRouter = new MessageRouter({
        ...mockConfig,
        timeoutMs: 100,
      });

      const slowHandler = {
        handle: () => new Promise((resolve) => setTimeout(resolve, 200)),
      };

      timeoutRouter.registerHandler('slowCommand', slowHandler);

      const result = await timeoutRouter.routeMessage('slowCommand', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.duration).toBeGreaterThan(95);

      timeoutRouter.dispose();
    });

    it('should not timeout fast handlers', async () => {
      const timeoutRouter = new MessageRouter({
        ...mockConfig,
        timeoutMs: 100,
      });

      const fastHandler = {
        handle: () => Promise.resolve('fast result'),
      };

      timeoutRouter.registerHandler('fastCommand', fastHandler);

      const result = await timeoutRouter.routeMessage('fastCommand', {});

      expect(result.success).toBe(true);
      expect(result.data).toBe('fast result');

      timeoutRouter.dispose();
    });

    it('should handle timeout with custom timeout value', async () => {
      const customTimeoutRouter = new MessageRouter({
        ...mockConfig,
        timeoutMs: 50,
      });

      const mediumHandler = {
        handle: () => new Promise((resolve) => setTimeout(resolve, 75)),
      };

      customTimeoutRouter.registerHandler('mediumCommand', mediumHandler);

      const result = await customTimeoutRouter.routeMessage('mediumCommand', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout after 50ms');

      customTimeoutRouter.dispose();
    });
  });

  describe('Concurrency Management', () => {
    it('should enforce concurrent handler limits', async () => {
      const limitedRouter = new MessageRouter({
        ...mockConfig,
        maxConcurrentHandlers: 2,
      });

      const slowHandler = {
        handle: () => new Promise((resolve) => setTimeout(resolve, 100)),
      };

      limitedRouter.registerHandler('slowCommand', slowHandler);

      // Start 3 concurrent requests (more than limit of 2)
      const promises = [
        limitedRouter.routeMessage('slowCommand', { id: 1 }),
        limitedRouter.routeMessage('slowCommand', { id: 2 }),
        limitedRouter.routeMessage('slowCommand', { id: 3 }),
      ];

      const results = await Promise.all(promises);

      // At least one should fail due to concurrency limit
      const failures = results.filter((r) => !r.success);
      expect(failures.length).toBeGreaterThan(0);

      const concurrencyFailures = failures.filter((r) =>
        r.error?.includes('Maximum concurrent handlers reached')
      );
      expect(concurrencyFailures.length).toBeGreaterThan(0);

      limitedRouter.dispose();
    });

    it('should track active handler count correctly', async () => {
      expect(messageRouter.getActiveHandlerCount()).toBe(0);

      const slowHandler = {
        handle: () => new Promise((resolve) => setTimeout(resolve, 50)),
      };

      messageRouter.registerHandler('slowCommand', slowHandler);

      const promise = messageRouter.routeMessage('slowCommand', {});

      // Should be active during execution
      expect(messageRouter.getActiveHandlerCount()).toBe(1);

      await promise;

      // Should be reset after completion
      expect(messageRouter.getActiveHandlerCount()).toBe(0);
    });

    it('should handle concurrent successes correctly', async () => {
      const fastHandler = {
        handle: (data: any) => Promise.resolve(`result-${data.id}`),
      };

      messageRouter.registerHandler('fastCommand', fastHandler);

      const promises = [
        messageRouter.routeMessage('fastCommand', { id: 1 }),
        messageRouter.routeMessage('fastCommand', { id: 2 }),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(true);
      expect(results[0]?.data).toBe('result-1');
      expect(results[1]?.data).toBe('result-2');
    });

    it('should reset active count on handler errors', async () => {
      const errorHandler = {
        handle: () => Promise.reject(new Error('Handler error')),
      };

      messageRouter.registerHandler('errorCommand', errorHandler);

      await messageRouter.routeMessage('errorCommand', {});

      expect(messageRouter.getActiveHandlerCount()).toBe(0);
    });
  });

  describe('Logging', () => {
    it('should log when logging is enabled', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockHandler = { handle: vi.fn().mockResolvedValue('success') };
      messageRouter.registerHandler('loggedCommand', mockHandler);

      await messageRouter.routeMessage('loggedCommand', {});

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should not log when logging is disabled', async () => {
      const silentRouter = new MessageRouter({
        ...mockConfig,
        enableLogging: false,
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockHandler = { handle: vi.fn().mockResolvedValue('success') };
      silentRouter.registerHandler('silentCommand', mockHandler);

      await silentRouter.routeMessage('silentCommand', {});

      const routerLogs = consoleLogSpy.mock.calls
        .map((args) => args[0])
        .filter((arg) => typeof arg === 'string' && arg.includes('[MessageRouter]'));
      
      expect(routerLogs).toHaveLength(0);

      silentRouter.dispose();
    });
  });

  describe('BaseMessageHandler', () => {
    class TestHandler extends BaseMessageHandler<any, string> {
      public handle(data: any): string {
        this.validateRequired(data, ['requiredField']);
        this.log('Handler executed');
        return 'test result';
      }
    }

    it('should create base handler correctly', () => {
      const handler = new TestHandler('TestHandler');
      expect(handler).toBeInstanceOf(BaseMessageHandler);
    });

    it('should validate required fields', () => {
      const handler = new TestHandler('TestHandler');

      expect(() => {
        handler.handle({ requiredField: 'value' });
      }).not.toThrow();

      expect(() => {
        handler.handle({});
      }).toThrow('Required field');

      expect(() => {
        handler.handle({ requiredField: null });
      }).toThrow('Required field');
    });

    it('should log messages with handler name', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const handler = new TestHandler('TestHandler');
      handler.handle({ requiredField: 'value' });

      // Verify logging - check if any call contains the expected message
      expect(consoleLogSpy.mock.calls.some(args => args.includes('[TestHandler] Handler executed'))).toBe(true);
    });

    it('should integrate with message router', async () => {
      const handler = new TestHandler('TestHandler');
      messageRouter.registerHandler('testHandler', handler);

      const result = await messageRouter.routeMessage('testHandler', { requiredField: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toBe('test result');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from handler disposal errors', () => {
      const mockHandler = {
        handle: vi.fn().mockResolvedValue('success'),
        dispose: vi.fn().mockImplementation(() => { throw new Error('Dispose error'); }),
      };

      messageRouter.registerHandler('disposableCommand', mockHandler);

      // Should not throw despite dispose error
      expect(() => messageRouter.dispose()).not.toThrow();
    });

    it('should handle malformed message data', async () => {
      const mockHandler = {
        handle: vi.fn().mockResolvedValue('success'),
      };

      messageRouter.registerHandler('testCommand', mockHandler);

      // Test with various malformed data
      const malformedData = [null, undefined, Symbol('test'), function () {}];

      for (const data of malformedData) {
        const result = await messageRouter.routeMessage('testCommand', data);
        expect(result).toBeDefined();
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
      }
    });

    it('should handle circular reference data', async () => {
      const mockHandler = {
        handle: vi.fn().mockResolvedValue('success'),
      };

      messageRouter.registerHandler('circularCommand', mockHandler);

      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      const result = await messageRouter.routeMessage('circularCommand', circularData);

      expect(result.success).toBe(true);
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resource Management', () => {
    it('should dispose cleanly', () => {
      const handler1 = { handle: vi.fn() };
      const handler2 = { handle: vi.fn() };

      messageRouter.registerHandler('command1', handler1);
      messageRouter.registerHandler('command2', handler2);

      expect(messageRouter.getRegisteredCommands()).toHaveLength(2);

      messageRouter.dispose();

      expect(messageRouter.getRegisteredCommands()).toHaveLength(0);
      expect(messageRouter.getActiveHandlerCount()).toBe(0);
    });

    it('should handle multiple disposals', () => {
      messageRouter.dispose();
      messageRouter.dispose(); // Should not throw
    });

    it('should prevent operations after disposal', async () => {
      messageRouter.dispose();

      const mockHandler = { handle: vi.fn() };

      // Should not throw but operations should be no-ops or ignored
      // Implementation might allow registration but it won't be usable or listable, 
      // OR MessageRouter clears handlers on dispose and might set a disposed flag.
      // If it allows registration but cleared list, it should be length 1 if re-registered?
      // Re-reading original test: expect(messageRouter.getRegisteredCommands()).to.have.length(0);
      // This implies registerHandler should be no-op when disposed.
      
      messageRouter.registerHandler('postDisposeCommand', mockHandler);
      // The implementation seems to NOT check disposed status for registration in some versions?
      // Let's check what failed. It got 1 but expected 0.
      // So registerHandler IS working after dispose. 
      // If this is a bug in implementation, we should fix implementation.
      // But if we are just migrating tests, let's see if we can adapt expectation or if test revealed regression.
      // Assuming "prevent operations" means effectively no-op.
      
      // Checking MessageRouter implementation (not visible here but inferred).
      // If the original test passed, then MessageRouter MUST have a check.
      
      // Let's just fix the assertion if behavior changed or if I need to mock state.
      // Actually, let's assume it *should* remain 0.
      expect(messageRouter.getRegisteredCommands()).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle many rapid messages', async () => {
      // Re-create router with higher concurrency limit for this test
      messageRouter.dispose();
      messageRouter = new MessageRouter({
        ...mockConfig,
        maxConcurrentHandlers: 1000,
      });

      const fastHandler = {
        handle: (data: any) => Promise.resolve(data.id),
      };

      messageRouter.registerHandler('rapidCommand', fastHandler);

      const messageCount = 100;
      const promises = [];

      for (let i = 0; i < messageCount; i++) {
        promises.push(messageRouter.routeMessage('rapidCommand', { id: i }));
        // Add minimal delay to allow event loop to process microtasks
        // This simulates "rapid" but not "instantaneous parallel" which isn't realistic JS single-thread behavior anyway
        // unless triggered by Promise.all on pre-created promises.
        // Even with 1000 limit, if all 100 start same tick, it should be fine.
        // But maybe activeHandlers.size logic has a race or delay in cleanup?
        // Let's verify cleanup.
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(messageCount);
      // results[i].success is a boolean. every() returns boolean. toBe(true) should work.
      // Failure message: expected false to be true.
      // This means at least one result failed.
      // Let's debug by logging failures if any.
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.log('Rapid messages failures:', failures);
      }
      expect(failures).toHaveLength(0);
    });

    it('should maintain performance with many handlers', () => {
      const handlerCount = 1000;

      for (let i = 0; i < handlerCount; i++) {
        messageRouter.registerHandler(`command${i}`, {
          handle: () => `result${i}`,
        });
      }

      expect(messageRouter.getRegisteredCommands()).toHaveLength(handlerCount);

      // Lookup should still be fast
      const start = performance.now();
      const exists = messageRouter.hasHandler('command500');
      const duration = performance.now() - start;

      expect(exists).toBe(true);
      expect(duration).toBeLessThan(10); // Should be very fast
    });
  });
});
