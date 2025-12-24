/**
 * TerminalLifecycleStateMachine Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 *
 * Tests for the terminal lifecycle state machine implementation.
 * Addresses issue #221: Terminal Lifecycle State Machine Implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TerminalLifecycleStateMachine,
  TerminalLifecycleStateMachineManager,
  TerminalLifecycleState,
  StateChangeEvent,
} from '../../../../../services/state/TerminalLifecycleStateMachine';

describe('TerminalLifecycleStateMachine', () => {
  describe('Basic State Management', () => {
    it('should initialize with Creating state by default', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Creating);
    });

    it('should initialize with custom initial state', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1', TerminalLifecycleState.Ready);
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Ready);
    });

    it('should return correct terminal ID', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      expect(stateMachine.getTerminalId()).toBe('term1');
    });

    it('should correctly check if in specific state', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1', TerminalLifecycleState.Ready);
      expect(stateMachine.isInState(TerminalLifecycleState.Ready)).toBe(true);
      expect(stateMachine.isInState(TerminalLifecycleState.Active)).toBe(false);
    });

    it('should correctly check if in any of specified states', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1', TerminalLifecycleState.Ready);
      expect(
        stateMachine.isInAnyState([TerminalLifecycleState.Ready, TerminalLifecycleState.Active])
      ).toBe(true);
      expect(
        stateMachine.isInAnyState([
          TerminalLifecycleState.Creating,
          TerminalLifecycleState.Initializing,
        ])
      ).toBe(false);
    });
  });

  describe('State Transition Rules', () => {
    it('should allow valid transition: Creating -> Initializing', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      expect(() => stateMachine.transition(TerminalLifecycleState.Initializing)).not.toThrow();
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Initializing);
    });

    it('should allow valid transition: Initializing -> Ready', () => {
      const stateMachine = new TerminalLifecycleStateMachine(
        'term1',
        TerminalLifecycleState.Initializing
      );
      expect(() => stateMachine.transition(TerminalLifecycleState.Ready)).not.toThrow();
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Ready);
    });

    it('should allow valid transition: Ready -> Active', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1', TerminalLifecycleState.Ready);
      expect(() => stateMachine.transition(TerminalLifecycleState.Active)).not.toThrow();
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Active);
    });

    it('should allow valid transition: Active -> Ready', () => {
      const stateMachine = new TerminalLifecycleStateMachine(
        'term1',
        TerminalLifecycleState.Active
      );
      expect(() => stateMachine.transition(TerminalLifecycleState.Ready)).not.toThrow();
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Ready);
    });

    it('should allow valid transition: Active -> Closing', () => {
      const stateMachine = new TerminalLifecycleStateMachine(
        'term1',
        TerminalLifecycleState.Active
      );
      expect(() => stateMachine.transition(TerminalLifecycleState.Closing)).not.toThrow();
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Closing);
    });

    it('should allow valid transition: Closing -> Closed', () => {
      const stateMachine = new TerminalLifecycleStateMachine(
        'term1',
        TerminalLifecycleState.Closing
      );
      expect(() => stateMachine.transition(TerminalLifecycleState.Closed)).not.toThrow();
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Closed);
    });

    it('should allow transition to Error from any non-terminal state', () => {
      const states = [
        TerminalLifecycleState.Creating,
        TerminalLifecycleState.Initializing,
        TerminalLifecycleState.Ready,
        TerminalLifecycleState.Active,
        TerminalLifecycleState.Closing,
      ];

      for (const state of states) {
        const stateMachine = new TerminalLifecycleStateMachine('term1', state);
        expect(() => stateMachine.transition(TerminalLifecycleState.Error)).not.toThrow();
        expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Error);
      }
    });

    it('should reject invalid transition: Creating -> Ready', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      expect(() => stateMachine.transition(TerminalLifecycleState.Ready)).toThrow(
        'Invalid state transition'
      );
    });

    it('should reject invalid transition: Ready -> Initializing', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1', TerminalLifecycleState.Ready);
      expect(() => stateMachine.transition(TerminalLifecycleState.Initializing)).toThrow(
        'Invalid state transition'
      );
    });

    it('should reject any transition from Closed state', () => {
      const stateMachine = new TerminalLifecycleStateMachine(
        'term1',
        TerminalLifecycleState.Closed
      );
      expect(() => stateMachine.transition(TerminalLifecycleState.Ready)).toThrow(
        'Invalid state transition'
      );
    });

    it('should correctly identify valid next states', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1', TerminalLifecycleState.Ready);
      const validStates = stateMachine.getValidNextStates();
      expect(validStates).toContain(TerminalLifecycleState.Active);
      expect(validStates).toContain(TerminalLifecycleState.Closing);
      expect(validStates).toContain(TerminalLifecycleState.Error);
      expect(validStates).not.toContain(TerminalLifecycleState.Initializing);
    });

    it('should correctly check if transition is valid', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1', TerminalLifecycleState.Ready);
      expect(stateMachine.canTransitionTo(TerminalLifecycleState.Active)).toBe(true);
      expect(stateMachine.canTransitionTo(TerminalLifecycleState.Initializing)).toBe(false);
    });
  });

  describe('Transition Metadata', () => {
    it('should include metadata in transition', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      stateMachine.transition(TerminalLifecycleState.Initializing, {
        reason: 'Test reason',
        data: { key: 'value' },
      });

      const lastTransition = stateMachine.getLastTransition();
      expect(lastTransition).toBeDefined();
      if (lastTransition) {
        expect(lastTransition.metadata.reason).toBe('Test reason');
        expect(lastTransition.metadata.data).toEqual({ key: 'value' });
        expect(lastTransition.metadata.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should include error in metadata when transitioning to Error state', () => {
      const stateMachine = new TerminalLifecycleStateMachine(
        'term1',
        TerminalLifecycleState.Active
      );
      const error = new Error('Test error');
      stateMachine.transition(TerminalLifecycleState.Error, {
        error,
        reason: 'Process crashed',
      });

      const lastTransition = stateMachine.getLastTransition();
      expect(lastTransition).toBeDefined();
      if (lastTransition) {
        expect(lastTransition.metadata.error).toBe(error);
        expect(lastTransition.metadata.reason).toBe('Process crashed');
      }
    });
  });

  describe('Transition History', () => {
    it('should track transition history', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      stateMachine.transition(TerminalLifecycleState.Initializing);
      stateMachine.transition(TerminalLifecycleState.Ready);
      stateMachine.transition(TerminalLifecycleState.Active);

      const history = stateMachine.getTransitionHistory();
      expect(history).toHaveLength(3);
      expect(history[0]!.from).toBe(TerminalLifecycleState.Creating);
      expect(history[0]!.to).toBe(TerminalLifecycleState.Initializing);
      expect(history[1]!.from).toBe(TerminalLifecycleState.Initializing);
      expect(history[1]!.to).toBe(TerminalLifecycleState.Ready);
      expect(history[2]!.from).toBe(TerminalLifecycleState.Ready);
      expect(history[2]!.to).toBe(TerminalLifecycleState.Active);
    });

    it('should limit history size', () => {
      const stateMachine = new TerminalLifecycleStateMachine(
        'term1',
        TerminalLifecycleState.Creating,
        2 // Max history size
      );

      stateMachine.transition(TerminalLifecycleState.Initializing);
      stateMachine.transition(TerminalLifecycleState.Ready);
      stateMachine.transition(TerminalLifecycleState.Active);

      const history = stateMachine.getTransitionHistory();
      expect(history).toHaveLength(2); // Only last 2 transitions
      expect(history[0]!.to).toBe(TerminalLifecycleState.Ready);
      expect(history[1]!.to).toBe(TerminalLifecycleState.Active);
    });

    it('should return limited history when requested', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      stateMachine.transition(TerminalLifecycleState.Initializing);
      stateMachine.transition(TerminalLifecycleState.Ready);
      stateMachine.transition(TerminalLifecycleState.Active);

      const history = stateMachine.getTransitionHistory(2);
      expect(history).toHaveLength(2);
      expect(history[0]!.to).toBe(TerminalLifecycleState.Ready);
      expect(history[1]!.to).toBe(TerminalLifecycleState.Active);
    });

    it('should return last transition', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      stateMachine.transition(TerminalLifecycleState.Initializing);
      stateMachine.transition(TerminalLifecycleState.Ready);

      const lastTransition = stateMachine.getLastTransition();
      expect(lastTransition).toBeDefined();
      if (lastTransition) {
        expect(lastTransition.to).toBe(TerminalLifecycleState.Ready);
      }
    });

    it('should clear history', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      stateMachine.transition(TerminalLifecycleState.Initializing);
      stateMachine.transition(TerminalLifecycleState.Ready);

      stateMachine.clearHistory();
      const history = stateMachine.getTransitionHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('State Change Listeners', () => {
    it('should notify listeners on state change', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      let eventReceived: StateChangeEvent | null = null;

      stateMachine.addListener((event) => {
        eventReceived = event;
      });

      stateMachine.transition(TerminalLifecycleState.Initializing);

      expect(eventReceived).toBeDefined();
      expect(eventReceived!.terminalId).toBe('term1');
      expect(eventReceived!.previousState).toBe(TerminalLifecycleState.Creating);
      expect(eventReceived!.newState).toBe(TerminalLifecycleState.Initializing);
    });

    it('should support multiple listeners', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      let listener1Called = false;
      let listener2Called = false;

      stateMachine.addListener(() => {
        listener1Called = true;
      });
      stateMachine.addListener(() => {
        listener2Called = true;
      });

      stateMachine.transition(TerminalLifecycleState.Initializing);

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });

    it('should remove listener when disposable is called', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      let callCount = 0;

      const dispose = stateMachine.addListener(() => {
        callCount++;
      });

      stateMachine.transition(TerminalLifecycleState.Initializing);
      expect(callCount).toBe(1);

      dispose();
      stateMachine.transition(TerminalLifecycleState.Ready);
      expect(callCount).toBe(1); // Not called again
    });

    it('should remove listener directly', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      stateMachine.addListener(listener);
      stateMachine.transition(TerminalLifecycleState.Initializing);
      expect(callCount).toBe(1);

      stateMachine.removeListener(listener);
      stateMachine.transition(TerminalLifecycleState.Ready);
      expect(callCount).toBe(1);
    });

    it('should clear all listeners', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      let callCount = 0;

      stateMachine.addListener(() => callCount++);
      stateMachine.addListener(() => callCount++);

      stateMachine.clearListeners();
      stateMachine.transition(TerminalLifecycleState.Initializing);
      expect(callCount).toBe(0);
    });

    it('should return correct listener count', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      expect(stateMachine.getListenerCount()).toBe(0);

      stateMachine.addListener(() => {});
      stateMachine.addListener(() => {});
      expect(stateMachine.getListenerCount()).toBe(2);

      stateMachine.clearListeners();
      expect(stateMachine.getListenerCount()).toBe(0);
    });

    it('should handle listener errors gracefully', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      let goodListenerCalled = false;

      stateMachine.addListener(() => {
        throw new Error('Listener error');
      });
      stateMachine.addListener(() => {
        goodListenerCalled = true;
      });

      // Should not throw despite error in first listener
      expect(() => stateMachine.transition(TerminalLifecycleState.Initializing)).not.toThrow();
      expect(goodListenerCalled).toBe(true);
    });
  });

  describe('Force Transition', () => {
    it('should allow forced transition bypassing validation', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      // Invalid transition normally
      expect(() => stateMachine.transition(TerminalLifecycleState.Closed)).toThrow();

      // Should work with force
      expect(() => stateMachine.forceTransition(TerminalLifecycleState.Closed)).not.toThrow();
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Closed);
    });

    it('should record forced transitions in history', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      stateMachine.forceTransition(TerminalLifecycleState.Closed);

      const lastTransition = stateMachine.getLastTransition();
      expect(lastTransition).toBeDefined();
      if (lastTransition) {
        expect(lastTransition.to).toBe(TerminalLifecycleState.Closed);
        expect(lastTransition.metadata.reason).toContain('Forced transition');
      }
    });
  });

  describe('State Summary', () => {
    it('should provide complete state summary', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      stateMachine.transition(TerminalLifecycleState.Initializing);
      stateMachine.transition(TerminalLifecycleState.Ready);

      const summary = stateMachine.getStateSummary();
      expect(summary.terminalId).toBe('term1');
      expect(summary.currentState).toBe(TerminalLifecycleState.Ready);
      expect(summary.validNextStates).toContain(TerminalLifecycleState.Active);
      expect(summary.transitionCount).toBe(2);
      expect(summary.lastTransition).toBeDefined();
    });
  });

  describe('Disposal', () => {
    it('should clean up resources on dispose', () => {
      const stateMachine = new TerminalLifecycleStateMachine('term1');
      stateMachine.addListener(() => {});
      stateMachine.transition(TerminalLifecycleState.Initializing);

      stateMachine.dispose();

      expect(stateMachine.getListenerCount()).toBe(0);
      expect(stateMachine.getTransitionHistory()).toHaveLength(0);
    });
  });
});

describe('TerminalLifecycleStateMachineManager', () => {
  let manager: TerminalLifecycleStateMachineManager;

  beforeEach(() => {
    manager = new TerminalLifecycleStateMachineManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('State Machine Creation', () => {
    it('should create a new state machine', () => {
      const stateMachine = manager.createStateMachine('term1');
      expect(stateMachine).toBeDefined();
      expect(stateMachine.getTerminalId()).toBe('term1');
      expect(manager.hasStateMachine('term1')).toBe(true);
    });

    it('should throw error when creating duplicate state machine', () => {
      manager.createStateMachine('term1');
      expect(() => manager.createStateMachine('term1')).toThrow('already exists');
    });

    it('should create state machine with custom initial state', () => {
      const stateMachine = manager.createStateMachine('term1', TerminalLifecycleState.Ready);
      expect(stateMachine.getCurrentState()).toBe(TerminalLifecycleState.Ready);
    });
  });

  describe('State Machine Retrieval', () => {
    it('should get existing state machine', () => {
      manager.createStateMachine('term1');
      const stateMachine = manager.getStateMachine('term1');
      expect(stateMachine).toBeDefined();
      expect(stateMachine?.getTerminalId()).toBe('term1');
    });

    it('should return undefined for non-existent state machine', () => {
      const stateMachine = manager.getStateMachine('term1');
      expect(stateMachine).toBeUndefined();
    });

    it('should get or create state machine', () => {
      const stateMachine1 = manager.getOrCreateStateMachine('term1');
      expect(stateMachine1).toBeDefined();

      const stateMachine2 = manager.getOrCreateStateMachine('term1');
      expect(stateMachine1).toBe(stateMachine2);
    });
  });

  describe('State Machine Removal', () => {
    it('should remove existing state machine', () => {
      manager.createStateMachine('term1');
      const result = manager.removeStateMachine('term1');
      expect(result).toBe(true);
      expect(manager.hasStateMachine('term1')).toBe(false);
    });

    it('should return false when removing non-existent state machine', () => {
      const result = manager.removeStateMachine('term1');
      expect(result).toBe(false);
    });
  });

  describe('State Queries', () => {
    it('should get current state for terminal', () => {
      const stateMachine = manager.createStateMachine('term1');
      stateMachine.transition(TerminalLifecycleState.Initializing);

      const state = manager.getCurrentState('term1');
      expect(state).toBe(TerminalLifecycleState.Initializing);
    });

    it('should return undefined for non-existent terminal state', () => {
      const state = manager.getCurrentState('term1');
      expect(state).toBeUndefined();
    });

    it('should check if terminal is in specific state', () => {
      const stateMachine = manager.createStateMachine('term1');
      stateMachine.transition(TerminalLifecycleState.Initializing);

      expect(manager.isTerminalInState('term1', TerminalLifecycleState.Initializing)).toBe(true);
      expect(manager.isTerminalInState('term1', TerminalLifecycleState.Ready)).toBe(false);
    });

    it('should return false for non-existent terminal state check', () => {
      expect(manager.isTerminalInState('term1', TerminalLifecycleState.Ready)).toBe(false);
    });

    it('should get all terminals in specific state', () => {
      const sm1 = manager.createStateMachine('term1');
      const sm2 = manager.createStateMachine('term2');
      const sm3 = manager.createStateMachine('term3');

      sm1.transition(TerminalLifecycleState.Initializing);
      sm1.transition(TerminalLifecycleState.Ready);
      sm2.transition(TerminalLifecycleState.Initializing);
      sm2.transition(TerminalLifecycleState.Ready);
      sm3.transition(TerminalLifecycleState.Initializing);

      const readyTerminals = manager.getTerminalsInState(TerminalLifecycleState.Ready);
      expect(readyTerminals).toHaveLength(2);
      expect(readyTerminals).toContain('term1');
      expect(readyTerminals).toContain('term2');

      const initializingTerminals = manager.getTerminalsInState(
        TerminalLifecycleState.Initializing
      );
      expect(initializingTerminals).toHaveLength(1);
      expect(initializingTerminals).toContain('term3');
    });
  });

  describe('Global Listeners', () => {
    it('should add global listener to all state machines', () => {
      let eventCount = 0;
      manager.addGlobalListener(() => eventCount++);

      const sm1 = manager.createStateMachine('term1');
      const sm2 = manager.createStateMachine('term2');

      sm1.transition(TerminalLifecycleState.Initializing);
      sm2.transition(TerminalLifecycleState.Initializing);

      expect(eventCount).toBe(2);
    });

    it('should add global listener to newly created state machines', () => {
      let eventCount = 0;
      manager.addGlobalListener(() => eventCount++);

      const sm1 = manager.createStateMachine('term1');
      sm1.transition(TerminalLifecycleState.Initializing);
      expect(eventCount).toBe(1);

      const sm2 = manager.createStateMachine('term2');
      sm2.transition(TerminalLifecycleState.Initializing);
      expect(eventCount).toBe(2);
    });

    it('should remove global listener from all state machines', () => {
      let eventCount = 0;
      const listener = () => eventCount++;

      manager.addGlobalListener(listener);
      const sm1 = manager.createStateMachine('term1');
      const sm2 = manager.createStateMachine('term2');

      sm1.transition(TerminalLifecycleState.Initializing);
      sm2.transition(TerminalLifecycleState.Initializing);
      expect(eventCount).toBe(2);

      manager.removeGlobalListener(listener);
      sm1.transition(TerminalLifecycleState.Ready);
      sm2.transition(TerminalLifecycleState.Ready);
      expect(eventCount).toBe(2); // Not incremented
    });

    it('should clear all global listeners', () => {
      let eventCount = 0;
      manager.addGlobalListener(() => eventCount++);
      manager.addGlobalListener(() => eventCount++);

      const sm = manager.createStateMachine('term1');
      sm.transition(TerminalLifecycleState.Initializing);
      expect(eventCount).toBe(2);

      manager.clearGlobalListeners();
      sm.transition(TerminalLifecycleState.Ready);
      expect(eventCount).toBe(2);
    });
  });

  describe('Bulk Operations', () => {
    it('should get all terminal IDs', () => {
      manager.createStateMachine('term1');
      manager.createStateMachine('term2');
      manager.createStateMachine('term3');

      const ids = manager.getAllTerminalIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('term1');
      expect(ids).toContain('term2');
      expect(ids).toContain('term3');
    });

    it('should get all state summaries', () => {
      manager.createStateMachine('term1');
      manager.createStateMachine('term2');

      const summaries = manager.getAllStateSummaries();
      expect(summaries.size).toBe(2);
      expect(summaries.has('term1')).toBe(true);
      expect(summaries.has('term2')).toBe(true);
    });

    it('should get state machine count', () => {
      expect(manager.getStateMachineCount()).toBe(0);

      manager.createStateMachine('term1');
      manager.createStateMachine('term2');
      expect(manager.getStateMachineCount()).toBe(2);

      manager.removeStateMachine('term1');
      expect(manager.getStateMachineCount()).toBe(1);
    });
  });

  describe('Disposal', () => {
    it('should dispose all state machines', () => {
      const sm1 = manager.createStateMachine('term1');
      const sm2 = manager.createStateMachine('term2');

      sm1.addListener(() => {});
      sm2.addListener(() => {});

      manager.dispose();

      expect(manager.getStateMachineCount()).toBe(0);
      expect(sm1.getListenerCount()).toBe(0);
      expect(sm2.getListenerCount()).toBe(0);
    });
  });
});
