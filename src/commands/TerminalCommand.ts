import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { extension as log } from '../utils/logger';

/**
 * ターミナル関連のコマンドハンドラー
 * テキスト送信、コマンド実行などの基本操作を提供
 */
export class TerminalCommand {
  constructor(private readonly terminalManager: TerminalManager) {}

  /**
   * アクティブなターミナルにコンテンツを送信
   */
  handleSendToTerminal(content?: string): void {
    log('🚀 [DEBUG] handleSendToTerminal called');

    try {
      if (!this.terminalManager.hasActiveTerminal()) {
        void vscode.window.showWarningMessage(
          'No active sidebar terminal. Please open the sidebar terminal first.'
        );
        return;
      }

      const activeTerminalId = this.terminalManager.getActiveTerminalId();
      if (!activeTerminalId) {
        log('❌ [ERROR] Active terminal ID is null');
        return;
      }

      if (content) {
        // コマンドから直接呼ばれた場合（コマンドパレットなど）
        this.terminalManager.sendInput(content, activeTerminalId);
        log(`✅ [DEBUG] Sent content to terminal: ${content}`);
      } else {
        // ユーザーに入力を求める
        void vscode.window
          .showInputBox({
            placeHolder: 'Enter text to send to terminal',
            prompt: 'Text will be sent to the active sidebar terminal',
          })
          .then((input) => {
            if (input) {
              this.terminalManager.sendInput(input, activeTerminalId);
              log(`✅ [DEBUG] Sent user input to terminal: ${input}`);
            }
          });
      }
    } catch (error) {
      log('❌ [ERROR] Error in handleSendToTerminal:', error);
      void vscode.window.showErrorMessage(`Failed to send to terminal: ${String(error)}`);
    }
  }
}
