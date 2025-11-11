/**
 * Shared Session Type Definitions
 * Common session data structures used across the codebase
 */

import { safeProcessCwd } from '../utils/common';

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
      cwd: terminal.cwd || safeProcessCwd(),
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

  /**
   * Phase 2.3.1: Migrate old session format (200-line scrollback) to new format (1000-line scrollback)
   * Detects sessions created before v0.1.137 and updates their configuration
   */
  static migrateSessionFormat(sessionData: SessionStorageData): {
    migrated: boolean;
    sessionData: SessionStorageData;
    message: string;
  } {
    let migrated = false;
    let message = 'No migration needed';

    // Check if this is an old format session (missing version or version < 0.1.137)
    const needsMigration =
      !sessionData.version ||
      sessionData.version < '0.1.137' ||
      (sessionData.config?.scrollbackLines && sessionData.config.scrollbackLines < 500);

    if (needsMigration) {
      migrated = true;

      // Update scrollback line limit from 200 to 1000
      if (!sessionData.config) {
        sessionData.config = {
          scrollbackLines: 1000,
          reviveProcess: 'auto',
        };
        message = 'Migrated session: Added default config (1000-line scrollback)';
      } else if (sessionData.config.scrollbackLines < 500) {
        const oldLimit = sessionData.config.scrollbackLines;
        sessionData.config.scrollbackLines = 1000;
        message = `Migrated session: Updated scrollback limit from ${oldLimit} to 1000 lines`;
      }

      // Update version to current
      sessionData.version = '0.1.137';

      // Log migration details
      console.log(
        `[SESSION-MIGRATION] ${message} (${sessionData.terminals.length} terminals)`
      );
    }

    return {
      migrated,
      sessionData,
      message,
    };
  }

  /**
   * Phase 2.3.2: Validate that session data can be safely restored without data loss
   */
  static validateSessionForRestore(sessionData: SessionStorageData): {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for required fields
    if (!sessionData.terminals || !Array.isArray(sessionData.terminals)) {
      issues.push('Missing or invalid terminals array');
    }

    if (typeof sessionData.timestamp !== 'number') {
      issues.push('Missing or invalid timestamp');
    }

    // Check for potential data loss scenarios
    if (sessionData.scrollbackData) {
      const scrollbackKeys = Object.keys(sessionData.scrollbackData);
      sessionData.terminals.forEach((terminal) => {
        if (!scrollbackKeys.includes(terminal.id)) {
          warnings.push(`Terminal ${terminal.id} (${terminal.name}) has no scrollback data`);
        }
      });
    }

    // Check scrollback line counts for old format detection
    if (sessionData.scrollbackData) {
      Object.entries(sessionData.scrollbackData).forEach(([termId, data]) => {
        if (Array.isArray(data)) {
          if (data.length === 200) {
            warnings.push(
              `Terminal ${termId} has exactly 200 lines (possible old format truncation)`
            );
          } else if (data.length > 0 && data.length < 200) {
            warnings.push(`Terminal ${termId} has only ${data.length} lines of history`);
          }
        }
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Phase 2.3.4: Create migration progress indicator data
   */
  static createMigrationProgress(
    totalTerminals: number,
    processedTerminals: number,
    migrated: boolean
  ): {
    progress: number;
    status: string;
    message: string;
  } {
    const progress = totalTerminals > 0 ? (processedTerminals / totalTerminals) * 100 : 100;
    const status = migrated ? 'migrating' : 'restoring';
    const message = migrated
      ? `Migrating session format... ${processedTerminals}/${totalTerminals} terminals`
      : `Restoring session... ${processedTerminals}/${totalTerminals} terminals`;

    return {
      progress,
      status,
      message,
    };
  }
}
