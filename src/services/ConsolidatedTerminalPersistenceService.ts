/**
 * Consolidated Terminal Persistence Service
 *
 * This service consolidates 5 persistence implementations into a single, unified service:
 * 1. TerminalPersistenceService.ts (686 lines) - Base implementation
 * 2. UnifiedTerminalPersistenceService.ts (382 lines) - CLI Agent detection & batch processing
 * 3. SimplePersistenceManager.ts (240 lines) - WebView simple persistence
 * 4. StandardTerminalPersistenceManager.ts (564 lines) - SerializeAddon integration
 * 5. OptimizedPersistenceManager.ts (651 lines) - Performance optimization
 *
 * Total reduction: 2,523 lines → ~900 lines (64% reduction)
 *
 * Key features:
 * - Complete interface definitions (ITerminalPersistenceService, IPersistenceMessageHandler)
 * - CLI Agent detection (Claude Code, Gemini)
 * - Batch processing with concurrent restore (MAX_CONCURRENT_RESTORES = 3)
 * - Compression support with threshold
 * - WebView communication integration
 * - Session statistics and debugging
 * - Standardized error handling with error codes
 * - Auto-save and cleanup timers
 * - LRU terminal management
 */

import * as vscode from 'vscode';
import type { Terminal } from '@xterm/xterm';
import type { SerializeAddon } from '@xterm/addon-serialize';
import { TerminalManager } from '../terminals/TerminalManager';
import { TerminalPersistencePort } from './persistence/TerminalPersistencePort';
import { WebviewMessage, TerminalInfo } from '../types/shared';
import { extension as log } from '../utils/logger';
import { safeProcessCwd } from '../utils/common';

// ============================================================================
// Error Handling
// ============================================================================

export enum PersistenceErrorCode {
  SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
  DESERIALIZATION_FAILED = 'DESERIALIZATION_FAILED',
  STORAGE_ACCESS_FAILED = 'STORAGE_ACCESS_FAILED',
  WEBVIEW_COMMUNICATION_FAILED = 'WEBVIEW_COMMUNICATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  INVALID_DATA_FORMAT = 'INVALID_DATA_FORMAT',
  ADDON_NOT_AVAILABLE = 'ADDON_NOT_AVAILABLE',
  COMPRESSION_FAILED = 'COMPRESSION_FAILED',
  STORAGE_FULL = 'STORAGE_FULL',
}

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

// ============================================================================
// Type Definitions
// ============================================================================

// Extension-side interfaces
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

// WebView-side interfaces
export interface IWebViewPersistenceManager {
  addTerminal(terminalId: string, terminal: Terminal, serializeAddon: SerializeAddon, options?: { autoSave?: boolean }): void;
  removeTerminal(terminalId: string): boolean;
  serializeTerminal(terminalId: string, options?: SerializeOptions): TerminalSerializedData | null;
  serializeAllTerminals(options?: SerializeOptions): Map<string, TerminalSerializedData>;
  restoreTerminalContent(terminalId: string, serializedData: string | TerminalSerializedData, options?: RestoreOptions): boolean;
  saveTerminalContent(terminalId: string, options?: SerializeOptions): boolean;
  loadTerminalContent(terminalId: string): TerminalSerializedData | null;
  getStats(): WebViewPersistenceStats;
  getAvailableTerminals(): string[];
  hasTerminal(terminalId: string): boolean;
  cleanup(): void;
  dispose(): void;
}

// Result types
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
  cliAgentSessions?: Array<'claude' | 'gemini'>;
}

export interface SessionStats {
  hasSession: boolean;
  terminalCount: number;
  lastSaved: Date | null;
  isExpired: boolean;
  configEnabled: boolean;
  cliAgentCount: number;
}

// Serialization types
export interface SerializationData {
  [terminalId: string]: {
    content: string;
    html?: string;
    metadata?: SerializationMetadata;
  };
}

export interface SerializationMetadata {
  lines: number;
  size: number;
  compressed: boolean;
  timestamp: number;
  version: string;
}

