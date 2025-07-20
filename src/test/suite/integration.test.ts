import * as assert from 'assert';
import * as vscode from 'vscode';
import { TerminalManager } from '../../terminals/TerminalManager';
import { SecondaryTerminalProvider } from '../../providers/SecondaryTerminalProvider';

suite('Integration Test Suite', () => {
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

  test('Should integrate TerminalManager with Provider', () => {
    assert.ok(terminalManager);
    assert.ok(provider);

    // Test provider methods
    assert.ok(typeof provider.killTerminal === 'function');
    assert.ok(typeof provider.splitTerminal === 'function');
    assert.ok(typeof provider.openSettings === 'function');
  });

  test('Should handle terminal events through provider', (done) => {
    let eventReceived = false;

    terminalManager.onTerminalCreated((terminal) => {
      eventReceived = true;
      assert.ok(terminal.id);
      assert.ok(terminal.name);

      if (eventReceived) {
        done();
      }
    });

    // Create terminal through terminal manager
    terminalManager.createTerminal();
  });

  test('Should manage terminal lifecycle', () => {
    // Create terminal
    const terminalId = terminalManager.createTerminal();
    assert.ok(terminalId);
    assert.strictEqual(terminalManager.hasActiveTerminal(), true);

    // Split terminal
    provider.splitTerminal();
    assert.strictEqual(terminalManager.getTerminals().length, 2);

    // Kill terminal
    provider.killTerminal();
    assert.strictEqual(terminalManager.getTerminals().length, 1);
  });

  test('Should handle configuration changes', () => {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');

    // Test that provider respects configuration
    assert.ok(config.get('fontSize'));
    assert.ok(config.get('fontFamily'));
    assert.ok(config.get('maxTerminals'));
  });

  test('Should handle terminal data flow', (done) => {
    let dataReceived = false;

    terminalManager.onData((event) => {
      dataReceived = true;
      assert.ok(event.terminalId);
      assert.ok(event.data);

      if (dataReceived) {
        done();
      }
    });

    // Create terminal and simulate data
    const terminalId = terminalManager.createTerminal();

    // Simulate data event (this would normally come from PTY)
    setTimeout(() => {
      terminalManager.sendInput('test\n', terminalId);
    }, 100);
  });

  test('Should handle terminal exit gracefully', (done) => {
    // This test verifies that the terminal manager properly handles terminal removal
    // Since exit events only fire for natural exits (not manual kills), we test the removal process instead

    const terminalCountBefore = terminalManager.getTerminals().length;
    const _terminalId = terminalManager.createTerminal();

    // Verify terminal was created
    assert.strictEqual(terminalManager.getTerminals().length, terminalCountBefore + 1);

    // Test graceful removal
    setTimeout(() => {
      try {
        const activeTerminalId = terminalManager.getActiveTerminalId();
        if (activeTerminalId) {
          terminalManager.killTerminal(activeTerminalId);

          // Verify terminal was removed gracefully
          const terminalCountAfter = terminalManager.getTerminals().length;
          assert.strictEqual(terminalCountAfter, terminalCountBefore);
          done();
        } else {
          done(new Error('No active terminal found'));
        }
      } catch (error) {
        done(error);
      }
    }, 100);
  });

  test('Should maintain terminal state consistency', () => {
    // Create multiple terminals
    const terminal1 = terminalManager.createTerminal();
    const _terminal2 = terminalManager.createTerminal();
    const terminal3 = terminalManager.createTerminal();

    // Verify state
    assert.strictEqual(terminalManager.getTerminals().length, 3);
    assert.strictEqual(terminalManager.getActiveTerminalId(), terminal3);

    // Switch active terminal
    terminalManager.setActiveTerminal(terminal1);
    assert.strictEqual(terminalManager.getActiveTerminalId(), terminal1);

    // Remove active terminal (terminal1) - killTerminal always removes active terminal
    const activeTerminalId = terminalManager.getActiveTerminalId();
    terminalManager.killTerminal(activeTerminalId || '');
    assert.strictEqual(terminalManager.getTerminals().length, 2);

    // Verify that a terminal is still active (should switch to another terminal)
    const newActiveId = terminalManager.getActiveTerminalId();
    assert.ok(newActiveId);
    assert.notStrictEqual(newActiveId, terminal1); // Should be different from the killed terminal
  });

  test('Should handle provider WebView lifecycle', () => {
    // Test that provider can handle WebView lifecycle
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

    // Test resolveWebviewView
    assert.doesNotThrow(() => {
      provider.resolveWebviewView(
        mockWebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );
    });
  });
});
