
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DOMManager } from '../../../../../webview/utils/DOMManager';

describe('DOMManager', () => {
  beforeEach(() => {
    DOMManager.clearPendingCallbacks();
    vi.useFakeTimers();
    // requestAnimationFrame mock is provided by vitest/jsdom but we can control it with fake timers
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(cb, 16);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('scheduleAtNextAnimationFrame', () => {
    it('should schedule and execute callback', async () => {
      const callback = vi.fn();
      DOMManager.scheduleAtNextAnimationFrame(callback);
      
      expect(callback).not.toHaveBeenCalled();
      
      vi.runAllTimers();
      
      expect(callback).toHaveBeenCalled();
    });

    it('should execute callbacks in priority order', () => {
      const executionOrder: string[] = [];
      
      DOMManager.scheduleAtNextAnimationFrame(() => executionOrder.push('low'), -10);
      DOMManager.scheduleAtNextAnimationFrame(() => executionOrder.push('high'), 10);
      DOMManager.scheduleAtNextAnimationFrame(() => executionOrder.push('normal'), 0);
      
      vi.runAllTimers();
      
      expect(executionOrder).toEqual(['high', 'normal', 'low']);
    });

    it('should allow cancellation via disposable', () => {
      const callback = vi.fn();
      const disposable = DOMManager.scheduleAtNextAnimationFrame(callback);
      
      disposable.dispose();
      
      vi.runAllTimers();
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('runAtThisOrScheduleAtNextAnimationFrame', () => {
    it('should run immediately if no pending callbacks', () => {
      const callback = vi.fn();
      DOMManager.runAtThisOrScheduleAtNextAnimationFrame(callback);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should schedule if there are pending callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      DOMManager.scheduleAtNextAnimationFrame(callback1);
      DOMManager.runAtThisOrScheduleAtNextAnimationFrame(callback2);
      
      expect(callback2).not.toHaveBeenCalled();
      
      vi.runAllTimers();
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    it('should schedule read with high priority', () => {
      const executionOrder: string[] = [];
      
      DOMManager.scheduleWrite(() => executionOrder.push('write'));
      DOMManager.scheduleRead(() => executionOrder.push('read'));
      
      vi.runAllTimers();
      
      expect(executionOrder).toEqual(['read', 'write']);
    });
  });
});
