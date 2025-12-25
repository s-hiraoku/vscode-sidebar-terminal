// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalStateManagementService } from '../../../../../services/terminal/TerminalStateManagementService';
import { TerminalInstance } from '../../../../../types/shared';

describe('TerminalStateManagementService', () => {
  let service: TerminalStateManagementService;

  beforeEach(() => {
    service = new TerminalStateManagementService();
  });

  afterEach(() => {
    service.dispose();
    vi.restoreAllMocks();
  });

  // Helper function to create mock terminal
  const createMockTerminal = (
    id: string = 'test1',
    name: string = 'Terminal 1'
  ): TerminalInstance => ({
    id,
    name,
    number: 1,
    process: { pid: 1234, killed: false } as any,
    isActive: false,
    createdAt: new Date(),
    pid: 1234,
    cwd: '/test',
    shell: '/bin/bash',
    shellArgs: [],
  });

  describe('Constructor', () => {
    it('should initialize successfully', () => {
      expect(service.getTerminalCount()).toBe(0);
      expect(service.hasActiveTerminal()).toBe(false);
    });
  });

  describe('addTerminal', () => {
    it('should add terminal to state', async () => {
      const terminal = createMockTerminal();

      await new Promise<void>((resolve) => {
        service.onTerminalAdded((addedTerminal) => {
          expect(addedTerminal.id).toBe(terminal.id);
          resolve();
        });

        service.addTerminal(terminal);

        expect(service.getTerminalCount()).toBe(1);
        expect(service.hasTerminal(terminal.id)).toBe(true);
        expect(service.getTerminal(terminal.id)).toEqual(terminal);
      });
    });

    it('should emit state update event on add', async () => {
      const terminal = createMockTerminal();

      await new Promise<void>((resolve) => {
        service.onStateUpdate((state) => {
          expect(state.terminals.length).toBe(1);
          expect(state.terminals[0]?.id).toBe(terminal.id);
          resolve();
        });

        service.addTerminal(terminal);
      });
    });

    it('should handle add terminal errors gracefully', () => {
      const terminal = createMockTerminal();

      // Mock event emitter to throw error
      const _originalFire = service.onTerminalAdded;
      (service as any)._terminalAddedEmitter.fire = () => {
        throw new Error('Test error');
      };

      try {
        service.addTerminal(terminal);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('removeTerminal', () => {
    it('should remove terminal from state', async () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      await new Promise<void>((resolve) => {
        service.onTerminalRemoved((removedId) => {
          expect(removedId).toBe(terminal.id);
          resolve();
        });

        service.removeTerminal(terminal.id);

        expect(service.getTerminalCount()).toBe(0);
        expect(service.hasTerminal(terminal.id)).toBe(false);
        expect(service.getTerminal(terminal.id)).toBeUndefined();
      });
    });

    it('should handle removal of non-existent terminal', () => {
      // Should not throw error
      service.removeTerminal('non-existent');
    });

    it('should clear active terminal when removing active terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);
      service.setActiveTerminal(terminal.id);

      expect(service.getActiveTerminalId()).toBe(terminal.id);

      service.removeTerminal(terminal.id);

      expect(service.hasActiveTerminal()).toBe(false);
      expect(service.getActiveTerminalId()).toBeUndefined();
    });

    it('should emit state update event on remove', async () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      let eventCount = 0;
      await new Promise<void>((resolve) => {
        service.onStateUpdate(() => {
          eventCount++;
          if (eventCount === 2) {
            // Second event is for removal
            expect(service.getTerminalCount()).toBe(0);
            resolve();
          }
        });

        service.removeTerminal(terminal.id);
      });
    });
  });

  describe('getTerminal', () => {
    it('should return existing terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      const retrieved = service.getTerminal(terminal.id);
      expect(retrieved).toEqual(terminal);
    });

    it('should return undefined for non-existent terminal', () => {
      const result = service.getTerminal('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getTerminals', () => {
    it('should return all terminals', () => {
      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);

      const terminals = service.getTerminals();
      expect(terminals.length).toBe(2);
      expect(terminals.some((t) => t.id === 'test1')).toBe(true);
      expect(terminals.some((t) => t.id === 'test2')).toBe(true);
    });

    it('should return empty array when no terminals', () => {
      const terminals = service.getTerminals();
      expect(terminals.length).toBe(0);
    });
  });

  describe('getTerminalsMap', () => {
    it('should return read-only map of terminals', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      const map = service.getTerminalsMap();
      expect(map.has(terminal.id)).toBe(true);
      expect(map.get(terminal.id)).toEqual(terminal);
    });
  });

  describe('hasTerminal', () => {
    it('should return true for existing terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      expect(service.hasTerminal(terminal.id)).toBe(true);
    });

    it('should return false for non-existent terminal', () => {
      expect(service.hasTerminal('non-existent')).toBe(false);
    });
  });

  describe('getTerminalCount', () => {
    it('should return correct count', () => {
      expect(service.getTerminalCount()).toBe(0);

      service.addTerminal(createMockTerminal('test1'));
      expect(service.getTerminalCount()).toBe(1);

      service.addTerminal(createMockTerminal('test2'));
      expect(service.getTerminalCount()).toBe(2);

      service.removeTerminal('test1');
      expect(service.getTerminalCount()).toBe(1);
    });
  });

  describe('Active Terminal Management', () => {
    it('should set active terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      const result = service.setActiveTerminal(terminal.id);

      expect(result).toBe(true);
      expect(service.hasActiveTerminal()).toBe(true);
      expect(service.getActiveTerminalId()).toBe(terminal.id);
      expect(service.getActiveTerminal()).toEqual(terminal);
    });

    it('should fail to set non-existent terminal as active', () => {
      const result = service.setActiveTerminal('non-existent');

      expect(result).toBe(false);
      expect(service.hasActiveTerminal()).toBe(false);
    });

    it('should deactivate previous active terminal when setting new one', () => {
      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);

      service.setActiveTerminal(terminal1.id);
      expect(terminal1.isActive).toBe(true);

      service.setActiveTerminal(terminal2.id);
      expect(terminal1.isActive).toBe(false);
      expect(terminal2.isActive).toBe(true);
    });

    it('should clear active terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);
      service.setActiveTerminal(terminal.id);

      service.clearActiveTerminal();

      expect(service.hasActiveTerminal()).toBe(false);
      expect(service.getActiveTerminalId()).toBeUndefined();
      expect(service.getActiveTerminal()).toBeUndefined();
      expect(terminal.isActive).toBe(false);
    });
  });

  describe('Terminal Number Management', () => {
    it('should get next terminal number', () => {
      const number = service.getNextTerminalNumber();
      expect(number).toBe(1);
    });

    it('should get available slots', () => {
      const slots = service.getAvailableSlots();
      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should release terminal number', () => {
      // Should not throw error
      service.releaseTerminalNumber(1);
    });
  });

  describe('Being Killed Tracking', () => {
    it('should mark and check terminal as being killed', () => {
      const terminalId = 'test1';

      expect(service.isTerminalBeingKilled(terminalId)).toBe(false);

      service.markTerminalAsBeingKilled(terminalId);
      expect(service.isTerminalBeingKilled(terminalId)).toBe(true);

      // Should be cleaned up when terminal is removed
      const terminal = createMockTerminal(terminalId);
      service.addTerminal(terminal);
      service.removeTerminal(terminalId);
      expect(service.isTerminalBeingKilled(terminalId)).toBe(false);
    });
  });

  describe('getCurrentState', () => {
    it('should return current state with no terminals', () => {
      const state = service.getCurrentState();

      expect(state.terminals.length).toBe(0);
      expect(state.activeTerminalId).toBeNull();
      expect(state.maxTerminals).toBeGreaterThan(0);
      expect(Array.isArray(state.availableSlots)).toBe(true);
    });

    it('should return current state with terminals', () => {
      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);
      service.setActiveTerminal(terminal1.id);

      const state = service.getCurrentState();

      expect(state.terminals.length).toBe(2);
      expect(state.activeTerminalId).toBe(terminal1.id);
      expect(state.terminals.some((t) => t.id === 'test1')).toBe(true);
      expect(state.terminals.some((t) => t.id === 'test2')).toBe(true);
    });

    it('should handle errors gracefully', () => {
      // Mock getTerminalsMap to throw error
      (service as any).getTerminalsMap = () => {
        throw new Error('Test error');
      };

      const state = service.getCurrentState();

      // Should return safe fallback state
      expect(state.terminals.length).toBe(0);
      expect(state.activeTerminalId).toBeNull();
    });
  });

  describe('getStateStatistics', () => {
    it('should return accurate statistics', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);
      service.setActiveTerminal(terminal.id);
      service.markTerminalAsBeingKilled('test2');

      const stats = service.getStateStatistics();

      expect(stats.terminalCount).toBe(1);
      expect(stats.activeTerminalId).toBe(terminal.id);
      expect(stats.terminalsBeingKilled).toBe(1);
      expect(Array.isArray(stats.availableSlots)).toBe(true);
      expect(Array.isArray(stats.usedNumbers)).toBe(true);
      expect(stats.maxTerminals).toBeGreaterThan(0);
    });
  });

  describe('selectNextActiveTerminal', () => {
    it('should select first terminal when no active terminal', () => {
      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);

      const selectedId = service.selectNextActiveTerminal();

      expect(selectedId).toBe(terminal1.id);
      expect(service.getActiveTerminalId()).toBe(terminal1.id);
    });

    it('should return null when no terminals available', () => {
      const selectedId = service.selectNextActiveTerminal();

      expect(selectedId).toBeNull();
    });

    it('should handle selection errors gracefully', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      // Mock setActiveTerminal to throw error
      const originalSetActive = service.setActiveTerminal;
      service.setActiveTerminal = () => {
        throw new Error('Test error');
      };

      const selectedId = service.selectNextActiveTerminal();
      expect(selectedId).toBeNull();

      // Restore original method
      service.setActiveTerminal = originalSetActive;
    });
  });

  describe('validateDeletion', () => {
    it('should allow deletion when multiple terminals exist', () => {
      const terminal1 = createMockTerminal('test1');
      const terminal2 = createMockTerminal('test2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);

      const result = service.validateDeletion(terminal1.id);

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should prevent deletion when only one terminal exists', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      const result = service.validateDeletion(terminal.id);

      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe('Must keep at least 1 terminal open');
    });

    it('should prevent deletion of non-existent terminal', () => {
      const result = service.validateDeletion('non-existent');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe('Terminal not found');
    });

    it('should handle validation errors gracefully', () => {
      // Mock hasTerminal to throw error
      (service as any).hasTerminal = () => {
        throw new Error('Test error');
      };

      const result = service.validateDeletion('test');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('Validation failed');
    });
  });

  describe('Event Emission', () => {
    it('should emit terminal added events', async () => {
      const terminal = createMockTerminal();

      await new Promise<void>((resolve) => {
        service.onTerminalAdded((addedTerminal) => {
          expect(addedTerminal).toEqual(terminal);
          resolve();
        });

        service.addTerminal(terminal);
      });
    });

    it('should emit terminal removed events', async () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      await new Promise<void>((resolve) => {
        service.onTerminalRemoved((removedId) => {
          expect(removedId).toBe(terminal.id);
          resolve();
        });

        service.removeTerminal(terminal.id);
      });
    });

    it('should emit state update events', async () => {
      let eventCount = 0;

      await new Promise<void>((resolve) => {
        service.onStateUpdate((state) => {
          eventCount++;
          if (eventCount === 1) {
            expect(state.terminals.length).toBe(1);
          } else if (eventCount === 2) {
            expect(state.terminals.length).toBe(0);
            resolve();
          }
        });

        const terminal = createMockTerminal();
        service.addTerminal(terminal);
        service.removeTerminal(terminal.id);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle state update notification errors', () => {
      const terminal = createMockTerminal();

      // Mock getCurrentState to throw error
      const originalGetCurrentState = service.getCurrentState;
      service.getCurrentState = () => {
        throw new Error('Test error');
      };

      // Should not throw error
      service.addTerminal(terminal);

      // Restore original method
      service.getCurrentState = originalGetCurrentState;
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      const terminal1 = createMockTerminal('test1');
      const terminal2 = createMockTerminal('test2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);
      service.setActiveTerminal(terminal1.id);
      service.markTerminalAsBeingKilled('test3');

      // Should not throw error
      service.dispose();

      // State should be cleaned up
      expect(service.getTerminalCount()).toBe(0);
      expect(service.hasActiveTerminal()).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete terminal lifecycle', async () => {
      let eventCount = 0;
      const expectedEvents = 4; // add + state, remove + state

      await new Promise<void>((resolve) => {
        service.onStateUpdate(() => {
          eventCount++;
          if (eventCount === expectedEvents) {
            resolve();
          }
        });

        const terminal1 = createMockTerminal('test1', 'Terminal 1');
        const terminal2 = createMockTerminal('test2', 'Terminal 2');

        // Add terminals
        service.addTerminal(terminal1);
        service.addTerminal(terminal2);

        // Set active
        service.setActiveTerminal(terminal1.id);
        expect(service.getActiveTerminalId()).toBe(terminal1.id);

        // Remove terminals
        service.removeTerminal(terminal1.id);
        expect(service.hasActiveTerminal()).toBe(false);

        service.removeTerminal(terminal2.id);
        expect(service.getTerminalCount()).toBe(0);
      });
    });

    it('should maintain consistency under rapid operations', () => {
      const terminals: TerminalInstance[] = [];

      // Rapid add/remove operations
      for (let i = 0; i < 10; i++) {
        const terminal = createMockTerminal(`test${i}`, `Terminal ${i}`);
        terminals.push(terminal);
        service.addTerminal(terminal);

        if (i % 2 === 0) {
          service.setActiveTerminal(terminal.id);
        }

        if (i % 3 === 0 && i > 0) {
          service.removeTerminal(terminals[i - 1]?.id || '');
        }
      }

      const state = service.getCurrentState();
      expect(state.terminals.length).toBeGreaterThan(0);

      // Clean up remaining terminals
      for (const terminal of terminals) {
        if (service.hasTerminal(terminal.id)) {
          service.removeTerminal(terminal.id);
        }
      }

      expect(service.getTerminalCount()).toBe(0);
    });
  });
});
