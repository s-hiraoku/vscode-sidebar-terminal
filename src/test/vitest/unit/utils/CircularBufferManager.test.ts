import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircularBufferManager } from '../../../../utils/CircularBufferManager';

// Mock CircularBuffer
vi.mock('../../../../utils/CircularBuffer', () => {
  return {
    CircularBuffer: class {
      push = vi.fn();
      getDataLength = vi.fn().mockReturnValue(100);
      getSize = vi.fn().mockReturnValue(5);
      getCapacity = vi.fn().mockReturnValue(50);
      isFull = vi.fn().mockReturnValue(false);
      flush = vi.fn().mockReturnValue('flushed data');
      isEmpty = vi.fn().mockReturnValue(false);
    },
  };
});

describe('CircularBufferManager', () => {
  let manager: CircularBufferManager;
  let flushCallback: any;

  beforeEach(() => {
    vi.useFakeTimers();
    flushCallback = vi.fn();
    manager = new CircularBufferManager(flushCallback, {
      flushInterval: 100,
      bufferCapacity: 50,
      maxDataSize: 1000,
      debug: false,
    });
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  describe('bufferData', () => {
    it('should create buffer and push data', () => {
      manager.bufferData('term-1', 'data');
      expect(manager.hasTerminal('term-1')).toBe(true);
    });

    it('should start global timer', () => {
      expect(manager.getManagerStats().timerActive).toBe(false);
      manager.bufferData('term-1', 'data');
      expect(manager.getManagerStats().timerActive).toBe(true);
    });

    it('should flush immediately if size threshold reached', () => {
      // Mock CircularBuffer to return large size
      // We need to re-instantiate or access the mock instance.
      // Since vi.mock is hoisted, we can't easily change return value per test unless we use a factory variable.
      // But we can check if flushCallback was called immediately.
      
      // Let's rely on the mock returning 100 bytes (setup above). 
      // maxDataSize is 1000. So normally no flush.
      // Let's force a flush by setting maxDataSize low.
      
      const smallManager = new CircularBufferManager(flushCallback, { maxDataSize: 50 });
      smallManager.bufferData('term-1', 'data'); // Mock returns 100 bytes length
      
      expect(flushCallback).toHaveBeenCalledWith('term-1', 'flushed data');
      smallManager.dispose();
    });

    it('should handle invalid input', () => {
      manager.bufferData('', 'data');
      expect(manager.hasTerminal('')).toBe(false);

      manager.bufferData('term-1', '');
      // Should not start timer or create buffer if data empty
      expect(manager.hasTerminal('term-1')).toBe(false);
    });
  });

  describe('flush', () => {
    it('should flush specific terminal', () => {
      manager.bufferData('term-1', 'data');
      flushCallback.mockClear();
      
      manager.flushTerminal('term-1');
      expect(flushCallback).toHaveBeenCalledWith('term-1', 'flushed data');
    });

    it('should flush all', () => {
      manager.bufferData('term-1', 'data');
      manager.bufferData('term-2', 'data');
      flushCallback.mockClear();
      
      manager.flushAll();
      expect(flushCallback).toHaveBeenCalledTimes(2);
    });

    it('should flush on timer tick', () => {
      manager.bufferData('term-1', 'data');
      flushCallback.mockClear();
      
      vi.advanceTimersByTime(100);
      expect(flushCallback).toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('should remove terminal', () => {
      manager.bufferData('term-1', 'data');
      manager.removeTerminal('term-1');
      
      expect(manager.hasTerminal('term-1')).toBe(false);
      // Timer should stop if no buffers
      expect(manager.getManagerStats().timerActive).toBe(false);
    });

    it('should dispose', () => {
      manager.bufferData('term-1', 'data');
      manager.dispose();
      
      expect(manager.getManagerStats().activeBuffers).toBe(0);
      expect(manager.getManagerStats().timerActive).toBe(false);
    });
  });

  describe('stats', () => {
    it('should return terminal stats', () => {
      manager.bufferData('term-1', 'data');
      const stats = manager.getTerminalStats('term-1');
      
      expect(stats).toBeDefined();
      expect(stats?.bufferSize).toBe(5);
      expect(stats?.totalBytes).toBe(4); // 'data'.length
    });

    it('should return manager stats', () => {
      manager.bufferData('term-1', 'data');
      const stats = manager.getManagerStats();
      
      expect(stats.activeBuffers).toBe(1);
      expect(stats.totalBytes).toBe(4);
    });
  });
});
