/**
 * Session Restore Manager
 *
 * Handles terminal session restoration logic, extracted from LightweightTerminalWebviewManager
 * for better separation of concerns and testability.
 *
 * Responsibilities:
 * - Track restored terminals to prevent duplicate restoration
 * - Coordinate scrollback data restoration
 * - Manage restoration state flags
 */

import { webview as log } from '../../utils/logger';
import { TerminalCreationService } from '../services/TerminalCreationService';
import { TerminalInstance } from '../interfaces/ManagerInterfaces';
import { SESSION_RESTORE_CONSTANTS } from '../constants/webview';

export interface SessionData {
  terminalId: string;
  terminalName: string;
  scrollbackData?: string[];
  sessionRestoreMessage?: string;
}

export interface SessionRestoreResult {
  success: boolean;
  terminalId: string;
  linesRestored: number;
  reason?: string;
}

export interface ISessionRestoreCallbacks {
  getTerminalInstance: (terminalId: string) => TerminalInstance | undefined;
  createTerminal: (
    terminalId: string,
    terminalName: string
  ) => Promise<import('@xterm/xterm').Terminal | null>;
  getActiveTerminalId: () => string | null;
}

/**
 * Manages terminal session restoration with deduplication
 */
export class SessionRestoreManager {
  private readonly processedScrollbackRequests = new Set<string>();
  private _isRestoringSession = false;

  constructor(private readonly callbacks: ISessionRestoreCallbacks) {
    log('[SESSION-RESTORE] SessionRestoreManager initialized');
  }

  /**
   * Check if session restore is in progress
   */
  public isRestoringSession(): boolean {
    return this._isRestoringSession;
  }

  /**
   * Set session restore flag
   */
  public setRestoringSession(isRestoring: boolean): void {
    this._isRestoringSession = isRestoring;
    log(`[SESSION-RESTORE] isRestoringSession set to: ${isRestoring}`);
  }

  /**
   * Check if terminal has already been restored
   */
  public isTerminalRestored(terminalId: string): boolean {
    return (
      this.processedScrollbackRequests.has(terminalId) ||
      TerminalCreationService.isTerminalRestoring(terminalId)
    );
  }

  /**
   * Restore terminal session from Extension data
   *
   * This method checks for duplicate restoration attempts using
   * TerminalCreationService.isTerminalRestoring() to prevent
   * overwriting previously restored scrollback data.
   */
  public async restoreSession(sessionData: SessionData): Promise<SessionRestoreResult> {
    const { terminalId, terminalName, scrollbackData, sessionRestoreMessage } = sessionData;

    log(`[RESTORATION] Starting session restore for terminal: ${terminalId}`);

    // Check if terminal is already being restored or was recently restored
    if (this.isTerminalRestored(terminalId)) {
      log(`[RESTORATION] Terminal ${terminalId} is already being restored or processed, skipping`);
      return {
        success: true,
        terminalId,
        linesRestored: 0,
        reason: 'already_restored',
      };
    }

    // Mark terminal as restoring (blocks auto-save)
    TerminalCreationService.markTerminalRestoring(terminalId);

    try {
      // 1. Create terminal if it doesn't exist
      let terminalInstance = this.callbacks.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        log(`[RESTORATION] Creating terminal for restore: ${terminalId}`);
        const xtermInstance = await this.callbacks.createTerminal(terminalId, terminalName);
        if (!xtermInstance) {
          log(`[RESTORATION] Failed to create terminal for restore: ${terminalId}`);
          this.markRestoreComplete(terminalId);
          return {
            success: false,
            terminalId,
            linesRestored: 0,
            reason: 'terminal_creation_failed',
          };
        }

        // Wait for terminal to be fully created
        await new Promise((resolve) =>
          setTimeout(resolve, SESSION_RESTORE_CONSTANTS.TERMINAL_CREATION_WAIT_MS)
        );
        terminalInstance = this.callbacks.getTerminalInstance(terminalId);
      }

      if (!terminalInstance?.terminal) {
        log(`[RESTORATION] Terminal instance not available for restore: ${terminalId}`);
        this.markRestoreComplete(terminalId);
        return {
          success: false,
          terminalId,
          linesRestored: 0,
          reason: 'terminal_not_available',
        };
      }

      const terminal = terminalInstance.terminal;
      let linesRestored = 0;

      // 2. Clear existing content (only if we're actually restoring data)
      if (scrollbackData && scrollbackData.length > 0) {
        terminal.clear();
      }

      // 3. Restore session restore message if available
      if (sessionRestoreMessage) {
        terminal.writeln(sessionRestoreMessage);
        log(`[RESTORATION] Restored session message for terminal: ${terminalId}`);
      }

      // 4. Restore scrollback data if available
      if (scrollbackData && scrollbackData.length > 0) {
        log(
          `[RESTORATION] Restoring ${scrollbackData.length} lines of scrollback for terminal: ${terminalId}`
        );

        // Write each line to restore scrollback history
        for (const line of scrollbackData) {
          if (line.trim()) {
            terminal.writeln(line);
            linesRestored++;
          }
        }

        log(`[RESTORATION] Scrollback restored for terminal: ${terminalId} (${linesRestored} lines)`);
      }

      // Mark as processed to prevent duplicate restoration
      this.processedScrollbackRequests.add(terminalId);
      this.markRestoreComplete(terminalId);

      // 5. Focus terminal if it's the active one
      if (this.callbacks.getActiveTerminalId() === terminalId) {
        terminal.focus();
      }

      log(`[RESTORATION] Session restore completed for terminal: ${terminalId}`);
      return {
        success: true,
        terminalId,
        linesRestored,
      };
    } catch (error) {
      log(`[RESTORATION] Error during session restore:`, error);
      // Even on error, mark as restored to prevent infinite retries
      this.markRestoreComplete(terminalId);
      return {
        success: false,
        terminalId,
        linesRestored: 0,
        reason: error instanceof Error ? error.message : 'unknown_error',
      };
    }
  }

  /**
   * Mark restoration as complete
   */
  private markRestoreComplete(terminalId: string): void {
    TerminalCreationService.markTerminalRestored(terminalId);
  }

  /**
   * Clear restoration state for a terminal (used when terminal is deleted)
   */
  public clearRestorationState(terminalId: string): void {
    this.processedScrollbackRequests.delete(terminalId);
    log(`[SESSION-RESTORE] Cleared restoration state for terminal: ${terminalId}`);
  }

  /**
   * Dispose and clear all state
   */
  public dispose(): void {
    this.processedScrollbackRequests.clear();
    this._isRestoringSession = false;
    log('[SESSION-RESTORE] SessionRestoreManager disposed');
  }
}
