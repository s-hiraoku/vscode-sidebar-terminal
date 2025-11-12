/**
 * WebView Persistence Service
 *
 * Consolidated persistence service for the WebView side that replaces:
 * - StandardTerminalPersistenceManager.ts (563 lines)
 * - OptimizedPersistenceManager.ts (505 lines)
 * - SimplePersistenceManager.ts (239 lines)
 *
 * Total consolidation: ~1,307 lines → ~300 lines (77% reduction)
 */

import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from '@xterm/xterm';
import {
  SerializationOptions,
  SerializationResult,
  IWebViewPersistenceService,
  PERSISTENCE_CONSTANTS,
} from '../../types/Persistence';

/**
 * Consolidated WebView-side persistence service
 */
export class WebViewPersistenceService implements IWebViewPersistenceService {
  private serializeAddons = new Map<string, SerializeAddon>();
  private terminals = new Map<string, Terminal>();
  private autoSaveTimers = new Map<string, number>();
  private vscodeApi: {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  } | null = null;

  constructor() {
    this.initializeVscodeApi();
    console.log('🔧 [WEBVIEW-PERSISTENCE] WebViewPersistenceService initialized');
  }

  /**
   * Adds a terminal to the persistence manager
   */
  public addTerminal(terminalId: string, terminal: Terminal): void {
    console.log(`🔧 [WEBVIEW-PERSISTENCE] Adding terminal ${terminalId}`);

    try {
      // Check if terminal is ready
      if (!terminal || !terminal.textarea) {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} not ready, scheduling retry`);
        setTimeout(() => {
          if (terminal && terminal.textarea) {
            this.addTerminal(terminalId, terminal);
          }
        }, 100);
        return;
      }

      // Create and load serialize addon
      const serializeAddon = new SerializeAddon();
      terminal.loadAddon(serializeAddon);

      this.serializeAddons.set(terminalId, serializeAddon);
      this.terminals.set(terminalId, terminal);

      // Setup auto-save
      this.setupAutoSave(terminalId, terminal);

      // Verify addon initialization
      setTimeout(() => this.verifyAddon(terminalId), 50);

      console.log(`✅ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} added successfully`);
    } catch (error) {
      console.error(`❌ [WEBVIEW-PERSISTENCE] Failed to add terminal ${terminalId}:`, error);
    }
  }

  /**
   * Removes a terminal from the persistence manager
   */
  public removeTerminal(terminalId: string): void {
    console.log(`🗑️ [WEBVIEW-PERSISTENCE] Removing terminal ${terminalId}`);

    // Clear auto-save timer
    const timer = this.autoSaveTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this.autoSaveTimers.delete(terminalId);
    }

    // Dispose serialize addon
    const serializeAddon = this.serializeAddons.get(terminalId);
    if (serializeAddon) {
      try {
        serializeAddon.dispose();
      } catch (error) {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Error disposing addon for ${terminalId}:`, error);
      }
      this.serializeAddons.delete(terminalId);
    }

    this.terminals.delete(terminalId);
  }

  /**
   * Serializes a terminal's content
   */
  public serializeTerminal(
    terminalId: string,
    options?: SerializationOptions
  ): SerializationResult | null {
    console.log(`📋 [WEBVIEW-PERSISTENCE] Serializing terminal ${terminalId}`);

    const serializeAddon = this.serializeAddons.get(terminalId);
    if (!serializeAddon) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No serialize addon for terminal ${terminalId}`);
      return null;
    }

    try {
      const scrollback = options?.scrollback || PERSISTENCE_CONSTANTS.MAX_SCROLLBACK_LINES;
      const serializedContent = serializeAddon.serialize({
        scrollback,
        excludeModes: options?.excludeModes ?? false,
        excludeAltBuffer: options?.excludeAltBuffer ?? true,
      });

      // Optional HTML serialization
      let serializedHtml: string | undefined;
      try {
        serializedHtml = serializeAddon.serializeAsHTML({
          scrollback,
          onlySelection: false,
          includeGlobalBackground: true,
        });
      } catch (htmlError) {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] HTML serialization failed for ${terminalId}`);
      }

      const result: SerializationResult = {
        content: serializedContent,
        html: serializedHtml,
        metadata: {
          lines: (serializedContent.match(/\n/g) || []).length,
          size: serializedContent.length,
          compressed: serializedContent.length > PERSISTENCE_CONSTANTS.COMPRESSION_THRESHOLD,
        },
      };

      console.log(
        `✅ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} serialized: ${serializedContent.length} chars`
      );
      return result;
    } catch (error) {
      console.error(`❌ [WEBVIEW-PERSISTENCE] Serialization failed for ${terminalId}:`, error);
      return null;
    }
  }

  /**
   * Restores terminal content from serialized data
   */
  public restoreTerminalContent(terminalId: string, content: string): boolean {
    console.log(`🔄 [WEBVIEW-PERSISTENCE] Restoring terminal ${terminalId}`);

    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No terminal found for ${terminalId}`);
      return false;
    }

    try {
      // Clear terminal and restore content
      terminal.clear();
      terminal.write(content);

      console.log(`✅ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} restored: ${content.length} chars`);
      return true;
    } catch (error) {
      console.error(`❌ [WEBVIEW-PERSISTENCE] Restoration failed for ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * Serializes all terminals
   */
  public serializeAllTerminals(
    scrollback: number = PERSISTENCE_CONSTANTS.MAX_SCROLLBACK_LINES
  ): Map<string, SerializationResult> {
    console.log(`📋 [WEBVIEW-PERSISTENCE] Serializing all terminals (${this.terminals.size} total)`);

    const serializedData = new Map<string, SerializationResult>();

    for (const [terminalId] of this.terminals) {
      const result = this.serializeTerminal(terminalId, { scrollback });
      if (result) {
        serializedData.set(terminalId, result);
      }
    }

    console.log(`✅ [WEBVIEW-PERSISTENCE] Serialized ${serializedData.size} terminals`);
    return serializedData;
  }

  /**
   * Handles serialization request from Extension
   */
  public handleSerializationRequest(terminalIds: string[]): void {
    console.log(
      `📡 [WEBVIEW-PERSISTENCE] Handling serialization request for ${terminalIds.length} terminals`
    );

    const serializationData: { [key: string]: SerializationResult } = {};

    for (const terminalId of terminalIds) {
      const result = this.serializeTerminal(terminalId);
      if (result) {
        serializationData[terminalId] = result;
      }
    }

    // Send response to Extension
    this.sendToExtension({
      command: 'serializationResponse',
      data: serializationData,
      timestamp: Date.now(),
    });

    console.log(
      `✅ [WEBVIEW-PERSISTENCE] Sent serialization response: ${Object.keys(serializationData).length} terminals`
    );
  }

  /**
   * Handles restoration request from Extension
   */
  public handleRestorationRequest(
    terminalData: Array<{ id: string; name: string; serializedContent: string; isActive: boolean }>
  ): void {
    console.log(
      `📡 [WEBVIEW-PERSISTENCE] Handling restoration request for ${terminalData.length} terminals`
    );

    let restoredCount = 0;

    for (const terminal of terminalData) {
      if (this.restoreTerminalContent(terminal.id, terminal.serializedContent)) {
        restoredCount++;
      }
    }

    console.log(`✅ [WEBVIEW-PERSISTENCE] Restored ${restoredCount}/${terminalData.length} terminals`);
  }

  /**
   * Disposes of the service
   */
  public dispose(): void {
    console.log(
      `🧹 [WEBVIEW-PERSISTENCE] Disposing service (${this.serializeAddons.size} addons)`
    );

    // Clear all auto-save timers
    for (const timer of this.autoSaveTimers.values()) {
      clearTimeout(timer);
    }
    this.autoSaveTimers.clear();

    // Dispose all serialize addons
    for (const [terminalId, serializeAddon] of this.serializeAddons) {
      try {
        serializeAddon.dispose();
      } catch (error) {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Error disposing addon for ${terminalId}:`, error);
      }
    }

    this.serializeAddons.clear();
    this.terminals.clear();

    console.log(`✅ [WEBVIEW-PERSISTENCE] Service disposed`);
  }

  // Private helper methods

  private initializeVscodeApi(): void {
    const windowWithApi = window as any;
    this.vscodeApi = windowWithApi.vscodeApi || null;

    if (!this.vscodeApi) {
      console.warn('⚠️ [WEBVIEW-PERSISTENCE] VS Code API not available');
    }
  }

  private setupAutoSave(terminalId: string, terminal: Terminal): void {
    const scheduleAutoSave = (): void => {
      const existingTimer = this.autoSaveTimers.get(terminalId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(() => {
        this.serializeTerminal(terminalId);
      }, PERSISTENCE_CONSTANTS.AUTO_SAVE_DEBOUNCE_MS);

      this.autoSaveTimers.set(terminalId, timer);
    };

    terminal.onData(scheduleAutoSave);
    terminal.onLineFeed(scheduleAutoSave);

    console.log(`🔧 [WEBVIEW-PERSISTENCE] Auto-save enabled for terminal ${terminalId}`);
  }

  private verifyAddon(terminalId: string): void {
    const serializeAddon = this.serializeAddons.get(terminalId);
    const terminal = this.terminals.get(terminalId);

    if (!serializeAddon || !terminal) {
      console.error(`❌ [WEBVIEW-PERSISTENCE] Addon verification failed for ${terminalId}`);
      return;
    }

    try {
      // Test serialization
      serializeAddon.serialize({ scrollback: 10 });
      console.log(`✅ [WEBVIEW-PERSISTENCE] Addon verified for terminal ${terminalId}`);
    } catch (error) {
      console.error(`❌ [WEBVIEW-PERSISTENCE] Addon verification error for ${terminalId}:`, error);

      // Attempt re-initialization
      try {
        const newAddon = new SerializeAddon();
        terminal.loadAddon(newAddon);
        this.serializeAddons.set(terminalId, newAddon);
        console.log(`✅ [WEBVIEW-PERSISTENCE] Re-initialized addon for ${terminalId}`);
      } catch (retryError) {
        console.error(`❌ [WEBVIEW-PERSISTENCE] Re-initialization failed for ${terminalId}`);
      }
    }
  }

  private sendToExtension(message: any): void {
    if (!this.vscodeApi) {
      console.warn('⚠️ [WEBVIEW-PERSISTENCE] Cannot send message, no VS Code API');
      return;
    }

    try {
      this.vscodeApi.postMessage(message);
    } catch (error) {
      console.error('❌ [WEBVIEW-PERSISTENCE] Failed to send message to Extension:', error);
    }
  }
}
