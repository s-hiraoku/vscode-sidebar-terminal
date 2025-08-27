import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from '@xterm/xterm';

/**
 * WebView側でxterm.js serialize addonを使用したVS Code標準ターミナル永続化
 */
export class StandardTerminalPersistenceManager {
  private serializeAddons: Map<string, SerializeAddon> = new Map();
  private terminals: Map<string, Terminal> = new Map();
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
      const serializeAddon = new SerializeAddon();
      terminal.loadAddon(serializeAddon);

      this.serializeAddons.set(terminalId, serializeAddon);
      this.terminals.set(terminalId, terminal);

      // ターミナル内容が変更されたときに自動保存
      this.setupAutoSave(terminalId, terminal);

      console.log(`✅ [WEBVIEW-PERSISTENCE] Serialize addon loaded for terminal ${terminalId}`);
    } catch (error) {
      console.error(
        `❌ [WEBVIEW-PERSISTENCE] Failed to load serialize addon for terminal ${terminalId}:`,
        error
      );
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

      if (!storageData || !storageData.content) {
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
