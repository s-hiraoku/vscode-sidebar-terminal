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
 * 統合セッション管理クラス
 * シンプルで確実に動作する実装に焦点を当て、段階的に機能を拡張
 */
export class UnifiedSessionManager {
  private static readonly STORAGE_KEY = 'unified-terminal-session';
  private static readonly SESSION_VERSION = '2.0.0';
  private static readonly MAX_SESSION_AGE_DAYS = 7;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager,
    private sidebarProvider?: any
  ) {}

  /**
   * SidebarProviderを設定
   */
  public setSidebarProvider(provider: any): void {
    this.sidebarProvider = provider;
    log('🔧 [SESSION] Sidebar provider set for UnifiedSessionManager');
  }

  /**
   * 現在のターミナル状態を保存
   */
  public async saveCurrentSession(): Promise<SimpleSaveResult> {
    try {
      log('💾 [SESSION] Starting unified session save...');

      const terminals = this.terminalManager.getTerminals();
      const activeTerminalId = this.terminalManager.getActiveTerminalId();

      if (terminals.length === 0) {
        log('📭 [SESSION] No terminals to save');
        return { success: true, terminalCount: 0 };
      }

      const sessionTerminals: SimpleTerminalInfo[] = [];

      for (const terminal of terminals) {
        log(`📋 [SESSION] Processing terminal ${terminal.id} (${terminal.name})`);

        const terminalInfo: SimpleTerminalInfo = {
          id: terminal.id,
          name: terminal.name,
          number: terminal.number,
          cwd: terminal.cwd || process.cwd(),
          isActive: terminal.id === activeTerminalId,
        };

        // Phase 1: Basic restoration without scrollback
        // Phase 2: Add scrollback restoration when basic functionality is stable
        const enableScrollback = vscode.workspace
          .getConfiguration('secondaryTerminal')
          .get<boolean>('restoreScrollback', false);

        if (enableScrollback && this.sidebarProvider) {
          // Request scrollback from WebView
          await this.requestScrollbackData(terminal.id);
          
          // Add basic session restore message
          terminalInfo.scrollback = [
            {
              content: `# Session restored for ${terminal.name} at ${new Date().toLocaleString()}`,
              type: 'output',
              timestamp: Date.now(),
            },
          ];
        }

        sessionTerminals.push(terminalInfo);
      }

      const sessionData: SimpleSessionData = {
        terminals: sessionTerminals,
        activeTerminalId: activeTerminalId || null,
        timestamp: Date.now(),
        version: UnifiedSessionManager.SESSION_VERSION,
      };

      await this.context.globalState.update(UnifiedSessionManager.STORAGE_KEY, sessionData);

      log(`✅ [SESSION] Unified session saved: ${terminals.length} terminals`);
      return {
        success: true,
        terminalCount: terminals.length,
      };
    } catch (error) {
      log(`❌ [SESSION] Save failed: ${error}`);
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
      log('🔄 [SESSION] === Unified Session Restore Start ===');

      const sessionData = this.context.globalState.get<SimpleSessionData>(
        UnifiedSessionManager.STORAGE_KEY
      );

      if (!sessionData) {
        log('📭 [SESSION] No session data found');
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      log(`🔍 [SESSION] Found session with ${sessionData.terminals.length} terminals`);

      // Validate session data
      if (!this.isValidSessionData(sessionData)) {
        log('⚠️ [SESSION] Invalid session data, clearing...');
        await this.clearSession();
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      // Check if session is expired
      if (this.isSessionExpired(sessionData)) {
        log('⏰ [SESSION] Session expired, clearing...');
        await this.clearSession();
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      // Skip if terminals already exist
      const existingTerminals = this.terminalManager.getTerminals();
      if (existingTerminals.length > 0) {
        log(`⚠️ [SESSION] ${existingTerminals.length} terminals already exist, skipping restore`);
        return {
          success: true,
          restoredCount: 0,
          skippedCount: sessionData.terminals.length,
        };
      }

      // Restore terminals
      let restoredCount = 0;
      let activeTerminalSet = false;

      for (const terminalInfo of sessionData.terminals) {
        try {
          log(`🔄 [SESSION] Restoring terminal: ${terminalInfo.name}`);
          
          const terminalId = this.terminalManager.createTerminal();
          if (!terminalId) {
            log(`❌ [SESSION] Failed to create terminal for ${terminalInfo.name}`);
            continue;
          }

          // Set active terminal (first active one found)
          if (!activeTerminalSet && terminalInfo.isActive) {
            this.terminalManager.setActiveTerminal(terminalId);
            activeTerminalSet = true;
            log(`🎯 [SESSION] Set active terminal: ${terminalId}`);
          }

          // Restore scrollback if available
          if (terminalInfo.scrollback && terminalInfo.scrollback.length > 0) {
            await this.restoreScrollbackData(terminalId, terminalInfo.scrollback);
          }

          restoredCount++;
          log(`✅ [SESSION] Restored terminal: ${terminalInfo.name} (${terminalId})`);
        } catch (error) {
          log(`❌ [SESSION] Failed to restore terminal ${terminalInfo.name}: ${error}`);
        }
      }

      log(`✅ [SESSION] Unified session restore completed: ${restoredCount} terminals`);
      return {
        success: true,
        restoredCount,
        skippedCount: sessionData.terminals.length - restoredCount,
      };
    } catch (error) {
      log(`❌ [SESSION] Restore failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * セッションデータをクリア
   */
  public async clearSession(): Promise<void> {
    try {
      await this.context.globalState.update(UnifiedSessionManager.STORAGE_KEY, undefined);
      log('🗑️ [SESSION] Unified session data cleared');
    } catch (error) {
      log(`❌ [SESSION] Failed to clear session: ${error}`);
    }
  }

  /**
   * スクロールバックデータをWebViewから要求
   */
  private async requestScrollbackData(terminalId: string): Promise<void> {
    if (!this.sidebarProvider) {
      return;
    }

    try {
      await this.sidebarProvider._sendMessage({
        command: 'getScrollback',
        terminalId,
        maxLines: 1000,
        timestamp: Date.now(),
      });
      log(`📋 [SESSION] Scrollback data requested for terminal ${terminalId}`);
    } catch (error) {
      log(`❌ [SESSION] Failed to request scrollback for ${terminalId}: ${error}`);
    }
  }

  /**
   * スクロールバックデータを復元
   */
  private async restoreScrollbackData(
    terminalId: string,
    scrollbackData: Array<{
      content: string;
      type?: 'output' | 'input' | 'error';
      timestamp?: number;
    }>
  ): Promise<void> {
    if (!this.sidebarProvider || !scrollbackData.length) {
      return;
    }

    try {
      // Wait for terminal to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      await this.sidebarProvider._sendMessage({
        command: 'restoreScrollback',
        terminalId,
        scrollbackContent: scrollbackData,
        timestamp: Date.now(),
      });

      log(`✅ [SESSION] Scrollback restored for terminal ${terminalId}: ${scrollbackData.length} lines`);
    } catch (error) {
      log(`❌ [SESSION] Failed to restore scrollback for ${terminalId}: ${error}`);
    }
  }

  /**
   * セッションデータの有効性をチェック
   */
  private isValidSessionData(data: any): data is SimpleSessionData {
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.terminals) &&
      typeof data.timestamp === 'number' &&
      typeof data.version === 'string' &&
      data.terminals.every(
        (t: any) =>
          typeof t.id === 'string' &&
          typeof t.name === 'string' &&
          typeof t.number === 'number' &&
          typeof t.cwd === 'string' &&
          typeof t.isActive === 'boolean'
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
    return ageDays > UnifiedSessionManager.MAX_SESSION_AGE_DAYS;
  }

  /**
   * セッション情報を取得（デバッグ用）
   */
  public async getSessionInfo(): Promise<SimpleSessionData | null> {
    return (
      this.context.globalState.get<SimpleSessionData>(UnifiedSessionManager.STORAGE_KEY) || null
    );
  }

  /**
   * セッション統計を取得
   */
  public async getSessionStats(): Promise<{
    hasSession: boolean;
    terminalCount: number;
    lastSaved: Date | null;
    isExpired: boolean;
  }> {
    const sessionData = await this.getSessionInfo();
    
    if (!sessionData) {
      return {
        hasSession: false,
        terminalCount: 0,
        lastSaved: null,
        isExpired: false,
      };
    }

    return {
      hasSession: true,
      terminalCount: sessionData.terminals.length,
      lastSaved: new Date(sessionData.timestamp),
      isExpired: this.isSessionExpired(sessionData),
    };
  }
}