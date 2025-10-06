/**
 * ManagerLogger Utility
 *
 * Standardized logging across all managers to eliminate duplicate logging patterns
 * and provide consistent log formatting with manager identification
 */

import { webview as baseLog } from '../../utils/logger';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogConfig {
  prefix?: string;
  emoji?: string;
  enableTimestamp?: boolean;
  enableLevel?: boolean;
  maxMessageLength?: number;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  manager: string;
  message: string;
  data?: unknown;
}

/**
 * Centralized manager logging utility
 * Provides consistent formatting and optional log retention
 */
export class ManagerLogger {
  private static logHistory: LogEntry[] = [];
  private static maxHistorySize = 1000;
  private static globalConfig: LogConfig = {
    enableTimestamp: false,
    enableLevel: true,
    maxMessageLength: 500,
  };

  private managerName: string;
  private emoji: string;
  private config: LogConfig;

  constructor(managerName: string, emoji: string = '📋', config: LogConfig = {}) {
    this.managerName = managerName;
    this.emoji = emoji;
    this.config = { ...ManagerLogger.globalConfig, ...config };
  }

  /**
   * Create a logger instance for a specific manager
   * @param managerName Name of the manager (e.g., 'TerminalLifecycleManager')
   * @param emoji Emoji to use for this manager's logs
   * @param config Optional logging configuration
   */
  static createLogger(
    managerName: string,
    emoji: string = '📋',
    config: LogConfig = {}
  ): ManagerLogger {
    return new ManagerLogger(managerName, emoji, config);
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Optional data to include
   */
  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Optional data to include
   */
  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param data Optional data to include
   */
  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Optional data to include
   */
  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  /**
   * Log a terminal-specific message with terminal ID
   * @param terminalId Terminal identifier
   * @param message The message to log
   * @param data Optional data to include
   */
  terminal(terminalId: string, message: string, data?: unknown): void {
    this.info(`[${terminalId}] ${message}`, data);
  }

  /**
   * Log a performance-related message
   * @param operation Operation being measured
   * @param duration Duration in milliseconds
   * @param data Optional additional data
   */
  performance(operation: string, duration: number, data?: unknown): void {
    this.info(`⏱️ ${operation}: ${duration}ms`, data);
  }

  /**
   * Log a lifecycle event (initialization, disposal, etc.)
   * @param event Lifecycle event name
   * @param status Status of the event (starting, completed, failed)
   * @param data Optional additional data
   */
  lifecycle(event: string, status: 'starting' | 'completed' | 'failed', data?: unknown): void {
    const statusEmoji = {
      starting: '🔄',
      completed: '✅',
      failed: '❌',
    }[status];

    this.info(`${statusEmoji} ${event} ${status}`, data);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    try {
      // Truncate message if too long
      const truncatedMessage =
        this.config.maxMessageLength && message.length > this.config.maxMessageLength
          ? `${message.substring(0, this.config.maxMessageLength)}...`
          : message;

      // Build formatted message
      const parts: string[] = [];

      // Add timestamp if enabled
      if (this.config.enableTimestamp) {
        parts.push(`[${new Date().toISOString()}]`);
      }

      // Add level if enabled
      if (this.config.enableLevel && level !== 'info') {
        parts.push(`[${level.toUpperCase()}]`);
      }

      // Add emoji and manager name
      parts.push(`${this.emoji} [${this.managerName}]`);

      // Add the message
      parts.push(truncatedMessage);

      const formattedMessage = parts.join(' ');

      // Log to base logger
      baseLog(formattedMessage);

      // Log data if provided
      if (data !== undefined) {
        log(`🔍 [${this.managerName}] Data:`, data);
      }

      // Store in history
      this.addToHistory(level, truncatedMessage, data);
    } catch (error) {
      // Fallback to base logger if formatting fails
      baseLog(`❌ ManagerLogger error for ${this.managerName}: ${message}`);
      console.error('ManagerLogger error:', error);
    }
  }

  /**
   * Add entry to log history
   */
  private addToHistory(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      manager: this.managerName,
      message,
      data,
    };

    ManagerLogger.logHistory.push(entry);

    // Trim history if too large
    if (ManagerLogger.logHistory.length > ManagerLogger.maxHistorySize) {
      ManagerLogger.logHistory = ManagerLogger.logHistory.slice(-ManagerLogger.maxHistorySize);
    }
  }

  /**
   * Get recent log entries for this manager
   * @param count Number of entries to return
   */
  getRecentLogs(count: number = 10): LogEntry[] {
    return ManagerLogger.logHistory
      .filter((entry) => entry.manager === this.managerName)
      .slice(-count);
  }

  /**
   * Get all log entries for this manager since a timestamp
   * @param since Timestamp to filter from
   */
  getLogsSince(since: number): LogEntry[] {
    return ManagerLogger.logHistory.filter(
      (entry) => entry.manager === this.managerName && entry.timestamp >= since
    );
  }

  // Static methods for global log management

  /**
   * Configure global logging settings
   * @param config Global configuration to apply
   */
  static configure(config: Partial<LogConfig>): void {
    ManagerLogger.globalConfig = { ...ManagerLogger.globalConfig, ...config };
  }

  /**
   * Get all log entries from all managers
   * @param managerFilter Optional filter by manager name
   * @param levelFilter Optional filter by log level
   */
  static getAllLogs(managerFilter?: string, levelFilter?: LogLevel): LogEntry[] {
    let logs = ManagerLogger.logHistory;

    if (managerFilter) {
      logs = logs.filter((entry) => entry.manager === managerFilter);
    }

    if (levelFilter) {
      logs = logs.filter((entry) => entry.level === levelFilter);
    }

    return logs;
  }

  /**
   * Clear all log history
   */
  static clearHistory(): void {
    ManagerLogger.logHistory = [];
    baseLog('🧹 ManagerLogger: Log history cleared');
  }

  /**
   * Export log history as JSON
   */
  static exportLogs(): string {
    return JSON.stringify(ManagerLogger.logHistory, null, 2);
  }

  /**
   * Get logging statistics
   */
  static getStats(): {
    totalEntries: number;
    managerCounts: Record<string, number>;
    levelCounts: Record<LogLevel, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const managerCounts: Record<string, number> = {};
    const levelCounts: Record<LogLevel, number> = {
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
    };

    for (const entry of ManagerLogger.logHistory) {
      managerCounts[entry.manager] = (managerCounts[entry.manager] || 0) + 1;
      levelCounts[entry.level]++;
    }

    return {
      totalEntries: ManagerLogger.logHistory.length,
      managerCounts,
      levelCounts,
      oldestEntry:
        ManagerLogger.logHistory.length > 0 ? ManagerLogger.logHistory[0]?.timestamp || null : null,
      newestEntry:
        ManagerLogger.logHistory.length > 0
          ? ManagerLogger.logHistory[ManagerLogger.logHistory.length - 1]?.timestamp || null
          : null,
    };
  }
}

// Pre-configured logger instances for common managers
export const terminalLogger = ManagerLogger.createLogger('TerminalLifecycle', '🔄');
export const uiLogger = ManagerLogger.createLogger('UI', '🎨');
export const inputLogger = ManagerLogger.createLogger('Input', '⌨️');
export const performanceLogger = ManagerLogger.createLogger('Performance', '📊');
export const splitLogger = ManagerLogger.createLogger('Split', '📱');
export const messageLogger = ManagerLogger.createLogger('Message', '📨');
export const notificationLogger = ManagerLogger.createLogger('Notification', '🔔');
export const configLogger = ManagerLogger.createLogger('Config', '⚙️');
