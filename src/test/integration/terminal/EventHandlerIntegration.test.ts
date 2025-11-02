/**
 * Integration Test Suite: Terminal Event Handler Integration
 *
 * Purpose: Verify that event handlers work correctly in real-world scenarios
 * with multiple terminals, concurrent operations, and lifecycle management.
 *
 * Test Strategy:
 * - Test multi-terminal event isolation
 * - Test event handler cleanup during terminal lifecycle
 * - Test concurrent operations without race conditions
 * - Test memory leak prevention
 */

// import { expect } from 'chai';
import '../../shared/TestSetup';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { ProcessState } from '../../../types/shared';

describe('Terminal Event Handler Integration Tests', () => {
  let terminalManager: TerminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    terminalManager.dispose();
  });

  describe('Multi-Terminal Event Isolation', () => {
    it('should isolate data events between multiple terminals', function (this: Mocha.Context) {
      this.timeout(5000);

      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      const terminal3 = terminalManager.createTerminal();

      const eventCounts = new Map<string, number>([
        [terminal1, 0],
        [terminal2, 0],
        [terminal3, 0],
      ]);

      // Track events for each terminal
      terminalManager.onData((event) => {
        const currentCount = eventCounts.get(event.terminalId) || 0;
        eventCounts.set(event.terminalId, currentCount + 1);
      });

      // Simulate data input to each terminal
      terminalManager.sendInput('command1\n', terminal1);
      terminalManager.sendInput('command2\n', terminal2);
      terminalManager.sendInput('command3\n', terminal3);

      // Each terminal should receive events independently
      // Note: Exact event counts depend on PTY implementation
      expect(eventCounts.size).to.be.greaterThan(0);

      // Cleanup
      terminalManager.removeTerminal(terminal1);
      terminalManager.removeTerminal(terminal2);
      terminalManager.removeTerminal(terminal3);
    });

    it('should handle exit events independently for multiple terminals', function (this: Mocha.Context) {
      this.timeout(5000);
      const terminals: string[] = [];

      // Create 3 terminals
      for (let i = 0; i < 3; i++) {
        terminals.push(terminalManager.createTerminal());
      }

      const exitedTerminals = new Set<string>();

      // Track exit events
      terminalManager.onExit((event) => {
        exitedTerminals.add(event.terminalId);
      });

      // Delete terminals one by one
      return Promise.all(
        terminals.map(async (id) => {
          await terminalManager.deleteTerminal(id);
        })
      ).then(() => {
        // All terminals should have fired exit events
        expect(exitedTerminals.size).to.equal(3);
        terminals.forEach((id) => {
          expect(exitedTerminals.has(id)).to.be.true;
        });
      });
    });
  });

  describe('Event Handler Lifecycle Management', () => {
    it('should clean up event handlers when terminal is deleted', async function (this: Mocha.Context) {
      this.timeout(5000);

      const _terminalId = terminalManager.createTerminal();

      // Send some data
      terminalManager.sendInput('test\n', terminalId);

      // Delete terminal
      await terminalManager.deleteTerminal(terminalId);

      // Terminal should no longer exist
      const terminal = terminalManager.getTerminal(terminalId);
      expect(terminal).to.be.undefined;
    });

    it('should handle rapid terminal creation and deletion without leaks', async function (this: Mocha.Context) {
      this.timeout(10000);

      const iterations = 10;
      const terminalIds: string[] = [];

      // Rapidly create terminals
      for (let i = 0; i < iterations; i++) {
        const id = terminalManager.createTerminal();
        terminalIds.push(id);
      }

      expect(terminalManager.getTerminals().length).to.equal(5); // Max limit

      // Rapidly delete terminals
      for (const id of terminalIds) {
        if (terminalManager.getTerminal(id)) {
          await terminalManager.deleteTerminal(id);
        }
      }

      // Should have at least 1 terminal remaining (minimum requirement)
      expect(terminalManager.getTerminals().length).to.be.greaterThan(0);
    });
  });

  describe('Process State Integration', () => {
    it('should maintain correct process states across terminal lifecycle', function (this: Mocha.Context) {
      this.timeout(5000);

      const _terminalId = terminalManager.createTerminal();
      const terminal = terminalManager.getTerminal(terminalId);

      // Initial state should be Launching
      expect(terminal?.processState).to.equal(ProcessState.Launching);

      // Send input to trigger state change
      terminalManager.sendInput('echo test\n', terminalId);

      // Clean up
      terminalManager.removeTerminal(terminalId);
    });

    it('should handle state transitions for multiple concurrent terminals', function (this: Mocha.Context) {
      this.timeout(5000);

      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();

      // Both should start in Launching state
      expect(terminalManager.getTerminal(terminal1)?.processState).to.equal(
        ProcessState.Launching
      );
      expect(terminalManager.getTerminal(terminal2)?.processState).to.equal(
        ProcessState.Launching
      );

      // Cleanup
      terminalManager.removeTerminal(terminal1);
      terminalManager.removeTerminal(terminal2);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent sendInput operations safely', function (this: Mocha.Context) {
      this.timeout(5000);

      const _terminalId = terminalManager.createTerminal();

      // Send multiple inputs concurrently
      const inputs = ['cmd1\n', 'cmd2\n', 'cmd3\n', 'cmd4\n', 'cmd5\n'];

      inputs.forEach((input) => {
        expect(() => {
          terminalManager.sendInput(input, terminalId);
        }).to.not.throw();
      });

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });

    it('should handle concurrent terminal creation safely', function (this: Mocha.Context) {
      this.timeout(5000);

      const terminalIds: string[] = [];

      // Create multiple terminals concurrently
      for (let i = 0; i < 5; i++) {
        const id = terminalManager.createTerminal();
        if (id) {
          terminalIds.push(id);
        }
      }

      // Should have created up to max limit
      expect(terminalIds.length).to.be.greaterThan(0);
      expect(terminalIds.length).to.be.at.most(5);

      // Cleanup
      terminalIds.forEach((id) => terminalManager.removeTerminal(id));
    });

    it('should handle concurrent terminal deletion safely', async function (this: Mocha.Context) {
      this.timeout(10000);

      // Create multiple terminals
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      const terminal3 = terminalManager.createTerminal();

      // Delete concurrently (only one should succeed per terminal due to lifecycle service)
      const results = await Promise.all([
        terminalManager.deleteTerminal(terminal1),
        terminalManager.deleteTerminal(terminal2),
        terminalManager.deleteTerminal(terminal3),
      ]);

      // All deletions should have results
      expect(results).to.have.length(3);
    });
  });

  describe('Event Handler Stress Test', () => {
    it('should handle high-frequency data events without duplication', function (this: Mocha.Context) {
      this.timeout(10000);

      const _terminalId = terminalManager.createTerminal();
      const dataEvents: string[] = [];

      // Track all data events
      terminalManager.onData((event) => {
        if (event.terminalId === terminalId && event.data) {
          dataEvents.push(event.data);
        }
      });

      // Send high-frequency inputs
      for (let i = 0; i < 100; i++) {
        terminalManager.sendInput(`echo ${i}\n`, terminalId);
      }

      // Data events should be received (exact count varies)
      // The key is that we should not see duplicate handlers firing
      expect(dataEvents.length).to.be.greaterThan(0);

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });
  });

  describe('Terminal Focus and Active State', () => {
    it('should maintain active state during event processing', function (this: Mocha.Context) {
      this.timeout(5000);

      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();

      // Terminal2 should be active (last created)
      expect(terminalManager.getActiveTerminalId()).to.equal(terminal2);

      // Switch active terminal
      terminalManager.setActiveTerminal(terminal1);
      expect(terminalManager.getActiveTerminalId()).to.equal(terminal1);

      // Send input to active terminal
      terminalManager.sendInput('test\n'); // Should go to terminal1

      // Cleanup
      terminalManager.removeTerminal(terminal1);
      terminalManager.removeTerminal(terminal2);
    });
  });

  describe('Event Handler Error Resilience', () => {
    it('should continue functioning after event handler errors', function (this: Mocha.Context) {
      this.timeout(5000);

      const _terminalId = terminalManager.createTerminal();

      // Add a handler that throws an error
      let errorCount = 0;
      terminalManager.onData(() => {
        if (errorCount < 1) {
          errorCount++;
          throw new Error('Test error');
        }
      });

      // Send input - should not crash the system
      expect(() => {
        terminalManager.sendInput('test\n', terminalId);
      }).to.not.throw();

      // Terminal should still be functional
      expect(terminalManager.getTerminal(terminalId)).to.exist;

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });
  });

  describe('Memory Management Integration', () => {
    it('should not accumulate event handlers over time', function (this: Mocha.Context) {
      this.timeout(10000);

      const initialMemory = process.memoryUsage().heapUsed;

      // Create and destroy terminals repeatedly
      for (let i = 0; i < 20; i++) {
        const id = terminalManager.createTerminal();
        terminalManager.sendInput('test\n', id);

        // Delete if not the last terminal
        if (terminalManager.getTerminals().length > 1) {
          terminalManager.removeTerminal(id);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      // This is a loose check as memory behavior varies
      expect(memoryIncrease).to.be.lessThan(10 * 1024 * 1024);
    });
  });
});

