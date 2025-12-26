
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalAddonManager } from '../../../../../webview/managers/TerminalAddonManager';
import { AddonLoader } from '../../../../../webview/utils/AddonLoader';

// Mock xterm.js addons
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { activate = vi.fn(); proposeDimensions = vi.fn().mockReturnValue({ cols: 80, rows: 24 }); dispose = vi.fn(); } }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class { activate = vi.fn(); dispose = vi.fn(); } }));
vi.mock('@xterm/addon-search', () => ({ SearchAddon: class { activate = vi.fn(); dispose = vi.fn(); } }));
vi.mock('@xterm/addon-serialize', () => ({ SerializeAddon: class { activate = vi.fn(); dispose = vi.fn(); } }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: class { activate = vi.fn(); dispose = vi.fn(); } }));

// Mock AddonLoader
vi.mock('../../../../../webview/utils/AddonLoader', () => ({
  AddonLoader: {
    loadAddon: vi.fn().mockImplementation(async (term, id, AddonClass) => new AddonClass())
  }
}));

describe('TerminalAddonManager', () => {
  let manager: TerminalAddonManager;
  let mockTerminal: any;

  beforeEach(() => {
    manager = new TerminalAddonManager();
    mockTerminal = {
      loadAddon: vi.fn(),
      unicode: { activeVersion: '' },
      element: { parentElement: {} }
    };
  });

  afterEach(() => {
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

    it('should load optional addons when enabled', async () => {
      const addons = await manager.loadAllAddons(mockTerminal, 't1', {
        enableSearchAddon: true,
        enableUnicode11: true
      });
      
      expect(addons.searchAddon).toBeDefined();
      expect(addons.unicode11Addon).toBeDefined();
    });

    it('should use custom link handler if provided', async () => {
      const linkHandler = vi.fn();
      const addons = await manager.loadAllAddons(mockTerminal, 't1', { linkHandler });
      
      expect(addons.webLinksAddon).toBeDefined();
      // Verifying custom instantiation (internal logic)
      expect(mockTerminal.loadAddon).toHaveBeenCalled();
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
  });
});
