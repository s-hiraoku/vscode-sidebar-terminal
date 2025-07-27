import * as assert from 'assert';
import * as vscode from 'vscode';
import { TerminalManager } from '../../terminals/TerminalManager';

suite('Performance Test Suite', () => {
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

    terminalManager = new TerminalManager();
  });

  teardown(() => {
    terminalManager.dispose();
  });

  test('Terminal creation should be fast', () => {
    const startTime = Date.now();

    // Create multiple terminals
    for (let i = 0; i < 3; i++) {
      terminalManager.createTerminal();
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Terminal creation should complete within 1 second
    assert.ok(duration < 1000, `Terminal creation took ${duration}ms, should be < 1000ms`);
  });

  test('Large data input should be handled efficiently', () => {
    const terminalId = terminalManager.createTerminal();
    const largeData = 'x'.repeat(10000); // 10KB of data

    const startTime = Date.now();

    // Send large data multiple times
    for (let i = 0; i < 10; i++) {
      terminalManager.sendInput(largeData, terminalId);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Large data handling should complete within 500ms
    assert.ok(duration < 500, `Large data handling took ${duration}ms, should be < 500ms`);
  });

  test('Memory usage should be reasonable', () => {
    const initialMemory = process.memoryUsage();

    // Create and destroy terminals multiple times
    for (let cycle = 0; cycle < 5; cycle++) {
      const terminals: string[] = [];

      // Create terminals
      for (let i = 0; i < 3; i++) {
        terminals.push(terminalManager.createTerminal());
      }

      // Use terminals (send some data)
      terminals.forEach((id) => {
        terminalManager.sendInput('echo "test"\n', id);
      });

      // Kill terminals
      terminals.forEach((id) => {
        terminalManager.killTerminal(id);
      });
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

    // Memory increase should be reasonable (less than 50MB)
    const maxMemoryIncrease = 50 * 1024 * 1024; // 50MB
    assert.ok(
      memoryIncrease < maxMemoryIncrease,
      `Memory increased by ${memoryIncrease / 1024 / 1024}MB, should be < 50MB`
    );
  });

  test('Terminal switching should be instant', () => {
    // Create multiple terminals
    const terminals: string[] = [];
    for (let i = 0; i < 4; i++) {
      terminals.push(terminalManager.createTerminal());
    }

    const startTime = Date.now();

    // Switch between terminals rapidly
    for (let i = 0; i < 100; i++) {
      const targetTerminal = terminals[i % terminals.length];
      if (targetTerminal) {
        terminalManager.setActiveTerminal(targetTerminal);
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Terminal switching should be very fast
    assert.ok(duration < 100, `Terminal switching took ${duration}ms, should be < 100ms`);
  });

  test('Concurrent operations should not degrade performance', async () => {
    const terminalId = terminalManager.createTerminal();

    const startTime = Date.now();

    // Perform concurrent operations
    const operations = [
      () => terminalManager.sendInput('ls\n', terminalId),
      () => terminalManager.resize(80, 24, terminalId),
      () => terminalManager.sendInput('pwd\n', terminalId),
      () => terminalManager.resize(100, 30, terminalId),
    ];

    // Execute operations concurrently
    const promises = [];
    for (let i = 0; i < 20; i++) {
      const operation = operations[i % operations.length];
      if (operation) {
        promises.push(Promise.resolve(operation()));
      }
    }

    await Promise.all(promises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Concurrent operations should complete quickly
    assert.ok(duration < 200, `Concurrent operations took ${duration}ms, should be < 200ms`);
  });

  test('Event handling should not cause memory leaks', () => {
    let eventCount = 0;
    const initialMemory = process.memoryUsage();

    // Add event listeners
    const disposables = [
      terminalManager.onData(() => eventCount++),
      terminalManager.onExit(() => eventCount++),
      terminalManager.onTerminalCreated(() => eventCount++),
      terminalManager.onTerminalRemoved(() => eventCount++),
    ];

    // Create and destroy terminals to trigger events
    for (let i = 0; i < 10; i++) {
      const terminalId = terminalManager.createTerminal();
      terminalManager.sendInput('echo test\n', terminalId);
      terminalManager.killTerminal(terminalId);
    }

    // Clean up event listeners
    disposables.forEach((d) => {
      if (d && typeof d.dispose === 'function') {
        d.dispose();
      }
    });

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

    // Memory increase should be minimal
    const maxMemoryIncrease = 10 * 1024 * 1024; // 10MB
    assert.ok(
      memoryIncrease < maxMemoryIncrease,
      `Event handling increased memory by ${memoryIncrease / 1024 / 1024}MB, should be < 10MB`
    );

    assert.ok(eventCount > 0, 'Events should have been triggered');
  });
});
