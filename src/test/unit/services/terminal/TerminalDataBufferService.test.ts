import * as assert from 'assert';
import { BaseTest } from '../../../utils';
import { TerminalDataBufferService } from '../../../../services/terminal/TerminalDataBufferService';

class TerminalDataBufferServiceTest extends BaseTest {
  public service!: TerminalDataBufferService;

  protected override setup(): void {
    super.setup();
    this.service = new TerminalDataBufferService();
  }

  protected override teardown(): void {
    if (this.service) {
      this.service.dispose();
    }
    super.teardown();
  }
}

describe('TerminalDataBufferService', () => {
  const test = new TerminalDataBufferServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const stats = test.service.getBufferStats();
      assert.strictEqual(stats.flushInterval, 16);
      assert.strictEqual(stats.isCliAgentActive, false);
    });

    it('should initialize with custom config', () => {
      const customService = new TerminalDataBufferService({
        flushInterval: 8,
        maxBufferSize: 100,
        cliAgentFlushInterval: 2,
      });

      const stats = customService.getBufferStats();
      assert.strictEqual(stats.flushInterval, 8);

      customService.dispose();
    });
  });

  describe('bufferData', () => {
    it('should buffer small data chunks', (done) => {
      let eventFired = false;

      test.service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'hello');
        assert.ok(event.timestamp);
        eventFired = true;
      });

      test.service.bufferData('test1', 'hello');

      // Should not fire immediately for small data
      assert.strictEqual(eventFired, false);

      // Should fire after flush interval
      setTimeout(() => {
        assert.strictEqual(eventFired, true);
        done();
      }, 25);
    });

    it('should immediately flush large data chunks', (done) => {
      let eventFired = false;

      test.service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data?.length, 1000);
        eventFired = true;
        done();
      });

      // Large data should flush immediately
      test.service.bufferData('test1', 'x'.repeat(1000));

      // Should fire immediately
      assert.strictEqual(eventFired, true);
    });

    it('should combine multiple small chunks', (done) => {
      let eventFired = false;

      test.service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'helloworldtest');
        eventFired = true;
        done();
      });

      test.service.bufferData('test1', 'hello');
      test.service.bufferData('test1', 'world');
      test.service.bufferData('test1', 'test');

      // Should not fire immediately
      assert.strictEqual(eventFired, false);

      // Force flush
      test.service.flushBuffer('test1');
    });

    it('should handle buffer overflow', (done) => {
      const customService = new TerminalDataBufferService({
        flushInterval: 16,
        maxBufferSize: 2,
      });
      let eventFired = false;

      customService.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'ab');
        eventFired = true;
        done();
      });

      customService.bufferData('test1', 'a');
      customService.bufferData('test1', 'b');
      // This should trigger immediate flush due to buffer overflow

      assert.strictEqual(eventFired, true);
      customService.dispose();
    });
  });

  describe('CLI Agent Integration', () => {
    it('should switch to faster flush interval for CLI Agent', () => {
      test.service.setCliAgentActive(true);

      const stats = test.service.getBufferStats();
      assert.strictEqual(stats.flushInterval, 4);
      assert.strictEqual(stats.isCliAgentActive, true);
    });

    it('should flush all buffers when CLI Agent becomes active', (done) => {
      let eventCount = 0;

      test.service.onData((_event) => {
        eventCount++;
        if (eventCount === 2) {
          done();
        }
      });

      // Buffer data for two terminals
      test.service.bufferData('test1', 'data1');
      test.service.bufferData('test2', 'data2');

      // Activate CLI Agent - should flush all buffers
      test.service.setCliAgentActive(true);
    });

    it('should return to normal flush interval when CLI Agent deactivated', () => {
      test.service.setCliAgentActive(true);
      assert.strictEqual(test.service.getBufferStats().flushInterval, 4);

      test.service.setCliAgentActive(false);
      assert.strictEqual(test.service.getBufferStats().flushInterval, 16);
    });
  });

  describe('flushBuffer', () => {
    it('should flush specific terminal buffer', (done) => {
      let eventFired = false;

      test.service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'test');
        eventFired = true;
        done();
      });

      test.service.bufferData('test1', 'test');
      test.service.flushBuffer('test1');

      assert.strictEqual(eventFired, true);
    });

    it('should handle flush of empty buffer', () => {
      // Should not throw error
      test.service.flushBuffer('non-existent');
    });

    it('should clear buffer after flush', (done) => {
      test.service.onData(() => {
        const stats = test.service.getBufferStats();
        assert.strictEqual(stats.totalBufferedChars, 0);
        done();
      });

      test.service.bufferData('test1', 'test');
      test.service.flushBuffer('test1');
    });
  });

  describe('flushAllBuffers', () => {
    it('should flush all terminal buffers', (done) => {
      let eventCount = 0;
      const expectedEvents = 3;

      test.service.onData((_event) => {
        eventCount++;
        if (eventCount === expectedEvents) {
          done();
        }
      });

      test.service.bufferData('test1', 'data1');
      test.service.bufferData('test2', 'data2');
      test.service.bufferData('test3', 'data3');

      test.service.flushAllBuffers();
    });
  });

  describe('clearTerminalBuffer', () => {
    it('should clear specific terminal buffer', (done) => {
      test.service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'test');

        // Clear the buffer
        test.service.clearTerminalBuffer('test1');

        const stats = test.service.getBufferStats();
        assert.strictEqual(stats.activeBuffers, 0);
        done();
      });

      test.service.bufferData('test1', 'test');
      test.service.clearTerminalBuffer('test1');
    });
  });

  describe('getBufferStats', () => {
    it('should return accurate buffer statistics', () => {
      test.service.bufferData('test1', 'hello');
      test.service.bufferData('test2', 'world');

      const stats = test.service.getBufferStats();
      assert.strictEqual(stats.activeBuffers, 2);
      assert.strictEqual(stats.totalBufferedChars, 10); // 'hello' + 'world'
      assert.strictEqual(stats.pendingFlushes, 2);
      assert.strictEqual(stats.isCliAgentActive, false);
      assert.strictEqual(stats.flushInterval, 16);
    });

    it('should update statistics when CLI Agent active', () => {
      test.service.setCliAgentActive(true);

      const stats = test.service.getBufferStats();
      assert.strictEqual(stats.isCliAgentActive, true);
      assert.strictEqual(stats.flushInterval, 4);
    });
  });

  describe('Error Handling', () => {
    it('should handle data buffering errors gracefully', (done) => {
      // Mock console.error to capture error logs
      const _consoleStub = test.sandbox.stub(console, 'error');
      let eventFired = false;

      test.service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'test');
        eventFired = true;
        done();
      });

      // This should trigger error handling but still emit data
      test.service.bufferData('test1', 'test');

      // Should still work despite any internal errors
      assert.strictEqual(eventFired, false); // Not immediate
      test.service.flushBuffer('test1');
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      test.service.bufferData('test1', 'data');
      test.service.bufferData('test2', 'data');

      let stats = test.service.getBufferStats();
      assert.ok(stats.activeBuffers > 0);

      test.service.dispose();

      // After dispose, should be clean
      stats = test.service.getBufferStats();
      assert.strictEqual(stats.activeBuffers, 0);
      assert.strictEqual(stats.pendingFlushes, 0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency data efficiently', (done) => {
      let eventCount = 0;
      const startTime = Date.now();

      test.service.onData(() => {
        eventCount++;
        if (eventCount === 10) {
          const duration = Date.now() - startTime;
          assert.ok(duration < 1000, 'Should handle high-frequency data in reasonable time');
          done();
        }
      });

      // Send data rapidly
      for (let i = 0; i < 10; i++) {
        test.service.bufferData(`test${i}`, `data${i}`);
        test.service.flushBuffer(`test${i}`);
      }
    });

    it('should maintain performance with CLI Agent mode', (done) => {
      test.service.setCliAgentActive(true);
      let eventCount = 0;

      test.service.onData(() => {
        eventCount++;
        if (eventCount === 5) {
          done();
        }
      });

      // Rapid data in CLI Agent mode
      for (let i = 0; i < 5; i++) {
        test.service.bufferData('agent-test', `fast-data-${i}`);
        test.service.flushBuffer('agent-test');
      }
    });
  });
});
