/**
 * Feedback utilities Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FeedbackManager, showSuccess, showError, showWarning, TerminalErrorHandler } from '../../../../utils/feedback';

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

describe('FeedbackManager', () => {
  let manager: FeedbackManager;

  beforeEach(() => {
    // Reset singleton instance if necessary or just get it
    manager = FeedbackManager.getInstance();
    vi.clearAllMocks();
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
      expect.stringContaining('Webview error: Unexpected crash'),
      expect.anything()
    );
  });
});
