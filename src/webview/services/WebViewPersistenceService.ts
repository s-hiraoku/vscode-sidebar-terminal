/**
 * WebView Persistence Service
 *
 * Unified persistence service for WebView-side terminal content management.
 * Consolidates functionality from:
 * - SimplePersistenceManager (240 lines)
 * - StandardTerminalPersistenceManager (740 lines)
 * - OptimizedTerminalPersistenceManager (775 lines)
 *
 * Total consolidation: 1,755 lines → ~300 lines (82% reduction)
 *
 * Key features:
 * - SerializeAddon integration for terminal serialization
 * - Progressive loading for large scrollback (>500 lines)
 * - Lazy loading for deferred content
 * - Auto-save with debounce (3 seconds)
 * - Metadata capture (dimensions, cursor position, selection)
 * - Performance tracking and optimization
 */

import { Terminal } from '@xterm/xterm';
import { SerializeAddon } from '@xterm/addon-serialize';
import { webview as log } from '../../utils/logger';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SerializeOptions {
  scrollback?: number;
  excludeAltBuffer?: boolean;
  trimEmptyLines?: boolean;
}

export interface RestoreOptions {
  progressive?: boolean;
  initialLines?: number;
  validateFormat?: boolean;
}

export interface TerminalMetadata {
  dimensions: { cols: number; rows: number };
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  scrollPosition: number;
  timestamp: number;
}

export interface SerializedTerminalData {
  content: string;
  metadata: TerminalMetadata;
  lineCount: number;
  compressed: boolean;
}

export interface WebViewPersistenceStats {
  terminalCount: number;
  totalSerializedBytes: number;
  averageSerializationTimeMs: number;
}

// ============================================================================
// WebView Persistence Service
// ============================================================================

export class WebViewPersistenceService {
  private terminals = new Map<string, Terminal>();
  private serializeAddons = new Map<string, SerializeAddon>();
  private autoSaveTimers = new Map<string, number>();
  private serializedCache = new Map<string, SerializedTerminalData>();

  private vscodeApi: {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
  };

  private static readonly AUTO_SAVE_DEBOUNCE_MS = 3000; // 3 seconds
  private static readonly DEFAULT_SCROLLBACK = 1000;
  private static readonly PROGRESSIVE_THRESHOLD = 500; // lines

  constructor() {
    // @ts-ignore - VS Code API available in webview
    this.vscodeApi = acquireVsCodeApi();
    log('✅ [WV-PERSISTENCE] WebView Persistence Service initialized');
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Register a terminal with the persistence service
   */
  public addTerminal(
    terminalId: string,
    terminal: Terminal,
    options: { autoSave?: boolean } = {}
  ): void {
    log(`[WV-PERSISTENCE] Adding terminal ${terminalId}`);

    // Verify terminal is ready
    if (!terminal || !terminal.textarea) {
      log(`⚠️ [WV-PERSISTENCE] Terminal ${terminalId} not ready, retrying...`);
      setTimeout(() => {
        if (terminal && terminal.textarea) {
          this.addTerminal(terminalId, terminal, options);
        }
      }, 100);
      return;
    }

    try {
      // Create and load SerializeAddon
      const serializeAddon = new SerializeAddon();
      terminal.loadAddon(serializeAddon);

      this.terminals.set(terminalId, terminal);
      this.serializeAddons.set(terminalId, serializeAddon);

      // Setup auto-save if enabled
      if (options.autoSave !== false) {
        this.setupAutoSave(terminalId, terminal);
      }

      log(`✅ [WV-PERSISTENCE] Terminal ${terminalId} registered`);
    } catch (error) {
      log(`❌ [WV-PERSISTENCE] Failed to add terminal ${terminalId}: ${error}`);
    }
  }

  /**
   * Unregister a terminal
   */
  public removeTerminal(terminalId: string): boolean {
    const timer = this.autoSaveTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this.autoSaveTimers.delete(terminalId);
    }

    this.terminals.delete(terminalId);
    this.serializeAddons.delete(terminalId);
    this.serializedCache.delete(terminalId);

    log(`[WV-PERSISTENCE] Terminal ${terminalId} removed`);
    return true;
  }

