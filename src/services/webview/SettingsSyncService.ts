import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { getUnifiedConfigurationService } from '../../config/UnifiedConfigurationService';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { showSuccess, showError } from '../../utils/feedback';

/**
 * Manages settings synchronization between Extension and WebView
 *
 * This service extracts settings management from SecondaryTerminalProvider
 * to provide a clean separation of concerns.
 */
export class SettingsSyncService {
  private configChangeDisposable?: vscode.Disposable;

  constructor() {
    log('⚙️ [SettingsSyncService] Settings sync service created');
  }

  /**
   * Get current terminal settings
   */
  getCurrentSettings(): PartialTerminalSettings {
    const configService = getUnifiedConfigurationService();
    const settings = configService.getCompleteTerminalSettings();
    const altClickSettings = configService.getAltClickSettings();

    return {
      cursorBlink: settings.cursorBlink,
      theme: settings.theme || 'auto',
      altClickMovesCursor: altClickSettings.altClickMovesCursor,
      multiCursorModifier: altClickSettings.multiCursorModifier,
      enableCliAgentIntegration: configService.isFeatureEnabled('cliAgentIntegration'),
      dynamicSplitDirection: configService.isFeatureEnabled('dynamicSplitDirection'),
      panelLocation: configService.get('sidebarTerminal', 'panelLocation', 'auto'),
    };
  }

  /**
   * Get current font settings
   */
  getCurrentFontSettings(): WebViewFontSettings {
    const configService = getUnifiedConfigurationService();
    return configService.getWebViewFontSettings();
  }

  /**
   * Get Alt+Click settings
   */
  getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string } {
    const configService = getUnifiedConfigurationService();
    return configService.getAltClickSettings();
  }

  /**
   * Determine current panel location
   */
  getCurrentPanelLocation(): 'sidebar' | 'panel' {
    const configService = getUnifiedConfigurationService();
    const isDynamicSplitEnabled = configService.isFeatureEnabled('dynamicSplitDirection');

    if (!isDynamicSplitEnabled) {
      log('📍 [SettingsSyncService] Dynamic split direction disabled, defaulting to sidebar');
      return 'sidebar';
    }

    const manualLocation = configService.get('sidebarTerminal', 'panelLocation', 'auto');
    if (manualLocation !== 'auto') {
      log(`📍 [SettingsSyncService] Using manual panel location: ${manualLocation}`);
      return manualLocation as 'sidebar' | 'panel';
    }

    // Default to sidebar
    return 'sidebar';
  }

  /**
   * Update terminal settings
   */
  async updateSettings(
    settings: PartialTerminalSettings,
    onReinitialize?: () => Promise<void>
  ): Promise<void> {
    try {
      const configService = getUnifiedConfigurationService();
      log('⚙️ [SettingsSyncService] Updating settings:', settings);

      // Update VS Code settings using unified configuration service
      if (settings.cursorBlink !== undefined) {
        await configService.update('sidebarTerminal', 'cursorBlink', settings.cursorBlink);
      }
      if (settings.theme) {
        await configService.update('sidebarTerminal', 'theme', settings.theme);
      }
      if (settings.enableCliAgentIntegration !== undefined) {
        await configService.update(
          'sidebarTerminal',
          'enableCliAgentIntegration',
          settings.enableCliAgentIntegration
        );
      }
      if (settings.dynamicSplitDirection !== undefined) {
        await configService.update(
          'sidebarTerminal',
          'dynamicSplitDirection',
          settings.dynamicSplitDirection
        );
      }
      if (settings.panelLocation !== undefined) {
        await configService.update('sidebarTerminal', 'panelLocation', settings.panelLocation);
      }

      log('✅ [SettingsSyncService] Settings updated successfully');
      showSuccess('Settings updated successfully');

      // Reinitialize terminal with new settings
      if (onReinitialize) {
        await onReinitialize();
      }
    } catch (error) {
      log('❌ [SettingsSyncService] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Set up configuration change listeners
   */
  setupConfigurationChangeListeners(onConfigChanged: (settings: PartialTerminalSettings) => Promise<void>): vscode.Disposable {
    log('⚙️ [SettingsSyncService] Setting up configuration change listeners');

    this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
      // Check if relevant settings changed
      if (
        e.affectsConfiguration('sidebarTerminal') ||
        e.affectsConfiguration('terminal.integrated.fontFamily') ||
        e.affectsConfiguration('terminal.integrated.fontSize') ||
        e.affectsConfiguration('terminal.integrated.lineHeight') ||
        e.affectsConfiguration('terminal.integrated.letterSpacing') ||
        e.affectsConfiguration('terminal.integrated.fontWeight') ||
        e.affectsConfiguration('terminal.integrated.fontWeightBold')
      ) {
        log('⚙️ [SettingsSyncService] Configuration changed, notifying WebView');

        try {
          const newSettings = this.getCurrentSettings();
          await onConfigChanged(newSettings);
        } catch (error) {
          log('❌ [SettingsSyncService] Failed to handle configuration change:', error);
        }
      }
    });

    return this.configChangeDisposable;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.configChangeDisposable) {
      this.configChangeDisposable.dispose();
      this.configChangeDisposable = undefined;
    }
    log('🧹 [SettingsSyncService] Disposed');
  }
}
