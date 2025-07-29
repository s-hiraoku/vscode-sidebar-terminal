import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import {
  SimpleSessionData,
  SimpleTerminalInfo,
  SimpleSaveResult,
  SimpleRestoreResult,
} from '../types/simple-session';
import { extension as log } from '../utils/logger';

/**
 * シンプルなセッション管理クラス
 * 複雑な処理を排除し、確実に動作する最小限の実装
 */
export class SimpleSessionManager {
  private static readonly STORAGE_KEY = 'simple-terminal-session';
  private static readonly SESSION_VERSION = '1.0.0';
  private static readonly MAX_SESSION_AGE_DAYS = 7;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager,
    private sidebarProvider?: { [key: string]: unknown } // SecondaryTerminalProviderへの参照（Scrollback用）
  ) {}

  /**
   * SidebarProviderを設定（Scrollback機能用）
   */
  public setSidebarProvider(provider: { [key: string]: unknown }): void {
    this.sidebarProvider = provider;
  }

  // Scrollback処理は完全に削除 - 基本機能に集中

  /**
   * 現在のターミナル状態を保存
   */
  public async saveCurrentSession(): Promise<SimpleSaveResult> {
    try {
      log('💾 [SIMPLE_SESSION] Starting session save...');

      const terminals = this.terminalManager.getTerminals();
      const activeTerminalId = this.terminalManager.getActiveTerminalId();

      if (terminals.length === 0) {
        log('📭 [SIMPLE_SESSION] No terminals to save');
        return { success: true, terminalCount: 0 };
      }

      // ターミナル情報とScrollbackデータを収集
      const simpleTerminals: SimpleTerminalInfo[] = [];

      for (const terminal of terminals) {
        log(`📋 [SIMPLE_SESSION] Processing terminal ${terminal.id} (${terminal.name})`);

        // 基本情報
        const terminalInfo: SimpleTerminalInfo = {
          id: terminal.id,
          name: terminal.name,
          number: terminal.number,
          cwd: terminal.cwd || process.cwd(),
          isActive: terminal.id === activeTerminalId,
        };

        // Scrollback処理（基本復元が安定したら段階的に有効化）
        if (
          vscode.workspace
            .getConfiguration('secondaryTerminal')
            .get<boolean>('restoreScrollback', true)
        ) {
          // モックScrollbackデータを追加（テスト用）
          terminalInfo.scrollback = [
            {
              content: `Previous session for ${terminal.name}`,
              type: 'output',
              timestamp: Date.now(),
            },
            { content: 'echo "Session restored"', type: 'input', timestamp: Date.now() },
            { content: 'Session restored', type: 'output', timestamp: Date.now() },
          ];
          log(`✅ [SIMPLE_SESSION] Added mock scrollback for terminal ${terminal.id}`);
        }

        simpleTerminals.push(terminalInfo);
      }

      const sessionData: SimpleSessionData = {
        terminals: simpleTerminals,
        activeTerminalId: activeTerminalId || null,
        timestamp: Date.now(),
        version: SimpleSessionManager.SESSION_VERSION,
      };

      // VS Code storage に保存（同期的）
      await this.context.globalState.update(SimpleSessionManager.STORAGE_KEY, sessionData);

      log(`✅ [SIMPLE_SESSION] Session saved: ${terminals.length} terminals`);
      return {
        success: true,
        terminalCount: terminals.length,
      };
    } catch (error) {
      log(`❌ [SIMPLE_SESSION] Save failed: ${String(error)}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 保存されたセッションを復元
   */
  public async restoreSession(): Promise<SimpleRestoreResult> {
    try {
      log('🔄 [SIMPLE_SESSION_MANAGER] === restoreSession() CALLED ===');
      log(`🔧 [SIMPLE_SESSION_MANAGER] Storage key: ${SimpleSessionManager.STORAGE_KEY}`);

      // 保存されたデータを取得
      log('📖 [SIMPLE_SESSION_MANAGER] Reading session data from globalState...');
      const sessionData = this.context.globalState.get<SimpleSessionData>(
        SimpleSessionManager.STORAGE_KEY
      );
      log(`🔧 [SIMPLE_SESSION_MANAGER] Raw session data: ${sessionData ? 'EXISTS' : 'NULL'}`);

      if (!sessionData) {
        log('📭 [SIMPLE_SESSION_MANAGER] No session data found');
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      log(
        `🔧 [SIMPLE_SESSION_MANAGER] Session data found - terminals: ${sessionData.terminals?.length || 0}`
      );

      // データの有効性チェック
      log('🔍 [SIMPLE_SESSION_MANAGER] Validating session data...');
      if (!this.isValidSessionData(sessionData)) {
        log('⚠️ [SIMPLE_SESSION_MANAGER] Invalid session data, clearing...');
        await this.clearSession();
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }
      log('✅ [SIMPLE_SESSION_MANAGER] Session data is valid');

      // 期限切れチェック
      log('⏰ [SIMPLE_SESSION_MANAGER] Checking session expiry...');
      if (this.isSessionExpired(sessionData)) {
        log('⏰ [SIMPLE_SESSION_MANAGER] Session expired, clearing...');
        await this.clearSession();
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }
      log('✅ [SIMPLE_SESSION_MANAGER] Session is not expired');

      // 既存のターミナルがある場合はスキップ
      log('🔧 [SIMPLE_SESSION_MANAGER] Checking for existing terminals...');
      const existingTerminals = this.terminalManager.getTerminals();
      log(`🔧 [SIMPLE_SESSION_MANAGER] Found ${existingTerminals.length} existing terminals`);
      if (existingTerminals.length > 0) {
        log('⚠️ [SIMPLE_SESSION_MANAGER] Terminals already exist, skipping restore');
        return {
          success: true,
          restoredCount: 0,
          skippedCount: sessionData.terminals.length,
        };
      }

      // ターミナルを復元
      let restoredCount = 0;
      let activeTerminalSet = false;

      for (const terminalInfo of sessionData.terminals) {
        try {
          const terminalId = this.terminalManager.createTerminal();

          if (terminalId && !activeTerminalSet && terminalInfo.isActive) {
            // アクティブターミナルを設定（最初の1回のみ）
            this.terminalManager.setActiveTerminal(terminalId);
            activeTerminalSet = true;
          }

          // Scrollback復元（基本復元が成功したら段階的に有効化）
          if (
            terminalInfo.scrollback &&
            terminalInfo.scrollback.length > 0 &&
            this.sidebarProvider
          ) {
            log(
              `📋 [SIMPLE_SESSION] Restoring ${terminalInfo.scrollback.length} scrollback lines for terminal ${terminalId}`
            );

            // 復元処理を少し遅延させてターミナルが初期化完了まで待つ
            setTimeout(() => {
              if (
                this.sidebarProvider &&
                '_sendMessage' in this.sidebarProvider &&
                typeof this.sidebarProvider._sendMessage === 'function'
              ) {
                (this.sidebarProvider._sendMessage as (message: unknown) => void)({
                  command: 'restoreScrollback',
                  terminalId: terminalId,
                  scrollbackContent: terminalInfo.scrollback,
                  timestamp: Date.now(),
                });
                log(
                  `✅ [SIMPLE_SESSION] Scrollback restore message sent for terminal ${terminalId}`
                );
              }
            }, 1500); // 1.5秒待機でターミナル初期化完了を確実に待つ
          }

          restoredCount++;
          log(`✅ [SIMPLE_SESSION] Restored terminal: ${terminalInfo.name}`);
        } catch (error) {
          log(
            `❌ [SIMPLE_SESSION] Failed to restore terminal ${terminalInfo.name}: ${String(error)}`
          );
        }
      }

      log(`✅ [SIMPLE_SESSION] Session restored: ${restoredCount} terminals`);
      return {
        success: true,
        restoredCount,
        skippedCount: sessionData.terminals.length - restoredCount,
      };
    } catch (error) {
      log(`❌ [SIMPLE_SESSION] Restore failed: ${String(error)}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 保存されたセッションをクリア
   */
  public async clearSession(): Promise<void> {
    try {
      await this.context.globalState.update(SimpleSessionManager.STORAGE_KEY, undefined);
      log('🗑️ [SIMPLE_SESSION] Session data cleared');
    } catch (error) {
      log(`❌ [SIMPLE_SESSION] Failed to clear session: ${String(error)}`);
    }
  }

  /**
   * セッションデータの有効性をチェック
   */
  private isValidSessionData(data: unknown): data is SimpleSessionData {
    return (
      Boolean(data) &&
      typeof data === 'object' &&
      data !== null &&
      'terminals' in data &&
      Array.isArray((data as Record<string, unknown>).terminals) &&
      'timestamp' in data &&
      typeof (data as Record<string, unknown>).timestamp === 'number' &&
      'version' in data &&
      typeof (data as Record<string, unknown>).version === 'string' &&
      ((data as Record<string, unknown>).terminals as unknown[]).every(
        (t: unknown) =>
          Boolean(t) &&
          typeof t === 'object' &&
          t !== null &&
          'id' in t &&
          typeof (t as Record<string, unknown>).id === 'string' &&
          'name' in t &&
          typeof (t as Record<string, unknown>).name === 'string' &&
          'number' in t &&
          typeof (t as Record<string, unknown>).number === 'number' &&
          'cwd' in t &&
          typeof (t as Record<string, unknown>).cwd === 'string' &&
          'isActive' in t &&
          typeof (t as Record<string, unknown>).isActive === 'boolean'
      )
    );
  }

  /**
   * セッションの期限切れをチェック
   */
  private isSessionExpired(data: SimpleSessionData): boolean {
    const now = Date.now();
    const ageMs = now - data.timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > SimpleSessionManager.MAX_SESSION_AGE_DAYS;
  }

  /**
   * 保存されたセッション情報を取得（デバッグ用）
   */
  public getSessionInfo(): SimpleSessionData | null {
    return (
      this.context.globalState.get<SimpleSessionData>(SimpleSessionManager.STORAGE_KEY) || null
    );
  }
}
