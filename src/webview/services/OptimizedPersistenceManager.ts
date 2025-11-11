/**
 * Optimized Terminal Persistence Manager for WebView
 *
 * This service replaces the StandardTerminalPersistenceManager with improved
 * performance, error handling, and resource management.
 *
 * Key improvements:
 * - Lazy loading for large terminal histories
 * - Compression support for storage optimization
 * - Better memory management with automatic cleanup
 * - Standardized error handling
 * - Performance monitoring and metrics
 * - Resource lifecycle management
 */

import type { Terminal } from '@xterm/xterm';
import type { SerializeAddon } from '@xterm/addon-serialize';
import { log } from '../../utils/logger';

// VS Code WebView API declaration
declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
};

// Performance and storage optimization constants
const STORAGE_KEY_PREFIX = 'vscode-terminal-session-';
const STORAGE_VERSION = '2.0.0';
const COMPRESSION_THRESHOLD = 2000; // Characters before compression
const AUTO_SAVE_INTERVAL = 120000; // 2 minutes (optimized for CPU performance)
const CLEANUP_INTERVAL = 600000; // 10 minutes (optimized for CPU performance)
const MAX_TERMINALS = 10;
const DEFAULT_SCROLLBACK = 1000;

// Error types for better error handling
export enum PersistenceErrorType {
  SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
  DESERIALIZATION_FAILED = 'DESERIALIZATION_FAILED',
  STORAGE_FULL = 'STORAGE_FULL',
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  ADDON_NOT_AVAILABLE = 'ADDON_NOT_AVAILABLE',
  COMPRESSION_FAILED = 'COMPRESSION_FAILED',
}

export class WebViewPersistenceError extends Error {
  public override readonly name = 'WebViewPersistenceError';

  constructor(
    override message: string,
    public readonly type: PersistenceErrorType,
    public readonly terminalId?: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = 'WebViewPersistenceError';
  }
}

// Interfaces for type safety
export interface TerminalSerializedData {
  content: string;
  html?: string;
  metadata: {
    lines: number;
    size: number;
    compressed: boolean;
    timestamp: number;
    version: string;
    // Phase 2.1.3: Enhanced metadata for full state restoration
    dimensions?: {
      cols: number;
      rows: number;
    };
    cursor?: {
      x: number;
      y: number;
    };
    selection?: {
      start: { x: number; y: number };
      end: { x: number; y: number };
    } | null;
    workingDirectory?: string;
    scrollPosition?: number;
  };
}

export interface TerminalRegistration {
  id: string;
  terminal: Terminal;
  serializeAddon: SerializeAddon;
  lastAccessed: number;
  autoSaveEnabled: boolean;
}

export interface PersistenceStats {
  terminalCount: number;
  totalStorageSize: number;
  compressionRatio: number;
  lastSaveTime: number;
  autoSaveCount: number;
  errorCount: number;
}

/**
 * Optimized persistence manager for WebView terminal persistence operations
 */
