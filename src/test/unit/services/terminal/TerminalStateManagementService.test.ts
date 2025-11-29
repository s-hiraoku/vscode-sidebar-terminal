import * as assert from 'assert';
import * as sinon from 'sinon';
import { TerminalStateManagementService } from '../../../../services/terminal/TerminalStateManagementService';
import { TerminalInstance } from '../../../../types/shared';

describe('TerminalStateManagementService', () => {
  let service: TerminalStateManagementService;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new TerminalStateManagementService();
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
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
      assert.strictEqual(service.getTerminalCount(), 0);
      assert.strictEqual(service.hasActiveTerminal(), false);
    });
  });

  describe('addTerminal', () => {
    it('should add terminal to state', (done) => {
      const terminal = createMockTerminal();

      service.onTerminalAdded((addedTerminal) => {
        assert.strictEqual(addedTerminal.id, terminal.id);
        done();
      });

      service.addTerminal(terminal);

      assert.strictEqual(service.getTerminalCount(), 1);
      assert.ok(service.hasTerminal(terminal.id));
      assert.deepStrictEqual(service.getTerminal(terminal.id), terminal);
    });

    it('should emit state update event on add', (done) => {
      const terminal = createMockTerminal();

      service.onStateUpdate((state) => {
        assert.strictEqual(state.terminals.length, 1);
        assert.strictEqual(state.terminals[0]?.id, terminal.id);
        done();
      });

      service.addTerminal(terminal);
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
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  describe('removeTerminal', () => {
    it('should remove terminal from state', (done) => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      service.onTerminalRemoved((removedId) => {
        assert.strictEqual(removedId, terminal.id);
        done();
      });

      service.removeTerminal(terminal.id);

      assert.strictEqual(service.getTerminalCount(), 0);
      assert.strictEqual(service.hasTerminal(terminal.id), false);
      assert.strictEqual(service.getTerminal(terminal.id), undefined);
    });

    it('should handle removal of non-existent terminal', () => {
      // Should not throw error
      service.removeTerminal('non-existent');
    });

    it('should clear active terminal when removing active terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);
      service.setActiveTerminal(terminal.id);

      assert.strictEqual(service.getActiveTerminalId(), terminal.id);

      service.removeTerminal(terminal.id);

      assert.strictEqual(service.hasActiveTerminal(), false);
      assert.strictEqual(service.getActiveTerminalId(), undefined);
    });

    it('should emit state update event on remove', (done) => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      let eventCount = 0;
      service.onStateUpdate(() => {
        eventCount++;
        if (eventCount === 2) {
          // Second event is for removal
          assert.strictEqual(service.getTerminalCount(), 0);
          done();
        }
      });

      service.removeTerminal(terminal.id);
    });
  });

  describe('getTerminal', () => {
    it('should return existing terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      const retrieved = service.getTerminal(terminal.id);
      assert.deepStrictEqual(retrieved, terminal);
    });

    it('should return undefined for non-existent terminal', () => {
      const result = service.getTerminal('non-existent');
      assert.strictEqual(result, undefined);
    });
  });

  describe('getTerminals', () => {
    it('should return all terminals', () => {
      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);

      const terminals = service.getTerminals();
      assert.strictEqual(terminals.length, 2);
      assert.ok(terminals.some((t) => t.id === 'test1'));
      assert.ok(terminals.some((t) => t.id === 'test2'));
    });

    it('should return empty array when no terminals', () => {
      const terminals = service.getTerminals();
      assert.strictEqual(terminals.length, 0);
    });
  });

  describe('getTerminalsMap', () => {
    it('should return read-only map of terminals', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      const map = service.getTerminalsMap();
      assert.ok(map.has(terminal.id));
      assert.deepStrictEqual(map.get(terminal.id), terminal);
    });
  });

  describe('hasTerminal', () => {
    it('should return true for existing terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      assert.strictEqual(service.hasTerminal(terminal.id), true);
    });

    it('should return false for non-existent terminal', () => {
      assert.strictEqual(service.hasTerminal('non-existent'), false);
    });
  });

  describe('getTerminalCount', () => {
    it('should return correct count', () => {
      assert.strictEqual(service.getTerminalCount(), 0);

      service.addTerminal(createMockTerminal('test1'));
      assert.strictEqual(service.getTerminalCount(), 1);

      service.addTerminal(createMockTerminal('test2'));
      assert.strictEqual(service.getTerminalCount(), 2);

      service.removeTerminal('test1');
      assert.strictEqual(service.getTerminalCount(), 1);
    });
  });

  describe('Active Terminal Management', () => {
    it('should set active terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      const result = service.setActiveTerminal(terminal.id);

      assert.strictEqual(result, true);
      assert.strictEqual(service.hasActiveTerminal(), true);
      assert.strictEqual(service.getActiveTerminalId(), terminal.id);
      assert.deepStrictEqual(service.getActiveTerminal(), terminal);
    });

    it('should fail to set non-existent terminal as active', () => {
      const result = service.setActiveTerminal('non-existent');

      assert.strictEqual(result, false);
      assert.strictEqual(service.hasActiveTerminal(), false);
    });

    it('should deactivate previous active terminal when setting new one', () => {
      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);

      service.setActiveTerminal(terminal1.id);
      assert.strictEqual(terminal1.isActive, true);

      service.setActiveTerminal(terminal2.id);
      assert.strictEqual(terminal1.isActive, false);
      assert.strictEqual(terminal2.isActive, true);
    });

    it('should clear active terminal', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);
      service.setActiveTerminal(terminal.id);

      service.clearActiveTerminal();

      assert.strictEqual(service.hasActiveTerminal(), false);
      assert.strictEqual(service.getActiveTerminalId(), undefined);
      assert.strictEqual(service.getActiveTerminal(), undefined);
      assert.strictEqual(terminal.isActive, false);
    });
  });

  describe('Terminal Number Management', () => {
    it('should get next terminal number', () => {
      const number = service.getNextTerminalNumber();
      assert.strictEqual(number, 1);
    });

    it('should get available slots', () => {
      const slots = service.getAvailableSlots();
      assert.ok(Array.isArray(slots));
      assert.ok(slots.length > 0);
    });

    it('should release terminal number', () => {
      // Should not throw error
      service.releaseTerminalNumber(1);
    });
  });

  describe('Being Killed Tracking', () => {
    it('should mark and check terminal as being killed', () => {
      const terminalId = 'test1';

      assert.strictEqual(service.isTerminalBeingKilled(terminalId), false);

      service.markTerminalAsBeingKilled(terminalId);
      assert.strictEqual(service.isTerminalBeingKilled(terminalId), true);

      // Should be cleaned up when terminal is removed
      const terminal = createMockTerminal(terminalId);
      service.addTerminal(terminal);
      service.removeTerminal(terminalId);
      assert.strictEqual(service.isTerminalBeingKilled(terminalId), false);
    });
  });

  describe('getCurrentState', () => {
    it('should return current state with no terminals', () => {
      const state = service.getCurrentState();

      assert.strictEqual(state.terminals.length, 0);
      assert.strictEqual(state.activeTerminalId, null);
      assert.ok(state.maxTerminals > 0);
      assert.ok(Array.isArray(state.availableSlots));
    });

    it('should return current state with terminals', () => {
      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);
      service.setActiveTerminal(terminal1.id);

      const state = service.getCurrentState();

      assert.strictEqual(state.terminals.length, 2);
      assert.strictEqual(state.activeTerminalId, terminal1.id);
      assert.ok(state.terminals.some((t) => t.id === 'test1'));
      assert.ok(state.terminals.some((t) => t.id === 'test2'));
    });

    it('should handle errors gracefully', () => {
      // Mock getTerminalsMap to throw error
      (service as any).getTerminalsMap = () => {
        throw new Error('Test error');
      };

      const state = service.getCurrentState();

      // Should return safe fallback state
      assert.strictEqual(state.terminals.length, 0);
      assert.strictEqual(state.activeTerminalId, null);
    });
  });

  describe('getStateStatistics', () => {
    it('should return accurate statistics', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);
      service.setActiveTerminal(terminal.id);
      service.markTerminalAsBeingKilled('test2');

      const stats = service.getStateStatistics();

      assert.strictEqual(stats.terminalCount, 1);
      assert.strictEqual(stats.activeTerminalId, terminal.id);
      assert.strictEqual(stats.terminalsBeingKilled, 1);
      assert.ok(Array.isArray(stats.availableSlots));
      assert.ok(Array.isArray(stats.usedNumbers));
      assert.ok(stats.maxTerminals > 0);
    });
  });

  describe('selectNextActiveTerminal', () => {
    it('should select first terminal when no active terminal', () => {
      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      service.addTerminal(terminal1);
      service.addTerminal(terminal2);

      const selectedId = service.selectNextActiveTerminal();

      assert.strictEqual(selectedId, terminal1.id);
      assert.strictEqual(service.getActiveTerminalId(), terminal1.id);
    });

    it('should return null when no terminals available', () => {
      const selectedId = service.selectNextActiveTerminal();

      assert.strictEqual(selectedId, null);
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
      assert.strictEqual(selectedId, null);

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

      assert.strictEqual(result.canDelete, true);
      assert.strictEqual(result.reason, undefined);
    });

    it('should prevent deletion when only one terminal exists', () => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      const result = service.validateDeletion(terminal.id);

      assert.strictEqual(result.canDelete, false);
      assert.strictEqual(result.reason, 'Must keep at least 1 terminal open');
    });

    it('should prevent deletion of non-existent terminal', () => {
      const result = service.validateDeletion('non-existent');

      assert.strictEqual(result.canDelete, false);
      assert.strictEqual(result.reason, 'Terminal not found');
    });

    it('should handle validation errors gracefully', () => {
      // Mock hasTerminal to throw error
      (service as any).hasTerminal = () => {
        throw new Error('Test error');
      };

      const result = service.validateDeletion('test');

      assert.strictEqual(result.canDelete, false);
      assert.ok(result.reason?.includes('Validation failed'));
    });
  });

  describe('Event Emission', () => {
    it('should emit terminal added events', (done) => {
      const terminal = createMockTerminal();

      service.onTerminalAdded((addedTerminal) => {
        assert.deepStrictEqual(addedTerminal, terminal);
        done();
      });

      service.addTerminal(terminal);
    });

    it('should emit terminal removed events', (done) => {
      const terminal = createMockTerminal();
      service.addTerminal(terminal);

      service.onTerminalRemoved((removedId) => {
        assert.strictEqual(removedId, terminal.id);
        done();
      });

      service.removeTerminal(terminal.id);
    });

    it('should emit state update events', (done) => {
      let eventCount = 0;

      service.onStateUpdate((state) => {
        eventCount++;
        if (eventCount === 1) {
          assert.strictEqual(state.terminals.length, 1);
        } else if (eventCount === 2) {
          assert.strictEqual(state.terminals.length, 0);
          done();
        }
      });

      const terminal = createMockTerminal();
      service.addTerminal(terminal);
      service.removeTerminal(terminal.id);
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
      assert.strictEqual(service.getTerminalCount(), 0);
      assert.strictEqual(service.hasActiveTerminal(), false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete terminal lifecycle', (done) => {
      let eventCount = 0;
      const expectedEvents = 4; // add + state, remove + state

      service.onStateUpdate(() => {
        eventCount++;
        if (eventCount === expectedEvents) {
          done();
        }
      });

      const terminal1 = createMockTerminal('test1', 'Terminal 1');
      const terminal2 = createMockTerminal('test2', 'Terminal 2');

      // Add terminals
      service.addTerminal(terminal1);
      service.addTerminal(terminal2);

      // Set active
      service.setActiveTerminal(terminal1.id);
      assert.strictEqual(service.getActiveTerminalId(), terminal1.id);

      // Remove terminals
      service.removeTerminal(terminal1.id);
      assert.strictEqual(service.hasActiveTerminal(), false);

      service.removeTerminal(terminal2.id);
      assert.strictEqual(service.getTerminalCount(), 0);
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
      assert.ok(state.terminals.length > 0);

      // Clean up remaining terminals
      for (const terminal of terminals) {
        if (service.hasTerminal(terminal.id)) {
          service.removeTerminal(terminal.id);
        }
      }

      assert.strictEqual(service.getTerminalCount(), 0);
    });
  });
});
