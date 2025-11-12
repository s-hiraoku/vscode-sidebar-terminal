/**
 * 統一エラーハンドリングシステム
 * 全コンポーネントで一貫したエラー処理を提供
 */

import * as vscode from 'vscode';

// =============================================================================
// エラー分類と型定義
// =============================================================================

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  TERMINAL = 'terminal',
  SESSION = 'session',
  CONFIGURATION = 'config',
  WEBVIEW = 'webview',
  COMMUNICATION = 'communication',
  RESOURCE = 'resource',
  UNKNOWN = 'unknown'
}

export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  component: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface ErrorReport {
  message: string;
  context: ErrorContext;
  error?: Error;
  stack?: string;
  recoverable: boolean;
}

// =============================================================================
// カスタムエラークラス
// =============================================================================

export abstract class BaseError extends Error {
  public readonly context: ErrorContext;
  public readonly recoverable: boolean;

  constructor(message: string, context: Partial<ErrorContext>, recoverable = true) {
    super(message);
    this.name = this.constructor.name;
    this.context = {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.ERROR,
      component: 'Unknown',
      timestamp: Date.now(),
      ...context
    };
    this.recoverable = recoverable;

    // TypeScript のプロトタイプチェーン修正
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toReport(): ErrorReport {
    return {
      message: this.message,
      context: this.context,
      error: this,
      stack: this.stack,
      recoverable: this.recoverable
    };
  }
}

export class TerminalError extends BaseError {
  constructor(message: string, component: string, operation?: string, recoverable = true) {
    super(message, {
      category: ErrorCategory.TERMINAL,
      severity: ErrorSeverity.ERROR,
      component,
      operation
    }, recoverable);
  }
}

export class SessionError extends BaseError {
  constructor(message: string, component: string, operation?: string, recoverable = true) {
    super(message, {
      category: ErrorCategory.SESSION,
      severity: ErrorSeverity.ERROR,
      component,
      operation
    }, recoverable);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, component: string, operation?: string) {
    super(message, {
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.WARNING,
      component,
      operation
    }, true);
  }
}

export class CommunicationError extends BaseError {
  constructor(message: string, component: string, operation?: string, recoverable = false) {
    super(message, {
      category: ErrorCategory.COMMUNICATION,
      severity: ErrorSeverity.ERROR,
      component,
      operation
    }, recoverable);
  }
}

export class ResourceError extends BaseError {
  constructor(message: string, component: string, operation?: string) {
    super(message, {
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.CRITICAL,
      component,
      operation
    }, false);
  }
}

// =============================================================================
// エラーハンドリングマネージャー
// =============================================================================

export class ErrorHandlingManager {
  private static instance: ErrorHandlingManager;
  private errorLog: ErrorReport[] = [];
  private readonly maxLogSize = 1000;
  private readonly errorHandlers = new Map<ErrorCategory, Set<ErrorHandler>>();
  private readonly globalHandlers = new Set<ErrorHandler>();

  private constructor() {}

  public static getInstance(): ErrorHandlingManager {
    if (!ErrorHandlingManager.instance) {
      ErrorHandlingManager.instance = new ErrorHandlingManager();
    }
    return ErrorHandlingManager.instance;
  }

  /**
   * エラーを処理し、適切なアクションを実行
   */
  public handleError(error: unknown, context?: Partial<ErrorContext>): ErrorReport {
    const report = this.createErrorReport(error, context);
    this.logError(report);
    this.notifyHandlers(report);
    this.showUserNotification(report);

    return report;
  }

  /**
   * 非同期エラーハンドリング付き実行
   */
  public async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext>,
    fallback?: T
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const report = this.handleError(error, context);

      if (report.recoverable && fallback !== undefined) {
        console.log(`🔄 Recovering with fallback value for ${context.operation}`);
        return fallback;
      }

