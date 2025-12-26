import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { InputManager } from '../../../../../webview/managers/InputManager';

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('Initialization', () => {
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

    it('should block special keys during IME composition', () => {
      // Simulate IME composition active via internal state
      (manager as any).stateManager.updateIMEState({ isActive: true });
      
      const event = new dom.window.KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 'c'
      });
      
      const handled = manager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);
      
      expect(handled).toBe(false); // blocked
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
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
});