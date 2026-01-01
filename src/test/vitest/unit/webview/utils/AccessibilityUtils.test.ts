import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Import after mocks are set up
import {
  FocusManager,
  AriaHelper,
  KeyboardNavigationHelper,
  ColorContrastValidator,
} from '../../../../../webview/utils/AccessibilityUtils';

describe('AccessibilityUtils', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('FocusManager', () => {
    describe('getFocusableElements', () => {
      it('should return focusable elements', () => {
        const container = document.createElement('div');
        container.innerHTML = `
          <button>Button 1</button>
          <a href="#">Link</a>
          <input type="text">
          <textarea></textarea>
          <select><option>Option</option></select>
          <div tabindex="0">Focusable div</div>
          <div tabindex="-1">Non-focusable div</div>
          <span>Non-focusable span</span>
        `;
        document.body.appendChild(container);

        const focusable = FocusManager.getFocusableElements(container);

        expect(focusable.length).toBe(6);
      });

      it('should exclude disabled elements', () => {
        const container = document.createElement('div');
        container.innerHTML = `
          <button>Enabled Button</button>
          <button disabled>Disabled Button</button>
          <input type="text">
          <input type="text" disabled>
        `;
        document.body.appendChild(container);

        const focusable = FocusManager.getFocusableElements(container);

        expect(focusable.length).toBe(2);
      });

      it('should return empty array for empty container', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const focusable = FocusManager.getFocusableElements(container);

        expect(focusable.length).toBe(0);
      });
    });

    describe('trapFocus', () => {
      it('should return cleanup function', () => {
        const container = document.createElement('div');
        container.innerHTML = `
          <button id="first">First</button>
          <button id="last">Last</button>
        `;
        document.body.appendChild(container);

        const cleanup = FocusManager.trapFocus(container);

        expect(typeof cleanup).toBe('function');
        cleanup();
      });

      it('should focus first element', () => {
        const container = document.createElement('div');
        container.innerHTML = `
          <button id="first">First</button>
          <button id="second">Second</button>
        `;
        document.body.appendChild(container);

        FocusManager.trapFocus(container);

        const firstButton = document.getElementById('first');
        expect(document.activeElement).toBe(firstButton);
      });
    });

    describe('setFocus', () => {
      it('should focus element', () => {
        const button = document.createElement('button');
        button.textContent = 'Test';
        // Mock scrollIntoView
        button.scrollIntoView = vi.fn();
        document.body.appendChild(button);

        FocusManager.setFocus(button);

        expect(document.activeElement).toBe(button);
      });

      it('should scroll into view when specified', () => {
        const button = document.createElement('button');
        button.textContent = 'Test';
        button.scrollIntoView = vi.fn();
        document.body.appendChild(button);

        FocusManager.setFocus(button, true);

        expect(button.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'nearest',
        });
      });

      it('should not scroll when scrollIntoView is false', () => {
        const button = document.createElement('button');
        button.textContent = 'Test';
        button.scrollIntoView = vi.fn();
        document.body.appendChild(button);

        FocusManager.setFocus(button, false);

        expect(button.scrollIntoView).not.toHaveBeenCalled();
      });
    });
  });

  describe('AriaHelper', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = document.createElement('div');
      document.body.appendChild(element);
    });

    describe('setAttributes', () => {
      it('should set multiple ARIA attributes', () => {
        AriaHelper.setAttributes(element, {
          label: 'Test label',
          expanded: 'true',
        });

        expect(element.getAttribute('aria-label')).toBe('Test label');
        expect(element.getAttribute('aria-expanded')).toBe('true');
      });

      it('should handle attributes with aria- prefix', () => {
        AriaHelper.setAttributes(element, {
          'aria-hidden': 'true',
        });

        expect(element.getAttribute('aria-hidden')).toBe('true');
      });

      it('should convert boolean values to strings', () => {
        AriaHelper.setAttributes(element, {
          expanded: true,
          hidden: false,
        });

        expect(element.getAttribute('aria-expanded')).toBe('true');
        expect(element.getAttribute('aria-hidden')).toBe('false');
      });
    });

    describe('setExpanded', () => {
      it('should set aria-expanded to true', () => {
        AriaHelper.setExpanded(element, true);

        expect(element.getAttribute('aria-expanded')).toBe('true');
      });

      it('should set aria-expanded to false', () => {
        AriaHelper.setExpanded(element, false);

        expect(element.getAttribute('aria-expanded')).toBe('false');
      });
    });

    describe('setSelected', () => {
      it('should set aria-selected', () => {
        AriaHelper.setSelected(element, true);

        expect(element.getAttribute('aria-selected')).toBe('true');
      });
    });

    describe('setPressed', () => {
      it('should set aria-pressed', () => {
        AriaHelper.setPressed(element, true);

        expect(element.getAttribute('aria-pressed')).toBe('true');
      });
    });

    describe('setDisabled', () => {
      it('should set aria-disabled and tabindex when disabled', () => {
        AriaHelper.setDisabled(element, true);

        expect(element.getAttribute('aria-disabled')).toBe('true');
        expect(element.getAttribute('tabindex')).toBe('-1');
      });

      it('should remove tabindex when enabled', () => {
        element.setAttribute('tabindex', '-1');

        AriaHelper.setDisabled(element, false);

        expect(element.getAttribute('aria-disabled')).toBe('false');
        expect(element.hasAttribute('tabindex')).toBe(false);
      });
    });

    describe('setLabel', () => {
      it('should set aria-label', () => {
        AriaHelper.setLabel(element, 'Test label');

        expect(element.getAttribute('aria-label')).toBe('Test label');
      });
    });

    describe('setDescribedBy', () => {
      it('should set aria-describedby', () => {
        AriaHelper.setDescribedBy(element, 'description-id');

        expect(element.getAttribute('aria-describedby')).toBe('description-id');
      });
    });

    describe('setLabelledBy', () => {
      it('should set aria-labelledby', () => {
        AriaHelper.setLabelledBy(element, 'label-id');

        expect(element.getAttribute('aria-labelledby')).toBe('label-id');
      });
    });

    describe('setLiveRegion', () => {
      it('should set aria-live and aria-atomic', () => {
        AriaHelper.setLiveRegion(element, 'polite');

        expect(element.getAttribute('aria-live')).toBe('polite');
        expect(element.getAttribute('aria-atomic')).toBe('true');
      });

      it('should set aria-live to off', () => {
        AriaHelper.setLiveRegion(element, 'off');

        expect(element.getAttribute('aria-live')).toBe('off');
      });
    });

    describe('setCurrent', () => {
      it('should set aria-current to page', () => {
        AriaHelper.setCurrent(element, 'page');

        expect(element.getAttribute('aria-current')).toBe('page');
      });

      it('should set aria-current to step', () => {
        AriaHelper.setCurrent(element, 'step');

        expect(element.getAttribute('aria-current')).toBe('step');
      });
    });
  });

  describe('KeyboardNavigationHelper', () => {
    describe('handleArrowKeys', () => {
      it('should navigate down with ArrowDown', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 0, onNavigate);

        expect(onNavigate).toHaveBeenCalledWith(1);
      });

      it('should navigate up with ArrowUp', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 1, onNavigate);

        expect(onNavigate).toHaveBeenCalledWith(0);
      });

      it('should wrap to end with ArrowUp at start', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 0, onNavigate);

        expect(onNavigate).toHaveBeenCalledWith(2);
      });

      it('should wrap to start with ArrowDown at end', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 2, onNavigate);

        expect(onNavigate).toHaveBeenCalledWith(0);
      });

      it('should navigate to start with Home', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'Home' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 1, onNavigate);

        expect(onNavigate).toHaveBeenCalledWith(0);
      });

      it('should navigate to end with End', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'End' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 1, onNavigate);

        expect(onNavigate).toHaveBeenCalledWith(2);
      });

      it('should not navigate for other keys', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'Enter' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 0, onNavigate);

        expect(onNavigate).not.toHaveBeenCalled();
      });

      it('should handle ArrowRight same as ArrowDown', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 0, onNavigate);

        expect(onNavigate).toHaveBeenCalledWith(1);
      });

      it('should handle ArrowLeft same as ArrowUp', () => {
        const onNavigate = vi.fn();
        const items = [
          document.createElement('div'),
          document.createElement('div'),
        ];
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

        KeyboardNavigationHelper.handleArrowKeys(event, items, 1, onNavigate);

        expect(onNavigate).toHaveBeenCalledWith(0);
      });
    });

    describe('setupShortcut', () => {
      it('should return cleanup function', () => {
        const element = document.createElement('div');
        const callback = vi.fn();

        const cleanup = KeyboardNavigationHelper.setupShortcut(
          element,
          ['Enter'],
          callback,
          'Test action'
        );

        expect(typeof cleanup).toBe('function');
        cleanup();
      });

      it('should call callback on matching key', () => {
        const element = document.createElement('div');
        document.body.appendChild(element);
        const callback = vi.fn();

        KeyboardNavigationHelper.setupShortcut(element, ['Enter'], callback, 'Test action');

        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        element.dispatchEvent(event);

        expect(callback).toHaveBeenCalled();
      });

      it('should not call callback on non-matching key', () => {
        const element = document.createElement('div');
        document.body.appendChild(element);
        const callback = vi.fn();

        KeyboardNavigationHelper.setupShortcut(element, ['Enter'], callback, 'Test action');

        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        element.dispatchEvent(event);

        expect(callback).not.toHaveBeenCalled();
      });
    });
  });

  describe('ColorContrastValidator', () => {
    describe('getContrastRatio', () => {
      it('should return 21 for black and white', () => {
        const ratio = ColorContrastValidator.getContrastRatio('#000000', '#ffffff');

        expect(ratio).toBeCloseTo(21, 0);
      });

      it('should return 1 for same colors', () => {
        const ratio = ColorContrastValidator.getContrastRatio('#000000', '#000000');

        expect(ratio).toBeCloseTo(1, 0);
      });

      it('should return 0 for invalid colors', () => {
        const ratio = ColorContrastValidator.getContrastRatio('invalid', '#ffffff');

        expect(ratio).toBe(0);
      });

      it('should handle colors without hash', () => {
        const ratio = ColorContrastValidator.getContrastRatio('000000', 'ffffff');

        expect(ratio).toBeCloseTo(21, 0);
      });
    });

    describe('meetsWCAG_AA', () => {
      it('should return true for black on white', () => {
        const meets = ColorContrastValidator.meetsWCAG_AA('#000000', '#ffffff');

        expect(meets).toBe(true);
      });

      it('should return false for low contrast', () => {
        const meets = ColorContrastValidator.meetsWCAG_AA('#777777', '#888888');

        expect(meets).toBe(false);
      });

      it('should return true for 4.5:1 ratio', () => {
        // Gray that should meet AA
        const meets = ColorContrastValidator.meetsWCAG_AA('#595959', '#ffffff');

        expect(meets).toBe(true);
      });
    });

    describe('meetsWCAG_AAA', () => {
      it('should return true for black on white', () => {
        const meets = ColorContrastValidator.meetsWCAG_AAA('#000000', '#ffffff');

        expect(meets).toBe(true);
      });

      it('should return false for medium contrast', () => {
        // Gray that meets AA but not AAA
        const meets = ColorContrastValidator.meetsWCAG_AAA('#767676', '#ffffff');

        expect(meets).toBe(false);
      });

      it('should return true for 7:1 ratio', () => {
        const meets = ColorContrastValidator.meetsWCAG_AAA('#3d3d3d', '#ffffff');

        expect(meets).toBe(true);
      });
    });
  });

});
