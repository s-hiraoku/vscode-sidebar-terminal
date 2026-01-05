/**
 * DebouncedEventBuffer Unit Tests
 *
 * Tests for debouncing, throttling, and event buffering utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Debouncer,
  Throttler,
  EventBuffer,
  KeyedEventBuffer,
  createDebouncer,
  createResizeDebouncer,
  createOutputBuffer,
} from '../../../../../webview/utils/DebouncedEventBuffer';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('DebouncedEventBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Debouncer', () => {
    describe('basic functionality', () => {
      it('should delay execution by specified delay', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100 });

        debouncer.trigger();
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.dispose();
      });

      it('should reset timer on subsequent triggers', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100 });

        debouncer.trigger();
        vi.advanceTimersByTime(50);

        debouncer.trigger();
        vi.advanceTimersByTime(50);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.dispose();
      });

      it('should execute immediately on leading edge when configured', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100, leading: true });

        debouncer.trigger();
        expect(callback).toHaveBeenCalledTimes(1);

        // Trailing edge execution
        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(2);

        debouncer.dispose();
      });

      it('should not execute on trailing edge when trailing is false', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100, leading: true, trailing: false });

        debouncer.trigger();
        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.dispose();
      });
    });

    describe('cancel', () => {
      it('should cancel pending execution', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100 });

        debouncer.trigger();
        vi.advanceTimersByTime(50);
        debouncer.cancel();

        vi.advanceTimersByTime(100);
        expect(callback).not.toHaveBeenCalled();

        debouncer.dispose();
      });

      it('should reset leading executed flag', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100, leading: true, trailing: false });

        debouncer.trigger();
        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.cancel();

        debouncer.trigger();
        expect(callback).toHaveBeenCalledTimes(2);

        debouncer.dispose();
      });
    });

    describe('flush', () => {
      it('should execute immediately and cancel pending', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100 });

        debouncer.trigger();
        debouncer.flush();
        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.dispose();
      });
    });

    describe('isPending', () => {
      it('should return true when execution is pending', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100 });

        expect(debouncer.isPending()).toBe(false);

        debouncer.trigger();
        expect(debouncer.isPending()).toBe(true);

        vi.advanceTimersByTime(100);
        expect(debouncer.isPending()).toBe(false);

        debouncer.dispose();
      });
    });

    describe('dispose', () => {
      it('should cancel pending and clean up', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100 });

        debouncer.trigger();
        debouncer.dispose();

        vi.advanceTimersByTime(100);
        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('debug logging', () => {
      it('should log when debug is enabled', () => {
        const callback = vi.fn();
        const debouncer = new Debouncer(callback, { delay: 100, debug: true, name: 'test' });

        debouncer.trigger();
        vi.advanceTimersByTime(100);

        debouncer.dispose();
      });
    });
  });

  describe('Throttler', () => {
    describe('basic functionality', () => {
      it('should execute immediately on first call (leading)', () => {
        const callback = vi.fn();
        const throttler = new Throttler(callback, { interval: 100 });

        throttler.trigger('arg1');
        expect(callback).toHaveBeenCalledWith('arg1');

        throttler.dispose();
      });

      it('should throttle subsequent calls', () => {
        const callback = vi.fn();
        const throttler = new Throttler(callback, { interval: 100 });

        throttler.trigger('first');
        throttler.trigger('second');
        throttler.trigger('third');

        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenLastCalledWith('third');

        throttler.dispose();
      });

      it('should allow execution after interval passes', () => {
        const callback = vi.fn();
        const throttler = new Throttler(callback, { interval: 100 });

        throttler.trigger('first');
        vi.advanceTimersByTime(100);

        throttler.trigger('second');
        expect(callback).toHaveBeenCalledTimes(2);

        throttler.dispose();
      });

      it('should not execute on leading when leading is false', () => {
        const callback = vi.fn();
        const throttler = new Throttler(callback, { interval: 100, leading: false });

        throttler.trigger('arg');
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledWith('arg');

        throttler.dispose();
      });

      it('should not execute on trailing when trailing is false', () => {
        const callback = vi.fn();
        const throttler = new Throttler(callback, { interval: 100, trailing: false });

        throttler.trigger('first');
        throttler.trigger('second');

        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(1);

        throttler.dispose();
      });
    });

    describe('cancel', () => {
      it('should cancel pending trailing execution', () => {
        const callback = vi.fn();
        const throttler = new Throttler(callback, { interval: 100 });

        throttler.trigger('first');
        throttler.trigger('second');
        throttler.cancel();

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(1);

        throttler.dispose();
      });
    });

    describe('dispose', () => {
      it('should cancel pending and clean up', () => {
        const callback = vi.fn();
        const throttler = new Throttler(callback, { interval: 100 });

        throttler.trigger('first');
        throttler.trigger('second');
        throttler.dispose();

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('EventBuffer', () => {
    describe('add', () => {
      it('should buffer items and flush after interval', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('item1');
        buffer.add('item2');

        expect(onFlush).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(onFlush).toHaveBeenCalledWith(['item1', 'item2']);

        buffer.dispose();
      });

      it('should flush when maxBufferSize is reached', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          maxBufferSize: 3,
          onFlush,
        });

        buffer.add('item1');
        buffer.add('item2');
        expect(onFlush).not.toHaveBeenCalled();

        buffer.add('item3');
        expect(onFlush).toHaveBeenCalledWith(['item1', 'item2', 'item3']);

        buffer.dispose();
      });

      it('should not flush on max when flushOnMax is false', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          maxBufferSize: 3,
          flushOnMax: false,
          onFlush,
        });

        buffer.add('item1');
        buffer.add('item2');
        buffer.add('item3');
        buffer.add('item4');

        expect(onFlush).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(onFlush).toHaveBeenCalledWith(['item1', 'item2', 'item3', 'item4']);

        buffer.dispose();
      });
    });

    describe('addAll', () => {
      it('should add multiple items at once', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.addAll(['item1', 'item2', 'item3']);

        vi.advanceTimersByTime(100);
        expect(onFlush).toHaveBeenCalledWith(['item1', 'item2', 'item3']);

        buffer.dispose();
      });
    });

    describe('flush', () => {
      it('should flush immediately', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('item1');
        buffer.flush();
        expect(onFlush).toHaveBeenCalledWith(['item1']);

        buffer.dispose();
      });

      it('should not call onFlush if buffer is empty', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.flush();
        expect(onFlush).not.toHaveBeenCalled();

        buffer.dispose();
      });
    });

    describe('clear', () => {
      it('should clear buffer without flushing', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('item1');
        buffer.add('item2');
        buffer.clear();

        vi.advanceTimersByTime(100);
        expect(onFlush).not.toHaveBeenCalled();

        buffer.dispose();
      });
    });

    describe('properties', () => {
      it('should return correct size', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        expect(buffer.size).toBe(0);

        buffer.add('item1');
        expect(buffer.size).toBe(1);

        buffer.add('item2');
        expect(buffer.size).toBe(2);

        buffer.dispose();
      });

      it('should return correct isEmpty', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        expect(buffer.isEmpty).toBe(true);

        buffer.add('item1');
        expect(buffer.isEmpty).toBe(false);

        buffer.dispose();
      });

      it('should return correct isFlushScheduled', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        expect(buffer.isFlushScheduled).toBe(false);

        buffer.add('item1');
        expect(buffer.isFlushScheduled).toBe(true);

        vi.advanceTimersByTime(100);
        expect(buffer.isFlushScheduled).toBe(false);

        buffer.dispose();
      });
    });

    describe('dispose', () => {
      it('should flush remaining items on dispose', () => {
        const onFlush = vi.fn();
        const buffer = new EventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('item1');
        buffer.dispose();

        expect(onFlush).toHaveBeenCalledWith(['item1']);
      });
    });
  });

  describe('KeyedEventBuffer', () => {
    describe('add', () => {
      it('should buffer items by key', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('key1', 'item1');
        buffer.add('key1', 'item2');
        buffer.add('key2', 'item3');

        vi.advanceTimersByTime(100);

        expect(onFlush).toHaveBeenCalledWith('key1', ['item1', 'item2']);
        expect(onFlush).toHaveBeenCalledWith('key2', ['item3']);

        buffer.dispose();
      });

      it('should flush when maxBufferSize is reached for a key', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          maxBufferSize: 2,
          onFlush,
        });

        buffer.add('key1', 'item1');
        buffer.add('key1', 'item2');

        expect(onFlush).toHaveBeenCalledWith('key1', ['item1', 'item2']);

        buffer.dispose();
      });
    });

    describe('flushKey', () => {
      it('should flush specific key only', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('key1', 'item1');
        buffer.add('key2', 'item2');

        buffer.flushKey('key1');

        expect(onFlush).toHaveBeenCalledTimes(1);
        expect(onFlush).toHaveBeenCalledWith('key1', ['item1']);

        buffer.dispose();
      });

      it('should do nothing if key does not exist', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.flushKey('nonexistent');
        expect(onFlush).not.toHaveBeenCalled();

        buffer.dispose();
      });
    });

    describe('flushAll', () => {
      it('should flush all keys', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('key1', 'item1');
        buffer.add('key2', 'item2');

        buffer.flushAll();

        expect(onFlush).toHaveBeenCalledTimes(2);

        buffer.dispose();
      });
    });

    describe('clearKey', () => {
      it('should clear specific key without flushing', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('key1', 'item1');
        buffer.add('key2', 'item2');

        buffer.clearKey('key1');

        vi.advanceTimersByTime(100);

        expect(onFlush).toHaveBeenCalledTimes(1);
        expect(onFlush).toHaveBeenCalledWith('key2', ['item2']);

        buffer.dispose();
      });
    });

    describe('clearAll', () => {
      it('should clear all keys without flushing', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('key1', 'item1');
        buffer.add('key2', 'item2');

        buffer.clearAll();

        vi.advanceTimersByTime(100);

        expect(onFlush).not.toHaveBeenCalled();

        buffer.dispose();
      });
    });

    describe('getSize', () => {
      it('should return size for a key', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        expect(buffer.getSize('key1')).toBe(0);

        buffer.add('key1', 'item1');
        expect(buffer.getSize('key1')).toBe(1);

        buffer.add('key1', 'item2');
        expect(buffer.getSize('key1')).toBe(2);

        buffer.dispose();
      });
    });

    describe('getKeys', () => {
      it('should return all keys', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        expect(buffer.getKeys()).toEqual([]);

        buffer.add('key1', 'item1');
        buffer.add('key2', 'item2');

        expect(buffer.getKeys()).toEqual(['key1', 'key2']);

        buffer.dispose();
      });
    });

    describe('dispose', () => {
      it('should flush and clear all on dispose', () => {
        const onFlush = vi.fn();
        const buffer = new KeyedEventBuffer<string>({
          flushInterval: 100,
          onFlush,
        });

        buffer.add('key1', 'item1');
        buffer.add('key2', 'item2');

        buffer.dispose();

        expect(onFlush).toHaveBeenCalledTimes(2);
        expect(buffer.getKeys()).toEqual([]);
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createDebouncer', () => {
      it('should create a debouncer with specified delay', () => {
        const callback = vi.fn();
        const debouncer = createDebouncer(callback, 50);

        debouncer.trigger();
        vi.advanceTimersByTime(50);

        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.dispose();
      });

      it('should accept additional options', () => {
        const callback = vi.fn();
        const debouncer = createDebouncer(callback, 50, { leading: true });

        debouncer.trigger();
        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.dispose();
      });
    });

    describe('createResizeDebouncer', () => {
      it('should create a debouncer with default 100ms delay', () => {
        const callback = vi.fn();
        const debouncer = createResizeDebouncer(callback);

        debouncer.trigger();
        vi.advanceTimersByTime(99);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.dispose();
      });

      it('should accept custom delay', () => {
        const callback = vi.fn();
        const debouncer = createResizeDebouncer(callback, 200);

        debouncer.trigger();
        vi.advanceTimersByTime(200);

        expect(callback).toHaveBeenCalledTimes(1);

        debouncer.dispose();
      });
    });

    describe('createOutputBuffer', () => {
      it('should create a buffer with default 16ms interval', () => {
        const onFlush = vi.fn();
        const buffer = createOutputBuffer<string>(onFlush);

        buffer.add('item');
        vi.advanceTimersByTime(16);

        expect(onFlush).toHaveBeenCalledWith(['item']);

        buffer.dispose();
      });

      it('should create a buffer with default 100 max size', () => {
        const onFlush = vi.fn();
        const buffer = createOutputBuffer<number>(onFlush);

        for (let i = 0; i < 100; i++) {
          buffer.add(i);
        }

        expect(onFlush).toHaveBeenCalled();

        buffer.dispose();
      });

      it('should accept custom options', () => {
        const onFlush = vi.fn();
        const buffer = createOutputBuffer<string>(onFlush, {
          flushInterval: 50,
          maxBufferSize: 5,
        });

        for (let i = 0; i < 5; i++) {
          buffer.add(`item${i}`);
        }

        expect(onFlush).toHaveBeenCalled();

        buffer.dispose();
      });
    });
  });
});
