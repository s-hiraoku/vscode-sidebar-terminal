import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { SimpleSessionManager } from '../sessions/SimpleSessionManager';
// import { ScrollbackSessionManager } from '../sessions/ScrollbackSessionManager'; // Temporarily disabled for simplified implementation
import { extension as log, logger, LogLevel } from '../utils/logger';
import { FileReferenceCommand, TerminalCommand } from '../commands';
import { CopilotIntegrationCommand } from '../commands/CopilotIntegrationCommand';
import { VSCODE_COMMANDS } from '../constants';

/**
 * VS Code拡張機能のライフサイクル管理
 * 初期化、コマンド登録、クリーンアップを担当
 */
export class ExtensionLifecycle {
  private terminalManager: TerminalManager | undefined;
  private sidebarProvider: SecondaryTerminalProvider | undefined;
  private simpleSessionManager: SimpleSessionManager | undefined;
  // private scrollbackSessionManager: ScrollbackSessionManager | undefined; // Temporarily disabled
  private fileReferenceCommand: FileReferenceCommand | undefined;
  private terminalCommand: TerminalCommand | undefined;
  private copilotIntegrationCommand: CopilotIntegrationCommand | undefined;

  // シンプルな復元管理
  private _restoreExecuted = false;

  /**
   * ScrollbackSessionManagerへのアクセスを提供
   * Temporarily disabled for simplified implementation
   */
  // public getScrollbackSessionManager(): ScrollbackSessionManager | undefined {
  //   return this.scrollbackSessionManager;
  // }

