import * as vscode from 'vscode';
import { TerminalInstance, TerminalState, TerminalInfo } from '../../types/shared';
import { terminal as log } from '../../utils/logger';
import { getTerminalConfig } from '../../utils/common';
import { TerminalNumberManager } from '../../utils/TerminalNumberManager';
import { ActiveTerminalManager } from '../../utils/common';

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

  // Event emitters for state changes
  private readonly _stateUpdateEmitter = new vscode.EventEmitter<TerminalState>();
  private readonly _terminalRemovedEmitter = new vscode.EventEmitter<string>();
  private readonly _terminalAddedEmitter = new vscode.EventEmitter<TerminalInstance>();

  // Track terminals being killed to prevent race conditions
  private readonly _terminalBeingKilled = new Set<string>();

  public readonly onStateUpdate = this._stateUpdateEmitter.event;
  public readonly onTerminalRemoved = this._terminalRemovedEmitter.event;
  public readonly onTerminalAdded = this._terminalAddedEmitter.event;

  constructor() {
    const config = getTerminalConfig();
    this._activeTerminalManager = new ActiveTerminalManager();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);

    log('📊 [StateManager] Terminal state management service initialized');
  }

  /**
   * Add a terminal to the state
   */
  addTerminal(terminal: TerminalInstance): void {
    try {
      this._terminals.set(terminal.id, terminal);
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

      this._terminals.delete(terminalId);
      this._terminalBeingKilled.delete(terminalId); // Clean up killing tracker

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

      // Deactivate all terminals
      this._deactivateAllTerminals();

      // Set new active terminal
      terminal.isActive = true;
      this._activeTerminalManager.setActive(terminalId);

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
      if (!this.hasTerminal(terminalId)) {
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
      this._activeTerminalManager.clearActive();

      // Dispose event emitters
      this._stateUpdateEmitter.dispose();
      this._terminalRemovedEmitter.dispose();
      this._terminalAddedEmitter.dispose();

      log('✅ [StateManager] Terminal state management service disposed');
    } catch (error) {
      log('❌ [StateManager] Error disposing terminal state management service:', error);
    }
  }
}
