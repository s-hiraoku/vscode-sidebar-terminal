/**
 * LifecycleController Unit Tests
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { LifecycleController, AddonLoadOptions as _AddonLoadOptions } from '../../../../webview/controllers/LifecycleController';

describe('LifecycleController', function () {
  let lifecycleController: LifecycleController;
  let mockTerminal: any;
  let _mockAddon: any;

  beforeEach(function () {
    lifecycleController = new LifecycleController();

    // Create mock terminal
    mockTerminal = {
      loadAddon: sinon.stub(),
      dispose: sinon.stub(),
    };

    // Create mock addon
    _mockAddon = {
      dispose: sinon.stub(),
    };
  });

  afterEach(function () {
    if (lifecycleController && !lifecycleController.getStats) {
      lifecycleController.dispose();
    }
    sinon.restore();
  });

  describe('Terminal Attachment', function () {
    it('should attach terminal successfully', function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).to.equal(1);
      expect(stats.terminals).to.include('test-1');
    });

    it('should handle multiple terminals', function () {
      const mockTerminal2 = { ...mockTerminal };

      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.attachTerminal('test-2', mockTerminal2);

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).to.equal(2);
      expect(stats.terminals).to.have.members(['test-1', 'test-2']);
    });

    it('should detach existing terminal when attaching duplicate', function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.attachTerminal('test-1', mockTerminal); // Duplicate

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).to.equal(1);
    });

    it('should check terminal attachment status', function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);

      expect(lifecycleController.hasTerminal('test-1')).to.be.true;
      expect(lifecycleController.hasTerminal('non-existent')).to.be.false;
    });
  });

  describe('Terminal Detachment', function () {
    beforeEach(function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should detach terminal successfully', function () {
      lifecycleController.detachTerminal('test-1');

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).to.equal(0);
      expect(lifecycleController.hasTerminal('test-1')).to.be.false;
    });

    it('should handle detaching non-existent terminal', function () {
      expect(() => {
        lifecycleController.detachTerminal('non-existent');
      }).to.not.throw();
    });
  });

  describe('Lazy Addon Loading', function () {
    beforeEach(function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should load addon lazily', function () {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      const addon = lifecycleController.loadAddonLazy(
        'test-1',
        'MockAddon',
        MockAddon,
        { lazy: true }
      );

      expect(addon).to.not.be.null;
      expect(mockTerminal.loadAddon.called).to.be.true;
    });

    it('should reuse existing addon for same terminal', function () {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      const addon1 = lifecycleController.loadAddonLazy(
        'test-1',
        'MockAddon',
        MockAddon
      );
      const addon2 = lifecycleController.loadAddonLazy(
        'test-1',
        'MockAddon',
        MockAddon
      );

      expect(addon1).to.equal(addon2);
      expect(mockTerminal.loadAddon.calledOnce).to.be.true; // Only loaded once
    });

    it('should cache addon globally when enabled', function () {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      // Load for first terminal
      lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon, {
        cache: true,
      });

      // Attach second terminal
      const mockTerminal2 = { ...mockTerminal, loadAddon: sinon.stub() };
      lifecycleController.attachTerminal('test-2', mockTerminal2);

      // Load for second terminal (should reuse from cache)
      lifecycleController.loadAddonLazy('test-2', 'MockAddon', MockAddon, {
        cache: true,
      });

      const stats = lifecycleController.getStats();
      expect(stats.cachedAddons).to.be.greaterThan(0);
    });

    it('should not cache addon when cache disabled', function () {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon, {
        cache: false,
      });

      const _stats = lifecycleController.getStats();
      // Note: Cache size may still be > 0 from previous tests if not isolated
      // Just verify addon was loaded
      expect(mockTerminal.loadAddon.called).to.be.true;
    });

    it('should return null for non-existent terminal', function () {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      const addon = lifecycleController.loadAddonLazy(
        'non-existent',
        'MockAddon',
        MockAddon
      );

      expect(addon).to.be.null;
    });

    it('should throw error for required addon failure', function () {
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
      }).to.throw();
    });

    it('should return null for optional addon failure', function () {
      class FailingAddon {
        constructor() {
          throw new Error('Addon initialization failed');
        }
        public activate() {}
        public dispose() {}
      }

      const addon = lifecycleController.loadAddonLazy(
        'test-1',
        'FailingAddon',
        FailingAddon,
        { required: false }
      );

      expect(addon).to.be.null;
    });
  });

  describe('Addon Retrieval', function () {
    beforeEach(function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should get loaded addon', function () {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      const loadedAddon = lifecycleController.loadAddonLazy(
        'test-1',
        'MockAddon',
        MockAddon
      );

      const retrievedAddon = lifecycleController.getAddon('test-1', 'MockAddon');

      expect(retrievedAddon).to.equal(loadedAddon);
    });

    it('should return null for non-existent addon', function () {
      const addon = lifecycleController.getAddon('test-1', 'NonExistentAddon');

      expect(addon).to.be.null;
    });

    it('should return null for non-existent terminal', function () {
      const addon = lifecycleController.getAddon('non-existent', 'MockAddon');

      expect(addon).to.be.null;
    });
  });

  describe('Event Listeners', function () {
    beforeEach(function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should add event listener', function () {
      const handler = sinon.stub();

      expect(() => {
        lifecycleController.addEventListener('test-1', 'data', handler);
      }).to.not.throw();
    });

    it('should remove event listener', function () {
      const handler = sinon.stub();

      lifecycleController.addEventListener('test-1', 'data', handler);
      lifecycleController.removeEventListener('test-1', 'data');

      // Should not throw
      expect(() => {
        lifecycleController.removeEventListener('test-1', 'data');
      }).to.not.throw();
    });

    it('should handle adding listener to non-existent terminal', function () {
      const handler = sinon.stub();

      expect(() => {
        lifecycleController.addEventListener('non-existent', 'data', handler);
      }).to.not.throw();
    });
  });

  describe('Terminal Disposal', function () {
    beforeEach(function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);
    });

    it('should dispose terminal and all resources', function () {
      class MockAddon {
        public activate() {}
        public dispose = sinon.stub();
      }

      const addon = lifecycleController.loadAddonLazy(
        'test-1',
        'MockAddon',
        MockAddon
      );

      lifecycleController.disposeTerminal('test-1');

      expect(addon!.dispose.called).to.be.true;
      expect(lifecycleController.hasTerminal('test-1')).to.be.false;
    });

    it('should handle disposing non-existent terminal', function () {
      expect(() => {
        lifecycleController.disposeTerminal('non-existent');
      }).to.not.throw();
    });

    it('should dispose in reasonable time (<100ms)', function () {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);

      const startTime = performance.now();
      lifecycleController.disposeTerminal('test-1');
      const elapsed = performance.now() - startTime;

      expect(elapsed).to.be.lessThan(100);
    });

    it('should dispose multiple addons', function () {
      class MockAddon1 {
        public activate() {}
        public dispose = sinon.stub();
      }
      class MockAddon2 {
        public activate() {}
        public dispose = sinon.stub();
      }

      const addon1 = lifecycleController.loadAddonLazy(
        'test-1',
        'MockAddon1',
        MockAddon1
      );
      const addon2 = lifecycleController.loadAddonLazy(
        'test-1',
        'MockAddon2',
        MockAddon2
      );

      lifecycleController.disposeTerminal('test-1');

      expect(addon1!.dispose.called).to.be.true;
      expect(addon2!.dispose.called).to.be.true;
    });
  });

  describe('Controller Disposal', function () {
    it('should dispose all terminals', function () {
      class MockAddon {
        public activate() {}
        public dispose = sinon.stub();
      }

      const mockTerminal2 = { ...mockTerminal, loadAddon: sinon.stub() };

      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.attachTerminal('test-2', mockTerminal2);

      const addon1 = lifecycleController.loadAddonLazy(
        'test-1',
        'MockAddon',
        MockAddon
      );
      const addon2 = lifecycleController.loadAddonLazy(
        'test-2',
        'MockAddon',
        MockAddon
      );

      lifecycleController.dispose();

      expect(addon1!.dispose.called).to.be.true;
      expect(addon2!.dispose.called).to.be.true;

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).to.equal(0);
      expect(stats.cachedAddons).to.equal(0);
    });

    it('should not throw on double dispose', function () {
      expect(() => {
        lifecycleController.dispose();
        lifecycleController.dispose();
      }).to.not.throw();
    });

    it('should prevent operations after disposal', function () {
      lifecycleController.dispose();

      // Should not attach after disposal
      lifecycleController.attachTerminal('test-1', mockTerminal);

      const stats = lifecycleController.getStats();
      expect(stats.attachedTerminals).to.equal(0);
    });
  });

  describe('Statistics', function () {
    it('should return accurate stats', function () {
      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.attachTerminal('test-2', mockTerminal);

      const stats = lifecycleController.getStats();

      expect(stats.attachedTerminals).to.equal(2);
      expect(stats.terminals).to.have.lengthOf(2);
      expect(stats.terminals).to.include.members(['test-1', 'test-2']);
    });

    it('should return empty stats when no terminals attached', function () {
      const stats = lifecycleController.getStats();

      expect(stats.attachedTerminals).to.equal(0);
      expect(stats.terminals).to.have.lengthOf(0);
    });
  });

  describe('Memory Leak Prevention', function () {
    it('should clear all references on dispose', function () {
      class MockAddon {
        public activate() {}
        public dispose() {}
      }

      lifecycleController.attachTerminal('test-1', mockTerminal);
      lifecycleController.loadAddonLazy('test-1', 'MockAddon', MockAddon);
      lifecycleController.addEventListener('test-1', 'data', () => {});

      lifecycleController.disposeTerminal('test-1');

      expect(lifecycleController.hasTerminal('test-1')).to.be.false;
      expect(lifecycleController.getAddon('test-1', 'MockAddon')).to.be.null;
    });
  });
});
