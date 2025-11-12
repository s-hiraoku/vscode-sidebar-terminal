import * as vscode from 'vscode';
import { TerminalInstance, TerminalState, TerminalInfo } from '../../types/shared';
import { terminal as log } from '../../utils/logger';
import { getTerminalConfig } from '../../utils/common';
import { TerminalNumberManager } from '../../utils/TerminalNumberManager';
import { ActiveTerminalManager } from '../../utils/common';
import {
  TerminalLifecycleStateMachine,
  TerminalLifecycleState,
  StateTransition,
} from './TerminalLifecycleStateMachine';

/**
 * Service responsible for terminal state management
 *
 * This service extracts state management logic from TerminalManager to improve:
 * - Single Responsibility: Focus only on terminal state tracking
 * - Testability: Isolated state management logic
 * - Maintainability: Clear separation of state concerns
 * - Reusability: Can be used by other terminal-related components
 */
export class TerminalStateManagementService {
  private readonly _terminals = new Map<string, TerminalInstance>();
  private readonly _activeTerminalManager: ActiveTerminalManager;
  private readonly _terminalNumberManager: TerminalNumberManager;
  private readonly _lifecycleStateMachine: TerminalLifecycleStateMachine;

  // Event emitters for state changes
  private readonly _stateUpdateEmitter = new vscode.EventEmitter<TerminalState>();
  private readonly _terminalRemovedEmitter = new vscode.EventEmitter<string>();
  private readonly _terminalAddedEmitter = new vscode.EventEmitter<TerminalInstance>();
  private readonly _lifecycleStateChangeEmitter = new vscode.EventEmitter<StateTransition>();

  // Track terminals being killed to prevent race conditions
  private readonly _terminalBeingKilled = new Set<string>();

  public readonly onStateUpdate = this._stateUpdateEmitter.event;
  public readonly onTerminalRemoved = this._terminalRemovedEmitter.event;
  public readonly onTerminalAdded = this._terminalAddedEmitter.event;
  public readonly onLifecycleStateChange = this._lifecycleStateChangeEmitter.event;

  constructor() {
    const config = getTerminalConfig();
    this._activeTerminalManager = new ActiveTerminalManager();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);
    this._lifecycleStateMachine = new TerminalLifecycleStateMachine();

    // Forward lifecycle state changes to our own event
    this._lifecycleStateMachine.onStateChange((transition) => {
      this._lifecycleStateChangeEmitter.fire(transition);
    });

