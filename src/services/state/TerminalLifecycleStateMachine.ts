/**
 * Terminal Lifecycle State Machine
 *
 * Implements a centralized state machine pattern for terminal lifecycle management.
 * Addresses issue #221: fragmented terminal state management across multiple classes.
 *
 * This state machine provides:
 * - Clear terminal lifecycle states (Creating, Initializing, Ready, Active, Closing, Closed, Error)
 * - Enforced valid state transitions
 * - Transition history tracking for debugging
 * - State change event listeners for UI synchronization
 */

/**
 * Terminal Lifecycle States
 *
 * Defines all possible states in the terminal lifecycle.
 * Higher-level states than ProcessState, focusing on overall terminal lifecycle.
 */
export enum TerminalLifecycleState {
  /** Terminal is being created (before initialization) */
  Creating = 'Creating',
  /** Terminal is initializing (spawning process, setting up environment) */
  Initializing = 'Initializing',
  /** Terminal is ready for use (process running, not active) */
  Ready = 'Ready',
  /** Terminal is currently active and receiving user input */
  Active = 'Active',
  /** Terminal is in the process of closing */
  Closing = 'Closing',
  /** Terminal has been closed */
  Closed = 'Closed',
  /** Terminal encountered an error */
  Error = 'Error',
}

/**
 * State Transition Metadata
 *
 * Additional context about a state transition.
 */
export interface StateTransitionMetadata {
  /** Reason for the transition */
  reason?: string;
  /** Error information if transitioning to Error state */
  error?: Error | string;
  /** Timestamp of the transition */
  timestamp: Date;
  /** Additional custom data */
  data?: Record<string, unknown>;
}

/**
 * State Transition Record
 *
 * Historical record of a state transition.
 */
export interface StateTransitionRecord {
  /** Source state */
  from: TerminalLifecycleState;
  /** Target state */
  to: TerminalLifecycleState;
  /** Transition metadata */
  metadata: StateTransitionMetadata;
}

/**
 * State Change Event
 *
 * Event data for state change notifications.
 */
export interface StateChangeEvent {
  /** Terminal ID */
  terminalId: string;
  /** Previous state */
  previousState: TerminalLifecycleState;
  /** New state */
  newState: TerminalLifecycleState;
  /** Transition metadata */
  metadata: StateTransitionMetadata;
}

/**
 * State Change Listener
 *
 * Callback function for state change notifications.
 */
export type StateChangeListener = (event: StateChangeEvent) => void;

/**
 * Valid State Transitions Map
 *
 * Defines which state transitions are allowed.
 * Key: current state, Value: array of allowed next states
 */
const VALID_TRANSITIONS: Record<
  TerminalLifecycleState,
  TerminalLifecycleState[]
