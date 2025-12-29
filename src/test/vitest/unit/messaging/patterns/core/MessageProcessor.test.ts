
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageProcessor } from '../../../../../../messaging/patterns/core/MessageProcessor';
import { LogLevel } from '../../../../../../messaging/patterns/core/MessageLogger';
import { IMessageHandler } from '../../../../../../messaging/patterns/core/IMessageHandler';

describe('MessageProcessor', () => {
  let processor: MessageProcessor;
  let mockCoordinator: any;

  beforeEach(() => {
    mockCoordinator = {
      postMessageToExtension: vi.fn(),
    };
    processor = new MessageProcessor({
      logLevel: LogLevel.NONE, // Silence logs for tests
      enableValidation: false, // Simplify basic tests
    });
  });

  afterEach(() => {
    processor.dispose();
  });

  it('should not process messages before initialization', async () => {
    const result = await processor.processMessage({ command: 'test', id: '1', timestamp: 123 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Processor not initialized');
  });

  describe('Initialized', () => {
    beforeEach(async () => {
      await processor.initialize(mockCoordinator);
    });

    it('should return error if no handler found', async () => {
      const result = await processor.processMessage({ command: 'unknown', id: '1', timestamp: 123 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler found');
    });

    it('should register and execute a handler', async () => {
      const handler: IMessageHandler = {
        getName: () => 'TestHandler',
        getPriority: () => 100,
        getSupportedCommands: () => ['testCommand'],
        canHandle: () => true,
        handle: vi.fn().mockResolvedValue(undefined),
      };

      processor.registerHandler(handler);
      expect(processor.hasHandler('testCommand')).toBe(true);

      const result = await processor.processMessage({ command: 'testCommand', id: '1', timestamp: 123 });
      
      expect(result.success).toBe(true);
      expect(result.handledBy).toBe('TestHandler');
      expect(handler.handle).toHaveBeenCalled();
    });

    it('should respect handler priority', async () => {
      const log: string[] = [];
      const lowPriorityHandler: IMessageHandler = {
        getName: () => 'Low',
        getPriority: () => 1,
        getSupportedCommands: () => ['cmd'],
        canHandle: () => true,
        handle: async () => { log.push('low'); },
      };
      const highPriorityHandler: IMessageHandler = {
        getName: () => 'High',
        getPriority: () => 10,
        getSupportedCommands: () => ['cmd'],
        canHandle: () => true,
        handle: async () => { log.push('high'); },
      };

      processor.registerHandler(lowPriorityHandler);
      processor.registerHandler(highPriorityHandler);

      await processor.processMessage({ command: 'cmd', id: '1', timestamp: 123 });
      
      expect(log).toEqual(['high']); // Highest priority handles first and stops chain if successful
    });

    it('should fall back to next handler if first one fails', async () => {
      const failingHandler: IMessageHandler = {
        getName: () => 'Failing',
        getPriority: () => 10,
        getSupportedCommands: () => ['cmd'],
        canHandle: () => true,
        handle: async () => { throw new Error('First failed'); },
      };
      const fallbackHandler: IMessageHandler = {
        getName: () => 'Fallback',
        getPriority: () => 1,
        getSupportedCommands: () => ['cmd'],
        canHandle: () => true,
        handle: vi.fn().mockResolvedValue(undefined),
      };

      processor.registerHandler(failingHandler);
      processor.registerHandler(fallbackHandler);

      const result = await processor.processMessage({ command: 'cmd', id: '1', timestamp: 123 });
      
      expect(result.success).toBe(true);
      expect(result.handledBy).toBe('Fallback');
      expect(fallbackHandler.handle).toHaveBeenCalled();
    });

    it('should handle timeouts', async () => {
      vi.useFakeTimers();
      
      // Re-create processor with short timeout
      const timeoutProcessor = new MessageProcessor({
        handlerTimeout: 100,
        logLevel: LogLevel.DEBUG,
        enableValidation: false
      });
      await timeoutProcessor.initialize(mockCoordinator);

      const slowHandler: IMessageHandler = {
        getName: () => 'Slow',
        getPriority: () => 1,
        getSupportedCommands: () => ['slowCmd'],
        canHandle: () => {
          return true;
        },
        handle: () => {
          return new Promise((resolve) => setTimeout(resolve, 1000));
        },
      };

      timeoutProcessor.registerHandler(slowHandler);

      const processPromise = timeoutProcessor.processMessage({ command: 'slowCmd', id: '1', timestamp: 123 });
      
      await vi.advanceTimersByTimeAsync(200);
      
      const result = await processPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('No suitable handler found');
      
      vi.useRealTimers();
    });
  });

  describe('Validation', () => {
    it('should validate messages if enabled', async () => {
      const validator = {
        validate: vi.fn().mockImplementation(() => { throw new Error('Invalid'); })
      };
      const validationProcessor = new MessageProcessor({
        enableValidation: true,
        validator: validator as any,
        logLevel: LogLevel.NONE
      });
      await validationProcessor.initialize(mockCoordinator);

      const result = await validationProcessor.processMessage({ command: 'any', id: '1', timestamp: 123 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed: Invalid');
      expect(validator.validate).toHaveBeenCalled();
    });
  });

  it('should provide stats', async () => {
    await processor.initialize(mockCoordinator);
    processor.registerHandler({
      getName: () => 'H1',
      getPriority: () => 1,
      getSupportedCommands: () => ['c1', 'c2'],
      canHandle: () => true,
      handle: async () => {},
    });

    const stats = processor.getStats();
    expect(stats.totalHandlers).toBe(1);
    expect(stats.totalCommands).toBe(2);
    expect(stats.isInitialized).toBe(true);
    expect(stats.registeredCommands).toEqual(['c1', 'c2']);
  });
});
