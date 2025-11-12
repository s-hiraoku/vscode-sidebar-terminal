import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  TerminalLifecycleStateMachine,
  TerminalLifecycleState,
  StateTransition,
} from '../../../../services/terminal/TerminalLifecycleStateMachine';

describe('TerminalLifecycleStateMachine', () => {
  let stateMachine: TerminalLifecycleStateMachine;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stateMachine = new TerminalLifecycleStateMachine();
  });

  afterEach(() => {
    stateMachine.dispose();
    sandbox.restore();
  });

  describe('Constructor', () => {
    it('should initialize successfully', () => {
      const debugInfo = stateMachine.getDebugInfo();
      assert.strictEqual(debugInfo.totalTerminals, 0);
    });

    it('should accept custom history limit', () => {
      const customStateMachine = new TerminalLifecycleStateMachine(100);
      assert.ok(customStateMachine);
      customStateMachine.dispose();
    });
  });

  describe('initializeTerminal', () => {
    it('should initialize terminal with Creating state', () => {
      const terminalId = 'test-terminal-1';
      const result = stateMachine.initializeTerminal(terminalId);

      assert.strictEqual(result, true);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Creating);
      assert.strictEqual(stateMachine.hasTerminal(terminalId), true);
    });

    it('should not allow initializing same terminal twice', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      const result = stateMachine.initializeTerminal(terminalId);

      assert.strictEqual(result, false);
    });

    it('should record initial transition in history', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);

      const history = stateMachine.getHistory(terminalId);
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0]?.fromState, TerminalLifecycleState.Creating);
      assert.strictEqual(history[0]?.toState, TerminalLifecycleState.Creating);
    });

    it('should accept metadata', () => {
      const terminalId = 'test-terminal-1';
      const metadata = { name: 'Terminal 1', pid: 1234 };
      stateMachine.initializeTerminal(terminalId, metadata);

      const history = stateMachine.getHistory(terminalId);
      assert.deepStrictEqual(history[0]?.metadata, metadata);
    });
  });

  describe('transition', () => {
    it('should transition from Creating to Initializing', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);

      const result = stateMachine.transition(
        terminalId,
        TerminalLifecycleState.Initializing,
        'Starting initialization'
      );

      assert.strictEqual(result, true);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Initializing);
    });

    it('should reject invalid transitions', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);

      // Cannot go directly from Creating to Active
      const result = stateMachine.transition(terminalId, TerminalLifecycleState.Active);

      assert.strictEqual(result, false);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Creating);
    });

    it('should record transition in history', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transition(terminalId, TerminalLifecycleState.Initializing, 'Test reason');

      const history = stateMachine.getHistory(terminalId);
      assert.strictEqual(history.length, 2); // Initial + transition
      assert.strictEqual(history[1]?.fromState, TerminalLifecycleState.Creating);
      assert.strictEqual(history[1]?.toState, TerminalLifecycleState.Initializing);
      assert.strictEqual(history[1]?.reason, 'Test reason');
    });

    it('should emit state change event on transition', (done) => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);

      stateMachine.onStateChange((transition: StateTransition) => {
        assert.strictEqual(transition.terminalId, terminalId);
        assert.strictEqual(transition.fromState, TerminalLifecycleState.Creating);
        assert.strictEqual(transition.toState, TerminalLifecycleState.Initializing);
        done();
      });

      stateMachine.transition(terminalId, TerminalLifecycleState.Initializing);
    });

    it('should not transition unknown terminal', () => {
      const result = stateMachine.transition('unknown', TerminalLifecycleState.Ready);
      assert.strictEqual(result, false);
    });

    it('should handle full lifecycle transition', () => {
      const terminalId = 'test-terminal-1';

      stateMachine.initializeTerminal(terminalId);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Creating);

      stateMachine.transition(terminalId, TerminalLifecycleState.Initializing);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Initializing);

      stateMachine.transition(terminalId, TerminalLifecycleState.Ready);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Ready);

      stateMachine.transition(terminalId, TerminalLifecycleState.Active);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Active);

      stateMachine.transition(terminalId, TerminalLifecycleState.Inactive);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Inactive);

      stateMachine.transition(terminalId, TerminalLifecycleState.Closing);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Closing);

      stateMachine.transition(terminalId, TerminalLifecycleState.Closed);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Closed);
    });

    it('should handle Active <-> Inactive transitions', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transition(terminalId, TerminalLifecycleState.Initializing);
      stateMachine.transition(terminalId, TerminalLifecycleState.Ready);
      stateMachine.transition(terminalId, TerminalLifecycleState.Active);

      // Active -> Inactive
      stateMachine.transition(terminalId, TerminalLifecycleState.Inactive);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Inactive);

      // Inactive -> Active
      stateMachine.transition(terminalId, TerminalLifecycleState.Active);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Active);
    });
  });

  describe('transitionToError', () => {
    it('should transition to error state from any non-closed state', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);

      const result = stateMachine.transitionToError(terminalId, 'Test error');

      assert.strictEqual(result, true);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Error);
    });

    it('should not allow error transition from Closed state', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transition(terminalId, TerminalLifecycleState.Initializing);
      stateMachine.transition(terminalId, TerminalLifecycleState.Closing);
      stateMachine.transition(terminalId, TerminalLifecycleState.Closed);

      const result = stateMachine.transitionToError(terminalId, 'Test error');

      assert.strictEqual(result, false);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Closed);
    });

    it('should record error transition with reason', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transitionToError(terminalId, 'PTY creation failed', { errorCode: 500 });

      const history = stateMachine.getHistory(terminalId);
      const lastTransition = history[history.length - 1];

      assert.strictEqual(lastTransition?.toState, TerminalLifecycleState.Error);
      assert.strictEqual(lastTransition?.reason, 'PTY creation failed');
      assert.deepStrictEqual(lastTransition?.metadata, { errorCode: 500 });
    });
  });

  describe('isInState', () => {
    it('should correctly check terminal state', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);

      assert.strictEqual(stateMachine.isInState(terminalId, TerminalLifecycleState.Creating), true);
      assert.strictEqual(stateMachine.isInState(terminalId, TerminalLifecycleState.Ready), false);
    });
  });

  describe('canTransitionTo', () => {
    it('should correctly check if transition is valid', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);

      assert.strictEqual(
        stateMachine.canTransitionTo(terminalId, TerminalLifecycleState.Initializing),
        true
      );
      assert.strictEqual(stateMachine.canTransitionTo(terminalId, TerminalLifecycleState.Active), false);
    });

    it('should return false for unknown terminal', () => {
      assert.strictEqual(
        stateMachine.canTransitionTo('unknown', TerminalLifecycleState.Ready),
        false
      );
    });
  });

  describe('getHistory', () => {
    it('should return empty array for unknown terminal', () => {
      const history = stateMachine.getHistory('unknown');
      assert.deepStrictEqual(history, []);
    });

    it('should limit history size', () => {
      const smallStateMachine = new TerminalLifecycleStateMachine(5);
      const terminalId = 'test-terminal-1';

      smallStateMachine.initializeTerminal(terminalId);
      smallStateMachine.transition(terminalId, TerminalLifecycleState.Initializing);
      smallStateMachine.transition(terminalId, TerminalLifecycleState.Ready);
      smallStateMachine.transition(terminalId, TerminalLifecycleState.Active);
      smallStateMachine.transition(terminalId, TerminalLifecycleState.Inactive);
      smallStateMachine.transition(terminalId, TerminalLifecycleState.Active);
      smallStateMachine.transition(terminalId, TerminalLifecycleState.Inactive);

      const history = smallStateMachine.getHistory(terminalId);
      assert.strictEqual(history.length, 5); // Limited to max

      smallStateMachine.dispose();
    });
  });

  describe('getTerminalsInState', () => {
    it('should return terminals in specific state', () => {
      stateMachine.initializeTerminal('terminal1');
      stateMachine.initializeTerminal('terminal2');
      stateMachine.transition('terminal1', TerminalLifecycleState.Initializing);

      const creatingTerminals = stateMachine.getTerminalsInState(TerminalLifecycleState.Creating);
      const initializingTerminals = stateMachine.getTerminalsInState(
        TerminalLifecycleState.Initializing
      );

      assert.strictEqual(creatingTerminals.length, 1);
      assert.strictEqual(creatingTerminals[0], 'terminal2');
      assert.strictEqual(initializingTerminals.length, 1);
      assert.strictEqual(initializingTerminals[0], 'terminal1');
    });

    it('should return empty array if no terminals in state', () => {
      stateMachine.initializeTerminal('terminal1');

      const activeTerminals = stateMachine.getTerminalsInState(TerminalLifecycleState.Active);
      assert.deepStrictEqual(activeTerminals, []);
    });
  });

  describe('getStateCounts', () => {
    it('should count terminals in each state', () => {
      stateMachine.initializeTerminal('terminal1');
      stateMachine.initializeTerminal('terminal2');
      stateMachine.transition('terminal1', TerminalLifecycleState.Initializing);
      stateMachine.transition('terminal1', TerminalLifecycleState.Ready);

      const counts = stateMachine.getStateCounts();

      assert.strictEqual(counts[TerminalLifecycleState.Creating], 1);
      assert.strictEqual(counts[TerminalLifecycleState.Ready], 1);
      assert.strictEqual(counts[TerminalLifecycleState.Active], 0);
    });
  });

  describe('getAllStates', () => {
    it('should return all terminals and their states', () => {
      stateMachine.initializeTerminal('terminal1');
      stateMachine.initializeTerminal('terminal2');

      const allStates = stateMachine.getAllStates();

      assert.strictEqual(allStates.size, 2);
      assert.strictEqual(allStates.get('terminal1'), TerminalLifecycleState.Creating);
      assert.strictEqual(allStates.get('terminal2'), TerminalLifecycleState.Creating);
    });
  });

  describe('removeTerminal', () => {
    it('should remove terminal in Closed state', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transition(terminalId, TerminalLifecycleState.Initializing);
      stateMachine.transition(terminalId, TerminalLifecycleState.Closing);
      stateMachine.transition(terminalId, TerminalLifecycleState.Closed);

      const result = stateMachine.removeTerminal(terminalId);

      assert.strictEqual(result, true);
      assert.strictEqual(stateMachine.hasTerminal(terminalId), false);
    });

    it('should not remove terminal not in Closed state', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);

      const result = stateMachine.removeTerminal(terminalId);

      assert.strictEqual(result, false);
      assert.strictEqual(stateMachine.hasTerminal(terminalId), true);
    });

    it('should not remove unknown terminal', () => {
      const result = stateMachine.removeTerminal('unknown');
      assert.strictEqual(result, false);
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information', () => {
      stateMachine.initializeTerminal('terminal1');
      stateMachine.initializeTerminal('terminal2');
      stateMachine.transition('terminal1', TerminalLifecycleState.Initializing);

      const debugInfo = stateMachine.getDebugInfo();

      assert.strictEqual(debugInfo.totalTerminals, 2);
      assert.strictEqual(debugInfo.terminals.length, 2);
      assert.strictEqual(debugInfo.stateCounts[TerminalLifecycleState.Creating], 1);
      assert.strictEqual(debugInfo.stateCounts[TerminalLifecycleState.Initializing], 1);
    });
  });

  describe('clear', () => {
    it('should clear all state', () => {
      stateMachine.initializeTerminal('terminal1');
      stateMachine.initializeTerminal('terminal2');

      stateMachine.clear();

      const debugInfo = stateMachine.getDebugInfo();
      assert.strictEqual(debugInfo.totalTerminals, 0);
    });
  });

  describe('State Validation', () => {
    it('should prevent invalid transition from Closed state', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transition(terminalId, TerminalLifecycleState.Initializing);
      stateMachine.transition(terminalId, TerminalLifecycleState.Closing);
      stateMachine.transition(terminalId, TerminalLifecycleState.Closed);

      // Cannot transition from Closed to any state
      const result = stateMachine.transition(terminalId, TerminalLifecycleState.Active);

      assert.strictEqual(result, false);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Closed);
    });

    it('should allow transition from Error to Closing', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transitionToError(terminalId, 'Test error');

      const result = stateMachine.transition(terminalId, TerminalLifecycleState.Closing);

      assert.strictEqual(result, true);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Closing);
    });

    it('should allow transition from Error to Closed', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transitionToError(terminalId, 'Test error');

      const result = stateMachine.transition(terminalId, TerminalLifecycleState.Closed);

      assert.strictEqual(result, true);
      assert.strictEqual(stateMachine.getState(terminalId), TerminalLifecycleState.Closed);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid state transitions', () => {
      const terminalId = 'test-terminal-1';
      stateMachine.initializeTerminal(terminalId);
      stateMachine.transition(terminalId, TerminalLifecycleState.Initializing);
      stateMachine.transition(terminalId, TerminalLifecycleState.Ready);
      stateMachine.transition(terminalId, TerminalLifecycleState.Active);
      stateMachine.transition(terminalId, TerminalLifecycleState.Inactive);
      stateMachine.transition(terminalId, TerminalLifecycleState.Active);

      const history = stateMachine.getHistory(terminalId);
      assert.ok(history.length >= 5); // Should have all transitions
    });

    it('should handle multiple terminals independently', () => {
      stateMachine.initializeTerminal('terminal1');
      stateMachine.initializeTerminal('terminal2');
      stateMachine.transition('terminal1', TerminalLifecycleState.Initializing);
      stateMachine.transition('terminal2', TerminalLifecycleState.Initializing);
      stateMachine.transition('terminal1', TerminalLifecycleState.Ready);

      assert.strictEqual(stateMachine.getState('terminal1'), TerminalLifecycleState.Ready);
      assert.strictEqual(stateMachine.getState('terminal2'), TerminalLifecycleState.Initializing);
    });
  });
});
