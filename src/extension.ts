import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from './providers/SecondaryTerminalProvider';
import { TerminalManager } from './terminals/TerminalManager';
import { extension as log, logger, LogLevel } from './utils/logger';
import { TerminalErrorHandler } from './utils/feedback';
import { CliAgentTracker } from './integration/CliAgentTerminalTracker';

let terminalManager: TerminalManager | undefined;
let sidebarProvider: SecondaryTerminalProvider | undefined;
let cliAgentTracker: CliAgentTracker | undefined;

export function activate(context: vscode.ExtensionContext): void {
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
    terminalManager = new TerminalManager();

    // Register the sidebar terminal provider
    sidebarProvider = new SecondaryTerminalProvider(context, terminalManager);

    // Register webview providers for both sidebar and panel
    const sidebarWebviewProvider = vscode.window.registerWebviewViewProvider(
      SecondaryTerminalProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    );
    context.subscriptions.push(sidebarWebviewProvider);

    // Initialize Claude Terminal Tracker
    cliAgentTracker = CliAgentTracker.getInstance(context);

    // Set SecondaryTerminalProvider reference for WebView notifications
    cliAgentTracker.setSidebarProvider(sidebarProvider);

    // Register commands
    registerCommands(context, sidebarProvider);

    // Add test command for CLI Agent status update
    const testClaudeStatusCommand = vscode.commands.registerCommand(
      'secondaryTerminal.testClaudeStatus',
      () => {
        log('🧪 [DEBUG] Test CLI Agent status command executed');
        if (sidebarProvider) {
          sidebarProvider.sendCliAgentStatusUpdate('Terminal 1', 'connected');

          setTimeout(() => {
            if (sidebarProvider) {
              sidebarProvider.sendCliAgentStatusUpdate('Terminal 1', 'disconnected');
            }
          }, 2000);

          setTimeout(() => {
            if (sidebarProvider) {
              sidebarProvider.sendCliAgentStatusUpdate(null, 'none');
            }
          }, 4000);
        }
      }
    );
    context.subscriptions.push(testClaudeStatusCommand);

    log('Sidebar Terminal extension activated successfully');
  } catch (error) {
    log('Failed to activate Sidebar Terminal extension:', error);
    TerminalErrorHandler.handleWebviewError(error);
  }
}

/**
 * @filename 送信処理
 */
async function handleSendAtMention(): Promise<void> {
  try {
    log('🚀 [DEBUG] handleSendAtMention called with sidebar terminal Claude detection');

    // CLI Agent統合機能が有効かチェック
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    const isEnabled = config.get<boolean>('enableCliAgentIntegration', true);

    if (!isEnabled) {
      log('🔧 [DEBUG] CLI Agent integration is disabled by user setting');
      void vscode.window.showInformationMessage(
        'File reference shortcuts are disabled. Enable them in Terminal Settings.'
      );
      return;
    }

    // アクティブエディタの確認
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      log('⚠️ [WARN] No active editor found for @mention');
      void vscode.window.showWarningMessage('No active file to mention. Please open a file first.');
      return;
    }

    // アクティブなサイドバーターミナルを確認
    if (!terminalManager || !terminalManager.hasActiveTerminal()) {
      log('⚠️ [WARN] No active sidebar terminal');
      void vscode.window.showWarningMessage(
        'No sidebar terminal available. Please open the sidebar terminal first.'
      );
      return;
    }

    const activeTerminalId = terminalManager.getActiveTerminalId();
    if (!activeTerminalId) {
      log('⚠️ [WARN] Could not get active terminal ID');
      return;
    }

    // サイドバーターミナルでCLI Agentが実行中かチェック
    const isCliAgentActive = terminalManager.isCliAgentActive(activeTerminalId);
    log(`🔍 [DEBUG] Claude active in sidebar terminal ${activeTerminalId}: ${isCliAgentActive}`);

    if (!isCliAgentActive) {
      log('⚠️ [DEBUG] CLI Agent not running, refusing to send @filename');
      void vscode.window.showInformationMessage(
        'ℹ️ Please start CLI Agent first to use file references. Run "cli-agent" command in the terminal.'
      );
      return;
    }

    // CLI Agentが実行中の場合のみファイル参照を送信
    const fileName = activeEditor.document.fileName;
    const baseName = fileName.split('/').pop() || fileName.split('\\').pop() || fileName;
    const text = `@${baseName} `;

    // サイドバーターミナルに送信
    terminalManager.sendInput(text);

    void vscode.window.showInformationMessage(
      '✅ Sent file reference to CLI Agent in secondary terminal'
    );
    log('✅ [DEBUG] Successfully sent to CLI Agent in secondary terminal');
  } catch (error) {
    log('❌ [ERROR] Error in handleSendAtMention:', error);
    void vscode.window.showErrorMessage(`Failed to send @mention: ${String(error)}`);
  }
}

