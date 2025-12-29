
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VSCodeCommandHandler } from '../../../../../../../webview/managers/input/handlers/VSCodeCommandHandler';
import { TerminalOperationsService } from '../../../../../../../webview/managers/input/services/TerminalOperationsService';
import { IManagerCoordinator } from '../../../../../../../interfaces/ManagerInterfaces';

describe('VSCodeCommandHandler', () => {
  let handler: VSCodeCommandHandler;
  let mockTerminalOperations: TerminalOperationsService;
  let mockManager: IManagerCoordinator;
  let mockEmitEvent: any;
  let mockLogger: any;

  beforeEach(() => {
    mockTerminalOperations = {
      clearTerminal: vi.fn(),
      scrollTerminal: vi.fn(),
    } as any;

    mockManager = {
      getActiveTerminalId: vi.fn(),
      getTerminalInstance: vi.fn(),
      postMessageToExtension: vi.fn(),
      getManagers: vi.fn().mockReturnValue({}),
    } as any;

    mockEmitEvent = vi.fn();
    mockLogger = vi.fn();

    handler = new VSCodeCommandHandler(
      mockTerminalOperations,
      mockEmitEvent,
      mockLogger
    );
  });

  describe('handleCommand', () => {
    it('should return true for registered commands', async () => {
      const result = await handler.handleCommand('workbench.action.terminal.new', mockManager);
      expect(result).toBe(true);
    });

    it('should return false for unregistered commands', async () => {
      const result = await handler.handleCommand('unknown.command', mockManager);
      expect(result).toBe(false);
    });

    it('should log error and return false if handling fails', async () => {
      // Force an error by mocking a dependency to throw
      (mockManager.getActiveTerminalId as any).mockImplementation(() => {
        throw new Error('Test error');
      });

      // Using a command that calls getActiveTerminalId, e.g., split
      const result = await handler.handleCommand('workbench.action.terminal.split', mockManager);
      expect(result).toBe(false);
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Error handling command'), expect.any(Error));
    });
  });

  describe('Lifecycle Commands', () => {
    it('should handle new terminal', async () => {
      await handler.handleCommand('workbench.action.terminal.new', mockManager);
      expect(mockEmitEvent).toHaveBeenCalledWith('create-terminal', '', undefined, mockManager);
    });

    it('should handle split terminal', async () => {
      (mockManager.getActiveTerminalId as any).mockReturnValue('term-1');
      await handler.handleCommand('workbench.action.terminal.split', mockManager);
      expect(mockEmitEvent).toHaveBeenCalledWith('split-terminal', 'term-1', undefined, mockManager);
    });

    it('should handle kill terminal', async () => {
      (mockManager.getActiveTerminalId as any).mockReturnValue('term-1');
      await handler.handleCommand('workbench.action.terminal.kill', mockManager);
      expect(mockEmitEvent).toHaveBeenCalledWith('kill-terminal', 'term-1', undefined, mockManager);
    });

    it('should handle clear terminal', async () => {
      await handler.handleCommand('workbench.action.terminal.clear', mockManager);
      expect(mockTerminalOperations.clearTerminal).toHaveBeenCalledWith(mockManager);
    });

    it('should handle sizeToContentWidth', async () => {
      const mockFit = vi.fn();
      (mockManager.getActiveTerminalId as any).mockReturnValue('term-1');
      (mockManager.getTerminalInstance as any).mockReturnValue({
        fitAddon: { fit: mockFit },
      });

      await handler.handleCommand('workbench.action.terminal.sizeToContentWidth', mockManager);
      expect(mockFit).toHaveBeenCalled();
    });
  });

  describe('Navigation Commands', () => {
    it('should handle focus next', async () => {
      (mockManager.getActiveTerminalId as any).mockReturnValue('term-1');
      await handler.handleCommand('workbench.action.terminal.focusNext', mockManager);
      expect(mockEmitEvent).toHaveBeenCalledWith('switch-next', 'term-1', undefined, mockManager);
    });

    it('should handle focus previous', async () => {
      (mockManager.getActiveTerminalId as any).mockReturnValue('term-1');
      await handler.handleCommand('workbench.action.terminal.focusPrevious', mockManager);
      expect(mockEmitEvent).toHaveBeenCalledWith('switch-previous', 'term-1', undefined, mockManager);
    });

    it('should handle toggle terminal', async () => {
      await handler.handleCommand('workbench.action.terminal.toggleTerminal', mockManager);
      expect(mockEmitEvent).toHaveBeenCalledWith('toggle-terminal', '', undefined, mockManager);
    });
  });

  describe('Scroll Commands', () => {
    it('should delegate scroll commands to TerminalOperationsService', async () => {
      await handler.handleCommand('workbench.action.terminal.scrollUp', mockManager);
      expect(mockTerminalOperations.scrollTerminal).toHaveBeenCalledWith('up', mockManager);

      await handler.handleCommand('workbench.action.terminal.scrollToBottom', mockManager);
      expect(mockTerminalOperations.scrollTerminal).toHaveBeenCalledWith('bottom', mockManager);
    });
  });

  describe('Clipboard Commands', () => {
    it('should handle copy selection', async () => {
      (mockManager.getActiveTerminalId as any).mockReturnValue('term-1');
      (mockManager.getTerminalInstance as any).mockReturnValue({
        terminal: {
          hasSelection: () => true,
          getSelection: () => 'selected text',
        },
      });

      await handler.handleCommand('workbench.action.terminal.copySelection', mockManager);
      expect(mockManager.postMessageToExtension).toHaveBeenCalledWith({
        command: 'copyToClipboard',
        text: 'selected text',
      });
    });

    it('should handle paste', async () => {
      await handler.handleCommand('workbench.action.terminal.paste', mockManager);
      expect(mockManager.postMessageToExtension).toHaveBeenCalledWith({
        command: 'requestPaste',
      });
    });

    it('should handle select all', async () => {
      const mockSelectAll = vi.fn();
      (mockManager.getActiveTerminalId as any).mockReturnValue('term-1');
      (mockManager.getTerminalInstance as any).mockReturnValue({
        terminal: { selectAll: mockSelectAll },
      });

      await handler.handleCommand('workbench.action.terminal.selectAll', mockManager);
      expect(mockSelectAll).toHaveBeenCalled();
    });
  });

  describe('Find Commands', () => {
    let mockFindInTerminal: any;

    beforeEach(() => {
      mockFindInTerminal = {
        show: vi.fn(),
        findNext: vi.fn(),
        findPrevious: vi.fn(),
        hide: vi.fn(),
      };
      (mockManager.getManagers as any).mockReturnValue({
        findInTerminal: mockFindInTerminal,
      });
    });

    it('should handle focus find', async () => {
      await handler.handleCommand('workbench.action.terminal.focusFind', mockManager);
      expect(mockFindInTerminal.show).toHaveBeenCalled();
    });

    it('should handle find next', async () => {
      await handler.handleCommand('workbench.action.terminal.findNext', mockManager);
      expect(mockFindInTerminal.findNext).toHaveBeenCalled();
    });

    it('should handle find previous', async () => {
      await handler.handleCommand('workbench.action.terminal.findPrevious', mockManager);
      expect(mockFindInTerminal.findPrevious).toHaveBeenCalled();
    });

    it('should handle hide find', async () => {
      await handler.handleCommand('workbench.action.terminal.hideFind', mockManager);
      expect(mockFindInTerminal.hide).toHaveBeenCalled();
    });
  });

  describe('Editing Commands', () => {
    let mockInput: any;

    beforeEach(() => {
      mockInput = vi.fn();
      (mockManager.getActiveTerminalId as any).mockReturnValue('term-1');
      (mockManager.getTerminalInstance as any).mockReturnValue({
        terminal: { input: mockInput },
      });
    });

    it('should handle delete word left', async () => {
      await handler.handleCommand('workbench.action.terminal.deleteWordLeft', mockManager);
      expect(mockInput).toHaveBeenCalledWith('\x17');
    });

    it('should handle delete word right', async () => {
      await handler.handleCommand('workbench.action.terminal.deleteWordRight', mockManager);
      expect(mockInput).toHaveBeenCalledWith('\x1bd');
    });

    it('should handle move to line start', async () => {
      await handler.handleCommand('workbench.action.terminal.moveToLineStart', mockManager);
      expect(mockInput).toHaveBeenCalledWith('\x01');
    });

    it('should handle move to line end', async () => {
      await handler.handleCommand('workbench.action.terminal.moveToLineEnd', mockManager);
      expect(mockInput).toHaveBeenCalledWith('\x05');
    });
  });

  describe('Unavailable Commands', () => {
    it('should log unavailable commands without error', async () => {
      await handler.handleCommand('workbench.action.reloadWindow', mockManager);
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('not available'));
    });
  });

  describe('Stats and Checks', () => {
    it('should return registry stats', () => {
      const stats = handler.getStats();
      expect(stats.totalCommands).toBeGreaterThan(0);
      expect(stats.categories).toBeDefined();
    });

    it('should check if command is registered', () => {
      expect(handler.hasCommand('workbench.action.terminal.new')).toBe(true);
      expect(handler.hasCommand('unknown')).toBe(false);
    });
  });
});
