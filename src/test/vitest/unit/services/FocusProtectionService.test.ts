import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode before importing the service
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

    service = new FocusProtectionService({
      isTerminalFocused: mockIsTerminalFocused,
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

  describe('delayed focus restoration', () => {
    it('should NOT restore focus immediately (uses delay)', () => {
      mockIsTerminalFocused.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'bash' });

      // まだ実行されない（遅延中）
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should restore focus after delay when sidebar terminal was focused', () => {
      mockIsTerminalFocused.mockReturnValue(true);

      fireActiveTerminalChanged({ name: 'bash' });

      // 遅延後に実行される
      vi.advanceTimersByTime(150);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminalContainer.secondaryTerminal.focus'
      );
    });

    it('should NOT restore focus when sidebar terminal was NOT focused', () => {
      mockIsTerminalFocused.mockReturnValue(false);

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(150);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should NOT restore focus when active terminal becomes undefined', () => {
      mockIsTerminalFocused.mockReturnValue(true);

      fireActiveTerminalChanged(undefined);
      vi.advanceTimersByTime(150);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should debounce rapid terminal changes (only restore once)', () => {
      mockIsTerminalFocused.mockReturnValue(true);

      // 連続で発火
      fireActiveTerminalChanged({ name: 'bash' });
      fireActiveTerminalChanged({ name: 'zsh' });
      fireActiveTerminalChanged({ name: 'fish' });

      vi.advanceTimersByTime(150);

      // 1回だけ実行
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('cooldown', () => {
    it('should skip restoration during cooldown period', () => {
      mockIsTerminalFocused.mockReturnValue(true);

      // 1回目: 復帰
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(150);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);

      // 2回目: クールダウン中なのでスキップ
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(150);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
    });

    it('should allow restoration after cooldown expires', () => {
      mockIsTerminalFocused.mockReturnValue(true);

      // 1回目
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(150);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);

      // クールダウン経過（500ms）
      vi.advanceTimersByTime(500);

      // 2回目: クールダウン終了後なので復帰する
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(150);
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
    });
  });

  describe('setting: focusProtection disabled', () => {
    it('should NOT restore focus when focusProtection is disabled', () => {
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
      });

      mockIsTerminalFocused.mockReturnValue(true);
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(150);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should respond to runtime configuration changes', () => {
      mockIsTerminalFocused.mockReturnValue(true);

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
      vi.advanceTimersByTime(150);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should resume protection when setting is re-enabled', () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'focusProtection') return false;
          return undefined;
        }),
      } as any);
      fireConfigurationChanged(
        (section: string) => section === 'secondaryTerminal.focusProtection'
      );

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'focusProtection') return true;
          return undefined;
        }),
      } as any);
      fireConfigurationChanged(
        (section: string) => section === 'secondaryTerminal.focusProtection'
      );

      mockIsTerminalFocused.mockReturnValue(true);
      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(150);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminalContainer.secondaryTerminal.focus'
      );
    });
  });

  describe('dispose', () => {
    it('should clean up all listeners on dispose', () => {
      service.dispose();
      expect((vscode.window as any)._onDidChangeActiveTerminalListeners).toHaveLength(0);
    });

    it('should cancel pending timer on dispose', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      fireActiveTerminalChanged({ name: 'bash' });

      // タイマー発火前にdispose
      service.dispose();
      vi.advanceTimersByTime(150);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should not restore focus after dispose', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      service.dispose();

      fireActiveTerminalChanged({ name: 'bash' });
      vi.advanceTimersByTime(150);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
