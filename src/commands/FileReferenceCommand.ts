import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { extension as log } from '../utils/logger';

/**
 * ファイル参照コマンドのハンドラー
 * CMD+OPT+L で現在のファイルパスを CLI Agent に送信する
 */
export class FileReferenceCommand {
  constructor(private terminalManager: TerminalManager) {}

  /**
   * @filename 送信処理（CLI Agent連携）
   */
  handleSendAtMention(): void {
    try {
      log('🚀 [DEBUG] handleSendAtMention called with CLI Agent integration');

      // CLI Agent統合機能が有効かチェック
      if (!this.isCliAgentIntegrationEnabled()) {
        log('🔧 [DEBUG] CLI Agent integration is disabled by user setting');
        void vscode.window.showInformationMessage(
          'File reference shortcuts are disabled. Enable them in Terminal Settings.'
        );
        return;
      }

      // アクティブエディタの確認
      const fileInfo = this.getActiveFileBaseName();
      if (!fileInfo) {
        log('⚠️ [WARN] No active editor found for @mention');
        void vscode.window.showWarningMessage(
          'No active file to mention. Please open a file first.'
        );
        return;
      }

      // ターミナル環境の確認
      const terminalEnv = this.validateTerminalEnvironment();
      if (!terminalEnv) {
        return;
      }

      // CONNECTED状態の全CLI Agentに送信
      const connectedAgents = this.getConnectedAgents();
      if (connectedAgents.length === 0) {
        void vscode.window.showWarningMessage(
          'No active CLI Agent found. Please ensure a CLI Agent is running.'
        );
        return;
      }

      // ファイル参照を送信
      const text = `@${fileInfo.relativePath} `;
      connectedAgents.forEach((agent) => {
        this.terminalManager.sendInput(text, agent.terminalId);
      });

      // 成功メッセージ
      const agentTypes = connectedAgents.map((a) => a.agentType).join(', ');
      const message =
        connectedAgents.length === 1
          ? `✅ Sent file reference to ${agentTypes}`
          : `✅ Sent file reference to ${connectedAgents.length} CLI Agents (${agentTypes})`;

      void vscode.window.showInformationMessage(message);
      log(
        `✅ [DEBUG] Successfully sent @${fileInfo.relativePath} to ${connectedAgents.length} agents`
      );
    } catch (error) {
      log('❌ [ERROR] Error in handleSendAtMention:', error);
      void vscode.window.showErrorMessage(`Failed to send @mention: ${String(error)}`);
    }
  }

  /**
   * アクティブエディタからファイルのベース名を取得
   */
  private getActiveFileBaseName(): {
    baseName: string;
    fullPath: string;
    relativePath: string;
  } | null {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return null;
    }

    const fullPath = activeEditor.document.fileName;
    const baseName = fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath;

    // ワークスペースルートからの相対パスを計算
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let relativePath = fullPath;

    if (workspaceFolder) {
      const workspaceRoot = workspaceFolder.uri.fsPath;
      if (fullPath.startsWith(workspaceRoot)) {
        // ワークスペースルートからの相対パスを取得
        relativePath = fullPath.substring(workspaceRoot.length);
        // 先頭のスラッシュを削除
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          relativePath = relativePath.substring(1);
        }
      }
    }

    return { baseName, fullPath, relativePath };
  }

  /**
   * CLI Agent統合機能が有効かチェック
   */
  private isCliAgentIntegrationEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return config.get<boolean>('enableCliAgentIntegration', true);
  }

  /**
   * ターミナルマネージャーとアクティブターミナルの確認
   */
  private validateTerminalEnvironment(): { activeTerminalId: string } | null {
    if (!this.terminalManager.hasActiveTerminal()) {
      log('⚠️ [WARN] No active sidebar terminal');
      void vscode.window.showWarningMessage(
        'No sidebar terminal available. Please open the sidebar terminal first.'
      );
      return null;
    }

    const activeTerminalId = this.terminalManager.getActiveTerminalId();
    if (!activeTerminalId) {
      log('❌ [ERROR] Active terminal ID is null');
      return null;
    }

    return { activeTerminalId };
  }

  /**
   * CONNECTED状態の全CLI Agentを取得
   */
  private getConnectedAgents(): Array<{ terminalId: string; agentType: string }> {
    const connectedAgents = this.terminalManager.getConnectedAgents();
    log(`🔍 [DEBUG] Found ${connectedAgents.length} connected CLI agents`);

    return connectedAgents.map((agent) => ({
      terminalId: agent.terminalId,
      agentType: agent.agentInfo.type,
    }));
  }
}
