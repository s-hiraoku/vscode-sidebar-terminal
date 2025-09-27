import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { StandardTerminalSessionManager } from '../sessions/StandardTerminalSessionManager';
import { extension as log, logger, LogLevel } from '../utils/logger';
import { FileReferenceCommand, TerminalCommand } from '../commands';
import { CopilotIntegrationCommand } from '../commands/CopilotIntegrationCommand';
import { EnhancedShellIntegrationService } from '../services/EnhancedShellIntegrationService';
import { KeyboardShortcutService } from '../services/KeyboardShortcutService';
import { TerminalDecorationsService } from '../services/TerminalDecorationsService';
import { TerminalLinksService } from '../services/TerminalLinksService';

/**
 * VS Code拡張機能のライフサイクル管理
 * 初期化、コマンド登録、クリーンアップを担当
 */
export class ExtensionLifecycle {
  private terminalManager: TerminalManager | undefined;
  private sidebarProvider: SecondaryTerminalProvider | undefined;
  private standardSessionManager: StandardTerminalSessionManager | undefined;
  private fileReferenceCommand: FileReferenceCommand | undefined;
  private terminalCommand: TerminalCommand | undefined;
  private copilotIntegrationCommand: CopilotIntegrationCommand | undefined;
  private shellIntegrationService: EnhancedShellIntegrationService | undefined;
  private keyboardShortcutService: KeyboardShortcutService | undefined;
  private decorationsService: TerminalDecorationsService | undefined;
  private linksService: TerminalLinksService | undefined;

  // シンプルな復元管理
  private _restoreExecuted = false;

