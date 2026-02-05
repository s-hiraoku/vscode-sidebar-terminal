/**
 * Config Manager - Handles settings management, persistence, and configuration updates
 *
 * Note: Font settings are managed by FontSettingsService (single source of truth).
 * ConfigManager provides getCurrentFontSettings() for compatibility but delegates
 * to FontSettingsService when available.
 */

import { webview as log } from '../../utils/logger';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { IConfigManager, TerminalInstance } from '../interfaces/ManagerInterfaces';
import { FontSettingsService } from '../services/FontSettingsService';

// VS Code API interface for settings persistence
declare const vscode: {
  getState(): unknown;
  setState(state: unknown): void;
};

/**
 * Validation limits for settings
 */
const ValidationLimits = {
  FONT_SIZE: { min: 8, max: 72 },
  SCROLLBACK: { min: 0, max: 100000 },
  MAX_TERMINALS: { min: 1, max: 10 },
} as const;

/**
 * Allowed values for enumerated settings
 */
const AllowedValues = {
  THEME: ['light', 'dark', 'auto'] as const,
  MULTI_CURSOR_MODIFIER: ['alt', 'ctrl', 'cmd'] as const,
  CURSOR_STYLE: ['block', 'underline', 'bar'] as const,
  ACTIVE_BORDER_MODE: ['none', 'always', 'multipleOnly'] as const,
  PANEL_LOCATION: ['auto', 'sidebar', 'panel'] as const,
} as const;

/**
 * Validation helper functions
 */
const Validators = {
  /**
   * Validates a number is within a range, returns rounded value or default
   */
  numberInRange(
    value: unknown,
    limits: { min: number; max: number },
    defaultValue: number
  ): number {
    if (typeof value === 'number' && value >= limits.min && value <= limits.max) {
      return Math.round(value);
    }
    return defaultValue;
  },

  /**
   * Validates a non-empty string, returns trimmed value or default
   */
  nonEmptyString(value: unknown, defaultValue: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return defaultValue;
  },

  /**
   * Validates a string is in an allowed list, returns value or default
   */
  stringInList<T extends string>(
    value: unknown,
    allowedValues: readonly T[],
    defaultValue: T
  ): T {
    if (typeof value === 'string' && allowedValues.includes(value as T)) {
      return value as T;
    }
    return defaultValue;
  },

  /**
   * Validates a boolean, returns value or default
   */
  boolean(value: unknown, defaultValue: boolean): boolean {
    return typeof value === 'boolean' ? value : defaultValue;
  },

  /**
   * Validates an optional string (can be empty)
   */
  optionalString(value: unknown, defaultValue: string): string {
    return typeof value === 'string' ? value : defaultValue;
  },

  /**
   * Validates a string array
   */
  stringArray(value: unknown, defaultValue: string[]): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
    return defaultValue;
  },
} as const;

export class ConfigManager implements IConfigManager {
  // Font settings service reference (single source of truth)
  private fontSettingsService: FontSettingsService | null = null;

  // Settings validation schema (single source of truth for defaults)
  // Default theme to 'auto' to detect VS Code theme instead of hardcoding dark
  private readonly DEFAULTS: Required<PartialTerminalSettings> = {
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: 'auto',
    cursorBlink: true,
    enableCliAgentIntegration: true,
    enableTerminalHeaderEnhancements: true,
    // Terminal profiles (will be populated from VS Code settings)
    profilesWindows: {},
    profilesLinux: {},
    profilesOsx: {},
    defaultProfileWindows: null,
    defaultProfileLinux: null,
    defaultProfileOsx: null,
    inheritVSCodeProfiles: true,
    enableProfileAutoDetection: true,
    scrollback: 2000, // Match package.json default
    activeBorderMode: 'multipleOnly',
    bellSound: false,
    altClickMovesCursor: false,
    multiCursorModifier: 'alt',
    sendKeybindingsToShell: false,
    commandsToSkipShell: [],
    allowChords: true,
    allowMnemonics: true,
    shell: '',
    shellArgs: [],
    cwd: '',
    defaultDirectory: '',
    maxTerminals: 5,
    cursor: {
      style: 'block',
      blink: true,
    },
    // 🆕 Issue #148: Dynamic split direction settings
    dynamicSplitDirection: true,
    panelLocation: 'auto',
  };

  // Font settings validation defaults
  private readonly FONT_DEFAULTS: Required<WebViewFontSettings> = {
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontWeight: 'normal',
    fontWeightBold: 'bold',
    lineHeight: 1.0,
    letterSpacing: 0,
    cursorStyle: 'block',
    cursorWidth: 1,
    drawBoldTextInBrightColors: true,
    minimumContrastRatio: 1,
  };

