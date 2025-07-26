import * as vscode from 'vscode';
import { SessionStorage } from './SessionStorage';
import { TerminalManager } from '../terminals/TerminalManager';
import { extension as log } from '../utils/logger';
import {
  TerminalSessionData,
  TerminalSessionInfo,
  SessionSaveResult,
  SessionRestoreResult,
  SessionRestoreOptions,
  RestoreMessageInfo,
  SplitLayoutInfo,
  SESSION_RESTORE_MESSAGES,
} from '../types/session';

/**
 * ターミナルセッション管理のメインクラス
 * セッションの保存、復元、設定管理を担当する
 */
export class SessionManager {
  private readonly storage: SessionStorage;
  private readonly terminalManager: TerminalManager;
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext, terminalManager: TerminalManager) {
    this.context = context;
    this.storage = new SessionStorage(context);
    this.terminalManager = terminalManager;

    // VS Code終了時の自動保存設定
    this.setupAutoSave();
  }

  /**
   * 現在のターミナル状態をセッションとして保存する
   */
  async saveCurrentSession(): Promise<SessionSaveResult> {
    try {
      log('💾 [SESSION_MANAGER] Starting session save...');

      // 設定を確認
      const config = this.getSessionConfig();
      if (!config.enablePersistentSessions) {
        log('📵 [SESSION_MANAGER] Persistent sessions disabled');
        return {
          success: false,
          terminalCount: 0,
          error: 'Persistent sessions are disabled',
        };
      }

      // 現在のターミナル状態を収集
      const sessionData = await this.collectCurrentSessionData();
      if (!sessionData || sessionData.terminals.length === 0) {
        log('📭 [SESSION_MANAGER] No terminals to save');
        return {
          success: true,
          terminalCount: 0,
        };
      }

      // ストレージに保存
      const result = await this.storage.saveSession(sessionData);
      
      if (result.success) {
        log(`✅ [SESSION_MANAGER] Session saved successfully: ${result.terminalCount} terminals`);
      } else {
        log(`❌ [SESSION_MANAGER] Session save failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [SESSION_MANAGER] Unexpected error during session save: ${errorMessage}`);

      return {
        success: false,
        terminalCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * 保存されたセッションを復元する
   */
  async restoreSession(): Promise<SessionRestoreResult> {
    try {
      log('🔄 [SESSION_MANAGER] Starting session restore...');

      // 設定を確認
      const config = this.getSessionConfig();
      if (!config.enablePersistentSessions) {
        log('📵 [SESSION_MANAGER] Persistent sessions disabled');
        return {
          success: false,
          restoredTerminalCount: 0,
          skippedTerminalCount: 0,
          error: 'Persistent sessions are disabled',
        };
      }

      // 現在のワークスペースパスを取得
      const workspacePath = this.getCurrentWorkspacePath();

      // セッションデータを復元
      const sessionData = await this.storage.restoreSession(workspacePath);
      if (!sessionData) {
        log('📭 [SESSION_MANAGER] No session data to restore');
        return {
          success: true,
          restoredTerminalCount: 0,
          skippedTerminalCount: 0,
        };
      }

      // ターミナルを復元
      const restoreResult = await this.restoreTerminalsFromSession(sessionData);

      log(`✅ [SESSION_MANAGER] Session restore completed: ${restoreResult.restoredTerminalCount} restored, ${restoreResult.skippedTerminalCount} skipped`);

      return {
        ...restoreResult,
        sessionTimestamp: sessionData.timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [SESSION_MANAGER] Unexpected error during session restore: ${errorMessage}`);

      return {
        success: false,
        restoredTerminalCount: 0,
        skippedTerminalCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * セッション設定を取得する
   */
  getSessionConfig(): SessionRestoreOptions {
    const vsCodeConfig = vscode.workspace.getConfiguration('secondaryTerminal');
    
    return {
      enablePersistentSessions: vsCodeConfig.get<boolean>('enablePersistentSessions', true),
      persistentSessionScrollback: vsCodeConfig.get<number>('persistentSessionScrollback', 100),
      persistentSessionReviveProcess: vsCodeConfig.get<'never' | 'onExit' | 'onExitAndWindowClose'>('persistentSessionReviveProcess', 'onExitAndWindowClose'),
      hideOnStartup: vsCodeConfig.get<'never' | 'whenEmpty' | 'always'>('hideOnStartup', 'never'),
    };
  }

  /**
   * セッションをクリアする
   */
  async clearSession(): Promise<void> {
    const workspacePath = this.getCurrentWorkspacePath();
    await this.storage.clearSession(workspacePath);
    log('🗑️ [SESSION_MANAGER] Session cleared');
  }

  /**
   * セッション情報を取得する（デバッグ用）
   */
  async getSessionInfo(): Promise<any> {
    const storageInfo = await this.storage.getStorageInfo();
    const config = this.getSessionConfig();
    
    return {
      config,
      storage: storageInfo,
      currentWorkspace: this.getCurrentWorkspacePath(),
    };
  }

  /**
   * 現在のターミナル状態を収集してセッションデータを作成する
   */
  private async collectCurrentSessionData(): Promise<TerminalSessionData | null> {
    try {
      // アクティブなターミナル一覧を取得
      const terminals = this.terminalManager.getAllTerminals();
      if (terminals.length === 0) {
        return null;
      }

      const config = this.getSessionConfig();
      const sessionTerminals: TerminalSessionInfo[] = [];

      // 各ターミナルの情報を収集
      for (const terminal of terminals) {
        try {
          const terminalInfo = await this.collectTerminalInfo(terminal, config.persistentSessionScrollback);
          if (terminalInfo) {
            sessionTerminals.push(terminalInfo);
          }
        } catch (error) {
          log(`⚠️ [SESSION_MANAGER] Failed to collect info for terminal ${terminal.id}: ${error}`);
        }
      }

      if (sessionTerminals.length === 0) {
        return null;
      }

      // レイアウト情報を収集
      const layoutInfo = this.collectLayoutInfo();

      // セッションデータを構築
      const sessionData: TerminalSessionData = {
        terminals: sessionTerminals,
        activeTerminalId: this.terminalManager.getActiveTerminalId(),
        layoutInfo,
        timestamp: Date.now(),
        version: '1.0.0',
        workspacePath: this.getCurrentWorkspacePath(),
      };

      return sessionData;
    } catch (error) {
      log(`❌ [SESSION_MANAGER] Failed to collect session data: ${error}`);
      return null;
    }
  }

  /**
   * 単一ターミナルの情報を収集する
   */
  private async collectTerminalInfo(terminal: any, maxScrollback: number): Promise<TerminalSessionInfo | null> {
    try {
      // スクロールバック履歴を取得（実装はTerminalManagerの拡張が必要）
      const scrollback = await this.terminalManager.getTerminalScrollback(terminal.id, maxScrollback);
      
      return {
        id: terminal.id,
        name: terminal.name || `Terminal ${terminal.number}`,
        cwd: terminal.cwd || process.cwd(),
        scrollback: scrollback || [],
        isActive: terminal.id === this.terminalManager.getActiveTerminalId(),
        createdAt: terminal.createdAt || Date.now(),
        lastUpdated: Date.now(),
        terminalNumber: terminal.number,
      };
    } catch (error) {
      log(`⚠️ [SESSION_MANAGER] Failed to collect terminal info for ${terminal.id}: ${error}`);
      return null;
    }
  }

  /**
   * レイアウト情報を収集する
   */
  private collectLayoutInfo(): SplitLayoutInfo {
    // 現在はシンプルな実装。将来的に分割レイアウト対応時に拡張
    const terminals = this.terminalManager.getAllTerminals();
    
    return {
      direction: 'none',
      sizes: [100],
      terminalIds: terminals.map(t => t.id),
    };
  }

  /**
   * セッションデータからターミナルを復元する
   */
  private async restoreTerminalsFromSession(sessionData: TerminalSessionData): Promise<{
    success: boolean;
    restoredTerminalCount: number;
    skippedTerminalCount: number;
    error?: string;
  }> {
    let restoredCount = 0;
    let skippedCount = 0;

    try {
      for (const terminalInfo of sessionData.terminals) {
        try {
          const restored = await this.restoreTerminal(terminalInfo);
          if (restored) {
            restoredCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          log(`⚠️ [SESSION_MANAGER] Failed to restore terminal ${terminalInfo.id}: ${error}`);
          skippedCount++;
        }
      }

      // アクティブターミナルを復元
      if (sessionData.activeTerminalId && restoredCount > 0) {
        setTimeout(() => {
          this.terminalManager.focusTerminal(sessionData.activeTerminalId!);
        }, 100);
      }

      return {
        success: true,
        restoredTerminalCount: restoredCount,
        skippedTerminalCount: skippedCount,
      };
    } catch (error) {
      return {
        success: false,
        restoredTerminalCount: restoredCount,
        skippedTerminalCount: skippedCount,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 単一ターミナルを復元する
   */
  private async restoreTerminal(terminalInfo: TerminalSessionInfo): Promise<boolean> {
    try {
      // 復元メッセージを作成
      const restoreMessage = this.createRestoreMessage(terminalInfo);

      // ターミナルを作成（TerminalManagerの拡張が必要）
      const terminalId = await this.terminalManager.createTerminalFromSession({
        id: terminalInfo.id,
        name: terminalInfo.name,
        cwd: terminalInfo.cwd,
        terminalNumber: terminalInfo.terminalNumber,
        restoreMessage,
        scrollbackHistory: terminalInfo.scrollback,
      });

      if (terminalId) {
        log(`✅ [SESSION_MANAGER] Restored terminal: ${terminalInfo.name} (${terminalId})`);
        return true;
      } else {
        log(`⚠️ [SESSION_MANAGER] Failed to create terminal for: ${terminalInfo.name}`);
        return false;
      }
    } catch (error) {
      log(`❌ [SESSION_MANAGER] Error restoring terminal ${terminalInfo.name}: ${error}`);
      return false;
    }
  }

  /**
   * 復元メッセージを作成する
   */
  private createRestoreMessage(terminalInfo: TerminalSessionInfo): string {
    const date = new Date(terminalInfo.lastUpdated);
    const formattedDate = date.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return SESSION_RESTORE_MESSAGES.RESTORE_MESSAGE_TEMPLATE.replace('{date}', formattedDate);
  }

  /**
   * 現在のワークスペースパスを取得する
   */
  private getCurrentWorkspacePath(): string | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath || null;
  }

  /**
   * 自動保存の設定
   */
  private setupAutoSave(): void {
    const config = this.getSessionConfig();

    // VS Code終了時の保存
    if (config.persistentSessionReviveProcess === 'onExitAndWindowClose' || config.persistentSessionReviveProcess === 'onExit') {
      // VS Codeのbeforeexitイベントをリッスン（実装はExtensionLifecycleで行う）
      log('⚙️ [SESSION_MANAGER] Auto-save configured for exit events');
    }

    // 定期的な保存（オプション）
    // setInterval(() => {
    //   this.saveCurrentSession();
    // }, 5 * 60 * 1000); // 5分ごと
  }
}