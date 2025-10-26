import { expect } from 'chai';
import * as sinon from 'sinon';

import '../../shared/TestSetup';
import { TerminalLifecycleService } from '../../../terminals/core/TerminalLifecycleService';

describe('TerminalLifecycleService', () => {
  it('serializes delete operations through the shared queue', async () => {
    const service = new TerminalLifecycleService();
    const order: number[] = [];

    const enqueueOp = (id: number, delayMs: number) =>
      service.enqueue(async () => {
        order.push(id);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return id;
      });

    const p1 = enqueueOp(1, 10);
    const p2 = enqueueOp(2, 0);

    await Promise.all([p1, p2]);
    expect(order).to.deep.equal([1, 2]);
  });

  it('tracks terminals currently being killed', () => {
    const service = new TerminalLifecycleService();

    service.markBeingKilled('t1');
    expect(service.isBeingKilled('t1')).to.be.true;

    service.unmarkBeingKilled('t1');
    expect(service.isBeingKilled('t1')).to.be.false;

    service.markBeingKilled('t2');
    service.clear();
    expect(service.isBeingKilled('t2')).to.be.false;
  });
});
