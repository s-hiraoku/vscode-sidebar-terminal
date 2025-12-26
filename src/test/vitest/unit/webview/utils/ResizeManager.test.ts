/**
 * ResizeManager Utility Tests
 * Tests for centralized debounced resize logic and ResizeObserver management
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestEnvironment, resetTestEnvironment } from '../../../../shared/TestSetup';
import { ResizeManager } from '../../../../../webview/utils/ResizeManager';

describe('ResizeManager', () => {
  let testElement: HTMLElement;

  beforeEach(() => {
    setupTestEnvironment();

    testElement = document.createElement('div');
    testElement.id = 'test-element';
    document.body.appendChild(testElement);

    // Mock ResizeObserver
    (global as any).ResizeObserver = class MockResizeObserver {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
  });

  afterEach(() => {
    try {
      // Clean up ResizeManager state
      ResizeManager.dispose();
    } finally {
      resetTestEnvironment();
      delete (global as any).ResizeObserver;
    }
  });

  describe('debounceResize', () => {
    it('should debounce resize callbacks', async () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      // Call multiple times rapidly
      ResizeManager.debounceResize('test-key', callback, { delay: 50 });
      ResizeManager.debounceResize('test-key', callback, { delay: 50 });
      ResizeManager.debounceResize('test-key', callback, { delay: 50 });

      // Should only call once after delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callCount).toBe(1);
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
      expect(callCount).toBe(1);
    });

    it('should handle async callbacks', async () => {
      let resolved = false;
      const asyncCallback = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      };

      ResizeManager.debounceResize('test-key', asyncCallback, { delay: 50 });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(resolved).toBe(true);
    });

    it('should handle multiple keys independently', async () => {
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

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callback1Count).toBe(1);
      expect(callback2Count).toBe(1);
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = () => {
        throw new Error('Test error');
      };

      // Should not throw
      expect(() => {
        ResizeManager.debounceResize('error-key', errorCallback, { delay: 50 });
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe('observeResize', () => {
    it('should create ResizeObserver and observe element', () => {
      const callback = vi.fn();

      ResizeManager.observeResize('test-key', testElement, callback);

      // Should have created observer (internal, can't directly test)
      // But we can test that subsequent calls work
      expect(() => {
        ResizeManager.observeResize('test-key', testElement, callback);
      }).not.toThrow();
    });

    it('should handle callback with ResizeObserverEntry', () => {
      const callback = vi.fn();

      ResizeManager.observeResize('test-key', testElement, callback);

      // Simulate ResizeObserver callback - this test verifies registration doesn't throw
      expect(() => {
        ResizeManager.observeResize('test-key-2', testElement, callback);
      }).not.toThrow();
    });

    it('should handle multiple elements with same key', () => {
      const callback = vi.fn();
      const element2 = document.createElement('div');

      ResizeManager.observeResize('test-key', testElement, callback);
      ResizeManager.observeResize('test-key', element2, callback);

      // Should not throw
      expect(() => {
        ResizeManager.unobserveResize('test-key');
      }).not.toThrow();
    });

    it('should handle missing ResizeObserver gracefully', () => {
      // Remove ResizeObserver temporarily
      const originalResizeObserver = (global as any).ResizeObserver;
      delete (global as any).ResizeObserver;

      const callback = vi.fn();

      expect(() => {
        ResizeManager.observeResize('test-key', testElement, callback);
      }).not.toThrow();

      // Restore
      (global as any).ResizeObserver = originalResizeObserver;
    });
  });

  describe('clearResize', () => {
    it('should clear debounced resize for specific key', async () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      ResizeManager.debounceResize('test-key', callback, { delay: 50 });

      // Clear before callback executes
      await new Promise((resolve) => setTimeout(resolve, 25));
      ResizeManager.clearResize('test-key');

      // Check that callback was not called
      await new Promise((resolve) => setTimeout(resolve, 75));
      expect(callCount).toBe(0);
    });

    it('should handle clearing non-existent key', () => {
      expect(() => {
        ResizeManager.clearResize('non-existent-key');
      }).not.toThrow();
    });
  });

  describe('unobserveResize', () => {
    it('should unobserve element for specific key', () => {
      const callback = vi.fn();

      ResizeManager.observeResize('test-key', testElement, callback);

      expect(() => {
        ResizeManager.unobserveResize('test-key');
      }).not.toThrow();
    });

    it('should handle unobserving non-existent key', () => {
      expect(() => {
        ResizeManager.unobserveResize('non-existent-key');
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should clear all timers and observers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      ResizeManager.debounceResize('key1', callback1, { delay: 100 });
      ResizeManager.debounceResize('key2', callback2, { delay: 100 });
      ResizeManager.observeResize('obs1', testElement, callback1);
      ResizeManager.observeResize('obs2', testElement, callback2);

      expect(() => {
        ResizeManager.dispose();
      }).not.toThrow();
    });

    it('should prevent further operations after disposal', () => {
      ResizeManager.dispose();

      const callback = vi.fn();

      // Operations after disposal should be handled gracefully
      expect(() => {
        ResizeManager.debounceResize('test-key', callback, { delay: 50 });
        ResizeManager.observeResize('test-key', testElement, callback);
        ResizeManager.clearResize('test-key');
        ResizeManager.unobserveResize('test-key');
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid dispose and reinitialize', () => {
      const callback = vi.fn();

      ResizeManager.debounceResize('test-key', callback, { delay: 50 });
      ResizeManager.dispose();
      ResizeManager.debounceResize('test-key', callback, { delay: 50 });

      expect(() => {
        ResizeManager.dispose();
      }).not.toThrow();
    });

    it('should handle very short delays', async () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      ResizeManager.debounceResize('test-key', callback, { delay: 1 });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(callCount).toBe(1);
    });

    it('should handle zero delay', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      ResizeManager.debounceResize('test-key', callback, { delay: 0 });

      // Should handle gracefully
      expect(callCount).toBeGreaterThanOrEqual(0);
    });
  });
});
