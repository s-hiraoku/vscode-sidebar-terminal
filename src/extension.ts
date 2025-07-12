import * as vscode from 'vscode';
import { SidebarTerminalProvider } from './providers/SidebarTerminalProvider';
import { TerminalManager } from './terminals/TerminalManager';
import { extension as log, logger, LogLevel } from './utils/logger';

let terminalManager: TerminalManager | undefined;
let sidebarProvider: SidebarTerminalProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Configure logger based on extension mode
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    logger.setLevel(LogLevel.DEBUG);
  } else {
    logger.setLevel(LogLevel.WARN);
  }

  // Get extension version info
  const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
  const version = extension?.packageJSON?.version || 'unknown';
  
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

    // Register commands
    registerCommands(context, sidebarProvider);

    log('Sidebar Terminal extension activated successfully');
  } catch (error) {
    log('Failed to activate Sidebar Terminal extension:', error);
    void vscode.window.showErrorMessage(`Failed to activate Sidebar Terminal: ${String(error)}`);
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

    log('Sidebar Terminal extension deactivated successfully');
  } catch (error) {
    log('Error during deactivation:', error);
  }
}
