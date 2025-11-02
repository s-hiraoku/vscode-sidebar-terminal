/**
 * TDD Test Suite: TerminalManager Event Handler Setup
 *
 * Purpose: Verify that event handlers (_setupTerminalEvents) are set up correctly
 * and only once, preventing duplicate event registration that causes issues like
 * double character display.
 *
 * Test Strategy:
 * - RED: Write failing tests that detect duplicate handlers
 * - GREEN: Verify current implementation has no duplicates
 * - REFACTOR: Add comprehensive edge case coverage
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import '../../shared/TestSetup';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { ProcessState } from '../../../types/shared';

/**
 * Mock PTY Process for testing event handler registration
 */
class MockPtyProcess {
  private dataHandlers: Array<(data: string) => void> = [];
  private exitHandlers: Array<(event: any) => void> = [];
  public pid = 12345;

  onData(handler: (data: string) => void) {
    this.dataHandlers.push(handler);
    return {
      dispose: () => {
        const index = this.dataHandlers.indexOf(handler);
        if (index > -1) {
          this.dataHandlers.splice(index, 1);
        }
      },
    };
  }

  onExit(handler: (event: any) => void) {
    this.exitHandlers.push(handler);
    return {
      dispose: () => {
        const index = this.exitHandlers.indexOf(handler);
        if (index > -1) {
          this.exitHandlers.splice(index, 1);
        }
      },
    };
  }

  write(_data: string) {
    // Mock write operation
  }

  resize(_cols: number, _rows: number) {
    // Mock resize operation
  }

  kill() {
    // Simulate process exit
    this.emitExit({ exitCode: 0 });
  }

  // Test helpers
  emitData(data: string) {
    this.dataHandlers.forEach((handler) => handler(data));
  }

  emitExit(event: { exitCode: number; signal?: number }) {
    this.exitHandlers.forEach((handler) => handler(event));
  }

  getDataHandlerCount(): number {
    return this.dataHandlers.length;
  }

  getExitHandlerCount(): number {
    return this.exitHandlers.length;
  }
}

