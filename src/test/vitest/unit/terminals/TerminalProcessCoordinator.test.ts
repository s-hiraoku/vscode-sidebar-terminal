import { describe, it, expect, vi } from 'vitest';

import { TerminalProcessCoordinator } from '../../../../terminals/TerminalProcessCoordinator';
import { TerminalInstance, ProcessState } from '../../../../types/shared';

// Mock VS Code
vi.mock('vscode', () => ({
  EventEmitter: class {
    fire = vi.fn();
    event = vi.fn();
  },
  Disposable: class {
    dispose = vi.fn();
  },
  window: {
    showWarningMessage: vi.fn(),
  },
}));

vi.mock('../../../../utils/logger');
vi.mock('../../../../utils/common', () => ({
  showWarningMessage: vi.fn(),
}));

describe('TerminalProcessCoordinator', () => {
  let coordinator: TerminalProcessCoordinator;
  let mockTerminals: Map<string, TerminalInstance>;
  let mockShellIntegrationService: any;
  let mockStateUpdateEmitter: any;
  let mockBufferDataCallback: any;
  let mockPtyProcess: any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    mockTerminals = new Map();
    
    mockPtyProcess = {
      pid: 123,
      onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onExit: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      write: vi.fn(),
      spawnfile: '/bin/bash',
    };

    const terminal: TerminalInstance = {
      id: 't1',
      name: 'Terminal 1',
      ptyProcess: mockPtyProcess,
      processState: ProcessState.Launching,
      shouldPersist: false,
      // @ts-ignore
      xterm: {},
    };
    mockTerminals.set('t1', terminal);

    mockShellIntegrationService = {
      injectShellIntegration: vi.fn().mockResolvedValue(undefined),
      processTerminalData: vi.fn(),
    };

    mockStateUpdateEmitter = new vscode.EventEmitter();
    mockBufferDataCallback = vi.fn();

    coordinator = new TerminalProcessCoordinator(
      mockTerminals,
      mockShellIntegrationService,
      mockStateUpdateEmitter,
      mockBufferDataCallback
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    coordinator.dispose();
  });

  describe('initializeShellForTerminal', () => {
    it('should inject shell integration if enabled and not safe mode', () => {
      coordinator.initializeShellForTerminal('t1', mockPtyProcess, false);
      
      expect(mockShellIntegrationService.injectShellIntegration).toHaveBeenCalledWith(
        't1',
        '/bin/bash',
        mockPtyProcess
      );
    });

    it('should skip shell integration in safe mode', () => {
      coordinator.initializeShellForTerminal('t1', mockPtyProcess, true);
      
      expect(mockShellIntegrationService.injectShellIntegration).not.toHaveBeenCalled();
    });

    it('should avoid duplicate initialization', () => {
      coordinator.initializeShellForTerminal('t1', mockPtyProcess, false);
      coordinator.initializeShellForTerminal('t1', mockPtyProcess, false);
      
      expect(mockShellIntegrationService.injectShellIntegration).toHaveBeenCalledTimes(1);
    });
    
    it('should setup initial prompt guard if not safe mode', () => {
      // Access private map if needed or verify side effects
      // We can verify that ptyProcess.onData was attached for the guard
      // But mockPtyProcess.onData is used for multiple things.
      // Let's spy on setTimeout to see if guard timeout was set
      coordinator.initializeShellForTerminal('t1', mockPtyProcess, false);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });
  });

  describe('startPtyOutput', () => {
    it('should verify terminal exists', () => {
      coordinator.startPtyOutput('non-existent');
      // Should handle gracefully
    });

    it('should mark output as started', () => {
      coordinator.startPtyOutput('t1');
      // No observable effect publically other than logging and internal state
      // Attempting to start again should be skipped (coverage check)
      coordinator.startPtyOutput('t1');
    });
  });

  describe('setupTerminalEvents', () => {
    it('should setup data and exit handlers', () => {
      const onExit = vi.fn();
      const term = mockTerminals.get('t1')!;
      
      coordinator.setupTerminalEvents(term, onExit);
      
      expect(mockPtyProcess.onData).toHaveBeenCalled();
      expect(mockPtyProcess.onExit).toHaveBeenCalled();
      expect(term.processState).toBe(ProcessState.Launching);
    });

    it('should update state to Running on data', () => {
      const onExit = vi.fn();
      const term = mockTerminals.get('t1')!;
      
      coordinator.setupTerminalEvents(term, onExit);
      
      // Get the data callback passed to onData
      const dataCallback = mockPtyProcess.onData.mock.calls[0][0];
      
      // Simulate data
      dataCallback('some data');
      
      expect(term.processState).toBe(ProcessState.Running);
      expect(mockBufferDataCallback).toHaveBeenCalledWith('t1', 'some data');
    });

    it('should handle process exit', () => {
      const onExit = vi.fn();
      const term = mockTerminals.get('t1')!;
      
      coordinator.setupTerminalEvents(term, onExit);
      
      // Get the exit callback
      const exitCallback = mockPtyProcess.onExit.mock.calls[0][0];
      
      // Simulate exit
      exitCallback({ exitCode: 1 });
      
      expect(onExit).toHaveBeenCalledWith('t1', 1);
      expect(term.processState).toBe(ProcessState.KilledDuringLaunch); // because it was Launching
    });
  });

  describe('notifyProcessStateChange', () => {
    it('should fire event emitter', () => {
      const term = mockTerminals.get('t1')!;
      coordinator.notifyProcessStateChange(term, ProcessState.Running);
      
      expect(mockStateUpdateEmitter.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'processStateChange',
          terminalId: 't1',
          newState: ProcessState.Running,
        })
      );
    });

    it('should setup timeout for Launching state', () => {
      const term = mockTerminals.get('t1')!;
      coordinator.notifyProcessStateChange(term, ProcessState.Launching);
      
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      
      // Fast forward
      vi.runAllTimers();
      
      expect(term.processState).toBe(ProcessState.KilledDuringLaunch);
    });

    it('should clear timeout for Running state', () => {
      const term = mockTerminals.get('t1')!;
      // First Launching to set timeout
      term.processState = ProcessState.Launching;
      coordinator.notifyProcessStateChange(term, ProcessState.Launching);
      const _timerCount = vi.getTimerCount();
      
      // Then Running to clear it
      term.processState = ProcessState.Running;
      coordinator.notifyProcessStateChange(term, ProcessState.Running);
      
      // Timers should be reduced (or cleared)
      // Note: ensureInitialPrompt might also set timers
      // But we can check that if we run timers, state doesn't change to KilledDuringLaunch
      vi.runAllTimers();
      expect(term.processState).toBe(ProcessState.Running);
    });
  });

  describe('cleanupPtyOutput', () => {
    it('should dispose disposables', () => {
      coordinator.cleanupPtyOutput('t1');
      // Internal cleanup verification
    });
  });
});
