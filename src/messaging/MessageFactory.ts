/**
 * 統一されたメッセージファクトリー
 *
 * Extension ↔ WebView 間の通信メッセージを一貫性をもって作成します。
 * 重複していたメッセージ構築パターンを統一します。
 */

import { WebviewMessage, VsCodeMessage, TerminalInstance, TerminalState } from '../types/common';
import { TerminalConfig } from '../types/shared';

/**
 * メッセージ作成のベースインターフェース
 */
interface BaseMessageData {
  terminalId?: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * 統一されたメッセージファクトリー
 */
export class MessageFactory {
  /**
   * 基本的なターミナルメッセージを作成
   */
  static createTerminalMessage<T extends BaseMessageData>(
    command: WebviewMessage['command'] | VsCodeMessage['command'],
    terminalId?: string,
    additionalData: T = {} as T
  ): WebviewMessage & T {
    return {
      command,
      terminalId,
      timestamp: Date.now(),
      ...additionalData,
    } as WebviewMessage & T;
  }

  // === WebView → Extension メッセージ ===

  /**
   * ターミナル作成要求メッセージ
   */
  static createTerminalCreationRequest(): VsCodeMessage {
    return this.createTerminalMessage('createTerminal') as VsCodeMessage;
  }

  /**
   * ターミナル削除要求メッセージ
   */
  static createTerminalDeletionRequest(
    terminalId: string,
    requestSource: 'header' | 'panel' = 'panel'
  ): VsCodeMessage {
    return this.createTerminalMessage('deleteTerminal', terminalId, {
      requestSource,
    }) as VsCodeMessage;
  }

  /**
   * ターミナル入力メッセージ
   */
  static createTerminalInputMessage(terminalId: string, data: string): VsCodeMessage {
    return this.createTerminalMessage('input', terminalId, { data }) as VsCodeMessage;
  }

  /**
   * ターミナルリサイズメッセージ
   */
  static createTerminalResizeMessage(
    terminalId: string,
    cols: number,
    rows: number
  ): VsCodeMessage {
    return this.createTerminalMessage('resize', terminalId, { cols, rows }) as VsCodeMessage;
  }

  /**
   * フォーカス要求メッセージ
   */
  static createTerminalFocusMessage(terminalId: string): VsCodeMessage {
    return this.createTerminalMessage('focusTerminal', terminalId) as VsCodeMessage;
  }

  /**
   * 設定要求メッセージ
   */
  static createSettingsRequest(): VsCodeMessage {
    return this.createTerminalMessage('getSettings') as VsCodeMessage;
  }

  /**
   * Scrollback データ要求メッセージ
   */
  static createScrollbackDataRequest(
    terminalId: string,
    scrollbackLines?: number,
    maxLines?: number
  ): VsCodeMessage {
    return this.createTerminalMessage('getScrollbackData', terminalId, {
      scrollbackLines,
      maxLines,
    }) as VsCodeMessage;
  }

  /**
   * エラー報告メッセージ
   */
  static createErrorReport(
    context: string,
    message: string,
    stack?: string,
    terminalId?: string
  ): VsCodeMessage {
    return this.createTerminalMessage('error', terminalId, {
      context,
      message,
      stack,
    }) as VsCodeMessage;
  }

  // === Extension → WebView メッセージ ===

  /**
   * ターミナル作成完了メッセージ
   */
  static createTerminalCreatedMessage(
    terminal: TerminalInstance,
    config: TerminalConfig
  ): WebviewMessage {
    return this.createTerminalMessage('terminalCreated', terminal.id, {
      terminalName: terminal.name,
      terminalInfo: {
        originalId: terminal.id,
        name: terminal.name,
        number: terminal.number,
        cwd: terminal.cwd || process.cwd(),
        isActive: terminal.isActive,
      },
      config,
    });
  }

