import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from 'xterm';

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
    let lastSaveTime = 0;
    let changeCount = 0;

    const saveContent = () => {
      changeCount++;

      if (saveTimer) {
        clearTimeout(saveTimer);
      }

      // より積極的な保存戦略
      const currentTime = Date.now();
      const timeSinceLastSave = currentTime - lastSaveTime;

      // 大量の変更がある場合（10回以上の変更）は早めに保存
      // または最後の保存から5秒以上経過した場合も保存
      const shouldSaveEarly = changeCount >= 10 || timeSinceLastSave >= 5000;
      const debounceTime = shouldSaveEarly ? 500 : 2000; // 通常2秒、緊急時0.5秒

      saveTimer = window.setTimeout(() => {
        this.saveTerminalContent(terminalId);
        lastSaveTime = Date.now();
        changeCount = 0;
      }, debounceTime);
    };

    // より多くのイベントでトリガー
    terminal.onData(saveContent);
    terminal.onLineFeed(saveContent);
    terminal.onScroll(saveContent);

    // ターミナルフォーカス離脱時にも保存
    terminal.onSelectionChange(() => {
      // セレクション変更時は即座に保存
      setTimeout(() => {
        this.saveTerminalContent(terminalId);
        lastSaveTime = Date.now();
      }, 100);
    });

    // 定期的な保存（30秒毎）
    const periodicSave = setInterval(() => {
      if (changeCount > 0) {
        this.saveTerminalContent(terminalId);
        lastSaveTime = Date.now();
        changeCount = 0;
      }
    }, 30000);

    // クリーンアップ用にインターバルを保存
    const cleanupKey = `periodic-${terminalId}`;
    (this as any)[cleanupKey] = periodicSave;

    console.log(`🔧 [WEBVIEW-PERSISTENCE] Enhanced auto-save enabled for terminal ${terminalId}`);
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

    // 最後の保存を実行
    try {
      this.saveTerminalContent(terminalId);
      console.log(`💾 [WEBVIEW-PERSISTENCE] Final save completed for terminal ${terminalId}`);
    } catch (error) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Final save failed for ${terminalId}:`, error);
    }

    // SerializeAddonをクリーンアップ
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

    // 定期保存タイマーをクリーンアップ
    const cleanupKey = `periodic-${terminalId}`;
    const periodicSave = (this as any)[cleanupKey];
    if (periodicSave) {
      clearInterval(periodicSave);
      delete (this as any)[cleanupKey];
      console.log(`🧹 [WEBVIEW-PERSISTENCE] Cleaned up periodic save for ${terminalId}`);
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
   * 保存されたコンテンツからターミナルを復元（新しいIDで古いIDのデータを復元）
   */
  public restoreTerminalFromStorage(terminalId: string, originalId?: string): boolean {
    console.log(
      `🔄 [WEBVIEW-PERSISTENCE] Attempting to restore terminal ${terminalId} from storage${originalId ? ` (original: ${originalId})` : ''}`
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

      // 復元の優先順位:
      // 1. originalIdがある場合はそれを使用
      // 2. 現在のterminalIdを使用
      // 3. 全てのキーを検索して最新のデータを使用
      const searchIds = originalId ? [originalId, terminalId] : [terminalId];

      let storageData:
        | {
            content: string;
            timestamp: number;
            version: string;
            terminalId: string;
          }
        | undefined;

      let foundKey: string | null = null;

      for (const searchId of searchIds) {
        const storageKey = `${StandardTerminalPersistenceManager.STORAGE_KEY_PREFIX}${searchId}`;
        const data = state?.[storageKey] as typeof storageData;
        if (data && data.content) {
          storageData = data;
          foundKey = storageKey;
          console.log(`🔍 [WEBVIEW-PERSISTENCE] Found data with key: ${storageKey}`);
          break;
        }
      }

      // それでも見つからない場合は、prefix検索を実行
      if (!storageData && state) {
        const allKeys = Object.keys(state);
        const terminalKeys = allKeys.filter((key) =>
          key.startsWith(StandardTerminalPersistenceManager.STORAGE_KEY_PREFIX)
        );

        console.log(
          `🔍 [WEBVIEW-PERSISTENCE] Searching among ${terminalKeys.length} terminal keys`
        );

        // 最新のタイムスタンプのデータを選択
        let latestData:
          | {
              content: string;
              timestamp: number;
              version: string;
              terminalId: string;
            }
          | undefined;
        let latestTimestamp = 0;

        for (const key of terminalKeys) {
          const data = state[key] as
            | {
                content: string;
                timestamp: number;
                version: string;
                terminalId: string;
              }
            | undefined;
          if (data && data.content && data.timestamp > latestTimestamp) {
            latestData = data;
            latestTimestamp = data.timestamp;
            foundKey = key;
          }
        }

        if (latestData) {
          storageData = latestData;
          console.log(`🔍 [WEBVIEW-PERSISTENCE] Using latest data from key: ${foundKey}`);
        }
      }

      if (!storageData || !storageData.content) {
        console.log(
          `📭 [WEBVIEW-PERSISTENCE] No saved content found for terminal ${terminalId}${originalId ? ` or ${originalId}` : ''}`
        );
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

      console.log(
        `✅ [WEBVIEW-PERSISTENCE] Found valid data from ${foundKey}, restoring to terminal ${terminalId}`
      );
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
      // VS Code標準アプローチの改善版: より確実な復元処理

      // Step 1: ターミナルをリセットして初期状態にする
      terminal.reset();

      // Step 2: 復元メッセージを表示
      const restoreTimestamp = new Date().toLocaleString();
      terminal.writeln(`\x1b[32m📋 [${restoreTimestamp}] Restoring terminal history...\x1b[0m`);

      // Step 3: シリアル化されたコンテンツを復元
      // 改善: データを分割して段階的に復元することで、大量データでも確実に処理
      const chunkSize = 1000; // 1000文字ずつ分割
      const chunks: string[] = [];
      for (let i = 0; i < serializedContent.length; i += chunkSize) {
        chunks.push(serializedContent.slice(i, i + chunkSize));
      }

      // Step 4: 非同期で段階的に復元
      let chunkIndex = 0;
      const writeChunk = (): void => {
        if (chunkIndex < chunks.length) {
          const chunk = chunks[chunkIndex];
          if (chunk !== undefined) {
            terminal.write(chunk);
          }
          chunkIndex++;

          // 次のチャンクを少し遅延させて処理
          setTimeout(writeChunk, 10);
        } else {
          // Step 5: 復元完了後の処理
          terminal.writeln(
            `\x1b[32m✅ History restored (${serializedContent.length} characters)\x1b[0m`
          );

          // スクロール位置を適切に調整
          setTimeout(() => {
            // 最後の数行が見えるようにスクロール調整
            const buffer = terminal.buffer.active;
            if (buffer.length > terminal.rows) {
              terminal.scrollToBottom();
            }
          }, 100);
        }
      };

      // 復元処理を開始
      setTimeout(writeChunk, 50);

      console.log(
        `✅ [WEBVIEW-PERSISTENCE] Terminal state restoration initiated for ${terminalId}: ${serializedContent.length} chars`
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
