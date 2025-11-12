import { describe, it, expect, beforeEach } from '@jest/globals';
import { CircularBuffer } from '../../../utils/CircularBuffer';

describe('CircularBuffer', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer(5); // Small capacity for testing
  });

  describe('constructor', () => {
    it('should create buffer with specified capacity', () => {
      const customBuffer = new CircularBuffer(10);
      expect(customBuffer.getCapacity()).toBe(10);
    });

    it('should throw error for invalid capacity', () => {
      expect(() => new CircularBuffer(0)).toThrow('CircularBuffer capacity must be greater than 0');
      expect(() => new CircularBuffer(-1)).toThrow(
        'CircularBuffer capacity must be greater than 0'
      );
    });

    it('should default capacity to 50', () => {
      const defaultBuffer = new CircularBuffer();
      expect(defaultBuffer.getCapacity()).toBe(50);
    });
  });

  describe('push', () => {
    it('should push data to buffer', () => {
      const result = buffer.push('test1');
      expect(result).toBe(true);
      expect(buffer.getSize()).toBe(1);
    });

    it('should push multiple items', () => {
      buffer.push('test1');
      buffer.push('test2');
      buffer.push('test3');
      expect(buffer.getSize()).toBe(3);
    });

    it('should handle buffer overflow by overwriting oldest data', () => {
      // Fill buffer to capacity
      buffer.push('test1');
      buffer.push('test2');
      buffer.push('test3');
      buffer.push('test4');
      buffer.push('test5');
      expect(buffer.isFull()).toBe(true);

      // Push one more item (should overwrite oldest)
      buffer.push('test6');
      expect(buffer.getSize()).toBe(5);
      expect(buffer.isFull()).toBe(true);

      // Verify oldest data was overwritten
      const data = buffer.flush();
      expect(data).toBe('test2test3test4test5test6');
    });
  });

  describe('flush', () => {
    it('should return empty string for empty buffer', () => {
      expect(buffer.flush()).toBe('');
    });

    it('should return combined data and clear buffer', () => {
      buffer.push('hello');
      buffer.push(' ');
      buffer.push('world');

      const result = buffer.flush();
      expect(result).toBe('hello world');
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.getSize()).toBe(0);
    });

    it('should handle flush after partial fill', () => {
      buffer.push('test1');
      buffer.push('test2');

      const result = buffer.flush();
      expect(result).toBe('test1test2');
      expect(buffer.getSize()).toBe(0);
    });

    it('should handle multiple flush operations', () => {
      buffer.push('first');
      expect(buffer.flush()).toBe('first');

      buffer.push('second');
      expect(buffer.flush()).toBe('second');

      expect(buffer.isEmpty()).toBe(true);
    });
  });

  describe('peek', () => {
    it('should return empty string for empty buffer', () => {
      expect(buffer.peek()).toBe('');
    });

    it('should return data without clearing buffer', () => {
      buffer.push('test1');
      buffer.push('test2');

      const peeked = buffer.peek();
      expect(peeked).toBe('test1test2');
      expect(buffer.getSize()).toBe(2); // Size unchanged
      expect(buffer.isEmpty()).toBe(false);
    });

    it('should allow multiple peeks', () => {
      buffer.push('data');
      expect(buffer.peek()).toBe('data');
      expect(buffer.peek()).toBe('data');
      expect(buffer.getSize()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear empty buffer', () => {
      buffer.clear();
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.getSize()).toBe(0);
    });

    it('should clear buffer with data', () => {
      buffer.push('test1');
      buffer.push('test2');
      buffer.clear();

      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.getSize()).toBe(0);
      expect(buffer.flush()).toBe('');
    });

    it('should allow reuse after clear', () => {
      buffer.push('test1');
      buffer.clear();
      buffer.push('test2');

      expect(buffer.getSize()).toBe(1);
      expect(buffer.flush()).toBe('test2');
    });
  });

  describe('state methods', () => {
    it('should correctly report empty state', () => {
      expect(buffer.isEmpty()).toBe(true);
      buffer.push('data');
      expect(buffer.isEmpty()).toBe(false);
      buffer.flush();
      expect(buffer.isEmpty()).toBe(true);
    });

    it('should correctly report full state', () => {
      expect(buffer.isFull()).toBe(false);

      // Fill to capacity
      for (let i = 0; i < 5; i++) {
        buffer.push(`item${i}`);
      }

      expect(buffer.isFull()).toBe(true);
    });

    it('should correctly report size', () => {
      expect(buffer.getSize()).toBe(0);
      buffer.push('test');
      expect(buffer.getSize()).toBe(1);
      buffer.push('test2');
      expect(buffer.getSize()).toBe(2);
      buffer.flush();
      expect(buffer.getSize()).toBe(0);
    });

    it('should correctly report capacity', () => {
      expect(buffer.getCapacity()).toBe(5);
      const largeBuffer = new CircularBuffer(100);
      expect(largeBuffer.getCapacity()).toBe(100);
    });
  });

  describe('getDataLength', () => {
    it('should return 0 for empty buffer', () => {
      expect(buffer.getDataLength()).toBe(0);
    });

    it('should return total length of buffered data', () => {
      buffer.push('12345'); // 5 chars
      buffer.push('abc'); // 3 chars
      expect(buffer.getDataLength()).toBe(8);
    });

    it('should update after flush', () => {
      buffer.push('test');
      expect(buffer.getDataLength()).toBeGreaterThan(0);
      buffer.flush();
      expect(buffer.getDataLength()).toBe(0);
    });
  });

  describe('circular wrapping', () => {
    it('should correctly wrap around when full', () => {
      // Fill buffer
      buffer.push('1');
      buffer.push('2');
      buffer.push('3');
      buffer.push('4');
      buffer.push('5');

      // Overflow - should overwrite oldest
      buffer.push('6');
      buffer.push('7');

      const data = buffer.flush();
      expect(data).toBe('34567');
    });

    it('should handle continuous wrap around', () => {
      // Simulate continuous data flow
      for (let i = 0; i < 20; i++) {
        buffer.push(`item${i}`);
      }

      expect(buffer.getSize()).toBe(5); // Should remain at capacity
      const data = buffer.flush();
      expect(data).toContain('item19'); // Latest should be present
    });
  });

  describe('edge cases', () => {
    it('should handle empty string push', () => {
      buffer.push('');
      expect(buffer.getSize()).toBe(1);
      expect(buffer.flush()).toBe('');
    });

    it('should handle large strings', () => {
      const largeString = 'x'.repeat(10000);
      buffer.push(largeString);
      expect(buffer.getDataLength()).toBe(10000);
    });

    it('should handle special characters', () => {
      buffer.push('\x1b[31m'); // ANSI escape
      buffer.push('color\n');
      buffer.push('\t\r');

      const result = buffer.flush();
      expect(result).toBe('\x1b[31mcolor\n\t\r');
    });

    it('should handle unicode characters', () => {
      buffer.push('Hello 👋');
      buffer.push(' 世界');

      const result = buffer.flush();
      expect(result).toBe('Hello 👋 世界');
    });
  });

  describe('performance characteristics', () => {
    it('should perform push in O(1) time', () => {
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        buffer.push(`item${i}`);
      }

      const duration = Date.now() - start;
      // Should complete in reasonable time (< 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
    });

    it('should perform flush in O(n) time', () => {
      // Fill buffer
      for (let i = 0; i < buffer.getCapacity(); i++) {
        buffer.push(`item${i}`);
      }

      const start = Date.now();
      buffer.flush();
      const duration = Date.now() - start;

      // Flush should be fast
      expect(duration).toBeLessThan(10);
    });
  });
});
