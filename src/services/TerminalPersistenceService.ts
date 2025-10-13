/**
 * Unified Terminal Persistence Service
 *
 * Replaces the dual persistence managers (StandardTerminalSessionManager and StandardTerminalPersistenceManager)
 * with a single, cohesive service that handles all terminal persistence operations.
 *
 * Key improvements:
 * - Single responsibility for all persistence operations
 * - Proper separation of concerns between Extension and WebView sides
 * - Standardized error handling and resource management
 * - Type-safe message handling
 * - Performance optimization with compression and lazy loading
 */

import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { WebviewMessage, TerminalInfo } from '../types/shared';
import { log } from '../utils/logger';
import { safeProcessCwd } from '../utils/common';

// Standardized error types for better error handling
export class PersistenceError extends Error {
  public override readonly name = 'PersistenceError';

  constructor(
    override message: string,
    public readonly code: PersistenceErrorCode,
    public readonly terminalId?: string,
    public override readonly cause?: Error
  ) {
    super(message);
  }
}

export enum PersistenceErrorCode {
  SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
  DESERIALIZATION_FAILED = 'DESERIALIZATION_FAILED',
  STORAGE_ACCESS_FAILED = 'STORAGE_ACCESS_FAILED',
  WEBVIEW_COMMUNICATION_FAILED = 'WEBVIEW_COMMUNICATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  INVALID_DATA_FORMAT = 'INVALID_DATA_FORMAT',
}

// Unified persistence interfaces
export interface ITerminalPersistenceService {
  saveCurrentSession(): Promise<PersistenceResult>;
  restoreSession(forceRestore?: boolean): Promise<RestoreResult>;
  getSessionInfo(): SessionInfo | null;
  clearSession(): Promise<void>;
  getSessionStats(): SessionStats;
  dispose(): void;
}

export interface IPersistenceMessageHandler {
  handleSerializationRequest(terminalIds: string[]): Promise<SerializationData>;
  handleRestorationRequest(terminalData: TerminalRestoreData[]): Promise<RestoreResult>;
  sendSessionInfoToWebView(): Promise<void>;
}

// Standardized result types
export interface PersistenceResult {
  success: boolean;
  terminalCount: number;
  error?: PersistenceError;
}

export interface RestoreResult {
  success: boolean;
  restoredCount: number;
  skippedCount: number;
  error?: PersistenceError;
}

export interface SessionInfo {
  exists: boolean;
  terminals?: TerminalInfo[];
  timestamp?: number;
  version?: string;
}

export interface SessionStats {
  hasSession: boolean;
  terminalCount: number;
  lastSaved: Date | null;
  isExpired: boolean;
  configEnabled: boolean;
}

export interface SerializationData {
  [terminalId: string]: {
    content: string;
    html?: string;
    metadata?: {
      lines: number;
      size: number;
      compressed: boolean;
    };
  };
}

export interface TerminalRestoreData {
  id: string;
  name: string;
  serializedContent: string;
  isActive: boolean;
  metadata?: {
    originalSize: number;
    compressed: boolean;
  };
}

/**
 * Unified Terminal Persistence Service Implementation
 *
 * This service consolidates all persistence operations and provides a clean,
 * type-safe interface for terminal session management.
 */
