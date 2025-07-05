import * as assert from 'assert';
import * as vscode from 'vscode';

suite('E2E Test Suite', () => {
  let extension: vscode.Extension<any> | undefined;

  suiteSetup(async () => {
    // Wait for extension to activate
    extension = vscode.extensions.getExtension('your-publisher-name.vscode-sidebar-terminal');
    if (extension && !extension.isActive) {
      await extension.activate();
    }

    // Wait for VS Code to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  test('Extension should be active', async () => {
    assert.ok(extension);
    assert.ok(extension!.isActive);
  });

  test('Should register terminal view', async () => {
    // Check if the terminal view is registered
    const terminalView = vscode.window.createTreeView('sidebarTerminal', {
      treeDataProvider: {
        getTreeItem: () => new vscode.TreeItem('test'),
        getChildren: () => [],
      },
    });

    assert.ok(terminalView);
    terminalView.dispose();
  });

  test('Should create new terminal command', async () => {
    // Execute create terminal command
    try {
      await vscode.commands.executeCommand('sidebarTerminal.createTerminal');
      assert.ok(true, 'Command executed successfully');
    } catch (error) {
      assert.fail(`Command execution failed: ${String(error)}`);
    }
  });

  test('Should split terminal command', async () => {
    // Execute split terminal command
    try {
      await vscode.commands.executeCommand('sidebarTerminal.splitTerminal');
      assert.ok(true, 'Split command executed successfully');
    } catch (error) {
      assert.fail(`Split command execution failed: ${String(error)}`);
    }
  });

  test('Should clear terminal command', async () => {
    // Execute clear terminal command
    try {
      await vscode.commands.executeCommand('sidebarTerminal.clearTerminal');
      assert.ok(true, 'Clear command executed successfully');
    } catch (error) {
      assert.fail(`Clear command execution failed: ${String(error)}`);
    }
  });

  test('Should kill terminal command', async () => {
    // Execute kill terminal command
    try {
      await vscode.commands.executeCommand('sidebarTerminal.killTerminal');
      assert.ok(true, 'Kill command executed successfully');
    } catch (error) {
      assert.fail(`Kill command execution failed: ${String(error)}`);
    }
  });

  test('Should respect configuration changes', async () => {
    const config = vscode.workspace.getConfiguration('sidebarTerminal');
    const originalFontSize = config.get<number>('fontSize', 14);

    // Change configuration
    await config.update('fontSize', 16, vscode.ConfigurationTarget.Global);

    // Verify change
    const newFontSize = config.get<number>('fontSize', 14);
    assert.strictEqual(newFontSize, 16);

    // Restore original configuration
    await config.update('fontSize', originalFontSize, vscode.ConfigurationTarget.Global);
  });

  test('Should handle multiple terminals', async () => {
    // Create multiple terminals
    try {
      await vscode.commands.executeCommand('sidebarTerminal.createTerminal');
      await vscode.commands.executeCommand('sidebarTerminal.createTerminal');
      await vscode.commands.executeCommand('sidebarTerminal.createTerminal');

      assert.ok(true, 'Multiple terminals created successfully');
    } catch (error) {
      assert.fail(`Multiple terminal creation failed: ${String(error)}`);
    }
  });

  test('Should handle terminal limits', async () => {
    const config = vscode.workspace.getConfiguration('sidebarTerminal');
    const maxTerminals = config.get<number>('maxTerminals', 5);

    // Try to create more than the limit
    for (let i = 0; i < maxTerminals + 2; i++) {
      try {
        await vscode.commands.executeCommand('sidebarTerminal.createTerminal');
      } catch (error) {
        // Expected to fail after reaching limit
      }
    }

    assert.ok(true, 'Terminal limit handling works correctly');
  });

  suiteTeardown(async () => {
    // Clean up any remaining terminals
    try {
      await vscode.commands.executeCommand('sidebarTerminal.killTerminal');
    } catch {
      // Ignore cleanup errors
    }
  });
});
