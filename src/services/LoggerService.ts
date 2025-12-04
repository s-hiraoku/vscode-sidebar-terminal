/**
 * Logger Service - Structured Logging System
 * Replaces scattered console.log statements with configurable, structured logging
 */

import * as vscode from 'vscode';

/**
 * Log level enumeration
 */
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

/**
 * Log level string mapping
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.NONE]: 'NONE',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
};

/**
 * Configuration section for logger
 */
const LOGGER_CONFIG_SECTION = 'secondaryTerminal.logging';

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableContext: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.WARN,
  enableTimestamp: true,
  enableContext: true,
};

/**
 * Structured logging service with configurable log levels
 */
export class LoggerService {
  private static instance: LoggerService | null = null;
  private config: LoggerConfig;
  private outputChannel: vscode.OutputChannel;
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    this.config = this.loadConfig();
    this.outputChannel = vscode.window.createOutputChannel('Secondary Terminal');

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(LOGGER_CONFIG_SECTION)) {
          this.config = this.loadConfig();
        }
      })
    );

    this.disposables.push(this.outputChannel);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfig(): LoggerConfig {
    const config = vscode.workspace.getConfiguration(LOGGER_CONFIG_SECTION);

    const levelString = config.get<string>('level', 'warn').toUpperCase();
    let level = LogLevel.WARN;

    switch (levelString) {
      case 'NONE':
        level = LogLevel.NONE;
        break;
      case 'ERROR':
        level = LogLevel.ERROR;
        break;
      case 'WARN':
        level = LogLevel.WARN;
        break;
      case 'INFO':
        level = LogLevel.INFO;
        break;
      case 'DEBUG':
        level = LogLevel.DEBUG;
        break;
    }

    return {
      level,
      enableTimestamp: config.get<boolean>('enableTimestamp', DEFAULT_CONFIG.enableTimestamp),
      enableContext: config.get<boolean>('enableContext', DEFAULT_CONFIG.enableContext),
    };
  }

  /**
   * Format log message with timestamp and context
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown
  ): string {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }

    parts.push(`[${LOG_LEVEL_NAMES[level]}]`);

    if (this.config.enableContext && context) {
      parts.push(`[${context}]`);
    }

    parts.push(message);

    if (data !== undefined) {
      if (typeof data === 'object') {
        try {
          parts.push(JSON.stringify(data, null, 2));
        } catch {
          parts.push(`[Circular or non-serializable data]`);
        }
      } else {
        parts.push(String(data));
      }
    }

    return parts.join(' ');
  }

  /**
   * Log at specified level
   */
  private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    if (level > this.config.level) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, context, data);
    this.outputChannel.appendLine(formattedMessage);

    // Also log to console in development mode for ERROR and WARN levels
    if (level <= LogLevel.WARN) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        if (level === LogLevel.ERROR) {
          // eslint-disable-next-line no-console
          console.error(formattedMessage);
        } else if (level === LogLevel.WARN) {
          // eslint-disable-next-line no-console
          console.warn(formattedMessage);
        }
      }
    }
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Log info message
   */
  public info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Log error message
   */
  public error(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  /**
   * Show and focus output channel
   */
  public show(): void {
    this.outputChannel.show();
  }

  /**
   * Get current log level
   */
  public getLogLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set log level programmatically (for testing)
   */
  public setLogLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Dispose service and clean up resources
   */
  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    LoggerService.instance = null;
  }
}

/**
 * Convenience function to get logger instance
 */
export function getLogger(): LoggerService {
  return LoggerService.getInstance();
}
