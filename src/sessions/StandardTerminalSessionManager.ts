import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { extension as log } from '../utils/logger';
import { safeProcessCwd } from '../utils/common';

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

  private pendingRestoreResponse?: {
    expectedCount: number;
    resolve: (result: {
      restoredCount: number;
      totalCount: number;
      error?: string;
      timedOut?: boolean;
    }) => void;
    timeout: ReturnType<typeof setTimeout>;
  };

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
        cwd: terminal.cwd || safeProcessCwd(),
        isActive: terminal.id === activeTerminalId,
      }));

      // WebViewから履歴データを取得
      log('💾 [STANDARD-SESSION] Requesting scrollback data from WebView...');
      const terminalInfos = terminals.map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        number: terminal.number || 1,
        cwd: terminal.cwd || safeProcessCwd(),
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

      // Use workspaceState for per-workspace session isolation (multi-window support)
      await this.context.workspaceState.update(
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
      // Use workspaceState for per-workspace session isolation (multi-window support)
      const sessionData = this.context.workspaceState.get<{
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

      if (!sessionData || !sessionData.terminals) {
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

      // Use workspaceState for per-workspace session isolation (multi-window support)
      const sessionData = this.context.workspaceState.get<{
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

      if (!sessionData || !sessionData.terminals) {
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
      let restoredCount = successfulCreations.length;

      // Step 2: 🎯 IMPROVED: Wait a moment for terminals to fully initialize, then restore content
      if (restoredCount > 0 && sessionData.scrollbackData) {
        log('⏳ [STANDARD-SESSION] Waiting for terminal initialization before content restoration...');
        await new Promise((resolve) => setTimeout(resolve, 800)); // Wait for terminal setup

        log('🔄 [STANDARD-SESSION] Requesting scrollback restoration from WebView...');
        
        // Create terminal data mapping with new IDs
        const terminalRestoreData = successfulCreations.map(result => {
          const rawScrollback = sessionData.scrollbackData?.[result.originalInfo.id];
          let serializedContent = '';

          if (typeof rawScrollback === 'string') {
            serializedContent = rawScrollback;
          } else if (Array.isArray(rawScrollback)) {
            serializedContent = rawScrollback.filter((line): line is string => typeof line === 'string').join('\n');
          }

          return {
            id: result.terminalId!,
            name: result.originalInfo.name,
            number: result.originalInfo.number,
            cwd: result.originalInfo.cwd,
            isActive: result.originalInfo.isActive,
            serializedContent,
          };
        });

        const restoreResult = await this.requestScrollbackRestoration(terminalRestoreData);

        if (restoreResult) {
          restoredCount = restoreResult.restoredCount;
        }

        if (!restoreResult || restoreResult.restoredCount < terminalRestoreData.length) {
          log(
            `⚠️ [STANDARD-SESSION] Serialization restore incomplete (${restoreResult?.restoredCount ?? 0}/${terminalRestoreData.length}) - attempting scrollback fallback`
          );

          const fallbackRestored = await this.restoreScrollbackFallback(
            successfulCreations,
            sessionData.scrollbackData || {}
          );

          if (fallbackRestored > 0) {
            log(
              `✅ [STANDARD-SESSION] Fallback scrollback restore succeeded for ${fallbackRestored} terminals`
            );
            restoredCount = fallbackRestored;
          } else {
            log('❌ [STANDARD-SESSION] Fallback scrollback restore failed');
            restoredCount = restoreResult?.restoredCount ?? 0;
          }
        }
      } else if (restoredCount > 0) {
        log('⚠️ [STANDARD-SESSION] No scrollback data available for restored terminals');
        restoredCount = 0;
      }

      log(
        `✅ [STANDARD-SESSION] VS Code standard session restore completed: ${restoredCount} terminals`
      );
      return {
        success: restoredCount > 0,
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
      `📋 [STANDARD-SESSION] Requesting scrollback data from WebView via extractScrollbackData`
    );

    if (!this.sidebarProvider) {
      log('⚠️ [STANDARD-SESSION] No sidebar provider available for scrollback request');
      return {};
    }

    try {
      // 🎯 FIX: Use extractScrollbackData command like SecondaryTerminalProvider does
      const scrollbackDataMap: Record<string, string[]> = {};

      // Request scrollback data for each terminal
      await Promise.all(
        terminals.map(async (terminal) => {
          try {
            const requestId = `scrollback-${terminal.id}-${Date.now()}`;

            const scrollbackData = await new Promise<string[]>((resolve) => {
              const timeout = setTimeout(() => {
                log(`⏰ [STANDARD-SESSION] Timeout for terminal ${terminal.id}, using empty scrollback`);
                resolve([]);
              }, 10000); // 10 second timeout per terminal

              // Store pending request
              if (!(this as any)._pendingScrollbackRequests) {
                (this as any)._pendingScrollbackRequests = new Map();
              }

              (this as any)._pendingScrollbackRequests.set(requestId, {
                resolve,
                timeout,
                terminalId: terminal.id,
              });

              // Send extractScrollbackData command to WebView
              this.sidebarProvider!.sendMessageToWebview({
                command: 'extractScrollbackData',
                terminalId: terminal.id,
                requestId,
                maxLines: 1000,
                timestamp: Date.now(),
              });
            });

            if (scrollbackData && scrollbackData.length > 0) {
              scrollbackDataMap[terminal.id] = scrollbackData;
              log(`✅ [STANDARD-SESSION] Received ${scrollbackData.length} lines for terminal ${terminal.id}`);
            }
          } catch (error) {
            log(`❌ [STANDARD-SESSION] Failed to get scrollback for terminal ${terminal.id}:`, error);
          }
        })
      );

      log(`✅ [STANDARD-SESSION] Collected scrollback data for ${Object.keys(scrollbackDataMap).length}/${terminals.length} terminals`);
      return scrollbackDataMap;
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Failed to request scrollback data:`, error);
      return {};
    }
  }

  /**
   * Handle scrollback data response from WebView
   */
  public handleScrollbackDataResponse(message: {
    command: string;
    requestId?: string;
    terminalId?: string;
    scrollbackData?: string[];
    error?: string;
  }): void {
    if (!message.requestId) {
      return;
    }

    const pendingRequests = (this as any)._pendingScrollbackRequests as Map<string, any> | undefined;
    if (!pendingRequests) {
      return;
    }

    const pendingRequest = pendingRequests.get(message.requestId);
    if (!pendingRequest) {
      log(`⚠️ [STANDARD-SESSION] No pending request found for ${message.requestId}`);
      return;
    }

    // Clear timeout and resolve promise
    clearTimeout(pendingRequest.timeout);
    pendingRequests.delete(message.requestId);

    if (message.error) {
      log(`⚠️ [STANDARD-SESSION] Scrollback extraction error for terminal ${message.terminalId}: ${message.error}`);
      pendingRequest.resolve([]);
    } else {
      log(`✅ [STANDARD-SESSION] Scrollback data received for terminal ${message.terminalId}: ${message.scrollbackData?.length || 0} lines`);
      pendingRequest.resolve(message.scrollbackData || []);
    }
  }

  /**
   * WebViewからのscrollbackデータ応答を処理（旧実装・非推奨）
   */
  private _legacyScrollbackResponseHandler = (_data: Record<string, unknown>): void => {
    // デフォルト実装（上記のPromiseで動的に上書きされる）
    log('📋 [STANDARD-SESSION] Legacy scrollback response handler called');
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
    if (pendingRequest && pendingRequest.handler) {
      pendingRequest.handler(data);
      // Clean up pending request
      delete (this as any)._pendingScrollbackRequest;
    } else {
      // Fallback to legacy handler
      this._legacyScrollbackResponseHandler(data);
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
  ): Promise<{
    restoredCount: number;
    totalCount: number;
    error?: string;
    timedOut?: boolean;
  } | null> {
    log(`🔄 [STANDARD-SESSION] Sending terminal restoration data to WebView PersistenceManager`);

    if (!this.sidebarProvider) {
      log('⚠️ [STANDARD-SESSION] No sidebar provider available for restoration');
      return null;
    }

    try {
      // 🎯 IMPROVED: Use the passed terminal data directly with serialized content
      const terminalRestoreData = terminals.map(terminal => ({
        id: terminal.id,
        name: terminal.name,
        serializedContent: terminal.serializedContent || '',
        isActive: terminal.isActive,
      })).filter(data => data.serializedContent.length > 0); // Only restore terminals with content

      const expectedCount = terminalRestoreData.length;

      if (expectedCount === 0) {
        log('📁 [STANDARD-SESSION] No terminals with serialized content to restore');
        return {
          restoredCount: 0,
          totalCount: 0,
        };
      }

      return await new Promise((resolve) => {
        let pendingEntry!: {
          expectedCount: number;
          resolve: (result: {
            restoredCount: number;
            totalCount: number;
            error?: string;
            timedOut?: boolean;
          }) => void;
          timeout: ReturnType<typeof setTimeout>;
        };

        const timeout = setTimeout(() => {
          if (this.pendingRestoreResponse === pendingEntry) {
            this.pendingRestoreResponse = undefined;
          }
          resolve({
            restoredCount: 0,
            totalCount: expectedCount,
            error: 'timeout',
            timedOut: true,
          });
        }, 8000);

        pendingEntry = {
          expectedCount,
          timeout,
          resolve: (result) => {
            clearTimeout(timeout);
            if (this.pendingRestoreResponse === pendingEntry) {
              this.pendingRestoreResponse = undefined;
            }
            resolve(result);
          },
        };

        this.pendingRestoreResponse = pendingEntry;

        void this.sidebarProvider!
          .sendMessageToWebview({
            command: 'restoreTerminalSerialization',
            terminalData: terminalRestoreData,
            timestamp: Date.now(),
          })
          .then(() => {
            log(
              `✅ [STANDARD-SESSION] Restoration data sent to WebView PersistenceManager (${expectedCount} terminals with content)`
            );
          })
          .catch((error) => {
            log(`❌ [STANDARD-SESSION] Error sending restoration data: ${String(error)}`);
            pendingEntry.resolve({
              restoredCount: 0,
              totalCount: expectedCount,
              error: String(error),
            });
          });
      });
    } catch (error) {
      log(`❌ [STANDARD-SESSION] Error sending restoration data: ${String(error)}`);
      return {
        restoredCount: 0,
        totalCount: terminals.length,
        error: String(error),
      };
    }
  }

  public handleSerializationRestoreResponse(message: Record<string, unknown>): void {
    log('📋 [STANDARD-SESSION] Received serialization restore response from WebView');

    const pending = this.pendingRestoreResponse;
    if (!pending) {
      log('⚠️ [STANDARD-SESSION] No pending restore request to resolve');
      return;
    }

    const restoredCount = typeof message.restoredCount === 'number' ? message.restoredCount : 0;
    const totalCount = typeof message.totalCount === 'number' ? message.totalCount : pending.expectedCount;
    const error = typeof message.error === 'string' ? message.error : undefined;

    pending.resolve({
      restoredCount,
      totalCount,
      error,
    });
  }

  private async restoreScrollbackFallback(
    terminalCreationResults: Array<{
      originalInfo: any;
      terminalId: string | null;
      success: boolean;
    }>,
    scrollbackData: Record<string, unknown>
  ): Promise<number> {
    if (!this.sidebarProvider) {
      log('⚠️ [STANDARD-SESSION] Cannot perform fallback restoration without sidebar provider');
      return 0;
    }

    let restored = 0;

    for (const result of terminalCreationResults) {
      if (!result.success || !result.terminalId) {
        continue;
      }

      const originalId = result.originalInfo?.id;
      if (!originalId) {
        continue;
      }

      const lines = scrollbackData?.[originalId];
      if (!Array.isArray(lines) || lines.length === 0) {
        log(`⚠️ [STANDARD-SESSION] No fallback scrollback data for terminal ${originalId}`);
        continue;
      }

      const sanitizedLines = (lines as unknown[]).filter((line): line is string => typeof line === 'string');

      if (sanitizedLines.length === 0) {
        continue;
      }

      try {
        await this.sidebarProvider.sendMessageToWebview({
          command: 'restoreScrollback',
          terminalId: result.terminalId,
          scrollback: sanitizedLines,
          timestamp: Date.now(),
        });
        restored++;
      } catch (error) {
        log(
          `❌ [STANDARD-SESSION] Failed to send fallback scrollback for ${result.terminalId}: ${String(error)}`
        );
      }
    }

    return restored;
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
      // Use workspaceState for per-workspace session isolation (multi-window support)
      const sessionData = this.context.workspaceState.get<{
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

      if (!sessionData || !sessionData.terminals || sessionData.terminals.length === 0) {
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
      // Use workspaceState for per-workspace session isolation (multi-window support)
      await this.context.workspaceState.update(StandardTerminalSessionManager.STORAGE_KEY, undefined);
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
