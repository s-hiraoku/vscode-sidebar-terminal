/**
 * Unified Logger Manager - Consolidates all logging operations with performance optimization
 * Eliminates code duplication across all managers and provides centralized log management
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory =
  | 'DOM'
  | 'COMM'
  | 'UI'
  | 'PERF'
  | 'INPUT'
  | 'SPLIT'
  | 'CONFIG'
  | 'NOTIFICATION'
  | 'GENERAL';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  context?: string;
}

export interface LogConfig {
  level: LogLevel;
  categories: LogCategory[];
  enablePerformanceLogging: boolean;
  enableCategoryFiltering: boolean;
  maxLogEntries: number;
}

export class LoggerManager {
  private static instance: LoggerManager;
  private logEntries: LogEntry[] = [];
  private config: LogConfig = {
    level: 'INFO',
    categories: [
      'DOM',
      'COMM',
      'UI',
      'PERF',
      'INPUT',
      'SPLIT',
      'CONFIG',
      'NOTIFICATION',
      'GENERAL',
    ],
    enablePerformanceLogging: true,
    enableCategoryFiltering: false,
    maxLogEntries: 1000,
  };

  private readonly levelPriority: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  public static getInstance(): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager();
    }
    return LoggerManager.instance;
  }

  /**
   * Configure logging behavior
   */
  public configure(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('CONFIG', 'INFO', 'Logger configuration updated', this.config);
  }

  /**
   * Main logging method with category and level support
   */
  public log(
    category: LogCategory,
    level: LogLevel,
    message: string,
    data?: any,
    context?: string
  ): void {
    // Check if log level meets minimum threshold
    if (this.levelPriority[level] < this.levelPriority[this.config.level]) {
      return;
    }

    // Check if category is enabled
    if (this.config.enableCategoryFiltering && !this.config.categories.includes(category)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      context,
    };

    // Add to internal log storage
    this.logEntries.push(entry);

    // Trim log entries if exceeding max size
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries);
    }

    // Output to console with formatted message
    this.outputToConsole(entry);
  }

  /**
   * DOM-specific logging methods
   */
  public dom = {
    debug: (message: string, data?: any) => this.log('DOM', 'DEBUG', message, data),
    info: (message: string, data?: any) => this.log('DOM', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('DOM', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('DOM', 'ERROR', message, data),
  };

  /**
   * Communication-specific logging methods
   */
  public comm = {
    debug: (message: string, data?: any) => this.log('COMM', 'DEBUG', message, data),
    info: (message: string, data?: any) => this.log('COMM', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('COMM', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('COMM', 'ERROR', message, data),
  };

  /**
   * UI-specific logging methods
   */
  public ui = {
    debug: (message: string, data?: any) => this.log('UI', 'DEBUG', message, data),
    info: (message: string, data?: any) => this.log('UI', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('UI', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('UI', 'ERROR', message, data),
  };

  /**
   * Performance-specific logging methods
   */
  public perf = {
    debug: (message: string, data?: any) =>
      this.config.enablePerformanceLogging && this.log('PERF', 'DEBUG', message, data),
    info: (message: string, data?: any) =>
      this.config.enablePerformanceLogging && this.log('PERF', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('PERF', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('PERF', 'ERROR', message, data),
  };

  /**
   * Input-specific logging methods
   */
  public input = {
    debug: (message: string, data?: any) => this.log('INPUT', 'DEBUG', message, data),
    info: (message: string, data?: any) => this.log('INPUT', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('INPUT', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('INPUT', 'ERROR', message, data),
  };

  /**
   * Split manager logging methods
   */
  public split = {
    debug: (message: string, data?: any) => this.log('SPLIT', 'DEBUG', message, data),
    info: (message: string, data?: any) => this.log('SPLIT', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('SPLIT', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('SPLIT', 'ERROR', message, data),
  };

  /**
   * Configuration logging methods
   */
  public configLog = {
    debug: (message: string, data?: any) => this.log('CONFIG', 'DEBUG', message, data),
    info: (message: string, data?: any) => this.log('CONFIG', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('CONFIG', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('CONFIG', 'ERROR', message, data),
  };

  /**
   * Notification logging methods
   */
  public notification = {
    debug: (message: string, data?: any) => this.log('NOTIFICATION', 'DEBUG', message, data),
    info: (message: string, data?: any) => this.log('NOTIFICATION', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('NOTIFICATION', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('NOTIFICATION', 'ERROR', message, data),
  };

  /**
   * General logging methods
   */
  public general = {
    debug: (message: string, data?: any) => this.log('GENERAL', 'DEBUG', message, data),
    info: (message: string, data?: any) => this.log('GENERAL', 'INFO', message, data),
    warn: (message: string, data?: any) => this.log('GENERAL', 'WARN', message, data),
    error: (message: string, data?: any) => this.log('GENERAL', 'ERROR', message, data),
  };

  /**
   * Performance measurement utilities
   */
  public performance = {
    start: (label: string): number => {
      const startTime = performance.now();
      this.perf.debug(`Performance start: ${label}`, { startTime });
      return startTime;
    },

    end: (label: string, startTime: number): number => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.perf.info(`Performance end: ${label}`, {
        startTime,
        endTime,
        duration: `${duration.toFixed(2)}ms`,
      });
      return duration;
    },

    measure: <T>(label: string, fn: () => T): T => {
      const startTime = this.performance.start(label);
      try {
        const result = fn();
        this.performance.end(label, startTime);
        return result;
      } catch (error) {
        this.performance.end(label, startTime);
        this.perf.error(`Performance error in ${label}`, error);
        throw error;
      }
    },

    measureAsync: async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      const startTime = this.performance.start(label);
      try {
        const result = await fn();
        this.performance.end(label, startTime);
        return result;
      } catch (error) {
        this.performance.end(label, startTime);
        this.perf.error(`Performance error in ${label}`, error);
        throw error;
      }
    },
  };

  /**
   * Format and output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString().substr(11, 12);
    const emoji = this.getLevelEmoji(entry.level);
    const categoryTag = `[${entry.category}]`;
    const formattedMessage = `${emoji} ${timestamp} ${categoryTag} ${entry.message}`;

    // Choose appropriate console method based on level
    switch (entry.level) {
      case 'DEBUG':
        console.debug(formattedMessage, entry.data || '');
        break;
      case 'INFO':
        console.info(formattedMessage, entry.data || '');
        break;
      case 'WARN':
        console.warn(formattedMessage, entry.data || '');
        break;
      case 'ERROR':
        console.error(formattedMessage, entry.data || '');
        break;
    }
  }

  /**
   * Get emoji for log level
   */
  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case 'DEBUG':
        return '🔧';
      case 'INFO':
        return '📝';
      case 'WARN':
        return '⚠️';
      case 'ERROR':
        return '❌';
      default:
        return '📄';
    }
  }

  /**
   * Get recent log entries
   */
  public getRecentLogs(count = 50): LogEntry[] {
    return this.logEntries.slice(-count);
  }

  /**
   * Get logs by category
   */
  public getLogsByCategory(category: LogCategory, count = 50): LogEntry[] {
    return this.logEntries.filter((entry) => entry.category === category).slice(-count);
  }

  /**
   * Get logs by level
   */
  public getLogsByLevel(level: LogLevel, count = 50): LogEntry[] {
    return this.logEntries.filter((entry) => entry.level === level).slice(-count);
  }

  /**
   * Search logs by message content
   */
  public searchLogs(searchTerm: string, count = 50): LogEntry[] {
    return this.logEntries
      .filter((entry) => entry.message.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(-count);
  }

  /**
   * Get log statistics
   */
  public getLogStats(): {
    totalEntries: number;
    entriesByLevel: Record<LogLevel, number>;
    entriesByCategory: Record<LogCategory, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const entriesByLevel = this.logEntries.reduce(
      (acc, entry) => {
        acc[entry.level] = (acc[entry.level] || 0) + 1;
        return acc;
      },
      {} as Record<LogLevel, number>
    );

    const entriesByCategory = this.logEntries.reduce(
      (acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + 1;
        return acc;
      },
      {} as Record<LogCategory, number>
    );

    return {
      totalEntries: this.logEntries.length,
      entriesByLevel,
      entriesByCategory,
      oldestEntry: this.logEntries.length > 0 ? this.logEntries[0]!.timestamp : null,
      newestEntry:
        this.logEntries.length > 0 ? this.logEntries[this.logEntries.length - 1]!.timestamp : null,
    };
  }

  /**
   * Export logs as JSON
   */
  public exportLogs(): string {
    return JSON.stringify(
      {
        config: this.config,
        entries: this.logEntries,
        exportedAt: Date.now(),
      },
      null,
      2
    );
  }

  /**
   * Clear all log entries
   */
  public clearLogs(): void {
    const count = this.logEntries.length;
    this.logEntries = [];
    this.log('GENERAL', 'INFO', `Cleared ${count} log entries`);
  }

  /**
   * Enable/disable performance logging
   */
  public setPerformanceLogging(enabled: boolean): void {
    this.config.enablePerformanceLogging = enabled;
    this.log('CONFIG', 'INFO', `Performance logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set log level
   */
  public setLogLevel(level: LogLevel): void {
    this.config.level = level;
    this.log('CONFIG', 'INFO', `Log level set to ${level}`);
  }

  /**
   * Enable/disable category filtering
   */
  public setCategoryFiltering(enabled: boolean, categories?: LogCategory[]): void {
    this.config.enableCategoryFiltering = enabled;
    if (categories) {
      this.config.categories = categories;
    }
    this.log('CONFIG', 'INFO', `Category filtering ${enabled ? 'enabled' : 'disabled'}`, {
      categories: this.config.categories,
    });
  }

  /**
   * Dispose and cleanup resources
   */
  public dispose(): void {
    this.log('GENERAL', 'INFO', 'Disposing logger manager');
    this.clearLogs();
  }
}
