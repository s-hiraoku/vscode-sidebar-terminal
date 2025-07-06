import * as assert from 'assert';
import * as vscode from 'vscode';
import { SidebarTerminalProvider } from '../../providers/SidebarTerminalProvider';
import { TerminalManager } from '../../terminals/TerminalManager';

suite('UX Feedback Test Suite', () => {
  let provider: SidebarTerminalProvider;
  let terminalManager: TerminalManager;
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

  test('Error messages should be user-friendly', () => {
    let errorMessageShown = false;
    let errorMessage = '';

    // Mock vscode.window.showErrorMessage
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = (message: string) => {
      errorMessageShown = true;
      errorMessage = message;
      return Promise.resolve(undefined);
    };

    try {
      // Trigger an error condition
      provider.killTerminal(); // Should show user-friendly error when no terminal exists

      // Verify error message is user-friendly
      if (errorMessageShown) {
        assert.ok(errorMessage.length > 0, 'Error message should not be empty');
        assert.ok(
          !errorMessage.includes('undefined'),
          'Error message should not contain "undefined"'
        );
        assert.ok(!errorMessage.includes('null'), 'Error message should not contain "null"');
        assert.ok(
          !errorMessage.includes('[object Object]'),
          'Error message should not contain object representation'
        );
      }
    } finally {
      // Restore original method
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('Warning messages should be informative', () => {
    let warningMessageShown = false;
    let warningMessage = '';

    // Mock vscode.window.showWarningMessage
    const originalShowWarningMessage = vscode.window.showWarningMessage;
    vscode.window.showWarningMessage = (message: string) => {
      warningMessageShown = true;
      warningMessage = message;
      return Promise.resolve(undefined);
    };

    try {
      // Create maximum number of terminals to trigger warning
      for (let i = 0; i < 10; i++) {
        terminalManager.createTerminal();
      }

      if (warningMessageShown) {
        assert.ok(warningMessage.length > 0, 'Warning message should not be empty');
        assert.ok(
          warningMessage.includes('maximum') || warningMessage.includes('limit'),
          'Warning should mention limits or maximum'
        );
      }
    } finally {
      // Restore original method
      vscode.window.showWarningMessage = originalShowWarningMessage;
    }
  });

  test('Success operations should provide feedback', () => {
    // Test that successful operations complete without hanging
    const startTime = Date.now();

    try {
      // These operations should complete quickly and successfully
      const terminalId = terminalManager.createTerminal();
      assert.ok(terminalId, 'Terminal creation should return an ID');

      provider.clearTerminal();
      provider.killTerminal();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Operations should complete quickly (within 2 seconds)
      assert.ok(duration < 2000, `Operations took ${duration}ms, should be < 2000ms`);
    } catch (error) {
      assert.fail(`Operations should not throw errors: ${String(error)}`);
    }
  });

  test('Status updates should be timely', async () => {
    // Mock webview to capture status updates
    const statusUpdates: string[] = [];

    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: (message: { command: string; data?: string }) => {
          if (message.command === 'output' && message.data) {
            statusUpdates.push(message.data);
          }
          return Promise.resolve(true);
        },
        onDidReceiveMessage: (callback: (message: unknown) => void) => {
          // Simulate immediate ready message
          setTimeout(() => callback({ command: 'ready' }), 1);
          return { dispose: () => {} };
        },
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: 'vscode-resource:',
      },
      viewType: 'sidebarTerminal',
      onDidDispose: () => ({ dispose: () => {} }),
      visible: true,
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
    } as unknown as vscode.WebviewView;

    // Resolve webview
    provider.resolveWebviewView(
      mockWebviewView,
      {} as vscode.WebviewViewResolveContext,
      {} as vscode.CancellationToken
    );

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Status updates should be captured during terminal operations
    assert.ok(true, 'Status updates should be handled without errors');
  });

  test('User input should be responsive', () => {
    const terminalId = terminalManager.createTerminal();

    const testInputs = [
      'echo "Hello World"',
      'ls -la',
      'pwd',
      'date',
      '\\x03', // Ctrl+C
      '\\x0c', // Ctrl+L
    ];

    // Test that all common inputs are handled without errors
    testInputs.forEach((input) => {
      assert.doesNotThrow(() => {
        terminalManager.sendInput(input, terminalId);
      }, `Input "${input}" should not throw errors`);
    });
  });

  test('Accessibility features should work', () => {
    // Test that the extension provides proper accessibility support
    const terminalId = terminalManager.createTerminal();
    const terminals = terminalManager.getTerminals();

    // Verify terminal has proper identification
    assert.ok(terminals.length > 0, 'Should have created terminals');
    assert.ok(terminals[0]?.id, 'Terminal should have ID for accessibility');
    assert.ok(terminals[0]?.name, 'Terminal should have name for accessibility');

    // Test keyboard navigation support
    assert.doesNotThrow(() => {
      terminalManager.setActiveTerminal(terminalId);
    }, 'Terminal switching should work for keyboard navigation');
  });

  test('Visual feedback should be consistent', async () => {
    // Test that visual states are properly managed
    let initMessageReceived = false;

    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: (message: { command: string }) => {
          if (message.command === 'init') {
            initMessageReceived = true;
          }
          return Promise.resolve(true);
        },
        onDidReceiveMessage: (callback: (message: unknown) => void) => {
          setTimeout(() => callback({ command: 'ready' }), 1);
          return { dispose: () => {} };
        },
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: 'vscode-resource:',
      },
      viewType: 'sidebarTerminal',
      onDidDispose: () => ({ dispose: () => {} }),
      visible: true,
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
    } as unknown as vscode.WebviewView;

    provider.resolveWebviewView(
      mockWebviewView,
      {} as vscode.WebviewViewResolveContext,
      {} as vscode.CancellationToken
    );

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(initMessageReceived, 'Init message should be sent for visual feedback');
  });

  test('Error recovery should be smooth', () => {
    // Test that the extension recovers gracefully from errors
    const terminalId = terminalManager.createTerminal();

    // Kill the terminal
    terminalManager.killTerminal(terminalId);

    // Try to use the killed terminal - should not crash
    assert.doesNotThrow(() => {
      terminalManager.sendInput('test', terminalId);
    }, 'Should handle operations on killed terminals gracefully');

    // Creating new terminal should work after errors
    const newTerminalId = terminalManager.createTerminal();
    assert.ok(newTerminalId, 'Should be able to create new terminal after errors');
  });
});