  /**
   * 拡張機能の起動処理
   */
  activate(context: vscode.ExtensionContext): void {
    log('🚀 [EXTENSION] === ACTIVATION START ===');

    // Configure logger based on extension mode
    if (context.extensionMode === vscode.ExtensionMode.Development) {
      logger.setLevel(LogLevel.DEBUG);
      log('🔧 [EXTENSION] Logger set to DEBUG mode');
    } else {
      logger.setLevel(LogLevel.WARN);
      log('⚠️ [EXTENSION] Logger set to WARN mode');
    }

    // Get extension version info
    const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
    const version = (extension?.packageJSON as { version?: string })?.version || 'unknown';

    log('Sidebar Terminal extension is now active!');
    log(`Extension version: ${version}`);
    log('Extension path:', context.extensionPath);

    try {
      // Ensure node-pty looks for release binaries
      process.env.NODE_PSTY_DEBUG = '0';

      // Initialize terminal manager
      this.terminalManager = new TerminalManager();

      // Initialize simple session manager
      log('🔧 [EXTENSION] Initializing simple session manager...');
      this.simpleSessionManager = new SimpleSessionManager(context, this.terminalManager);
      log('✅ [EXTENSION] Simple session manager initialized');

      // Initialize scrollback session manager - Temporarily disabled
      // log('🔧 [EXTENSION] Initializing scrollback session manager...');
      // this.scrollbackSessionManager = new ScrollbackSessionManager(context);
      // log('✅ [EXTENSION] Scrollback session manager initialized');

      // Initialize command handlers
      this.fileReferenceCommand = new FileReferenceCommand(this.terminalManager);
      this.terminalCommand = new TerminalCommand(this.terminalManager);
      this.copilotIntegrationCommand = new CopilotIntegrationCommand();

      // Register the sidebar terminal provider
      this.sidebarProvider = new SecondaryTerminalProvider(context, this.terminalManager);

      // Set sidebar provider for SimpleSessionManager
      if (this.simpleSessionManager) {
        this.simpleSessionManager.setSidebarProvider(
          this.sidebarProvider as unknown as { [key: string]: unknown }
        );
        log('🔧 [EXTENSION] Sidebar provider set for SimpleSessionManager');
      }

      // Register webview providers for both sidebar and panel
      const sidebarWebviewProvider = vscode.window.registerWebviewViewProvider(
        SecondaryTerminalProvider.viewType,
        this.sidebarProvider,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
      );
      context.subscriptions.push(sidebarWebviewProvider);

      // Register all commands
      this.registerCommands(context);

      // Setup session manager event listeners - DISABLED FOR DEBUGGING
      // this.setupSessionEventListeners();

      // デバッグコマンドを完全削除 - 無限ループの原因防止

      // VS Code完全初期化後に復元処理を実行（無限ループ修正済み）
      log('🔧 [EXTENSION] Scheduling session restore after VS Code initialization...');

      // 少し遅延させてVS Code完全初期化を待つ
      setTimeout(() => {
        void this.executeOneTimeRestore();
      }, 2000); // 2秒遅延で確実性を確保

      // 自動保存設定（復元完了後にのみ有効化）
      this.setupSessionAutoSave(context);

      log('✅ Sidebar Terminal extension activated successfully');
    } catch (error) {
      log('Failed to activate Sidebar Terminal extension:', error);
      void vscode.window.showErrorMessage(
        `Failed to activate Sidebar Terminal: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * コマンド登録
   */
  private registerCommands(context: vscode.ExtensionContext): void {
    const commandDisposables = [
      // ======================= メインコマンド =======================
      {
        command: 'secondaryTerminal.createTerminal',
        handler: () => {
          log('🔧 [DEBUG] Command executed: createTerminal');
          // TODO: SecondaryTerminalProviderにhandleNewTerminalメソッドを追加する必要があります
          void vscode.window.showInformationMessage(
            'Create terminal functionality needs to be implemented'
          );
        },
      },
      {
        command: 'secondaryTerminal.splitTerminal',
        handler: () => {
          log('🔧 [DEBUG] Command executed: splitTerminal');
          this.sidebarProvider?.splitTerminal();
        },
      },
      {
        command: 'secondaryTerminal.focus',
        handler: () => {
          log('🔧 [DEBUG] Command executed: focus');
          void vscode.commands.executeCommand(VSCODE_COMMANDS.SECONDARY_TERMINAL_VIEW_FOCUS);
        },
      },

      // ======================= ファイル参照コマンド =======================
      {
        command: 'secondaryTerminal.sendAtMention',
        handler: () => {
          log('🔧 [DEBUG] Command executed: sendAtMention (independent @filename command)');
          void this.fileReferenceCommand?.handleSendAtMention();
        },
      },

      // ======================= GitHub Copilot統合コマンド =======================
      {
        command: 'secondaryTerminal.activateCopilot',
        handler: () => {
          log(
            '🔧 [DEBUG] Command executed: activateCopilot (GitHub Copilot Chat integration - CMD+K CMD+C)'
          );
          void this.copilotIntegrationCommand?.handleActivateCopilot();
        },
      },

      // ======================= ターミナル操作コマンド =======================
      {
        command: 'secondaryTerminal.sendToTerminal',
        handler: (content?: string) => {
          log('🔧 [DEBUG] Command executed: sendToTerminal');
          this.terminalCommand?.handleSendToTerminal(content);
        },
      },

      // ======================= 設定コマンド =======================
      {
        command: 'secondaryTerminal.openSettings',
        handler: () => {
          log('🔧 [DEBUG] Command executed: openSettings');
          this.sidebarProvider?.openSettings();
        },
      },

      // ======================= シンプルセッション管理コマンド =======================
      {
        command: 'secondaryTerminal.saveSession',
        handler: async () => {
          log('🔧 [DEBUG] Command executed: saveSession (simple)');
          await this.handleSimpleSaveSessionCommand();
        },
      },
      {
        command: 'secondaryTerminal.restoreSession',
        handler: async () => {
          log('🔧 [DEBUG] Command executed: restoreSession (simple)');
          await this.handleSimpleRestoreSessionCommand();
        },
      },
      {
        command: 'secondaryTerminal.clearSession',
        handler: async () => {
          log('🔧 [DEBUG] Command executed: clearSession (simple)');
          await this.handleSimpleClearSessionCommand();
        },
      },
      // ======================= Scrollbackテストコマンド =======================
      {
        command: 'secondaryTerminal.testScrollback',
        handler: async () => {
          log('🔧 [DEBUG] Command executed: testScrollback');
          await this.handleTestScrollbackCommand();
        },
      },
    ];

    // Register all commands
    commandDisposables.forEach(({ command, handler }) => {
      const disposable = vscode.commands.registerCommand(command, handler);
      context.subscriptions.push(disposable);
    });
  }

  /**
   * 拡張機能の停止処理
   */
  deactivate(): void {
    log('🔧 [EXTENSION] Starting deactivation...');

    // シンプルセッション保存処理
    this.saveSimpleSessionOnExit();

    // Dispose simple session manager
    if (this.simpleSessionManager) {
      log('🔧 [EXTENSION] Disposing simple session manager...');
      this.simpleSessionManager = undefined;
    }

    // Dispose scrollback session manager - Temporarily disabled
    // if (this.scrollbackSessionManager) {
    //   log('🔧 [EXTENSION] Disposing scrollback session manager...');
    //   this.scrollbackSessionManager = undefined;
    // }

    // Dispose terminal manager
    if (this.terminalManager) {
      log('🔧 [EXTENSION] Disposing terminal manager...');
      this.terminalManager.dispose();
      this.terminalManager = undefined;
    }

    // Dispose sidebar provider
    if (this.sidebarProvider) {
      log('🔧 [EXTENSION] Disposing sidebar provider...');
      this.sidebarProvider.dispose();
      this.sidebarProvider = undefined;
    }

    // Clear command handlers
    this.fileReferenceCommand = undefined;
    this.terminalCommand = undefined;
    this.copilotIntegrationCommand = undefined;

    log('✅ [EXTENSION] Deactivation complete');
  }

  /**
   * 現在のターミナルマネージャーを取得（テスト用）
   */
  getTerminalManager(): TerminalManager | undefined {
    return this.terminalManager;
  }

  /**
   * 現在のサイドバープロバイダーを取得（テスト用）
   */
  getSidebarProvider(): SecondaryTerminalProvider | undefined {
    return this.sidebarProvider;
  }

  /**
   * 現在のシンプルセッションマネージャーを取得（テスト用）
   */
  getSimpleSessionManager(): SimpleSessionManager | undefined {
    return this.simpleSessionManager;
  }

  // ==================== セッション管理関連のメソッド - DISABLED FOR DEBUGGING ====================

  /**
   * 起動時のセッション復元処理 - DISABLED FOR DEBUGGING
   */
  /*
  private async restoreSessionOnStartup(): Promise<void> {
    try {
      if (!this.sessionManager) {
        log('⚠️ [SESSION] Session manager not initialized');
        return;
      }

      log('🔄 [SESSION] Starting session restore on startup...');

      // 少し遅延させてから復元（他の初期化処理完了を待つ）
      try {
        if (this.sessionManager && this.terminalManager) {
          log('🔄 [SESSION] Executing session restore...');
          const result = await this.sessionManager.restoreSession();

          if (result.success && result.restoredTerminalCount > 0) {
            log(`✅ [SESSION] Session restored: ${result.restoredTerminalCount} terminals`);

            // 復元完了後の初期化処理
            this.terminalManager.finalizeSessionRestore();

            // ユーザーに通知（オプション）
            void vscode.window.showInformationMessage(
              `Terminal session restored: ${result.restoredTerminalCount} terminals`
            );
          } else {
            log('📭 [SESSION] No session data found - creating initial terminal');
            // Create initial terminal when no session data exists
            this.createFallbackTerminal();
          }
        } else {
          log('⚠️ [SESSION] Session manager not available - creating initial terminal');
          if (this.terminalManager) {
            this.createFallbackTerminal();
          }
        }
      } catch (error) {
        log(`❌ [SESSION] Error during session restore: ${error} - creating fallback terminal`);
        this.createFallbackTerminal();
      }
    } catch (error) {
      log(`❌ [SESSION] Error during session restore: ${error}`);
    }
  }
  */

  /**
   * 終了時のセッション保存処理 - DISABLED FOR DEBUGGING
   */
  /*
  private saveSessionOnExit(): void {
    try {
      if (!this.sessionManager) {
        log('⚠️ [SESSION] Session manager not available for save on exit');
        return;
      }

      log('💾 [SESSION] Saving session on exit...');

      // 同期的に保存処理を実行（非同期では拡張終了に間に合わない可能性）
      this.sessionManager
        .saveCurrentSession()
        .then((result) => {
          if (result.success) {
            log(`✅ [SESSION] Session saved on exit: ${result.terminalCount} terminals`);
          } else {
            log(`❌ [SESSION] Failed to save session on exit: ${result.error}`);
          }
        })
        .catch((error) => {
          log(`❌ [SESSION] Error saving session on exit: ${error}`);
        });
    } catch (error) {
      log(`❌ [SESSION] Error during session save on exit: ${error}`);
    }
  }
  */

  /**
   * VS Code終了時の自動保存設定 - ENABLED FOR TESTING
   */
  private setupSessionAutoSave(_context: vscode.ExtensionContext): void {
    // 無限ループを防ぐため、VS Code終了時の保存のみ
    // 定期保存や自動保存は完全無効化
    log('🔧 [EXTENSION] Auto-save setup simplified (exit-only)');
  }

  /**
   * Setup session manager event listeners to forward notifications to WebView - DISABLED FOR DEBUGGING
   */
  /*
  private setupSessionEventListeners(): void {
    if (!this.sessionManager || !this.sidebarProvider) {
      log('❌ [SESSION] Cannot setup event listeners - missing dependencies');
      return;
    }

    log('🔧 [SESSION] Setting up session event listeners...');

    // Session restore events
    this.sessionManager.on('sessionRestoreStarted', (data: { terminalCount: number }) => {
      this.sidebarProvider?.sendSessionMessage({
        command: 'sessionRestoreStarted',
        terminalCount: data.terminalCount,
      });
    });

    this.sessionManager.on('sessionRestoreProgress', (data: { restored: number; total: number }) => {
      this.sidebarProvider?.sendSessionMessage({
        command: 'sessionRestoreProgress',
        restored: data.restored,
        total: data.total,
      });
    });

    this.sessionManager.on(
      'sessionRestoreCompleted',
      (data: { restoredCount: number; skippedCount: number }) => {
        this.sidebarProvider?.sendSessionMessage({
          command: 'sessionRestoreCompleted',
          restoredCount: data.restoredCount,
          skippedCount: data.skippedCount,
        });
      }
    );

    this.sessionManager.on(
      'sessionRestoreError',
      (data: { error: string; partialSuccess: boolean; errorType?: string; recoveryAction?: string }) => {
        this.sidebarProvider?.sendSessionMessage({
          command: 'sessionRestoreError',
          error: data.error,
          partialSuccess: data.partialSuccess,
          errorType: data.errorType,
          recoveryAction: data.recoveryAction,
        });
      }
    );

    this.sessionManager.on(
      'terminalRestoreError',
      (data: { terminalId: string; terminalName: string; error: string; errorType: string }) => {
        this.sidebarProvider?.sendSessionMessage({
          command: 'terminalRestoreError',
          terminalId: data.terminalId,
          terminalName: data.terminalName,
          error: data.error,
          errorType: data.errorType,
        });
      }
    );

    this.sessionManager.on('sessionRestoreSkipped', (data: { reason: string }) => {
      this.sidebarProvider?.sendSessionMessage({
        command: 'sessionRestoreSkipped',
        reason: data.reason,
      });
    });

    // Session save events
    this.sessionManager.on('sessionSaved', (data: { terminalCount: number }) => {
      this.sidebarProvider?.sendSessionMessage({
        command: 'sessionSaved',
        terminalCount: data.terminalCount,
      });
    });

    this.sessionManager.on('sessionSaveError', (data: { error: string }) => {
      this.sidebarProvider?.sendSessionMessage({
        command: 'sessionSaveError',
        error: data.error,
      });
    });

    // Session clear events
    this.sessionManager.on('sessionCleared', () => {
      this.sidebarProvider?.sendSessionMessage({
        command: 'sessionCleared',
      });
    });

    log('✅ [SESSION] Session event listeners configured');
  }

  /**
   * Handle save session command - DISABLED FOR DEBUGGING
   */
  /*
  private async handleSaveSessionCommand(): Promise<void> {
    if (!this.sessionManager) {
      await vscode.window.showErrorMessage('Session manager not available');
      return;
    }

    try {
      const result = await this.sessionManager.saveCurrentSession();
      if (result.success) {
        await vscode.window.showInformationMessage(
          `Terminal session saved successfully (${result.terminalCount} terminal${result.terminalCount > 1 ? 's' : ''})`
        );
      } else {
        await vscode.window.showErrorMessage(`Failed to save session: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Failed to save session: ${error}`);
    }
  }

  /**
   * Handle restore session command - DISABLED FOR DEBUGGING
   */
  /*
  private async handleRestoreSessionCommand(): Promise<void> {
    if (!this.sessionManager) {
      await vscode.window.showErrorMessage('Session manager not available');
      return;
    }

    try {
      const result = await this.sessionManager.restoreSession();
      if (result.success) {
        if (result.restoredTerminalCount > 0) {
          await vscode.window.showInformationMessage(
            `Terminal session restored successfully: ${result.restoredTerminalCount} terminal${result.restoredTerminalCount > 1 ? 's' : ''} restored${result.skippedTerminalCount > 0 ? `, ${result.skippedTerminalCount} skipped` : ''}`
          );
        } else {
          await vscode.window.showInformationMessage('No previous session data found to restore');
        }
      } else {
        await vscode.window.showErrorMessage(`Failed to restore session: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Failed to restore session: ${error}`);
    }
  }

  /**
   * Handle clear session command - DISABLED FOR DEBUGGING
   */
  /*
  private async handleClearSessionCommand(): Promise<void> {
    if (!this.sessionManager) {
      await vscode.window.showErrorMessage('Session manager not available');
      return;
    }

    // Confirm before clearing
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to clear all saved terminal session data?',
      { modal: true },
      'Clear Session'
    );

    if (confirm === 'Clear Session') {
      try {
        await this.sessionManager.clearSession();
        await vscode.window.showInformationMessage('Terminal session data cleared successfully');
      } catch (error) {
        await vscode.window.showErrorMessage(`Failed to clear session: ${error}`);
      }
    }
  }
  */

  // ==================== シンプルセッション管理メソッド ====================

  /**
   * シンプルセッション保存コマンドハンドラー
   */
  private async handleSimpleSaveSessionCommand(): Promise<void> {
    if (!this.simpleSessionManager) {
      await vscode.window.showErrorMessage('Simple session manager not available');
      return;
    }

    try {
      // Scrollback抽出処理（復元機能を完全動作させるため）
      log('📋 [SIMPLE_SESSION] Starting scrollback extraction...');
      await this.extractScrollbackFromAllTerminals();
      log('✅ [SIMPLE_SESSION] Scrollback extraction completed');

      // 通常のセッション保存を実行
      const result = await this.simpleSessionManager.saveCurrentSession();
      if (result.success) {
        await vscode.window.showInformationMessage(
          `Terminal session saved successfully (${result.terminalCount} terminal${result.terminalCount !== 1 ? 's' : ''})`
        );
      } else {
        await vscode.window.showErrorMessage(
          `Failed to save session: ${result.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to save session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * シンプルセッション復元コマンドハンドラー
   */
  private async handleSimpleRestoreSessionCommand(): Promise<void> {
    if (!this.simpleSessionManager) {
      await vscode.window.showErrorMessage('Simple session manager not available');
      return;
    }

    try {
      const result = await this.simpleSessionManager.restoreSession();

      if (result.success) {
        if (result.restoredCount && result.restoredCount > 0) {
          // Scrollbackデータも復元
          await this.restoreScrollbackForAllTerminals();

          await vscode.window.showInformationMessage(
            `Terminal session restored: ${result.restoredCount} terminal${result.restoredCount > 1 ? 's' : ''} restored${result.skippedCount && result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ''}`
          );
        } else {
          await vscode.window.showInformationMessage('No previous session data found to restore');
        }
      } else {
        await vscode.window.showErrorMessage(
          `Failed to restore session: ${result.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to restore session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * シンプルセッションクリアコマンドハンドラー
   */
  private async handleSimpleClearSessionCommand(): Promise<void> {
    if (!this.simpleSessionManager) {
      await vscode.window.showErrorMessage('Simple session manager not available');
      return;
    }

    // Confirm before clearing
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to clear all saved terminal session data?',
      { modal: true },
      'Clear Session'
    );

    if (confirm === 'Clear Session') {
      try {
        await this.simpleSessionManager.clearSession();
        await vscode.window.showInformationMessage('Terminal session data cleared successfully');
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Failed to clear session: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * 終了時のシンプルセッション保存処理
   */
  private saveSimpleSessionOnExit(): void {
    try {
      if (!this.simpleSessionManager) {
        log('⚠️ [SIMPLE_SESSION] Session manager not available, skipping save on exit');
        return;
      }

      log('💾 [SIMPLE_SESSION] Saving session on exit...');

      // 同期的に保存処理を実行
      this.simpleSessionManager
        .saveCurrentSession()
        .then((result) => {
          if (result.success) {
            log(`✅ [SIMPLE_SESSION] Session saved on exit: ${result.terminalCount} terminals`);
          } else {
            log(`❌ [SIMPLE_SESSION] Failed to save session on exit: ${result.error}`);
          }
        })
        .catch((error) => {
          log(`❌ [SIMPLE_SESSION] Exception during session save on exit: ${String(error)}`);
        });
    } catch (error) {
      log(`❌ [SIMPLE_SESSION] Error during saveSimpleSessionOnExit: ${String(error)}`);
    }
  }

  /**
   * シンプルな復元実行（1回のみ）
   */
  private async executeOneTimeRestore(): Promise<void> {
    // 重複実行防止
    if (this._restoreExecuted) {
      log('⚠️ [EXTENSION] Restore already executed, skipping');
      return;
    }

    this._restoreExecuted = true;

    try {
      log('🔄 [EXTENSION] Starting session restore...');

      if (!this.simpleSessionManager) {
        log('❌ [EXTENSION] Session manager not available');
        return;
      }

      const result = await this.simpleSessionManager.restoreSession();

      if (result.success && result.restoredCount && result.restoredCount > 0) {
        log(`✅ [EXTENSION] Restored ${result.restoredCount} terminals`);
        void vscode.window.showInformationMessage(
          `Terminal session restored: ${result.restoredCount} terminal${result.restoredCount > 1 ? 's' : ''}`
        );
      } else {
        log('📭 [EXTENSION] No terminals to restore');
      }
    } catch (error) {
      log(`❌ [EXTENSION] Restore error: ${String(error)}`);
    }
  }

  /**
   * 起動時のシンプルセッション復元処理
   */
  private async restoreSimpleSessionOnStartup(): Promise<void> {
    log('🔍 [SESSION] === RESTORE SESSION STARTUP CALLED ===');

    try {
      if (!this.simpleSessionManager || !this.terminalManager) {
        log('⚠️ [SESSION] Managers not available');
        return;
      }

      // 既存のターミナルがある場合は復元をスキップ
      const existingTerminals = this.terminalManager.getTerminals();
      log(`🔍 [SESSION] Existing terminals check: ${existingTerminals.length}`);
      if (existingTerminals.length > 0) {
        log('📋 [SESSION] Terminals already exist, skipping restore');
        return;
      }

      log('🔍 [SESSION] About to call simpleSessionManager.restoreSession()');
      // セッション復元を実行
      const result = await this.simpleSessionManager.restoreSession();
      log(`🔍 [SESSION] restoreSession() completed with result: ${JSON.stringify(result)}`);

      if (result.success && result.restoredCount && result.restoredCount > 0) {
        log(`✅ [SESSION] Restored ${result.restoredCount} terminals`);
        // 復元成功をユーザーに通知
        setTimeout(() => {
          void vscode.window.showInformationMessage(
            `Terminal session restored: ${result.restoredCount} terminal${(result.restoredCount || 0) > 1 ? 's' : ''}`
          );
        }, 1000);
      } else if (result.success && result.restoredCount === 0) {
        log('📭 [SESSION] No session data found - creating initial terminal');
        this.createInitialTerminal();
      } else {
        log(`❌ [SESSION] Restore failed: ${result.error}`);
        this.createInitialTerminal();
      }
    } catch (error) {
      log(
        `❌ [SESSION] Error during restore: ${error instanceof Error ? error.message : String(error)}`
      );
      log(`❌ [SESSION] Error stack: ${error instanceof Error ? error.stack : 'No stack'}`);
      // エラー時も初期ターミナルを作成
      this.createInitialTerminal();
    }

    log('🔍 [SESSION] === RESTORE SESSION STARTUP FINISHED ===');
  }

  /**
   * すべてのターミナルにScrollbackデータを復元
   * Temporarily disabled - using SimpleSessionManager approach instead
   */
  private restoreScrollbackForAllTerminals(): Promise<void> {
    log(
      '🔄 [SCROLLBACK_RESTORE] Scrollback restoration temporarily disabled - using SimpleSessionManager'
    );
    return Promise.resolve();

    // if (!this.terminalManager || !this.sidebarProvider || !this.scrollbackSessionManager) {
    //   log('❌ [SCROLLBACK_RESTORE] Required managers not available');
    //   return;
    // }

    // const terminals = this.terminalManager.getTerminals();
    // log(`🔄 [SCROLLBACK_RESTORE] Found ${terminals.length} terminals to restore scrollback to`);

    // for (const terminal of terminals) {
    //   try {
    //     log(`🔄 [SCROLLBACK_RESTORE] Restoring scrollback for terminal ${terminal.id}`);
    //
    //     // ScrollbackSessionManagerからデータを取得
    //     const scrollback = await this.scrollbackSessionManager.extractScrollbackFromTerminal(terminal.id);
    //
    //     if (scrollback && scrollback.lines.length > 0) {
    //       // WebViewにScrollback復元を要求
    //       await (this.sidebarProvider as any)._sendMessage({
    //         command: 'restoreScrollback',
    //         terminalId: terminal.id,
    //         scrollbackContent: scrollback.lines,
    //         timestamp: Date.now()
    //       });
    //
    //       log(`✅ [SCROLLBACK_RESTORE] Restored ${scrollback.lines.length} lines for terminal ${terminal.id}`);
    //     } else {
    //       log(`📭 [SCROLLBACK_RESTORE] No scrollback data found for terminal ${terminal.id}`);
    //     }
    //
    //     // 少し待機してデータの処理を完了させる
    //     await new Promise(resolve => setTimeout(resolve, 100));
    //
    //   } catch (error) {
    //     log(`❌ [SCROLLBACK_RESTORE] Error restoring scrollback for terminal ${terminal.id}: ${error instanceof Error ? error.message : String(error)}`);
    //   }
    // }
    //
    // log('✅ [SCROLLBACK_RESTORE] Scrollback restoration completed for all terminals');
  }

  /**
   * すべてのターミナルからScrollbackデータを抽出
   */
  private async extractScrollbackFromAllTerminals(): Promise<void> {
    log('🔍 [SCROLLBACK_EXTRACT] Extracting scrollback from all terminals');

    if (!this.terminalManager || !this.sidebarProvider) {
      log('❌ [SCROLLBACK_EXTRACT] Terminal manager or sidebar provider not available');
      return;
    }

    const terminals = this.terminalManager.getTerminals();
    log(`🔍 [SCROLLBACK_EXTRACT] Found ${terminals.length} terminals to extract scrollback from`);

    for (const terminal of terminals) {
      try {
        log(`🔍 [SCROLLBACK_EXTRACT] Requesting scrollback for terminal ${terminal.id}`);

        // WebViewにScrollback抽出を要求
        await (
          this.sidebarProvider as unknown as { _sendMessage: (msg: unknown) => Promise<void> }
        )._sendMessage({
          command: 'getScrollback',
          terminalId: terminal.id,
          maxLines: 1000,
          timestamp: Date.now(),
        });

        // 少し待機してデータの処理を完了させる
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        log(
          `❌ [SCROLLBACK_EXTRACT] Error extracting scrollback for terminal ${terminal.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    log('✅ [SCROLLBACK_EXTRACT] Scrollback extraction requests sent for all terminals');
  }

  /**
   * Scrollbackテストコマンドハンドラー
   * Temporarily disabled - using SimpleSessionManager approach instead
   */
  private async handleTestScrollbackCommand(): Promise<void> {
    log('🧪 [SCROLLBACK_TEST] Scrollback test temporarily disabled - using SimpleSessionManager');
    await vscode.window.showInformationMessage(
      'Scrollback test temporarily disabled - using SimpleSessionManager approach instead'
    );
    return;

    // if (!this.scrollbackSessionManager) {
    //   await vscode.window.showErrorMessage('Scrollback manager not available');
    //   return;
    // }

    // try {
    //   // 現在のセッション情報を取得
    //   const sessionInfo = await this.scrollbackSessionManager.getScrollbackSessionInfo();
    //
    //   if (sessionInfo.exists) {
    //     await vscode.window.showInformationMessage(
    //       `Scrollback session exists: ${sessionInfo.terminalCount} terminals, ${sessionInfo.totalLines} lines, ${sessionInfo.dataSize} bytes`
    //     );
    //   } else {
    //     await vscode.window.showInformationMessage('No scrollback session data found');
    //   }
    //
    //   // テスト用にモックScrollbackを抽出
    //   const terminals = this.terminalManager?.getTerminals() || [];
    //   if (terminals.length > 0) {
    //     const terminal = terminals[0];
    //     if (terminal) {
    //       const scrollback = await this.scrollbackSessionManager.extractScrollbackFromTerminal(terminal.id);
    //
    //       if (scrollback) {
    //         log(`🧪 [SCROLLBACK_TEST] Extracted ${scrollback.lines.length} lines from terminal ${terminal.id}`);
    //         await vscode.window.showInformationMessage(
    //           `Extracted ${scrollback.lines.length} lines from terminal "${terminal.name}"`
    //         );
    //       }
    //     }
    //   }
    //
    // } catch (error) {
    //   log(`❌ [SCROLLBACK_TEST] Test failed: ${error instanceof Error ? error.message : String(error)}`);
    //   await vscode.window.showErrorMessage(
    //     `Scrollback test failed: ${error instanceof Error ? error.message : String(error)}`
    //   );
    // }
  }

  /**
   * 初期ターミナルを作成（復元データがない場合）
   */
  private createInitialTerminal(): void {
    try {
      if (this.terminalManager) {
        const terminals = this.terminalManager.getTerminals();
        if (terminals.length === 0) {
          log('🔧 [SIMPLE_SESSION] Creating initial terminal');
          const terminalId = this.terminalManager.createTerminal();
          log(`✅ [SIMPLE_SESSION] Initial terminal created: ${terminalId}`);
        } else {
          log(
            `📋 [SIMPLE_SESSION] Skipping initial terminal creation - ${terminals.length} terminals already exist`
          );
        }
      } else {
        log('❌ [SIMPLE_SESSION] Cannot create initial terminal - terminal manager not available');
      }
    } catch (error) {
      log(
        `❌ [SIMPLE_SESSION] Error creating initial terminal: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
