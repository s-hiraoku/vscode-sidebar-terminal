/** Environment-aware logging utility for VS Code extension. */

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
    const isWebViewEnvironment = typeof window !== 'undefined' && typeof process === 'undefined';

    if (isWebViewEnvironment) {
      this.isDevelopment = this.detectWebViewDevMode();
    } else {
      this.isDevelopment = process.env.NODE_ENV !== 'production';
    }

    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;
    this.isProduction = !this.isDevelopment;

    if (this.isProduction) {
      this.setupProductionLogging();
    }
  }

  private detectWebViewDevMode(): boolean {
    if (typeof window === 'undefined') return false;

    const isDevHost =
      window.location?.hostname === 'localhost' ||
      window.location?.protocol === 'vscode-webview:';

    const hasDebugFlag =
      window.location?.search?.includes('debug=true') ||
      (window as Window & { VSCODE_DEBUG?: boolean }).VSCODE_DEBUG === true;

    return isDevHost || hasDebugFlag;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  isDebugEnabled(): boolean {
    return this.level <= LogLevel.DEBUG;
  }

  isInfoEnabled(): boolean {
    return this.level <= LogLevel.INFO;
  }

  private setupProductionLogging(): void {
    this.flushTimer = setInterval(() => this.flushBuffer(), this.bufferFlushInterval);
  }

  private addToBuffer(level: string, args: unknown[]): void {
    this.logBuffer.push({ level, args, timestamp: Date.now() });
    if (this.logBuffer.length >= this.maxBufferSize) this.flushBuffer();
  }

  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;
    // Production logs are suppressed - buffer is only cleared
    this.logBuffer = [];
  }

  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flushBuffer();
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

  // Categorized logging - DEBUG level
  private logDebug(category: string, emoji: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('DEBUG', category, emoji, ...args));
    }
  }

  // Categorized logging - INFO level
  private logInfo(category: string, emoji: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('INFO', category, emoji, ...args));
    }
  }

  terminal(...args: unknown[]): void { this.logDebug('TERMINAL', '✨', ...args); }
  webview(...args: unknown[]): void { this.logDebug('WEBVIEW', '🌐', ...args); }
  provider(...args: unknown[]): void { this.logDebug('PROVIDER', '📡', ...args); }
  extension(...args: unknown[]): void { this.logDebug('EXTENSION', '🔧', ...args); }
  performance(...args: unknown[]): void { this.logDebug('PERF', '⚡', ...args); }
  message(...args: unknown[]): void { this.logDebug('MESSAGE', '📨', ...args); }
  ui(...args: unknown[]): void { this.logDebug('UI', '🎨', ...args); }
  config(...args: unknown[]): void { this.logDebug('CONFIG', '⚙️', ...args); }
  input(...args: unknown[]): void { this.logDebug('INPUT', '⌨️', ...args); }
  output(...args: unknown[]): void { this.logDebug('OUTPUT', '📤', ...args); }
  debug_category(...args: unknown[]): void { this.logDebug('DEBUG', '🔍', ...args); }
  file(...args: unknown[]): void { this.logDebug('FILE', '📁', ...args); }
  network(...args: unknown[]): void { this.logDebug('NETWORK', '🌐', ...args); }
  state(...args: unknown[]): void { this.logDebug('STATE', '🔄', ...args); }
  scrollback(...args: unknown[]): void { this.logDebug('SCROLLBACK', '📜', ...args); }

  session(...args: unknown[]): void { this.logInfo('SESSION', '💾', ...args); }
  lifecycle(...args: unknown[]): void { this.logInfo('LIFECYCLE', '🔄', ...args); }
  success(...args: unknown[]): void { this.logInfo('SUCCESS', '✅', ...args); }
  startup(...args: unknown[]): void { this.logInfo('STARTUP', '🚀', ...args); }
  agent(...args: unknown[]): void { this.logInfo('AGENT', '🤖', ...args); }

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
}

export const logger = new Logger();

// Basic logging
export const debug = (...args: unknown[]): void => logger.debug(...args);
export const info = (...args: unknown[]): void => logger.info(...args);
export const warn = (...args: unknown[]): void => logger.warn(...args);
export const error = (...args: unknown[]): void => logger.error(...args);
export const log = (...args: unknown[]): void => logger.info(...args);

// Categorized logging - DEBUG level
export const terminal = (...args: unknown[]): void => logger.terminal(...args);
export const webview = (...args: unknown[]): void => logger.webview(...args);
export const provider = (...args: unknown[]): void => logger.provider(...args);
export const extension = (...args: unknown[]): void => logger.extension(...args);
export const performance = (...args: unknown[]): void => logger.performance(...args);
export const message = (...args: unknown[]): void => logger.message(...args);
export const ui = (...args: unknown[]): void => logger.ui(...args);
export const config = (...args: unknown[]): void => logger.config(...args);
export const input = (...args: unknown[]): void => logger.input(...args);
export const output = (...args: unknown[]): void => logger.output(...args);
export const debug_category = (...args: unknown[]): void => logger.debug_category(...args);
export const file = (...args: unknown[]): void => logger.file(...args);
export const network = (...args: unknown[]): void => logger.network(...args);
export const state = (...args: unknown[]): void => logger.state(...args);
export const scrollback = (...args: unknown[]): void => logger.scrollback(...args);

// Categorized logging - INFO level
export const session = (...args: unknown[]): void => logger.session(...args);
export const lifecycle = (...args: unknown[]): void => logger.lifecycle(...args);
export const success = (...args: unknown[]): void => logger.success(...args);
export const startup = (...args: unknown[]): void => logger.startup(...args);
export const agent = (...args: unknown[]): void => logger.agent(...args);

// Categorized logging - WARN/ERROR level
export const error_category = (...args: unknown[]): void => logger.error_category(...args);
export const warning_category = (...args: unknown[]): void => logger.warning_category(...args);

// Query helpers
export const isDebugEnabled = (): boolean => logger.isDebugEnabled();
export const isInfoEnabled = (): boolean => logger.isInfoEnabled();
