/**
 * Unified Configuration Service
 *
 * Consolidates all configuration management across the extension following VS Code patterns.
 * This service replaces:
 * - src/config/ConfigManager.ts
 * - src/webview/managers/ConfigManager.ts
 * - src/services/core/UnifiedConfigurationService.ts
 * - src/services/webview/WebViewSettingsManagerService.ts
 *
 * Architecture follows VS Code's IConfigurationService pattern with:
 * - Configuration registry for type safety
 * - Hierarchical configuration targets
 * - Event-driven change notifications
 * - Centralized caching and validation
 */

import * as vscode from 'vscode';
import { EventEmitter, Disposable } from 'vscode';
import {
  CONFIG_SECTIONS,
  CONFIG_KEYS,
  ExtensionTerminalConfig,
  CompleteTerminalSettings,
  CompleteExtensionConfig,
  WebViewFontSettings,
  WebViewTerminalSettings,
  TerminalProfilesConfig,
} from '../types/shared';
import { TERMINAL_CONSTANTS, CONFIG_CACHE_CONSTANTS } from '../constants/SystemConstants';
import { terminal as log } from '../utils/logger';

/**
 * Configuration target priority (higher number = higher priority)
 * Following VS Code's ConfigurationTarget pattern
 */
export enum ConfigurationTarget {
  DEFAULT = 0,
  APPLICATION = 1,
  USER = 2,
  WORKSPACE = 3,
  WORKSPACE_FOLDER = 4,
  MEMORY = 5, // Runtime overrides
}

/**
 * Configuration change event following VS Code patterns
 */
export interface ConfigurationChangeEvent {
  readonly affectsConfiguration: (section: string, key?: string) => boolean;
  readonly source: ConfigurationTarget;
  readonly changedKeys: string[];
  readonly timestamp: number;
}

/**
 * Configuration schema for type safety and validation
 */
interface ConfigurationSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  properties?: Record<string, ConfigurationSchema>;
}

/**
 * Configuration registry following VS Code's IConfigurationRegistry pattern
 */
class ConfigurationRegistry {
  private _schemas = new Map<string, ConfigurationSchema>();

  register(key: string, schema: ConfigurationSchema): void {
    this._schemas.set(key, schema);
  }

  getSchema(key: string): ConfigurationSchema | undefined {
    return this._schemas.get(key);
  }

  validate(key: string, value: unknown): { isValid: boolean; errors: string[] } {
    const schema = this._schemas.get(key);
    if (!schema) {
      return { isValid: true, errors: [] };
    }

    const errors: string[] = [];

    // Type validation
    if (schema.type === 'number' && typeof value !== 'number') {
      errors.push(`Expected number, got ${typeof value}`);
    } else if (schema.type === 'string' && typeof value !== 'string') {
      errors.push(`Expected string, got ${typeof value}`);
    } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Expected boolean, got ${typeof value}`);
    } else if (schema.type === 'array' && !Array.isArray(value)) {
      errors.push(`Expected array, got ${typeof value}`);
    } else if (schema.type === 'object' && (typeof value !== 'object' || value === null)) {
      errors.push(`Expected object, got ${typeof value}`);
    }

    // Range validation for numbers
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`Value ${value} is below minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`Value ${value} exceeds maximum ${schema.maximum}`);
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Value ${value} is not one of allowed values: ${schema.enum.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  }
}

/**
 * Unified Configuration Service
 *
 * Single source of truth for all extension configuration management.
 * Follows VS Code's configuration architecture patterns.
 */
export class UnifiedConfigurationService implements Disposable {
  private static _instance: UnifiedConfigurationService | undefined;

  // Event handling following VS Code patterns
  private readonly _onDidChangeConfiguration = new EventEmitter<ConfigurationChangeEvent>();
  public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

  // Configuration registry and caching
  private readonly _registry = new ConfigurationRegistry();
  private readonly _configurationCache = new Map<string, { value: unknown; expiry: number }>();
  private readonly _disposables: vscode.Disposable[] = [];

