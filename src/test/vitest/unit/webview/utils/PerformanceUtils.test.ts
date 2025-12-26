/**
 * PerformanceUtils Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestEnvironment, resetTestEnvironment } from '../../../../shared/TestSetup';
import { PerformanceUtils } from '../../../../../webview/utils/PerformanceUtils';

describe('PerformanceUtils', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.useFakeTimers();

    // Mock requestAnimationFrame and cancelAnimationFrame
    (global as any).requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    (global as any).cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetTestEnvironment();
    delete (global as any).requestAnimationFrame;
    delete (global as any).cancelAnimationFrame;
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const mockFn = vi.fn();
      const debouncedFn = PerformanceUtils.debounce(mockFn, 50);

      debouncedFn('test1');
      debouncedFn('test2');
      debouncedFn('test3');

      expect(mockFn).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFn).toHaveBeenCalledOnce();
      expect(mockFn).toHaveBeenCalledWith('test3');
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should handle multiple debounced calls', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const mockFn = vi.fn();
      const debouncedFn = PerformanceUtils.debounce(mockFn, 30);

      debouncedFn('first');
      await new Promise((resolve) => setTimeout(resolve, 15));
      debouncedFn('second');
      await new Promise((resolve) => setTimeout(resolve, 15));
      debouncedFn('third');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockFn).toHaveBeenCalledOnce();
      expect(mockFn).toHaveBeenCalledWith('third');
      vi.useFakeTimers(); // Restore fake timers
    });
  });

  describe.skip('throttle', () => {
    it('should create throttled function', () => {
      const mockFn = vi.fn();
      const throttledFn = PerformanceUtils.throttle(mockFn, 100);

      expect(throttledFn).toBeTypeOf('function');

      // Call immediately - should execute right away
      throttledFn('test1');

      // At minimum, verify function was created successfully
      expect(mockFn).toHaveBeenCalled();
    });

    it('should limit rapid calls', () => {
      const mockFn = vi.fn();
      const throttledFn = PerformanceUtils.throttle(mockFn, 100);

      // First call should execute immediately
      throttledFn('first');
      expect(mockFn).toHaveBeenCalledOnce();

      // Rapid subsequent calls within throttle period
      throttledFn('second');
      throttledFn('third');

      // Should still only have been called once immediately
      expect(mockFn).toHaveBeenCalledOnce();
    });
  });

  describe('requestIdleCallback', () => {
    it('should execute callback when idle', async () => {
      const callback = vi.fn();

      PerformanceUtils.requestIdleCallback(callback);

      // Advance timers to trigger the setTimeout fallback
      vi.advanceTimersByTime(1);
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalled();
    });

    it('should handle timeout option', async () => {
      const callback = vi.fn();

      PerformanceUtils.requestIdleCallback(callback, 100);

      vi.advanceTimersByTime(1);
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('measurePerformance', () => {
    it('should measure function performance', () => {
      const testFn = () => {
        // Simulate some work
        for (let i = 0; i < 1000; i++) {
          Math.random();
        }
      };

      const result = PerformanceUtils.measurePerformance('test-operation', testFn);
      expect(result).not.toBeTypeOf('number'); // Returns the function result, not duration
    });

    it('should handle function with return value', () => {
      const testFn = () => 'test result';
      const result = PerformanceUtils.measurePerformance('test-with-return', testFn);
      expect(result).toBe('test result');
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage info', () => {
      // Mock performance.memory
      (global as any).performance = {
        memory: {
          usedJSHeapSize: 1000000,
          totalJSHeapSize: 2000000,
          jsHeapSizeLimit: 4000000,
        },
      };

      const usage = PerformanceUtils.getMemoryUsage();
      expect(usage).toBeTypeOf('object');
      expect(usage).toHaveProperty('usedJSHeapSize', 1000000);
      expect(usage).toHaveProperty('totalJSHeapSize', 2000000);
      expect(usage).toHaveProperty('jsHeapSizeLimit', 4000000);
    });

    it('should handle missing performance.memory', () => {
      // Save original performance
      const originalPerf = (global as any).performance;

      // Set performance without memory property
      (global as any).performance = {};

      const usage = PerformanceUtils.getMemoryUsage();
      expect(usage).toBeNull();

      // Restore original performance
      (global as any).performance = originalPerf;
    });
  });

  describe('deepClone', () => {
    it('should clone simple objects', () => {
      const original = { name: 'test', value: 42 };
      const cloned = PerformanceUtils.deepClone(original);

      expect(cloned).not.toBe(original);
      expect(cloned).toEqual(original);
    });

    it('should clone arrays', () => {
      const original = [1, 2, { nested: 'value' }];
      const cloned = PerformanceUtils.deepClone(original);

      expect(cloned).not.toBe(original);
      expect(cloned).toEqual(original);
      expect(cloned[2]).not.toBe(original[2]);
    });

    it('should handle null and primitive values', () => {
      expect(PerformanceUtils.deepClone(null)).toBeNull();
      expect(PerformanceUtils.deepClone(42)).toBe(42);
      expect(PerformanceUtils.deepClone('test')).toBe('test');
    });
  });
});
