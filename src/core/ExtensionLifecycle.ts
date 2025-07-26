import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { SessionManager } from '../sessions/SessionManager';
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
  private sessionManager: SessionManager | undefined;
  private fileReferenceCommand: FileReferenceCommand | undefined;
  private terminalCommand: TerminalCommand | undefined;
  private copilotIntegrationCommand: CopilotIntegrationCommand | undefined;

  /**
   * 拡張機能の起動処理
   */
  activate(context: vscode.ExtensionContext): void {
    // Configure logger based on extension mode
    if (context.extensionMode === vscode.ExtensionMode.Development) {
      logger.setLevel(LogLevel.DEBUG);
    } else {
      logger.setLevel(LogLevel.WARN);
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

      // Initialize session manager
      this.sessionManager = new SessionManager(context, this.terminalManager);

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

      // セッション復元処理（初期化完了後に実行）
      this.restoreSessionOnStartup();

      // VS Code終了時の自動保存設定
      this.setupSessionAutoSave(context);

      log('Sidebar Terminal extension activated successfully');
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

    // セッション保存処理
    this.saveSessionOnExit();

    // Dispose session manager
    if (this.sessionManager) {
      log('🔧 [EXTENSION] Disposing session manager...');
      this.sessionManager = undefined;
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
   * 現在のセッションマネージャーを取得（テスト用）
   */
  getSessionManager(): SessionManager | undefined {
    return this.sessionManager;
  }

  // ==================== セッション管理関連のメソッド ====================

  /**
   * 起動時のセッション復元処理
   */
  private async restoreSessionOnStartup(): Promise<void> {
    try {
      if (!this.sessionManager) {
        log('⚠️ [SESSION] Session manager not initialized');
        return;
      }

      log('🔄 [SESSION] Starting session restore on startup...');
      
      // 少し遅延させてから復元（他の初期化処理完了を待つ）
      setTimeout(async () => {
        if (this.sessionManager && this.terminalManager) {
          const result = await this.sessionManager.restoreSession();
          
          if (result.success && result.restoredTerminalCount > 0) {
            log(`✅ [SESSION] Session restored: ${result.restoredTerminalCount} terminals`);
            
            // 復元完了後の初期化処理
            this.terminalManager.finalizeSessionRestore();
            
            // ユーザーに通知（オプション）
            void vscode.window.showInformationMessage(
              `Terminal session restored: ${result.restoredTerminalCount} terminals`
            );
          } else if (result.error) {
            log(`❌ [SESSION] Session restore failed: ${result.error}`);
          }
        }
      }, 1000); // 1秒遅延
    } catch (error) {
      log(`❌ [SESSION] Error during session restore: ${error}`);
    }
  }

  /**
   * 終了時のセッション保存処理
   */
  private saveSessionOnExit(): void {
    try {
      if (!this.sessionManager) {
        log('⚠️ [SESSION] Session manager not available for save on exit');
        return;
      }

      log('💾 [SESSION] Saving session on exit...');

      // 同期的に保存処理を実行（非同期では拡張終了に間に合わない可能性）
      this.sessionManager.saveCurrentSession().then((result) => {
        if (result.success) {
          log(`✅ [SESSION] Session saved on exit: ${result.terminalCount} terminals`);
        } else {
          log(`❌ [SESSION] Failed to save session on exit: ${result.error}`);
        }
      }).catch((error) => {
        log(`❌ [SESSION] Error saving session on exit: ${error}`);
      });
    } catch (error) {
      log(`❌ [SESSION] Error during session save on exit: ${error}`);
    }
  }

  /**
   * VS Code終了時の自動保存設定
   */
  private setupSessionAutoSave(context: vscode.ExtensionContext): void {
    try {
      if (!this.sessionManager) {
        log('⚠️ [SESSION] Session manager not available for auto-save setup');
        return;
      }

      log('⚙️ [SESSION] Setting up session auto-save...');

      // ワークスペース変更時の保存
      const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (this.sessionManager) {
          this.sessionManager.saveCurrentSession().then((result) => {
            if (result.success) {
              log(`💾 [SESSION] Session saved on workspace change: ${result.terminalCount} terminals`);
            }
          }).catch((error) => {
            log(`❌ [SESSION] Error saving session on workspace change: ${error}`);
          });
        }
      });

      context.subscriptions.push(workspaceWatcher);

      // 定期保存（5分間隔）
      const autoSaveInterval = setInterval(() => {
        if (this.sessionManager) {
          this.sessionManager.saveCurrentSession().then((result) => {
            if (result.success && result.terminalCount > 0) {
              log(`💾 [SESSION] Auto-save completed: ${result.terminalCount} terminals`);
            }
          }).catch((error) => {
            log(`❌ [SESSION] Error during auto-save: ${error}`);
          });
        }
      }, 5 * 60 * 1000); // 5分

      // 拡張停止時にインターバルをクリア
      context.subscriptions.push({
        dispose: () => {
          clearInterval(autoSaveInterval);
          log('🔧 [SESSION] Auto-save interval cleared');
        }
      });

      log('✅ [SESSION] Session auto-save configured');
    } catch (error) {
      log(`❌ [SESSION] Error setting up auto-save: ${error}`);
    }
  }
}