  // Current settings cache (initialized from DEFAULTS)
  private currentSettings: PartialTerminalSettings;

  // Fallback font settings (initialized from FONT_DEFAULTS)
  private fallbackFontSettings: WebViewFontSettings;

  constructor() {
    // Initialize from defaults to avoid duplication
    this.currentSettings = { ...this.DEFAULTS };
    this.fallbackFontSettings = { ...this.FONT_DEFAULTS };
  }

  /**
   * Set FontSettingsService reference for delegation
   * This enables single source of truth for font settings
   */
  public setFontSettingsService(service: FontSettingsService): void {
    this.fontSettingsService = service;
    log('⚙️ [CONFIG] FontSettingsService connected');
  }

  /**
   * Load settings from VS Code state with fallbacks
   */
  public loadSettings(): PartialTerminalSettings {
    try {
      const state = vscode.getState() as { terminalSettings?: PartialTerminalSettings } | undefined;
      const savedSettings = state?.terminalSettings;

      if (savedSettings) {
        this.currentSettings = this.validateAndNormalizeSettings(savedSettings);
        log('⚙️ [CONFIG] Settings loaded from VS Code state:', this.currentSettings);
      } else {
        this.currentSettings = { ...this.DEFAULTS };
        log('⚙️ [CONFIG] Using default settings');
      }

      this.updateFontSettingsFromGeneral();
      return { ...this.currentSettings };
    } catch (error) {
      log('❌ [CONFIG] Error loading settings, using defaults:', error);
      this.currentSettings = { ...this.DEFAULTS };
      this.updateFontSettingsFromGeneral();
      return { ...this.currentSettings };
    }
  }

  /**
   * Save settings to VS Code state
   */
  public saveSettings(settings: PartialTerminalSettings): void {
    try {
      const validatedSettings = this.validateAndNormalizeSettings(settings);
      this.currentSettings = validatedSettings;

      const state =
        (vscode.getState() as { terminalSettings?: PartialTerminalSettings } | undefined) || {};
      vscode.setState({
        ...state,
        terminalSettings: this.currentSettings,
      });

      this.updateFontSettingsFromGeneral();
      log('⚙️ [CONFIG] Settings saved:', this.currentSettings);
    } catch (error) {
      log('❌ [CONFIG] Error saving settings:', error);
    }
  }

  /**
   * Apply settings to all terminals
   */
  public applySettings(
    settings: PartialTerminalSettings,
    terminals: Map<string, TerminalInstance>
  ): void {
    const validatedSettings = this.validateAndNormalizeSettings(settings);
    this.currentSettings = validatedSettings;

    // Apply to each terminal
    terminals.forEach((terminalData, terminalId) => {
      try {
        const terminal = terminalData.terminal;

        // Apply theme
        if (validatedSettings.theme) {
          // Theme application would be handled by UIManager
          log(`⚙️ [CONFIG] Theme setting for terminal ${terminalId}: ${validatedSettings.theme}`);
        }

        // Apply cursor settings
        if (validatedSettings.cursorBlink !== undefined) {
          terminal.options.cursorBlink = validatedSettings.cursorBlink;
        }

        // Apply scrollback
        if (validatedSettings.scrollback !== undefined) {
          terminal.options.scrollback = validatedSettings.scrollback;
        }

        // Bell sound is not supported in xterm.js options
        // Terminal bell handling would be implemented differently

        // Apply Alt+Click setting (VS Code standard)
        if (validatedSettings.altClickMovesCursor !== undefined) {
          terminal.options.altClickMovesCursor =
            validatedSettings.altClickMovesCursor &&
            validatedSettings.multiCursorModifier === 'alt';
        }

        log(`⚙️ [CONFIG] Settings applied to terminal ${terminalId}`);
      } catch (error) {
        log(`❌ [CONFIG] Error applying settings to terminal ${terminalId}:`, error);
      }
    });

    this.updateFontSettingsFromGeneral();
    log('⚙️ [CONFIG] Settings applied to all terminals');
  }

  /**
   * Apply font settings to all terminals
   *
   * @deprecated Use FontSettingsService.updateSettings() instead.
   * This method is kept for backward compatibility but actual font application
   * should go through FontSettingsService.
   */
  public applyFontSettings(
    fontSettings: WebViewFontSettings,
    _terminals: Map<string, TerminalInstance>
  ): void {
    const validatedFontSettings = this.validateAndNormalizeFontSettings(fontSettings);

    // Update fallback cache for when FontSettingsService is not available
    this.fallbackFontSettings = validatedFontSettings;

    // Update general settings (create new object due to readonly properties)
    this.currentSettings = {
      ...this.currentSettings,
      fontSize: validatedFontSettings.fontSize,
      fontFamily: validatedFontSettings.fontFamily,
    };

    // Note: Actual terminal font application is handled by FontSettingsService
    // This method only updates ConfigManager's internal caches
    log('⚙️ [CONFIG] Font settings cache updated (actual application via FontSettingsService)');
  }

