import * as vscode from 'vscode';
import { SidebarTerminalProvider } from './providers/SidebarTerminalProvider';
import { TerminalManager } from './terminals/TerminalManager';

let terminalManager: TerminalManager | undefined;
let sidebarProvider: SidebarTerminalProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('Sidebar Terminal extension is now active!');

  try {
    // Initialize terminal manager
    terminalManager = new TerminalManager(context);

    // Register the sidebar terminal provider
    sidebarProvider = new SidebarTerminalProvider(context, terminalManager);

    // Register webview provider
    const webviewProvider = vscode.window.registerWebviewViewProvider(
      SidebarTerminalProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    );
    context.subscriptions.push(webviewProvider);

    // Register commands
    registerCommands(context, sidebarProvider);

    console.log('Sidebar Terminal extension activated successfully');
  } catch (error) {
    console.error('Failed to activate Sidebar Terminal extension:', error);
    vscode.window.showErrorMessage(`Failed to activate Sidebar Terminal: ${String(error)}`);
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
      command: 'sidebarTerminal.createTerminal',
      callback: () => provider.createNewTerminal(),
    },
    {
      command: 'sidebarTerminal.clearTerminal',
      callback: () => provider.clearTerminal(),
    },
    {
      command: 'sidebarTerminal.killTerminal',
      callback: () => provider.killTerminal(),
    },
    {
      command: 'sidebarTerminal.splitTerminal',
      callback: () => provider.splitTerminal(),
    },
  ];

  for (const { command, callback } of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  }
}

export function deactivate(): void {
  console.log('Deactivating Sidebar Terminal extension...');

  try {
    if (terminalManager) {
      terminalManager.dispose();
      terminalManager = undefined;
    }

    sidebarProvider = undefined;

    console.log('Sidebar Terminal extension deactivated successfully');
  } catch (error) {
    console.error('Error during deactivation:', error);
  }
}
