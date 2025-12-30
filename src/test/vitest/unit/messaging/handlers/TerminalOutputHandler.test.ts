import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalOutputHandler } from '../../../../../messaging/handlers/TerminalOutputHandler';
import { IMessageHandlerContext } from '../../../../../messaging/UnifiedMessageDispatcher';
import { WebviewMessage } from '../../../../../types/common';

describe('TerminalOutputHandler', () => {
  let handler: TerminalOutputHandler;
  let mockContext: IMessageHandlerContext;
  let mockCoordinator: any;
  let mockPerformanceManager: any;
  let mockTerminal: any;

  beforeEach(() => {
    mockTerminal = {
      write: vi.fn(),
    };

    mockPerformanceManager = {
      bufferedWrite: vi.fn(),
    };

    mockCoordinator = {
      getTerminalInstance: vi.fn().mockReturnValue({
        id: 'term-1',
        name: 'Terminal 1',
        terminal: mockTerminal
      }),
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
      getManagers: vi.fn().mockReturnValue({
        performance: mockPerformanceManager
      }),
    };

    mockContext = {
      coordinator: mockCoordinator,
      postMessage: vi.fn(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
    };

    handler = new TerminalOutputHandler();
  });

  describe('handle', () => {
    it('should buffer write via performance manager', async () => {
      const message: WebviewMessage = {
        command: 'output',
        terminalId: 'term-1',
        data: 'hello'
      };

      await handler.handle(message, mockContext);

      expect(mockPerformanceManager.bufferedWrite).toHaveBeenCalledWith('hello', mockTerminal, 'term-1');
    });

    it('should write directly if performance manager is missing', async () => {
      mockCoordinator.getManagers.mockReturnValue({});
      
      const message: WebviewMessage = {
        command: 'output',
        terminalId: 'term-1',
        data: 'hello'
      };

      await handler.handle(message, mockContext);

      expect(mockTerminal.write).toHaveBeenCalledWith('hello');
    });

    it('should log error if terminal missing', async () => {
      mockCoordinator.getTerminalInstance.mockReturnValue(null);
      
      const message: WebviewMessage = {
        command: 'output',
        terminalId: 'unknown',
        data: 'hello'
      };

      await handler.handle(message, mockContext);

      expect(mockContext.logger.error).toHaveBeenCalledWith(expect.stringContaining('non-existent'), expect.any(Object));
    });

    it('should log error for invalid data', async () => {
      const message: WebviewMessage = {
        command: 'output',
        terminalId: 'term-1',
        data: '' // invalid
      } as any;

      await handler.handle(message, mockContext);

      expect(mockContext.logger.error).toHaveBeenCalledWith(expect.stringContaining('missing data'), expect.any(Object));
    });
  });
});
