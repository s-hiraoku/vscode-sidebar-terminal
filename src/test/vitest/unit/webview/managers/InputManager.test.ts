
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager } from '../../../../../webview/managers/InputManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

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
  let manager: InputManager;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCoordinator = {
      getActiveTerminalId: vi.fn().mockReturnValue('t1'),
      postMessageToExtension: vi.fn(),
      getTerminalInstance: vi.fn(),
      getMessageManager: vi.fn(),
    } as any;

    // Reset document
    document.body.innerHTML = '';

    manager = new InputManager(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      manager.initialize();
      // Should verify successful initialization via mocks if needed
      expect(manager).toBeDefined();
    });
  });

  describe('Alt+Click Feedback', () => {
    it('should register alt key listeners', () => {
      // We can spy on addEventListener or check if our registry registered them
      const spy = vi.spyOn(document, 'addEventListener');
      manager.setupAltKeyVisualFeedback();
      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function), undefined);
      expect(spy).toHaveBeenCalledWith('keyup', expect.any(Function), undefined);
    });

    it('should update cursor styles when alt is pressed', () => {
        // Setup DOM
        const terminal = document.createElement('div');
        terminal.className = 'xterm';
        const container = document.createElement('div');
        container.className = 'terminal-container';
        container.appendChild(terminal);
        document.body.appendChild(container);

        manager.setupAltKeyVisualFeedback();
        
        // Simulate Alt press
        const keydown = new KeyboardEvent('keydown', { altKey: true });
        document.dispatchEvent(keydown);
        
        // By default disabled, so cursor should be empty or default
        expect(terminal.style.cursor).toBe('');

        // Enable setting
        manager.updateAltClickSettings({ altClickMovesCursor: true, multiCursorModifier: 'alt' });
        
        // Press Alt again
        document.dispatchEvent(keydown);
        expect(terminal.style.cursor).toBe('default');

        // Release Alt
        const keyup = new KeyboardEvent('keyup', { altKey: false });
        document.dispatchEvent(keyup);
        expect(terminal.style.cursor).toBe('');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should setup global keyboard listener', () => {
        const spy = vi.spyOn(document, 'addEventListener');
        // This is called internally by initialize, but we can call it manually if needed for specific test
        // manager.initialize() calls setupGlobalKeyboardListener
        manager.initialize();
        // Check for 'global-keyboard' listener (our internal name) or just keydown
        expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    });
  });

  describe('Special Keys', () => {
    it('should handle Ctrl+C interrupt', () => {
        const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
        vi.spyOn(event, 'preventDefault');
        vi.spyOn(event, 'stopPropagation');

        const result = manager.handleSpecialKeys(event, 't1', mockCoordinator);
        
        expect(result).toBe(true);
        expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
            command: 'terminalInteraction',
            type: 'interrupt',
            terminalId: 't1'
        }));
    });

    it('should handle Shift+Enter for multiline', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
        vi.spyOn(event, 'preventDefault');
        vi.spyOn(event, 'stopPropagation');

        const result = manager.handleSpecialKeys(event, 't1', mockCoordinator);
        
        expect(result).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
        // Should send newline via queueInputData -> flushPendingInput -> postMessageToExtension
        vi.advanceTimersByTime(0);
        expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
            command: 'input',
            data: '\n'
        }));
    });
  });

  describe('Input Queuing', () => {
      it('should queue and flush input', () => {
          // Access private/protected method via 'any' or test via public interface that uses it
          // addXtermClickHandler uses queueInputData
          const terminal = {
              onKey: vi.fn(),
              textarea: {},
              onFocus: vi.fn(),
              onBlur: vi.fn(),
              focus: vi.fn()
          } as any;
          const container = document.createElement('div');
          
          manager.addXtermClickHandler(terminal, 't1', container, mockCoordinator);
          
          // Trigger onKey
          const onKeyHandler = terminal.onKey.mock.calls[0][0];
          onKeyHandler({ key: 'a', domEvent: { key: 'a' } });
          
          // Should be queued, not sent immediately
          expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
          
          vi.advanceTimersByTime(0); // Flush queue
          
          expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
              command: 'input',
              data: 'a',
              terminalId: 't1'
          }));
      });

      it('should flush immediate keys directly', () => {
        const terminal = {
            onKey: vi.fn(),
            textarea: {},
            focus: vi.fn()
        } as any;
        const container = document.createElement('div');
        
        manager.addXtermClickHandler(terminal, 't1', container, mockCoordinator);
        
        const onKeyHandler = terminal.onKey.mock.calls[0][0];
        // Enter is immediate
        onKeyHandler({ key: '\r', domEvent: { key: 'Enter' } });
        
        expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
            command: 'input',
            data: '\r',
            terminalId: 't1'
        }));
      });
  });
});
