// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
/**
 * BufferManagementService Unit Tests
 *
 * Tests for the buffer management service.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../../../../core/EventBus';
import {
  BufferManagementService,
  BufferFlushedEvent,
  BufferOverflowEvent,
} from '../../../../../services/buffer/BufferManagementService';

describe('BufferManagementService', () => {
  let eventBus: EventBus;
  let service: BufferManagementService;

  beforeEach(() => {
    eventBus = new EventBus();
    service = new BufferManagementService(eventBus);
  });

  afterEach(() => {
    service.dispose();
    eventBus.dispose();
  });

  describe('Buffer Initialization', () => {
    it('should initialize buffer with default configuration', () => {
      service.initializeBuffer(1);

      const stats = service.getBufferStats(1);
      expect(stats).toBeDefined();
      expect(stats?.terminalId).toBe(1);
      expect(stats?.currentSize).toBe(0);
    });

    it('should initialize buffer with custom configuration', () => {
      service.initializeBuffer(1, {
        flushInterval: 100,
        maxBufferSize: 1000,
      });

      expect(service.getFlushInterval(1)).toBe(100);
    });

    it('should not reinitialize existing buffer', () => {
      service.initializeBuffer(1);
      service.write(1, 'test');

      service.initializeBuffer(1); // Should not clear buffer

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).toBeGreaterThan(0);
    });
  });

  describe('Buffer Write Operations', () => {
    it('should write data to buffer', () => {
      service.initializeBuffer(1);

      const buffered = service.write(1, 'test data');

      expect(buffered).toBe(true);

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).toBe(9);
    });

    it('should initialize buffer on-demand', () => {
      const buffered = service.write(1, 'test');

      expect(buffered).toBe(true);
      expect(service.getBufferStats(1)).toBeDefined();
    });

    it('should accumulate multiple writes', () => {
      service.initializeBuffer(1);

      service.write(1, 'Hello ');
      service.write(1, 'World');

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).toBe(11);
    });

    it('should flush immediately on buffer overflow', () => {
      service.initializeBuffer(1, { maxBufferSize: 10 });

      let overflowEventReceived = false;
      eventBus.subscribe(BufferOverflowEvent, () => {
        overflowEventReceived = true;
      });

      service.write(1, '12345');
      const buffered = service.write(1, '67890X'); // Exceeds maxBufferSize

      expect(buffered).toBe(false); // Flushed immediately
      expect(overflowEventReceived).toBe(true);

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).toBe(0); // Buffer cleared after flush
    });
  });

  describe('Buffer Flush Operations', () => {
    it('should flush buffer and return data', () => {
      service.initializeBuffer(1);
      service.write(1, 'test');

      const data = service.flush(1);

      expect(data).toBe('test');

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).toBe(0);
    });

    it('should return empty string for empty buffer', () => {
      service.initializeBuffer(1);

      const data = service.flush(1);

      expect(data).toBe('');
    });

    it('should update flush statistics', () => {
      service.initializeBuffer(1);
      service.write(1, 'data1');
      service.flush(1);
      service.write(1, 'data2');
      service.flush(1);

      const stats = service.getBufferStats(1);
      expect(stats?.flushCount).toBe(2);
    });

    it('should publish flush event', () => {
      let flushedData = '';
      eventBus.subscribe(BufferFlushedEvent, (event) => {
        flushedData = event.data.data;
      });

      service.initializeBuffer(1);
      service.write(1, 'test');
      service.flush(1);

      expect(flushedData).toBe('test');
    });

    it('should flush all buffers', () => {
      service.initializeBuffer(1);
      service.initializeBuffer(2);
      service.write(1, 'data1');
      service.write(2, 'data2');

      const result = service.flushAll();

      expect(result.size).toBe(2);
      expect(result.get(1)).toBe('data1');
      expect(result.get(2)).toBe('data2');
    });
  });

  describe('Flush Interval Management', () => {
    it('should set flush interval', () => {
      service.initializeBuffer(1);

      service.setFlushInterval(1, 200);

      expect(service.getFlushInterval(1)).toBe(200);
    });

    it('should get default flush interval for uninitialized buffer', () => {
      const interval = service.getFlushInterval(999);

      expect(interval).toBe(16); // Default
    });

    it('should auto-flush after interval', async () => {
      service.initializeBuffer(1, { flushInterval: 20 });

      let flushed = false;
      eventBus.subscribe(BufferFlushedEvent, () => {
        flushed = true;
      });

      service.write(1, 'test');

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(flushed).toBe(true);
          resolve();
        }, 30);
      });
    }, 100);
  });

  describe('Adaptive Buffering', () => {
    it('should enable adaptive buffering', () => {
      service.initializeBuffer(1, { adaptiveBuffering: false });

      service.enableAdaptiveBuffering(1);

      // Verify by checking CLI agent mode behavior
      service.onCliAgentDetected(1);
      expect(service.getFlushInterval(1)).toBe(4); // CLI agent interval
    });

    it('should disable adaptive buffering', () => {
      service.initializeBuffer(1, { adaptiveBuffering: true });

      service.disableAdaptiveBuffering(1);

      // Verify by checking CLI agent mode doesn't change interval
      const originalInterval = service.getFlushInterval(1);
      service.onCliAgentDetected(1);
      expect(service.getFlushInterval(1)).toBe(originalInterval);
    });
  });

  describe('CLI Agent Mode', () => {
    it('should switch to high-performance mode on CLI agent detection', () => {
      service.initializeBuffer(1, { adaptiveBuffering: true });

      service.onCliAgentDetected(1);

      expect(service.getFlushInterval(1)).toBe(4); // 250fps mode
    });

    it('should return to normal mode on CLI agent disconnection', () => {
      service.initializeBuffer(1, { adaptiveBuffering: true });

      service.onCliAgentDetected(1);
      service.onCliAgentDisconnected(1);

      expect(service.getFlushInterval(1)).toBe(16); // Normal mode
    });

    it('should not change interval if adaptive buffering is disabled', () => {
      service.initializeBuffer(1, {
        adaptiveBuffering: false,
        flushInterval: 50,
      });

      service.onCliAgentDetected(1);

      expect(service.getFlushInterval(1)).toBe(50); // Unchanged
    });
  });

  describe('Buffer Statistics', () => {
    it('should return buffer statistics', () => {
      service.initializeBuffer(1);
      service.write(1, 'test');

      const stats = service.getBufferStats(1);

      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.terminalId).toBe(1);
        expect(stats.currentSize).toBe(4);
        expect(stats.flushCount).toBe(0);
        expect(stats.lastFlushAt).toBeInstanceOf(Date);
      }
    });

    it('should return undefined for non-existent buffer', () => {
      const stats = service.getBufferStats(999);

      expect(stats).toBeUndefined();
    });

    it('should get all buffer statistics', () => {
      service.initializeBuffer(1);
      service.initializeBuffer(2);
      service.initializeBuffer(3);

      const allStats = service.getAllBufferStats();

      expect(allStats).toHaveLength(3);
      expect(allStats[0]?.terminalId).toBe(1);
      expect(allStats[1]?.terminalId).toBe(2);
      expect(allStats[2]?.terminalId).toBe(3);
    });

    it('should return empty array when no buffers exist', () => {
      const allStats = service.getAllBufferStats();

      expect(allStats).toEqual([]);
    });
  });

  describe('Buffer Clear and Disposal', () => {
    it('should clear buffer without disposing', () => {
      service.initializeBuffer(1);
      service.write(1, 'test');

      service.clearBuffer(1);

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).toBe(0);
      expect(stats).toBeDefined(); // Buffer still exists
    });

    it('should dispose buffer and flush data', () => {
      let flushedData = '';
      eventBus.subscribe(BufferFlushedEvent, (event) => {
        flushedData = event.data.data;
      });

      service.initializeBuffer(1);
      service.write(1, 'test');

      service.disposeBuffer(1);

      expect(flushedData).toBe('test');
      expect(service.getBufferStats(1)).toBeUndefined();
    });

    it('should dispose all buffers', () => {
      service.initializeBuffer(1);
      service.initializeBuffer(2);
      service.write(1, 'data1');
      service.write(2, 'data2');

      service.dispose();

      expect(service.getAllBufferStats()).toEqual([]);
    });

    it('should throw error when using disposed service', () => {
      service.dispose();

      expect(() => service.initializeBuffer(1)).toThrow(
        'Cannot use disposed BufferManagementService'
      );
    });

    it('should allow multiple dispose calls', () => {
      service.dispose();
      service.dispose(); // Should not throw

      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle write to non-existent buffer gracefully', () => {
      // Should auto-initialize
      expect(() => service.write(999, 'test')).not.toThrow();
    });

    it('should handle flush of non-existent buffer gracefully', () => {
      const data = service.flush(999);

      expect(data).toBe('');
    });

    it('should handle clear of non-existent buffer gracefully', () => {
      expect(() => service.clearBuffer(999)).not.toThrow();
    });

    it('should handle dispose of non-existent buffer gracefully', () => {
      expect(() => service.disposeBuffer(999)).not.toThrow();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle rapid writes efficiently', () => {
      service.initializeBuffer(1, { maxBufferSize: 1000 });

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        service.write(1, `line ${i}\n`);
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // Should complete quickly
    });

    it('should handle multiple terminals', () => {
      for (let i = 1; i <= 10; i++) {
        service.initializeBuffer(i);
        service.write(i, `data for terminal ${i}`);
      }

      const allStats = service.getAllBufferStats();

      expect(allStats).toHaveLength(10);
    });

    it('should clean up timers on disposal', async () => {
      service.initializeBuffer(1, { flushInterval: 10 });

      service.dispose();

      // Wait to ensure no timer fires
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          // Test passes if no error is thrown
          resolve();
        }, 50);
      });
    }, 100);
  });

  describe('Edge Cases', () => {
    it('should handle empty string writes', () => {
      service.initializeBuffer(1);

      service.write(1, '');

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).toBe(0);
    });

    it('should handle very large buffer sizes', () => {
      service.initializeBuffer(1, { maxBufferSize: 10000 });

      const largeData = 'x'.repeat(5000);
      service.write(1, largeData);

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).toBe(5000);
    });

    it('should handle flush of empty buffer multiple times', () => {
      service.initializeBuffer(1);

      service.flush(1);
      service.flush(1);
      service.flush(1);

      const stats = service.getBufferStats(1);
      expect(stats?.flushCount).toBe(0); // No data to flush
    });
  });
});
