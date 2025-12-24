/**
 * TerminalBorderService Test Suite - Border styling and active state management
 *
 * TDD Pattern: Covers border updates, mode handling, and theme integration
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { TerminalBorderService } from '../../../../../../webview/managers/ui/TerminalBorderService';

describe('TerminalBorderService', () => {
  let borderService: TerminalBorderService;
  let dom: JSDOM;

  beforeEach(() => {
    // CRITICAL: Create JSDOM in beforeEach to prevent test pollution
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="terminal-body"></div></body></html>', {
      url: 'http://localhost',
    });

    // Set up global DOM
    (global as any).document = dom.window.document;
    (global as any).window = dom.window;
    (global as any).HTMLElement = dom.window.HTMLElement;

    borderService = new TerminalBorderService();
  });

  afterEach(() => {
    // CRITICAL: Use try-finally to ensure all cleanup happens
    try {
      vi.restoreAllMocks();
    } finally {
      try {
        // CRITICAL: Close JSDOM window to prevent memory leaks
        dom.window.close();
      } finally {
        // CRITICAL: Clean up global DOM state to prevent test pollution
        delete (global as any).document;
        delete (global as any).window;
        delete (global as any).HTMLElement;
      }
    }
  });

  describe('Initialization', () => {
    it('should create instance correctly', () => {
      expect(borderService).toBeInstanceOf(TerminalBorderService);
    });

    it('should default to multipleOnly mode', () => {
      expect(borderService.getActiveBorderMode()).toBe('multipleOnly');
    });
  });

  describe('Border Mode Management', () => {
    it('should set active border mode to always', () => {
      borderService.setActiveBorderMode('always');
      expect(borderService.getActiveBorderMode()).toBe('always');
    });

    it('should set active border mode to none', () => {
      borderService.setActiveBorderMode('none');
      expect(borderService.getActiveBorderMode()).toBe('none');
    });

    it('should set active border mode to multipleOnly', () => {
      borderService.setActiveBorderMode('always');
      borderService.setActiveBorderMode('multipleOnly');
      expect(borderService.getActiveBorderMode()).toBe('multipleOnly');
    });
  });

  describe('Single Terminal Border Update', () => {
    it('should add active class when terminal is active', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setTerminalCount(2);
      borderService.setActiveBorderMode('always');
      borderService.updateSingleTerminalBorder(container, true);

      expect(container.classList.contains('active')).toBe(true);
      expect(container.classList.contains('inactive')).toBe(false);
    });

    it('should add inactive class when terminal is not active', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.updateSingleTerminalBorder(container, false);

      expect(container.classList.contains('active')).toBe(false);
      expect(container.classList.contains('inactive')).toBe(true);
    });

    it('should set border width and style', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.updateSingleTerminalBorder(container, true);

      expect(container.style.borderWidth).toBe('2px');
      expect(container.style.borderStyle).toBe('solid');
    });

    it('should set border radius', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.updateSingleTerminalBorder(container, true);

      expect(container.style.borderRadius).toBe('4px');
    });

    it('should set z-index higher for active container', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setActiveBorderMode('always');
      borderService.updateSingleTerminalBorder(container, true);

      expect(container.style.zIndex).toBe('2');
    });

    it('should set lower z-index for inactive container', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.updateSingleTerminalBorder(container, false);

      expect(container.style.zIndex).toBe('1');
    });
  });

  describe('Multiple Terminals Border Update', () => {
    it('should update borders for all containers', () => {
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      const container2 = document.createElement('div');
      container2.className = 'terminal-container';

      const allContainers = new Map([
        ['terminal-1', container1],
        ['terminal-2', container2],
      ]);

      borderService.setActiveBorderMode('always');
      borderService.updateTerminalBorders('terminal-1', allContainers);

      expect(container1.classList.contains('active')).toBe(true);
      expect(container2.classList.contains('inactive')).toBe(true);
    });

    it('should handle missing active container gracefully', () => {
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';

      const allContainers = new Map([['terminal-1', container1]]);

      // Should not throw
      expect(() => {
        borderService.updateTerminalBorders('nonexistent', allContainers);
      }).not.toThrow();
    });

    it('should reset terminal-body border', () => {
      const terminalBody = document.getElementById('terminal-body') as HTMLElement;
      terminalBody.style.borderColor = 'red';
      terminalBody.classList.add('active');

      const container = document.createElement('div');
      const allContainers = new Map([['terminal-1', container]]);

      borderService.updateTerminalBorders('terminal-1', allContainers);

      expect(terminalBody.style.borderColor).toBe('transparent');
      expect(terminalBody.classList.contains('active')).toBe(false);
    });
  });

  describe('Split Terminal Borders', () => {
    it('should update borders for split terminals in DOM', () => {
      // Create containers in DOM
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      container1.dataset.terminalId = 'terminal-1';

      const container2 = document.createElement('div');
      container2.className = 'terminal-container';
      container2.dataset.terminalId = 'terminal-2';

      document.body.appendChild(container1);
      document.body.appendChild(container2);

      borderService.setActiveBorderMode('always');
      borderService.updateSplitTerminalBorders('terminal-1');

      expect(container1.classList.contains('active')).toBe(true);
      expect(container2.classList.contains('inactive')).toBe(true);

      // Cleanup
      container1.remove();
      container2.remove();
    });
  });

  describe('Border Mode - Always', () => {
    it('should show active border when mode is always', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setActiveBorderMode('always');
      borderService.updateSingleTerminalBorder(container, true);

      expect(container.classList.contains('no-highlight-border')).toBe(false);
      expect(container.style.borderColor).not.toBe('transparent');
    });
  });

  describe('Border Mode - None', () => {
    it('should hide active border when mode is none', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setActiveBorderMode('none');
      borderService.updateSingleTerminalBorder(container, true);

      expect(container.classList.contains('no-highlight-border')).toBe(true);
    });
  });

  describe('Border Mode - MultipleOnly', () => {
    it('should hide border when only one terminal exists', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setActiveBorderMode('multipleOnly');
      borderService.setTerminalCount(1);
      borderService.updateSingleTerminalBorder(container, true);

      expect(container.classList.contains('no-highlight-border')).toBe(true);
    });

    it('should show border when multiple terminals exist', () => {
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      container1.dataset.terminalId = 'terminal-1';
      const container2 = document.createElement('div');
      container2.className = 'terminal-container';
      container2.dataset.terminalId = 'terminal-2';

      document.body.appendChild(container1);
      document.body.appendChild(container2);

      borderService.setActiveBorderMode('multipleOnly');
      borderService.setTerminalCount(2);
      borderService.updateSingleTerminalBorder(container1, true);

      expect(container1.classList.contains('no-highlight-border')).toBe(false);

      // Cleanup
      container1.remove();
      container2.remove();
    });

    it('should hide border when in fullscreen mode', () => {
      // Add containers to DOM first
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      container1.dataset.terminalId = 'terminal-1';
      const container2 = document.createElement('div');
      container2.className = 'terminal-container';
      container2.dataset.terminalId = 'terminal-2';
      document.body.appendChild(container1);
      document.body.appendChild(container2);

      borderService.setActiveBorderMode('multipleOnly');
      borderService.setTerminalCount(3);
      borderService.setFullscreenMode(true);
      borderService.updateSingleTerminalBorder(container1, true);

      expect(container1.classList.contains('no-highlight-border')).toBe(true);

      // Cleanup
      container1.remove();
      container2.remove();
    });

    it('should show border when not in fullscreen with multiple terminals', () => {
      // Add containers to DOM first
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      container1.dataset.terminalId = 'terminal-1';
      const container2 = document.createElement('div');
      container2.className = 'terminal-container';
      container2.dataset.terminalId = 'terminal-2';
      document.body.appendChild(container1);
      document.body.appendChild(container2);

      borderService.setActiveBorderMode('multipleOnly');
      borderService.setTerminalCount(3);
      borderService.setFullscreenMode(false);
      borderService.updateSingleTerminalBorder(container1, true);

      expect(container1.classList.contains('no-highlight-border')).toBe(false);

      // Cleanup
      container1.remove();
      container2.remove();
    });
  });

  describe('Terminal Count Management', () => {
    it('should update terminal count', () => {
      // Create containers in DOM to test refresh
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      container1.dataset.terminalId = 'terminal-1';
      document.body.appendChild(container1);

      borderService.setTerminalCount(5);

      // Should not throw
      expect(() => borderService.setTerminalCount(3)).not.toThrow();

      // Cleanup
      container1.remove();
    });
  });

  describe('Fullscreen Mode', () => {
    it('should set fullscreen mode', () => {
      expect(() => borderService.setFullscreenMode(true)).not.toThrow();
      expect(() => borderService.setFullscreenMode(false)).not.toThrow();
    });

    it('should affect multipleOnly border visibility', () => {
      // Add multiple containers to DOM so count is preserved
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      container1.dataset.terminalId = 'terminal-1';
      const container2 = document.createElement('div');
      container2.className = 'terminal-container';
      container2.dataset.terminalId = 'terminal-2';
      const container3 = document.createElement('div');
      container3.className = 'terminal-container';
      container3.dataset.terminalId = 'terminal-3';

      document.body.appendChild(container1);
      document.body.appendChild(container2);
      document.body.appendChild(container3);

      borderService.setActiveBorderMode('multipleOnly');

      // Before fullscreen - should show (3 terminals)
      borderService.setFullscreenMode(false);
      borderService.updateSingleTerminalBorder(container1, true);
      expect(container1.classList.contains('no-highlight-border')).toBe(false);

      // After fullscreen - should hide
      borderService.setFullscreenMode(true);
      borderService.updateSingleTerminalBorder(container1, true);
      expect(container1.classList.contains('no-highlight-border')).toBe(true);

      // Cleanup
      container1.remove();
      container2.remove();
      container3.remove();
    });
  });

  describe('Theme Integration', () => {
    it('should set light theme mode', () => {
      expect(() => borderService.setLightTheme(true)).not.toThrow();
      expect(() => borderService.setLightTheme(false)).not.toThrow();
    });

    it('should use gray border for inactive terminals in light theme', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setLightTheme(true);
      borderService.updateSingleTerminalBorder(container, false);

      // Browser may convert #999 to rgb(153, 153, 153)
      const borderColor = container.style.borderColor;
      expect(borderColor === '#999' || borderColor === 'rgb(153, 153, 153)').toBe(true);
    });

    it('should use transparent border for inactive terminals in dark theme', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setLightTheme(false);
      borderService.updateSingleTerminalBorder(container, false);

      expect(container.style.borderColor).toBe('transparent');
    });

    it('should use gray border for active terminal when highlight is disabled in light theme', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setLightTheme(true);
      borderService.setActiveBorderMode('none');
      borderService.updateSingleTerminalBorder(container, true);

      // Browser may convert #999 to rgb(153, 153, 153)
      const borderColor = container.style.borderColor;
      expect(borderColor === '#999' || borderColor === 'rgb(153, 153, 153)').toBe(true);
    });

    it('should use transparent border for active terminal when highlight is disabled in dark theme', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';

      borderService.setLightTheme(false);
      borderService.setActiveBorderMode('none');
      borderService.updateSingleTerminalBorder(container, true);

      expect(container.style.borderColor).toBe('transparent');
    });
  });

  describe('Border Styling', () => {
    it('should disable box-shadow for clean appearance', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';
      container.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

      borderService.updateSingleTerminalBorder(container, true);

      expect(container.style.boxShadow).toBe('none');
    });
  });
});
