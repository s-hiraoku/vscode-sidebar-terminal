import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { SimpleSessionManager } from '../sessions/SimpleSessionManager';
import { ScrollbackSessionManager } from '../sessions/ScrollbackSessionManager';
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
  private scrollbackSessionManager: ScrollbackSessionManager | undefined;
  private fileReferenceCommand: FileReferenceCommand | undefined;
  private terminalCommand: TerminalCommand | undefined;
  private copilotIntegrationCommand: CopilotIntegrationCommand | undefined;

  /**
   * ScrollbackSessionManagerへのアクセスを提供
   */
  public getScrollbackSessionManager(): ScrollbackSessionManager | undefined {
    return this.scrollbackSessionManager;
  }

  /**
   * 拡張機能の起動処理
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
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

      // Initialize scrollback session manager
      log('🔧 [EXTENSION] Initializing scrollback session manager...');
      this.scrollbackSessionManager = new ScrollbackSessionManager(context);
      log('✅ [EXTENSION] Scrollback session manager initialized');

      // Initialize command handlers
      this.fileReferenceCommand = new FileReferenceCommand(this.terminalManager);
      this.terminalCommand = new TerminalCommand(this.terminalManager);
      this.copilotIntegrationCommand = new CopilotIntegrationCommand();

      // Register the sidebar terminal provider
      this.sidebarProvider = new SecondaryTerminalProvider(context, this.terminalManager);

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

      // Test command for Claude CLI Agent status display
      const testClaudeStatusCommand = vscode.commands.registerCommand(
        'secondaryTerminal.testClaudeStatus',
        () => {
          log('🔧 [DEBUG] Test Claude status command executed');
          if (this.sidebarProvider) {
            // Show active status
            this.sidebarProvider.sendCliAgentStatusUpdate('test-terminal-1', 'connected');
            // Clear after 4 seconds
            setTimeout(() => {
              if (this.sidebarProvider) {
                this.sidebarProvider.sendCliAgentStatusUpdate(null, 'none');
              }
            }, 4000);
          }
        }
      );
      context.subscriptions.push(testClaudeStatusCommand);

      // Debug command for session debugging
      const debugSessionCommand = vscode.commands.registerCommand(
        'secondaryTerminal.debugSession',
        async () => {
          log('🔧 [DEBUG] === SESSION DEBUG COMMAND EXECUTED ===');

          if (!this.simpleSessionManager || !this.terminalManager) {
            log('❌ [DEBUG] Managers not available');
            void vscode.window.showErrorMessage('Session managers not available');
            return;
          }

          try {
            // Show current terminal state
            const terminals = this.terminalManager.getTerminals();
            log(`🔧 [DEBUG] Current terminals: ${terminals.length}`);
            terminals.forEach((t, i) => {
              log(`   - Terminal ${i + 1}: ${t.id} (${t.name})`);
            });

            // Check stored session data
            const sessionInfo = await this.simpleSessionManager.getSessionInfo();
            log(`🔧 [DEBUG] Stored session: ${sessionInfo ? 'EXISTS' : 'NONE'}`);
            if (sessionInfo) {
              log(`   - Stored terminals: ${sessionInfo.terminals.length}`);
              log(`   - Timestamp: ${new Date(sessionInfo.timestamp).toISOString()}`);
            }

            // Test save and restore
            log('🔧 [DEBUG] Testing save...');
            const saveResult = await this.simpleSessionManager.saveCurrentSession();
            log(`🔧 [DEBUG] Save result: ${JSON.stringify(saveResult)}`);

            void vscode.window.showInformationMessage(
              `Debug: ${terminals.length} terminals, session ${sessionInfo ? 'exists' : 'none'}, save ${saveResult.success ? 'success' : 'failed'}`
            );
          } catch (error) {
            log(
              `❌ [DEBUG] Debug command error: ${error instanceof Error ? error.message : String(error)}`
            );
            void vscode.window.showErrorMessage(
              `Debug error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
      context.subscriptions.push(debugSessionCommand);

      // シンプルセッション復元処理（初期化完了後に実行）
      log('🔄 [EXTENSION] === STARTING SIMPLE SESSION RESTORE ===');
      log(`🔧 [EXTENSION] Current timestamp: ${new Date().toISOString()}`);
      log(`🔧 [EXTENSION] Extension context: ${!!context}`);
      log(`🔧 [EXTENSION] SimpleSessionManager available: ${!!this.simpleSessionManager}`);
      log(`🔧 [EXTENSION] TerminalManager available: ${!!this.terminalManager}`);
      log(`🔧 [EXTENSION] SidebarProvider available: ${!!this.sidebarProvider}`);

      // Manager state詳細チェック
      if (this.simpleSessionManager) {
        log(`🔧 [EXTENSION] SimpleSessionManager type: ${typeof this.simpleSessionManager}`);
        log(
          `🔧 [EXTENSION] SimpleSessionManager constructor: ${this.simpleSessionManager.constructor.name}`
        );
      }

      if (this.terminalManager) {
        log(`🔧 [EXTENSION] TerminalManager type: ${typeof this.terminalManager}`);
        log(`🔧 [EXTENSION] TerminalManager constructor: ${this.terminalManager.constructor.name}`);
      }

      if (this.simpleSessionManager && this.terminalManager) {
        log('✅ [EXTENSION] Both managers available, proceeding with restore...');
        try {
          log('🔧 [EXTENSION] About to call restoreSimpleSessionOnStartup()...');
          await this.restoreSimpleSessionOnStartup();
          log('✅ [EXTENSION] === SIMPLE SESSION RESTORE COMPLETED ===');
        } catch (error) {
          log(
            `❌ [EXTENSION] Error in restoreSimpleSessionOnStartup: ${error instanceof Error ? error.message : String(error)}`
          );
          log(`❌ [EXTENSION] Error stack: ${error instanceof Error ? error.stack : 'No stack'}`);
        }
      } else {
        log('❌ [EXTENSION] Missing managers, cannot restore session');
        log(`   - SimpleSessionManager: ${!!this.simpleSessionManager}`);
        log(`   - TerminalManager: ${!!this.terminalManager}`);
      }

      // VS Code終了時の自動保存設定 - ENABLED FOR TESTING
      log('🔧 [EXTENSION] Setting up session auto-save for testing...');
      this.setupSessionAutoSave(context);
      log('✅ [EXTENSION] Session auto-save configured');

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

    // Dispose scrollback session manager
    if (this.scrollbackSessionManager) {
      log('🔧 [EXTENSION] Disposing scrollback session manager...');
      this.scrollbackSessionManager = undefined;
    }

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
  private setupSessionAutoSave(context: vscode.ExtensionContext): void {
    try {
      if (!this.simpleSessionManager) {
        log('⚠️ [SIMPLE_SESSION] Session manager not available for auto-save setup');
        return;
      }

      log('⚙️ [SIMPLE_SESSION] Setting up session auto-save...');

      // ワークスペース変更時の保存
      const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (this.simpleSessionManager) {
          this.simpleSessionManager
            .saveCurrentSession()
            .then((result) => {
              if (result.success) {
                log(
                  `💾 [SIMPLE_SESSION] Session saved on workspace change: ${result.terminalCount} terminals`
                );
              }
            })
            .catch((error) => {
              log(`❌ [SIMPLE_SESSION] Error saving session on workspace change: ${error}`);
            });
        }
      });

      context.subscriptions.push(workspaceWatcher);

      // 定期保存（5分間隔）
      const autoSaveInterval = setInterval(
        () => {
          if (this.simpleSessionManager) {
            this.simpleSessionManager
              .saveCurrentSession()
              .then((result) => {
                if (result.success && result.terminalCount && result.terminalCount > 0) {
                  log(`💾 [SIMPLE_SESSION] Auto-save completed: ${result.terminalCount} terminals`);
                }
              })
              .catch((error) => {
                log(`❌ [SIMPLE_SESSION] Error during auto-save: ${error}`);
              });
          }
        },
        5 * 60 * 1000
      ); // 5分

      // 拡張停止時にインターバルをクリア
      context.subscriptions.push({
        dispose: () => {
          clearInterval(autoSaveInterval);
          log('🔧 [SIMPLE_SESSION] Auto-save interval cleared');
        },
      });

      log('✅ [SIMPLE_SESSION] Session auto-save configured');
    } catch (error) {
      log(
        `❌ [SIMPLE_SESSION] Error setting up auto-save: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
        log('⚠️ [SIMPLE_SESSION] Session manager not available for save on exit');
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
          log(
            `❌ [SIMPLE_SESSION] Error saving session on exit: ${error instanceof Error ? error.message : String(error)}`
          );
        });
    } catch (error) {
      log(
        `❌ [SIMPLE_SESSION] Error during session save on exit: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 起動時のシンプルセッション復元処理
   */
  private async restoreSimpleSessionOnStartup(): Promise<void> {
    log('🎯 [SIMPLE_SESSION] === restoreSimpleSessionOnStartup() CALLED ===');

    try {
      log('🔧 [SIMPLE_SESSION] Checking manager availability...');
      if (!this.simpleSessionManager || !this.terminalManager) {
        log('⚠️ [SIMPLE_SESSION] Session manager or terminal manager not initialized');
        log(`   - SimpleSessionManager: ${!!this.simpleSessionManager}`);
        log(`   - TerminalManager: ${!!this.terminalManager}`);
        return;
      }

      log('🔄 [SIMPLE_SESSION] Starting session restore on startup...');

      // 既存のターミナルがある場合は復元をスキップ
      const existingTerminals = this.terminalManager.getTerminals();
      log(
        `🔧 [SIMPLE_SESSION] Existing terminals check: ${existingTerminals.length} terminals found`
      );

      if (existingTerminals.length > 0) {
        log('📋 [SIMPLE_SESSION] Terminals already exist, skipping restore');
        existingTerminals.forEach((t, i) => {
          log(`   - Terminal ${i + 1}: ${t.id} (${t.name})`);
        });
        return;
      }

      // セッションデータの存在確認
      const sessionInfo = await this.simpleSessionManager.getSessionInfo();
      log(`🔧 [SIMPLE_SESSION] Session data check: ${sessionInfo ? 'FOUND' : 'NOT FOUND'}`);
      if (sessionInfo) {
        log(`   - Terminals in session: ${sessionInfo.terminals.length}`);
        log(`   - Session timestamp: ${new Date(sessionInfo.timestamp).toISOString()}`);
      }

      // セッション復元を実行
      if (sessionInfo && sessionInfo.terminals.length > 0) {
        log(
          `🔔 [SIMPLE_SESSION] Starting session restore for ${sessionInfo.terminals.length} terminals...`
        );
      }

      // シンプルセッション復元を実行
      log('⚡ [SIMPLE_SESSION] Executing restoreSession()...');
      const result = await this.simpleSessionManager.restoreSession();
      log(`🎯 [SIMPLE_SESSION] Restore result: ${JSON.stringify(result)}`);

      if (result.success && result.restoredCount && result.restoredCount > 0) {
        log(`✅ [SIMPLE_SESSION] Session restored on startup: ${result.restoredCount} terminals`);

        // 復元成功をユーザーに通知（控えめに）
        setTimeout(() => {
          void vscode.window.showInformationMessage(
            `Terminal session restored: ${result.restoredCount} terminal${(result.restoredCount || 0) > 1 ? 's' : ''}`
          );
        }, 1000);
      } else if (result.success && result.restoredCount === 0) {
        log('📭 [SIMPLE_SESSION] No session data found - creating initial terminal');
        // セッションデータがない場合は通常の初期ターミナルを作成
        this.createInitialTerminal();
      } else {
        log(`❌ [SIMPLE_SESSION] Session restore failed: ${result.error}`);
        // 復元失敗時も初期ターミナルを作成
        this.createInitialTerminal();
      }
    } catch (error) {
      log(
        `❌ [SIMPLE_SESSION] Error during startup session restore: ${error instanceof Error ? error.message : String(error)}`
      );
      // エラー時も初期ターミナルを作成
      this.createInitialTerminal();
    }
  }

  /**
   * Scrollbackテストコマンドハンドラー
   */
  private async handleTestScrollbackCommand(): Promise<void> {
    log('🧪 [SCROLLBACK_TEST] Starting scrollback test');
    
    if (!this.scrollbackSessionManager) {
      await vscode.window.showErrorMessage('Scrollback manager not available');
      return;
    }

    try {
      // 現在のセッション情報を取得
      const sessionInfo = await this.scrollbackSessionManager.getScrollbackSessionInfo();
      
      if (sessionInfo.exists) {
        await vscode.window.showInformationMessage(
          `Scrollback session exists: ${sessionInfo.terminalCount} terminals, ${sessionInfo.totalLines} lines, ${sessionInfo.dataSize} bytes`
        );
      } else {
        await vscode.window.showInformationMessage('No scrollback session data found');
      }
      
      // テスト用にモックScrollbackを抽出
      const terminals = this.terminalManager?.getTerminals() || [];
      if (terminals.length > 0) {
        const terminal = terminals[0];
        if (terminal) {
          const scrollback = await this.scrollbackSessionManager.extractScrollbackFromTerminal(terminal.id);
          
          if (scrollback) {
            log(`🧪 [SCROLLBACK_TEST] Extracted ${scrollback.lines.length} lines from terminal ${terminal.id}`);
            await vscode.window.showInformationMessage(
              `Extracted ${scrollback.lines.length} lines from terminal "${terminal.name}"`
            );
          }
        }
      }
      
    } catch (error) {
      log(`❌ [SCROLLBACK_TEST] Test failed: ${error instanceof Error ? error.message : String(error)}`);
      await vscode.window.showErrorMessage(
        `Scrollback test failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
