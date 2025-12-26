/**
 * InputManager Test Suite - Comprehensive input handling validation
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager } from '../../../../../webview/managers/InputManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

describe('InputManager', () => {
  let inputManager: InputManager;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock coordinator
    mockCoordinator = {
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      setActiveTerminalId: vi.fn(),
      postMessageToExtension: vi.fn(),
      getMessageManager: vi.fn().mockReturnValue(null),
      getTerminalInstance: vi.fn().mockReturnValue({
        terminal: {
          hasSelection: vi.fn().mockReturnValue(false),
        },
      }),
    } as any;

    inputManager = new InputManager(mockCoordinator);
  });

  afterEach(() => {
    inputManager.dispose();
    vi.useRealTimers();
  });

  describe('IME Composition Handling', () => {
    it('should properly handle composition start event', () => {
      inputManager.setupIMEHandling();

      expect(inputManager.isIMEComposing()).toBe(false);

      // Simulate composition start
      const compositionEvent = new CompositionEvent('compositionstart', {
        data: 'test',
      });
      document.dispatchEvent(compositionEvent);

      expect(inputManager.isIMEComposing()).toBe(true);
    });

    it('should handle composition update without changing state', () => {
      inputManager.setupIMEHandling();

      // Start composition
      document.dispatchEvent(new CompositionEvent('compositionstart', { data: 't' }));
      expect(inputManager.isIMEComposing()).toBe(true);

      // Update composition
      document.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'te' }));
      expect(inputManager.isIMEComposing()).toBe(true);
    });

    it('should properly handle composition end immediately', () => {
      inputManager.setupIMEHandling();

      // Start composition
      document.dispatchEvent(new CompositionEvent('compositionstart', { data: 'test' }));
      expect(inputManager.isIMEComposing()).toBe(true);

      // End composition
      document.dispatchEvent(new CompositionEvent('compositionend', { data: 'test' }));

      // Should be immediately set to not composing after end event
      expect(inputManager.isIMEComposing()).toBe(false);
    });

    it('should ignore keyboard shortcuts during IME composition', () => {
      inputManager.setupIMEHandling();
      inputManager.setupKeyboardShortcuts(mockCoordinator);

      // Start composition
      document.dispatchEvent(new CompositionEvent('compositionstart', { data: 'test' }));

      // Try to trigger Ctrl+Tab shortcut during composition
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        ctrlKey: true,
      });
      document.dispatchEvent(keyEvent);

      // Should not have triggered terminal switch
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });
  });

  describe('Input Delay Optimization', () => {
    it('should debounce focus events with reduced delay (50ms)', () => {
      const testTerminalId = 'terminal-1';

      // Emit multiple focus events quickly
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        testTerminalId,
        undefined,
        mockCoordinator
      );
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        testTerminalId,
        undefined,
        mockCoordinator
      );
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        testTerminalId,
        undefined,
        mockCoordinator
      );

      // Should not have sent any messages yet
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(0);

      // Advance time by 49ms - still no messages
      vi.advanceTimersByTime(49);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(0);

      // Advance to 50ms - should send one message (debounced)
      vi.advanceTimersByTime(1);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalInteraction',
          type: 'focus',
          terminalId: testTerminalId,
        })
      );
    });

    it('should emit non-focus events immediately', () => {
      const testTerminalId = 'terminal-1';

      // Emit alt-click event (should be immediate)
      (inputManager as any).emitTerminalInteractionEvent(
        'alt-click',
        testTerminalId,
        { x: 100, y: 200 },
        mockCoordinator
      );

      // Should send message immediately without debouncing
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalInteraction',
          type: 'alt-click',
          terminalId: testTerminalId,
        })
      );
    });
  });

  describe('Input Buffering', () => {
    it('should batch sequential input when message manager is unavailable', () => {
      const queueInputData = (inputManager as any).queueInputData.bind(inputManager);

      queueInputData('terminal-1', 'a', false);
      queueInputData('terminal-1', 'b', false);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(0);
      vi.runAllTimers();

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);
      const payload = (mockCoordinator.postMessageToExtension as any).mock.calls[0][0] as {
        data: string;
      };
      expect(payload.data).toBe('ab');
    });

    it('should prefer message manager queue when available', () => {
      const sendInputStub = vi.fn();
      (mockCoordinator.getMessageManager as any).mockReturnValue({
        sendInput: sendInputStub,
      });

      const queueInputData = (inputManager as any).queueInputData.bind(inputManager);
      queueInputData('terminal-1', 'x', false);
      queueInputData('terminal-1', 'y', false);

      vi.runAllTimers();

      expect(sendInputStub).toHaveBeenCalledTimes(1);
      expect(sendInputStub).toHaveBeenCalledWith('xy', 'terminal-1');
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle events when IME listener setup fails', () => {
      // Mock document.addEventListener to throw error
      const originalAddEventListener = document.addEventListener;
      try {
        document.addEventListener = vi.fn().mockImplementation(() => {
          throw new Error('Setup failed');
        });

        // Should not throw
        expect(() => inputManager.setupIMEHandling()).not.toThrow();
      } finally {
        // CRITICAL: Always restore original to prevent test pollution
        document.addEventListener = originalAddEventListener;
      }
    });

    it('should gracefully handle missing coordinator in event emission', () => {
      const nullCoordinator = null as any;

      // Should not throw when coordinator is null
      expect(() => {
        (inputManager as any).emitTerminalInteractionEvent(
          'focus',
          'terminal-1',
          undefined,
          nullCoordinator
        );
      }).not.toThrow();
    });

    it('should clear pending input events during IME start', () => {
      inputManager.setupIMEHandling();

      // Add some debounced events
      const eventDebounceTimers = (inputManager as any).eventDebounceTimers as Map<string, number>;
      const fakeTimer = setTimeout(() => {}, 100);
      eventDebounceTimers.set('input-test', fakeTimer as any);
      eventDebounceTimers.set('keydown-test', fakeTimer as any);
      eventDebounceTimers.set('other-test', fakeTimer as any);

      expect(eventDebounceTimers.size).toBe(3);

      // Start IME composition (should clear input-related timers)
      document.dispatchEvent(new CompositionEvent('compositionstart', { data: 'test' }));

      // Should have cleared input and keydown timers, but kept other-test
      expect(eventDebounceTimers.size).toBe(1);
      expect(eventDebounceTimers.has('other-test')).toBe(true);
    });
  });

  describe('Alt+Click Functionality', () => {
    it('should properly handle VS Code Alt+Click settings', () => {
      const settings = {
        altClickMovesCursor: true,
        multiCursorModifier: 'alt' as const,
      };

      expect(inputManager.isVSCodeAltClickEnabled(settings)).toBe(true);

      // Update settings
      inputManager.updateAltClickSettings(settings);

      const altClickState = inputManager.getAltClickState();
      expect(altClickState.isVSCodeAltClickEnabled).toBe(true);
    });

    it('should disable Alt+Click when settings do not match', () => {
      const settings = {
        altClickMovesCursor: true,
        multiCursorModifier: 'ctrl' as const, // Different modifier
      };

      expect(inputManager.isVSCodeAltClickEnabled(settings)).toBe(false);

      inputManager.updateAltClickSettings(settings);

      const altClickState = inputManager.getAltClickState();
      expect(altClickState.isVSCodeAltClickEnabled).toBe(false);
    });
  });

  describe('Special Key Handling', () => {
    it('should handle Ctrl+C with terminal selection correctly', () => {
      (mockCoordinator.getTerminalInstance as any).mockReturnValue({
        id: 'terminal-1',
        name: 'Terminal 1',
        terminal: {
          hasSelection: vi.fn().mockReturnValue(true),
          getSelection: vi.fn().mockReturnValue('selected text'),
          clearSelection: vi.fn(),
        } as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
      } as any);

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should be handled (copy via extension messaging)
      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'copyToClipboard',
          terminalId: 'terminal-1',
          text: 'selected text',
        })
      );
    });

    it('should handle Ctrl+C without selection as interrupt', () => {
      (mockCoordinator.getTerminalInstance as any).mockReturnValue({
        id: 'terminal-1',
        name: 'Terminal 1',
        terminal: {
          hasSelection: vi.fn().mockReturnValue(false),
          getSelection: vi.fn().mockReturnValue(''),
          clearSelection: vi.fn(),
        } as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
      } as any);

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should be handled as interrupt
      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalled();
    });

    it('should ignore special keys during IME composition', () => {
      inputManager.setupIMEHandling();

      // Start composition
      document.dispatchEvent(new CompositionEvent('compositionstart', { data: 'test' }));

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should not be handled during composition
      expect(handled).toBe(false);
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should handle Shift+Enter as newline for Claude Code multiline input', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should be handled as newline input
      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);

      const callArgs = (mockCoordinator.postMessageToExtension as any).mock.calls[0][0] as any;
      expect(callArgs.command).toBe('input');
      expect(callArgs.terminalId).toBe('terminal-1');
      expect(callArgs.data).toBe('\n');
    });

    it('should handle Alt+Enter (Option+Enter) as newline for Claude Code multiline input', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        altKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should be handled as newline input
      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);

      const callArgs = (mockCoordinator.postMessageToExtension as any).mock.calls[0][0] as any;
      expect(callArgs.command).toBe('input');
      expect(callArgs.terminalId).toBe('terminal-1');
      expect(callArgs.data).toBe('\n');
    });

    it('should handle Cmd+Enter (Meta+Enter) as newline for Claude Code multiline input', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should be handled as newline input
      expect(handled).toBe(true);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);

      const callArgs = (mockCoordinator.postMessageToExtension as any).mock.calls[0][0] as any;
      expect(callArgs.command).toBe('input');
      expect(callArgs.terminalId).toBe('terminal-1');
      expect(callArgs.data).toBe('\n');
    });

    it('should not handle plain Enter without modifier keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Plain Enter should not be handled by special keys (let terminal handle it)
      expect(handled).toBe(false);
    });
  });

  describe('High-Speed Typing Test', () => {
    it('should handle rapid input events without loss', () => {
      const inputEvents: string[] = [];
      (mockCoordinator.postMessageToExtension as any).mockImplementation((message: any) => {
        if (message.command === 'terminalInteraction' && message.type === 'input') {
          inputEvents.push(message.data);
        }
      });

      // Simulate rapid typing (each character as separate event)
      const testString = 'Hello World! This is a test of rapid typing.';
      for (const char of testString) {
        (inputManager as any).emitTerminalInteractionEvent(
          'input',
          'terminal-1',
          char,
          mockCoordinator
        );
      }

      // All characters should be captured
      expect(inputEvents.length).toBe(testString.length);
      expect(inputEvents.join('')).toBe(testString);
    });
  });

  describe('Memory Management', () => {
    it('should properly cleanup all event listeners on dispose', () => {
      inputManager.setupIMEHandling();
      inputManager.setupAltKeyVisualFeedback();
      inputManager.setupKeyboardShortcuts(mockCoordinator);

      // Add some debounced events
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        'terminal-1',
        undefined,
        mockCoordinator
      );

      const eventDebounceTimers = (inputManager as any).eventDebounceTimers as Map<string, number>;
      expect(eventDebounceTimers.size).toBeGreaterThan(0);

      // Dispose should clear everything
      inputManager.dispose();

      // Check internal state is reset
      expect(inputManager.isIMEComposing()).toBe(false);
      expect(inputManager.isAgentInteractionMode()).toBe(false);

      const altClickState = inputManager.getAltClickState();
      expect(altClickState.isVSCodeAltClickEnabled).toBe(false);
      expect(altClickState.isAltKeyPressed).toBe(false);
    });
  });
});