  // Cache configuration
  private readonly CACHE_TTL = CONFIG_CACHE_CONSTANTS.CACHE_TTL_MS;
  private _initialized = false;

  /**
   * Get singleton instance following VS Code patterns
   */
  public static getInstance(): UnifiedConfigurationService {
    if (!UnifiedConfigurationService._instance) {
      UnifiedConfigurationService._instance = new UnifiedConfigurationService();
    }
    return UnifiedConfigurationService._instance;
  }

  private constructor() {
    this._registerConfigurationSchemas();
    this._initializeConfigurationWatcher();
    log('⚙️ [UnifiedConfig] Unified configuration service initialized');
  }

  /**
   * Initialize the service (ensures proper VS Code API availability)
   */
  public initialize(): void {
    if (this._initialized) {
      return;
    }

    try {
      // Test VS Code API availability
      if (typeof vscode !== 'undefined' && vscode?.workspace) {
        // Test if we can actually use getConfiguration
        vscode.workspace.getConfiguration(); // This should work if API is available
        this._initialized = true;
        log('✅ [UnifiedConfig] Service initialized with VS Code API');
      } else {
        log('⚠️ [UnifiedConfig] VS Code API not available, running in limited mode');
      }
    } catch (error) {
      log('❌ [UnifiedConfig] Error during initialization:', error);
    }
  }

  /**
   * Get configuration value with type safety and caching
   */
  public get<T>(section: string, key: string, defaultValue: T): T {
    const fullKey = `${section}.${key}`;

    // Check cache first
    const cached = this._configurationCache.get(fullKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.value as T;
    }

    try {
      // Get from VS Code configuration
      const config = vscode.workspace.getConfiguration(section);
      const value = config.get<T>(key, defaultValue);

      // Validate against schema
      const validation = this._registry.validate(fullKey, value);
      if (!validation.isValid) {
        log(`⚠️ [UnifiedConfig] Validation failed for ${fullKey}:`, validation.errors);
        // Use default value on validation failure
        return defaultValue;
      }

      // Cache the value
      this._configurationCache.set(fullKey, {
        value,
        expiry: Date.now() + this.CACHE_TTL,
      });

      return value;
    } catch (error) {
      log(`❌ [UnifiedConfig] Error getting ${fullKey}:`, error);
      return defaultValue;
    }
  }

  /**
   * Update configuration value following VS Code patterns
   */
  public async update(
    section: string,
    key: string,
    value: unknown,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const fullKey = `${section}.${key}`;

    try {
      // Validate against schema
      const validation = this._registry.validate(fullKey, value);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const config = vscode.workspace.getConfiguration(section);
      const oldValue = config.get(key);

      await config.update(key, value, target);

      // Clear cache
      this._configurationCache.delete(fullKey);

      // Fire change event
      this._onDidChangeConfiguration.fire({
        affectsConfiguration: (checkSection: string, checkKey?: string) => {
          if (checkKey) {
            return checkSection === section && checkKey === key;
          }
          return checkSection === section;
        },
        source: this._mapVSCodeTargetToConfigTarget(target),
        changedKeys: [fullKey],
        timestamp: Date.now(),
      });

      log(`⚙️ [UnifiedConfig] Updated ${fullKey}: ${oldValue} → ${value}`);
    } catch (error) {
      log(`❌ [UnifiedConfig] Failed to update ${fullKey}:`, error);
      throw error;
    }
  }