  /**
   * Get current settings
   */
  public getCurrentSettings(): PartialTerminalSettings {
    return { ...this.currentSettings };
  }

  /**
   * Get current font settings
   *
   * Delegates to FontSettingsService when available (single source of truth).
   * Falls back to local cache if service is not connected.
   */
  public getCurrentFontSettings(): WebViewFontSettings {
    // Prefer FontSettingsService (single source of truth)
    if (this.fontSettingsService) {
      const settings = this.fontSettingsService.getCurrentSettings();
      log(`🔤 [CONFIG] getCurrentFontSettings from FontSettingsService: ${settings.fontFamily}, ${settings.fontSize}px`);
      return settings;
    }

    // Fallback for backward compatibility
    log(`🔤 [CONFIG] getCurrentFontSettings FALLBACK: ${this.fallbackFontSettings.fontFamily}, ${this.fallbackFontSettings.fontSize}px`);
    return { ...this.fallbackFontSettings };
  }

  /**
   * Update Alt+Click setting for all terminals
   */
  public updateAltClickSetting(
    terminals: Map<string, TerminalInstance>,
    settings: PartialTerminalSettings
  ): void {
    const altClickEnabled = settings.altClickMovesCursor ?? false;
    const multiCursorModifier = settings.multiCursorModifier ?? 'alt';
    const isVSCodeStandard = altClickEnabled && multiCursorModifier === 'alt';

    terminals.forEach((terminalData, terminalId) => {
      try {
        terminalData.terminal.options.altClickMovesCursor = isVSCodeStandard;
        log(
          `⚙️ [CONFIG] Alt+Click setting updated for terminal ${terminalId}: ${isVSCodeStandard}`
        );
      } catch (error) {
        log(`❌ [CONFIG] Error updating Alt+Click for terminal ${terminalId}:`, error);
      }
    });

    // Update current settings (create new object since properties are readonly)
    this.currentSettings = {
      ...this.currentSettings,
      altClickMovesCursor: altClickEnabled,
      multiCursorModifier: multiCursorModifier,
    };

    log(
      `⚙️ [CONFIG] Alt+Click setting updated globally: ${isVSCodeStandard} (altClick: ${altClickEnabled}, modifier: ${multiCursorModifier})`
    );
  }

  /**
   * Validate and normalize settings with fallbacks
   */
  private validateAndNormalizeSettings(settings: PartialTerminalSettings): PartialTerminalSettings {
    return {
      // Numeric settings with range validation
      fontSize: Validators.numberInRange(
        settings.fontSize,
        ValidationLimits.FONT_SIZE,
        this.DEFAULTS.fontSize
      ),
      scrollback: Validators.numberInRange(
        settings.scrollback,
        ValidationLimits.SCROLLBACK,
        this.DEFAULTS.scrollback
      ),
      maxTerminals: Validators.numberInRange(
        settings.maxTerminals,
        ValidationLimits.MAX_TERMINALS,
        this.DEFAULTS.maxTerminals
      ),

      // String settings requiring non-empty values
      fontFamily: Validators.nonEmptyString(settings.fontFamily, this.DEFAULTS.fontFamily),

      // Enumerated string settings
      theme: Validators.stringInList(settings.theme, AllowedValues.THEME, this.DEFAULTS.theme),
      multiCursorModifier: Validators.stringInList(
        settings.multiCursorModifier,
        AllowedValues.MULTI_CURSOR_MODIFIER,
        this.DEFAULTS.multiCursorModifier
      ),

      // Boolean settings
      cursorBlink: Validators.boolean(settings.cursorBlink, this.DEFAULTS.cursorBlink),
      bellSound: Validators.boolean(settings.bellSound, this.DEFAULTS.bellSound),
      altClickMovesCursor: Validators.boolean(
        settings.altClickMovesCursor,
        this.DEFAULTS.altClickMovesCursor
      ),
      enableCliAgentIntegration: Validators.boolean(
        settings.enableCliAgentIntegration,
        this.DEFAULTS.enableCliAgentIntegration
      ),
      enableTerminalHeaderEnhancements: Validators.boolean(
        settings.enableTerminalHeaderEnhancements,
        this.DEFAULTS.enableTerminalHeaderEnhancements
      ),

      // Enumerated string settings (with restricted values)
      activeBorderMode: Validators.stringInList(
        settings.activeBorderMode,
        AllowedValues.ACTIVE_BORDER_MODE,
        this.DEFAULTS.activeBorderMode
      ),
      panelLocation: Validators.stringInList(
        settings.panelLocation,
        AllowedValues.PANEL_LOCATION,
        this.DEFAULTS.panelLocation
      ),

      // Optional string settings (can be empty)
      shell: Validators.optionalString(settings.shell, this.DEFAULTS.shell),
      cwd: Validators.optionalString(settings.cwd, this.DEFAULTS.cwd),
      defaultDirectory: Validators.optionalString(
        settings.defaultDirectory,
        this.DEFAULTS.defaultDirectory
      ),

      // Array settings
      shellArgs: Validators.stringArray(settings.shellArgs, this.DEFAULTS.shellArgs),
      commandsToSkipShell: Validators.stringArray(
        settings.commandsToSkipShell,
        this.DEFAULTS.commandsToSkipShell
      ),

      // Additional boolean settings
      dynamicSplitDirection: Validators.boolean(
        settings.dynamicSplitDirection,
        this.DEFAULTS.dynamicSplitDirection
      ),
      sendKeybindingsToShell: Validators.boolean(
        settings.sendKeybindingsToShell,
        this.DEFAULTS.sendKeybindingsToShell
      ),
      allowChords: Validators.boolean(settings.allowChords, this.DEFAULTS.allowChords),
      allowMnemonics: Validators.boolean(settings.allowMnemonics, this.DEFAULTS.allowMnemonics),

      // Cursor object validation
      cursor: this.validateCursorSettings(settings.cursor),
    };
  }

