/**
 * Feedback utilities Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

import {
  FeedbackManager,
  _FeedbackType,
  showSuccess,
  showError,
  showWarning,
  TerminalErrorHandler
} from '../../../../utils/feedback';

// Mock VS Code API
vi.mock('vscode', () => {
  const mockStatusBarItem = {
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    text: '',
    tooltip: undefined,
  };

  return {
    window: {
      createStatusBarItem: vi.fn(() => mockStatusBarItem),
      showInformationMessage: vi.fn().mockResolvedValue(undefined),
      showWarningMessage: vi.fn().mockResolvedValue(undefined),
      showErrorMessage: vi.fn().mockResolvedValue(undefined),
      withProgress: vi.fn((options, task) => task({ report: vi.fn() })),
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    ProgressLocation: { Notification: 15 },
    commands: {
      executeCommand: vi.fn().mockResolvedValue(undefined),
    },
    Uri: {
      parse: vi.fn((url) => ({ toString: () => url })),
    },
    env: {
      openExternal: vi.fn().mockResolvedValue(true),
    }
  };
});

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  log: vi.fn(),
}));

describe('Feedback Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance if necessary
    (FeedbackManager as any).instance = undefined;
  });

  describe('FeedbackManager', () => {
    let _manager: FeedbackManager;

    beforeEach(() => {
      _manager = FeedbackManager.getInstance();
    });

    describe('showFeedback', () => {
      it('should show information message for success', async () => {
        showSuccess('Operation successful');

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Operation successful');
      });

      it('should show error message', async () => {
        showError('Something went wrong');

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Something went wrong');
      });

      it('should handle actions in notifications', async () => {
        const action = vi.fn();
        const options = {
          actions: [{ title: 'Fix it', action }]
        };

        // Mock user selecting the action
        (vscode.window.showInformationMessage as any).mockResolvedValue('Fix it');

        showSuccess('Error with fix', options);

        // Wait for async notification handling
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(action).toHaveBeenCalled();
      });

      it('should execute action when notification button is clicked', async () => {
        const actionFn = vi.fn();
        (vscode.window.showErrorMessage as any).mockResolvedValue('Retry');

        showError('Failed', {
          actions: [{ title: 'Retry', action: actionFn }]
        });

        // Wait for async notification handling
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(actionFn).toHaveBeenCalled();
      });

      it('should update status bar', () => {
        const statusBar = vscode.window.createStatusBarItem() as any;
        showWarning('Disk full');

        expect(statusBar.text).toContain('Disk full');
      });
    });
  });

  describe('TerminalErrorHandler', () => {
    it('should handle ENOENT error', () => {
      TerminalErrorHandler.handleTerminalCreationError(new Error('ENOENT: file not found'));

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Shell not found'),
        expect.anything()
      );
    });

    it('should handle permission denied errors', () => {
      TerminalErrorHandler.handleTerminalCreationError(new Error('EACCES: permission denied'));

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
        'Learn More'
      );
    });

    it('should handle max terminals reached', () => {
      TerminalErrorHandler.handleMaxTerminalsReached(5);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Maximum number of terminals reached (5)'),
        expect.anything()
      );
    });

    it('should handle webview errors', () => {
      TerminalErrorHandler.handleWebviewError('Unexpected crash');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Webview error'),
        expect.anything()
      );
    });
  });
});
