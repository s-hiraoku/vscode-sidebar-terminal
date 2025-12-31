import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Debouncer, DOMBatcher, PerformanceMonitor, MemoryMonitor } from '../../../../utils/PerformanceOptimizer';

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  log: vi.fn(),
}));

describe('PerformanceOptimizer', () => {
  describe('Debouncer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce execution', () => {
      const func = vi.fn();
      const debouncer = new Debouncer(func, 100);

      debouncer.execute();
      debouncer.execute();
      debouncer.execute();

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should cancel execution', () => {
      const func = vi.fn();
      const debouncer = new Debouncer(func, 100);

      debouncer.execute();
      expect(debouncer.isScheduled()).toBe(true);

      debouncer.cancel();
      expect(debouncer.isScheduled()).toBe(false);

      vi.advanceTimersByTime(100);
      expect(func).not.toHaveBeenCalled();
    });

    it('should handle async function errors', async () => {
      const func = vi.fn().mockRejectedValue(new Error('Async error'));
      const debouncer = new Debouncer(func, 100);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      debouncer.execute();
      vi.advanceTimersByTime(100);

      // Async execution inside setTimeout might not be caught by expect immediately
      // But implementation catches it and logs to console.error
      // We need to wait for promise resolution if possible, but setTimeout callback is void
      // The implementation is:
      /*
      this.timeoutId = setTimeout(async () => {
        try {
          await this.func(...args);
        } catch (error) {
          console.error('Debounced function execution failed:', error);
        }
        this.timeoutId = null;
      }, this.delay) as unknown as number;
      */
      
      // Since it's async void, we rely on console.error spy
      // We need to allow the promise microtask to complete
      await Promise.resolve(); 
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Debounced function execution failed:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('DOMBatcher', () => {
    let requestAnimationFrameSpy: any;
    let frameCallback: FrameRequestCallback | null = null;

    beforeEach(() => {
      frameCallback = null;
      requestAnimationFrameSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
        frameCallback = cb;
        return 1;
      });
    });

    afterEach(() => {
      requestAnimationFrameSpy.mockRestore();
    });

    it('should batch operations', () => {
      const batcher = new DOMBatcher();
      const op1 = vi.fn();
      const op2 = vi.fn();

      batcher.add(op1);
      batcher.add(op2);

      expect(op1).not.toHaveBeenCalled();
      expect(op2).not.toHaveBeenCalled();
      expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);

      // Trigger frame
      if (frameCallback) frameCallback(0);

      expect(op1).toHaveBeenCalledTimes(1);
      expect(op2).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in operations', () => {
      const batcher = new DOMBatcher();
      const op1 = vi.fn().mockImplementation(() => { throw new Error('Op1 Error'); });
      const op2 = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      batcher.add(op1);
      batcher.add(op2);

      if (frameCallback) frameCallback(0);

      expect(op1).toHaveBeenCalled();
      expect(op2).toHaveBeenCalled(); // Should continue
      expect(consoleErrorSpy).toHaveBeenCalledWith('DOM batch operation failed:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should clear operations', () => {
      const batcher = new DOMBatcher();
      const op1 = vi.fn();

      batcher.add(op1);
      batcher.clear();

      if (frameCallback) frameCallback(0);

      expect(op1).not.toHaveBeenCalled();
    });
  });

  describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor(); // Or PerformanceMonitor.getInstance() if we want singleton
      // Since it's singleton in impl but we can instantiate for test if class is exported
      // The class is exported.
      monitor.clearMetrics();
    });

    it('should measure duration', () => {
      // Mock performance.now
      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);

      monitor.startTimer('test');
      now = 1050;
      const duration = monitor.endTimer('test');

      expect(duration).toBe(50);
      expect(monitor.getMetrics()['test']).toBe(50);
    });

    it('should warn if timer not started', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const duration = monitor.endTimer('unknown');
      
      expect(duration).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Timer "unknown" was not started');
      consoleWarnSpy.mockRestore();
    });

    it('should clear metrics', () => {
      vi.spyOn(performance, 'now').mockReturnValue(100);
      monitor.startTimer('test');
      monitor.endTimer('test');
      
      monitor.clearMetrics();
      expect(Object.keys(monitor.getMetrics()).length).toBe(0);
    });
  });

  describe('MemoryMonitor', () => {
    it('should get memory usage if available', () => {
      // Mock performance.memory (Chrome specific)
      const originalPerformance = global.performance;
      Object.defineProperty(global, 'performance', {
        value: {
          ...originalPerformance,
          memory: {
            usedJSHeapSize: 50 * 1024 * 1024,
            totalJSHeapSize: 100 * 1024 * 1024,
          },
          now: originalPerformance.now,
        },
        writable: true,
      });

      const usage = MemoryMonitor.getMemoryUsage();
      expect(usage).toEqual({
        used: 50,
        total: 100,
        percentage: 50,
      });

      // Restore
      Object.defineProperty(global, 'performance', {
        value: originalPerformance,
        writable: true,
      });
    });

    it('should return null if memory API not available', () => {
      const originalPerformance = global.performance;
      Object.defineProperty(global, 'performance', {
        value: {
          now: originalPerformance.now,
          // no memory prop
        },
        writable: true,
      });

      const usage = MemoryMonitor.getMemoryUsage();
      expect(usage).toBeNull();

      // Restore
      Object.defineProperty(global, 'performance', {
        value: originalPerformance,
        writable: true,
      });
    });
  });
});
