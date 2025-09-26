import * as vscode from 'vscode';
import { ExtensionLifecycle } from './core/ExtensionLifecycle';

// シングルトンインスタンス
const lifecycle = new ExtensionLifecycle();

export function activate(context: vscode.ExtensionContext): Promise<void> {
  return lifecycle.activate(context);
}

export function deactivate(): void {
  lifecycle.deactivate();
}
