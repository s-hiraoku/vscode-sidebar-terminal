/**
 * 統合ロギングフレームワーク
 * 全コンポーネントで一貫したロギングを提供
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// ログレベルと型定義
// =============================================================================

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  SILENT = 999
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
  error?: Error;
  stack?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableVSCodeOutput: boolean;
  enableMetrics: boolean;
  logFilePath?: string;
  maxFileSize?: number;
  maxLogEntries?: number;
  format?: LogFormat;
}

export enum LogFormat {
  JSON = 'json',
  TEXT = 'text',
  PRETTY = 'pretty'
}

export interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByComponent: Record<string, number>;
  errorRate: number;
  averageLogSize: number;
}

// =============================================================================
// ロガー基底クラス
// =============================================================================

export abstract class BaseLogger {
  protected config: LoggerConfig;
  protected readonly category: string;
  protected readonly component: string;

  constructor(category: string, component: string, config?: Partial<LoggerConfig>) {
    this.category = category;
    this.component = component;
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableVSCodeOutput: false,
      enableMetrics: true,
      format: LogFormat.PRETTY,
      maxLogEntries: 10000,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ...config
    };
  }

  protected abstract writeLog(entry: LogEntry): void;

  protected shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  protected createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: Date.now(),
      level,
      category: this.category,
      component: this.component,
      message,
      metadata,
      error,
      stack: error?.stack
    };
  }

  public trace(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      this.writeLog(this.createLogEntry(LogLevel.TRACE, message, metadata));
    }
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.createLogEntry(LogLevel.DEBUG, message, metadata));
    }
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.createLogEntry(LogLevel.INFO, message, metadata));
    }
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.createLogEntry(LogLevel.WARN, message, metadata));
    }
  }

  public error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(this.createLogEntry(LogLevel.ERROR, message, metadata, error));
    }
  }

  public fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      this.writeLog(this.createLogEntry(LogLevel.FATAL, message, metadata, error));
    }
  }

  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  public getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// =============================================================================
// 統合ロガー実装
// =============================================================================

export class IntegratedLogger extends BaseLogger {
  private static instances = new Map<string, IntegratedLogger>();
  private logBuffer: LogEntry[] = [];
  private outputChannel?: vscode.OutputChannel;
  private fileStream?: fs.WriteStream;
  private metrics: LogMetrics;

  private constructor(category: string, component: string, config?: Partial<LoggerConfig>) {
    super(category, component, config);
    this.metrics = this.initializeMetrics();
    this.setupOutputs();
  }

  public static getLogger(
    category: string,
    component: string,
    config?: Partial<LoggerConfig>
  ): IntegratedLogger {
    const key = `${category}:${component}`;

    if (!IntegratedLogger.instances.has(key)) {
      IntegratedLogger.instances.set(key, new IntegratedLogger(category, component, config));
    }

    return IntegratedLogger.instances.get(key)!;
  }

  private initializeMetrics(): LogMetrics {
    return {
      totalLogs: 0,
      logsByLevel: {},
      logsByComponent: {},
      errorRate: 0,
      averageLogSize: 0
    };
  }

  private setupOutputs(): void {
    // VS Code Output Channel設定
    if (this.config.enableVSCodeOutput) {
      this.outputChannel = vscode.window.createOutputChannel(
        `${this.category} - ${this.component}`
      );
    }

    // ファイル出力設定
    if (this.config.enableFile && this.config.logFilePath) {
      this.setupFileLogging();
    }
  }

  private setupFileLogging(): void {
    if (!this.config.logFilePath) return;

    const logDir = path.dirname(this.config.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.fileStream = fs.createWriteStream(this.config.logFilePath, {
      flags: 'a',
      encoding: 'utf-8'
    });

    // ファイルサイズ管理
    this.checkAndRotateLogFile();
  }

  private checkAndRotateLogFile(): void {
    if (!this.config.logFilePath || !this.config.maxFileSize) return;

    try {
      const stats = fs.statSync(this.config.logFilePath);
      if (stats.size > this.config.maxFileSize) {
        this.rotateLogFile();
      }
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  }

  private rotateLogFile(): void {
    if (!this.config.logFilePath) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = `${this.config.logFilePath}.${timestamp}`;

    // 現在のファイルをリネーム
    fs.renameSync(this.config.logFilePath, rotatedPath);

    // 新しいファイルストリームを作成
    if (this.fileStream) {
      this.fileStream.end();
    }
    this.setupFileLogging();
  }

  protected writeLog(entry: LogEntry): void {
    // バッファに追加
    this.addToBuffer(entry);

    // メトリクス更新
    if (this.config.enableMetrics) {
      this.updateMetrics(entry);
    }

    // 各出力先に書き込み
    const formattedMessage = this.formatLogEntry(entry);

    if (this.config.enableConsole) {
      this.writeToConsole(entry, formattedMessage);
    }

    if (this.config.enableVSCodeOutput && this.outputChannel) {
      this.outputChannel.appendLine(formattedMessage);
    }

    if (this.config.enableFile && this.fileStream) {
      this.fileStream.write(formattedMessage + '\n');
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // バッファサイズ管理
    if (this.config.maxLogEntries && this.logBuffer.length > this.config.maxLogEntries) {
      this.logBuffer = this.logBuffer.slice(-this.config.maxLogEntries);
    }
  }

  private updateMetrics(entry: LogEntry): void {
    this.metrics.totalLogs++;

    // レベル別集計
    const levelName = LogLevel[entry.level];
    this.metrics.logsByLevel[levelName] = (this.metrics.logsByLevel[levelName] || 0) + 1;

    // コンポーネント別集計
    this.metrics.logsByComponent[entry.component] =
      (this.metrics.logsByComponent[entry.component] || 0) + 1;

    // エラーレート計算
    if (entry.level >= LogLevel.ERROR) {
      const errorCount = this.metrics.logsByLevel['ERROR'] || 0;
      const fatalCount = this.metrics.logsByLevel['FATAL'] || 0;
      this.metrics.errorRate = (errorCount + fatalCount) / this.metrics.totalLogs;
    }

    // 平均ログサイズ計算
    const messageSize = JSON.stringify(entry).length;
    this.metrics.averageLogSize =
      (this.metrics.averageLogSize * (this.metrics.totalLogs - 1) + messageSize) /
      this.metrics.totalLogs;
  }

  private formatLogEntry(entry: LogEntry): string {
    switch (this.config.format) {
      case LogFormat.JSON:
        return JSON.stringify(entry);

      case LogFormat.TEXT:
        return this.formatAsText(entry);

      case LogFormat.PRETTY:
        return this.formatAsPretty(entry);

      default:
        return this.formatAsPretty(entry);
    }
  }

  private formatAsText(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const category = `[${entry.category}]`.padEnd(15);
    const component = `[${entry.component}]`.padEnd(20);

    let message = `${timestamp} ${level} ${category} ${component} ${entry.message}`;

    if (entry.metadata) {
      message += ` | ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.message}`;
      if (entry.stack) {
        message += `\n  Stack: ${entry.stack}`;
      }
    }

    return message;
  }

  private formatAsPretty(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const emoji = this.getLogEmoji(entry.level);
    const level = LogLevel[entry.level];
    const prefix = `${emoji} [${timestamp}] [${level}]`;

    let message = `${prefix} ${entry.category}::${entry.component} - ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += `\n  📊 Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    if (entry.error) {
      message += `\n  ❌ Error: ${entry.error.message}`;
      if (entry.stack) {
        message += `\n  📚 Stack:\n${entry.stack.split('\n').map(line => '    ' + line).join('\n')}`;
      }
    }

    return message;
  }

  private getLogEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.TRACE: return '🔍';
      case LogLevel.DEBUG: return '🐛';
      case LogLevel.INFO: return '💡';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      case LogLevel.FATAL: return '💀';
      default: return '📝';
    }
  }

  private writeToConsole(entry: LogEntry, formattedMessage: string): void {
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.log(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage);
        break;
    }
  }

  // メトリクス取得
  public getMetrics(): LogMetrics {
    return { ...this.metrics };
  }

  // ログバッファ取得
  public getLogBuffer(filter?: Partial<LogEntry>): LogEntry[] {
    if (!filter) {
      return [...this.logBuffer];
    }

    return this.logBuffer.filter(entry => {
      return Object.entries(filter).every(([key, value]) => {
        return entry[key as keyof LogEntry] === value;
      });
    });
  }

  // ログクリア
  public clearLogs(): void {
    this.logBuffer = [];
    this.metrics = this.initializeMetrics();
  }

  // クリーンアップ
  public dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
    }

    if (this.fileStream) {
      this.fileStream.end();
    }
  }
}

// =============================================================================
// コンテキスト付きロガー
// =============================================================================

export class ContextualLogger {
  private logger: IntegratedLogger;
  private context: Record<string, unknown>;

  constructor(
    category: string,
    component: string,
    context: Record<string, unknown> = {},
    config?: Partial<LoggerConfig>
  ) {
    this.logger = IntegratedLogger.getLogger(category, component, config);
    this.context = context;
  }

  private mergeContext(metadata?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.context, ...metadata };
  }

  public trace(message: string, metadata?: Record<string, unknown>): void {
    this.logger.trace(message, this.mergeContext(metadata));
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.logger.debug(message, this.mergeContext(metadata));
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.logger.info(message, this.mergeContext(metadata));
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.logger.warn(message, this.mergeContext(metadata));
  }

  public error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.logger.error(message, error, this.mergeContext(metadata));
  }

  public fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.logger.fatal(message, error, this.mergeContext(metadata));
  }

  public addContext(key: string, value: unknown): void {
    this.context[key] = value;
  }

  public removeContext(key: string): void {
    delete this.context[key];
  }

  public clearContext(): void {
    this.context = {};
  }
}

// =============================================================================
// パフォーマンスロガー
// =============================================================================

export class PerformanceLogger {
  private logger: IntegratedLogger;
  private timers = new Map<string, number>();

  constructor(category: string, component: string, config?: Partial<LoggerConfig>) {
    this.logger = IntegratedLogger.getLogger(category, component, config);
  }

  public startTimer(operation: string): void {
    this.timers.set(operation, performance.now());
    this.logger.trace(`⏱️ Started timer: ${operation}`);
  }

  public endTimer(operation: string, metadata?: Record<string, unknown>): number {
    const startTime = this.timers.get(operation);

    if (!startTime) {
      this.logger.warn(`⏱️ Timer not found: ${operation}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(operation);

    this.logger.info(`⏱️ ${operation} completed`, {
      duration: `${duration.toFixed(2)}ms`,
      ...metadata
    });

    return duration;
  }

  public measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.startTimer(operation);

    return fn()
      .then(result => {
        this.endTimer(operation, { ...metadata, status: 'success' });
        return result;
      })
      .catch(error => {
        this.endTimer(operation, { ...metadata, status: 'error', error: error.message });
        throw error;
      });
  }

  public measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    this.startTimer(operation);

    try {
      const result = fn();
      this.endTimer(operation, { ...metadata, status: 'success' });
      return result;
    } catch (error) {
      this.endTimer(operation, {
        ...metadata,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// =============================================================================
// デコレーター
// =============================================================================

/**
 * メソッドログデコレーター
 */
