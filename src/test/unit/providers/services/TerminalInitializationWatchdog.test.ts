import { expect } from 'chai';
import * as sinon from 'sinon';
import '../../shared/TestSetup';

import { TerminalInitializationWatchdog } from '../../../../providers/services/TerminalInitializationWatchdog';

describe('TerminalInitializationWatchdog', () => {
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  let callback: sinon.SinonSpy;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
    callback = sandbox.spy();
  });

  afterEach(() => {
    clock.restore();
    sandbox.restore();
  });

  it('invokes callback for each attempt until maxAttempts is reached', () => {
    const watchdog = new TerminalInitializationWatchdog(callback, {
      initialDelayMs: 100,
      maxAttempts: 3,
      backoffFactor: 2,
    });

    watchdog.start('terminal-1', 'unit');

    clock.tick(100);
    expect(callback).to.have.been.calledOnceWithExactly('terminal-1', {
      attempt: 1,
      isFinalAttempt: false,
    });

    clock.tick(200);
    expect(callback).to.have.been.calledTwice;

    clock.tick(400);
    expect(callback).to.have.been.calledThrice;
    const finalCall = callback.getCall(2);
    expect(finalCall.args[1]).to.deep.equal({ attempt: 3, isFinalAttempt: true });
  });

  it('stops timers when stop() is invoked', () => {
    const watchdog = new TerminalInitializationWatchdog(callback, {
      initialDelayMs: 100,
      maxAttempts: 2,
      backoffFactor: 2,
    });

    watchdog.start('terminal-2', 'pre-stop');
    watchdog.stop('terminal-2', 'manual');

    clock.tick(500);
    expect(callback).to.not.have.been.called;
  });

  it('applies per-start override options', () => {
    const watchdog = new TerminalInitializationWatchdog(callback);

    watchdog.start('terminal-3', 'override', {
      initialDelayMs: 50,
      maxAttempts: 1,
    });

    clock.tick(50);
    expect(callback).to.have.been.calledOnceWithExactly('terminal-3', {
      attempt: 1,
      isFinalAttempt: true,
    });
  });
});
