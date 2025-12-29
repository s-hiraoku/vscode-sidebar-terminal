/**
 * TerminalInitializationStateMachine Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerminalInitializationStateMachine, TerminalInitializationState } from '../../../../../providers/services/TerminalInitializationStateMachine';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('TerminalInitializationStateMachine', () => {
  let stateMachine: TerminalInitializationStateMachine;
  const terminalId = 'term-123';

  beforeEach(() => {
    stateMachine = new TerminalInitializationStateMachine();
  });

  describe('Initial State', () => {
    it('should return Idle state for unknown terminal', () => {
      expect(stateMachine.getState('unknown')).toBe(TerminalInitializationState.Idle);
    });

    it('should not allow output initially', () => {
      expect(stateMachine.isOutputAllowed(terminalId)).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should transition through states sequentially', () => {
      stateMachine.markViewPending(terminalId);
      expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.ViewPending);

      stateMachine.markViewReady(terminalId);
      expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.ViewReady);

      stateMachine.markPtySpawned(terminalId);
      expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.PtySpawned);
    });

    it('should allow output after OutputStreaming state', () => {
      stateMachine.markShellInitializing(terminalId);
      expect(stateMachine.isOutputAllowed(terminalId)).toBe(false);

      stateMachine.markOutputStreaming(terminalId);
      expect(stateMachine.isOutputAllowed(terminalId)).toBe(true);

      stateMachine.markPromptReady(terminalId);
      expect(stateMachine.isOutputAllowed(terminalId)).toBe(true);
    });

    it('should ignore regressions by default', () => {
      stateMachine.markPtySpawned(terminalId);
      stateMachine.markViewReady(terminalId); // Attempt regression
      
      expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.PtySpawned);
    });

    it('should allow regression to Failed state', () => {
      stateMachine.markPromptReady(terminalId);
      stateMachine.markFailed(terminalId);
      
      expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.Failed);
    });
  });

  describe('Retry Handling', () => {
    it('should increment retry count', () => {
      expect(stateMachine.incrementRetry(terminalId)).toBe(1);
      expect(stateMachine.incrementRetry(terminalId)).toBe(2);
    });

    it('should preserve state while incrementing retry', () => {
      stateMachine.markPtySpawned(terminalId);
      stateMachine.incrementRetry(terminalId);
      
      expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.PtySpawned);
    });
  });

  describe('Reset Management', () => {
    it('should clear state on reset', () => {
      stateMachine.markPtySpawned(terminalId);
      stateMachine.reset(terminalId);
      
      expect(stateMachine.getState(terminalId)).toBe(TerminalInitializationState.Idle);
    });
  });
});