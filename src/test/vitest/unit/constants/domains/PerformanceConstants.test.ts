/**
 * PerformanceConstants Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { PERFORMANCE_CONSTANTS } from '../../../../../constants/domains/PerformanceConstants';

describe('PerformanceConstants', () => {
  describe('Timeout Settings', () => {
    it('should have valid initialization timeout', () => {
      expect(PERFORMANCE_CONSTANTS.DEFAULT_INITIALIZATION_TIMEOUT_MS).toBe(5000);
      expect(PERFORMANCE_CONSTANTS.DEFAULT_INITIALIZATION_TIMEOUT_MS).toBeGreaterThan(0);
    });

    it('should have valid operation timeout', () => {
      expect(PERFORMANCE_CONSTANTS.DEFAULT_OPERATION_TIMEOUT_MS).toBe(30000);
      expect(PERFORMANCE_CONSTANTS.DEFAULT_OPERATION_TIMEOUT_MS).toBeGreaterThan(
        PERFORMANCE_CONSTANTS.DEFAULT_INITIALIZATION_TIMEOUT_MS
      );
    });

    it('should have valid WebView communication timeout', () => {
      expect(PERFORMANCE_CONSTANTS.WEBVIEW_COMMUNICATION_TIMEOUT_MS).toBe(3000);
    });
  });

  describe('Buffer Settings', () => {
    it('should have valid flush intervals', () => {
      expect(PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS).toBe(16); // 60fps
      expect(PERFORMANCE_CONSTANTS.CLI_AGENT_FAST_FLUSH_INTERVAL_MS).toBe(4); // 250fps
      expect(PERFORMANCE_CONSTANTS.ULTRA_FAST_FLUSH_INTERVAL_MS).toBe(2); // 500fps
    });

    it('should have faster interval for CLI agents than standard', () => {
      expect(PERFORMANCE_CONSTANTS.CLI_AGENT_FAST_FLUSH_INTERVAL_MS).toBeLessThan(
        PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS
      );
    });

    it('should have valid buffer size', () => {
      expect(PERFORMANCE_CONSTANTS.MAX_BUFFER_SIZE_BYTES).toBe(1024 * 1024); // 1MB
    });

    it('should have valid output thresholds', () => {
      expect(PERFORMANCE_CONSTANTS.SMALL_INPUT_THRESHOLD_BYTES).toBe(10);
      expect(PERFORMANCE_CONSTANTS.MODERATE_OUTPUT_THRESHOLD_BYTES).toBe(50);
      expect(PERFORMANCE_CONSTANTS.LARGE_OUTPUT_THRESHOLD_BYTES).toBe(500);
      expect(PERFORMANCE_CONSTANTS.IMMEDIATE_FLUSH_THRESHOLD_BYTES).toBe(1000);

      // Thresholds should be in ascending order
      expect(PERFORMANCE_CONSTANTS.SMALL_INPUT_THRESHOLD_BYTES).toBeLessThan(
        PERFORMANCE_CONSTANTS.MODERATE_OUTPUT_THRESHOLD_BYTES
      );
      expect(PERFORMANCE_CONSTANTS.MODERATE_OUTPUT_THRESHOLD_BYTES).toBeLessThan(
        PERFORMANCE_CONSTANTS.LARGE_OUTPUT_THRESHOLD_BYTES
      );
      expect(PERFORMANCE_CONSTANTS.LARGE_OUTPUT_THRESHOLD_BYTES).toBeLessThan(
        PERFORMANCE_CONSTANTS.IMMEDIATE_FLUSH_THRESHOLD_BYTES
      );
    });
  });

  describe('Retry Settings', () => {
    it('should have valid retry count', () => {
      expect(PERFORMANCE_CONSTANTS.DEFAULT_RETRY_COUNT).toBe(3);
      expect(PERFORMANCE_CONSTANTS.DEFAULT_RETRY_COUNT).toBeGreaterThan(0);
    });

    it('should have valid retry delay', () => {
      expect(PERFORMANCE_CONSTANTS.RETRY_DELAY_BASE_MS).toBe(1000);
      expect(PERFORMANCE_CONSTANTS.RETRY_DELAY_MULTIPLIER).toBe(2);
    });
  });

  describe('Memory Management', () => {
    it('should have valid cleanup interval', () => {
      expect(PERFORMANCE_CONSTANTS.CLEANUP_INTERVAL_MS).toBe(30000);
    });

    it('should have valid memory threshold', () => {
      expect(PERFORMANCE_CONSTANTS.MEMORY_PRESSURE_THRESHOLD_MB).toBe(100);
    });
  });
});
