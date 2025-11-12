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

  // VS Code標準アプローチ: 複雑なメッセージパッシングは不要
  // StandardTerminalPersistenceManagerが自動的にscrollbackを管理

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager,
    private sidebarProvider?: {
      _sendMessage: (message: unknown) => Promise<void>;
      sendMessageToWebview: (message: unknown) => Promise<void>;
    }
  ) {}

  /**
   * SidebarProviderを設定
   */
  public setSidebarProvider(provider: unknown): void {
    this.sidebarProvider = provider as {
      _sendMessage: (message: unknown) => Promise<void>;
      sendMessageToWebview: (message: unknown) => Promise<void>;
    };
    log('🔧 [STANDARD-SESSION] Sidebar provider set');
  }

  // handleScrollbackDataResponse method removed - VS Code standard approach doesn't need complex message passing

  /**
   * VS Code標準のターミナル永続化設定を取得
   */
  private getTerminalPersistenceConfig(): {
    enablePersistentSessions: boolean;
    persistentSessionScrollback: number;
    persistentSessionReviveProcess: string;
  } {
    // Fixed: Use secondaryTerminal configuration namespace instead of terminal.integrated
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return {
      enablePersistentSessions: config.get<boolean>('enablePersistentSessions', true),
      persistentSessionScrollback: config.get<number>('persistentSessionScrollback', 100),
      persistentSessionReviveProcess: config.get<string>(
        'persistentSessionReviveProcess',
        'onExitAndWindowClose'
      ),
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

      // VS Code標準: ターミナル基本情報と履歴データの両方を保存
      const basicTerminals = terminals.map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        number: terminal.number,
        cwd: terminal.cwd || process.cwd(),
        isActive: terminal.id === activeTerminalId,
      }));

      // WebViewから履歴データを取得
      log('💾 [STANDARD-SESSION] Requesting scrollback data from WebView...');
      const terminalInfos = terminals.map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        number: terminal.number || 1,
        cwd: terminal.cwd || process.cwd(),
        isActive: terminal.id === activeTerminalId,
      }));
      const scrollbackData = await this.requestScrollbackDataFromWebView(terminalInfos);

      const sessionData = {
        terminals: basicTerminals,
        activeTerminalId: activeTerminalId || null,
        timestamp: Date.now(),
        version: StandardTerminalSessionManager.SESSION_VERSION,
        config: {
          scrollbackLines: config.persistentSessionScrollback,
          reviveProcess: config.persistentSessionReviveProcess,
        },
        // VS Code標準: 履歴データも保存
        scrollbackData: scrollbackData || {},
      };

      await this.context.globalState.update(
        StandardTerminalSessionManager.STORAGE_KEY,
        sessionData
      );

      log(
        `✅ [STANDARD-SESSION] VS Code standard session saved: ${basicTerminals.length} terminals`
      );
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
   * セッション情報を取得（復元前の確認用）
   */
  public getSessionInfo(): {
    exists: boolean;
    terminals?: Array<{
      id: string;
      name: string;
      number: number;
      cwd: string;
      isActive: boolean;
    }>;
    timestamp?: number;
    version?: string;
  } | null {
    try {
      const sessionData = this.context.globalState.get<{
        terminals: Array<{
          id: string;
          name: string;
          number: number;
          cwd: string;
          isActive: boolean;
        }>;
        activeTerminalId: string | null;
        timestamp: number;
        version: string;
        scrollbackData?: Record<string, unknown>;
        config?: {
          scrollbackLines: number;
          reviveProcess: string;
        };
      }>(StandardTerminalSessionManager.STORAGE_KEY);

      if (!sessionData?.terminals) {
        return { exists: false };
      }

      // セッション期限チェック
      if (this.isSessionExpired(sessionData)) {
        log('⏰ [STANDARD-SESSION] Session expired in getSessionInfo');
        return { exists: false };
      }

      return {
        exists: true,
        terminals: sessionData.terminals,
        timestamp: sessionData.timestamp,
        version: sessionData.version,
      };
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Error getting session info: ${String(error)}`);
      return null;
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

      const sessionData = this.context.globalState.get<{
        terminals: Array<{
          id: string;
          name: string;
          number: number;
          cwd: string;
          isActive: boolean;
        }>;
        activeTerminalId: string | null;
        timestamp: number;
        version: string;
        scrollbackData?: Record<string, unknown>;
        config?: {
          scrollbackLines: number;
          reviveProcess: string;
        };
      }>(StandardTerminalSessionManager.STORAGE_KEY);

      if (!sessionData?.terminals) {
        log('📁 [STANDARD-SESSION] No session data found');
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
        log(
          `⚠️ [STANDARD-SESSION] ${existingTerminals.length} terminals already exist, skipping restore`
        );
        return {
          success: true,
          restoredCount: 0,
          skippedCount: sessionData.terminals.length,
        };
      }

      // 既存ターミナルを削除（force restore時）
      if (forceRestore && existingTerminals.length > 0) {
        log(
          `🗑️ [STANDARD-SESSION] Force restore: deleting ${existingTerminals.length} existing terminals`
        );

        // 非同期削除処理を順次実行し、完了を待つ
        for (const terminal of existingTerminals) {
          try {
            log(`🗑️ [STANDARD-SESSION] Deleting existing terminal: ${terminal.id}`);
            const deleteResult = await this.terminalManager.deleteTerminal(terminal.id, {
              force: true,
            });

            if (deleteResult.success) {
              log(`✅ [STANDARD-SESSION] Successfully deleted terminal: ${terminal.id}`);
            } else {
              log(
                `⚠️ [STANDARD-SESSION] Failed to delete terminal ${terminal.id}: ${deleteResult.reason}`
              );
            }
          } catch (error) {
            log(`❌ [STANDARD-SESSION] Error deleting terminal ${terminal.id}: ${String(error)}`);
          }
        }

        // 削除処理完了後に少し待機（PTYプロセス終了の確実な完了を待つ）
        log('⏳ [STANDARD-SESSION] Waiting for terminal deletion to complete...');
        await new Promise((resolve) => setTimeout(resolve, 500));
        log('✅ [STANDARD-SESSION] Terminal deletion wait completed');
      }

      // 🎯 IMPROVED: Create all terminals first, then restore content
      const terminalCreationResults: Array<{
        originalInfo: any;
        terminalId: string | null;
        success: boolean;
      }> = [];
      
      let activeTerminalSet = false;

      // Step 1: Create all terminals
      for (const terminalInfo of sessionData.terminals) {
        try {
          log(`🔄 [STANDARD-SESSION] Creating terminal: ${terminalInfo.name}`);

          const terminalId = this.terminalManager.createTerminal();
          if (!terminalId) {
            log(`❌ [STANDARD-SESSION] Failed to create terminal for ${terminalInfo.name}`);
            terminalCreationResults.push({
              originalInfo: terminalInfo,
              terminalId: null,
              success: false,
            });
            continue;
          }

          // アクティブターミナル設定
          if (!activeTerminalSet && terminalInfo.isActive) {
            this.terminalManager.setActiveTerminal(terminalId);
            activeTerminalSet = true;
            log(`🎯 [STANDARD-SESSION] Set active terminal: ${terminalId}`);
          }

          terminalCreationResults.push({
            originalInfo: terminalInfo,
            terminalId: terminalId,
            success: true,
          });

          log(`✅ [STANDARD-SESSION] Created terminal: ${terminalInfo.name} (${terminalId})`);
        } catch (error) {
          log(
            `❌ [STANDARD-SESSION] Failed to create terminal ${terminalInfo.name}: ${String(error)}`
          );
          terminalCreationResults.push({
            originalInfo: terminalInfo,
            terminalId: null,
            success: false,
          });
        }
      }

      const successfulCreations = terminalCreationResults.filter(r => r.success);
      const restoredCount = successfulCreations.length;

      // Step 2: 🎯 IMPROVED: Wait a moment for terminals to fully initialize, then restore content
      if (restoredCount > 0 && sessionData.scrollbackData) {
        log('⏳ [STANDARD-SESSION] Waiting for terminal initialization before content restoration...');
        await new Promise((resolve) => setTimeout(resolve, 800)); // Wait for terminal setup

        log('🔄 [STANDARD-SESSION] Requesting scrollback restoration from WebView...');
        
        // Create terminal data mapping with new IDs
        const terminalRestoreData = successfulCreations.map(result => ({
          id: result.terminalId!,
          name: result.originalInfo.name,
          number: result.originalInfo.number,
          cwd: result.originalInfo.cwd,
          isActive: result.originalInfo.isActive,
          serializedContent: (sessionData.scrollbackData?.[result.originalInfo.id] as string) || '',
        }));

        await this.requestScrollbackRestoration(terminalRestoreData);
      }

      log(
        `✅ [STANDARD-SESSION] VS Code standard session restore completed: ${restoredCount} terminals`
      );
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
   * VS Code標準: WebViewから履歴データを取得
   */
  private async requestScrollbackDataFromWebView(
    terminals: Array<{
      id: string;
      name: string;
      number: number;
      cwd: string;
      isActive: boolean;
    }>
  ): Promise<Record<string, unknown>> {
    log(
      `📋 [STANDARD-SESSION] Requesting serialized terminal data from WebView PersistenceManager`
    );

    if (!this.sidebarProvider) {
      log('⚠️ [STANDARD-SESSION] No sidebar provider available for scrollback request');
      return {};
    }

    try {
      // 🎯 IMPROVED: Use Promise-based approach with proper timeout handling
      const requestId = `scrollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      return new Promise<Record<string, unknown>>((resolve) => {
        const timeout = setTimeout(() => {
          log('⏰ [STANDARD-SESSION] Timeout waiting for serialized data, using fallback');
          resolve({});
        }, 3000); // 3秒のタイムアウト（短縮）

        // 🎯 FIXED: Create a dedicated response handler to avoid conflicts
        const responseHandler = (data: Record<string, unknown>) => {
          clearTimeout(timeout);
          log(
            `✅ [STANDARD-SESSION] Received serialized data for ${Object.keys(data).length} terminals`
          );
          resolve(data);
        };

        // 🎯 IMPROVED: Store response handler for cleanup
        (this as any)._pendingScrollbackRequest = {
          requestId,
          handler: responseHandler,
          timestamp: Date.now(),
        };

        // WebView のStandardTerminalPersistenceManager から実際のシリアライズされたデータを取得
        this.sidebarProvider!.sendMessageToWebview({
          command: 'requestTerminalSerialization',
          terminalIds: terminals.map((t) => t.id),
          requestId: requestId,
          timestamp: Date.now(),
        });
      });
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Error requesting scrollback data: ${String(error)}`);
      return {};
    }
  }

  /**
   * WebViewからのscrollbackデータ応答を処理
   */
  private readonly handleScrollbackDataResponse = (_data: Record<string, unknown>): void => {
    // デフォルト実装（上記のPromiseで動的に上書きされる）
    log('📋 [STANDARD-SESSION] Default scrollback response handler called');
  };

  /**
   * WebViewからのシリアライゼーション応答を処理（外部から呼び出し可能）
   */
  public handleSerializationResponse(data: Record<string, unknown>): void {
    log(
      `📋 [STANDARD-SESSION] Received serialization response with ${Object.keys(data).length} terminals`
    );
    
    // 🎯 IMPROVED: Handle pending request properly
    const pendingRequest = (this as any)._pendingScrollbackRequest;
    if (pendingRequest?.handler) {
      pendingRequest.handler(data);
      // Clean up pending request
      delete (this as any)._pendingScrollbackRequest;
    } else {
      // Fallback to original handler
      this.handleScrollbackDataResponse(data);
    }
  }

  /**
   * VS Code標準: WebViewに履歴復元要求を送信
   */
  private async requestScrollbackRestoration(
    terminals: Array<{
      id: string;
      name: string;
      number: number;
      cwd: string;
      isActive: boolean;
      serializedContent?: string;
    }>
  ): Promise<void> {
    log(`🔄 [STANDARD-SESSION] Sending terminal restoration data to WebView PersistenceManager`);

    if (!this.sidebarProvider) {
      log('⚠️ [STANDARD-SESSION] No sidebar provider available for restoration');
      return;
    }

    try {
      // 🎯 IMPROVED: Use the passed terminal data directly with serialized content
      const terminalRestoreData = terminals.map(terminal => ({
        id: terminal.id,
        name: terminal.name,
        serializedContent: terminal.serializedContent || '',
        isActive: terminal.isActive,
      })).filter(data => data.serializedContent.length > 0); // Only restore terminals with content

      if (terminalRestoreData.length === 0) {
        log('📁 [STANDARD-SESSION] No terminals with serialized content to restore');
        return;
      }

      // WebViewにターミナル復元データを送信
      await this.sidebarProvider.sendMessageToWebview({
        command: 'restoreTerminalSerialization',
        terminalData: terminalRestoreData,
        timestamp: Date.now(),
      });

      log(
        `✅ [STANDARD-SESSION] Restoration data sent to WebView PersistenceManager (${terminalRestoreData.length} terminals with content)`
      );
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Error sending restoration data: ${String(error)}`);
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
      const sessionData = this.context.globalState.get<{
        terminals: Array<{
          id: string;
          name: string;
          number: number;
          cwd: string;
          isActive: boolean;
        }>;
        activeTerminalId: string | null;
        timestamp: number;
        version: string;
        scrollbackData?: Record<string, unknown>;
        config?: {
          scrollbackLines: number;
          reviveProcess: string;
        };
      }>(StandardTerminalSessionManager.STORAGE_KEY);

      if (!sessionData?.terminals || sessionData.terminals.length === 0) {
        log('📭 [STANDARD-SESSION] No session data to send to WebView');
        return;
      }

      // WebViewにターミナル復元情報を送信
      await this.sidebarProvider.sendMessageToWebview({
        command: 'terminalRestoreInfo',
        terminals: sessionData.terminals,
        activeTerminalId: sessionData.activeTerminalId,
        config: sessionData.config,
        timestamp: Date.now(),
      });

      log(
        `✅ [STANDARD-SESSION] Terminal restore info sent to WebView: ${sessionData.terminals.length} terminals`
      );
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
  private isSessionExpired(data: { timestamp: number }): boolean {
    const now = Date.now();
    const ageMs = now - data.timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > StandardTerminalSessionManager.MAX_SESSION_AGE_DAYS;
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
      lastSaved: sessionData.timestamp ? new Date(sessionData.timestamp) : null,
      isExpired: sessionData.timestamp
        ? this.isSessionExpired({ timestamp: sessionData.timestamp })
        : false,
      configEnabled: config.enablePersistentSessions,
    };
  }
}
