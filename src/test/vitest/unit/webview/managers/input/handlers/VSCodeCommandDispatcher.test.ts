import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VSCodeCommandDispatcher,
  IVSCodeCommandDispatcherDeps,
} from '../../../../../../../webview/managers/input/handlers/VSCodeCommandDispatcher';

// Mock PlatformUtils
vi.mock('../../../../../../../webview/utils/PlatformUtils', () => ({
  isMacPlatform: vi.fn().mockReturnValue(false),
}));

import { isMacPlatform } from '../../../../../../../webview/utils/PlatformUtils';

describe('VSCodeCommandDispatcher', () => {
  let dispatcher: VSCodeCommandDispatcher;
  let deps: IVSCodeCommandDispatcherDeps;
  let mockManager: any;
  let mockTerminal: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (isMacPlatform as any).mockReturnValue(false);

    deps = {
      logger: vi.fn(),
      emitTerminalInteractionEvent: vi.fn(),
      terminalOperationsService: {
        scrollTerminal: vi.fn(),
        clearTerminal: vi.fn(),
        deleteWordLeft: vi.fn(),
        deleteWordRight: vi.fn(),
        moveToLineStart: vi.fn(),
        moveToLineEnd: vi.fn(),
        sizeToContent: vi.fn(),
      } as any,
      handleTerminalCopy: vi.fn(),
      handleTerminalPaste: vi.fn(),
      handleTerminalSelectAll: vi.fn(),
      handleTerminalFind: vi.fn(),
      handleTerminalFindNext: vi.fn(),
      handleTerminalFindPrevious: vi.fn(),
      handleTerminalHideFind: vi.fn(),
      handleTerminalClear: vi.fn(),
    };

    mockManager = {
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      getTerminalInstance: vi.fn().mockReturnValue({
        terminal: { hasSelection: vi.fn().mockReturnValue(false) },
      }),
      postMessageToExtension: vi.fn(),
    };

    mockTerminal = {
      hasSelection: vi.fn().mockReturnValue(false),
      getSelection: vi.fn().mockReturnValue(''),
    };

    dispatcher = new VSCodeCommandDispatcher(deps);
  });

  describe('handleVSCodeCommand', () => {
    describe('Terminal lifecycle commands', () => {
      it('should emit create-terminal for terminal.new', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.new', mockManager);
        expect(deps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
          'create-terminal',
          '',
          undefined,
          mockManager
        );
      });

      it('should emit split-terminal for terminal.split', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.split', mockManager);
        expect(deps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
          'split-terminal',
          'terminal-1',
          undefined,
          mockManager
        );
      });

      it('should emit kill-terminal for terminal.kill', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.kill', mockManager);
        expect(deps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
          'kill-terminal',
          'terminal-1',
          undefined,
          mockManager
        );
      });

      it('should delegate terminal.clear to handleTerminalClear', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.clear', mockManager);
        expect(deps.handleTerminalClear).toHaveBeenCalledWith(mockManager);
      });
    });

    describe('Navigation commands', () => {
      it('should emit switch-next for focusNext', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.focusNext', mockManager);
        expect(deps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
          'switch-next',
          'terminal-1',
          undefined,
          mockManager
        );
      });

      it('should emit switch-previous for focusPrevious', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.focusPrevious',
          mockManager
        );
        expect(deps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
          'switch-previous',
          'terminal-1',
          undefined,
          mockManager
        );
      });

      it('should emit toggle-terminal for toggleTerminal', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.toggleTerminal',
          mockManager
        );
        expect(deps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
          'toggle-terminal',
          '',
          undefined,
          mockManager
        );
      });
    });

    describe('Scroll commands', () => {
      it.each([
        ['scrollUp', 'up'],
        ['scrollDown', 'down'],
        ['scrollToTop', 'top'],
        ['scrollToBottom', 'bottom'],
        ['scrollToPreviousCommand', 'previousCommand'],
        ['scrollToNextCommand', 'nextCommand'],
      ])('should scroll %s', (commandSuffix, direction) => {
        dispatcher.handleVSCodeCommand(
          `workbench.action.terminal.${commandSuffix}`,
          mockManager
        );
        expect(deps.terminalOperationsService.scrollTerminal).toHaveBeenCalledWith(
          direction,
          mockManager
        );
      });
    });

    describe('Clipboard commands', () => {
      it('should delegate copySelection to handleTerminalCopy', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.copySelection',
          mockManager
        );
        expect(deps.handleTerminalCopy).toHaveBeenCalledWith(mockManager);
      });

      it('should delegate paste to handleTerminalPaste', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.paste', mockManager);
        expect(deps.handleTerminalPaste).toHaveBeenCalledWith(mockManager);
      });

      it('should delegate selectAll to handleTerminalSelectAll', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.selectAll', mockManager);
        expect(deps.handleTerminalSelectAll).toHaveBeenCalledWith(mockManager);
      });
    });

    describe('Find commands', () => {
      it('should delegate focusFind to handleTerminalFind', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.focusFind', mockManager);
        expect(deps.handleTerminalFind).toHaveBeenCalledWith(mockManager);
      });

      it('should delegate findNext to handleTerminalFindNext', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.findNext', mockManager);
        expect(deps.handleTerminalFindNext).toHaveBeenCalledWith(mockManager);
      });

      it('should delegate findPrevious to handleTerminalFindPrevious', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.findPrevious',
          mockManager
        );
        expect(deps.handleTerminalFindPrevious).toHaveBeenCalledWith(mockManager);
      });

      it('should delegate hideFind to handleTerminalHideFind', () => {
        dispatcher.handleVSCodeCommand('workbench.action.terminal.hideFind', mockManager);
        expect(deps.handleTerminalHideFind).toHaveBeenCalledWith(mockManager);
      });
    });

    describe('Word/Line operations', () => {
      it('should delegate deleteWordLeft', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.deleteWordLeft',
          mockManager
        );
        expect(deps.terminalOperationsService.deleteWordLeft).toHaveBeenCalledWith(
          mockManager
        );
      });

      it('should delegate deleteWordRight', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.deleteWordRight',
          mockManager
        );
        expect(deps.terminalOperationsService.deleteWordRight).toHaveBeenCalledWith(
          mockManager
        );
      });

      it('should delegate moveToLineStart', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.moveToLineStart',
          mockManager
        );
        expect(deps.terminalOperationsService.moveToLineStart).toHaveBeenCalledWith(
          mockManager
        );
      });

      it('should delegate moveToLineEnd', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.moveToLineEnd',
          mockManager
        );
        expect(deps.terminalOperationsService.moveToLineEnd).toHaveBeenCalledWith(
          mockManager
        );
      });
    });

    describe('Size and unavailable commands', () => {
      it('should delegate sizeToContentWidth', () => {
        dispatcher.handleVSCodeCommand(
          'workbench.action.terminal.sizeToContentWidth',
          mockManager
        );
        expect(deps.terminalOperationsService.sizeToContent).toHaveBeenCalledWith(
          mockManager
        );
      });

      it('should log unavailable commands without errors', () => {
        const unavailableCommands = [
          'workbench.action.togglePanel',
          'workbench.action.closePanel',
          'workbench.action.toggleSidebarVisibility',
          'workbench.action.toggleDevTools',
          'workbench.action.reloadWindow',
          'workbench.action.reloadWindowWithExtensionsDisabled',
          'workbench.action.zoomIn',
          'workbench.action.zoomOut',
          'workbench.action.zoomReset',
          'workbench.action.quickOpen',
          'workbench.action.showCommands',
          'workbench.action.terminal.openNativeConsole',
        ];

        for (const command of unavailableCommands) {
          dispatcher.handleVSCodeCommand(command, mockManager);
        }

        // All should log, none should throw
        expect(deps.logger).toHaveBeenCalled();
      });

      it('should log unhandled commands', () => {
        dispatcher.handleVSCodeCommand('some.unknown.command', mockManager);
        expect(deps.logger).toHaveBeenCalledWith(
          'Unhandled VS Code command: some.unknown.command'
        );
      });
    });

    describe('Fallback when no active terminal', () => {
      it('should use empty string when getActiveTerminalId returns null', () => {
        mockManager.getActiveTerminalId.mockReturnValue(null);

        dispatcher.handleVSCodeCommand('workbench.action.terminal.split', mockManager);
        expect(deps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
          'split-terminal',
          '',
          undefined,
          mockManager
        );
      });
    });
  });

  describe('shouldInterceptKeyForVSCode', () => {
    const createKeyEvent = (init: KeyboardEventInit): KeyboardEvent => {
      return new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
    };

    describe('Arrow keys', () => {
      it('should pass arrow keys to shell', () => {
        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
          const event = createKeyEvent({ key });
          expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
            false
          );
        }
      });

      it('should intercept Ctrl+Shift+ArrowUp for scroll up', () => {
        const event = createKeyEvent({
          key: 'ArrowUp',
          ctrlKey: true,
          shiftKey: true,
        });
        const result = dispatcher.shouldInterceptKeyForVSCode(
          event,
          mockTerminal,
          mockManager
        );
        expect(result).toBe(true);
        expect(deps.terminalOperationsService.scrollTerminal).toHaveBeenCalledWith(
          'up',
          mockManager
        );
      });

      it('should intercept Ctrl+Shift+ArrowDown for scroll down', () => {
        const event = createKeyEvent({
          key: 'ArrowDown',
          ctrlKey: true,
          shiftKey: true,
        });
        const result = dispatcher.shouldInterceptKeyForVSCode(
          event,
          mockTerminal,
          mockManager
        );
        expect(result).toBe(true);
        expect(deps.terminalOperationsService.scrollTerminal).toHaveBeenCalledWith(
          'down',
          mockManager
        );
      });
    });

    describe('Tab key', () => {
      it('should pass Tab to shell for completion', () => {
        const event = createKeyEvent({ key: 'Tab' });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          false
        );
      });
    });

    describe('Copy/Paste with Ctrl/Cmd', () => {
      it('should intercept Ctrl+C when selection exists (copy)', () => {
        mockTerminal.hasSelection.mockReturnValue(true);
        const event = createKeyEvent({ key: 'c', ctrlKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          true
        );
        expect(deps.handleTerminalCopy).toHaveBeenCalledWith(mockManager);
      });

      it('should pass Ctrl+C to shell when no selection (SIGINT)', () => {
        mockTerminal.hasSelection.mockReturnValue(false);
        const event = createKeyEvent({ key: 'c', ctrlKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          false
        );
      });

      it('should intercept Ctrl+V for paste', () => {
        const event = createKeyEvent({ key: 'v', ctrlKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          true
        );
        expect(deps.handleTerminalPaste).toHaveBeenCalledWith(mockManager);
      });

      it('should intercept Ctrl+Shift+C for copy when selection exists', () => {
        mockTerminal.hasSelection.mockReturnValue(true);
        const event = createKeyEvent({ key: 'c', ctrlKey: true, shiftKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          true
        );
        expect(deps.handleTerminalCopy).toHaveBeenCalledWith(mockManager);
      });

      it('should not intercept Ctrl+Shift+C when no selection', () => {
        mockTerminal.hasSelection.mockReturnValue(false);
        const event = createKeyEvent({ key: 'c', ctrlKey: true, shiftKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          false
        );
      });

      it('should intercept Ctrl+Shift+V for paste', () => {
        const event = createKeyEvent({ key: 'v', ctrlKey: true, shiftKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          true
        );
        expect(deps.handleTerminalPaste).toHaveBeenCalledWith(mockManager);
      });
    });

    describe('Shell-essential keys', () => {
      it('should pass Ctrl+D/Z/A/E/U/K/W/R/L to shell', () => {
        const keys = ['d', 'z', 'a', 'e', 'u', 'k', 'w', 'r', 'l'];
        for (const key of keys) {
          const event = createKeyEvent({ key, ctrlKey: true });
          expect(
            dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)
          ).toBe(false);
        }
      });
    });

    describe('macOS Cmd+K clear', () => {
      it('should intercept Cmd+K on macOS for clear', () => {
        (isMacPlatform as any).mockReturnValue(true);
        const event = createKeyEvent({ key: 'k', metaKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          true
        );
        expect(deps.handleTerminalClear).toHaveBeenCalledWith(mockManager);
      });

      it('should not intercept Cmd+K on non-Mac', () => {
        (isMacPlatform as any).mockReturnValue(false);
        const event = createKeyEvent({ key: 'k', metaKey: true });
        // metaKey without ctrlKey on non-Mac falls through to "all other keys"
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          false
        );
      });
    });

    describe('Insert key shortcuts', () => {
      it('should intercept Ctrl+Insert for copy when selection exists', () => {
        mockTerminal.hasSelection.mockReturnValue(true);
        const event = createKeyEvent({ key: 'Insert', ctrlKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          true
        );
        expect(deps.handleTerminalCopy).toHaveBeenCalledWith(mockManager);
      });

      it('should not intercept Ctrl+Insert when no selection', () => {
        mockTerminal.hasSelection.mockReturnValue(false);
        const event = createKeyEvent({ key: 'Insert', ctrlKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          false
        );
      });

      it('should intercept Shift+Insert for paste', () => {
        const event = createKeyEvent({ key: 'Insert', shiftKey: true });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          true
        );
        expect(deps.handleTerminalPaste).toHaveBeenCalledWith(mockManager);
      });
    });

    describe('F12 key', () => {
      it('should intercept F12 for dev tools', () => {
        const event = createKeyEvent({ key: 'F12' });
        expect(dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)).toBe(
          true
        );
      });
    });

    describe('Regular keys', () => {
      it('should pass regular keys to shell', () => {
        for (const key of ['a', 'b', '1', 'Enter', 'Backspace']) {
          const event = createKeyEvent({ key });
          expect(
            dispatcher.shouldInterceptKeyForVSCode(event, mockTerminal, mockManager)
          ).toBe(false);
        }
      });
    });
  });
});