  /**
   * Validate cursor settings object
   */
  private validateCursorSettings(
    cursor: PartialTerminalSettings['cursor']
  ): { style: 'block' | 'underline' | 'bar'; blink: boolean } {
    if (cursor && typeof cursor === 'object') {
      return {
        style: Validators.stringInList(
          cursor.style,
          AllowedValues.CURSOR_STYLE,
          this.DEFAULTS.cursor.style
        ),
        blink: Validators.boolean(cursor.blink, this.DEFAULTS.cursor.blink),
      };
    }
    return this.DEFAULTS.cursor;
  }

  /**
   * Validate and normalize font settings
   */
  private validateAndNormalizeFontSettings(fontSettings: WebViewFontSettings): WebViewFontSettings {
    return {
      fontSize: Validators.numberInRange(
        fontSettings.fontSize,
        ValidationLimits.FONT_SIZE,
        this.FONT_DEFAULTS.fontSize
      ),
      fontFamily: Validators.nonEmptyString(fontSettings.fontFamily, this.FONT_DEFAULTS.fontFamily),
    };
  }

  /**
   * Update font settings from general settings
   * Updates the fallback cache for backward compatibility
   */
  private updateFontSettingsFromGeneral(): void {
    this.fallbackFontSettings = {
      fontSize: this.currentSettings.fontSize || this.FONT_DEFAULTS.fontSize,
      fontFamily: this.currentSettings.fontFamily || this.FONT_DEFAULTS.fontFamily,
    };
  }

  /**
   * Reset settings to defaults
   */
  public resetToDefaults(): PartialTerminalSettings {
    this.currentSettings = { ...this.DEFAULTS };
    this.updateFontSettingsFromGeneral();
    this.saveSettings(this.currentSettings);
    log('⚙️ [CONFIG] Settings reset to defaults');
    return { ...this.currentSettings };
  }

  /**
   * Export current settings for backup
   */
  public exportSettings(): string {
    return JSON.stringify(
      {
        settings: this.currentSettings,
        fontSettings: this.getCurrentFontSettings(),
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Import settings from backup
   */
  public importSettings(jsonData: string): PartialTerminalSettings {
    try {
      const data = JSON.parse(jsonData) as { settings?: PartialTerminalSettings };
      if (data.settings) {
        const settings = this.validateAndNormalizeSettings(data.settings);
        this.saveSettings(settings);
        log('⚙️ [CONFIG] Settings imported from backup');
        return settings;
      } else {
        throw new Error('Invalid settings format');
      }
    } catch (error) {
      log('❌ [CONFIG] Error importing settings:', error);
      throw error;
    }
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    log('🧹 [CONFIG] Disposing config manager');

    // Save current state before disposal
    this.saveSettings(this.currentSettings);

    log('✅ [CONFIG] Config manager disposed');
  }
}
