import * as assert from 'assert';
import * as sinon from 'sinon';
import { TerminalDataBufferService } from '../../../../services/terminal/TerminalDataBufferService';

describe('TerminalDataBufferService', () => {
  let service: TerminalDataBufferService;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new TerminalDataBufferService();
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const stats = service.getBufferStats();
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
      
      service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'hello');
        assert.ok(event.timestamp);
        eventFired = true;
      });

      service.bufferData('test1', 'hello');
      
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
      
      service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data?.length, 1000);
        eventFired = true;
        done();
      });

      // Large data should flush immediately
      service.bufferData('test1', 'x'.repeat(1000));
      
      // Should fire immediately
      assert.strictEqual(eventFired, true);
    });

    it('should combine multiple small chunks', (done) => {
      let eventFired = false;
      
      service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'helloworldtest');
        eventFired = true;
        done();
      });

      service.bufferData('test1', 'hello');
      service.bufferData('test1', 'world');
      service.bufferData('test1', 'test');
      
      // Should not fire immediately
      assert.strictEqual(eventFired, false);
      
      // Force flush
      service.flushBuffer('test1');
    });

    it('should handle buffer overflow', (done) => {
      const customService = new TerminalDataBufferService({ 
        flushInterval: 16, 
        maxBufferSize: 2 
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
      service.setCliAgentActive(true);
      
      const stats = service.getBufferStats();
      assert.strictEqual(stats.flushInterval, 4);
      assert.strictEqual(stats.isCliAgentActive, true);
    });

    it('should flush all buffers when CLI Agent becomes active', (done) => {
      let eventCount = 0;
      
      service.onData((_event) => {
        eventCount++;
        if (eventCount === 2) {
          done();
        }
      });

      // Buffer data for two terminals
      service.bufferData('test1', 'data1');
      service.bufferData('test2', 'data2');
      
      // Activate CLI Agent - should flush all buffers
      service.setCliAgentActive(true);
    });

    it('should return to normal flush interval when CLI Agent deactivated', () => {
      service.setCliAgentActive(true);
      assert.strictEqual(service.getBufferStats().flushInterval, 4);
      
      service.setCliAgentActive(false);
      assert.strictEqual(service.getBufferStats().flushInterval, 16);
    });
  });

  describe('flushBuffer', () => {
    it('should flush specific terminal buffer', (done) => {
      let eventFired = false;
      
      service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'test');
        eventFired = true;
        done();
      });

      service.bufferData('test1', 'test');
      service.flushBuffer('test1');
      
      assert.strictEqual(eventFired, true);
    });

    it('should handle flush of empty buffer', () => {
      // Should not throw error
      service.flushBuffer('non-existent');
    });

    it('should clear buffer after flush', (done) => {
      service.onData(() => {
        const stats = service.getBufferStats();
        assert.strictEqual(stats.totalBufferedChars, 0);
        done();
      });

      service.bufferData('test1', 'test');
      service.flushBuffer('test1');
    });
  });

  describe('flushAllBuffers', () => {
    it('should flush all terminal buffers', (done) => {
      let eventCount = 0;
      const expectedEvents = 3;
      
      service.onData((_event) => {
        eventCount++;
        if (eventCount === expectedEvents) {
          done();
        }
      });

      service.bufferData('test1', 'data1');
      service.bufferData('test2', 'data2');
      service.bufferData('test3', 'data3');
      
      service.flushAllBuffers();
    });
  });

  describe('clearTerminalBuffer', () => {
    it('should clear specific terminal buffer', (done) => {
      service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'test');
        
        // Clear the buffer
        service.clearTerminalBuffer('test1');
        
        const stats = service.getBufferStats();
        assert.strictEqual(stats.activeBuffers, 0);
        done();
      });

      service.bufferData('test1', 'test');
      service.clearTerminalBuffer('test1');
    });
  });

  describe('getBufferStats', () => {
    it('should return accurate buffer statistics', () => {
      service.bufferData('test1', 'hello');
      service.bufferData('test2', 'world');
      
      const stats = service.getBufferStats();
      assert.strictEqual(stats.activeBuffers, 2);
      assert.strictEqual(stats.totalBufferedChars, 10); // 'hello' + 'world'
      assert.strictEqual(stats.pendingFlushes, 2);
      assert.strictEqual(stats.isCliAgentActive, false);
      assert.strictEqual(stats.flushInterval, 16);
    });

    it('should update statistics when CLI Agent active', () => {
      service.setCliAgentActive(true);
      
      const stats = service.getBufferStats();
      assert.strictEqual(stats.isCliAgentActive, true);
      assert.strictEqual(stats.flushInterval, 4);
    });
  });

  describe('Error Handling', () => {
    it('should handle data buffering errors gracefully', (done) => {
      // Mock console.error to capture error logs
      const _consoleStub = sandbox.stub(console, 'error');
      let eventFired = false;
      
      service.onData((event) => {
        assert.strictEqual(event.terminalId, 'test1');
        assert.strictEqual(event.data, 'test');
        eventFired = true;
        done();
      });

      // This should trigger error handling but still emit data
      service.bufferData('test1', 'test');
      
      // Should still work despite any internal errors
      assert.strictEqual(eventFired, false); // Not immediate
      service.flushBuffer('test1');
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      service.bufferData('test1', 'data');
      service.bufferData('test2', 'data');
      
      let stats = service.getBufferStats();
      assert.ok(stats.activeBuffers > 0);
      
      service.dispose();
      
      // After dispose, should be clean
      stats = service.getBufferStats();
      assert.strictEqual(stats.activeBuffers, 0);
      assert.strictEqual(stats.pendingFlushes, 0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency data efficiently', (done) => {
      let eventCount = 0;
      const startTime = Date.now();
      
      service.onData(() => {
        eventCount++;
        if (eventCount === 10) {
          const duration = Date.now() - startTime;
          assert.ok(duration < 1000, 'Should handle high-frequency data in reasonable time');
          done();
        }
      });

      // Send data rapidly
      for (let i = 0; i < 10; i++) {
        service.bufferData(`test${i}`, `data${i}`);
        service.flushBuffer(`test${i}`);
      }
    });

    it('should maintain performance with CLI Agent mode', (done) => {
      service.setCliAgentActive(true);
      let eventCount = 0;
      
      service.onData(() => {
        eventCount++;
        if (eventCount === 5) {
          done();
        }
      });

      // Rapid data in CLI Agent mode
      for (let i = 0; i < 5; i++) {
        service.bufferData('agent-test', `fast-data-${i}`);
        service.flushBuffer('agent-test');
      }
    });
  });
});