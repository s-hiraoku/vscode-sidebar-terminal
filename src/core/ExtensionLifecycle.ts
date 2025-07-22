import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { extension as log, logger, LogLevel } from '../utils/logger';
import { FileReferenceCommand, TerminalCommand } from '../commands';

/**
 * VS Code拡張機能のライフサイクル管理
 * 初期化、コマンド登録、クリーンアップを担当
 */
export class ExtensionLifecycle {
  private terminalManager: TerminalManager | undefined;
  private sidebarProvider: SecondaryTerminalProvider | undefined;
  private fileReferenceCommand: FileReferenceCommand | undefined;
  private terminalCommand: TerminalCommand | undefined;

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

      // Initialize command handlers
      this.fileReferenceCommand = new FileReferenceCommand(this.terminalManager);
      this.terminalCommand = new TerminalCommand(this.terminalManager);

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
          void vscode.commands.executeCommand('secondaryTerminalView.focus');
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
}
