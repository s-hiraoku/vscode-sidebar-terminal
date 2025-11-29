import { expect } from 'chai';

import '../test-setup';
import { CircularBuffer } from '../../../utils/CircularBuffer';

describe('CircularBuffer', () => {
  it('uses the default capacity and starts empty', () => {
    const buffer = new CircularBuffer();
    expect(buffer.getCapacity()).to.equal(50);
    expect(buffer.isEmpty()).to.be.true;
    expect(buffer.getSize()).to.equal(0);
    expect(buffer.flush()).to.equal('');
    expect(buffer.peek()).to.equal('');
  });

  it('throws when initialized with a non-positive capacity', () => {
    expect(() => new CircularBuffer(0)).to.throw('capacity');
    expect(() => new CircularBuffer(-5)).to.throw('capacity');
  });

  it('buffers data in FIFO order and resets after flush', () => {
    const buffer = new CircularBuffer(3);
    buffer.push('a');
    buffer.push('bc');

    expect(buffer.getSize()).to.equal(2);
    expect(buffer.peek()).to.equal('abc');

    const flushed = buffer.flush();
    expect(flushed).to.equal('abc');
    expect(buffer.isEmpty()).to.be.true;
  });

  it('does not clear data when peeking', () => {
    const buffer = new CircularBuffer(2);
    buffer.push('x');
    const firstPeek = buffer.peek();
    expect(firstPeek).to.equal('x');
    expect(buffer.getSize()).to.equal(1);
    expect(buffer.flush()).to.equal('x');
  });

  it('overwrites the oldest entries once the buffer is full', () => {
    const buffer = new CircularBuffer(3);
    buffer.push('a');
    buffer.push('b');
    buffer.push('c');
    buffer.push('d');

    expect(buffer.getSize()).to.equal(3);
    expect(buffer.peek()).to.equal('bcd');
    expect(buffer.flush()).to.equal('bcd');
    expect(buffer.isEmpty()).to.be.true;
  });

  it('reports the cumulative data length', () => {
    const buffer = new CircularBuffer(4);
    buffer.push('ab');
    buffer.push('cde');
    expect(buffer.getDataLength()).to.equal(5);
  });

  it('can be cleared and reused without leaking entries', () => {
    const buffer = new CircularBuffer(2);
    buffer.push('foo');
    buffer.clear();
    expect(buffer.isEmpty()).to.be.true;
    expect(buffer.getSize()).to.equal(0);

    buffer.push('bar');
    expect(buffer.flush()).to.equal('bar');
  });
});
