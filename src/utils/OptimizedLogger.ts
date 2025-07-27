/**
 * 最適化されたログ出力戦略
 * 
 * パフォーマンスを重視し、本番環境では必要最低限のログのみを出力する
 * 開発環境では詳細なデバッグ情報を提供
 */

import * as vscode from 'vscode';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export enum LogCategory {
  EXTENSION = 'EXT',
  SESSION = 'SES',
  TERMINAL = 'TRM',
  WEBVIEW = 'WEB',
  PERFORMANCE = 'PERF',
  ERROR = 'ERR',
}

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  timestamp: number;
  data?: unknown;
}

/**
 * 最適化されたロガークラス
 * - 本番環境ではERRORとWARNのみ
 * - 開発環境では全レベル対応
 * - ログバッファリングによるパフォーマンス最適化
 * - 構造化ログによる解析容易性
 */
export class OptimizedLogger {
  private static instance: OptimizedLogger;
  private currentLevel: LogLevel = LogLevel.WARN;
  private isProduction = true;
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.startFlushTimer();
  }

  public static getInstance(): OptimizedLogger {
    if (!OptimizedLogger.instance) {
      OptimizedLogger.instance = new OptimizedLogger();
    }
    return OptimizedLogger.instance;
  }

  /**
   * 拡張機能モードに基づいてログレベルを設定
   */
  public initialize(extensionMode: vscode.ExtensionMode): void {
    this.isProduction = extensionMode === vscode.ExtensionMode.Production;
    
    if (this.isProduction) {
      this.currentLevel = LogLevel.WARN; // 本番: ERROR + WARN のみ
    } else {
      this.currentLevel = LogLevel.DEBUG; // 開発: ERROR + WARN + INFO + DEBUG
    }

    this.info(LogCategory.EXTENSION, `Logger initialized - Mode: ${this.isProduction ? 'Production' : 'Development'}, Level: ${LogLevel[this.currentLevel]}`);
  }

  /**
   * エラーログ（本番・開発共通）
   */
  public error(category: LogCategory, message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  /**
   * 警告ログ（本番・開発共通）
   */
  public warn(category: LogCategory, message: string, data?: unknown): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  /**
   * 情報ログ（開発環境のみ）
   */
  public info(category: LogCategory, message: string, data?: unknown): void {
    if (!this.isProduction) {
      this.log(LogLevel.INFO, category, message, data);
    }
  }

  /**
   * デバッグログ（開発環境のみ）
   */
  public debug(category: LogCategory, message: string, data?: unknown): void {
    if (!this.isProduction) {
      this.log(LogLevel.DEBUG, category, message, data);
    }
  }

  /**
   * パフォーマンス測定ログ
   */
  public performance(operation: string, duration: number, category: LogCategory = LogCategory.PERFORMANCE): void {
    if (duration > 1000) { // 1秒以上の場合は警告
      this.warn(category, `Performance warning: ${operation} took ${duration}ms`);
    } else if (!this.isProduction) {
      this.debug(category, `Performance: ${operation} completed in ${duration}ms`);
    }
  }

  /**
   * 重要な操作の成功ログ（本番・開発共通）
   */
  public success(category: LogCategory, message: string, data?: unknown): void {
    this.info(category, `✅ ${message}`, data);
  }

  /**
   * 重要な操作の開始ログ（開発環境のみ）
   */
  public operation(category: LogCategory, operation: string, data?: unknown): void {
    this.debug(category, `🔧 Starting: ${operation}`, data);
  }

  /**
   * セッション復元専用ログ
   */
  public sessionRestore(phase: 'start' | 'progress' | 'complete' | 'error', message: string, data?: unknown): void {
    const icon = {
      start: '🔄',
      progress: '⏳',
      complete: '✅',
      error: '❌'
    }[phase];

    if (phase === 'error') {
      this.error(LogCategory.SESSION, `${icon} ${message}`, data);
    } else if (phase === 'complete') {
      this.success(LogCategory.SESSION, `${icon} ${message}`, data);
    } else {
      this.info(LogCategory.SESSION, `${icon} ${message}`, data);
    }
  }

  /**
   * ターミナル操作専用ログ
   */
  public terminal(action: 'create' | 'remove' | 'focus' | 'error', terminalId: string, details?: string): void {
    const icon = {
      create: '➕',
      remove: '🗑️',
      focus: '🎯',
      error: '❌'
    }[action];

    const message = `${icon} Terminal ${action}: ${terminalId}${details ? ` - ${details}` : ''}`;

    if (action === 'error') {
      this.error(LogCategory.TERMINAL, message);
    } else {
      this.info(LogCategory.TERMINAL, message);
    }
  }

  /**
   * WebView通信専用ログ
   */
  public webviewMessage(direction: 'send' | 'receive', command: string, success: boolean = true): void {
    const icon = direction === 'send' ? '📤' : '📥';
    const status = success ? '✅' : '❌';
    
    if (!success) {
      this.error(LogCategory.WEBVIEW, `${icon} ${status} WebView message ${direction}: ${command}`);
    } else {
      this.debug(LogCategory.WEBVIEW, `${icon} WebView message ${direction}: ${command}`);
    }
  }

  /**
   * 内部ログメソッド
   */
  private log(level: LogLevel, category: LogCategory, message: string, data?: unknown): void {
    if (level > this.currentLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      category,
      message,
      timestamp: Date.now(),
      data: data ? this.sanitizeData(data) : undefined,
    };

    this.logBuffer.push(entry);

    // 即座に出力が必要なエラーレベル
    if (level <= LogLevel.ERROR) {
      this.flushBuffer();
    }

    // バッファサイズ制限
    if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.flushBuffer();
    }
  }

  /**
   * データのサニタイズ（センシティブ情報の除去）
   */
  private sanitizeData(data: unknown): unknown {
    if (typeof data === 'string') {
      // パスワードやトークンらしき文字列をマスク
      return data.replace(/(?:password|token|key|secret)[:=]\s*["']?([^"'\s,}]+)/gi, 'password=***');
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof key === 'string' && /password|token|key|secret/i.test(key)) {
          sanitized[key] = '***';
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * ログバッファの出力
   */
  private flushBuffer(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    for (const entry of this.logBuffer) {
      const timestamp = new Date(entry.timestamp).toISOString().substr(11, 12); // HH:mm:ss.sss
      const levelIcon = this.getLevelIcon(entry.level);
      const message = `${timestamp} ${levelIcon}[${entry.category}] ${entry.message}`;

      // VS Code出力チャンネルまたはコンソールに出力
      if (entry.level <= LogLevel.ERROR) {
        console.error(message, entry.data || '');
      } else if (entry.level <= LogLevel.WARN) {
        console.warn(message, entry.data || '');
      } else {
        console.log(message, entry.data || '');
      }
    }

    this.logBuffer = [];
  }

  /**
   * レベルアイコンの取得
   */
  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '❌';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.DEBUG: return '🔧';
      case LogLevel.TRACE: return '🔍';
      default: return '📝';
    }
  }

  /**
   * 定期的なバッファフラッシュ
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushBuffer();
  }
}

// グローバルロガーインスタンス
export const logger = OptimizedLogger.getInstance();

// 簡潔なログ関数（後方互換性のため）
export const log = {
  error: (category: LogCategory, message: string, data?: unknown) => logger.error(category, message, data),
  warn: (category: LogCategory, message: string, data?: unknown) => logger.warn(category, message, data),
  info: (category: LogCategory, message: string, data?: unknown) => logger.info(category, message, data),
  debug: (category: LogCategory, message: string, data?: unknown) => logger.debug(category, message, data),
  performance: (operation: string, duration: number) => logger.performance(operation, duration),
  success: (category: LogCategory, message: string, data?: unknown) => logger.success(category, message, data),
  operation: (category: LogCategory, operation: string, data?: unknown) => logger.operation(category, operation, data),
  sessionRestore: (phase: 'start' | 'progress' | 'complete' | 'error', message: string, data?: unknown) => 
    logger.sessionRestore(phase, message, data),
  terminal: (action: 'create' | 'remove' | 'focus' | 'error', terminalId: string, details?: string) => 
    logger.terminal(action, terminalId, details),
  webviewMessage: (direction: 'send' | 'receive', command: string, success?: boolean) => 
    logger.webviewMessage(direction, command, success),
};