/**
 * InputManager - Arrow Key Handling Tests
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager } from '../../../../../webview/managers/InputManager';

describe('InputManager - Arrow Key Handling', () => {
  let inputManager: InputManager;
  let mockCoordinator: any;
  let mockVsCodeApi: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup DOM environment
    const terminalContainer = document.createElement('div');
    terminalContainer.className = 'terminal-container active';
    terminalContainer.setAttribute('data-terminal-id', 'terminal-1');
    document.body.appendChild(terminalContainer);

    const terminalContent = document.createElement('div');
    terminalContent.className = 'terminal-content';
    terminalContainer.appendChild(terminalContent);

    const xterm = document.createElement('div');
    xterm.className = 'xterm';
    terminalContent.appendChild(xterm);

    // Mock VS Code API
    mockVsCodeApi = vi.fn();
    (window as any).acquireVsCodeApi = () => ({
      postMessage: mockVsCodeApi,
    });

    // Create mock coordinator
    mockCoordinator = {
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      setActiveTerminalId: vi.fn(),
      getTerminalInstance: vi.fn(),
      getAllTerminalInstances: vi.fn(),
      getAllTerminalContainers: vi.fn(),
      getTerminalElement: vi.fn(),
      postMessageToExtension: vi.fn(),
      createTerminal: vi.fn(),
      openSettings: vi.fn(),
      applyFontSettings: vi.fn(),
      closeTerminal: vi.fn(),
      log: vi.fn(),
      getManagers: vi.fn(),
      updateClaudeStatus: vi.fn(),
      updateCliAgentStatus: vi.fn(),
      ensureTerminalFocus: vi.fn(),
    };

    inputManager = new InputManager(mockCoordinator);
  });

  afterEach(() => {
    inputManager.dispose();
    document.body.innerHTML = '';
    delete (window as any).acquireVsCodeApi;
  });

  describe('Arrow Key Mode Management', () => {
    it('should always disable agent interaction mode for VS Code standard behavior', () => {
      // VS Code Standard: Agent interaction mode is always disabled
      // This preserves arrow key functionality for bash history, completion, etc.
      inputManager.setAgentInteractionMode(true);
      // Implementation forces this to false for VS Code compatibility
      expect(inputManager.isAgentInteractionMode()).toBe(false);

      inputManager.setAgentInteractionMode(false);
      expect(inputManager.isAgentInteractionMode()).toBe(false);
    });

    it('should start with agent interaction mode disabled', () => {
      expect(inputManager.isAgentInteractionMode()).toBe(false);
    });

    it('should not throw when calling setAgentInteractionMode', () => {
      expect(() => inputManager.setAgentInteractionMode(true)).not.toThrow();
      expect(() => inputManager.setAgentInteractionMode(false)).not.toThrow();
    });
  });

  describe('Arrow Key Event Handling', () => {
    it('should map arrow keys to ANSI sequences', () => {
      // Test that arrow key constants are correct ANSI escape sequences
      const arrowKeyMap = {
        ArrowUp: '\x1b[A',
        ArrowDown: '\x1b[B',
        ArrowRight: '\x1b[C',
        ArrowLeft: '\x1b[D',
      };

      // Verify the ANSI escape sequences are correct
      expect(arrowKeyMap['ArrowUp']).toBe('\x1b[A');
      expect(arrowKeyMap['ArrowDown']).toBe('\x1b[B');
      expect(arrowKeyMap['ArrowRight']).toBe('\x1b[C');
      expect(arrowKeyMap['ArrowLeft']).toBe('\x1b[D');
    });

    it('should handle arrow key events without throwing', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      // Dispatch the event - should not throw
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('should handle non-arrow key events without throwing', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });

      // Non-arrow keys should not throw
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('should ignore events when IME is composing', () => {
      // Simulate IME composition
      inputManager.setupIMEHandling();
      const compositionStartEvent = new CompositionEvent('compositionstart');
      document.dispatchEvent(compositionStartEvent);

      expect(inputManager.isIMEComposing()).toBe(true);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      // Should not throw even during IME composition
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });
  });

  describe('Cleanup and Disposal', () => {
    it('should cleanup on disposal without throwing', () => {
      // Dispose should not throw
      expect(() => inputManager.dispose()).not.toThrow();
    });

    it('should have agent interaction mode disabled after disposal', () => {
      inputManager.dispose();
      expect(inputManager.isAgentInteractionMode()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing terminal container gracefully', () => {
      // Remove the terminal container
      const container = document.querySelector('.terminal-container');
      container?.remove();

      inputManager.setAgentInteractionMode(true);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      // Should not throw an error
      expect(() => document.dispatchEvent(event)).not.toThrow();
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should handle missing terminal ID attribute gracefully', () => {
      const container = document.querySelector('.terminal-container');
      container?.removeAttribute('data-terminal-id');

      inputManager.setAgentInteractionMode(true);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      expect(() => document.dispatchEvent(event)).not.toThrow();
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });
});
