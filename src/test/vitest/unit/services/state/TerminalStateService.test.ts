// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
/**
 * TerminalStateService Unit Tests
 *
 * Tests for the terminal state management service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../../../../core/EventBus';
import {
  TerminalStateService,
  TerminalStateChangedEvent,
} from '../../../../../services/state/TerminalStateService';
import { ProcessState, InteractionState } from '../../../../../types/shared';

describe('TerminalStateService', () => {
  let eventBus: EventBus;
  let service: TerminalStateService;

  beforeEach(() => {
    eventBus = new EventBus();
    service = new TerminalStateService(eventBus);
  });

  afterEach(() => {
    service.dispose();
    eventBus.dispose();
  });

  describe('Terminal Registration', () => {
    it('should register a new terminal', () => {
      service.registerTerminal('term1', {
        name: 'Terminal 1',
        number: 1,
      });

      expect(service.hasTerminal('term1')).toBe(true);
      expect(service.getTerminalCount()).toBe(1);
    });

    it('should set default values for missing metadata', () => {
      service.registerTerminal('term1', {});

      const metadata = service.getMetadata('term1');
      expect(metadata).toBeDefined();
      if (metadata) {
        expect(metadata.id).toBe('term1');
        expect(metadata.name).toBe('Terminal term1');
        expect(metadata.isActive).toBe(false);
        expect(metadata.createdAt).toBeInstanceOf(Date);
        expect(metadata.lastActiveAt).toBeInstanceOf(Date);
      }
    });

    it('should throw error when registering duplicate terminal', () => {
      service.registerTerminal('term1', {});

      expect(() => service.registerTerminal('term1', {})).toThrow(
        'Terminal term1 is already registered'
      );
    });

    it('should initialize lifecycle state to defaults', () => {
      service.registerTerminal('term1', {});

      const lifecycle = service.getLifecycleState('term1');
      expect(lifecycle).toBeDefined();
      if (lifecycle) {
        expect(lifecycle.processState).toBe(ProcessState.Uninitialized);
        expect(lifecycle.interactionState).toBe(InteractionState.None);
        expect(lifecycle.shouldPersist).toBe(false);
      }
    });

    it('should publish registration event', () => {
      let eventReceived = false;

      eventBus.subscribe(TerminalStateChangedEvent, (event) => {
        if (event.data.changeType === 'registered') {
          eventReceived = true;
        }
      });

      service.registerTerminal('term1', {});

      expect(eventReceived).toBe(true);
    });
  });

  describe('Terminal Unregistration', () => {
    it('should unregister existing terminal', () => {
      service.registerTerminal('term1', {});

      const result = service.unregisterTerminal('term1');

      expect(result).toBe(true);
      expect(service.hasTerminal('term1')).toBe(false);
      expect(service.getTerminalCount()).toBe(0);
    });

    it('should return false when unregistering non-existent terminal', () => {
      const result = service.unregisterTerminal('nonexistent');

      expect(result).toBe(false);
    });

    it('should clear active terminal when unregistering active terminal', () => {
      service.registerTerminal('term1', {});
      service.setActiveTerminal('term1');

      service.unregisterTerminal('term1');

      expect(service.getActiveTerminalId()).toBeUndefined();
    });

    it('should publish unregistration event', () => {
      let eventReceived = false;

      service.registerTerminal('term1', {});

      eventBus.subscribe(TerminalStateChangedEvent, (event) => {
        if (event.data.changeType === 'unregistered') {
          eventReceived = true;
        }
      });

      service.unregisterTerminal('term1');

      expect(eventReceived).toBe(true);
    });
  });

  describe('Metadata Management', () => {
    it('should get terminal metadata', () => {
      service.registerTerminal('term1', {
        name: 'My Terminal',
        number: 1,
        cwd: '/home/user',
      });

      const metadata = service.getMetadata('term1');

      expect(metadata).toBeDefined();
      if (metadata) {
        expect(metadata.id).toBe('term1');
        expect(metadata.name).toBe('My Terminal');
        expect(metadata.number).toBe(1);
        expect(metadata.cwd).toBe('/home/user');
      }
    });

    it('should return undefined for non-existent terminal', () => {
      const metadata = service.getMetadata('nonexistent');

      expect(metadata).toBeUndefined();
    });

    it('should update terminal metadata', () => {
      service.registerTerminal('term1', { name: 'Original' });

      const result = service.updateMetadata('term1', {
        name: 'Updated',
        cwd: '/new/path',
      });

      expect(result).toBe(true);

      const metadata = service.getMetadata('term1');
      expect(metadata?.name).toBe('Updated');
      expect(metadata?.cwd).toBe('/new/path');
    });

    it('should return false when updating non-existent terminal', () => {
      const result = service.updateMetadata('nonexistent', { name: 'Test' });

      expect(result).toBe(false);
    });

    it('should publish update event when metadata changes', () => {
      let eventReceived = false;

      service.registerTerminal('term1', {});

      eventBus.subscribe(TerminalStateChangedEvent, (event) => {
        if (event.data.changeType === 'updated') {
          eventReceived = true;
        }
      });

      service.updateMetadata('term1', { name: 'Updated' });

      expect(eventReceived).toBe(true);
    });
  });

  describe('Lifecycle State Management', () => {
    it('should get lifecycle state', () => {
      service.registerTerminal('term1', {});

      const lifecycle = service.getLifecycleState('term1');

      expect(lifecycle).toBeDefined();
    });

    it('should update lifecycle state', () => {
      service.registerTerminal('term1', {});

      const result = service.updateLifecycleState('term1', {
        processState: ProcessState.Running,
        shouldPersist: true,
      });

      expect(result).toBe(true);

      const lifecycle = service.getLifecycleState('term1');
      expect(lifecycle?.processState).toBe(ProcessState.Running);
      expect(lifecycle?.shouldPersist).toBe(true);
    });

    it('should set process state', () => {
      service.registerTerminal('term1', {});

      service.setProcessState('term1', ProcessState.Running);

      expect(service.getProcessState('term1')).toBe(ProcessState.Running);
    });

    it('should set interaction state', () => {
      service.registerTerminal('term1', {});

      service.setInteractionState('term1', InteractionState.Session);

      expect(service.getInteractionState('term1')).toBe(InteractionState.Session);
    });

    it('should return undefined for non-existent terminal states', () => {
      expect(service.getProcessState('nonexistent')).toBeUndefined();
      expect(service.getInteractionState('nonexistent')).toBeUndefined();
    });
  });

  describe('Complete State Management', () => {
    it('should get complete terminal state', () => {
      service.registerTerminal('term1', {
        name: 'Terminal 1',
        number: 1,
      });

      service.setProcessState('term1', ProcessState.Running);

      const state = service.getState('term1');

      expect(state).toBeDefined();
      if (state) {
        expect(state.id).toBe('term1');
        expect(state.name).toBe('Terminal 1');
        expect(state.lifecycle.processState).toBe(ProcessState.Running);
      }
    });

    it('should return undefined for non-existent terminal state', () => {
      const state = service.getState('nonexistent');

      expect(state).toBeUndefined();
    });
  });

  describe('Active Terminal Management', () => {
    it('should set active terminal', () => {
      service.registerTerminal('term1', {});

      const result = service.setActiveTerminal('term1');

      expect(result).toBe(true);
      expect(service.getActiveTerminalId()).toBe('term1');
      expect(service.isTerminalActive('term1')).toBe(true);
    });

    it('should update isActive flag when setting active terminal', () => {
      service.registerTerminal('term1', {});

      service.setActiveTerminal('term1');

      const metadata = service.getMetadata('term1');
      expect(metadata?.isActive).toBe(true);
    });

    it('should update lastActiveAt when setting active terminal', async () => {
      service.registerTerminal('term1', {});
      const initialTime = service.getMetadata('term1')?.lastActiveAt;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));
      service.setActiveTerminal('term1');

      const updatedTime = service.getMetadata('term1')?.lastActiveAt;
      expect(updatedTime).toBeDefined();
      if (initialTime && updatedTime) {
        expect(updatedTime.getTime()).toBeGreaterThan(initialTime.getTime());
      }
    });

    it('should deactivate previous active terminal', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});

      service.setActiveTerminal('term1');
      service.setActiveTerminal('term2');

      expect(service.getMetadata('term1')?.isActive).toBe(false);
      expect(service.getMetadata('term2')?.isActive).toBe(true);
      expect(service.getActiveTerminalId()).toBe('term2');
    });

    it('should return false when setting non-existent terminal as active', () => {
      const result = service.setActiveTerminal('nonexistent');

      expect(result).toBe(false);
    });

    it('should get active terminal metadata', () => {
      service.registerTerminal('term1', { name: 'Active Terminal' });
      service.setActiveTerminal('term1');

      const active = service.getActiveTerminal();

      expect(active).toBeDefined();
      expect(active?.id).toBe('term1');
      expect(active?.name).toBe('Active Terminal');
    });

    it('should return undefined when no active terminal', () => {
      const active = service.getActiveTerminal();

      expect(active).toBeUndefined();
    });

    it('should clear active terminal', () => {
      service.registerTerminal('term1', {});
      service.setActiveTerminal('term1');

      service.clearActiveTerminal();

      expect(service.getActiveTerminalId()).toBeUndefined();
      expect(service.getMetadata('term1')?.isActive).toBe(false);
    });

    it('should publish activation event', () => {
      let eventReceived = false;

      service.registerTerminal('term1', {});

      eventBus.subscribe(TerminalStateChangedEvent, (event) => {
        if (event.data.changeType === 'activated') {
          eventReceived = true;
        }
      });

      service.setActiveTerminal('term1');

      expect(eventReceived).toBe(true);
    });

    it('should publish deactivation event', () => {
      let eventReceived = false;

      service.registerTerminal('term1', {});
      service.setActiveTerminal('term1');

      eventBus.subscribe(TerminalStateChangedEvent, (event) => {
        if (event.data.changeType === 'deactivated') {
          eventReceived = true;
        }
      });

      service.clearActiveTerminal();

      expect(eventReceived).toBe(true);
    });
  });

  describe('Terminal Queries', () => {
    it('should get all terminal IDs', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});
      service.registerTerminal('term3', {});

      const ids = service.getAllTerminalIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain('term1');
      expect(ids).toContain('term2');
      expect(ids).toContain('term3');
    });

    it('should get all terminal metadata', () => {
      service.registerTerminal('term1', { name: 'Terminal 1' });
      service.registerTerminal('term2', { name: 'Terminal 2' });

      const terminals = service.getAllTerminals();

      expect(terminals).toHaveLength(2);
      expect(['Terminal 1', 'Terminal 2']).toContain(terminals[0]?.name);
    });

    it('should get all terminal states', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});

      const states = service.getAllStates();

      expect(states).toHaveLength(2);
      expect(states[0]).toHaveProperty('lifecycle');
    });

    it('should get terminal count', () => {
      expect(service.getTerminalCount()).toBe(0);

      service.registerTerminal('term1', {});
      expect(service.getTerminalCount()).toBe(1);

      service.registerTerminal('term2', {});
      expect(service.getTerminalCount()).toBe(2);

      service.unregisterTerminal('term1');
      expect(service.getTerminalCount()).toBe(1);
    });

    it('should check if terminal is ready', () => {
      service.registerTerminal('term1', {});

      expect(service.isTerminalReady('term1')).toBe(false);

      service.setProcessState('term1', ProcessState.Running);

      expect(service.isTerminalReady('term1')).toBe(true);
    });

    it('should check if terminal is active', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});

      service.setActiveTerminal('term1');

      expect(service.isTerminalActive('term1')).toBe(true);
      expect(service.isTerminalActive('term2')).toBe(false);
    });

    it('should find terminals by predicate', () => {
      service.registerTerminal('term1', { number: 1 });
      service.registerTerminal('term2', { number: 2 });
      service.registerTerminal('term3', { number: 3 });

      const found = service.findTerminals((m) => m.number === 2);

      expect(found).toHaveLength(1);
      expect(found[0]?.id).toBe('term2');
    });

    it('should return empty array when no terminals match predicate', () => {
      service.registerTerminal('term1', { number: 1 });

      const found = service.findTerminals((m) => m.number === 99);

      expect(found).toEqual([]);
    });
  });

  describe('Activity Tracking', () => {
    it('should update last active time', async () => {
      service.registerTerminal('term1', {});
      const initialTime = service.getMetadata('term1')?.lastActiveAt;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = service.updateLastActiveTime('term1');

      expect(result).toBe(true);

      const updatedTime = service.getMetadata('term1')?.lastActiveAt;
      if (initialTime && updatedTime) {
        expect(updatedTime.getTime()).toBeGreaterThan(initialTime.getTime());
      }
    });

    it('should get terminals ordered by activity', () => {
      vi.useFakeTimers();

      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});
      service.registerTerminal('term3', {});

      // Update activity in specific order with time advancement
      vi.advanceTimersByTime(10);
      service.updateLastActiveTime('term2');

      vi.advanceTimersByTime(10);
      service.updateLastActiveTime('term3');

      vi.advanceTimersByTime(10);
      service.updateLastActiveTime('term1');

      const ordered = service.getTerminalsByActivity();

      // Most recent first
      expect(ordered[0]).toBe('term1');
      expect(ordered[1]).toBe('term3');
      expect(ordered[2]).toBe('term2');

      vi.useRealTimers();
    });
  });

  describe('Clear and Disposal', () => {
    it('should clear all terminals', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});
      service.setActiveTerminal('term1');

      service.clear();

      expect(service.getTerminalCount()).toBe(0);
      expect(service.getActiveTerminalId()).toBeUndefined();
    });

    it('should dispose service', () => {
      service.registerTerminal('term1', {});

      service.dispose();

      expect(service.getTerminalCount()).toBe(0);
    });

    it('should throw error when using disposed service', () => {
      service.dispose();

      expect(() => service.registerTerminal('term1', {})).toThrow(
        'Cannot use disposed TerminalStateService'
      );
    });

    it('should allow multiple dispose calls', () => {
      service.dispose();
      service.dispose(); // Should not throw

      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle operations on non-existent terminals gracefully', () => {
      expect(() => service.updateMetadata('nonexistent', {})).not.toThrow();
      expect(() => service.setProcessState('nonexistent', ProcessState.Running)).not.toThrow();
      expect(() => service.updateLastActiveTime('nonexistent')).not.toThrow();
    });

    it('should handle setting non-existent terminal as active', () => {
      const result = service.setActiveTerminal('nonexistent');

      expect(result).toBe(false);
      expect(service.getActiveTerminalId()).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty terminal ID', () => {
      service.registerTerminal('', {});

      expect(service.hasTerminal('')).toBe(true);
      expect(service.getMetadata('')?.id).toBe('');
    });

    it('should handle many terminals', () => {
      for (let i = 0; i < 100; i++) {
        service.registerTerminal(`term${i}`, { number: i });
      }

      expect(service.getTerminalCount()).toBe(100);
      expect(service.getAllTerminalIds()).toHaveLength(100);
    });

    it('should handle rapid state updates', () => {
      service.registerTerminal('term1', {});

      for (let i = 0; i < 100; i++) {
        service.updateMetadata('term1', { name: `Name ${i}` });
      }

      const metadata = service.getMetadata('term1');
      expect(metadata?.name).toBe('Name 99');
    });

    it('should handle terminal switching', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});
      service.registerTerminal('term3', {});

      service.setActiveTerminal('term1');
      service.setActiveTerminal('term2');
      service.setActiveTerminal('term3');
      service.setActiveTerminal('term1');

      expect(service.getActiveTerminalId()).toBe('term1');
      expect(service.isTerminalActive('term1')).toBe(true);
      expect(service.isTerminalActive('term2')).toBe(false);
      expect(service.isTerminalActive('term3')).toBe(false);
    });
  });

  describe('Event System Integration', () => {
    it('should emit events for all state changes', () => {
      const events: string[] = [];

      eventBus.subscribe(TerminalStateChangedEvent, (event) => {
        events.push(event.data.changeType);
      });

      service.registerTerminal('term1', {});
      service.setActiveTerminal('term1');
      service.updateMetadata('term1', { name: 'Updated' });
      service.clearActiveTerminal();
      service.unregisterTerminal('term1');

      expect(events).toContain('registered');
      expect(events).toContain('activated');
      expect(events).toContain('updated');
      expect(events).toContain('deactivated');
      expect(events).toContain('unregistered');
    });

    it('should include previous and current state in events', () => {
      let receivedEvent: any;

      service.registerTerminal('term1', { name: 'Original' });

      eventBus.subscribe(TerminalStateChangedEvent, (event) => {
        receivedEvent = event.data;
      });

      service.updateMetadata('term1', { name: 'Updated' });

      expect(receivedEvent).toBeDefined();
      expect(receivedEvent.previousState.name).toBe('Original');
      expect(receivedEvent.currentState.name).toBe('Updated');
    });
  });
});