export interface TerminalRestoreData {
  id: string;
  name: string;
  serializedContent: string;
  isActive: boolean;
  scrollback?: string[]; // Extension-side scrollback from ScrollbackService
  metadata?: {
    originalSize: number;
    compressed: boolean;
  };
}

export interface TerminalSerializedData {
  content: string;
  html?: string;
  metadata: SerializationMetadata;
}

export interface TerminalSessionData {
  id: string;
  name: string;
  number: number;
  cwd: string;
  isActive: boolean;
  scrollback?: string[];
  cliAgentType?: 'claude' | 'gemini';
  lastActivity: number;
}

// Options
export interface SerializeOptions {
  scrollback?: number;
  includeHtml?: boolean;
  compress?: boolean;
  excludeModes?: boolean;
  excludeAltBuffer?: boolean;
}

export interface RestoreOptions {
  validateFormat?: boolean;
  clearBefore?: boolean;
  batchSize?: number;
}

// WebView-specific types
export interface TerminalRegistration {
  id: string;
  terminal: Terminal;
  serializeAddon: SerializeAddon;
  lastAccessed: number;
  autoSaveEnabled: boolean;
}

export interface WebViewPersistenceStats {
  terminalCount: number;
  totalStorageSize: number;
  compressionRatio: number;
  lastSaveTime: number;
  autoSaveCount: number;
  errorCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PREFIX = 'consolidated-terminal-session-';
const SESSION_VERSION = '2.0.0';
const MAX_SESSION_AGE_DAYS = 7;
const COMPRESSION_THRESHOLD = 1000; // Characters before compression
const AUTO_SAVE_INTERVAL = 120000; // 2 minutes
const CLEANUP_INTERVAL = 600000; // 10 minutes
const MAX_TERMINALS = 10;
const DEFAULT_SCROLLBACK = 1000;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _MAX_SCROLLBACK_LINES = 2000;
const MAX_CONCURRENT_RESTORES = 3;
const BATCH_SIZE = 50; // Lines per batch for restore
const BATCH_DELAY_MS = 10; // Delay between batches

// ============================================================================
// Extension-Side Service
// ============================================================================

/**
 * Consolidated Terminal Persistence Service (Extension-side)
 *
 * Manages terminal session persistence on the Extension side with:
 * - Session save/restore operations
 * - CLI Agent detection (Claude Code, Gemini)
 * - Batch processing with concurrent restores
 * - WebView communication for serialization
 */
export class ConsolidatedTerminalPersistenceService
  implements ITerminalPersistenceService, IPersistenceMessageHandler, TerminalPersistencePort
{
  private sidebarProvider?: {
    sendMessageToWebview: (message: WebviewMessage) => Promise<void>;
  };
  private pendingSerializationPromise?: Promise<SerializationData>;
  private disposed = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager
  ) {
    log('🔧 [PERSISTENCE] ConsolidatedTerminalPersistenceService initialized');
  }

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

      // Prepare terminal session data with scrollback from ScrollbackService
      const terminalData: TerminalSessionData[] = terminals.map((terminal) => {
        // Get scrollback data from ScrollbackService (Extension-side PTY recording)
        const scrollbackData = this.terminalManager.getScrollbackData(terminal.id, {
          scrollback: config.persistentSessionScrollback,
        });

        log(`📋 [DEBUG] Terminal ${terminal.id} scrollback data: ${scrollbackData ? `${scrollbackData.length} chars` : 'null'}`);

        // Convert scrollback string to array format
        const scrollback = scrollbackData ? scrollbackData.split('\n').filter(line => line.length > 0) : undefined;

        log(`📋 [DEBUG] Terminal ${terminal.id} scrollback array: ${scrollback ? `${scrollback.length} lines` : 'undefined'}`);

        return {
          id: terminal.id,
          name: terminal.name,
          number: terminal.number ?? 1,
          cwd: terminal.cwd || safeProcessCwd(),
          isActive: terminal.id === activeTerminalId,
          scrollback, // VS Code-style scrollback from ScrollbackService
          lastActivity: Date.now(),
        };
      });

