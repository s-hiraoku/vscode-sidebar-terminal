/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as vscode from 'vscode';
import { TerminalInstance, TerminalState, TerminalInfo } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { getTerminalConfig, ActiveTerminalManager, getFirstValue } from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';

/**
 * TerminalStateCoordinator
 *
 * Responsibility: Manage terminal state and synchronization
 * - Track active terminal state
 * - Manage state update notifications
 * - Calculate available slots
 * - Handle terminal activation/deactivation
 *
 * Single Responsibility Principle: Focused on state management only
 */
export class TerminalStateCoordinator {
  constructor(
    private readonly _terminals: Map<string, TerminalInstance>,
    private readonly _activeTerminalManager: ActiveTerminalManager,
    private readonly _stateUpdateEmitter: vscode.EventEmitter<TerminalState>,
    private readonly _terminalFocusEmitter: vscode.EventEmitter<string>,
    private readonly _terminalNumberManager: TerminalNumberManager
  ) {}

  /**
   * Get current terminal state
   */
  public getCurrentState(): TerminalState {
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
   * Get available terminal slots
   */
  public getAvailableSlots(): number[] {
    return this._terminalNumberManager.getAvailableSlots(this._terminals);
  }

  /**
   * Notify WebView of state update
   */
  public notifyStateUpdate(): void {
    const state = this.getCurrentState();
    this._stateUpdateEmitter.fire(state);
    log(`📡 [STATE] State update notification sent:`, state);
  }

  /**
   * Check if there is an active terminal
   */
  public hasActiveTerminal(): boolean {
    return this._activeTerminalManager.hasActive();
  }

  /**
   * Get active terminal ID
   */
  public getActiveTerminalId(): string | undefined {
    return this._activeTerminalManager.getActive();
  }

  /**
   * Set active terminal
   */
  public setActiveTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      this.deactivateAllTerminals();
      terminal.isActive = true;
      this._activeTerminalManager.setActive(terminalId);
    }
  }

  /**
   * Focus a terminal (fires focus event without changing CLI Agent status)
   * 🚨 IMPORTANT: Focus should NOT change CLI Agent status (spec compliance)
   */
  public focusTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log('⚠️ [WARN] Terminal not found for focus:', terminalId);
      return;
    }

    // 🚨 CRITICAL: フォーカス変更はCLI Agent状態に影響しない（仕様書準拠）
    // Only fire focus event, do not change CLI Agent status
    this._terminalFocusEmitter.fire(terminalId);
    log(`🎯 [TERMINAL] Focused: ${terminal.name} (NO status change - spec compliant)`);
  }

  /**
   * Deactivate all terminals
   */
  public deactivateAllTerminals(): void {
    for (const term of this._terminals.values()) {
      term.isActive = false;
    }
  }

  /**
   * Update active terminal after removal
   */
  public updateActiveTerminalAfterRemoval(terminalId: string): void {
    if (this._activeTerminalManager.isActive(terminalId)) {
      const remaining = getFirstValue(this._terminals);
      if (remaining) {
        this._activeTerminalManager.setActive(remaining.id);
        remaining.isActive = true;
        log('🔄 [TERMINAL] Set new active terminal:', remaining.id);
      } else {
        this._activeTerminalManager.clearActive();
        log('🔄 [TERMINAL] No remaining terminals, cleared active');
      }
    }
  }

  /**
   * Reorder terminals according to the provided order
   */
  public reorderTerminals(order: string[]): void {
    if (!Array.isArray(order) || order.length === 0) {
      return;
    }

    const existingEntries = Array.from(this._terminals.entries());
    const existingMap = new Map(existingEntries);

    const normalizedOrder = order.filter((id) => existingMap.has(id));
    const remaining = existingEntries
      .map(([id]) => id)
      .filter((id) => !normalizedOrder.includes(id));
    const finalOrder = [...normalizedOrder, ...remaining];

    if (finalOrder.length === 0) {
      return;
    }

    this._terminals.clear();

    for (const id of finalOrder) {
      const terminal = existingMap.get(id);
      if (terminal) {
        this._terminals.set(id, terminal);
      }
    }

    this.notifyStateUpdate();
  }

  /**
   * Update terminal CWD
   */
  public updateTerminalCwd(terminalId: string, cwd: string): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return;
    }

    terminal.cwd = cwd;
  }
}
