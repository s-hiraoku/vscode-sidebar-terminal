/**
 * TerminalCommandQueue Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalCommandQueue } from '../../../../terminals/core/TerminalCommandQueue';

describe('TerminalCommandQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    await vi.advanceTimersByTimeAsync(30);
    await Promise.all([p1, p2, p3]);

    expect(order).toEqual([1, 2, 3]);
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

    await expect(failing).rejects.toThrow('boom');
    await expect(succeeding).resolves.toBe('ok');
    expect(order).toEqual(['fail', 'success']);
  });
});
