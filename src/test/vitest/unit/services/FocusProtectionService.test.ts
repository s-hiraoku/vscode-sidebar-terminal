import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('vscode', () => {
  const onDidChangeActiveTerminalListeners: Array<(terminal: unknown) => void> = [];
  const onDidOpenTerminalListeners: Array<(terminal: unknown) => void> = [];
  const onDidChangeConfigurationListeners: Array<(e: unknown) => void> = [];

  class ThemeIcon {
    constructor(public id: string) {}
  }

  return {
    window: {
      onDidChangeActiveTerminal: vi.fn((listener: (terminal: unknown) => void) => {
        onDidChangeActiveTerminalListeners.push(listener);
        return {
          dispose: vi.fn(() => {
            const idx = onDidChangeActiveTerminalListeners.indexOf(listener);
            if (idx >= 0) onDidChangeActiveTerminalListeners.splice(idx, 1);
          }),
        };
      }),
      onDidOpenTerminal: vi.fn((listener: (terminal: unknown) => void) => {
        onDidOpenTerminalListeners.push(listener);
        return {
          dispose: vi.fn(() => {
            const idx = onDidOpenTerminalListeners.indexOf(listener);
            if (idx >= 0) onDidOpenTerminalListeners.splice(idx, 1);
          }),
        };
      }),
      _onDidChangeActiveTerminalListeners: onDidChangeActiveTerminalListeners,
      _onDidOpenTerminalListeners: onDidOpenTerminalListeners,
    },
    workspace: {
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(true),
      }),
      onDidChangeConfiguration: vi.fn((listener: (e: unknown) => void) => {
        onDidChangeConfigurationListeners.push(listener);
        return {
          dispose: vi.fn(() => {
            const idx = onDidChangeConfigurationListeners.indexOf(listener);
            if (idx >= 0) onDidChangeConfigurationListeners.splice(idx, 1);
          }),
        };
      }),
      _onDidChangeConfigurationListeners: onDidChangeConfigurationListeners,
    },
    commands: {
      executeCommand: vi.fn().mockResolvedValue(undefined),
    },
    ThemeIcon,
  };
});

import * as vscode from 'vscode';
import { FocusProtectionService } from '../../../../services/FocusProtectionService';

function fireActiveTerminalChanged(terminal: unknown): void {
  const listeners = (vscode.window as any)._onDidChangeActiveTerminalListeners;
  for (const listener of listeners) {
    listener(terminal);
  }
}

function fireOpenTerminal(terminal: unknown): void {
  const listeners = (vscode.window as any)._onDidOpenTerminalListeners;
  for (const listener of listeners) {
    listener(terminal);
  }
}

function fireConfigurationChanged(affectsConfiguration: (section: string) => boolean): void {
  const listeners = (vscode.workspace as any)._onDidChangeConfigurationListeners;
  for (const listener of listeners) {
    listener({ affectsConfiguration });
  }
}

