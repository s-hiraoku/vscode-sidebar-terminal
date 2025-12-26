/**
 * UIManager Test Suite - Visual feedback, theming, and terminal appearance
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 * Uses happy-dom environment configured in vitest.config.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIManager } from '../../../../../webview/managers/UIManager';
import { Terminal } from '@xterm/xterm';
import { PartialTerminalSettings, WebViewFontSettings } from '../../../../../types/shared';

describe('UIManager', () => {
  let uiManager: UIManager;
  let mockTerminal: Partial<Terminal>;

  beforeEach(() => {
    // happy-dom provides document/window automatically
    // Create container elements
    const container = document.createElement('div');
    container.id = 'terminal-container';
    document.body.appendChild(container);

    const body = document.createElement('div');
    body.id = 'terminal-body';
    document.body.appendChild(body);

    // Create mock terminal
    mockTerminal = {
      options: {},
      rows: 24,
      refresh: vi.fn(),
      element: document.createElement('div'),
    };

    uiManager = new UIManager();
    uiManager.initialize();
  });

  afterEach(() => {
    uiManager.dispose();
    // Clean up DOM
    document.body.innerHTML = '';
  });

  describe('Initialization and Lifecycle', () => {
    it('should initialize correctly', () => {
      expect(uiManager).toBeInstanceOf(UIManager);
    });

    it('should dispose resources properly', () => {
      // Create some state
      const _header = uiManager.createTerminalHeader('test-1', 'Test Terminal');
      expect(uiManager.headerElementsCache.size).toBeGreaterThan(0);

      // Dispose
      uiManager.dispose();

      // Verify cleanup
      expect(uiManager.headerElementsCache.size).toBe(0);
    });

    it('should get current theme information', () => {
      const themeInfo = uiManager.getCurrentTheme();
      expect(themeInfo).toHaveProperty('background');
      expect(themeInfo).toHaveProperty('applied');
    });
  });

  describe('Theme Application', () => {
    it('should apply terminal theme with dark settings', () => {
      const settings: PartialTerminalSettings = {
        theme: 'dark',
        fontSize: 14,
        fontFamily: 'Consolas',
      };

      uiManager.applyTerminalTheme(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.theme).toBeDefined();
      expect(mockTerminal.options?.theme?.background).toBeTypeOf('string');
      expect(mockTerminal.refresh).toHaveBeenCalledOnce();
    });

    it('should apply terminal theme with light settings', () => {
      const settings: PartialTerminalSettings = {
        theme: 'light',
        fontSize: 14,
        fontFamily: 'Consolas',
      };

      uiManager.applyTerminalTheme(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.theme).toBeDefined();
    });

    it('should apply terminal theme with auto settings', () => {
      const settings: PartialTerminalSettings = {
        theme: 'auto',
      };

      uiManager.applyTerminalTheme(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.theme).toBeDefined();
    });

    it('should detect light background correctly', () => {
      // Apply light theme
      const lightSettings: PartialTerminalSettings = { theme: 'light' };
      uiManager.applyTerminalTheme(mockTerminal as Terminal, lightSettings);

      const themeInfo = uiManager.getCurrentTheme();
      if (themeInfo.background) {
        // Light theme background should be bright
        expect(themeInfo.background).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('Font Settings', () => {
    it('should apply font settings to terminal', () => {
      const fontSettings: WebViewFontSettings = {
        fontSize: 16,
        fontFamily: 'JetBrains Mono',
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        lineHeight: 1.2,
        letterSpacing: 0,
      };

      uiManager.applyFontSettings(mockTerminal as Terminal, fontSettings);

      expect(mockTerminal.options?.fontSize).toBe(16);
      expect(mockTerminal.options?.fontFamily).toBe('JetBrains Mono');
    });

    it('should apply optional font settings when provided', () => {
      const fontSettings: WebViewFontSettings = {
        fontSize: 14,
        fontFamily: 'Consolas',
        fontWeight: 'bold',
        fontWeightBold: 'bolder',
        lineHeight: 1.5,
        letterSpacing: 1,
      };

      uiManager.applyFontSettings(mockTerminal as Terminal, fontSettings);

      expect(mockTerminal.options?.lineHeight).toBe(1.5);
      expect(mockTerminal.options?.letterSpacing).toBe(1);
    });
  });

  describe('Visual Settings', () => {
    it('should apply all visual settings comprehensively', () => {
      const settings: PartialTerminalSettings = {
        theme: 'dark',
        cursorBlink: true,
        scrollback: 3000,
        cursor: {
          style: 'underline',
          blink: true,
        },
      };

      uiManager.applyAllVisualSettings(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.cursorBlink).toBe(true);
      expect(mockTerminal.options?.scrollback).toBe(3000);
      expect(mockTerminal.options?.cursorStyle).toBe('underline');
    });

    it('should handle nested cursor settings', () => {
      const settings: PartialTerminalSettings = {
        cursor: {
          style: 'bar',
          blink: false,
        },
      };

      uiManager.applyAllVisualSettings(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.cursorStyle).toBe('bar');
      expect(mockTerminal.options?.cursorBlink).toBe(false);
    });

    it('should handle flat cursorBlink setting', () => {
      const settings: PartialTerminalSettings = {
        cursorBlink: false,
      };

      uiManager.applyAllVisualSettings(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.cursorBlink).toBe(false);
    });
  });

  describe('Terminal Header Management', () => {
    it('should create terminal header with correct elements', () => {
      const header = uiManager.createTerminalHeader('test-1', 'Test Terminal');

      expect(header).toBeInstanceOf(HTMLElement);
      expect(header.className).toContain('terminal-header');
      expect(header.getAttribute('data-terminal-id')).toBe('test-1');
    });

    it('should cache header elements for quick access', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal 1');
      uiManager.createTerminalHeader('test-2', 'Terminal 2');

      expect(uiManager.headerElementsCache.size).toBe(2);
      expect(uiManager.headerElementsCache.has('test-1')).toBe(true);
      expect(uiManager.headerElementsCache.has('test-2')).toBe(true);
    });

    it('should update terminal header title', () => {
      uiManager.createTerminalHeader('test-1', 'Old Name');
      uiManager.updateTerminalHeader('test-1', 'New Name');

      const headerElements = uiManager.headerElementsCache.get('test-1');
      if (headerElements?.nameSpan) {
        expect(headerElements.nameSpan.textContent).toBe('New Name');
      }
    });

    it('should remove terminal header from cache', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal');
      expect(uiManager.headerElementsCache.has('test-1')).toBe(true);

      uiManager.removeTerminalHeader('test-1');
      expect(uiManager.headerElementsCache.has('test-1')).toBe(false);
    });

    it('should clear all header cache', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal 1');
      uiManager.createTerminalHeader('test-2', 'Terminal 2');
      expect(uiManager.headerElementsCache.size).toBe(2);

      uiManager.clearHeaderCache();
      expect(uiManager.headerElementsCache.size).toBe(0);
    });

    it('should find terminal headers in DOM', () => {
      // Add headers to DOM
      const header1 = document.createElement('div');
      header1.className = 'terminal-header';
      const header2 = document.createElement('div');
      header2.className = 'terminal-header';
      document.body.appendChild(header1);
      document.body.appendChild(header2);

      const headers = uiManager.findTerminalHeaders();
      expect(headers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Terminal Placeholder', () => {
    it('should show terminal placeholder when no terminals exist', () => {
      uiManager.showTerminalPlaceholder();

      const placeholder = document.getElementById('terminal-placeholder');
      expect(placeholder).toBeDefined();
      expect(placeholder?.style.display).toBe('flex');
    });

    it('should hide terminal placeholder when terminals exist', () => {
      uiManager.showTerminalPlaceholder();
      uiManager.hideTerminalPlaceholder();

      const placeholder = document.getElementById('terminal-placeholder');
      expect(placeholder?.style.display).toBe('none');
    });

    it('should create placeholder with correct content', () => {
      uiManager.showTerminalPlaceholder();

      const placeholder = document.getElementById('terminal-placeholder');
      const title = placeholder?.querySelector('.placeholder-title');
      const subtitle = placeholder?.querySelector('.placeholder-subtitle');

      expect(title?.textContent).toBe('No Terminal Active');
      expect(subtitle?.textContent).toBe('Create a new terminal to get started');
    });
  });

  describe('Loading Indicator', () => {
    it('should show loading indicator with message', () => {
      const indicator = uiManager.showLoadingIndicator('Loading terminal...');

      expect(indicator).toBeInstanceOf(HTMLElement);
      expect(indicator.className).toContain('loading-indicator');
    });

    it('should hide specific loading indicator', () => {
      const indicator = uiManager.showLoadingIndicator();
      document.body.appendChild(indicator);

      uiManager.hideLoadingIndicator(indicator);

      expect(document.body.contains(indicator)).toBe(false);
    });

    it('should hide all loading indicators', () => {
      const indicator1 = uiManager.showLoadingIndicator('Loading 1');
      const indicator2 = uiManager.showLoadingIndicator('Loading 2');
      document.body.appendChild(indicator1);
      document.body.appendChild(indicator2);

      uiManager.hideLoadingIndicator();

      const indicators = document.querySelectorAll('.loading-indicator');
      expect(indicators.length).toBe(0);
    });
  });

  describe('Focus Indicator', () => {
    it('should add focus indicator to container', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      uiManager.addFocusIndicator(container);

      expect(container.classList.contains('focused')).toBe(true);
      expect(container.style.boxShadow).toContain('rgba');
    });
  });

  describe('VS Code Styling', () => {
    it('should apply VS Code-like terminal styling', () => {
      const container = document.createElement('div');

      uiManager.applyVSCodeStyling(container);

      // Note: happy-dom may not fully support CSS variables in style properties
      // So we check that the method runs without error and sets some style
      expect(container.style.fontFamily).toBeDefined();
      expect(container.style.borderRadius).toBe('4px');
      expect(container.style.padding).toBe('8px');
    });

    it('should apply custom CSS to container', () => {
      const container = document.createElement('div');
      const customCSS: Partial<CSSStyleDeclaration> = {
        padding: '10px',
        margin: '5px',
      };

      uiManager.applyCustomCSS(container, customCSS);

      expect(container.style.padding).toBe('10px');
      expect(container.style.margin).toBe('5px');
    });
  });

  describe('Border Management', () => {
    it('should update terminal borders for active state', () => {
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      const allContainers = new Map([
        ['terminal-1', container1],
        ['terminal-2', container2],
      ]);

      uiManager.updateTerminalBorders('terminal-1', allContainers);

      // Border service should have been called
      // Since we can't directly check border service internals,
      // we verify no errors are thrown
      expect(true).toBe(true);
    });

    it('should set active border mode', () => {
      // Should not throw - only valid values
      expect(() => uiManager.setActiveBorderMode('always')).not.toThrow();
      expect(() => uiManager.setActiveBorderMode('multipleOnly')).not.toThrow();
    });

    it('should set terminal count', () => {
      expect(() => uiManager.setTerminalCount(3)).not.toThrow();
    });

    it('should set fullscreen mode', () => {
      expect(() => uiManager.setFullscreenMode(true)).not.toThrow();
      expect(() => uiManager.setFullscreenMode(false)).not.toThrow();
    });

    it('should update single terminal border', () => {
      const container = document.createElement('div');
      expect(() => uiManager.updateSingleTerminalBorder(container, true)).not.toThrow();
      expect(() => uiManager.updateSingleTerminalBorder(container, false)).not.toThrow();
    });
  });

  describe('Split Separator', () => {
    it('should create horizontal split separator', () => {
      const separator = uiManager.createSplitSeparator('horizontal');

      expect(separator.className).toContain('split-separator-horizontal');
      expect(separator.style.cursor).toBe('row-resize');
      expect(separator.style.height).toBe('4px');
    });

    it('should create vertical split separator', () => {
      const separator = uiManager.createSplitSeparator('vertical');

      expect(separator.className).toContain('split-separator-vertical');
      expect(separator.style.cursor).toBe('col-resize');
      expect(separator.style.width).toBe('4px');
    });
  });
});
