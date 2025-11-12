/**
 * Extension Persistence Service
 *
 * Clean Architecture - Extension Layer
 * Implements IPersistenceService for the Extension layer using VS Code APIs.
 *
 * Responsibilities:
 * - Save/load terminal sessions using VS Code ExtensionContext
 * - Compression and optimization for storage
 * - Session cleanup and retention management
 */

import * as vscode from 'vscode';
import {
  IPersistenceService,
  TerminalSessionData,
  PersistenceResult,
  PersistenceConfig,
} from '../../interfaces/IPersistenceService';
import { extension as log } from '../../utils/logger';

/**
 * Internal storage format
 */
interface StorageData {
  version: string;
  timestamp: number;
  sessions: TerminalSessionData[];
}

/**
 * Extension-specific persistence service
 * Uses VS Code globalState for storage
 */
export class ExtensionPersistenceService implements IPersistenceService {
  private static readonly STORAGE_KEY = 'terminal-sessions-v2';
  private static readonly STORAGE_VERSION = '2.0.0';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly config: PersistenceConfig
  ) {
    log('🔧 [PERSISTENCE] ExtensionPersistenceService initialized');
  }

  /**
   * Save a single terminal session
   */
  async saveSession(session: TerminalSessionData): Promise<PersistenceResult> {
    try {
      const existingSessions = await this.loadSessions();
      const updatedSessions = [
        ...existingSessions.filter((s) => s.id !== session.id),
        session,
      ];

      // Apply retention policy
      const retainedSessions = this.applyRetentionPolicy(updatedSessions);

      await this.saveSessions(retainedSessions);

      log(`📦 [PERSISTENCE] Session saved: ${session.id}`);
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to save session: ${(error as Error).message}`;
      log(`❌ [PERSISTENCE] ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Save multiple terminal sessions
   */
  async saveSessions(
    sessions: TerminalSessionData[]
  ): Promise<PersistenceResult> {
    try {
      // Apply retention policy
      const retainedSessions = this.applyRetentionPolicy(sessions);

      // Optimize scrollback data
      const optimizedSessions = retainedSessions.map((session) =>
        this.optimizeSession(session)
      );

      const storageData: StorageData = {
        version: ExtensionPersistenceService.STORAGE_VERSION,
        timestamp: Date.now(),
        sessions: optimizedSessions,
      };

      // Compress and save
      const compressedData = this.compressData(storageData);
      await this.context.globalState.update(
        ExtensionPersistenceService.STORAGE_KEY,
        compressedData
      );

      log(`📦 [PERSISTENCE] Saved ${optimizedSessions.length} sessions`);
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to save sessions: ${(error as Error).message}`;
      log(`❌ [PERSISTENCE] ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Load all saved sessions
   */
  async loadSessions(): Promise<TerminalSessionData[]> {
    try {
      const compressedData = this.context.globalState.get<string>(
        ExtensionPersistenceService.STORAGE_KEY
      );

      if (!compressedData) {
        log('📦 [PERSISTENCE] No saved sessions found');
        return [];
      }

      const storageData = this.decompressData(compressedData);

      if (!this.validateStorageData(storageData)) {
        log('⚠️ [PERSISTENCE] Invalid storage data format');
        return [];
      }

      log(`📦 [PERSISTENCE] Loaded ${storageData.sessions.length} sessions`);
      return storageData.sessions;
    } catch (error) {
      log(`❌ [PERSISTENCE] Failed to load sessions: ${error}`);
      return [];
    }
  }

  /**
   * Load a specific session by ID
   */
  async loadSession(sessionId: string): Promise<TerminalSessionData | null> {
    const sessions = await this.loadSessions();
    return sessions.find((s) => s.id === sessionId) || null;
  }

  /**
   * Delete a specific session
   */
  async deleteSession(sessionId: string): Promise<PersistenceResult> {
    try {
      const sessions = await this.loadSessions();
      const filteredSessions = sessions.filter((s) => s.id !== sessionId);

      await this.saveSessions(filteredSessions);

      log(`🗑️ [PERSISTENCE] Session deleted: ${sessionId}`);
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to delete session: ${(error as Error).message}`;
      log(`❌ [PERSISTENCE] ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Clear all saved sessions
   */
  async clearAllSessions(): Promise<PersistenceResult> {
    try {
      await this.context.globalState.update(
        ExtensionPersistenceService.STORAGE_KEY,
        undefined
      );

      log('🗑️ [PERSISTENCE] All sessions cleared');
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to clear sessions: ${(error as Error).message}`;
      log(`❌ [PERSISTENCE] ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if persistence is available
   */
  async isAvailable(): Promise<boolean> {
    return !!this.context.globalState;
  }

  /**
   * Apply retention policy to sessions
   */
  private applyRetentionPolicy(
    sessions: TerminalSessionData[]
  ): TerminalSessionData[] {
    // Sort by lastActiveAt descending
    const sorted = [...sessions].sort(
      (a, b) => b.lastActiveAt - a.lastActiveAt
    );

    // Keep only maxSessions most recent
    const retained = sorted.slice(0, this.config.maxSessions);

    if (retained.length < sorted.length) {
      log(
        `📦 [PERSISTENCE] Retention policy applied: ${sorted.length} -> ${retained.length}`
      );
    }

    return retained;
  }

  /**
   * Optimize session data for storage
   */
  private optimizeSession(
    session: TerminalSessionData
  ): TerminalSessionData {
    if (!session.scrollbackData) {
      return session;
    }

    // Limit scrollback size
    const lines = session.scrollbackData.split('\n');
    if (lines.length > this.config.maxScrollbackSize) {
      const truncated = lines
        .slice(-this.config.maxScrollbackSize)
        .join('\n');
      return {
        ...session,
        scrollbackData: truncated,
      };
    }

    return session;
  }

  /**
   * Compress storage data for efficient storage
   */
  private compressData(data: StorageData): string {
    // Simple JSON compression (could be enhanced with actual compression)
    return JSON.stringify(data);
  }

  /**
   * Decompress storage data
   */
  private decompressData(compressed: string): StorageData {
    return JSON.parse(compressed);
  }

  /**
   * Validate storage data format
   */
  private validateStorageData(data: any): data is StorageData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.version === 'string' &&
      typeof data.timestamp === 'number' &&
      Array.isArray(data.sessions)
    );
  }
}
