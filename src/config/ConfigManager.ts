/**
 * 設定管理クラス - VS Code設定へのアクセスを統合
 */

import * as vscode from 'vscode';
import {
  CONFIG_SECTIONS,
  CONFIG_KEYS,
  ExtensionTerminalConfig,
  CompleteTerminalSettings,
  CompleteExtensionConfig,
} from '../types/shared';
import { TERMINAL_CONSTANTS } from '../constants';

/**
 * VS Code設定アクセスを統合管理するクラス
 * 全ての設定取得処理を集約し、型安全性とキャッシュ機能を提供
 */
export class ConfigManager {
  private static _instance: ConfigManager;
  private _configCache = new Map<string, unknown>();
  private _cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5000; // 5秒のキャッシュ

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager._instance) {
      ConfigManager._instance = new ConfigManager();
    }
    return ConfigManager._instance;
  }

  private _initialized = false;

  private constructor() {
    // 遅延初期化
  }

  private _ensureInitialized(): void {
    if (this._initialized) {
      return;
    }

    // VS Code設定変更イベントを監視してキャッシュをクリア（テスト環境では安全にスキップ）
    try {
      if (vscode?.workspace?.onDidChangeConfiguration) {
        vscode.workspace.onDidChangeConfiguration((event) => {
          if (
            event.affectsConfiguration(CONFIG_SECTIONS.SIDEBAR_TERMINAL) ||
            event.affectsConfiguration(CONFIG_SECTIONS.EDITOR) ||
            event.affectsConfiguration(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
          ) {
            this.clearCache();
          }
        });
      }
    } catch (error) {
      // テスト環境やモック環境では無視
      console.warn('ConfigManager: VS Code workspace API not available:', error);
    }

    this._initialized = true;
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this._configCache.clear();
    this._cacheExpiry.clear();
  }

  /**
   * 基本的な設定取得（型安全版）
   */
  public getConfig<T>(section: string, key: string, defaultValue: T): T {
    const cacheKey = `${section}.${key}`;

    // キャッシュチェック
    if (this._isValidCache(cacheKey)) {
      return this._configCache.get(cacheKey) as T;
    }

    // VS Code設定から取得
    const config = vscode.workspace.getConfiguration(section);
    const value = config.get<T>(key, defaultValue);

    // キャッシュに保存
    this._configCache.set(cacheKey, value);
    this._cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

    return value;
  }

  /**
   * Extension用ターミナル設定を取得
   * 従来の getTerminalConfig() の置き換え
   */
  public getExtensionTerminalConfig(): ExtensionTerminalConfig {
    this._ensureInitialized();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    return {
      maxTerminals: this.getConfig(
        section,
        CONFIG_KEYS.MAX_TERMINALS,
        TERMINAL_CONSTANTS.DEFAULT_MAX_TERMINALS
      ),
      shell: this.getConfig(section, CONFIG_KEYS.SHELL, ''),
      shellArgs: this.getConfig(section, CONFIG_KEYS.SHELL_ARGS, []),
      defaultDirectory: this.getConfig(section, CONFIG_KEYS.DEFAULT_DIRECTORY, ''),
      fontSize: this.getFontSize(),
      fontFamily: this.getFontFamily(),
      cursorBlink: this.getConfig(section, CONFIG_KEYS.CURSOR_BLINK, true),
    };
  }

  /**
   * 完全なターミナル設定を取得
   */
  public getCompleteTerminalSettings(): CompleteTerminalSettings {
    this._ensureInitialized();
    const sidebarConfig = this.getExtensionTerminalConfig();

    return {
      ...sidebarConfig,
      fontSize: this.getFontSize(),
      fontFamily: this.getFontFamily(),
      theme: this.getConfig(CONFIG_SECTIONS.SIDEBAR_TERMINAL, CONFIG_KEYS.THEME, 'auto'),
      cursorBlink: this.getConfig(CONFIG_SECTIONS.SIDEBAR_TERMINAL, CONFIG_KEYS.CURSOR_BLINK, true),
      confirmBeforeKill: this.getConfig(
        CONFIG_SECTIONS.SIDEBAR_TERMINAL,
        CONFIG_KEYS.CONFIRM_BEFORE_KILL,
        false
      ),
      protectLastTerminal: this.getConfig(
        CONFIG_SECTIONS.SIDEBAR_TERMINAL,
        CONFIG_KEYS.PROTECT_LAST_TERMINAL,
        true
      ),
      minTerminalCount: this.getConfig(
        CONFIG_SECTIONS.SIDEBAR_TERMINAL,
        CONFIG_KEYS.MIN_TERMINAL_COUNT,
        1
      ),
      altClickMovesCursor: this.getConfig(
        CONFIG_SECTIONS.TERMINAL_INTEGRATED,
        CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR,
        false
      ),
      multiCursorModifier: this.getConfig(
        CONFIG_SECTIONS.EDITOR,
        CONFIG_KEYS.MULTI_CURSOR_MODIFIER,
        'ctrlCmd'
      ),
    };
  }

  /**
   * WebView表示設定を取得
   */
  public getCompleteExtensionConfig(): CompleteExtensionConfig {
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;
    const baseConfig = this.getCompleteTerminalSettings();

    return {
      fontSize: baseConfig.fontSize,
      fontFamily: baseConfig.fontFamily,
      theme: baseConfig.theme || 'auto',
      cursorBlink: baseConfig.cursorBlink,
      maxTerminals: baseConfig.maxTerminals,
      minTerminalHeight: this.getConfig(section, 'minTerminalHeight', 200),
      autoHideStatus: this.getConfig(section, 'autoHideStatus', true),
      statusDisplayDuration: this.getConfig(section, 'statusDisplayDuration', 3000),
      showWebViewHeader: this.getConfig(section, 'showWebViewHeader', true),
      webViewTitle: this.getConfig(section, 'webViewTitle', 'Terminal'),
      showSampleIcons: this.getConfig(section, 'showSampleIcons', true),
      sampleIconOpacity: this.getConfig(section, 'sampleIconOpacity', 0.3),
      headerFontSize: this.getConfig(section, 'headerFontSize', 14),
      headerIconSize: this.getConfig(section, 'headerIconSize', 16),
      sampleIconSize: this.getConfig(section, 'sampleIconSize', 24),
    };
  }

  /**
   * プラットフォーム固有のシェル設定を取得
   */
  public getShellForPlatform(customShell?: string): string {
    this._ensureInitialized();
    if (customShell) {
      return customShell;
    }

    const section = CONFIG_SECTIONS.TERMINAL_INTEGRATED;

    switch (process.platform) {
      case TERMINAL_CONSTANTS.PLATFORMS.WINDOWS:
        return (
          this.getConfig(section, CONFIG_KEYS.SHELL_WINDOWS, '') ||
          process.env['COMSPEC'] ||
          'cmd.exe'
        );

      case TERMINAL_CONSTANTS.PLATFORMS.DARWIN:
        return (
          this.getConfig(section, CONFIG_KEYS.SHELL_OSX, '') || process.env['SHELL'] || '/bin/zsh'
        );

      default:
        return (
          this.getConfig(section, CONFIG_KEYS.SHELL_LINUX, '') ||
          process.env['SHELL'] ||
          '/bin/bash'
        );
    }
  }

  /**
   * Alt+Click設定を取得
   */
  public getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string } {
    this._ensureInitialized();
    return {
      altClickMovesCursor: this.getConfig(
        CONFIG_SECTIONS.TERMINAL_INTEGRATED,
        CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR,
        false
      ),
      multiCursorModifier: this.getConfig(
        CONFIG_SECTIONS.EDITOR,
        CONFIG_KEYS.MULTI_CURSOR_MODIFIER,
        'ctrlCmd'
      ),
    };
  }

  /**
   * VS Codeのフォント設定を取得
   * 優先順位：terminal.integrated.fontFamily > editor.fontFamily > system monospace
   */
  public getFontFamily(): string {
    this._ensureInitialized();

    try {
      // 1. ターミナル専用のフォント設定を確認
      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalFontFamily = terminalConfig.get<string>('fontFamily');

      console.log('[ConfigManager] Terminal fontFamily from VS Code:', terminalFontFamily);

      if (terminalFontFamily && terminalFontFamily.trim()) {
        return terminalFontFamily.trim();
      }

      // 2. エディタのフォント設定をフォールバック
      const editorConfig = vscode.workspace.getConfiguration('editor');
      const editorFontFamily = editorConfig.get<string>('fontFamily');

      console.log('[ConfigManager] Editor fontFamily from VS Code:', editorFontFamily);

      if (editorFontFamily && editorFontFamily.trim()) {
        return editorFontFamily.trim();
      }

      // 3. システムデフォルトのmonospaceフォント
      console.log('[ConfigManager] Using default fontFamily: monospace');
      return 'monospace';
    } catch (error) {
      console.error('[ConfigManager] Error getting fontFamily:', error);
      return 'monospace';
    }
  }

  /**
   * VS Codeのフォントサイズ設定を取得
   * 優先順位：terminal.integrated.fontSize > editor.fontSize > default(14)
   */
  public getFontSize(): number {
    this._ensureInitialized();

    try {
      // 1. ターミナル専用のフォントサイズ設定を確認
      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalFontSize = terminalConfig.get<number>('fontSize');

      console.log('[ConfigManager] Terminal fontSize from VS Code:', terminalFontSize);

      if (terminalFontSize && terminalFontSize > 0) {
        return terminalFontSize;
      }

      // 2. エディタのフォントサイズ設定をフォールバック
      const editorConfig = vscode.workspace.getConfiguration('editor');
      const editorFontSize = editorConfig.get<number>('fontSize');

      console.log('[ConfigManager] Editor fontSize from VS Code:', editorFontSize);

      if (editorFontSize && editorFontSize > 0) {
        return editorFontSize;
      }

      // 3. デフォルトフォントサイズ
      console.log('[ConfigManager] Using default fontSize: 14');
      return 14;
    } catch (error) {
      console.error('[ConfigManager] Error getting fontSize:', error);
      return 14;
    }
  }

  /**
   * 設定変更の監視を開始
   */
  public onConfigurationChange(
    callback: (event: vscode.ConfigurationChangeEvent) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(callback);
  }

  /**
   * キャッシュの有効性をチェック
   */
  private _isValidCache(key: string): boolean {
    const expiry = this._cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this._configCache.delete(key);
      this._cacheExpiry.delete(key);
      return false;
    }
    return this._configCache.has(key);
  }

  /**
   * デバッグ用：現在のキャッシュ状態を取得
   */
  public getCacheInfo(): { size: number; keys: string[] } {
    return {
      size: this._configCache.size,
      keys: Array.from(this._configCache.keys()),
    };
  }
}

/**
 * ConfigManager のシングルトンインスタンスを取得するヘルパー関数
 * 他モジュールからのアクセス用（遅延初期化）
 */
export function getConfigManager(): ConfigManager {
  return ConfigManager.getInstance();
}
