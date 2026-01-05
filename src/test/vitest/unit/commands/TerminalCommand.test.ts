import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { TerminalCommand } from '../../../../commands/TerminalCommand';
import { TerminalManager } from '../../../../terminals/TerminalManager';

// Mock VS Code
vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showInputBox: vi.fn().mockResolvedValue('user-input'),
  },
}));

vi.mock('../../../../utils/logger');

describe('TerminalCommand', () => {
  let command: TerminalCommand;
  let mockTerminalManager: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockTerminalManager = {
      hasActiveTerminal: vi.fn().mockReturnValue(true),
      getActiveTerminalId: vi.fn().mockReturnValue('term-1'),
      sendInput: vi.fn(),
    };

    command = new TerminalCommand(mockTerminalManager as unknown as TerminalManager);
  });

  describe('handleSendToTerminal', () => {
    it('should send provided content directly', () => {
      command.handleSendToTerminal('echo hello');
      
      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith('echo hello', 'term-1');
    });

    it('should show input box if no content provided', async () => {
      // Create a promise that we can control
      let resolveInput: (value: string | undefined) => void;
      const inputPromise = new Promise<string | undefined>((resolve) => {
        resolveInput = resolve;
      });
      vi.mocked(vscode.window.showInputBox).mockReturnValue(inputPromise as any);

      command.handleSendToTerminal();
      
      expect(vscode.window.showInputBox).toHaveBeenCalled();
      
      // Resolve the promise
      resolveInput!('user-input');
      
      // Wait for .then() to execute
      await Promise.resolve();
      await Promise.resolve(); // extra tick just in case
      
      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith('user-input', 'term-1');
    });

    it('should show warning if no active terminal', () => {
      mockTerminalManager.hasActiveTerminal.mockReturnValue(false);
      
      command.handleSendToTerminal('hello');
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(mockTerminalManager.sendInput).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockTerminalManager.sendInput.mockImplementation(() => {
        throw new Error('Send failed');
      });
      
      command.handleSendToTerminal('hello');
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Send failed'));
    });
  });
});
