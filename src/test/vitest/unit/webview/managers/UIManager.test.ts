
/**
 * UIManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { UIManager } from '../../../../../webview/managers/UIManager';
import { TerminalTheme } from '../../../../../webview/utils/WebviewThemeUtils';
import { ResizeManager } from '../../../../../webview/utils/ResizeManager';

// Mock dependencies
vi.mock('../../../../../webview/utils/WebviewThemeUtils', async () => {
  const actual = await vi.importActual('../../../../../webview/utils/WebviewThemeUtils');
  return {
    ...actual,
    getWebviewTheme: vi.fn().mockReturnValue({ background: '#1e1e1e', foreground: '#d4d4d4' }),
  };
});

vi.mock('../../../../../webview/factories/HeaderFactory', () => ({
  HeaderFactory: {
    createTerminalHeader: vi.fn().mockImplementation(({ terminalId, terminalName }) => {
      const container = document.createElement('div');
      container.id = `header-${terminalId}`;
      container.className = 'terminal-header';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'terminal-name';
      nameSpan.textContent = terminalName;
      container.appendChild(nameSpan);
      return { container, nameSpan, titleSection: document.createElement('div') };
    }),
    updateTerminalName: vi.fn().mockImplementation((elements, name) => {
      if (elements.nameSpan) elements.nameSpan.textContent = name;
    }),
    insertCliAgentStatus: vi.fn(),
    removeCliAgentStatus: vi.fn(),
    setAiAgentToggleButtonVisibility: vi.fn(),
  },
}));

vi.mock('../../../../../webview/utils/ResizeManager', () => ({
  ResizeManager: {
    observeResize: vi.fn(),
    unobserveResize: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  uiLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    lifecycle: vi.fn(),
  },
}));

describe('UIManager', () => {
  let uiManager: UIManager;
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><div id="terminal-container"></div><div id="terminal-body"></div>', {
      url: 'http://localhost',
    });
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    
    uiManager = new UIManager();
  });

  afterEach(() => {
    uiManager.dispose();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Theme Management', () => {
    it('should update theme and notify tab updater', () => {
      const theme: TerminalTheme = {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: '#333333',
      };
      
      const tabUpdater = vi.fn();
      uiManager.setTabThemeUpdater(tabUpdater);
      
      uiManager.updateTheme(theme);
      
      expect(tabUpdater).toHaveBeenCalledWith(theme);
      expect(uiManager.getCurrentTheme().background).toBe('#000000');
      expect(uiManager.getCurrentTheme().applied).toBe(true);
    });

    it('should apply theme to terminal instance', () => {
      const mockTerminal = {
        options: {},
        refresh: vi.fn(),
        rows: 24,
        element: document.createElement('div')
      } as any;
      
      uiManager.applyTerminalTheme(mockTerminal, {});
      
      expect(mockTerminal.options.theme).toBeDefined();
      expect(mockTerminal.refresh).toHaveBeenCalled();
    });
  });

  describe('Terminal Placeholder', () => {
    it('should show and hide placeholder', () => {
      uiManager.showTerminalPlaceholder();
      let placeholder = document.getElementById('terminal-placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder?.style.display).toBe('flex');

      uiManager.hideTerminalPlaceholder();
      expect(placeholder?.style.display).toBe('none');
    });
  });

  describe('Header Management', () => {
    it('should create and cache terminal header', () => {
      const header = uiManager.createTerminalHeader('term-1', 'Test Terminal');
      
      expect(header).toBeTruthy();
      expect(header.id).toBe('header-term-1');
      expect(uiManager.headerElementsCache.has('term-1')).toBe(true);
    });

    it('should update terminal header title', () => {
      uiManager.createTerminalHeader('term-1', 'Old Name');
      uiManager.updateTerminalHeader('term-1', 'New Name');
      
      const elements = uiManager.headerElementsCache.get('term-1');
      expect(elements?.nameSpan?.textContent).toBe('New Name');
    });

    it('should remove header from cache', () => {
      uiManager.createTerminalHeader('term-1', 'Test');
      uiManager.removeTerminalHeader('term-1');
      expect(uiManager.headerElementsCache.has('term-1')).toBe(false);
    });
  });

  describe('Loading Indicator', () => {
    it('should show and hide loading indicator', () => {
      const indicator = uiManager.showLoadingIndicator('Testing...');
      expect(document.querySelector('.loading-indicator')).toBeTruthy();
      expect(indicator.textContent).toContain('Testing...');

      uiManager.hideLoadingIndicator(indicator);
      expect(document.querySelector('.loading-indicator')).toBeFalsy();
    });

    it('should hide all indicators if none specified', () => {
      uiManager.showLoadingIndicator('1');
      uiManager.showLoadingIndicator('2');
      expect(document.querySelectorAll('.loading-indicator').length).toBe(2);

      uiManager.hideLoadingIndicator();
      expect(document.querySelectorAll('.loading-indicator').length).toBe(0);
    });
  });

  describe('Focus Indicator', () => {
    it('should add focus class and remove it after timeout', async () => {
      vi.useFakeTimers();
      const element = document.createElement('div');
      uiManager.addFocusIndicator(element);
      
      expect(element.classList.contains('focused')).toBe(true);
      
      vi.advanceTimersByTime(300);
      expect(element.classList.contains('focused')).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('Resize Observer', () => {
    it('should setup resize observer', () => {
      const callback = vi.fn();
      const container = document.createElement('div');
      
      uiManager.setupResizeObserver(container, callback);
      
      expect(ResizeManager.observeResize).toHaveBeenCalled();
    });
  });

  describe('Split Separator', () => {
    it('should create horizontal separator', () => {
      const sep = uiManager.createSplitSeparator('horizontal');
      expect(sep.className).toContain('split-separator-horizontal');
      expect(sep.style.height).toBe('4px');
    });

    it('should create vertical separator', () => {
      const sep = uiManager.createSplitSeparator('vertical');
      expect(sep.className).toContain('split-separator-vertical');
      expect(sep.style.width).toBe('4px');
    });
  });

  describe('Disposal', () => {
    it('should clean up resources on dispose', () => {
      uiManager.setupResizeObserver(document.createElement('div'), () => {});

      uiManager.dispose();

      expect(ResizeManager.unobserveResize).toHaveBeenCalled();
      expect(uiManager.headerElementsCache.size).toBe(0);
    });

    it('should handle dispose errors gracefully', () => {
      // Setup: create a resize observer to trigger cleanup
      uiManager.setupResizeObserver(document.createElement('div'), () => {});

      // Force an error scenario
      vi.mocked(ResizeManager.unobserveResize).mockImplementationOnce(() => {
        throw new Error('Cleanup error');
      });

      // Should throw the error
      expect(() => uiManager.dispose()).toThrow('Cleanup error');
    });
  });

  describe('Border Management', () => {
    it('should update terminal borders', () => {
      const container1 = document.createElement('div');
      container1.dataset.terminalId = 'term-1';
      const container2 = document.createElement('div');
      container2.dataset.terminalId = 'term-2';

      const allContainers = new Map<string, HTMLElement>();
      allContainers.set('term-1', container1);
      allContainers.set('term-2', container2);

      // Should not throw
      uiManager.updateTerminalBorders('term-1', allContainers);

      expect(container1.classList.contains('active')).toBe(true);
      expect(container2.classList.contains('inactive')).toBe(true);
    });

    it('should update split terminal borders', () => {
      document.body.innerHTML = `
        <div class="terminal-container" data-terminal-id="term-1"></div>
        <div class="terminal-container" data-terminal-id="term-2"></div>
      `;

      uiManager.updateSplitTerminalBorders('term-2');

      const containers = document.querySelectorAll('.terminal-container');
      expect((containers[0] as HTMLElement).classList.contains('inactive')).toBe(true);
      expect((containers[1] as HTMLElement).classList.contains('active')).toBe(true);
    });

    it('should set active border mode', () => {
      // Should not throw
      uiManager.setActiveBorderMode('always');
      uiManager.setActiveBorderMode('multipleOnly');
      uiManager.setActiveBorderMode('none');
    });

    it('should set terminal count', () => {
      // Should not throw
      uiManager.setTerminalCount(3);
    });

    it('should set fullscreen mode', () => {
      // Should not throw
      uiManager.setFullscreenMode(true);
      uiManager.setFullscreenMode(false);
    });

    it('should update single terminal border', () => {
      const container = document.createElement('div');

      uiManager.updateSingleTerminalBorder(container, true);
      expect(container.classList.contains('active')).toBe(true);

      uiManager.updateSingleTerminalBorder(container, false);
      expect(container.classList.contains('inactive')).toBe(true);
    });
  });

  describe('Visual Settings', () => {
    it('should apply all visual settings', () => {
      const mockTerminal = {
        options: {},
        refresh: vi.fn(),
        rows: 24,
        element: document.createElement('div')
      } as any;

      const settings = {
        theme: 'dark',
        cursor: { style: 'block' as const, blink: true },
        cursorBlink: true,
        scrollback: 1000,
      };

      uiManager.applyAllVisualSettings(mockTerminal, settings);

      expect(mockTerminal.options.cursorStyle).toBe('block');
      expect(mockTerminal.options.cursorBlink).toBe(true);
      expect(mockTerminal.options.scrollback).toBe(1000);
    });

    it('should apply cursor blink from settings.cursorBlink', () => {
      const mockTerminal = {
        options: {},
        refresh: vi.fn(),
        rows: 24,
        element: document.createElement('div')
      } as any;

      uiManager.applyAllVisualSettings(mockTerminal, { cursorBlink: false });

      expect(mockTerminal.options.cursorBlink).toBe(false);
    });

    it('should apply font settings to terminal', () => {
      const mockTerminal = {
        options: {},
      } as any;

      const fontSettings = {
        fontSize: 16,
        fontFamily: 'Consolas',
        fontWeight: 'normal' as const,
        fontWeightBold: 'bold' as const,
        lineHeight: 1.2,
        letterSpacing: 0,
      };

      uiManager.applyFontSettings(mockTerminal, fontSettings);

      expect(mockTerminal.options.fontSize).toBe(16);
      expect(mockTerminal.options.fontFamily).toBe('Consolas');
      expect(mockTerminal.options.fontWeight).toBe('normal');
      expect(mockTerminal.options.fontWeightBold).toBe('bold');
      expect(mockTerminal.options.lineHeight).toBe(1.2);
      expect(mockTerminal.options.letterSpacing).toBe(0);
    });

    it('should apply VS Code styling', () => {
      const container = document.createElement('div');

      uiManager.applyVSCodeStyling(container);

      expect(container.style.fontFamily).toContain('monospace');
      expect(container.style.borderRadius).toBe('4px');
      expect(container.style.padding).toBe('8px');
    });

    it('should apply custom CSS to container', () => {
      const container = document.createElement('div');

      uiManager.applyCustomCSS(container, {
        backgroundColor: '#ff0000',
        color: '#00ff00',
      });

      // JSDOM may keep hex format or convert to rgb - check both
      expect(['#ff0000', 'rgb(255, 0, 0)']).toContain(container.style.backgroundColor);
      expect(['#00ff00', 'rgb(0, 255, 0)']).toContain(container.style.color);
    });
  });

  describe('CLI Agent Status', () => {
    it('should update CLI agent status display', () => {
      // Create a header first
      uiManager.createTerminalHeader('term-1', 'Test Terminal');

      // Should not throw
      uiManager.updateCliAgentStatusDisplay('Test Terminal', 'connected', 'claude');
      uiManager.updateCliAgentStatusDisplay('Test Terminal', 'disconnected', 'copilot');
      uiManager.updateCliAgentStatusDisplay(null, 'none', null);
    });

    it('should update CLI agent status by terminal ID', () => {
      // Create a header first
      uiManager.createTerminalHeader('term-1', 'Test Terminal');

      // Should not throw
      uiManager.updateCliAgentStatusByTerminalId('term-1', 'connected', 'claude');
      uiManager.updateCliAgentStatusByTerminalId('term-1', 'disconnected', null);
      uiManager.updateCliAgentStatusByTerminalId('term-1', 'none', null);
    });

    it('should handle missing header gracefully', () => {
      // Should not throw when header doesn't exist
      uiManager.updateCliAgentStatusByTerminalId('non-existent', 'connected', 'claude');
    });
  });

  describe('Legacy Claude Status', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div data-terminal-id="term-1">
          <div class="terminal-header">
            <span class="terminal-name">Test Terminal</span>
            <div class="terminal-status"></div>
            <div class="terminal-controls">
              <button class="close-btn">X</button>
            </div>
          </div>
        </div>
      `;
    });

    it('should update legacy claude status to active', () => {
      uiManager.updateLegacyClaudeStatus('term-1', true);

      const statusSpan = document.querySelector('.claude-status');
      expect(statusSpan).toBeTruthy();
      expect(statusSpan?.textContent).toBe('CLI Agent Active');
    });

    it('should clear legacy claude status when inactive', () => {
      // First set active
      uiManager.updateLegacyClaudeStatus('term-1', true);
      expect(document.querySelector('.claude-status')).toBeTruthy();

      // Then set inactive - status section is cleared
      uiManager.updateLegacyClaudeStatus('term-1', false);
      const statusSection = document.querySelector('.terminal-status');
      expect(statusSection?.textContent).toBe('');
    });

    it('should handle missing header gracefully', () => {
      document.body.innerHTML = '';
      // Should not throw
      uiManager.updateLegacyClaudeStatus('non-existent', true);
    });

    it('should insert status before controls container', () => {
      uiManager.updateLegacyClaudeStatus('term-1', true);

      const controls = document.querySelector('.terminal-controls');
      const status = document.querySelector('.claude-status');

      // Status should be before controls
      expect(status?.nextElementSibling).toBe(controls);
    });
  });

  describe('Notification', () => {
    it('should create notification element', () => {
      const notification = uiManager.createNotificationElement({
        message: 'Test message',
        type: 'info',
      });

      expect(notification).toBeTruthy();
      expect(notification.textContent).toContain('Test message');
    });

    it('should ensure animations are loaded', () => {
      // Should not throw
      uiManager.ensureAnimationsLoaded();
    });
  });

  describe('Header Utilities', () => {
    it('should find terminal headers', () => {
      document.body.innerHTML = `
        <div class="terminal-header">Header 1</div>
        <div class="terminal-header">Header 2</div>
        <div class="other-element">Not a header</div>
      `;

      const headers = uiManager.findTerminalHeaders();

      expect(headers).toHaveLength(2);
      expect(headers[0].textContent).toBe('Header 1');
      expect(headers[1].textContent).toBe('Header 2');
    });

    it('should return empty array when no headers exist', () => {
      document.body.innerHTML = '<div>No headers here</div>';

      const headers = uiManager.findTerminalHeaders();

      expect(headers).toHaveLength(0);
    });

    it('should clear header cache', () => {
      uiManager.createTerminalHeader('term-1', 'Test');
      expect(uiManager.headerElementsCache.size).toBe(1);

      uiManager.clearHeaderCache();

      expect(uiManager.headerElementsCache.size).toBe(0);
    });
  });

  describe('Theme Updates', () => {
    it('should update theme and notify tab updater', () => {
      const tabUpdater = vi.fn();
      uiManager.setTabThemeUpdater(tabUpdater);

      const theme: TerminalTheme = {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      };

      uiManager.updateTheme(theme);

      expect(tabUpdater).toHaveBeenCalledWith(theme);
    });

    it('should update header themes when theme changes', () => {
      // Create some headers first
      uiManager.createTerminalHeader('term-1', 'Terminal 1');
      uiManager.createTerminalHeader('term-2', 'Terminal 2');

      const theme: TerminalTheme = {
        background: '#ffffff',
        foreground: '#000000',
      };

      // Should not throw
      uiManager.updateTheme(theme);

      // Headers should have been updated (background color set)
      const headers = Array.from(uiManager.headerElementsCache.values());
      expect(headers.length).toBe(2);
    });
  });
});
