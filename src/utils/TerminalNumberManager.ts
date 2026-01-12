import { TerminalInstance } from '../types/common';

/** Manages terminal number allocation and recycling. */
export class TerminalNumberManager {
  constructor(private readonly maxTerminals: number) {}

  /** Gets the set of currently used terminal numbers. */
  private getUsedNumbers(terminals: Map<string, TerminalInstance>): Set<number> {
    const usedNumbers = new Set<number>();

    for (const terminal of terminals.values()) {
      if (terminal.number && typeof terminal.number === 'number') {
        usedNumbers.add(terminal.number);
      } else {
        // Fallback: extract from terminal name for backward compatibility
        const match = terminal.name.match(/Terminal (\d+)/);
        if (match?.[1]) {
          usedNumbers.add(parseInt(match[1], 10));
        }
      }
    }

    return usedNumbers;
  }

  /** Finds the lowest available terminal number. */
  findAvailableNumber(terminals: Map<string, TerminalInstance>): number {
    const usedNumbers = this.getUsedNumbers(terminals);
    for (let i = 1; i <= this.maxTerminals; i++) {
      if (!usedNumbers.has(i)) return i;
    }
    return this.maxTerminals;
  }

  /** Checks if a new terminal can be created. */
  canCreate(terminals: Map<string, TerminalInstance>): boolean {
    const usedNumbers = this.getUsedNumbers(terminals);
    for (let i = 1; i <= this.maxTerminals; i++) {
      if (!usedNumbers.has(i)) return true;
    }
    return false;
  }

  /** Gets all available slot numbers. */
  getAvailableSlots(terminals: Map<string, TerminalInstance>): number[] {
    const usedNumbers = this.getUsedNumbers(terminals);
    const slots: number[] = [];
    for (let i = 1; i <= this.maxTerminals; i++) {
      if (!usedNumbers.has(i)) slots.push(i);
    }
    return slots;
  }

  /** Allocates a specific number or finds an available one. */
  allocateNumber(preferredNumber: number, terminals: Map<string, TerminalInstance>): number {
    const usedNumbers = this.getUsedNumbers(terminals);

    if (preferredNumber >= 1 && preferredNumber <= this.maxTerminals && !usedNumbers.has(preferredNumber)) {
      return preferredNumber;
    }

    return this.findAvailableNumber(terminals);
  }
}
