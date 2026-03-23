/**
 * PerformanceMonitor Unit Tests
 *
 * Tests for performance monitoring utilities including
 * metrics collection and bounded growth.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceMonitor } from '../../../../utils/PerformanceOptimizer';

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  log: vi.fn(),
}));

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // Reset singleton for each test
    (PerformanceMonitor as any).instance = undefined;
    monitor = PerformanceMonitor.getInstance();
    monitor.clearMetrics();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = PerformanceMonitor.getInstance();
      const instance2 = PerformanceMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('timer operations', () => {
    it('should start and end timer', () => {
      monitor.startTimer('test-op');
      const duration = monitor.endTimer('test-op');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return null for unknown timer', () => {
      const duration = monitor.endTimer('unknown');
      expect(duration).toBeNull();
    });

    it('should return metrics', () => {
      monitor.startTimer('op1');
      monitor.endTimer('op1');

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveProperty('op1');
    });
  });

  describe('Bug #6: metrics unbounded growth', () => {
    it('should not grow beyond MAX_METRICS_SIZE entries', () => {
      const MAX_SIZE = 1000;

      // Add more entries than the max
      for (let i = 0; i < MAX_SIZE + 200; i++) {
        monitor.startTimer(`metric-${i}`);
        monitor.endTimer(`metric-${i}`);
      }

      // The metrics map should not exceed MAX_SIZE
      const metrics = monitor.getMetrics();
      const metricCount = Object.keys(metrics).length;
      expect(metricCount).toBeLessThanOrEqual(MAX_SIZE);
    });

    it('should evict oldest entries when max size is reached', () => {
      const MAX_SIZE = 1000;

      // Fill to capacity
      for (let i = 0; i < MAX_SIZE; i++) {
        monitor.startTimer(`old-metric-${i}`);
        monitor.endTimer(`old-metric-${i}`);
      }

      // Add one more
      monitor.startTimer('new-metric');
      monitor.endTimer('new-metric');

      const metrics = monitor.getMetrics();
      // The newest metric should be present
      expect(metrics).toHaveProperty('new-metric');
      // Total count should not exceed MAX_SIZE
      expect(Object.keys(metrics).length).toBeLessThanOrEqual(MAX_SIZE);
    });

    it('should clear all metrics', () => {
      monitor.startTimer('op1');
      monitor.endTimer('op1');

      monitor.clearMetrics();

      const metrics = monitor.getMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });
  });
});
