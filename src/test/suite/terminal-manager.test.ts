import * as assert from 'assert';
import * as vscode from 'vscode';
import { TerminalManager } from '../../terminals/TerminalManager';

suite('TerminalManager Test Suite', () => {
  let terminalManager: TerminalManager;
  let _mockContext: vscode.ExtensionContext;

  setup(() => {
    _mockContext = {
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

    terminalManager = new TerminalManager();
  });

  teardown(() => {
    terminalManager.dispose();
  });

  test('Should create terminal manager', () => {
    assert.ok(terminalManager);
    assert.strictEqual(terminalManager.hasActiveTerminal(), false);
  });

  test('Should create terminal', () => {
    const terminalId = terminalManager.createTerminal();
    assert.ok(terminalId);
    assert.strictEqual(terminalManager.hasActiveTerminal(), true);
    assert.strictEqual(terminalManager.getActiveTerminalId(), terminalId);
  });

  test('Should manage multiple terminals', () => {
    const terminal1 = terminalManager.createTerminal();
    const terminal2 = terminalManager.createTerminal();

    assert.notStrictEqual(terminal1, terminal2);
    assert.strictEqual(terminalManager.getTerminals().length, 2);
    assert.strictEqual(terminalManager.getActiveTerminalId(), terminal2);
  });

  test('Should switch active terminal', () => {
    const terminal1 = terminalManager.createTerminal();
    const terminal2 = terminalManager.createTerminal();

    assert.strictEqual(terminalManager.getActiveTerminalId(), terminal2);

    terminalManager.setActiveTerminal(terminal1);
    assert.strictEqual(terminalManager.getActiveTerminalId(), terminal1);
  });

  test('Should limit maximum terminals', () => {
    // Create maximum number of terminals (default is 5)
    const terminals: string[] = [];
    for (let i = 0; i < 5; i++) {
      terminals.push(terminalManager.createTerminal());
    }

    assert.strictEqual(terminalManager.getTerminals().length, 5);

    // Try to create one more (should not create)
    const extraTerminal = terminalManager.createTerminal();
    assert.strictEqual(terminalManager.getTerminals().length, 5);
    assert.strictEqual(extraTerminal, terminals[4]); // Should return the last created terminal ID
  });

  test('Should remove terminal', () => {
    const _terminal1 = terminalManager.createTerminal();
    const _terminal2 = terminalManager.createTerminal();

    assert.strictEqual(terminalManager.getTerminals().length, 2);

    // killTerminal should kill the active terminal (terminal2)
    const activeTerminalId = terminalManager.getActiveTerminalId();
    terminalManager.killTerminal(activeTerminalId || '');
    assert.strictEqual(terminalManager.getTerminals().length, 1);

    // The remaining terminal should be the other one
    const remainingTerminals = terminalManager.getTerminals();
    assert.strictEqual(remainingTerminals.length, 1);
  });

  test('Should handle terminal events', (done) => {
    let terminalCreatedCalled = false;

    terminalManager.onTerminalCreated((terminal) => {
      terminalCreatedCalled = true;
      assert.ok(terminal.id);
      assert.ok(terminal.name);
      assert.strictEqual(terminal.isActive, true);

      if (terminalCreatedCalled) {
        done();
      }
    });

    terminalManager.createTerminal();
  });
});
