import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateTracker, createIdTracker, createExpiringTracker } from '../../../../../webview/utils/StateTracker';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('StateTracker', () => {
  describe('Basic Operations', () => {
    let tracker: StateTracker<string>;

    beforeEach(() => {
      tracker = new StateTracker<string>();
    });

    afterEach(() => {
      tracker.dispose();
    });

    it('should add items', () => {
      expect(tracker.add('item1')).toBe(true);
      expect(tracker.has('item1')).toBe(true);
      expect(tracker.size).toBe(1);
    });

    it('should not duplicate items', () => {
      tracker.add('item1');
      expect(tracker.add('item1')).toBe(false);
      expect(tracker.size).toBe(1);
    });

    it('should remove items', () => {
      tracker.add('item1');
      expect(tracker.remove('item1')).toBe(true);
      expect(tracker.has('item1')).toBe(false);
      expect(tracker.size).toBe(0);
    });

    it('should return false when removing non-existent item', () => {
      expect(tracker.remove('item1')).toBe(false);
    });

    it('should clear all items', () => {
      tracker.add('item1');
      tracker.add('item2');
      tracker.clear();
      expect(tracker.size).toBe(0);
      expect(tracker.getAll()).toEqual([]);
    });

    it('should get all items', () => {
      tracker.add('item1');
      tracker.add('item2');
      expect(tracker.getAll()).toEqual(expect.arrayContaining(['item1', 'item2']));
    });
  });

  describe('Bulk Operations', () => {
    let tracker: StateTracker<string>;

    beforeEach(() => {
      tracker = new StateTracker<string>();
    });

    it('should add multiple items', () => {
      expect(tracker.addAll(['item1', 'item2', 'item1'])).toBe(2);
      expect(tracker.size).toBe(2);
    });

    it('should remove multiple items', () => {
      tracker.addAll(['item1', 'item2', 'item3']);
      expect(tracker.removeAll(['item1', 'item3', 'item4'])).toBe(2);
      expect(tracker.size).toBe(1);
      expect(tracker.has('item2')).toBe(true);
    });

    it('should check if any exists', () => {
      tracker.add('item1');
      expect(tracker.hasAny(['item1', 'item2'])).toBe(true);
      expect(tracker.hasAny(['item2', 'item3'])).toBe(false);
    });

    it('should check if all exist', () => {
      tracker.addAll(['item1', 'item2']);
      expect(tracker.hasAll(['item1', 'item2'])).toBe(true);
      expect(tracker.hasAll(['item1', 'item3'])).toBe(false);
    });
  });

  describe('TTL and Expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire items after TTL', () => {
      const tracker = new StateTracker<string>({ ttlMs: 1000 });
      tracker.add('item1');
      
      expect(tracker.has('item1')).toBe(true);
      
      // Advance time past TTL
      vi.advanceTimersByTime(1100);
      
      expect(tracker.has('item1')).toBe(false);
      expect(tracker.size).toBe(0);
      tracker.dispose();
    });

    it('should update expiration on re-add', () => {
      const tracker = new StateTracker<string>({ ttlMs: 1000 });
      tracker.add('item1');
      
      vi.advanceTimersByTime(500);
      tracker.add('item1'); // Refresh
      
      vi.advanceTimersByTime(600); // Total 1100ms from start, but only 600ms from refresh
      
      expect(tracker.has('item1')).toBe(true);
      
      vi.advanceTimersByTime(500); // Total 1100ms from refresh
      expect(tracker.has('item1')).toBe(false);
      tracker.dispose();
    });

    it('should automatically cleanup expired items via timer', () => {
      const onRemove = vi.fn();
      const tracker = new StateTracker<string>({ ttlMs: 1000, onRemove });
      tracker.add('item1');
      
      // Timer runs at ttl/2 = 500ms
      vi.advanceTimersByTime(500);
      expect(onRemove).not.toHaveBeenCalled();
      
      // Advance significantly to cover multiple intervals and ensure expiration
      vi.advanceTimersByTime(5000);
      expect(onRemove).toHaveBeenCalledWith('item1');
      tracker.dispose();
    });
  });

  describe('Callbacks', () => {
    it('should call onAdd callback', () => {
      const onAdd = vi.fn();
      const tracker = new StateTracker<string>({ onAdd });
      
      tracker.add('item1');
      expect(onAdd).toHaveBeenCalledWith('item1');
      
      tracker.add('item1'); // Duplicate
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('should call onRemove callback', () => {
      const onRemove = vi.fn();
      const tracker = new StateTracker<string>({ onRemove });
      
      tracker.add('item1');
      tracker.remove('item1');
      expect(onRemove).toHaveBeenCalledWith('item1');
      
      tracker.remove('item1'); // Non-existent
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('should call onRemove when clearing', () => {
      const onRemove = vi.fn();
      const tracker = new StateTracker<string>({ onRemove });
      
      tracker.add('item1');
      tracker.add('item2');
      tracker.clear();
      
      expect(onRemove).toHaveBeenCalledTimes(2);
      expect(onRemove).toHaveBeenCalledWith('item1');
      expect(onRemove).toHaveBeenCalledWith('item2');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should provide correct stats', () => {
      const tracker = new StateTracker<string>();
      
      tracker.add('item1');
      vi.advanceTimersByTime(100);
      tracker.add('item2');
      
      const stats = tracker.getStats();
      expect(stats.total).toBe(2);
      expect(stats.oldest?.item).toBe('item1');
      expect(stats.newest?.item).toBe('item2');
      // Age is approximate due to execution time, but relative order stands
      expect(stats.oldest!.age).toBeGreaterThan(stats.newest!.age);
    });

    it('should return empty stats for empty tracker', () => {
      const tracker = new StateTracker<string>();
      const stats = tracker.getStats();
      expect(stats.total).toBe(0);
      expect(stats.oldest).toBeUndefined();
    });
  });

  describe('Helper Functions', () => {
    it('createIdTracker should create instance', () => {
      const tracker = createIdTracker();
      expect(tracker).toBeInstanceOf(StateTracker);
    });

    it('createExpiringTracker should create instance with TTL', () => {
      vi.useFakeTimers();
      const tracker = createExpiringTracker<string>(1000);
      tracker.add('item1');
      vi.advanceTimersByTime(1100);
      expect(tracker.has('item1')).toBe(false);
      vi.useRealTimers();
    });
  });
});
