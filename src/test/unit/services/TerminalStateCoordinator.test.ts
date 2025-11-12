/**
 * Terminal State Coordinator Test Suite
 *
 * Tests for terminal state management:
 * - State tracking and synchronization
 * - Event emission
 * - Active terminal management
 * - Process state notifications
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalStateCoordinator } from '../../../services/TerminalStateCoordinator';
import { TerminalInstance, TerminalState, ProcessState } from '../../../types/shared';

describe('🧪 Terminal State Coordinator Test Suite', () => {
  let stateCoordinator: TerminalStateCoordinator;
  let sandbox: sinon.SinonSandbox;

  // Event tracking
  let stateUpdateEvents: TerminalState[] = [];
  let dataEvents: Array<{ terminalId: string; data: string }> = [];
  let exitEvents: Array<{ terminalId: string; exitCode?: number }> = [];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stateCoordinator = new TerminalStateCoordinator();

    // Track events
    stateUpdateEvents = [];
    dataEvents = [];
    exitEvents = [];

    stateCoordinator.onStateUpdate((event) => {
      stateUpdateEvents.push(event);
    });

    stateCoordinator.onData((event) => {
      dataEvents.push(event);
    });

    stateCoordinator.onExit((event) => {
      exitEvents.push(event);
    });
  });

  afterEach(() => {
    stateCoordinator.dispose();
    sandbox.restore();
  });

  // =================== State Management Tests ===================

  describe('📊 State Management', () => {
    it('should return empty state initially', () => {
      const state = stateCoordinator.getCurrentState();
      expect(state.terminals).to.be.an('array').that.is.empty;
      expect(state.activeTerminalId).to.be.null;
      expect(state.maxTerminals).to.be.a('number');
      expect(state.availableSlots).to.be.an('array');
    });

    it('should include registered terminal in state', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      const state = stateCoordinator.getCurrentState();

      expect(state.terminals).to.have.lengthOf(1);
      expect(state.terminals[0]?.id).to.equal('terminal-1');
      expect(state.terminals[0]?.name).to.equal('Terminal 1');
    });

    it('should handle multiple terminals in state', () => {
      const terminals: TerminalInstance[] = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          isActive: false,
          createdAt: new Date(),
        },
        {
          id: 'terminal-3',
          name: 'Terminal 3',
          number: 3,
          isActive: false,
          createdAt: new Date(),
        },
      ];

      terminals.forEach((terminal) => stateCoordinator.registerTerminal(terminal));
      const state = stateCoordinator.getCurrentState();

      expect(state.terminals).to.have.lengthOf(3);
    });

    it('should notify state update', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      stateCoordinator.notifyStateUpdate();

      expect(stateUpdateEvents).to.have.lengthOf(1);
      expect(stateUpdateEvents[0]?.terminals).to.have.lengthOf(1);
    });
  });

  // =================== Active Terminal Management Tests ===================

  describe('🎯 Active Terminal Management', () => {
    it('should set terminal as active', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      stateCoordinator.setTerminalActive('terminal-1', true);

      expect(stateCoordinator.isTerminalActive('terminal-1')).to.be.true;
      expect(terminal.isActive).to.be.true;
    });

    it('should set terminal as inactive', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      stateCoordinator.setTerminalActive('terminal-1', false);

      expect(stateCoordinator.isTerminalActive('terminal-1')).to.be.false;
      expect(terminal.isActive).to.be.false;
    });

    it('should deactivate all terminals', () => {
      const terminals: TerminalInstance[] = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          isActive: true,
          createdAt: new Date(),
        },
      ];

      terminals.forEach((terminal) => stateCoordinator.registerTerminal(terminal));
      stateCoordinator.deactivateAllTerminals();

      const allTerminals = stateCoordinator.getAllTerminals();
      allTerminals.forEach((terminal) => {
        expect(terminal.isActive).to.be.false;
      });
    });

    it('should update active terminal after removal', () => {
      const terminals: TerminalInstance[] = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          isActive: false,
          createdAt: new Date(),
        },
      ];

      terminals.forEach((terminal) => stateCoordinator.registerTerminal(terminal));
      stateCoordinator.setTerminalActive('terminal-1', true);

      // Remove active terminal
      stateCoordinator.unregisterTerminal('terminal-1');
      stateCoordinator.updateActiveTerminalAfterRemoval('terminal-1');

      // Terminal 2 should become active
      const state = stateCoordinator.getCurrentState();
      expect(state.activeTerminalId).to.equal('terminal-2');
    });
  });

  // =================== Process State Notification Tests ===================

  describe('🔄 Process State Notifications', () => {
    it('should notify process state change', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
        processState: ProcessState.Launching,
      };

      stateCoordinator.registerTerminal(terminal);
      stateCoordinator.notifyProcessStateChange(
        terminal,
        ProcessState.Running,
        ProcessState.Launching
      );

      expect(terminal.processState).to.equal(ProcessState.Running);
      expect(stateUpdateEvents).to.have.lengthOf(1);
    });

    it('should handle process state transitions', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
        processState: ProcessState.Launching,
      };

      stateCoordinator.registerTerminal(terminal);

      // Launching → Running
      stateCoordinator.notifyProcessStateChange(
        terminal,
        ProcessState.Running,
        ProcessState.Launching
      );
      expect(terminal.processState).to.equal(ProcessState.Running);

      // Running → KilledByUser
      stateCoordinator.notifyProcessStateChange(
        terminal,
        ProcessState.KilledByUser,
        ProcessState.Running
      );
      expect(terminal.processState).to.equal(ProcessState.KilledByUser);

      expect(stateUpdateEvents).to.have.lengthOf(2);
    });
  });

  // =================== Event Emission Tests ===================

  describe('📡 Event Emission', () => {
    it('should fire data event', () => {
      stateCoordinator.fireDataEvent('terminal-1', 'test data');

      expect(dataEvents).to.have.lengthOf(1);
      expect(dataEvents[0]?.terminalId).to.equal('terminal-1');
      expect(dataEvents[0]?.data).to.equal('test data');
    });

    it('should fire exit event', () => {
      stateCoordinator.fireExitEvent('terminal-1', 0);

      expect(exitEvents).to.have.lengthOf(1);
      expect(exitEvents[0]?.terminalId).to.equal('terminal-1');
      expect(exitEvents[0]?.exitCode).to.equal(0);
    });

    it('should fire exit event without exit code', () => {
      stateCoordinator.fireExitEvent('terminal-1');

      expect(exitEvents).to.have.lengthOf(1);
      expect(exitEvents[0]?.terminalId).to.equal('terminal-1');
      expect(exitEvents[0]?.exitCode).to.be.undefined;
    });

    it('should handle multiple data events', () => {
      stateCoordinator.fireDataEvent('terminal-1', 'data 1');
      stateCoordinator.fireDataEvent('terminal-2', 'data 2');
      stateCoordinator.fireDataEvent('terminal-1', 'data 3');

      expect(dataEvents).to.have.lengthOf(3);
      expect(dataEvents[0]?.data).to.equal('data 1');
      expect(dataEvents[1]?.data).to.equal('data 2');
      expect(dataEvents[2]?.data).to.equal('data 3');
    });
  });

  // =================== Terminal Registry Tests ===================

  describe('📝 Terminal Registry', () => {
    it('should register terminal', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      const retrieved = stateCoordinator.getTerminal('terminal-1');

      expect(retrieved).to.equal(terminal);
    });

    it('should unregister terminal', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      stateCoordinator.unregisterTerminal('terminal-1');

      const retrieved = stateCoordinator.getTerminal('terminal-1');
      expect(retrieved).to.be.undefined;
    });

    it('should get all terminals', () => {
      const terminals: TerminalInstance[] = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          isActive: false,
          createdAt: new Date(),
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          isActive: false,
          createdAt: new Date(),
        },
      ];

      terminals.forEach((terminal) => stateCoordinator.registerTerminal(terminal));
      const allTerminals = stateCoordinator.getAllTerminals();

      expect(allTerminals).to.have.lengthOf(2);
    });

    it('should get terminals map', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      const terminalsMap = stateCoordinator.getTerminalsMap();

      expect(terminalsMap).to.be.instanceOf(Map);
      expect(terminalsMap.size).to.equal(1);
      expect(terminalsMap.get('terminal-1')).to.equal(terminal);
    });
  });

  // =================== Available Slots Tests ===================

  describe('🎰 Available Slots', () => {
    it('should return available slots', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      const slots = stateCoordinator.getAvailableSlots();

      expect(slots).to.be.an('array');
      expect(slots).to.not.include(1);
    });

    it('should reflect terminal additions in available slots', () => {
      const terminals: TerminalInstance[] = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          isActive: false,
          createdAt: new Date(),
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          isActive: false,
          createdAt: new Date(),
        },
      ];

      terminals.forEach((terminal) => stateCoordinator.registerTerminal(terminal));
      const slots = stateCoordinator.getAvailableSlots();

      expect(slots).to.not.include(1);
      expect(slots).to.not.include(2);
    });
  });

  // =================== Disposal Tests ===================

  describe('🗑️ Disposal', () => {
    it('should dispose successfully', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      expect(() => stateCoordinator.dispose()).to.not.throw();
    });

    it('should clear terminals on disposal', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      };

      stateCoordinator.registerTerminal(terminal);
      stateCoordinator.dispose();

      const state = stateCoordinator.getCurrentState();
      expect(state.terminals).to.be.empty;
    });
  });
});
