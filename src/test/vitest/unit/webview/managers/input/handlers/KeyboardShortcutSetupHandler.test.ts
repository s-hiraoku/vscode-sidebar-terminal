import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  KeyboardShortcutSetupHandler,
  IKeyboardShortcutSetupHandlerDeps,
} from '../../../../../../../webview/managers/input/handlers/KeyboardShortcutSetupHandler';

describe('KeyboardShortcutSetupHandler', () => {
  let dom: JSDOM;
  let handler: KeyboardShortcutSetupHandler;
  let mockDeps: IKeyboardShortcutSetupHandlerDeps;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);

    mockDeps = {
      logger: vi.fn(),
      eventRegistry: {
        register: vi.fn(),
        unregister: vi.fn(),
        dispose: vi.fn(),
      } as any,
      isIMEComposing: vi.fn().mockReturnValue(false),
      resolveKeybinding: vi.fn().mockReturnValue(null),
      shouldSkipShell: vi.fn().mockReturnValue(false),
      handleVSCodeCommand: vi.fn(),
      handlePanelNavigationKey: vi.fn().mockReturnValue(false),
      handleSpecialKeys: vi.fn().mockReturnValue(false),
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
    };

    handler = new KeyboardShortcutSetupHandler(mockDeps);
  });

  afterEach(() => {
    handler.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('setupKeyboardShortcuts', () => {
    it('should register keyboard-shortcuts event on document', () => {
      const mockManager = {} as any;
      handler.setupKeyboardShortcuts(mockManager);

      expect(mockDeps.eventRegistry.register).toHaveBeenCalledWith(
        'keyboard-shortcuts',
        dom.window.document,
        'keydown',
        expect.any(Function)
      );
    });

    it('should log setup completion', () => {
      const mockManager = {} as any;
      handler.setupKeyboardShortcuts(mockManager);

      expect(mockDeps.logger).toHaveBeenCalledWith(expect.stringContaining('keyboard shortcuts'));
    });

    it('should delegate to panel navigation handler first', () => {
      const mockManager = {} as any;
      (mockDeps.handlePanelNavigationKey as ReturnType<typeof vi.fn>).mockReturnValue(true);
      handler.setupKeyboardShortcuts(mockManager);

      // Get the registered handler
      const registerCall = (mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const shortcutHandler = registerCall![3] as (event: KeyboardEvent) => void;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      shortcutHandler(event);

      expect(mockDeps.handlePanelNavigationKey).toHaveBeenCalledWith(event);
      // Should not proceed to IME check or keybinding resolution
      expect(mockDeps.isIMEComposing).not.toHaveBeenCalled();
    });

    it('should block shortcuts during IME composition', () => {
      const mockManager = {} as any;
      (mockDeps.isIMEComposing as ReturnType<typeof vi.fn>).mockReturnValue(true);
      handler.setupKeyboardShortcuts(mockManager);

      const registerCall = (mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const shortcutHandler = registerCall![3] as (event: KeyboardEvent) => void;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });
      shortcutHandler(event);

      expect(mockDeps.isIMEComposing).toHaveBeenCalled();
      expect(mockDeps.resolveKeybinding).not.toHaveBeenCalled();
    });

    it('should handle KEY_IN_COMPOSITION keycode 229', () => {
      const mockManager = {} as any;
      handler.setupKeyboardShortcuts(mockManager);

      const registerCall = (mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const shortcutHandler = registerCall![3] as (event: KeyboardEvent) => void;

      const event = new dom.window.KeyboardEvent('keydown', {
        keyCode: 229,
        bubbles: true,
        cancelable: true,
      });
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      shortcutHandler(event);

      expect(stopSpy).toHaveBeenCalled();
    });

    it('should dispatch VS Code command when keybinding resolves and should skip shell', () => {
      const mockManager = {} as any;
      (mockDeps.resolveKeybinding as ReturnType<typeof vi.fn>).mockReturnValue(
        'workbench.action.terminal.new'
      );
      (mockDeps.shouldSkipShell as ReturnType<typeof vi.fn>).mockReturnValue(true);
      handler.setupKeyboardShortcuts(mockManager);

      const registerCall = (mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const shortcutHandler = registerCall![3] as (event: KeyboardEvent) => void;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      shortcutHandler(event);

      expect(preventSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
      expect(mockDeps.handleVSCodeCommand).toHaveBeenCalledWith(
        'workbench.action.terminal.new',
        mockManager
      );
    });

    it('should fall through to legacy shortcuts when no VS Code command matches', () => {
      const mockManager = {
        profileManager: { showProfileSelector: vi.fn() },
      } as any;
      handler.setupKeyboardShortcuts(mockManager);

      const registerCall = (mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const shortcutHandler = registerCall![3] as (event: KeyboardEvent) => void;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      shortcutHandler(event);

      // Legacy shortcuts should be processed (Escape clears notifications)
      expect(mockDeps.logger).toHaveBeenCalledWith(expect.stringContaining('Escape'));
    });
  });

  describe('handleLegacyShortcuts', () => {
    it('should clear notifications on Escape', () => {
      const mockManager = {} as any;
      const notification = dom.window.document.createElement('div');
      notification.className = 'notification';
      dom.window.document.body.appendChild(notification);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      handler.handleLegacyShortcuts(event, mockManager);

      expect(dom.window.document.querySelectorAll('.notification').length).toBe(0);
    });

    it('should toggle debug panel on Ctrl+Shift+D', () => {
      const toggleDebugPanel = vi.fn();
      const mockManager = { toggleDebugPanel } as any;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'D',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      handler.handleLegacyShortcuts(event, mockManager);

      expect(toggleDebugPanel).toHaveBeenCalled();
    });

    it('should show profile selector on Ctrl+Shift+P', () => {
      const showProfileSelector = vi.fn();
      const mockManager = {
        profileManager: { showProfileSelector },
      } as any;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      handler.handleLegacyShortcuts(event, mockManager);

      expect(showProfileSelector).toHaveBeenCalled();
    });

    it('should create terminal with default profile on Ctrl+Alt+T', () => {
      const createTerminalWithDefaultProfile = vi.fn().mockResolvedValue(undefined);
      const mockManager = {
        profileManager: { createTerminalWithDefaultProfile },
      } as any;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      handler.handleLegacyShortcuts(event, mockManager);

      expect(createTerminalWithDefaultProfile).toHaveBeenCalled();
    });

    it('should switch profile by index on Ctrl+Shift+1-5', () => {
      const switchToProfileByIndex = vi.fn().mockResolvedValue(undefined);
      const mockManager = {
        profileManager: { switchToProfileByIndex },
      } as any;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: '3',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      handler.handleLegacyShortcuts(event, mockManager);

      expect(switchToProfileByIndex).toHaveBeenCalledWith(2); // index = key - 1
    });

    it('should not crash when profileManager is missing', () => {
      const mockManager = {} as any;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      expect(() => handler.handleLegacyShortcuts(event, mockManager)).not.toThrow();
    });
  });

  describe('Agent interaction mode', () => {
    it('should default to agent interaction mode disabled', () => {
      expect(handler.isAgentInteractionMode()).toBe(false);
    });

    it('should always force disable agent interaction mode (VS Code standard)', () => {
      handler.setAgentInteractionMode(true);
      expect(handler.isAgentInteractionMode()).toBe(false);
    });

    it('should not call unregister when mode does not change (already false)', () => {
      // agentInteractionMode starts as false, actualEnabled is always false
      // so the condition `this.agentInteractionMode !== actualEnabled` is false
      handler.setAgentInteractionMode(true);
      expect(mockDeps.eventRegistry.unregister).not.toHaveBeenCalledWith('agent-arrow-keys');
    });
  });

  describe('setupGlobalKeyboardListener', () => {
    it('should register global-keyboard event on document', () => {
      handler.setupGlobalKeyboardListener();

      expect(mockDeps.eventRegistry.register).toHaveBeenCalledWith(
        'global-keyboard',
        dom.window.document,
        'keydown',
        expect.any(Function),
        true
      );
    });

    it('should delegate to handleSpecialKeys for active terminal', () => {
      (mockDeps.handleSpecialKeys as ReturnType<typeof vi.fn>).mockReturnValue(true);
      handler.setupGlobalKeyboardListener();

      const registerCall = (
        mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>
      ).mock.calls.find((call: any[]) => call[0] === 'global-keyboard');
      const globalHandler = registerCall![3] as (event: KeyboardEvent) => void;

      // Use a key that does NOT trigger the Ctrl+Shift+D early return guard
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      // setupGlobalKeyboardListener needs a coordinator reference set via setupKeyboardShortcuts
      const mockManager = {} as any;
      handler.setupKeyboardShortcuts(mockManager);
      globalHandler(event);

      expect(mockDeps.handleSpecialKeys).toHaveBeenCalled();
    });

    it('should skip special keys when no active terminal', () => {
      (mockDeps.getActiveTerminalId as ReturnType<typeof vi.fn>).mockReturnValue(null);
      handler.setupGlobalKeyboardListener();

      const registerCall = (
        mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>
      ).mock.calls.find((call: any[]) => call[0] === 'global-keyboard');
      const globalHandler = registerCall![3] as (event: KeyboardEvent) => void;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      globalHandler(event);

      expect(mockDeps.handleSpecialKeys).not.toHaveBeenCalled();
    });
  });

  describe('setupAgentArrowKeyHandler', () => {
    it('should register agent-arrow-keys event on document', () => {
      handler.setupAgentArrowKeyHandler();

      expect(mockDeps.eventRegistry.register).toHaveBeenCalledWith(
        'agent-arrow-keys',
        dom.window.document,
        'keydown',
        expect.any(Function),
        true
      );
    });

    it('should return early during IME composition', () => {
      (mockDeps.isIMEComposing as ReturnType<typeof vi.fn>).mockReturnValue(true);
      handler.setupAgentArrowKeyHandler();

      const registerCall = (
        mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>
      ).mock.calls.find((call: any[]) => call[0] === 'agent-arrow-keys');
      const arrowHandler = registerCall![3] as (event: KeyboardEvent) => void;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });
      arrowHandler(event);

      expect(mockDeps.logger).toHaveBeenCalledWith(expect.stringContaining('IME composition'));
    });

    it('should not log arrow keys when agent mode is disabled', () => {
      handler.setupAgentArrowKeyHandler();

      const registerCall = (
        mockDeps.eventRegistry.register as ReturnType<typeof vi.fn>
      ).mock.calls.find((call: any[]) => call[0] === 'agent-arrow-keys');
      const arrowHandler = registerCall![3] as (event: KeyboardEvent) => void;

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });
      arrowHandler(event);

      // Should not log about agent mode since it's disabled
      expect(mockDeps.logger).not.toHaveBeenCalledWith(expect.stringContaining('Arrow key'));
    });
  });

  describe('dispose', () => {
    it('should reset agent interaction mode', () => {
      handler.dispose();
      expect(handler.isAgentInteractionMode()).toBe(false);
    });
  });
});
