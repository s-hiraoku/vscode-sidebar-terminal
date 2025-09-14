import {
  UnifiedTerminalPersistenceService,
  PersistenceError,
} from '../services/UnifiedTerminalPersistenceService';
import { extension as log } from '../utils/logger';

/**
 * ターミナル永続化メッセージハンドラ
 * Extension側でWebViewからの永続化リクエストを処理
 */
export interface PersistenceMessage {
  command: 'saveSession' | 'restoreSession' | 'clearSession';
  data?: any;
  terminalId?: string; // Changed from number to string to match WebviewMessage
}

export interface PersistenceResponse {
  success: boolean;
  data?: any;
  error?: string;
  terminalCount?: number;
}

/**
 * PersistenceMessageHandler interface for dependency injection
 */
export interface IPersistenceMessageHandler {
  handleMessage(message: PersistenceMessage): Promise<PersistenceResponse>;
  createWebViewMessage(command: string, data: any, success?: boolean): any;
  createErrorResponse(command: string, error: string): any;
  createSuccessResponse(command: string, data: any): any;
  registerMessageHandlers(): void;
  handlePersistenceMessage(message: any): Promise<any>;
}

/**
 * Factory function to create PersistenceMessageHandler instance
 */
export function createPersistenceMessageHandler(
  persistenceService: UnifiedTerminalPersistenceService
): IPersistenceMessageHandler {
  return new PersistenceMessageHandler(persistenceService);
}

export class PersistenceMessageHandler {
  constructor(private readonly persistenceService: UnifiedTerminalPersistenceService) {
    log('🔧 [MSG-HANDLER] PersistenceMessageHandler initialized');
  }

  /**
   * 永続化メッセージ処理のメインエントリーポイント
   */
  async handleMessage(message: PersistenceMessage): Promise<PersistenceResponse> {
    try {
      log(`📨 [MSG-HANDLER] Processing message: ${message.command}`);

      switch (message.command) {
        case 'saveSession':
          return await this.handleSaveSession(message.data);

        case 'restoreSession':
          return await this.handleRestoreSession();

        case 'clearSession':
          return await this.handleClearSession();

        default:
          return {
            success: false,
            error: `Unknown persistence command: ${message.command}`,
          };
      }
    } catch (error) {
      log(`❌ [MSG-HANDLER] Message handling failed: ${error}`);
      return {
        success: false,
        error: `Message handling failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * セッション保存処理
   */
  private async handleSaveSession(terminalData: any): Promise<PersistenceResponse> {
    try {
      if (!terminalData || !Array.isArray(terminalData)) {
        return {
          success: false,
          error: 'Invalid terminal data for save operation',
        };
      }

      await this.persistenceService.saveSession(terminalData);

      log(`✅ [MSG-HANDLER] Session saved successfully: ${terminalData.length} terminals`);
      return {
        success: true,
        terminalCount: terminalData.length,
        data: 'Session saved successfully',
      };
    } catch (error) {
      const errorMsg =
        error instanceof PersistenceError
          ? error.message
          : `Save operation failed: ${(error as Error).message}`;

      log(`❌ [MSG-HANDLER] Save failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * セッション復元処理
   */
  private async handleRestoreSession(): Promise<PersistenceResponse> {
    try {
      const restoredTerminals = await this.persistenceService.restoreSession();

      if (restoredTerminals.length === 0) {
        log('📦 [MSG-HANDLER] No session to restore');
        return {
          success: true,
          terminalCount: 0,
          data: [],
          error: 'No session found to restore',
        };
      }

      log(`✅ [MSG-HANDLER] Session restored successfully: ${restoredTerminals.length} terminals`);
      return {
        success: true,
        terminalCount: restoredTerminals.length,
        data: restoredTerminals,
      };
    } catch (error) {
      const errorMsg =
        error instanceof PersistenceError
          ? error.message
          : `Restore operation failed: ${(error as Error).message}`;

      log(`❌ [MSG-HANDLER] Restore failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * セッションクリア処理
   */
  private async handleClearSession(): Promise<PersistenceResponse> {
    try {
      await this.persistenceService.cleanupExpiredSessions();

      log('✅ [MSG-HANDLER] Session cleared successfully');
      return {
        success: true,
        data: 'Session cleared successfully',
      };
    } catch (error) {
      const errorMsg = `Clear operation failed: ${(error as Error).message}`;
      log(`❌ [MSG-HANDLER] Clear failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * WebView向けメッセージ作成ヘルパー
   */
  createWebViewMessage(command: string, data: any, success: boolean = true): any {
    return {
      command: `persistence${command.charAt(0).toUpperCase() + command.slice(1)}Response`,
      data,
      success,
      timestamp: Date.now(),
    };
  }

  /**
   * エラーレスポンス作成ヘルパー
   */
  createErrorResponse(command: string, error: string): any {
    return this.createWebViewMessage(command, { error }, false);
  }

  /**
   * 成功レスポンス作成ヘルパー
   */
  createSuccessResponse(command: string, data: any): any {
    return this.createWebViewMessage(command, data, true);
  }

  /**
   * メッセージハンドラー登録（compatibility method）
   */
  registerMessageHandlers(): void {
    // Implementation for compatibility with interface
    log('🔧 [MSG-HANDLER] Message handlers registered');
  }

  /**
   * 永続化メッセージ処理（compatibility method）
   */
  async handlePersistenceMessage(message: any): Promise<any> {
    // Delegate to handleMessage for compatibility
    return await this.handleMessage(message as PersistenceMessage);
  }
}