export class OptimizedTerminalPersistenceManager {
  private terminals = new Map<string, TerminalRegistration>();
  private autoSaveTimer?: number;
  private cleanupTimer?: number;
  private stats: PersistenceStats = {
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
      };
    }
  })();

  constructor() {
    this.startAutoSave();
    this.startPeriodicCleanup();
    log('✅ [WEBVIEW-PERSISTENCE] Optimized persistence manager initialized');
  }

  /**
   * Registers a terminal with its serialize addon for persistence
   */
  public addTerminal(
    terminalId: string,
    terminal: Terminal,
    serializeAddon: SerializeAddon,
    options: { autoSave?: boolean } = {}
  ): void {
    if (this.disposed) {
      throw new WebViewPersistenceError(
        'Manager disposed',
        PersistenceErrorType.TERMINAL_NOT_FOUND,
        terminalId
      );
    }

    if (this.terminals.size >= MAX_TERMINALS) {
      // Clean up least recently used terminal
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

    log(
      `✅ [WEBVIEW-PERSISTENCE] Terminal registered: ${terminalId} (total: ${this.terminals.size})`
    );
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

      log(
        `🗑️ [WEBVIEW-PERSISTENCE] Terminal removed: ${terminalId} (remaining: ${this.terminals.size})`
      );
    }
    return removed;
  }

  /**
   * Serializes a specific terminal with optimization
   */
  public serializeTerminal(
    terminalId: string,
    options: {
      scrollback?: number;
      includeHtml?: boolean;
      compress?: boolean;
    } = {}
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
        excludeModes: false,
        excludeAltBuffer: true,
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

      // Phase 2.1.3: Capture terminal state metadata
      const dimensions = {
        cols: registration.terminal.cols,
        rows: registration.terminal.rows,
      };

      const cursorPosition = registration.terminal.buffer.active.cursorY >= 0 ? {
        x: registration.terminal.buffer.active.cursorX,
        y: registration.terminal.buffer.active.cursorY,
      } : undefined;

      // Capture selection if present
      const selection = registration.terminal.hasSelection() ? {
        start: { x: registration.terminal.getSelectionPosition()?.start.x || 0, y: registration.terminal.getSelectionPosition()?.start.y || 0 },
        end: { x: registration.terminal.getSelectionPosition()?.end.x || 0, y: registration.terminal.getSelectionPosition()?.end.y || 0 },
      } : null;

      const serializedData: TerminalSerializedData = {
        content: finalContent,
        html,
        metadata: {
          lines: (content.match(/\n/g) || []).length,
          size: content.length,
          compressed,
          timestamp: Date.now(),
          version: STORAGE_VERSION,
          // Enhanced metadata for Phase 2.1.3
          dimensions,
          cursor: cursorPosition,
          selection,
          scrollPosition: registration.terminal.buffer.active.viewportY,
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
      const persistenceError = new WebViewPersistenceError(
        `Failed to serialize terminal: ${error}`,
        PersistenceErrorType.SERIALIZATION_FAILED,
        terminalId,
        error instanceof Error ? error : undefined
      );
      log(`❌ [WEBVIEW-PERSISTENCE] ${persistenceError.message}`);
      throw persistenceError;
    }
  }

  /**
   * Serializes all registered terminals
   */
  public serializeAllTerminals(
    options: {
      scrollback?: number;
      includeHtml?: boolean;
      compress?: boolean;
    } = {}
  ): Map<string, TerminalSerializedData> {
    log(`📋 [WEBVIEW-PERSISTENCE] Serializing all terminals (${this.terminals.size} terminals)`);

    const serializedData = new Map<string, TerminalSerializedData>();
    const errors: string[] = [];

    for (const [terminalId] of this.terminals) {
      try {
        const data = this.serializeTerminal(terminalId, options);
        if (data) {
          serializedData.set(terminalId, data);
        }
      } catch (error) {
        errors.push(`${terminalId}: ${error}`);
        log(`❌ [WEBVIEW-PERSISTENCE] Failed to serialize terminal ${terminalId}: ${error}`);
      }
    }

    if (errors.length > 0) {
      log(`⚠️ [WEBVIEW-PERSISTENCE] Serialization completed with ${errors.length} errors`);
    }

    log(
      `✅ [WEBVIEW-PERSISTENCE] Serialized ${serializedData.size}/${this.terminals.size} terminals`
    );
    return serializedData;
  }

  /**
   * Restores terminal content from serialized data
   *
   * Phase 2.2.1: Progressive loading support for large scrollback
   */
  public restoreTerminalContent(
    terminalId: string,
    serializedData: string | TerminalSerializedData,
    options: {
      validateFormat?: boolean;
      progressive?: boolean;  // Phase 2.2.1: Enable progressive loading
      initialLines?: number;  // Phase 2.2.1: Number of lines to load initially (default: 500)
    } = {}
  ): boolean {
    const registration = this.getTerminalRegistration(terminalId);
    if (!registration) {
      return false;
    }

    try {
      let content: string;

      if (typeof serializedData === 'string') {
        // Legacy format
        content = serializedData;
      } else {
        // New format with metadata
        content = serializedData.metadata?.compressed
          ? this.decompressContent(serializedData.content)
          : serializedData.content;

        // Validate format if requested
        if (options.validateFormat && !this.validateSerializedData(serializedData)) {
          throw new WebViewPersistenceError(
            'Invalid serialized data format',
            PersistenceErrorType.DESERIALIZATION_FAILED,
            terminalId
          );
        }
      }

      registration.lastAccessed = Date.now();

      // Clear terminal first
      registration.terminal.clear();

      // Phase 2.2.1 & 2.2.2: Progressive loading with performance tracking
      const startTime = performance.now();
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Phase 2.2.1: Determine if progressive loading should be used
      const useProgressive = options.progressive !== false && totalLines > 500;
      const initialLines = useProgressive ? (options.initialLines || 500) : totalLines;
      const batchSize = 100; // Process in batches to avoid blocking

      // Store remaining lines for lazy loading (Phase 2.2.3)
      let remainingLines: string[] = [];
      if (useProgressive && totalLines > initialLines) {
        remainingLines = lines.slice(initialLines);
        log(`📊 [WEBVIEW-PERSISTENCE] Progressive loading: ${initialLines}/${totalLines} lines initially, ${remainingLines.length} lines deferred`);
      }

      const writeBatch = (startIndex: number, linesToWrite: string[]) => {
        const endIndex = Math.min(startIndex + batchSize, linesToWrite.length);

        for (let i = startIndex; i < endIndex; i++) {
          const line = linesToWrite[i];
          if (line !== undefined) {
            registration.terminal.write(line);
            if (i < linesToWrite.length - 1) {
              registration.terminal.write('\r\n');
            }
          }
        }

        if (endIndex < linesToWrite.length) {
          // Schedule next batch
          setTimeout(() => writeBatch(endIndex, linesToWrite), 0);
        } else {
          // Phase 2.2.2: Performance tracking
          const endTime = performance.now();
          const duration = endTime - startTime;
          const isLargeScrollback = totalLines > 1000;
          const targetDuration = isLargeScrollback ? 1000 : 500;
          const performanceStatus = duration < targetDuration ? '✅' : '⚠️';

          log(
            `${performanceStatus} [WEBVIEW-PERSISTENCE] Terminal restored: ${terminalId} ` +
            `(${linesToWrite.length}/${totalLines} lines, ${duration.toFixed(0)}ms, ` +
            `target: ${targetDuration}ms)`
          );

          // Phase 2.2.3: Setup lazy loading for remaining content if needed
          if (remainingLines.length > 0) {
            this.setupLazyLoading(terminalId, remainingLines);
          }
        }
      };

      // Start with initial lines only (progressive) or all lines (non-progressive)
      const initialContent = useProgressive ? lines.slice(0, initialLines) : lines;
      writeBatch(0, initialContent);
      return true;
    } catch (error) {
      this.stats.errorCount++;
      const persistenceError = new WebViewPersistenceError(
        `Failed to restore terminal: ${error}`,
        PersistenceErrorType.DESERIALIZATION_FAILED,
        terminalId,
        error instanceof Error ? error : undefined
      );
      log(`❌ [WEBVIEW-PERSISTENCE] ${persistenceError.message}`);
      throw persistenceError;
    }
  }

  /**
   * Saves terminal content to local storage
   */
  public saveTerminalContent(
    terminalId: string,
    options: { scrollback?: number; compress?: boolean } = {}
  ): boolean {
    try {
      const serializedData = this.serializeTerminal(terminalId, options);
      if (!serializedData) {
        return false;
      }

      const storageKey = `${STORAGE_KEY_PREFIX}${terminalId}`;
      const storageData = {
        version: STORAGE_VERSION,
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

      // Check version compatibility
      if (storageData.version !== STORAGE_VERSION) {
        log(`⚠️ [WEBVIEW-PERSISTENCE] Version mismatch for ${terminalId}, skipping load`);
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
  public getStats(): PersistenceStats {
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

    // Clean up old terminals
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

  /**
   * Phase 2.2.3: Setup lazy loading for deferred scrollback content
   */
  private setupLazyLoading(terminalId: string, remainingLines: string[]): void {
    const registration = this.getTerminalRegistration(terminalId);
    if (!registration) {
      return;
    }

    log(`🔄 [WEBVIEW-PERSISTENCE] Lazy loading setup: ${remainingLines.length} lines available on scroll`);

    // Listen for scroll-to-top events
    const scrollListener = () => {
      const buffer = registration.terminal.buffer.active;
      const isAtTop = buffer.viewportY === 0;

      if (isAtTop && remainingLines.length > 0) {
        log(`📜 [WEBVIEW-PERSISTENCE] Loading more history: ${Math.min(500, remainingLines.length)} lines`);

        // Load next chunk (500 lines)
        const chunkSize = 500;
        const chunk = remainingLines.splice(0, chunkSize);

        // Prepend chunk to terminal
        const currentCursorY = buffer.cursorY;
        registration.terminal.write('\x1b[H'); // Move to top
        chunk.forEach((line, index) => {
          registration.terminal.write(line);
          if (index < chunk.length - 1) {
            registration.terminal.write('\r\n');
          }
        });
        registration.terminal.write(`\x1b[${currentCursorY + chunk.length};0H`); // Restore cursor

        if (remainingLines.length === 0) {
          log(`✅ [WEBVIEW-PERSISTENCE] All history loaded for ${terminalId}`);
          // Remove listener when all content is loaded
          registration.terminal.onScroll.dispose();
        } else {
          log(`📊 [WEBVIEW-PERSISTENCE] ${remainingLines.length} lines remaining`);
        }
      }
    };

    registration.terminal.onScroll(scrollListener);
  }

  private getTerminalRegistration(terminalId: string): TerminalRegistration | null {
    if (this.disposed) {
      throw new WebViewPersistenceError(
        'Manager disposed',
        PersistenceErrorType.TERMINAL_NOT_FOUND,
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
    // Simple compression using repeated pattern replacement
    // In production, consider using a proper compression library
    try {
      return content
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/(.{1})\1{2,}/g, '$1'); // Remove excessive repetition
    } catch (error) {
      log(`⚠️ [WEBVIEW-PERSISTENCE] Compression failed, returning original: ${error}`);
      return content;
    }
  }

  private decompressContent(content: string): string {
    // For now, return as-is since we're using simple compression
    // In production, implement proper decompression
    return content;
  }

  private validateSerializedData(data: TerminalSerializedData): boolean {
    return !!(
      data &&
      typeof data.content === 'string' &&
      data.metadata &&
      typeof data.metadata.size === 'number' &&
      typeof data.metadata.timestamp === 'number' &&
      data.metadata.version === STORAGE_VERSION
    );
  }

  private updateCompressionStats(originalSize: number, compressedSize: number): void {
    if (originalSize > 0) {
      const ratio = compressedSize / originalSize;
      this.stats.compressionRatio = (this.stats.compressionRatio + ratio) / 2; // Moving average
      this.stats.totalStorageSize += compressedSize;
    }
  }
}
