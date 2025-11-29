/**
 * Terminal Settings Manager
 *
 * Centralized management of terminal settings with clear responsibilities:
 * - Maintain current settings state
 * - Apply settings to terminals
 * - Persist and load settings from WebView state
 *
 * This manager consolidates settings logic that was previously scattered
 * across multiple locations in LightweightTerminalWebviewManager.
 */

import { webview as log } from '../../utils/logger';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { FontSettingsService } from '../services/FontSettingsService';
import { TerminalInstance, IUIManager, IConfigManager } from '../interfaces/ManagerInterfaces';
import { ConfigManager } from './ConfigManager';

export interface SettingsState {
  settings: PartialTerminalSettings;
  fontSettings: WebViewFontSettings;
  timestamp: number;
}

export interface ISettingsCallbacks {
  getAllTerminalInstances: () => Map<string, TerminalInstance>;
  getAllTerminalContainers: () => Map<string, HTMLElement>;
  getActiveTerminalId: () => string | null;
}

/**
 * Default settings for terminals
 */
const DEFAULT_SETTINGS: PartialTerminalSettings = {
  theme: 'auto',
  cursorBlink: true,
  altClickMovesCursor: true,
  multiCursorModifier: 'alt',
  highlightActiveBorder: true,
};

/**
 * Manages terminal settings with clear separation of concerns
 */
export class TerminalSettingsManager {
  private currentSettings: PartialTerminalSettings = { ...DEFAULT_SETTINGS };
  private readonly fontSettingsService: FontSettingsService;

  constructor(
    private readonly uiManager: IUIManager,
    private readonly configManager: IConfigManager,
    private readonly callbacks: ISettingsCallbacks
  ) {
    this.fontSettingsService = new FontSettingsService();
    this.fontSettingsService.setApplicator(uiManager);

    // Connect ConfigManager to FontSettingsService for single source of truth
    // Use type narrowing to access ConfigManager-specific method
    if (this.configManager instanceof ConfigManager) {
      this.configManager.setFontSettingsService(this.fontSettingsService);
    }

    log('[SETTINGS] TerminalSettingsManager initialized');
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
    return this.fontSettingsService.getCurrentSettings();
  }

  /**
   * Apply settings to all terminals
   */
  public applySettings(settings: PartialTerminalSettings): void {
    try {
      const highlightActiveBorder =
        settings.highlightActiveBorder !== undefined
          ? settings.highlightActiveBorder
          : (this.currentSettings.highlightActiveBorder ?? true);

      this.currentSettings = {
        ...this.currentSettings,
        ...settings,
        highlightActiveBorder,
      };

      this.uiManager.setHighlightActiveBorder(highlightActiveBorder);

      const activeId = this.callbacks.getActiveTerminalId();
      if (activeId) {
        const containers = this.callbacks.getAllTerminalContainers();
        if (containers.size > 0) {
          this.uiManager.updateTerminalBorders(activeId, containers);
        } else {
          this.uiManager.updateSplitTerminalBorders(activeId);
        }
      }

      // Apply to ConfigManager for terminal-level settings
      if (this.configManager) {
        const instances = this.callbacks.getAllTerminalInstances();
        this.configManager.applySettings(this.currentSettings, instances);
        this.currentSettings = this.configManager.getCurrentSettings();
      }

      log('[SETTINGS] Settings applied:', settings);
    } catch (error) {
      log('[SETTINGS] Error applying settings:', error);
    }
  }

  /**
   * Apply font settings to all terminals
   *
   * Delegates to FontSettingsService for single source of truth management.
   */
  public applyFontSettings(
    fontSettings: WebViewFontSettings,
    terminals: Map<string, TerminalInstance>
  ): void {
    try {
      this.fontSettingsService.updateSettings(fontSettings, terminals);
      log('[SETTINGS] Font settings applied via FontSettingsService');
    } catch (error) {
      log('[SETTINGS] Error applying font settings:', error);
    }
  }

  /**
   * Load settings from saved state
   */
  public loadFromState(savedState: SettingsState | null): void {
    try {
      if (savedState?.settings) {
        this.applySettings(savedState.settings);
      }

      if (savedState?.fontSettings) {
        const terminals = this.callbacks.getAllTerminalInstances();
        this.applyFontSettings(savedState.fontSettings, terminals);
      }

      log('[SETTINGS] Settings loaded from WebView state');
    } catch (error) {
      log('[SETTINGS] Error loading settings:', error);
    }
  }

  /**
   * Get settings state for saving
   */
  public getStateForSave(): SettingsState {
    return {
      settings: this.currentSettings,
      fontSettings: this.fontSettingsService.getCurrentSettings(),
      timestamp: Date.now(),
    };
  }

  /**
   * Reset settings to defaults
   */
  public resetToDefaults(): void {
    this.currentSettings = { ...DEFAULT_SETTINGS };
    this.applySettings(this.currentSettings);
    log('[SETTINGS] Settings reset to defaults');
  }

  /**
   * Update a single setting
   */
  public updateSetting<K extends keyof PartialTerminalSettings>(
    key: K,
    value: PartialTerminalSettings[K]
  ): void {
    this.applySettings({ [key]: value } as PartialTerminalSettings);
  }

  /**
   * Get FontSettingsService for direct access
   */
  public getFontSettingsService(): FontSettingsService {
    return this.fontSettingsService;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    log('[SETTINGS] TerminalSettingsManager disposed');
  }
}
