/**
 * WebView Persistence Service
 *
 * Handles persistence operations on the WebView side.
 * Uses localStorage and sessionStorage for temporary state.
 *
 * @see Issue #223 - Phase 2: Persistence Layer Separation
 */

import {
  IWebViewPersistencePort,
  SaveSessionRequestDTO,
  SaveSessionResponseDTO,
  RestoreSessionRequestDTO,
  RestoreSessionResponseDTO,
  ClearSessionRequestDTO,
  ClearSessionResponseDTO,
  SessionDataDTO,
} from '../../communication';

/**
 * WebView-side persistence service
 * Implements IWebViewPersistencePort for WebView layer storage
 */
export class WebViewPersistenceService implements IWebViewPersistencePort {
  private static readonly STORAGE_KEY = 'secondaryTerminal.webview.session';
  private static readonly SESSION_VERSION = '2.0.0';
  private static readonly MAX_LOCAL_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Save the current session
   */
  async saveSession(_request: SaveSessionRequestDTO): Promise<SaveSessionResponseDTO> {
    try {
      const sessionData = await this.collectLocalSessionData();
      const success = await this.storeLocalSessionData(sessionData);

      if (!success) {
        return {
          success: false,
          savedTerminals: 0,
          totalSize: 0,
          error: 'Failed to store local session data',
          timestamp: Date.now(),
        };
      }

      const size = await this.getLocalStorageSize();

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
  async restoreSession(
    _request: RestoreSessionRequestDTO
  ): Promise<RestoreSessionResponseDTO> {
    try {
      const sessionData = await this.getLocalSessionData();

      if (!sessionData) {
        return {
          success: false,
          restoredTerminals: 0,
          skippedTerminals: 0,
          errors: ['No local session data found'],
          timestamp: Date.now(),
        };
      }

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
  async clearSession(_request: ClearSessionRequestDTO): Promise<ClearSessionResponseDTO> {
    try {
      const success = await this.clearLocalStorage();

      return {
        success,
        clearedSessions: success ? 1 : 0,
        error: success ? undefined : 'Failed to clear local storage',
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
      const sessionData = await this.getLocalSessionData();
      if (!sessionData) {
        return;
      }

      const now = Date.now();
      const retentionMs = 1 * 24 * 60 * 60 * 1000; // 1 day for WebView cache

      if (now - sessionData.timestamp > retentionMs) {
        await this.clearLocalStorage();
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Get local session data
   */
  async getLocalSessionData(): Promise<SessionDataDTO | null> {
    try {
      const data = localStorage.getItem(WebViewPersistenceService.STORAGE_KEY);
      if (!data) {
        return null;
      }

      return JSON.parse(data) as SessionDataDTO;
    } catch (error) {
      console.error('Failed to get local session data:', error);
      return null;
    }
  }

  /**
   * Store local session data
   */
  async storeLocalSessionData(data: SessionDataDTO): Promise<boolean> {
    try {
      const serialized = JSON.stringify(data);
      const size = serialized.length;

      if (size > WebViewPersistenceService.MAX_LOCAL_STORAGE_SIZE) {
        console.warn('Local session data exceeds maximum storage size');
        return false;
      }

      localStorage.setItem(WebViewPersistenceService.STORAGE_KEY, serialized);
      return true;
    } catch (error) {
      console.error('Failed to store local session data:', error);
      return false;
    }
  }

  /**
   * Clear local storage
   */
  async clearLocalStorage(): Promise<boolean> {
    try {
      localStorage.removeItem(WebViewPersistenceService.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear local storage:', error);
      return false;
    }
  }

  /**
   * Get local storage size
   */
  async getLocalStorageSize(): Promise<number> {
    try {
      const data = localStorage.getItem(WebViewPersistenceService.STORAGE_KEY);
      return data ? data.length : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Dispose of the persistence service
   */
  dispose(): void {
    // No resources to dispose
  }

  /**
   * Collect current local session data
   * This will be called by WebView managers to get current state
   */
  private async collectLocalSessionData(): Promise<SessionDataDTO> {
    // This is a placeholder - actual implementation will collect data from WebView managers
    return {
      version: WebViewPersistenceService.SESSION_VERSION,
      timestamp: Date.now(),
      terminals: [],
    };
  }
}