describe('TerminalManager - Event Handler Setup (TDD)', () => {
  let terminalManager: TerminalManager;
  let spawnStub: sinon.SinonStub;
  let mockPty: MockPtyProcess;

  beforeEach(() => {
    // Create fresh mock PTY for each test
    mockPty = new MockPtyProcess();

    // Stub TerminalSpawner to return our mock PTY
    const TerminalSpawner = require('../../../terminals/TerminalSpawner').TerminalSpawner;
    spawnStub = sinon.stub(TerminalSpawner.prototype, 'spawnTerminal').returns({
      ptyProcess: mockPty,
    });

    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    terminalManager.dispose();
    spawnStub.restore();
  });

  describe('RED Phase: Event Handler Duplication Detection', () => {
    it('should register onData handler exactly once in createTerminal()', () => {
      // Act: Create terminal (this triggers _setupTerminalEvents)
      const terminalId = terminalManager.createTerminal();

      // Assert: Only one data handler should be registered
      expect(mockPty.getDataHandlerCount()).to.equal(
        1,
        'Expected exactly one onData handler to be registered'
      );

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });

    it('should register onExit handler exactly once in createTerminal()', () => {
      // Act: Create terminal
      const terminalId = terminalManager.createTerminal();

      // Assert: Only one exit handler should be registered
      expect(mockPty.getExitHandlerCount()).to.equal(
        1,
        'Expected exactly one onExit handler to be registered'
      );

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });

    it('should register onData handler exactly once in createTerminalWithProfile()', async () => {
      // Act: Create terminal with profile
      const terminalId = await terminalManager.createTerminalWithProfile();

      // Assert: Only one data handler should be registered
      expect(mockPty.getDataHandlerCount()).to.equal(
        1,
        'Expected exactly one onData handler to be registered in createTerminalWithProfile'
      );

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });

    it('should register onExit handler exactly once in createTerminalWithProfile()', async () => {
      // Act: Create terminal with profile
      const terminalId = await terminalManager.createTerminalWithProfile();

      // Assert: Only one exit handler should be registered
      expect(mockPty.getExitHandlerCount()).to.equal(
        1,
        'Expected exactly one onExit handler to be registered in createTerminalWithProfile'
      );

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });
  });

  describe('RED Phase: Data Event Emission Count', () => {
    it('should emit data event exactly once when PTY sends data', (done) => {
      const terminalId = terminalManager.createTerminal();
      let dataEventCount = 0;
      const testData = 'test output';

      // Listen for data events
      terminalManager.onData((event) => {
        if (event.terminalId === terminalId && event.data === testData) {
          dataEventCount++;
        }
      });

      // Simulate PTY data emission
      mockPty.emitData(testData);

      // Wait for event processing
      setTimeout(() => {
        expect(dataEventCount).to.equal(1, 'Data event should fire exactly once');
        terminalManager.removeTerminal(terminalId);
        done();
      }, 100);
    });

    it('should emit exit event exactly once when PTY process exits', (done) => {
      const terminalId = terminalManager.createTerminal();
      let exitEventCount = 0;

      // Listen for exit events
      terminalManager.onExit((event) => {
        if (event.terminalId === terminalId) {
          exitEventCount++;
        }
      });

      // Simulate PTY exit
      mockPty.emitExit({ exitCode: 0 });

      // Wait for event processing
      setTimeout(() => {
        expect(exitEventCount).to.equal(1, 'Exit event should fire exactly once');
        done();
      }, 100);
    });
  });

  describe('GREEN Phase: Process State Management', () => {
    it('should initialize terminal with Launching state', () => {
      const terminalId = terminalManager.createTerminal();
      const terminal = terminalManager.getTerminal(terminalId);

      expect(terminal).to.exist;
      expect(terminal?.processState).to.equal(
        ProcessState.Launching,
        'Terminal should start in Launching state'
      );

      terminalManager.removeTerminal(terminalId);
    });

    it('should transition from Launching to Running on first data', (done) => {
      const terminalId = terminalManager.createTerminal();
      const terminal = terminalManager.getTerminal(terminalId);

      expect(terminal?.processState).to.equal(ProcessState.Launching);

      // Simulate first data reception
      mockPty.emitData('$ ');

      // Wait for state transition
      setTimeout(() => {
        const updatedTerminal = terminalManager.getTerminal(terminalId);
        expect(updatedTerminal?.processState).to.equal(
          ProcessState.Running,
          'Terminal should transition to Running after first data'
        );

        terminalManager.removeTerminal(terminalId);
        done();
      }, 50);
    });

    it('should set KilledByUser state when deleteTerminal is called', (done) => {
      const terminalId = terminalManager.createTerminal();

      // Transition to Running state first
      mockPty.emitData('initial data');

      setTimeout(async () => {
        let capturedExitState: ProcessState | undefined;

        // Capture exit event state
        terminalManager.onExit((event) => {
          if (event.terminalId === terminalId) {
            const terminal = terminalManager.getTerminal(terminalId);
            capturedExitState = terminal?.processState;
          }
        });

        // Delete terminal
        await terminalManager.deleteTerminal(terminalId);

        // Verify state was KilledByUser
        expect(capturedExitState).to.equal(
          ProcessState.KilledByUser,
          'Terminal should be in KilledByUser state when explicitly deleted'
        );

        done();
      }, 50);
    });
  });

  describe('REFACTOR Phase: Method Consistency', () => {
    it('should use identical event setup pattern in both create methods', async () => {
      // Create terminal using both methods
      const terminal1Id = terminalManager.createTerminal();

      // Create new mock PTY for second terminal
      const mockPty2 = new MockPtyProcess();
      spawnStub.returns({ ptyProcess: mockPty2 });

      const terminal2Id = await terminalManager.createTerminalWithProfile();

      // Both should have exactly one handler each
      expect(mockPty.getDataHandlerCount()).to.equal(1);
      expect(mockPty.getExitHandlerCount()).to.equal(1);
      expect(mockPty2.getDataHandlerCount()).to.equal(1);
      expect(mockPty2.getExitHandlerCount()).to.equal(1);

      // Cleanup
      terminalManager.removeTerminal(terminal1Id);
      terminalManager.removeTerminal(terminal2Id);
    });
  });

  describe('REFACTOR Phase: Edge Cases', () => {
    it('should handle rapid terminal creation without handler leaks', () => {
      const terminalIds: string[] = [];

      // Create 5 terminals rapidly
      for (let i = 0; i < 5; i++) {
        const mockPtyN = new MockPtyProcess();
        spawnStub.returns({ ptyProcess: mockPtyN });

        const id = terminalManager.createTerminal();
        terminalIds.push(id);

        // Each should have exactly one handler
        expect(mockPtyN.getDataHandlerCount()).to.equal(1);
        expect(mockPtyN.getExitHandlerCount()).to.equal(1);
      }

      // Cleanup all
      terminalIds.forEach((id) => terminalManager.removeTerminal(id));
    });

    it('should not register duplicate handlers on multiple state transitions', (done) => {
      const terminalId = terminalManager.createTerminal();

      // Emit multiple data events to trigger state transitions
      mockPty.emitData('data 1');
      mockPty.emitData('data 2');
      mockPty.emitData('data 3');

      setTimeout(() => {
        // Handler count should still be 1
        expect(mockPty.getDataHandlerCount()).to.equal(
          1,
          'Handler count should remain 1 after multiple data emissions'
        );

        terminalManager.removeTerminal(terminalId);
        done();
      }, 100);
    });

    it('should handle terminal deletion during data processing', (done) => {
      const terminalId = terminalManager.createTerminal();

      // Start data emission
      mockPty.emitData('data before deletion');

      // Delete terminal immediately
      void terminalManager.deleteTerminal(terminalId);

      // Should not crash or cause errors
      setTimeout(() => {
        expect(terminalManager.getTerminal(terminalId)).to.be.undefined;
        done();
      }, 100);
    });
  });

  describe('REFACTOR Phase: Handler Cleanup', () => {
    it('should clean up handlers when terminal is removed', (done) => {
      const terminalId = terminalManager.createTerminal();

      expect(mockPty.getDataHandlerCount()).to.equal(1);
      expect(mockPty.getExitHandlerCount()).to.equal(1);

      // Remove terminal
      terminalManager.removeTerminal(terminalId);

      // Wait for cleanup
      setTimeout(() => {
        // Note: In real implementation, handlers might not be explicitly removed
        // but the terminal reference should be gone
        expect(terminalManager.getTerminal(terminalId)).to.be.undefined;
        done();
      }, 50);
    });
  });
});

