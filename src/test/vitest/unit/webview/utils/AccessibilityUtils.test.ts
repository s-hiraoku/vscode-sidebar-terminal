import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  ScreenReaderAnnouncer, 
  AriaHelper, 
  ColorContrastValidator,
  FocusManager
} from '../../../../../webview/utils/AccessibilityUtils';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('AccessibilityUtils', () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ScreenReaderAnnouncer', () => {
    beforeEach(() => {
      // Reset static state for tests
      (ScreenReaderAnnouncer as any).liveRegion = null;
      (ScreenReaderAnnouncer as any).politeRegion = null;
    });

    it('should initialize live regions', () => {
      ScreenReaderAnnouncer.initialize();
      expect(document.body.querySelector('.sr-live-region-assertive')).not.toBeNull();
      expect(document.body.querySelector('.sr-live-region-polite')).not.toBeNull();
    });

    it('should announce message', () => {
      ScreenReaderAnnouncer.announce('Test message');
      
      const region = document.body.querySelector('.sr-live-region-polite');
      expect(region).not.toBeNull();
      
      // Initially cleared
      expect(region!.textContent).toBe('');
      
      vi.advanceTimersByTime(100);
      
      expect(region!.textContent).toBe('Test message');
    });

    it('should announce assertive message', () => {
      ScreenReaderAnnouncer.announce('Important', 'assertive');
      
      const region = document.body.querySelector('.sr-live-region-assertive');
      vi.advanceTimersByTime(100);
      expect(region!.textContent).toBe('Important');
    });

    it('should clear announcements', () => {
      ScreenReaderAnnouncer.announce('Test');
      vi.advanceTimersByTime(100);
      ScreenReaderAnnouncer.clear();
      
      const region = document.body.querySelector('.sr-live-region-polite');
      expect(region!.textContent).toBe('');
    });
  });

  describe('AriaHelper', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = document.createElement('button');
    });

    it('should set ARIA attributes', () => {
      AriaHelper.setAttributes(element, { label: 'Test', disabled: true });
      expect(element.getAttribute('aria-label')).toBe('Test');
      expect(element.getAttribute('aria-disabled')).toBe('true');
    });

    it('should set expanded state', () => {
      AriaHelper.setExpanded(element, true);
      expect(element.getAttribute('aria-expanded')).toBe('true');
    });

    it('should set selected state', () => {
      AriaHelper.setSelected(element, true);
      expect(element.getAttribute('aria-selected')).toBe('true');
    });

    it('should set pressed state', () => {
      AriaHelper.setPressed(element, true);
      expect(element.getAttribute('aria-pressed')).toBe('true');
    });

    it('should set disabled state and tabindex', () => {
      AriaHelper.setDisabled(element, true);
      expect(element.getAttribute('aria-disabled')).toBe('true');
      expect(element.getAttribute('tabindex')).toBe('-1');

      AriaHelper.setDisabled(element, false);
      expect(element.getAttribute('aria-disabled')).toBe('false');
      expect(element.hasAttribute('tabindex')).toBe(false);
    });

    it('should set label', () => {
      AriaHelper.setLabel(element, 'Label');
      expect(element.getAttribute('aria-label')).toBe('Label');
    });

    it('should set described by', () => {
      AriaHelper.setDescribedBy(element, 'desc-id');
      expect(element.getAttribute('aria-describedby')).toBe('desc-id');
    });

    it('should set labelled by', () => {
      AriaHelper.setLabelledBy(element, 'label-id');
      expect(element.getAttribute('aria-labelledby')).toBe('label-id');
    });

    it('should set live region', () => {
      AriaHelper.setLiveRegion(element, 'polite');
      expect(element.getAttribute('aria-live')).toBe('polite');
      expect(element.getAttribute('aria-atomic')).toBe('true');
    });

    it('should set current', () => {
      AriaHelper.setCurrent(element, 'page');
      expect(element.getAttribute('aria-current')).toBe('page');
    });
  });

  describe('ColorContrastValidator', () => {
    it('should calculate contrast ratio', () => {
      // Black on White = 21:1
      expect(ColorContrastValidator.getContrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
      // White on Black = 21:1
      expect(ColorContrastValidator.getContrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
      // Same color = 1:1
      expect(ColorContrastValidator.getContrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
    });

    it('should handle invalid colors', () => {
      expect(ColorContrastValidator.getContrastRatio('invalid', '#FFFFFF')).toBe(0);
    });

    it('should check WCAG AA compliance', () => {
      expect(ColorContrastValidator.meetsWCAG_AA('#000000', '#FFFFFF')).toBe(true);
      expect(ColorContrastValidator.meetsWCAG_AA('#767676', '#FFFFFF')).toBe(true); // ~4.54:1
      expect(ColorContrastValidator.meetsWCAG_AA('#777777', '#FFFFFF')).toBe(false); // ~4.47:1
    });

    it('should check WCAG AAA compliance', () => {
      expect(ColorContrastValidator.meetsWCAG_AAA('#000000', '#FFFFFF')).toBe(true);
      expect(ColorContrastValidator.meetsWCAG_AAA('#595959', '#FFFFFF')).toBe(true); // ~7.0:1
      expect(ColorContrastValidator.meetsWCAG_AAA('#5A5A5A', '#FFFFFF')).toBe(false); // ~6.9:1
    });
  });

  describe('FocusManager', () => {
    it('should find focusable elements', () => {
      container.innerHTML = `
        <button id="btn1">1</button>
        <div>text</div>
        <input id="inp1" />
        <button disabled>disabled</button>
        <div tabindex="0" id="div1">tabbable</div>
      `;
      
      const focusable = FocusManager.getFocusableElements(container);
      expect(focusable.length).toBe(3);
      expect(focusable[0].id).toBe('btn1');
      expect(focusable[1].id).toBe('inp1');
      expect(focusable[2].id).toBe('div1');
    });

    it('should set focus', () => {
      const btn = document.createElement('button');
      container.appendChild(btn);
      
      // Mock scrollIntoView as it's not implemented in jsdom
      btn.scrollIntoView = vi.fn();
      
      FocusManager.setFocus(btn);
      
      expect(document.activeElement).toBe(btn);
      expect(btn.scrollIntoView).toHaveBeenCalled();
    });
  });
});
