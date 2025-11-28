/**
 * Message Logger
 *
 * Unified logging system for message handling.
 * Consolidates logging patterns from:
 * - messageLogger (webview/utils/ManagerLogger)
 * - provider logger (utils/logger)
 * - Inline console.log statements
 *
 * Related to: GitHub Issue #219
 */

import { WebviewMessage } from '../../../types/common';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Log entry
 */
export interface ILogEntry {
  readonly level: LogLevel;
  readonly timestamp: number;
  readonly source: string;
  readonly message: string;
  readonly data?: unknown;
}

/**
 * Logger configuration
 */
export interface ILoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;

  /** Whether to include timestamps */
  includeTimestamp: boolean;

  /** Whether to include source names */
  includeSource: boolean;

  /** Custom log output function */
  outputFn?: (entry: ILogEntry) => void;

  /** Maximum number of log entries to keep in memory */
  maxHistorySize: number;
}

/**
 * Unified message logger
 */
export class MessageLogger {
  private readonly config: ILoggerConfig;
  private readonly history: ILogEntry[] = [];
  private readonly levelNames: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.NONE]: 'NONE',
  };

  private readonly levelEmojis: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.NONE]: '',
  };

  constructor(config: Partial<ILoggerConfig> = {}) {
    this.config = {
      minLevel: config.minLevel ?? LogLevel.WARN,
      includeTimestamp: config.includeTimestamp ?? true,
      includeSource: config.includeSource ?? true,
      maxHistorySize: config.maxHistorySize ?? 1000,
      outputFn: config.outputFn,
    };
  }

  /**
   * Log debug message
   */
  public debug(source: string, message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, source, message, data);
  }

  /**
   * Log info message
   */
  public info(source: string, message: string, data?: unknown): void {
    this.log(LogLevel.INFO, source, message, data);
  }

  /**
   * Log warning message
   */
  public warn(source: string, message: string, data?: unknown): void {
    this.log(LogLevel.WARN, source, message, data);
  }

  /**
   * Log error message
   */
  public error(source: string, message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, source, message, error);
  }

  /**
   * Log message received
   */
  public logMessageReceived(source: string, message: WebviewMessage): void {
    this.debug(source, `Message received: ${message.command}`, {
      command: message.command,
      timestamp: Date.now(),
    });
  }

  /**
   * Log message sent
   */
  public logMessageSent(source: string, message: unknown): void {
    const command = (message as any)?.command || 'unknown';
    this.debug(source, `Message sent: ${command}`, { command, timestamp: Date.now() });
  }

  /**
   * Log message handling started
   */
  public logHandlingStarted(source: string, message: WebviewMessage, handlerName: string): void {
    this.info(source, `Handler '${handlerName}' processing: ${message.command}`, {
      command: message.command,
      handler: handlerName,
    });
  }

  /**
   * Log message handling completed
   */
  public logHandlingCompleted(
    source: string,
    message: WebviewMessage,
    handlerName: string,
    processingTime: number
  ): void {
    this.info(
      source,
      `Handler '${handlerName}' completed: ${message.command} in ${processingTime}ms`,
      { command: message.command, handler: handlerName, processingTime }
    );
  }

  /**
   * Log message handling failed
   */
  public logHandlingFailed(
    source: string,
    message: WebviewMessage,
    handlerName: string,
    error: unknown
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.error(
      source,
      `Handler '${handlerName}' failed for ${message.command}: ${errorMessage}`,
      error
    );
  }

  /**
   * Log validation error
   */
  public logValidationError(source: string, message: WebviewMessage, error: string): void {
    this.error(source, `Validation failed for ${message.command}: ${error}`, {
      command: message.command,
      error,
    });
  }

  /**
   * Core log method
   */
  private log(level: LogLevel, source: string, message: string, data?: unknown): void {
    // Skip if below minimum level
    if (level < this.config.minLevel) {
      return;
    }

    const entry: ILogEntry = {
      level,
      timestamp: Date.now(),
      source,
      message,
      data,
    };

    // Add to history
    this.history.push(entry);
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }

    // Output
    if (this.config.outputFn) {
      this.config.outputFn(entry);
    } else {
      this.defaultOutput(entry);
    }
  }

  /**
   * Default console output
   */
  private defaultOutput(entry: ILogEntry): void {
    const parts: string[] = [];

    // Emoji
    const emoji = this.levelEmojis[entry.level];
    if (emoji) {
      parts.push(emoji);
    }

    // Timestamp
    if (this.config.includeTimestamp) {
      const date = new Date(entry.timestamp);
      parts.push(`[${date.toISOString()}]`);
    }

    // Level
    parts.push(`[${this.levelNames[entry.level]}]`);

    // Source
    if (this.config.includeSource) {
      parts.push(`[${entry.source}]`);
    }

    // Message
    parts.push(entry.message);

    const fullMessage = parts.join(' ');

    // Use appropriate console method
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage, entry.data);
        break;
      case LogLevel.INFO:
        console.info(fullMessage, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage, entry.data);
        break;
      case LogLevel.ERROR:
        console.error(fullMessage, entry.data);
        break;
    }
  }

  /**
   * Get log history
   */
  public getHistory(): readonly ILogEntry[] {
    return [...this.history];
  }

  /**
   * Clear log history
   */
  public clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Set minimum log level
   */
  public setMinLevel(level: LogLevel): void {
    (this.config as any).minLevel = level;
  }

  /**
   * Create a child logger with a specific source prefix
   */
  public createChild(sourcePrefix: string): ChildMessageLogger {
    return new ChildMessageLogger(this, sourcePrefix);
  }
}

/**
 * Child logger that automatically prefixes sources
 */
export class ChildMessageLogger {
  constructor(
    private readonly parent: MessageLogger,
    private readonly sourcePrefix: string
  ) {}

  public debug(message: string, data?: unknown): void {
    this.parent.debug(this.sourcePrefix, message, data);
  }

  public info(message: string, data?: unknown): void {
    this.parent.info(this.sourcePrefix, message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.parent.warn(this.sourcePrefix, message, data);
  }

  public error(message: string, error?: unknown): void {
    this.parent.error(this.sourcePrefix, message, error);
  }
}

/**
 * Create a default message logger instance
 */
export function createMessageLogger(config?: Partial<ILoggerConfig>): MessageLogger {
  return new MessageLogger(config);
}

/**
 * Singleton message logger instance
 */
export const messageLogger = createMessageLogger({
  minLevel: LogLevel.DEBUG,
  includeTimestamp: true,
  includeSource: true,
});
