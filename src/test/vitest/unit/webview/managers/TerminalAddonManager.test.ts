/**
 * TerminalAddonManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalAddonManager, AddonConfig } from '../../../../../webview/managers/TerminalAddonManager';
import { Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';
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
    proposeDimensions = vi.fn().mockReturnValue({ cols: 80, rows: 24 });
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class {
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: class {
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: class {
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: class {
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
    (AddonLoader.loadAddon as any).mockImplementation((term, id, AddonClass) => {
      return new AddonClass();
    });
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
  });

  describe('Addon Loading', () => {
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
      
      // When handler is provided, WebLinksAddon is instantiated directly, not via AddonLoader
      // So we need to reset the AddonLoader mock count expectation
      await manager.loadAllAddons(mockTerminal as Terminal, 't1', config);
      
      expect(mockTerminal.loadAddon).toHaveBeenCalled();
      // AddonLoader called for Fit and Serialize (2 times)
      // WebLinksAddon instantiated directly
      // Optional addons (Search, Unicode) disabled (0 times)
      // Total 2 calls to AddonLoader
      // Wait, FitAddon is loaded via AddonLoader. SerializeAddon too.
      // WebLinksAddon is manual.
      // So AddonLoader should be called for FitAddon and SerializeAddon.
      expect(AddonLoader.loadAddon).toHaveBeenCalledTimes(2); 
    });

    it('should throw if required addon fails to load', async () => {
      (AddonLoader.loadAddon as any).mockResolvedValueOnce(null); // Fail FitAddon
      
      await expect(manager.loadAllAddons(mockTerminal as Terminal, 't1', {}))
        .rejects.toThrow('FitAddon failed to load');
    });
  });

  describe('Addon Disposal', () => {
    it('should dispose optional addons', async () => {
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
  });

  describe('Fit Addon Patching', () => {
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
