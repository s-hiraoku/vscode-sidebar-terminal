import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddonLoader } from '../../../../../webview/utils/AddonLoader';

// Mock logger
vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('AddonLoader', () => {
  let mockTerminal: any;

  beforeEach(() => {
    mockTerminal = {
      loadAddon: vi.fn()
    };
    vi.clearAllMocks();
  });

  class MockAddon {
    activate = vi.fn();
  }

  class FailingAddon {
    constructor() {
      throw new Error('Simulation Failure');
    }
  }

  describe('loadAddon', () => {
    it('should successfully load an addon', async () => {
      const addon = await AddonLoader.loadAddon(mockTerminal, 't1', MockAddon);
      
      expect(addon).toBeInstanceOf(MockAddon);
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(addon);
    });

    it('should call onLoaded after loading', async () => {
      const onLoaded = vi.fn();
      const addon = await AddonLoader.loadAddon(mockTerminal, 't1', MockAddon, { onLoaded });
      
      expect(onLoaded).toHaveBeenCalledWith(addon, mockTerminal);
    });

    it('should throw error for required addon failure', async () => {
      await expect(
        AddonLoader.loadAddon(mockTerminal, 't1', FailingAddon, { required: true })
      ).rejects.toThrow('Simulation Failure');
    });

    it('should return undefined for optional addon failure', async () => {
      const addon = await AddonLoader.loadAddon(mockTerminal, 't1', FailingAddon, { required: false });
      
      expect(addon).toBeUndefined();
      expect(mockTerminal.loadAddon).not.toHaveBeenCalled();
    });
  });

  describe('loadAddonWithResult', () => {
    it('should return success result', async () => {
      const result = await AddonLoader.loadAddonWithResult(mockTerminal, 't1', MockAddon);
      expect(result.success).toBe(true);
      expect(result.addon).toBeInstanceOf(MockAddon);
    });

    it('should return failure result instead of throwing', async () => {
      const result = await AddonLoader.loadAddonWithResult(mockTerminal, 't1', FailingAddon);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('loadMultipleAddons', () => {
    it('should load multiple addons and return a map', async () => {
      const addons = [
        { AddonClass: MockAddon, options: { addonName: 'Addon1' } },
        { AddonClass: MockAddon, options: { addonName: 'Addon2' } }
      ];

      const resultMap = await AddonLoader.loadMultipleAddons(mockTerminal, 't1', addons);
      
      expect(resultMap.size).toBe(2);
      expect(resultMap.get('Addon1')).toBeInstanceOf(MockAddon);
      expect(resultMap.get('Addon2')).toBeInstanceOf(MockAddon);
    });
  });
});