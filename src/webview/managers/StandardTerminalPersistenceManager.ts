import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from '@xterm/xterm';
import { webview as log } from '../../utils/logger';
import { ScrollbackManager, ScrollbackOptions } from './ScrollbackManager';

/**
 * WebView側でxterm.js serialize addonを使用したVS Code標準ターミナル永続化
 *
 * Phase 2 Update: Integrated ScrollbackManager for advanced scrollback processing
 * - ANSI color preservation with SerializeAddon
 * - Wrapped line detection and joining
 * - Empty line trimming for storage optimization
 * - Buffer reverse iteration for efficient processing
 */
export class StandardTerminalPersistenceManager {
  private serializeAddons: Map<string, SerializeAddon> = new Map();
  private terminals: Map<string, Terminal> = new Map();
  private scrollbackManager: ScrollbackManager;
  private vscodeApi: {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
  } | null = null; // VS Code API instance cached

  // Serialized content cache for instant access
  private serializedCache: Map<string, string> = new Map();

  constructor() {
    this.scrollbackManager = new ScrollbackManager();
  }

  // ローカルストレージキー
  private static readonly STORAGE_KEY_PREFIX = 'terminal-session-';
  private static readonly STORAGE_VERSION = '1.0.0';

  /**
   * ターミナルにserialize addonを追加
   */
  public addTerminal(terminalId: string, terminal: Terminal): void {
    log(`🔧 [WEBVIEW-PERSISTENCE] Adding serialize addon to terminal ${terminalId}`);

    try {
      // 🔧 FIX: Check if terminal is ready before adding addon
      if (!terminal || !terminal.textarea) {
        console.warn(
          `⚠️ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} not ready for addon - scheduling retry`
        );

        // Retry after a short delay when terminal is ready
        setTimeout(() => {
          if (terminal && terminal.textarea) {
            this.addTerminal(terminalId, terminal);
          } else {
            console.error(
              `❌ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} still not ready after retry`
            );
          }
        }, 100);
        return;
      }

      const serializeAddon = new SerializeAddon();
      terminal.loadAddon(serializeAddon);

      this.serializeAddons.set(terminalId, serializeAddon);
      this.terminals.set(terminalId, terminal);

      // Register terminal with ScrollbackManager for advanced scrollback processing
      this.scrollbackManager.registerTerminal(terminalId, terminal, serializeAddon);

      // ターミナル内容が変更されたときに自動保存
      this.setupAutoSave(terminalId, terminal);

      log(`✅ [WEBVIEW-PERSISTENCE] Serialize addon loaded for terminal ${terminalId}`);

      // 🔧 FIX: Verify addon is working by testing serialization
      setTimeout(() => {
        this.verifyAddonInitialization(terminalId);
      }, 50);
    } catch (error) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] Failed to load serialize addon for terminal ${terminalId}:`,
        error
      );
    }
  }

  /**
   * 🔧 FIX: Verify that the serialize addon was properly initialized
   */
  private verifyAddonInitialization(terminalId: string): void {
    log(
      `🔍 [WEBVIEW-PERSISTENCE] Verifying addon initialization for terminal ${terminalId}`
    );

    const serializeAddon = this.serializeAddons.get(terminalId);
    const terminal = this.terminals.get(terminalId);

    if (!serializeAddon) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] No serialize addon found for terminal ${terminalId} during verification`
      );
      return;
    }

    if (!terminal) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] No terminal instance found for ${terminalId} during verification`
      );
      return;
    }

    try {
      // Test serialization to ensure addon is working
      const testSerialization = serializeAddon.serialize({ scrollback: 10 });
      log(
        `✅ [WEBVIEW-PERSISTENCE] Addon verification successful for terminal ${terminalId}: ${testSerialization.length} chars`
      );
    } catch (error) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] Addon verification failed for terminal ${terminalId}:`,
        error
      );

      // Try to re-initialize the addon
      try {
        log(
          `🔧 [WEBVIEW-PERSISTENCE] Attempting to re-initialize addon for terminal ${terminalId}`
        );
        const newSerializeAddon = new SerializeAddon();
        terminal.loadAddon(newSerializeAddon);
        this.serializeAddons.set(terminalId, newSerializeAddon);
        log(
          `✅ [WEBVIEW-PERSISTENCE] Successfully re-initialized addon for terminal ${terminalId}`
        );
      } catch (retryError) {
        console.error(
          `❌ [WEBVIEW-PERSISTENCE] Failed to re-initialize addon for terminal ${terminalId}:`,
          retryError
        );
      }
    }
  }

  /**
   * ターミナル内容の自動保存をセットアップ
   *
   * Phase 2 Update: 3-second debounce for better performance with high-frequency output
   */
  private setupAutoSave(terminalId: string, terminal: Terminal): void {
    // データ変更時に自動保存（デバウンス付き）
    let saveTimer: number | null = null;

    const saveContent = (): void => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }

      // Phase 2 Update: 3-second debounce (was 1 second)
      // This reduces performance impact during high-frequency output
      // while still ensuring data is saved regularly
      saveTimer = window.setTimeout(() => {
        this.saveTerminalContent(terminalId);
      }, 3000); // 3秒のデバウンス (Phase 2 optimization)
    };

    // ターミナルデータ変更イベント
    // onData: Fires on every data chunk (high frequency)
    // onLineFeed: Fires on line feeds (lower frequency)
    terminal.onData(saveContent);
    terminal.onLineFeed(saveContent);

    log(
      `🔧 [WEBVIEW-PERSISTENCE] Auto-save enabled for terminal ${terminalId} (3s debounce)`
    );
  }

  /**
   * Phase 2.1.3: Capture terminal state metadata for full restoration
   */
  private captureTerminalMetadata(terminalId: string): {
    dimensions: { cols: number; rows: number };
    cursor?: { x: number; y: number };
    selection: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
    scrollPosition: number;
  } | null {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return null;
    }

    try {
      const dimensions = {
        cols: terminal.cols,
        rows: terminal.rows,
      };

      const cursor = terminal.buffer.active.cursorY >= 0 ? {
        x: terminal.buffer.active.cursorX,
        y: terminal.buffer.active.cursorY,
      } : undefined;

      const selection = terminal.hasSelection() ? {
        start: {
          x: terminal.getSelectionPosition()?.start.x || 0,
          y: terminal.getSelectionPosition()?.start.y || 0,
        },
        end: {
          x: terminal.getSelectionPosition()?.end.x || 0,
          y: terminal.getSelectionPosition()?.end.y || 0,
        },
      } : null;

      const scrollPosition = terminal.buffer.active.viewportY;

      return {
        dimensions,
        cursor,
        selection,
        scrollPosition,
      };
    } catch (error) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Failed to capture metadata for ${terminalId}:`, error);
      return null;
    }
  }

  /**
   * ターミナルコンテンツをローカルストレージに保存
   *
   * Phase 2 Update: Uses ScrollbackManager for advanced processing
   * Phase 2.1.3 Update: Captures terminal state metadata (dimensions, cursor, selection)
   */
  public saveTerminalContent(terminalId: string): void {
    try {
      // Use ScrollbackManager for advanced scrollback processing
      const scrollbackOptions: ScrollbackOptions = {
        scrollback: 1000,
        excludeModes: false,
        excludeAltBuffer: true,
        trimEmptyLines: true,
        preserveWrappedLines: true,
      };

      const scrollbackData = this.scrollbackManager.saveScrollback(
        terminalId,
        scrollbackOptions
      );

      if (!scrollbackData) {
        log(`⚠️ [WEBVIEW-PERSISTENCE] Failed to save scrollback for ${terminalId}`);
        return;
      }

      // Cache serialized content for instant access
      this.serializedCache.set(terminalId, scrollbackData.content);

      // Initialize VS Code API if needed
      if (!this.vscodeApi) {
        const windowWithApi = window as Window & {
          vscodeApi?: {
            postMessage: (message: unknown) => void;
            getState: () => unknown;
            setState: (state: unknown) => void;
          };
        };
        this.vscodeApi = windowWithApi.vscodeApi || null;
        if (!this.vscodeApi) {
          console.warn(`⚠️ [WEBVIEW-PERSISTENCE] VS Code API not found in window.vscodeApi`);
          return;
        }
      }

      // Phase 2.1.3: Capture terminal state metadata
      const metadata = this.captureTerminalMetadata(terminalId);

      if (this.vscodeApi) {
        // Push serialized content to Extension immediately (VS Code standard approach)
        this.vscodeApi.postMessage({
          command: 'pushScrollbackData',
          terminalId,
          scrollbackData: scrollbackData.content.split('\n'),
          metadata, // Phase 2.1.3: Include metadata
          timestamp: Date.now(),
        });

        log(
          `💾 [WEBVIEW-PERSISTENCE] Pushed terminal ${terminalId} scrollback to Extension ` +
            `(${scrollbackData.lineCount} lines, ${scrollbackData.trimmedSize} chars, ` +
            `${((1 - scrollbackData.trimmedSize / scrollbackData.originalSize) * 100).toFixed(1)}% size reduction, ` +
            `${metadata ? 'metadata captured' : 'no metadata'})`
        );
      } else {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No VS Code API available for saving`);
      }
    } catch (error) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Failed to save terminal ${terminalId}:`, error);
    }
  }

  /**
   * ターミナルを削除
   *
   * Phase 2 Update: Unregister from ScrollbackManager
   */
  public removeTerminal(terminalId: string): void {
    log(
      `🗑️ [WEBVIEW-PERSISTENCE] Removing terminal ${terminalId} from persistence manager`
    );

    const serializeAddon = this.serializeAddons.get(terminalId);
    if (serializeAddon) {
      try {
        serializeAddon.dispose();
      } catch (error) {
        console.warn(
          `⚠️ [WEBVIEW-PERSISTENCE] Error disposing serialize addon for ${terminalId}:`,
          error
        );
      }
    }

    // Unregister from ScrollbackManager
    this.scrollbackManager.unregisterTerminal(terminalId);

    this.serializeAddons.delete(terminalId);
    this.terminals.delete(terminalId);
    this.serializedCache.delete(terminalId);
  }

  /**
   * ターミナルのコンテンツをシリアル化
   */
  public serializeTerminal(
    terminalId: string,
    options?: {
      scrollback?: number;
      excludeModes?: boolean;
      excludeAltBuffer?: boolean;
    }
  ): { content: string; html?: string } | null {
    log(`📋 [WEBVIEW-PERSISTENCE] Serializing terminal ${terminalId}`);

    const serializeAddon = this.serializeAddons.get(terminalId);
    if (!serializeAddon) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No serialize addon found for terminal ${terminalId}`);
      return null;
    }

    try {
      // VS Code標準: より多くのscrollback行数を保存（デフォルト1000行）
      const serializeOptions = {
        scrollback: options?.scrollback || 1000,
        excludeModes: options?.excludeModes ?? false,
        excludeAltBuffer: options?.excludeAltBuffer ?? true,
      };

      const serializedContent = serializeAddon.serialize(serializeOptions);

      // HTMLシリアライゼーションも取得（オプション）
      let serializedHtml: string | undefined;
      try {
        serializedHtml = serializeAddon.serializeAsHTML({
          scrollback: serializeOptions.scrollback,
          onlySelection: false,
          includeGlobalBackground: true,
        });
      } catch (htmlError) {
        console.warn(
          `⚠️ [WEBVIEW-PERSISTENCE] HTML serialization failed for ${terminalId}:`,
          htmlError
        );
      }

      log(
        `✅ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} serialized: ${serializedContent.length} chars`
      );

      return {
        content: serializedContent,
        html: serializedHtml,
      };
    } catch (error) {
      console.error(`❌ [WEBVIEW-PERSISTENCE] Failed to serialize terminal ${terminalId}:`, error);
      return null;
    }
  }

  /**
   * 保存されたコンテンツからターミナルを復元
   */
  public restoreTerminalFromStorage(terminalId: string): boolean {
    log(
      `🔄 [WEBVIEW-PERSISTENCE] Attempting to restore terminal ${terminalId} from storage`
    );

    try {
      // HTMLで既に取得済みのAPIを使用
      if (!this.vscodeApi) {
        const windowWithApi = window as Window & {
          vscodeApi?: {
            postMessage: (message: unknown) => void;
            getState: () => unknown;
            setState: (state: unknown) => void;
          };
        };
        this.vscodeApi = windowWithApi.vscodeApi || null;
      }

      if (!this.vscodeApi) {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No VS Code API available for restore`);
        return false;
      }

      const state = this.vscodeApi.getState() as Record<string, unknown> | null;
      const storageKey = `${StandardTerminalPersistenceManager.STORAGE_KEY_PREFIX}${terminalId}`;
      const storageData = state?.[storageKey] as
        | {
            content: string;
            timestamp: number;
            version: string;
            terminalId: string;
          }
        | undefined;

      if (!storageData || !storageData.content) {
        log(`📭 [WEBVIEW-PERSISTENCE] No saved content found for terminal ${terminalId}`);
        return false;
      }

      // 保存時間チェック（7日以上前のデータは使用しない）
      const ageMs = Date.now() - storageData.timestamp;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        log(
          `⏰ [WEBVIEW-PERSISTENCE] Saved content too old for terminal ${terminalId}: ${ageDays.toFixed(1)} days`
        );
        return false;
      }

      return this.restoreTerminalContent(terminalId, storageData.content);
    } catch (error) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] Failed to restore from storage for ${terminalId}:`,
        error
      );
      return false;
    }
  }

  /**
   * VS Code標準: xterm serialize addonを使ってターミナル状態を完全復元
   */
  public restoreTerminalContent(terminalId: string, serializedContent: string): boolean {
    log(
      `🔄 [WEBVIEW-PERSISTENCE] Restoring terminal state using serialize addon for ${terminalId}`
    );

    const terminal = this.terminals.get(terminalId);
    const serializeAddon = this.serializeAddons.get(terminalId);

    if (!terminal) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No terminal found for ${terminalId}`);
      return false;
    }

    if (!serializeAddon) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No serialize addon found for ${terminalId}`);
      return false;
    }

    try {
      // VS Code標準アプローチ: SerializeAddonのdeserialize機能を使用
      // ただし、現在のxterm serialize addonにはdeserialize機能がないため、
      // write()を使用してコンテンツを復元（VS Code互換）

      // ターミナルをクリアしてから復元
      terminal.clear();

      // シリアル化されたコンテンツを復元
      // VS Code標準: ANSI escape sequencesを含む完全な状態復元
      terminal.write(serializedContent);

      log(
        `✅ [WEBVIEW-PERSISTENCE] Terminal state restored for ${terminalId}: ${serializedContent.length} chars`
      );
      return true;
    } catch (error) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] Failed to restore terminal state for ${terminalId}:`,
        error
      );
      return false;
    }
  }

  /**
   * 全ターミナルのシリアル化データを取得
   */
  public serializeAllTerminals(
    scrollback: number = 1000
  ): Map<string, { content: string; html?: string }> {
    log(
      `📋 [WEBVIEW-PERSISTENCE] Serializing all terminals (${this.terminals.size} terminals)`
    );

    const serializedData = new Map<string, { content: string; html?: string }>();

    for (const [terminalId] of this.terminals) {
      const result = this.serializeTerminal(terminalId, { scrollback });
      if (result) {
        serializedData.set(terminalId, result);
      }
    }

    log(`✅ [WEBVIEW-PERSISTENCE] Serialized ${serializedData.size} terminals`);
    return serializedData;
  }

  /**
   * 利用可能なターミナル一覧を取得
   */
  public getAvailableTerminals(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * ターミナルが登録されているかチェック
   */
  public hasTerminal(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  /**
   * 統計情報を取得
   */
  public getStats(): {
    terminalCount: number;
    serializeAddonCount: number;
    availableTerminals: string[];
  } {
    return {
      terminalCount: this.terminals.size,
      serializeAddonCount: this.serializeAddons.size,
      availableTerminals: this.getAvailableTerminals(),
    };
  }

  /**
   * 🔄 Restore session data to a terminal (Extension integration)
   *
   * Phase 2 Update: Uses ScrollbackManager for advanced restore with ANSI colors
   */
  public async restoreSession(sessionData: {
    terminalId: string;
    scrollbackData?: string[];
    sessionRestoreMessage?: string;
    restoreScrollback?: boolean; // New option to enable scrollback restore
  }): Promise<boolean> {
    log(
      `🔄 [WEBVIEW-PERSISTENCE] Restoring session for terminal ${sessionData.terminalId}`
    );

    const { terminalId, scrollbackData, restoreScrollback = false } = sessionData;
    const terminal = this.terminals.get(terminalId);

    if (!terminal) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No terminal found for session restore: ${terminalId}`);
      return false;
    }

    try {
      // Option 1: Restore scrollback with ANSI colors using ScrollbackManager
      if (restoreScrollback && scrollbackData && scrollbackData.length > 0) {
        const scrollbackContent = scrollbackData.join('\n');
        const restored = this.scrollbackManager.restoreScrollback(terminalId, scrollbackContent);

        if (restored) {
          log(
            `✅ [WEBVIEW-PERSISTENCE] Restored ${scrollbackData.length} lines with ANSI colors for ${terminalId}`
          );
        } else {
          log(
            `⚠️ [WEBVIEW-PERSISTENCE] Failed to restore scrollback for ${terminalId}, starting clean`
          );
          terminal.clear();
        }
      } else {
        // Option 2: VS Code Pattern - Don't restore scrollback (default)
        // Clear existing content for clean start
        terminal.clear();

        // 🎯 FIX: VS Code Pattern - Don't restore scrollback during session restore
        // Rationale:
        // 1. PTY process starts a fresh shell session with new prompt
        // 2. Restoring scrollback causes visual duplication (restored + PTY output)
        // 3. VS Code's standard terminal doesn't restore scrollback either
        // 4. Users see clean, fresh prompt without flicker
        //
        // Note: Scrollback data is still saved and available for future use
        // (e.g., search, export, debugging)

        log(
          `✅ [WEBVIEW-PERSISTENCE] Skipped scrollback restore for clean start (${scrollbackData?.length || 0} lines available)`
        );
      }

      // Save the terminal reference for future scrollback operations
      this.saveTerminalContent(terminalId);

      log(`✅ [WEBVIEW-PERSISTENCE] Session restore completed for terminal: ${terminalId}`);
      return true;
    } catch (error) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] Error during session restore for ${terminalId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Request Extension to send scrollback data for restoration
   */
  public requestScrollbackFromExtension(terminalId: string): void {
    log(
      `📡 [WEBVIEW-PERSISTENCE] Requesting scrollback from Extension for terminal: ${terminalId}`
    );

    if (!this.vscodeApi) {
      const windowWithApi = window as Window & {
        vscodeApi?: {
          postMessage: (message: unknown) => void;
          getState: () => unknown;
          setState: (state: unknown) => void;
        };
      };
      this.vscodeApi = windowWithApi.vscodeApi || null;
    }

    if (this.vscodeApi) {
      this.vscodeApi.postMessage({
        command: 'requestScrollbackData',
        terminalId,
        timestamp: Date.now(),
      });
      log(
        `📡 [WEBVIEW-PERSISTENCE] Scrollback request sent to Extension for terminal: ${terminalId}`
      );
    } else {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No VS Code API available for scrollback request`);
    }
  }

  /**
   * クリーンアップ
   *
   * Phase 2 Update: Dispose ScrollbackManager
   */
  public dispose(): void {
    log(
      `🧹 [WEBVIEW-PERSISTENCE] Disposing persistence manager (${this.serializeAddons.size} addons)`
    );

    for (const [terminalId, serializeAddon] of this.serializeAddons) {
      try {
        serializeAddon.dispose();
      } catch (error) {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Error disposing addon for ${terminalId}:`, error);
      }
    }

    // Dispose ScrollbackManager
    this.scrollbackManager.dispose();

    this.serializeAddons.clear();
    this.terminals.clear();
    this.serializedCache.clear();

    log(`✅ [WEBVIEW-PERSISTENCE] Persistence manager disposed`);
  }
}