      return null;
    }
  }

  /**
   * エラーレポート作成
   */
  private createErrorReport(error: unknown, context?: Partial<ErrorContext>): ErrorReport {
    if (error instanceof BaseError) {
      return error.toReport();
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    return {
      message: errorMessage,
      context: {
        category: context?.category || ErrorCategory.UNKNOWN,
        severity: context?.severity || ErrorSeverity.ERROR,
        component: context?.component || 'Unknown',
        operation: context?.operation,
        metadata: context?.metadata,
        timestamp: Date.now()
      },
      error: error instanceof Error ? error : undefined,
      stack: errorStack,
      recoverable: context?.severity !== ErrorSeverity.CRITICAL
    };
  }

  /**
   * エラーログ記録
   */
  private logError(report: ErrorReport): void {
    this.errorLog.push(report);

    // ログサイズ管理
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // コンソール出力
    const prefix = `[${report.context.category.toUpperCase()}]`;
    const severity = report.context.severity;

    switch (severity) {
      case ErrorSeverity.INFO:
        console.info(prefix, report.message);
        break;
      case ErrorSeverity.WARNING:
        console.warn(prefix, report.message);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        console.error(prefix, report.message, report.stack || '');
        break;
    }
  }

  /**
   * エラーハンドラー通知
   */
  private notifyHandlers(report: ErrorReport): void {
    // カテゴリ別ハンドラー
    const categoryHandlers = this.errorHandlers.get(report.context.category);
    if (categoryHandlers) {
      categoryHandlers.forEach(handler => handler(report));
    }

    // グローバルハンドラー
    this.globalHandlers.forEach(handler => handler(report));
  }

  /**
   * ユーザー通知表示
   */
  private showUserNotification(report: ErrorReport): void {
    const { message, context } = report;

    switch (context.severity) {
      case ErrorSeverity.INFO:
        vscode.window.showInformationMessage(message);
        break;
      case ErrorSeverity.WARNING:
        vscode.window.showWarningMessage(message);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        vscode.window.showErrorMessage(message);
        break;
    }
  }

  /**
   * エラーハンドラー登録
   */
  public registerErrorHandler(handler: ErrorHandler, category?: ErrorCategory): void {
    if (category) {
      if (!this.errorHandlers.has(category)) {
        this.errorHandlers.set(category, new Set());
      }
      this.errorHandlers.get(category)!.add(handler);
    } else {
      this.globalHandlers.add(handler);
    }
  }

  /**
   * エラーハンドラー削除
   */
  public unregisterErrorHandler(handler: ErrorHandler, category?: ErrorCategory): void {
    if (category) {
      this.errorHandlers.get(category)?.delete(handler);
    } else {
      this.globalHandlers.delete(handler);
    }
  }

  /**
   * エラーログ取得
   */
  public getErrorLog(category?: ErrorCategory, limit = 100): ErrorReport[] {
    let log = this.errorLog;

    if (category) {
      log = log.filter(report => report.context.category === category);
    }

    return log.slice(-limit);
  }

  /**
   * エラー統計取得
   */
  public getErrorStatistics(): ErrorStatistics {
    const stats: ErrorStatistics = {
      total: this.errorLog.length,
      byCategory: {},
      bySeverity: {},
      recoverable: 0,
      unrecoverable: 0
    };

    this.errorLog.forEach(report => {
      // カテゴリ別集計
      const category = report.context.category;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // 重要度別集計
      const severity = report.context.severity;
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;

      // 復旧可能性集計
      if (report.recoverable) {
        stats.recoverable++;
      } else {
        stats.unrecoverable++;
      }
    });

    return stats;
  }

  /**
   * エラーログクリア
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }
}

// =============================================================================
// 型定義
// =============================================================================

export type ErrorHandler = (report: ErrorReport) => void;

export interface ErrorStatistics {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recoverable: number;
  unrecoverable: number;
}

// =============================================================================
// ユーティリティ関数
// =============================================================================

/**
 * エラーを安全に文字列化
 */
export function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * スタックトレース取得
 */
export function getStackTrace(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * エラー型判定
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.recoverable;
  }
  return false;
}

/**
 * デコレーター: エラーハンドリング付きメソッド
 */
export function withErrorHandling(
  category: ErrorCategory,
  component: string,
  recoverable = true
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const manager = ErrorHandlingManager.getInstance();
      return manager.executeWithErrorHandling(
        () => originalMethod.apply(this, args),
        {
          category,
          component,
          operation: propertyKey,
          severity: recoverable ? ErrorSeverity.ERROR : ErrorSeverity.CRITICAL
        }
      );
    };

    return descriptor;
  };
}

// =============================================================================
// エクスポート
// =============================================================================

export const errorManager = ErrorHandlingManager.getInstance();