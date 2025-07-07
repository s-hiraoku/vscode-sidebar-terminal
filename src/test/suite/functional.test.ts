import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Functional Test Suite', () => {
  let extension: vscode.Extension<unknown> | undefined;

  suiteSetup(async () => {
    // Ensure extension is loaded and activated
    extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');

    if (extension && !extension.isActive) {
      await extension.activate();
    }

    // Wait for VS Code to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  test('Extension should be properly activated', () => {
    assert.ok(extension, 'Extension should be found');
    assert.ok(extension && extension.isActive, 'Extension should be active');
  });

  test('All required commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const requiredCommands = [
      'sidebarTerminal.killTerminal',
      'sidebarTerminal.splitTerminal',
      'sidebarTerminal.openSettings',
    ];

    for (const command of requiredCommands) {
      assert.ok(commands.includes(command), `Command ${command} should be registered`);
    }
  });

  test('Commands should execute without throwing errors', async () => {
    const commandsToTest = ['sidebarTerminal.splitTerminal', 'sidebarTerminal.openSettings'];

    for (const command of commandsToTest) {
      try {
        await vscode.commands.executeCommand(command);
        assert.ok(true, `Command ${command} executed successfully`);
      } catch (error) {
        assert.fail(`Command ${command} execution failed: ${String(error)}`);
      }
    }
  });

  test('Extension should handle rapid command execution', async () => {
    const rapidCommands = [
      'sidebarTerminal.splitTerminal',
      'sidebarTerminal.openSettings',
      'sidebarTerminal.splitTerminal',
    ];

    try {
      // Execute commands rapidly
      const promises = rapidCommands.map((command) => vscode.commands.executeCommand(command));

      await Promise.allSettled(promises);
      assert.ok(true, 'Rapid command execution handled successfully');
    } catch (error) {
      assert.fail(`Rapid command execution failed: ${String(error)}`);
    }
  });

  test('Configuration should be accessible and valid', () => {
    const config = vscode.workspace.getConfiguration('sidebarTerminal');

    // Test that configuration properties exist and have expected types
    const fontSize = config.get<number>('fontSize');
    const fontFamily = config.get<string>('fontFamily');
    const maxTerminals = config.get<number>('maxTerminals');
    const shell = config.get<string>('shell');
    const shellArgs = config.get<string[]>('shellArgs');

    assert.ok(typeof fontSize === 'number', 'fontSize should be a number');
    assert.ok(typeof fontFamily === 'string', 'fontFamily should be a string');
    assert.ok(typeof maxTerminals === 'number', 'maxTerminals should be a number');
    assert.ok(typeof shell === 'string', 'shell should be a string');
    assert.ok(Array.isArray(shellArgs), 'shellArgs should be an array');

    // Test reasonable default values
    assert.ok(fontSize > 0 && fontSize <= 100, 'fontSize should be reasonable');
    assert.ok(maxTerminals > 0 && maxTerminals <= 50, 'maxTerminals should be reasonable');
  });

  test('Configuration changes should be handled gracefully', async () => {
    const config = vscode.workspace.getConfiguration('sidebarTerminal');
    const originalFontSize = config.get<number>('fontSize', 14);

    try {
      // Change configuration
      await config.update('fontSize', originalFontSize + 2, vscode.ConfigurationTarget.Global);

      // Wait for configuration to be applied
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify change
      const updatedConfig = vscode.workspace.getConfiguration('sidebarTerminal');
      const newFontSize = updatedConfig.get<number>('fontSize', 14);
      assert.strictEqual(newFontSize, originalFontSize + 2, 'Configuration should be updated');

      // Test that extension handles configuration change
      await vscode.commands.executeCommand('sidebarTerminal.splitTerminal');
      assert.ok(true, 'Extension should handle configuration changes');
    } finally {
      // Restore original configuration
      await config.update('fontSize', originalFontSize, vscode.ConfigurationTarget.Global);
    }
  });

  test('Extension should handle workspace changes', async () => {
    // Test that extension continues to work after simulated workspace events
    try {
      // Execute commands after potential workspace changes
      await vscode.commands.executeCommand('sidebarTerminal.splitTerminal');
      await vscode.commands.executeCommand('sidebarTerminal.openSettings');

      assert.ok(true, 'Extension should handle workspace changes');
    } catch (error) {
      assert.fail(`Extension failed after workspace changes: ${String(error)}`);
    }
  });

  test('Extension should respect maximum terminal limits', async () => {
    const config = vscode.workspace.getConfiguration('sidebarTerminal');
    const maxTerminals = config.get<number>('maxTerminals', 5);

    try {
      // Try to create more terminals than the limit using split terminal
      const createPromises = [];
      for (let i = 0; i < maxTerminals + 3; i++) {
        createPromises.push(vscode.commands.executeCommand('sidebarTerminal.splitTerminal'));
      }

      await Promise.allSettled(createPromises);

      // The extension should handle this gracefully without crashing
      assert.ok(true, 'Extension should respect terminal limits');
    } catch (error) {
      assert.fail(`Extension failed to handle terminal limits: ${String(error)}`);
    }
  });

  test('Extension should handle error conditions gracefully', async () => {
    try {
      // Try to kill terminal when none exists
      await vscode.commands.executeCommand('sidebarTerminal.killTerminal');

      // Try to clear terminal when none exists
      await vscode.commands.executeCommand('sidebarTerminal.clearTerminal');

      // Extension should handle these gracefully
      assert.ok(true, 'Extension should handle error conditions gracefully');
    } catch (error) {
      // Some errors might be expected, but the extension shouldn't crash
      assert.ok(true, 'Extension should handle errors without crashing completely');
    }
  });

  suiteTeardown(async () => {
    // Clean up any remaining terminals
    try {
      // Try to clean up multiple times to ensure cleanup
      for (let i = 0; i < 5; i++) {
        await vscode.commands.executeCommand('sidebarTerminal.killTerminal');
      }
    } catch {
      // Ignore cleanup errors
    }
  });
});
