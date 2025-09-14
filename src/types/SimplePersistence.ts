/**
 * Simple Session Continuation Types
 * Phase 2: Realistic terminal session restoration approach
 */

/**
 * Simple session data - only essentials for continuation
 */
export interface SimpleSessionData {
  /** Number of terminals that were open */
  terminalCount: number;
  
  /** Which terminal was active */
  activeTerminalId: string | null;
  
  /** Terminal names for recreation */
  terminalNames: string[];
  
  /** When the session was saved */
  timestamp: number;
  
  /** Version for future compatibility */
  version: string;
}

/**
 * Session continuation message for user
 */
export interface SessionContinuationMessage {
  /** Type of message to display */
  type: 'welcome' | 'restored' | 'info';
  
  /** Main message text */
  message: string;
  
  /** Additional details if needed */
  details?: string;
  
  /** Timestamp when message was created */
  timestamp: number;
}

/**
 * Simple persistence manager interface
 */
export interface ISimplePersistenceManager {
  /** Save current session state */
  saveSession(): Promise<boolean>;
  
  /** Load previous session state */
  loadSession(): Promise<SimpleSessionData | null>;
  
  /** Clear saved session */
  clearSession(): Promise<void>;
  
  /** Get session continuation message */
  getSessionMessage(sessionData: SimpleSessionData): SessionContinuationMessage;
}

/**
 * Constants for simple persistence
 */
export const SIMPLE_PERSISTENCE = {
  STORAGE_KEY: 'simple_terminal_session',
  VERSION: '1.0.0',
  MAX_TERMINALS: 5,
  DEFAULT_TERMINAL_NAME: 'Terminal'
} as const;