> = {
  [TerminalLifecycleState.Creating]: [
    TerminalLifecycleState.Initializing,
    TerminalLifecycleState.Error,
  ],
  [TerminalLifecycleState.Initializing]: [
    TerminalLifecycleState.Ready,
    TerminalLifecycleState.Active,
    TerminalLifecycleState.Error,
  ],
  [TerminalLifecycleState.Ready]: [
    TerminalLifecycleState.Active,
    TerminalLifecycleState.Closing,
    TerminalLifecycleState.Error,
  ],
  [TerminalLifecycleState.Active]: [
    TerminalLifecycleState.Ready,
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
 * Terminal Lifecycle State Machine
 *
 * Manages the lifecycle state of a single terminal instance.
 * Enforces valid state transitions and provides state query methods.
 */
export class TerminalLifecycleStateMachine {
  private _currentState: TerminalLifecycleState;
  private readonly _terminalId: string;
  private readonly _listeners: Set<StateChangeListener>;
  private readonly _transitionHistory: StateTransitionRecord[];
  private readonly _maxHistorySize: number;

  /**
   * Creates a new Terminal Lifecycle State Machine
   *
   * @param terminalId Terminal identifier
   * @param initialState Initial state (defaults to Creating)
   * @param maxHistorySize Maximum number of transitions to keep in history (defaults to 100)
   */
  constructor(
    terminalId: string,
    initialState: TerminalLifecycleState = TerminalLifecycleState.Creating,
    maxHistorySize: number = 100
  ) {
    this._terminalId = terminalId;
    this._currentState = initialState;
    this._listeners = new Set();
    this._transitionHistory = [];
    this._maxHistorySize = maxHistorySize;
  }

  /**
   * Get the current state
   *
   * @returns Current terminal lifecycle state
   */
  public getCurrentState(): TerminalLifecycleState {
    return this._currentState;
  }

  /**
   * Get terminal ID
   *
   * @returns Terminal identifier
   */
  public getTerminalId(): string {
    return this._terminalId;
  }

  /**
   * Check if terminal is in a specific state
   *
   * @param state State to check
   * @returns True if terminal is in the specified state
   */
  public isInState(state: TerminalLifecycleState): boolean {
    return this._currentState === state;
  }

  /**
   * Check if terminal is in any of the specified states
   *
   * @param states States to check
   * @returns True if terminal is in any of the specified states
   */
  public isInAnyState(states: TerminalLifecycleState[]): boolean {
    return states.includes(this._currentState);
  }

  /**
   * Check if a transition is valid from the current state
   *
   * @param targetState Target state
   * @returns True if transition is valid
   */
  public canTransitionTo(targetState: TerminalLifecycleState): boolean {
    const validNextStates = VALID_TRANSITIONS[this._currentState];
    return validNextStates.includes(targetState);
  }

  /**
   * Get all valid next states from the current state
   *
   * @returns Array of valid next states
   */
  public getValidNextStates(): TerminalLifecycleState[] {
    return [...VALID_TRANSITIONS[this._currentState]];
  }

  /**
   * Transition to a new state
   *
   * @param targetState Target state
   * @param metadata Optional transition metadata
   * @throws Error if transition is not valid
   */
  public transition(
    targetState: TerminalLifecycleState,
    metadata?: Partial<StateTransitionMetadata>
  ): void {
    // Check if transition is valid
    if (!this.canTransitionTo(targetState)) {
      const validStates = this.getValidNextStates().join(', ');
      throw new Error(
        `Invalid state transition for terminal ${this._terminalId}: ` +
          `${this._currentState} -> ${targetState}. ` +
          `Valid transitions: ${validStates || 'none'}`
      );
    }

    // Record the transition
    const previousState = this._currentState;
    const transitionMetadata: StateTransitionMetadata = {
      timestamp: new Date(),
      ...metadata,
    };

    const transitionRecord: StateTransitionRecord = {
      from: previousState,
      to: targetState,
      metadata: transitionMetadata,
    };

    // Add to history (maintain max size)
    this._transitionHistory.push(transitionRecord);
    if (this._transitionHistory.length > this._maxHistorySize) {
      this._transitionHistory.shift();
    }

    // Update state
    this._currentState = targetState;

    // Notify listeners
    const event: StateChangeEvent = {
      terminalId: this._terminalId,
      previousState,
      newState: targetState,
      metadata: transitionMetadata,
    };

    this._notifyListeners(event);
  }

  /**
   * Force transition to a state (bypassing validation)
   *
   * WARNING: Use with caution. This bypasses transition validation.
   * Only use for recovery scenarios or special cases.
   *
   * @param targetState Target state
   * @param metadata Optional transition metadata
   */
  public forceTransition(
    targetState: TerminalLifecycleState,
    metadata?: Partial<StateTransitionMetadata>
  ): void {
    const previousState = this._currentState;
    const transitionMetadata: StateTransitionMetadata = {
      reason: 'Forced transition (validation bypassed)',
      timestamp: new Date(),
      ...metadata,
    };

    const transitionRecord: StateTransitionRecord = {
      from: previousState,
      to: targetState,
      metadata: transitionMetadata,
    };

    this._transitionHistory.push(transitionRecord);
    if (this._transitionHistory.length > this._maxHistorySize) {
      this._transitionHistory.shift();
    }

    this._currentState = targetState;

    const event: StateChangeEvent = {
      terminalId: this._terminalId,
      previousState,
      newState: targetState,
      metadata: transitionMetadata,
    };

    this._notifyListeners(event);
  }

  /**
   * Add a state change listener
   *
   * @param listener Listener callback
   * @returns Disposable function to remove the listener
   */
  public addListener(listener: StateChangeListener): () => void {
    this._listeners.add(listener);
    return () => this.removeListener(listener);
  }

  /**
   * Remove a state change listener
   *
   * @param listener Listener callback
   * @returns True if listener was removed
   */
  public removeListener(listener: StateChangeListener): boolean {
    return this._listeners.delete(listener);
  }

  /**
   * Remove all listeners
   */
  public clearListeners(): void {
    this._listeners.clear();
  }

  /**
   * Get the number of registered listeners
   *
   * @returns Number of listeners
   */
  public getListenerCount(): number {
    return this._listeners.size;
  }

  /**
   * Get transition history
   *
   * @param limit Optional limit on number of records (most recent first)
   * @returns Array of transition records
   */
  public getTransitionHistory(limit?: number): StateTransitionRecord[] {
    const history = [...this._transitionHistory];
    if (limit !== undefined && limit > 0) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Get the most recent transition
   *
   * @returns Most recent transition record or undefined
   */
  public getLastTransition(): StateTransitionRecord | undefined {
    return this._transitionHistory[this._transitionHistory.length - 1];
  }

  /**
   * Clear transition history
   */
  public clearHistory(): void {
    this._transitionHistory.length = 0;
  }

  /**
   * Get a summary of the current state
   *
   * @returns State summary object
   */
  public getStateSummary(): {
    terminalId: string;
    currentState: TerminalLifecycleState;
    validNextStates: TerminalLifecycleState[];
    transitionCount: number;
    lastTransition?: StateTransitionRecord;
  } {
    return {
      terminalId: this._terminalId,
      currentState: this._currentState,
      validNextStates: this.getValidNextStates(),
      transitionCount: this._transitionHistory.length,
      lastTransition: this.getLastTransition(),
    };
  }

  /**
   * Notify all listeners of a state change
   *
   * @param event State change event
   */
  private _notifyListeners(event: StateChangeEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(
          `Error in state change listener for terminal ${this._terminalId}:`,
          error
        );
      }
    }
  }

  /**
   * Dispose the state machine and clean up resources
   */
  public dispose(): void {
    this._listeners.clear();
    this._transitionHistory.length = 0;
  }
}

/**
 * Terminal Lifecycle State Machine Manager
 *
 * Manages multiple terminal state machines.
 * Provides centralized access to all terminal lifecycle states.
 */
export class TerminalLifecycleStateMachineManager {
  private readonly _stateMachines: Map<string, TerminalLifecycleStateMachine>;
  private readonly _globalListeners: Set<StateChangeListener>;

  constructor() {
    this._stateMachines = new Map();
    this._globalListeners = new Set();
  }

  /**
   * Create a state machine for a terminal
   *
   * @param terminalId Terminal identifier
   * @param initialState Initial state (defaults to Creating)
   * @returns The created state machine
   * @throws Error if state machine already exists for this terminal
   */
  public createStateMachine(
    terminalId: string,
    initialState?: TerminalLifecycleState
  ): TerminalLifecycleStateMachine {
    if (this._stateMachines.has(terminalId)) {
      throw new Error(
        `State machine already exists for terminal ${terminalId}`
      );
    }

    const stateMachine = new TerminalLifecycleStateMachine(
      terminalId,
      initialState
    );

    // Add global listeners to the new state machine
    for (const listener of this._globalListeners) {
      stateMachine.addListener(listener);
    }

    this._stateMachines.set(terminalId, stateMachine);
    return stateMachine;
  }

  /**
   * Get a state machine for a terminal
   *
   * @param terminalId Terminal identifier
   * @returns The state machine or undefined if not found
   */
  public getStateMachine(
    terminalId: string
  ): TerminalLifecycleStateMachine | undefined {
    return this._stateMachines.get(terminalId);
  }

  /**
   * Get or create a state machine for a terminal
   *
   * @param terminalId Terminal identifier
   * @param initialState Initial state if creating (defaults to Creating)
   * @returns The state machine
   */
  public getOrCreateStateMachine(
    terminalId: string,
    initialState?: TerminalLifecycleState
  ): TerminalLifecycleStateMachine {
    let stateMachine = this._stateMachines.get(terminalId);
    if (!stateMachine) {
      stateMachine = this.createStateMachine(terminalId, initialState);
    }
    return stateMachine;
  }

  /**
   * Check if a state machine exists for a terminal
   *
   * @param terminalId Terminal identifier
   * @returns True if state machine exists
   */
  public hasStateMachine(terminalId: string): boolean {
    return this._stateMachines.has(terminalId);
  }

  /**
   * Remove a state machine for a terminal
   *
   * @param terminalId Terminal identifier
   * @returns True if state machine was removed
   */
  public removeStateMachine(terminalId: string): boolean {
    const stateMachine = this._stateMachines.get(terminalId);
    if (stateMachine) {
      stateMachine.dispose();
      return this._stateMachines.delete(terminalId);
    }
    return false;
  }

  /**
   * Get all terminal IDs with state machines
   *
   * @returns Array of terminal IDs
   */
  public getAllTerminalIds(): string[] {
    return Array.from(this._stateMachines.keys());
  }

  /**
   * Get current state for a terminal
   *
   * @param terminalId Terminal identifier
   * @returns Current state or undefined if not found
   */
  public getCurrentState(
    terminalId: string
  ): TerminalLifecycleState | undefined {
    return this._stateMachines.get(terminalId)?.getCurrentState();
  }

  /**
   * Check if a terminal is in a specific state
   *
   * @param terminalId Terminal identifier
   * @param state State to check
   * @returns True if terminal is in the specified state
   */
  public isTerminalInState(
    terminalId: string,
    state: TerminalLifecycleState
  ): boolean {
    return this._stateMachines.get(terminalId)?.isInState(state) ?? false;
  }

  /**
   * Get all terminals in a specific state
   *
   * @param state State to filter by
   * @returns Array of terminal IDs in the specified state
   */
  public getTerminalsInState(state: TerminalLifecycleState): string[] {
    const result: string[] = [];
    for (const [terminalId, stateMachine] of this._stateMachines) {
      if (stateMachine.isInState(state)) {
        result.push(terminalId);
      }
    }
    return result;
  }

  /**
   * Add a global listener that will be called for all terminal state changes
   *
   * @param listener Listener callback
   * @returns Disposable function to remove the listener
   */
  public addGlobalListener(listener: StateChangeListener): () => void {
    this._globalListeners.add(listener);

    // Add to all existing state machines
    for (const stateMachine of this._stateMachines.values()) {
      stateMachine.addListener(listener);
    }

    return () => this.removeGlobalListener(listener);
  }

  /**
   * Remove a global listener
   *
   * @param listener Listener callback
   * @returns True if listener was removed
   */
  public removeGlobalListener(listener: StateChangeListener): boolean {
    // Remove from all state machines
    for (const stateMachine of this._stateMachines.values()) {
      stateMachine.removeListener(listener);
    }

    return this._globalListeners.delete(listener);
  }

  /**
   * Clear all global listeners
   */
  public clearGlobalListeners(): void {
    for (const stateMachine of this._stateMachines.values()) {
      stateMachine.clearListeners();
    }
    this._globalListeners.clear();
  }

  /**
   * Get a summary of all terminal states
   *
   * @returns Map of terminal IDs to state summaries
   */
  public getAllStateSummaries(): Map<
    string,
    ReturnType<TerminalLifecycleStateMachine['getStateSummary']>
  > {
    const summaries = new Map();
    for (const [terminalId, stateMachine] of this._stateMachines) {
      summaries.set(terminalId, stateMachine.getStateSummary());
    }
    return summaries;
  }

  /**
   * Dispose the manager and all state machines
   */
  public dispose(): void {
    for (const stateMachine of this._stateMachines.values()) {
      stateMachine.dispose();
    }
    this._stateMachines.clear();
    this._globalListeners.clear();
  }

  /**
   * Get the number of managed state machines
   *
   * @returns Number of state machines
   */
  public getStateMachineCount(): number {
    return this._stateMachines.size;
  }
}