  /**
   * Get extension terminal configuration (replaces ConfigManager.getExtensionTerminalConfig)
   */
  public getExtensionTerminalConfig(): ExtensionTerminalConfig {
    this.initialize();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    return {
      maxTerminals: this.get(
        section,
        CONFIG_KEYS.MAX_TERMINALS,
        TERMINAL_CONSTANTS.DEFAULT_MAX_TERMINALS
      ),
      shell: this.get(section, CONFIG_KEYS.SHELL, ''),
      shellArgs: this.get(section, CONFIG_KEYS.SHELL_ARGS, []),
      defaultDirectory: this.get(section, CONFIG_KEYS.DEFAULT_DIRECTORY, ''),
      fontSize: this.getFontSize(),
      fontFamily: this.getFontFamily(),
      cursorBlink: this.get(section, CONFIG_KEYS.CURSOR_BLINK, true),
      cursor: {
        style: 'block',
        blink: this.get(section, CONFIG_KEYS.CURSOR_BLINK, true),
      },
      enableCliAgentIntegration: this.get(section, 'enableCliAgentIntegration', true),
      enableTerminalHeaderEnhancements: this.get(
        section,
        'enableTerminalHeaderEnhancements',
        true
      ),
      activeBorderMode: this.get(section, 'activeBorderMode', 'multipleOnly'),
    };
  }

  /**
   * Get complete terminal settings (consolidates multiple config methods)
   */
  public getCompleteTerminalSettings(): CompleteTerminalSettings {
    this.initialize();
    const sidebarConfig = this.getExtensionTerminalConfig();

    return {
      ...sidebarConfig,
      fontSize: this.getFontSize(),
      fontFamily: this.getFontFamily(),
      theme: this.get(CONFIG_SECTIONS.SIDEBAR_TERMINAL, CONFIG_KEYS.THEME, 'auto'),
      cursorBlink: this.get(CONFIG_SECTIONS.SIDEBAR_TERMINAL, CONFIG_KEYS.CURSOR_BLINK, true),
      confirmBeforeKill: this.get(
        CONFIG_SECTIONS.SIDEBAR_TERMINAL,
        CONFIG_KEYS.CONFIRM_BEFORE_KILL,
        false
      ),
      protectLastTerminal: this.get(
        CONFIG_SECTIONS.SIDEBAR_TERMINAL,
        CONFIG_KEYS.PROTECT_LAST_TERMINAL,
        true
      ),
      minTerminalCount: this.get(
        CONFIG_SECTIONS.SIDEBAR_TERMINAL,
        CONFIG_KEYS.MIN_TERMINAL_COUNT,
        1
      ),
      altClickMovesCursor: this.get(
        CONFIG_SECTIONS.TERMINAL_INTEGRATED,
        CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR,
        false
      ),
      multiCursorModifier: this.get(
        CONFIG_SECTIONS.EDITOR,
        CONFIG_KEYS.MULTI_CURSOR_MODIFIER,
        'ctrlCmd'
      ),
      activeBorderMode: this.get(
        CONFIG_SECTIONS.SIDEBAR_TERMINAL,
        'activeBorderMode',
        'multipleOnly'
      ),
    };
  }

  /**
   * Get WebView terminal settings (consolidates WebView config logic)
   */
  public getWebViewTerminalSettings(): WebViewTerminalSettings {
    const baseConfig = this.getCompleteTerminalSettings();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    return {
      ...baseConfig,
      scrollback: this.get(section, 'scrollback', 1000),
      bellSound: this.get(section, 'bellSound', false),
      enableCliAgentIntegration: this.get(section, 'enableCliAgentIntegration', true),
      enableTerminalHeaderEnhancements: this.get(section, 'enableTerminalHeaderEnhancements', true),
      sendKeybindingsToShell: this.get(section, 'sendKeybindingsToShell', false),
      commandsToSkipShell: this.get(section, 'commandsToSkipShell', []),
      allowChords: this.get(section, 'allowChords', true),
      allowMnemonics: this.get(section, 'allowMnemonics', true),
      cursor: {
        style: this.get(section, 'cursor.style', 'block'),
        blink: this.get(section, 'cursor.blink', true),
      },
      dynamicSplitDirection: this.get(section, 'dynamicSplitDirection', true),
      panelLocation: this.get(section, 'panelLocation', 'auto'),
    };
  }

