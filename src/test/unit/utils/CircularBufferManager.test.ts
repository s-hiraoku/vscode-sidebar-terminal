import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CircularBufferManager, FlushCallback } from '../../../utils/CircularBufferManager';

describe('CircularBufferManager', () => {
  let manager: CircularBufferManager;
  let flushCallback: jest.Mock<FlushCallback>;

  beforeEach(() => {
    jest.useFakeTimers();
    flushCallback = jest.fn();
    manager = new CircularBufferManager(flushCallback, {
      flushInterval: 16,
      bufferCapacity: 50,
      maxDataSize: 1000,
      debug: false,
    });
  });

  afterEach(() => {
    manager.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create manager with default options', () => {
      const defaultManager = new CircularBufferManager(flushCallback);
      const stats = defaultManager.getManagerStats();
      expect(stats.activeBuffers).toBe(0);
      expect(stats.timerActive).toBe(false);
      defaultManager.dispose();
    });

    it('should accept custom options', () => {
      const customManager = new CircularBufferManager(flushCallback, {
        flushInterval: 32,
        bufferCapacity: 100,
        maxDataSize: 2000,
        debug: true,
      });
      expect(customManager).toBeDefined();
      customManager.dispose();
    });
  });

  describe('bufferData', () => {
    it('should buffer data for a terminal', () => {
      manager.bufferData('terminal1', 'test data');

      expect(manager.hasTerminal('terminal1')).toBe(true);
      const stats = manager.getTerminalStats('terminal1');
      expect(stats).not.toBeNull();
      expect(stats!.bufferSize).toBe(1);
    });

    it('should reject invalid terminal IDs', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      manager.bufferData('', 'data');
      manager.bufferData(null as any, 'data');

      expect(manager.hasTerminal('')).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('should ignore empty data', () => {
      manager.bufferData('terminal1', '');

      expect(manager.hasTerminal('terminal1')).toBe(false);
    });

    it('should start global timer on first buffer', () => {
      const stats1 = manager.getManagerStats();
      expect(stats1.timerActive).toBe(false);

      manager.bufferData('terminal1', 'data');

      const stats2 = manager.getManagerStats();
      expect(stats2.timerActive).toBe(true);
    });

    it('should buffer data for multiple terminals', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');
      manager.bufferData('terminal3', 'data3');

      expect(manager.hasTerminal('terminal1')).toBe(true);
      expect(manager.hasTerminal('terminal2')).toBe(true);
      expect(manager.hasTerminal('terminal3')).toBe(true);

      const stats = manager.getManagerStats();
      expect(stats.activeBuffers).toBe(3);
    });

    it('should immediately flush when data exceeds maxDataSize', () => {
      const largeData = 'x'.repeat(1001); // Exceeds maxDataSize of 1000

      manager.bufferData('terminal1', largeData);
      expect(flushCallback).toHaveBeenCalledWith('terminal1', largeData);
    });

    it('should immediately flush when buffer is full', () => {
      // Fill buffer to capacity
      for (let i = 0; i < 50; i++) {
        manager.bufferData('terminal1', `item${i}`);
      }

      expect(flushCallback).toHaveBeenCalled();
    });
  });

  describe('global timer', () => {
    it('should flush all buffers on timer tick', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');

      // Advance timer
      jest.advanceTimersByTime(16);

      expect(flushCallback).toHaveBeenCalledWith('terminal1', 'data1');
      expect(flushCallback).toHaveBeenCalledWith('terminal2', 'data2');
    });

    it('should not flush empty buffers', () => {
      manager.bufferData('terminal1', 'data');
      manager.flushAll(); // Flush immediately

      flushCallback.mockClear();

      // Advance timer - should not flush again (buffer is empty)
      jest.advanceTimersByTime(16);

      expect(flushCallback).not.toHaveBeenCalled();
    });

    it('should stop timer when no buffers remain', () => {
      manager.bufferData('terminal1', 'data');
      expect(manager.getManagerStats().timerActive).toBe(true);

      manager.removeTerminal('terminal1');
      expect(manager.getManagerStats().timerActive).toBe(false);
    });

    it('should use single timer for multiple terminals', () => {
      // Add multiple terminals
      for (let i = 0; i < 10; i++) {
        manager.bufferData(`terminal${i}`, `data${i}`);
      }

      const stats = manager.getManagerStats();
      expect(stats.activeBuffers).toBe(10);
      expect(stats.timerActive).toBe(true);

      // Only one timer should be running
      // This is implicit - the manager uses setInterval once
    });
  });

  describe('flushTerminal', () => {
    it('should flush specific terminal buffer', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');

      manager.flushTerminal('terminal1');

      expect(flushCallback).toHaveBeenCalledWith('terminal1', 'data1');
      expect(flushCallback).not.toHaveBeenCalledWith('terminal2', expect.anything());
    });

    it('should handle flush of non-existent terminal', () => {
      manager.flushTerminal('nonexistent');
      expect(flushCallback).not.toHaveBeenCalled();
    });

    it('should handle flush of empty buffer', () => {
      manager.bufferData('terminal1', 'data');
      manager.flushTerminal('terminal1'); // First flush

      flushCallback.mockClear();
      manager.flushTerminal('terminal1'); // Second flush - buffer is empty

      expect(flushCallback).not.toHaveBeenCalled();
    });
  });

  describe('flushAll', () => {
    it('should flush all terminal buffers', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');
      manager.bufferData('terminal3', 'data3');

      manager.flushAll();

      expect(flushCallback).toHaveBeenCalledTimes(3);
      expect(flushCallback).toHaveBeenCalledWith('terminal1', 'data1');
      expect(flushCallback).toHaveBeenCalledWith('terminal2', 'data2');
      expect(flushCallback).toHaveBeenCalledWith('terminal3', 'data3');
    });

    it('should handle flushAll with no buffers', () => {
      manager.flushAll();
      expect(flushCallback).not.toHaveBeenCalled();
    });

    it('should clear all buffers after flush', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');

      manager.flushAll();

      const stats1 = manager.getTerminalStats('terminal1');
      const stats2 = manager.getTerminalStats('terminal2');

      expect(stats1!.bufferSize).toBe(0);
      expect(stats2!.bufferSize).toBe(0);
    });
  });

  describe('removeTerminal', () => {
    it('should remove terminal buffer', () => {
      manager.bufferData('terminal1', 'data');
      expect(manager.hasTerminal('terminal1')).toBe(true);

      manager.removeTerminal('terminal1');
      expect(manager.hasTerminal('terminal1')).toBe(false);
    });

    it('should flush before removing', () => {
      manager.bufferData('terminal1', 'data');

      manager.removeTerminal('terminal1');

      expect(flushCallback).toHaveBeenCalledWith('terminal1', 'data');
    });

    it('should handle removal of non-existent terminal', () => {
      manager.removeTerminal('nonexistent');
      expect(manager.hasTerminal('nonexistent')).toBe(false);
    });

    it('should stop timer when last terminal is removed', () => {
      manager.bufferData('terminal1', 'data');
      expect(manager.getManagerStats().timerActive).toBe(true);

      manager.removeTerminal('terminal1');

      const stats = manager.getManagerStats();
      expect(stats.timerActive).toBe(false);
      expect(stats.activeBuffers).toBe(0);
    });

    it('should keep timer running if other terminals remain', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');

      manager.removeTerminal('terminal1');

      const stats = manager.getManagerStats();
      expect(stats.timerActive).toBe(true);
      expect(stats.activeBuffers).toBe(1);
    });
  });

  describe('hasTerminal', () => {
    it('should return false for non-existent terminal', () => {
      expect(manager.hasTerminal('terminal1')).toBe(false);
    });

    it('should return true for existing terminal', () => {
      manager.bufferData('terminal1', 'data');
      expect(manager.hasTerminal('terminal1')).toBe(true);
    });

    it('should return false after terminal removal', () => {
      manager.bufferData('terminal1', 'data');
      manager.removeTerminal('terminal1');
      expect(manager.hasTerminal('terminal1')).toBe(false);
    });
  });

  describe('getTerminalStats', () => {
    it('should return null for non-existent terminal', () => {
      expect(manager.getTerminalStats('terminal1')).toBeNull();
    });

    it('should return stats for existing terminal', () => {
      manager.bufferData('terminal1', 'test data');

      const stats = manager.getTerminalStats('terminal1');
      expect(stats).not.toBeNull();
      expect(stats!.bufferSize).toBeGreaterThan(0);
      expect(stats!.bufferCapacity).toBe(50);
      expect(stats!.totalBytes).toBeGreaterThan(0);
      expect(stats!.flushCount).toBe(0);
    });

    it('should update flush count after flush', () => {
      manager.bufferData('terminal1', 'data');

      manager.flushTerminal('terminal1');

      const stats = manager.getTerminalStats('terminal1');
      expect(stats!.flushCount).toBe(1);
    });

    it('should track total bytes', () => {
      manager.bufferData('terminal1', '12345'); // 5 bytes
      manager.bufferData('terminal1', 'abc'); // 3 bytes

      const stats = manager.getTerminalStats('terminal1');
      expect(stats!.totalBytes).toBe(8);
    });

    it('should track buffer age', () => {
      manager.bufferData('terminal1', 'data');

      // Advance time
      jest.advanceTimersByTime(1000);

      const stats = manager.getTerminalStats('terminal1');
      expect(stats!.age).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('getManagerStats', () => {
    it('should return stats for empty manager', () => {
      const stats = manager.getManagerStats();
      expect(stats.activeBuffers).toBe(0);
      expect(stats.timerActive).toBe(false);
      expect(stats.totalFlushes).toBe(0);
      expect(stats.totalBytes).toBe(0);
    });

    it('should return stats with active buffers', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');

      const stats = manager.getManagerStats();
      expect(stats.activeBuffers).toBe(2);
      expect(stats.timerActive).toBe(true);
      expect(stats.totalBytes).toBeGreaterThan(0);
    });

    it('should track total flushes across all terminals', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');

      manager.flushAll();
      manager.flushAll();

      const stats = manager.getManagerStats();
      expect(stats.totalFlushes).toBe(4); // 2 terminals * 2 flushes
    });
  });

  describe('dispose', () => {
    it('should flush all buffers before dispose', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');

      manager.dispose();

      expect(flushCallback).toHaveBeenCalledWith('terminal1', 'data1');
      expect(flushCallback).toHaveBeenCalledWith('terminal2', 'data2');
    });

    it('should stop timer on dispose', () => {
      manager.bufferData('terminal1', 'data');

      manager.dispose();

      const stats = manager.getManagerStats();
      expect(stats.timerActive).toBe(false);
    });

    it('should clear all buffers on dispose', () => {
      manager.bufferData('terminal1', 'data1');
      manager.bufferData('terminal2', 'data2');

      manager.dispose();

      const stats = manager.getManagerStats();
      expect(stats.activeBuffers).toBe(0);
    });

    it('should handle dispose with no buffers', () => {
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle flush callback errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Flush error');
      });
      const errorManager = new CircularBufferManager(errorCallback);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      errorManager.bufferData('terminal1', 'data');
      errorManager.flushTerminal('terminal1');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
      errorManager.dispose();
    });
  });

  describe('memory efficiency', () => {
    it('should use single timer for many terminals', () => {
      // Create many terminals
      for (let i = 0; i < 100; i++) {
        manager.bufferData(`terminal${i}`, `data${i}`);
      }

      const stats = manager.getManagerStats();
      expect(stats.activeBuffers).toBe(100);
      expect(stats.timerActive).toBe(true);

      // All terminals share single timer (verified by implementation)
      // This is a design test - no N timers created
    });

    it('should automatically clean up removed terminals', () => {
      // Add terminals
      for (let i = 0; i < 10; i++) {
        manager.bufferData(`terminal${i}`, `data${i}`);
      }

      // Remove half
      for (let i = 0; i < 5; i++) {
        manager.removeTerminal(`terminal${i}`);
      }

      const stats = manager.getManagerStats();
      expect(stats.activeBuffers).toBe(5);
    });
  });

  describe('data accumulation', () => {
    it('should accumulate multiple data chunks before flush', () => {
      manager.bufferData('terminal1', 'chunk1');
      manager.bufferData('terminal1', 'chunk2');
      manager.bufferData('terminal1', 'chunk3');

      manager.flushTerminal('terminal1');

      expect(flushCallback).toHaveBeenCalledWith('terminal1', 'chunk1chunk2chunk3');
    });

    it('should handle rapid data buffering', () => {
      for (let i = 0; i < 100; i++) {
        manager.bufferData('terminal1', `data${i}`);
      }

      // Buffer should auto-flush when full
      expect(flushCallback).toHaveBeenCalled();
    });
  });
});
