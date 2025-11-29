import { TerminalInstance } from '../../types/shared';
import { ActiveTerminalManager } from '../../utils/common';
import { TerminalNumberManager } from '../../utils/TerminalNumberManager';

interface RegisterOptions {
  setActive?: boolean;
}

/**
 * Central store/orchestrator for managing TerminalInstance lifecycle metadata.
 * Encapsulates terminal bookkeeping (map management, active tracking, number allocation)
 * so higher-level managers can focus on orchestration and side-effects.
 */
export class TerminalOrchestrator {
  private readonly terminals = new Map<string, TerminalInstance>();
  private readonly activeManager = new ActiveTerminalManager();
  private maxTerminals: number;
  private numberManager: TerminalNumberManager;

  constructor(maxTerminals: number) {
    this.maxTerminals = maxTerminals;
    this.numberManager = new TerminalNumberManager(maxTerminals);
  }

  public updateMaxTerminals(maxTerminals: number): void {
    if (maxTerminals !== this.maxTerminals) {
      this.maxTerminals = maxTerminals;
      this.numberManager = new TerminalNumberManager(maxTerminals);
    }
  }

  public registerTerminal(terminal: TerminalInstance, options?: RegisterOptions): void {
    this.terminals.set(terminal.id, terminal);

    if (options?.setActive) {
      this.setActiveTerminal(terminal.id);
    }
  }

  public hasTerminal(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this.terminals.get(terminalId);
  }

  public getTerminals(): TerminalInstance[] {
    return Array.from(this.terminals.values());
  }

  public getTerminalIds(): string[] {
    return Array.from(this.terminals.keys());
  }

  public entries(): IterableIterator<[string, TerminalInstance]> {
    return this.terminals.entries();
  }

  public values(): IterableIterator<TerminalInstance> {
    return this.terminals.values();
  }

  public size(): number {
    return this.terminals.size;
  }

  public removeTerminal(terminalId: string): TerminalInstance | undefined {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return undefined;
    }

    this.terminals.delete(terminalId);

    if (this.activeManager.isActive(terminalId)) {
      this.clearActiveTerminal();
    }

    return terminal;
  }

  public clearTerminals(): void {
    this.terminals.clear();
    this.clearActiveTerminal();
  }

  public canCreate(): boolean {
    return this.numberManager.canCreate(this.terminals);
  }

  public findAvailableNumber(): number {
    return this.numberManager.findAvailableNumber(this.terminals);
  }

  public getAvailableSlots(): number[] {
    return this.numberManager.getAvailableSlots(this.terminals);
  }

  public getTerminalNumber(terminalId: string): number | undefined {
    return this.terminals.get(terminalId)?.number;
  }

  public findByTerminalNumber(terminalNumber: number): TerminalInstance | undefined {
    for (const terminal of this.terminals.values()) {
      if (terminal.number === terminalNumber) {
        return terminal;
      }
    }
    return undefined;
  }

  public setActiveTerminal(terminalId: string): void {
    for (const [id, terminal] of this.terminals.entries()) {
      terminal.isActive = id === terminalId;
    }

    this.activeManager.setActive(terminalId);
  }

  public deactivateAllTerminals(): void {
    for (const terminal of this.terminals.values()) {
      terminal.isActive = false;
    }
    this.activeManager.clearActive();
  }

  public getActiveTerminalId(): string | undefined {
    return this.activeManager.getActive();
  }

  public hasActiveTerminal(): boolean {
    return this.activeManager.hasActive();
  }

  public isActive(terminalId: string): boolean {
    return this.activeManager.isActive(terminalId);
  }

  public clearActiveTerminal(): void {
    this.activeManager.clearActive();
  }

  public getFirstTerminal(): TerminalInstance | undefined {
    const iterator = this.terminals.values();
    const result = iterator.next();
    return result.done ? undefined : result.value;
  }
}
