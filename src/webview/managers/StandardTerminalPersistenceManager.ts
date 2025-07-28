import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from 'xterm';

/**
 * WebView側でxterm.js serialize addonを使用したVS Code標準ターミナル永続化
 */
export class StandardTerminalPersistenceManager {
  private serializeAddons: Map<string, SerializeAddon> = new Map();
  private terminals: Map<string, Terminal> = new Map();
  
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
      
      console.log(`✅ [WEBVIEW-PERSISTENCE] Serialize addon loaded for terminal ${terminalId}`);
    } catch (error) {
      console.error(`❌ [WEBVIEW-PERSISTENCE] Failed to load serialize addon for terminal ${terminalId}:`, error);
    }
  }

  /**
   * ターミナルを削除
   */
  public removeTerminal(terminalId: string): void {
    console.log(`🗑️ [WEBVIEW-PERSISTENCE] Removing terminal ${terminalId} from persistence manager`);
    
    const serializeAddon = this.serializeAddons.get(terminalId);
    if (serializeAddon) {
      try {
        serializeAddon.dispose();
      } catch (error) {
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] Error disposing serialize addon for ${terminalId}:`, error);
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
      const serializeOptions = {
        scrollback: options?.scrollback || 100,
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
        console.warn(`⚠️ [WEBVIEW-PERSISTENCE] HTML serialization failed for ${terminalId}:`, htmlError);
      }

      console.log(`✅ [WEBVIEW-PERSISTENCE] Terminal ${terminalId} serialized: ${serializedContent.length} chars`);
      
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
   * シリアル化されたコンテンツをターミナルに復元
   */
  public restoreTerminalContent(terminalId: string, serializedContent: string): boolean {
    console.log(`🔄 [WEBVIEW-PERSISTENCE] Restoring content to terminal ${terminalId}`);
    
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      console.warn(`⚠️ [WEBVIEW-PERSISTENCE] No terminal found for ${terminalId}`);
      return false;
    }

    try {
      // VS Code標準: Terminal.open前に復元するのがベスト
      // ただし、既に開いているターミナルの場合はそのまま復元
      terminal.write(serializedContent);
      
      console.log(`✅ [WEBVIEW-PERSISTENCE] Content restored to terminal ${terminalId}: ${serializedContent.length} chars`);
      return true;
    } catch (error) {
      console.error(`❌ [WEBVIEW-PERSISTENCE] Failed to restore content to terminal ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * 全ターミナルのシリアル化データを取得
   */
  public serializeAllTerminals(scrollback: number = 100): Map<string, { content: string; html?: string }> {
    console.log(`📋 [WEBVIEW-PERSISTENCE] Serializing all terminals (${this.terminals.size} terminals)`);
    
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
    console.log(`🧹 [WEBVIEW-PERSISTENCE] Disposing persistence manager (${this.serializeAddons.size} addons)`);
    
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