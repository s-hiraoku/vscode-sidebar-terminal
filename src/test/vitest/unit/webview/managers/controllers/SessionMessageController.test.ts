import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionMessageController } from '../../../../../../webview/managers/controllers/SessionMessageController';
import type { IManagerCoordinator } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';
import type { MessageCommand } from '../../../../../../webview/managers/messageTypes';
import * as NotificationUtils from '../../../../../../webview/utils/NotificationUtils';

vi.mock('../../../../../../webview/utils/NotificationUtils', () => ({
  showSessionRestoreStarted: vi.fn(),
  showSessionRestoreProgress: vi.fn(),
  showSessionRestoreCompleted: vi.fn(),
  showSessionRestoreError: vi.fn(),
  showSessionSaved: vi.fn(),
  showSessionSaveError: vi.fn(),
  showSessionCleared: vi.fn(),
  showSessionRestoreSkipped: vi.fn(),
  showTerminalRestoreError: vi.fn(),
}));

describe('SessionMessageController', () => {
  let controller: SessionMessageController;
  let mockCoordinator: IManagerCoordinator;
  let mockLogger: ManagerLogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ManagerLogger;

    mockCoordinator = {
      createTerminal: vi.fn().mockResolvedValue(undefined),
    } as unknown as IManagerCoordinator;

    controller = new SessionMessageController({ logger: mockLogger });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSessionRestoreMessage', () => {
    it('should log error if terminalId or terminalName is missing', async () => {
      const msg: MessageCommand = { command: 'sessionRestore' }; // missing data
      await controller.handleSessionRestoreMessage(msg, mockCoordinator);
      expect(mockLogger.error).toHaveBeenCalledWith('Invalid session restore data received', expect.anything());
    });

    it('should use restoreSession if available on coordinator', async () => {
      const msg: MessageCommand = {
        command: 'sessionRestore',
        terminalId: 'term-1',
        terminalName: 'Term 1',
        sessionScrollback: ['line 1', 'line 2'],
      };

      const restoreSessionMock = vi.fn().mockResolvedValue(true);
      (mockCoordinator as any).restoreSession = restoreSessionMock;

      await controller.handleSessionRestoreMessage(msg, mockCoordinator);

      expect(restoreSessionMock).toHaveBeenCalledWith({
        terminalId: 'term-1',
        terminalName: 'Term 1',
        scrollbackData: ['line 1', 'line 2'],
        sessionRestoreMessage: undefined,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully restored terminal session'));
    });

    it('should fallback to createTerminal if restoreSession returns false', async () => {
      const msg: MessageCommand = {
        command: 'sessionRestore',
        terminalId: 'term-1',
        terminalName: 'Term 1',
        config: { shell: 'bash' },
      };

      const restoreSessionMock = vi.fn().mockResolvedValue(false);
      (mockCoordinator as any).restoreSession = restoreSessionMock;

      await controller.handleSessionRestoreMessage(msg, mockCoordinator);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Session restore failed'));
      expect(mockCoordinator.createTerminal).toHaveBeenCalledWith(
        'term-1',
        'Term 1',
        { shell: 'bash' },
        undefined,
        'extension'
      );
    });

    it('should use createTerminal if restoreSession is not available', async () => {
      const msg: MessageCommand = {
        command: 'sessionRestore',
        terminalId: 'term-1',
        terminalName: 'Term 1',
        config: { shell: 'zsh' },
      };

      // mockCoordinator does not have restoreSession
      await controller.handleSessionRestoreMessage(msg, mockCoordinator);

      expect(mockCoordinator.createTerminal).toHaveBeenCalledWith(
        'term-1',
        'Term 1',
        { shell: 'zsh' },
        undefined,
        'extension'
      );
    });

    it('should call restoreTerminalScrollback if message/scrollback exists and createTerminal was used', async () => {
        vi.useFakeTimers();
        const msg: MessageCommand = {
            command: 'sessionRestore',
            terminalId: 'term-1',
            terminalName: 'Term 1',
            sessionRestoreMessage: 'Restored',
        };

        const restoreTerminalScrollbackMock = vi.fn();
        (mockCoordinator as any).restoreTerminalScrollback = restoreTerminalScrollbackMock;

        await controller.handleSessionRestoreMessage(msg, mockCoordinator);
        
        vi.runAllTimers();

        expect(restoreTerminalScrollbackMock).toHaveBeenCalledWith('term-1', 'Restored', []);
        vi.useRealTimers();
    });

    it('should handle errors during creation and try creation again as fallback', async () => {
       const msg: MessageCommand = {
        command: 'sessionRestore',
        terminalId: 'term-1',
        terminalName: 'Term 1',
      };
      const error = new Error('Creation failed');
      (mockCoordinator.createTerminal as any).mockRejectedValueOnce(error);

      await controller.handleSessionRestoreMessage(msg, mockCoordinator);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to restore terminal session'));
      // Expect fallback creation attempt
      expect(mockCoordinator.createTerminal).toHaveBeenCalledTimes(2);
    });
  });

  describe('Notification handlers', () => {
    it('handleSessionRestoreStartedMessage should call notification util', () => {
      controller.handleSessionRestoreStartedMessage({ command: 'started', terminalCount: 5 });
      expect(NotificationUtils.showSessionRestoreStarted).toHaveBeenCalledWith(5);
    });

    it('handleSessionRestoreProgressMessage should call notification util', () => {
      controller.handleSessionRestoreProgressMessage({ command: 'progress', restored: 2, total: 5 });
      expect(NotificationUtils.showSessionRestoreProgress).toHaveBeenCalledWith(2, 5);
    });

    it('handleSessionRestoreCompletedMessage should call notification util', () => {
      controller.handleSessionRestoreCompletedMessage({ command: 'completed', restoredCount: 3, skippedCount: 2 });
      expect(NotificationUtils.showSessionRestoreCompleted).toHaveBeenCalledWith(3, 2);
    });

    it('handleSessionRestoreErrorMessage should call notification util', () => {
      controller.handleSessionRestoreErrorMessage({ command: 'error', error: 'Fail', partialSuccess: true, errorType: 'Timeout' });
      expect(NotificationUtils.showSessionRestoreError).toHaveBeenCalledWith('Fail', true, 'Timeout');
    });

    it('handleSessionSavedMessage should call notification util', () => {
      controller.handleSessionSavedMessage({ command: 'saved', terminalCount: 10 });
      expect(NotificationUtils.showSessionSaved).toHaveBeenCalledWith(10);
    });

    it('handleSessionSaveErrorMessage should call notification util', () => {
      controller.handleSessionSaveErrorMessage({ command: 'saveError', error: 'Disk full' });
      expect(NotificationUtils.showSessionSaveError).toHaveBeenCalledWith('Disk full');
    });

    it('handleSessionClearedMessage should call notification util', () => {
      controller.handleSessionClearedMessage();
      expect(NotificationUtils.showSessionCleared).toHaveBeenCalled();
    });
    
    it('handleSessionRestoreSkippedMessage should call notification util', () => {
        controller.handleSessionRestoreSkippedMessage({ command: 'skipped', reason: 'Old' });
        expect(NotificationUtils.showSessionRestoreSkipped).toHaveBeenCalledWith('Old');
    });

    it('handleTerminalRestoreErrorMessage should call notification util dynamically imported', async () => {
        // Since we mocked the module, dynamic import might return the mocked module in test env usually.
        // However, the implementation does `await import(...)`.
        // Vitest module mocking should handle this if configured correctly, but let's verify.
        
        await controller.handleTerminalRestoreErrorMessage({ command: 'termError', terminalName: 'T1', error: 'Err' });
        // The implementation calls showTerminalRestoreError from dynamic import.
        // Assuming vitest mocks the module globally for this file:
        const { showTerminalRestoreError } = await import('../../../../../../webview/utils/NotificationUtils');
        expect(showTerminalRestoreError).toHaveBeenCalledWith('T1', 'Err');
    });
  });

  describe('handleSessionRestoredMessage', () => {
      it('should log success message', () => {
          controller.handleSessionRestoredMessage({ command: 'restored', success: true, restoredCount: 5, totalCount: 5 });
          expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Session restoration successful'));
      });

      it('should log warning message for partial success', () => {
        controller.handleSessionRestoredMessage({ command: 'restored', success: false, restoredCount: 3, totalCount: 5 });
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Session restoration partially failed'));
    });
  });
});
