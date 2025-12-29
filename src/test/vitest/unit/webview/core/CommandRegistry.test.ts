/**
 * CommandRegistry Unit Tests
 *
 * Tests for command registry functionality including:
 * - Handler registration (single and bulk)
 * - Priority-based handler execution
 * - Category grouping
 * - Middleware support
 * - Message dispatch
 * - Registry statistics and cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CommandRegistry,
  CommandMessage,
  CommandMiddleware,
  createLoggingMiddleware,
  createPerformanceMiddleware,
} from '../../../../../webview/core/CommandRegistry';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  afterEach(() => {
    registry.clear();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a new empty registry', () => {
      const stats = registry.getStats();
      expect(stats.totalCommands).toBe(0);
      expect(stats.totalHandlers).toBe(0);
      expect(stats.categories).toHaveLength(0);
      expect(stats.middlewareCount).toBe(0);
    });
  });

  describe('register', () => {
    it('should register a command handler', () => {
      const handler = vi.fn();
      registry.register('testCommand', handler);

      expect(registry.has('testCommand')).toBe(true);
      expect(registry.getCommands()).toContain('testCommand');
    });

    it('should register handler with priority', () => {
      const handler = vi.fn();
      registry.register('testCommand', handler, { priority: 'high' });

      expect(registry.has('testCommand')).toBe(true);
    });

    it('should register handler with category', () => {
      const handler = vi.fn();
      registry.register('testCommand', handler, { category: 'lifecycle' });

      expect(registry.getByCategory('lifecycle')).toContain('testCommand');
    });

    it('should register handler with description', () => {
      const handler = vi.fn();
      registry.register('testCommand', handler, { description: 'Test description' });

      expect(registry.has('testCommand')).toBe(true);
    });

    it('should register multiple handlers for same command', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.register('testCommand', handler1);
      registry.register('testCommand', handler2);

      const stats = registry.getStats();
      expect(stats.totalCommands).toBe(1);
      expect(stats.totalHandlers).toBe(2);
    });

    it('should order handlers by priority', async () => {
      const executionOrder: string[] = [];

      registry.register('testCommand', () => { executionOrder.push('low'); }, { priority: 'low' });
      registry.register('testCommand', () => { executionOrder.push('high'); }, { priority: 'high' });
      registry.register('testCommand', () => { executionOrder.push('normal'); }, { priority: 'normal' });

      await registry.dispatch({ command: 'testCommand' });

      expect(executionOrder).toEqual(['high', 'normal', 'low']);
    });
  });

  describe('registerBulk', () => {
    it('should register multiple handlers at once', () => {
      const handlers = {
        command1: vi.fn(),
        command2: vi.fn(),
        command3: vi.fn(),
      };

      registry.registerBulk(handlers);

      expect(registry.has('command1')).toBe(true);
      expect(registry.has('command2')).toBe(true);
      expect(registry.has('command3')).toBe(true);
    });

    it('should apply common options to all handlers', () => {
      const handlers = {
        command1: vi.fn(),
        command2: vi.fn(),
      };

      registry.registerBulk(handlers, { category: 'bulk-category', priority: 'high' });

      expect(registry.getByCategory('bulk-category')).toContain('command1');
      expect(registry.getByCategory('bulk-category')).toContain('command2');
    });

    it('should return correct stats after bulk registration', () => {
      const handlers = {
        cmd1: vi.fn(),
        cmd2: vi.fn(),
        cmd3: vi.fn(),
        cmd4: vi.fn(),
      };

      registry.registerBulk(handlers);

      const stats = registry.getStats();
      expect(stats.totalCommands).toBe(4);
      expect(stats.totalHandlers).toBe(4);
    });
  });

  describe('unregister', () => {
    it('should unregister an existing command', () => {
      registry.register('testCommand', vi.fn());
      expect(registry.has('testCommand')).toBe(true);

      const result = registry.unregister('testCommand');

      expect(result).toBe(true);
      expect(registry.has('testCommand')).toBe(false);
    });

    it('should return false for non-existent command', () => {
      const result = registry.unregister('nonExistent');
      expect(result).toBe(false);
    });

    it('should remove command from category', () => {
      registry.register('testCommand', vi.fn(), { category: 'testCategory' });
      expect(registry.getByCategory('testCategory')).toContain('testCommand');

      registry.unregister('testCommand');

      expect(registry.getByCategory('testCategory')).not.toContain('testCommand');
    });
  });

  describe('use (middleware)', () => {
    it('should add middleware', () => {
      const middleware: CommandMiddleware = async (_msg, _ctx, next) => {
        await next();
      };

      registry.use(middleware);

      const stats = registry.getStats();
      expect(stats.middlewareCount).toBe(1);
    });

    it('should add multiple middlewares', () => {
      const middleware1: CommandMiddleware = async (_msg, _ctx, next) => { await next(); };
      const middleware2: CommandMiddleware = async (_msg, _ctx, next) => { await next(); };

      registry.use(middleware1);
      registry.use(middleware2);

      const stats = registry.getStats();
      expect(stats.middlewareCount).toBe(2);
    });
  });

  describe('dispatch', () => {
    it('should dispatch message to registered handler', async () => {
      const handler = vi.fn();
      registry.register('testCommand', handler);

      const message: CommandMessage = { command: 'testCommand', data: 'test' };
      const result = await registry.dispatch(message);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledWith(message, expect.any(Object));
    });

    it('should return false for unregistered command', async () => {
      const message: CommandMessage = { command: 'unknownCommand' };
      const result = await registry.dispatch(message);

      expect(result).toBe(false);
    });

    it('should execute all handlers for a command', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.register('testCommand', handler1);
      registry.register('testCommand', handler2);

      await registry.dispatch({ command: 'testCommand' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should execute middleware before handlers', async () => {
      const executionOrder: string[] = [];

      const middleware: CommandMiddleware = async (_msg, _ctx, next) => {
        executionOrder.push('middleware-before');
        await next();
        executionOrder.push('middleware-after');
      };

      registry.use(middleware);
      registry.register('testCommand', () => {
        executionOrder.push('handler');
      });

      await registry.dispatch({ command: 'testCommand' });

      expect(executionOrder).toEqual(['middleware-before', 'handler', 'middleware-after']);
    });

    it('should chain multiple middlewares', async () => {
      const executionOrder: string[] = [];

      const middleware1: CommandMiddleware = async (_msg, _ctx, next) => {
        executionOrder.push('m1-before');
        await next();
        executionOrder.push('m1-after');
      };

      const middleware2: CommandMiddleware = async (_msg, _ctx, next) => {
        executionOrder.push('m2-before');
        await next();
        executionOrder.push('m2-after');
      };

      registry.use(middleware1);
      registry.use(middleware2);
      registry.register('testCommand', () => {
        executionOrder.push('handler');
      });

      await registry.dispatch({ command: 'testCommand' });

      expect(executionOrder).toEqual([
        'm1-before',
        'm2-before',
        'handler',
        'm2-after',
        'm1-after',
      ]);
    });

    it('should provide context to handlers', async () => {
      let receivedContext: any = null;

      registry.register('testCommand', (_msg, ctx) => {
        receivedContext = ctx;
      });

      await registry.dispatch({ command: 'testCommand' });

      expect(receivedContext).toBeDefined();
      expect(receivedContext.registry).toBe(registry);
      expect(receivedContext.data).toBeDefined();
    });

    it('should throw error when handler fails without continueOnError', async () => {
      const error = new Error('Handler failed');
      registry.register('testCommand', () => {
        throw error;
      });

      await expect(registry.dispatch({ command: 'testCommand' })).rejects.toThrow('Handler failed');
    });

    it('should continue execution when handler fails with continueOnError', async () => {
      const handler1 = vi.fn().mockImplementation(() => {
        throw new Error('Handler 1 failed');
      });
      const handler2 = vi.fn();

      registry.register('testCommand', handler1, { continueOnError: true });
      registry.register('testCommand', handler2, { continueOnError: true });

      await registry.dispatch({ command: 'testCommand' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle async handlers', async () => {
      const asyncHandler = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      registry.register('testCommand', asyncHandler);

      await registry.dispatch({ command: 'testCommand' });

      expect(asyncHandler).toHaveBeenCalled();
    });
  });

  describe('has', () => {
    it('should return true for registered command', () => {
      registry.register('testCommand', vi.fn());
      expect(registry.has('testCommand')).toBe(true);
    });

    it('should return false for unregistered command', () => {
      expect(registry.has('nonExistent')).toBe(false);
    });

    it('should return false after unregistration', () => {
      registry.register('testCommand', vi.fn());
      registry.unregister('testCommand');
      expect(registry.has('testCommand')).toBe(false);
    });
  });

  describe('getByCategory', () => {
    it('should return commands in category', () => {
      registry.register('cmd1', vi.fn(), { category: 'cat1' });
      registry.register('cmd2', vi.fn(), { category: 'cat1' });
      registry.register('cmd3', vi.fn(), { category: 'cat2' });

      const cat1Commands = registry.getByCategory('cat1');

      expect(cat1Commands).toContain('cmd1');
      expect(cat1Commands).toContain('cmd2');
      expect(cat1Commands).not.toContain('cmd3');
    });

    it('should return empty array for non-existent category', () => {
      const commands = registry.getByCategory('nonExistent');
      expect(commands).toEqual([]);
    });
  });

  describe('getCommands', () => {
    it('should return all registered commands', () => {
      registry.register('cmd1', vi.fn());
      registry.register('cmd2', vi.fn());
      registry.register('cmd3', vi.fn());

      const commands = registry.getCommands();

      expect(commands).toHaveLength(3);
      expect(commands).toContain('cmd1');
      expect(commands).toContain('cmd2');
      expect(commands).toContain('cmd3');
    });

    it('should return empty array when no commands registered', () => {
      expect(registry.getCommands()).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      registry.register('cmd1', vi.fn(), { category: 'cat1' });
      registry.register('cmd2', vi.fn(), { category: 'cat2' });
      registry.register('cmd1', vi.fn()); // Second handler for cmd1
      registry.use(async (_m, _c, next) => { await next(); });

      const stats = registry.getStats();

      expect(stats.totalCommands).toBe(2);
      expect(stats.totalHandlers).toBe(3);
      expect(stats.categories).toContain('cat1');
      expect(stats.categories).toContain('cat2');
      expect(stats.middlewareCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all handlers', () => {
      registry.register('cmd1', vi.fn());
      registry.register('cmd2', vi.fn());
      registry.use(async (_m, _c, next) => { await next(); });

      registry.clear();

      const stats = registry.getStats();
      expect(stats.totalCommands).toBe(0);
      expect(stats.totalHandlers).toBe(0);
      expect(stats.middlewareCount).toBe(0);
    });

    it('should clear categories', () => {
      registry.register('cmd1', vi.fn(), { category: 'cat1' });

      registry.clear();

      expect(registry.getByCategory('cat1')).toEqual([]);
    });
  });
});

describe('createLoggingMiddleware', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new CommandRegistry();
  });

  afterEach(() => {
    registry.clear();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should log command execution', async () => {
    const mockLogger = vi.fn();
    const loggingMiddleware = createLoggingMiddleware(mockLogger);

    registry.use(loggingMiddleware);
    registry.register('testCommand', vi.fn());

    await registry.dispatch({ command: 'testCommand' });

    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('→ testCommand'));
    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('✅ testCommand'));
  });

  it('should log command failure', async () => {
    const mockLogger = vi.fn();
    const loggingMiddleware = createLoggingMiddleware(mockLogger);

    registry.use(loggingMiddleware);
    registry.register('testCommand', () => {
      throw new Error('Test error');
    });

    await expect(registry.dispatch({ command: 'testCommand' })).rejects.toThrow();

    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('→ testCommand'));
    expect(mockLogger).toHaveBeenCalledWith(
      expect.stringContaining('❌ testCommand'),
      expect.any(Error)
    );
  });

  it('should include execution time in log', async () => {
    const mockLogger = vi.fn();
    const loggingMiddleware = createLoggingMiddleware(mockLogger);

    registry.use(loggingMiddleware);
    registry.register('testCommand', vi.fn());

    await registry.dispatch({ command: 'testCommand' });

    // Check that the log contains time in milliseconds
    const successCall = mockLogger.mock.calls.find((call) =>
      call[0].includes('✅ testCommand')
    );
    expect(successCall?.[0]).toMatch(/\d+\.\d+ms/);
  });

  it('should use default logger when none provided', async () => {
    const loggingMiddleware = createLoggingMiddleware();

    registry.use(loggingMiddleware);
    registry.register('testCommand', vi.fn());

    // Should not throw
    await expect(registry.dispatch({ command: 'testCommand' })).resolves.toBe(true);
  });
});

describe('createPerformanceMiddleware', () => {
  let registry: CommandRegistry;
  let originalPerformanceNow: typeof performance.now;

  beforeEach(() => {
    registry = new CommandRegistry();
    originalPerformanceNow = performance.now;
  });

  afterEach(() => {
    registry.clear();
    performance.now = originalPerformanceNow;
    vi.clearAllMocks();
  });

  it('should not log for fast commands (under threshold)', async () => {
    const { webview: mockLog } = await import('../../../../../utils/logger');

    // Mock performance.now to simulate fast execution
    let callCount = 0;
    performance.now = vi.fn(() => {
      return callCount++ * 50; // 50ms execution
    });

    const perfMiddleware = createPerformanceMiddleware(100);

    registry.use(perfMiddleware);
    registry.register('fastCommand', vi.fn());

    await registry.dispatch({ command: 'fastCommand' });

    // Should not log slow command warning for fast execution
    const slowWarningCalls = (mockLog as any).mock.calls.filter((call: any[]) =>
      call[0]?.includes?.('⚠️ Slow command')
    );
    expect(slowWarningCalls).toHaveLength(0);
  });

  it('should log warning for slow commands (over threshold)', async () => {
    const { webview: mockLog } = await import('../../../../../utils/logger');

    // Mock performance.now to simulate slow execution (150ms)
    let callCount = 0;
    performance.now = vi.fn(() => {
      return callCount++ * 150;
    });

    const perfMiddleware = createPerformanceMiddleware(100);

    registry.use(perfMiddleware);
    registry.register('slowCommand', vi.fn());

    await registry.dispatch({ command: 'slowCommand' });

    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ Slow command: slowCommand')
    );
  });

  it('should use custom threshold', async () => {
    const { webview: mockLog } = await import('../../../../../utils/logger');

    // Mock performance.now to simulate 75ms execution
    let callCount = 0;
    performance.now = vi.fn(() => {
      return callCount++ * 75;
    });

    // Use 50ms threshold, so 75ms execution should trigger warning
    const perfMiddleware = createPerformanceMiddleware(50);

    registry.use(perfMiddleware);
    registry.register('mediumCommand', vi.fn());

    await registry.dispatch({ command: 'mediumCommand' });

    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ Slow command: mediumCommand')
    );
  });

  it('should use default threshold of 100ms when not specified', async () => {
    const { webview: mockLog } = await import('../../../../../utils/logger');

    // Mock performance.now to simulate 50ms execution (under default 100ms)
    let callCount = 0;
    performance.now = vi.fn(() => {
      return callCount++ * 50;
    });

    const perfMiddleware = createPerformanceMiddleware(); // Default threshold

    registry.use(perfMiddleware);
    registry.register('testCommand', vi.fn());

    await registry.dispatch({ command: 'testCommand' });

    // Should not log slow command warning
    const slowWarningCalls = (mockLog as any).mock.calls.filter((call: any[]) =>
      call[0]?.includes?.('⚠️ Slow command')
    );
    expect(slowWarningCalls).toHaveLength(0);
  });
});

describe('priority ordering', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  it('should execute high priority before normal', async () => {
    const order: string[] = [];

    registry.register('cmd', () => { order.push('normal'); }, { priority: 'normal' });
    registry.register('cmd', () => { order.push('high'); }, { priority: 'high' });

    await registry.dispatch({ command: 'cmd' });

    expect(order[0]).toBe('high');
    expect(order[1]).toBe('normal');
  });

  it('should execute normal priority before low', async () => {
    const order: string[] = [];

    registry.register('cmd', () => { order.push('low'); }, { priority: 'low' });
    registry.register('cmd', () => { order.push('normal'); }, { priority: 'normal' });

    await registry.dispatch({ command: 'cmd' });

    expect(order[0]).toBe('normal');
    expect(order[1]).toBe('low');
  });

  it('should maintain insertion order for same priority', async () => {
    const order: string[] = [];

    registry.register('cmd', () => { order.push('first'); }, { priority: 'normal' });
    registry.register('cmd', () => { order.push('second'); }, { priority: 'normal' });
    registry.register('cmd', () => { order.push('third'); }, { priority: 'normal' });

    await registry.dispatch({ command: 'cmd' });

    expect(order).toEqual(['first', 'second', 'third']);
  });
});

describe('edge cases', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  it('should handle command with empty string', () => {
    registry.register('', vi.fn());
    expect(registry.has('')).toBe(true);
  });

  it('should handle command with special characters', () => {
    registry.register('cmd:with:colons', vi.fn());
    registry.register('cmd.with.dots', vi.fn());
    registry.register('cmd-with-dashes', vi.fn());

    expect(registry.has('cmd:with:colons')).toBe(true);
    expect(registry.has('cmd.with.dots')).toBe(true);
    expect(registry.has('cmd-with-dashes')).toBe(true);
  });

  it('should handle dispatch with additional message properties', async () => {
    let receivedMessage: CommandMessage | null = null;

    registry.register('testCommand', (msg) => {
      receivedMessage = msg;
    });

    const message: CommandMessage = {
      command: 'testCommand',
      terminalId: 'term-1',
      data: { nested: { value: 123 } },
      timestamp: Date.now(),
    };

    await registry.dispatch(message);

    expect(receivedMessage).toEqual(message);
  });

  it('should handle middleware that does not call next', async () => {
    const handler = vi.fn();

    const blockingMiddleware: CommandMiddleware = async () => {
      // Intentionally not calling next()
    };

    registry.use(blockingMiddleware);
    registry.register('testCommand', handler);

    await registry.dispatch({ command: 'testCommand' });

    // Handler should not be called because middleware didn't call next()
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle multiple categories for different commands', () => {
    registry.register('cmd1', vi.fn(), { category: 'cat1' });
    registry.register('cmd2', vi.fn(), { category: 'cat1' });
    registry.register('cmd3', vi.fn(), { category: 'cat2' });
    registry.register('cmd4', vi.fn(), { category: 'cat2' });

    expect(registry.getByCategory('cat1')).toHaveLength(2);
    expect(registry.getByCategory('cat2')).toHaveLength(2);
    expect(registry.getStats().categories).toHaveLength(2);
  });

  it('should handle rapid successive dispatches', async () => {
    let callCount = 0;

    registry.register('testCommand', () => {
      callCount++;
    });

    // Dispatch 10 times rapidly
    await Promise.all(
      Array.from({ length: 10 }, () =>
        registry.dispatch({ command: 'testCommand' })
      )
    );

    expect(callCount).toBe(10);
  });
});
