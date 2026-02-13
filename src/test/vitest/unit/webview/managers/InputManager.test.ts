import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { InputManager } from '../../../../../webview/managers/InputManager';

// Mock dependencies
vi.mock('../../../../../webview/managers/input/handlers/IMEHandler', () => ({
  IMEHandler: class {
    initialize = vi.fn();
    dispose = vi.fn();
    clearPendingInputEvents = vi.fn();
    isIMEComposing = vi.fn().mockReturnValue(false);
  }
}));

vi.mock('../../../../../webview/managers/input/services/InputStateManager', () => ({
  InputStateManager: class {
    dispose = vi.fn();
    updateAltClickState = vi.fn();
    updateIMEState = vi.fn();
    getStateSection = vi.fn().mockReturnValue({ isActive: false });
  }
}));

vi.mock('../../../../../webview/managers/input/services/InputEventService', () => ({
  InputEventService: class {
    dispose = vi.fn();
  }
}));

vi.mock('../../../../../webview/managers/input/services/KeybindingService', () => ({
  KeybindingService: class {
    updateSettings = vi.fn();
    shouldSkipShell = vi.fn().mockReturnValue(false);
    resolveKeybinding = vi.fn().mockReturnValue(null);
  }
}));

vi.mock('../../../../../webview/managers/input/services/TerminalOperationsService', () => ({
  TerminalOperationsService: class {
    scrollTerminal = vi.fn();
    clearTerminal = vi.fn();
    deleteWordLeft = vi.fn();
    deleteWordRight = vi.fn();
    moveToLineStart = vi.fn();
    moveToLineEnd = vi.fn();
    sizeToContent = vi.fn();
  },
  ScrollDirection: {
    UP: 'up',
    DOWN: 'down'
  }
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('InputManager', () => {
  let dom: JSDOM;
  let manager: InputManager;
  let mockCoordinator: any;
  let mockTerminal: any;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', dom.window.navigator);
    vi.stubGlobal('performance', dom.window.performance);

    vi.useFakeTimers();

    // Mock terminal
    mockTerminal = {
      write: vi.fn(),
      focus: vi.fn(),
      clear: vi.fn(),
      hasSelection: vi.fn().mockReturnValue(false),
      getSelection: vi.fn().mockReturnValue(''),
      clearSelection: vi.fn(),
      onKey: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      textarea: {},
      onFocus: vi.fn(),
      onBlur: vi.fn(),
    };

    // Mock coordinator
    mockCoordinator = {
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      getTerminalInstance: vi.fn().mockReturnValue({
        terminal: mockTerminal,
        id: 'terminal-1',
        searchAddon: { findNext: vi.fn(), findPrevious: vi.fn() }
      }),
      postMessageToExtension: vi.fn().mockResolvedValue(undefined),
      getMessageManager: vi.fn().mockReturnValue({
        sendInput: vi.fn()
      })
    };

    manager = new InputManager(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      manager.initialize();
      expect(manager).toBeDefined();
    });

    it('should initialize with default states', () => {
      expect(manager.isAgentInteractionMode()).toBe(false);
      expect(manager.isIMEComposing()).toBe(false);
    });
  });

  describe('Alt+Click Handling', () => {
    it('should determine if Alt+Click is enabled based on settings', () => {
      expect(manager.isVSCodeAltClickEnabled({ altClickMovesCursor: true, multiCursorModifier: 'alt' })).toBe(true);
      expect(manager.isVSCodeAltClickEnabled({ altClickMovesCursor: false })).toBe(false);
      expect(manager.isVSCodeAltClickEnabled({ altClickMovesCursor: true, multiCursorModifier: 'ctrlCmd' })).toBe(false);
    });

    it('should update state when settings change', () => {
      manager.updateAltClickSettings({ altClickMovesCursor: true, multiCursorModifier: 'alt' });
      expect(manager.getAltClickState().isVSCodeAltClickEnabled).toBe(true);
    });
  });

  describe('Alt+Click Feedback', () => {
    it('should register alt key listeners', () => {
      const spy = vi.spyOn(dom.window.document, 'addEventListener');
      manager.setupAltKeyVisualFeedback();
      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function), undefined);
      expect(spy).toHaveBeenCalledWith('keyup', expect.any(Function), undefined);
    });

    it('should update cursor styles when alt is pressed', () => {
      // Setup DOM
      const terminal = dom.window.document.createElement('div');
      terminal.className = 'xterm';
      const container = dom.window.document.createElement('div');
      container.className = 'terminal-container';
      container.appendChild(terminal);
      dom.window.document.body.appendChild(container);

      manager.setupAltKeyVisualFeedback();

      // Simulate Alt press
      const keydown = new dom.window.KeyboardEvent('keydown', { altKey: true });
      dom.window.document.dispatchEvent(keydown);

      // By default disabled, so cursor should be empty or default
      expect(terminal.style.cursor).toBe('');

      // Enable setting
      manager.updateAltClickSettings({ altClickMovesCursor: true, multiCursorModifier: 'alt' });

      // Press Alt again
      dom.window.document.dispatchEvent(keydown);
      expect(terminal.style.cursor).toBe('default');

      // Release Alt
      const keyup = new dom.window.KeyboardEvent('keyup', { altKey: false });
      dom.window.document.dispatchEvent(keyup);
      expect(terminal.style.cursor).toBe('');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should setup global keyboard listener', () => {
      const spy = vi.spyOn(dom.window.document, 'addEventListener');
      manager.initialize();
      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    });

    it('should enter panel navigation mode on Ctrl+P', () => {
      // Given: initialized manager
      manager.initialize();

      // When: press Ctrl+P
      const enterModeEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      vi.spyOn(enterModeEvent, 'preventDefault');
      vi.spyOn(enterModeEvent, 'stopPropagation');
      dom.window.document.dispatchEvent(enterModeEvent);

      // Then: event is intercepted
      expect(enterModeEvent.preventDefault).toHaveBeenCalled();
      expect(enterModeEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should navigate panels while in panel navigation mode', () => {
      // Given: manager in panel navigation mode
      manager.initialize();
      const enterEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p', ctrlKey: true, bubbles: true, cancelable: true,
      });
      dom.window.document.dispatchEvent(enterEvent);
      mockCoordinator.postMessageToExtension.mockClear();

      // When: press ArrowRight
      const moveEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      vi.spyOn(moveEvent, 'preventDefault');
      vi.spyOn(moveEvent, 'stopPropagation');
      dom.window.document.dispatchEvent(moveEvent);

      // Then: navigation event is sent
      expect(moveEvent.preventDefault).toHaveBeenCalled();
      expect(moveEvent.stopPropagation).toHaveBeenCalled();
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalInteraction',
          type: 'switch-next',
          terminalId: 'terminal-1',
        })
      );
    });

    it('should exit panel navigation mode on Escape', () => {
      // Given: manager in panel navigation mode
      manager.initialize();
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        key: 'p', ctrlKey: true, bubbles: true, cancelable: true,
      }));
      mockCoordinator.postMessageToExtension.mockClear();

      // When: press Escape
      const escapeEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true,
      });
      vi.spyOn(escapeEvent, 'preventDefault');
      vi.spyOn(escapeEvent, 'stopPropagation');
      dom.window.document.dispatchEvent(escapeEvent);

      // Then: mode exits and navigation keys no longer work
      expect(escapeEvent.preventDefault).toHaveBeenCalled();
      expect(escapeEvent.stopPropagation).toHaveBeenCalled();

      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true, cancelable: true,
      }));
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should exit panel navigation mode on Ctrl+P when already in mode', () => {
      // Given: manager in panel navigation mode
      manager.initialize();
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        key: 'p', ctrlKey: true, bubbles: true, cancelable: true,
      }));

      // When: press Ctrl+P again to toggle off
      const exitEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p', ctrlKey: true, bubbles: true, cancelable: true,
      });
      vi.spyOn(exitEvent, 'preventDefault');
      vi.spyOn(exitEvent, 'stopPropagation');
      dom.window.document.dispatchEvent(exitEvent);

      // Then: event is intercepted (mode toggled off)
      expect(exitEvent.preventDefault).toHaveBeenCalled();
      expect(exitEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should ignore non-navigation keys in panel navigation mode', () => {
      manager.initialize();

      // Enter panel navigation mode
      const enterModeEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(enterModeEvent);
      mockCoordinator.postMessageToExtension.mockClear();

      // Send non-navigation keys — should be blocked and NOT trigger terminal switch
      const nonNavKeys = ['a', 'z', '1', 'Enter', 'Tab', ' '];
      for (const key of nonNavKeys) {
        const event = new dom.window.KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        vi.spyOn(event, 'preventDefault');
        dom.window.document.dispatchEvent(event);
        expect(event.preventDefault).toHaveBeenCalled();
      }

      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should not send navigation events when no active terminal', () => {
      manager.initialize();

      // Set no active terminal
      mockCoordinator.getActiveTerminalId.mockReturnValue(null);

      // Enter panel navigation mode
      const enterModeEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(enterModeEvent);
      mockCoordinator.postMessageToExtension.mockClear();

      // Try navigation
      const moveEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(moveEvent);

      // Should NOT call postMessageToExtension since no active terminal
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should fallback to DOM active terminal when active terminal id is temporarily null', () => {
      manager.initialize();

      const activeContainer = dom.window.document.createElement('div');
      activeContainer.className = 'terminal-container active';
      activeContainer.setAttribute('data-terminal-id', 'terminal-dom');
      dom.window.document.body.appendChild(activeContainer);

      mockCoordinator.getActiveTerminalId.mockReturnValue(null);

      const enterModeEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(enterModeEvent);
      mockCoordinator.postMessageToExtension.mockClear();

      const moveEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(moveEvent);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalInteraction',
          type: 'switch-next',
          terminalId: 'terminal-dom',
        })
      );
    });

    it('should not enter panel navigation mode with Ctrl+Shift+P or Ctrl+Alt+P', () => {
      manager.initialize();

      // Ctrl+Shift+P should NOT enter navigation mode
      const ctrlShiftP = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(ctrlShiftP);

      // Ctrl+Alt+P should NOT enter navigation mode
      const ctrlAltP = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(ctrlAltP);

      // Try arrow key — should NOT be intercepted (not in navigation mode)
      const moveEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(moveEvent);

      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should not enter panel navigation mode with Cmd+P on macOS', () => {
      manager.initialize();

      const enterModeEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      vi.spyOn(enterModeEvent, 'preventDefault');
      vi.spyOn(enterModeEvent, 'stopPropagation');
      dom.window.document.dispatchEvent(enterModeEvent);

      expect(enterModeEvent.preventDefault).not.toHaveBeenCalled();
      expect(enterModeEvent.stopPropagation).not.toHaveBeenCalled();

      mockCoordinator.postMessageToExtension.mockClear();

      const moveEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(moveEvent);

      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should exit panel navigation mode on dispose', () => {
      manager.initialize();

      // Enter panel navigation mode
      const enterModeEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(enterModeEvent);

      // Dispose manager
      manager.dispose();

      // Re-create manager and initialize
      manager = new InputManager(mockCoordinator);
      manager.initialize();
      mockCoordinator.postMessageToExtension.mockClear();

      // Arrow key should NOT trigger navigation (mode was cleared)
      const moveEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(moveEvent);

      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should map vim keys and arrow keys to terminal switch events in panel navigation mode', () => {
      manager.initialize();

      const enterModeEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(enterModeEvent);
      mockCoordinator.postMessageToExtension.mockClear();

      const sendKey = (key: string): void => {
        const event = new dom.window.KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        dom.window.document.dispatchEvent(event);
      };

      sendKey('h');
      sendKey('k');
      sendKey('ArrowLeft');
      sendKey('ArrowUp');

      sendKey('j');
      sendKey('l');
      sendKey('ArrowRight');
      sendKey('ArrowDown');

      const interactionCalls = mockCoordinator.postMessageToExtension.mock.calls
        .map((call: any[]) => call[0])
        .filter((message: any) => message?.command === 'terminalInteraction');

      const previousCount = interactionCalls.filter(
        (message: any) => message.type === 'switch-previous'
      ).length;
      const nextCount = interactionCalls.filter(
        (message: any) => message.type === 'switch-next'
      ).length;

      expect(previousCount).toBe(4);
      expect(nextCount).toBe(4);
    });

    it('should allow panel navigation mode to be enabled externally', () => {
      manager.initialize();
      (manager as any).setPanelNavigationMode(true);
      mockCoordinator.postMessageToExtension.mockClear();

      const moveEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      dom.window.document.dispatchEvent(moveEvent);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalInteraction',
          type: 'switch-next',
          terminalId: 'terminal-1',
        })
      );
    });

    it('should show and hide panel navigation mode indicator', () => {
      manager.initialize();
      expect(dom.window.document.querySelector('.panel-navigation-indicator')).toBeNull();

      (manager as any).setPanelNavigationMode(true);
      const indicator = dom.window.document.querySelector(
        '.panel-navigation-indicator'
      ) as HTMLElement | null;

      expect(indicator).not.toBeNull();
      expect(indicator?.textContent).toContain('PANEL MODE');
      expect(indicator?.style.display).toBe('block');
      expect(dom.window.document.body.classList.contains('panel-navigation-mode')).toBe(true);

      (manager as any).setPanelNavigationMode(false);
      expect(indicator?.style.display).toBe('none');
      expect(dom.window.document.body.classList.contains('panel-navigation-mode')).toBe(false);
    });
  });

  describe('Input Buffering & Flushing', () => {
    it('should buffer multiple characters and flush them after a delay', async () => {
      const sendInputSpy = mockCoordinator.getMessageManager().sendInput;

      // Use internal method access for testing
      (manager as any).queueInputData('terminal-1', 'a', false);
      (manager as any).queueInputData('terminal-1', 'b', false);

      // Should not be called yet
      expect(sendInputSpy).not.toHaveBeenCalled();

      // Advance timers
      vi.advanceTimersByTime(10);

      expect(sendInputSpy).toHaveBeenCalledWith('ab', 'terminal-1');
    });

    it('should flush immediately when Enter is pressed', () => {
      const sendInputSpy = mockCoordinator.getMessageManager().sendInput;

      (manager as any).queueInputData('terminal-1', 'ls', false);
      (manager as any).queueInputData('terminal-1', '\r', true);

      expect(sendInputSpy).toHaveBeenCalledWith('ls\r', 'terminal-1');
    });
  });

  describe('Special Keys Handling', () => {
    it('should handle Ctrl+C as interrupt when no selection', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 'c',
        keyCode: 67
      });

      mockTerminal.hasSelection.mockReturnValue(false);

      const handled = manager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        type: 'interrupt'
      }));
    });

    it('should handle Ctrl+C as copy when selection exists', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 'c',
        keyCode: 67
      });

      mockTerminal.hasSelection.mockReturnValue(true);
      mockTerminal.getSelection.mockReturnValue('selected text');

      const handled = manager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'copyToClipboard',
        text: 'selected text'
      }));
    });

    it('should handle Shift+Enter for multiline', () => {
      const event = new dom.window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
      vi.spyOn(event, 'preventDefault');
      vi.spyOn(event, 'stopPropagation');

      const sendInputSpy = mockCoordinator.getMessageManager().sendInput;

      const result = manager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      // Should send newline via queueInputData -> flushPendingInput -> sendInput
      vi.advanceTimersByTime(0);
      expect(sendInputSpy).toHaveBeenCalledWith('\n', 'terminal-1');
    });

    it('should block special keys during IME composition', () => {
      // Mock isIMEComposing to return true for this test
      (manager as any).imeHandler.isIMEComposing.mockReturnValue(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 'c'
      });

      const handled = manager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      expect(handled).toBe(false); // blocked
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });
  });

  describe('Input Queuing', () => {
    it('should queue and flush input via xterm handler', () => {
      const container = dom.window.document.createElement('div');
      const sendInputSpy = mockCoordinator.getMessageManager().sendInput;

      manager.addXtermClickHandler(mockTerminal, 'terminal-1', container, mockCoordinator);

      // Trigger onKey
      const onKeyHandler = mockTerminal.onKey.mock.calls[0][0];
      onKeyHandler({ key: 'a', domEvent: { key: 'a' } });

      // Should be queued, not sent immediately
      expect(sendInputSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0); // Flush queue

      expect(sendInputSpy).toHaveBeenCalledWith('a', 'terminal-1');
    });

    it('should flush immediate keys directly', () => {
      const container = dom.window.document.createElement('div');
      const sendInputSpy = mockCoordinator.getMessageManager().sendInput;

      manager.addXtermClickHandler(mockTerminal, 'terminal-1', container, mockCoordinator);

      const onKeyHandler = mockTerminal.onKey.mock.calls[0][0];
      // Enter is immediate
      onKeyHandler({ key: '\r', domEvent: { key: 'Enter' } });

      expect(sendInputSpy).toHaveBeenCalledWith('\r', 'terminal-1');
    });
  });

  describe('Keyboard Shortcut Interception', () => {
    it('should allow arrow keys to pass to shell (VS Code standard)', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp'
      });

      const intercepted = (manager as any).shouldInterceptKeyForVSCode(event, mockTerminal, mockCoordinator);

      expect(intercepted).toBe(false); // Pass to shell
    });

    it('should intercept Cmd+K on macOS for clear', () => {
      // Mock macOS
      vi.stubGlobal('navigator', { ...dom.window.navigator, userAgent: 'Macintosh' });

      const event = new dom.window.KeyboardEvent('keydown', {
        metaKey: true,
        key: 'k'
      });

      const intercepted = (manager as any).shouldInterceptKeyForVSCode(event, mockTerminal, mockCoordinator);

      expect(intercepted).toBe(true);
    });
  });

  describe('Terminal Handler Cleanup', () => {
    it('should remove terminal handlers and disposables on removeTerminalHandlers', () => {
      const container = dom.window.document.createElement('div');
      const onKeyDispose = vi.fn();
      const onDataDispose = vi.fn();
      mockTerminal.onKey.mockReturnValue({ dispose: onKeyDispose });
      mockTerminal.onData.mockReturnValue({ dispose: onDataDispose });

      manager.addXtermClickHandler(mockTerminal, 'terminal-1', container, mockCoordinator);

      // Verify handlers were added
      expect(mockTerminal.onKey).toHaveBeenCalled();
      expect(mockTerminal.onData).toHaveBeenCalled();

      // Remove handlers
      manager.removeTerminalHandlers('terminal-1');

      // Verify disposables were called
      expect(onKeyDispose).toHaveBeenCalled();
      expect(onDataDispose).toHaveBeenCalled();
    });

    it('should clear pending input buffers on removeTerminalHandlers', () => {
      const container = dom.window.document.createElement('div');
      manager.addXtermClickHandler(mockTerminal, 'terminal-1', container, mockCoordinator);

      // Queue some input (not flushed yet)
      const onKeyHandler = mockTerminal.onKey.mock.calls[0][0];
      onKeyHandler({ key: 'a', domEvent: { key: 'a' } });
      onKeyHandler({ key: 'b', domEvent: { key: 'b' } });

      // Remove handlers (should clear pending buffer)
      manager.removeTerminalHandlers('terminal-1');

      // Advance timers - nothing should be sent because buffer was cleared
      vi.advanceTimersByTime(100);

      // Only the initial setup should have occurred, no additional sends after removal
      const sendInputCalls = mockCoordinator.getMessageManager().sendInput.mock.calls;
      // The removeTerminalHandlers should have cleared the buffer
      expect(sendInputCalls.length).toBe(0);
    });

    it('should handle removeTerminalHandlers for non-existent terminal gracefully', () => {
      // Should not throw
      expect(() => manager.removeTerminalHandlers('non-existent-terminal')).not.toThrow();
    });

    it('should clean up handlers when addXtermClickHandler is called for existing terminal', () => {
      const container = dom.window.document.createElement('div');
      const firstOnKeyDispose = vi.fn();
      const firstOnDataDispose = vi.fn();
      mockTerminal.onKey.mockReturnValueOnce({ dispose: firstOnKeyDispose });
      mockTerminal.onData.mockReturnValueOnce({ dispose: firstOnDataDispose });

      // First setup
      manager.addXtermClickHandler(mockTerminal, 'terminal-1', container, mockCoordinator);

      // Reset mocks for second setup
      const secondOnKeyDispose = vi.fn();
      const secondOnDataDispose = vi.fn();
      mockTerminal.onKey.mockReturnValue({ dispose: secondOnKeyDispose });
      mockTerminal.onData.mockReturnValue({ dispose: secondOnDataDispose });

      // Second setup for same terminal - should cleanup first
      manager.addXtermClickHandler(mockTerminal, 'terminal-1', container, mockCoordinator);

      // First handlers should have been disposed
      expect(firstOnKeyDispose).toHaveBeenCalled();
      expect(firstOnDataDispose).toHaveBeenCalled();
    });
  });
});