  /**
   * Serialize terminal content
   */
  public serializeTerminal(
    terminalId: string,
    options: SerializeOptions = {}
  ): SerializedTerminalData | null {
    const terminal = this.terminals.get(terminalId);
    const serializeAddon = this.serializeAddons.get(terminalId);

    if (!terminal || !serializeAddon) {
      log(`⚠️ [WV-PERSISTENCE] Terminal ${terminalId} not found for serialization`);
      return null;
    }

    try {
      const scrollback = options.scrollback ?? WebViewPersistenceService.DEFAULT_SCROLLBACK;

      // Serialize terminal content
      const content = serializeAddon.serialize({
        scrollback,
        excludeModes: false,
        excludeAltBuffer: options.excludeAltBuffer ?? true,
      });

      // Optionally trim empty lines
      let finalContent = content;
      if (options.trimEmptyLines) {
        const lines = content.split('\n');
        const trimmed = lines.filter(line => line.trim().length > 0);
        finalContent = trimmed.join('\n');
      }

      // Capture metadata
      const metadata = this.captureTerminalMetadata(terminal);
      const lineCount = (finalContent.match(/\n/g) || []).length;

      const serializedData: SerializedTerminalData = {
        content: finalContent,
        metadata,
        lineCount,
        compressed: false, // Compression handled by Extension side
      };

      // Cache for quick access
      this.serializedCache.set(terminalId, serializedData);

      log(`[WV-PERSISTENCE] Serialized terminal ${terminalId}: ${lineCount} lines`);
      return serializedData;

    } catch (error) {
      log(`❌ [WV-PERSISTENCE] Serialization failed for ${terminalId}: ${error}`);
      return null;
    }
  }

  /**
   * Serialize all terminals
   */
  public serializeAllTerminals(
    options: SerializeOptions = {}
  ): Map<string, SerializedTerminalData> {
    const results = new Map<string, SerializedTerminalData>();

    for (const terminalId of this.terminals.keys()) {
      const data = this.serializeTerminal(terminalId, options);
      if (data) {
        results.set(terminalId, data);
      }
    }

    log(`[WV-PERSISTENCE] Serialized ${results.size}/${this.terminals.size} terminals`);
    return results;
  }

  /**
   * Restore terminal content
   */
  public restoreTerminalContent(
    terminalId: string,
    serializedData: string | SerializedTerminalData,
    options: RestoreOptions = {}
  ): boolean {
    const terminal = this.terminals.get(terminalId);

    if (!terminal) {
      log(`⚠️ [WV-PERSISTENCE] Terminal ${terminalId} not found for restoration`);
      return false;
    }

    try {
      // Extract content
      const content = typeof serializedData === 'string'
        ? serializedData
        : serializedData.content;

      const lines = content.split('\n');
      const totalLines = lines.length;

      // Determine if progressive loading should be used
      const useProgressive = options.progressive !== false &&
        totalLines > WebViewPersistenceService.PROGRESSIVE_THRESHOLD;

      const linesToLoad = useProgressive
        ? (options.initialLines || WebViewPersistenceService.PROGRESSIVE_THRESHOLD)
        : totalLines;

      log(`[WV-PERSISTENCE] Restoring ${terminalId}: ${linesToLoad}/${totalLines} lines` +
        (useProgressive ? ' (progressive)' : ''));

      const startTime = performance.now();

      // Write initial batch
      const initialLines = lines.slice(0, linesToLoad);
      this.writeBatchToTerminal(terminal, initialLines);

      // Setup lazy loading for remaining content
      if (useProgressive && totalLines > linesToLoad) {
        const remainingLines = lines.slice(linesToLoad);
        this.setupLazyLoading(terminalId, terminal, remainingLines);
      }

      const duration = performance.now() - startTime;
      const isLarge = totalLines > 1000;
      const targetDuration = isLarge ? 1000 : 500;
      const status = duration < targetDuration ? '✅' : '⚠️';

      log(`${status} [WV-PERSISTENCE] Restored ${terminalId}: ` +
        `${totalLines} lines, ${duration.toFixed(0)}ms (target: ${targetDuration}ms)`);

      return true;

    } catch (error) {
      log(`❌ [WV-PERSISTENCE] Restoration failed for ${terminalId}: ${error}`);
      return false;
    }
  }

  /**
   * Save terminal content and push to extension
   */
  public saveTerminalContent(terminalId: string): boolean {
    const serializedData = this.serializeTerminal(terminalId);

    if (!serializedData) {
      return false;
    }

    // Push scrollback data to extension for instant save
    this.vscodeApi.postMessage({
      command: 'pushScrollbackData',
      terminalId,
      scrollbackData: serializedData.content.split('\n'),
      metadata: serializedData.metadata,
      timestamp: Date.now(),
    });

    log(`[WV-PERSISTENCE] Pushed scrollback for ${terminalId}: ${serializedData.lineCount} lines`);
    return true;
  }

