import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { extension as log } from '../utils/logger';

/**
 * VS Code標準に準拠したターミナルセッション管理
 * xterm.js serialize addonを使用してターミナル状態を完全に保存・復元
 */
export class StandardTerminalSessionManager {
  private static readonly STORAGE_KEY = 'standard-terminal-session-v3';
  private static readonly SESSION_VERSION = '3.0.0';
  private static readonly MAX_SESSION_AGE_DAYS = 7;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager,
    private sidebarProvider?: { _sendMessage: (message: unknown) => Promise<void> }
  ) {}

  /**
   * SidebarProviderを設定
   */
  public setSidebarProvider(provider: unknown): void {
    this.sidebarProvider = provider as { _sendMessage: (message: unknown) => Promise<void> };
    log('🔧 [STANDARD-SESSION] Sidebar provider set');
  }

  /**
   * VS Code標準のターミナル永続化設定を取得
   */
  private getTerminalPersistenceConfig(): {
    enablePersistentSessions: boolean;
    persistentSessionScrollback: number;
    persistentSessionReviveProcess: string;
  } {
    const config = vscode.workspace.getConfiguration('terminal.integrated');
    return {
      enablePersistentSessions: config.get<boolean>('enablePersistentSessions', true),
      persistentSessionScrollback: config.get<number>('persistentSessionScrollback', 100),
      persistentSessionReviveProcess: config.get<string>('persistentSessionReviveProcess', 'onExitAndWindowClose'),
    };
  }

  /**
   * 現在のターミナル状態を保存（基本情報のみ）
   * WebView側でserialize addonによる状態管理を行う
   */
  public async saveCurrentSession(): Promise<{
    success: boolean;
    terminalCount: number;
    error?: string;
  }> {
    try {
      log('💾 [STANDARD-SESSION] Starting VS Code standard session save...');

      const config = this.getTerminalPersistenceConfig();
      if (!config.enablePersistentSessions) {
        log('⚠️ [STANDARD-SESSION] Persistent sessions disabled in VS Code settings');
        return { success: true, terminalCount: 0 };
      }

      const terminals = this.terminalManager.getTerminals();
      const activeTerminalId = this.terminalManager.getActiveTerminalId();

      if (terminals.length === 0) {
        log('📭 [STANDARD-SESSION] No terminals to save');
        return { success: true, terminalCount: 0 };
      }

      // Extension側では基本的なターミナル情報のみ保存
      const basicTerminals = terminals.map(terminal => ({
        id: terminal.id,
        name: terminal.name,
        number: terminal.number,
        cwd: terminal.cwd || process.cwd(),
        isActive: terminal.id === activeTerminalId,
      }));

      const sessionData = {
        terminals: basicTerminals,
        activeTerminalId: activeTerminalId || null,
        timestamp: Date.now(),
        version: StandardTerminalSessionManager.SESSION_VERSION,
        config: {
          scrollbackLines: config.persistentSessionScrollback,
          reviveProcess: config.persistentSessionReviveProcess,
        },
      };

      await this.context.globalState.update(StandardTerminalSessionManager.STORAGE_KEY, sessionData);

      log(`✅ [STANDARD-SESSION] VS Code standard session saved: ${basicTerminals.length} terminals`);
      return {
        success: true,
        terminalCount: basicTerminals.length,
      };
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Save failed: ${String(error)}`);
      return {
        success: false,
        terminalCount: 0,
        error: String(error),
      };
    }
  }


  /**
   * 保存されたセッションを復元
   */
  public async restoreSession(forceRestore = false): Promise<{
    success: boolean;
    restoredCount: number;
    skippedCount: number;
    error?: string;
  }> {
    try {
      log('🔄 [STANDARD-SESSION] === VS Code Standard Session Restore Start ===');

      const config = this.getTerminalPersistenceConfig();
      if (!config.enablePersistentSessions) {
        log('⚠️ [STANDARD-SESSION] Persistent sessions disabled in VS Code settings');
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      const sessionData = this.context.globalState.get<any>(StandardTerminalSessionManager.STORAGE_KEY);

      if (!sessionData || !sessionData.terminals) {
        log('📭 [STANDARD-SESSION] No session data found');
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      log(`🔍 [STANDARD-SESSION] Found session with ${sessionData.terminals.length} terminals`);

      // セッション期限チェック
      if (this.isSessionExpired(sessionData)) {
        log('⏰ [STANDARD-SESSION] Session expired, clearing...');
        await this.clearSession();
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      // 既存ターミナルの処理
      const existingTerminals = this.terminalManager.getTerminals();
      if (existingTerminals.length > 0 && !forceRestore) {
        log(`⚠️ [STANDARD-SESSION] ${existingTerminals.length} terminals already exist, skipping restore`);
        return {
          success: true,
          restoredCount: 0,
          skippedCount: sessionData.terminals.length,
        };
      }

      // 既存ターミナルを削除（force restore時）
      if (forceRestore) {
        for (const terminal of existingTerminals) {
          this.terminalManager.deleteTerminal(terminal.id);
        }
      }

      // ターミナル復元
      let restoredCount = 0;
      let activeTerminalSet = false;

      for (const terminalInfo of sessionData.terminals) {
        try {
          log(`🔄 [STANDARD-SESSION] Restoring terminal: ${terminalInfo.name}`);

          const terminalId = this.terminalManager.createTerminal();
          if (!terminalId) {
            log(`❌ [STANDARD-SESSION] Failed to create terminal for ${terminalInfo.name}`);
            continue;
          }

          // アクティブターミナル設定
          if (!activeTerminalSet && terminalInfo.isActive) {
            this.terminalManager.setActiveTerminal(terminalId);
            activeTerminalSet = true;
            log(`🎯 [STANDARD-SESSION] Set active terminal: ${terminalId}`);
          }

          // WebView側でserialize addonによる状態復元を行う
          // Extension側では基本的なターミナル作成のみ実行

          restoredCount++;
          log(`✅ [STANDARD-SESSION] Restored terminal: ${terminalInfo.name} (${terminalId})`);
        } catch (error) {
          log(`❌ [STANDARD-SESSION] Failed to restore terminal ${terminalInfo.name}: ${String(error)}`);
        }
      }

      log(`✅ [STANDARD-SESSION] VS Code standard session restore completed: ${restoredCount} terminals`);
      return {
        success: true,
        restoredCount,
        skippedCount: sessionData.terminals.length - restoredCount,
      };
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Restore failed: ${String(error)}`);
      return {
        success: false,
        restoredCount: 0,
        skippedCount: 0,
        error: String(error),
      };
    }
  }


  /**
   * WebView初期化後にターミナル復元情報を送信
   */
  public async sendTerminalRestoreInfoToWebView(): Promise<void> {
    if (!this.sidebarProvider) {
      log('⚠️ [STANDARD-SESSION] No sidebar provider available for restore info');
      return;
    }

    try {
      const sessionData = this.context.globalState.get<any>(StandardTerminalSessionManager.STORAGE_KEY);
      
      if (!sessionData || !sessionData.terminals || sessionData.terminals.length === 0) {
        log('📭 [STANDARD-SESSION] No session data to send to WebView');
        return;
      }

      // WebViewにターミナル復元情報を送信
      await this.sidebarProvider._sendMessage({
        command: 'terminalRestoreInfo',
        terminals: sessionData.terminals,
        activeTerminalId: sessionData.activeTerminalId,
        config: sessionData.config,
        timestamp: Date.now(),
      });

      log(`✅ [STANDARD-SESSION] Terminal restore info sent to WebView: ${sessionData.terminals.length} terminals`);
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Failed to send restore info to WebView: ${String(error)}`);
    }
  }

  /**
   * セッションデータをクリア
   */
  public async clearSession(): Promise<void> {
    try {
      await this.context.globalState.update(StandardTerminalSessionManager.STORAGE_KEY, undefined);
      log('🗑️ [STANDARD-SESSION] Session data cleared');
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Failed to clear session: ${String(error)}`);
    }
  }

  /**
   * セッションの期限切れをチェック
   */
  private isSessionExpired(data: any): boolean {
    const now = Date.now();
    const ageMs = now - data.timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > StandardTerminalSessionManager.MAX_SESSION_AGE_DAYS;
  }

  /**
   * セッション情報を取得（デバッグ用）
   */
  public getSessionInfo(): any | null {
    return (
      this.context.globalState.get<any>(StandardTerminalSessionManager.STORAGE_KEY) || null
    );
  }

  /**
   * セッション統計を取得
   */
  public getSessionStats(): {
    hasSession: boolean;
    terminalCount: number;
    lastSaved: Date | null;
    isExpired: boolean;
    configEnabled: boolean;
  } {
    const sessionData = this.getSessionInfo();
    const config = this.getTerminalPersistenceConfig();

    if (!sessionData) {
      return {
        hasSession: false,
        terminalCount: 0,
        lastSaved: null,
        isExpired: false,
        configEnabled: config.enablePersistentSessions,
      };
    }

    return {
      hasSession: true,
      terminalCount: sessionData.terminals?.length || 0,
      lastSaved: new Date(sessionData.timestamp),
      isExpired: this.isSessionExpired(sessionData),
      configEnabled: config.enablePersistentSessions,
    };
  }
}