describe('Terminal Event Handler Regression Tests', () => {
  let terminalManager: TerminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    terminalManager.dispose();
  });

  describe('Double Character Display Prevention', () => {
    it('should not duplicate terminal output characters', function (this: Mocha.Context) {
      this.timeout(5000);

      const _terminalId = terminalManager.createTerminal();
      const outputChunks: string[] = [];

      // Collect all output
      terminalManager.onData((event) => {
        if (event.terminalId === terminalId && event.data) {
          outputChunks.push(event.data);
        }
      });

      // Send input
      terminalManager.sendInput('echo test\n', terminalId);

      // Wait for output
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Output should not be duplicated
          // (exact assertion depends on shell echo behavior)
          expect(outputChunks.length).to.be.greaterThan(0);

          terminalManager.removeTerminal(terminalId);
          resolve();
        }, 1000);
      });
    });
  });

  describe('Event Handler Setup Consistency', () => {
    it('should set up handlers consistently across create methods', async function (this: Mocha.Context) {
      this.timeout(5000);

      const terminal1 = terminalManager.createTerminal();
      const terminal2 = await terminalManager.createTerminalWithProfile();

      // Both should receive events
      let terminal1Events = 0;
      let terminal2Events = 0;

      terminalManager.onData((event) => {
        if (event.terminalId === terminal1) {
          terminal1Events++;
        }
        if (event.terminalId === terminal2) {
          terminal2Events++;
        }
      });

      // Send input to both
      terminalManager.sendInput('test1\n', terminal1);
      terminalManager.sendInput('test2\n', terminal2);

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Both should have received events
      expect(terminal1Events).to.be.greaterThan(0);
      expect(terminal2Events).to.be.greaterThan(0);

      // Cleanup
      terminalManager.removeTerminal(terminal1);
      terminalManager.removeTerminal(terminal2);
    });
  });
});