  /**
   * Get cached serialized data
   */
  public loadTerminalContent(terminalId: string): SerializedTerminalData | null {
    return this.serializedCache.get(terminalId) || null;
  }

  /**
   * Get service statistics
   */
  public getStats(): WebViewPersistenceStats {
    let totalBytes = 0;

    for (const data of this.serializedCache.values()) {
      totalBytes += data.content.length;
    }

    return {
      terminalCount: this.terminals.size,
      totalSerializedBytes: totalBytes,
      averageSerializationTimeMs: 0, // Could track this if needed
    };
  }

  /**
   * Check if terminal is registered
   */
  public hasTerminal(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  /**
   * Get list of registered terminal IDs
   */
  public getAvailableTerminals(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Clear all cached data
   */
  public cleanup(): void {
    for (const timer of this.autoSaveTimers.values()) {
      clearTimeout(timer);
    }

    this.autoSaveTimers.clear();
    this.serializedCache.clear();

    log('[WV-PERSISTENCE] Cleanup completed');
  }

  /**
   * Dispose service
   */
  public dispose(): void {
    this.cleanup();
    this.terminals.clear();
    this.serializeAddons.clear();
    log('[WV-PERSISTENCE] Disposed');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Setup auto-save with debounce
   */
  private setupAutoSave(terminalId: string, terminal: Terminal): void {
    const scheduleAutoSave = () => {
      const existingTimer = this.autoSaveTimers.get(terminalId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(() => {
        this.saveTerminalContent(terminalId);
      }, WebViewPersistenceService.AUTO_SAVE_DEBOUNCE_MS);

      this.autoSaveTimers.set(terminalId, timer);
    };

    // Trigger auto-save on terminal data changes
    terminal.onData(() => scheduleAutoSave());
    terminal.onLineFeed(() => scheduleAutoSave());

    log(`[WV-PERSISTENCE] Auto-save configured for ${terminalId} (${WebViewPersistenceService.AUTO_SAVE_DEBOUNCE_MS}ms debounce)`);
  }

  /**
   * Capture terminal state metadata
   */
  private captureTerminalMetadata(terminal: Terminal): TerminalMetadata {
    try {
      const buffer = terminal.buffer.active;

      return {
        dimensions: {
          cols: terminal.cols,
          rows: terminal.rows,
        },
        cursor: {
          x: buffer.cursorX,
          y: buffer.cursorY,
        },
        selection: terminal.hasSelection()
          ? { start: 0, end: 0 } // Simplified - could enhance with actual selection bounds
          : undefined,
        scrollPosition: buffer.viewportY,
        timestamp: Date.now(),
      };
    } catch (error) {
      log(`⚠️ [WV-PERSISTENCE] Metadata capture warning: ${error}`);
      return {
        dimensions: { cols: terminal.cols, rows: terminal.rows },
        scrollPosition: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Write lines to terminal in batches (non-blocking)
   */
  private writeBatchToTerminal(terminal: Terminal, lines: string[]): void {
    const BATCH_SIZE = 100;

    const writeBatch = (startIndex: number) => {
      const endIndex = Math.min(startIndex + BATCH_SIZE, lines.length);

      for (let i = startIndex; i < endIndex; i++) {
        const line = lines[i];
        if (line !== undefined) {
          terminal.write(line);
          if (i < lines.length - 1) {
            terminal.write('\r\n');
          }
        }
      }

      if (endIndex < lines.length) {
        setTimeout(() => writeBatch(endIndex), 0);
      }
    };

    writeBatch(0);
  }

  /**
   * Setup lazy loading for remaining terminal content
   */
  private setupLazyLoading(
    terminalId: string,
    terminal: Terminal,
    remainingLines: string[]
  ): void {
    log(`[WV-PERSISTENCE] Setting up lazy loading for ${terminalId}: ${remainingLines.length} remaining lines`);

    // Load remaining content after a delay
    setTimeout(() => {
      log(`[WV-PERSISTENCE] Loading remaining content for ${terminalId}`);
      this.writeBatchToTerminal(terminal, remainingLines);
    }, 2000); // 2 second delay
  }
}
