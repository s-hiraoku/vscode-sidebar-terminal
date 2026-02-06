/**
 * TerminalKillService Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    }),
  },
  window: {
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  TerminalKillService,
  ITerminalKillDependencies,
} from '../../../../../providers/services/TerminalKillService';
import * as vscode from 'vscode';

function createMockDeps(): ITerminalKillDependencies {
  return {
    getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
    getTerminal: vi.fn().mockReturnValue({ name: 'Test Terminal' }),
    killTerminal: vi.fn().mockResolvedValue(undefined),
    getCurrentState: vi.fn().mockReturnValue({ terminals: [] }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };
}

describe('TerminalKillService', () => {
  let service: TerminalKillService;
  let deps: ITerminalKillDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset vscode mock to default (no confirmation)
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    } as any);
    deps = createMockDeps();
    service = new TerminalKillService(deps);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('killTerminal', () => {
    it('should kill active terminal without confirmation', async () => {
      vi.useFakeTimers();
      const killPromise = service.killTerminal();
      await vi.advanceTimersByTimeAsync(50);
      await killPromise;

      expect(deps.killTerminal).toHaveBeenCalledWith('terminal-1');
      expect(deps.sendMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ command: 'terminalRemoved', terminalId: 'terminal-1' })
      );
      expect(deps.sendMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ command: 'stateUpdate' })
      );
    });

    it('should short-circuit duplicate kill attempts while in flight', async () => {
      vi.useFakeTimers();
      vi.mocked(deps.killTerminal).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 10);
          })
      );

      const first = service.killTerminal();
      const second = service.killTerminal();
      await vi.advanceTimersByTimeAsync(100);
      await Promise.all([first, second]);

      expect(deps.killTerminal).toHaveBeenCalledWith('terminal-1');
      expect(deps.killTerminal).toHaveBeenCalledTimes(1);
    });

    it('should not kill when no active terminal', async () => {
      vi.mocked(deps.getActiveTerminalId).mockReturnValue(null);

      await service.killTerminal();

      expect(deps.killTerminal).not.toHaveBeenCalled();
    });

    it('should show confirmation when confirmBeforeKill is true', async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn().mockReturnValue(true),
      } as any);
      vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Kill Terminal' as any);

      await service.killTerminal();

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(deps.killTerminal).toHaveBeenCalledWith('terminal-1');
    });

    it('should cancel kill when user declines confirmation', async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn().mockReturnValue(true),
      } as any);
      vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);

      await service.killTerminal();

      expect(deps.killTerminal).not.toHaveBeenCalled();
    });

    it('should send failure response when kill throws', async () => {
      vi.mocked(deps.killTerminal).mockRejectedValue(new Error('Kill failed'));

      await service.killTerminal();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'deleteTerminalResponse',
          terminalId: 'terminal-1',
          success: false,
        })
      );
      // Should NOT send terminalRemoved on failure
      expect(deps.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ command: 'terminalRemoved' })
      );
    });
  });

  describe('killSpecificTerminal', () => {
    it('should kill the specified terminal', async () => {
      vi.useFakeTimers();
      const killPromise = service.killSpecificTerminal('terminal-3');
      await vi.advanceTimersByTimeAsync(50);
      await killPromise;

      expect(deps.killTerminal).toHaveBeenCalledWith('terminal-3');
      expect(deps.sendMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ command: 'terminalRemoved', terminalId: 'terminal-3' })
      );
      expect(deps.sendMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ command: 'stateUpdate' })
      );
    });

    it('should short-circuit duplicate killSpecificTerminal requests while in flight', async () => {
      vi.useFakeTimers();
      vi.mocked(deps.killTerminal).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 10);
          })
      );

      const first = service.killSpecificTerminal('terminal-3');
      const second = service.killSpecificTerminal('terminal-3');
      await vi.advanceTimersByTimeAsync(100);
      await Promise.all([first, second]);

      expect(deps.killTerminal).toHaveBeenCalledWith('terminal-3');
      expect(deps.killTerminal).toHaveBeenCalledTimes(1);
    });
  });
});