  /**
   * Get WebView font settings (consolidates font config logic)
   */
  public getWebViewFontSettings(): WebViewFontSettings {
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;
    return {
      fontSize: this.getFontSize(),
      fontFamily: this.getFontFamily(),
      fontWeight: this.getFontWeight(),
      fontWeightBold: this.getFontWeightBold(),
      lineHeight: this.getLineHeight(),
      letterSpacing: this.getLetterSpacing(),
      // Cursor settings
      cursorStyle: this.get(section, 'cursorStyle', 'block') as 'block' | 'underline' | 'bar',
      cursorWidth: this.get(section, 'cursorWidth', 1),
      // Display settings
      drawBoldTextInBrightColors: this.get(section, 'drawBoldTextInBrightColors', true),
      minimumContrastRatio: this.get(section, 'minimumContrastRatio', 1),
    };
  }

  /**
   * Get complete extension config for WebView display
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
      minTerminalHeight: this.get(section, 'minTerminalHeight', 200),
      autoHideStatus: this.get(section, 'autoHideStatus', false),
      statusDisplayDuration: this.get(section, 'statusDisplayDuration', 3000),
      showWebViewHeader: this.get(section, 'showWebViewHeader', true),
      webViewTitle: this.get(section, 'webViewTitle', 'Terminal'),
      showSampleIcons: this.get(section, 'showSampleIcons', true),
      sampleIconOpacity: this.get(section, 'sampleIconOpacity', 0.3),
      headerFontSize: this.get(section, 'headerFontSize', 14),
      headerIconSize: this.get(section, 'headerIconSize', 16),
      sampleIconSize: this.get(section, 'sampleIconSize', 24),
    };
  }

  /**
   * Get platform-specific shell configuration
   */
  public getShellForPlatform(customShell?: string): string {
    this.initialize();
    if (customShell) {
      return customShell;
    }

    const section = CONFIG_SECTIONS.TERMINAL_INTEGRATED;

    switch (process.platform) {
      case TERMINAL_CONSTANTS.PLATFORMS.WINDOWS:
        return (
          this.get(section, CONFIG_KEYS.SHELL_WINDOWS, '') || process.env['COMSPEC'] || 'cmd.exe'
        );

      case TERMINAL_CONSTANTS.PLATFORMS.DARWIN:
        return this.get(section, CONFIG_KEYS.SHELL_OSX, '') || process.env['SHELL'] || '/bin/zsh';

      default:
        return (
          this.get(section, CONFIG_KEYS.SHELL_LINUX, '') || process.env['SHELL'] || '/bin/bash'
        );
    }
  }

