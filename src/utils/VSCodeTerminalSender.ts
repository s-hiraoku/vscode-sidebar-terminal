import * as vscode from 'vscode';
import { extension as log } from './logger';

/**
 * VS Code標準ターミナルへのテキスト送信を管理するユーティリティ
 * 注意: このクラスは静的メソッドのみを提供するユーティリティクラスです
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class VSCodeTerminalSender {
  /**
   * 指定されたターミナルIDのターミナルにテキストを送信
   */
  public static sendToTerminal(terminalId: string, text: string): boolean {
    try {
      const terminals = vscode.window.terminals;
      const targetTerminal = terminals.find(
        (terminal) => this.getTerminalId(terminal) === terminalId
      );

      if (!targetTerminal) {
        log(`⚠️ [TERMINAL-SENDER] Terminal not found: ${terminalId}`);
        return false;
      }

      // ターミナルにテキストを送信
      targetTerminal.sendText(text);

      // ターミナルを表示（フォーカス）
      targetTerminal.show();

      log(`✅ [TERMINAL-SENDER] Sent text to terminal ${terminalId}: ${text}`);
      return true;
    } catch (error) {
      log(`❌ [TERMINAL-SENDER] Error sending to terminal ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * アクティブなエディタから @filename 文字列を生成してターミナルに送信
   */
  public static sendFileReferenceToTerminal(terminalId: string): boolean {
    try {
      const activeEditor = vscode.window.activeTextEditor;

      if (!activeEditor) {
        log('⚠️ [TERMINAL-SENDER] No active editor found for file reference');
        return false;
      }

      const fileName = activeEditor.document.fileName;
      const baseName = fileName.split('/').pop() || fileName.split('\\').pop() || fileName;
      const text = `@${baseName} `;

      log(`🔧 [TERMINAL-SENDER] Generated file reference: ${text}`);
      return this.sendToTerminal(terminalId, text);
    } catch (error) {
      log(`❌ [TERMINAL-SENDER] Error generating file reference:`, error);
      return false;
    }
  }

  /**
   * アクティブなターミナルにテキストを送信（フォールバック用）
   */
  public static sendToActiveTerminal(text: string): boolean {
    try {
      const activeTerminal = vscode.window.activeTerminal;

      if (!activeTerminal) {
        log('⚠️ [TERMINAL-SENDER] No active terminal found');
        return false;
      }

      activeTerminal.sendText(text);
      activeTerminal.show();

      log(`✅ [TERMINAL-SENDER] Sent to active terminal: ${text}`);
      return true;
    } catch (error) {
      log(`❌ [TERMINAL-SENDER] Error sending to active terminal:`, error);
      return false;
    }
  }

  /**
   * 利用可能な全ターミナルの情報を取得（デバッグ用）
   */
  public static async getTerminalInfo(): Promise<
    Array<{ id: string; name: string; processId: number | undefined }>
  > {
    const terminals = vscode.window.terminals;
    const terminalInfos: Array<{ id: string; name: string; processId: number | undefined }> = [];

    for (const terminal of terminals) {
      terminalInfos.push({
        id: this.getTerminalId(terminal),
        name: terminal.name,
        processId: await terminal.processId,
      });
    }

    return terminalInfos;
  }

  /**
   * ターミナルの一意IDを取得（ClaudeTerminalTrackerと同じロジック）
   */
  private static getTerminalId(terminal: vscode.Terminal): string {
    const terminals = vscode.window.terminals;
    const index = terminals.indexOf(terminal);
    return `terminal-${index}-${terminal.name}`;
  }

  /**
   * 指定されたターミナルIDが存在するかチェック
   */
  public static isTerminalExists(terminalId: string): boolean {
    const terminals = vscode.window.terminals;
    return terminals.some((terminal) => this.getTerminalId(terminal) === terminalId);
  }

  /**
   * Claude Connected ターミナルを検索
   */
  public static findClaudeConnectedTerminal(): vscode.Terminal | undefined {
    const terminals = vscode.window.terminals;
    return terminals.find((terminal) => terminal.name.includes('○ IDE connected'));
  }
}
