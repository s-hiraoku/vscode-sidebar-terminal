import { expect } from 'chai';
import * as sinon from 'sinon';

import '../../shared/TestSetup';
import { TerminalCommandQueue } from '../../../terminals/core/TerminalCommandQueue';

describe('TerminalCommandQueue', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('processes operations sequentially even when enqueued at once', async () => {
    const queue = new TerminalCommandQueue();
    const order: number[] = [];

    const op = (id: number, delay: number) =>
      queue.enqueue(async () => {
        order.push(id);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return id;
      });

    const p1 = op(1, 20);
    const p2 = op(2, 0);
    const p3 = op(3, 5);

    clock.tick(30);
    await Promise.all([p1, p2, p3]);

    expect(order).to.deep.equal([1, 2, 3]);
  });

  it('continues processing after a rejection', async () => {
    const queue = new TerminalCommandQueue();
    const order: string[] = [];

    const failing = queue.enqueue(async () => {
      order.push('fail');
      throw new Error('boom');
    });

    const succeeding = queue.enqueue(async () => {
      order.push('success');
      return 'ok';
    });

    await expect(failing).to.be.rejectedWith('boom');
    await expect(succeeding).to.eventually.equal('ok');
    expect(order).to.deep.equal(['fail', 'success']);
  });
});
