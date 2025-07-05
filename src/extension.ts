import * as vscode from 'vscode';
import { SidebarTerminalProvider } from './providers/SidebarTerminalProvider';
import { TerminalManager } from './terminals/TerminalManager';

let terminalManager: TerminalManager | undefined;
let sidebarProvider: SidebarTerminalProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('🚀 [DEBUG] Sidebar Terminal extension is now active!');
  console.log('🚀 [DEBUG] Extension path:', context.extensionPath);

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
      command: 'sidebarTerminal.createTerminal',
      callback: () => {
        console.log('🔧 [DEBUG] Command executed: createTerminal');
        provider.createNewTerminal();
      },
    },
    {
      command: 'sidebarTerminal.clearTerminal',
      callback: () => {
        console.log('🔧 [DEBUG] Command executed: clearTerminal');
        provider.clearTerminal();
      },
    },
    {
      command: 'sidebarTerminal.killTerminal',
      callback: () => {
        console.log('🔧 [DEBUG] Command executed: killTerminal');
        provider.killTerminal();
      },
    },
    {
      command: 'sidebarTerminal.splitTerminal',
      callback: () => {
        console.log('🔧 [DEBUG] Command executed: splitTerminal');
        provider.splitTerminal();
      },
    },
  ];

  for (const { command, callback } of commands) {
    const commandRegistration = vscode.commands.registerCommand(command, callback);
    context.subscriptions.push(commandRegistration);
    console.log('✅ [DEBUG] Command registered:', command);
  }

  console.log('✅ [DEBUG] All commands registered successfully');
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
