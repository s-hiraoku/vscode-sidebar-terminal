
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { 
  FeedbackManager, 
  FeedbackType, 
  showError, 
  showSuccess, 
  TerminalErrorHandler 
} from '../../../../utils/feedback';

// Mock vscode
vi.mock('vscode', () => {
  const showInformationMessage = vi.fn().mockResolvedValue(undefined);
  const showWarningMessage = vi.fn().mockResolvedValue(undefined);
  const showErrorMessage = vi.fn().mockResolvedValue(undefined);
  const createStatusBarItem = vi.fn().mockReturnValue({
    show: vi.fn(),
    dispose: vi.fn(),
    text: '',
    tooltip: ''
  });

  return {
    window: {
      showInformationMessage,
      showWarningMessage,
      showErrorMessage,
      createStatusBarItem
    },
    StatusBarAlignment: { Left: 1 },
    commands: {
      executeCommand: vi.fn()
    },
    env: {
      openExternal: vi.fn()
    },
    Uri: {
      parse: vi.fn().mockReturnValue({})
    }
  };
});

describe('Feedback Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance if necessary
    (FeedbackManager as any).instance = undefined;
  });

  describe('FeedbackManager', () => {
    it('should show information message for success', async () => {
      showSuccess('Operation completed');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Operation completed');
    });

    it('should show error message', async () => {
      showError('Something went wrong');
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Something went wrong');
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
  });

  describe('TerminalErrorHandler', () => {
    it('should handle ENOENT by suggesting settings', () => {
      TerminalErrorHandler.handleTerminalCreationError(new Error('ENOENT: no such file or directory'));
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Shell not found'),
        'Open Settings'
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
        'Kill Active Terminal'
      );
    });

    it('should handle webview errors', () => {
      TerminalErrorHandler.handleWebviewError('crash');
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Webview error'),
        'Refresh'
      );
    });
  });
});
