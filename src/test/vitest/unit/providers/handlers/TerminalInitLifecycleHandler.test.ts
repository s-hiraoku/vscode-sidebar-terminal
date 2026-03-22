/**
 * TerminalInitLifecycleHandler Tests
 *
 * Tests for the terminal initialization lifecycle handler extracted from
 * SecondaryTerminalProvider. Covers terminal ready, init complete, watchdog
 * registration, and terminal ensure logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    }),
  },
}));

vi.mock('../../../../../shared/constants', () => ({
  SHARED_TERMINAL_COMMANDS: {
    START_OUTPUT: 'startOutput',
  },
}));

vi.mock('../../../../../constants', () => ({
  TERMINAL_CONSTANTS: {
    COMMANDS: {
      START_OUTPUT: 'startOutput',
    },
  },
}));

import {
  TerminalInitLifecycleHandler,
  ITerminalInitLifecycleDependencies,
} from '../../../../../providers/handlers/TerminalInitLifecycleHandler';
import { WebviewMessage } from '../../../../../types/common';

function createMockDeps(
  overrides: Partial<ITerminalInitLifecycleDependencies> = {}
): ITerminalInitLifecycleDependencies {
  return {
    getTerminal: vi.fn().mockReturnValue({ id: 'term-1', ptyProcess: {} }),
    getTerminals: vi.fn().mockReturnValue([]),
    getActiveTerminalId: vi.fn().mockReturnValue('term-1'),
    createTerminal: vi.fn().mockReturnValue('term-2'),
    setActiveTerminal: vi.fn(),
    initializeShellForTerminal: vi.fn(),
    startPtyOutput: vi.fn(),
    consumeCreationDisplayModeOverride: vi.fn().mockReturnValue(undefined),
    getCurrentState: vi.fn().mockReturnValue({ terminals: [], activeTerminalId: 'term-1' }),
    onTerminalCreated: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onTerminalRemoved: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getCurrentFontSettings: vi.fn().mockReturnValue({ fontSize: 14, fontFamily: 'monospace' }),
    sendFullCliAgentStateSync: vi.fn(),
    addDisposable: vi.fn(),
    isWebViewInitialized: vi.fn().mockReturnValue(true),
    watchdogCoordinator: {
      recordInitStart: vi.fn(),
      startForTerminal: vi.fn(),
      stopForTerminal: vi.fn(),
      addPendingTerminal: vi.fn(),
      getPhase: vi.fn().mockReturnValue('ack'),
      isInSafeMode: vi.fn().mockReturnValue(false),
      clearSafeMode: vi.fn(),
      markInitSuccess: vi.fn(),
      startPendingWatchdogs: vi.fn(),
    },
    terminalInitStateMachine: {
      getState: vi.fn().mockReturnValue(0),
      markViewPending: vi.fn(),
      markPtySpawned: vi.fn(),
      markViewReady: vi.fn(),
      markShellInitializing: vi.fn(),
      markShellInitialized: vi.fn(),
      markOutputStreaming: vi.fn(),
      markPromptReady: vi.fn(),
      markFailed: vi.fn(),
      reset: vi.fn(),
    },
    eventCoordinator: {
      flushBufferedOutput: vi.fn(),
    },
    safeProcessCwd: vi.fn().mockReturnValue('/home/user'),
    ...overrides,
  };
}

describe('TerminalInitLifecycleHandler', () => {
  let handler: TerminalInitLifecycleHandler;
  let deps: ITerminalInitLifecycleDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    handler = new TerminalInitLifecycleHandler(deps);
  });

  describe('handleTerminalReady', () => {
    it('should return early when terminalId is missing', async () => {
      const msg = { command: 'terminalReady' } as unknown as WebviewMessage;
      await handler.handleTerminalReady(msg);
      expect(deps.watchdogCoordinator.startForTerminal).not.toHaveBeenCalled();
    });

    it('should advance state to ViewReady when state is below ViewReady', async () => {
      (deps.terminalInitStateMachine.getState as ReturnType<typeof vi.fn>).mockReturnValue(0);
      const msg = {
        command: 'terminalReady',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      await handler.handleTerminalReady(msg);

      expect(deps.terminalInitStateMachine.markViewReady).toHaveBeenCalledWith(
        'term-1',
        'terminalReady'
      );
      expect(deps.watchdogCoordinator.startForTerminal).toHaveBeenCalledWith(
        'term-1',
        'prompt',
        'terminalReady'
      );
    });

    it('should not advance state when already at or above ViewReady', async () => {
      (deps.terminalInitStateMachine.getState as ReturnType<typeof vi.fn>).mockReturnValue(3);
      const msg = {
        command: 'terminalReady',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      await handler.handleTerminalReady(msg);

      expect(deps.terminalInitStateMachine.markViewReady).not.toHaveBeenCalled();
    });
  });

  describe('handleTerminalInitializationComplete', () => {
    it('should return early when terminalId is missing', async () => {
      const msg = { command: 'terminalInitializationComplete' } as unknown as WebviewMessage;
      await handler.handleTerminalInitializationComplete(msg);
      expect(deps.watchdogCoordinator.stopForTerminal).not.toHaveBeenCalled();
    });

    it('should ignore duplicate when prompt phase already active and past ViewReady', async () => {
      (deps.watchdogCoordinator.getPhase as ReturnType<typeof vi.fn>).mockReturnValue('prompt');
      (deps.terminalInitStateMachine.getState as ReturnType<typeof vi.fn>).mockReturnValue(2); // ViewReady
      const msg = {
        command: 'terminalInitializationComplete',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      await handler.handleTerminalInitializationComplete(msg);

      expect(deps.initializeShellForTerminal).not.toHaveBeenCalled();
    });

    it('should retry when terminal pty is not ready', async () => {
      vi.useFakeTimers();
      (deps.getTerminal as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'term-1' }); // no ptyProcess
      (deps.watchdogCoordinator.getPhase as ReturnType<typeof vi.fn>).mockReturnValue('ack');
      const msg = {
        command: 'terminalInitializationComplete',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      await handler.handleTerminalInitializationComplete(msg);

      // Should schedule a retry
      expect(deps.initializeShellForTerminal).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should give up after max retries', async () => {
      vi.useFakeTimers();
      (deps.getTerminal as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (deps.watchdogCoordinator.getPhase as ReturnType<typeof vi.fn>).mockReturnValue('ack');
      const msg = {
        command: 'terminalInitializationComplete',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      // Call 6 times to exceed max retries of 5
      for (let i = 0; i < 6; i++) {
        await handler.handleTerminalInitializationComplete(msg);
      }

      expect(deps.initializeShellForTerminal).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should initialize shell and start pty output on success', async () => {
      (deps.watchdogCoordinator.getPhase as ReturnType<typeof vi.fn>).mockReturnValue('ack');
      (deps.terminalInitStateMachine.getState as ReturnType<typeof vi.fn>).mockReturnValue(1);
      const msg = {
        command: 'terminalInitializationComplete',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      await handler.handleTerminalInitializationComplete(msg);

      expect(deps.watchdogCoordinator.stopForTerminal).toHaveBeenCalledWith('term-1', 'webviewAck');
      expect(deps.terminalInitStateMachine.markViewReady).toHaveBeenCalledWith(
        'term-1',
        'webviewAck'
      );
      expect(deps.initializeShellForTerminal).toHaveBeenCalledWith('term-1', {}, false);
      expect(deps.startPtyOutput).toHaveBeenCalledWith('term-1');
      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'startOutput',
          terminalId: 'term-1',
        })
      );
      expect(deps.terminalInitStateMachine.markPromptReady).toHaveBeenCalledWith(
        'term-1',
        'startOutput'
      );
      expect(deps.watchdogCoordinator.markInitSuccess).toHaveBeenCalledWith('term-1');
    });

    it('should handle shell initialization failure gracefully', async () => {
      (deps.watchdogCoordinator.getPhase as ReturnType<typeof vi.fn>).mockReturnValue('ack');
      (deps.terminalInitStateMachine.getState as ReturnType<typeof vi.fn>).mockReturnValue(1);
      (deps.initializeShellForTerminal as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('shell init failed');
      });
      const msg = {
        command: 'terminalInitializationComplete',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      await handler.handleTerminalInitializationComplete(msg);

      expect(deps.terminalInitStateMachine.markFailed).toHaveBeenCalledWith(
        'term-1',
        'initializeShell'
      );
      expect(deps.startPtyOutput).not.toHaveBeenCalled();
    });

    it('should handle pty output start failure gracefully', async () => {
      (deps.watchdogCoordinator.getPhase as ReturnType<typeof vi.fn>).mockReturnValue('ack');
      (deps.terminalInitStateMachine.getState as ReturnType<typeof vi.fn>).mockReturnValue(1);
      (deps.startPtyOutput as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('pty output failed');
      });
      const msg = {
        command: 'terminalInitializationComplete',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      await handler.handleTerminalInitializationComplete(msg);

      expect(deps.terminalInitStateMachine.markFailed).toHaveBeenCalledWith(
        'term-1',
        'startPtyOutput'
      );
    });
  });

  describe('sendInitializationComplete', () => {
    it('should send initializationComplete message with terminal count', async () => {
      await handler.sendInitializationComplete(3);
      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'initializationComplete',
          terminalCount: 3,
        })
      );
    });
  });

  describe('initializeTerminal', () => {
    it('should send terminalCreated for each existing terminal', async () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([
        { id: 'term-1', name: 'Terminal 1', cwd: '/home' },
        { id: 'term-2', name: 'Terminal 2', cwd: '/tmp' },
      ]);
      (deps.getActiveTerminalId as ReturnType<typeof vi.fn>).mockReturnValue('term-1');

      await handler.initializeTerminal();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalCreated',
          terminal: expect.objectContaining({ id: 'term-1', isActive: true }),
        })
      );
      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalCreated',
          terminal: expect.objectContaining({ id: 'term-2', isActive: false }),
        })
      );
    });

    it('should send stateUpdate after terminal creation messages', async () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([]);
      await handler.initializeTerminal();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'stateUpdate' })
      );
    });

    it('should include font settings in config', async () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([
        { id: 'term-1', name: 'T1' },
      ]);

      await handler.initializeTerminal();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            fontSettings: { fontSize: 14, fontFamily: 'monospace' },
          }),
        })
      );
    });

    it('should include displayModeOverride when present', async () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([
        { id: 'term-1', name: 'T1' },
      ]);
      (deps.consumeCreationDisplayModeOverride as ReturnType<typeof vi.fn>).mockReturnValue('tab');

      await handler.initializeTerminal();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ displayModeOverride: 'tab' }),
        })
      );
    });
  });

  describe('ensureMultipleTerminals', () => {
    it('should create a terminal when none exist', () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([]);
      handler.ensureMultipleTerminals();

      expect(deps.createTerminal).toHaveBeenCalled();
      expect(deps.setActiveTerminal).toHaveBeenCalledWith('term-2');
    });

    it('should not create a terminal when one already exists', () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 'term-1' }]);
      handler.ensureMultipleTerminals();

      expect(deps.createTerminal).not.toHaveBeenCalled();
    });

    it('should handle createTerminal returning null gracefully', () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (deps.createTerminal as ReturnType<typeof vi.fn>).mockReturnValue(null);

      handler.ensureMultipleTerminals();

      expect(deps.setActiveTerminal).not.toHaveBeenCalled();
    });
  });

  describe('syncTerminalStateToWebView', () => {
    it('should re-initialize terminals and sync CLI agent state', async () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([]);
      handler.syncTerminalStateToWebView();

      expect(deps.sendFullCliAgentStateSync).toHaveBeenCalled();
    });
  });

  describe('registerInitializationWatchdogs', () => {
    it('should register onTerminalCreated and onTerminalRemoved listeners', () => {
      handler.registerInitializationWatchdogs();

      expect(deps.onTerminalCreated).toHaveBeenCalled();
      expect(deps.onTerminalRemoved).toHaveBeenCalled();
      expect(deps.addDisposable).toHaveBeenCalledTimes(2);
    });

    it('should start watchdog for existing terminals when webview is initialized', () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 'term-1' }]);
      (deps.isWebViewInitialized as ReturnType<typeof vi.fn>).mockReturnValue(true);

      handler.registerInitializationWatchdogs();

      expect(deps.watchdogCoordinator.recordInitStart).toHaveBeenCalledWith('term-1');
      expect(deps.watchdogCoordinator.startForTerminal).toHaveBeenCalledWith(
        'term-1',
        'ack',
        'existingTerminal'
      );
    });

    it('should add pending terminal when webview is not initialized', () => {
      (deps.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 'term-1' }]);
      (deps.isWebViewInitialized as ReturnType<typeof vi.fn>).mockReturnValue(false);

      handler.registerInitializationWatchdogs();

      expect(deps.watchdogCoordinator.addPendingTerminal).toHaveBeenCalledWith('term-1');
    });

    it('should handle errors gracefully', () => {
      (deps.onTerminalCreated as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('event error');
      });

      // Should not throw
      handler.registerInitializationWatchdogs();
    });

    it('should call callback for terminal created event that records init and starts watchdog', () => {
      let createdCallback: ((terminal: { id: string }) => void) | undefined;
      (deps.onTerminalCreated as ReturnType<typeof vi.fn>).mockImplementation((cb: any) => {
        createdCallback = cb;
        return { dispose: vi.fn() };
      });

      handler.registerInitializationWatchdogs();
      expect(createdCallback).toBeDefined();

      // Simulate terminal creation
      createdCallback!({ id: 'new-term' });

      expect(deps.watchdogCoordinator.recordInitStart).toHaveBeenCalledWith('new-term');
      expect(deps.terminalInitStateMachine.markViewPending).toHaveBeenCalledWith(
        'new-term',
        'terminalCreated'
      );
      expect(deps.terminalInitStateMachine.markPtySpawned).toHaveBeenCalledWith(
        'new-term',
        'terminalCreated'
      );
    });

    it('should call callback for terminal removed event that stops watchdog and resets state', () => {
      let removedCallback: ((terminalId: string) => void) | undefined;
      (deps.onTerminalRemoved as ReturnType<typeof vi.fn>).mockImplementation((cb: any) => {
        removedCallback = cb;
        return { dispose: vi.fn() };
      });

      handler.registerInitializationWatchdogs();
      expect(removedCallback).toBeDefined();

      removedCallback!('term-1');

      expect(deps.watchdogCoordinator.stopForTerminal).toHaveBeenCalledWith(
        'term-1',
        'terminalRemoved'
      );
      expect(deps.terminalInitStateMachine.reset).toHaveBeenCalledWith('term-1');
    });
  });
});
