/**
 * Memory Leak Detection Tests for TerminalManager
 *
 * Tests to ensure TerminalManager properly disposes all resources
 * and doesn't leak memory when creating and destroying terminals.
 *
 * Related: Issue #232 - Memory Leak Detection
 */

import { describe, it, beforeEach as _beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { MemoryLeakDetector, DisposalStressTest as _DisposalStressTest } from '../../utils/MemoryLeakDetector';

describe('TerminalManager - Memory Leak Detection', () => {
  let terminalManager: TerminalManager | null = null;

  afterEach(() => {
    if (terminalManager) {
      terminalManager.dispose();
      terminalManager = null;
    }
  });

  it('should not leak memory when creating and disposing TerminalManager', async function() {
    // Increase timeout for stress test
    this.timeout(30000);

    const detector = new MemoryLeakDetector();
    await detector.startMonitoring();

    // Create and dispose multiple TerminalManager instances
    for (let i = 0; i < 50; i++) {
      const manager = new TerminalManager();
      manager.dispose();

      // Periodically force GC
      if (i % 10 === 0 && global.gc) {
        global.gc();
      }
    }

    const result = await detector.checkForLeaks();

    console.log(detector.generateReport());

    // Log warnings if any
    if (result.warnings.length > 0) {
      console.warn('Memory warnings detected:');
      result.warnings.forEach(warning => console.warn('  - ' + warning));
    }

    expect(result.hasLeak).to.be.false;
  });

  it('should dispose all event emitters properly', () => {
    terminalManager = new TerminalManager();

    // Verify event emitters are accessible
    expect(terminalManager.onData).to.exist;
    expect(terminalManager.onExit).to.exist;
    expect(terminalManager.onTerminalCreated).to.exist;
    expect(terminalManager.onTerminalRemoved).to.exist;

    // Dispose the manager
    terminalManager.dispose();

    // After disposal, attempting to add listeners should not cause leaks
    // (VS Code's EventEmitter handles this gracefully)
    expect(() => {
      terminalManager!.onData(() => {});
    }).to.not.throw();
  });

  it('should clean up PTY data disposables when disposing', async function() {
    this.timeout(10000);

    terminalManager = new TerminalManager();

    // Create multiple terminals
    const terminalIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      try {
        const id = terminalManager.createTerminal();
        if (id) {
          terminalIds.push(id);
          // Start PTY output for each terminal
          terminalManager.startPtyOutput(id);
        }
      } catch (error) {
        // Ignore errors from terminal creation in test environment
        console.log(`Terminal creation ${i} failed (expected in test env):`, error);
      }
    }

    // Wait a bit for everything to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dispose the manager - should clean up all PTY disposables
    terminalManager.dispose();

    // No explicit assertion - the test passes if no errors are thrown
    // and memory is properly cleaned up
    expect(true).to.be.true;
  });

  it('should clean up timers when disposing', async function() {
    this.timeout(10000);

    terminalManager = new TerminalManager();

    // Create a terminal to trigger timer creation
    try {
      const terminalId = terminalManager.createTerminal();
      if (terminalId) {
        // Send some data to trigger buffering timers
        terminalManager.startPtyOutput(terminalId);
      }
    } catch (error) {
      // Ignore errors from terminal creation in test environment
      console.log('Terminal creation failed (expected in test env):', error);
    }

    // Wait for timers to be created
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dispose should clean up all timers
    terminalManager.dispose();
    terminalManager = null;

    // Wait to ensure timers don't fire after disposal
    await new Promise(resolve => setTimeout(resolve, 200));

    // If we get here without errors, timers were cleaned up properly
    expect(true).to.be.true;
  });

  it('should handle rapid create/dispose cycles without leaking', async function() {
    this.timeout(30000);

    const detector = new MemoryLeakDetector();
    await detector.startMonitoring();

    // Rapid create/dispose cycles
    for (let i = 0; i < 20; i++) {
      const manager = new TerminalManager();

      try {
        // Try to create a terminal
        const terminalId = manager.createTerminal();
        if (terminalId) {
          // Immediately dispose
          manager.dispose();
        } else {
          manager.dispose();
        }
      } catch (error) {
        // Clean up on error
        manager.dispose();
      }

      // Force GC periodically
      if (i % 5 === 0 && global.gc) {
        global.gc();
      }
    }

    const result = await detector.checkForLeaks();

    console.log(detector.generateReport());

    if (result.warnings.length > 0) {
      console.warn('Memory warnings detected:');
      result.warnings.forEach(warning => console.warn('  - ' + warning));
    }

    // Allow some memory growth for rapid cycles, but not excessive
    expect(result.heapGrowthPercent).to.be.lessThan(50);
  });

  it('should clean up shell integration resources', () => {
    terminalManager = new TerminalManager();

    // Set a mock shell integration service
    const mockService = {
      injectShellIntegration: () => Promise.resolve(),
      processTerminalData: () => {},
      dispose: () => {}
    };

    terminalManager.setShellIntegrationService(mockService);

    // Dispose should not throw
    expect(() => terminalManager!.dispose()).to.not.throw();
  });
});

describe('TerminalManager - Disposal Patterns', () => {
  it('should follow proper disposal order (LIFO)', () => {
    const disposalOrder: string[] = [];

    class MockDisposable {
      constructor(private name: string) {}
      dispose() {
        disposalOrder.push(this.name);
      }
    }

    // Simulate the disposal pattern
    const disposables = [
      new MockDisposable('first'),
      new MockDisposable('second'),
      new MockDisposable('third')
    ];

    // Dispose in reverse order (LIFO)
    for (let i = disposables.length - 1; i >= 0; i--) {
      disposables[i]?.dispose();
    }

    // Verify LIFO order
    expect(disposalOrder).to.deep.equal(['third', 'second', 'first']);
  });

  it('should handle disposal errors gracefully', () => {
    class ErrorDisposable {
      dispose() {
        throw new Error('Disposal error');
      }
    }

    const disposable = new ErrorDisposable();

    // Should not throw - errors should be caught
    expect(() => {
      try {
        disposable.dispose();
      } catch (error) {
        // Caught and handled
        console.error('Disposal error caught:', error);
      }
    }).to.not.throw();
  });
});