  /**
   * Get Alt+Click settings (VS Code standard)
   */
  public getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string } {
    this.initialize();
    return {
      altClickMovesCursor: this.get(
        CONFIG_SECTIONS.TERMINAL_INTEGRATED,
        CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR,
        false
      ),
      multiCursorModifier: this.get(
        CONFIG_SECTIONS.EDITOR,
        CONFIG_KEYS.MULTI_CURSOR_MODIFIER,
        'ctrlCmd'
      ),
    };
  }

  /**
   * Get font family with VS Code hierarchy
   * Priority: secondaryTerminal.fontFamily > terminal.integrated.fontFamily > editor.fontFamily > system default
   */
  public getFontFamily(): string {
    this.initialize();

    try {
      // Clear cache for font settings to ensure fresh values
      this._configurationCache.delete('secondaryTerminal.fontFamily');
      this._configurationCache.delete('terminal.integrated.fontFamily');
      this._configurationCache.delete('editor.fontFamily');

      // Direct VS Code API call to ensure we get the latest value
      const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
      const directTerminalFont = terminalConfig.get<string>('fontFamily');

      // 1. Extension-specific font (highest priority)
      const extensionFont = this.get('secondaryTerminal', 'fontFamily', '');
      if (
        typeof extensionFont === 'string' &&
        extensionFont.trim() &&
        extensionFont.trim() !== 'monospace'
      ) {
        return extensionFont.trim();
      }

      // 2. Terminal-specific font - use direct value if available
      const terminalFont = directTerminalFont || this.get('terminal.integrated', 'fontFamily', '');
      if (typeof terminalFont === 'string' && terminalFont.trim()) {
        return terminalFont.trim();
      }

      // 3. Editor font fallback
      const editorFont = this.get('editor', 'fontFamily', '');
      if (typeof editorFont === 'string' && editorFont.trim()) {
        return editorFont.trim();
      }

      // 4. System default
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_FAMILY;
    } catch (error) {
      log('❌ [UnifiedConfig] Error getting fontFamily:', error);
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_FAMILY;
    }
  }

  /**
   * Get font size with VS Code hierarchy
   * Priority: secondaryTerminal.fontSize > terminal.integrated.fontSize > editor.fontSize > default(14)
   */
  public getFontSize(): number {
    this.initialize();

    try {
      // 1. Extension-specific font size (highest priority)
      const extensionSize = this.get<number>('secondaryTerminal', 'fontSize', 0);
      // Use extension setting if explicitly set (not default value of 12)
      // Note: package.json default is 12, so we only use if user changed it
      if (extensionSize > 0 && extensionSize !== 12) {
        return extensionSize;
      }

      // 2. Terminal-specific font size
      const terminalSize = this.get('terminal.integrated', 'fontSize', 0);
      if (typeof terminalSize === 'number' && terminalSize > 0) {
        return terminalSize;
      }

      // 3. Editor font size fallback
      const editorSize = this.get('editor', 'fontSize', 0);
      if (typeof editorSize === 'number' && editorSize > 0) {
        return editorSize;
      }

      // 4. Default
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_SIZE;
    } catch (error) {
      log('❌ [UnifiedConfig] Error getting fontSize:', error);
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_SIZE;
    }
  }

  /**
   * Get font weight with extension priority
   */
  public getFontWeight(): string {
    this.initialize();

    try {
      // 1. Extension-specific setting
      const extensionWeight = this.get('secondaryTerminal', 'fontWeight', '');
      if (typeof extensionWeight === 'string' && extensionWeight.trim()) {
        return extensionWeight.trim();
      }

      // 2. Terminal setting
      const terminalWeight = this.get('terminal.integrated', 'fontWeight', '');
      if (typeof terminalWeight === 'string' && terminalWeight.trim()) {
        return terminalWeight.trim();
      }

      // 3. Default
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_WEIGHT;
    } catch (error) {
      log('❌ [UnifiedConfig] Error getting fontWeight:', error);
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_WEIGHT;
    }
  }

  /**
   * Get bold font weight with extension priority
   */
  public getFontWeightBold(): string {
    this.initialize();

    try {
      // 1. Extension-specific setting
      const extensionBold = this.get('secondaryTerminal', 'fontWeightBold', '');
      if (typeof extensionBold === 'string' && extensionBold.trim()) {
        return extensionBold.trim();
      }

      // 2. Terminal setting
      const terminalBold = this.get('terminal.integrated', 'fontWeightBold', '');
      if (typeof terminalBold === 'string' && terminalBold.trim()) {
        return terminalBold.trim();
      }

      // 3. Default
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_WEIGHT_BOLD;
    } catch (error) {
      log('❌ [UnifiedConfig] Error getting fontWeightBold:', error);
      return CONFIG_CACHE_CONSTANTS.DEFAULT_FONT_WEIGHT_BOLD;
    }
  }

  /**
   * Get line height with extension priority
   */
  public getLineHeight(): number {
    this.initialize();

    try {
      // 1. Extension-specific setting
      const extensionHeight = this.get('secondaryTerminal', 'lineHeight', 0);
      if (typeof extensionHeight === 'number' && extensionHeight > 0) {
        return extensionHeight;
      }

      // 2. Terminal setting
      const terminalHeight = this.get('terminal.integrated', 'lineHeight', 0);
      if (typeof terminalHeight === 'number' && terminalHeight > 0) {
        return terminalHeight;
      }

      // 3. Default
      return CONFIG_CACHE_CONSTANTS.DEFAULT_LINE_HEIGHT;
    } catch (error) {
      log('❌ [UnifiedConfig] Error getting lineHeight:', error);
      return CONFIG_CACHE_CONSTANTS.DEFAULT_LINE_HEIGHT;
    }
  }

  /**
   * Get letter spacing with extension priority
   */
  public getLetterSpacing(): number {
    this.initialize();

    try {
      // 1. Extension-specific setting
      const extensionSpacing = this.get('secondaryTerminal', 'letterSpacing', undefined);
      if (typeof extensionSpacing === 'number') {
        return extensionSpacing;
      }

      // 2. Terminal setting
      const terminalSpacing = this.get('terminal.integrated', 'letterSpacing', undefined);
      if (typeof terminalSpacing === 'number') {
        return terminalSpacing;
      }

      // 3. Default
      return CONFIG_CACHE_CONSTANTS.DEFAULT_LETTER_SPACING;
    } catch (error) {
      log('❌ [UnifiedConfig] Error getting letterSpacing:', error);
      return CONFIG_CACHE_CONSTANTS.DEFAULT_LETTER_SPACING;
    }
  }

  /**
   * Get terminal profiles configuration
   */
  public getTerminalProfilesConfig(): TerminalProfilesConfig {
    this.initialize();
    const section = CONFIG_SECTIONS.SIDEBAR_TERMINAL;

    return {
      profiles: {
        windows: this.get(section, CONFIG_KEYS.PROFILES_WINDOWS, {}),
        linux: this.get(section, CONFIG_KEYS.PROFILES_LINUX, {}),
        osx: this.get(section, CONFIG_KEYS.PROFILES_OSX, {}),
      },
      defaultProfiles: {
        windows: this.get(section, CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS, null),
        linux: this.get(section, CONFIG_KEYS.DEFAULT_PROFILE_LINUX, null),
        osx: this.get(section, CONFIG_KEYS.DEFAULT_PROFILE_OSX, null),
      },
      autoDetection: {
        enabled: this.get(section, CONFIG_KEYS.ENABLE_PROFILE_AUTO_DETECTION, true),
        searchPaths: [],
        useCache: true,
        cacheExpiration: CONFIG_CACHE_CONSTANTS.PROFILE_CACHE_EXPIRATION_MS,
      },
      inheritVSCodeProfiles: this.get(section, CONFIG_KEYS.INHERIT_VSCODE_PROFILES, true),
    };
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(featureName: string): boolean {
    switch (featureName) {
      case 'cliAgentIntegration':
        return this.get(CONFIG_SECTIONS.SIDEBAR_TERMINAL, 'enableCliAgentIntegration', true);
      case 'terminalHeaderEnhancements':
        return this.get(CONFIG_SECTIONS.SIDEBAR_TERMINAL, 'enableTerminalHeaderEnhancements', true);
      case 'githubCopilotIntegration':
        return this.get(CONFIG_SECTIONS.SIDEBAR_TERMINAL, 'enableGitHubCopilotIntegration', true);
      case 'altClickMovesCursor':
        return (
          this.get(CONFIG_SECTIONS.TERMINAL_INTEGRATED, 'altClickMovesCursor', true) &&
          this.get(CONFIG_SECTIONS.EDITOR, 'multiCursorModifier', 'alt') === 'alt'
        );
      case 'dynamicSplitDirection':
        return this.get(CONFIG_SECTIONS.SIDEBAR_TERMINAL, 'dynamicSplitDirection', true);
      case 'activeBorderMode':
        return (this.get(CONFIG_SECTIONS.SIDEBAR_TERMINAL, 'activeBorderMode', 'multipleOnly') as string) !== 'none';
      default:
        log(`⚠️ [UnifiedConfig] Unknown feature: ${featureName}`);
        return false;
    }
  }

  /**
   * Clear configuration cache
   */
  public clearCache(): void {
    this._configurationCache.clear();
    log('🧹 [UnifiedConfig] Configuration cache cleared');
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): Record<string, unknown> {
    return {
      initialized: this._initialized,
      cacheSize: this._configurationCache.size,
      registeredSchemas: 'ConfigurationRegistry', // Can't access private property
      disposables: this._disposables.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Register configuration schemas for validation
   */
  private _registerConfigurationSchemas(): void {
    // Font settings
    this._registry.register('terminal.integrated.fontSize', {
      type: 'number',
      default: 14,
      minimum: 8,
      maximum: 72,
    });

    this._registry.register('terminal.integrated.fontFamily', {
      type: 'string',
      default: 'monospace',
    });

    // Terminal limits
    this._registry.register(`${CONFIG_SECTIONS.SIDEBAR_TERMINAL}.${CONFIG_KEYS.MAX_TERMINALS}`, {
      type: 'number',
      default: 5,
      minimum: 1,
      maximum: 10,
    });

    // Theme
    this._registry.register(`${CONFIG_SECTIONS.SIDEBAR_TERMINAL}.${CONFIG_KEYS.THEME}`, {
      type: 'string',
      default: 'auto',
      enum: ['light', 'dark', 'auto'],
    });

    // Add more schemas as needed...
  }

  /**
   * Initialize configuration change watcher
   */
  private _initializeConfigurationWatcher(): void {
    try {
      if (vscode?.workspace?.onDidChangeConfiguration) {
        const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
          const affectedSections = [
            CONFIG_SECTIONS.SIDEBAR_TERMINAL,
            CONFIG_SECTIONS.TERMINAL_INTEGRATED,
            CONFIG_SECTIONS.EDITOR,
          ];

          const changedKeys: string[] = [];
          let hasChanges = false;

          for (const section of affectedSections) {
            if (event.affectsConfiguration(section)) {
              hasChanges = true;
              // Clear cache for this section
              for (const [key] of this._configurationCache) {
                if (key.startsWith(section)) {
                  this._configurationCache.delete(key);
                  changedKeys.push(key);
                }
              }
            }
          }

          if (hasChanges) {
            this._onDidChangeConfiguration.fire({
              affectsConfiguration: (section: string, key?: string) => {
                if (key) {
                  return changedKeys.includes(`${section}.${key}`);
                }
                return changedKeys.some((k) => k.startsWith(section));
              },
              source: ConfigurationTarget.USER,
              changedKeys,
              timestamp: Date.now(),
            });

            log(`⚙️ [UnifiedConfig] Configuration changed: ${changedKeys.length} keys affected`);
          }
        });

        this._disposables.push(disposable);
      }
    } catch (error) {
      log('⚠️ [UnifiedConfig] Could not initialize configuration watcher:', error);
    }
  }

  /**
   * Map VS Code ConfigurationTarget to our ConfigurationTarget
   */
  private _mapVSCodeTargetToConfigTarget(target: vscode.ConfigurationTarget): ConfigurationTarget {
    switch (target) {
      case vscode.ConfigurationTarget.Global:
        return ConfigurationTarget.USER;
      case vscode.ConfigurationTarget.Workspace:
        return ConfigurationTarget.WORKSPACE;
      case vscode.ConfigurationTarget.WorkspaceFolder:
        return ConfigurationTarget.WORKSPACE_FOLDER;
      default:
        return ConfigurationTarget.USER;
    }
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    log('🧹 [UnifiedConfig] Disposing unified configuration service');

    try {
      // Dispose event emitter
      this._onDidChangeConfiguration.dispose();

      // Dispose all subscriptions
      for (const disposable of this._disposables) {
        disposable.dispose();
      }
      this._disposables.length = 0;

      // Clear cache
      this._configurationCache.clear();

      // Clear singleton instance
      UnifiedConfigurationService._instance = undefined;

      log('✅ [UnifiedConfig] Service disposed successfully');
    } catch (error) {
      log('❌ [UnifiedConfig] Error during disposal:', error);
    }
  }
}

/**
 * Get the singleton instance of UnifiedConfigurationService
 * This replaces all previous config manager imports
 */
export function getUnifiedConfigurationService(): UnifiedConfigurationService {
  return UnifiedConfigurationService.getInstance();
}

/**
 * Legacy compatibility helper (to be removed after migration)
 * @deprecated Use getUnifiedConfigurationService() instead
 */
export function getConfigManager(): UnifiedConfigurationService {
  return UnifiedConfigurationService.getInstance();
}
