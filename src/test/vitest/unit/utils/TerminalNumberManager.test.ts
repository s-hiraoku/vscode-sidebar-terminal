import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalNumberManager } from '../../../../utils/TerminalNumberManager';
import { TerminalInstance } from '../../../../types/common';

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  log: vi.fn(),
}));

describe('TerminalNumberManager', () => {
  let manager: TerminalNumberManager;
  let terminals: Map<string, TerminalInstance>;

  beforeEach(() => {
    manager = new TerminalNumberManager(5);
    terminals = new Map();
  });

  describe('findAvailableNumber', () => {
    it('should find first available number', () => {
      // No terminals
      expect(manager.findAvailableNumber(terminals)).toBe(1);

      // Terminal with number 1 exists
      terminals.set('t1', { id: 't1', name: 'Terminal 1', number: 1 } as any);
      expect(manager.findAvailableNumber(terminals)).toBe(2);

      // Terminals with numbers 1 and 3 exist
      terminals.set('t3', { id: 't3', name: 'Terminal 3', number: 3 } as any);
      expect(manager.findAvailableNumber(terminals)).toBe(2);
    });

    it('should return maxTerminals if all slots full', () => {
      for (let i = 1; i <= 5; i++) {
        terminals.set(`t${i}`, { id: `t${i}`, name: `Terminal ${i}`, number: i } as any);
      }
      expect(manager.findAvailableNumber(terminals)).toBe(5);
    });

    it('should parse number from name if property missing', () => {
      terminals.set('t1', { id: 't1', name: 'Terminal 1' } as any); // number missing
      expect(manager.findAvailableNumber(terminals)).toBe(2);
    });
  });

  describe('canCreate', () => {
    it('should return true if slots available', () => {
      expect(manager.canCreate(terminals)).toBe(true);
    });

    it('should return false if all slots full', () => {
      for (let i = 1; i <= 5; i++) {
        terminals.set(`t${i}`, { id: `t${i}`, name: `Terminal ${i}`, number: i } as any);
      }
      expect(manager.canCreate(terminals)).toBe(false);
    });
  });

  describe('getAvailableSlots', () => {
    it('should return all slots if empty', () => {
      expect(manager.getAvailableSlots(terminals)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return remaining slots', () => {
      terminals.set('t1', { id: 't1', name: 'Terminal 1', number: 1 } as any);
      terminals.set('t3', { id: 't3', name: 'Terminal 3', number: 3 } as any);
      expect(manager.getAvailableSlots(terminals)).toEqual([2, 4, 5]);
    });
  });

  describe('allocateNumber', () => {
    it('should allocate preferred number if available', () => {
      expect(manager.allocateNumber(3, terminals)).toBe(3);
    });

    it('should fallback to first available if preferred is taken', () => {
      terminals.set('t3', { id: 't3', name: 'Terminal 3', number: 3 } as any);
      expect(manager.allocateNumber(3, terminals)).toBe(1);
    });

    it('should fallback if preferred is invalid', () => {
      expect(manager.allocateNumber(0, terminals)).toBe(1);
      expect(manager.allocateNumber(6, terminals)).toBe(1);
    });
  });
});