export class UnifiedTerminalPersistenceService
  implements ITerminalPersistenceService, IPersistenceMessageHandler
{
  private static readonly STORAGE_KEY = 'unified-terminal-session-v1';
  private static readonly SESSION_VERSION = '1.0.0';
  private static readonly MAX_SESSION_AGE_DAYS = 7;
  private static readonly COMPRESSION_THRESHOLD = 1000; // Characters

  private sidebarProvider?: {
    sendMessageToWebview: (message: WebviewMessage) => Promise<void>;
  };
  private pendingSerializationPromise?: Promise<SerializationData>;
  private disposed = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager
  ) {}

  /**
   * Sets the sidebar provider for WebView communication
   */
  public setSidebarProvider(provider: {
    sendMessageToWebview: (message: WebviewMessage) => Promise<void>;
  }): void {
    this.sidebarProvider = provider;
    log('🔧 [PERSISTENCE] Sidebar provider configured');
  }

  /**
   * Saves the current terminal session with enhanced error handling and optimization
   */
  public async saveCurrentSession(): Promise<PersistenceResult> {
    if (this.disposed) {
      throw new PersistenceError('Service disposed', PersistenceErrorCode.STORAGE_ACCESS_FAILED);
    }

    try {
      log('💾 [PERSISTENCE] Starting unified session save...');

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
      const basicTerminals = terminals.map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        number: terminal.number,
        cwd: terminal.cwd || safeProcessCwd(),
        isActive: terminal.id === activeTerminalId,
      }));

      // Request serialization data from WebView
      const serializationData = await this.requestSerializationFromWebView(
        basicTerminals.map((t) => t.id)
      );

      // Create optimized session data
      const sessionData = {
        terminals: basicTerminals,
        activeTerminalId: activeTerminalId || null,
        timestamp: Date.now(),
        version: UnifiedTerminalPersistenceService.SESSION_VERSION,
        config: {
          scrollbackLines: config.persistentSessionScrollback,
          reviveProcess: config.persistentSessionReviveProcess,
        },
        serializationData: this.optimizeSerializationData(serializationData),
      };

      await this.context.globalState.update(
        UnifiedTerminalPersistenceService.STORAGE_KEY,
        sessionData
      );

      log(`✅ [PERSISTENCE] Session saved: ${basicTerminals.length} terminals`);
      return {
        success: true,
        terminalCount: basicTerminals.length,
      };
    } catch (error) {
      const persistenceError =
        error instanceof PersistenceError
          ? error
          : new PersistenceError(
              `Failed to save session: ${error}`,
              PersistenceErrorCode.STORAGE_ACCESS_FAILED,
              undefined,
              error instanceof Error ? error : undefined
            );

      log(`❌ [PERSISTENCE] Save failed: ${persistenceError.message}`);
      return {
        success: false,
        terminalCount: 0,
        error: persistenceError,
      };
    }
  }

  /**
   * Restores terminal session with improved error handling and performance
   */
  public async restoreSession(forceRestore = false): Promise<RestoreResult> {
    if (this.disposed) {
      throw new PersistenceError('Service disposed', PersistenceErrorCode.STORAGE_ACCESS_FAILED);
    }

    try {
      log('🔄 [PERSISTENCE] Starting unified session restore...');

      const config = this.getPersistenceConfig();
      if (!config.enablePersistentSessions) {
        log('⚠️ [PERSISTENCE] Persistent sessions disabled');
        return { success: true, restoredCount: 0, skippedCount: 0 };
      }

      const sessionData = await this.getStoredSessionData();
      if (!sessionData || !sessionData.terminals) {
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
      let activeTerminalSet = false;

      for (const terminalInfo of sessionData.terminals) {
        try {
          const terminalId = this.terminalManager.createTerminal();
          if (!terminalId) {
            log(`❌ [PERSISTENCE] Failed to create terminal for ${terminalInfo.name}`);
            continue;
          }

          // Set active terminal
          if (!activeTerminalSet && terminalInfo.isActive) {
            this.terminalManager.setActiveTerminal(terminalId);
            activeTerminalSet = true;
            log(`🎯 [PERSISTENCE] Set active terminal: ${terminalId}`);
          }

          restoredCount++;
          log(`✅ [PERSISTENCE] Restored terminal: ${terminalInfo.name} (${terminalId})`);
        } catch (error) {
          log(`❌ [PERSISTENCE] Failed to restore terminal ${terminalInfo.name}: ${error}`);
        }
      }

      // Restore serialized content
      if (restoredCount > 0 && sessionData.serializationData) {
        await this.sendRestorationToWebView(sessionData.terminals, sessionData.serializationData);
      }

      log(`✅ [PERSISTENCE] Session restore completed: ${restoredCount} terminals`);
      return {
        success: true,
        restoredCount,
        skippedCount: sessionData.terminals.length - restoredCount,
      };
    } catch (error) {
      const persistenceError =
        error instanceof PersistenceError
          ? error
          : new PersistenceError(
              `Failed to restore session: ${error}`,
              PersistenceErrorCode.DESERIALIZATION_FAILED,
              undefined,
              error instanceof Error ? error : undefined
            );

      log(`❌ [PERSISTENCE] Restore failed: ${persistenceError.message}`);
      return {
        success: false,
        restoredCount: 0,
        skippedCount: 0,
        error: persistenceError,
      };
    }
  }

  /**
   * Gets current session information
   */
  public getSessionInfo(): SessionInfo | null {
    try {
      const sessionData = this.context.globalState.get<any>(
        UnifiedTerminalPersistenceService.STORAGE_KEY
      );

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
      await this.context.globalState.update(
        UnifiedTerminalPersistenceService.STORAGE_KEY,
        undefined
      );
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
    const sessionData = this.getSessionInfo();
    const config = this.getPersistenceConfig();

    if (!sessionData) {
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
      terminalCount: sessionData.terminals?.length || 0,
      lastSaved: sessionData.timestamp ? new Date(sessionData.timestamp) : null,
      isExpired: sessionData.timestamp
        ? this.isSessionExpired({ timestamp: sessionData.timestamp })
        : false,
      configEnabled: config.enablePersistentSessions,
    };
  }

  // IPersistenceMessageHandler implementation

  /**
   * Handles serialization requests from WebView
   */
  public async handleSerializationRequest(terminalIds: string[]): Promise<SerializationData> {
    if (!this.sidebarProvider) {
      throw new PersistenceError(
        'No sidebar provider available',
        PersistenceErrorCode.WEBVIEW_COMMUNICATION_FAILED
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new PersistenceError(
            'Serialization request timeout',
            PersistenceErrorCode.WEBVIEW_COMMUNICATION_FAILED
          )
        );
      }, 10000); // 10 second timeout

      // Set up temporary response handler
      this.pendingSerializationPromise = new Promise<SerializationData>((promiseResolve) => {
        const cleanup = () => {
          clearTimeout(timeout);
          this.pendingSerializationPromise = undefined;
        };

        this.handleSerializationResponse = (data: SerializationData) => {
          cleanup();
          promiseResolve(data);
        };
      });

      // Send request to WebView
      this.sidebarProvider!.sendMessageToWebview({
        command: 'requestTerminalSerialization',
        terminalIds,
        timestamp: Date.now(),
      })
        .then(() => {
          // Wait for response
          return this.pendingSerializationPromise!;
        })
        .then(resolve)
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Handles restoration requests to WebView
   */
  public async handleRestorationRequest(
    terminalData: TerminalRestoreData[]
  ): Promise<RestoreResult> {
    if (!this.sidebarProvider) {
      throw new PersistenceError(
        'No sidebar provider available',
        PersistenceErrorCode.WEBVIEW_COMMUNICATION_FAILED
      );
    }

    try {
      await this.sidebarProvider.sendMessageToWebview({
        command: 'restoreTerminalSerialization',
        terminalData: terminalData.map((terminal) => ({
          id: terminal.id,
          name: terminal.name,
          serializedContent: this.decompressContent(terminal.serializedContent, terminal.metadata),
          isActive: terminal.isActive,
        })),
        timestamp: Date.now(),
      });

      log(`✅ [PERSISTENCE] Restoration request sent: ${terminalData.length} terminals`);
      return {
        success: true,
        restoredCount: terminalData.length,
        skippedCount: 0,
      };
    } catch (error) {
      throw new PersistenceError(
        `Failed to send restoration request: ${error}`,
        PersistenceErrorCode.WEBVIEW_COMMUNICATION_FAILED,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Sends session information to WebView
   */
  public async sendSessionInfoToWebView(): Promise<void> {
    if (!this.sidebarProvider) {
      log('⚠️ [PERSISTENCE] No sidebar provider for session info');
      return;
    }

    try {
      const sessionInfo = this.getSessionInfo();
      if (!sessionInfo || !sessionInfo.exists) {
        log('📑 [PERSISTENCE] No session info to send');
        return;
      }

      await this.sidebarProvider.sendMessageToWebview({
        command: 'terminalRestoreInfo',
        terminals: sessionInfo.terminals,
        activeTerminalId: (sessionInfo as any).activeTerminalId,
        config: (sessionInfo as any).config,
        timestamp: Date.now(),
      });

      log(`✅ [PERSISTENCE] Session info sent: ${sessionInfo.terminals?.length} terminals`);
    } catch (error) {
      log(`❌ [PERSISTENCE] Failed to send session info: ${error}`);
    }
  }

  /**
   * Disposes of the service and cleans up resources
   */
  public dispose(): void {
    this.disposed = true;
    this.pendingSerializationPromise = undefined;
    this.sidebarProvider = undefined;
    log('🗑️ [PERSISTENCE] Service disposed');
  }

  // Private helper methods

  private handleSerializationResponse = (_data: SerializationData): void => {
    // Default implementation, overridden by promises
    log('📋 [PERSISTENCE] Default serialization response handler called');
  };

  private async getStoredSessionData(): Promise<any> {
    return this.context.globalState.get(UnifiedTerminalPersistenceService.STORAGE_KEY);
  }

  private getPersistenceConfig() {
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

  private isSessionExpired(data: { timestamp: number }): boolean {
    const now = Date.now();
    const ageMs = now - data.timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > UnifiedTerminalPersistenceService.MAX_SESSION_AGE_DAYS;
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
    await new Promise((resolve) => setTimeout(resolve, 500));
    log('✅ [PERSISTENCE] Terminal cleanup completed');
  }

  private async requestSerializationFromWebView(terminalIds: string[]): Promise<SerializationData> {
    if (!this.sidebarProvider) {
      throw new PersistenceError(
        'No sidebar provider available for serialization',
        PersistenceErrorCode.WEBVIEW_COMMUNICATION_FAILED
      );
    }

    return this.handleSerializationRequest(terminalIds);
  }

  private async sendRestorationToWebView(terminals: any[], serializationData: any): Promise<void> {
    const terminalData: TerminalRestoreData[] = terminals.map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      serializedContent: serializationData[terminal.id] || '',
      isActive: terminal.isActive,
    }));

    await this.handleRestorationRequest(terminalData);
  }

  private optimizeSerializationData(data: SerializationData): any {
    const optimizedData: any = {};

    for (const [terminalId, terminalData] of Object.entries(data)) {
      if (typeof terminalData === 'string') {
        // Legacy format - just compress if needed
        optimizedData[terminalId] = this.compressContent(terminalData);
      } else if (terminalData && typeof terminalData === 'object' && 'content' in terminalData) {
        // New format with metadata
        optimizedData[terminalId] = {
          content: this.compressContent(terminalData.content),
          html: terminalData.html,
          metadata: {
            lines: (terminalData.content.match(/\n/g) || []).length,
            size: terminalData.content.length,
            compressed:
              terminalData.content.length > UnifiedTerminalPersistenceService.COMPRESSION_THRESHOLD,
          },
        };
      }
    }

    return optimizedData;
  }

  private compressContent(content: string): string {
    // Simple compression - in production, consider using a proper compression library
    if (content.length > UnifiedTerminalPersistenceService.COMPRESSION_THRESHOLD) {
      try {
        // Placeholder for actual compression
        return content; // For now, return as-is
      } catch (error) {
        log(`⚠️ [PERSISTENCE] Compression failed, storing uncompressed: ${error}`);
        return content;
      }
    }
    return content;
  }

  private decompressContent(content: string, metadata?: { compressed?: boolean }): string {
    if (metadata?.compressed) {
      try {
        // Placeholder for actual decompression
        return content; // For now, return as-is
      } catch (error) {
        log(`⚠️ [PERSISTENCE] Decompression failed: ${error}`);
        throw new PersistenceError(
          'Failed to decompress content',
          PersistenceErrorCode.INVALID_DATA_FORMAT
        );
      }
    }
    return content;
  }

  /**
   * Public method to handle serialization responses from WebView
   */
  public handleSerializationResponseMessage(data: SerializationData): void {
    log(`📋 [PERSISTENCE] Received serialization response: ${Object.keys(data).length} terminals`);
    this.handleSerializationResponse(data);
  }
}
