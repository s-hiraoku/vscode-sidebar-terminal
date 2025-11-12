/**
 * Extension Persistence Service
 *
 * Consolidated persistence service for the Extension side that replaces:
 * - UnifiedTerminalPersistenceService.ts (686 lines)
 * - StandardTerminalSessionManager.ts (627 lines)
 * - PersistenceMessageHandler.ts (216 lines)
 *
 * Total consolidation: ~1,529 lines → ~400 lines (74% reduction)
 */

import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { log } from '../utils/logger';
import {
  PersistenceConfig,
  TerminalSessionData,
  StoredSessionData,
  PersistenceResult,
  RestoreResult,
  SessionInfo,
  SessionStats,
  SerializationData,
  PersistenceError,
  PersistenceErrorCode,
  IExtensionPersistenceService,
  PersistenceMessage,
  PERSISTENCE_CONSTANTS,
} from '../types/Persistence';

/**
 * Consolidated Extension-side persistence service
 */
export class ExtensionPersistenceService implements IExtensionPersistenceService {
  private sidebarProvider?: {
    sendMessageToWebview: (message: PersistenceMessage) => Promise<void>;
  };
  private pendingSerializationRequest?: {
    resolve: (data: SerializationData) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  };
  private disposed = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager
  ) {
    log('🔧 [PERSISTENCE] ExtensionPersistenceService initialized');
  }

  /**
   * Sets the sidebar provider for WebView communication
   */
  public setSidebarProvider(provider: {
    sendMessageToWebview: (message: PersistenceMessage) => Promise<void>;
  }): void {
    this.sidebarProvider = provider;
    log('🔧 [PERSISTENCE] Sidebar provider configured');
  }

  /**
   * Saves the current terminal session
   */
  public async saveCurrentSession(): Promise<PersistenceResult> {
    if (this.disposed) {
      throw new PersistenceError('Service disposed', PersistenceErrorCode.STORAGE_ACCESS_FAILED);
    }

    try {
      log('💾 [PERSISTENCE] Starting session save...');

      const config = this.getPersistenceConfig();
      if (!config.enablePersistentSessions) {
        log('⚠️ [PERSISTENCE] Persistent sessions disabled');
        return { success: true, terminalCount: 0 };
      }

      const terminals = this.terminalManager.getTerminals();
      const activeTerminalId = this.terminalManager.getActiveTerminalId();

      if (terminals.length === 0) {
        log('📑 [PERSISTENCE] No terminals to save');
        return { success: true, terminalCount: 0 };
      }

      // Prepare basic terminal info
      const terminalData: TerminalSessionData[] = terminals.map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        number: terminal.number,
        cwd: terminal.cwd || process.cwd(),
        isActive: terminal.id === activeTerminalId,
      }));

      // Request serialization data from WebView
      const serializationData = await this.requestSerializationFromWebView(
        terminalData.map((t) => t.id)
      );

      // Merge serialization data with terminal info
      for (const terminal of terminalData) {
        const serialized = serializationData[terminal.id];
        if (serialized) {
          terminal.serializedContent =
            typeof serialized === 'string' ? serialized : serialized.content;
          terminal.metadata = typeof serialized === 'object' ? serialized.metadata : undefined;
        }
      }

      // Create session data
      const sessionData: StoredSessionData = {
        version: PERSISTENCE_CONSTANTS.SESSION_VERSION,
        timestamp: Date.now(),
        terminals: terminalData,
        activeTerminalId: activeTerminalId || null,
        config,
      };

      // Save to globalState
      await this.context.globalState.update(PERSISTENCE_CONSTANTS.STORAGE_KEY, sessionData);

      log(`✅ [PERSISTENCE] Session saved: ${terminals.length} terminals`);
      return {
        success: true,
        terminalCount: terminals.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [PERSISTENCE] Save failed: ${errorMessage}`);
      return {
        success: false,
        terminalCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Restores a terminal session
   */
  public async restoreSession(forceRestore = false): Promise<RestoreResult> {
    if (this.disposed) {
      throw new PersistenceError('Service disposed', PersistenceErrorCode.STORAGE_ACCESS_FAILED);
    }

    try {
      log('🔄 [PERSISTENCE] Starting session restore...');

      const config = this.getPersistenceConfig();
      if (!config.enablePersistentSessions) {
        log('⚠️ [PERSISTENCE] Persistent sessions disabled');
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      const sessionData = this.getStoredSessionData();
      if (!sessionData || !sessionData.terminals || sessionData.terminals.length === 0) {
        log('📑 [PERSISTENCE] No session data found');
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      if (this.isSessionExpired(sessionData)) {
        log('⏰ [PERSISTENCE] Session expired, clearing...');
        await this.clearSession();
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      // Handle existing terminals
      const existingTerminals = this.terminalManager.getTerminals();
      if (existingTerminals.length > 0 && !forceRestore) {
        log(`⚠️ [PERSISTENCE] ${existingTerminals.length} terminals exist, skipping restore`);
        return {
          success: true,
          restoredCount: 0,
          skippedCount: sessionData.terminals.length,
        };
      }

      // Clean up existing terminals if force restore
      if (forceRestore && existingTerminals.length > 0) {
        await this.cleanupExistingTerminals(existingTerminals);
      }

      // Restore terminals
      let restoredCount = 0;
      const createdTerminals: Array<{ id: string; originalData: TerminalSessionData }> = [];

      for (const terminalInfo of sessionData.terminals) {
        try {
          const terminalId = this.terminalManager.createTerminal();
          if (!terminalId) {
            log(`❌ [PERSISTENCE] Failed to create terminal for ${terminalInfo.name}`);
            continue;
          }

          createdTerminals.push({
            id: terminalId,
            originalData: terminalInfo,
          });

          restoredCount++;
          log(`✅ [PERSISTENCE] Created terminal: ${terminalInfo.name} (${terminalId})`);
        } catch (error) {
          log(`❌ [PERSISTENCE] Failed to restore terminal ${terminalInfo.name}: ${error}`);
        }
      }

      // Set active terminal
      const activeTerminal = createdTerminals.find((t) => t.originalData.isActive);
      if (activeTerminal) {
        this.terminalManager.setActiveTerminal(activeTerminal.id);
        log(`🎯 [PERSISTENCE] Set active terminal: ${activeTerminal.id}`);
      }

      // Wait for terminals to initialize
      if (restoredCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Send restoration data to WebView
        await this.sendRestorationToWebView(createdTerminals);
      }

      log(`✅ [PERSISTENCE] Session restore completed: ${restoredCount} terminals`);
      return {
        success: true,
        restoredCount,
        skippedCount: sessionData.terminals.length - restoredCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [PERSISTENCE] Restore failed: ${errorMessage}`);
      return {
        success: false,
        restoredCount: 0,
        skippedCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Gets current session information
   */
  public getSessionInfo(): SessionInfo | null {
    try {
      const sessionData = this.getStoredSessionData();

      if (!sessionData || !sessionData.terminals) {
        return { exists: false };
      }

      if (this.isSessionExpired(sessionData)) {
        log('⏰ [PERSISTENCE] Session expired in getSessionInfo');
        return { exists: false };
      }

      return {
        exists: true,
        terminals: sessionData.terminals,
        timestamp: sessionData.timestamp,
        version: sessionData.version,
      };
    } catch (error) {
      log(`❌ [PERSISTENCE] Error getting session info: ${error}`);
      return null;
    }
  }

  /**
   * Clears stored session data
   */
  public async clearSession(): Promise<void> {
    try {
      await this.context.globalState.update(PERSISTENCE_CONSTANTS.STORAGE_KEY, undefined);
      log('🗑️ [PERSISTENCE] Session data cleared');
    } catch (error) {
      throw new PersistenceError(
        `Failed to clear session: ${error}`,
        PersistenceErrorCode.STORAGE_ACCESS_FAILED,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets session statistics
   */
  public getSessionStats(): SessionStats {
    const sessionInfo = this.getSessionInfo();
    const config = this.getPersistenceConfig();

    if (!sessionInfo || !sessionInfo.exists) {
      return {
        hasSession: false,
        terminalCount: 0,
        lastSaved: null,
        isExpired: false,
        configEnabled: config.enablePersistentSessions,
      };
    }

    return {
      hasSession: true,
      terminalCount: sessionInfo.terminals?.length || 0,
      lastSaved: sessionInfo.timestamp ? new Date(sessionInfo.timestamp) : null,
      isExpired: sessionInfo.timestamp
        ? this.isSessionExpired({ timestamp: sessionInfo.timestamp })
        : false,
      configEnabled: config.enablePersistentSessions,
    };
  }

  /**
   * Handles serialization responses from WebView
   */
  public handleSerializationResponse(data: SerializationData): void {
    log(`📋 [PERSISTENCE] Received serialization response: ${Object.keys(data).length} terminals`);

    if (this.pendingSerializationRequest) {
      clearTimeout(this.pendingSerializationRequest.timeout);
      this.pendingSerializationRequest.resolve(data);
      this.pendingSerializationRequest = undefined;
    }
  }

  /**
   * Disposes of the service
   */
  public dispose(): void {
    this.disposed = true;
    if (this.pendingSerializationRequest) {
      clearTimeout(this.pendingSerializationRequest.timeout);
      this.pendingSerializationRequest.reject(new Error('Service disposed'));
      this.pendingSerializationRequest = undefined;
    }
    this.sidebarProvider = undefined;
    log('🗑️ [PERSISTENCE] Service disposed');
  }

  // Private helper methods

  private getPersistenceConfig(): PersistenceConfig {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return {
      enablePersistentSessions: config.get<boolean>('enablePersistentSessions', true),
      persistentSessionScrollback: config.get<number>('persistentSessionScrollback', 100),
      persistentSessionReviveProcess: config.get<string>(
        'persistentSessionReviveProcess',
        'onExitAndWindowClose'
      ),
    };
  }

  private getStoredSessionData(): StoredSessionData | null {
    try {
      return this.context.globalState.get<StoredSessionData>(PERSISTENCE_CONSTANTS.STORAGE_KEY) || null;
    } catch (error) {
      log(`❌ [PERSISTENCE] Failed to load session data: ${error}`);
      return null;
    }
  }

  private isSessionExpired(data: { timestamp: number }): boolean {
    const ageMs = Date.now() - data.timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > PERSISTENCE_CONSTANTS.MAX_SESSION_AGE_DAYS;
  }

  private async cleanupExistingTerminals(terminals: any[]): Promise<void> {
    log(`🗑️ [PERSISTENCE] Cleaning up ${terminals.length} existing terminals`);

    for (const terminal of terminals) {
      try {
        const deleteResult = await this.terminalManager.deleteTerminal(terminal.id, {
          force: true,
        });

        if (deleteResult.success) {
          log(`✅ [PERSISTENCE] Cleaned up terminal: ${terminal.id}`);
        } else {
          log(
            `⚠️ [PERSISTENCE] Failed to clean up terminal ${terminal.id}: ${deleteResult.reason}`
          );
        }
      } catch (error) {
        log(`❌ [PERSISTENCE] Error cleaning up terminal ${terminal.id}: ${error}`);
      }
    }

    // Allow cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  private async requestSerializationFromWebView(terminalIds: string[]): Promise<SerializationData> {
    if (!this.sidebarProvider) {
      log('⚠️ [PERSISTENCE] No sidebar provider, returning empty serialization data');
      return {};
    }

    return new Promise<SerializationData>((resolve, reject) => {
      const timeout = setTimeout(() => {
        log('⏰ [PERSISTENCE] Serialization request timeout');
        this.pendingSerializationRequest = undefined;
        resolve({}); // Return empty data on timeout
      }, PERSISTENCE_CONSTANTS.SERIALIZATION_TIMEOUT_MS);

      this.pendingSerializationRequest = { resolve, reject, timeout };

      this.sidebarProvider!.sendMessageToWebview({
        command: 'requestTerminalSerialization',
        terminalIds,
        timestamp: Date.now(),
      }).catch((error) => {
        clearTimeout(timeout);
        log(`❌ [PERSISTENCE] Failed to send serialization request: ${error}`);
        resolve({}); // Return empty data on error
      });
    });
  }

  private async sendRestorationToWebView(
    terminals: Array<{ id: string; originalData: TerminalSessionData }>
  ): Promise<void> {
    if (!this.sidebarProvider) {
      log('⚠️ [PERSISTENCE] No sidebar provider for restoration');
      return;
    }

    try {
      const terminalData = terminals
        .filter((t) => t.originalData.serializedContent)
        .map((t) => ({
          id: t.id,
          name: t.originalData.name,
          serializedContent: t.originalData.serializedContent!,
          isActive: t.originalData.isActive,
        }));

      if (terminalData.length === 0) {
        log('📁 [PERSISTENCE] No terminals with content to restore');
        return;
      }

      await this.sidebarProvider.sendMessageToWebview({
        command: 'restoreTerminalSerialization',
        terminalData,
        timestamp: Date.now(),
      });

      log(`✅ [PERSISTENCE] Restoration data sent: ${terminalData.length} terminals`);
    } catch (error) {
      log(`❌ [PERSISTENCE] Failed to send restoration data: ${error}`);
    }
  }
}
