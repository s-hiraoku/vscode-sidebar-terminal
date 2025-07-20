import * as vscode from 'vscode';
import { SidebarTerminalProvider } from './providers/SidebarTerminalProvider';
import { TerminalManager } from './terminals/TerminalManager';
import { extension as log, logger, LogLevel } from './utils/logger';
import { TerminalErrorHandler } from './utils/feedback';
import { ClaudeTerminalTracker } from './integration/ClaudeTerminalTracker';

let terminalManager: TerminalManager | undefined;
let sidebarProvider: SidebarTerminalProvider | undefined;
let claudeTracker: ClaudeTerminalTracker | undefined;

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
    terminalManager = new TerminalManager(context);

    // Register the sidebar terminal provider
    sidebarProvider = new SidebarTerminalProvider(context, terminalManager);

    // Register webview providers for both sidebar and panel
    const sidebarWebviewProvider = vscode.window.registerWebviewViewProvider(
      SidebarTerminalProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    );
    context.subscriptions.push(sidebarWebviewProvider);

    // Initialize Claude Terminal Tracker
    claudeTracker = ClaudeTerminalTracker.getInstance(context);

    // Set SidebarTerminalProvider reference for WebView notifications
    claudeTracker.setSidebarProvider(sidebarProvider);

    // Register commands
    registerCommands(context, sidebarProvider);

    // Add test command for Claude status update
    const testClaudeStatusCommand = vscode.commands.registerCommand(
      'sidebarTerminal.testClaudeStatus',
      () => {
        log('🧪 [DEBUG] Test Claude status command executed');
        if (sidebarProvider) {
          sidebarProvider.sendClaudeStatusUpdate('Terminal 1', 'connected');

          setTimeout(() => {
            if (sidebarProvider) {
              sidebarProvider.sendClaudeStatusUpdate('Terminal 1', 'disconnected');
            }
          }, 2000);

          setTimeout(() => {
            if (sidebarProvider) {
              sidebarProvider.sendClaudeStatusUpdate(null, 'none');
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
 * サイドバーターミナルにフォーカスを移動
 */
async function focusSidebarTerminal(): Promise<void> {
  try {
    log('🔧 [DEBUG] Attempting to focus sidebar terminal...');

    // 1. サイドバーコンテナを表示してフォーカス
    await vscode.commands.executeCommand('workbench.view.extension.sidebarTerminalContainer');

    // 2. WebView内のターミナルにフォーカスを送信（将来の実装）
    // TODO: SidebarTerminalProvider に sendFocusToTerminal メソッドを追加
    // if (sidebarProvider && typeof sidebarProvider.sendFocusToTerminal === 'function') {
    //   sidebarProvider.sendFocusToTerminal();
    //   log('🔧 [DEBUG] Sent focus message to WebView');
    // }

    log('✅ [DEBUG] Successfully focused sidebar terminal');
  } catch (error) {
    log('⚠️ [WARN] Failed to focus sidebar terminal:', error);
    // フォーカス失敗は致命的ではないので、エラーメッセージは表示しない
  }
}

/**
 * @filename 送信処理
 */
async function handleSendAtMention(): Promise<void> {
  try {
    log('🚀 [DEBUG] handleSendAtMention called with sidebar terminal Claude detection');

    // Claude Code統合機能が有効かチェック
    const config = vscode.workspace.getConfiguration('sidebarTerminal');
    const isEnabled = config.get<boolean>('enableClaudeCodeIntegration', true);

    if (!isEnabled) {
      log('🔧 [DEBUG] Claude Code integration is disabled by user setting');
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

    // サイドバーターミナルでClaudeが実行中かチェック
    const isClaudeActive = terminalManager.isClaudeActive(activeTerminalId);
    log(`🔍 [DEBUG] Claude active in sidebar terminal ${activeTerminalId}: ${isClaudeActive}`);

    if (!isClaudeActive) {
      log('⚠️ [DEBUG] Claude not running, refusing to send @filename');
      void vscode.window.showInformationMessage(
        'ℹ️ Please start Claude first to use file references. Run "claude" command in the terminal.'
      );
      return;
    }

    // Claudeが実行中の場合のみファイル参照を送信
    const fileName = activeEditor.document.fileName;
    const baseName = fileName.split('/').pop() || fileName.split('\\').pop() || fileName;
    const text = `@${baseName} `;

    // サイドバーターミナルに送信
    terminalManager.sendInput(text);
    await focusSidebarTerminal();

    void vscode.window.showInformationMessage(
      '✅ Sent file reference to Claude in sidebar terminal'
    );
    log('✅ [DEBUG] Successfully sent to Claude in sidebar terminal');
  } catch (error) {
    log('❌ [ERROR] Error in handleSendAtMention:', error);
    void vscode.window.showErrorMessage(`Failed to send @mention: ${String(error)}`);
  }
}

/**
 * サイドバーターミナルに送信する処理（フォールバック用）
 */
async function sendToSidebarTerminal(): Promise<void> {
  try {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const fileName = activeEditor.document.fileName;
    const baseName = fileName.split('/').pop() || fileName.split('\\').pop() || fileName;
    const text = `@${baseName} `;

    if (terminalManager) {
      terminalManager.sendInput(text);
      await focusSidebarTerminal();
      log('✅ [DEBUG] Sent to sidebar terminal as fallback:', text);
    } else {
      log('⚠️ [WARN] TerminalManager not available for fallback');
      void vscode.window.showWarningMessage(
        'Sidebar terminal not available. Please open the sidebar terminal first.'
      );
    }
  } catch (error) {
    log('❌ [ERROR] Error in sendToSidebarTerminal:', error);
  }
}

/**
 * テキストをターミナルに送信する（Claude Code連携用）
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
  provider: SidebarTerminalProvider
): void {
  const commands = [
    {
      command: 'sidebarTerminal.killTerminal',
      callback: () => {
        log('🔧 [DEBUG] Command executed: killTerminal');
        provider.killTerminal();
      },
    },
    {
      command: 'sidebarTerminal.splitTerminal',
      callback: () => {
        log('🔧 [DEBUG] Command executed: splitTerminal');
        provider.splitTerminal();
      },
    },
    {
      command: 'sidebarTerminal.openSettings',
      callback: () => {
        log('🔧 [DEBUG] Command executed: openSettings');
        provider.openSettings();
      },
    },
    {
      command: 'sidebarTerminal.sendToTerminal',
      callback: (content?: string) => {
        log('🔧 [DEBUG] Command executed: sendToTerminal', 'content:', content);
        handleSendToTerminal(content);
      },
    },
    {
      command: 'sidebarTerminal.sendAtMention',
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

    if (claudeTracker) {
      claudeTracker.dispose();
      claudeTracker = undefined;
    }

    log('Sidebar Terminal extension deactivated successfully');
  } catch (error) {
    log('Error during deactivation:', error);
  }
}
