/**
 * 統一されたオペレーション結果処理ユーティリティ
 *
 * 重複していたエラーハンドリングパターンを統一し、
 * 一貫性のある成功/失敗処理を提供します。
 */

import { extension as log } from './logger';

export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  reason?: string;
  error?: Error;
}

export interface NotificationService {
  showSuccess(message: string): void;
  showError(message: string): void;
  showWarning(message: string): void;
}

/**
 * 統一されたオペレーション結果処理
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class OperationResultHandler {
  /**
   * Common result processing logic (private helper)
   */
  private static processResult<T>(
    result: OperationResult<T>,
    context: string,
    successMessage?: string,
    notificationService?: NotificationService
  ): T | null {
    if (result.success) {
      log(`✅ [${context}] Operation successful`);
      if (successMessage && notificationService) {
        notificationService.showSuccess(successMessage);
      }
      return result.data || null;
    } else {
      const reason = result.reason || 'Operation failed';
      log(`⚠️ [${context}] Operation failed: ${reason}`);
      if (notificationService) {
        notificationService.showError(reason);
      }
      return null;
    }
  }

  /**
   * Common error handling logic (private helper)
   */
  private static handleErrorInternal(
    error: unknown,
    context: string,
    notificationService?: NotificationService
  ): null {
    const errorMessage = `Operation error: ${String(error)}`;
    log(`❌ [${context}] ${errorMessage}`);
    if (notificationService) {
      notificationService.showError(errorMessage);
    }
    return null;
  }

  /**
   * Handle terminal operation result (async)
   */
  static async handleTerminalOperation<T>(
    operation: () => Promise<OperationResult<T>>,
    context: string,
    successMessage?: string,
    notificationService?: NotificationService
  ): Promise<T | null> {
    try {
      const result = await operation();
      return this.processResult(result, context, successMessage, notificationService);
    } catch (error) {
      return this.handleErrorInternal(error, context, notificationService);
    }
  }

  /**
   * Handle sync operation result
   */
  static handleSyncOperation<T>(
    operation: () => OperationResult<T>,
    context: string,
    successMessage?: string,
    notificationService?: NotificationService
  ): T | null {
    try {
      const result = operation();
      return this.processResult(result, context, successMessage, notificationService);
    } catch (error) {
      return this.handleErrorInternal(error, context, notificationService);
    }
  }

  /**
   * 複数オペレーションのバッチ処理
   */
  static async handleBatchOperations<T>(
    operations: Array<() => Promise<OperationResult<T>>>,
    context: string,
    notificationService?: NotificationService
  ): Promise<{
    successful: T[];
    failed: Array<{ index: number; reason: string }>;
  }> {
    const successful: T[] = [];
    const failed: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      if (operation) {
        const result = await this.handleTerminalOperation(
          operation,
          `${context}-BATCH-${i}`,
          undefined,
          undefined // バッチ処理では個別通知は行わない
        );

        if (result !== null) {
          successful.push(result);
        } else {
          failed.push({ index: i, reason: 'Operation failed' });
        }
      } else {
        failed.push({ index: i, reason: 'Invalid operation' });
      }
    }

    const summary = `Batch operation completed: ${successful.length} successful, ${failed.length} failed`;
    log(`📊 [${context}] ${summary}`);

    if (notificationService) {
      if (failed.length === 0) {
        notificationService.showSuccess(
          `All ${successful.length} operations completed successfully`
        );
      } else if (successful.length === 0) {
        notificationService.showError(`All ${failed.length} operations failed`);
      } else {
        notificationService.showWarning(summary);
      }
    }

    return { successful, failed };
  }

  /**
   * オペレーション結果を作成するヘルパー
   */
  static createResult<T>(
    success: boolean,
    data?: T,
    reason?: string,
    error?: Error
  ): OperationResult<T> {
    return { success, data, reason, error };
  }

  /**
   * 成功結果を作成
   */
  static success<T>(data?: T): OperationResult<T> {
    return this.createResult(true, data);
  }

  /**
   * 失敗結果を作成
   */
  static failure<T = unknown>(reason: string, error?: Error): OperationResult<T> {
    return this.createResult<T>(false, undefined, reason, error);
  }
}
