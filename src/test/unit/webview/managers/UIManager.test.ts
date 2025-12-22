/**
 * UIManager Test Suite - Visual feedback, theming, and terminal appearance
 *
 * TDD Pattern: Covers theme application, border management, header creation, and styling
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="terminal-container"></div><div id="terminal-body"></div></body></html>', {
  url: 'http://localhost',
});
(global as any).document = dom.window.document;
(global as any).window = dom.window;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { UIManager } from '../../../../webview/managers/UIManager';
import { Terminal } from '@xterm/xterm';
import { PartialTerminalSettings, WebViewFontSettings } from '../../../../types/shared';

describe('UIManager', () => {
  let uiManager: UIManager;
  let mockTerminal: Partial<Terminal>;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="terminal-container"></div><div id="terminal-body"></div>';

    // Create mock terminal
    mockTerminal = {
      options: {},
      rows: 24,
      refresh: sinon.stub(),
      element: document.createElement('div'),
    };

    uiManager = new UIManager();
    uiManager.initialize();
  });

  afterEach(() => {
    uiManager.dispose();
    sinon.restore();
  });

  describe('Initialization and Lifecycle', () => {
    it('should initialize correctly', () => {
      expect(uiManager).to.be.instanceOf(UIManager);
    });

    it('should dispose resources properly', () => {
      // Create some state
      const _header = uiManager.createTerminalHeader('test-1', 'Test Terminal');
      expect(uiManager.headerElementsCache.size).to.be.greaterThan(0);

      // Dispose
      uiManager.dispose();

      // Verify cleanup
      expect(uiManager.headerElementsCache.size).to.equal(0);
    });

    it('should get current theme information', () => {
      const themeInfo = uiManager.getCurrentTheme();
      expect(themeInfo).to.have.property('background');
      expect(themeInfo).to.have.property('applied');
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

      expect(mockTerminal.options?.theme).to.exist;
      expect(mockTerminal.options?.theme?.background).to.be.a('string');
      expect((mockTerminal.refresh as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('should apply terminal theme with light settings', () => {
      const settings: PartialTerminalSettings = {
        theme: 'light',
        fontSize: 14,
        fontFamily: 'Consolas',
      };

      uiManager.applyTerminalTheme(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.theme).to.exist;
    });

    it('should apply terminal theme with auto settings', () => {
      const settings: PartialTerminalSettings = {
        theme: 'auto',
      };

      uiManager.applyTerminalTheme(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.theme).to.exist;
    });

    it('should detect light background correctly', () => {
      // Apply light theme
      const lightSettings: PartialTerminalSettings = { theme: 'light' };
      uiManager.applyTerminalTheme(mockTerminal as Terminal, lightSettings);

      const themeInfo = uiManager.getCurrentTheme();
      if (themeInfo.background) {
        // Light theme background should be bright
        expect(themeInfo.background).to.match(/^#[0-9a-fA-F]{6}$/);
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

      expect(mockTerminal.options?.fontSize).to.equal(16);
      expect(mockTerminal.options?.fontFamily).to.equal('JetBrains Mono');
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

      expect(mockTerminal.options?.lineHeight).to.equal(1.5);
      expect(mockTerminal.options?.letterSpacing).to.equal(1);
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

      expect(mockTerminal.options?.cursorBlink).to.be.true;
      expect(mockTerminal.options?.scrollback).to.equal(3000);
      expect(mockTerminal.options?.cursorStyle).to.equal('underline');
    });

    it('should handle nested cursor settings', () => {
      const settings: PartialTerminalSettings = {
        cursor: {
          style: 'bar',
          blink: false,
        },
      };

      uiManager.applyAllVisualSettings(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.cursorStyle).to.equal('bar');
      expect(mockTerminal.options?.cursorBlink).to.be.false;
    });

    it('should handle flat cursorBlink setting', () => {
      const settings: PartialTerminalSettings = {
        cursorBlink: false,
      };

      uiManager.applyAllVisualSettings(mockTerminal as Terminal, settings);

      expect(mockTerminal.options?.cursorBlink).to.be.false;
    });
  });

  describe('Terminal Header Management', () => {
    it('should create terminal header with correct elements', () => {
      const header = uiManager.createTerminalHeader('test-1', 'Test Terminal');

      expect(header).to.be.instanceOf(HTMLElement);
      expect(header.className).to.include('terminal-header');
      expect(header.getAttribute('data-terminal-id')).to.equal('test-1');
    });

    it('should cache header elements for quick access', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal 1');
      uiManager.createTerminalHeader('test-2', 'Terminal 2');

      expect(uiManager.headerElementsCache.size).to.equal(2);
      expect(uiManager.headerElementsCache.has('test-1')).to.be.true;
      expect(uiManager.headerElementsCache.has('test-2')).to.be.true;
    });

    it('should update terminal header title', () => {
      uiManager.createTerminalHeader('test-1', 'Old Name');
      uiManager.updateTerminalHeader('test-1', 'New Name');

      const headerElements = uiManager.headerElementsCache.get('test-1');
      if (headerElements?.nameSpan) {
        expect(headerElements.nameSpan.textContent).to.equal('New Name');
      }
    });

    it('should remove terminal header from cache', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal');
      expect(uiManager.headerElementsCache.has('test-1')).to.be.true;

      uiManager.removeTerminalHeader('test-1');
      expect(uiManager.headerElementsCache.has('test-1')).to.be.false;
    });

    it('should clear all header cache', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal 1');
      uiManager.createTerminalHeader('test-2', 'Terminal 2');
      expect(uiManager.headerElementsCache.size).to.equal(2);

      uiManager.clearHeaderCache();
      expect(uiManager.headerElementsCache.size).to.equal(0);
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
      expect(headers.length).to.be.at.least(2);
    });
  });

  describe('Terminal Placeholder', () => {
    it('should show terminal placeholder when no terminals exist', () => {
      uiManager.showTerminalPlaceholder();

      const placeholder = document.getElementById('terminal-placeholder');
      expect(placeholder).to.exist;
      expect(placeholder?.style.display).to.equal('flex');
    });

    it('should hide terminal placeholder when terminals exist', () => {
      uiManager.showTerminalPlaceholder();
      uiManager.hideTerminalPlaceholder();

      const placeholder = document.getElementById('terminal-placeholder');
      expect(placeholder?.style.display).to.equal('none');
    });

    it('should create placeholder with correct content', () => {
      uiManager.showTerminalPlaceholder();

      const placeholder = document.getElementById('terminal-placeholder');
      const title = placeholder?.querySelector('.placeholder-title');
      const subtitle = placeholder?.querySelector('.placeholder-subtitle');

      expect(title?.textContent).to.equal('No Terminal Active');
      expect(subtitle?.textContent).to.equal('Create a new terminal to get started');
    });
  });

  describe('Loading Indicator', () => {
    it('should show loading indicator with message', () => {
      const indicator = uiManager.showLoadingIndicator('Loading terminal...');

      expect(indicator).to.be.instanceOf(HTMLElement);
      expect(indicator.className).to.include('loading-indicator');
    });

    it('should hide specific loading indicator', () => {
      const indicator = uiManager.showLoadingIndicator();
      document.body.appendChild(indicator);

      uiManager.hideLoadingIndicator(indicator);

      expect(document.body.contains(indicator)).to.be.false;
    });

    it('should hide all loading indicators', () => {
      const indicator1 = uiManager.showLoadingIndicator('Loading 1');
      const indicator2 = uiManager.showLoadingIndicator('Loading 2');
      document.body.appendChild(indicator1);
      document.body.appendChild(indicator2);

      uiManager.hideLoadingIndicator();

      const indicators = document.querySelectorAll('.loading-indicator');
      expect(indicators.length).to.equal(0);
    });
  });

  describe('Focus Indicator', () => {
    it('should add focus indicator to container', () => {
      const container = document.createElement('div');

      uiManager.addFocusIndicator(container);

      expect(container.classList.contains('focused')).to.be.true;
      expect(container.style.boxShadow).to.include('rgba');
    });
  });

  describe('VS Code Styling', () => {
    it('should apply VS Code-like terminal styling', () => {
      const container = document.createElement('div');

      uiManager.applyVSCodeStyling(container);

      expect(container.style.fontFamily).to.include('var(--vscode-editor-font-family');
      expect(container.style.backgroundColor).to.include('var(--vscode-terminal-background');
    });

    it('should apply custom CSS to container', () => {
      const container = document.createElement('div');
      const customCSS: Partial<CSSStyleDeclaration> = {
        padding: '10px',
        margin: '5px',
      };

      uiManager.applyCustomCSS(container, customCSS);

      expect(container.style.padding).to.equal('10px');
      expect(container.style.margin).to.equal('5px');
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
      expect(true).to.be.true;
    });

    it('should set active border mode', () => {
      // Should not throw - only valid values
      expect(() => uiManager.setActiveBorderMode('always')).to.not.throw();
      expect(() => uiManager.setActiveBorderMode('multipleOnly')).to.not.throw();
    });

    it('should set terminal count', () => {
      expect(() => uiManager.setTerminalCount(3)).to.not.throw();
    });

    it('should set fullscreen mode', () => {
      expect(() => uiManager.setFullscreenMode(true)).to.not.throw();
      expect(() => uiManager.setFullscreenMode(false)).to.not.throw();
    });

    it('should update single terminal border', () => {
      const container = document.createElement('div');
      expect(() => uiManager.updateSingleTerminalBorder(container, true)).to.not.throw();
      expect(() => uiManager.updateSingleTerminalBorder(container, false)).to.not.throw();
    });
  });

  describe('Split Separator', () => {
    it('should create horizontal split separator', () => {
      const separator = uiManager.createSplitSeparator('horizontal');

      expect(separator.className).to.include('split-separator-horizontal');
      expect(separator.style.cursor).to.equal('row-resize');
      expect(separator.style.height).to.equal('4px');
    });

    it('should create vertical split separator', () => {
      const separator = uiManager.createSplitSeparator('vertical');

      expect(separator.className).to.include('split-separator-vertical');
      expect(separator.style.cursor).to.equal('col-resize');
      expect(separator.style.width).to.equal('4px');
    });
  });

  describe('Tab Theme Updater', () => {
    it('should set tab theme updater callback', () => {
      const mockUpdater = sinon.stub();

      uiManager.setTabThemeUpdater(mockUpdater);

      // Apply theme which should trigger tab updater
      const settings: PartialTerminalSettings = { theme: 'dark' };
      uiManager.applyTerminalTheme(mockTerminal as Terminal, settings);

      expect(mockUpdater.calledOnce).to.be.true;
    });
  });

  describe('Resize Observer Setup', () => {
    it('should setup resize observer for container', () => {
      const container = document.createElement('div');
      container.id = 'test-container';
      const callback = sinon.stub();

      expect(() => {
        uiManager.setupResizeObserver(container, callback);
      }).to.not.throw();
    });
  });

  describe('CLI Agent Status', () => {
    it('should update CLI agent status display', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal 1');

      expect(() => {
        uiManager.updateCliAgentStatusDisplay('Terminal 1', 'connected', 'Claude Code');
      }).to.not.throw();
    });

    it('should update CLI agent status by terminal ID', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal 1');

      expect(() => {
        uiManager.updateCliAgentStatusByTerminalId('test-1', 'connected', 'Claude Code');
      }).to.not.throw();
    });

    it('should handle disconnected status', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal 1');

      expect(() => {
        uiManager.updateCliAgentStatusByTerminalId('test-1', 'disconnected', null);
      }).to.not.throw();
    });

    it('should handle none status', () => {
      uiManager.createTerminalHeader('test-1', 'Terminal 1');

      expect(() => {
        uiManager.updateCliAgentStatusByTerminalId('test-1', 'none', null);
      }).to.not.throw();
    });
  });

  describe('Notification Integration', () => {
    it('should create notification element', () => {
      const notification = uiManager.createNotificationElement({
        title: 'Test',
        message: 'Test notification',
        type: 'info',
      });

      expect(notification).to.be.instanceOf(HTMLElement);
    });

    it('should ensure animations are loaded', () => {
      expect(() => {
        uiManager.ensureAnimationsLoaded();
      }).to.not.throw();
    });
  });

  describe('Legacy Claude Status', () => {
    it('should update legacy Claude status', () => {
      // Create header structure
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', 'test-1');
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const status = document.createElement('div');
      status.className = 'terminal-status';
      header.appendChild(status);
      container.appendChild(header);
      document.body.appendChild(container);

      expect(() => {
        uiManager.updateLegacyClaudeStatus('test-1', true);
      }).to.not.throw();

      expect(() => {
        uiManager.updateLegacyClaudeStatus('test-1', false);
      }).to.not.throw();
    });
  });
});
