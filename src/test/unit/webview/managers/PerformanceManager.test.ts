/**
 * PerformanceManager Test Suite - Buffer optimization and input responsiveness validation
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { PerformanceManager } from '../../../../webview/managers/PerformanceManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';

// Mock Terminal interface with buffer for DSR testing
interface MockTerminal {
  write: sinon.SinonStub;
  resize: sinon.SinonStub;
  buffer: {
    active: {
      cursorX: number;
      cursorY: number;
    };
  };
}

// Mock FitAddon interface
interface MockFitAddon {
  fit: sinon.SinonStub;
}

describe('PerformanceManager', () => {
  let performanceManager: PerformanceManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let mockTerminal: MockTerminal;
  let mockFitAddon: MockFitAddon;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    // Create mock terminal with buffer for DSR testing
    mockTerminal = {
      write: sinon.stub(),
      resize: sinon.stub(),
      buffer: {
        active: {
          cursorX: 0, // 0-based column
          cursorY: 0, // 0-based row
        },
      },
    };

    // Create mock FitAddon
    mockFitAddon = {
      fit: sinon.stub(),
    };

    // Create mock coordinator
    mockCoordinator = {
      postMessageToExtension: sinon.stub(),
      getActiveTerminalId: sinon.stub().returns('terminal-1'),
      getTerminalInstance: sinon.stub().returns({
        terminal: mockTerminal,
      }),
    } as any;

    performanceManager = new PerformanceManager();
    performanceManager.initializePerformance(mockCoordinator);
  });

  afterEach(() => {
    performanceManager.dispose();
    clock.restore();
  });

  describe('Buffer Optimization', () => {
    it('should immediately flush small inputs (≤10 chars) for typing responsiveness', () => {
      const smallInput = 'a'; // 1 character

      performanceManager.scheduleOutputBuffer(smallInput, mockTerminal as any);

      // Should write immediately without buffering
      expect(mockTerminal.write.calledOnce).to.be.true;
      expect(mockTerminal.write.calledWith(smallInput)).to.be.true;
    });

    it('should immediately flush large outputs (≥500 chars)', () => {
      const largeOutput = 'a'.repeat(500); // 500 characters

      performanceManager.scheduleOutputBuffer(largeOutput, mockTerminal as any);

      // Should write immediately
      expect(mockTerminal.write.calledOnce).to.be.true;
      expect(mockTerminal.write.calledWith(largeOutput)).to.be.true;
    });

    it('should buffer medium-sized outputs for efficiency', () => {
      const mediumOutput = 'a'.repeat(50); // 50 characters

      performanceManager.scheduleOutputBuffer(mediumOutput, mockTerminal as any);

      // Should not write immediately (buffered)
      expect(mockTerminal.write.called).to.be.false;

      // Should write after buffer flush interval (4ms)
      clock.tick(4);
      expect(mockTerminal.write.calledOnce).to.be.true;
      expect(mockTerminal.write.calledWith(mediumOutput)).to.be.true;
    });

    it('should use dynamic flush intervals based on CLI Agent mode', () => {
      const testOutput = 'a'.repeat(20); // Medium size

      // Normal mode: 4ms interval
      performanceManager.scheduleOutputBuffer(testOutput, mockTerminal as any);

      clock.tick(3); // Just before 4ms
      expect(mockTerminal.write.called).to.be.false;

      clock.tick(1); // At 4ms
      expect(mockTerminal.write.calledOnce).to.be.true;

      // Reset
      mockTerminal.write.resetHistory();

      // CLI Agent mode: 2ms interval
      performanceManager.setCliAgentMode(true);
      performanceManager.scheduleOutputBuffer(testOutput, mockTerminal as any);

      clock.tick(1); // At 1ms
      expect(mockTerminal.write.called).to.be.false;

      clock.tick(1); // At 2ms
      expect(mockTerminal.write.calledOnce).to.be.true;
    });

    it('should immediately flush when buffer is full', () => {
      const mediumOutput = 'a'.repeat(30); // Medium size output (11-499 chars - will be buffered)

      // Fill buffer to capacity (MAX_BUFFER_SIZE = 50)
      // Use medium-sized outputs that will actually be buffered (not small inputs)
      for (let i = 0; i < 50; i++) {
        performanceManager.scheduleOutputBuffer('b'.repeat(15), mockTerminal as any); // Medium size - will be buffered
        // Don't tick clock - we want these to accumulate in buffer
      }

      // At this point buffer should have 50 items and no writes yet
      expect(mockTerminal.write.called).to.be.false;

      // Reset call history to clearly see the next write
      mockTerminal.write.resetHistory();

      // This should trigger immediate flush due to buffer full condition (>= 50)
      performanceManager.scheduleOutputBuffer(mediumOutput, mockTerminal as any);

      // Should write immediately due to buffer full
      expect(mockTerminal.write.called).to.be.true;
    });
  });

  describe('CLI Agent Mode Optimization', () => {
    it('should enable CLI Agent mode and adjust timing', () => {
      expect(performanceManager.getCliAgentMode()).to.be.false;

      performanceManager.setCliAgentMode(true);

      expect(performanceManager.getCliAgentMode()).to.be.true;
    });

    it('should flush buffers when CLI Agent mode changes', () => {
      const testOutput = 'a'.repeat(30); // Medium size output that gets buffered

      // Buffer some output in normal mode
      performanceManager.scheduleOutputBuffer(testOutput, mockTerminal as any);
      expect(mockTerminal.write.called).to.be.false;

      // Changing to CLI Agent mode should flush immediately (not on change, but the logic flushes when mode is disabled)
      performanceManager.setCliAgentMode(true);
      // CLI Agent mode doesn't flush on enable, but let's test that turning it OFF flushes
      performanceManager.setCliAgentMode(false);

      // Should have flushed the buffer when mode was disabled
      expect(mockTerminal.write.calledWith(testOutput)).to.be.true;
    });

    it('should use faster intervals in CLI Agent mode', () => {
      performanceManager.setCliAgentMode(true);

      const stats = performanceManager.getBufferStats();
      expect(stats.isCliAgentMode).to.be.true;

      // Buffer output that would normally take 4ms, should now take 2ms
      const testOutput = 'a'.repeat(30);
      performanceManager.scheduleOutputBuffer(testOutput, mockTerminal as any);

      clock.tick(1); // At 1ms
      expect(mockTerminal.write.called).to.be.false;

      clock.tick(1); // At 2ms
      expect(mockTerminal.write.calledOnce).to.be.true;
    });

    it('should immediately process moderate output in CLI Agent mode', () => {
      performanceManager.setCliAgentMode(true);

      const moderateOutput = 'a'.repeat(75); // ≥50 chars

      performanceManager.scheduleOutputBuffer(moderateOutput, mockTerminal as any);

      // Should write immediately in CLI Agent mode
      expect(mockTerminal.write.calledOnce).to.be.true;
      expect(mockTerminal.write.calledWith(moderateOutput)).to.be.true;
    });
  });

  describe('Resize Debouncing', () => {
    it('should debounce resize operations', async () => {
      const cols = 80,
        rows = 24;

      // Multiple rapid resize calls
      performanceManager.debouncedResize(cols, rows, mockTerminal as any, mockFitAddon as any);
      performanceManager.debouncedResize(cols + 1, rows, mockTerminal as any, mockFitAddon as any);
      performanceManager.debouncedResize(cols + 2, rows, mockTerminal as any, mockFitAddon as any);

      // Should not have resized yet
      expect(mockTerminal.resize.called).to.be.false;
      expect(mockFitAddon.fit.called).to.be.false;

      // After debounce delay (100ms from constants optimization)
      clock.tick(100);
      await clock.runAllAsync(); // Let async operations complete

      // Should have resized only once with the last values
      expect(mockTerminal.resize.calledOnce).to.be.true;
      expect(mockTerminal.resize.calledWith(cols + 2, rows)).to.be.true;
      expect(mockFitAddon.fit.calledOnce).to.be.true;
    });

    it('should handle resize errors gracefully', () => {
      mockTerminal.resize.throws(new Error('Resize failed'));

      expect(() => {
        performanceManager.debouncedResize(80, 24, mockTerminal as any, mockFitAddon as any);
        clock.tick(100);
      }).to.not.throw();
    });
  });

  describe('Buffer Statistics and Monitoring', () => {
    it('should provide accurate buffer statistics', () => {
      let stats = performanceManager.getBufferStats();
      expect(stats.bufferSize).to.equal(0);
      expect(stats.isFlushScheduled).to.be.false;
      expect(stats.isCliAgentMode).to.be.false;
      expect(stats.currentTerminal).to.be.false;

      // Buffer some output
      performanceManager.scheduleOutputBuffer('test output', mockTerminal as any);

      stats = performanceManager.getBufferStats();
      expect(stats.currentTerminal).to.be.true;

      // Enable CLI Agent mode
      performanceManager.setCliAgentMode(true);

      stats = performanceManager.getBufferStats();
      expect(stats.isCliAgentMode).to.be.true;
    });
  });

  describe('Emergency Operations', () => {
    it('should force flush all buffers', () => {
      // Buffer multiple outputs (use medium size that gets buffered, not small inputs)
      const output1 = 'a'.repeat(25); // Medium size - will be buffered
      const output2 = 'b'.repeat(25); // Medium size - will be buffered

      performanceManager.scheduleOutputBuffer(output1, mockTerminal as any);
      performanceManager.scheduleOutputBuffer(output2, mockTerminal as any);

      expect(mockTerminal.write.called).to.be.false;

      // Force flush
      performanceManager.forceFlush();

      // Should have written all buffered content
      expect(mockTerminal.write.called).to.be.true;
    });

    it('should clear buffers without writing', () => {
      // Buffer some output (medium size that gets buffered)
      const testOutput = 'a'.repeat(25); // Medium size - will be buffered
      performanceManager.scheduleOutputBuffer(testOutput, mockTerminal as any);

      let stats = performanceManager.getBufferStats();
      expect(stats.bufferSize).to.be.greaterThan(0);

      // Clear buffers
      performanceManager.clearBuffers();

      // Buffers should be empty, no writing should occur
      stats = performanceManager.getBufferStats();
      expect(stats.bufferSize).to.equal(0);
      expect(stats.isFlushScheduled).to.be.false;
      expect(mockTerminal.write.called).to.be.false;
    });
  });

  describe('Error Handling', () => {
    it('should handle terminal write errors gracefully', () => {
      mockTerminal.write.throws(new Error('Write failed'));

      // Should not throw even if terminal write fails
      expect(() => {
        performanceManager.scheduleOutputBuffer('small input', mockTerminal as any);
      }).to.not.throw();
    });

    it('should recover from buffer flush errors', () => {
      mockTerminal.write.throws(new Error('Write failed'));

      // Buffer some output
      performanceManager.scheduleOutputBuffer('test output', mockTerminal as any);

      // Should not throw when flush timer triggers
      expect(() => {
        clock.tick(4);
      }).to.not.throw();

      // Buffer should be cleared even on error
      const stats = performanceManager.getBufferStats();
      expect(stats.bufferSize).to.equal(0);
    });
  });

  describe('High-Frequency Input Simulation', () => {
    it('should handle rapid character input efficiently', () => {
      const characters = 'Hello World!'.split('');
      let immediateWrites = 0;
      let bufferedWrites = 0;

      // Track immediate vs buffered writes
      mockTerminal.write.callsFake((data) => {
        if (data.length === 1) {
          immediateWrites++;
        } else {
          bufferedWrites++;
        }
      });

      // Simulate rapid typing
      characters.forEach((char) => {
        performanceManager.scheduleOutputBuffer(char, mockTerminal as any);
      });

      // All single characters should be written immediately
      expect(immediateWrites).to.equal(characters.length);
      expect(bufferedWrites).to.equal(0);
    });

    it('should handle mixed small and large outputs correctly', () => {
      const outputs = [
        'a', // Small (immediate) ≤10
        'b'.repeat(500), // Large (immediate) ≥500
        'c'.repeat(30), // Medium (buffered) 11-499
        'd', // Small (immediate) ≤10
        'e'.repeat(600), // Large (immediate) ≥500
      ];

      let immediateCount = 0;
      let bufferedCount = 0;

      outputs.forEach((output) => {
        const beforeCount = mockTerminal.write.callCount;
        performanceManager.scheduleOutputBuffer(output, mockTerminal as any);
        const afterCount = mockTerminal.write.callCount;

        if (afterCount > beforeCount) {
          immediateCount++;
        } else {
          bufferedCount++;
        }
      });

      // Should have 4 immediate writes (small + large) and 1 buffered
      expect(immediateCount).to.equal(4);
      expect(bufferedCount).to.equal(1);

      // Process buffered output
      clock.tick(4);
      expect(mockTerminal.write.callCount).to.equal(5);
    });
  });

  describe('Memory Management', () => {
    it('should properly cleanup on dispose', () => {
      // Buffer some output and schedule resize
      performanceManager.scheduleOutputBuffer('test output', mockTerminal as any);
      performanceManager.debouncedResize(80, 24, mockTerminal as any, mockFitAddon as any);

      // Should flush before disposal
      performanceManager.dispose();

      expect(mockTerminal.write.called).to.be.true;

      // Stats should show clean state
      const stats = performanceManager.getBufferStats();
      expect(stats.bufferSize).to.equal(0);
      expect(stats.isFlushScheduled).to.be.false;
      expect(stats.currentTerminal).to.be.false;
      expect(stats.isCliAgentMode).to.be.false;
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should maintain sub-5ms response time for typing', () => {
      const startTime = clock.now;

      // Simulate typing a character
      performanceManager.scheduleOutputBuffer('x', mockTerminal as any);

      const responseTime = clock.now - startTime;

      // Should respond immediately (< 1ms with immediate flush)
      expect(responseTime).to.be.lessThan(1);
      expect(mockTerminal.write.calledOnce).to.be.true;
    });

    it('should process CLI Agent output within optimized timeframes', () => {
      performanceManager.setCliAgentMode(true);

      const moderateOutput = 'a'.repeat(75);
      const startTime = clock.now;

      performanceManager.scheduleOutputBuffer(moderateOutput, mockTerminal as any);

      const responseTime = clock.now - startTime;

      // CLI Agent moderate output should be immediate
      expect(responseTime).to.be.lessThan(1);
      expect(mockTerminal.write.calledOnce).to.be.true;
    });
  });

  /**
   * DSR (Device Status Report) Handling Tests
   * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/341
   *
   * CLI tools like codex send \x1b[6n to query cursor position.
   * Terminal should respond with \x1b[row;colR format.
   */
  describe('DSR (Device Status Report) Handling', () => {
    it('should detect DSR query sequence \\x1b[6n and send cursor position response', () => {
      const terminalId = 'terminal-1';

      // Set cursor position (0-based in xterm.js)
      mockTerminal.buffer.active.cursorX = 4; // column 5 (1-based)
      mockTerminal.buffer.active.cursorY = 9; // row 10 (1-based)

      // Send output containing DSR query
      performanceManager.bufferedWrite('\x1b[6n', mockTerminal as any, terminalId);

      // Should send DSR response back to extension
      expect(mockCoordinator.postMessageToExtension.calledOnce).to.be.true;

      const call = mockCoordinator.postMessageToExtension.getCall(0);
      expect(call.args[0].command).to.equal('input');
      expect(call.args[0].terminalId).to.equal(terminalId);
      // Response should be \x1b[10;5R (row 10, column 5 in 1-based format)
      expect(call.args[0].data).to.equal('\x1b[10;5R');
    });

    it('should handle DSR at cursor position (1,1) correctly', () => {
      const terminalId = 'terminal-1';

      // Set cursor at origin (0,0 in 0-based)
      mockTerminal.buffer.active.cursorX = 0;
      mockTerminal.buffer.active.cursorY = 0;

      performanceManager.bufferedWrite('\x1b[6n', mockTerminal as any, terminalId);

      expect(mockCoordinator.postMessageToExtension.calledOnce).to.be.true;

      const call = mockCoordinator.postMessageToExtension.getCall(0);
      // Response should be \x1b[1;1R (row 1, column 1 in 1-based format)
      expect(call.args[0].data).to.equal('\x1b[1;1R');
    });

    it('should handle DSR embedded in larger output', () => {
      const terminalId = 'terminal-1';

      mockTerminal.buffer.active.cursorX = 9; // column 10
      mockTerminal.buffer.active.cursorY = 4; // row 5

      // DSR query embedded in other output
      const mixedOutput = 'Hello\x1b[6nWorld';
      performanceManager.bufferedWrite(mixedOutput, mockTerminal as any, terminalId);

      // Should still detect and respond to DSR
      expect(mockCoordinator.postMessageToExtension.calledOnce).to.be.true;

      const call = mockCoordinator.postMessageToExtension.getCall(0);
      expect(call.args[0].data).to.equal('\x1b[5;10R');
    });

    it('should not send DSR response for non-DSR sequences', () => {
      const terminalId = 'terminal-1';

      // Various escape sequences that are NOT DSR
      const nonDsrSequences = [
        '\x1b[H', // Cursor home
        '\x1b[2J', // Clear screen
        '\x1b[m', // Reset attributes
        '\x1b[1;31m', // Set color
        'Hello World', // Plain text
      ];

      nonDsrSequences.forEach((seq) => {
        mockCoordinator.postMessageToExtension.resetHistory();
        performanceManager.bufferedWrite(seq, mockTerminal as any, terminalId);

        // Should NOT send any DSR response
        expect(
          mockCoordinator.postMessageToExtension.called,
          `Unexpected DSR response for: ${seq.replace(/\x1b/g, '\\x1b')}`
        ).to.be.false;
      });
    });

    it('should handle DSR when coordinator is not initialized', () => {
      // Create a new manager without coordinator
      const uninitializedManager = new PerformanceManager();
      // Don't call initializePerformance

      // Should not throw when DSR is detected without coordinator
      expect(() => {
        uninitializedManager.bufferedWrite('\x1b[6n', mockTerminal as any, 'terminal-1');
      }).to.not.throw();

      uninitializedManager.dispose();
    });

    it('should respond to multiple DSR queries in sequence', () => {
      const terminalId = 'terminal-1';

      // First query at position (0,0)
      mockTerminal.buffer.active.cursorX = 0;
      mockTerminal.buffer.active.cursorY = 0;
      performanceManager.bufferedWrite('\x1b[6n', mockTerminal as any, terminalId);

      // Second query at different position
      mockTerminal.buffer.active.cursorX = 19; // column 20
      mockTerminal.buffer.active.cursorY = 14; // row 15
      performanceManager.bufferedWrite('\x1b[6n', mockTerminal as any, terminalId);

      expect(mockCoordinator.postMessageToExtension.callCount).to.equal(2);

      // First response: row 1, col 1
      expect(mockCoordinator.postMessageToExtension.getCall(0).args[0].data).to.equal('\x1b[1;1R');

      // Second response: row 15, col 20
      expect(mockCoordinator.postMessageToExtension.getCall(1).args[0].data).to.equal('\x1b[15;20R');
    });

    it('should include timestamp in DSR response message', () => {
      const terminalId = 'terminal-1';

      performanceManager.bufferedWrite('\x1b[6n', mockTerminal as any, terminalId);

      const call = mockCoordinator.postMessageToExtension.getCall(0);
      expect(call.args[0].timestamp).to.be.a('number');
      expect(call.args[0].timestamp).to.be.greaterThan(0);
    });
  });
});
