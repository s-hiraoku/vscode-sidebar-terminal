import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from '@xterm/xterm';

/**
 * WebView側でxterm.js serialize addonを使用したVS Code標準ターミナル永続化
 */
export class StandardTerminalPersistenceManager {
  private readonly serializeAddons: Map<string, SerializeAddon> = new Map();
  private readonly terminals: Map<string, Terminal> = new Map();
  private vscodeApi: {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
  } | null = null; // VS Code API instance cached

  // ローカルストレージキー
  private static readonly STORAGE_KEY_PREFIX = 'terminal-session-';
  private static readonly STORAGE_VERSION = '1.0.0';

  /**
   * ターミナルにserialize addonを追加
   */
  public addTerminal(terminalId: string, terminal: Terminal): void {
    console.log(`🔧 [WEBVIEW-PERSISTENCE] Adding serialize addon to terminal ${terminalId}`);

    try {
      // 🔧 FIX: Check if terminal is ready before adding addon
      if (!terminal.textarea) {
        console.warn(
          `⚠️ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} not ready for addon - scheduling retry`
        );

        // Retry after a short delay when terminal is ready
        setTimeout(() => {
          if (terminal.textarea) {
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

      // ターミナル内容が変更されたときに自動保存
      this.setupAutoSave(terminalId, terminal);

      console.log(`✅ [WEBVIEW-PERSISTENCE] Serialize addon loaded for terminal ${terminalId}`);

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
    console.log(
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
      console.log(
        `✅ [WEBVIEW-PERSISTENCE] Addon verification successful for terminal ${terminalId}: ${testSerialization.length} chars`
      );
    } catch (error) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] Addon verification failed for terminal ${terminalId}:`,
        error
      );

      // Try to re-initialize the addon
      try {
        console.log(
          `🔧 [WEBVIEW-PERSISTENCE] Attempting to re-initialize addon for terminal ${terminalId}`
        );
        const newSerializeAddon = new SerializeAddon();
        terminal.loadAddon(newSerializeAddon);
        this.serializeAddons.set(terminalId, newSerializeAddon);
        console.log(
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
   */
  private setupAutoSave(terminalId: string, terminal: Terminal): void {
    // データ変更時に自動保存（デバウンス付き）
    let saveTimer: number | null = null;

    const saveContent = (): void => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }

      saveTimer = window.setTimeout(() => {
        this.saveTerminalContent(terminalId);
      }, 1000); // 1秒のデバウンス
    };

    // ターミナルデータ変更イベント
    terminal.onData(saveContent);
    terminal.onLineFeed(saveContent);

    console.log(`🔧 [WEBVIEW-PERSISTENCE] Auto-save enabled for terminal ${terminalId}`);
  }

  /**
   * ターミナルコンテンツをローカルストレージに保存
   */
  public saveTerminalContent(terminalId: string): void {
    try {
      const serializedData = this.serializeTerminal(terminalId, { scrollback: 1000 });

      if (!serializedData) {
        return;
      }

      const storageKey = `${StandardTerminalPersistenceManager.STORAGE_KEY_PREFIX}${terminalId}`;
      const storageData = {
        version: StandardTerminalPersistenceManager.STORAGE_VERSION,
        terminalId,
        content: serializedData.content,
        timestamp: Date.now(),
      };

      // VS CodeのWebView内ではlocalStorageの代わりにstateを使用
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
        if (!this.vscodeApi) {
          console.warn(`⚠️ [WEBVIEW-PERSISTENCE] VS Code API not found in window.vscodeApi`);
          return;
        }
      }

      if (this.vscodeApi) {
        const currentState = this.vscodeApi.getState() as Record<string, unknown> | null;
        this.vscodeApi.setState({
          ...(currentState || {}),
          [storageKey]: storageData,
        });
        console.log(
          `💾 [WEBVIEW-PERSISTENCE] Saved terminal ${terminalId} content (${serializedData.content.length} chars)`
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
   */
  public removeTerminal(terminalId: string): void {
    console.log(
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

    this.serializeAddons.delete(terminalId);
    this.terminals.delete(terminalId);
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
    console.log(`📋 [WEBVIEW-PERSISTENCE] Serializing terminal ${terminalId}`);

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

      console.log(
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
    console.log(
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

      if (!storageData?.content) {
        console.log(`📭 [WEBVIEW-PERSISTENCE] No saved content found for terminal ${terminalId}`);
        return false;
      }

      // 保存時間チェック（7日以上前のデータは使用しない）
      const ageMs = Date.now() - storageData.timestamp;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        console.log(
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
    console.log(
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

      console.log(
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
    console.log(
      `📋 [WEBVIEW-PERSISTENCE] Serializing all terminals (${this.terminals.size} terminals)`
    );

    const serializedData = new Map<string, { content: string; html?: string }>();

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
   */
  public async restoreSession(sessionData: {
    terminalId: string;
    scrollbackData?: string[];
    sessionRestoreMessage?: string;
  }): Promise<boolean> {
    console.log(
      `🔄 [WEBVIEW-PERSISTENCE] Restoring session for terminal ${sessionData.terminalId}`
    );

    const { terminalId, scrollbackData, sessionRestoreMessage } = sessionData;
    const terminal = this.terminals.get(terminalId);

    if (!terminal) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No terminal found for session restore: ${terminalId}`);
      return false;
    }

    try {
      // Clear existing content
      terminal.clear();

      // Restore session restore message if available
      if (sessionRestoreMessage) {
        terminal.writeln(sessionRestoreMessage);
        console.log(
          `🔄 [WEBVIEW-PERSISTENCE] Restored session message for terminal: ${terminalId}`
        );
      }

      // Restore scrollback data if available
      if (scrollbackData && scrollbackData.length > 0) {
        console.log(
          `🔄 [WEBVIEW-PERSISTENCE] Restoring ${scrollbackData.length} lines of scrollback for terminal: ${terminalId}`
        );

        // Write each line to restore scrollback history
        for (const line of scrollbackData) {
          if (line.trim()) {
            terminal.writeln(line);
          }
        }

        console.log(
          `✅ [WEBVIEW-PERSISTENCE] Scrollback restored for terminal: ${terminalId} (${scrollbackData.length} lines)`
        );
      }

      // Save the restored content to persistence
      this.saveTerminalContent(terminalId);

      console.log(`✅ [WEBVIEW-PERSISTENCE] Session restore completed for terminal: ${terminalId}`);
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
    console.log(
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
      console.log(
        `📡 [WEBVIEW-PERSISTENCE] Scrollback request sent to Extension for terminal: ${terminalId}`
      );
    } else {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No VS Code API available for scrollback request`);
    }
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    console.log(
      `🧹 [WEBVIEW-PERSISTENCE] Disposing persistence manager (${this.serializeAddons.size} addons)`
    );

    for (const [terminalId, serializeAddon] of this.serializeAddons) {
      try {
        serializeAddon.dispose();
      } catch (error) {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Error disposing addon for ${terminalId}:`, error);
      }
    }

    this.serializeAddons.clear();
    this.terminals.clear();

    console.log(`✅ [WEBVIEW-PERSISTENCE] Persistence manager disposed`);
  }
}
