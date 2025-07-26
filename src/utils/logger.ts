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
    // Check environment and set appropriate log level
    const isWebViewEnvironment = typeof window !== 'undefined' && typeof process === 'undefined';

    if (isWebViewEnvironment) {
      // WebView environment - use conservative logging in production
      this.isDevelopment = this.detectWebViewDevMode();
      this.level = this.isDevelopment ? LogLevel.INFO : LogLevel.WARN;
    } else {
      // Extension environment
      this.isDevelopment =
        process.env.NODE_ENV === 'development' || process.env.VSCODE_DEBUG_MODE === 'true';
      this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;
    }
  }

  private detectWebViewDevMode(): boolean {
    // Check for development indicators in WebView environment
    if (typeof window !== 'undefined') {
      // VS Code development host detection
      const isDevHost =
        window.location?.hostname === 'localhost' ||
        window.location?.protocol === 'vscode-webview:';

      // Check for debug flags in URL or global variables
      const hasDebugFlag =
        window.location?.search?.includes('debug=true') ||
        (window as Window & { VSCODE_DEBUG?: boolean }).VSCODE_DEBUG === true;

      return isDevHost || hasDebugFlag;
    }
    return false;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private safeStringify(obj: unknown): string {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (obj === null || obj === undefined) return String(obj);

    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return '[Complex Object]';
    }
  }

  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
      console.log('[DEBUG]', ...safeArgs);
    }
  }

  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
      console.log('[INFO]', ...safeArgs);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
      console.warn('[WARN]', ...safeArgs);
    }
  }

  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
      console.error('[ERROR]', ...safeArgs);
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
export const debug = (...args: unknown[]): void => logger.debug(...args);
export const info = (...args: unknown[]): void => logger.info(...args);
export const warn = (...args: unknown[]): void => logger.warn(...args);
export const error = (...args: unknown[]): void => logger.error(...args);
export const terminal = (...args: unknown[]): void => logger.terminal(...args);
export const webview = (...args: unknown[]): void => logger.webview(...args);
export const provider = (...args: unknown[]): void => logger.provider(...args);
export const extension = (...args: unknown[]): void => logger.extension(...args);
export const performance = (...args: unknown[]): void => logger.performance(...args);