describe('FocusProtectionService', () => {
  let service: FocusProtectionService;
  let mockIsTerminalFocused: ReturnType<typeof vi.fn<() => boolean>>;
  let mockIsWebViewVisible: ReturnType<typeof vi.fn<() => boolean>>;
  let mockSendWebviewFocus: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    (vscode.window as any)._onDidChangeActiveTerminalListeners.length = 0;
    (vscode.workspace as any)._onDidChangeConfigurationListeners.length = 0;

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'focusProtection') return true;
        return undefined;
      }),
    } as any);

    mockIsTerminalFocused = vi.fn().mockReturnValue(false);
    mockIsWebViewVisible = vi.fn().mockReturnValue(true);
    mockSendWebviewFocus = vi.fn();

    service = new FocusProtectionService({
      isTerminalFocused: mockIsTerminalFocused,
      isWebViewVisible: mockIsWebViewVisible,
      sendWebviewFocus: mockSendWebviewFocus,
    });
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should register onDidChangeActiveTerminal listener', () => {
      expect(vscode.window.onDidChangeActiveTerminal).toHaveBeenCalledOnce();
    });

    it('should register onDidChangeConfiguration listener', () => {
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalledOnce();
    });

    it('should read initial focusProtection setting', () => {
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('secondaryTerminal');
    });
  });

  describe('focus restoration with recent focus tracking', () => {
    it('should restore focus when terminal is currently focused', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
    });

    it('should restore focus when terminal was recently focused (blur arrived first)', () => {
      // Simulate: terminal was focused, then blur arrived before onDidChangeActiveTerminal
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      // Notify focus was gained 50ms ago
      service.notifyFocusChanged(true);
      vi.advanceTimersByTime(50);

      // Now blur has arrived (isTerminalFocused=false) but recent focus window still open
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
    });

    it('should NOT restore focus when terminal was NOT recently focused', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      // No notifyFocusChanged called, and isTerminalFocused is false
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should NOT restore focus after recent focus window expires', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyFocusChanged(true);
      // Wait longer than RECENT_FOCUS_WINDOW_MS (600ms)
      vi.advanceTimersByTime(700);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should restore focus when recent focus was within 500ms (within 600ms window)', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyFocusChanged(true);
      // 500ms is within the 600ms window — still protected
      vi.advanceTimersByTime(500);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
    });

    it('should NOT restore focus when WebView is not visible', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(false);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should NOT restore focus when active terminal becomes undefined', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      fireActiveTerminalChanged(undefined);
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should debounce rapid terminal changes', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'bash' });
      fireActiveTerminalChanged({ name: 'zsh' });
      fireActiveTerminalChanged({ name: 'fish' });

      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('cooldown', () => {
    it('should skip restoration during cooldown period', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
    });

    it('should allow restoration after cooldown expires', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
    });
  });

  describe('setting: focusProtection disabled', () => {
    it('should NOT restore focus when disabled', () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'focusProtection') return false;
          return undefined;
        }),
      } as any);

      service.dispose();
      (vscode.window as any)._onDidChangeActiveTerminalListeners.length = 0;
      service = new FocusProtectionService({
        isTerminalFocused: mockIsTerminalFocused,
        isWebViewVisible: mockIsWebViewVisible,
      });

      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should respond to runtime configuration changes', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'focusProtection') return false;
          return undefined;
        }),
      } as any);
      fireConfigurationChanged(
        (section: string) => section === 'secondaryTerminal.focusProtection'
      );

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('notifyInteraction (typing keeps focus window fresh)', () => {
    it('should refresh recent-focus window when user interacts', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      // Initial focus 400ms ago
      service.notifyFocusChanged(true);
      vi.advanceTimersByTime(400);

      // User is actively typing → interaction refreshes the window
      service.notifyInteraction();
      vi.advanceTimersByTime(400);

      // 800ms since initial focus, but only 400ms since last interaction → still protected
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
    });

    it('should NOT refresh window when terminal is not visible (avoid false positives)', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(false);

      // WebView hidden — interaction should not update the window
      service.notifyInteraction();
      vi.advanceTimersByTime(100);

      mockIsWebViewVisible.mockReturnValue(true);
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should restore focus when blur happens immediately after recent interaction without active terminal change', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyFocusChanged(true);
      service.notifyInteraction();

      mockIsTerminalFocused.mockReturnValue(false);
      service.notifyFocusChanged(false);
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
      expect(mockSendWebviewFocus).toHaveBeenCalledTimes(1);
    });

    it('should NOT restore focus on blur without recent interaction when active terminal does not change', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyFocusChanged(true);
      vi.advanceTimersByTime(250);

      mockIsTerminalFocused.mockReturnValue(false);
      service.notifyFocusChanged(false);
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      expect(mockSendWebviewFocus).not.toHaveBeenCalled();
    });
  });

  describe('sendWebviewFocus dependency', () => {
    it('should invoke sendWebviewFocus after executing the focus command', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
      expect(mockSendWebviewFocus).toHaveBeenCalledTimes(1);
    });

    it('should work without sendWebviewFocus dep (backward compatible)', () => {
      service.dispose();
      (vscode.window as any)._onDidChangeActiveTerminalListeners.length = 0;
      service = new FocusProtectionService({
        isTerminalFocused: mockIsTerminalFocused,
        isWebViewVisible: mockIsWebViewVisible,
        // sendWebviewFocus omitted
      });

      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
      // No error, no sendWebviewFocus call required
    });
  });

  describe('terminal ID tracking (restore focus to the correct terminal)', () => {
    it('should pass the last interacted terminal ID to sendWebviewFocus', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      // User interacts with terminal "3"
      service.notifyInteraction('3');

      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);

      expect(mockSendWebviewFocus).toHaveBeenCalledWith('3');
    });

    it('should pass undefined when no terminal ID was tracked', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      // No notifyInteraction with ID — legacy call without ID
      service.notifyInteraction();

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(mockSendWebviewFocus).toHaveBeenCalledWith(undefined);
    });

    it('should track the most recent terminal ID across multiple interactions', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyInteraction('1');
      service.notifyInteraction('2');
      service.notifyInteraction('5');

      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);

      expect(mockSendWebviewFocus).toHaveBeenCalledWith('5');
    });

    it('should restore focus to correct terminal in CLI agent mode', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyCliAgentConnected(true);

      // User submits prompt in terminal "2", then focus is gained
      service.notifyInteraction('2');
      service.notifyFocusChanged(true);
      vi.advanceTimersByTime(100);

      // Claude Code steals focus
      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
      expect(mockSendWebviewFocus).toHaveBeenCalledWith('2');
    });
  });

  describe('diagnostic logging (onDidOpenTerminal / describeTerminal)', () => {
    it('should register an onDidOpenTerminal listener', () => {
      expect(vscode.window.onDidOpenTerminal).toHaveBeenCalledOnce();
    });

    it('should handle opening a terminal without creationOptions gracefully', () => {
      expect(() => {
        fireOpenTerminal({ name: 'bash' });
      }).not.toThrow();
    });

    it('should handle active-terminal change with rich creationOptions gracefully', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      const richTerminal = {
        name: 'GitLens',
        processId: Promise.resolve(12345),
        state: { isInteractedWith: false },
        creationOptions: {
          name: 'GitLens',
          shellPath: '/bin/zsh',
          shellArgs: ['-l'],
          cwd: '/tmp/project',
          env: { FOO: 'bar' },
          iconPath: new (vscode as any).ThemeIcon('git'),
          isTransient: true,
          hideFromUser: false,
        },
      };

      expect(() => {
        fireActiveTerminalChanged(richTerminal);
        vi.advanceTimersByTime(200);
      }).not.toThrow();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
    });
  });

  describe('CLI agent connected mode (aggressive focus protection)', () => {
    it('should restore focus without recent interaction when CLI agent is connected', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      // Focus was gained recently
      service.notifyFocusChanged(true);
      vi.advanceTimersByTime(100);

      // CLI agent connected — no interaction required
      service.notifyCliAgentConnected(true);

      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
    });

    it('should use shorter cooldown when CLI agent is connected', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyCliAgentConnected(true);

      // First restore
      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);

      // After 200ms (less than normal 500ms cooldown, but enough for CLI agent mode)
      vi.advanceTimersByTime(200);

      // Second restore should work with shorter cooldown
      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
    });

    it('should extend recent focus window when CLI agent is connected', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyCliAgentConnected(true);

      // Focus gained, then long time passes (beyond normal 600ms window)
      service.notifyFocusChanged(true);
      vi.advanceTimersByTime(30_000); // 30 seconds — well beyond normal window

      // With CLI agent connected, the extended window (10 min) still covers this
      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
    });

    it('should protect during long CLI agent processing sessions', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyCliAgentConnected(true);

      // User submitted a prompt, then CLI agent processes for 5 minutes
      service.notifyFocusChanged(true);
      vi.advanceTimersByTime(300_000); // 5 minutes

      // Claude Code steals focus during processing
      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('secondaryTerminal.focus');
    });

    it('should NOT extend recent focus window beyond CLI agent window', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyCliAgentConnected(true);

      service.notifyFocusChanged(true);
      // Wait beyond CLI agent extended window (10 min = 600_000ms)
      vi.advanceTimersByTime(700_000);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should revert to normal behavior when CLI agent disconnects', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyCliAgentConnected(true);
      service.notifyFocusChanged(true);

      // Disconnect CLI agent
      service.notifyCliAgentConnected(false);

      // Wait beyond normal RECENT_FOCUS_WINDOW_MS (600ms)
      // After disconnect, the normal window applies → focus should NOT be restored
      vi.advanceTimersByTime(800);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should still respect disabled setting even with CLI agent connected', () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'focusProtection') return false;
          return undefined;
        }),
      } as any);

      service.dispose();
      (vscode.window as any)._onDidChangeActiveTerminalListeners.length = 0;
      service = new FocusProtectionService({
        isTerminalFocused: mockIsTerminalFocused,
        isWebViewVisible: mockIsWebViewVisible,
      });

      service.notifyCliAgentConnected(true);
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should still require WebView visible even with CLI agent connected', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(false);

      service.notifyCliAgentConnected(true);

      fireActiveTerminalChanged({ name: 'Claude Code' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should clean up all listeners on dispose', () => {
      service.dispose();
      expect((vscode.window as any)._onDidChangeActiveTerminalListeners).toHaveLength(0);
    });

    it('should cancel pending timer on dispose', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);
      fireActiveTerminalChanged({ name: 'bash' });

      service.dispose();
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should not restore focus after dispose', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      mockIsWebViewVisible.mockReturnValue(true);
      service.dispose();

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
