/**
 * Centralized Settings Manager - Consolidates all configuration handling
 * Eliminates duplicated validation and normalization logic
 */

import { webview as log } from '../../utils/logger';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';

export interface SettingsChangeListener {
  onSettingsChanged(settings: PartialTerminalSettings): void;
  onFontSettingsChanged(fontSettings: WebViewFontSettings): void;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalized?: PartialTerminalSettings | WebViewFontSettings;
}

/**
 * Centralized settings management with validation, normalization, and change notifications
 */
export class CentralizedSettingsManager {
  private currentSettings: PartialTerminalSettings = {
    theme: 'auto',
    cursorBlink: true,
    altClickMovesCursor: true,
    multiCursorModifier: 'alt',
  };

  private currentFontSettings: WebViewFontSettings = {
    fontSize: 14,
    fontFamily: 'monospace',
  };

  private listeners = new Set<SettingsChangeListener>();
  private settingsHistory: Array<{ settings: PartialTerminalSettings; timestamp: number }> = [];
  private readonly maxHistorySize = 10;

  /**
   * Add settings change listener
   */
  public addListener(listener: SettingsChangeListener): void {
    this.listeners.add(listener);
    log(`⚙️ [SETTINGS-MANAGER] Added listener, total: ${this.listeners.size}`);
  }

  /**
   * Remove settings change listener
   */
  public removeListener(listener: SettingsChangeListener): void {
    this.listeners.delete(listener);
    log(`⚙️ [SETTINGS-MANAGER] Removed listener, total: ${this.listeners.size}`);
  }

  /**
   * Update settings with validation and normalization
   */
  public updateSettings(newSettings: Partial<PartialTerminalSettings>): ValidationResult {
    log('⚙️ [SETTINGS-MANAGER] Updating settings:', newSettings);

    const validationResult = this.validateSettings(newSettings);
    if (!validationResult.isValid) {
      log('❌ [SETTINGS-MANAGER] Settings validation failed:', validationResult.errors);
      return validationResult;
    }

    // Store previous settings in history
    this.addToHistory(this.currentSettings);

    // Apply normalized settings
    const normalizedSettings = validationResult.normalized as PartialTerminalSettings;
    this.currentSettings = { ...this.currentSettings, ...normalizedSettings };

    // Notify listeners
    this.notifySettingsChanged();

    log('✅ [SETTINGS-MANAGER] Settings updated successfully');
    return { isValid: true, errors: [], normalized: this.currentSettings };
  }

