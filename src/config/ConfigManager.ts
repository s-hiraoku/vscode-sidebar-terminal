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
  TerminalProfile,
  TerminalProfilesConfig,
} from '../types/shared';
import { TERMINAL_CONSTANTS } from '../constants';

/**
 * VS Code設定アクセスを統合管理するクラス
 * 全ての設定取得処理を集約し、型安全性とキャッシュ機能を提供
 */
export class ConfigManager {
  private static _instance: ConfigManager;
  private readonly _configCache = new Map<string, unknown>();
  private readonly _cacheExpiry = new Map<string, number>();
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
      if (vscode.workspace.onDidChangeConfiguration) {
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
      cursor: {
        style: 'block',
        blink: this.getConfig(section, CONFIG_KEYS.CURSOR_BLINK, true),
      },
      enableCliAgentIntegration: this.getConfig(section, 'enableCliAgentIntegration', true),
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

      // Debug log removed for production

      if (terminalFontFamily?.trim()) {
        return terminalFontFamily.trim();
      }

      // 2. エディタのフォント設定をフォールバック
      const editorConfig = vscode.workspace.getConfiguration('editor');
      const editorFontFamily = editorConfig.get<string>('fontFamily');

      // Debug log removed for production

      if (editorFontFamily?.trim()) {
        return editorFontFamily.trim();
      }

      // 3. システムデフォルトのmonospaceフォント
      // Debug log removed for production
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

      // Debug log removed for production

      if (terminalFontSize && terminalFontSize > 0) {
        return terminalFontSize;
      }

      // 2. エディタのフォントサイズ設定をフォールバック
      const editorConfig = vscode.workspace.getConfiguration('editor');
      const editorFontSize = editorConfig.get<number>('fontSize');

      // Debug log removed for production

      if (editorFontSize && editorFontSize > 0) {
        return editorFontSize;
      }

      // 3. デフォルトフォントサイズ
      // Debug log removed for production
      return 14;
    } catch (error) {
      console.error('[ConfigManager] Error getting fontSize:', error);
      return 14;
    }
  }

  /**
   * VS Code標準フォント太さ設定を取得
   * 優先順位：secondaryTerminal.fontWeight > terminal.integrated.fontWeight > default('normal')
   */
  public getFontWeight(): string {
    this._ensureInitialized();

    try {
      // 1. 拡張機能専用のフォント太さ設定を確認
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionFontWeight = extensionConfig.get<string>('fontWeight');

      if (extensionFontWeight?.trim()) {
        return extensionFontWeight.trim();
      }

      // 2. ターミナル専用のフォント太さ設定を確認
      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalFontWeight = terminalConfig.get<string>('fontWeight');

      if (terminalFontWeight?.trim()) {
        return terminalFontWeight.trim();
      }

      // 3. デフォルトフォント太さ
      return 'normal';
    } catch (error) {
      console.error('[ConfigManager] Error getting fontWeight:', error);
      return 'normal';
    }
  }

  /**
   * VS Code標準フォント太字設定を取得
   * 優先順位：secondaryTerminal.fontWeightBold > terminal.integrated.fontWeightBold > default('bold')
   */
  public getFontWeightBold(): string {
    this._ensureInitialized();

    try {
      // 1. 拡張機能専用のフォント太字設定を確認
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionFontWeightBold = extensionConfig.get<string>('fontWeightBold');

      if (extensionFontWeightBold?.trim()) {
        return extensionFontWeightBold.trim();
      }

      // 2. ターミナル専用のフォント太字設定を確認
      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalFontWeightBold = terminalConfig.get<string>('fontWeightBold');

      if (terminalFontWeightBold?.trim()) {
        return terminalFontWeightBold.trim();
      }

      // 3. デフォルトフォント太字
      return 'bold';
    } catch (error) {
      console.error('[ConfigManager] Error getting fontWeightBold:', error);
      return 'bold';
    }
  }

  /**
   * VS Code標準行間隔設定を取得
   * 優先順位：secondaryTerminal.lineHeight > terminal.integrated.lineHeight > default(1.0)
   */
  public getLineHeight(): number {
    this._ensureInitialized();

    try {
      // 1. 拡張機能専用の行間隔設定を確認
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionLineHeight = extensionConfig.get<number>('lineHeight');

      if (extensionLineHeight && extensionLineHeight > 0) {
        return extensionLineHeight;
      }

      // 2. ターミナル専用の行間隔設定を確認
      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalLineHeight = terminalConfig.get<number>('lineHeight');

      if (terminalLineHeight && terminalLineHeight > 0) {
        return terminalLineHeight;
      }

      // 3. デフォルト行間隔
      return 1.0;
    } catch (error) {
      console.error('[ConfigManager] Error getting lineHeight:', error);
      return 1.0;
    }
  }

  /**
   * VS Code標準文字間隔設定を取得
   * 優先順位：secondaryTerminal.letterSpacing > terminal.integrated.letterSpacing > default(0)
   */
  public getLetterSpacing(): number {
    this._ensureInitialized();

    try {
      // 1. 拡張機能専用の文字間隔設定を確認
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionLetterSpacing = extensionConfig.get<number>('letterSpacing');

      if (typeof extensionLetterSpacing === 'number') {
        return extensionLetterSpacing;
      }

      // 2. ターミナル専用の文字間隔設定を確認
      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalLetterSpacing = terminalConfig.get<number>('letterSpacing');

      if (typeof terminalLetterSpacing === 'number') {
        return terminalLetterSpacing;
      }

      // 3. デフォルト文字間隔
      return 0;
    } catch (error) {
      console.error('[ConfigManager] Error getting letterSpacing:', error);
      return 0;
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
   * 🆕 Phase 5: ターミナルプロファイル設定を取得
   * VS Code標準のターミナルプロファイルシステムに対応
   */
  public getTerminalProfilesConfig(): TerminalProfilesConfig {
    this._ensureInitialized();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    return {
      profiles: {
        windows: this.getConfig(section, CONFIG_KEYS.PROFILES_WINDOWS, {}),
        linux: this.getConfig(section, CONFIG_KEYS.PROFILES_LINUX, {}),
        osx: this.getConfig(section, CONFIG_KEYS.PROFILES_OSX, {}),
      },
      defaultProfiles: {
        windows: this.getConfig(section, CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS, null),
        linux: this.getConfig(section, CONFIG_KEYS.DEFAULT_PROFILE_LINUX, null),
        osx: this.getConfig(section, CONFIG_KEYS.DEFAULT_PROFILE_OSX, null),
      },
      autoDetection: {
        enabled: this.getConfig(section, CONFIG_KEYS.ENABLE_PROFILE_AUTO_DETECTION, true),
        searchPaths: [],
        useCache: true,
        cacheExpiration: 3600000, // 1 hour
      },
      inheritVSCodeProfiles: this.getConfig(section, CONFIG_KEYS.INHERIT_VSCODE_PROFILES, true),
    };
  }

  /**
   * 🆕 Phase 5: 現在のプラットフォーム用のターミナルプロファイル設定を取得
   */
  public getTerminalProfilesForCurrentPlatform(): Record<string, TerminalProfile | null> {
    this._ensureInitialized();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    let profileKey: string;
    switch (process.platform) {
      case 'win32':
        profileKey = CONFIG_KEYS.PROFILES_WINDOWS;
        break;
      case 'darwin':
        profileKey = CONFIG_KEYS.PROFILES_OSX;
        break;
      default:
        profileKey = CONFIG_KEYS.PROFILES_LINUX;
        break;
    }

    return this.getConfig(section, profileKey, {});
  }

  /**
   * 🆕 Phase 5: 現在のプラットフォーム用のデフォルトプロファイルを取得
   */
  public getDefaultTerminalProfile(): string | null {
    this._ensureInitialized();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    let defaultKey: string;
    switch (process.platform) {
      case 'win32':
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS;
        break;
      case 'darwin':
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_OSX;
        break;
      default:
        defaultKey = CONFIG_KEYS.DEFAULT_PROFILE_LINUX;
        break;
    }

    return this.getConfig(section, defaultKey, null);
  }

  /**
   * 🆕 Phase 5: VS Codeのターミナルプロファイル設定を取得
   * VS Codeの terminal.integrated.profiles.* 設定から取得
   */
  public getVSCodeTerminalProfiles(): Record<string, TerminalProfile> {
    this._ensureInitialized();

    let profileKey: string;
    switch (process.platform) {
      case 'win32':
        profileKey = 'profiles.windows';
        break;
      case 'darwin':
        profileKey = 'profiles.osx';
        break;
      default:
        profileKey = 'profiles.linux';
        break;
    }

    const vscodeConfig = vscode.workspace.getConfiguration('terminal.integrated');
    const vscodeProfiles = vscodeConfig.get<Record<string, any>>(profileKey, {});

    // VS CodeのプロファイルフォーマットをTerminalProfileに変換
    const convertedProfiles: Record<string, TerminalProfile> = {};

    for (const [name, profile] of Object.entries(vscodeProfiles)) {
      if (profile && typeof profile === 'object' && profile.path) {
        convertedProfiles[name] = {
          path: profile.path,
          args: profile.args,
          cwd: profile.cwd,
          env: profile.env,
          icon: profile.icon,
          color: profile.color,
          isVisible: profile.isVisible !== false, // デフォルトはtrue
          overrideName: profile.overrideName,
          useColor: profile.useColor,
        };
      }
    }

    return convertedProfiles;
  }

  /**
   * 🆕 Phase 5: VS Codeプロファイル継承が有効かチェック
   */
  public isVSCodeProfileInheritanceEnabled(): boolean {
    this._ensureInitialized();
    return this.getConfig(
      CONFIG_SECTIONS.SIDEBAR_TERMINAL,
      CONFIG_KEYS.INHERIT_VSCODE_PROFILES,
      true
    );
  }

  /**
   * 🆕 Phase 5: プロファイル自動検出が有効かチェック
   */
  public isProfileAutoDetectionEnabled(): boolean {
    this._ensureInitialized();
    return this.getConfig(
      CONFIG_SECTIONS.SIDEBAR_TERMINAL,
      CONFIG_KEYS.ENABLE_PROFILE_AUTO_DETECTION,
      true
    );
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
