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
  },
}));

vi.mock('../../../../../webview/managers/input/services/InputStateManager', () => ({
  InputStateManager: class {
    dispose = vi.fn();
    updateAltClickState = vi.fn();
    updateIMEState = vi.fn();
    getStateSection = vi.fn().mockReturnValue({ isActive: false });
  },
}));

vi.mock('../../../../../webview/managers/input/services/InputEventService', () => ({
  InputEventService: class {
    dispose = vi.fn();
  },
}));

vi.mock('../../../../../webview/managers/input/services/KeybindingService', () => ({
  KeybindingService: class {
    updateSettings = vi.fn();
    shouldSkipShell = vi.fn().mockReturnValue(false);
    resolveKeybinding = vi.fn().mockReturnValue(null);
  },
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
    DOWN: 'down',
  },
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
      pretendToBeVisual: true,
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
        searchAddon: { findNext: vi.fn(), findPrevious: vi.fn() },
      }),
      postMessageToExtension: vi.fn().mockResolvedValue(undefined),
      getMessageManager: vi.fn().mockReturnValue({
        sendInput: vi.fn(),
      }),
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
      expect(
        manager.isVSCodeAltClickEnabled({ altClickMovesCursor: true, multiCursorModifier: 'alt' })
      ).toBe(true);
      expect(manager.isVSCodeAltClickEnabled({ altClickMovesCursor: false })).toBe(false);
      expect(
        manager.isVSCodeAltClickEnabled({
          altClickMovesCursor: true,
          multiCursorModifier: 'ctrlCmd',
        })
      ).toBe(false);
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
        keyCode: 67,
      });

      mockTerminal.hasSelection.mockReturnValue(false);

      const handled = manager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'interrupt',
        })
      );
    });

    it('should handle Ctrl+C as copy when selection exists', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 'c',
        keyCode: 67,
      });

      mockTerminal.hasSelection.mockReturnValue(true);
      mockTerminal.getSelection.mockReturnValue('selected text');

      const handled = manager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'copyToClipboard',
          text: 'selected text',
        })
      );
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
        key: 'c',
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
        key: 'ArrowUp',
      });

      const intercepted = (manager as any).shouldInterceptKeyForVSCode(
        event,
        mockTerminal,
        mockCoordinator
      );

      expect(intercepted).toBe(false); // Pass to shell
    });

    it('should intercept Cmd+K on macOS for clear', () => {
      // Mock macOS
      vi.stubGlobal('navigator', { ...dom.window.navigator, userAgent: 'Macintosh' });

      const event = new dom.window.KeyboardEvent('keydown', {
        metaKey: true,
        key: 'k',
      });

      const intercepted = (manager as any).shouldInterceptKeyForVSCode(
        event,
        mockTerminal,
        mockCoordinator
      );

      expect(intercepted).toBe(true);
    });
  });
});
