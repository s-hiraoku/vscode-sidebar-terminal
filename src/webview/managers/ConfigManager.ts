/**
 * Config Manager - Handles settings management, persistence, and configuration updates
 *
 * @deprecated This WebView ConfigManager is being replaced by UnifiedConfigurationService.
 * Please migrate to: import { getUnifiedConfigurationService } from '../../config/UnifiedConfigurationService';
 *
 * Migration notes:
 * - WebView-side configuration should now use UnifiedConfigurationService
 * - State persistence methods (loadSettings/saveSettings) are available in UnifiedConfigurationService
 * - All font settings methods are preserved with the same API
 */

import { webview as log } from '../../utils/logger';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { IConfigManager, TerminalInstance } from '../interfaces/ManagerInterfaces';

// VS Code API interface for settings persistence
declare const vscode: {
  getState(): unknown;
  setState(state: unknown): void;
};

export class ConfigManager implements IConfigManager {
  // Current settings cache
  private currentSettings: PartialTerminalSettings = {
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: 'dark',
    cursorBlink: true,
    scrollback: 1000,
    bellSound: false,
    altClickMovesCursor: false,
    multiCursorModifier: 'alt',
    highlightActiveBorder: true,
  };

  // Current font settings cache
  private currentFontSettings: WebViewFontSettings = {
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontWeight: 'normal',
    fontWeightBold: 'bold',
    lineHeight: 1.0,
    letterSpacing: 0,
  };

