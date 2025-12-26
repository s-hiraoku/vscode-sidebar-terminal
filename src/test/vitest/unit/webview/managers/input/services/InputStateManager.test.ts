/**
 * InputStateManager TDD Test Suite
 * Following t-wada's TDD methodology for comprehensive state management testing
 * RED-GREEN-REFACTOR cycles with focus on state validation, error handling, and listeners
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  InputStateManager,
  IMECompositionState,
  AltClickState,
  KeyboardState,
  AgentInteractionState,
  InputState as _InputState,
  StateChangeListener,
} from '../../../../../../../webview/managers/input/services/InputStateManager';

describe('InputStateManager TDD Test Suite', () => {
  let stateManager: InputStateManager;
  let mockLogger: ReturnType<typeof vi.fn>;
  let logMessages: string[];

  beforeEach(() => {
    vi.useFakeTimers();

    // Arrange: Setup mock logger to capture all log messages
    logMessages = [];
    mockLogger = vi.fn().mockImplementation((message: string) => {
      logMessages.push(message);
    });

    // Create state manager instance
    stateManager = new InputStateManager(mockLogger);
  });

  afterEach(() => {
    // Cleanup: Essential for preventing test pollution
    try {
      vi.useRealTimers();
    } finally {
      stateManager.dispose();
    }
  });

  describe('TDD Red Phase: Initialization and Default State', () => {
    describe('Service Construction', () => {
      it('should initialize with default logger when none provided', () => {
        // Act: Create state manager without logger
        const defaultManager = new InputStateManager();

        // Assert: Should not throw and should be functional
        expect(() => {
          defaultManager.getState();
        }).not.toThrow();

        defaultManager.dispose();
      });

      it('should log initialization message', () => {
        // Assert: Should have logged initialization
        expect(logMessages).toContain('InputStateManager initialized');
      });

      it('should initialize with default IME state', () => {
        // Act: Get initial IME state
        const imeState = stateManager.getStateSection('ime');

        // Assert: Should have correct default IME state
        expect(imeState.isActive).toBe(false);
        expect(imeState.data).toBe('');
        expect(imeState.startOffset).toBe(0);
        expect(imeState.endOffset).toBe(0);
        expect(imeState.lastEvent).toBeNull();
        expect(imeState.timestamp).toBe(0);
      });

      it('should initialize with default Alt+Click state', () => {
        // Act: Get initial Alt+Click state
        const altClickState = stateManager.getStateSection('altClick');

        // Assert: Should have correct default Alt+Click state
        expect(altClickState.isVSCodeAltClickEnabled).toBe(false);
        expect(altClickState.isAltKeyPressed).toBe(false);
        expect(altClickState.lastClickPosition).toBeNull();
        expect(altClickState.clickCount).toBe(0);
      });

      it('should initialize with default keyboard state', () => {
        // Act: Get initial keyboard state
        const keyboardState = stateManager.getStateSection('keyboard');

        // Assert: Should have correct default keyboard state
        expect(keyboardState.isInChordMode).toBe(false);
        expect(keyboardState.lastKeyPressed).toBeNull();
        expect(keyboardState.modifiers.ctrl).toBe(false);
        expect(keyboardState.modifiers.alt).toBe(false);
        expect(keyboardState.modifiers.shift).toBe(false);
        expect(keyboardState.modifiers.meta).toBe(false);
        expect(keyboardState.lastKeyTimestamp).toBe(0);
      });

      it('should initialize with default agent interaction state', () => {
        // Act: Get initial agent state
        const agentState = stateManager.getStateSection('agent');

        // Assert: Should have correct default agent state
        expect(agentState.isAgentMode).toBe(false);
        expect(agentState.agentType).toBeNull();
        expect(agentState.isAwaitingResponse).toBe(false);
        expect(agentState.lastCommand).toBeNull();
        expect(agentState.commandTimestamp).toBe(0);
      });

      it('should initialize with no critical state active', () => {
        // Act: Check critical state
        const hasCriticalState = stateManager.hasCriticalStateActive();

        // Assert: Should not have critical state initially
        expect(hasCriticalState).toBe(false);
      });
    });

    describe('State Deep Cloning', () => {
      it('should return deep copies of state to prevent external modification', () => {
        // Arrange: Modify IME state
        stateManager.updateIMEState({
          isActive: true,
          data: 'test',
          timestamp: Date.now(),
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
        expect(freshState.ime.timestamp).toBe(originalTimestamp);
        expect(freshState.ime.data).toBe('test');
      });

      it('should return deep copies of state sections', () => {
        // Arrange: Set keyboard state
        stateManager.updateKeyboardState({
          lastKeyPressed: 'Enter',
          modifiers: { ctrl: true, alt: false, shift: true, meta: false },
        });

        // Act: Get state section and attempt to modify
        const keyboardState = stateManager.getStateSection('keyboard');
        const originalKey = keyboardState.lastKeyPressed;

        (keyboardState as any).lastKeyPressed = 'modified';
        (keyboardState.modifiers as any).ctrl = false;

        // Act: Get state section again
        const freshKeyboardState = stateManager.getStateSection('keyboard');

        // Assert: Original state should be unchanged
        expect(freshKeyboardState.lastKeyPressed).toBe(originalKey);
        expect(freshKeyboardState.modifiers.ctrl).toBe(true);
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
          timestamp: Date.now(),
        };

        stateManager.updateIMEState(updates);

        // Assert: State should be updated
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).toBe(true);
        expect(imeState.data).toBe('こんにちは');
        expect(imeState.lastEvent).toBe('update');

        // Assert: Change listener should be called
        expect(stateChanges).toHaveLength(1);
        expect(stateChanges[0].stateKey).toBe('ime');
        expect(stateChanges[0].newState.isActive).toBe(true);
        expect(stateChanges[0].previousState.isActive).toBe(false);
      });

      it('should validate IME state and log warnings for invalid data', () => {
        // Act: Update with questionable IME state
        stateManager.updateIMEState({
          isActive: true,
          data: '', // Active but no data
          lastEvent: 'update', // Not a start event
        });

        // Assert: Should log validation warning
        const warningLogs = logMessages.filter(
          (msg) =>
            msg.includes('State validation warnings for ime') &&
            msg.includes('IME active but no composition data')
        );
        expect(warningLogs.length).toBeGreaterThan(0);
      });

      it('should validate IME state and log errors for invalid offsets', () => {
        // Act: Update with invalid IME offsets
        stateManager.updateIMEState({
          startOffset: -1,
          endOffset: -5,
          timestamp: -1000,
        });

        // Assert: Should log validation errors
        const errorLogs = logMessages.filter((msg) =>
          msg.includes('State validation errors for ime')
        );
        expect(errorLogs.length).toBeGreaterThan(0);
      });

      it('should track critical state when IME is active', () => {
        // Act: Activate IME
        stateManager.updateIMEState({ isActive: true });

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).toBe(true);

        // Act: Deactivate IME
        stateManager.updateIMEState({ isActive: false });

        // Assert: Should not report critical state
        expect(stateManager.hasCriticalStateActive()).toBe(false);
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
          clickCount: 3,
        };

        stateManager.updateAltClickState(updates);

        // Assert: State should be updated
        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.isVSCodeAltClickEnabled).toBe(true);
        expect(altClickState.isAltKeyPressed).toBe(true);
        expect(altClickState.lastClickPosition).toEqual({ x: 150, y: 300 });
        expect(altClickState.clickCount).toBe(3);

        // Assert: Change listener should be triggered
        expect(stateChanges).toHaveLength(1);
        expect(stateChanges[0].stateKey).toBe('altClick');
      });

      it('should validate Alt+Click state and warn about inconsistencies', () => {
        // Act: Update with inconsistent Alt+Click state
        stateManager.updateAltClickState({
          isAltKeyPressed: true,
          isVSCodeAltClickEnabled: false, // Alt pressed but not enabled
        });

        // Assert: Should log validation warning
        const warningLogs = logMessages.filter(
          (msg) =>
            msg.includes('State validation warnings for altClick') &&
            msg.includes('Alt key pressed but Alt+Click not enabled')
        );
        expect(warningLogs.length).toBeGreaterThan(0);
      });

      it('should validate Alt+Click state and error on invalid click count', () => {
        // Act: Update with invalid click count
        stateManager.updateAltClickState({
          clickCount: -5,
        });

        // Assert: Should log validation error
        const errorLogs = logMessages.filter(
          (msg) =>
            msg.includes('State validation errors for altClick') &&
            msg.includes('Invalid click count')
        );
        expect(errorLogs.length).toBeGreaterThan(0);
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
            meta: false,
          },
          lastKeyTimestamp: Date.now(),
        };

        stateManager.updateKeyboardState(updates);

        // Assert: State should be updated
        const keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.isInChordMode).toBe(true);
        expect(keyboardState.lastKeyPressed).toBe('Ctrl+K');
        expect(keyboardState.modifiers.ctrl).toBe(true);
        expect(keyboardState.modifiers.shift).toBe(true);

        // Assert: Change should be tracked
        expect(stateChanges).toHaveLength(1);
      });

      it('should track critical state when in chord mode', () => {
        // Act: Enter chord mode
        stateManager.updateKeyboardState({ isInChordMode: true });

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).toBe(true);
      });

      it('should validate keyboard state and warn about chord mode inconsistencies', () => {
        // Act: Update with inconsistent chord mode state
        stateManager.updateKeyboardState({
          isInChordMode: true,
          lastKeyPressed: null, // In chord mode but no key recorded
        });

        // Assert: Should log validation warning
        const warningLogs = logMessages.filter(
          (msg) =>
            msg.includes('State validation warnings for keyboard') &&
            msg.includes('In chord mode but no last key recorded')
        );
        expect(warningLogs.length).toBeGreaterThan(0);
      });

      it('should validate keyboard state and error on invalid timestamp', () => {
        // Act: Update with invalid timestamp
        stateManager.updateKeyboardState({
          lastKeyTimestamp: -1000,
        });

        // Assert: Should log validation error
        const errorLogs = logMessages.filter(
          (msg) =>
            msg.includes('State validation errors for keyboard') &&
            msg.includes('Invalid keyboard timestamp')
        );
        expect(errorLogs.length).toBeGreaterThan(0);
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
          commandTimestamp: Date.now(),
        };

        stateManager.updateAgentState(updates);

        // Assert: State should be updated
        const agentState = stateManager.getStateSection('agent');
        expect(agentState.isAgentMode).toBe(true);
        expect(agentState.agentType).toBe('claude-code');
        expect(agentState.isAwaitingResponse).toBe(true);
        expect(agentState.lastCommand).toBe('@filename src/test.ts');

        // Assert: Change listener should be called
        expect(stateChanges).toHaveLength(1);
        expect(stateChanges[0].stateKey).toBe('agent');
      });

      it('should track critical state when awaiting agent response', () => {
        // Act: Set awaiting response
        stateManager.updateAgentState({ isAwaitingResponse: true });

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).toBe(true);
      });

      it('should validate agent state and warn about agent mode without type', () => {
        // Act: Update with agent mode but no type
        stateManager.updateAgentState({
          isAgentMode: true,
          agentType: null,
        });

        // Assert: Should log validation warning
        const warningLogs = logMessages.filter(
          (msg) =>
            msg.includes('State validation warnings for agent') &&
            msg.includes('Agent mode active but no agent type set')
        );
        expect(warningLogs.length).toBeGreaterThan(0);
      });

      it('should validate agent state and error on invalid timestamp', () => {
        // Act: Update with invalid command timestamp
        stateManager.updateAgentState({
          commandTimestamp: -5000,
        });

        // Assert: Should log validation error
        const errorLogs = logMessages.filter(
          (msg) =>
            msg.includes('State validation errors for agent') &&
            msg.includes('Invalid agent command timestamp')
        );
        expect(errorLogs.length).toBeGreaterThan(0);
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
        expect(imeChanges).toHaveLength(1);
        expect(imeChanges[0].stateKey).toBe('ime');

        expect(keyboardChanges).toHaveLength(1);
        expect(keyboardChanges[0].stateKey).toBe('keyboard');
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
        expect(allChanges).toHaveLength(3);
        expect(allChanges[0].stateKey).toBe('ime');
        expect(allChanges[1].stateKey).toBe('altClick');
        expect(allChanges[2].stateKey).toBe('keyboard');
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
        expect(listener1Calls).toHaveLength(1);
        expect(listener2Calls).toHaveLength(1);
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
        expect(removedListenerCalls).toHaveLength(0);
        expect(persistentListenerCalls).toHaveLength(1);
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
        }).not.toThrow();
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
        }).not.toThrow();

        // Assert: Error should be logged
        const errorLogs = logMessages.filter((msg) =>
          msg.includes('Error in state change listener for ime')
        );
        expect(errorLogs.length).toBeGreaterThan(0);
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
        }).not.toThrow();

        // Assert: Error should be logged
        const errorLogs = logMessages.filter((msg) =>
          msg.includes('Error in global state change listener')
        );
        expect(errorLogs.length).toBeGreaterThan(0);
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
        expect(history).toHaveLength(3);
        expect(history[0]).toBeDefined();
        expect(history[1]).toBeDefined();
        expect(history[2]).toBeDefined();
        expect(history[0]!.stateKey).toBe('ime');
        expect(history[1]!.stateKey).toBe('keyboard');
        expect(history[2]!.stateKey).toBe('ime');

        // Assert: Should track previous and new values
        expect(history[0]!.previousValue.isActive).toBe(false);
        expect(history[0]!.newValue.isActive).toBe(true);
        expect(history[0]!.newValue.data).toBe('test1');
      });

      it('should limit history size to prevent memory growth', () => {
        // Act: Make many state changes (more than limit)
        for (let i = 0; i < 150; i++) {
          stateManager.updateIMEState({ data: `test${i}` });
        }

        // Act: Get history
        const history = stateManager.getStateHistory(200); // Request more than limit

        // Assert: Should be limited to prevent memory issues
        expect(history.length).toBeLessThan(150);
        expect(history.length).toBeLessThanOrEqual(100); // Default limit
      });

      it('should provide limited history when requested', () => {
        // Act: Make multiple changes
        for (let i = 0; i < 20; i++) {
          stateManager.updateIMEState({ data: `change${i}` });
        }

        // Act: Get limited history
        const limitedHistory = stateManager.getStateHistory(5);

        // Assert: Should return only requested amount
        expect(limitedHistory).toHaveLength(5);

        // Assert: Should be the most recent changes
        expect(limitedHistory[4]).toBeDefined();
        expect(limitedHistory[3]).toBeDefined();
        expect(limitedHistory[4]!.newValue.data).toBe('change19');
        expect(limitedHistory[3]!.newValue.data).toBe('change18');
      });

      it('should include deep copies in history to prevent corruption', () => {
        // Act: Update state
        stateManager.updateIMEState({
          isActive: true,
          data: 'original',
          timestamp: 12345,
        });

        // Act: Get history and attempt to modify
        const history = stateManager.getStateHistory();
        const firstChange = history[0];

        expect(firstChange).toBeDefined();

        // Modify history entry
        (firstChange!.newValue as any).data = 'corrupted';
        (firstChange!.previousValue as any).isActive = true;

        // Act: Get history again
        const freshHistory = stateManager.getStateHistory();

        // Assert: History should not be corrupted
        expect(freshHistory[0]).toBeDefined();
        expect(freshHistory[0]!.newValue.data).toBe('original');
        expect(freshHistory[0]!.previousValue.isActive).toBe(false);
      });
    });

    describe('State Summary for Debugging', () => {
      it('should provide comprehensive state summary', () => {
        // Arrange: Set up various states
        stateManager.updateIMEState({
          isActive: true,
          data: 'composing text',
          lastEvent: 'update',
        });

        stateManager.updateAltClickState({
          isVSCodeAltClickEnabled: true,
          isAltKeyPressed: false,
          clickCount: 5,
        });

        stateManager.updateKeyboardState({
          isInChordMode: true,
          lastKeyPressed: 'Ctrl+K',
          modifiers: { ctrl: true, alt: false, shift: true, meta: false },
        });

        stateManager.updateAgentState({
          isAgentMode: true,
          agentType: 'claude-code',
          isAwaitingResponse: false,
        });

        // Act: Get state summary
        const summary = stateManager.getStateSummary();

        // Assert: Should provide meaningful summary
        expect(summary.ime.active).toBe(true);
        expect(summary.ime.hasData).toBe(true);
        expect(summary.ime.lastEvent).toBe('update');

        expect(summary.altClick.enabled).toBe(true);
        expect(summary.altClick.pressed).toBe(false);
        expect(summary.altClick.clickCount).toBe(5);

        expect(summary.keyboard.chordMode).toBe(true);
        expect(summary.keyboard.lastKey).toBe('Ctrl+K');
        expect(summary.keyboard.modifiersActive).toBe(true);

        expect(summary.agent.active).toBe(true);
        expect(summary.agent.type).toBe('claude-code');
        expect(summary.agent.awaiting).toBe(false);
      });

      it('should indicate when no modifiers are active', () => {
        // Arrange: Keyboard state with no modifiers
        stateManager.updateKeyboardState({
          lastKeyPressed: 'a',
          modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        });

        // Act: Get summary
        const summary = stateManager.getStateSummary();

        // Assert: Should indicate no modifiers active
        expect(summary.keyboard.modifiersActive).toBe(false);
      });

      it('should handle empty/null state data in summary', () => {
        // Arrange: States with empty data
        stateManager.updateIMEState({ data: '' });
        stateManager.updateAgentState({ agentType: null });

        // Act: Get summary
        const summary = stateManager.getStateSummary();

        // Assert: Should handle empty data gracefully
        expect(summary.ime.hasData).toBe(false);
        expect(summary.agent.type).toBeNull();
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
          timestamp: Date.now(),
        });

        // Verify state is modified
        let imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).toBe(true);
        expect(imeState.data).toBe('test data');

        // Act: Reset IME state
        stateManager.resetStateSection('ime');

        // Assert: Should be back to defaults
        imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).toBe(false);
        expect(imeState.data).toBe('');
        expect(imeState.startOffset).toBe(0);
        expect(imeState.endOffset).toBe(0);
        expect(imeState.lastEvent).toBeNull();
        expect(imeState.timestamp).toBe(0);
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
          lastKeyPressed: 'Ctrl+K',
        });

        // Clear previous changes
        stateChanges.length = 0;

        // Act: Reset keyboard state
        stateManager.resetStateSection('keyboard');

        // Assert: Should trigger change listener
        expect(stateChanges).toHaveLength(1);
        expect(stateChanges[0].stateKey).toBe('keyboard');
        expect(stateChanges[0].newState.isInChordMode).toBe(false);
        expect(stateChanges[0].previousState.isInChordMode).toBe(true);
      });

      it('should log section reset operation', () => {
        // Act: Reset altClick state
        stateManager.resetStateSection('altClick');

        // Assert: Should log reset operation
        const resetLogs = logMessages.filter((msg) =>
          msg.includes('Reset altClick state to default')
        );
        expect(resetLogs.length).toBeGreaterThan(0);
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
        expect(stateManager.getStateSection('ime').isActive).toBe(true);
        expect(stateManager.getStateSection('altClick').isAltKeyPressed).toBe(true);
        expect(stateManager.getStateSection('keyboard').isInChordMode).toBe(true);
        expect(stateManager.getStateSection('agent').isAgentMode).toBe(true);

        // Act: Reset all state
        stateManager.resetAllState();

        // Assert: All states should be back to defaults
        expect(stateManager.getStateSection('ime').isActive).toBe(false);
        expect(stateManager.getStateSection('ime').data).toBe('');

        expect(stateManager.getStateSection('altClick').isAltKeyPressed).toBe(false);
        expect(stateManager.getStateSection('altClick').clickCount).toBe(0);

        expect(stateManager.getStateSection('keyboard').isInChordMode).toBe(false);
        expect(stateManager.getStateSection('keyboard').lastKeyPressed).toBeNull();

        expect(stateManager.getStateSection('agent').isAgentMode).toBe(false);
        expect(stateManager.getStateSection('agent').agentType).toBeNull();
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
        expect(imeChanges.length).toBeGreaterThan(0);
        expect(keyboardChanges.length).toBeGreaterThan(0);
        expect(globalChanges.length).toBeGreaterThan(0);
      });

      it('should log complete reset operation', () => {
        // Act: Reset all state
        stateManager.resetAllState();

        // Assert: Should log complete reset
        const resetLogs = logMessages.filter((msg) => msg.includes('Reset all state to default'));
        expect(resetLogs.length).toBeGreaterThan(0);
      });

      it('should clear critical state after complete reset', () => {
        // Arrange: Set critical states
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateKeyboardState({ isInChordMode: true });
        stateManager.updateAgentState({ isAwaitingResponse: true });

        // Verify critical state is active
        expect(stateManager.hasCriticalStateActive()).toBe(true);

        // Act: Reset all state
        stateManager.resetAllState();

        // Assert: Should not have critical state
        expect(stateManager.hasCriticalStateActive()).toBe(false);
      });
    });
  });

  describe('TDD Red Phase: Resource Management and Disposal', () => {
    describe('Complete Service Disposal', () => {
      it('should clear all state change listeners on disposal', () => {
        // Arrange: Multiple listeners
        const listener1 = vi.fn();
        const listener2 = vi.fn();
        const globalListener = vi.fn();

        stateManager.addStateListener('ime', listener1);
        stateManager.addStateListener('keyboard', listener2);
        stateManager.addStateListener('*', globalListener);

        // Act: Dispose service
        stateManager.dispose();

        // Act: Try to trigger state changes
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateKeyboardState({ isInChordMode: true });

        // Assert: No listeners should be called after disposal
        expect(listener1).not.toHaveBeenCalled();
        expect(listener2).not.toHaveBeenCalled();
        expect(globalListener).not.toHaveBeenCalled();
      });

      it('should clear state history on disposal', () => {
        // Arrange: Generate state history
        for (let i = 0; i < 10; i++) {
          stateManager.updateIMEState({ data: `test${i}` });
        }

        // Verify history exists
        expect(stateManager.getStateHistory().length).toBeGreaterThan(0);

        // Act: Dispose service
        stateManager.dispose();

        // Assert: History should be cleared
        expect(stateManager.getStateHistory()).toHaveLength(0);
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
        expect(state.ime.isActive).toBe(false);
        expect(state.ime.data).toBe('');
        expect(state.altClick.isAltKeyPressed).toBe(false);
        expect(state.keyboard.isInChordMode).toBe(false);
        expect(state.agent.isAgentMode).toBe(false);
      });

      it('should clear validation rules on disposal', () => {
        // Act: Dispose service
        stateManager.dispose();

        // Act: Try to update state (should not cause validation errors)
        stateManager.updateIMEState({
          startOffset: -1, // Would normally cause validation error
          endOffset: -1,
        });

        // Assert: Should not log validation errors after disposal
        const recentLogs = logMessages.slice(-5); // Check recent logs
        const validationErrors = recentLogs.filter((msg) =>
          msg.includes('State validation errors')
        );
        expect(validationErrors).toHaveLength(0);
      });

      it('should log disposal operation', () => {
        // Act: Dispose service
        stateManager.dispose();

        // Assert: Should log disposal operations
        expect(logMessages).toContain('Disposing InputStateManager');
        expect(logMessages).toContain('InputStateManager disposed');
      });

      it('should handle double disposal gracefully', () => {
        // Arrange: Add some state
        stateManager.updateIMEState({ isActive: true });

        // Act: Dispose twice
        stateManager.dispose();

        expect(() => {
          stateManager.dispose();
        }).not.toThrow();

        // Assert: Should remain in clean state
        const state = stateManager.getState();
        expect(state.ime.isActive).toBe(false);
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
        }).not.toThrow();
      });

      it('should allow state updates after disposal without errors', () => {
        // Act: Dispose first
        stateManager.dispose();

        // Assert: State updates should not throw
        expect(() => {
          stateManager.updateIMEState({ isActive: true });
          stateManager.updateKeyboardState({ isInChordMode: true });
          stateManager.resetAllState();
        }).not.toThrow();
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
        expect(stateManager.hasCriticalStateActive()).toBe(true);

        // Act: Deactivate one critical state
        stateManager.updateIMEState({ isActive: false });

        // Assert: Should still report critical state (other critical states active)
        expect(stateManager.hasCriticalStateActive()).toBe(true);

        // Act: Deactivate all critical states
        stateManager.updateKeyboardState({ isInChordMode: false });
        stateManager.updateAgentState({ isAwaitingResponse: false });

        // Assert: Should not report critical state
        expect(stateManager.hasCriticalStateActive()).toBe(false);
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
          vi.advanceTimersByTime(1); // Advance time slightly
        }

        // Assert: Should handle all transitions
        expect(stateChanges.length).toBe(100); // 50 IME + 50 keyboard changes

        // Assert: Should maintain state consistency
        const finalState = stateManager.getState();
        expect(finalState.ime.data).toBe('rapid49');
        expect(finalState.keyboard.lastKeyPressed).toBe('key49');
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
          timestamp: -1000, // Error: invalid timestamp
        });

        // Assert: Should log both errors and warnings
        const errorLogs = logMessages.filter((msg) =>
          msg.includes('State validation errors for ime')
        );
        const warningLogs = logMessages.filter((msg) =>
          msg.includes('State validation warnings for ime')
        );

        expect(errorLogs.length).toBeGreaterThan(0);
        expect(warningLogs.length).toBeGreaterThan(0);
      });

      it('should handle validation across multiple state sections', () => {
        // Act: Update multiple sections with validation issues
        stateManager.updateIMEState({
          startOffset: -1,
          timestamp: -1,
        });

        stateManager.updateAltClickState({
          clickCount: -5,
          isAltKeyPressed: true,
          isVSCodeAltClickEnabled: false,
        });

        stateManager.updateKeyboardState({
          lastKeyTimestamp: -1000,
          isInChordMode: true,
          lastKeyPressed: null,
        });

        // Assert: Should validate all sections independently
        const imeErrorLogs = logMessages.filter((msg) =>
          msg.includes('State validation errors for ime')
        );
        const altClickErrorLogs = logMessages.filter((msg) =>
          msg.includes('State validation errors for altClick')
        );
        const keyboardErrorLogs = logMessages.filter((msg) =>
          msg.includes('State validation errors for keyboard')
        );

        expect(imeErrorLogs.length).toBeGreaterThan(0);
        expect(altClickErrorLogs.length).toBeGreaterThan(0);
        expect(keyboardErrorLogs.length).toBeGreaterThan(0);
      });
    });
  });
});
