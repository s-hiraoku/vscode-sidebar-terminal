import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  SpecialKeysHandler,
  ISpecialKeysHandlerDeps,
} from '../../../../../../../webview/managers/input/handlers/SpecialKeysHandler';

describe('SpecialKeysHandler', () => {
  let dom: JSDOM;
  let handler: SpecialKeysHandler;
  let mockDeps: ISpecialKeysHandlerDeps;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);

    mockDeps = {
      logger: vi.fn(),
      isIMEComposing: vi.fn().mockReturnValue(false),
      handleTerminalCopy: vi.fn(),
      handleTerminalPaste: vi.fn(),
      emitTerminalInteractionEvent: vi.fn(),
      queueInputData: vi.fn(),
      getTerminalInstance: vi.fn().mockReturnValue(null),
    };

    handler = new SpecialKeysHandler(mockDeps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('IME composition blocking', () => {
    it('should block special keys during IME composition', () => {
      (mockDeps.isIMEComposing as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(false);
      expect(mockDeps.logger).toHaveBeenCalledWith(
        expect.stringContaining('blocked during IME composition')
      );
    });

    it('should block KEY_IN_COMPOSITION (keyCode 229)', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        keyCode: 229,
        bubbles: true,
        cancelable: true,
      });
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(true);
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Copy (Ctrl+C / Cmd+C)', () => {
    it('should copy when terminal has selection', () => {
      const mockTerminal = {
        terminal: { hasSelection: vi.fn().mockReturnValue(true) },
      };
      (mockDeps.getTerminalInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockTerminal);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(true);
      expect(preventSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
      expect(mockDeps.handleTerminalCopy).toHaveBeenCalledWith(manager);
    });

    it('should send interrupt on Ctrl+C without selection', () => {
      const mockTerminal = {
        terminal: { hasSelection: vi.fn().mockReturnValue(false) },
      };
      (mockDeps.getTerminalInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockTerminal);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(true);
      expect(mockDeps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
        'interrupt',
        'terminal-1',
        undefined,
        manager
      );
    });

    it('should not send interrupt on Cmd+C (macOS) without selection', () => {
      const mockTerminal = {
        terminal: { hasSelection: vi.fn().mockReturnValue(false) },
      };
      (mockDeps.getTerminalInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockTerminal);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'c',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(false);
      expect(mockDeps.emitTerminalInteractionEvent).not.toHaveBeenCalled();
    });
  });

  describe('Paste handling', () => {
    it('should not intercept Ctrl+V (let paste event handler process)', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(false);
    });

    it('should handle Shift+Insert paste', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Insert',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(true);
      expect(preventSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
      expect(mockDeps.handleTerminalPaste).toHaveBeenCalledWith(manager);
    });
  });

  describe('Ctrl+Insert copy', () => {
    it('should copy on Ctrl+Insert when terminal has selection', () => {
      const mockTerminal = {
        terminal: { hasSelection: vi.fn().mockReturnValue(true) },
      };
      (mockDeps.getTerminalInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockTerminal);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Insert',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(true);
      expect(preventSpy).toHaveBeenCalled();
      expect(mockDeps.handleTerminalCopy).toHaveBeenCalledWith(manager);
    });
  });

  describe('Multiline input (Shift/Alt/Cmd+Enter)', () => {
    it('should send newline on Shift+Enter', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(true);
      expect(preventSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
      expect(mockDeps.queueInputData).toHaveBeenCalledWith('terminal-1', '\n', true);
    });

    it('should send newline on Alt+Enter', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(true);
      expect(mockDeps.queueInputData).toHaveBeenCalledWith('terminal-1', '\n', true);
    });
  });

  describe('Unhandled keys', () => {
    it('should return false for unhandled keys', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });
      const manager = {} as any;

      const result = handler.handleSpecialKeys(event, 'terminal-1', manager);
      expect(result).toBe(false);
    });
  });
});
