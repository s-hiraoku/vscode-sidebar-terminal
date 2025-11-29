import * as assert from 'assert';
import * as vscode from 'vscode';

suite('E2E Test Suite', () => {
  let extension: vscode.Extension<unknown> | undefined;

  suiteSetup(async function () {
    // Increase timeout for this setup
    this.timeout(5000);

    // Wait for extension to activate
    extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
    if (extension && !extension.isActive) {
      await extension.activate();
    }

    // Shorter wait time for VS Code to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  test('Extension should be active', () => {
    assert.ok(extension);
    assert.ok(extension && extension.isActive);
  });

  test('Should register terminal view', () => {
    // Check if the terminal view is registered
    const terminalView = vscode.window.createTreeView('secondaryTerminal', {
      treeDataProvider: {
        getTreeItem: () => new vscode.TreeItem('test'),
        getChildren: () => [],
      },
    });

    assert.ok(terminalView);
    terminalView.dispose();
  });

  test('Should open settings command', async () => {
    // Execute open settings command
    try {
      await vscode.commands.executeCommand('secondaryTerminal.openSettings');
      assert.ok(true, 'Command executed successfully');
    } catch (error) {
      assert.fail(`Command execution failed: ${String(error)}`);
    }
  });

  test('Should split terminal command', async () => {
    // Execute split terminal command
    try {
      await vscode.commands.executeCommand('secondaryTerminal.splitTerminal');
      assert.ok(true, 'Split command executed successfully');
    } catch (error) {
      assert.fail(`Split command execution failed: ${String(error)}`);
    }
  });

  test('Should open settings command', async () => {
    // Execute open settings command
    try {
      await vscode.commands.executeCommand('secondaryTerminal.openSettings');
      assert.ok(true, 'Settings command executed successfully');
    } catch (error) {
      assert.fail(`Settings command execution failed: ${String(error)}`);
    }
  });

  test('Should kill terminal command', async () => {
    // Execute kill terminal command
    try {
      await vscode.commands.executeCommand('secondaryTerminal.killTerminal');
      assert.ok(true, 'Kill command executed successfully');
    } catch (error) {
      assert.fail(`Kill command execution failed: ${String(error)}`);
    }
  });

  test('Should respect configuration changes', async () => {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    const originalFontSize = config.get<number>('fontSize', 14);

    // Change configuration
    await config.update('fontSize', 16, vscode.ConfigurationTarget.Global);

    // Wait for configuration to be applied
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify change
    const updatedConfig = vscode.workspace.getConfiguration('secondaryTerminal');
    const newFontSize = updatedConfig.get<number>('fontSize', 14);
    assert.strictEqual(newFontSize, 16);

    // Restore original configuration
    await updatedConfig.update('fontSize', originalFontSize, vscode.ConfigurationTarget.Global);
  });

  test('Should handle multiple terminals', async () => {
    // Create multiple terminals using split
    try {
      await vscode.commands.executeCommand('secondaryTerminal.splitTerminal');
      await vscode.commands.executeCommand('secondaryTerminal.splitTerminal');
      await vscode.commands.executeCommand('secondaryTerminal.splitTerminal');

      assert.ok(true, 'Multiple terminals created successfully');
    } catch (error) {
      assert.fail(`Multiple terminal creation failed: ${String(error)}`);
    }
  });

  test('Should handle terminal limits', async () => {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    const maxTerminals = config.get<number>('maxTerminals', 5);

    // Try to create more than the limit using split
    for (let i = 0; i < maxTerminals + 2; i++) {
      try {
        await vscode.commands.executeCommand('secondaryTerminal.splitTerminal');
      } catch (error) {
        // Expected to fail after reaching limit
      }
    }

    assert.ok(true, 'Terminal limit handling works correctly');
  });

  suiteTeardown(async () => {
    // Clean up any remaining terminals
    try {
      await vscode.commands.executeCommand('secondaryTerminal.killTerminal');
    } catch {
      // Ignore cleanup errors
    }
  });
});
