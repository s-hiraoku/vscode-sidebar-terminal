import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyboardShortcutService } from '../../../../services/KeyboardShortcutService';
import * as vscode from 'vscode';

const mocks = vi.hoisted(() => {
  const mockCommands = {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    executeCommand: vi.fn().mockResolvedValue(undefined),
  };

  const mockWindow = {
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showInputBox: vi.fn(),
    showInformationMessage: vi.fn(),
    showQuickPick: vi.fn(),
  };

  const mockClipboard = {
    readText: vi.fn(),
  };

  return {
    mockCommands,
    mockWindow,
    mockClipboard,
  };
});

// Mock dependencies
const mockTerminalManager = {
  getActiveTerminalId: vi.fn(),
  getTerminals: vi.fn().mockReturnValue([]),
  setActiveTerminal: vi.fn(),
  getDefaultProfile: vi.fn(),
  createTerminal: vi.fn(),
  createTerminalWithProfile: vi.fn(),
  sendInput: vi.fn(),
};

const mockWebviewProvider = {
  sendMessage: vi.fn(),
};

vi.mock('vscode', () => ({
  commands: mocks.mockCommands,
  window: mocks.mockWindow,
  env: { clipboard: mocks.mockClipboard },
}));

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('KeyboardShortcutService', () => {
  let service: KeyboardShortcutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KeyboardShortcutService(mockTerminalManager as any);
    service.setWebviewProvider(mockWebviewProvider as any);
  });

  describe('Registration', () => {
    it('should register all commands', () => {
      // Check for expected commands
      const registeredCommands = mocks.mockCommands.registerCommand.mock.calls.map(c => c[0]);
      
      expect(registeredCommands).toContain('secondaryTerminal.focusTerminal');
      expect(registeredCommands).toContain('secondaryTerminal.createTerminal');
      expect(registeredCommands).toContain('secondaryTerminal.focusNextTerminal');
      expect(registeredCommands).toContain('secondaryTerminal.focusPreviousTerminal');
      expect(registeredCommands).toContain('secondaryTerminal.clearTerminal');
      expect(registeredCommands).toContain('secondaryTerminal.scrollToPreviousCommand');
      expect(registeredCommands).toContain('secondaryTerminal.scrollToNextCommand');
      expect(registeredCommands).toContain('secondaryTerminal.selectAll');
      expect(registeredCommands).toContain('secondaryTerminal.copy');
      expect(registeredCommands).toContain('secondaryTerminal.paste');
      expect(registeredCommands).toContain('secondaryTerminal.runRecentCommand');
      expect(registeredCommands).toContain('secondaryTerminal.focusTerminal1');
    });
  });

  describe('focusTerminal', () => {
    it('should focus webview and active terminal', async () => {
      mockTerminalManager.getActiveTerminalId.mockReturnValue('term-1');
      
      // Get handler for focusTerminal
      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.focusTerminal')![1];
      await handler();

      expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
      expect(mockWebviewProvider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'focus',
        terminalId: 'term-1'
      }));
    });
  });

  describe('createTerminal', () => {
    it('should create terminal with default profile if available', async () => {
      mockTerminalManager.getDefaultProfile.mockReturnValue('default');
      mockTerminalManager.createTerminalWithProfile.mockResolvedValue('term-new');
      
      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.createTerminal')![1];
      await handler();

      expect(mockTerminalManager.createTerminalWithProfile).toHaveBeenCalledWith('default');
      expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('term-new');
    });

    it('should fallback to standard creation', async () => {
      mockTerminalManager.getDefaultProfile.mockReturnValue(undefined);
      mockTerminalManager.createTerminal.mockReturnValue('term-new');
      
      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.createTerminal')![1];
      await handler();

      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
      expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('term-new');
    });
  });

  describe('Terminal Navigation', () => {
    it('should focus next terminal', () => {
      mockTerminalManager.getTerminals.mockReturnValue([{ id: 't1' }, { id: 't2' }]);
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');

      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.focusNextTerminal')![1];
      handler();

      expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('t2');
      expect(mockWebviewProvider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'focusTerminal',
        terminalId: 't2'
      }));
    });

    it('should focus previous terminal', () => {
      mockTerminalManager.getTerminals.mockReturnValue([{ id: 't1' }, { id: 't2' }]);
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t2');

      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.focusPreviousTerminal')![1];
      handler();

      expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('t1');
    });
  });

  describe('focusTerminalByNumber', () => {
    it('should focus terminal by number', () => {
      mockTerminalManager.getTerminals.mockReturnValue([{ id: 't1', number: 1 }, { id: 't2', number: 2 }]);
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');
      
      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.focusTerminal2')![1];
      handler();

      expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('t2');
    });
  });

  describe('Operations', () => {
    it('should send clear command', () => {
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');
      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.clearTerminal')![1];
      handler();
      expect(mockWebviewProvider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'clearTerminal', terminalId: 't1' }));
    });

    it('should send scroll commands', () => {
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');
      
      const prevHandler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.scrollToPreviousCommand')![1];
      prevHandler();
      expect(mockWebviewProvider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'scrollToPreviousCommand' }));

      const nextHandler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.scrollToNextCommand')![1];
      nextHandler();
      expect(mockWebviewProvider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'scrollToNextCommand' }));
    });
  });

  describe('Text Operations', () => {
    it('should copy', () => {
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');
      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.copy')![1];
      handler();
      expect(mockWebviewProvider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'copy' }));
    });

    it('should paste', async () => {
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');
      mocks.mockClipboard.readText.mockResolvedValue('clipboard content');
      
      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.paste')![1];
      await handler();

      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith('clipboard content', 't1');
    });
  });

  describe('find', () => {
    it('should show input box and send find command', async () => {
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');
      mocks.mockWindow.showInputBox.mockResolvedValue('search term');
      
      await service.find();

      expect(mockWebviewProvider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'find',
        searchTerm: 'search term'
      }));
    });
  });

  describe('runRecentCommand', () => {
    it('should execute selected recent command', async () => {
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');
      service.addToHistory('cmd1');
      mocks.mockWindow.showQuickPick.mockResolvedValue('cmd1');

      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.runRecentCommand')![1];
      await handler();

      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith('cmd1\n', 't1');
    });

    it('should warn if history empty', async () => {
      mockTerminalManager.getActiveTerminalId.mockReturnValue('t1');
      
      const handler = mocks.mockCommands.registerCommand.mock.calls.find(c => c[0] === 'secondaryTerminal.runRecentCommand')![1];
      await handler();

      expect(mocks.mockWindow.showInformationMessage).toHaveBeenCalledWith('No command history available');
    });
  });
});