  // Settings validation schema
  private readonly DEFAULTS: Required<PartialTerminalSettings> = {
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: 'dark',
    cursorBlink: true,
    enableCliAgentIntegration: true,

    // Terminal profiles (will be populated from VS Code settings)
    profilesWindows: {},
    profilesLinux: {},
    profilesOsx: {},
    defaultProfileWindows: null,
    defaultProfileLinux: null,
    defaultProfileOsx: null,
    inheritVSCodeProfiles: true,
    enableProfileAutoDetection: true,
    scrollback: 1000,
    highlightActiveBorder: true,
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

  // Font settings validation
  private readonly FONT_DEFAULTS: Required<WebViewFontSettings> = {
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontWeight: 'normal',
    fontWeightBold: 'bold',
    lineHeight: 1.0,
    letterSpacing: 0,
  };

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
   */
  public applyFontSettings(
    fontSettings: WebViewFontSettings,
    terminals: Map<string, TerminalInstance>
  ): void {
    const validatedFontSettings = this.validateAndNormalizeFontSettings(fontSettings);
    this.currentFontSettings = validatedFontSettings;

    terminals.forEach((terminalData, terminalId) => {
      try {
        const terminal = terminalData.terminal;

        // Use options property to properly update xterm.js settings (v5.0+ API)
        terminal.options.fontSize = validatedFontSettings.fontSize;
        terminal.options.fontFamily = validatedFontSettings.fontFamily;

        log(
          `⚙️ [CONFIG] Font settings applied to terminal ${terminalId}: ${validatedFontSettings.fontFamily}, ${validatedFontSettings.fontSize}px`
        );
      } catch (error) {
        log(`❌ [CONFIG] Error applying font settings to terminal ${terminalId}:`, error);
      }
    });

    // Update general settings (create new object due to readonly properties)
    this.currentSettings = {
      ...this.currentSettings,
      fontSize: validatedFontSettings.fontSize,
      fontFamily: validatedFontSettings.fontFamily,
    };

    log('⚙️ [CONFIG] Font settings applied to all terminals');
  }

  /**
   * Get current settings
   */
  public getCurrentSettings(): PartialTerminalSettings {
    return { ...this.currentSettings };
  }

  /**
   * Get current font settings
   */
  public getCurrentFontSettings(): WebViewFontSettings {
    return { ...this.currentFontSettings };
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
    const normalized: PartialTerminalSettings = {};

    // Font size validation
    if (
      typeof settings.fontSize === 'number' &&
      settings.fontSize >= 8 &&
      settings.fontSize <= 72
    ) {
      normalized.fontSize = Math.round(settings.fontSize);
    } else {
      normalized.fontSize = this.DEFAULTS.fontSize;
    }

    // Font family validation
    if (typeof settings.fontFamily === 'string' && settings.fontFamily.trim().length > 0) {
      normalized.fontFamily = settings.fontFamily.trim();
    } else {
      normalized.fontFamily = this.DEFAULTS.fontFamily;
    }

    // Theme validation
    if (typeof settings.theme === 'string' && ['light', 'dark', 'auto'].includes(settings.theme)) {
      normalized.theme = settings.theme;
    } else {
      normalized.theme = this.DEFAULTS.theme;
    }

    // Boolean settings validation
    normalized.cursorBlink =
      typeof settings.cursorBlink === 'boolean' ? settings.cursorBlink : this.DEFAULTS.cursorBlink;
    normalized.bellSound =
      typeof settings.bellSound === 'boolean' ? settings.bellSound : this.DEFAULTS.bellSound;
    normalized.altClickMovesCursor =
      typeof settings.altClickMovesCursor === 'boolean'
        ? settings.altClickMovesCursor
        : this.DEFAULTS.altClickMovesCursor;

    // Scrollback validation
    if (
      typeof settings.scrollback === 'number' &&
      settings.scrollback >= 0 &&
      settings.scrollback <= 100000
    ) {
      normalized.scrollback = Math.round(settings.scrollback);
    } else {
      normalized.scrollback = this.DEFAULTS.scrollback;
    }

    // Multi-cursor modifier validation
    if (
      typeof settings.multiCursorModifier === 'string' &&
      ['alt', 'ctrl', 'cmd'].includes(settings.multiCursorModifier)
    ) {
      normalized.multiCursorModifier = settings.multiCursorModifier;
    } else {
      normalized.multiCursorModifier = this.DEFAULTS.multiCursorModifier;
    }

    // CLI Agent integration validation
    normalized.enableCliAgentIntegration =
      typeof settings.enableCliAgentIntegration === 'boolean'
        ? settings.enableCliAgentIntegration
        : this.DEFAULTS.enableCliAgentIntegration;
    normalized.highlightActiveBorder =
      typeof settings.highlightActiveBorder === 'boolean'
        ? settings.highlightActiveBorder
        : this.DEFAULTS.highlightActiveBorder;

    // Shell validation
    if (typeof settings.shell === 'string') {
      normalized.shell = settings.shell;
    } else {
      normalized.shell = this.DEFAULTS.shell;
    }

    // Shell args validation
    if (Array.isArray(settings.shellArgs)) {
      normalized.shellArgs = settings.shellArgs.filter(
        (arg): arg is string => typeof arg === 'string'
      );
    } else {
      normalized.shellArgs = this.DEFAULTS.shellArgs;
    }

    // CWD validation
    if (typeof settings.cwd === 'string') {
      normalized.cwd = settings.cwd;
    } else {
      normalized.cwd = this.DEFAULTS.cwd;
    }

    // Default directory validation
    if (typeof settings.defaultDirectory === 'string') {
      normalized.defaultDirectory = settings.defaultDirectory;
    } else {
      normalized.defaultDirectory = this.DEFAULTS.defaultDirectory;
    }

    // Max terminals validation
    if (
      typeof settings.maxTerminals === 'number' &&
      settings.maxTerminals >= 1 &&
      settings.maxTerminals <= 10
    ) {
      normalized.maxTerminals = Math.round(settings.maxTerminals);
    } else {
      normalized.maxTerminals = this.DEFAULTS.maxTerminals;
    }

    // Cursor validation
    if (settings.cursor && typeof settings.cursor === 'object') {
      normalized.cursor = {
        style: ['block', 'underline', 'bar'].includes(settings.cursor.style || '')
          ? (settings.cursor.style as 'block' | 'underline' | 'bar')
          : this.DEFAULTS.cursor.style,
        blink:
          typeof settings.cursor.blink === 'boolean'
            ? settings.cursor.blink
            : this.DEFAULTS.cursor.blink,
      };
    } else {
      normalized.cursor = this.DEFAULTS.cursor;
    }

    return normalized;
  }

  /**
   * Validate and normalize font settings
   */
  private validateAndNormalizeFontSettings(fontSettings: WebViewFontSettings): WebViewFontSettings {
    const normalized: WebViewFontSettings = {
      fontSize: this.FONT_DEFAULTS.fontSize,
      fontFamily: this.FONT_DEFAULTS.fontFamily,
    };

    // Font size validation
    if (
      typeof fontSettings.fontSize === 'number' &&
      fontSettings.fontSize >= 8 &&
      fontSettings.fontSize <= 72
    ) {
      normalized.fontSize = Math.round(fontSettings.fontSize);
    }

    // Font family validation
    if (typeof fontSettings.fontFamily === 'string' && fontSettings.fontFamily.trim().length > 0) {
      normalized.fontFamily = fontSettings.fontFamily.trim();
    }

    return normalized;
  }

  /**
   * Update font settings from general settings
   */
  private updateFontSettingsFromGeneral(): void {
    this.currentFontSettings = {
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
        fontSettings: this.currentFontSettings,
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
