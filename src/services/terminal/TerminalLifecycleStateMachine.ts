import * as vscode from 'vscode';
import { terminal as log } from '../../utils/logger';

/**
 * Terminal lifecycle states
 *
 * State transition flow:
 * Creating → Initializing → Ready → Active ⇄ Inactive → Closing → Closed
 *                           ↓         ↓         ↓         ↓
 *                           └─────────→ Error ←─────────┘
 */
export enum TerminalLifecycleState {
  /** Terminal is being created (PTY process starting) */
  Creating = 'creating',

  /** Terminal PTY created, initializing xterm.js and UI */
  Initializing = 'initializing',

  /** Terminal fully initialized and ready for use */
  Ready = 'ready',

  /** Terminal is active (user is interacting) */
  Active = 'active',

  /** Terminal exists but is not currently active */
  Inactive = 'inactive',

  /** Terminal is being closed (cleanup in progress) */
  Closing = 'closing',

  /** Terminal has been closed and resources released */
  Closed = 'closed',

  /** Terminal encountered an error */
  Error = 'error',
}

/**
 * State transition event
 */
export interface StateTransition {
  terminalId: string;
  fromState: TerminalLifecycleState;
  toState: TerminalLifecycleState;
  timestamp: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Valid state transitions mapping
 */
const VALID_TRANSITIONS: Record<TerminalLifecycleState, TerminalLifecycleState[]> = {
  [TerminalLifecycleState.Creating]: [
    TerminalLifecycleState.Initializing,
    TerminalLifecycleState.Error,
    TerminalLifecycleState.Closed, // Allow direct closure if creation fails
  ],
  [TerminalLifecycleState.Initializing]: [
    TerminalLifecycleState.Ready,
    TerminalLifecycleState.Error,
    TerminalLifecycleState.Closing,
  ],
  [TerminalLifecycleState.Ready]: [
    TerminalLifecycleState.Active,
    TerminalLifecycleState.Inactive,
    TerminalLifecycleState.Closing,
    TerminalLifecycleState.Error,
  ],
  [TerminalLifecycleState.Active]: [
    TerminalLifecycleState.Inactive,
    TerminalLifecycleState.Closing,
    TerminalLifecycleState.Error,
  ],
  [TerminalLifecycleState.Inactive]: [
    TerminalLifecycleState.Active,
    TerminalLifecycleState.Closing,
    TerminalLifecycleState.Error,
  ],
  [TerminalLifecycleState.Closing]: [
    TerminalLifecycleState.Closed,
    TerminalLifecycleState.Error,
  ],
  [TerminalLifecycleState.Closed]: [],
  [TerminalLifecycleState.Error]: [
    TerminalLifecycleState.Closing,
    TerminalLifecycleState.Closed,
  ],
};

/**
 * Terminal lifecycle state machine
 *
 * Manages terminal state transitions with validation and history tracking.
 * Provides a single source of truth for terminal lifecycle states.
 */
export class TerminalLifecycleStateMachine {
  private readonly _terminalStates = new Map<string, TerminalLifecycleState>();
  private readonly _transitionHistory = new Map<string, StateTransition[]>();
  private readonly _stateChangeEmitter = new vscode.EventEmitter<StateTransition>();

  // Event for state change notifications
  public readonly onStateChange = this._stateChangeEmitter.event;

  // Configuration
  private readonly _maxHistoryPerTerminal: number;

  constructor(maxHistoryPerTerminal: number = 50) {
    this._maxHistoryPerTerminal = maxHistoryPerTerminal;
    log('🔄 [StateMachine] Terminal lifecycle state machine initialized');
  }

