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
import { TERMINAL_CONSTANTS, CONFIG_CACHE_CONSTANTS } from '../constants/SystemConstants';

/** Unified VS Code configuration access with type safety and caching */
export class ConfigManager {
  private static _instance: ConfigManager;
  private _configCache = new Map<string, unknown>();
  private _cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = CONFIG_CACHE_CONSTANTS.CACHE_TTL_MS;
  private _initialized = false;

  public static getInstance(): ConfigManager {
    if (!ConfigManager._instance) {
      ConfigManager._instance = new ConfigManager();
    }
    return ConfigManager._instance;
  }

  private constructor() {}

  private _ensureInitialized(): void {
    if (this._initialized) {
      return;
    }

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
    } catch {
      // Test/mock environment - VS Code API not available
    }

    this._initialized = true;
  }

  public clearCache(): void {
    this._configCache.clear();
    this._cacheExpiry.clear();
  }

  public getConfig<T>(section: string, key: string, defaultValue: T): T {
    const cacheKey = `${section}.${key}`;

    if (this._isValidCache(cacheKey)) {
      return this._configCache.get(cacheKey) as T;
    }

    const config = vscode.workspace.getConfiguration(section);
    const value = config.get<T>(key, defaultValue);

    this._configCache.set(cacheKey, value);
    this._cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

    return value;
  }

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
      activeBorderMode: this.getConfig(section, 'activeBorderMode', 'multipleOnly'),
    };
  }

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
      activeBorderMode: this.getConfig(
        CONFIG_SECTIONS.SIDEBAR_TERMINAL,
        'activeBorderMode',
        'multipleOnly'
      ),
    };
  }

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
      autoHideStatus: this.getConfig(section, 'autoHideStatus', false),
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

  /** Font family: secondaryTerminal > terminal.integrated > editor > system monospace */
  public getFontFamily(): string {
    this._ensureInitialized();

    try {
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionFontFamily = extensionConfig.get<string>('fontFamily');
      if (extensionFontFamily && extensionFontFamily.trim() && extensionFontFamily.trim() !== 'monospace') {
        return extensionFontFamily.trim();
      }

      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalFontFamily = terminalConfig.get<string>('fontFamily');
      if (terminalFontFamily && terminalFontFamily.trim()) {
        return terminalFontFamily.trim();
      }

      const editorConfig = vscode.workspace.getConfiguration('editor');
      const editorFontFamily = editorConfig.get<string>('fontFamily');
      if (editorFontFamily && editorFontFamily.trim()) {
        return editorFontFamily.trim();
      }

      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_FAMILY;
    } catch {
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_FAMILY;
    }
  }

  /** Font size: secondaryTerminal > terminal.integrated > editor > default(14) */
  public getFontSize(): number {
    this._ensureInitialized();

    try {
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionFontSize = extensionConfig.get<number>('fontSize');
      if (extensionFontSize && extensionFontSize > 0 && extensionFontSize !== 12) {
        return extensionFontSize;
      }

      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalFontSize = terminalConfig.get<number>('fontSize');
      if (terminalFontSize && terminalFontSize > 0) {
        return terminalFontSize;
      }

      const editorConfig = vscode.workspace.getConfiguration('editor');
      const editorFontSize = editorConfig.get<number>('fontSize');
      if (editorFontSize && editorFontSize > 0) {
        return editorFontSize;
      }

      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_SIZE;
    } catch {
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_SIZE;
    }
  }

  /** Font weight: secondaryTerminal > terminal.integrated > default('normal') */
  public getFontWeight(): string {
    this._ensureInitialized();

    try {
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionFontWeight = extensionConfig.get<string>('fontWeight');
      if (extensionFontWeight && extensionFontWeight.trim()) {
        return extensionFontWeight.trim();
      }

      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalFontWeight = terminalConfig.get<string>('fontWeight');
      if (terminalFontWeight && terminalFontWeight.trim()) {
        return terminalFontWeight.trim();
      }

      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_WEIGHT;
    } catch {
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_WEIGHT;
    }
  }

  /** Bold font weight: secondaryTerminal > terminal.integrated > default('bold') */
  public getFontWeightBold(): string {
    this._ensureInitialized();

    try {
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionFontWeightBold = extensionConfig.get<string>('fontWeightBold');
      if (extensionFontWeightBold && extensionFontWeightBold.trim()) {
        return extensionFontWeightBold.trim();
      }

      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalFontWeightBold = terminalConfig.get<string>('fontWeightBold');
      if (terminalFontWeightBold && terminalFontWeightBold.trim()) {
        return terminalFontWeightBold.trim();
      }

      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_WEIGHT_BOLD;
    } catch {
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_WEIGHT_BOLD;
    }
  }

  /** Line height: secondaryTerminal > terminal.integrated > default(1.0) */
  public getLineHeight(): number {
    this._ensureInitialized();

    try {
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionLineHeight = extensionConfig.get<number>('lineHeight');
      if (extensionLineHeight && extensionLineHeight > 0) {
        return extensionLineHeight;
      }

      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalLineHeight = terminalConfig.get<number>('lineHeight');
      if (terminalLineHeight && terminalLineHeight > 0) {
        return terminalLineHeight;
      }

      return CONFIG_CACHE_CONSTANTS.DEFAULT_LINE_HEIGHT;
    } catch {
      return CONFIG_CACHE_CONSTANTS.DEFAULT_LINE_HEIGHT;
    }
  }

  /** Letter spacing: secondaryTerminal > terminal.integrated > default(0) */
  public getLetterSpacing(): number {
    this._ensureInitialized();

    try {
      const extensionConfig = vscode.workspace.getConfiguration('secondaryTerminal');
      const extensionLetterSpacing = extensionConfig.get<number>('letterSpacing');
      if (typeof extensionLetterSpacing === 'number') {
        return extensionLetterSpacing;
      }

      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const terminalLetterSpacing = terminalConfig.get<number>('letterSpacing');
      if (typeof terminalLetterSpacing === 'number') {
        return terminalLetterSpacing;
      }

      return CONFIG_CACHE_CONSTANTS.DEFAULT_LETTER_SPACING;
    } catch {
      return CONFIG_CACHE_CONSTANTS.DEFAULT_LETTER_SPACING;
    }
  }

  public onConfigurationChange(
    callback: (event: vscode.ConfigurationChangeEvent) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(callback);
  }

  private _isValidCache(key: string): boolean {
    const expiry = this._cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this._configCache.delete(key);
      this._cacheExpiry.delete(key);
      return false;
    }
    return this._configCache.has(key);
  }

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
        cacheExpiration: CONFIG_CACHE_CONSTANTS.PROFILE_CACHE_EXPIRATION_MS,
      },
      inheritVSCodeProfiles: this.getConfig(section, CONFIG_KEYS.INHERIT_VSCODE_PROFILES, true),
    };
  }

  public getTerminalProfilesForCurrentPlatform(): Record<string, TerminalProfile | null> {
    this._ensureInitialized();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    const profileKeyMap: Record<string, string> = {
      win32: CONFIG_KEYS.PROFILES_WINDOWS,
      darwin: CONFIG_KEYS.PROFILES_OSX,
    };
    const profileKey = profileKeyMap[process.platform] || CONFIG_KEYS.PROFILES_LINUX;

    return this.getConfig(section, profileKey, {});
  }

  public getDefaultTerminalProfile(): string | null {
    this._ensureInitialized();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    const defaultKeyMap: Record<string, string> = {
      win32: CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS,
      darwin: CONFIG_KEYS.DEFAULT_PROFILE_OSX,
    };
    const defaultKey = defaultKeyMap[process.platform] || CONFIG_KEYS.DEFAULT_PROFILE_LINUX;

    return this.getConfig(section, defaultKey, null);
  }

  public getVSCodeTerminalProfiles(): Record<string, TerminalProfile> {
    this._ensureInitialized();

    const profileKeyMap: Record<string, string> = {
      win32: 'profiles.windows',
      darwin: 'profiles.osx',
    };
    const profileKey = profileKeyMap[process.platform] || 'profiles.linux';

    const vscodeConfig = vscode.workspace.getConfiguration('terminal.integrated');
    const vscodeProfiles = vscodeConfig.get<Record<string, unknown>>(profileKey, {});

    const convertedProfiles: Record<string, TerminalProfile> = {};

    for (const [name, profile] of Object.entries(vscodeProfiles)) {
      if (profile && typeof profile === 'object') {
        const prof = profile as Record<string, unknown>;
        if (prof.path) {
          convertedProfiles[name] = {
            path: prof.path as string,
            args: prof.args as string[] | undefined,
            cwd: prof.cwd as string | undefined,
            env: prof.env as Record<string, string> | undefined,
            icon: prof.icon as string | undefined,
            color: prof.color as string | undefined,
            isVisible: prof.isVisible !== false,
            overrideName: prof.overrideName as boolean | undefined,
            useColor: prof.useColor as boolean | undefined,
          };
        }
      }
    }

    return convertedProfiles;
  }

  public isVSCodeProfileInheritanceEnabled(): boolean {
    this._ensureInitialized();
    return this.getConfig(
      CONFIG_SECTIONS.SIDEBAR_TERMINAL,
      CONFIG_KEYS.INHERIT_VSCODE_PROFILES,
      true
    );
  }

  public isProfileAutoDetectionEnabled(): boolean {
    this._ensureInitialized();
    return this.getConfig(
      CONFIG_SECTIONS.SIDEBAR_TERMINAL,
      CONFIG_KEYS.ENABLE_PROFILE_AUTO_DETECTION,
      true
    );
  }

  public getCacheInfo(): { size: number; keys: string[] } {
    return {
      size: this._configCache.size,
      keys: Array.from(this._configCache.keys()),
    };
  }
}

export function getConfigManager(): ConfigManager {
  return ConfigManager.getInstance();
}
