import * as vscode from 'vscode';
import { extension as log } from '../utils/logger';
import {
  TerminalSessionData,
  SessionSaveResult,
  SessionRestoreResult,
  SessionRestoreOptions,
  SESSION_STORAGE_KEYS,
  SESSION_LIMITS,
} from '../types/session';

/**
 * ターミナルセッションデータの永続化処理を担当するクラス
 * VS Code の globalStorage と workspaceState を使用してデータを保存・復元する
 */
export class SessionStorage {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * セッションデータを保存する
   */
  async saveSession(sessionData: TerminalSessionData): Promise<SessionSaveResult> {
    try {
      log('💾 [SESSION] Starting session save...');

      // データサイズチェック
      const serializedData = JSON.stringify(sessionData);
      const dataSizeBytes = Buffer.byteLength(serializedData, 'utf8');
      const dataSizeMB = dataSizeBytes / (1024 * 1024);

      if (dataSizeMB > SESSION_LIMITS.MAX_SESSION_SIZE_MB) {
        const error = `Session data too large: ${dataSizeMB.toFixed(2)}MB (max: ${SESSION_LIMITS.MAX_SESSION_SIZE_MB}MB)`;
        log(`❌ [SESSION] ${error}`);
        return {
          success: false,
          terminalCount: sessionData.terminals.length,
          error,
        };
      }

      // ワークスペース固有のストレージに保存
      if (sessionData.workspacePath) {
        await this.context.workspaceState.update(SESSION_STORAGE_KEYS.SESSION_DATA, sessionData);
        log(`💾 [SESSION] Saved to workspace storage: ${sessionData.workspacePath}`);
      } else {
        // ワークスペースがない場合はグローバルストレージに保存
        await this.context.globalState.update(SESSION_STORAGE_KEYS.SESSION_DATA, sessionData);
        log('💾 [SESSION] Saved to global storage');
      }

      // 最後の保存時刻を記録
      await this.context.globalState.update(SESSION_STORAGE_KEYS.LAST_SAVE_TIME, Date.now());

      log(
        `✅ [SESSION] Successfully saved ${sessionData.terminals.length} terminals (${dataSizeMB.toFixed(2)}MB)`
      );

      return {
        success: true,
        terminalCount: sessionData.terminals.length,
        dataSize: dataSizeBytes,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [SESSION] Failed to save session: ${errorMessage}`);

      return {
        success: false,
        terminalCount: sessionData.terminals.length,
        error: errorMessage,
      };
    }
  }

  /**
   * セッションデータを復元する
   */
  async restoreSession(workspacePath?: string): Promise<TerminalSessionData | null> {
    try {
      log('🔄 [SESSION] Starting session restore...');

      let sessionData: TerminalSessionData | undefined;

      // ワークスペース固有のデータを優先して検索
      if (workspacePath) {
        sessionData = this.context.workspaceState.get<TerminalSessionData>(
          SESSION_STORAGE_KEYS.SESSION_DATA
        );
        if (sessionData) {
          log(`🔄 [SESSION] Found workspace session: ${workspacePath}`);
        }
      }

      // ワークスペース固有のデータがない場合はグローバルデータを検索
      if (!sessionData) {
        sessionData = this.context.globalState.get<TerminalSessionData>(
          SESSION_STORAGE_KEYS.SESSION_DATA
        );
        if (sessionData) {
          log('🔄 [SESSION] Found global session');
        }
      }

      if (!sessionData) {
        log('📭 [SESSION] No session data found');
        return null;
      }

      // セッションの有効期限チェック
      const currentTime = Date.now();
      const sessionAge = currentTime - sessionData.timestamp;
      const maxAge = SESSION_LIMITS.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (sessionAge > maxAge) {
        log(
          `⏰ [SESSION] Session expired (${Math.round(sessionAge / (24 * 60 * 60 * 1000))} days old)`
        );
        await this.clearSession(workspacePath);
        return null;
      }

      // データの整合性チェック
      if (!this.validateSessionData(sessionData)) {
        log('❌ [SESSION] Session data validation failed');
        return null;
      }

      log(`✅ [SESSION] Successfully restored ${sessionData.terminals.length} terminals`);
      return sessionData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [SESSION] Failed to restore session: ${errorMessage}`);
      return null;
    }
  }

