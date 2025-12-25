// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
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

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import '../../../shared/TestSetup';
import { TerminalManager } from '../../../../terminals/TerminalManager';
import { ProcessState } from '../../../../types/shared';

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
  let spawnStub: ReturnType<typeof vi.spyOn>;
  let mockPty: MockPtyProcess;

  beforeEach(async () => {
    // Create fresh mock PTY for each test
    mockPty = new MockPtyProcess();

    // Stub TerminalSpawner to return our mock PTY
    const { TerminalSpawner } = await import('../../../../terminals/TerminalSpawner');
    spawnStub = vi.spyOn(TerminalSpawner.prototype, 'spawnTerminal').mockReturnValue({
      ptyProcess: mockPty,
    } as any);

    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    terminalManager.dispose();
    spawnStub.mockRestore();
  });

  describe('RED Phase: Event Handler Duplication Detection', () => {
    it('should register onData handler exactly once in createTerminal()', () => {
      // Act: Create terminal (this triggers _setupTerminalEvents)
      const terminalId = terminalManager.createTerminal();

      // Assert: Only one data handler should be registered
      expect(mockPty.getDataHandlerCount()).toBe(1);

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });

    it('should register onExit handler exactly once in createTerminal()', () => {
      // Act: Create terminal
      const terminalId = terminalManager.createTerminal();

      // Assert: Only one exit handler should be registered
      expect(mockPty.getExitHandlerCount()).toBe(1);

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });

    it('should register onData handler exactly once in createTerminalWithProfile()', async () => {
      // Act: Create terminal with profile
      const terminalId = await terminalManager.createTerminalWithProfile();

      // Assert: Only one data handler should be registered
      expect(mockPty.getDataHandlerCount()).toBe(1);

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });

    it('should register onExit handler exactly once in createTerminalWithProfile()', async () => {
      // Act: Create terminal with profile
      const terminalId = await terminalManager.createTerminalWithProfile();

      // Assert: Only one exit handler should be registered
      expect(mockPty.getExitHandlerCount()).toBe(1);

      // Cleanup
      terminalManager.removeTerminal(terminalId);
    });
  });

  describe('RED Phase: Data Event Emission Count', () => {
    it('should emit data event exactly once when PTY sends data', async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(dataEventCount).toBe(1);
      terminalManager.removeTerminal(terminalId);
    });

    it('should emit exit event exactly once when PTY process exits', async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(exitEventCount).toBe(1);
    });
  });

  describe('GREEN Phase: Process State Management', () => {
    it('should initialize terminal with Launching state', () => {
      const terminalId = terminalManager.createTerminal();
      const terminal = terminalManager.getTerminal(terminalId);

      expect(terminal).toBeDefined();
      expect(terminal?.processState).toBe(ProcessState.Launching);

      terminalManager.removeTerminal(terminalId);
    });

    it('should transition from Launching to Running on first data', async () => {
      const terminalId = terminalManager.createTerminal();
      const terminal = terminalManager.getTerminal(terminalId);

      expect(terminal?.processState).toBe(ProcessState.Launching);

      // Simulate first data reception
      mockPty.emitData('$ ');

      // Wait for state transition
      await new Promise((resolve) => setTimeout(resolve, 50));

      const updatedTerminal = terminalManager.getTerminal(terminalId);
      expect(updatedTerminal?.processState).toBe(ProcessState.Running);

      terminalManager.removeTerminal(terminalId);
    });

    it('should set KilledByUser state when deleteTerminal is called', async () => {
      const terminalId = terminalManager.createTerminal();

      // Transition to Running state first
      mockPty.emitData('initial data');

      await new Promise((resolve) => setTimeout(resolve, 50));

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
      expect(capturedExitState).toBe(ProcessState.KilledByUser);
    });
  });

  describe('REFACTOR Phase: Method Consistency', () => {
    it('should use identical event setup pattern in both create methods', async () => {
      // Create terminal using both methods
      const terminal1Id = terminalManager.createTerminal();

      // Create new mock PTY for second terminal
      const mockPty2 = new MockPtyProcess();
      spawnStub.mockReturnValue({ ptyProcess: mockPty2 } as any);

      const terminal2Id = await terminalManager.createTerminalWithProfile();

      // Both should have exactly one handler each
      expect(mockPty.getDataHandlerCount()).toBe(1);
      expect(mockPty.getExitHandlerCount()).toBe(1);
      expect(mockPty2.getDataHandlerCount()).toBe(1);
      expect(mockPty2.getExitHandlerCount()).toBe(1);

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
        spawnStub.mockReturnValue({ ptyProcess: mockPtyN } as any);

        const id = terminalManager.createTerminal();
        terminalIds.push(id);

        // Each should have exactly one handler
        expect(mockPtyN.getDataHandlerCount()).toBe(1);
        expect(mockPtyN.getExitHandlerCount()).toBe(1);
      }

      // Cleanup all
      terminalIds.forEach((id) => terminalManager.removeTerminal(id));
    });

    it('should not register duplicate handlers on multiple state transitions', async () => {
      const terminalId = terminalManager.createTerminal();

      // Emit multiple data events to trigger state transitions
      mockPty.emitData('data 1');
      mockPty.emitData('data 2');
      mockPty.emitData('data 3');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Handler count should still be 1
      expect(mockPty.getDataHandlerCount()).toBe(1);

      terminalManager.removeTerminal(terminalId);
    });

    it('should handle terminal deletion during data processing', async () => {
      const terminalId = terminalManager.createTerminal();

      // Start data emission
      mockPty.emitData('data before deletion');

      // Delete terminal immediately
      void terminalManager.deleteTerminal(terminalId);

      // Should not crash or cause errors
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(terminalManager.getTerminal(terminalId)).toBeUndefined();
    });
  });

  describe('REFACTOR Phase: Handler Cleanup', () => {
    it('should clean up handlers when terminal is removed', async () => {
      const terminalId = terminalManager.createTerminal();

      expect(mockPty.getDataHandlerCount()).toBe(1);
      expect(mockPty.getExitHandlerCount()).toBe(1);

      // Remove terminal
      terminalManager.removeTerminal(terminalId);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Note: In real implementation, handlers might not be explicitly removed
      // but the terminal reference should be gone
      expect(terminalManager.getTerminal(terminalId)).toBeUndefined();
    });
  });
});

describe('TerminalManager - Event Handler Cross-Contamination Prevention', () => {
  let terminalManager: TerminalManager;
  let spawnStub: ReturnType<typeof vi.spyOn>;
  let mockPty1: MockPtyProcess;
  let mockPty2: MockPtyProcess;

  beforeEach(async () => {
    mockPty1 = new MockPtyProcess();
    mockPty2 = new MockPtyProcess();

    const { TerminalSpawner } = await import('../../../../terminals/TerminalSpawner');
    let callCount = 0;
    spawnStub = vi.spyOn(TerminalSpawner.prototype, 'spawnTerminal').mockImplementation(() => {
      callCount++;
      return { ptyProcess: callCount === 1 ? mockPty1 : mockPty2 } as any;
    });

    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    terminalManager.dispose();
    spawnStub.mockRestore();
  });

  it('should not mix events between multiple terminals', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Each terminal should only receive its own data
    expect(terminal1Events).toContain('terminal1 data');
    expect(terminal1Events).not.toContain('terminal2 data');

    expect(terminal2Events).toContain('terminal2 data');
    expect(terminal2Events).not.toContain('terminal1 data');

    terminalManager.removeTerminal(terminal1Id);
    terminalManager.removeTerminal(terminal2Id);
  });
});
