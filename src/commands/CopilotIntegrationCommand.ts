import * as vscode from 'vscode';
import { extension as log } from '../utils/logger';

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
        this.activateCopilotChat();
        return;
      }

      // GitHub Copilot Chatをアクティブ化してファイル参照を送信
      this.activateCopilotChatWithFileReference(fileInfo);

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
    try {
      // 第一候補: workbench.action.chat.open
      await vscode.commands.executeCommand('workbench.action.chat.open');
      log('📤 [DEBUG] Executed workbench.action.chat.open command');
    } catch (primaryError) {
      log('⚠️ [WARN] Primary command failed, trying fallback:', primaryError);

      try {
        // 代替案: Copilot Chatパネルにフォーカス
        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
        log('📤 [DEBUG] Executed workbench.panel.chat.view.copilot.focus command');
      } catch (fallbackError) {
        log('❌ [ERROR] Both activation methods failed:', fallbackError);

        // エラー時の案内
        void vscode.window.showWarningMessage(
          'Could not activate GitHub Copilot Chat. Please ensure GitHub Copilot Chat extension is installed and enabled.',
          'Open Command Palette'
        ).then((selection) => {
          if (selection === 'Open Command Palette') {
            void vscode.commands.executeCommand('workbench.action.showCommands');
          }
        });

        throw new Error('Failed to activate GitHub Copilot Chat');
      }
    }
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
    try {
      // ファイル参照を直接Copilot Chatに送信（方法1が成功する可能性が高い）
      log('🚀 [DEBUG] Attempting direct file reference insertion');
      await this.sendFileReferenceToCopilot(fileInfo);
      
      // 成功した場合は処理終了
      log('✅ [DEBUG] File reference successfully inserted into Copilot Chat');
    } catch (error) {
      log('❌ [ERROR] Error sending file reference to Copilot:', error);
      
      // フォールバック: 従来の方法（Copilot Chatを開いてからクリップボード）
      try {
        await this.activateCopilotChat();
        const fileReference = this.formatCopilotFileReference(fileInfo);
        await vscode.env.clipboard.writeText(fileReference);
        
        void vscode.window.showInformationMessage(
          `Copilot Chat opened. File reference copied to clipboard: ${fileReference}`,
          'Paste (Cmd+V)'
        );
      } catch (fallbackError) {
        log('❌ [ERROR] Fallback method also failed:', fallbackError);
        throw error;
      }
    }
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
    try {
      const fileReference = this.formatCopilotFileReference(fileInfo);
      log(`📤 [DEBUG] Attempting to send file reference to Copilot: "${fileReference}"`);

      // 複数の方法を試す
      
      // 方法1: workbench.action.chat.openでクエリパラメータを使用
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open', {
          query: fileReference,
          isPartialQuery: true
        });
        log('✅ [DEBUG] File reference sent using chat.open with query');
        return;
      } catch (e1) {
        log('⚠️ [DEBUG] chat.open with query failed:', e1);
      }

      // 方法2: 一般的なchat.insertTextコマンドを試す
      try {
        await vscode.commands.executeCommand('workbench.action.chat.insertText', { text: fileReference });
        log('✅ [DEBUG] File reference sent using insertText with object');
        return;
      } catch (e2) {
        log('⚠️ [DEBUG] insertText with object failed:', e2);
      }

      // 方法3: シンプルなテキスト引数で試す
      try {
        await vscode.commands.executeCommand('workbench.action.chat.insertText', fileReference);
        log('✅ [DEBUG] File reference sent using insertText with string');
        return;
      } catch (e3) {
        log('⚠️ [DEBUG] insertText with string failed:', e3);
      }

      // 方法4: Copilot Chatにフォーカスしてからtypeコマンドを実行
      try {
        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
        await new Promise(resolve => setTimeout(resolve, 300));
        await vscode.commands.executeCommand('type', { text: fileReference });
        log('✅ [DEBUG] File reference typed into focused chat');
        return;
      } catch (e4) {
        log('⚠️ [DEBUG] focus + type command failed:', e4);
      }

      // 方法5: workbench.action.chat.submitを試す
      try {
        await vscode.commands.executeCommand('workbench.action.chat.submit', fileReference);
        log('✅ [DEBUG] File reference submitted directly');
        return;
      } catch (e5) {
        log('⚠️ [DEBUG] chat.submit failed:', e5);
      }

      // すべて失敗した場合はクリップボードにコピー
      throw new Error('All insertion methods failed');
      
    } catch (error) {
      log('⚠️ [WARN] All methods to insert file reference failed, using clipboard:', error);
      
      // 最終手段：クリップボードにコピーしてユーザーに通知
      try {
        const fileReference = this.formatCopilotFileReference(fileInfo);
        await vscode.env.clipboard.writeText(fileReference);
        void vscode.window.showInformationMessage(
          `File reference ready: ${fileReference} (Press Cmd+V to paste)`,
          'OK'
        );
      } catch (clipboardError) {
        log('❌ [ERROR] Failed to copy to clipboard:', clipboardError);
        const fileReference = this.formatCopilotFileReference(fileInfo);
        void vscode.window.showWarningMessage(
          `Manual copy required: ${fileReference}`
        );
      }
    }
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
        // ワークスペースルートからの相対パスを取得
        relativePath = fullPath.substring(workspaceRoot.length);
        // 先頭のスラッシュを削除
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          relativePath = relativePath.substring(1);
        }
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
   * より高度なファイル参照作成 - VS Code内部APIを活用
   */
  private async createAdvancedFileReference(fileInfo: {
    relativePath: string;
    selection?: {
      startLine: number;
      endLine: number;
      hasSelection: boolean;
    };
  }): Promise<string> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return this.formatCopilotFileReference(fileInfo);
      }

      const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fileInfo.relativePath);
      
      // VS CodeのファイルシステムAPIを使ってファイル存在確認
      try {
        await vscode.workspace.fs.stat(fileUri);
        log(`✅ [DEBUG] File confirmed to exist: ${fileInfo.relativePath}`);
        
        // ファイルが存在する場合、シンプルな参照を作成
        const reference = `#file:${fileInfo.relativePath}`;
        
        log(`📤 [DEBUG] Advanced file reference: ${reference}`);
        
        return `${reference}  `;
      } catch (statError) {
        log(`⚠️ [WARN] File may not exist: ${fileInfo.relativePath}`, statError);
        return this.formatCopilotFileReference(fileInfo);
      }
    } catch (error) {
      log(`❌ [ERROR] Error creating advanced file reference:`, error);
      return this.formatCopilotFileReference(fileInfo);
    }
  }

  /**
   * GitHub Copilot連携機能が有効かチェック
   */
  private isGitHubCopilotIntegrationEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return config.get<boolean>('enableGitHubCopilotIntegration', true);
  }
}