/**
 * SettingsCoordinator
 *
 * Settings management methods extracted from LightweightTerminalWebviewManager.
 * Handles settings load/save/apply, font settings, and settings panel operations.
 */

import { webview as log } from '../../utils/logger';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { TerminalTheme } from '../types/theme.types';
import { TerminalInstance } from '../interfaces/ManagerInterfaces';

/**
 * Dependencies required by SettingsCoordinator
 */
export interface ISettingsCoordinatorDependencies {
  // Settings state
  getCurrentSettings(): PartialTerminalSettings;
  setCurrentSettings(settings: PartialTerminalSettings): void;

  // ConfigManager delegation
  configManagerApplySettings(
    settings: PartialTerminalSettings,
    instances: Map<string, TerminalInstance>
  ): void;
  configManagerGetCurrentSettings(): PartialTerminalSettings;
  hasConfigManager(): boolean;

  // Terminal instances
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  getAllTerminalContainers(): Map<string, HTMLElement>;
  getSplitTerminals(): Map<string, TerminalInstance>;

  // UI Manager delegation
  setActiveBorderMode(mode: string): void;
  setTerminalHeaderEnhancementsEnabled(enabled: boolean): void;
  updateTerminalBorders(activeId: string, containers: Map<string, HTMLElement>): void;
  updateSplitTerminalBorders(activeId: string): void;
  applyAllVisualSettings(terminal: unknown, settings: PartialTerminalSettings): void;

  // Font settings service delegation
  fontSettingsUpdateSettings(
    fontSettings: WebViewFontSettings,
    terminals: Map<string, TerminalInstance>
  ): void;
  fontSettingsGetCurrentSettings(): WebViewFontSettings;

  // WebView API delegation
  loadState(): { settings?: PartialTerminalSettings; fontSettings?: WebViewFontSettings } | null;
  saveState(state: unknown): void;

  // Active terminal
  getActiveTerminalId(): string | null;

  // Settings panel delegation
  hasSettingsPanel(): boolean;
  settingsPanelSetVersionInfo(version: string): void;
  settingsPanelShow(settings: PartialTerminalSettings): void;

  // Version info
  getVersionInfo(): string;
}

export class SettingsCoordinator {
  constructor(private readonly deps: ISettingsCoordinatorDependencies) {}

  /**
   * Apply settings to all terminals
   */
  public applySettings(settings: PartialTerminalSettings): void {
    try {
      const currentSettings = this.deps.getCurrentSettings();
      const activeBorderMode =
        settings.activeBorderMode !== undefined
          ? settings.activeBorderMode
          : (currentSettings.activeBorderMode ?? 'multipleOnly');

      const newSettings: PartialTerminalSettings = {
        ...currentSettings,
        ...settings,
        activeBorderMode,
      };

      this.deps.setCurrentSettings(newSettings);

      // Update ConfigManager with new settings
      if (this.deps.hasConfigManager()) {
        const instances = this.deps.getAllTerminalInstances();
        this.deps.configManagerApplySettings(newSettings, instances);
        log(`⚙️ [SETTINGS] ConfigManager updated with theme: ${newSettings.theme}`);
      }

      this.deps.setActiveBorderMode(activeBorderMode);
      this.deps.setTerminalHeaderEnhancementsEnabled(
        newSettings.enableTerminalHeaderEnhancements !== false
      );

      const activeId = this.deps.getActiveTerminalId();
      if (activeId) {
        const containers = this.deps.getAllTerminalContainers();
        if (containers.size > 0) {
          this.deps.updateTerminalBorders(activeId, containers);
        } else {
          this.deps.updateSplitTerminalBorders(activeId);
        }
      }

      // Apply theme and visual settings to all terminals
      const instances = this.deps.getAllTerminalInstances();
      instances.forEach((terminalData, terminalId) => {
        try {
          this.deps.applyAllVisualSettings(terminalData.terminal, newSettings);
          log(`⚙️ [SETTINGS] Applied visual settings to terminal ${terminalId}`);
        } catch (error) {
          log(`❌ [SETTINGS] Error applying visual settings to terminal ${terminalId}:`, error);
        }
      });

      log('⚙️ Settings applied:', settings);
    } catch (error) {
      log('❌ Error applying settings:', error);
    }
  }

