import * as vscode from 'vscode';
import { SidebarTerminalProvider } from './providers/SidebarTerminalProvider';
import { TerminalManager } from './terminals/TerminalManager';

let terminalManager: TerminalManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('Sidebar Terminal extension is now active!');

  // Initialize terminal manager
  terminalManager = new TerminalManager(context);

  // Register the sidebar terminal provider
  const provider = new SidebarTerminalProvider(context, terminalManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarTerminalProvider.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('sidebarTerminal.createTerminal', () => {
      provider.createNewTerminal();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sidebarTerminal.clearTerminal', () => {
      provider.clearTerminal();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sidebarTerminal.killTerminal', () => {
      provider.killTerminal();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sidebarTerminal.splitTerminal', () => {
      provider.splitTerminal();
    })
  );
}

export function deactivate(): void {
  if (terminalManager) {
    terminalManager.dispose();
  }
}