  /**
   * Initialize a new terminal with Creating state
   */
  initializeTerminal(terminalId: string, metadata?: Record<string, unknown>): boolean {
    try {
      if (this._terminalStates.has(terminalId)) {
        log(`⚠️ [StateMachine] Terminal already exists: ${terminalId}`);
        return false;
      }

      this._terminalStates.set(terminalId, TerminalLifecycleState.Creating);
      this._initializeHistory(terminalId);

      this._recordTransition(
        terminalId,
        TerminalLifecycleState.Creating,
        TerminalLifecycleState.Creating,
        'Terminal initialized',
        metadata
      );

      log(`✅ [StateMachine] Terminal initialized: ${terminalId} -> Creating`);
      return true;
    } catch (error) {
      log(`❌ [StateMachine] Error initializing terminal:`, error);
      return false;
    }
  }

  /**
   * Transition terminal to a new state with validation
   */
  transition(
    terminalId: string,
    toState: TerminalLifecycleState,
    reason?: string,
    metadata?: Record<string, unknown>
  ): boolean {
    try {
      const currentState = this._terminalStates.get(terminalId);

      if (!currentState) {
        log(`⚠️ [StateMachine] Cannot transition unknown terminal: ${terminalId}`);
        return false;
      }

      // Validate transition
      if (!this._isValidTransition(currentState, toState)) {
        log(
          `❌ [StateMachine] Invalid transition: ${terminalId} from ${currentState} to ${toState}`
        );
        return false;
      }

      // Update state
      this._terminalStates.set(terminalId, toState);

      // Record transition
      this._recordTransition(terminalId, currentState, toState, reason, metadata);

      log(
        `✅ [StateMachine] Terminal transitioned: ${terminalId} ${currentState} → ${toState}${reason ? ` (${reason})` : ''}`
      );

      return true;
    } catch (error) {
      log(`❌ [StateMachine] Error transitioning terminal:`, error);
      return false;
    }
  }

  /**
   * Force transition to error state (always allowed)
   */
  transitionToError(
    terminalId: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): boolean {
    try {
      const currentState = this._terminalStates.get(terminalId);

      if (!currentState) {
        log(`⚠️ [StateMachine] Cannot transition unknown terminal to error: ${terminalId}`);
        return false;
      }

      // Error transitions are always allowed from any state except Closed
      if (currentState === TerminalLifecycleState.Closed) {
        log(`⚠️ [StateMachine] Cannot transition closed terminal to error: ${terminalId}`);
        return false;
      }

      this._terminalStates.set(terminalId, TerminalLifecycleState.Error);
      this._recordTransition(
        terminalId,
        currentState,
        TerminalLifecycleState.Error,
        reason,
        metadata
      );

      log(`⚠️ [StateMachine] Terminal error: ${terminalId} ${currentState} → Error (${reason})`);

      return true;
    } catch (error) {
      log(`❌ [StateMachine] Error transitioning to error state:`, error);
      return false;
    }
  }

  /**
   * Get current state of a terminal
   */
  getState(terminalId: string): TerminalLifecycleState | undefined {
    return this._terminalStates.get(terminalId);
  }

  /**
   * Check if terminal is in a specific state
   */
  isInState(terminalId: string, state: TerminalLifecycleState): boolean {
    return this._terminalStates.get(terminalId) === state;
  }

  /**
   * Check if terminal can transition to a target state
   */
  canTransitionTo(terminalId: string, toState: TerminalLifecycleState): boolean {
    const currentState = this._terminalStates.get(terminalId);
    if (!currentState) {
      return false;
    }
    return this._isValidTransition(currentState, toState);
  }

  /**
   * Get transition history for a terminal
   */
  getHistory(terminalId: string): StateTransition[] {
    return this._transitionHistory.get(terminalId) || [];
  }

  /**
   * Get all terminals in a specific state
   */
  getTerminalsInState(state: TerminalLifecycleState): string[] {
    const terminals: string[] = [];
    for (const [terminalId, terminalState] of this._terminalStates.entries()) {
      if (terminalState === state) {
        terminals.push(terminalId);
      }
    }
    return terminals;
  }