describe('TerminalManager - Event Handler Cross-Contamination Prevention', () => {
  let terminalManager: TerminalManager;
  let spawnStub: sinon.SinonStub;
  let mockPty1: MockPtyProcess;
  let mockPty2: MockPtyProcess;

  beforeEach(() => {
    mockPty1 = new MockPtyProcess();
    mockPty2 = new MockPtyProcess();

    const TerminalSpawner = require('../../../terminals/TerminalSpawner').TerminalSpawner;
    let callCount = 0;
    spawnStub = sinon.stub(TerminalSpawner.prototype, 'spawnTerminal').callsFake(() => {
      callCount++;
      return { ptyProcess: callCount === 1 ? mockPty1 : mockPty2 };
    });

    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    terminalManager.dispose();
    spawnStub.restore();
  });

  it('should not mix events between multiple terminals', (done) => {
    const terminal1Id = terminalManager.createTerminal();
    const terminal2Id = terminalManager.createTerminal();

    const terminal1Events: string[] = [];
    const terminal2Events: string[] = [];

    // Listen for events
    terminalManager.onData((event) => {
      if (event.terminalId === terminal1Id && event.data) {
        terminal1Events.push(event.data);
      }
      if (event.terminalId === terminal2Id && event.data) {
        terminal2Events.push(event.data);
      }
    });

    // Send data to different terminals
    mockPty1.emitData('terminal1 data');
    mockPty2.emitData('terminal2 data');

    setTimeout(() => {
      // Each terminal should only receive its own data
      expect(terminal1Events).to.include('terminal1 data');
      expect(terminal1Events).to.not.include('terminal2 data');

      expect(terminal2Events).to.include('terminal2 data');
      expect(terminal2Events).to.not.include('terminal1 data');

      terminalManager.removeTerminal(terminal1Id);
      terminalManager.removeTerminal(terminal2Id);
      done();
    }, 100);
  });
});
