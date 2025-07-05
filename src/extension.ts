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
      callback: async () => {
        console.log('🔧 [DEBUG] Command executed: createTerminal');
        try {
          provider.createNewTerminal();
          // Re-initialize to show the new terminal
          await provider._initializeTerminal();
        } catch (error) {
          console.error('❌ [ERROR] Command createTerminal failed:', error);
        }
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
    {
      command: 'sidebarTerminal.moveToRightPanel',
      callback: async () => {
        console.log('🔧 [DEBUG] Command executed: moveToRightPanel');
        // Open auxiliary bar (right panel)
        await vscode.commands.executeCommand('workbench.action.toggleAuxiliaryBar');
        
        // Show guide message
        const result = await vscode.window.showInformationMessage(
          '右側パネルが開きました。ターミナルビューをドラッグして右側に移動してください。',
          'ガイドを表示',
          '今後表示しない'
        );
        
        if (result === 'ガイドを表示') {
          await vscode.commands.executeCommand('sidebarTerminal.showRightPanelGuide');
        } else if (result === '今後表示しない') {
          // Save setting
          await vscode.workspace.getConfiguration('sidebarTerminal').update('showRightPanelGuide', false, true);
        }
      },
    },
    {
      command: 'sidebarTerminal.showRightPanelGuide',
      callback: async () => {
        console.log('🔧 [DEBUG] Command executed: showRightPanelGuide');
        await vscode.window.showInformationMessage(
          '右側パネルにターミナルを移動する方法:\n\n' +
          '1. ターミナルビューのタイトルバーをクリック\n' +
          '2. 右側パネルにドラッグ&ドロップ\n' +
          '3. ターミナルが右側に表示されます',
          'OK'
        );
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
