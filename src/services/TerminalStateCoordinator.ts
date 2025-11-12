/**
 * Terminal State Coordinator Service
 *
 * Responsible for terminal state management:
 * - State tracking and synchronization
 * - Event emission and notification
 * - Active terminal management
 * - State consistency
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213
 */

import * as vscode from 'vscode';
import { ITerminalStateCoordinator } from '../interfaces/TerminalServices';
import { TerminalInstance, TerminalState, TerminalInfo, ProcessState } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { getTerminalConfig, ActiveTerminalManager, getFirstValue } from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';

/**
 * Terminal State Coordinator Implementation
 */
export class TerminalStateCoordinator implements ITerminalStateCoordinator {
  // Terminal registry
  private readonly _terminals = new Map<string, TerminalInstance>();

  // Active terminal manager
  private readonly _activeTerminalManager = new ActiveTerminalManager();

  // Terminal number manager
  private readonly _terminalNumberManager: TerminalNumberManager;

  // Event emitters
  private readonly _stateUpdateEmitter = new vscode.EventEmitter<TerminalState>();
  private readonly _dataEmitter = new vscode.EventEmitter<{
    terminalId: string;
    data: string;
  }>();
  private readonly _exitEmitter = new vscode.EventEmitter<{
    terminalId: string;
    exitCode?: number;
  }>();

  // Disposables
  private readonly _disposables: vscode.Disposable[] = [];

  constructor() {
    const config = getTerminalConfig();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);

    // Register disposables
    this._disposables.push(this._stateUpdateEmitter, this._dataEmitter, this._exitEmitter);

