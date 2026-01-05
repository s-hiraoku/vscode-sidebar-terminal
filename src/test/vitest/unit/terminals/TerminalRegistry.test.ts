import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalRegistry } from '../../../../terminals/core/TerminalRegistry';
import { TerminalInstance } from '../../../../types/shared';
import { ActiveTerminalManager } from '../../../../utils/common';
import { TerminalNumberManager } from '../../../../utils/TerminalNumberManager';

describe('TerminalRegistry', () => {
  let registry: TerminalRegistry;
  let terminals: Map<string, TerminalInstance>;
  let activeManager: ActiveTerminalManager;
  let numberManager: TerminalNumberManager;

  const createMockTerminal = (id: string, number: number, isActive = false): TerminalInstance => ({
    id,
    name: `Terminal ${number}`,
    number,
    isActive,
    pid: 1234 + number,
    ptyProcess: {} as TerminalInstance['ptyProcess'],
    processState: 'running',
    interactionState: 'active',
    scrollbackBuffer: [],
    createdAt: Date.now(),
    cwd: '/test',
  });

  beforeEach(() => {
    terminals = new Map();
    activeManager = new ActiveTerminalManager();
    numberManager = new TerminalNumberManager(5);
    registry = new TerminalRegistry(terminals, activeManager, numberManager);
  });

  describe('getAll', () => {
    it('should return empty array when no terminals exist', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all terminals as array', () => {
      const terminal1 = createMockTerminal('term-1', 1);
      const terminal2 = createMockTerminal('term-2', 2);

      registry.set(terminal1);
      registry.set(terminal2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(terminal1);
      expect(all).toContainEqual(terminal2);
    });
  });

  describe('getById', () => {
    it('should return undefined for non-existent terminal', () => {
      expect(registry.getById('non-existent')).toBeUndefined();
    });

    it('should return terminal by id', () => {
      const terminal = createMockTerminal('term-1', 1);
      registry.set(terminal);

      expect(registry.getById('term-1')).toBe(terminal);
    });
  });

  describe('has', () => {
    it('should return false for non-existent terminal', () => {
      expect(registry.has('non-existent')).toBe(false);
    });

    it('should return true for existing terminal', () => {
      registry.set(createMockTerminal('term-1', 1));

      expect(registry.has('term-1')).toBe(true);
    });
  });

  describe('set', () => {
    it('should add terminal to registry', () => {
      const terminal = createMockTerminal('term-1', 1);

      registry.set(terminal);

      expect(registry.has('term-1')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should overwrite existing terminal with same id', () => {
      const terminal1 = createMockTerminal('term-1', 1);
      const terminal2 = createMockTerminal('term-1', 2);

      registry.set(terminal1);
      registry.set(terminal2);

      expect(registry.size()).toBe(1);
      expect(registry.getById('term-1')?.number).toBe(2);
    });
  });

  describe('delete', () => {
    it('should return false when deleting non-existent terminal', () => {
      expect(registry.delete('non-existent')).toBe(false);
    });

    it('should delete terminal and return true', () => {
      registry.set(createMockTerminal('term-1', 1));

      const result = registry.delete('term-1');

      expect(result).toBe(true);
      expect(registry.has('term-1')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all terminals', () => {
      registry.set(createMockTerminal('term-1', 1));
      registry.set(createMockTerminal('term-2', 2));
      registry.setActiveTerminal('term-1');

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.hasActiveTerminal()).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count', () => {
      registry.set(createMockTerminal('term-1', 1));
      registry.set(createMockTerminal('term-2', 2));

      expect(registry.size()).toBe(2);
    });
  });

  describe('entries', () => {
    it('should return iterable of entries', () => {
      const terminal1 = createMockTerminal('term-1', 1);
      const terminal2 = createMockTerminal('term-2', 2);

      registry.set(terminal1);
      registry.set(terminal2);

      const entries = Array.from(registry.entries());

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['term-1', terminal1]);
      expect(entries).toContainEqual(['term-2', terminal2]);
    });
  });

  describe('canCreate', () => {
    it('should return true when under limit', () => {
      expect(registry.canCreate()).toBe(true);
    });

    it('should return false when at limit', () => {
      for (let i = 1; i <= 5; i++) {
        registry.set(createMockTerminal(`term-${i}`, i));
      }

      expect(registry.canCreate()).toBe(false);
    });
  });

  describe('findAvailableNumber', () => {
    it('should return 1 for empty registry', () => {
      expect(registry.findAvailableNumber()).toBe(1);
    });

    it('should return next available number', () => {
      registry.set(createMockTerminal('term-1', 1));
      registry.set(createMockTerminal('term-2', 2));

      expect(registry.findAvailableNumber()).toBe(3);
    });

    it('should fill gaps in numbering', () => {
      registry.set(createMockTerminal('term-1', 1));
      registry.set(createMockTerminal('term-3', 3));

      expect(registry.findAvailableNumber()).toBe(2);
    });
  });

  describe('getAvailableSlots', () => {
    it('should return all slots for empty registry', () => {
      const slots = registry.getAvailableSlots();

      expect(slots).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return remaining slots', () => {
      registry.set(createMockTerminal('term-1', 1));
      registry.set(createMockTerminal('term-3', 3));

      const slots = registry.getAvailableSlots();

      expect(slots).toEqual([2, 4, 5]);
    });
  });

  describe('active terminal management', () => {
    describe('setActiveTerminal', () => {
      it('should set active terminal', () => {
        registry.set(createMockTerminal('term-1', 1));

        registry.setActiveTerminal('term-1');

        expect(registry.isActive('term-1')).toBe(true);
      });
    });

    describe('getActiveTerminalId', () => {
      it('should return undefined when no active terminal', () => {
        expect(registry.getActiveTerminalId()).toBeUndefined();
      });

      it('should return active terminal id', () => {
        registry.set(createMockTerminal('term-1', 1));
        registry.setActiveTerminal('term-1');

        expect(registry.getActiveTerminalId()).toBe('term-1');
      });
    });

    describe('hasActiveTerminal', () => {
      it('should return false when no active terminal', () => {
        expect(registry.hasActiveTerminal()).toBe(false);
      });

      it('should return true when terminal is active', () => {
        registry.set(createMockTerminal('term-1', 1));
        registry.setActiveTerminal('term-1');

        expect(registry.hasActiveTerminal()).toBe(true);
      });
    });

    describe('isActive', () => {
      it('should return false for non-active terminal', () => {
        registry.set(createMockTerminal('term-1', 1));

        expect(registry.isActive('term-1')).toBe(false);
      });

      it('should return true for active terminal', () => {
        registry.set(createMockTerminal('term-1', 1));
        registry.setActiveTerminal('term-1');

        expect(registry.isActive('term-1')).toBe(true);
      });
    });

    describe('clearActive', () => {
      it('should clear active terminal', () => {
        registry.set(createMockTerminal('term-1', 1));
        registry.setActiveTerminal('term-1');

        registry.clearActive();

        expect(registry.hasActiveTerminal()).toBe(false);
      });
    });

    describe('deactivateAll', () => {
      it('should deactivate all terminals', () => {
        const terminal1 = createMockTerminal('term-1', 1, true);
        const terminal2 = createMockTerminal('term-2', 2, true);

        registry.set(terminal1);
        registry.set(terminal2);
        registry.setActiveTerminal('term-1');

        registry.deactivateAll();

        expect(terminal1.isActive).toBe(false);
        expect(terminal2.isActive).toBe(false);
        expect(registry.hasActiveTerminal()).toBe(false);
      });
    });
  });

  describe('getTerminalNumber', () => {
    it('should return undefined for non-existent terminal', () => {
      expect(registry.getTerminalNumber('non-existent')).toBeUndefined();
    });

    it('should return terminal number', () => {
      registry.set(createMockTerminal('term-1', 3));

      expect(registry.getTerminalNumber('term-1')).toBe(3);
    });
  });
});
