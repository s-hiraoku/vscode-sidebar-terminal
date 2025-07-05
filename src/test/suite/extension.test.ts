import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('your-publisher-name.vscode-sidebar-terminal'));
  });

  test('Should register commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    
    assert.ok(commands.includes('sidebarTerminal.createTerminal'));
    assert.ok(commands.includes('sidebarTerminal.clearTerminal'));
    assert.ok(commands.includes('sidebarTerminal.killTerminal'));
    assert.ok(commands.includes('sidebarTerminal.splitTerminal'));
  });

  test('Should activate extension', async () => {
    const extension = vscode.extensions.getExtension('your-publisher-name.vscode-sidebar-terminal');
    assert.ok(extension);
    
    if (!extension!.isActive) {
      await extension!.activate();
    }
    
    assert.ok(extension!.isActive);
  });
});