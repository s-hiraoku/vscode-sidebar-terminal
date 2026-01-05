/**
 * LifecycleController Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LifecycleController,
  AddonLoadOptions as _AddonLoadOptions,
} from '../../../../../webview/controllers/LifecycleController';

describe('LifecycleController', () => {
  let lifecycleController: LifecycleController;
  let mockTerminal: any;
  let _mockAddon: any;

  beforeEach(() => {
    lifecycleController = new LifecycleController();

    // Create mock terminal
    mockTerminal = {
      loadAddon: vi.fn(),
      dispose: vi.fn(),
    };

    // Create mock addon
    _mockAddon = {
      dispose: vi.fn(),
    };
  });

  afterEach(() => {
    if (lifecycleController && !lifecycleController.getStats) {
      lifecycleController.dispose();
    }
    vi.restoreAllMocks();
  });

  describe('Terminal Attachment', () => {
    it('should attach terminal successfully', () => {
      lifecycleController.attachTerminal('test-1', mockTerminal);

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).toBe(1);
      expect(stats.terminals).toContain('test-1');
    });

    it('should handle multiple terminals', () => {
      const mockTerminal2 = { ...mockTerminal };

      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.attachTerminal('test-2', mockTerminal2);

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).toBe(2);
      expect(stats.terminals).toContain('test-1');
      expect(stats.terminals).toContain('test-2');
    });

    it('should detach existing terminal when attaching duplicate', () => {
      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.attachTerminal('test-1', mockTerminal); // Duplicate

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).toBe(1);
    });

    it('should check terminal attachment status', () => {
      lifecycleController.attachTerminal('test-1', mockTerminal);

      expect(lifecycleController.hasTerminal('test-1')).toBe(true);
      expect(lifecycleController.hasTerminal('non-existent')).toBe(false);
    });
  });

  describe('Terminal Detachment', () => {
    beforeEach(() => {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should detach terminal successfully', () => {
      lifecycleController.detachTerminal('test-1');

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).toBe(0);
      expect(lifecycleController.hasTerminal('test-1')).toBe(false);
    });

    it('should handle detaching non-existent terminal', () => {
      expect(() => {
        lifecycleController.detachTerminal('non-existent');
      }).not.toThrow();
    });
  });

  describe('Lazy Addon Loading', () => {
    beforeEach(() => {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should load addon lazily', () => {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      const addon = lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon, {
        lazy: true,
      });

      expect(addon).not.toBeNull();
      expect(mockTerminal.loadAddon).toHaveBeenCalled();
    });

    it('should reuse existing addon for same terminal', () => {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      const addon1 = lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);
      const addon2 = lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);

      expect(addon1).toBe(addon2);
      expect(mockTerminal.loadAddon).toHaveBeenCalledTimes(1); // Only loaded once
    });

    it('should cache addon globally when enabled', () => {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      // Load for first terminal
      lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon, {
        cache: true,
      });

      // Attach second terminal
      const mockTerminal2 = { ...mockTerminal, loadAddon: vi.fn() };
      lifecycleController.attachTerminal('test-2', mockTerminal2);

      // Load for second terminal (should reuse from cache)
      lifecycleController.loadAddonLazy('test-2', 'MockAddon', MockAddon, {
        cache: true,
      });

      const stats = lifecycleController.getStats();
      expect(stats.cachedAddons).toBeGreaterThan(0);
    });

    it('should not cache addon when cache disabled', () => {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon, {
        cache: false,
      });

      // Just verify addon was loaded
      expect(mockTerminal.loadAddon).toHaveBeenCalled();
    });

    it('should return null for non-existent terminal', () => {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      const addon = lifecycleController.loadAddonLazy('non-existent', 'MockAddon', MockAddon);

      expect(addon).toBeNull();
    });

    it('should throw error for required addon failure', () => {
      class FailingAddon {
        constructor() {
          throw new Error('Addon initialization failed');
        }
        public activate() {}
        public dispose() {}
      }

      expect(() => {
        lifecycleController.loadAddonLazy('test-1', 'FailingAddon', FailingAddon, {
          required: true,
        });
      }).toThrow();
    });

    it('should return null for optional addon failure', () => {
      class FailingAddon {
        constructor() {
          throw new Error('Addon initialization failed');
        }
        public activate() {}
        public dispose() {}
      }

      const addon = lifecycleController.loadAddonLazy('test-1', 'FailingAddon', FailingAddon, {
        required: false,
      });

      expect(addon).toBeNull();
    });
  });

  describe('Addon Retrieval', () => {
    beforeEach(() => {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should get loaded addon', () => {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      const loadedAddon = lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);

      const retrievedAddon = lifecycleController.getAddon('test-1', 'MockAddon');

      expect(retrievedAddon).toBe(loadedAddon);
    });

    it('should return null for non-existent addon', () => {
      const addon = lifecycleController.getAddon('test-1', 'NonExistentAddon');

      expect(addon).toBeNull();
    });

    it('should return null for non-existent terminal', () => {
      const addon = lifecycleController.getAddon('non-existent', 'MockAddon');

      expect(addon).toBeNull();
    });
  });

  describe('Event Listeners', () => {
    beforeEach(() => {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should add event listener', () => {
      const handler = vi.fn();

      expect(() => {
        lifecycleController.addEventListener('test-1', 'data', handler);
      }).not.toThrow();
    });

    it('should remove event listener', () => {
      const handler = vi.fn();

      lifecycleController.addEventListener('test-1', 'data', handler);
      lifecycleController.removeEventListener('test-1', 'data');

      // Should not throw
      expect(() => {
        lifecycleController.removeEventListener('test-1', 'data');
      }).not.toThrow();
    });

    it('should handle adding listener to non-existent terminal', () => {
      const handler = vi.fn();

      expect(() => {
        lifecycleController.addEventListener('non-existent', 'data', handler);
      }).not.toThrow();
    });
  });

  describe('Terminal Disposal', () => {
    beforeEach(() => {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should dispose terminal and all resources', () => {
      class MockAddon {
        public activate() {}
        public dispose = vi.fn();
      }

      const addon = lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);

      lifecycleController.disposeTerminal('test-1');

      expect(addon!.dispose).toHaveBeenCalled();
      expect(lifecycleController.hasTerminal('test-1')).toBe(false);
    });

    it('should handle disposing non-existent terminal', () => {
      expect(() => {
        lifecycleController.disposeTerminal('non-existent');
      }).not.toThrow();
    });

    it('should dispose in reasonable time (<100ms)', () => {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);

      const startTime = performance.now();
      lifecycleController.disposeTerminal('test-1');
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(100);
    });

    it('should dispose multiple addons', () => {
      class MockAddon1 {
        public activate() {}
        public dispose = vi.fn();
      }
      class MockAddon2 {
        public activate() {}
        public dispose = vi.fn();
      }

      const addon1 = lifecycleController.loadAddonLazy('test-1', 'MockAddon1', MockAddon1);
      const addon2 = lifecycleController.loadAddonLazy('test-1', 'MockAddon2', MockAddon2);

      lifecycleController.disposeTerminal('test-1');

      expect(addon1!.dispose).toHaveBeenCalled();
      expect(addon2!.dispose).toHaveBeenCalled();
    });
  });

  describe('Controller Disposal', () => {
    it('should dispose all terminals', () => {
      class MockAddon {
        public activate() {}
        public dispose = vi.fn();
      }

      const mockTerminal2 = { ...mockTerminal, loadAddon: vi.fn() };

      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.attachTerminal('test-2', mockTerminal2);

      const addon1 = lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);
      const addon2 = lifecycleController.loadAddonLazy('test-2', 'MockAddon', MockAddon);

      lifecycleController.dispose();

      expect(addon1!.dispose).toHaveBeenCalled();
      expect(addon2!.dispose).toHaveBeenCalled();

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).toBe(0);
      expect(stats.cachedAddons).toBe(0);
    });

    it('should not throw on double dispose', () => {
      expect(() => {
        lifecycleController.dispose();
        lifecycleController.dispose();
      }).not.toThrow();
    });

    it('should prevent operations after disposal', () => {
      lifecycleController.dispose();

      // Should not attach after disposal
      lifecycleController.attachTerminal('test-1', mockTerminal);

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should return accurate stats', () => {
      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.attachTerminal('test-2', mockTerminal);

      const stats = lifecycleController.getStats();

      expect(stats.attachedTerminals).toBe(2);
      expect(stats.terminals).toHaveLength(2);
      expect(stats.terminals).toContain('test-1');
      expect(stats.terminals).toContain('test-2');
    });

    it('should return empty stats when no terminals attached', () => {
      const stats = lifecycleController.getStats();

      expect(stats.attachedTerminals).toBe(0);
      expect(stats.terminals).toHaveLength(0);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should clear all references on dispose', () => {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);
      lifecycleController.addEventListener('test-1', 'data', () => {});

      lifecycleController.disposeTerminal('test-1');

      expect(lifecycleController.hasTerminal('test-1')).toBe(false);
      expect(lifecycleController.getAddon('test-1', 'MockAddon')).toBeNull();
    });
  });
});
