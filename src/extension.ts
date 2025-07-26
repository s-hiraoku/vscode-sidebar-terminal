import * as vscode from 'vscode';
import { ExtensionLifecycle } from './core/ExtensionLifecycle';

console.log('🚀 [EXTENSION.TS] === EXTENSION MODULE LOADED ===');

// シングルトンインスタンス
const lifecycle = new ExtensionLifecycle();
console.log('🚀 [EXTENSION.TS] ExtensionLifecycle instance created');

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('🚀 [EXTENSION.TS] === ACTIVATE FUNCTION CALLED ===');
  console.log('🚀 [EXTENSION.TS] Extension ID:', context.extension.id);
  console.log('🚀 [EXTENSION.TS] Extension mode:', context.extensionMode);
  console.log('🚀 [EXTENSION.TS] Calling lifecycle.activate()...');
  
  try {
    await lifecycle.activate(context);
    console.log('🚀 [EXTENSION.TS] === ACTIVATE COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    console.error('🚀 [EXTENSION.TS] === ACTIVATE FAILED ===', error);
    throw error;
  }
}

export function deactivate(): void {
  console.log('🚀 [EXTENSION.TS] === DEACTIVATE FUNCTION CALLED ===');
  lifecycle.deactivate();
  console.log('🚀 [EXTENSION.TS] === DEACTIVATE COMPLETED ===');
}
