/**
 * Extension Persistence Service
 *
 * Handles persistence operations on the Extension side.
 * Uses VS Code's globalState and workspace storage.
 *
 * @see Issue #223 - Phase 2: Persistence Layer Separation
 */

import * as vscode from 'vscode';
import {
  IExtensionPersistencePort,
  SaveSessionRequestDTO,
  SaveSessionResponseDTO,
  RestoreSessionRequestDTO,
  RestoreSessionResponseDTO,
  ClearSessionRequestDTO,
  ClearSessionResponseDTO,
  SessionDataDTO,
} from '../../communication';

/**
 * Extension-side persistence service
 * Implements IExtensionPersistencePort for Extension layer storage
 */
export class ExtensionPersistenceService implements IExtensionPersistencePort {
  private static readonly STORAGE_KEY = 'secondaryTerminal.sessionData';
  private static readonly SESSION_VERSION = '2.0.0';
  private static readonly MAX_STORAGE_SIZE = 20 * 1024 * 1024; // 20MB
  private static readonly RETENTION_DAYS = 7;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Save the current session
   */
  async saveSession(_request: SaveSessionRequestDTO): Promise<SaveSessionResponseDTO> {
    try {
      const sessionData = await this.collectSessionData();
      const success = await this.storeSessionData(sessionData);

      if (!success) {
        return {
          success: false,
          savedTerminals: 0,
          totalSize: 0,
          error: 'Failed to store session data',
          timestamp: Date.now(),
        };
      }

      const size = await this.getStorageSize();

      return {
        success: true,
        savedTerminals: sessionData.terminals.length,
        totalSize: size,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        savedTerminals: 0,
        totalSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Restore a session
   */
  async restoreSession(request: RestoreSessionRequestDTO): Promise<RestoreSessionResponseDTO> {
    try {
      const sessionData = await this.getSessionData(request.sessionId);

      if (!sessionData) {
        return {
          success: false,
          restoredTerminals: 0,
          skippedTerminals: 0,
          errors: ['No session data found'],
          timestamp: Date.now(),
        };
      }

      // Session data will be used by TerminalManager to restore terminals
      return {
        success: true,
        restoredTerminals: sessionData.terminals.length,
        skippedTerminals: 0,
        errors: [],
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        restoredTerminals: 0,
        skippedTerminals: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Clear stored session data
   */
  async clearSession(request: ClearSessionRequestDTO): Promise<ClearSessionResponseDTO> {
    try {
      if (request.clearAll) {
        await this.context.globalState.update(ExtensionPersistenceService.STORAGE_KEY, undefined);
        await this.context.workspaceState.update(
          ExtensionPersistenceService.STORAGE_KEY,
          undefined
        );
        return {
          success: true,
          clearedSessions: 1,
          timestamp: Date.now(),
        };
      }

      if (request.sessionId) {
        // Clear specific session (if we implement multiple sessions in the future)
        return {
          success: true,
          clearedSessions: 1,
          timestamp: Date.now(),
        };
      }

      return {
        success: false,
        clearedSessions: 0,
        error: 'No session specified',
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        clearedSessions: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const sessionData = await this.getSessionData();
      if (!sessionData) {
        return;
      }

      const now = Date.now();
      const retentionMs = ExtensionPersistenceService.RETENTION_DAYS * 24 * 60 * 60 * 1000;

      if (now - sessionData.timestamp > retentionMs) {
        await this.context.globalState.update(ExtensionPersistenceService.STORAGE_KEY, undefined);
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Get session data
   */
  async getSessionData(_sessionId?: string): Promise<SessionDataDTO | null> {
    try {
      // Try workspace state first, then global state
      let data =
        this.context.workspaceState.get<SessionDataDTO>(ExtensionPersistenceService.STORAGE_KEY) ||
        this.context.globalState.get<SessionDataDTO>(ExtensionPersistenceService.STORAGE_KEY);

      return data || null;
    } catch (error) {
      console.error('Failed to get session data:', error);
      return null;
    }
  }

  /**
   * Store session data
   */
  async storeSessionData(data: SessionDataDTO): Promise<boolean> {
    try {
      const size = JSON.stringify(data).length;

      if (size > ExtensionPersistenceService.MAX_STORAGE_SIZE) {
        console.warn('Session data exceeds maximum storage size');
        return false;
      }

      // Store in both workspace and global state for redundancy
      await this.context.workspaceState.update(ExtensionPersistenceService.STORAGE_KEY, data);
      await this.context.globalState.update(ExtensionPersistenceService.STORAGE_KEY, data);

      return true;
    } catch (error) {
      console.error('Failed to store session data:', error);
      return false;
    }
  }

  /**
   * Get storage size
   */
  async getStorageSize(): Promise<number> {
    try {
      const data = await this.getSessionData();
      if (!data) {
        return 0;
      }
      return JSON.stringify(data).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check storage health
   */
  async checkStorageHealth(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const size = await this.getStorageSize();
      const maxSize = ExtensionPersistenceService.MAX_STORAGE_SIZE;
      const usagePercent = (size / maxSize) * 100;

      if (usagePercent > 90) {
        return {
          healthy: false,
          message: `Storage usage is ${usagePercent.toFixed(1)}% (${size} bytes)`,
        };
      }

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Dispose of the persistence service
   */
  dispose(): void {
    // No resources to dispose
  }

  /**
   * Collect current session data
   * This will be called by TerminalManager to get current state
   */
  private async collectSessionData(): Promise<SessionDataDTO> {
    // This is a placeholder - actual implementation will collect data from TerminalManager
    return {
      version: ExtensionPersistenceService.SESSION_VERSION,
      timestamp: Date.now(),
      terminals: [],
      workspaceId: vscode.workspace.workspaceFolders?.[0]?.uri.toString(),
    };
  }
}
