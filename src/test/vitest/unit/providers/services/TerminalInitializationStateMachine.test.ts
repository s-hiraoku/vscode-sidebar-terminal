/**
 * TerminalInitializationStateMachine Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '../../../../shared/TestSetup';

import {
  TerminalInitializationStateMachine,
  TerminalInitializationState,
} from '../../../../../providers/services/TerminalInitializationStateMachine';

describe('TerminalInitializationStateMachine', () => {
  const terminalId = 'terminal-test';
  let stateMachine: TerminalInitializationStateMachine;

  beforeEach(() => {
    stateMachine = new TerminalInitializationStateMachine();
  });

  it('starts in Idle and blocks output until streaming is allowed', () => {
    expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.Idle);
    expect(stateMachine.isOutputAllowed(terminalId)).toBe(false);

    stateMachine.markOutputStreaming(terminalId, 'unit');
    expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.OutputStreaming);
    expect(stateMachine.isOutputAllowed(terminalId)).toBe(true);
  });

  it('prevents state regressions by default', () => {
    stateMachine.markPtySpawned(terminalId, 'spawned');
    expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.PtySpawned);

    stateMachine.markViewPending(terminalId, 'late-message');
    expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.PtySpawned);
  });

  it('allows failure state overrides and reset cleanup', () => {
    stateMachine.markPtySpawned(terminalId, 'spawned');
    stateMachine.markFailed(terminalId, 'error');

    expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.Failed);

    stateMachine.reset(terminalId);
    expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.Idle);
  });

  it('tracks retry counts even before explicit state transitions', () => {
    expect(stateMachine.incrementRetry(terminalId)).toBe(1);
    expect(stateMachine.incrementRetry(terminalId)).toBe(2);
    expect(stateMachine.incrementRetry(terminalId)).toBe(3);
  });
});
