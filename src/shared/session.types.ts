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
   * Phase 2.4: Enhanced with configurable expiry period
   */
  static isSessionExpired(sessionData: SessionStorageData, expiryDays: number = 7): boolean {
    const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
    return Date.now() - sessionData.timestamp > expiryMs;
  }

  /**
   * Phase 2.4.2: Calculate storage size of session data in bytes
   */
  static calculateStorageSize(sessionData: SessionStorageData): number {
    try {
      const jsonString = JSON.stringify(sessionData);
      // Approximate UTF-8 byte size (more accurate than just string length)
      const byteSize = new Blob([jsonString]).size;
      return byteSize;
    } catch (error) {
      console.error('[SESSION-STORAGE] Failed to calculate storage size:', error);
      return 0;
    }
  }

  /**
   * Phase 2.4.3: Check if storage size exceeds limit
   * Default limit: 20MB (20 * 1024 * 1024 bytes)
   */
  static isStorageLimitExceeded(
    sessionData: SessionStorageData,
    limitMB: number = 20
  ): {
    exceeded: boolean;
    currentSizeMB: number;
    limitMB: number;
    percentageUsed: number;
  } {
    const currentSizeBytes = this.calculateStorageSize(sessionData);
    const currentSizeMB = currentSizeBytes / (1024 * 1024);
    const percentageUsed = (currentSizeMB / limitMB) * 100;

    return {
      exceeded: currentSizeMB > limitMB,
      currentSizeMB: parseFloat(currentSizeMB.toFixed(2)),
      limitMB,
      percentageUsed: parseFloat(percentageUsed.toFixed(1)),
    };
  }

  /**
   * Phase 2.4.4: Get cleanup recommendations based on storage and age
   */
  static getCleanupRecommendations(
    sessionData: SessionStorageData,
    config: {
      maxAgeDays?: number;
      maxStorageMB?: number;
      warnThresholdPercent?: number;
    } = {}
  ): {
    shouldCleanup: boolean;
    reason: string[];
    storageInfo: ReturnType<typeof SessionDataTransformer.isStorageLimitExceeded>;
    ageInfo: { ageInDays: number; maxAgeDays: number };
  } {
    const maxAgeDays = config.maxAgeDays ?? 7;
    const maxStorageMB = config.maxStorageMB ?? 20;
    const warnThresholdPercent = config.warnThresholdPercent ?? 80;

    const storageInfo = this.isStorageLimitExceeded(sessionData, maxStorageMB);
    const ageInDays = (Date.now() - sessionData.timestamp) / (24 * 60 * 60 * 1000);
    const ageInfo = { ageInDays: parseFloat(ageInDays.toFixed(1)), maxAgeDays };

    const reasons: string[] = [];
    let shouldCleanup = false;

    // Check age
    if (this.isSessionExpired(sessionData, maxAgeDays)) {
      reasons.push(`Session expired (${ageInfo.ageInDays} days old, limit: ${maxAgeDays} days)`);
      shouldCleanup = true;
    }

    // Check storage limit
    if (storageInfo.exceeded) {
      reasons.push(
        `Storage limit exceeded (${storageInfo.currentSizeMB}MB / ${storageInfo.limitMB}MB)`
      );
      shouldCleanup = true;
    }

    // Check warning threshold
    if (storageInfo.percentageUsed >= warnThresholdPercent && !storageInfo.exceeded) {
      reasons.push(
        `Storage usage high (${storageInfo.percentageUsed}% of ${storageInfo.limitMB}MB)`
      );
    }

    return {
      shouldCleanup,
      reason: reasons,
      storageInfo,
      ageInfo,
    };
  }

  /**
   * Phase 2.4.4: Optimize session data to reduce storage size
   * Trims scrollback to fit within storage limits
   */
  static optimizeSessionStorage(
    sessionData: SessionStorageData,
    targetSizeMB: number = 18 // 90% of 20MB default limit
  ): {
    optimized: boolean;
    originalSizeMB: number;
    newSizeMB: number;
    reductionPercent: number;
    message: string;
  } {
    const originalSize = this.calculateStorageSize(sessionData);
    const originalSizeMB = originalSize / (1024 * 1024);
    const targetSizeBytes = targetSizeMB * 1024 * 1024;

    if (originalSize <= targetSizeBytes) {
      return {
        optimized: false,
        originalSizeMB: parseFloat(originalSizeMB.toFixed(2)),
        newSizeMB: parseFloat(originalSizeMB.toFixed(2)),
        reductionPercent: 0,
        message: 'No optimization needed',
      };
    }

    // Reduce scrollback data to fit within target size
    let currentSize = originalSize;
    let reductionFactor = 0.9; // Start by reducing to 90%

    while (currentSize > targetSizeBytes && reductionFactor > 0.1) {
      if (sessionData.scrollbackData) {
        // Reduce scrollback for each terminal
        Object.keys(sessionData.scrollbackData).forEach((termId) => {
          const scrollback = sessionData.scrollbackData![termId];
          if (Array.isArray(scrollback)) {
            const targetLength = Math.floor(scrollback.length * reductionFactor);
            sessionData.scrollbackData![termId] = scrollback.slice(-targetLength);
          }
        });
      }

      currentSize = this.calculateStorageSize(sessionData);
      reductionFactor -= 0.1;
    }

    const newSizeMB = currentSize / (1024 * 1024);
    const reductionPercent = ((originalSize - currentSize) / originalSize) * 100;

    return {
      optimized: true,
      originalSizeMB: parseFloat(originalSizeMB.toFixed(2)),
      newSizeMB: parseFloat(newSizeMB.toFixed(2)),
      reductionPercent: parseFloat(reductionPercent.toFixed(1)),
      message: `Reduced storage from ${originalSizeMB.toFixed(2)}MB to ${newSizeMB.toFixed(2)}MB`,
    };
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
