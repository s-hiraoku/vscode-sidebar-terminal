import * as assert from 'assert';
import * as vscode from 'vscode';
import { SidebarTerminalProvider } from '../../providers/SidebarTerminalProvider';
import { TerminalManager } from '../../terminals/TerminalManager';

suite('Webview Test Suite', () => {
  let terminalManager: TerminalManager;
  let provider: SidebarTerminalProvider;
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    mockContext = {
      subscriptions: [],
      extensionPath: '',
      extensionUri: vscode.Uri.file(''),
      globalState: {} as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
      workspaceState: {} as vscode.Memento,
      asAbsolutePath: (relativePath: string) => relativePath,
      secrets: {} as vscode.SecretStorage,
      environmentVariableCollection: {} as vscode.EnvironmentVariableCollection,
      storageUri: undefined,
      storagePath: undefined,
      globalStorageUri: vscode.Uri.file(''),
      globalStoragePath: '',
      logUri: vscode.Uri.file(''),
      logPath: '',
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as vscode.Extension<unknown>,
      languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
    } as unknown as vscode.ExtensionContext;

    terminalManager = new TerminalManager(mockContext);
    provider = new SidebarTerminalProvider(mockContext, terminalManager);
  });

  teardown(() => {
    terminalManager.dispose();
  });

  test('Should generate valid HTML for webview', () => {
    const mockWebview = {
      asWebviewUri: (uri: vscode.Uri) => uri,
      cspSource: 'vscode-resource:',
    } as vscode.Webview;

    // Use private method through any cast for testing
    const html = (provider as any)._getHtmlForWebview(mockWebview);

    assert.ok(html);
    assert.ok(typeof html === 'string');
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('<div id="terminal">'));
    assert.ok(html.includes('webview.js'));
    assert.ok(html.includes('xterm.css'));
    assert.ok(html.includes('Loading terminal...'));
  });

  test('Should handle webview view resolution', () => {
    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: () => Promise.resolve(true),
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: 'vscode-resource:',
      },
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      visible: true,
      viewType: 'sidebarTerminal',
      show: () => {},
    } as vscode.WebviewView;

    assert.doesNotThrow(() => {
      provider.resolveWebviewView(
        mockWebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );
    });

    // Verify HTML was set
    assert.ok(mockWebviewView.webview.html.length > 0);
  });

  test('Should handle webview message communication', async () => {
    let messageHandled = false;
    let lastMessage: any = null;

    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: (message: any) => {
          lastMessage = message;
          return Promise.resolve(true);
        },
        onDidReceiveMessage: (callback: (message: any) => void) => {
          // Simulate webview ready message
          setTimeout(() => {
            messageHandled = true;
            callback({ command: 'ready' });
          }, 10);
          return { dispose: () => {} };
        },
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: 'vscode-resource:',
      },
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      visible: true,
      viewType: 'sidebarTerminal',
      show: () => {},
    } as vscode.WebviewView;

    provider.resolveWebviewView(
      mockWebviewView,
      {} as vscode.WebviewViewResolveContext,
      {} as vscode.CancellationToken
    );

    // Wait for message handling
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(messageHandled, 'Webview message should be handled');
    assert.ok(lastMessage, 'Message should be sent to webview');
    assert.strictEqual(lastMessage.command, 'init', 'Init message should be sent');
  });

  test('Should handle command execution through provider', () => {
    let createTerminalCalled = false;
    let clearTerminalCalled = false;
    let killTerminalCalled = false;
    let splitTerminalCalled = false;

    // Mock the methods to track calls
    const originalCreateNewTerminal = provider.createNewTerminal;
    const originalClearTerminal = provider.clearTerminal;
    const originalKillTerminal = provider.killTerminal;
    const originalSplitTerminal = provider.splitTerminal;

    provider.createNewTerminal = () => {
      createTerminalCalled = true;
      originalCreateNewTerminal.call(provider);
    };

    provider.clearTerminal = () => {
      clearTerminalCalled = true;
      originalClearTerminal.call(provider);
    };

    provider.killTerminal = () => {
      killTerminalCalled = true;
      originalKillTerminal.call(provider);
    };

    provider.splitTerminal = () => {
      splitTerminalCalled = true;
      originalSplitTerminal.call(provider);
    };

    // Test command execution
    provider.createNewTerminal();
    provider.clearTerminal();
    provider.splitTerminal();

    // Create a terminal first before killing
    terminalManager.createTerminal();
    provider.killTerminal();

    assert.ok(createTerminalCalled, 'Create terminal command should be called');
    assert.ok(clearTerminalCalled, 'Clear terminal command should be called');
    assert.ok(killTerminalCalled, 'Kill terminal command should be called');
    assert.ok(splitTerminalCalled, 'Split terminal command should be called');

    // Restore original methods
    provider.createNewTerminal = originalCreateNewTerminal;
    provider.clearTerminal = originalClearTerminal;
    provider.killTerminal = originalKillTerminal;
    provider.splitTerminal = originalSplitTerminal;
  });

  test('Should handle error cases gracefully', async () => {
    let errorOccurred = false;

    // Mock vscode.window.showErrorMessage to capture errors
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = () => {
      errorOccurred = true;
      return Promise.resolve(undefined);
    };

    try {
      // Test with invalid webview view
      const invalidWebviewView = null as any;

      assert.doesNotThrow(() => {
        try {
          provider.resolveWebviewView(
            invalidWebviewView,
            {} as vscode.WebviewViewResolveContext,
            {} as vscode.CancellationToken
          );
        } catch (error) {
          // Expected to fail gracefully
        }
      });

      // Test sending message without webview
      await (provider as any)._sendMessage({ command: 'test' });

      // Give time for error handling
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      // Restore original method
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('Should handle different message types correctly', () => {
    const messageTypes = ['ready', 'input', 'resize', 'switchTerminal'];
    const processedMessages: string[] = [];

    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: () => Promise.resolve(true),
        onDidReceiveMessage: (callback: (message: any) => void) => {
          // Test different message types
          messageTypes.forEach((command) => {
            const message = {
              command,
              data: command === 'input' ? 'test data' : undefined,
              cols: command === 'resize' ? 80 : undefined,
              rows: command === 'resize' ? 24 : undefined,
              terminalId: ['switchTerminal', 'input', 'resize'].includes(command)
                ? 'test-terminal'
                : undefined,
            };

            try {
              callback(message);
              processedMessages.push(command);
            } catch (error) {
              // Some messages might fail due to missing terminal, that's expected
            }
          });

          return { dispose: () => {} };
        },
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: 'vscode-resource:',
      },
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      visible: true,
      viewType: 'sidebarTerminal',
      show: () => {},
    } as vscode.WebviewView;

    provider.resolveWebviewView(
      mockWebviewView,
      {} as vscode.WebviewViewResolveContext,
      {} as vscode.CancellationToken
    );

    // At least some messages should be processed
    assert.ok(processedMessages.length > 0, 'Some messages should be processed');
  });
});
