/**
 * Logging utility for VS Code extension
 * Provides environment-aware logging with configurable levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    // Check if running in development mode
    this.isDevelopment = process.env.NODE_ENV === 'development' || 
                        process.env.VSCODE_DEBUG_MODE === 'true';
    
    // Set log level based on environment
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }

  // Convenience methods for common use cases
  terminal(...args: unknown[]): void {
    this.debug('🔌 [TERMINAL]', ...args);
  }

  webview(...args: unknown[]): void {
    this.debug('🌐 [WEBVIEW]', ...args);
  }

  provider(...args: unknown[]): void {
    this.debug('📡 [PROVIDER]', ...args);
  }

  extension(...args: unknown[]): void {
    this.debug('🔧 [EXTENSION]', ...args);
  }

  performance(...args: unknown[]): void {
    this.debug('⚡ [PERF]', ...args);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const { debug, info, warn, error, terminal, webview, provider, extension, performance } = logger;