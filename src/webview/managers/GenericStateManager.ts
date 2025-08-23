/**
 * Generic State Manager - Base class to eliminate state management duplication
 * Provides common patterns for CLI Agent and Terminal state management
 */

import { webview as log } from '../../utils/logger';

export interface StateChangeListener<T> {
  onStateChanged(id: string, newState: T, previousState?: T): void;
  onStateRemoved(id: string, removedState: T): void;
}

export interface StateValidationRule<T> {
  name: string;
  validate: (state: T) => boolean;
  message: string;
}

export interface StateTransitionRule<T> {
  from: keyof T | '*';
  to: keyof T;
  validate?: (currentState: T, newState: T) => boolean;
  message?: string;
}

/**
 * Generic base class for managing state collections with validation and transitions
 */
export abstract class GenericStateManager<T extends Record<string, unknown>> {
  protected states = new Map<string, T>();
  protected listeners = new Set<StateChangeListener<T>>();
  protected validationRules: StateValidationRule<T>[] = [];
  protected transitionRules: StateTransitionRule<T>[] = [];
  protected stateHistory = new Map<string, Array<{ state: T; timestamp: number }>>();
  protected readonly maxHistoryPerState = 5;

  constructor(protected readonly managerName: string) {
    log(`🏗️ [${this.managerName.toUpperCase()}] Generic state manager initialized`);
  }

  /**
   * Add a state validation rule
   */
  protected addValidationRule(rule: StateValidationRule<T>): void {
    this.validationRules.push(rule);
    log(`📋 [${this.managerName.toUpperCase()}] Added validation rule: ${rule.name}`);
  }

  /**
   * Add a state transition rule
   */
  protected addTransitionRule(rule: StateTransitionRule<T>): void {
    this.transitionRules.push(rule);
    log(`🔄 [${this.managerName.toUpperCase()}] Added transition rule: ${String(rule.from)} → ${String(rule.to)}`);
  }

  /**
   * Set state with validation and transition checking
   */
  public setState(id: string, newState: T, skipValidation = false): boolean {
    const previousState = this.states.get(id);

    // Validation
    if (!skipValidation && !this.validateState(newState)) {
      log(`❌ [${this.managerName.toUpperCase()}] State validation failed for ${id}`);
      return false;
    }

    // Transition validation
    if (previousState && !this.validateTransition(previousState, newState)) {
      log(`❌ [${this.managerName.toUpperCase()}] State transition validation failed for ${id}`);
      return false;
    }

    // Store in history
    this.addToHistory(id, previousState);

    // Update state
    this.states.set(id, newState);

    // Notify listeners
    this.notifyStateChanged(id, newState, previousState);

    log(`✅ [${this.managerName.toUpperCase()}] State updated for ${id}`);
    return true;
  }

  /**
   * Get state by ID
   */
  public getState(id: string): T | undefined {
    return this.states.get(id);
  }

  /**
   * Get all states
   */
  public getAllStates(): Map<string, T> {
    return new Map(this.states);
  }

  /**
   * Check if state exists
   */
  public hasState(id: string): boolean {
    return this.states.has(id);
  }

  /**
   * Remove state
   */
  public removeState(id: string): boolean {
    const state = this.states.get(id);
    if (!state) {
      return false;
    }

    this.states.delete(id);
    this.stateHistory.delete(id);
    this.notifyStateRemoved(id, state);

    log(`🗑️ [${this.managerName.toUpperCase()}] State removed for ${id}`);
    return true;
  }

  /**
   * Update partial state
   */
  public updateState(id: string, updates: Partial<T>): boolean {
    const currentState = this.states.get(id);
    if (!currentState) {
      log(`⚠️ [${this.managerName.toUpperCase()}] Cannot update non-existent state for ${id}`);
      return false;
    }

    const newState = { ...currentState, ...updates } as T;
    return this.setState(id, newState);
  }

  /**
   * Add state change listener
   */
  public addListener(listener: StateChangeListener<T>): void {
    this.listeners.add(listener);
    log(`👂 [${this.managerName.toUpperCase()}] Added listener, total: ${this.listeners.size}`);
  }

  /**
   * Remove state change listener
   */
  public removeListener(listener: StateChangeListener<T>): void {
    this.listeners.delete(listener);
    log(`👂 [${this.managerName.toUpperCase()}] Removed listener, total: ${this.listeners.size}`);
  }

