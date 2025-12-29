/**
 * ResizeManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResizeManager } from '../../../../../webview/utils/ResizeManager';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('ResizeManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ResizeManager.dispose();
  });

  afterEach(() => {
    vi.useRealTimers();
    ResizeManager.dispose();
  });

  describe('debounceResize', () => {
    it('should debounce consecutive calls', () => {
      const callback = vi.fn();
      ResizeManager.debounceResize('test-key', callback, { delay: 100 });
      ResizeManager.debounceResize('test-key', callback, { delay: 100 });
      
      vi.advanceTimersByTime(50);
      expect(callback).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(50);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should execute immediately if requested', () => {
      const callback = vi.fn();
      ResizeManager.debounceResize('test-key', callback, { immediate: true });
      expect(callback).toHaveBeenCalled();
    });

    it('should call onStart and onComplete', async () => {
      const start = vi.fn();
      const complete = vi.fn();
      const callback = vi.fn().mockResolvedValue(undefined);
      
      ResizeManager.debounceResize('test-key', callback, { 
        delay: 100, 
        onStart: start, 
        onComplete: complete 
      });
      
      expect(start).toHaveBeenCalled();
      expect(complete).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      // Wait for promise resolution in executeResize
      await vi.runAllTicks();
      
      expect(callback).toHaveBeenCalled();
      expect(complete).toHaveBeenCalled();
    });
  });

  describe('ResizeObserver', () => {
    let resizeCallback: any;
    class MockResizeObserver {
      constructor(callback: any) {
        resizeCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }

    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', MockResizeObserver);
    });

    it('should setup observer and handle resize', () => {
      const element = document.createElement('div');
      const callback = vi.fn();
      
      ResizeManager.observeResize('obs-key', element, callback, { 
        delay: 100,
        skipFirstCallback: false 
      });
      
      const mockEntry = { contentRect: { width: 100, height: 100 } };
      resizeCallback([mockEntry]);
      
      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalled();
    });

    it('should skip first callback by default', () => {
      const element = document.createElement('div');
      const callback = vi.fn();
      
      ResizeManager.observeResize('obs-key', element, callback);
      
      const mockEntry = { contentRect: { width: 100, height: 100 } };
      resizeCallback([mockEntry]); // 1st call
      
      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
      
      resizeCallback([mockEntry]); // 2nd call
      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalled();
    });

    it('should honor global pause', () => {
      const element = document.createElement('div');
      const callback = vi.fn();
      ResizeManager.observeResize('obs-key', element, callback, { skipFirstCallback: false });
      
      ResizeManager.pauseObservers();
      expect(ResizeManager.isPaused()).toBe(true);
      
      resizeCallback([{ contentRect: { width: 100, height: 100 } }]);
      vi.advanceTimersByTime(1000);
      
      expect(callback).not.toHaveBeenCalled();
      
      ResizeManager.resumeObservers();
      expect(ResizeManager.isPaused()).toBe(false);
    });
  });

  describe('Management and Cleanup', () => {
    it('should check pending state', () => {
      ResizeManager.debounceResize('key1', () => {});
      expect(ResizeManager.isPending('key1')).toBe(true);
      expect(ResizeManager.getPendingKeys()).toContain('key1');
      
      ResizeManager.clearResize('key1');
      expect(ResizeManager.isPending('key1')).toBe(false);
    });

    it('should flush all pending operations', () => {
      const c1 = vi.fn();
      ResizeManager.debounceResize('k1', c1);
      
      ResizeManager.flushAll();
      expect(ResizeManager.getPendingKeys().length).toBe(0);
      // flushAll currently clears timers but doesn't execute them (as per implementation)
      expect(c1).not.toHaveBeenCalled();
    });

    it('should provide status', () => {
      ResizeManager.debounceResize('k1', () => {});
      const status = ResizeManager.getStatus();
      expect(status.pendingTimers).toBe(1);
    });
  });
});