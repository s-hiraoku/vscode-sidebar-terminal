import * as vscode from 'vscode';
import { ExtensionLifecycle } from './core/ExtensionLifecycle';

// シングルトンインスタンス
const lifecycle = new ExtensionLifecycle();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await lifecycle.activate(context);
}

export function deactivate(): void {
  lifecycle.deactivate();
}
