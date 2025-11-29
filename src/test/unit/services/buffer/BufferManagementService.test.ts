/**
 * BufferManagementService Unit Tests
 *
 * Tests for the buffer management service.
 */

import { expect } from 'chai';
import { EventBus } from '../../../../core/EventBus';
import {
  BufferManagementService,
  BufferFlushedEvent,
  BufferOverflowEvent,
} from '../../../../services/buffer/BufferManagementService';

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
      expect(stats).to.exist;
      expect(stats?.terminalId).to.equal(1);
      expect(stats?.currentSize).to.equal(0);
    });

    it('should initialize buffer with custom configuration', () => {
      service.initializeBuffer(1, {
        flushInterval: 100,
        maxBufferSize: 1000,
      });

      expect(service.getFlushInterval(1)).to.equal(100);
    });

    it('should not reinitialize existing buffer', () => {
      service.initializeBuffer(1);
      service.write(1, 'test');

      service.initializeBuffer(1); // Should not clear buffer

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).to.be.greaterThan(0);
    });
  });

  describe('Buffer Write Operations', () => {
    it('should write data to buffer', () => {
      service.initializeBuffer(1);

      const buffered = service.write(1, 'test data');

      expect(buffered).to.be.true;

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).to.equal(9);
    });

    it('should initialize buffer on-demand', () => {
      const buffered = service.write(1, 'test');

      expect(buffered).to.be.true;
      expect(service.getBufferStats(1)).to.exist;
    });

    it('should accumulate multiple writes', () => {
      service.initializeBuffer(1);

      service.write(1, 'Hello ');
      service.write(1, 'World');

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).to.equal(11);
    });

    it('should flush immediately on buffer overflow', () => {
      service.initializeBuffer(1, { maxBufferSize: 10 });

      let overflowEventReceived = false;
      eventBus.subscribe(BufferOverflowEvent, () => {
        overflowEventReceived = true;
      });

      service.write(1, '12345');
      const buffered = service.write(1, '67890X'); // Exceeds maxBufferSize

      expect(buffered).to.be.false; // Flushed immediately
      expect(overflowEventReceived).to.be.true;

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).to.equal(0); // Buffer cleared after flush
    });
  });

  describe('Buffer Flush Operations', () => {
    it('should flush buffer and return data', () => {
      service.initializeBuffer(1);
      service.write(1, 'test');

      const data = service.flush(1);

      expect(data).to.equal('test');

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).to.equal(0);
    });

    it('should return empty string for empty buffer', () => {
      service.initializeBuffer(1);

      const data = service.flush(1);

      expect(data).to.equal('');
    });

    it('should update flush statistics', () => {
      service.initializeBuffer(1);
      service.write(1, 'data1');
      service.flush(1);
      service.write(1, 'data2');
      service.flush(1);

      const stats = service.getBufferStats(1);
      expect(stats?.flushCount).to.equal(2);
    });

    it('should publish flush event', () => {
      let flushedData = '';
      eventBus.subscribe(BufferFlushedEvent, (event) => {
        flushedData = event.data.data;
      });

      service.initializeBuffer(1);
      service.write(1, 'test');
      service.flush(1);

      expect(flushedData).to.equal('test');
    });

    it('should flush all buffers', () => {
      service.initializeBuffer(1);
      service.initializeBuffer(2);
      service.write(1, 'data1');
      service.write(2, 'data2');

      const result = service.flushAll();

      expect(result.size).to.equal(2);
      expect(result.get(1)).to.equal('data1');
      expect(result.get(2)).to.equal('data2');
    });
  });

  describe('Flush Interval Management', () => {
    it('should set flush interval', () => {
      service.initializeBuffer(1);

      service.setFlushInterval(1, 200);

      expect(service.getFlushInterval(1)).to.equal(200);
    });

    it('should get default flush interval for uninitialized buffer', () => {
      const interval = service.getFlushInterval(999);

      expect(interval).to.equal(16); // Default
    });

    it('should auto-flush after interval', function (done) {
      this.timeout(100);

      service.initializeBuffer(1, { flushInterval: 20 });

      let flushed = false;
      eventBus.subscribe(BufferFlushedEvent, () => {
        flushed = true;
      });

      service.write(1, 'test');

      setTimeout(() => {
        expect(flushed).to.be.true;
        done();
      }, 30);
    });
  });

  describe('Adaptive Buffering', () => {
    it('should enable adaptive buffering', () => {
      service.initializeBuffer(1, { adaptiveBuffering: false });

      service.enableAdaptiveBuffering(1);

      // Verify by checking CLI agent mode behavior
      service.onCliAgentDetected(1);
      expect(service.getFlushInterval(1)).to.equal(4); // CLI agent interval
    });

    it('should disable adaptive buffering', () => {
      service.initializeBuffer(1, { adaptiveBuffering: true });

      service.disableAdaptiveBuffering(1);

      // Verify by checking CLI agent mode doesn't change interval
      const originalInterval = service.getFlushInterval(1);
      service.onCliAgentDetected(1);
      expect(service.getFlushInterval(1)).to.equal(originalInterval);
    });
  });

  describe('CLI Agent Mode', () => {
    it('should switch to high-performance mode on CLI agent detection', () => {
      service.initializeBuffer(1, { adaptiveBuffering: true });

      service.onCliAgentDetected(1);

      expect(service.getFlushInterval(1)).to.equal(4); // 250fps mode
    });

    it('should return to normal mode on CLI agent disconnection', () => {
      service.initializeBuffer(1, { adaptiveBuffering: true });

      service.onCliAgentDetected(1);
      service.onCliAgentDisconnected(1);

      expect(service.getFlushInterval(1)).to.equal(16); // Normal mode
    });

    it('should not change interval if adaptive buffering is disabled', () => {
      service.initializeBuffer(1, {
        adaptiveBuffering: false,
        flushInterval: 50,
      });

      service.onCliAgentDetected(1);

      expect(service.getFlushInterval(1)).to.equal(50); // Unchanged
    });
  });

  describe('Buffer Statistics', () => {
    it('should return buffer statistics', () => {
      service.initializeBuffer(1);
      service.write(1, 'test');

      const stats = service.getBufferStats(1);

      expect(stats).to.exist;
      if (stats) {
        expect(stats.terminalId).to.equal(1);
        expect(stats.currentSize).to.equal(4);
        expect(stats.flushCount).to.equal(0);
        expect(stats.lastFlushAt).to.be.instanceOf(Date);
      }
    });

    it('should return undefined for non-existent buffer', () => {
      const stats = service.getBufferStats(999);

      expect(stats).to.be.undefined;
    });

    it('should get all buffer statistics', () => {
      service.initializeBuffer(1);
      service.initializeBuffer(2);
      service.initializeBuffer(3);

      const allStats = service.getAllBufferStats();

      expect(allStats).to.have.length(3);
      expect(allStats[0]?.terminalId).to.equal(1);
      expect(allStats[1]?.terminalId).to.equal(2);
      expect(allStats[2]?.terminalId).to.equal(3);
    });

    it('should return empty array when no buffers exist', () => {
      const allStats = service.getAllBufferStats();

      expect(allStats).to.be.an('array').that.is.empty;
    });
  });

  describe('Buffer Clear and Disposal', () => {
    it('should clear buffer without disposing', () => {
      service.initializeBuffer(1);
      service.write(1, 'test');

      service.clearBuffer(1);

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).to.equal(0);
      expect(stats).to.exist; // Buffer still exists
    });

    it('should dispose buffer and flush data', () => {
      let flushedData = '';
      eventBus.subscribe(BufferFlushedEvent, (event) => {
        flushedData = event.data.data;
      });

      service.initializeBuffer(1);
      service.write(1, 'test');

      service.disposeBuffer(1);

      expect(flushedData).to.equal('test');
      expect(service.getBufferStats(1)).to.be.undefined;
    });

    it('should dispose all buffers', () => {
      service.initializeBuffer(1);
      service.initializeBuffer(2);
      service.write(1, 'data1');
      service.write(2, 'data2');

      service.dispose();

      expect(service.getAllBufferStats()).to.be.empty;
    });

    it('should throw error when using disposed service', () => {
      service.dispose();

      expect(() => service.initializeBuffer(1)).to.throw(
        'Cannot use disposed BufferManagementService'
      );
    });

    it('should allow multiple dispose calls', () => {
      service.dispose();
      service.dispose(); // Should not throw

      expect(true).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle write to non-existent buffer gracefully', () => {
      // Should auto-initialize
      expect(() => service.write(999, 'test')).to.not.throw();
    });

    it('should handle flush of non-existent buffer gracefully', () => {
      const data = service.flush(999);

      expect(data).to.equal('');
    });

    it('should handle clear of non-existent buffer gracefully', () => {
      expect(() => service.clearBuffer(999)).to.not.throw();
    });

    it('should handle dispose of non-existent buffer gracefully', () => {
      expect(() => service.disposeBuffer(999)).to.not.throw();
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

      expect(duration).to.be.lessThan(50); // Should complete quickly
    });

    it('should handle multiple terminals', () => {
      for (let i = 1; i <= 10; i++) {
        service.initializeBuffer(i);
        service.write(i, `data for terminal ${i}`);
      }

      const allStats = service.getAllBufferStats();

      expect(allStats).to.have.length(10);
    });

    it('should clean up timers on disposal', function (done) {
      this.timeout(100);

      service.initializeBuffer(1, { flushInterval: 10 });

      service.dispose();

      // Wait to ensure no timer fires
      setTimeout(() => {
        // Test passes if no error is thrown
        done();
      }, 50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string writes', () => {
      service.initializeBuffer(1);

      service.write(1, '');

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).to.equal(0);
    });

    it('should handle very large buffer sizes', () => {
      service.initializeBuffer(1, { maxBufferSize: 10000 });

      const largeData = 'x'.repeat(5000);
      service.write(1, largeData);

      const stats = service.getBufferStats(1);
      expect(stats?.currentSize).to.equal(5000);
    });

    it('should handle flush of empty buffer multiple times', () => {
      service.initializeBuffer(1);

      service.flush(1);
      service.flush(1);
      service.flush(1);

      const stats = service.getBufferStats(1);
      expect(stats?.flushCount).to.equal(0); // No data to flush
    });
  });
});
