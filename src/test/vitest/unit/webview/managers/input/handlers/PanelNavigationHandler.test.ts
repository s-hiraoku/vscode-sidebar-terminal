import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  PanelNavigationHandler,
  IPanelNavigationHandlerDeps,
} from '../../../../../../../webview/managers/input/handlers/PanelNavigationHandler';

describe('PanelNavigationHandler', () => {
  let dom: JSDOM;
  let handler: PanelNavigationHandler;
  let mockDeps: IPanelNavigationHandlerDeps;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);

    mockDeps = {
      logger: vi.fn(),
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      emitTerminalInteractionEvent: vi.fn(),
    };

    handler = new PanelNavigationHandler(mockDeps);
  });

  afterEach(() => {
    handler.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('Initialization', () => {
    it('should initialize with panel navigation disabled', () => {
      expect(handler.isPanelNavigationMode()).toBe(false);
    });

    it('should not handle keys when not enabled', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      expect(handler.handlePanelNavigationKey(event)).toBe(false);
    });
  });

  describe('setPanelNavigationEnabled', () => {
    it('should enable panel navigation', () => {
      handler.setPanelNavigationEnabled(true);
      // After enabling, Ctrl+P should toggle panel mode
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const handled = handler.handlePanelNavigationKey(event);
      expect(handled).toBe(true);
    });

    it('should disable panel navigation and exit mode', () => {
      handler.setPanelNavigationEnabled(true);
      handler.setPanelNavigationMode(true);
      handler.setPanelNavigationEnabled(false);
      expect(handler.isPanelNavigationMode()).toBe(false);
    });

    it('should toggle panel-navigation-enabled class on body', () => {
      handler.setPanelNavigationEnabled(true);
      expect(dom.window.document.body.classList.contains('panel-navigation-enabled')).toBe(true);
      handler.setPanelNavigationEnabled(false);
      expect(dom.window.document.body.classList.contains('panel-navigation-enabled')).toBe(false);
    });
  });

  describe('Toggle with Ctrl+P', () => {
    it('should enter panel navigation mode on Ctrl+P', () => {
      handler.setPanelNavigationEnabled(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      vi.spyOn(event, 'preventDefault');
      vi.spyOn(event, 'stopPropagation');

      const handled = handler.handlePanelNavigationKey(event);

      expect(handled).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(handler.isPanelNavigationMode()).toBe(true);
    });

    it('should exit panel navigation mode on second Ctrl+P', () => {
      handler.setPanelNavigationEnabled(true);

      // Enter
      handler.handlePanelNavigationKey(
        new dom.window.KeyboardEvent('keydown', {
          key: 'p',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
      expect(handler.isPanelNavigationMode()).toBe(true);

      // Exit
      handler.handlePanelNavigationKey(
        new dom.window.KeyboardEvent('keydown', {
          key: 'p',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
      expect(handler.isPanelNavigationMode()).toBe(false);
    });

    it('should not activate on Ctrl+Shift+P', () => {
      handler.setPanelNavigationEnabled(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const handled = handler.handlePanelNavigationKey(event);

      expect(handled).toBe(false);
    });

    it('should not activate on Ctrl+Alt+P', () => {
      handler.setPanelNavigationEnabled(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      const handled = handler.handlePanelNavigationKey(event);

      expect(handled).toBe(false);
    });

    it('should not activate on Cmd+P (metaKey)', () => {
      handler.setPanelNavigationEnabled(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'p',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const handled = handler.handlePanelNavigationKey(event);

      expect(handled).toBe(false);
    });
  });

  describe('Escape to exit', () => {
    it('should exit panel navigation mode on Escape', () => {
      handler.setPanelNavigationEnabled(true);
      handler.setPanelNavigationMode(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      vi.spyOn(event, 'preventDefault');
      vi.spyOn(event, 'stopPropagation');

      const handled = handler.handlePanelNavigationKey(event);

      expect(handled).toBe(true);
      expect(handler.isPanelNavigationMode()).toBe(false);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Navigation keys', () => {
    beforeEach(() => {
      handler.setPanelNavigationEnabled(true);
      handler.setPanelNavigationMode(true);
    });

    it.each([
      ['h', 'switch-previous'],
      ['k', 'switch-previous'],
      ['ArrowLeft', 'switch-previous'],
      ['ArrowUp', 'switch-previous'],
      ['j', 'switch-next'],
      ['l', 'switch-next'],
      ['ArrowRight', 'switch-next'],
      ['ArrowDown', 'switch-next'],
    ])('should map %s to %s', (key, expectedType) => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      vi.spyOn(event, 'preventDefault');
      vi.spyOn(event, 'stopPropagation');

      handler.handlePanelNavigationKey(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockDeps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
        expectedType,
        'terminal-1',
        undefined
      );
    });

    it('should not emit navigation event when no active terminal', () => {
      mockDeps.getActiveTerminalId = vi.fn().mockReturnValue(null);
      handler = new PanelNavigationHandler(mockDeps);
      handler.setPanelNavigationEnabled(true);
      handler.setPanelNavigationMode(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      handler.handlePanelNavigationKey(event);

      expect(mockDeps.emitTerminalInteractionEvent).not.toHaveBeenCalled();
    });

    it('should fallback to DOM active terminal when id is null', () => {
      mockDeps.getActiveTerminalId = vi.fn().mockReturnValue(null);
      handler = new PanelNavigationHandler(mockDeps);
      handler.setPanelNavigationEnabled(true);
      handler.setPanelNavigationMode(true);

      // Create a DOM element that looks like an active terminal container
      const activeContainer = dom.window.document.createElement('div');
      activeContainer.className = 'terminal-container active';
      activeContainer.setAttribute('data-terminal-id', 'terminal-dom');
      dom.window.document.body.appendChild(activeContainer);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      handler.handlePanelNavigationKey(event);

      expect(mockDeps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
        'switch-next',
        'terminal-dom',
        undefined
      );
    });
  });

  describe('Action keys', () => {
    beforeEach(() => {
      handler.setPanelNavigationEnabled(true);
      handler.setPanelNavigationMode(true);
    });

    it.each([
      ['r', 'create-terminal'],
      ['d', 'create-terminal'],
      ['x', 'kill-terminal'],
    ])('should handle %s key and emit %s', (key, expectedType) => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      vi.spyOn(event, 'preventDefault');
      vi.spyOn(event, 'stopPropagation');

      handler.handlePanelNavigationKey(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockDeps.emitTerminalInteractionEvent).toHaveBeenCalledWith(
        expectedType,
        expectedType === 'create-terminal' ? '' : 'terminal-1',
        undefined
      );
    });
  });

  describe('Non-navigation keys blocked', () => {
    it('should block non-navigation keys in panel navigation mode', () => {
      handler.setPanelNavigationEnabled(true);
      handler.setPanelNavigationMode(true);

      const nonNavKeys = ['a', 'z', '1', 'Enter', 'Tab', ' '];
      for (const key of nonNavKeys) {
        const event = new dom.window.KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        vi.spyOn(event, 'preventDefault');

        const handled = handler.handlePanelNavigationKey(event);

        expect(handled).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
      }

      expect(mockDeps.emitTerminalInteractionEvent).not.toHaveBeenCalled();
    });
  });

  describe('Indicator UI', () => {
    it('should show indicator when mode is enabled', () => {
      handler.setPanelNavigationMode(true);

      const indicator = dom.window.document.querySelector(
        '.panel-navigation-indicator'
      ) as HTMLElement | null;

      expect(indicator).not.toBeNull();
      expect(indicator?.textContent).toContain('PANEL MODE');
      expect(indicator?.textContent).toContain('r/d:new');
      expect(indicator?.textContent).toContain('x:close');
      expect(indicator?.style.display).toBe('block');
    });

    it('should hide indicator when mode is disabled', () => {
      handler.setPanelNavigationMode(true);
      handler.setPanelNavigationMode(false);

      const indicator = dom.window.document.querySelector(
        '.panel-navigation-indicator'
      ) as HTMLElement | null;

      expect(indicator?.style.display).toBe('none');
    });

    it('should toggle body class', () => {
      handler.setPanelNavigationMode(true);
      expect(dom.window.document.body.classList.contains('panel-navigation-mode')).toBe(true);

      handler.setPanelNavigationMode(false);
      expect(dom.window.document.body.classList.contains('panel-navigation-mode')).toBe(false);
    });
  });

  describe('Dispose', () => {
    it('should clean up indicator on dispose', () => {
      handler.setPanelNavigationMode(true);
      expect(dom.window.document.querySelector('.panel-navigation-indicator')).not.toBeNull();

      handler.dispose();

      expect(dom.window.document.querySelector('.panel-navigation-indicator')).toBeNull();
    });

    it('should exit panel navigation mode on dispose', () => {
      handler.setPanelNavigationMode(true);
      handler.dispose();
      // After dispose, internal state should be reset
      // (cannot check isPanelNavigationMode after dispose, but body class should be cleared)
      expect(dom.window.document.body.classList.contains('panel-navigation-mode')).toBe(false);
    });
  });
});
