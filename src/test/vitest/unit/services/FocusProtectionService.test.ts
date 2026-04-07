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
      // Expose listeners for test triggering
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

/**
 * Helper to simulate onDidChangeActiveTerminal event
 */
function fireActiveTerminalChanged(terminal: unknown): void {
  const listeners = (vscode.window as any)._onDidChangeActiveTerminalListeners;
  for (const listener of listeners) {
    listener(terminal);
  }
}

/**
 * Helper to simulate configuration change
 */
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
    vi.clearAllMocks();

    // Reset listeners
    (vscode.window as any)._onDidChangeActiveTerminalListeners.length = 0;
    (vscode.workspace as any)._onDidChangeConfigurationListeners.length = 0;

    // Default: focusProtection enabled
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

  describe('focus protection behavior', () => {
    it('should restore focus when sidebar terminal was focused and standard terminal steals focus', () => {
      // サイドバーターミナルにフォーカスがある状態
      mockIsTerminalFocused.mockReturnValue(true);

      // 標準ターミナルにフォーカスが移動（terminal !== undefined = 標準ターミナル）
      const mockTerminal = { name: 'bash' };
      fireActiveTerminalChanged(mockTerminal);

      // フォーカスを戻すコマンドが実行される
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminalContainer.secondaryTerminal.focus'
      );
    });

    it('should NOT restore focus when sidebar terminal was NOT focused', () => {
      // サイドバーターミナルにフォーカスがない状態
      mockIsTerminalFocused.mockReturnValue(false);

      // 標準ターミナルにフォーカスが移動
      const mockTerminal = { name: 'bash' };
      fireActiveTerminalChanged(mockTerminal);

      // フォーカスを戻すコマンドは実行されない
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should NOT restore focus when active terminal becomes undefined (no terminal focused)', () => {
      mockIsTerminalFocused.mockReturnValue(true);

      // ターミナルのフォーカスが外れた（エディタ等に移動）
      fireActiveTerminalChanged(undefined);

      // フォーカスを戻さない
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('setting: focusProtection disabled', () => {
    it('should NOT restore focus when focusProtection is disabled', () => {
      // focusProtection を無効化
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'focusProtection') return false;
          return undefined;
        }),
      } as any);

      // 新しいインスタンスを作成（設定が無効）
      service.dispose();
      (vscode.window as any)._onDidChangeActiveTerminalListeners.length = 0;
      service = new FocusProtectionService({
        isTerminalFocused: mockIsTerminalFocused,
      });

      mockIsTerminalFocused.mockReturnValue(true);
      const mockTerminal = { name: 'bash' };
      fireActiveTerminalChanged(mockTerminal);

      // 無効なのでフォーカスを戻さない
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should respond to runtime configuration changes', () => {
      // 初期状態: 有効
      mockIsTerminalFocused.mockReturnValue(true);

      // 設定変更: 無効化
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'focusProtection') return false;
          return undefined;
        }),
      } as any);

      fireConfigurationChanged(
        (section: string) => section === 'secondaryTerminal.focusProtection'
      );

      // フォーカスが移動しても戻さない
      const mockTerminal = { name: 'bash' };
      fireActiveTerminalChanged(mockTerminal);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should resume protection when setting is re-enabled', () => {
      // まず無効化
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'focusProtection') return false;
          return undefined;
        }),
      } as any);
      fireConfigurationChanged(
        (section: string) => section === 'secondaryTerminal.focusProtection'
      );

      // 再有効化
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
      const mockTerminal = { name: 'bash' };
      fireActiveTerminalChanged(mockTerminal);

      // 有効化されたのでフォーカスを戻す
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminalContainer.secondaryTerminal.focus'
      );
    });
  });

  describe('dispose', () => {
    it('should clean up all listeners on dispose', () => {
      service.dispose();

      // リスナーが削除されている
      expect((vscode.window as any)._onDidChangeActiveTerminalListeners).toHaveLength(0);
    });

    it('should not restore focus after dispose', () => {
      mockIsTerminalFocused.mockReturnValue(true);
      service.dispose();

      // dispose後にイベントが発火しても何も起きない（リスナーが削除済み）
      // 手動で発火しても問題ない
      fireActiveTerminalChanged({ name: 'bash' });
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