  /**
   * Find states by criteria
   */
  public findStates(predicate: (state: T, id: string) => boolean): Map<string, T> {
    const results = new Map<string, T>();

    for (const [id, state] of this.states) {
      if (predicate(state, id)) {
        results.set(id, state);
      }
    }

    return results;
  }

  /**
   * Get state history for rollback
   */
  public getStateHistory(id: string): Array<{ state: T; timestamp: number }> {
    return this.stateHistory.get(id)?.slice() || [];
  }

  /**
   * Rollback to previous state
   */
  public rollbackState(id: string, steps = 1): boolean {
    const history = this.stateHistory.get(id);
    if (!history || history.length < steps) {
      log(`⚠️ [${this.managerName.toUpperCase()}] Cannot rollback ${steps} steps for ${id}`);
      return false;
    }

    const targetHistoryEntry = history[history.length - steps];
    const success = this.setState(id, targetHistoryEntry!.state, true); // Skip validation for rollback

    if (success) {
      // Remove rolled-back history entries
      history.splice(-steps);
      log(`🔄 [${this.managerName.toUpperCase()}] Rolled back ${steps} steps for ${id}`);
    }

    return success;
  }

  /**
   * Validate state using registered rules
   */
  protected validateState(state: T): boolean {
    for (const rule of this.validationRules) {
      if (!rule.validate(state)) {
        log(`❌ [${this.managerName.toUpperCase()}] Validation failed: ${rule.message}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Validate state transition
   */
  protected validateTransition(currentState: T, newState: T): boolean {
    for (const rule of this.transitionRules) {
      // Check if rule applies to this transition
      const fromMatches = rule.from === '*' || this.hasStateValue(currentState, rule.from);
      const toMatches = this.hasStateValue(newState, rule.to);

      if (fromMatches && toMatches) {
        if (rule.validate && !rule.validate(currentState, newState)) {
          log(
            `❌ [${this.managerName.toUpperCase()}] Transition validation failed: ${rule.message || 'Unknown rule'}`
          );
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Check if state has specific value
   */
  protected hasStateValue(state: T, key: keyof T): boolean {
    return state[key] !== undefined;
  }

  /**
   * Add state to history
   */
  private addToHistory(id: string, state?: T): void {
    if (!state) return;

    let history = this.stateHistory.get(id);
    if (!history) {
      history = [];
      this.stateHistory.set(id, history);
    }

    history.push({ state: { ...state }, timestamp: Date.now() });

    // Maintain history size limit
    if (history.length > this.maxHistoryPerState) {
      history.shift();
    }
  }

  /**
   * Notify listeners of state change
   */
  private notifyStateChanged(id: string, newState: T, previousState?: T): void {
    this.listeners.forEach((listener) => {
      try {
        listener.onStateChanged(id, newState, previousState);
      } catch (error) {
        log(`❌ [${this.managerName.toUpperCase()}] Error notifying state change listener:`, error);
      }
    });
  }

  /**
   * Notify listeners of state removal
   */
  private notifyStateRemoved(id: string, removedState: T): void {
    this.listeners.forEach((listener) => {
      try {
        listener.onStateRemoved(id, removedState);
      } catch (error) {
        log(
          `❌ [${this.managerName.toUpperCase()}] Error notifying state removal listener:`,
          error
        );
      }
    });
  }

  /**
   * Clear all states
   */
  public clear(): void {
    const removedStates = new Map(this.states);
    this.states.clear();
    this.stateHistory.clear();

    // Notify about all removals
    for (const [id, state] of removedStates) {
      this.notifyStateRemoved(id, state);
    }

    log(`🧹 [${this.managerName.toUpperCase()}] All states cleared`);
  }

  /**
   * Get manager statistics
   */
  public getStats(): {
    stateCount: number;
    listenerCount: number;
    validationRules: number;
    transitionRules: number;
    totalHistoryEntries: number;
  } {
    let totalHistory = 0;
    for (const history of this.stateHistory.values()) {
      totalHistory += history.length;
    }

    return {
      stateCount: this.states.size,
      listenerCount: this.listeners.size,
      validationRules: this.validationRules.length,
      transitionRules: this.transitionRules.length,
      totalHistoryEntries: totalHistory,
    };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.clear();
    this.listeners.clear();
    this.validationRules = [];
    this.transitionRules = [];
    log(`🧹 [${this.managerName.toUpperCase()}] Generic state manager disposed`);
  }
}
