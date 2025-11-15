/**
 * Logging utility for VS Code extension
 * Provides environment-aware logging with configurable levels
 */

interface Disposable {
  dispose(): void;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger implements Disposable {
  private level: LogLevel;
  private isDevelopment: boolean;
  private isProduction: boolean;
  private logBuffer: Array<{ level: string; args: unknown[]; timestamp: number }> = [];
  private bufferFlushInterval: number = 100; // ms
  private maxBufferSize: number = 50;
  private flushTimer?: NodeJS.Timeout;

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

    this.isProduction = !this.isDevelopment;

    // Set up automatic buffer flushing for production performance
    if (this.isProduction) {
      this.setupProductionLogging();
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

  // Public query helpers
  isDebugEnabled(): boolean {
    return this.level <= LogLevel.DEBUG;
  }
  isInfoEnabled(): boolean {
    return this.level <= LogLevel.INFO;
  }

  private setupProductionLogging(): void {
    // In production, use buffered logging for performance
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.bufferFlushInterval);
  }

  private addToBuffer(level: string, args: unknown[]): void {
    this.logBuffer.push({
      level,
      args,
      timestamp: Date.now(),
    });

    // Force flush if buffer is too large
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flushBuffer();
    }
  }

  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;

    // Group logs by level for efficient output
    const logsByLevel = this.logBuffer.reduce(
      (acc, log) => {
        if (!acc[log.level]) acc[log.level] = [];
        acc[log.level]!.push(log);
        return acc;
      },
      {} as Record<string, typeof this.logBuffer>
    );

    // Output grouped logs
    // In production, logs are suppressed based on log level
    // eslint-disable-next-line no-constant-condition
    if (false) {
      // This code path is only for type checking - replaced by build-time stripping
      Object.entries(logsByLevel).forEach(([level, logs]) => {
        if (level === 'error') {
          logs.forEach((log) => {
            // eslint-disable-next-line no-console
            console.error(...log.args);
          });
        } else if (level === 'warn') {
          logs.forEach((log) => {
            // eslint-disable-next-line no-console
            console.warn(...log.args);
          });
        } else {
          logs.forEach((log) => {
            // eslint-disable-next-line no-console
            console.log(...log.args);
          });
        }
      });
    }

    // Clear buffer
    this.logBuffer = [];
  }

  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flushBuffer(); // Final flush
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

  private formatMessage(
    level: string,
    category: string,
    emoji: string,
    ...args: unknown[]
  ): unknown[] {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS format
    const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
    return [`[${timestamp}] ${emoji} [${level}:${category}]`, ...safeArgs];
  }

  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
      if (this.isProduction) {
        this.addToBuffer('log', ['[DEBUG]', ...safeArgs]);
      } else {
        // Development mode only - will be stripped in production builds
        // eslint-disable-next-line no-console
        console.log('[DEBUG]', ...safeArgs);
      }
    }
  }

  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
      if (this.isProduction) {
        this.addToBuffer('log', ['[INFO]', ...safeArgs]);
      } else {
        // Development mode only - will be stripped in production builds
        // eslint-disable-next-line no-console
        console.log('[INFO]', ...safeArgs);
      }
    }
  }

  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
      if (this.isProduction) {
        this.addToBuffer('warn', ['[WARN]', ...safeArgs]);
      } else {
        // Development mode only - will be stripped in production builds
        // eslint-disable-next-line no-console
        console.warn('[WARN]', ...safeArgs);
      }
    }
  }

  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      const safeArgs = args.map((arg) => (typeof arg === 'object' ? this.safeStringify(arg) : arg));
      // Errors are always logged immediately, even in production
      // eslint-disable-next-line no-console
      console.error('[ERROR]', ...safeArgs);
    }
  }

  // Enhanced categorized logging methods with consistent formatting and emojis
  terminal(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'TERMINAL', '✨', ...args));
    }
  }

  webview(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'WEBVIEW', '🌐', ...args));
    }
  }

  provider(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'PROVIDER', '📡', ...args));
    }
  }

  extension(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'EXTENSION', '🔧', ...args));
    }
  }

  performance(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'PERF', '⚡', ...args));
    }
  }

  // New categorized logging methods for better organization
  message(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'MESSAGE', '📨', ...args));
    }
  }

  ui(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'UI', '🎨', ...args));
    }
  }

  config(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'CONFIG', '⚙️', ...args));
    }
  }

  session(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('INFO', 'SESSION', '💾', ...args));
    }
  }

  input(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'INPUT', '⌨️', ...args));
    }
  }

  output(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'OUTPUT', '📤', ...args));
    }
  }

  lifecycle(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('INFO', 'LIFECYCLE', '🔄', ...args));
    }
  }

  error_category(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      // eslint-disable-next-line no-console
      console.error(...this.formatMessage('ERROR', 'ERROR', '🚨', ...args));
    }
  }

  warning_category(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      // eslint-disable-next-line no-console
      console.warn(...this.formatMessage('WARN', 'WARNING', '⚠️', ...args));
    }
  }

  success(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('INFO', 'SUCCESS', '✅', ...args));
    }
  }

  startup(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('INFO', 'STARTUP', '🚀', ...args));
    }
  }

  debug_category(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'DEBUG', '🔍', ...args));
    }
  }

  // Agent-related logging
  agent(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('INFO', 'AGENT', '🤖', ...args));
    }
  }

  // File operations
  file(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'FILE', '📁', ...args));
    }
  }

  // Network/communication
  network(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'NETWORK', '🌐', ...args));
    }
  }

  // State management
  state(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'STATE', '🔄', ...args));
    }
  }

  // Scrollback logging
  scrollback(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', 'SCROLLBACK', '📜', ...args));
    }
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

// New categorized convenience functions
export const message = (...args: unknown[]): void => logger.message(...args);
export const ui = (...args: unknown[]): void => logger.ui(...args);
export const config = (...args: unknown[]): void => logger.config(...args);
export const session = (...args: unknown[]): void => logger.session(...args);
export const input = (...args: unknown[]): void => logger.input(...args);
export const output = (...args: unknown[]): void => logger.output(...args);
export const lifecycle = (...args: unknown[]): void => logger.lifecycle(...args);
export const error_category = (...args: unknown[]): void => logger.error_category(...args);
export const warning_category = (...args: unknown[]): void => logger.warning_category(...args);
export const success = (...args: unknown[]): void => logger.success(...args);
export const startup = (...args: unknown[]): void => logger.startup(...args);
export const debug_category = (...args: unknown[]): void => logger.debug_category(...args);
export const agent = (...args: unknown[]): void => logger.agent(...args);
export const file = (...args: unknown[]): void => logger.file(...args);
export const network = (...args: unknown[]): void => logger.network(...args);
export const state = (...args: unknown[]): void => logger.state(...args);
export const scrollback = (...args: unknown[]): void => logger.scrollback(...args);

// Query helpers
export const isDebugEnabled = (): boolean => logger.isDebugEnabled();
export const isInfoEnabled = (): boolean => logger.isInfoEnabled();

// General log function (alias for info)
export const log = (...args: unknown[]): void => logger.info(...args);
