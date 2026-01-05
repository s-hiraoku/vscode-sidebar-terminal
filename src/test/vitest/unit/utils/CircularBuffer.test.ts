/**
 * CircularBuffer Tests
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect } from 'vitest';
import { CircularBuffer } from '../../../../utils/CircularBuffer';

describe('CircularBuffer', () => {
  it('uses the default capacity and starts empty', () => {
    const buffer = new CircularBuffer();
    expect(buffer.getCapacity()).toBe(50);
    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.getSize()).toBe(0);
    expect(buffer.flush()).toBe('');
    expect(buffer.peek()).toBe('');
  });

  it('throws when initialized with a non-positive capacity', () => {
    expect(() => new CircularBuffer(0)).toThrow('capacity');
    expect(() => new CircularBuffer(-5)).toThrow('capacity');
  });

  it('buffers data in FIFO order and resets after flush', () => {
    const buffer = new CircularBuffer(3);
    buffer.push('a');
    buffer.push('bc');

    expect(buffer.getSize()).toBe(2);
    expect(buffer.peek()).toBe('abc');

    const flushed = buffer.flush();
    expect(flushed).toBe('abc');
    expect(buffer.isEmpty()).toBe(true);
  });

  it('does not clear data when peeking', () => {
    const buffer = new CircularBuffer(2);
    buffer.push('x');
    const firstPeek = buffer.peek();
    expect(firstPeek).toBe('x');
    expect(buffer.getSize()).toBe(1);
    expect(buffer.flush()).toBe('x');
  });

  it('overwrites the oldest entries once the buffer is full', () => {
    const buffer = new CircularBuffer(3);
    buffer.push('a');
    buffer.push('b');
    buffer.push('c');
    buffer.push('d');

    expect(buffer.getSize()).toBe(3);
    expect(buffer.peek()).toBe('bcd');
    expect(buffer.flush()).toBe('bcd');
    expect(buffer.isEmpty()).toBe(true);
  });

  it('reports the cumulative data length', () => {
    const buffer = new CircularBuffer(4);
    buffer.push('ab');
    buffer.push('cde');
    expect(buffer.getDataLength()).toBe(5);
  });

  it('can be cleared and reused without leaking entries', () => {
    const buffer = new CircularBuffer(2);
    buffer.push('foo');
    buffer.clear();
    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.getSize()).toBe(0);

    buffer.push('bar');
    expect(buffer.flush()).toBe('bar');
  });
});
