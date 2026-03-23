/**
 * TerminalStateCoordinator
 *
 * Terminal state management methods extracted from LightweightTerminalWebviewManager.
 * Handles state updates, UI synchronization, debug display, and system status queries.
 */

import { webview as log } from '../../utils/logger';
import { TerminalState } from '../../types/shared';

/**
 * System status snapshot returned by getSystemStatus()
 */
export interface SystemStatusSnapshot {
  ready: boolean;
  state: TerminalState | null;
  pendingOperations: {
    deletions: string[];
    creations: number;
  };
}

/**
 * Dependencies required by TerminalStateCoordinator
 */
export interface ITerminalStateCoordinatorDependencies {
  // State cache
  getCurrentTerminalState(): TerminalState | null;
  setCurrentTerminalState(state: TerminalState): void;
  getHasProcessedInitialState(): boolean;
  setHasProcessedInitialState(value: boolean): void;

  // TerminalOperationsCoordinator delegation
  terminalOperationsUpdateState(state: TerminalState): void;
  hasPendingCreations(): boolean;
  getPendingCreationsCount(): number;
  processPendingCreationRequests(): void;
  hasPendingDeletions(): boolean;
  getPendingDeletions(): string[];

  // TerminalStateDisplayManager delegation
  updateFromState(state: TerminalState): void;
  updateCreationState(state: TerminalState): void;

  // DebugCoordinator delegation
  debugUpdateDisplay(state: TerminalState, source: string): void;
  debugShowTerminalLimitMessage(current: number, max: number): void;

  // Layout delegation
  ensureSplitResizersOnInitialDisplay(state: TerminalState, isInitialStateSync: boolean): void;

  // Messaging
  postMessageToExtension(message: unknown): void;
}

export class TerminalStateCoordinator {
  constructor(private readonly deps: ITerminalStateCoordinatorDependencies) {}

  /**
   * Process incoming state update from Extension
   */
  public updateState(state: unknown): void {
    try {
      // Type-safe state validation
      if (!state || typeof state !== 'object') {
        log('\u26a0\ufe0f [STATE] Invalid state received:', state);
        return;
      }

      // Type-safe state validation and casting
      const stateObj = state as Record<string, unknown>;
      if (
        !Array.isArray(stateObj.terminals) ||
        !Array.isArray(stateObj.availableSlots) ||
        typeof stateObj.maxTerminals !== 'number'
      ) {
        log('\u26a0\ufe0f [STATE] Invalid state structure:', stateObj);
        return;
      }

      const terminalState = state as TerminalState;
      const isInitialStateSync = !this.deps.getHasProcessedInitialState();

      log('\ud83d\udd04 [STATE] Processing state update:', {
        terminals: terminalState.terminals.length,
        availableSlots: terminalState.availableSlots,
        maxTerminals: terminalState.maxTerminals,
        activeTerminalId: terminalState.activeTerminalId,
      });

      // Handle deletion synchronization FIRST (delegated to coordinator)
      this.deps.terminalOperationsUpdateState(terminalState);

      // 1. Update internal state cache
      this.deps.setCurrentTerminalState({
        terminals: terminalState.terminals,
        activeTerminalId: terminalState.activeTerminalId,
        maxTerminals: terminalState.maxTerminals,
        availableSlots: terminalState.availableSlots,
      });

      const currentState = this.deps.getCurrentTerminalState()!;

      // 2. Update UI state immediately
      this.updateUIFromState(currentState);

      // 2.5. Ensure split resizers appear on initial split display
      this.deps.ensureSplitResizersOnInitialDisplay(terminalState, isInitialStateSync);

      // 3. Update terminal creation availability
      this.updateTerminalCreationState();

      // 4. Debug visualization (if enabled)
      this.updateDebugDisplay(currentState);

      // 5. Process any pending creation requests (delegated to coordinator)
      if (this.deps.hasPendingCreations()) {
        log(
          `\ud83d\udd04 [QUEUE] State updated, processing ${this.deps.getPendingCreationsCount()} pending requests`
        );
        setTimeout(() => this.deps.processPendingCreationRequests(), 50);
      }

      this.deps.setHasProcessedInitialState(true);
      log('\u2705 [STATE] State update completed successfully');
    } catch (error) {
      log('\u274c [STATE] Error processing state update:', error);
    }
  }

  /**
   * Update UI elements based on current terminal state
   * Delegates to TerminalStateDisplayManager
   */
  public updateUIFromState(state: TerminalState): void {
    this.deps.updateFromState(state);
  }

  /**
   * Update terminal creation button state and messaging
   * Delegates to TerminalStateDisplayManager
   */
  public updateTerminalCreationState(): void {
    const currentState = this.deps.getCurrentTerminalState();
    if (!currentState) {
      return;
    }
    this.deps.updateCreationState(currentState);
  }

  /**
   * Update debug display with current state information
   * Delegates to DebugCoordinator
   */
  public updateDebugDisplay(state: TerminalState): void {
    this.deps.debugUpdateDisplay(state, 'state-update');
  }

  /**
   * Show terminal limit reached message
   * Delegates to DebugCoordinator
   */
  public showTerminalLimitMessage(current: number, max: number): void {
    const currentState = this.deps.getCurrentTerminalState();
    if (currentState) {
      this.deps.updateCreationState(currentState);
    } else {
      this.deps.debugShowTerminalLimitMessage(current, max);
    }
  }

  /**
   * Request latest state from Extension
   */
  public requestLatestState(): void {
    log('\ud83d\udce1 [STATE] Requesting latest state from Extension...');

    this.deps.postMessageToExtension({
      command: 'requestState',
      timestamp: Date.now(),
    });
  }

  /**
   * Get current cached state
   */
  public getCurrentCachedState(): TerminalState | null {
    return this.deps.getCurrentTerminalState();
  }

  /**
   * Check if the system is in a safe state for operations
   */
  public isSystemReady(): boolean {
    const hasCachedState = !!this.deps.getCurrentTerminalState();
    const noPendingDeletions = !this.deps.hasPendingDeletions();
    const noPendingCreations = !this.deps.hasPendingCreations();
    return hasCachedState && noPendingDeletions && noPendingCreations;
  }

  /**
   * Get system status for external monitoring
   */
  public getSystemStatus(): SystemStatusSnapshot {
    return {
      ready: this.isSystemReady(),
      state: this.deps.getCurrentTerminalState(),
      pendingOperations: {
        deletions: this.deps.getPendingDeletions(),
        creations: this.deps.getPendingCreationsCount(),
      },
    };
  }
}