    log('📊 [StateManager] Terminal state management service initialized with lifecycle state machine');
  }

  /**
   * Add a terminal to the state
   */
  addTerminal(terminal: TerminalInstance): void {
    try {
      this._terminals.set(terminal.id, terminal);

      // Initialize lifecycle state machine for this terminal
      this._lifecycleStateMachine.initializeTerminal(terminal.id, {
        name: terminal.name,
        number: terminal.number,
      });

      log(`➕ [StateManager] Terminal added to state: ${terminal.id} (${terminal.name})`);

      // Emit events
      this._terminalAddedEmitter.fire(terminal);
      this._notifyStateUpdate();
    } catch (error) {
      log(`❌ [StateManager] Error adding terminal to state:`, error);
      throw error;
    }
  }

  /**
   * Remove a terminal from the state
   */
  removeTerminal(terminalId: string): void {
    try {
      const terminal = this._terminals.get(terminalId);
      if (!terminal) {
        log(`⚠️ [StateManager] Attempted to remove non-existent terminal: ${terminalId}`);
        return;
      }

      // Transition to Closed state in lifecycle state machine
      const currentLifecycleState = this._lifecycleStateMachine.getState(terminalId);
      if (currentLifecycleState && currentLifecycleState !== TerminalLifecycleState.Closed) {
        // Ensure terminal is in Closing state before removing
        if (currentLifecycleState !== TerminalLifecycleState.Closing) {
          this._lifecycleStateMachine.transition(
            terminalId,
            TerminalLifecycleState.Closing,
            'Terminal removal initiated'
          );
        }
        this._lifecycleStateMachine.transition(
          terminalId,
          TerminalLifecycleState.Closed,
          'Terminal removed from state'
        );
      }

      this._terminals.delete(terminalId);
      this._terminalBeingKilled.delete(terminalId); // Clean up killing tracker

      // Remove from lifecycle state machine after a delay to preserve history
      setTimeout(() => {
        if (this._lifecycleStateMachine.hasTerminal(terminalId)) {
          this._lifecycleStateMachine.removeTerminal(terminalId);
        }
      }, 5000); // Keep history for 5 seconds for debugging

      // Terminal number release handled externally
      if (terminal.number) {
        log(
          `🔢 [StateManager] Terminal number ${terminal.number} marked for release for ${terminalId}`
        );
      }

      // Clear active terminal if this was the active one
      if (this._activeTerminalManager.getActive() === terminalId) {
        this._activeTerminalManager.clearActive();
        log(`🔄 [StateManager] Cleared active terminal: ${terminalId}`);
      }

      log(`🗑️ [StateManager] Terminal removed from state: ${terminalId}`);

      // Emit events
      this._terminalRemovedEmitter.fire(terminalId);
      this._notifyStateUpdate();
    } catch (error) {
      log(`❌ [StateManager] Error removing terminal from state:`, error);
      throw error;
    }
  }

  /**
   * Get a terminal by ID
   */
  getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._terminals.get(terminalId);
  }

  /**
   * Get all terminals
   */
  getTerminals(): TerminalInstance[] {
    return Array.from(this._terminals.values());
  }

  /**
   * Get terminals map (read-only)
   */
  getTerminalsMap(): ReadonlyMap<string, TerminalInstance> {
    return this._terminals;
  }

  /**
   * Check if a terminal exists
   */
  hasTerminal(terminalId: string): boolean {
    return this._terminals.has(terminalId);
  }

  /**
   * Get terminal count
   */
  getTerminalCount(): number {
    return this._terminals.size;
  }

  /**
   * Check if has active terminal
   */
  hasActiveTerminal(): boolean {
    return this._activeTerminalManager.hasActive();
  }

  /**
   * Get active terminal ID
   */
  getActiveTerminalId(): string | undefined {
    return this._activeTerminalManager.getActive();
  }

  /**
   * Get active terminal instance
   */
  getActiveTerminal(): TerminalInstance | undefined {
    const activeId = this._activeTerminalManager.getActive();
    return activeId ? this._terminals.get(activeId) : undefined;
  }

  /**
   * Set active terminal
   */
  setActiveTerminal(terminalId: string): boolean {
    try {
      const terminal = this._terminals.get(terminalId);
      if (!terminal) {
        log(`⚠️ [StateManager] Cannot set non-existent terminal as active: ${terminalId}`);
        return false;
      }

      // Get previous active terminal
      const previousActiveId = this._activeTerminalManager.getActive();

      // Transition previous active terminal to Inactive
      if (previousActiveId && previousActiveId !== terminalId) {
        const previousState = this._lifecycleStateMachine.getState(previousActiveId);
        if (previousState === TerminalLifecycleState.Active) {
          this._lifecycleStateMachine.transition(
            previousActiveId,
            TerminalLifecycleState.Inactive,
            'Another terminal became active'
          );
        }
      }

      // Deactivate all terminals
      this._deactivateAllTerminals();

      // Set new active terminal
      terminal.isActive = true;
      this._activeTerminalManager.setActive(terminalId);

      // Transition new active terminal to Active state
      const currentState = this._lifecycleStateMachine.getState(terminalId);
      if (currentState === TerminalLifecycleState.Ready || currentState === TerminalLifecycleState.Inactive) {
        this._lifecycleStateMachine.transition(
          terminalId,
          TerminalLifecycleState.Active,
          'Terminal set as active'
        );
      }

      log(`✅ [StateManager] Set active terminal: ${terminalId} (${terminal.name})`);
      this._notifyStateUpdate();

      return true;
    } catch (error) {
      log(`❌ [StateManager] Error setting active terminal:`, error);
      return false;
    }
  }

  /**
   * Clear active terminal
   */
  clearActiveTerminal(): void {
    try {
      this._deactivateAllTerminals();
      this._activeTerminalManager.clearActive();

      log(`🔄 [StateManager] Active terminal cleared`);
      this._notifyStateUpdate();
    } catch (error) {
      log(`❌ [StateManager] Error clearing active terminal:`, error);
    }
  }

  /**
   * Mark terminal as being killed (race condition prevention)
   */
  markTerminalAsBeingKilled(terminalId: string): void {
    this._terminalBeingKilled.add(terminalId);
    log(`⚠️ [StateManager] Terminal marked as being killed: ${terminalId}`);
  }

  /**
   * Check if terminal is being killed
   */
  isTerminalBeingKilled(terminalId: string): boolean {
    return this._terminalBeingKilled.has(terminalId);
  }

  /**
   * Get next available terminal number
   */
  getNextTerminalNumber(): number | null {
    const availableSlots = this._terminalNumberManager.getAvailableSlots(this._terminals);
    return availableSlots.length > 0 ? availableSlots[0]! : null;
  }

  /**
   * Release a terminal number (handled externally)
   */
  releaseTerminalNumber(number: number): void {
    log(`🔢 [StateManager] Terminal number ${number} release requested (handled externally)`);
  }

  /**
   * Get available terminal slots
   */
  getAvailableSlots(): number[] {
    return this._terminalNumberManager.getAvailableSlots(this._terminals);
  }

  /**
   * Get current terminal state
   */
  getCurrentState(): TerminalState {
    try {
      const terminals: TerminalInfo[] = Array.from(this._terminals.values()).map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        isActive: terminal.isActive,
      }));

      const state: TerminalState = {
        terminals,
        activeTerminalId: this._activeTerminalManager.getActive() || null,
        maxTerminals: getTerminalConfig().maxTerminals,
        availableSlots: this.getAvailableSlots(),
      };

      return state;
    } catch (error) {
      log(`❌ [StateManager] Error getting current state:`, error);

      // Return safe fallback state
      return {
        terminals: [],
        activeTerminalId: null,
        maxTerminals: getTerminalConfig().maxTerminals,
        availableSlots: [],
      };
    }
  }

  /**
   * Get state statistics for debugging
   */
  getStateStatistics(): {
    terminalCount: number;
    activeTerminalId: string | null;
    terminalsBeingKilled: number;
    availableSlots: number[];
    usedNumbers: number[];
    maxTerminals: number;
  } {
    return {
      terminalCount: this._terminals.size,
      activeTerminalId: this._activeTerminalManager.getActive() || null,
      terminalsBeingKilled: this._terminalBeingKilled.size,
      availableSlots: this._terminalNumberManager.getAvailableSlots(this._terminals),
      usedNumbers: [], // Would need external tracking
      maxTerminals: 5, // Default max terminals
    };
  }

  /**
   * Select next available terminal as active (used after deletion)
   */
  selectNextActiveTerminal(): string | null {
    try {
      if (this._terminals.size === 0) {
        log(`🔄 [StateManager] No terminals available to set as active`);
        return null;
      }

      const remaining = Array.from(this._terminals.values())[0];
      if (remaining) {
        this.setActiveTerminal(remaining.id);
        return remaining.id;
      }

      return null;
    } catch (error) {
      log(`❌ [StateManager] Error selecting next active terminal:`, error);
      return null;
    }
  }

  /**
   * Validate terminal deletion (business logic)
   */
  validateDeletion(terminalId: string): { canDelete: boolean; reason?: string } {
    try {
      if (!this._terminals.has(terminalId)) {
        return { canDelete: false, reason: 'Terminal not found' };
      }

      // Must keep at least 1 terminal open
      if (this._terminals.size <= 1) {
        return { canDelete: false, reason: 'Must keep at least 1 terminal open' };
      }

      return { canDelete: true };
    } catch (error) {
      log(`❌ [StateManager] Error validating deletion:`, error);
      return { canDelete: false, reason: `Validation failed: ${String(error)}` };
    }
  }

  /**
   * Transition terminal lifecycle state
   */
  transitionLifecycleState(
    terminalId: string,
    toState: TerminalLifecycleState,
    reason?: string
  ): boolean {
    return this._lifecycleStateMachine.transition(terminalId, toState, reason);
  }

  /**
   * Transition terminal to error state
   */
  transitionToError(terminalId: string, reason: string, metadata?: Record<string, unknown>): boolean {
    return this._lifecycleStateMachine.transitionToError(terminalId, reason, metadata);
  }

  /**
   * Get terminal lifecycle state
   */
  getLifecycleState(terminalId: string): TerminalLifecycleState | undefined {
    return this._lifecycleStateMachine.getState(terminalId);
  }

  /**
   * Get lifecycle state history for a terminal
   */
  getLifecycleHistory(terminalId: string): StateTransition[] {
    return this._lifecycleStateMachine.getHistory(terminalId);
  }

  /**
   * Get terminals in specific lifecycle state
   */
  getTerminalsInLifecycleState(state: TerminalLifecycleState): string[] {
    return this._lifecycleStateMachine.getTerminalsInState(state);
  }

  /**
   * Get lifecycle state machine debug info
   */
  getLifecycleDebugInfo(): {
    totalTerminals: number;
    stateCounts: Record<TerminalLifecycleState, number>;
    terminals: Array<{ id: string; state: TerminalLifecycleState; historyCount: number }>;
  } {
    return this._lifecycleStateMachine.getDebugInfo();
  }

  /**
   * Deactivate all terminals
   */
  private _deactivateAllTerminals(): void {
    for (const terminal of this._terminals.values()) {
      terminal.isActive = false;
    }
  }

  /**
   * Notify state update to listeners
   */
  private _notifyStateUpdate(): void {
    try {
      const state = this.getCurrentState();
      this._stateUpdateEmitter.fire(state);
      log(`📡 [StateManager] State update notification sent`);
    } catch (error) {
      log(`❌ [StateManager] Error notifying state update:`, error);
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [StateManager] Disposing terminal state management service');

    try {
      // Clear all state
      this._terminals.clear();
      this._terminalBeingKilled.clear();

      // Dispose lifecycle state machine
      this._lifecycleStateMachine.dispose();

      // Dispose event emitters
      this._stateUpdateEmitter.dispose();
      this._terminalRemovedEmitter.dispose();
      this._terminalAddedEmitter.dispose();
      this._lifecycleStateChangeEmitter.dispose();

      log('✅ [StateManager] Terminal state management service disposed');
    } catch (error) {
      log('❌ [StateManager] Error disposing terminal state management service:', error);
    }
  }
}
