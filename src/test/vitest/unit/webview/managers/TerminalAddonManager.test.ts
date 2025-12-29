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
  });
});
