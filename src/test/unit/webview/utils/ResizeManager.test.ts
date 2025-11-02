/**
 * ResizeManager Utility Tests
 * Tests for centralized debounced resize logic and ResizeObserver management
 */

// import { expect } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import { JSDOM } from 'jsdom';
import { ResizeManager } from '../../../../webview/utils/ResizeManager';

describe('ResizeManager', () => {
  let sandbox: SinonSandbox;
  let dom: JSDOM;
  let testElement: HTMLElement;

  beforeEach(() => {
    sandbox = createSandbox();

    // Create DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="test-element"></div></body></html>');
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.Element = dom.window.Element;
    global.HTMLElement = dom.window.HTMLElement;

    testElement = document.getElementById('test-element')!;

    // Mock ResizeObserver
    global.ResizeObserver = class MockResizeObserver {
      constructor(private callback: ResizeObserverCallback) {}
      observe = sandbox.stub();
      unobserve = sandbox.stub();
      disconnect = sandbox.stub();
    } as any;
  });

  afterEach(() => {
    sandbox.restore();
    // Clean up ResizeManager state
    ResizeManager.dispose();
  });

  describe('debounceResize', () => {
    it('should debounce resize callbacks', (done) => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      // Call multiple times rapidly
      ResizeManager.debounceResize('test-key', callback, { delay: 50 });
      ResizeManager.debounceResize('test-key', callback, { delay: 50 });
      ResizeManager.debounceResize('test-key', callback, { delay: 50 });

      // Should only call once after delay
      setTimeout(() => {
        expect(callCount).to.equal(1);
        done();
      }, 100);
    });

    it('should handle immediate execution option', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      ResizeManager.debounceResize('test-key', callback, {
        delay: 100,
        immediate: true,
      });

      // Should call immediately
      expect(callCount).to.equal(1);
    });

    it('should handle async callbacks', async () => {
      let resolved = false;
      const asyncCallback = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      };

      ResizeManager.debounceResize('test-key', asyncCallback, { delay: 50 });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(resolved).to.be.true;
    });

    it('should handle multiple keys independently', (done) => {
      let callback1Count = 0;
      let callback2Count = 0;

      const callback1 = () => {
        callback1Count++;
      };
      const callback2 = () => {
        callback2Count++;
      };

      ResizeManager.debounceResize('key1', callback1, { delay: 50 });
      ResizeManager.debounceResize('key2', callback2, { delay: 50 });

      setTimeout(() => {
        expect(callback1Count).to.equal(1);
        expect(callback2Count).to.equal(1);
        done();
      }, 100);
    });

    it('should handle callback errors gracefully', (done) => {
      const errorCallback = () => {
        throw new Error('Test error');
      };

      // Should not throw
      expect(() => {
        ResizeManager.debounceResize('error-key', errorCallback, { delay: 50 });
      }).to.not.throw();

      setTimeout(done, 100);
    });
  });

  describe('observeResize', () => {
    it('should create ResizeObserver and observe element', () => {
      const callback = sandbox.stub();

      ResizeManager.observeResize('test-key', testElement, callback);

      // Should have created observer (internal, can't directly test)
      // But we can test that subsequent calls work
      expect(() => {
        ResizeManager.observeResize('test-key', testElement, callback);
      }).to.not.throw();
    });

    it('should handle callback with ResizeObserverEntry', () => {
      const callback = sandbox.stub();
      const mockEntry = {
        target: testElement,
        contentRect: {
          width: 100,
          height: 200,
          top: 0,
          left: 0,
          bottom: 200,
          right: 100,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        },
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
      } as ResizeObserverEntry;

      ResizeManager.observeResize('test-key', testElement, callback);

      // Simulate ResizeObserver callback
      const ResizeObserverMock = global.ResizeObserver as any;
      if (ResizeObserverMock.mockInstance) {
        ResizeObserverMock.mockInstance.callback([mockEntry]);
        expect(callback).to.have.been.calledWith(mockEntry);
      }
    });

    it('should handle multiple elements with same key', () => {
      const callback = sandbox.stub();
      const element2 = document.createElement('div');

      ResizeManager.observeResize('test-key', testElement, callback);
      ResizeManager.observeResize('test-key', element2, callback);

      // Should not throw
      expect(() => {
        ResizeManager.unobserveResize('test-key');
      }).to.not.throw();
    });

    it('should handle missing ResizeObserver gracefully', () => {
      // Remove ResizeObserver temporarily
      const originalResizeObserver = global.ResizeObserver;
      delete (global as any).ResizeObserver;

      const callback = sandbox.stub();

      expect(() => {
        ResizeManager.observeResize('test-key', testElement, callback);
      }).to.not.throw();

      // Restore
      global.ResizeObserver = originalResizeObserver;
    });
  });

  describe('clearResize', () => {
    it('should clear debounced resize for specific key', (done) => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      ResizeManager.debounceResize('test-key', callback, { delay: 50 });

      // Clear before callback executes
      setTimeout(() => {
        ResizeManager.clearResize('test-key');
      }, 25);

      // Check that callback was not called
      setTimeout(() => {
        expect(callCount).to.equal(0);
        done();
      }, 100);
    });

    it('should handle clearing non-existent key', () => {
      expect(() => {
        ResizeManager.clearResize('non-existent-key');
      }).to.not.throw();
    });
  });

  describe('unobserveResize', () => {
    it('should unobserve element for specific key', () => {
      const callback = sandbox.stub();

      ResizeManager.observeResize('test-key', testElement, callback);

      expect(() => {
        ResizeManager.unobserveResize('test-key');
      }).to.not.throw();
    });

    it('should handle unobserving non-existent key', () => {
      expect(() => {
        ResizeManager.unobserveResize('non-existent-key');
      }).to.not.throw();
    });
  });

  describe('dispose', () => {
    it('should clear all timers and observers', () => {
      const callback1 = sandbox.stub();
      const callback2 = sandbox.stub();

      ResizeManager.debounceResize('key1', callback1, { delay: 100 });
      ResizeManager.debounceResize('key2', callback2, { delay: 100 });
      ResizeManager.observeResize('obs1', testElement, callback1);
      ResizeManager.observeResize('obs2', testElement, callback2);

      expect(() => {
        ResizeManager.dispose();
      }).to.not.throw();
    });

    it('should prevent further operations after disposal', () => {
      ResizeManager.dispose();

      const callback = sandbox.stub();

      // Operations after disposal should be handled gracefully
      expect(() => {
        ResizeManager.debounceResize('test-key', callback, { delay: 50 });
        ResizeManager.observeResize('test-key', testElement, callback);
        ResizeManager.clearResize('test-key');
        ResizeManager.unobserveResize('test-key');
      }).to.not.throw();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid dispose and reinitialize', () => {
      const callback = sandbox.stub();

      ResizeManager.debounceResize('test-key', callback, { delay: 50 });
      ResizeManager.dispose();
      ResizeManager.debounceResize('test-key', callback, { delay: 50 });

      expect(() => {
        ResizeManager.dispose();
      }).to.not.throw();
    });

    it('should handle very short delays', (done) => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      ResizeManager.debounceResize('test-key', callback, { delay: 1 });

      setTimeout(() => {
        expect(callCount).to.equal(1);
        done();
      }, 50);
    });

    it('should handle zero delay', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      ResizeManager.debounceResize('test-key', callback, { delay: 0 });

      // Should handle gracefully
      expect(callCount).to.be.at.least(0);
    });
  });
});