    log('🚀 [STATE-COORD] Terminal State Coordinator initialized');
  }

  // =================== Event Getters ===================

  public get onStateUpdate(): vscode.Event<TerminalState> {
    return this._stateUpdateEmitter.event;
  }

  public get onData(): vscode.Event<{ terminalId: string; data: string }> {
    return this._dataEmitter.event;
  }

  public get onExit(): vscode.Event<{ terminalId: string; exitCode?: number }> {
    return this._exitEmitter.event;
  }

  // =================== State Management ===================

  /**
   * Get current terminal state
   */
  getCurrentState(): TerminalState {
    const terminals: TerminalInfo[] = Array.from(this._terminals.values()).map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      isActive: terminal.isActive,
    }));

    return {
      terminals,
      activeTerminalId: this._activeTerminalManager.getActive() || null,
      maxTerminals: getTerminalConfig().maxTerminals,
      availableSlots: this.getAvailableSlots(),
    };
  }

  /**
   * Update terminal state and notify listeners
   */
  notifyStateUpdate(): void {
    const state = this.getCurrentState();
    this._stateUpdateEmitter.fire(state);
    log(`📡 [STATE-COORD] State update notification sent:`, state);
  }

  /**
   * Notify process state change
   */
  notifyProcessStateChange(
    terminal: TerminalInstance,
    newState: ProcessState,
    previousState?: ProcessState
  ): void {
    log(
      `🔄 [STATE-COORD] Terminal ${terminal.id} process state change:`,
      `${previousState !== undefined ? ProcessState[previousState] : 'undefined'} → ${ProcessState[newState]}`
    );

    // Update terminal's process state
    terminal.processState = newState;

    // Fire process state change event
    this._stateUpdateEmitter.fire({
      type: 'processStateChange',
      terminalId: terminal.id,
      previousState,
      newState,
      timestamp: Date.now(),
    } as any);

    // Handle state-specific actions
    this.handleProcessStateActions(terminal, newState, previousState);
  }

  /**
   * Get available terminal slots
   */
  getAvailableSlots(): number[] {
    return this._terminalNumberManager.getAvailableSlots(this._terminals);
  }

  // =================== Active Terminal Management ===================

  /**
   * Check if terminal is active
   */
  isTerminalActive(terminalId: string): boolean {
    return this._activeTerminalManager.isActive(terminalId);
  }

  /**
   * Set terminal active state
   */
  setTerminalActive(terminalId: string, isActive: boolean): void {
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      terminal.isActive = isActive;
      if (isActive) {
        this._activeTerminalManager.setActive(terminalId);
      }
      log(`🎯 [STATE-COORD] Terminal ${terminalId} active state: ${isActive}`);
    }
  }

  /**
   * Deactivate all terminals
   */
  deactivateAllTerminals(): void {
    for (const terminal of this._terminals.values()) {
      terminal.isActive = false;
    }
    log('📴 [STATE-COORD] All terminals deactivated');
  }

  /**
   * Update active terminal after removal
   */
  updateActiveTerminalAfterRemoval(terminalId: string): void {
    if (this._activeTerminalManager.isActive(terminalId)) {
      const remaining = getFirstValue(this._terminals);
      if (remaining) {
        this._activeTerminalManager.setActive(remaining.id);
        remaining.isActive = true;
        log(`🔄 [STATE-COORD] Set new active terminal: ${remaining.id}`);
      } else {
        this._activeTerminalManager.clearActive();
        log('🔄 [STATE-COORD] No remaining terminals, cleared active');
      }
    }
  }

  // =================== Event Emission ===================

  /**
   * Fire data event
   */
  fireDataEvent(terminalId: string, data: string): void {
    this._dataEmitter.fire({ terminalId, data });
  }

  /**
   * Fire exit event
   */
  fireExitEvent(terminalId: string, exitCode?: number): void {
    this._exitEmitter.fire({ terminalId, exitCode });
  }

  // =================== Terminal Registry (Internal) ===================

  /**
   * Register a terminal (internal use by TerminalManager)
   */
  registerTerminal(terminal: TerminalInstance): void {
    this._terminals.set(terminal.id, terminal);
    log(`📝 [STATE-COORD] Terminal registered: ${terminal.id}`);
  }

  /**
   * Unregister a terminal (internal use by TerminalManager)
   */
  unregisterTerminal(terminalId: string): void {
    this._terminals.delete(terminalId);
    log(`🗑️ [STATE-COORD] Terminal unregistered: ${terminalId}`);
  }

  /**
   * Get terminal by ID (internal use)
   */
  getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._terminals.get(terminalId);
  }

  /**
   * Get all terminals (internal use)
   */
  getAllTerminals(): TerminalInstance[] {
    return Array.from(this._terminals.values());
  }

  /**
   * Get terminals map (internal use)
   */
  getTerminalsMap(): Map<string, TerminalInstance> {
    return this._terminals;
  }

  // =================== Process State Actions ===================

  /**
   * Handle actions based on process state changes
   */
  private handleProcessStateActions(
    terminal: TerminalInstance,
    newState: ProcessState,
    previousState?: ProcessState
  ): void {
    switch (newState) {
      case ProcessState.Launching:
        log(`🚀 [STATE-COORD] Terminal ${terminal.id} is launching`);
        break;

      case ProcessState.Running:
        log(`✅ [STATE-COORD] Terminal ${terminal.id} is now running`);
        break;

      case ProcessState.KilledDuringLaunch:
        log(
          `⚠️ [STATE-COORD] Terminal ${terminal.id} killed during launch - potential configuration issue`
        );
        break;

      case ProcessState.KilledByUser:
        log(`ℹ️ [STATE-COORD] Terminal ${terminal.id} killed by user request`);
        break;

      case ProcessState.KilledByProcess:
        log(`⚠️ [STATE-COORD] Terminal ${terminal.id} process terminated unexpectedly`);
        break;
    }
  }

  // =================== Disposal ===================

  /**
   * Dispose service
   */
  dispose(): void {
    log('🗑️ [STATE-COORD] Disposing Terminal State Coordinator...');

    // Clear terminals
    this._terminals.clear();

    // Dispose event emitters
    this._disposables.forEach((d) => d.dispose());
    this._disposables.length = 0;

    log('✅ [STATE-COORD] Terminal State Coordinator disposed');
  }
}
