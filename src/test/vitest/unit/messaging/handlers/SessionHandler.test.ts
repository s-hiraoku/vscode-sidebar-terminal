import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionHandler } from '../../../../../messaging/handlers/SessionHandler';
import { IMessageHandlerContext } from '../../../../../messaging/UnifiedMessageDispatcher';
import { WebviewMessage } from '../../../../../types/common';

// Mock NotificationUtils
vi.mock('../../../../../webview/utils/NotificationUtils', () => ({
  showSessionRestoreStarted: vi.fn(),
  showSessionRestoreProgress: vi.fn(),
  showSessionRestoreCompleted: vi.fn(),
  showSessionRestoreError: vi.fn(),
  showSessionSaved: vi.fn(),
  showSessionSaveError: vi.fn(),
  showSessionCleared: vi.fn(),
  showSessionRestoreSkipped: vi.fn(),
}));

import * as notifications from '../../../../../webview/utils/NotificationUtils';

describe('SessionHandler', () => {
  let handler: SessionHandler;
  let mockContext: IMessageHandlerContext;
  let mockCoordinator: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCoordinator = {
      createTerminal: vi.fn().mockResolvedValue({}),
      restoreTerminalScrollback: vi.fn(),
      getTerminalInstance: vi.fn(),
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

    handler = new SessionHandler();
  });

  describe('handleSessionRestore', () => {
    it('should create terminal and restore scrollback', async () => {
      const message: WebviewMessage = {
        command: 'sessionRestore',
        terminalId: 'term-1',
        terminalName: 'Terminal 1',
        config: {},
        sessionRestoreMessage: 'Restored',
        sessionScrollback: ['line1']
      };

      vi.useFakeTimers();
      await handler.handle(message, mockContext);

      expect(mockCoordinator.createTerminal).toHaveBeenCalledWith('term-1', 'Terminal 1', {});
      
      // Advance timers for setTimeout
      vi.advanceTimersByTime(100);
      expect(mockCoordinator.restoreTerminalScrollback).toHaveBeenCalledWith('term-1', 'Restored', ['line1']);
      vi.useRealTimers();
    });
  });

  describe('Notification handlers', () => {
    it('should call showSessionRestoreStarted', async () => {
      await handler.handle({ command: 'sessionRestoreStarted', terminalCount: 5 }, mockContext);
      expect(notifications.showSessionRestoreStarted).toHaveBeenCalledWith(5);
    });

    it('should call showSessionRestoreCompleted', async () => {
      await handler.handle({ command: 'sessionRestoreCompleted', restoredCount: 3, skippedCount: 2 }, mockContext);
      expect(notifications.showSessionRestoreCompleted).toHaveBeenCalledWith(3, 2);
    });
  });

  describe('handleGetScrollback', () => {
    it('should extract scrollback and post message', async () => {
      const mockBuffer = {
        active: {
          length: 2,
          getLine: vi.fn().mockImplementation((i) => ({
            translateToString: () => `line${i}`
          }))
        }
      };
      const mockTerminal = { buffer: mockBuffer };
      mockCoordinator.getTerminalInstance.mockReturnValue({ terminal: mockTerminal });

      const message: WebviewMessage = {
        command: 'getScrollback',
        terminalId: 'term-1',
        maxLines: 10
      };

      await handler.handle(message, mockContext);

      expect(mockContext.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'scrollbackExtracted',
        terminalId: 'term-1',
        scrollbackContent: expect.arrayContaining([
          expect.objectContaining({ content: 'line0' }),
          expect.objectContaining({ content: 'line1' })
        ])
      }));
    });
  });

  describe('handleRestoreScrollback', () => {
    it('should restore scrollback to terminal', async () => {
      const mockTerminal = { writeln: vi.fn() };
      mockCoordinator.getTerminalInstance.mockReturnValue({ terminal: mockTerminal });

      const message: WebviewMessage = {
        command: 'restoreScrollback',
        terminalId: 'term-1',
        scrollbackContent: [
          { content: 'line1' },
          { content: 'line2' }
        ]
      };

      await handler.handle(message, mockContext);

      expect(mockTerminal.writeln).toHaveBeenCalledWith('line1');
      expect(mockTerminal.writeln).toHaveBeenCalledWith('line2');
      expect(mockContext.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'scrollbackRestored',
        terminalId: 'term-1',
        restoredLines: 2
      }));
    });
  });
});
