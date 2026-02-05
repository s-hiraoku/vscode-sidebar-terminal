// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
/**
 * TerminalContainerFactory Tests
 * Tests for centralized terminal container creation and styling
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import {
  TerminalContainerFactory,
  TerminalContainerConfig,
  TerminalHeaderConfig,
} from '../../../../../webview/factories/TerminalContainerFactory';

describe('TerminalContainerFactory', () => {
  beforeEach(() => {
    // Set up DOM elements in the existing environment
    document.body.innerHTML = '<div id="terminal-main-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('createContainer', () => {
    it('should create basic container with minimal config', () => {
      const config: TerminalContainerConfig = {
        id: 'test-terminal-1',
        name: 'Test Terminal',
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements).not.toBeNull();
      expect(elements.container).toBeInstanceOf(HTMLElement);
      expect(elements.body).toBeInstanceOf(HTMLElement);
      expect(elements.header).toBeUndefined();
      // Close button is undefined when header is not created
      expect(elements.closeButton).toBeUndefined();
      expect(elements.splitButton).toBeUndefined();
    });

    it('should create container with custom className', () => {
      const config: TerminalContainerConfig = {
        id: 'test-terminal-2',
        name: 'Test Terminal',
        className: 'custom-terminal-container active',
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements.container.className).toBe('custom-terminal-container active');
    });

    it('should create container with header when requested', () => {
      const config: TerminalContainerConfig = {
        id: 'test-terminal-3',
        name: 'Test Terminal with Header',
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true,
        showSplitButton: true,
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      expect(elements.header).toBeInstanceOf(HTMLElement);
      // HeaderFactory currently always creates close button if header is shown
      expect(elements.closeButton).toBeInstanceOf(HTMLElement);
      expect(elements.splitButton).toBeInstanceOf(HTMLElement);
    });

    it('should set correct data attributes', () => {
      const config: TerminalContainerConfig = {
        id: 'data-test-terminal',
        name: 'Data Test Terminal',
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements.container.getAttribute('data-terminal-id')).toBe('data-test-terminal');
      expect(elements.container.getAttribute('data-terminal-name')).toBe('Data Test Terminal');
    });

    it('should apply split-specific styles when isSplit is true', () => {
      const config: TerminalContainerConfig = {
        id: 'split-terminal',
        name: 'Split Terminal',
        isSplit: true,
        height: 250,
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements.container.style.height).toBe('250px');
      // Check for split-specific styles
      expect(elements.container.style.minHeight).toBe('150px');
    });

    it('should apply active state styles when isActive is true', () => {
      const config: TerminalContainerConfig = {
        id: 'active-terminal',
        name: 'Active Terminal',
        isActive: true,
      };

      const elements = TerminalContainerFactory.createContainer(config);

      // Should have active border style (borderColor may be empty/transparent in happy-dom due to CSS variables)
      expect(elements.container.style.borderStyle).toBe('solid');
    });

    it('should apply custom styles when provided', () => {
      const config: TerminalContainerConfig = {
        id: 'custom-styles-terminal',
        name: 'Custom Styles Terminal',
        customStyles: {
          backgroundColor: 'rgb(255, 0, 0)',
          border: '3px solid blue',
          opacity: '0.8',
        },
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements.container.style.backgroundColor).toBe('rgb(255, 0, 0)');
      expect(elements.container.style.border).toBe('3px solid blue');
      expect(elements.container.style.opacity).toBe('0.8');
    });

    it('should handle width and height configuration', () => {
      const config: TerminalContainerConfig = {
        id: 'sized-terminal',
        name: 'Sized Terminal',
        width: 800,
        height: 400,
        isSplit: true,
      };

      const elements = TerminalContainerFactory.createContainer(config);

      // Height should be set for splits
      expect(elements.container.style.height).toBe('400px');
    });
  });

  describe('header creation', () => {
    it('should create header with custom title', () => {
      const config: TerminalContainerConfig = {
        id: 'header-test',
        name: 'Original Name',
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        customTitle: 'Custom Header Title',
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      const titleElement = elements.header!.querySelector('.terminal-name');
      expect(titleElement!.textContent).toBe('Custom Header Title');
    });

    it('should use terminal name when no custom title provided', () => {
      const config: TerminalContainerConfig = {
        id: 'default-title-test',
        name: 'Default Title Terminal',
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      const titleElement = elements.header!.querySelector('.terminal-name');
      expect(titleElement!.textContent).toBe('Default Title Terminal');
    });

    it('should create requested buttons (split is optional)', () => {
      const config: TerminalContainerConfig = {
        id: 'button-test',
        name: 'Button Test',
      };

      // Close button is currently always created by HeaderFactory if header is shown
      const headerConfig1: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true,
        showSplitButton: false,
      };

      const elements1 = TerminalContainerFactory.createContainer(config, headerConfig1);
      expect(elements1.closeButton).toBeInstanceOf(HTMLElement);
      expect(elements1.splitButton).toBeUndefined();

      // Test only split button
      const headerConfig2: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: false,
        showSplitButton: true,
      };

      const elements2 = TerminalContainerFactory.createContainer(config, headerConfig2);
      // Still exists because HeaderFactory always creates it
      expect(elements2.closeButton).toBeInstanceOf(HTMLElement);
      expect(elements2.splitButton).toBeInstanceOf(HTMLElement);
    });

    it('should create header buttons with hover effects', () => {
      const config: TerminalContainerConfig = {
        id: 'hover-test',
        name: 'Hover Test',
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true,
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      const button = elements.closeButton!;

      // Simulate mouseenter
      const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);

      // Should have hover styles applied
      expect(button.style.backgroundColor).not.toBe('');
      expect(button.style.backgroundColor).not.toBe('transparent');

      // Simulate mouseleave
      const mouseLeaveEvent = new MouseEvent('mouseleave', { bubbles: true });
      button.dispatchEvent(mouseLeaveEvent);

      // Should revert to original styles
      expect(button.style.backgroundColor).toBe('transparent');
    });

    it('should not trigger container activation on second click of terminal-name double click', () => {
      const onContainerClick = vi.fn();
      const config: TerminalContainerConfig = {
        id: 'rename-click-test',
        name: 'Rename Click Test',
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        onContainerClick,
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);
      const nameSpan = elements.header?.querySelector('.terminal-name') as HTMLElement;

      nameSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      nameSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
      nameSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));

      expect(onContainerClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('utility methods', () => {
    let container: HTMLElement;

    beforeEach(() => {
      const config: TerminalContainerConfig = {
        id: 'utility-test',
        name: 'Utility Test',
      };
      const elements = TerminalContainerFactory.createContainer(config);
      container = elements.container;
    });

    it('should set active state correctly', () => {
      TerminalContainerFactory.setActiveState(container, true);

      expect(container.hasAttribute('data-active')).toBe(true);
      expect(container.style.borderStyle).toBe('solid');

      TerminalContainerFactory.setActiveState(container, false);

      expect(container.hasAttribute('data-active')).toBe(false);
      expect(container.style.borderColor).toBe('transparent');
    });

    it('should configure split mode correctly', () => {
      TerminalContainerFactory.configureSplitMode(container, 300);

      expect(container.style.height).toBe('300px');
      expect(container.hasAttribute('data-split')).toBe(true);
    });

    it('should remove from split mode correctly', () => {
      // First configure as split
      TerminalContainerFactory.configureSplitMode(container, 300);

      // Then remove from split
      TerminalContainerFactory.removeFromSplitMode(container);

      expect(container.style.height).toBe('100%');
      expect(container.hasAttribute('data-split')).toBe(false);
    });

    it('should apply theme correctly', () => {
      const theme = {
        background: '#1a1a1a',
        borderColor: '#ff0000',
        activeBorderColor: '#00ff00',
      };

      TerminalContainerFactory.applyTheme(container, theme);

      // Styles are often converted to RGB in DOM mocks
      expect(container.style.background).toMatch(/#1a1a1a|rgb\(26, 26, 26\)/);
      expect(container.style.borderColor).toMatch(/#ff0000|rgb\(255, 0, 0\)/);

      // Set as active and apply theme again
      TerminalContainerFactory.setActiveState(container, true);
      TerminalContainerFactory.applyTheme(container, theme);

      expect(container.style.borderColor).toMatch(/#00ff00|rgb\(0, 255, 0\)/);
    });

    it('should destroy container correctly', () => {
      const parent = document.getElementById('terminal-main-container')!;
      parent.appendChild(container);

      expect(parent.contains(container)).toBe(true);

      TerminalContainerFactory.destroyContainer(container);

      expect(parent.contains(container)).toBe(false);
    });
  });

  describe('createSimpleContainer', () => {
    it('should create lightweight container', () => {
      const container = TerminalContainerFactory.createSimpleContainer(
        'simple-1',
        'Simple Container'
      );

      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('terminal-container-simple');
      expect(container.getAttribute('data-terminal-id')).toBe('simple-1');
      expect(container.getAttribute('data-terminal-name')).toBe('Simple Container');
    });

    it('should have basic styles applied', () => {
      const container = TerminalContainerFactory.createSimpleContainer(
        'simple-2',
        'Simple Container 2'
      );

      expect(container.style.display).toBe('flex');
      expect(container.style.flexDirection).toBe('column');
      expect(container.style.background).toMatch(/#000|rgb\(0, 0, 0\)/);
    });
  });

  describe('error handling', () => {
    it('should handle missing main container gracefully', () => {
      // Remove main container
      const mainContainer = document.getElementById('terminal-main-container');
      if (mainContainer) {
        mainContainer.remove();
      }

      const config: TerminalContainerConfig = {
        id: 'error-test',
        name: 'Error Test',
      };

      // Should not throw
      expect(() => {
        TerminalContainerFactory.createContainer(config);
      }).not.toThrow();
    });

    it('should handle invalid config gracefully', () => {
      const invalidConfig = {
        id: '',
        name: '',
      } as TerminalContainerConfig;

      expect(() => {
        TerminalContainerFactory.createContainer(invalidConfig);
      }).not.toThrow();
    });

    it('should handle null/undefined custom styles', () => {
      const config: TerminalContainerConfig = {
        id: 'null-styles-test',
        name: 'Null Styles Test',
        customStyles: undefined,
      };

      expect(() => {
        TerminalContainerFactory.createContainer(config);
      }).not.toThrow();
    });

    it('should handle destroying non-existent container', () => {
      const orphanContainer = document.createElement('div');

      expect(() => {
        TerminalContainerFactory.destroyContainer(orphanContainer);
      }).not.toThrow();
    });
  });

  describe('DOM integration', () => {
    it('should NOT append container to main container by default (intentionally changed)', () => {
      const config: TerminalContainerConfig = {
        id: 'dom-test',
        name: 'DOM Test',
      };

      const elements = TerminalContainerFactory.createContainer(config);
      const mainContainer = document.getElementById('terminal-main-container')!;

      // Factory no longer appends by default
      expect(mainContainer.contains(elements.container)).toBe(false);
    });

    it('should create proper DOM hierarchy', () => {
      const config: TerminalContainerConfig = {
        id: 'hierarchy-test',
        name: 'Hierarchy Test',
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true,
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      // Check hierarchy: container > header, body
      expect(elements.container.contains(elements.header!)).toBe(true);
      expect(elements.container.contains(elements.body)).toBe(true);
      expect(elements.header!.contains(elements.closeButton!)).toBe(true);

      // Check order: header should come before body
      const children = Array.from(elements.container.children);
      const headerIndex = children.indexOf(elements.header!);
      const bodyIndex = children.indexOf(elements.body);
      expect(headerIndex).toBeLessThan(bodyIndex);
    });
  });
});