  /**
   * Update font settings with validation
   */
  public updateFontSettings(newFontSettings: Partial<WebViewFontSettings>): ValidationResult {
    log('⚙️ [SETTINGS-MANAGER] Updating font settings:', newFontSettings);

    const validationResult = this.validateFontSettings(newFontSettings);
    if (!validationResult.isValid) {
      log('❌ [SETTINGS-MANAGER] Font settings validation failed:', validationResult.errors);
      return validationResult;
    }

    // Apply normalized font settings
    const normalizedFontSettings = validationResult.normalized as WebViewFontSettings;
    this.currentFontSettings = { ...this.currentFontSettings, ...normalizedFontSettings };

    // Notify listeners
    this.notifyFontSettingsChanged();

    log('✅ [SETTINGS-MANAGER] Font settings updated successfully');
    return { isValid: true, errors: [], normalized: this.currentFontSettings };
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
   * Validate settings with comprehensive rules
   */
  private validateSettings(settings: Partial<PartialTerminalSettings>): ValidationResult {
    const errors: string[] = [];
    const normalized: Partial<PartialTerminalSettings> = {};

    // Theme validation
    if (settings.theme !== undefined) {
      const validThemes = ['auto', 'dark', 'light'];
      if (validThemes.includes(settings.theme)) {
        normalized.theme = settings.theme;
      } else {
        errors.push(`Invalid theme: ${settings.theme}. Must be one of: ${validThemes.join(', ')}`);
      }
    }

    // Cursor blink validation
    if (settings.cursorBlink !== undefined) {
      if (typeof settings.cursorBlink === 'boolean') {
        normalized.cursorBlink = settings.cursorBlink;
      } else {
        errors.push('cursorBlink must be a boolean value');
      }
    }

    // Alt click validation
    if (settings.altClickMovesCursor !== undefined) {
      if (typeof settings.altClickMovesCursor === 'boolean') {
        normalized.altClickMovesCursor = settings.altClickMovesCursor;
      } else {
        errors.push('altClickMovesCursor must be a boolean value');
      }
    }

    // Multi cursor modifier validation
    if (settings.multiCursorModifier !== undefined) {
      const validModifiers = ['alt', 'ctrl', 'meta'];
      if (validModifiers.includes(settings.multiCursorModifier)) {
        normalized.multiCursorModifier = settings.multiCursorModifier;
      } else {
        errors.push(
          `Invalid multiCursorModifier: ${settings.multiCursorModifier}. Must be one of: ${validModifiers.join(', ')}`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized: errors.length === 0 ? normalized : undefined,
    };
  }

  /**
   * Validate font settings
   */
  private validateFontSettings(fontSettings: Partial<WebViewFontSettings>): ValidationResult {
    const errors: string[] = [];
    const normalized: Partial<WebViewFontSettings> = {};

    // Font size validation
    if (fontSettings.fontSize !== undefined) {
      const fontSize = Number(fontSettings.fontSize);
      if (!isNaN(fontSize) && fontSize >= 8 && fontSize <= 72) {
        normalized.fontSize = fontSize;
      } else {
        errors.push('fontSize must be a number between 8 and 72');
      }
    }

    // Font family validation
    if (fontSettings.fontFamily !== undefined) {
      if (
        typeof fontSettings.fontFamily === 'string' &&
        fontSettings.fontFamily.trim().length > 0
      ) {
        // Sanitize font family
        normalized.fontFamily = fontSettings.fontFamily.trim();
      } else {
        errors.push('fontFamily must be a non-empty string');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized: errors.length === 0 ? normalized : undefined,
    };
  }

  /**
   * Notify all listeners of settings change
   */
  private notifySettingsChanged(): void {
    this.listeners.forEach((listener) => {
      try {
        listener.onSettingsChanged(this.currentSettings);
      } catch (error) {
        log('❌ [SETTINGS-MANAGER] Error notifying settings listener:', error);
      }
    });
  }

  /**
   * Notify all listeners of font settings change
   */
  private notifyFontSettingsChanged(): void {
    this.listeners.forEach((listener) => {
      try {
        listener.onFontSettingsChanged(this.currentFontSettings);
      } catch (error) {
        log('❌ [SETTINGS-MANAGER] Error notifying font settings listener:', error);
      }
    });
  }

  /**
   * Add settings to history for rollback capability
   */
  private addToHistory(settings: PartialTerminalSettings): void {
    this.settingsHistory.push({
      settings: { ...settings },
      timestamp: Date.now(),
    });

    // Maintain history size limit
    if (this.settingsHistory.length > this.maxHistorySize) {
      this.settingsHistory.shift();
    }
  }

  /**
   * Rollback to previous settings
   */
  public rollbackToPrevious(): boolean {
    if (this.settingsHistory.length === 0) {
      log('⚠️ [SETTINGS-MANAGER] No previous settings to rollback to');
      return false;
    }

    const previous = this.settingsHistory.pop()!;
    this.currentSettings = previous.settings;
    this.notifySettingsChanged();

    log(
      `✅ [SETTINGS-MANAGER] Rolled back to settings from ${new Date(previous.timestamp).toISOString()}`
    );
    return true;
  }

  /**
   * Reset to default settings
   */
  public resetToDefaults(): void {
    log('🔄 [SETTINGS-MANAGER] Resetting to default settings');

    this.addToHistory(this.currentSettings);

    this.currentSettings = {
      theme: 'auto',
      cursorBlink: true,
      altClickMovesCursor: true,
      multiCursorModifier: 'alt',
    };

    this.currentFontSettings = {
      fontSize: 14,
      fontFamily: 'monospace',
    };

    this.notifySettingsChanged();
    this.notifyFontSettingsChanged();
  }

  /**
   * Get settings statistics
   */
  public getStats(): {
    listenerCount: number;
    historySize: number;
    currentSettings: PartialTerminalSettings;
    currentFontSettings: WebViewFontSettings;
  } {
    return {
      listenerCount: this.listeners.size,
      historySize: this.settingsHistory.length,
      currentSettings: this.getCurrentSettings(),
      currentFontSettings: this.getCurrentFontSettings(),
    };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.listeners.clear();
    this.settingsHistory = [];
    log('🧹 [SETTINGS-MANAGER] Settings manager disposed');
  }
}