  /**
   * Get count of terminals in each state
   */
  getStateCounts(): Record<TerminalLifecycleState, number> {
    const counts = Object.values(TerminalLifecycleState).reduce(
      (acc, state) => {
        acc[state] = 0;
        return acc;
      },
      {} as Record<TerminalLifecycleState, number>
    );

    for (const state of this._terminalStates.values()) {
      counts[state]++;
    }

    return counts;
  }

  /**
   * Get all terminals and their states
   */
  getAllStates(): Map<string, TerminalLifecycleState> {
    return new Map(this._terminalStates);
  }

  /**
   * Check if terminal exists in state machine
   */
  hasTerminal(terminalId: string): boolean {
    return this._terminalStates.has(terminalId);
  }

  /**
   * Remove terminal from state machine (typically after closure)
   */
  removeTerminal(terminalId: string): boolean {
    try {
      const currentState = this._terminalStates.get(terminalId);

      if (!currentState) {
        log(`⚠️ [StateMachine] Cannot remove unknown terminal: ${terminalId}`);
        return false;
      }

      // Only remove if in Closed state
      if (currentState !== TerminalLifecycleState.Closed) {
        log(
          `⚠️ [StateMachine] Cannot remove terminal not in Closed state: ${terminalId} (current: ${currentState})`
        );
        return false;
      }

      this._terminalStates.delete(terminalId);
      // Keep history for debugging purposes

      log(`🗑️ [StateMachine] Terminal removed: ${terminalId}`);
      return true;
    } catch (error) {
      log(`❌ [StateMachine] Error removing terminal:`, error);
      return false;
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo(): {
    totalTerminals: number;
    stateCounts: Record<TerminalLifecycleState, number>;
    terminals: Array<{ id: string; state: TerminalLifecycleState; historyCount: number }>;
  } {
    const terminals: Array<{ id: string; state: TerminalLifecycleState; historyCount: number }> =
      [];

    for (const [id, state] of this._terminalStates.entries()) {
      terminals.push({
        id,
        state,
        historyCount: this._transitionHistory.get(id)?.length || 0,
      });
    }

    return {
      totalTerminals: this._terminalStates.size,
      stateCounts: this.getStateCounts(),
      terminals,
    };
  }

  /**
   * Clear all state (for testing or reset)
   */
  clear(): void {
    log('🧹 [StateMachine] Clearing all state');
    this._terminalStates.clear();
    this._transitionHistory.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    log('🧹 [StateMachine] Disposing state machine');
    try {
      this.clear();
      this._stateChangeEmitter.dispose();
      log('✅ [StateMachine] State machine disposed');
    } catch (error) {
      log('❌ [StateMachine] Error disposing state machine:', error);
    }
  }

  // Private methods

  /**
   * Check if transition is valid
   */
  private _isValidTransition(
    fromState: TerminalLifecycleState,
    toState: TerminalLifecycleState
  ): boolean {
    const validTransitions = VALID_TRANSITIONS[fromState];
    return validTransitions.includes(toState);
  }

  /**
   * Initialize history for a terminal
   */
  private _initializeHistory(terminalId: string): void {
    if (!this._transitionHistory.has(terminalId)) {
      this._transitionHistory.set(terminalId, []);
    }
  }

  /**
   * Record a state transition
   */
  private _recordTransition(
    terminalId: string,
    fromState: TerminalLifecycleState,
    toState: TerminalLifecycleState,
    reason?: string,
    metadata?: Record<string, unknown>
  ): void {
    const transition: StateTransition = {
      terminalId,
      fromState,
      toState,
      timestamp: new Date(),
      reason,
      metadata,
    };

    let history = this._transitionHistory.get(terminalId);
    if (!history) {
      history = [];
      this._transitionHistory.set(terminalId, history);
    }

    history.push(transition);

    // Limit history size
    if (history.length > this._maxHistoryPerTerminal) {
      history.shift();
    }

    // Emit event (only for actual transitions, not initialization)
    if (fromState !== toState) {
      this._stateChangeEmitter.fire(transition);
    }
  }
}
