import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnifiedMessageDispatcher, IUnifiedMessageHandler, MessagePriority } from '../../../../messaging/UnifiedMessageDispatcher';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';
import { WebviewMessage } from '../../../../types/common';

// Mock dependencies
const mockEnqueue = vi.fn();
const mockClear = vi.fn();
const mockFlush = vi.fn();
const mockGetQueueStats = vi.fn().mockReturnValue({ normal: 0, highPriority: 0, isProcessing: false });
const mockQueueDispose = vi.fn();

vi.mock('../../../../webview/utils/MessageQueue', () => {
  return {
    MessageQueue: class {
      enqueue = mockEnqueue;
      clear = mockClear;
      flush = mockFlush;
      getQueueStats = mockGetQueueStats;
      dispose = mockQueueDispose;
    },
  };
});

vi.mock('../../../../webview/utils/ManagerLogger', () => ({
  messageLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('UnifiedMessageDispatcher', () => {
  let dispatcher: UnifiedMessageDispatcher;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Coordinator
    mockCoordinator = {
      postMessageToExtension: vi.fn(),
      getActiveTerminalId: vi.fn().mockReturnValue('term-1'),
    } as unknown as IManagerCoordinator;

    // Setup window.acquireVsCodeApi mock if needed
    // Note: The dispatcher constructor checks for window.acquireVsCodeApi.
    // In vitest environment, window might be defined but acquireVsCodeApi not.
    
    dispatcher = new UnifiedMessageDispatcher(mockCoordinator);
  });

  afterEach(() => {
    dispatcher.dispose();
  });

  describe('Lifecycle', () => {
    it('should initialize successfully', async () => {
      await dispatcher.initialize(mockCoordinator);
      expect(dispatcher.isReady()).toBe(true);
    });

    it('should dispose resources', () => {
      dispatcher.dispose();
      expect(mockQueueDispose).toHaveBeenCalled();
      expect(dispatcher.isReady()).toBe(false);
    });
  });

  describe('Handler Registration', () => {
    it('should register and unregister handlers', () => {
      const handler: IUnifiedMessageHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockResolvedValue(undefined),
        getPriority: vi.fn().mockReturnValue(50),
        getSupportedCommands: vi.fn().mockReturnValue(['test-command']),
      };

      dispatcher.registerHandler(handler);
      expect(dispatcher.getSupportedCommands()).toContain('test-command');

      dispatcher.unregisterHandler(handler);
      expect(dispatcher.getSupportedCommands()).not.toContain('test-command');
    });

    it('should sort handlers by priority', async () => {
      const calls: string[] = [];
      
      const lowPriorityHandler: IUnifiedMessageHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockImplementation(async () => { calls.push('low'); }),
        getPriority: vi.fn().mockReturnValue(10),
        getSupportedCommands: vi.fn().mockReturnValue(['test-command']),
      };

      const highPriorityHandler: IUnifiedMessageHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockImplementation(async () => { calls.push('high'); }),
        getPriority: vi.fn().mockReturnValue(90),
        getSupportedCommands: vi.fn().mockReturnValue(['test-command']),
      };

      dispatcher.registerHandler(lowPriorityHandler);
      dispatcher.registerHandler(highPriorityHandler);

      // Simulate message processing manually since we can't easily trigger the private dispatchToHandler directly
      // But processMessage calls dispatchToHandler.
      
      // We need to make sure the first handler that canHandle returns success stops the chain?
      // UnifiedMessageDispatcher logic: 
      // for (const handler of handlers) { if (handler.canHandle) { try { await handler.handle; return success; } ... } }
      // So only the first matching handler executes.
      
      await dispatcher.processMessage({ command: 'test-command' } as WebviewMessage);
      
      expect(calls).toEqual(['high']); // Only high priority should be called because it handled it successfully
    });
  });

  describe('Message Processing', () => {
    it('should process valid messages', async () => {
      const handler: IUnifiedMessageHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockResolvedValue(undefined),
        getPriority: vi.fn().mockReturnValue(50),
        getSupportedCommands: vi.fn().mockReturnValue(['test-command']),
      };

      dispatcher.registerHandler(handler);

      const result = await dispatcher.processMessage({ command: 'test-command' } as WebviewMessage);
      
      expect(result.success).toBe(true);
      expect(handler.handle).toHaveBeenCalled();
    });

    it('should return error for unknown commands', async () => {
      const result = await dispatcher.processMessage({ command: 'unknown-command' } as WebviewMessage);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler found');
    });

    it('should handle handler errors gracefully', async () => {
      const handler: IUnifiedMessageHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockRejectedValue(new Error('Handler failed')),
        getPriority: vi.fn().mockReturnValue(50),
        getSupportedCommands: vi.fn().mockReturnValue(['test-command']),
      };

      dispatcher.registerHandler(handler);

      const result = await dispatcher.processMessage({ command: 'test-command' } as WebviewMessage);
      
      // If a handler fails, it logs error and continues to next handler.
      // If no other handler, it returns error.
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler could process command');
    });
  });

  describe('Outbound Messages', () => {
    it('should enqueue messages', async () => {
      await dispatcher.sendMessage({ command: 'test' });
      expect(mockEnqueue).toHaveBeenCalled();
    });

    it('should send input with high priority', async () => {
      await dispatcher.sendInput('ls');
      // High priority maps to 'high'
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'input', data: 'ls' }),
        'high'
      );
    });

    it('should send resize with high priority', async () => {
      await dispatcher.sendResize(100, 20);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'resize', cols: 100, rows: 20 }),
        'high'
      );
    });
  });

  describe('Stats', () => {
    it('should return statistics', () => {
      const stats = dispatcher.getStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.errorCount).toBe(0);
    });
  });
});
