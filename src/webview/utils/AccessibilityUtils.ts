/**
 * Accessibility Utilities
 * Provides WCAG AA compliant accessibility features including:
 * - ARIA attribute management
 * - Screen reader announcements
 * - Keyboard navigation support
 * - Focus management
 */

import { webview as log } from '../../utils/logger';

/**
 * Announces a message to screen readers
 */
export class ScreenReaderAnnouncer {
  private static liveRegion: HTMLElement | null = null;
  private static politeRegion: HTMLElement | null = null;

  /**
   * Initialize screen reader announcement regions
   */
  static initialize(): void {
    if (!this.liveRegion) {
      this.liveRegion = this.createLiveRegion('assertive');
      this.politeRegion = this.createLiveRegion('polite');
      document.body.appendChild(this.liveRegion);
      document.body.appendChild(this.politeRegion);
      log('✅ [A11Y] Screen reader announcement regions initialized');
    }
  }

  /**
   * Create a live region element
   */
  private static createLiveRegion(priority: 'assertive' | 'polite'): HTMLElement {
    const region = document.createElement('div');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.className = `sr-only sr-live-region-${priority}`;
    region.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    return region;
  }

  /**
   * Announce a message to screen readers
   * @param message - Message to announce
   * @param priority - 'assertive' for immediate announcement, 'polite' for when user is idle
   */
  static announce(message: string, priority: 'assertive' | 'polite' = 'polite'): void {
    if (!this.liveRegion || !this.politeRegion) {
      this.initialize();
    }

    const region = priority === 'assertive' ? this.liveRegion : this.politeRegion;
    if (region) {
      // Clear first to ensure announcement even if message is the same
      region.textContent = '';
      // Use setTimeout to ensure screen readers pick up the change
      setTimeout(() => {
        region.textContent = message;
        log(`📢 [A11Y] Announced (${priority}): ${message}`);
      }, 100);
    }
  }

  /**
   * Clear all announcements
   */
  static clear(): void {
    if (this.liveRegion) {
      this.liveRegion.textContent = '';
    }
    if (this.politeRegion) {
      this.politeRegion.textContent = '';
    }
  }
}

/**
 * Manages focus for accessibility
 */
export class FocusManager {
  private static focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /**
   * Get all focusable elements within a container
   */
  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableSelectors));
  }

  /**
   * Trap focus within a container (for modals, dialogs)
   */
  static trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Focus first element
    firstElement?.focus();

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Set focus to element and scroll into view
   */
  static setFocus(element: HTMLElement, scrollIntoView = true): void {
    element.focus();
    if (scrollIntoView) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

/**
 * ARIA attribute helpers
 */
export class AriaHelper {
  /**
   * Set ARIA attributes on an element
   */
  static setAttributes(element: HTMLElement, attributes: Record<string, string | boolean>): void {
    Object.entries(attributes).forEach(([key, value]) => {
      const ariaKey = key.startsWith('aria-') ? key : `aria-${key}`;
      element.setAttribute(ariaKey, String(value));
    });
  }

  /**
   * Mark element as expanded/collapsed
   */
  static setExpanded(element: HTMLElement, expanded: boolean): void {
    element.setAttribute('aria-expanded', String(expanded));
  }

  /**
   * Mark element as selected/unselected
   */
  static setSelected(element: HTMLElement, selected: boolean): void {
    element.setAttribute('aria-selected', String(selected));
  }

  /**
   * Mark element as pressed/unpressed (for toggle buttons)
   */
  static setPressed(element: HTMLElement, pressed: boolean): void {
    element.setAttribute('aria-pressed', String(pressed));
  }

  /**
   * Mark element as disabled/enabled
   */
  static setDisabled(element: HTMLElement, disabled: boolean): void {
    element.setAttribute('aria-disabled', String(disabled));
    if (disabled) {
      element.setAttribute('tabindex', '-1');
    } else {
      element.removeAttribute('tabindex');
    }
  }

  /**
   * Set ARIA label
   */
  static setLabel(element: HTMLElement, label: string): void {
    element.setAttribute('aria-label', label);
  }

  /**
   * Set ARIA described by
   */
  static setDescribedBy(element: HTMLElement, describerId: string): void {
    element.setAttribute('aria-describedby', describerId);
  }

  /**
   * Set ARIA labelled by
   */
  static setLabelledBy(element: HTMLElement, labelId: string): void {
    element.setAttribute('aria-labelledby', labelId);
  }

  /**
   * Set ARIA live region
   */
  static setLiveRegion(element: HTMLElement, priority: 'assertive' | 'polite' | 'off'): void {
    element.setAttribute('aria-live', priority);
    element.setAttribute('aria-atomic', 'true');
  }

  /**
   * Mark element as current (for navigation)
   */
  static setCurrent(element: HTMLElement, current: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'): void {
    element.setAttribute('aria-current', current);
  }
}

/**
 * Keyboard navigation helpers
 */
export class KeyboardNavigationHelper {
  /**
   * Handle arrow key navigation in a list
   */
  static handleArrowKeys(
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onNavigate: (newIndex: number) => void
  ): void {
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        newIndex = (currentIndex + 1) % items.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = (currentIndex - 1 + items.length) % items.length;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;
      default:
        return;
    }

    onNavigate(newIndex);
  }

  /**
   * Setup keyboard shortcuts with proper ARIA announcements
   */
  static setupShortcut(
    element: HTMLElement,
    keys: string[],
    callback: () => void,
    description: string
  ): () => void {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (keys.includes(e.key)) {
        e.preventDefault();
        callback();
        ScreenReaderAnnouncer.announce(description, 'polite');
      }
    };

    element.addEventListener('keydown', handleKeyDown);

    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }
}

/**
 * Color contrast validation
 */
export class ColorContrastValidator {
  /**
   * Calculate relative luminance
   */
  private static getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    if (!rgb1 || !rgb2) return 0;

    const l1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Convert hex color to RGB
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Check if contrast meets WCAG AA standards (4.5:1 for normal text)
   */
  static meetsWCAG_AA(foreground: string, background: string): boolean {
    return this.getContrastRatio(foreground, background) >= 4.5;
  }

  /**
   * Check if contrast meets WCAG AAA standards (7:1 for normal text)
   */
  static meetsWCAG_AAA(foreground: string, background: string): boolean {
    return this.getContrastRatio(foreground, background) >= 7;
  }
}

/**
 * Initialize all accessibility features
 */
export function initializeAccessibility(): void {
  ScreenReaderAnnouncer.initialize();
  log('✅ [A11Y] Accessibility utilities initialized');
}
