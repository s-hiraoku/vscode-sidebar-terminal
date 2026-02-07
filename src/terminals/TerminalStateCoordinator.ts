/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as vscode from 'vscode';
import { TerminalInstance, TerminalState, TerminalInfo } from '../types/shared';
import { getTerminalConfig, ActiveTerminalManager, getFirstValue } from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';

/** Manages terminal state and synchronization */
export class TerminalStateCoordinator {
  constructor(
    private readonly _terminals: Map<string, TerminalInstance>,
    private readonly _activeTerminalManager: ActiveTerminalManager,
    private readonly _stateUpdateEmitter: vscode.EventEmitter<TerminalState>,
    private readonly _terminalFocusEmitter: vscode.EventEmitter<string>,
    private readonly _terminalNumberManager: TerminalNumberManager
  ) {}

  public getCurrentState(): TerminalState {
    const terminals: TerminalInfo[] = Array.from(this._terminals.values()).map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      isActive: terminal.isActive,
      ...(terminal.indicatorColor ? { indicatorColor: terminal.indicatorColor } : {}),
    }));

    return {
      terminals,
      activeTerminalId: this._activeTerminalManager.getActive() || null,
      maxTerminals: getTerminalConfig().maxTerminals,
      availableSlots: this.getAvailableSlots(),
    };
  }

  public getAvailableSlots(): number[] {
    return this._terminalNumberManager.getAvailableSlots(this._terminals);
  }

  public notifyStateUpdate(): void {
    this._stateUpdateEmitter.fire(this.getCurrentState());
  }

  public hasActiveTerminal(): boolean {
    return this._activeTerminalManager.hasActive();
  }

  public getActiveTerminalId(): string | undefined {
    return this._activeTerminalManager.getActive();
  }

  public setActiveTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      this.deactivateAllTerminals();
      terminal.isActive = true;
      this._activeTerminalManager.setActive(terminalId);
    }
  }

  /** Focus a terminal without changing CLI Agent status */
  public focusTerminal(terminalId: string): void {
    if (this._terminals.has(terminalId)) {
      this._terminalFocusEmitter.fire(terminalId);
    }
  }

  public deactivateAllTerminals(): void {
    for (const term of this._terminals.values()) {
      term.isActive = false;
    }
  }

  public updateActiveTerminalAfterRemoval(terminalId: string): void {
    if (this._activeTerminalManager.isActive(terminalId)) {
      const remaining = getFirstValue(this._terminals);
      if (remaining) {
        this._activeTerminalManager.setActive(remaining.id);
        remaining.isActive = true;
      } else {
        this._activeTerminalManager.clearActive();
      }
    }
  }

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

  public updateTerminalCwd(terminalId: string, cwd: string): void {
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      terminal.cwd = cwd;
    }
  }

  public renameTerminal(terminalId: string, newName: string): boolean {
    return this.updateTerminalHeader(terminalId, { newName });
  }

  public updateTerminalHeader(
    terminalId: string,
    updates: { newName?: string; indicatorColor?: string }
  ): boolean {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return false;
    }

    const hasName = typeof updates.newName === 'string' && updates.newName.trim().length > 0;
    const normalizedIndicatorColor =
      typeof updates.indicatorColor === 'string'
        ? (() => {
            const value = updates.indicatorColor.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
              return value.toUpperCase();
            }
            if (value.toLowerCase() === 'transparent') {
              return 'transparent';
            }
            return undefined;
          })()
        : undefined;
    const hasColor = typeof normalizedIndicatorColor === 'string';

    if (!hasName && !hasColor) {
      return false;
    }

    let changed = false;

    if (hasName) {
      const trimmedName = updates.newName!.trim();
      if (terminal.name !== trimmedName) {
        terminal.name = trimmedName;
        changed = true;
      }
    }

    if (hasColor) {
      if (terminal.indicatorColor !== normalizedIndicatorColor) {
        terminal.indicatorColor = normalizedIndicatorColor;
        changed = true;
      }
    }

    if (changed) {
      this.notifyStateUpdate();
    }

    return true;
  }
}
