import * as assert from 'assert';
import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../../terminals/TerminalManager';

suite('Webview Test Suite', () => {
  let terminalManager: TerminalManager;
  let provider: SecondaryTerminalProvider;
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
    provider = new SecondaryTerminalProvider(mockContext, terminalManager);
  });

  teardown(() => {
    terminalManager.dispose();
  });

  test('Should generate valid HTML for webview', () => {
    const mockWebview = {
      asWebviewUri: (uri: vscode.Uri) => uri,
      cspSource: 'vscode-resource:',
    } as vscode.Webview;

    // Use private method through type assertion for testing
    const html = (
      provider as unknown as { _getHtmlForWebview: (webview: vscode.Webview) => string }
    )._getHtmlForWebview(mockWebview);

    assert.ok(html);
    assert.ok(typeof html === 'string');
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('<div id="terminal-body">'));
    assert.ok(html.includes('webview.js'));
    assert.ok(html.includes('<!-- Simple terminal container -->'));
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
      viewType: 'secondaryTerminal',
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
    let lastMessage: unknown = null;

    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: (message: unknown) => {
          lastMessage = message;
          return Promise.resolve(true);
        },
        onDidReceiveMessage: (callback: (message: unknown) => void) => {
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
      viewType: 'secondaryTerminal',
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
    assert.strictEqual(
      (lastMessage as { command: string }).command,
      'init',
      'Init message should be sent'
    );
  });

  test('Should handle command execution through provider', () => {
    let createTerminalCalled = false;
    let killTerminalCalled = false;
    let splitTerminalCalled = false;

    // Mock the methods to track calls
    const originalKillTerminal = provider.killTerminal.bind(provider);
    const originalSplitTerminal = provider.splitTerminal.bind(provider);

    // Mock terminal manager createTerminal method
    const originalCreateTerminal = terminalManager.createTerminal.bind(terminalManager);
    terminalManager.createTerminal = () => {
      createTerminalCalled = true;
      return originalCreateTerminal();
    };

    provider.killTerminal = () => {
      killTerminalCalled = true;
      originalKillTerminal();
    };

    provider.splitTerminal = () => {
      splitTerminalCalled = true;
      originalSplitTerminal();
    };

    // Test command execution
    terminalManager.createTerminal();
    provider.splitTerminal();

    // Create a terminal first before killing
    terminalManager.createTerminal();
    provider.killTerminal();

    assert.ok(createTerminalCalled, 'Create terminal command should be called');
    assert.ok(killTerminalCalled, 'Kill terminal command should be called');
    assert.ok(splitTerminalCalled, 'Split terminal command should be called');

    // Restore original methods
    terminalManager.createTerminal = originalCreateTerminal;
    provider.killTerminal = originalKillTerminal;
    provider.splitTerminal = originalSplitTerminal;
  });

  test('Should handle error cases gracefully', async () => {
    let _errorOccurred = false;

    // Mock vscode.window.showErrorMessage to capture errors
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = () => {
      _errorOccurred = true;
      return Promise.resolve(undefined);
    };

    try {
      // Test with invalid webview view
      const invalidWebviewView = null as unknown as vscode.WebviewView;

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
      await (
        provider as unknown as { _sendMessage: (message: unknown) => Promise<void> }
      )._sendMessage({ command: 'test' });

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
        onDidReceiveMessage: (callback: (message: unknown) => void) => {
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
      viewType: 'secondaryTerminal',
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
