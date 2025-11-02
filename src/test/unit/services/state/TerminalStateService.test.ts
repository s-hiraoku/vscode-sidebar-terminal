/**
 * TerminalStateService Unit Tests
 *
 * Tests for the terminal state management service.
 */

// import { expect } from 'chai';
import { EventBus } from '../../../../core/EventBus';
import {
  TerminalStateService,
  TerminalStateChangedEvent,
} from '../../../../services/state/TerminalStateService';
import { ProcessState, InteractionState } from '../../../../types/shared';

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

      expect(service.hasTerminal('term1')).to.be.true;
      expect(service.getTerminalCount()).to.equal(1);
    });

    it('should set default values for missing metadata', () => {
      service.registerTerminal('term1', {});

      const metadata = service.getMetadata('term1');
      expect(metadata).to.exist;
      if (metadata) {
        expect(metadata.id).to.equal('term1');
        expect(metadata.name).to.equal('Terminal term1');
        expect(metadata.isActive).to.be.false;
        expect(metadata.createdAt).to.be.instanceOf(Date);
        expect(metadata.lastActiveAt).to.be.instanceOf(Date);
      }
    });

    it('should throw error when registering duplicate terminal', () => {
      service.registerTerminal('term1', {});

      expect(() => service.registerTerminal('term1', {})).to.throw(
        'Terminal term1 is already registered'
      );
    });

    it('should initialize lifecycle state to defaults', () => {
      service.registerTerminal('term1', {});

      const lifecycle = service.getLifecycleState('term1');
      expect(lifecycle).to.exist;
      if (lifecycle) {
        expect(lifecycle.processState).to.equal(ProcessState.Uninitialized);
        expect(lifecycle.interactionState).to.equal(InteractionState.None);
        expect(lifecycle.shouldPersist).to.be.false;
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

      expect(eventReceived).to.be.true;
    });
  });

  describe('Terminal Unregistration', () => {
    it('should unregister existing terminal', () => {
      service.registerTerminal('term1', {});

      const result = service.unregisterTerminal('term1');

      expect(result).to.be.true;
      expect(service.hasTerminal('term1')).to.be.false;
      expect(service.getTerminalCount()).to.equal(0);
    });

    it('should return false when unregistering non-existent terminal', () => {
      const result = service.unregisterTerminal('nonexistent');

      expect(result).to.be.false;
    });

    it('should clear active terminal when unregistering active terminal', () => {
      service.registerTerminal('term1', {});
      service.setActiveTerminal('term1');

      service.unregisterTerminal('term1');

      expect(service.getActiveTerminalId()).to.be.undefined;
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

      expect(eventReceived).to.be.true;
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

      expect(metadata).to.exist;
      if (metadata) {
        expect(metadata.id).to.equal('term1');
        expect(metadata.name).to.equal('My Terminal');
        expect(metadata.number).to.equal(1);
        expect(metadata.cwd).to.equal('/home/user');
      }
    });

    it('should return undefined for non-existent terminal', () => {
      const metadata = service.getMetadata('nonexistent');

      expect(metadata).to.be.undefined;
    });

    it('should update terminal metadata', () => {
      service.registerTerminal('term1', { name: 'Original' });

      const result = service.updateMetadata('term1', {
        name: 'Updated',
        cwd: '/new/path',
      });

      expect(result).to.be.true;

      const metadata = service.getMetadata('term1');
      expect(metadata?.name).to.equal('Updated');
      expect(metadata?.cwd).to.equal('/new/path');
    });

    it('should return false when updating non-existent terminal', () => {
      const result = service.updateMetadata('nonexistent', { name: 'Test' });

      expect(result).to.be.false;
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

      expect(eventReceived).to.be.true;
    });
  });

  describe('Lifecycle State Management', () => {
    it('should get lifecycle state', () => {
      service.registerTerminal('term1', {});

      const lifecycle = service.getLifecycleState('term1');

      expect(lifecycle).to.exist;
    });

    it('should update lifecycle state', () => {
      service.registerTerminal('term1', {});

      const result = service.updateLifecycleState('term1', {
        processState: ProcessState.Running,
        shouldPersist: true,
      });

      expect(result).to.be.true;

      const lifecycle = service.getLifecycleState('term1');
      expect(lifecycle?.processState).to.equal(ProcessState.Running);
      expect(lifecycle?.shouldPersist).to.be.true;
    });

    it('should set process state', () => {
      service.registerTerminal('term1', {});

      service.setProcessState('term1', ProcessState.Running);

      expect(service.getProcessState('term1')).to.equal(ProcessState.Running);
    });

    it('should set interaction state', () => {
      service.registerTerminal('term1', {});

      service.setInteractionState('term1', InteractionState.Session);

      expect(service.getInteractionState('term1')).to.equal(
        InteractionState.Session
      );
    });

    it('should return undefined for non-existent terminal states', () => {
      expect(service.getProcessState('nonexistent')).to.be.undefined;
      expect(service.getInteractionState('nonexistent')).to.be.undefined;
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

      expect(state).to.exist;
      if (state) {
        expect(state.id).to.equal('term1');
        expect(state.name).to.equal('Terminal 1');
        expect(state.lifecycle.processState).to.equal(ProcessState.Running);
      }
    });

    it('should return undefined for non-existent terminal state', () => {
      const state = service.getState('nonexistent');

      expect(state).to.be.undefined;
    });
  });

  describe('Active Terminal Management', () => {
    it('should set active terminal', () => {
      service.registerTerminal('term1', {});

      const result = service.setActiveTerminal('term1');

      expect(result).to.be.true;
      expect(service.getActiveTerminalId()).to.equal('term1');
      expect(service.isTerminalActive('term1')).to.be.true;
    });

    it('should update isActive flag when setting active terminal', () => {
      service.registerTerminal('term1', {});

      service.setActiveTerminal('term1');

      const metadata = service.getMetadata('term1');
      expect(metadata?.isActive).to.be.true;
    });

    it('should update lastActiveAt when setting active terminal', () => {
      service.registerTerminal('term1', {});
      const initialTime = service.getMetadata('term1')?.lastActiveAt;

      // Small delay to ensure timestamp difference
      const delay = new Promise((resolve) => setTimeout(resolve, 10));
      return delay.then(() => {
        service.setActiveTerminal('term1');

        const updatedTime = service.getMetadata('term1')?.lastActiveAt;
        expect(updatedTime).to.exist;
        if (initialTime && updatedTime) {
          expect(updatedTime.getTime()).to.be.greaterThan(initialTime.getTime());
        }
      });
    });

    it('should deactivate previous active terminal', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});

      service.setActiveTerminal('term1');
      service.setActiveTerminal('term2');

      expect(service.getMetadata('term1')?.isActive).to.be.false;
      expect(service.getMetadata('term2')?.isActive).to.be.true;
      expect(service.getActiveTerminalId()).to.equal('term2');
    });

    it('should return false when setting non-existent terminal as active', () => {
      const result = service.setActiveTerminal('nonexistent');

      expect(result).to.be.false;
    });

    it('should get active terminal metadata', () => {
      service.registerTerminal('term1', { name: 'Active Terminal' });
      service.setActiveTerminal('term1');

      const active = service.getActiveTerminal();

      expect(active).to.exist;
      expect(active?.id).to.equal('term1');
      expect(active?.name).to.equal('Active Terminal');
    });

    it('should return undefined when no active terminal', () => {
      const active = service.getActiveTerminal();

      expect(active).to.be.undefined;
    });

    it('should clear active terminal', () => {
      service.registerTerminal('term1', {});
      service.setActiveTerminal('term1');

      service.clearActiveTerminal();

      expect(service.getActiveTerminalId()).to.be.undefined;
      expect(service.getMetadata('term1')?.isActive).to.be.false;
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

      expect(eventReceived).to.be.true;
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

      expect(eventReceived).to.be.true;
    });
  });

  describe('Terminal Queries', () => {
    it('should get all terminal IDs', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});
      service.registerTerminal('term3', {});

      const ids = service.getAllTerminalIds();

      expect(ids).to.have.length(3);
      expect(ids).to.include('term1');
      expect(ids).to.include('term2');
      expect(ids).to.include('term3');
    });

    it('should get all terminal metadata', () => {
      service.registerTerminal('term1', { name: 'Terminal 1' });
      service.registerTerminal('term2', { name: 'Terminal 2' });

      const terminals = service.getAllTerminals();

      expect(terminals).to.have.length(2);
      expect(terminals[0]?.name).to.be.oneOf(['Terminal 1', 'Terminal 2']);
    });

    it('should get all terminal states', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});

      const states = service.getAllStates();

      expect(states).to.have.length(2);
      expect(states[0]).to.have.property('lifecycle');
    });

    it('should get terminal count', () => {
      expect(service.getTerminalCount()).to.equal(0);

      service.registerTerminal('term1', {});
      expect(service.getTerminalCount()).to.equal(1);

      service.registerTerminal('term2', {});
      expect(service.getTerminalCount()).to.equal(2);

      service.unregisterTerminal('term1');
      expect(service.getTerminalCount()).to.equal(1);
    });

    it('should check if terminal is ready', () => {
      service.registerTerminal('term1', {});

      expect(service.isTerminalReady('term1')).to.be.false;

      service.setProcessState('term1', ProcessState.Running);

      expect(service.isTerminalReady('term1')).to.be.true;
    });

    it('should check if terminal is active', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});

      service.setActiveTerminal('term1');

      expect(service.isTerminalActive('term1')).to.be.true;
      expect(service.isTerminalActive('term2')).to.be.false;
    });

    it('should find terminals by predicate', () => {
      service.registerTerminal('term1', { number: 1 });
      service.registerTerminal('term2', { number: 2 });
      service.registerTerminal('term3', { number: 3 });

      const found = service.findTerminals((m) => m.number === 2);

      expect(found).to.have.length(1);
      expect(found[0]?.id).to.equal('term2');
    });

    it('should return empty array when no terminals match predicate', () => {
      service.registerTerminal('term1', { number: 1 });

      const found = service.findTerminals((m) => m.number === 99);

      expect(found).to.be.an('array').that.is.empty;
    });
  });

  describe('Activity Tracking', () => {
    it('should update last active time', () => {
      service.registerTerminal('term1', {});
      const initialTime = service.getMetadata('term1')?.lastActiveAt;

      // Small delay to ensure timestamp difference
      const delay = new Promise((resolve) => setTimeout(resolve, 10));
      return delay.then(() => {
        const result = service.updateLastActiveTime('term1');

        expect(result).to.be.true;

        const updatedTime = service.getMetadata('term1')?.lastActiveAt;
        if (initialTime && updatedTime) {
          expect(updatedTime.getTime()).to.be.greaterThan(initialTime.getTime());
        }
      });
    });

    it('should get terminals ordered by activity', function (done) {
      this.timeout(100);

      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});
      service.registerTerminal('term3', {});

      // Update activity in specific order
      setTimeout(() => service.updateLastActiveTime('term2'), 10);
      setTimeout(() => service.updateLastActiveTime('term3'), 20);
      setTimeout(() => service.updateLastActiveTime('term1'), 30);

      setTimeout(() => {
        const ordered = service.getTerminalsByActivity();

        // Most recent first
        expect(ordered[0]).to.equal('term1');
        expect(ordered[1]).to.equal('term3');
        expect(ordered[2]).to.equal('term2');

        done();
      }, 50);
    });
  });

  describe('Clear and Disposal', () => {
    it('should clear all terminals', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});
      service.setActiveTerminal('term1');

      service.clear();

      expect(service.getTerminalCount()).to.equal(0);
      expect(service.getActiveTerminalId()).to.be.undefined;
    });

    it('should dispose service', () => {
      service.registerTerminal('term1', {});

      service.dispose();

      expect(service.getTerminalCount()).to.equal(0);
    });

    it('should throw error when using disposed service', () => {
      service.dispose();

      expect(() => service.registerTerminal('term1', {})).to.throw(
        'Cannot use disposed TerminalStateService'
      );
    });

    it('should allow multiple dispose calls', () => {
      service.dispose();
      service.dispose(); // Should not throw

      expect(true).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle operations on non-existent terminals gracefully', () => {
      expect(() => service.updateMetadata('nonexistent', {})).to.not.throw();
      expect(() => service.setProcessState('nonexistent', ProcessState.Running)).to.not.throw();
      expect(() => service.updateLastActiveTime('nonexistent')).to.not.throw();
    });

    it('should handle setting non-existent terminal as active', () => {
      const result = service.setActiveTerminal('nonexistent');

      expect(result).to.be.false;
      expect(service.getActiveTerminalId()).to.be.undefined;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty terminal ID', () => {
      service.registerTerminal('', {});

      expect(service.hasTerminal('')).to.be.true;
      expect(service.getMetadata('')?.id).to.equal('');
    });

    it('should handle many terminals', () => {
      for (let i = 0; i < 100; i++) {
        service.registerTerminal(`term${i}`, { number: i });
      }

      expect(service.getTerminalCount()).to.equal(100);
      expect(service.getAllTerminalIds()).to.have.length(100);
    });

    it('should handle rapid state updates', () => {
      service.registerTerminal('term1', {});

      for (let i = 0; i < 100; i++) {
        service.updateMetadata('term1', { name: `Name ${i}` });
      }

      const metadata = service.getMetadata('term1');
      expect(metadata?.name).to.equal('Name 99');
    });

    it('should handle terminal switching', () => {
      service.registerTerminal('term1', {});
      service.registerTerminal('term2', {});
      service.registerTerminal('term3', {});

      service.setActiveTerminal('term1');
      service.setActiveTerminal('term2');
      service.setActiveTerminal('term3');
      service.setActiveTerminal('term1');

      expect(service.getActiveTerminalId()).to.equal('term1');
      expect(service.isTerminalActive('term1')).to.be.true;
      expect(service.isTerminalActive('term2')).to.be.false;
      expect(service.isTerminalActive('term3')).to.be.false;
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

      expect(events).to.include('registered');
      expect(events).to.include('activated');
      expect(events).to.include('updated');
      expect(events).to.include('deactivated');
      expect(events).to.include('unregistered');
    });

    it('should include previous and current state in events', () => {
      let receivedEvent: any;

      service.registerTerminal('term1', { name: 'Original' });

      eventBus.subscribe(TerminalStateChangedEvent, (event) => {
        receivedEvent = event.data;
      });

      service.updateMetadata('term1', { name: 'Updated' });

      expect(receivedEvent).to.exist;
      expect(receivedEvent.previousState.name).to.equal('Original');
      expect(receivedEvent.currentState.name).to.equal('Updated');
    });
  });
});
