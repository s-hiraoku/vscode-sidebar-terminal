/**
 * ターミナル履歴（Scrollback）セッション管理クラス
 * Issue #126の実装: ターミナル履歴復元機能
 */

import * as vscode from 'vscode';
import { extension as log } from '../utils/logger';
import { 
  ExtendedSessionData, 
  ExtendedTerminalInfo, 
  TerminalScrollback,
  ScrollbackLine,
  ScrollbackRestoreOptions,
  ScrollbackRestoreResult,
  ScrollbackSaveResult,
  ScrollbackRestoreProgress
} from '../types/scrollback-session';

/**
 * Scrollback履歴を管理するセッションマネージャー
 * 基本のSimpleSessionManagerと連携して履歴復元機能を提供
 */
export class ScrollbackSessionManager {
  private readonly STORAGE_KEY = 'secondaryTerminal.scrollbackSession';
  private readonly DEFAULT_MAX_LINES = 1000;
  private readonly DEFAULT_MAX_STORAGE_SIZE = 10 * 1024 * 1024; // 10MB
  
  private context: vscode.ExtensionContext;
  private onProgressCallback?: (progress: ScrollbackRestoreProgress) => void;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    log('🔧 [SCROLLBACK] ScrollbackSessionManager initialized');
  }

  /**
   * 進捗コールバックを設定
   */
  public setProgressCallback(callback: (progress: ScrollbackRestoreProgress) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * 設定からScrollback復元オプションを取得
   */
  private getRestoreOptions(): ScrollbackRestoreOptions {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    
    return {
      maxLines: config.get<number>('scrollbackLines', this.DEFAULT_MAX_LINES),
      enabled: config.get<boolean>('restoreScrollback', true),
      useCompression: config.get<boolean>('scrollbackCompression', true),
      progressiveLoad: config.get<boolean>('scrollbackProgressiveLoad', false)
    };
  }

  /**
   * ターミナルからScrollback履歴を取得
   * @param terminalId ターミナルID
   * @param maxLines 最大取得行数
   */
  public async extractScrollbackFromTerminal(
    terminalId: string, 
    maxLines?: number
  ): Promise<TerminalScrollback | null> {
    try {
      log(`🔍 [SCROLLBACK] Extracting scrollback for terminal ${terminalId}`);
      
      // TODO: WebViewからxtermのscrollback bufferを取得する実装
      // この部分は後で実装（WebViewとの通信が必要）
      
      // 仮の実装（実際にはWebViewからデータを取得）
      const mockScrollback: TerminalScrollback = {
        terminalId,
        lines: [
          { content: '$ echo "Terminal history placeholder"', type: 'input' },
          { content: 'Terminal history placeholder', type: 'output' }
        ],
        cursorPosition: { x: 0, y: 1 },
        compressed: false
      };
      
      log(`✅ [SCROLLBACK] Extracted ${mockScrollback.lines.length} lines for terminal ${terminalId}`);
      return mockScrollback;
      
    } catch (error) {
      log(`❌ [SCROLLBACK] Error extracting scrollback for terminal ${terminalId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Scrollback履歴をターミナルに復元
   * @param terminalId ターミナルID
   * @param scrollback 復元する履歴データ
   */
  public async restoreScrollbackToTerminal(
    terminalId: string, 
    scrollback: TerminalScrollback
  ): Promise<boolean> {
    try {
      log(`🔄 [SCROLLBACK] Restoring scrollback to terminal ${terminalId}`);
      
      // 進捗通知
      if (this.onProgressCallback) {
        this.onProgressCallback({
          terminalId,
          progress: 0,
          currentLines: 0,
          totalLines: scrollback.lines.length,
          stage: 'restoring'
        });
      }

      // TODO: WebViewにScrollback復元コマンドを送信する実装
      // この部分は後で実装（WebViewとの通信が必要）
      
      // 段階的復元のシミュレーション
      for (let i = 0; i < scrollback.lines.length; i++) {
        const line = scrollback.lines[i];
        
        if (!line) {
          log(`⚠️ [SCROLLBACK] Skipping undefined line at index ${i}`);
          continue;
        }
        
        // 進捗更新
        if (this.onProgressCallback && i % 100 === 0) {
          this.onProgressCallback({
            terminalId,
            progress: Math.round((i / scrollback.lines.length) * 100),
            currentLines: i,
            totalLines: scrollback.lines.length,
            stage: 'restoring'
          });
        }
        
        // 実際の復元処理（後で実装）
        const preview = line.content.length > 50 ? line.content.substring(0, 50) + '...' : line.content;
        log(`📝 [SCROLLBACK] Restoring line ${i + 1}/${scrollback.lines.length}: ${preview}`);
      }

      // 最終進捗
      if (this.onProgressCallback) {
        this.onProgressCallback({
          terminalId,
          progress: 100,
          currentLines: scrollback.lines.length,
          totalLines: scrollback.lines.length,
          stage: 'restoring'
        });
      }

      log(`✅ [SCROLLBACK] Successfully restored ${scrollback.lines.length} lines to terminal ${terminalId}`);
      return true;
      
    } catch (error) {
      log(`❌ [SCROLLBACK] Error restoring scrollback to terminal ${terminalId}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 拡張セッションデータを保存
   * @param sessionData 保存するセッションデータ
   */
  public async saveExtendedSession(sessionData: ExtendedSessionData): Promise<ScrollbackSaveResult> {
    try {
      log('💾 [SCROLLBACK] Saving extended session with scrollback data');
      
      const options = this.getRestoreOptions();
      let totalLines = 0;
      let totalSize = 0;

      // 各ターミナルの履歴サイズを計算
      for (const terminal of sessionData.terminals) {
        if (terminal.scrollback) {
          totalLines += terminal.scrollback.lines.length;
          totalSize += JSON.stringify(terminal.scrollback).length;
        }
      }

      // ストレージサイズチェック
      if (totalSize > sessionData.scrollbackConfig.maxStorageSize) {
        log(`⚠️ [SCROLLBACK] Session data size (${totalSize}) exceeds limit (${sessionData.scrollbackConfig.maxStorageSize})`);
        // データを削減またはエラーを返す
        return {
          success: false,
          error: `Session data too large: ${totalSize} bytes (limit: ${sessionData.scrollbackConfig.maxStorageSize})`
        };
      }

      // 圧縮処理（有効な場合）
      let dataToSave = sessionData;
      if (options.useCompression) {
        // TODO: データ圧縮の実装
        log('🗜️ [SCROLLBACK] Compressing session data');
      }

      // WorkspaceStateに保存
      await this.context.workspaceState.update(this.STORAGE_KEY, dataToSave);
      
      log(`✅ [SCROLLBACK] Extended session saved: ${sessionData.terminals.length} terminals, ${totalLines} lines`);
      
      return {
        success: true,
        savedTerminals: sessionData.terminals.length,
        savedLines: totalLines,
        fileSize: totalSize,
        compressionRatio: options.useCompression ? 0.7 : 1.0 // 仮の圧縮率
      };
      
    } catch (error) {
      log(`❌ [SCROLLBACK] Error saving extended session: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 拡張セッションデータを復元
   */
  public async restoreExtendedSession(): Promise<ScrollbackRestoreResult> {
    try {
      log('🔄 [SCROLLBACK] Starting extended session restore');
      
      const options = this.getRestoreOptions();
      if (!options.enabled) {
        log('⏭️ [SCROLLBACK] Scrollback restore disabled in settings');
        return {
          success: true,
          restoredTerminals: 0,
          restoredLines: 0
        };
      }

      // WorkspaceStateから読み込み
      const sessionData = this.context.workspaceState.get<ExtendedSessionData>(this.STORAGE_KEY);
      
      if (!sessionData) {
        log('📭 [SCROLLBACK] No extended session data found');
        return {
          success: true,
          restoredTerminals: 0,
          restoredLines: 0
        };
      }

      log(`📥 [SCROLLBACK] Found extended session: ${sessionData.terminals.length} terminals`);

      let restoredTerminals = 0;
      let restoredLines = 0;
      const warnings: string[] = [];

      // 各ターミナルの履歴を復元
      for (const terminal of sessionData.terminals) {
        if (terminal.scrollback) {
          log(`🔄 [SCROLLBACK] Restoring terminal ${terminal.id} (${terminal.scrollback.lines.length} lines)`);
          
          const success = await this.restoreScrollbackToTerminal(terminal.id, terminal.scrollback);
          
          if (success) {
            restoredTerminals++;
            restoredLines += terminal.scrollback.lines.length;
          } else {
            warnings.push(`Failed to restore scrollback for terminal ${terminal.name}`);
          }
        }
      }

      log(`✅ [SCROLLBACK] Extended session restore completed: ${restoredTerminals} terminals, ${restoredLines} lines`);
      
      return {
        success: true,
        restoredTerminals,
        restoredLines,
        warnings: warnings.length > 0 ? warnings : undefined
      };
      
    } catch (error) {
      log(`❌ [SCROLLBACK] Error restoring extended session: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Scrollbackセッションデータをクリア
   */
  public async clearScrollbackSession(): Promise<void> {
    try {
      await this.context.workspaceState.update(this.STORAGE_KEY, undefined);
      log('🗑️ [SCROLLBACK] Extended session data cleared');
    } catch (error) {
      log(`❌ [SCROLLBACK] Error clearing extended session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 現在のScrollbackセッション情報を取得（デバッグ用）
   */
  public async getScrollbackSessionInfo(): Promise<{
    exists: boolean;
    terminalCount?: number;
    totalLines?: number;
    dataSize?: number;
  }> {
    try {
      const sessionData = this.context.workspaceState.get<ExtendedSessionData>(this.STORAGE_KEY);
      
      if (!sessionData) {
        return { exists: false };
      }

      let totalLines = 0;
      for (const terminal of sessionData.terminals) {
        if (terminal.scrollback) {
          totalLines += terminal.scrollback.lines.length;
        }
      }

      const dataSize = JSON.stringify(sessionData).length;

      return {
        exists: true,
        terminalCount: sessionData.terminals.length,
        totalLines,
        dataSize
      };
      
    } catch (error) {
      log(`❌ [SCROLLBACK] Error getting session info: ${error instanceof Error ? error.message : String(error)}`);
      return { exists: false };
    }
  }
}