export function LogMethod(level: LogLevel = LogLevel.DEBUG) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = function (...args: any[]) {
      const logger = IntegratedLogger.getLogger('Method', className);

      logger.debug(`→ ${className}.${propertyKey}`, { args });

      try {
        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
          return result.then(res => {
            logger.debug(`← ${className}.${propertyKey}`, { result: res });
            return res;
          }).catch(err => {
            logger.error(`✗ ${className}.${propertyKey}`, err);
            throw err;
          });
        }

        logger.debug(`← ${className}.${propertyKey}`, { result });
        return result;

      } catch (error) {
        logger.error(`✗ ${className}.${propertyKey}`, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * パフォーマンス計測デコレーター
 */
export function MeasurePerformance() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      const logger = new PerformanceLogger('Performance', className);
      const operation = `${className}.${propertyKey}`;

      return logger.measureAsync(
        operation,
        () => originalMethod.apply(this, args),
        { args }
      );
    };

    return descriptor;
  };
}

// =============================================================================
// ファクトリー関数
// =============================================================================

export function createLogger(
  category: string,
  component: string,
  config?: Partial<LoggerConfig>
): IntegratedLogger {
  return IntegratedLogger.getLogger(category, component, config);
}

export function createContextualLogger(
  category: string,
  component: string,
  context: Record<string, unknown> = {},
  config?: Partial<LoggerConfig>
): ContextualLogger {
  return new ContextualLogger(category, component, context, config);
}

export function createPerformanceLogger(
  category: string,
  component: string,
  config?: Partial<LoggerConfig>
): PerformanceLogger {
  return new PerformanceLogger(category, component, config);
}

// =============================================================================
// デフォルトエクスポート
// =============================================================================

export default {
  createLogger,
  createContextualLogger,
  createPerformanceLogger,
  LogLevel,
  LogFormat,
  LogMethod,
  MeasurePerformance
};