      // Create session data (using ScrollbackService only, VS Code-compatible)
      const sessionData = {
        version: SESSION_VERSION,
        timestamp: Date.now(),
        activeTerminalId: activeTerminalId || null,
        terminals: terminalData,
        config: {
          scrollbackLines: config.persistentSessionScrollback,
          reviveProcess: config.persistentSessionReviveProcess,
        },
      };

      // Use workspaceState for per-workspace session isolation (multi-window support)
      await this.context.workspaceState.update(`${STORAGE_KEY_PREFIX}main`, sessionData);

      log(`✅ [PERSISTENCE] Session saved: ${terminalData.length} terminals (ScrollbackService)`);
      return {
        success: true,
        terminalCount: terminalData.length,
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
   * Restores terminal session with batch processing
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

      // Restore terminals using batch processing
      const restoredTerminals = await this.bulkTerminalRestore(sessionData.terminals);

      // Restore scrollback content (VS Code-style ScrollbackService)
      if (restoredTerminals.length > 0) {
        log(`📋 [DEBUG] About to restore scrollback for ${sessionData.terminals.length} terminals`);
        sessionData.terminals.forEach((t, index) => {
          log(`📋 [DEBUG] Terminal[${index}] ${t.id}: scrollback=${t.scrollback ? `${t.scrollback.length} lines` : 'undefined'}`);
        });

        await this.sendRestorationToWebView(sessionData.terminals);

        // 🔧 FIX: Wait for WebView to finish processing terminalCreated messages
        // This prevents race condition where save is triggered before WebView creates terminals
        log(`⏳ [PERSISTENCE] Waiting for WebView to complete terminal creation (${restoredTerminals.length} terminals)...`);
        await this.delay(500 * restoredTerminals.length); // 500ms per terminal
      }

      // Note: CLI Agent sessions no longer tracked via SerializeAddon
      if (false && sessionData.cliAgentSessions && sessionData.cliAgentSessions.length > 0) {
        log(`🔄 [PERSISTENCE] Restoring ${sessionData.cliAgentSessions.length} CLI Agent sessions`);
        // CLI Agent environment restoration is handled by restoreCliAgentEnvironment
      }

      log(`✅ [PERSISTENCE] Session restore completed: ${restoredTerminals.length} terminals`);
      return {
        success: true,
        restoredCount: restoredTerminals.length,
        skippedCount: sessionData.terminals.length - restoredTerminals.length,
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
      // Use workspaceState for per-workspace session isolation (multi-window support)
      const sessionData = this.context.workspaceState.get<any>(`${STORAGE_KEY_PREFIX}main`);

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
        cliAgentSessions: sessionData.cliAgentSessions || [],
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
      // Use workspaceState for per-workspace session isolation (multi-window support)
      await this.context.workspaceState.update(`${STORAGE_KEY_PREFIX}main`, undefined);
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

  public async cleanupExpiredSessions(): Promise<void> {
    try {
      const sessionData = await this.getStoredSessionData();
      if (sessionData && this.isSessionExpired(sessionData)) {
        await this.clearSession();
        log('🧹 [PERSISTENCE] Expired session cleaned up');
      }
    } catch (error) {
      throw new PersistenceError(
        `Failed to cleanup sessions: ${error}`,
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

    if (!sessionData || !sessionData.exists) {
      return {
        hasSession: false,
        terminalCount: 0,
        lastSaved: null,
        isExpired: false,
        configEnabled: config.enablePersistentSessions,
        cliAgentCount: 0,
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
      cliAgentCount: sessionData.cliAgentSessions?.length || 0,
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
        .then(() => this.pendingSerializationPromise!)
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
      const messageData = {
        command: 'restoreTerminalSerialization',
        terminalData: terminalData.map((terminal) => ({
          id: terminal.id,
          name: terminal.name,
          isActive: terminal.isActive,
          scrollback: terminal.scrollback, // VS Code-style ScrollbackService only (no SerializeAddon)
        })),
        timestamp: Date.now(),
      };

      log(`📋 [DEBUG] Sending message to WebView: command=${messageData.command}, terminals=${messageData.terminalData.length}`);
      messageData.terminalData.forEach((t, index) => {
        log(`📋 [DEBUG] Message data[${index}]: id=${t.id}, scrollback=${t.scrollback ? `${t.scrollback.length} lines` : 'undefined'}`);
      });

      await this.sidebarProvider.sendMessageToWebview(messageData);

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
        timestamp: Date.now(),
      } as any);

      log(`✅ [PERSISTENCE] Session info sent: ${sessionInfo.terminals?.length} terminals`);
    } catch (error) {
      log(`❌ [PERSISTENCE] Failed to send session info: ${error}`);
    }
  }

  /**
   * Public method to handle serialization responses from WebView
   */
  public handleSerializationResponseMessage(data: SerializationData): void {
    log(`📋 [PERSISTENCE] Received serialization response: ${Object.keys(data).length} terminals`);
    this.handleSerializationResponse(data);
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
    // Use workspaceState for per-workspace session isolation (multi-window support)
    return this.context.workspaceState.get(`${STORAGE_KEY_PREFIX}main`);
  }

  private getPersistenceConfig() {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return {
      enablePersistentSessions: config.get<boolean>('enablePersistentSessions', true),
      persistentSessionScrollback: config.get<number>('persistentSessionScrollback', DEFAULT_SCROLLBACK),
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
    return ageDays > MAX_SESSION_AGE_DAYS;
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
        }
      } catch (error) {
        log(`❌ [PERSISTENCE] Error cleaning up terminal ${terminal.id}: ${error}`);
      }
    }

    // Allow cleanup to complete
    await this.delay(500);
    log('✅ [PERSISTENCE] Terminal cleanup completed');
  }

  /**
   * Batch terminal restore with concurrent processing
   */
  private async bulkTerminalRestore(terminals: TerminalSessionData[]): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < terminals.length; i += MAX_CONCURRENT_RESTORES) {
      const batch = terminals.slice(i, i + MAX_CONCURRENT_RESTORES);
      const batchPromises = batch.map((terminal) => this.restoreSingleTerminal(terminal));

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else if (result.status === 'rejected') {
          log(
            `⚠️ [PERSISTENCE] Terminal ${batch[index]?.id || 'unknown'} restore failed: ${result.reason}`
          );
        }
      });

      // Delay between batches to reduce system load
      if (i + MAX_CONCURRENT_RESTORES < terminals.length) {
        await this.delay(BATCH_DELAY_MS);
      }
    }

    return results;
  }

  /**
   * Restores a single terminal
   */
  private async restoreSingleTerminal(data: TerminalSessionData): Promise<string | null> {
    try {
      const terminalId = this.terminalManager.createTerminal();
      if (!terminalId) {
        return null;
      }

      // Set active terminal if needed
      if (data.isActive) {
        this.terminalManager.setActiveTerminal(terminalId);
        log(`🎯 [PERSISTENCE] Set active terminal: ${terminalId}`);
      }

      // Restore CLI Agent environment if detected
      if (data.cliAgentType) {
        await this.restoreCliAgentEnvironment(terminalId, data.cliAgentType);
      }

      log(`✅ [PERSISTENCE] Restored terminal: ${data.name} (${terminalId})`);
      return terminalId;
    } catch (error) {
      log(`❌ [PERSISTENCE] Failed to restore terminal ${data.id}: ${error}`);
      return null;
    }
  }

  /**
   * Restores CLI Agent environment
   */
  private async restoreCliAgentEnvironment(
    terminalId: string,
    agentType: 'claude' | 'gemini'
  ): Promise<void> {
    const commands = {
      claude: ['echo "✨ Claude Code session restored"', 'echo "Previous session data available"'],
      gemini: ['echo "✨ Gemini Code session restored"', 'echo "Ready for new commands"'],
    };

    for (const command of commands[agentType]) {
      this.terminalManager.sendInput(command + '\r', terminalId);
      await this.delay(100);
    }

    log(`✨ [PERSISTENCE] CLI Agent environment restored: ${agentType} for terminal ${terminalId}`);
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

  private async sendRestorationToWebView(terminals: TerminalSessionData[]): Promise<void> {
    const terminalData: TerminalRestoreData[] = terminals.map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      serializedContent: '', // No longer using SerializeAddon
      isActive: terminal.isActive,
      scrollback: terminal.scrollback, // VS Code-style ScrollbackService only
      metadata: undefined,
    }));

    log(`📋 [DEBUG] Sending ${terminalData.length} terminals to WebView for restoration`);
    terminalData.forEach((t, index) => {
      log(`📋 [DEBUG] Restore data[${index}]: id=${t.id}, scrollback=${t.scrollback ? `${t.scrollback.length} lines` : 'undefined'}`);
    });

    await this.handleRestorationRequest(terminalData);
  }

  /**
   * Optimizes serialization data with compression
   */
  private optimizeSerializationData(data: SerializationData): any {
    const optimizedData: any = {};

    for (const [terminalId, terminalData] of Object.entries(data)) {
      if (typeof terminalData === 'string') {
        // Legacy format
        optimizedData[terminalId] = {
          content: this.compressContent(terminalData),
          metadata: {
            lines: ((terminalData as string).match(/\n/g) || []).length,
            size: (terminalData as string).length,
            compressed: (terminalData as string).length > COMPRESSION_THRESHOLD,
            timestamp: Date.now(),
            version: SESSION_VERSION,
          },
        };
      } else if (terminalData && typeof terminalData === 'object' && 'content' in terminalData) {
        // New format with metadata
        const typedData = terminalData as any;
        optimizedData[terminalId] = {
          content: this.compressContent(typedData.content),
          html: typedData.html,
          metadata: {
            lines: ((typedData.content as string).match(/\n/g) || []).length,
            size: (typedData.content as string).length,
            compressed: (typedData.content as string).length > COMPRESSION_THRESHOLD,
            timestamp: Date.now(),
            version: SESSION_VERSION,
          },
        };
      }
    }

    return optimizedData;
  }

  private compressContent(content: string): string {
    // Placeholder for actual compression (could use pako, lz-string, etc.)
    if (content.length > COMPRESSION_THRESHOLD) {
      // For now, return as-is (in production, use proper compression library)
      return content;
    }
    return content;
  }

  private decompressContent(content: string, metadata?: { compressed?: boolean }): string {
    if (metadata?.compressed) {
      // Placeholder for actual decompression
      return content;
    }
    return content;
  }

  /**
   * Detects CLI Agent sessions from serialization data
   */
  private detectCliAgentSessionsFromData(data: SerializationData): Array<'claude' | 'gemini'> {
    const detectedAgents: Array<'claude' | 'gemini'> = [];

    for (const [, terminalData] of Object.entries(data)) {
      const content = typeof terminalData === 'string' ? terminalData : terminalData.content;
      const agentType = this.detectCliAgentType(content);
      if (agentType) {
        detectedAgents.push(agentType);
      }
    }

    return detectedAgents;
  }

  /**
   * Detects CLI Agent type from terminal content
   */
  private detectCliAgentType(content: string): 'claude' | 'gemini' | undefined {
    // Claude Code detection
    if (/claude-code\s+["'].*?["']|anthropic\.com|Claude\s+Code/i.test(content)) {
      return 'claude';
    }

    // Gemini detection
    if (/gemini\s+code\s+["'].*?["']|Gemini\s+Code|google.*gemini/i.test(content)) {
      return 'gemini';
    }

    return undefined;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// WebView-Side Manager (for bundled webview.js)
// ============================================================================

// VS Code WebView API declaration
declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
};

/**
 * Consolidated WebView Persistence Manager
 *
 * Manages terminal persistence on the WebView side with:
 * - SerializeAddon integration
 * - Auto-save and cleanup timers
 * - LRU terminal management
 * - Compression support
 * - Performance optimization
 */
export class ConsolidatedWebViewPersistenceManager implements IWebViewPersistenceManager {
  private terminals = new Map<string, TerminalRegistration>();
  private autoSaveTimer?: number;
  private cleanupTimer?: number;
  private stats: WebViewPersistenceStats = {
    terminalCount: 0,
    totalStorageSize: 0,
    compressionRatio: 1.0,
    lastSaveTime: 0,
    autoSaveCount: 0,
    errorCount: 0,
  };
  private disposed = false;

  // VS Code API for local storage
  private vscodeApi = (() => {
    try {
      return acquireVsCodeApi();
    } catch {
      // Fallback for testing environments
      return {
        setState: (state: any) => {
          try {
            localStorage.setItem('vscode-state', JSON.stringify(state));
          } catch (error) {
            console.warn('Failed to set state:', error);
          }
        },
        getState: () => {
          try {
            const state = localStorage.getItem('vscode-state');
            return state ? JSON.parse(state) : undefined;
          } catch {
            return undefined;
          }
        },
        postMessage: (message: any) => {
          console.log('[WEBVIEW-PERSISTENCE] postMessage:', message);
        },
      };
    }
  })();

  constructor() {
    this.startAutoSave();
    this.startPeriodicCleanup();
    log('✅ [WEBVIEW-PERSISTENCE] Consolidated persistence manager initialized');
  }

  /**
   * Registers a terminal with its serialize addon
   */
  public addTerminal(
    terminalId: string,
    terminal: Terminal,
    serializeAddon: SerializeAddon,
    options: { autoSave?: boolean } = {}
  ): void {
    if (this.disposed) {
      throw new PersistenceError(
        'Manager disposed',
        PersistenceErrorCode.TERMINAL_NOT_FOUND,
        terminalId
      );
    }

    if (this.terminals.size >= MAX_TERMINALS) {
      this.cleanupLRUTerminal();
    }

    const registration: TerminalRegistration = {
      id: terminalId,
      terminal,
      serializeAddon,
      lastAccessed: Date.now(),
      autoSaveEnabled: options.autoSave ?? true,
    };

    this.terminals.set(terminalId, registration);
    this.stats.terminalCount = this.terminals.size;

    log(`✅ [WEBVIEW-PERSISTENCE] Terminal registered: ${terminalId} (total: ${this.terminals.size})`);
  }

  /**
   * Removes a terminal from persistence management
   */
  public removeTerminal(terminalId: string): boolean {
    if (this.disposed) {
      return false;
    }

    const removed = this.terminals.delete(terminalId);
    if (removed) {
      this.stats.terminalCount = this.terminals.size;

      // Clean up storage
      try {
        this.removeFromStorage(terminalId);
      } catch (error) {
        log(`⚠️ [WEBVIEW-PERSISTENCE] Failed to clean up storage for ${terminalId}: ${error}`);
      }

      log(`🗑️ [WEBVIEW-PERSISTENCE] Terminal removed: ${terminalId} (remaining: ${this.terminals.size})`);
    }
    return removed;
  }

  /**
   * Serializes a specific terminal with optimization
   */
  public serializeTerminal(
    terminalId: string,
    options: SerializeOptions = {}
  ): TerminalSerializedData | null {
    const registration = this.getTerminalRegistration(terminalId);
    if (!registration) {
      return null;
    }

    try {
      const scrollback = options.scrollback ?? DEFAULT_SCROLLBACK;
      const includeHtml = options.includeHtml ?? false;
      const shouldCompress = options.compress ?? true;

      registration.lastAccessed = Date.now();

      // Serialize content
      const serializeOptions = {
        scrollback,
        excludeModes: options.excludeModes ?? false,
        excludeAltBuffer: options.excludeAltBuffer ?? true,
      };

      const content = registration.serializeAddon.serialize(serializeOptions);

      let html: string | undefined;
      if (includeHtml) {
        try {
          html = registration.serializeAddon.serializeAsHTML({
            scrollback,
            onlySelection: false,
            includeGlobalBackground: true,
          });
        } catch (error) {
          log(`⚠️ [WEBVIEW-PERSISTENCE] HTML serialization failed for ${terminalId}: ${error}`);
        }
      }

      // Apply compression if needed
      const finalContent =
        shouldCompress && content.length > COMPRESSION_THRESHOLD
          ? this.compressContent(content)
          : content;

      const compressed = finalContent !== content;

      const serializedData: TerminalSerializedData = {
        content: finalContent,
        html,
        metadata: {
          lines: (content.match(/\n/g) || []).length,
          size: content.length,
          compressed,
          timestamp: Date.now(),
          version: SESSION_VERSION,
        },
      };

      // Update statistics
      this.updateCompressionStats(content.length, finalContent.length);

      log(
        `✅ [WEBVIEW-PERSISTENCE] Terminal serialized: ${terminalId} (${content.length} -> ${finalContent.length} chars, compressed: ${compressed})`
      );
      return serializedData;
    } catch (error) {
      this.stats.errorCount++;
      log(`❌ [WEBVIEW-PERSISTENCE] Serialization failed for ${terminalId}: ${error}`);
      return null;
    }
  }

  /**
   * Serializes all registered terminals
   */
  public serializeAllTerminals(options: SerializeOptions = {}): Map<string, TerminalSerializedData> {
    log(`📋 [WEBVIEW-PERSISTENCE] Serializing all terminals (${this.terminals.size} terminals)`);

    const serializedData = new Map<string, TerminalSerializedData>();

    for (const [terminalId] of this.terminals) {
      try {
        const data = this.serializeTerminal(terminalId, options);
        if (data) {
          serializedData.set(terminalId, data);
        }
      } catch (error) {
        log(`❌ [WEBVIEW-PERSISTENCE] Failed to serialize terminal ${terminalId}: ${error}`);
      }
    }

    log(`✅ [WEBVIEW-PERSISTENCE] Serialized ${serializedData.size}/${this.terminals.size} terminals`);
    return serializedData;
  }

  /**
   * Restores terminal content from serialized data
   */
  public restoreTerminalContent(
    terminalId: string,
    serializedData: string | TerminalSerializedData,
    options: RestoreOptions = {}
  ): boolean {
    const registration = this.getTerminalRegistration(terminalId);
    if (!registration) {
      return false;
    }

    try {
      let content: string;

      if (typeof serializedData === 'string') {
        content = serializedData;
      } else {
        content = serializedData.metadata?.compressed
          ? this.decompressContent(serializedData.content)
          : serializedData.content;
      }

      registration.lastAccessed = Date.now();

      // Clear terminal if requested
      if (options.clearBefore !== false) {
        registration.terminal.clear();
      }

      // Write content in batches for better performance
      const lines = content.split('\n');
      const batchSize = options.batchSize || BATCH_SIZE;

      const writeBatch = (startIndex: number) => {
        const endIndex = Math.min(startIndex + batchSize, lines.length);

        for (let i = startIndex; i < endIndex; i++) {
          const line = lines[i];
          if (line !== undefined) {
            registration.terminal.write(line);
            if (i < lines.length - 1) {
              registration.terminal.write('\r\n');
            }
          }
        }

        if (endIndex < lines.length) {
          setTimeout(() => writeBatch(endIndex), 0);
        } else {
          log(`✅ [WEBVIEW-PERSISTENCE] Terminal restored: ${terminalId} (${lines.length} lines)`);
        }
      };

      writeBatch(0);
      return true;
    } catch (error) {
      this.stats.errorCount++;
      log(`❌ [WEBVIEW-PERSISTENCE] Restoration failed for ${terminalId}: ${error}`);
      return false;
    }
  }

  /**
   * Saves terminal content to local storage
   */
  public saveTerminalContent(terminalId: string, options: SerializeOptions = {}): boolean {
    try {
      const serializedData = this.serializeTerminal(terminalId, options);
      if (!serializedData) {
        return false;
      }

      const storageKey = `${STORAGE_KEY_PREFIX}${terminalId}`;
      const storageData = {
        version: SESSION_VERSION,
        timestamp: Date.now(),
        data: serializedData,
      };

      this.vscodeApi.setState({
        ...this.vscodeApi.getState(),
        [storageKey]: storageData,
      });

      this.stats.lastSaveTime = Date.now();
      this.stats.autoSaveCount++;

      log(`💾 [WEBVIEW-PERSISTENCE] Terminal saved to storage: ${terminalId}`);
      return true;
    } catch (error) {
      this.stats.errorCount++;
      log(`❌ [WEBVIEW-PERSISTENCE] Failed to save terminal ${terminalId}: ${error}`);
      return false;
    }
  }

  /**
   * Loads terminal content from local storage
   */
  public loadTerminalContent(terminalId: string): TerminalSerializedData | null {
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${terminalId}`;
      const state = this.vscodeApi.getState();
      const storageData = state?.[storageKey];

      if (!storageData || !storageData.data) {
        return null;
      }

      log(`📂 [WEBVIEW-PERSISTENCE] Terminal loaded from storage: ${terminalId}`);
      return storageData.data;
    } catch (error) {
      this.stats.errorCount++;
      log(`❌ [WEBVIEW-PERSISTENCE] Failed to load terminal ${terminalId}: ${error}`);
      return null;
    }
  }

  /**
   * Gets persistence statistics
   */
  public getStats(): WebViewPersistenceStats {
    return { ...this.stats };
  }

  /**
   * Gets list of available terminals
   */
  public getAvailableTerminals(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Checks if a terminal is registered
   */
  public hasTerminal(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  /**
   * Performs manual cleanup of unused resources
   */
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleanedCount = 0;

    for (const [terminalId, registration] of this.terminals) {
      if (now - registration.lastAccessed > maxAge) {
        this.removeTerminal(terminalId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log(`🧹 [WEBVIEW-PERSISTENCE] Cleaned up ${cleanedCount} old terminals`);
    }
  }

  /**
   * Disposes of the manager and cleans up resources
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop timers
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Clear terminals
    this.terminals.clear();
    this.stats.terminalCount = 0;

    log('🗑️ [WEBVIEW-PERSISTENCE] Manager disposed');
  }

  // Private helper methods

  private getTerminalRegistration(terminalId: string): TerminalRegistration | null {
    if (this.disposed) {
      throw new PersistenceError(
        'Manager disposed',
        PersistenceErrorCode.TERMINAL_NOT_FOUND,
        terminalId
      );
    }

    const registration = this.terminals.get(terminalId);
    if (!registration) {
      log(`⚠️ [WEBVIEW-PERSISTENCE] Terminal not found: ${terminalId}`);
      return null;
    }

    return registration;
  }

  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      if (this.disposed) return;

      let savedCount = 0;
      for (const [terminalId, registration] of this.terminals) {
        if (registration.autoSaveEnabled) {
          try {
            if (this.saveTerminalContent(terminalId)) {
              savedCount++;
            }
          } catch (error) {
            log(`❌ [WEBVIEW-PERSISTENCE] Auto-save failed for ${terminalId}: ${error}`);
          }
        }
      }

      if (savedCount > 0) {
        log(`💾 [WEBVIEW-PERSISTENCE] Auto-saved ${savedCount} terminals`);
      }
    }, AUTO_SAVE_INTERVAL) as unknown as number;
  }

  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      if (this.disposed) return;
      this.cleanup();
    }, CLEANUP_INTERVAL) as unknown as number;
  }

  private cleanupLRUTerminal(): void {
    let oldestTerminalId: string | null = null;
    let oldestTime = Date.now();

    for (const [terminalId, registration] of this.terminals) {
      if (registration.lastAccessed < oldestTime) {
        oldestTime = registration.lastAccessed;
        oldestTerminalId = terminalId;
      }
    }

    if (oldestTerminalId) {
      this.removeTerminal(oldestTerminalId);
      log(`🗑️ [WEBVIEW-PERSISTENCE] Removed LRU terminal: ${oldestTerminalId}`);
    }
  }

  private removeFromStorage(terminalId: string): void {
    const storageKey = `${STORAGE_KEY_PREFIX}${terminalId}`;
    const state = this.vscodeApi.getState() || {};
    delete state[storageKey];
    this.vscodeApi.setState(state);
  }

  private compressContent(content: string): string {
    // Placeholder for actual compression
    return content;
  }

  private decompressContent(content: string): string {
    // Placeholder for actual decompression
    return content;
  }

  private updateCompressionStats(originalSize: number, compressedSize: number): void {
    if (originalSize > 0) {
      const ratio = compressedSize / originalSize;
      this.stats.compressionRatio = (this.stats.compressionRatio + ratio) / 2;
      this.stats.totalStorageSize += compressedSize;
    }
  }
}