  /**
   * 拡張機能の起動処理
   */
  activate(context: vscode.ExtensionContext): Promise<void> {
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
      process.env.NODE_PTY_DEBUG = '0';

      // Initialize terminal manager
      this.terminalManager = new TerminalManager();

      // Initialize standard terminal session manager
      log('🔧 [EXTENSION] Initializing VS Code standard session manager...');
      this.standardSessionManager = new StandardTerminalSessionManager(
        context,
        this.terminalManager
      );
      log('✅ [EXTENSION] Standard session manager initialized');

      // Initialize command handlers
      this.fileReferenceCommand = new FileReferenceCommand(this.terminalManager);
      this.terminalCommand = new TerminalCommand(this.terminalManager);
      this.copilotIntegrationCommand = new CopilotIntegrationCommand();

      // Initialize enhanced shell integration service
      log('🚀 [EXTENSION] Initializing enhanced shell integration service...');
      try {
        this.shellIntegrationService = new EnhancedShellIntegrationService(this.terminalManager);
        // Set shell integration service on TerminalManager
        this.terminalManager.setShellIntegrationService(this.shellIntegrationService);
        log('✅ [EXTENSION] Enhanced shell integration service initialized and connected');
      } catch (error) {
        log('❌ [EXTENSION] Failed to initialize enhanced shell integration service:', error);
        // Continue without shell integration
      }

      // Register the sidebar terminal provider
      this.sidebarProvider = new SecondaryTerminalProvider(
        context,
        this.terminalManager,
        this.standardSessionManager
      );

      // Set sidebar provider for StandardSessionManager
      if (this.standardSessionManager) {
        this.standardSessionManager.setSidebarProvider(this.sidebarProvider);
        log('🔧 [EXTENSION] Sidebar provider set for StandardSessionManager');
      }

      // Initialize keyboard shortcut service
      this.keyboardShortcutService = new KeyboardShortcutService(this.terminalManager);

      // Connect keyboard service to webview provider
      this.keyboardShortcutService.setWebviewProvider(this.sidebarProvider);

      // Connect enhanced shell integration service to webview provider
      if (this.shellIntegrationService) {
        this.shellIntegrationService.setWebviewProvider(this.sidebarProvider);
        log('🔗 [EXTENSION] Enhanced shell integration connected to webview');
      }

      log('⌨️ [EXTENSION] Keyboard shortcut service initialized');

      // Initialize Phase 8: Terminal Decorations & Links Services
      try {
        // Initialize terminal decorations service
        this.decorationsService = new TerminalDecorationsService();
        log('🎨 [EXTENSION] Terminal decorations service initialized');

        // Initialize terminal links service
        this.linksService = new TerminalLinksService();
        log('🔗 [EXTENSION] Terminal links service initialized');

        // Connect Phase 8 services to webview provider
        if (this.decorationsService && this.linksService) {
          this.sidebarProvider.setPhase8Services(this.decorationsService, this.linksService);
          log('🎨 [EXTENSION] Phase 8 services connected to webview provider');
        }

        // Connect Phase 8 services to terminal manager for data processing
        if (this.terminalManager) {
          // Set up data processing for decorations through terminal manager
          // Note: This will be connected via message passing in the webview
          log('🔄 [EXTENSION] Phase 8 services ready for webview integration');
        }

        log('✅ [EXTENSION] Phase 8 services (Decorations & Links) initialized successfully');
      } catch (error) {
        log('❌ [EXTENSION] Failed to initialize Phase 8 services:', error);
        // Continue without Phase 8 features
      }

      // Register all commands
      this.registerCommands(context);

      // Initialize context key for dynamic split icon functionality
      void vscode.commands.executeCommand(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );

      // CRITICAL: Session restore is now handled by SecondaryTerminalProvider asynchronously
      // This prevents VS Code activation spinner from hanging
      log(
        '🚀 [EXTENSION] Session restore will be handled asynchronously by SecondaryTerminalProvider'
      );
      log('✅ [EXTENSION] Activation will complete immediately to prevent spinner hang');

      // Register webview providers AFTER session restore completes
      log('🔧 [EXTENSION] Registering WebView providers after session restore...');
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

      // 自動保存設定
      this.setupSessionAutoSave(context);

      log('✅ Sidebar Terminal extension activated successfully');

      // CRITICAL: Ensure activation Promise resolves immediately
      // This prevents VS Code progress spinner from hanging
      return Promise.resolve();
    } catch (error) {
      log('Failed to activate Sidebar Terminal extension:', error);
      void vscode.window.showErrorMessage(
        `Failed to activate Sidebar Terminal: ${error instanceof Error ? error.message : String(error)}`
      );

      // CRITICAL: Even on error, resolve activation Promise to prevent spinner hanging
      return Promise.resolve();
    }
  }

  /**
   * コマンド登録
   */
  private registerCommands(context: vscode.ExtensionContext): void {
    const commandDisposables = [
      // ======================= メインコマンド =======================
      {
        command: 'secondaryTerminal.splitTerminal',
        handler: () => {
          log('🔧 [DEBUG] Command executed: splitTerminal (vertical)');
          this.sidebarProvider?.splitTerminal('vertical');
        },
      },
      {
        command: 'secondaryTerminal.splitTerminalHorizontal',
        handler: () => {
          log('🔧 [DEBUG] Command executed: splitTerminalHorizontal');
          this.sidebarProvider?.splitTerminal('horizontal');
        },
      },
      // REMOVED: 'secondaryTerminal.focusTerminal' - handled by KeyboardShortcutService

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
        handler: async () => {
          log(
            '🔧 [DEBUG] Command executed: activateCopilot (GitHub Copilot Chat integration - CMD+K CMD+C)'
          );
          await this.copilotIntegrationCommand?.handleActivateCopilot();
        },
      },

      // ======================= セッション管理コマンド =======================
      {
        command: 'secondaryTerminal.clearCorruptedHistory',
        handler: async () => {
          log('🔧 [DEBUG] Command executed: clearCorruptedHistory');
          try {
            if (this.standardSessionManager) {
              await this.standardSessionManager.clearSession();
              void vscode.window.showInformationMessage(
                '🧹 Terminal session cleared! VS Code standard session will be saved from now on.'
              );
            } else {
              void vscode.window.showErrorMessage('Session manager not available');
            }
          } catch (error) {
            log(`❌ [ERROR] Failed to clear session: ${String(error)}`);
            void vscode.window.showErrorMessage(
              `Failed to clear session: ${error instanceof Error ? error.message : String(error)}`
            );
          }
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
      {
        command: 'secondaryTerminal.killTerminal',
        handler: async () => {
          log('🔧 [DEBUG] Command executed: killTerminal');
          try {
            await this.sidebarProvider?.killTerminal();
            log('🔧 [DEBUG] killTerminal command completed successfully');
          } catch (error) {
            log('🔧 [ERROR] killTerminal command failed:', error);
          }
        },
      },

      // ======================= Shell Integration Commands =======================
      {
        command: 'secondaryTerminal.updateShellStatus',
        handler: (args: { terminalId: string; status: string }) => {
          log('🔧 [DEBUG] Command executed: updateShellStatus');
          this.sidebarProvider?.sendMessageToWebview({
            command: 'updateShellStatus',
            terminalId: args.terminalId,
            status: args.status,
          });
        },
      },
      {
        command: 'secondaryTerminal.updateCwd',
        handler: (args: { terminalId: string; cwd: string }) => {
          log('🔧 [DEBUG] Command executed: updateCwd');
          this.sidebarProvider?.sendMessageToWebview({
            command: 'updateCwd',
            terminalId: args.terminalId,
            cwd: args.cwd,
          });
        },
      },
      {
        command: 'secondaryTerminal.getCommandHistory',
        handler: (terminalId: string) => {
          log('🔧 [DEBUG] Command executed: getCommandHistory');
          if (this.shellIntegrationService) {
            const history = this.shellIntegrationService.getCommandHistory(terminalId);
            this.sidebarProvider?.sendMessageToWebview({
              command: 'commandHistory',
              terminalId,
              history,
            });
            return history;
          }
          return [];
        },
      },

      // ======================= 検索コマンド (Ctrl+F) =======================
      {
        command: 'secondaryTerminal.find',
        handler: () => {
          log('🔧 [DEBUG] Command executed: find (Ctrl+F search)');
          this.keyboardShortcutService?.find();
        },
      },

      {
        command: 'secondaryTerminal.selectProfile',
        handler: () => {
          log('🔧 [DEBUG] Command executed: selectProfile');
          this.sidebarProvider?.selectProfile();
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

      // ======================= デバッグコマンド =======================
      {
        command: 'secondaryTerminal.debugInput',
        handler: async () => {
          log('🔧 [DEBUG-CMD] Direct input test command triggered');

          if (!this.terminalManager) {
            log('❌ [DEBUG-CMD] TerminalManager not available');
            void vscode.window.showErrorMessage('TerminalManager not available');
            return;
          }

          // Get active terminal
          const activeTerminalId = this.terminalManager.getActiveTerminalId();
          log('🔧 [DEBUG-CMD] Active terminal ID:', activeTerminalId);

          if (!activeTerminalId) {
            log('❌ [DEBUG-CMD] No active terminal');
            void vscode.window.showErrorMessage('No active terminal available');
            return;
          }

          // Send test input directly to TerminalManager
          const testCommand = 'echo "DEBUG: Direct Extension input test successful"\\r';
          log('🔧 [DEBUG-CMD] Sending test input:', testCommand);

          this.terminalManager.sendInput(testCommand, activeTerminalId);
          log('🔧 [DEBUG-CMD] Test input sent successfully');

          void vscode.window.showInformationMessage('Debug input test sent directly to terminal');
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

    // Dispose standard session manager
    if (this.standardSessionManager) {
      log('🔧 [EXTENSION] Disposing standard session manager...');
      this.standardSessionManager = undefined;
    }

    // Dispose scrollback session manager - Temporarily disabled
    // if (this.scrollbackSessionManager) {
    //   log('🔧 [EXTENSION] Disposing scrollback session manager...');
    //   this.scrollbackSessionManager = undefined;
    // }

    // Dispose keyboard shortcut service
    if (this.keyboardShortcutService) {
      log('🔧 [EXTENSION] Disposing keyboard shortcut service...');
      this.keyboardShortcutService.dispose();
      this.keyboardShortcutService = undefined;
    }

    // Dispose Phase 8 services
    if (this.decorationsService) {
      log('🔧 [EXTENSION] Disposing terminal decorations service...');
      this.decorationsService.dispose();
      this.decorationsService = undefined;
    }

    if (this.linksService) {
      log('🔧 [EXTENSION] Disposing terminal links service...');
      this.linksService.dispose();
      this.linksService = undefined;
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

    // Dispose shell integration service
    if (this.shellIntegrationService) {
      this.shellIntegrationService.dispose();
      this.shellIntegrationService = undefined;
    }

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
   * 現在の標準セッションマネージャーを取得（テスト用）
   */
  getStandardSessionManager(): StandardTerminalSessionManager | undefined {
    return this.standardSessionManager;
  }

  // ==================== セッション管理関連のメソッド - DISABLED FOR DEBUGGING ====================

  /**
   * 起動時のセッション復元処理 - RE-ENABLED FOR TESTING
   */
  private async restoreSessionOnStartup(): Promise<void> {
    try {
      if (!this.standardSessionManager) {
        log('⚠️ [SESSION] Standard session manager not initialized');
        return;
      }

      log('🔄 [SESSION] Starting VS Code standard session restore on startup...');

      // 少し遅延させてから復元（他の初期化処理完了を待つ）
      try {
        if (this.standardSessionManager && this.terminalManager) {
          log('🔄 [SESSION] Executing VS Code standard session restore...');
          const result = await this.standardSessionManager.restoreSession();

          if (result.success && result.restoredCount && result.restoredCount > 0) {
            log(
              `✅ [SESSION] VS Code standard session restored: ${result.restoredCount} terminals`
            );

            // 復元完了後の初期化処理
            // Session restore finalization disabled for debugging

            // ユーザーに通知（オプション）
            void vscode.window.showInformationMessage(
              `Terminal session restored (VS Code standard): ${result.restoredCount} terminals`
            );
          } else {
            log('📭 [SESSION] No session data found - creating initial terminal');
            // Create initial terminal when no session data exists
            this.createInitialTerminal();
          }
        } else {
          log('⚠️ [SESSION] Session manager not available - creating initial terminal');
          if (this.terminalManager) {
            this.createInitialTerminal();
          }
        }
      } catch (error) {
        log(
          `❌ [SESSION] Error during session restore: ${String(error)} - creating fallback terminal`
        );
        this.createInitialTerminal();
      }
    } catch (error) {
      log(`❌ [SESSION] Error during session restore: ${String(error)}`);
    }
  }

  // Removed duplicate saveSessionOnExit method - keeping the async version below

  /**
   * VS Code終了時の自動保存設定 - ENABLED FOR TESTING
   */
  private setupSessionAutoSave(context: vscode.ExtensionContext): void {
    // VS Code終了時の保存を設定
    log('🔧 [EXTENSION] Setting up session auto-save on exit...');

    // Extension deactivation時にセッション保存
    context.subscriptions.push({
      dispose: () => {
        log('🔧 [EXTENSION] Extension disposing, saving session...');
        void this.saveSessionOnExit();
      },
    });

    // VS Code標準に準拠: ターミナル作成時に即座に保存
    if (this.terminalManager) {
      const terminalCreatedDisposable = this.terminalManager.onTerminalCreated((terminal) => {
        log(`💾 [EXTENSION] Terminal created - immediate save: ${terminal.name}`);
        void this.saveSessionImmediately('terminal_created');
      });

      const terminalRemovedDisposable = this.terminalManager.onTerminalRemoved((terminalId) => {
        log(`💾 [EXTENSION] Terminal removed - immediate save: ${terminalId}`);
        void this.saveSessionImmediately('terminal_removed');
      });

      context.subscriptions.push(terminalCreatedDisposable, terminalRemovedDisposable);
    }

    // ターミナル変更時の保存を設定（定期保存として - バックアップ用）
    const saveOnTerminalChange = setInterval(() => {
      void this.saveSessionPeriodically();
    }, 300000); // 5分ごとに保存（CPU負荷軽減のため30秒から変更）

    context.subscriptions.push({
      dispose: () => clearInterval(saveOnTerminalChange),
    });

    log('✅ [EXTENSION] Session auto-save setup completed');
  }

  /**
   * 終了時のセッション保存
   */
  private async saveSessionOnExit(): Promise<void> {
    try {
      if (!this.standardSessionManager) {
        log('⚠️ [EXTENSION] Standard session manager not available for save');
        return;
      }

      log('💾 [EXTENSION] Saving VS Code standard session on exit...');
      const result = await this.standardSessionManager.saveCurrentSession();

      if (result.success) {
        log(`✅ [EXTENSION] VS Code standard session saved: ${result.terminalCount} terminals`);
      } else {
        log('⚠️ [EXTENSION] Session save failed or no terminals to save');
      }
    } catch (error) {
      log(`❌ [EXTENSION] Error saving session on exit: ${String(error)}`);
    }
  }

  /**
   * 即座のセッション保存（VS Code標準準拠）
   */
  private async saveSessionImmediately(trigger: string): Promise<void> {
    try {
      if (!this.standardSessionManager || !this.terminalManager) {
        return;
      }

      const terminals = this.terminalManager.getTerminals();
      log(`💾 [EXTENSION] Immediate save triggered by ${trigger}: ${terminals.length} terminals`);

      const result = await this.standardSessionManager.saveCurrentSession();

      if (result.success) {
        log(
          `✅ [EXTENSION] Immediate save completed (${trigger}): ${result.terminalCount} terminals`
        );
      } else {
        log(
          `⚠️ [EXTENSION] Immediate save failed (${trigger}): ${result.error || 'unknown error'}`
        );
      }
    } catch (error) {
      log(`❌ [EXTENSION] Error in immediate save (${trigger}): ${String(error)}`);
    }
  }

  /**
   * 定期的なセッション保存
   */
  private async saveSessionPeriodically(): Promise<void> {
    try {
      if (!this.standardSessionManager || !this.terminalManager) {
        return;
      }

      // ターミナルが存在する場合のみ保存
      const terminals = this.terminalManager.getTerminals();
      if (terminals.length === 0) {
        return;
      }

      log(`💾 [EXTENSION] Periodic VS Code standard save: ${terminals.length} terminals`);
      const result = await this.standardSessionManager.saveCurrentSession();

      if (result.success) {
        log(`✅ [EXTENSION] Periodic save completed: ${result.terminalCount} terminals`);
      }
    } catch (error) {
      log(`❌ [EXTENSION] Error in periodic save: ${String(error)}`);
    }
  }

  /**
   * Setup session manager event listeners to forward notifications to WebView - RE-ENABLED FOR TESTING
   */
  private setupSessionEventListeners(): void {
    if (!this.standardSessionManager || !this.sidebarProvider) {
      log('❌ [SESSION] Cannot setup event listeners - missing dependencies');
      return;
    }

    log('🔧 [SESSION] Setting up session event listeners...');

    // Note: UnifiedSessionManager doesn't implement EventEmitter pattern
    // Session restore events would be handled differently
    // This event listener setup is disabled since UnifiedSessionManager doesn't emit events

    // Session restore events (disabled - UnifiedSessionManager doesn't use events)
    // this.unifiedSessionManager.on('sessionRestoreStarted', (data: { terminalCount: number }) => {
    //   this.sidebarProvider?.sendSessionMessage({
    //     command: 'sessionRestoreStarted',
    //     terminalCount: data.terminalCount,
    //   });
    // });

    // this.unifiedSessionManager.on('sessionRestoreProgress', (data: { restored: number; total: number }) => {
    //   this.sidebarProvider?.sendSessionMessage({
    //     command: 'sessionRestoreProgress',
    //     restored: data.restored,
    //     total: data.total,
    //   });
    // });

    // this.unifiedSessionManager.on(
    //   'sessionRestoreCompleted',
    //   (data: { restoredCount: number; skippedCount: number }) => {
    //     this.sidebarProvider?.sendSessionMessage({
    //       command: 'sessionRestoreCompleted',
    //       restoredCount: data.restoredCount,
    //       skippedCount: data.skippedCount,
    //     });
    //   }
    // );

    // this.unifiedSessionManager.on(
    //   'sessionRestoreError',
    //   (data: { error: string; partialSuccess: boolean; errorType?: string; recoveryAction?: string }) => {
    //     this.sidebarProvider?.sendSessionMessage({
    //       command: 'sessionRestoreError',
    //       error: data.error,
    //       partialSuccess: data.partialSuccess,
    //       errorType: data.errorType,
    //       recoveryAction: data.recoveryAction,
    //     });
    //   }
    // );

    // this.unifiedSessionManager.on(
    //   'terminalRestoreError',
    //   (data: { terminalId: string; terminalName: string; error: string; errorType: string }) => {
    //     this.sidebarProvider?.sendSessionMessage({
    //       command: 'terminalRestoreError',
    //       terminalId: data.terminalId,
    //       terminalName: data.terminalName,
    //       error: data.error,
    //       errorType: data.errorType,
    //     });
    //   }
    // );

    // this.unifiedSessionManager.on('sessionRestoreSkipped', (data: { reason: string }) => {
    //   this.sidebarProvider?.sendSessionMessage({
    //     command: 'sessionRestoreSkipped',
    //     reason: data.reason,
    //   });
    // });

    // Session save events (disabled - UnifiedSessionManager doesn't use events)
    // this.unifiedSessionManager.on('sessionSaved', (data: { terminalCount: number }) => {
    //   this.sidebarProvider?.sendSessionMessage({
    //     command: 'sessionSaved',
    //     terminalCount: data.terminalCount,
    //   });
    // });

    // this.unifiedSessionManager.on('sessionSaveError', (data: { error: string }) => {
    //   this.sidebarProvider?.sendSessionMessage({
    //     command: 'sessionSaveError',
    //     error: data.error,
    //   });
    // });

    // Session clear events (disabled - UnifiedSessionManager doesn't use events)
    // this.unifiedSessionManager.on('sessionCleared', () => {
    //   this.sidebarProvider?.sendSessionMessage({
    //     command: 'sessionCleared',
    //   });
    // });

    log('✅ [SESSION] Session event listeners configured');
  }

  /**
   * Handle save session command - RE-ENABLED FOR TESTING
   */
  private async handleSaveSessionCommand(): Promise<void> {
    if (!this.standardSessionManager) {
      await vscode.window.showErrorMessage('Standard session manager not available');
      return;
    }

    try {
      const result = await this.standardSessionManager.saveCurrentSession();
      if (result.success) {
        await vscode.window.showInformationMessage(
          `Terminal session saved successfully (${result.terminalCount || 0} terminal${(result.terminalCount || 0) > 1 ? 's' : ''})`
        );
      } else {
        await vscode.window.showErrorMessage(
          `Failed to save session: ${result.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Failed to save session: ${String(error)}`);
    }
  }

  /**
   * Handle restore session command - RE-ENABLED FOR TESTING
   */
  private async handleRestoreSessionCommand(): Promise<void> {
    if (!this.standardSessionManager) {
      await vscode.window.showErrorMessage('Standard session manager not available');
      return;
    }

    try {
      const result = await this.standardSessionManager.restoreSession();
      if (result.success) {
        if (result.restoredCount && result.restoredCount > 0) {
          await vscode.window.showInformationMessage(
            `Terminal session restored successfully: ${result.restoredCount} terminal${result.restoredCount > 1 ? 's' : ''} restored${result.skippedCount && result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ''}`
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
      await vscode.window.showErrorMessage(`Failed to restore session: ${String(error)}`);
    }
  }

  /**
   * Handle clear session command - RE-ENABLED FOR TESTING
   */
  private async handleClearSessionCommand(): Promise<void> {
    if (!this.standardSessionManager) {
      await vscode.window.showErrorMessage('Standard session manager not available');
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
        await this.standardSessionManager.clearSession();
        await vscode.window.showInformationMessage('Terminal session data cleared successfully');
      } catch (error) {
        await vscode.window.showErrorMessage(`Failed to clear session: ${String(error)}`);
      }
    }
  }

  // ==================== シンプルセッション管理メソッド ====================

  /**
   * 統合セッション保存コマンドハンドラー
   */
  private async handleSimpleSaveSessionCommand(): Promise<void> {
    if (!this.standardSessionManager) {
      await vscode.window.showErrorMessage('Standard session manager not available');
      return;
    }

    try {
      // Scrollback抽出処理（復元機能を完全動作させるため）
      log('📋 [SIMPLE_SESSION] Starting scrollback extraction...');
      await this.extractScrollbackFromAllTerminals();
      log('✅ [SIMPLE_SESSION] Scrollback extraction completed');

      // 通常のセッション保存を実行
      const result = await this.standardSessionManager.saveCurrentSession();
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
   * 統合セッション復元コマンドハンドラー
   */
  private async handleSimpleRestoreSessionCommand(): Promise<void> {
    if (!this.standardSessionManager) {
      await vscode.window.showErrorMessage('Standard session manager not available');
      return;
    }

    try {
      const result = await this.standardSessionManager.restoreSession();

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
   * 統合セッションクリアコマンドハンドラー
   */
  private async handleSimpleClearSessionCommand(): Promise<void> {
    if (!this.standardSessionManager) {
      await vscode.window.showErrorMessage('Standard session manager not available');
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
        await this.standardSessionManager.clearSession();
        await vscode.window.showInformationMessage('Terminal session data cleared successfully');
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Failed to clear session: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * 終了時の統合セッション保存処理
   */
  private saveSimpleSessionOnExit(): void {
    try {
      if (!this.standardSessionManager) {
        log('⚠️ [STANDARD_SESSION] Session manager not available, skipping save on exit');
        return;
      }

      log('💾 [STANDARD_SESSION] Saving session on exit...');

      // 同期的に保存処理を実行
      this.standardSessionManager
        .saveCurrentSession()
        .then((result) => {
          if (result.success) {
            log(`✅ [STANDARD_SESSION] Session saved on exit: ${result.terminalCount} terminals`);
          } else {
            log(`❌ [STANDARD_SESSION] Failed to save session on exit: ${result.error}`);
          }
        })
        .catch((error) => {
          log(`❌ [STANDARD_SESSION] Exception during session save on exit: ${String(error)}`);
        });
    } catch (error) {
      log(`❌ [STANDARD_SESSION] Error during saveSimpleSessionOnExit: ${String(error)}`);
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

      if (!this.standardSessionManager) {
        log('❌ [EXTENSION] Session manager not available');
        return;
      }

      const result = await this.standardSessionManager.restoreSession();

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
      if (!this.standardSessionManager || !this.terminalManager) {
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

      log('🔍 [SESSION] About to call standardSessionManager.restoreSession()');
      // セッション復元を実行
      const result = await this.standardSessionManager.restoreSession();
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

  /**
   * SPINNER FIX: Remove synchronous session restore method
   * Session restore is now handled asynchronously by WebView after activation
   */
  // private async performSynchronousSessionRestore(): Promise<void> {
  //   // DISABLED: This method was causing VS Code spinner hang during extension activation
  //   // Session restore is now handled by SecondaryTerminalProvider._performAsyncSessionRestore()
  // }
}
