import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalLifecycleHandler } from '../../../../../messaging/handlers/TerminalLifecycleHandler';
import { IMessageHandlerContext } from '../../../../../messaging/UnifiedMessageDispatcher';
import { WebviewMessage } from '../../../../../types/common';

describe('TerminalLifecycleHandler', () => {
  let handler: TerminalLifecycleHandler;
  let mockContext: IMessageHandlerContext;
  let mockCoordinator: any;
  let mockNotificationManager: any;

  beforeEach(() => {
    mockNotificationManager = {
      showWarning: vi.fn(),
    };

    mockCoordinator = {
      createTerminal: vi.fn().mockResolvedValue({}),
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
      handleTerminalRemovedFromExtension: vi.fn(),
      removeTerminal: vi.fn(),
      clearTerminalDeletionTracking: vi.fn(),
      ensureTerminalFocus: vi.fn(),
      getTerminalInstance: vi.fn(),
      getManagers: vi.fn().mockReturnValue({
        notification: mockNotificationManager
      }),
    };

    mockContext = {
      coordinator: mockCoordinator,
      postMessage: vi.fn().mockResolvedValue(undefined),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
    };

    handler = new TerminalLifecycleHandler();
  });

  describe('Initialization', () => {
    it('should register supported commands', () => {
      const commands = handler.getSupportedCommands();
      expect(commands).toContain('terminalCreated');
      expect(commands).toContain('createTerminal');
      expect(commands).toContain('terminalRemoved');
      expect(commands).toContain('deleteTerminalResponse');
      expect(commands).toContain('focusTerminal');
      expect(commands).toContain('clear');
    });
  });

  describe('handleTerminalCreated', () => {
    it('should call createTerminal on coordinator', async () => {
      const message: WebviewMessage = {
        command: 'terminalCreated',
        terminalId: 'term-1',
        terminalName: 'Terminal 1',
        terminalNumber: 1,
        config: {}
      };

      await handler.handle(message, mockContext);

      expect(mockCoordinator.createTerminal).toHaveBeenCalledWith(
        'term-1',
        'Terminal 1',
        {},
        1,
        'extension'
      );
    });

    it('should log error for invalid message', async () => {
      const message: WebviewMessage = {
        command: 'terminalCreated',
        terminalId: 'term-1'
        // missing fields
      };

      await handler.handle(message, mockContext);

      expect(mockContext.logger.error).toHaveBeenCalledWith('Invalid terminalCreated message', expect.any(Object));
    });
  });

  describe('handleNewTerminal', () => {
    it('should post terminalInteraction message', async () => {
      const message: WebviewMessage = {
        command: 'createTerminal',
        terminalId: 'term-1',
        terminalName: 'Terminal 1',
        config: { theme: 'dark' }
      };

      await handler.handle(message, mockContext);

      expect(mockContext.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'terminalInteraction',
        type: 'new-terminal',
        terminalId: 'term-1',
        data: { terminalName: 'Terminal 1', config: { theme: 'dark' } }
      }));
    });
  });

  describe('handleTerminalRemoved', () => {
    it('should call handleTerminalRemovedFromExtension on coordinator', async () => {
      const message: WebviewMessage = {
        command: 'terminalRemoved',
        terminalId: 'term-1'
      };

      await handler.handle(message, mockContext);

      expect(mockCoordinator.handleTerminalRemovedFromExtension).toHaveBeenCalledWith('term-1');
    });
  });

  describe('handleDeleteTerminalResponse', () => {
    it('should call removeTerminal on success', async () => {
      const message: WebviewMessage = {
        command: 'deleteTerminalResponse',
        terminalId: 'term-1',
        success: true
      } as any;

      await handler.handle(message, mockContext);

      expect(mockCoordinator.removeTerminal).toHaveBeenCalledWith('term-1');
    });

    it('should show warning and clear tracking on failure', async () => {
      const message: WebviewMessage = {
        command: 'deleteTerminalResponse',
        terminalId: 'term-1',
        success: false,
        reason: 'Error message'
      } as any;

      await handler.handle(message, mockContext);

      expect(mockCoordinator.clearTerminalDeletionTracking).toHaveBeenCalledWith('term-1');
      expect(mockNotificationManager.showWarning).toHaveBeenCalledWith('Error message');
    });
  });

  describe('handleFocusTerminal', () => {
    it('should call ensureTerminalFocus on coordinator', async () => {
      const message: WebviewMessage = {
        command: 'focusTerminal',
        terminalId: 'term-1'
      };

      await handler.handle(message, mockContext);

      expect(mockCoordinator.ensureTerminalFocus).toHaveBeenCalledWith('term-1');
    });
  });

  describe('handleClearTerminal', () => {
    it('should call terminal.clear', async () => {
      const mockTerminal = { clear: vi.fn() };
      mockCoordinator.getTerminalInstance.mockReturnValue({ terminal: mockTerminal });

      const message: WebviewMessage = {
        command: 'clear',
        terminalId: 'term-1'
      };

      await handler.handle(message, mockContext);

      expect(mockTerminal.clear).toHaveBeenCalled();
    });
  });
});
