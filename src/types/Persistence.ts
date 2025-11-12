/**
 * Unified Persistence Types and Interfaces
 *
 * This file consolidates all persistence-related types and interfaces used
 * across both Extension-side and WebView-side persistence services.
 */

/**
 * Persistence configuration from VS Code settings
 */
export interface PersistenceConfig {
  enablePersistentSessions: boolean;
  persistentSessionScrollback: number;
  persistentSessionReviveProcess: string;
}

/**
 * Terminal session data structure
 */
export interface TerminalSessionData {
  id: string;
  name: string;
  number: number;
  cwd: string;
  isActive: boolean;
  serializedContent?: string;
  metadata?: {
    lines: number;
    size: number;
    compressed: boolean;
  };
}

/**
 * Complete session data stored in globalState
 */
export interface StoredSessionData {
  version: string;
  timestamp: number;
  terminals: TerminalSessionData[];
  activeTerminalId: string | null;
  config: PersistenceConfig;
}

/**
 * Result of persistence operations
 */
export interface PersistenceResult {
  success: boolean;
  terminalCount: number;
  error?: string;
}

/**
 * Result of restore operations
 */
export interface RestoreResult {
  success: boolean;
  restoredCount: number;
  skippedCount: number;
  error?: string;
}

/**
 * Session information for queries
 */
export interface SessionInfo {
  exists: boolean;
  terminals?: TerminalSessionData[];
  timestamp?: number;
  version?: string;
}

/**
 * Session statistics
 */
export interface SessionStats {
  hasSession: boolean;
  terminalCount: number;
  lastSaved: Date | null;
  isExpired: boolean;
  configEnabled: boolean;
}

/**
 * Serialization data from WebView
 */
export interface SerializationData {
  [terminalId: string]: {
    content: string;
    html?: string;
    metadata?: {
      lines: number;
      size: number;
      compressed: boolean;
    };
  };
}

/**
 * Error codes for persistence operations
 */
export enum PersistenceErrorCode {
  SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
  DESERIALIZATION_FAILED = 'DESERIALIZATION_FAILED',
  STORAGE_ACCESS_FAILED = 'STORAGE_ACCESS_FAILED',
  WEBVIEW_COMMUNICATION_FAILED = 'WEBVIEW_COMMUNICATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  INVALID_DATA_FORMAT = 'INVALID_DATA_FORMAT',
}

/**
 * Custom persistence error
 */
export class PersistenceError extends Error {
  public override readonly name = 'PersistenceError';

  constructor(
    override message: string,
    public readonly code: PersistenceErrorCode,
    public readonly terminalId?: string,
    public override readonly cause?: Error
  ) {
    super(message);
  }
}

/**
 * Interface for Extension-side persistence service
 */
export interface IExtensionPersistenceService {
  saveCurrentSession(): Promise<PersistenceResult>;
  restoreSession(forceRestore?: boolean): Promise<RestoreResult>;
  getSessionInfo(): SessionInfo | null;
  clearSession(): Promise<void>;
  getSessionStats(): SessionStats;
  dispose(): void;
}

/**
 * Interface for WebView-side persistence service
 */
export interface IWebViewPersistenceService {
  addTerminal(terminalId: string, terminal: any): void;
  removeTerminal(terminalId: string): void;
  serializeTerminal(terminalId: string, options?: SerializationOptions): SerializationResult | null;
  restoreTerminalContent(terminalId: string, content: string): boolean;
  serializeAllTerminals(scrollback?: number): Map<string, SerializationResult>;
  dispose(): void;
}

/**
 * Options for terminal serialization
 */
export interface SerializationOptions {
  scrollback?: number;
  excludeModes?: boolean;
  excludeAltBuffer?: boolean;
}

/**
 * Result of terminal serialization
 */
export interface SerializationResult {
  content: string;
  html?: string;
  metadata?: {
    lines: number;
    size: number;
    compressed: boolean;
  };
}

/**
 * Message types for Extension <-> WebView communication
 */
export interface PersistenceMessage {
  command: string;
  terminalIds?: string[];
  terminalData?: any[];
  sessionData?: any;
  timestamp: number;
  requestId?: string;
}

/**
 * Constants for persistence layer
 */
export const PERSISTENCE_CONSTANTS = {
  STORAGE_KEY: 'consolidated-terminal-session-v1',
  SESSION_VERSION: '1.0.0',
  MAX_SESSION_AGE_DAYS: 7,
  MAX_SCROLLBACK_LINES: 1000,
  COMPRESSION_THRESHOLD: 1000,
  SERIALIZATION_TIMEOUT_MS: 3000,
  AUTO_SAVE_DEBOUNCE_MS: 1000,
} as const;
