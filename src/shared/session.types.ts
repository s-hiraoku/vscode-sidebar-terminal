/**
 * Shared Session Type Definitions
 * Common session data structures used across the codebase
 */

/**
 * Terminal session data interface
 */
export interface TerminalSessionData {
  id: string;
  name: string;
  number: number;
  cwd: string;
  isActive: boolean;
  scrollback?: string[];
  shellCommand?: string;
  cliAgentType?: 'claude' | 'gemini';
}

/**
 * Session storage data structure
 */
export interface SessionStorageData {
  terminals: TerminalSessionData[];
  activeTerminalId: string | null;
  timestamp: number;
  version: string;
  scrollbackData?: Record<string, unknown>;
  config?: {
    scrollbackLines: number;
    reviveProcess?: string;
  };
}

/**
 * Session info for readonly queries
 */
export interface SessionInfo {
  exists: boolean;
  terminals?: TerminalSessionData[];
  timestamp?: number;
  version?: string;
}

/**
 * Session restore result
 */
export interface SessionRestoreResult {
  success: boolean;
  restoredCount?: number;
  skippedCount?: number;
  message?: string;
  terminals?: TerminalSessionData[];
}

/**
 * Session data transformer utilities
 */
export class SessionDataTransformer {
  /**
   * Validate session data structure
   */
  static isValidSessionData(data: unknown): data is SessionStorageData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const session = data as Partial<SessionStorageData>;

    return (
      Array.isArray(session.terminals) &&
      typeof session.timestamp === 'number' &&
      typeof session.version === 'string'
    );
  }

  /**
   * Check if session has expired
   */
  static isSessionExpired(sessionData: SessionStorageData, expiryDays: number = 7): boolean {
    const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
    return Date.now() - sessionData.timestamp > expiryMs;
  }

  /**
   * Normalize terminal data for consistency
   */
  static normalizeTerminalData(terminal: Partial<TerminalSessionData>): TerminalSessionData {
    return {
      id: terminal.id || '',
      name: terminal.name || 'Terminal',
      number: terminal.number || 1,
      cwd: terminal.cwd || process.cwd(),
      isActive: terminal.isActive || false,
      scrollback: terminal.scrollback || [],
      shellCommand: terminal.shellCommand || '',
      cliAgentType: terminal.cliAgentType,
    };
  }

  /**
   * Create session info from storage data
   */
  static createSessionInfo(sessionData: SessionStorageData | null): SessionInfo {
    if (!sessionData || !SessionDataTransformer.isValidSessionData(sessionData)) {
      return { exists: false };
    }

    return {
      exists: true,
      terminals: sessionData.terminals,
      timestamp: sessionData.timestamp,
      version: sessionData.version,
    };
  }

  /**
   * Create empty session restore result
   */
  static createEmptyResult(message: string = 'No session data'): SessionRestoreResult {
    return {
      success: true,
      restoredCount: 0,
      skippedCount: 0,
      message,
    };
  }

  /**
   * Create success session restore result
   */
  static createSuccessResult(
    restoredCount: number,
    skippedCount: number = 0,
    terminals?: TerminalSessionData[]
  ): SessionRestoreResult {
    return {
      success: true,
      restoredCount,
      skippedCount,
      terminals,
      message: `Restored ${restoredCount} terminal(s)`,
    };
  }

  /**
   * Create failure session restore result
   */
  static createFailureResult(error: string | Error): SessionRestoreResult {
    const message = typeof error === 'string' ? error : error.message;
    return {
      success: false,
      restoredCount: 0,
      skippedCount: 0,
      message: `Restore failed: ${message}`,
    };
  }
}
