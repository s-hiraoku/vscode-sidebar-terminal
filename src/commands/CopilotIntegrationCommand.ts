import * as vscode from 'vscode';
import * as path from 'path';
import { extension as log } from '../utils/logger';
import { VSCODE_COMMANDS } from '../constants';

/**
 * GitHub Copilot連携コマンドのハンドラー
 * CMD+K CMD+C でGitHub Copilot Chatをアクティブ化し、#file:形式でファイル参照を送信する
 */
export class CopilotIntegrationCommand {
  /**
   * GitHub Copilot Chatをアクティブ化してファイル参照を送信する
   */
  handleActivateCopilot(): void {
    try {
      log('🚀 [DEBUG] handleActivateCopilot called');

      // GitHub Copilot統合機能が有効かチェック
      if (!this.isGitHubCopilotIntegrationEnabled()) {
        log('🔧 [DEBUG] GitHub Copilot integration is disabled by user setting');
        void vscode.window.showInformationMessage(
          'GitHub Copilot integration is disabled. Enable it in Terminal Settings.'
        );
        return;
      }

      // アクティブエディタの確認
      const fileInfo = this.getActiveFileInfo();
      if (!fileInfo) {
        log('⚠️ [DEBUG] No active editor found, activating Copilot without file reference');
        // ファイルが開いていなくてもCopilot Chatをアクティブ化
        void this.activateCopilotChat();
        return;
      }

      // GitHub Copilot Chatをアクティブ化してファイル参照を送信
      void this.activateCopilotChatWithFileReference(fileInfo);

      log('✅ [DEBUG] Successfully activated GitHub Copilot Chat with file reference');
    } catch (error) {
      log('❌ [ERROR] Error in handleActivateCopilot:', error);
      void vscode.window.showErrorMessage(
        `Failed to activate GitHub Copilot Chat: ${String(error)}`
      );
    }
  }

  /**
   * GitHub Copilot Chatをアクティブ化する
   */
  private async activateCopilotChat(): Promise<void> {
    await vscode.commands.executeCommand(VSCODE_COMMANDS.CHAT_OPEN);
  }

  /**
   * GitHub Copilot Chatをアクティブ化してファイル参照を送信
   */
  private async activateCopilotChatWithFileReference(fileInfo: {
    relativePath: string;
    selection?: {
      startLine: number;
      endLine: number;
      hasSelection: boolean;
    };
  }): Promise<void> {
    await this.sendFileReferenceToCopilot(fileInfo);
  }

  /**
   * Copilot Chatにファイル参照を送信
   */
  private async sendFileReferenceToCopilot(fileInfo: {
    relativePath: string;
    selection?: {
      startLine: number;
      endLine: number;
      hasSelection: boolean;
    };
  }): Promise<void> {
    const fileReference = this.formatCopilotFileReference(fileInfo);
    log(`📤 [DEBUG] Sending file reference to Copilot: "${fileReference}"`);

    await vscode.commands.executeCommand(VSCODE_COMMANDS.CHAT_OPEN, {
      query: fileReference,
      isPartialQuery: true,
    });
  }

  /**
   * アクティブエディタからファイル情報と選択範囲を取得
   */
  private getActiveFileInfo(): {
    relativePath: string;
    selection?: {
      startLine: number;
      endLine: number;
      hasSelection: boolean;
    };
  } | null {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return null;
    }

    const fullPath = activeEditor.document.fileName;

    // ワークスペースルートからの相対パスを計算
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let relativePath = fullPath;

    if (workspaceFolder) {
      const workspaceRoot = workspaceFolder.uri.fsPath;
      if (fullPath.startsWith(workspaceRoot)) {
        // クロスプラットフォーム対応の相対パス計算
        relativePath = path.relative(workspaceRoot, fullPath);
        // パス区切り文字を正規化（Windowsの場合）
        relativePath = relativePath.replace(/\\/g, '/');
      }
    }

    // 選択範囲の情報を取得
    const selection = activeEditor.selection;
    let selectionInfo = undefined;

    if (!selection.isEmpty) {
      // 選択がある場合の行番号を取得（1ベースに変換）
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      selectionInfo = {
        startLine,
        endLine,
        hasSelection: true,
      };

      log(`🔍 [DEBUG] Selection detected for Copilot: L${startLine}-L${endLine}`);
    }

    return { relativePath, selection: selectionInfo };
  }

  /**
   * Copilot用のファイル参照文字列をフォーマット
   * VS CodeのCopilot Chatでは特定の形式でファイル参照を生成する必要がある
   */
  private formatCopilotFileReference(fileInfo: {
    relativePath: string;
    selection?: {
      startLine: number;
      endLine: number;
      hasSelection: boolean;
    };
  }): string {
    // シンプルな #file: 形式（Copilotの正確な仕様を調査中）
    const fullReference = `#file:${fileInfo.relativePath}`;

    // デバッグ用：ファイル参照情報をログ出力
    log(`🔍 [DEBUG] Creating file reference: ${fullReference}`);

    // 選択範囲がある場合のログ出力
    if (fileInfo.selection?.hasSelection) {
      const { startLine, endLine } = fileInfo.selection;
      log(`🔍 [DEBUG] File selection detected: lines ${startLine}-${endLine}`);

      // 将来的な拡張: 選択範囲の情報も含める可能性
      // return `${fullReference} (lines ${startLine}-${endLine}) `;
    }

    return `${fullReference}  `;
  }

  /**
   * GitHub Copilot連携機能が有効かチェック
   */
  private isGitHubCopilotIntegrationEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return config.get<boolean>('enableGitHubCopilotIntegration', true);
  }
}