  /**
   * Load settings from WebView state
   */
  public loadSettings(): void {
    try {
      const savedState = this.deps.loadState();

      if (savedState?.settings) {
        this.applySettings(savedState.settings);
      }

      if (savedState?.fontSettings) {
        this.applyFontSettings(savedState.fontSettings);
      }

      log('📂 Settings loaded from WebView state');
    } catch (error) {
      log('❌ Error loading settings:', error);
    }
  }

  /**
   * Save settings to WebView state
   */
  public saveSettings(): void {
    try {
      const state = {
        settings: this.deps.getCurrentSettings(),
        fontSettings: this.deps.fontSettingsGetCurrentSettings(),
        timestamp: Date.now(),
      };

      this.deps.saveState(state);
      log('💾 Settings saved to WebView state');
    } catch (error) {
      log('❌ Error saving settings:', error);
    }
  }

  /**
   * Apply font settings to all terminals
   */
  public applyFontSettings(fontSettings: WebViewFontSettings): void {
    try {
      const terminals = this.deps.getSplitTerminals();
      this.deps.fontSettingsUpdateSettings(fontSettings, terminals);
    } catch (error) {
      log('❌ Error applying font settings:', error);
    }
  }

  /**
   * Get current font settings
   */
  public getCurrentFontSettings(): WebViewFontSettings {
    return this.deps.fontSettingsGetCurrentSettings();
  }

  /**
   * Open the settings panel
   */
  public openSettings(): void {
    try {
      if (!this.deps.hasSettingsPanel()) {
        log('⚙️ Settings panel not initialized');
        return;
      }

      const currentSettings = this.deps.getCurrentSettings();
      const baseSettings = this.deps.hasConfigManager()
        ? this.deps.configManagerGetCurrentSettings()
        : currentSettings;
      const panelSettings = { ...baseSettings, ...currentSettings };

      this.deps.settingsPanelSetVersionInfo(this.deps.getVersionInfo());
      this.deps.settingsPanelShow(panelSettings);
      log('⚙️ Opening settings panel');
    } catch (error) {
      log('❌ Error opening settings panel:', error);
    }
  }

  /**
   * Update theme for all terminal instances
   * Called when VS Code theme changes and settings.theme is 'auto'
   */
  public updateAllTerminalThemes(theme: TerminalTheme): void {
    try {
      log(`🎨 [THEME] Updating all terminal themes`);

      const terminals = this.deps.getSplitTerminals();
      let updatedCount = 0;

      for (const [id, instance] of terminals) {
        if (instance.terminal) {
          // Update xterm.js theme options
          (instance.terminal as any).options.theme = theme;

          // Update container background color
          if (instance.container) {
            instance.container.style.backgroundColor = theme.background;
          }

          // Update xterm.js internal elements for immediate visual update
          const terminalElement = instance.container?.querySelector('.xterm') as HTMLElement;
          if (terminalElement) {
            terminalElement.style.backgroundColor = theme.background;

            // Update viewport background
            const viewport = terminalElement.querySelector('.xterm-viewport') as HTMLElement;
            if (viewport) {
              viewport.style.backgroundColor = theme.background;
            }

            // Update screen background
            const screen = terminalElement.querySelector('.xterm-screen') as HTMLElement;
            if (screen) {
              screen.style.backgroundColor = theme.background;
            }
          }

          updatedCount++;
          log(`🎨 [THEME] Updated theme for terminal: ${id}`);
        }
      }

      // Also update terminal-body and terminals-wrapper backgrounds
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        terminalBody.style.backgroundColor = theme.background;
      }

      const terminalsWrapper = document.getElementById('terminals-wrapper');
      if (terminalsWrapper) {
        terminalsWrapper.style.backgroundColor = theme.background;
      }

      log(`🎨 [THEME] Theme updated for ${updatedCount} terminals`);
    } catch (error) {
      log('❌ Error updating terminal themes:', error);
    }
  }
}
