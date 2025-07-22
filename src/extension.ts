import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from './providers/SecondaryTerminalProvider';
import { TerminalManager } from './terminals/TerminalManager';
import { extension as log, logger, LogLevel } from './utils/logger';
import { TerminalErrorHandler } from './utils/feedback';
// CliAgentTracker is no longer needed - CLI Agent integration is now handled by TerminalManager

let terminalManager: TerminalManager | undefined;
let sidebarProvider: SecondaryTerminalProvider | undefined;
// CLI Agent integration is now handled by TerminalManager

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

    // CLI Agent integration is now handled directly by TerminalManager
    // No need for separate CLI Agent tracker

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

// =================== 共通ユーティリティ関数 ===================

/**
 * アクティブエディタからファイルのベース名を取得
 */
function getActiveFileBaseName(): { baseName: string; fullPath: string } | null {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return null;
  }

  const fullPath = activeEditor.document.fileName;
  const baseName = fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath;
  return { baseName, fullPath };
}

/**
 * CLI Agent統合機能が有効かチェック
 */
function isCliAgentIntegrationEnabled(): boolean {
  const config = vscode.workspace.getConfiguration('secondaryTerminal');
  return config.get<boolean>('enableCliAgentIntegration', true);
}

/**
 * ターミナルマネージャーとアクティブターミナルの確認
 */
function validateTerminalEnvironment(): { activeTerminalId: string } | null {
  if (!terminalManager || !terminalManager.hasActiveTerminal()) {
    log('⚠️ [WARN] No active sidebar terminal');
    void vscode.window.showWarningMessage(
      'No sidebar terminal available. Please open the sidebar terminal first.'
    );
    return null;
  }

  const activeTerminalId = terminalManager.getActiveTerminalId();
  if (!activeTerminalId) {
    log('⚠️ [WARN] Could not get active terminal ID');
    return null;
  }

  return { activeTerminalId };
}

/**
 * 最適なCLI Agent送信対象を決定
 */
function determineCliAgentTarget(activeTerminalId: string): {
  targetTerminalId: string;
  agentType: string;
  isCurrentTerminal: boolean;
} | null {
  if (!terminalManager) {
    log('❌ [ERROR] TerminalManager not available');
    return null;
  }

  // 現在のターミナルでCLI Agentが動いているかチェック
  const isRunningInCurrent = terminalManager.isCliAgentRunning(activeTerminalId);
  const isCurrentActive = terminalManager.isCliAgentConnected(activeTerminalId);

  if (isCurrentActive) {
    // 現在のターミナルがアクティブな場合
    const agentType = terminalManager.getAgentType(activeTerminalId);
    return {
      targetTerminalId: activeTerminalId,
      agentType: agentType?.toUpperCase() || 'CLI AGENT',
      isCurrentTerminal: true,
    };
  }

  // グローバルアクティブなCLI Agentを確認
  const globallyActiveAgent = terminalManager.getCurrentGloballyActiveAgent();
  if (globallyActiveAgent) {
    return {
      targetTerminalId: globallyActiveAgent.terminalId,
      agentType: globallyActiveAgent.type.toUpperCase(),
      isCurrentTerminal: false,
    };
  }

  // 現在のターミナルでCLI Agentが動いている場合（DISCONNECTED状態）
  if (isRunningInCurrent) {
    const agentType = terminalManager.getAgentType(activeTerminalId);
    log('⚠️ [WARN] CLI Agent running in current terminal but not active globally');
    void vscode.window.showInformationMessage(
      `ℹ️ ${agentType?.toUpperCase() || 'CLI Agent'} is running but not active. Please activate it or use the active CLI Agent in another terminal.`
    );
    return null;
  }

  // CLI Agentが全く動いていない
  log('⚠️ [DEBUG] No CLI Agent running');
  void vscode.window.showInformationMessage(
    'ℹ️ Please start CLI Agent first to use file references. Run "claude" or "gemini" command in a terminal.'
  );
  return null;
}

// =================== メイン機能関数 ===================

/**
 * @filename 送信処理（CLI Agent連携）
 */
async function handleSendAtMention(): Promise<void> {
  try {
    log('🚀 [DEBUG] handleSendAtMention called with CLI Agent integration');

    // CLI Agent統合機能が有効かチェック
    if (!isCliAgentIntegrationEnabled()) {
      log('🔧 [DEBUG] CLI Agent integration is disabled by user setting');
      void vscode.window.showInformationMessage(
        'File reference shortcuts are disabled. Enable them in Terminal Settings.'
      );
      return;
    }

    // アクティブエディタの確認
    const fileInfo = getActiveFileBaseName();
    if (!fileInfo) {
      log('⚠️ [WARN] No active editor found for @mention');
      void vscode.window.showWarningMessage('No active file to mention. Please open a file first.');
      return;
    }

    // ターミナル環境の確認
    const terminalEnv = validateTerminalEnvironment();
    if (!terminalEnv) {
      return;
    }

    // CLI Agent送信対象の決定
    const target = determineCliAgentTarget(terminalEnv.activeTerminalId);
    if (!target) {
      return;
    }

    // ファイル参照を送信
    if (!terminalManager) {
      log('❌ [ERROR] TerminalManager not available for sending');
      return;
    }

    const text = `@${fileInfo.baseName} `;
    terminalManager.sendInput(text, target.targetTerminalId);

    // 成功メッセージ
    const message = target.isCurrentTerminal
      ? `✅ Sent file reference to ${target.agentType} in current terminal`
      : `✅ Sent file reference to active ${target.agentType} in terminal ${target.targetTerminalId}`;

    void vscode.window.showInformationMessage(message);
    log(
      `✅ [DEBUG] Successfully sent @${fileInfo.baseName} to ${target.agentType} in terminal ${target.targetTerminalId}`
    );
  } catch (error) {
    log('❌ [ERROR] Error in handleSendAtMention:', error);
    void vscode.window.showErrorMessage(`Failed to send @mention: ${String(error)}`);
  }
}

/**
 * テキストをターミナルに送信する（汎用）
 */
function handleSendToTerminal(content?: string): void {
  try {
    log('🔧 [DEBUG] handleSendToTerminal called with content:', content);

    let text: string | undefined = content;

    // content が未定義の場合、アクティブエディタから @filename を生成
    if (!text) {
      const fileInfo = getActiveFileBaseName();
      if (fileInfo) {
        text = `@${fileInfo.baseName}`;
        log('🔧 [DEBUG] Generated @filename from active editor:', text);
      } else {
        log('⚠️ [WARN] No content provided and no active editor found');
        void vscode.window.showWarningMessage(
          'No content to send. Please provide content or open a file first.'
        );
        return;
      }
    }

    // ターミナル環境の確認
    const terminalEnv = validateTerminalEnvironment();
    if (!terminalEnv || !text) {
      return;
    }

    // テキストを送信
    if (!terminalManager) {
      log('❌ [ERROR] TerminalManager not available for sending');
      return;
    }

    terminalManager.sendInput(text, terminalEnv.activeTerminalId);
    log('✅ [DEBUG] Successfully sent text to terminal:', text);
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

    // CLI Agent integration disposal is handled by TerminalManager

    log('Sidebar Terminal extension deactivated successfully');
  } catch (error) {
    log('Error during deactivation:', error);
  }
}