  /**
   * ターミナル削除完了メッセージ
   */
  static createTerminalRemovedMessage(terminalId: string): WebviewMessage {
    return this.createTerminalMessage('terminalRemoved', terminalId);
  }

  /**
   * ターミナル出力メッセージ
   */
  static createTerminalOutputMessage(terminalId: string, data: string): WebviewMessage {
    return this.createTerminalMessage('output', terminalId, { data });
  }

  /**
   * ターミナル状態更新メッセージ
   */
  static createStateUpdateMessage(state: TerminalState, activeTerminalId?: string): WebviewMessage {
    return this.createTerminalMessage('stateUpdate', activeTerminalId, {
      state,
      activeTerminalId,
    });
  }

  /**
   * CLI Agent状態更新メッセージ
   */
  static createCliAgentStatusUpdate(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): WebviewMessage {
    return this.createTerminalMessage('cliAgentStatusUpdate', undefined, {
      cliAgentStatus: {
        activeTerminalName,
        status,
        agentType,
      },
    });
  }

  /**
   * CLI Agent完全状態同期メッセージ
   */
  static createCliAgentFullStateSync(
    terminalStates: Record<
      string,
      {
        status: 'connected' | 'disconnected' | 'none';
        agentType: string | null;
        terminalName: string;
      }
    >,
    connectedAgentId: string | null,
    connectedAgentType: string | null,
    disconnectedCount: number
  ): WebviewMessage {
    return this.createTerminalMessage('cliAgentFullStateSync', undefined, {
      terminalStates,
      connectedAgentId,
      connectedAgentType,
      disconnectedCount,
    });
  }

  /**
   * 設定応答メッセージ
   */
  static createSettingsResponse(settings: any, fontSettings?: any): WebviewMessage {
    return this.createTerminalMessage('settingsResponse', undefined, {
      settings,
      fontSettings,
    });
  }

  /**
   * Scrollback復元メッセージ
   */
  static createScrollbackRestoreMessage(
    terminalId: string,
    scrollbackContent:
      | Array<{
          content: string;
          type?: 'output' | 'input' | 'error';
          timestamp?: number;
        }>
      | string[]
  ): WebviewMessage {
    return this.createTerminalMessage('restoreScrollback', terminalId, {
      scrollbackContent,
    });
  }

  /**
   * セッション復元完了メッセージ
   */
  static createSessionRestoreCompleted(
    restoredCount: number,
    skippedCount: number = 0,
    partialSuccess: boolean = false
  ): WebviewMessage {
    return this.createTerminalMessage('sessionRestoreCompleted', undefined, {
      restoredCount,
      skippedCount,
      partialSuccess,
    });
  }

  /**
   * セッション復元エラーメッセージ
   */
  static createSessionRestoreError(
    error: string,
    errorType: string = 'unknown',
    recoveryAction?: string
  ): WebviewMessage {
    return this.createTerminalMessage('sessionRestoreError', undefined, {
      error,
      errorType,
      recoveryAction,
    });
  }

  /**
   * 汎用エラーメッセージ
   */
  static createErrorMessage(
    message: string,
    context?: string,
    terminalId?: string
  ): WebviewMessage {
    return this.createTerminalMessage('error', terminalId, {
      message,
      context,
    });
  }

  // === ユーティリティメソッド ===

  /**
   * メッセージにリクエストIDを追加
   */
  static addRequestId<T extends WebviewMessage | VsCodeMessage>(
    message: T,
    requestId: string
  ): T & { requestId: string } {
    return { ...message, requestId };
  }

  /**
   * メッセージのタイムスタンプを更新
   */
  static updateTimestamp<T extends WebviewMessage | VsCodeMessage>(message: T): T {
    return { ...message, timestamp: Date.now() };
  }

  /**
   * メッセージをクローンして変更
   */
  static cloneMessage<T extends WebviewMessage | VsCodeMessage>(
    message: T,
    modifications: Partial<T> = {}
  ): T {
    return { ...message, ...modifications };
  }
}
