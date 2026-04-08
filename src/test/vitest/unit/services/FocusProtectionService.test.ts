import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('vscode', () => {
  const onDidChangeActiveTerminalListeners: Array<(terminal: unknown) => void> = [];
  const onDidChangeConfigurationListeners: Array<(e: unknown) => void> = [];

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
      _onDidChangeActiveTerminalListeners: onDidChangeActiveTerminalListeners,
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

    service = new FocusProtectionService({
      isTerminalFocused: mockIsTerminalFocused,
      isWebViewVisible: mockIsWebViewVisible,
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

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminalContainer.secondaryTerminal.focus'
      );
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

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminalContainer.secondaryTerminal.focus'
      );
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
      // Wait longer than RECENT_FOCUS_WINDOW_MS (800ms)
      vi.advanceTimersByTime(900);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should restore focus when active terminal changes after 500ms delay', () => {
      mockIsTerminalFocused.mockReturnValue(false);
      mockIsWebViewVisible.mockReturnValue(true);

      service.notifyFocusChanged(true);
      vi.advanceTimersByTime(500);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(200);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminalContainer.secondaryTerminal.focus'
      );
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
