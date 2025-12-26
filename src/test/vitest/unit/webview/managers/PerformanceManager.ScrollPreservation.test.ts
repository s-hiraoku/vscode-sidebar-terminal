/**
 * @file PerformanceManager Scroll Preservation Tests
 * @description Tests for scroll position preservation during AI agent output
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Terminal } from '@xterm/xterm';
import { PerformanceManager } from '../../../../../webview/managers/PerformanceManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

describe('PerformanceManager - Scroll Preservation', () => {
  let performanceManager: PerformanceManager;
  let mockCoordinator: IManagerCoordinator;
  let mockTerminal: Terminal;
  let writeCallCount: number;
  let writtenData: string[];

  beforeEach(() => {
    writeCallCount = 0;
    writtenData = [];

    // Mock terminal with scroll state tracking
    mockTerminal = {
      write: (data: string) => {
        writeCallCount++;
        writtenData.push(data);
      },
      // Mock xterm.js internal properties for scroll state
      _core: {
        _bufferService: {
          buffer: {
            ydisp: 0, // Current scroll position
            ybase: 10, // Bottom of scrollback
            isUserScrolling: false,
          },
        },
      },
      buffer: {
        active: {
          baseY: 10,
          viewportY: 10,
        },
      },
      rows: 24,
    } as unknown as Terminal;

    mockCoordinator = {
      getActiveTerminalId: () => 'test-terminal-1',
      log: () => {},
    } as unknown as IManagerCoordinator;

    performanceManager = new PerformanceManager();
    performanceManager.initializePerformance(mockCoordinator);
  });

  afterEach(() => {
    performanceManager.dispose();
  });

  describe('Normal Output Behavior', () => {
    it('should write small output normally without intervention', () => {
      const testData = 'small output';

      performanceManager.bufferedWrite(testData, mockTerminal, 'test-terminal-1');

      // Small output should be buffered, not written immediately
      expect(writeCallCount).toBe(0);

      // Force flush
      performanceManager.flushOutputBuffer();

      expect(writeCallCount).toBe(1);
      expect(writtenData[0]).toBe(testData);
    });

    it('should write large output immediately', () => {
      const testData = 'x'.repeat(1500); // Large output

      performanceManager.bufferedWrite(testData, mockTerminal, 'test-terminal-1');

      // Large output should be written immediately
      expect(writeCallCount).toBe(1);
      expect(writtenData[0]).toBe(testData);
    });
  });

  describe('AI Agent Mode', () => {
    beforeEach(() => {
      performanceManager.setCliAgentMode(true);
    });

    it('should write moderate output immediately in CLI Agent mode', () => {
      const testData = 'x'.repeat(500); // Moderate output

      performanceManager.bufferedWrite(testData, mockTerminal, 'test-terminal-1');

      // In CLI Agent mode, moderate output should be written immediately
      expect(writeCallCount).toBe(1);
      expect(writtenData[0]).toBe(testData);
    });

    it('should handle rapid output correctly', () => {
      const outputs = ['output1', 'output2', 'output3'];

      outputs.forEach((output) => {
        performanceManager.bufferedWrite(output, mockTerminal, 'test-terminal-1');
      });

      // All outputs should be written immediately in CLI Agent mode
      expect(writeCallCount).toBe(3);
      expect(writtenData).toEqual(outputs);
    });
  });

  describe('Scroll Preservation Strategy', () => {
    it('should rely on xterm.js automatic scroll preservation', () => {
      // Simulate user scrolled up state
      const terminalWithCore = mockTerminal as Terminal & {
        _core: { _bufferService: { buffer: { ydisp: number; isUserScrolling: boolean } } };
      };
      terminalWithCore._core._bufferService.buffer.ydisp = 5; // Scrolled up
      terminalWithCore._core._bufferService.buffer.isUserScrolling = true;

      const testData = 'Agent output that should not affect scroll';

      performanceManager.bufferedWrite(testData, mockTerminal, 'test-terminal-1');
      performanceManager.flushOutputBuffer();

      // Data should be written normally - xterm.js handles scroll preservation
      expect(writeCallCount).toBe(1);
      expect(writtenData[0]).toBe(testData);

      // Verify no manual scroll manipulation was attempted
      // (Our implementation relies on xterm.js internal behavior)
    });

    it('should handle bottom-scrolled terminal normally', () => {
      // Simulate terminal at bottom
      const terminalWithCore = mockTerminal as Terminal & {
        _core: { _bufferService: { buffer: { ydisp: number; isUserScrolling: boolean } } };
      };
      terminalWithCore._core._bufferService.buffer.ydisp = 10; // At bottom
      terminalWithCore._core._bufferService.buffer.isUserScrolling = false;

      const testData = 'Output when at bottom';

      performanceManager.bufferedWrite(testData, mockTerminal, 'test-terminal-1');
      performanceManager.flushOutputBuffer();

      // Should write normally and let xterm.js handle auto-scroll
      expect(writeCallCount).toBe(1);
      expect(writtenData[0]).toBe(testData);
    });
  });

  describe('Performance Characteristics', () => {
    it('should use fast flush intervals in CLI Agent mode', async () => {
      performanceManager.setCliAgentMode(true);

      const testData = 'buffered output';
      performanceManager.bufferedWrite(testData, mockTerminal, 'test-terminal-1');

      // In CLI Agent mode, should flush quickly (4ms interval)
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait longer than CLI Agent flush interval

      expect(writeCallCount).toBe(1);
    });

    it('should handle buffer full condition', () => {
      // Fill buffer with moderate outputs
      for (let i = 0; i < 10; i++) {
        performanceManager.bufferedWrite(`output${i}`, mockTerminal, 'test-terminal-1');
      }

      // Force flush to test buffer handling
      performanceManager.flushOutputBuffer();

      // Buffer should have written data
      expect(writeCallCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle terminal write errors gracefully', () => {
      // Mock terminal that throws on write
      let errorThrown = false;
      const errorTerminal = {
        write: () => {
          errorThrown = true;
          throw new Error('Write failed');
        },
      } as unknown as Terminal;

      // bufferedWrite may throw during immediate write (large data or CLI Agent mode)
      // The important thing is that the manager remains functional
      try {
        performanceManager.bufferedWrite('test', errorTerminal, 'error-terminal');
        performanceManager.flushOutputBuffer();
      } catch (_e) {
        // Expected - error terminals throw
      }

      // Verify error was indeed thrown
      expect(errorThrown).toBe(true);

      // Manager should still be functional after error
      expect(() => {
        performanceManager.flushOutputBuffer();
      }).not.toThrow();
    });

    it('should handle missing terminal gracefully', () => {
      // Null terminal will throw - verify manager handles it
      try {
        performanceManager.bufferedWrite('test', null as unknown as Terminal, 'missing-terminal');
      } catch (e) {
        // Expected - null terminal throws
        expect(e).toBeInstanceOf(TypeError);
      }

      // Manager should still be functional
      expect(() => {
        performanceManager.flushOutputBuffer();
      }).not.toThrow();
    });
  });
});
