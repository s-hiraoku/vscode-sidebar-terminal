/**
 * TerminalAddonManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalAddonManager, AddonConfig } from '../../../../../webview/managers/TerminalAddonManager';
import { Terminal } from '@xterm/xterm';
import { AddonLoader } from '../../../../../webview/utils/AddonLoader';

// Mock generic logger
vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ErrorHandler
vi.mock('../../../../../webview/utils/ErrorHandler', () => ({
  ErrorHandler: {
    handleOperationError: vi.fn(),
  },
}));

// Mock AddonLoader
vi.mock('../../../../../webview/utils/AddonLoader', () => ({
  AddonLoader: {
    loadAddon: vi.fn(),
  },
}));

// Mock xterm addons
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    activate = vi.fn();
    proposeDimensions = vi.fn().mockReturnValue({ cols: 80, rows: 24 });
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class {
    activate = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: class {
    activate = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: class {
    activate = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: class {
    activate = vi.fn();
    dispose = vi.fn();
  },
}));

describe('TerminalAddonManager', () => {
  let manager: TerminalAddonManager;
  let mockTerminal: any;

  beforeEach(() => {
    manager = new TerminalAddonManager();
    mockTerminal = {
      loadAddon: vi.fn(),
      unicode: { activeVersion: '6' },
      element: document.createElement('div'),
      _core: {
        _renderService: { dimensions: { css: { cell: { width: 10, height: 20 } } } },
        viewport: { scrollBarWidth: 10 }
      }
    };

    // Setup basic AddonLoader mocks
    (AddonLoader.loadAddon as any).mockImplementation((term: any, id: string, AddonClass: any) => {
      return new AddonClass();
    });
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
  });

  describe('loadAllAddons', () => {
    it('should load essential addons by default', async () => {
      const addons = await manager.loadAllAddons(mockTerminal, 't1', {});

      expect(addons.fitAddon).toBeDefined();
      expect(addons.webLinksAddon).toBeDefined();
      expect(addons.serializeAddon).toBeDefined();
      expect(addons.searchAddon).toBeUndefined();
    });

    it('should load required addons successfully', async () => {
      const config: AddonConfig = {};
      const addons = await manager.loadAllAddons(mockTerminal as Terminal, 't1', config);

      expect(addons.fitAddon).toBeDefined();
      expect(addons.webLinksAddon).toBeDefined();
      expect(addons.serializeAddon).toBeDefined();
      expect(AddonLoader.loadAddon).toHaveBeenCalledTimes(3); // Fit, WebLinks, Serialize
    });

    it('should load optional addons when enabled', async () => {
      const config: AddonConfig = {
        enableSearchAddon: true,
        enableUnicode11: true,
      };

      const addons = await manager.loadAllAddons(mockTerminal as Terminal, 't1', config);

      expect(addons.searchAddon).toBeDefined();
      expect(addons.unicode11Addon).toBeDefined();
      expect(AddonLoader.loadAddon).toHaveBeenCalledTimes(5);
    });

    it('should configure WebLinksAddon with custom handler', async () => {
      const linkHandler = vi.fn();
      const config: AddonConfig = {
        linkHandler,
        linkModifier: 'alt',
      };

      await manager.loadAllAddons(mockTerminal as Terminal, 't1', config);

      expect(mockTerminal.loadAddon).toHaveBeenCalled();
      // AddonLoader called for Fit and Serialize (2 times)
      // WebLinksAddon instantiated directly
      expect(AddonLoader.loadAddon).toHaveBeenCalledTimes(2);
    });

    it('should throw if required addon fails to load', async () => {
      (AddonLoader.loadAddon as any).mockResolvedValueOnce(null); // Fail FitAddon

      await expect(manager.loadAllAddons(mockTerminal as Terminal, 't1', {}))
        .rejects.toThrow('FitAddon failed to load');
    });
  });

  describe('disposeAddons', () => {
    it('should call dispose on optional addons', () => {
      const searchAddon = { dispose: vi.fn() };
      const unicode11Addon = { dispose: vi.fn() };

      const addons: any = {
        searchAddon,
        unicode11Addon,
        fitAddon: {} // Essential ones usually auto-disposed by xterm
      };

      manager.disposeAddons(addons);

      expect(searchAddon.dispose).toHaveBeenCalled();
      expect(unicode11Addon.dispose).toHaveBeenCalled();
    });

    it('should dispose optional addons after loading', async () => {
      const config: AddonConfig = {
        enableSearchAddon: true,
        enableUnicode11: true,
      };

      const addons = await manager.loadAllAddons(mockTerminal as Terminal, 't1', config);

      // Mock dispose methods
      addons.searchAddon!.dispose = vi.fn();
      (addons.unicode11Addon as any).dispose = vi.fn();

      manager.disposeAddons(addons);

      expect(addons.searchAddon!.dispose).toHaveBeenCalled();
      expect((addons.unicode11Addon as any).dispose).toHaveBeenCalled();
    });

    it('should handle undefined addons gracefully', () => {
      expect(() => manager.disposeAddons(undefined)).not.toThrow();
    });

    it('should be safe with undefined', () => {
      expect(() => manager.disposeAddons(undefined)).not.toThrow();
    });
  });

  describe('fitAddon patching', () => {
    it('should patch proposeDimensions', async () => {
      const addons = await manager.loadAllAddons(mockTerminal, 't1', {});
      const fitAddon = addons.fitAddon;

      expect(fitAddon.proposeDimensions).toBeDefined();

      // Call patched method (should fallback to original or run custom logic)
      const dims = fitAddon.proposeDimensions();
      expect(dims).toBeDefined();
    });

    it('should patch proposeDimensions to handle scrollbar', async () => {
      const addons = await manager.loadAllAddons(mockTerminal as Terminal, 't1', {});
      const fitAddon = addons.fitAddon;

      // Setup DOM for patch logic test
      const parent = document.createElement('div');
      Object.defineProperty(parent, 'clientWidth', { value: 100 });
      Object.defineProperty(parent, 'clientHeight', { value: 100 });

      // JSDOM specific: getComputedStyle mocks
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
        if (el === parent) return { getPropertyValue: (prop: string) => (prop === 'width' ? '100px' : '100px') } as any;
        return { getPropertyValue: () => '0px' } as any;
      });

      // Mock terminal element parent
      Object.defineProperty(mockTerminal.element, 'parentElement', { value: parent });

      // Call patched method
      const dims = fitAddon.proposeDimensions();

      expect(dims).toBeDefined();
      expect(dims.cols).toBeGreaterThan(0);
      expect(dims.rows).toBeGreaterThan(0);
    });

    // Comprehensive tests for proposeDimensions with safety padding removal
    describe('proposeDimensions with safety padding removal', () => {
      const setupProposeDimensionsTest = (
        parentWidth: number,
        parentHeight: number,
        cellWidth: number,
        cellHeight: number,
        scrollbarWidth: number = 0,
        paddingLeft: number = 0,
        paddingRight: number = 0,
        paddingTop: number = 0,
        paddingBottom: number = 0,
        parentPaddingLeft: number = 0,
        parentPaddingRight: number = 0,
        parentPaddingTop: number = 0,
        parentPaddingBottom: number = 0
      ) => {
        const parent = document.createElement('div');
        const element = document.createElement('div');

        // Setup parent dimensions
        vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
          if (el === parent) {
            return {
              getPropertyValue: (prop: string) => {
                switch (prop) {
                  case 'width': return `${parentWidth}px`;
                  case 'height': return `${parentHeight}px`;
                  case 'padding-left': return `${parentPaddingLeft}px`;
                  case 'padding-right': return `${parentPaddingRight}px`;
                  case 'padding-top': return `${parentPaddingTop}px`;
                  case 'padding-bottom': return `${parentPaddingBottom}px`;
                  default: return '0px';
                }
              }
            } as any;
          }
          if (el === element) {
            return {
              getPropertyValue: (prop: string) => {
                switch (prop) {
                  case 'padding-left': return `${paddingLeft}px`;
                  case 'padding-right': return `${paddingRight}px`;
                  case 'padding-top': return `${paddingTop}px`;
                  case 'padding-bottom': return `${paddingBottom}px`;
                  default: return '0px';
                }
              }
            } as any;
          }
          return { getPropertyValue: () => '0px' } as any;
        });

        // Setup viewport with scrollbar measurement
        const viewport = document.createElement('div');
        Object.defineProperty(viewport, 'offsetWidth', { value: parentWidth - scrollbarWidth });
        Object.defineProperty(viewport, 'clientWidth', { value: parentWidth - scrollbarWidth });

        // Add viewport to element for querySelector to find
        element.appendChild(viewport);

        // Setup terminal mock with precise dimensions
        const terminalMock = {
          loadAddon: vi.fn(),
          unicode: { activeVersion: '6' },
          element,
          _core: {
            _renderService: {
              dimensions: {
                css: { cell: { width: cellWidth, height: cellHeight } }
              }
            },
            viewport: { scrollBarWidth: scrollbarWidth }
          }
        };

        Object.defineProperty(element, 'parentElement', { value: parent });

        return { terminalMock, parent, element };
      };

      it('should calculate cols correctly for narrow viewport (200px) without scrollbar', async () => {
        const { terminalMock } = setupProposeDimensionsTest(200, 400, 10, 20, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (200 - 0) / 10 = 20 cols
        expect(dims.cols).toBe(20);
        expect(dims.rows).toBeGreaterThan(0);
      });

      it('should calculate cols correctly for narrow viewport (200px) with scrollbar (14px)', async () => {
        const { terminalMock } = setupProposeDimensionsTest(200, 400, 10, 20, 14);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (200 - 14) / 10 = 18.6 → 18 cols
        expect(dims.cols).toBe(18);
        expect(dims.cols).toBeGreaterThanOrEqual(2); // Minimum cols
      });

      it('should calculate cols correctly for standard viewport (800px) without scrollbar', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 10, 20, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (800 - 0) / 10 = 80 cols
        expect(dims.cols).toBe(80);
      });

      it('should calculate cols correctly for standard viewport (800px) with scrollbar (14px)', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 10, 20, 14);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (800 - 14) / 10 = 78.6 → 78 cols
        expect(dims.cols).toBe(78);
      });

      it('should calculate cols correctly for wide viewport (1920px) without scrollbar', async () => {
        const { terminalMock } = setupProposeDimensionsTest(1920, 1080, 10, 20, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (1920 - 0) / 10 = 192 cols
        expect(dims.cols).toBe(192);
      });

      it('should calculate cols correctly for wide viewport (1920px) with scrollbar (14px)', async () => {
        const { terminalMock } = setupProposeDimensionsTest(1920, 1080, 10, 20, 14);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (1920 - 14) / 10 = 190.6 → 190 cols
        expect(dims.cols).toBe(190);
      });

      it('should handle small cell width (7px - compact font)', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 7, 16, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (800 - 0) / 7 = 114.28 → 114 cols
        expect(dims.cols).toBe(114);
        // Verify more columns are available with smaller font
        expect(dims.cols).toBeGreaterThan(80);
      });

      it('should handle medium cell width (10px - normal font)', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 10, 20, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (800 - 0) / 10 = 80 cols
        expect(dims.cols).toBe(80);
      });

      it('should handle large cell width (12px - large font)', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 12, 24, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (800 - 0) / 12 = 66.66 → 66 cols
        expect(dims.cols).toBe(66);
        // Verify fewer columns available with larger font
        expect(dims.cols).toBeLessThan(80);
      });

      it('should include padding in width calculation', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 10, 20, 0, 4, 4, 0, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (800 - 4 - 4) / 10 = 79.2 → 79 cols
        expect(dims.cols).toBe(79);
      });

      it('should handle both padding and scrollbar', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 10, 20, 14, 4, 4, 0, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (800 - 4 - 4 - 14) / 10 = 77.8 → 77 cols
        expect(dims.cols).toBe(77);
      });

      it('should include parent padding in width calculation', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 10, 20, 0, 0, 0, 0, 0, 4, 4, 0, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (800 - 4 - 4) / 10 = 79.2 → 79 cols
        expect(dims.cols).toBe(79);
      });

      it('should enforce minimum cols of 2', async () => {
        // Very small viewport that would result in < 2 cols
        const { terminalMock } = setupProposeDimensionsTest(10, 20, 10, 20, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: Math.max(2, Math.floor((10 - 0) / 10)) = Math.max(2, 1) = 2 cols
        expect(dims.cols).toBe(2);
      });

      it('should enforce minimum rows of 1', async () => {
        // Very small viewport that would result in < 1 row
        const { terminalMock } = setupProposeDimensionsTest(800, 10, 10, 20, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: Math.max(1, Math.floor((10 - 0) / 20)) = Math.max(1, 0) = 1 row
        expect(dims.rows).toBe(1);
      });

      it('should calculate rows correctly with padding', async () => {
        const { terminalMock } = setupProposeDimensionsTest(800, 400, 10, 20, 0, 0, 0, 4, 4);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (400 - 4 - 4) / 20 = 19.2 → 19 rows
        expect(dims.rows).toBe(19);
      });

      it('removal of 4px safety padding maximizes visible area', async () => {
        // Test with standard viewport
        const { terminalMock } = setupProposeDimensionsTest(800, 600, 10, 20, 0);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // With safety padding = 0, we get full width utilization
        // Expected: 800 / 10 = 80 cols
        expect(dims.cols).toBe(80);

        // Verify that if safety padding were 4px, we'd get fewer columns
        // (800 - 4) / 10 = 79.6 → 79 cols
        expect(dims.cols).toBeGreaterThan(79);
      });

      it('should not have regression with safety padding removal and scrollbar', async () => {
        // Realistic scenario: standard width with scrollbar
        const { terminalMock } = setupProposeDimensionsTest(1024, 768, 10, 20, 14);

        const addons = await manager.loadAllAddons(terminalMock as any, 't1', {});
        const dims = addons.fitAddon.proposeDimensions();

        // Expected: (1024 - 14) / 10 = 101 cols
        expect(dims.cols).toBe(101);
        expect(dims.cols).toBeGreaterThan(0);
      });
    });
  });
});