  /**
   * セッション設定を保存する
   */
  async saveSessionConfig(config: SessionRestoreOptions): Promise<void> {
    try {
      await this.context.globalState.update(SESSION_STORAGE_KEYS.SESSION_CONFIG, config);
      log('⚙️ [SESSION] Session config saved');
    } catch (error) {
      log(`❌ [SESSION] Failed to save config: ${error}`);
    }
  }

  /**
   * セッション設定を復元する
   */
  getSessionConfig(): SessionRestoreOptions {
    const config = this.context.globalState.get<SessionRestoreOptions>(
      SESSION_STORAGE_KEYS.SESSION_CONFIG
    );

    // デフォルト設定を返す
    return (
      config || {
        enablePersistentSessions: true,
        persistentSessionScrollback: 100,
        persistentSessionReviveProcess: 'onExitAndWindowClose',
        hideOnStartup: 'never',
      }
    );
  }

  /**
   * セッションデータをクリアする
   */
  async clearSession(workspacePath?: string): Promise<void> {
    try {
      if (workspacePath) {
        await this.context.workspaceState.update(SESSION_STORAGE_KEYS.SESSION_DATA, undefined);
        log(`🗑️ [SESSION] Cleared workspace session: ${workspacePath}`);
      } else {
        await this.context.globalState.update(SESSION_STORAGE_KEYS.SESSION_DATA, undefined);
        log('🗑️ [SESSION] Cleared global session');
      }
    } catch (error) {
      log(`❌ [SESSION] Failed to clear session: ${error}`);
    }
  }

  /**
   * 最後の保存時刻を取得する
   */
  getLastSaveTime(): number | null {
    return this.context.globalState.get<number>(SESSION_STORAGE_KEYS.LAST_SAVE_TIME) || null;
  }

  /**
   * セッションデータの整合性を検証する
   */
  private validateSessionData(sessionData: TerminalSessionData): boolean {
    try {
      // 必須プロパティの存在チェック
      if (!sessionData.version || !sessionData.timestamp || !Array.isArray(sessionData.terminals)) {
        log('❌ [SESSION] Missing required properties');
        return false;
      }

      // ターミナルデータの検証
      for (const terminal of sessionData.terminals) {
        if (!terminal.id || !terminal.name || typeof terminal.terminalNumber !== 'number') {
          log(`❌ [SESSION] Invalid terminal data: ${terminal.id}`);
          return false;
        }

        // スクロールバック行数の制限チェック
        if (terminal.scrollback.length > SESSION_LIMITS.MAX_SCROLLBACK_LINES) {
          log(`⚠️ [SESSION] Terminal ${terminal.id} has too many scrollback lines, truncating`);
          terminal.scrollback = terminal.scrollback.slice(-SESSION_LIMITS.MAX_SCROLLBACK_LINES);
        }
      }

      // アクティブターミナルIDの検証
      if (sessionData.activeTerminalId) {
        const activeTerminalExists = sessionData.terminals.some(
          (t) => t.id === sessionData.activeTerminalId
        );
        if (!activeTerminalExists) {
          log('⚠️ [SESSION] Active terminal ID not found in terminals list, clearing');
          sessionData.activeTerminalId = null;
        }
      }

      return true;
    } catch (error) {
      log(`❌ [SESSION] Validation error: ${error}`);
      return false;
    }
  }

  /**
   * ストレージの使用量情報を取得する（デバッグ用）
   */
  async getStorageInfo(): Promise<{
    hasWorkspaceSession: boolean;
    hasGlobalSession: boolean;
    lastSaveTime: number | null;
    configExists: boolean;
  }> {
    const workspaceSession = this.context.workspaceState.get<TerminalSessionData>(
      SESSION_STORAGE_KEYS.SESSION_DATA
    );
    const globalSession = this.context.globalState.get<TerminalSessionData>(
      SESSION_STORAGE_KEYS.SESSION_DATA
    );
    const lastSaveTime = this.getLastSaveTime();
    const config = this.context.globalState.get<SessionRestoreOptions>(
      SESSION_STORAGE_KEYS.SESSION_CONFIG
    );

    return {
      hasWorkspaceSession: !!workspaceSession,
      hasGlobalSession: !!globalSession,
      lastSaveTime,
      configExists: !!config,
    };
  }
}