/**
 * テキストをターミナルに送信する（CLI Agent連携用）
 */
function handleSendToTerminal(content?: string): void {
  try {
    log('🔧 [DEBUG] HandleSendToTerminal called with content:', content);

    let text: string | undefined = content;

    // content が未定義の場合、アクティブエディタから @filename を生成
    if (!text) {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const fileName = activeEditor.document.fileName;
        const baseName = fileName.split('/').pop() || fileName.split('\\').pop() || fileName;
        text = `@${baseName}`;
        log('🔧 [DEBUG] Generated @filename from active editor:', text);
      } else {
        log('⚠️ [WARN] No content provided and no active editor found');
        void vscode.window.showWarningMessage(
          'No content to send. Please provide content or open a file first.'
        );
        return;
      }
    }

    if (text && terminalManager) {
      // TerminalManagerのsendInputメソッドを使用してテキストを送信
      terminalManager.sendInput(text);
      log('✅ [DEBUG] Successfully sent text to terminal:', text);
    } else {
      log('⚠️ [WARN] No text to send or terminalManager not available');
      void vscode.window.showWarningMessage('Unable to send text to terminal');
    }
  } catch (error) {
    log('❌ [ERROR] Error in handleSendToTerminal:', error);
    void vscode.window.showErrorMessage(`Failed to send text to terminal: ${String(error)}`);
  }
}

/**
 * コマンドを登録する
 */
function registerCommands(
  context: vscode.ExtensionContext,
  provider: SecondaryTerminalProvider
): void {
  const commands = [
    {
      command: 'secondaryTerminal.killTerminal',
      callback: () => {
        log('🔧 [DEBUG] Command executed: killTerminal');
        provider.killTerminal();
      },
    },
    {
      command: 'secondaryTerminal.splitTerminal',
      callback: () => {
        log('🔧 [DEBUG] Command executed: splitTerminal');
        provider.splitTerminal();
      },
    },
    {
      command: 'secondaryTerminal.openSettings',
      callback: () => {
        log('🔧 [DEBUG] Command executed: openSettings');
        provider.openSettings();
      },
    },
    {
      command: 'secondaryTerminal.sendToTerminal',
      callback: (content?: string) => {
        log('🔧 [DEBUG] Command executed: sendToTerminal', 'content:', content);
        handleSendToTerminal(content);
      },
    },
    {
      command: 'secondaryTerminal.sendAtMention',
      callback: async () => {
        log('🔧 [DEBUG] Command executed: sendAtMention (independent @filename command)');
        await handleSendAtMention();
      },
    },
  ];

  for (const { command, callback } of commands) {
    const commandRegistration = vscode.commands.registerCommand(command, callback);
    context.subscriptions.push(commandRegistration);
    log('✅ [DEBUG] Command registered:', command);
  }

  log('✅ [DEBUG] All commands registered successfully');
}

export function deactivate(): void {
  log('Deactivating Sidebar Terminal extension...');

  try {
    if (terminalManager) {
      terminalManager.dispose();
      terminalManager = undefined;
    }

    sidebarProvider = undefined;

    if (cliAgentTracker) {
      cliAgentTracker.dispose();
      cliAgentTracker = undefined;
    }

    log('Sidebar Terminal extension deactivated successfully');
  } catch (error) {
    log('Error during deactivation:', error);
  }
}
