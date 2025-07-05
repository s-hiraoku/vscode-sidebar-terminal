import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  void vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
    assert.ok(extension);
  });

  test('Should register commands', async () => {
    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes('sidebarTerminal.createTerminal'));
    assert.ok(commands.includes('sidebarTerminal.clearTerminal'));
    assert.ok(commands.includes('sidebarTerminal.killTerminal'));
    assert.ok(commands.includes('sidebarTerminal.splitTerminal'));
  });

  test('Should activate extension', async () => {
    const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
    assert.ok(extension);

    if (extension && !extension.isActive) {
      await extension.activate();
    }

    assert.ok(extension && extension.isActive);
  });
});
