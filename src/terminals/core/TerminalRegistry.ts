import { TerminalInstance } from '../../types/shared';
import { ActiveTerminalManager } from '../../utils/common';
import { TerminalNumberManager } from '../../utils/TerminalNumberManager';

export class TerminalRegistry {
  constructor(
    private readonly terminals: Map<string, TerminalInstance>,
    private readonly activeManager: ActiveTerminalManager,
    private readonly numberManager: TerminalNumberManager
  ) {}

  public getAll(): TerminalInstance[] {
    return Array.from(this.terminals.values());
  }

  public getById(terminalId: string): TerminalInstance | undefined {
    return this.terminals.get(terminalId);
  }

  public has(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  public set(terminal: TerminalInstance): void {
    this.terminals.set(terminal.id, terminal);
  }

  public delete(terminalId: string): boolean {
    return this.terminals.delete(terminalId);
  }

  public clear(): void {
    this.terminals.clear();
    this.activeManager.clearActive();
  }

  public size(): number {
    return this.terminals.size;
  }

  public entries(): IterableIterator<[string, TerminalInstance]> {
    return this.terminals.entries();
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

  public setActiveTerminal(terminalId: string): void {
    this.activeManager.setActive(terminalId);
  }

  public getActiveTerminalId(): string | undefined {
    return this.activeManager.getActive();
  }

  public hasActiveTerminal(): boolean {
    return this.activeManager.hasActive();
  }

  public deactivateAll(): void {
    for (const terminal of this.terminals.values()) {
      terminal.isActive = false;
    }
    this.activeManager.clearActive();
  }

  public isActive(terminalId: string): boolean {
    return this.activeManager.isActive(terminalId);
  }

  public clearActive(): void {
    this.activeManager.clearActive();
  }

  public getTerminalNumber(terminalId: string): number | undefined {
    const terminal = this.terminals.get(terminalId);
    return terminal?.number;
  }
}
