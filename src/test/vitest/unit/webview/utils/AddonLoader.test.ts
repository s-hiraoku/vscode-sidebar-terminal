/**
 * AddonLoader Unit Tests
 *
 * Tests for generic addon loading utility with error handling and logging.
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Terminal } from '@xterm/xterm';
import { AddonLoader } from '../../../../../webview/utils/AddonLoader';
import { terminalLogger } from '../../../../../webview/utils/ManagerLogger';

describe('AddonLoader', () => {
  let terminal: { loadAddon: ReturnType<typeof vi.fn>; unicode: { activeVersion: string } };
  let loadAddonMock: ReturnType<typeof vi.fn>;
  let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  // Mock addon class
  class MockAddon {
    public name = 'MockAddon';
    public dispose() {}
  }

  beforeEach(() => {
    // Create terminal mock
    loadAddonMock = vi.fn();
    terminal = {
      loadAddon: loadAddonMock,
      unicode: { activeVersion: '' },
    };

    // Spy on logger methods
    loggerInfoSpy = vi.spyOn(terminalLogger, 'info').mockImplementation(() => {});
    loggerErrorSpy = vi.spyOn(terminalLogger, 'error').mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(terminalLogger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadAddon()', () => {
    it('should load required addon successfully', async () => {
      const addon = await AddonLoader.loadAddon(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: true,
      });

      expect(addon).toBeInstanceOf(MockAddon);
      expect(loadAddonMock).toHaveBeenCalledOnce();
      expect(loggerInfoSpy).toHaveBeenCalledWith('✅ MockAddon loaded: terminal-1');
    });

    it('should load optional addon successfully', async () => {
      const addon = await AddonLoader.loadAddon(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: false,
      });

      expect(addon).toBeInstanceOf(MockAddon);
      expect(loadAddonMock).toHaveBeenCalledOnce();
      expect(loggerInfoSpy).toHaveBeenCalledWith('✅ MockAddon loaded: terminal-1');
    });

    it('should use custom addon name for logging', async () => {
      const addon = await AddonLoader.loadAddon(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: true,
        addonName: 'CustomAddonName',
      });

      expect(addon).toBeInstanceOf(MockAddon);
      expect(loggerInfoSpy).toHaveBeenCalledWith('✅ CustomAddonName loaded: terminal-1');
    });

    it('should execute onLoaded callback after loading', async () => {
      const onLoadedSpy = vi.fn();

      const addon = await AddonLoader.loadAddon(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: true,
        onLoaded: onLoadedSpy,
      });

      expect(addon).toBeInstanceOf(MockAddon);
      expect(onLoadedSpy).toHaveBeenCalledOnce();
      expect(onLoadedSpy).toHaveBeenCalledWith(addon, terminal);
    });

    it('should set unicode.activeVersion in onLoaded callback', async () => {
      const addon = await AddonLoader.loadAddon(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: true,
        onLoaded: (_, term) => {
          (term as any).unicode.activeVersion = '11';
        },
      });

      expect(addon).toBeInstanceOf(MockAddon);
      expect(terminal.unicode.activeVersion).toBe('11');
    });

    it('should throw error for required addon that fails to load', async () => {
      loadAddonMock.mockImplementation(() => {
        throw new Error('Addon load failed');
      });

      await expect(
        AddonLoader.loadAddon(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
          required: true,
        })
      ).rejects.toThrow('Addon load failed');
      expect(loggerErrorSpy).toHaveBeenCalledOnce();
    });

    it('should return undefined for optional addon that fails to load', async () => {
      loadAddonMock.mockImplementation(() => {
        throw new Error('Addon load failed');
      });

      const addon = await AddonLoader.loadAddon(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: false,
      });

      expect(addon).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledOnce();
    });

    it('should default to required=true if not specified', async () => {
      loadAddonMock.mockImplementation(() => {
        throw new Error('Addon load failed');
      });

      await expect(
        AddonLoader.loadAddon(terminal as unknown as Terminal, 'terminal-1', MockAddon)
      ).rejects.toThrow('Addon load failed');
      expect(loggerErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('loadAddonWithResult()', () => {
    it('should return success result for successful load', async () => {
      const result = await AddonLoader.loadAddonWithResult(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: true,
      });

      expect(result.success).toBe(true);
      expect(result.addon).toBeInstanceOf(MockAddon);
      expect(result.error).toBeUndefined();
    });

    it('should return failure result for failed required addon', async () => {
      loadAddonMock.mockImplementation(() => {
        throw new Error('Load failed');
      });

      const result = await AddonLoader.loadAddonWithResult(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: true,
      });

      expect(result.success).toBe(false);
      expect(result.addon).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    it('should return failure result for failed optional addon', async () => {
      loadAddonMock.mockImplementation(() => {
        throw new Error('Load failed');
      });

      const result = await AddonLoader.loadAddonWithResult(terminal as unknown as Terminal, 'terminal-1', MockAddon, {
        required: false,
      });

      expect(result.success).toBe(false);
      expect(result.addon).toBeUndefined();
      expect(result.error).toBeUndefined(); // Optional addon doesn't throw
    });
  });

  describe('loadMultipleAddons()', () => {
    class Addon1 {
      public name = 'Addon1';
    }
    class Addon2 {
      public name = 'Addon2';
    }
    class Addon3 {
      public name = 'Addon3';
    }

    it('should load multiple addons in parallel', async () => {
      const addonMap = await AddonLoader.loadMultipleAddons(terminal as unknown as Terminal, 'terminal-1', [
        { AddonClass: Addon1, options: { required: true } },
        { AddonClass: Addon2, options: { required: true } },
        { AddonClass: Addon3, options: { required: false } },
      ]);

      expect(addonMap.size).toBe(3);
      expect(addonMap.get('Addon1')).toBeInstanceOf(Addon1);
      expect(addonMap.get('Addon2')).toBeInstanceOf(Addon2);
      expect(addonMap.get('Addon3')).toBeInstanceOf(Addon3);
      expect(loadAddonMock).toHaveBeenCalledTimes(3);
    });

    it('should skip failed optional addons in result map', async () => {
      loadAddonMock
        .mockImplementationOnce(() => {}) // Addon1 succeeds
        .mockImplementationOnce(() => {
          throw new Error('Addon2 failed');
        }) // Addon2 fails
        .mockImplementationOnce(() => {}); // Addon3 succeeds

      const addonMap = await AddonLoader.loadMultipleAddons(terminal as unknown as Terminal, 'terminal-1', [
        { AddonClass: Addon1, options: { required: true } },
        { AddonClass: Addon2, options: { required: false } },
        { AddonClass: Addon3, options: { required: true } },
      ]);

      expect(addonMap.size).toBe(2);
      expect(addonMap.get('Addon1')).toBeInstanceOf(Addon1);
      expect(addonMap.get('Addon2')).toBeUndefined();
      expect(addonMap.get('Addon3')).toBeInstanceOf(Addon3);
    });

    it('should use custom addon names in result map', async () => {
      const addonMap = await AddonLoader.loadMultipleAddons(terminal as unknown as Terminal, 'terminal-1', [
        {
          AddonClass: Addon1,
          options: { required: true, addonName: 'CustomAddon1' },
        },
        {
          AddonClass: Addon2,
          options: { required: true, addonName: 'CustomAddon2' },
        },
      ]);

      expect(addonMap.size).toBe(2);
      expect(addonMap.get('CustomAddon1')).toBeInstanceOf(Addon1);
      expect(addonMap.get('CustomAddon2')).toBeInstanceOf(Addon2);
    });
  });
});
