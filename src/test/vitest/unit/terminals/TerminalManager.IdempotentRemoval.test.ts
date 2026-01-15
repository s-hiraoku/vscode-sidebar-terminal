import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import '../../../shared/TestSetup';
import { TerminalManager } from '../../../../terminals/TerminalManager';

class MockPtyProcess {
  public pid = 12345;
  onData() { return { dispose: () => {} }; }
  onExit() { return { dispose: () => {} }; }
  write() {}
  resize() {}
  kill() {}
}

describe('TerminalManager - Idempotent Removal', () => {
  let terminalManager: TerminalManager;
  let spawnStub: ReturnType<typeof vi.spyOn>;
  let mockPty: MockPtyProcess;

  beforeEach(async () => {
    mockPty = new MockPtyProcess();
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

  it('should fire terminalRemoved event exactly once even if _cleanupTerminalData is called multiple times', async () => {
    const terminalId = terminalManager.createTerminal();
    let removedEventCount = 0;

    terminalManager.onTerminalRemoved((id) => {
      if (id === terminalId) {
        removedEventCount++;
      }
    });

    // First cleanup
    (terminalManager as any)._cleanupTerminalData(terminalId);
    expect(removedEventCount).toBe(1);

    // Second cleanup (should be idempotent)
    (terminalManager as any)._cleanupTerminalData(terminalId);
    expect(removedEventCount).toBe(1, 'TerminalRemoved event should not fire twice');
  });

  it('should only fire exit event once if cleanup is already in progress', async () => {
    let exitEventCount = 0;

    terminalManager.onExit((_event) => {
      exitEventCount++;
    });

    // Trigger pty exit
    (terminalManager as any)._processCoordinator.setupTerminalEvents = vi.fn().mockImplementation((terminal, callback) => {
        // Keep track of callback
        (terminalManager as any)._lastExitCallback = callback;
    });
    
    // Re-create terminal to use our mocked setupTerminalEvents
    const terminalId2 = terminalManager.createTerminal();
    const exitCallback = (terminalManager as any)._lastExitCallback;
    
    expect(exitCallback).toBeDefined();

    // Start cleanup
    (terminalManager as any)._cleanupTerminalData(terminalId2);
    
    // Call exit callback AFTER cleanup finished
    exitCallback(terminalId2, 0);
    
    expect(exitEventCount).toBe(0, 'Exit event should not fire if terminal is already removed');
  });
});
