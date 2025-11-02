/**
 * InputStateManager TDD Test Suite
 * Following t-wada's TDD methodology for comprehensive state management testing
 * RED-GREEN-REFACTOR cycles with focus on state validation, error handling, and listeners
 */

// import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import {
  InputStateManager,
  IMECompositionState,
  AltClickState,
  KeyboardState,
  AgentInteractionState,
  InputState as _InputState,
  StateChangeListener
} from '../../../../../../webview/managers/input/services/InputStateManager';

describe('InputStateManager TDD Test Suite', () => {
  let stateManager: InputStateManager;
  let mockLogger: sinon.SinonStub;
  let logMessages: string[];
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    // Arrange: Setup mock logger to capture all log messages
    logMessages = [];
    mockLogger = sinon.stub().callsFake((message: string) => {
      logMessages.push(message);
    });

    // Setup fake timers for timestamp testing
    clock = sinon.useFakeTimers(Date.now());

    // Create state manager instance
    stateManager = new InputStateManager(mockLogger);
  });

  afterEach(() => {
    // Cleanup: Essential for preventing test pollution
    clock.restore();
    stateManager.dispose();
  });

  describe('TDD Red Phase: Initialization and Default State', () => {
    describe('Service Construction', () => {
      it('should initialize with default logger when none provided', () => {
        // Act: Create state manager without logger
        const defaultManager = new InputStateManager();

        // Assert: Should not throw and should be functional
        expect(() => {
          defaultManager.getState();
        }).to.not.throw();

        defaultManager.dispose();
      });

      it('should log initialization message', () => {
        // Assert: Should have logged initialization
        expect(logMessages).to.include('InputStateManager initialized');
      });

      it('should initialize with default IME state', () => {
        // Act: Get initial IME state
        const imeState = stateManager.getStateSection('ime');

        // Assert: Should have correct default IME state
        expect(imeState.isActive).to.be.false;
        expect(imeState.data).to.equal('');
        expect(imeState.startOffset).to.equal(0);
        expect(imeState.endOffset).to.equal(0);
        expect(imeState.lastEvent).to.be.null;
        expect(imeState.timestamp).to.equal(0);
      });

      it('should initialize with default Alt+Click state', () => {
        // Act: Get initial Alt+Click state
        const altClickState = stateManager.getStateSection('altClick');

        // Assert: Should have correct default Alt+Click state
        expect(altClickState.isVSCodeAltClickEnabled).to.be.false;
        expect(altClickState.isAltKeyPressed).to.be.false;
        expect(altClickState.lastClickPosition).to.be.null;
        expect(altClickState.clickCount).to.equal(0);
      });

      it('should initialize with default keyboard state', () => {
        // Act: Get initial keyboard state
        const keyboardState = stateManager.getStateSection('keyboard');

        // Assert: Should have correct default keyboard state
        expect(keyboardState.isInChordMode).to.be.false;
        expect(keyboardState.lastKeyPressed).to.be.null;
        expect(keyboardState.modifiers.ctrl).to.be.false;
        expect(keyboardState.modifiers.alt).to.be.false;
        expect(keyboardState.modifiers.shift).to.be.false;
        expect(keyboardState.modifiers.meta).to.be.false;
        expect(keyboardState.lastKeyTimestamp).to.equal(0);
      });

      it('should initialize with default agent interaction state', () => {
        // Act: Get initial agent state
        const agentState = stateManager.getStateSection('agent');

        // Assert: Should have correct default agent state
        expect(agentState.isAgentMode).to.be.false;
        expect(agentState.agentType).to.be.null;
        expect(agentState.isAwaitingResponse).to.be.false;
        expect(agentState.lastCommand).to.be.null;
        expect(agentState.commandTimestamp).to.equal(0);
      });

      it('should initialize with no critical state active', () => {
        // Act: Check critical state
        const hasCriticalState = stateManager.hasCriticalStateActive();

        // Assert: Should not have critical state initially
        expect(hasCriticalState).to.be.false;
      });
    });

    describe('State Deep Cloning', () => {
      it('should return deep copies of state to prevent external modification', () => {
        // Arrange: Modify IME state
        stateManager.updateIMEState({
          isActive: true,
          data: 'test',
          timestamp: Date.now()
        });

        // Act: Get state and attempt to modify it
        const state = stateManager.getState();
        const originalTimestamp = state.ime.timestamp;

        // Modify the returned state
        (state.ime as any).timestamp = 999999;
        (state.ime as any).data = 'modified';

        // Act: Get state again
        const freshState = stateManager.getState();

        // Assert: Original state should be unchanged (deep copy protection)
        expect(freshState.ime.timestamp).to.equal(originalTimestamp);
        expect(freshState.ime.data).to.equal('test');
      });

      it('should return deep copies of state sections', () => {
        // Arrange: Set keyboard state
        stateManager.updateKeyboardState({
          lastKeyPressed: 'Enter',
          modifiers: { ctrl: true, alt: false, shift: true, meta: false }
        });

        // Act: Get state section and attempt to modify
        const keyboardState = stateManager.getStateSection('keyboard');
        const originalKey = keyboardState.lastKeyPressed;

        (keyboardState as any).lastKeyPressed = 'modified';
        (keyboardState.modifiers as any).ctrl = false;

        // Act: Get state section again
        const freshKeyboardState = stateManager.getStateSection('keyboard');

        // Assert: Original state should be unchanged
        expect(freshKeyboardState.lastKeyPressed).to.equal(originalKey);
        expect(freshKeyboardState.modifiers.ctrl).to.be.true;
      });
    });
  });

  describe('TDD Red Phase: State Updates and Change Detection', () => {
    describe('IME State Management', () => {
      it('should update IME state and trigger change notifications', () => {
        // Arrange: State change listener
        const stateChanges: any[] = [];
        const listener: StateChangeListener = (newState, previousState, stateKey) => {
          stateChanges.push({ newState, previousState, stateKey });
        };

        stateManager.addStateListener('ime', listener);

        // Act: Update IME state
        const updates: Partial<IMECompositionState> = {
          isActive: true,
          data: 'こんにちは',
          startOffset: 0,
          endOffset: 5,
          lastEvent: 'update',
          timestamp: Date.now()
        };

        stateManager.updateIMEState(updates);

        // Assert: State should be updated
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.true;
        expect(imeState.data).to.equal('こんにちは');
        expect(imeState.lastEvent).to.equal('update');

        // Assert: Change listener should be called
        expect(stateChanges).to.have.length(1);
        expect(stateChanges[0].stateKey).to.equal('ime');
        expect(stateChanges[0].newState.isActive).to.be.true;
        expect(stateChanges[0].previousState.isActive).to.be.false;
      });

      it('should validate IME state and log warnings for invalid data', () => {
        // Act: Update with questionable IME state
        stateManager.updateIMEState({
          isActive: true,
          data: '', // Active but no data
          lastEvent: 'update' // Not a start event
        });

        // Assert: Should log validation warning
        const warningLogs = logMessages.filter(msg =>
          msg.includes('State validation warnings for ime') &&
          msg.includes('IME active but no composition data')
        );
        expect(warningLogs).to.have.length.greaterThan(0);
      });

      it('should validate IME state and log errors for invalid offsets', () => {
        // Act: Update with invalid IME offsets
        stateManager.updateIMEState({
          startOffset: -1,
          endOffset: -5,
          timestamp: -1000
        });

        // Assert: Should log validation errors
        const errorLogs = logMessages.filter(msg =>
          msg.includes('State validation errors for ime')
        );
        expect(errorLogs).to.have.length.greaterThan(0);
      });

      it('should track critical state when IME is active', () => {
        // Act: Activate IME
        stateManager.updateIMEState({ isActive: true });

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.true;

        // Act: Deactivate IME
        stateManager.updateIMEState({ isActive: false });

        // Assert: Should not report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.false;
      });
    });

    describe('Alt+Click State Management', () => {
      it('should update Alt+Click state with position tracking', () => {
        // Arrange: State change tracking
        const stateChanges: any[] = [];
        const listener: StateChangeListener = (newState, previousState, stateKey) => {
          stateChanges.push({ newState, previousState, stateKey });
        };

        stateManager.addStateListener('altClick', listener);

        // Act: Update Alt+Click state
        const updates: Partial<AltClickState> = {
          isVSCodeAltClickEnabled: true,
          isAltKeyPressed: true,
          lastClickPosition: { x: 150, y: 300 },
          clickCount: 3
        };

        stateManager.updateAltClickState(updates);

        // Assert: State should be updated
        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.isVSCodeAltClickEnabled).to.be.true;
        expect(altClickState.isAltKeyPressed).to.be.true;
        expect(altClickState.lastClickPosition).to.deep.equal({ x: 150, y: 300 });
        expect(altClickState.clickCount).to.equal(3);

        // Assert: Change listener should be triggered
        expect(stateChanges).to.have.length(1);
        expect(stateChanges[0].stateKey).to.equal('altClick');
      });

      it('should validate Alt+Click state and warn about inconsistencies', () => {
        // Act: Update with inconsistent Alt+Click state
        stateManager.updateAltClickState({
          isAltKeyPressed: true,
          isVSCodeAltClickEnabled: false // Alt pressed but not enabled
        });

        // Assert: Should log validation warning
        const warningLogs = logMessages.filter(msg =>
          msg.includes('State validation warnings for altClick') &&
          msg.includes('Alt key pressed but Alt+Click not enabled')
        );
        expect(warningLogs).to.have.length.greaterThan(0);
      });

      it('should validate Alt+Click state and error on invalid click count', () => {
        // Act: Update with invalid click count
        stateManager.updateAltClickState({
          clickCount: -5
        });

        // Assert: Should log validation error
        const errorLogs = logMessages.filter(msg =>
          msg.includes('State validation errors for altClick') &&
          msg.includes('Invalid click count')
        );
        expect(errorLogs).to.have.length.greaterThan(0);
      });
    });

    describe('Keyboard State Management', () => {
      it('should update keyboard state with modifier tracking', () => {
        // Arrange: State change listener
        const stateChanges: any[] = [];
        stateManager.addStateListener('keyboard', (newState, previousState, stateKey) => {
          stateChanges.push({ newState, previousState, stateKey });
        });

        // Act: Update keyboard state
        const updates: Partial<KeyboardState> = {
          isInChordMode: true,
          lastKeyPressed: 'Ctrl+K',
          modifiers: {
            ctrl: true,
            alt: false,
            shift: true,
            meta: false
          },
          lastKeyTimestamp: Date.now()
        };

        stateManager.updateKeyboardState(updates);

        // Assert: State should be updated
        const keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.isInChordMode).to.be.true;
        expect(keyboardState.lastKeyPressed).to.equal('Ctrl+K');
        expect(keyboardState.modifiers.ctrl).to.be.true;
        expect(keyboardState.modifiers.shift).to.be.true;

        // Assert: Change should be tracked
        expect(stateChanges).to.have.length(1);
      });

      it('should track critical state when in chord mode', () => {
        // Act: Enter chord mode
        stateManager.updateKeyboardState({ isInChordMode: true });

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.true;
      });

      it('should validate keyboard state and warn about chord mode inconsistencies', () => {
        // Act: Update with inconsistent chord mode state
        stateManager.updateKeyboardState({
          isInChordMode: true,
          lastKeyPressed: null // In chord mode but no key recorded
        });

        // Assert: Should log validation warning
        const warningLogs = logMessages.filter(msg =>
          msg.includes('State validation warnings for keyboard') &&
          msg.includes('In chord mode but no last key recorded')
        );
        expect(warningLogs).to.have.length.greaterThan(0);
      });

      it('should validate keyboard state and error on invalid timestamp', () => {
        // Act: Update with invalid timestamp
        stateManager.updateKeyboardState({
          lastKeyTimestamp: -1000
        });

        // Assert: Should log validation error
        const errorLogs = logMessages.filter(msg =>
          msg.includes('State validation errors for keyboard') &&
          msg.includes('Invalid keyboard timestamp')
        );
        expect(errorLogs).to.have.length.greaterThan(0);
      });
    });

    describe('Agent Interaction State Management', () => {
      it('should update agent state with command tracking', () => {
        // Arrange: State change tracking
        const stateChanges: any[] = [];
        stateManager.addStateListener('agent', (newState, previousState, stateKey) => {
          stateChanges.push({ newState, previousState, stateKey });
        });

        // Act: Update agent state
        const updates: Partial<AgentInteractionState> = {
          isAgentMode: true,
          agentType: 'claude-code',
          isAwaitingResponse: true,
          lastCommand: '@filename src/test.ts',
          commandTimestamp: Date.now()
        };

        stateManager.updateAgentState(updates);

        // Assert: State should be updated
        const agentState = stateManager.getStateSection('agent');
        expect(agentState.isAgentMode).to.be.true;
        expect(agentState.agentType).to.equal('claude-code');
        expect(agentState.isAwaitingResponse).to.be.true;
        expect(agentState.lastCommand).to.equal('@filename src/test.ts');

        // Assert: Change listener should be called
        expect(stateChanges).to.have.length(1);
        expect(stateChanges[0].stateKey).to.equal('agent');
      });

      it('should track critical state when awaiting agent response', () => {
        // Act: Set awaiting response
        stateManager.updateAgentState({ isAwaitingResponse: true });

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.true;
      });

      it('should validate agent state and warn about agent mode without type', () => {
        // Act: Update with agent mode but no type
        stateManager.updateAgentState({
          isAgentMode: true,
          agentType: null
        });

        // Assert: Should log validation warning
        const warningLogs = logMessages.filter(msg =>
          msg.includes('State validation warnings for agent') &&
          msg.includes('Agent mode active but no agent type set')
        );
        expect(warningLogs).to.have.length.greaterThan(0);
      });

      it('should validate agent state and error on invalid timestamp', () => {
        // Act: Update with invalid command timestamp
        stateManager.updateAgentState({
          commandTimestamp: -5000
        });

        // Assert: Should log validation error
        const errorLogs = logMessages.filter(msg =>
          msg.includes('State validation errors for agent') &&
          msg.includes('Invalid agent command timestamp')
        );
        expect(errorLogs).to.have.length.greaterThan(0);
      });
    });
  });

  describe('TDD Red Phase: State Change Listeners and Notifications', () => {
    describe('Listener Registration and Management', () => {
      it('should register and call specific section listeners', () => {
        // Arrange: Section-specific listeners
        const imeChanges: any[] = [];
        const keyboardChanges: any[] = [];

        const imeListener: StateChangeListener = (newState, previousState, stateKey) => {
          imeChanges.push({ newState, previousState, stateKey });
        };

        const keyboardListener: StateChangeListener = (newState, previousState, stateKey) => {
          keyboardChanges.push({ newState, previousState, stateKey });
        };

        // Act: Register listeners
        stateManager.addStateListener('ime', imeListener);
        stateManager.addStateListener('keyboard', keyboardListener);

        // Act: Update both states
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateKeyboardState({ isInChordMode: true });

        // Assert: Each listener should only receive its section's changes
        expect(imeChanges).to.have.length(1);
        expect(imeChanges[0].stateKey).to.equal('ime');

        expect(keyboardChanges).to.have.length(1);
        expect(keyboardChanges[0].stateKey).to.equal('keyboard');
      });

      it('should register and call global listeners for all state changes', () => {
        // Arrange: Global listener
        const allChanges: any[] = [];
        const globalListener: StateChangeListener = (newState, previousState, stateKey) => {
          allChanges.push({ newState, previousState, stateKey });
        };

        // Act: Register global listener
        stateManager.addStateListener('*', globalListener);

        // Act: Update multiple state sections
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateAltClickState({ isAltKeyPressed: true });
        stateManager.updateKeyboardState({ isInChordMode: true });

        // Assert: Global listener should receive all changes
        expect(allChanges).to.have.length(3);
        expect(allChanges[0].stateKey).to.equal('ime');
        expect(allChanges[1].stateKey).to.equal('altClick');
        expect(allChanges[2].stateKey).to.equal('keyboard');
      });

      it('should handle multiple listeners for the same section', () => {
        // Arrange: Multiple listeners for same section
        const listener1Calls: any[] = [];
        const listener2Calls: any[] = [];

        const listener1: StateChangeListener = (newState, previousState, stateKey) => {
          listener1Calls.push({ stateKey });
        };

        const listener2: StateChangeListener = (newState, previousState, stateKey) => {
          listener2Calls.push({ stateKey });
        };

        // Act: Register multiple listeners
        stateManager.addStateListener('ime', listener1);
        stateManager.addStateListener('ime', listener2);

        // Act: Update state
        stateManager.updateIMEState({ isActive: true });

        // Assert: Both listeners should be called
        expect(listener1Calls).to.have.length(1);
        expect(listener2Calls).to.have.length(1);
      });

      it('should remove specific listeners correctly', () => {
        // Arrange: Listener to be removed
        const removedListenerCalls: any[] = [];
        const persistentListenerCalls: any[] = [];

        const removedListener: StateChangeListener = () => {
          removedListenerCalls.push({});
        };

        const persistentListener: StateChangeListener = () => {
          persistentListenerCalls.push({});
        };

        // Act: Register both listeners
        stateManager.addStateListener('ime', removedListener);
        stateManager.addStateListener('ime', persistentListener);

        // Act: Remove one listener
        stateManager.removeStateListener('ime', removedListener);

        // Act: Update state
        stateManager.updateIMEState({ isActive: true });

        // Assert: Only persistent listener should be called
        expect(removedListenerCalls).to.have.length(0);
        expect(persistentListenerCalls).to.have.length(1);
      });

      it('should clean up listener sets when empty', () => {
        // Arrange: Listener to be removed
        const listener: StateChangeListener = () => {};

        // Act: Register and remove listener
        stateManager.addStateListener('ime', listener);
        stateManager.removeStateListener('ime', listener);

        // Act: Try to remove again (should not error)
        expect(() => {
          stateManager.removeStateListener('ime', listener);
        }).to.not.throw();
      });
    });

    describe('Listener Error Handling', () => {
      it('should handle errors in state change listeners gracefully', () => {
        // Arrange: Error-throwing listener
        const errorListener: StateChangeListener = () => {
          throw new Error('Listener error');
        };

        const goodListener: StateChangeListener = () => {
          // This should still work
        };

        // Act: Register both listeners
        stateManager.addStateListener('ime', errorListener);
        stateManager.addStateListener('ime', goodListener);

        // Act: Update state (should not throw)
        expect(() => {
          stateManager.updateIMEState({ isActive: true });
        }).to.not.throw();

        // Assert: Error should be logged
        const errorLogs = logMessages.filter(msg =>
          msg.includes('Error in state change listener for ime')
        );
        expect(errorLogs).to.have.length.greaterThan(0);
      });

      it('should handle errors in global listeners gracefully', () => {
        // Arrange: Error-throwing global listener
        const errorGlobalListener: StateChangeListener = () => {
          throw new Error('Global listener error');
        };

        // Act: Register global listener
        stateManager.addStateListener('*', errorGlobalListener);

        // Act: Update state (should not throw)
        expect(() => {
          stateManager.updateIMEState({ isActive: true });
        }).to.not.throw();

        // Assert: Error should be logged
        const errorLogs = logMessages.filter(msg =>
          msg.includes('Error in global state change listener')
        );
        expect(errorLogs).to.have.length.greaterThan(0);
      });
    });
  });

  describe('TDD Red Phase: State History and Debugging Features', () => {
    describe('State Change History Tracking', () => {
      it('should record state changes in history', () => {
        // Act: Make several state changes
        stateManager.updateIMEState({ isActive: true, data: 'test1' });
        stateManager.updateKeyboardState({ lastKeyPressed: 'Enter' });
        stateManager.updateIMEState({ data: 'test2' });

        // Act: Get history
        const history = stateManager.getStateHistory();

        // Assert: Should have recorded all changes
        expect(history).to.have.length(3);
        expect(history[0]).to.exist;
        expect(history[1]).to.exist;
        expect(history[2]).to.exist;
        expect(history[0]!.stateKey).to.equal('ime');
        expect(history[1]!.stateKey).to.equal('keyboard');
        expect(history[2]!.stateKey).to.equal('ime');

        // Assert: Should track previous and new values
        expect(history[0]!.previousValue.isActive).to.be.false;
        expect(history[0]!.newValue.isActive).to.be.true;
        expect(history[0]!.newValue.data).to.equal('test1');
      });

      it('should limit history size to prevent memory growth', () => {
        // Act: Make many state changes (more than limit)
        for (let i = 0; i < 150; i++) {
          stateManager.updateIMEState({ data: `test${i}` });
        }

        // Act: Get history
        const history = stateManager.getStateHistory(200); // Request more than limit

        // Assert: Should be limited to prevent memory issues
        expect(history).to.have.length.lessThan(150);
        expect(history).to.have.length.lessThanOrEqual(100); // Default limit
      });

      it('should provide limited history when requested', () => {
        // Act: Make multiple changes
        for (let i = 0; i < 20; i++) {
          stateManager.updateIMEState({ data: `change${i}` });
        }

        // Act: Get limited history
        const limitedHistory = stateManager.getStateHistory(5);

        // Assert: Should return only requested amount
        expect(limitedHistory).to.have.length(5);

        // Assert: Should be the most recent changes
        expect(limitedHistory[4]).to.exist;
        expect(limitedHistory[3]).to.exist;
        expect(limitedHistory[4]!.newValue.data).to.equal('change19');
        expect(limitedHistory[3]!.newValue.data).to.equal('change18');
      });

      it('should include deep copies in history to prevent corruption', () => {
        // Act: Update state
        stateManager.updateIMEState({
          isActive: true,
          data: 'original',
          timestamp: 12345
        });

        // Act: Get history and attempt to modify
        const history = stateManager.getStateHistory();
        const firstChange = history[0];

        expect(firstChange).to.exist;

        // Modify history entry
        (firstChange!.newValue as any).data = 'corrupted';
        (firstChange!.previousValue as any).isActive = true;

        // Act: Get history again
        const freshHistory = stateManager.getStateHistory();

        // Assert: History should not be corrupted
        expect(freshHistory[0]).to.exist;
        expect(freshHistory[0]!.newValue.data).to.equal('original');
        expect(freshHistory[0]!.previousValue.isActive).to.be.false;
      });
    });

    describe('State Summary for Debugging', () => {
      it('should provide comprehensive state summary', () => {
        // Arrange: Set up various states
        stateManager.updateIMEState({
          isActive: true,
          data: 'composing text',
          lastEvent: 'update'
        });

        stateManager.updateAltClickState({
          isVSCodeAltClickEnabled: true,
          isAltKeyPressed: false,
          clickCount: 5
        });

        stateManager.updateKeyboardState({
          isInChordMode: true,
          lastKeyPressed: 'Ctrl+K',
          modifiers: { ctrl: true, alt: false, shift: true, meta: false }
        });

        stateManager.updateAgentState({
          isAgentMode: true,
          agentType: 'claude-code',
          isAwaitingResponse: false
        });

        // Act: Get state summary
        const summary = stateManager.getStateSummary();

        // Assert: Should provide meaningful summary
        expect(summary.ime.active).to.be.true;
        expect(summary.ime.hasData).to.be.true;
        expect(summary.ime.lastEvent).to.equal('update');

        expect(summary.altClick.enabled).to.be.true;
        expect(summary.altClick.pressed).to.be.false;
        expect(summary.altClick.clickCount).to.equal(5);

        expect(summary.keyboard.chordMode).to.be.true;
        expect(summary.keyboard.lastKey).to.equal('Ctrl+K');
        expect(summary.keyboard.modifiersActive).to.be.true;

        expect(summary.agent.active).to.be.true;
        expect(summary.agent.type).to.equal('claude-code');
        expect(summary.agent.awaiting).to.be.false;
      });

      it('should indicate when no modifiers are active', () => {
        // Arrange: Keyboard state with no modifiers
        stateManager.updateKeyboardState({
          lastKeyPressed: 'a',
          modifiers: { ctrl: false, alt: false, shift: false, meta: false }
        });

        // Act: Get summary
        const summary = stateManager.getStateSummary();

        // Assert: Should indicate no modifiers active
        expect(summary.keyboard.modifiersActive).to.be.false;
      });

      it('should handle empty/null state data in summary', () => {
        // Arrange: States with empty data
        stateManager.updateIMEState({ data: '' });
        stateManager.updateAgentState({ agentType: null });

        // Act: Get summary
        const summary = stateManager.getStateSummary();

        // Assert: Should handle empty data gracefully
        expect(summary.ime.hasData).to.be.false;
        expect(summary.agent.type).to.be.null;
      });
    });
  });

  describe('TDD Red Phase: State Reset and Recovery', () => {
    describe('Individual State Section Reset', () => {
      it('should reset specific state section to defaults', () => {
        // Arrange: Modify IME state
        stateManager.updateIMEState({
          isActive: true,
          data: 'test data',
          startOffset: 5,
          endOffset: 10,
          lastEvent: 'update',
          timestamp: Date.now()
        });

        // Verify state is modified
        let imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.true;
        expect(imeState.data).to.equal('test data');

        // Act: Reset IME state
        stateManager.resetStateSection('ime');

        // Assert: Should be back to defaults
        imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;
        expect(imeState.data).to.equal('');
        expect(imeState.startOffset).to.equal(0);
        expect(imeState.endOffset).to.equal(0);
        expect(imeState.lastEvent).to.be.null;
        expect(imeState.timestamp).to.equal(0);
      });

      it('should trigger state change listeners on section reset', () => {
        // Arrange: State change listener
        const stateChanges: any[] = [];
        stateManager.addStateListener('keyboard', (newState, previousState, stateKey) => {
          stateChanges.push({ newState, previousState, stateKey });
        });

        // Arrange: Modify keyboard state
        stateManager.updateKeyboardState({
          isInChordMode: true,
          lastKeyPressed: 'Ctrl+K'
        });

        // Clear previous changes
        stateChanges.length = 0;

        // Act: Reset keyboard state
        stateManager.resetStateSection('keyboard');

        // Assert: Should trigger change listener
        expect(stateChanges).to.have.length(1);
        expect(stateChanges[0].stateKey).to.equal('keyboard');
        expect(stateChanges[0].newState.isInChordMode).to.be.false;
        expect(stateChanges[0].previousState.isInChordMode).to.be.true;
      });

      it('should log section reset operation', () => {
        // Act: Reset altClick state
        stateManager.resetStateSection('altClick');

        // Assert: Should log reset operation
        const resetLogs = logMessages.filter(msg =>
          msg.includes('Reset altClick state to default')
        );
        expect(resetLogs).to.have.length.greaterThan(0);
      });
    });

    describe('Complete State Reset', () => {
      it('should reset all state sections to defaults', () => {
        // Arrange: Modify all state sections
        stateManager.updateIMEState({ isActive: true, data: 'ime test' });
        stateManager.updateAltClickState({ isAltKeyPressed: true, clickCount: 3 });
        stateManager.updateKeyboardState({ isInChordMode: true, lastKeyPressed: 'Enter' });
        stateManager.updateAgentState({ isAgentMode: true, agentType: 'test-agent' });

        // Verify all states are modified
        expect(stateManager.getStateSection('ime').isActive).to.be.true;
        expect(stateManager.getStateSection('altClick').isAltKeyPressed).to.be.true;
        expect(stateManager.getStateSection('keyboard').isInChordMode).to.be.true;
        expect(stateManager.getStateSection('agent').isAgentMode).to.be.true;

        // Act: Reset all state
        stateManager.resetAllState();

        // Assert: All states should be back to defaults
        expect(stateManager.getStateSection('ime').isActive).to.be.false;
        expect(stateManager.getStateSection('ime').data).to.equal('');

        expect(stateManager.getStateSection('altClick').isAltKeyPressed).to.be.false;
        expect(stateManager.getStateSection('altClick').clickCount).to.equal(0);

        expect(stateManager.getStateSection('keyboard').isInChordMode).to.be.false;
        expect(stateManager.getStateSection('keyboard').lastKeyPressed).to.be.null;

        expect(stateManager.getStateSection('agent').isAgentMode).to.be.false;
        expect(stateManager.getStateSection('agent').agentType).to.be.null;
      });

      it('should trigger individual change listeners for each section reset', () => {
        // Arrange: Listeners for each section
        const imeChanges: any[] = [];
        const keyboardChanges: any[] = [];
        const globalChanges: any[] = [];

        stateManager.addStateListener('ime', () => imeChanges.push({}));
        stateManager.addStateListener('keyboard', () => keyboardChanges.push({}));
        stateManager.addStateListener('*', () => globalChanges.push({}));

        // Arrange: Modify states
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateKeyboardState({ isInChordMode: true });

        // Clear change tracking
        imeChanges.length = 0;
        keyboardChanges.length = 0;
        globalChanges.length = 0;

        // Act: Reset all state
        stateManager.resetAllState();

        // Assert: All listeners should be triggered
        expect(imeChanges.length).to.be.greaterThan(0);
        expect(keyboardChanges.length).to.be.greaterThan(0);
        expect(globalChanges.length).to.be.greaterThan(0);
      });

      it('should log complete reset operation', () => {
        // Act: Reset all state
        stateManager.resetAllState();

        // Assert: Should log complete reset
        const resetLogs = logMessages.filter(msg =>
          msg.includes('Reset all state to default')
        );
        expect(resetLogs).to.have.length.greaterThan(0);
      });

      it('should clear critical state after complete reset', () => {
        // Arrange: Set critical states
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateKeyboardState({ isInChordMode: true });
        stateManager.updateAgentState({ isAwaitingResponse: true });

        // Verify critical state is active
        expect(stateManager.hasCriticalStateActive()).to.be.true;

        // Act: Reset all state
        stateManager.resetAllState();

        // Assert: Should not have critical state
        expect(stateManager.hasCriticalStateActive()).to.be.false;
      });
    });
  });

  describe('TDD Red Phase: Resource Management and Disposal', () => {
    describe('Complete Service Disposal', () => {
      it('should clear all state change listeners on disposal', () => {
        // Arrange: Multiple listeners
        const listener1 = sinon.stub();
        const listener2 = sinon.stub();
        const globalListener = sinon.stub();

        stateManager.addStateListener('ime', listener1);
        stateManager.addStateListener('keyboard', listener2);
        stateManager.addStateListener('*', globalListener);

        // Act: Dispose service
        stateManager.dispose();

        // Act: Try to trigger state changes
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateKeyboardState({ isInChordMode: true });

        // Assert: No listeners should be called after disposal
        expect(listener1.called).to.be.false;
        expect(listener2.called).to.be.false;
        expect(globalListener.called).to.be.false;
      });

      it('should clear state history on disposal', () => {
        // Arrange: Generate state history
        for (let i = 0; i < 10; i++) {
          stateManager.updateIMEState({ data: `test${i}` });
        }

        // Verify history exists
        expect(stateManager.getStateHistory()).to.have.length.greaterThan(0);

        // Act: Dispose service
        stateManager.dispose();

        // Assert: History should be cleared
        expect(stateManager.getStateHistory()).to.have.length(0);
      });

      it('should reset state to defaults on disposal', () => {
        // Arrange: Modify all states
        stateManager.updateIMEState({ isActive: true, data: 'test' });
        stateManager.updateAltClickState({ isAltKeyPressed: true });
        stateManager.updateKeyboardState({ isInChordMode: true });
        stateManager.updateAgentState({ isAgentMode: true });

        // Act: Dispose service
        stateManager.dispose();

        // Assert: States should be back to defaults
        const state = stateManager.getState();
        expect(state.ime.isActive).to.be.false;
        expect(state.ime.data).to.equal('');
        expect(state.altClick.isAltKeyPressed).to.be.false;
        expect(state.keyboard.isInChordMode).to.be.false;
        expect(state.agent.isAgentMode).to.be.false;
      });

      it('should clear validation rules on disposal', () => {
        // Act: Dispose service
        stateManager.dispose();

        // Act: Try to update state (should not cause validation errors)
        stateManager.updateIMEState({
          startOffset: -1, // Would normally cause validation error
          endOffset: -1
        });

        // Assert: Should not log validation errors after disposal
        const recentLogs = logMessages.slice(-5); // Check recent logs
        const validationErrors = recentLogs.filter(msg =>
          msg.includes('State validation errors')
        );
        expect(validationErrors).to.have.length(0);
      });

      it('should log disposal operation', () => {
        // Act: Dispose service
        stateManager.dispose();

        // Assert: Should log disposal operations
        expect(logMessages).to.include('Disposing InputStateManager');
        expect(logMessages).to.include('InputStateManager disposed');
      });

      it('should handle double disposal gracefully', () => {
        // Arrange: Add some state
        stateManager.updateIMEState({ isActive: true });

        // Act: Dispose twice
        stateManager.dispose();

        expect(() => {
          stateManager.dispose();
        }).to.not.throw();

        // Assert: Should remain in clean state
        const state = stateManager.getState();
        expect(state.ime.isActive).to.be.false;
      });
    });

    describe('Post-Disposal Behavior', () => {
      it('should handle method calls gracefully after disposal', () => {
        // Act: Dispose first
        stateManager.dispose();

        // Assert: Methods should not throw after disposal
        expect(() => {
          stateManager.getState();
          stateManager.getStateSection('ime');
          stateManager.getStateSummary();
          stateManager.hasCriticalStateActive();
          stateManager.getStateHistory();
        }).to.not.throw();
      });

      it('should allow state updates after disposal without errors', () => {
        // Act: Dispose first
        stateManager.dispose();

        // Assert: State updates should not throw
        expect(() => {
          stateManager.updateIMEState({ isActive: true });
          stateManager.updateKeyboardState({ isInChordMode: true });
          stateManager.resetAllState();
        }).to.not.throw();
      });
    });
  });

  describe('TDD Red Phase: Complex State Interaction Scenarios', () => {
    describe('Multi-Critical State Scenarios', () => {
      it('should handle multiple critical states simultaneously', () => {
        // Act: Activate multiple critical states
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateKeyboardState({ isInChordMode: true });
        stateManager.updateAgentState({ isAwaitingResponse: true });

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.true;

        // Act: Deactivate one critical state
        stateManager.updateIMEState({ isActive: false });

        // Assert: Should still report critical state (other critical states active)
        expect(stateManager.hasCriticalStateActive()).to.be.true;

        // Act: Deactivate all critical states
        stateManager.updateKeyboardState({ isInChordMode: false });
        stateManager.updateAgentState({ isAwaitingResponse: false });

        // Assert: Should not report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.false;
      });

      it('should handle rapid state transitions', () => {
        // Arrange: State change tracking
        const stateChanges: any[] = [];
        stateManager.addStateListener('*', (newState, previousState, stateKey) => {
          stateChanges.push({ stateKey, timestamp: Date.now() });
        });

        // Act: Rapid state transitions
        for (let i = 0; i < 50; i++) {
          stateManager.updateIMEState({ data: `rapid${i}` });
          stateManager.updateKeyboardState({ lastKeyPressed: `key${i}` });
          clock.tick(1); // Advance time slightly
        }

        // Assert: Should handle all transitions
        expect(stateChanges.length).to.equal(100); // 50 IME + 50 keyboard changes

        // Assert: Should maintain state consistency
        const finalState = stateManager.getState();
        expect(finalState.ime.data).to.equal('rapid49');
        expect(finalState.keyboard.lastKeyPressed).to.equal('key49');
      });
    });

    describe('Complex State Validation Scenarios', () => {
      it('should handle cascading validation errors', () => {
        // Act: Update with multiple validation issues
        stateManager.updateIMEState({
          isActive: true,
          data: '', // Warning: active but no data
          startOffset: -1, // Error: invalid offset
          endOffset: -5, // Error: invalid offset
          timestamp: -1000 // Error: invalid timestamp
        });

        // Assert: Should log both errors and warnings
        const errorLogs = logMessages.filter(msg =>
          msg.includes('State validation errors for ime')
        );
        const warningLogs = logMessages.filter(msg =>
          msg.includes('State validation warnings for ime')
        );

        expect(errorLogs.length).to.be.greaterThan(0);
        expect(warningLogs.length).to.be.greaterThan(0);
      });

      it('should handle validation across multiple state sections', () => {
        // Act: Update multiple sections with validation issues
        stateManager.updateIMEState({
          startOffset: -1,
          timestamp: -1
        });

        stateManager.updateAltClickState({
          clickCount: -5,
          isAltKeyPressed: true,
          isVSCodeAltClickEnabled: false
        });

        stateManager.updateKeyboardState({
          lastKeyTimestamp: -1000,
          isInChordMode: true,
          lastKeyPressed: null
        });

        // Assert: Should validate all sections independently
        const imeErrorLogs = logMessages.filter(msg =>
          msg.includes('State validation errors for ime')
        );
        const altClickErrorLogs = logMessages.filter(msg =>
          msg.includes('State validation errors for altClick')
        );
        const keyboardErrorLogs = logMessages.filter(msg =>
          msg.includes('State validation errors for keyboard')
        );

        expect(imeErrorLogs.length).to.be.greaterThan(0);
        expect(altClickErrorLogs.length).to.be.greaterThan(0);
        expect(keyboardErrorLogs.length).to.be.greaterThan(0);
      });
    });
  });
});