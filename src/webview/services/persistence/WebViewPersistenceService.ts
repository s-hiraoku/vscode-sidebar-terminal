/**
 * WebView Persistence Service
 *
 * Clean Architecture - WebView Layer
 * Implements IPersistenceService for the WebView layer using browser storage.
 *
 * Responsibilities:
 * - Save/load terminal sessions using localStorage
 * - Temporary session storage (complementary to Extension storage)
 * - Quick session recovery for WebView state
 */

import {
  IPersistenceService,
  TerminalSessionData,
  PersistenceResult,
  PersistenceConfig,
} from '../../../interfaces/IPersistenceService';

/**
 * Storage data format for WebView
 */
interface WebViewStorageData {
  version: string;
  timestamp: number;
  sessions: TerminalSessionData[];
}

/**
 * WebView-specific persistence service
 * Uses browser localStorage for temporary storage
 */
export class WebViewPersistenceService implements IPersistenceService {
  private static readonly STORAGE_KEY = 'vscode-terminal-webview-sessions';
  private static readonly STORAGE_VERSION = '1.0.0';

  constructor(private readonly config: PersistenceConfig) {
    console.log('[WebView Persistence] Service initialized');
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

      await this.saveSessions(updatedSessions);

      console.log(`[WebView Persistence] Session saved: ${session.id}`);
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to save session: ${(error as Error).message}`;
      console.error(`[WebView Persistence] ${errorMessage}`);
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
      if (!this.isStorageAvailable()) {
        return {
          success: false,
          error: 'localStorage is not available',
        };
      }

      // Apply retention policy
      const retainedSessions = this.applyRetentionPolicy(sessions);

      // Optimize sessions for storage
      const optimizedSessions = retainedSessions.map((session) =>
        this.optimizeSession(session)
      );

      const storageData: WebViewStorageData = {
        version: WebViewPersistenceService.STORAGE_VERSION,
        timestamp: Date.now(),
        sessions: optimizedSessions,
      };

      localStorage.setItem(
        WebViewPersistenceService.STORAGE_KEY,
        JSON.stringify(storageData)
      );

      console.log(
        `[WebView Persistence] Saved ${optimizedSessions.length} sessions`
      );
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to save sessions: ${(error as Error).message}`;
      console.error(`[WebView Persistence] ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Load all saved sessions
   */
  async loadSessions(): Promise<TerminalSessionData[]> {
    try {
      if (!this.isStorageAvailable()) {
        console.warn('[WebView Persistence] localStorage is not available');
        return [];
      }

      const dataString = localStorage.getItem(
        WebViewPersistenceService.STORAGE_KEY
      );

      if (!dataString) {
        console.log('[WebView Persistence] No saved sessions found');
        return [];
      }

      const storageData: WebViewStorageData = JSON.parse(dataString);

      if (!this.validateStorageData(storageData)) {
        console.warn('[WebView Persistence] Invalid storage data format');
        return [];
      }

      console.log(
        `[WebView Persistence] Loaded ${storageData.sessions.length} sessions`
      );
      return storageData.sessions;
    } catch (error) {
      console.error(`[WebView Persistence] Failed to load sessions:`, error);
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

      console.log(`[WebView Persistence] Session deleted: ${sessionId}`);
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to delete session: ${(error as Error).message}`;
      console.error(`[WebView Persistence] ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Clear all saved sessions
   */
  async clearAllSessions(): Promise<PersistenceResult> {
    try {
      if (!this.isStorageAvailable()) {
        return {
          success: false,
          error: 'localStorage is not available',
        };
      }

      localStorage.removeItem(WebViewPersistenceService.STORAGE_KEY);

      console.log('[WebView Persistence] All sessions cleared');
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to clear sessions: ${(error as Error).message}`;
      console.error(`[WebView Persistence] ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if persistence is available
   */
  async isAvailable(): Promise<boolean> {
    return this.isStorageAvailable();
  }

  /**
   * Check if localStorage is available
   */
  private isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
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
      console.log(
        `[WebView Persistence] Retention policy applied: ${sorted.length} -> ${retained.length}`
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
   * Validate storage data format
   */
  private validateStorageData(data: any): data is WebViewStorageData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.version === 'string' &&
      typeof data.timestamp === 'number' &&
      Array.isArray(data.sessions)
    );
  }
}
