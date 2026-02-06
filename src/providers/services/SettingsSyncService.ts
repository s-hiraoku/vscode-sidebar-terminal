import * as vscode from 'vscode';
import { PartialTerminalSettings, WebViewFontSettings, ActiveBorderMode } from '../../types/shared';
import { getUnifiedConfigurationService } from '../../config/UnifiedConfigurationService';
import { showSuccess, showError } from '../../utils/feedback';
import { provider as log } from '../../utils/logger';

/**
 * SettingsSyncService
 *
 * Handles synchronization of terminal settings between VS Code configuration
 * and the WebView terminal. This service centralizes all settings-related operations
 * and provides a clean interface for settings management.
 *
 * Responsibilities:
 * - Retrieve current terminal settings
 * - Retrieve font settings
 * - Update settings in VS Code configuration
 * - Get Alt+Click and multi-cursor settings
 *
 * Part of Issue #214 refactoring to apply Facade pattern
 */
export class SettingsSyncService {
  /**
   * Callback to reinitialize terminal after settings update
   */
  private _reinitializeTerminalCallback?: () => Promise<void>;

  constructor(reinitializeTerminalCallback?: () => Promise<void>) {
    this._reinitializeTerminalCallback = reinitializeTerminalCallback;
    // Run migration check on construction
    this._migrateDeprecatedSettings();
  }

  /**
   * Migrate deprecated settings to new format
   * Handles: highlightActiveBorder (boolean) -> activeBorderMode (enum)
   */
  private _migrateDeprecatedSettings(): void {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    const inspection = config.inspect<boolean>('highlightActiveBorder');

    // Check if user explicitly set the old setting (not default)
    const userValue = inspection?.globalValue ?? inspection?.workspaceValue;
    if (userValue !== undefined) {
      // User had the old setting - migrate it
      const newMode: ActiveBorderMode = userValue === false ? 'none' : 'multipleOnly';

      // Only migrate if new setting hasn't been explicitly set
      const newInspection = config.inspect<string>('activeBorderMode');
      const newUserValue = newInspection?.globalValue ?? newInspection?.workspaceValue;

      if (newUserValue === undefined) {
        log(`🔄 Migrating highlightActiveBorder=${userValue} to activeBorderMode=${newMode}`);
        config.update('activeBorderMode', newMode, vscode.ConfigurationTarget.Global)
          .then(() => {
            log(`✅ Settings migration complete`);
          }, (err) => {
            log(`⚠️ Settings migration failed: ${err}`);
          });
      }
    }
  }

  /**
   * Get current terminal settings for WebView
   *
   * Returns settings that affect terminal behavior in the WebView,
   * including theme, cursor, CLI agent integration, and dynamic split direction
   */
  public getCurrentSettings(): PartialTerminalSettings {
    const configService = getUnifiedConfigurationService();
    const settings = configService.getCompleteTerminalSettings();
    const altClickSettings = configService.getAltClickSettings();

    // Use unified service for all configuration access
    return {
      cursorBlink: settings.cursorBlink,
      theme: settings.theme || 'auto',
      // Scrollback buffer size (secondaryTerminal.scrollback setting)
      scrollback: configService.get('secondaryTerminal', 'scrollback', 2000),
      // VS Code standard settings for Alt+Click functionality
      altClickMovesCursor: altClickSettings.altClickMovesCursor,
      multiCursorModifier: altClickSettings.multiCursorModifier,
      // CLI Agent Code integration settings
      enableCliAgentIntegration: configService.isFeatureEnabled('cliAgentIntegration'),
      enableTerminalHeaderEnhancements: configService.isFeatureEnabled(
        'terminalHeaderEnhancements'
      ),
      showHeaderModeIndicator: configService.get(
        'secondaryTerminal',
        'showHeaderModeIndicator',
        true
      ),
      activeBorderMode: configService.get('secondaryTerminal', 'activeBorderMode', 'multipleOnly'),
      // Dynamic split direction settings (Issue #148)
      dynamicSplitDirection: configService.isFeatureEnabled('dynamicSplitDirection'),
      panelLocation: configService.get('secondaryTerminal', 'panelLocation', 'auto'),
    };
  }

  /**
   * Get current font settings for WebView
   *
   * Returns font-related settings from VS Code's terminal configuration
   */
  public getCurrentFontSettings(): WebViewFontSettings {
    const configService = getUnifiedConfigurationService();
    return configService.getWebViewFontSettings();
  }

  /**
   * Get complete settings including shell and terminal configuration
   *
   * This method provides a more comprehensive settings object
   * including shell, font size, and other terminal-specific settings
   */
  public getCompleteSettings(): PartialTerminalSettings {
    const configService = getUnifiedConfigurationService();
    const config = configService.getExtensionTerminalConfig();
    const webViewSettings = configService.getWebViewTerminalSettings();

    return {
      shell: config.shell || '',
      shellArgs: config.shellArgs || [],
      fontSize: config.fontSize || 14,
      fontFamily: config.fontFamily || 'monospace',
      theme: webViewSettings.theme || 'dark',
      cursor: config.cursor || {
        style: 'block',
        blink: true,
      },
      maxTerminals: config.maxTerminals || 5,
      enableCliAgentIntegration: config.enableCliAgentIntegration || false,
      enableTerminalHeaderEnhancements: config.enableTerminalHeaderEnhancements ?? true,
      showHeaderModeIndicator: config.showHeaderModeIndicator ?? true,
      // 🆕 Issue #148: Dynamic split direction settings
      dynamicSplitDirection: webViewSettings.dynamicSplitDirection,
      panelLocation: webViewSettings.panelLocation || 'auto',
    };
  }

  /**
   * Get Alt+Click settings for restoration
   *
   * Retrieves settings that control Alt+Click behavior in the terminal
   * and multi-cursor modifier settings from the editor
   */
  public getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string } {
    const vsCodeAltClickSetting = vscode.workspace
      .getConfiguration('terminal.integrated')
      .get<boolean>('altClickMovesCursor', false);

    const vsCodeMultiCursorModifier = vscode.workspace
      .getConfiguration('editor')
      .get<string>('multiCursorModifier', 'alt');

    const extensionAltClickSetting = vscode.workspace
      .getConfiguration('secondaryTerminal')
      .get<boolean>('altClickMovesCursor', vsCodeAltClickSetting);

    return {
      altClickMovesCursor: extensionAltClickSetting,
      multiCursorModifier: vsCodeMultiCursorModifier,
    };
  }

  /**
   * Update terminal settings
   *
   * Updates VS Code configuration with new settings and optionally
   * reinitializes the terminal to apply changes
   */
  public async updateSettings(settings: PartialTerminalSettings): Promise<void> {
    try {
      const configService = getUnifiedConfigurationService();
      log('⚙️ [SETTINGS] Updating settings via UnifiedConfigurationService:', settings);

      // Update VS Code settings using unified configuration service
      if (settings.cursorBlink !== undefined) {
        await configService.update('secondaryTerminal', 'cursorBlink', settings.cursorBlink);
      }
      if (settings.theme) {
        await configService.update('secondaryTerminal', 'theme', settings.theme);
      }
      if (settings.enableCliAgentIntegration !== undefined) {
        await configService.update(
          'secondaryTerminal',
          'enableCliAgentIntegration',
          settings.enableCliAgentIntegration
        );
      }
      if (settings.enableTerminalHeaderEnhancements !== undefined) {
        await configService.update(
          'secondaryTerminal',
          'enableTerminalHeaderEnhancements',
          settings.enableTerminalHeaderEnhancements
        );
      }
      if (settings.showHeaderModeIndicator !== undefined) {
        await configService.update(
          'secondaryTerminal',
          'showHeaderModeIndicator',
          settings.showHeaderModeIndicator
        );
      }
      if (settings.activeBorderMode !== undefined) {
        await configService.update(
          'secondaryTerminal',
          'activeBorderMode',
          settings.activeBorderMode
        );
      }
      if (settings.dynamicSplitDirection !== undefined) {
        await configService.update(
          'secondaryTerminal',
          'dynamicSplitDirection',
          settings.dynamicSplitDirection
        );
      }
      if (settings.panelLocation !== undefined) {
        await configService.update('secondaryTerminal', 'panelLocation', settings.panelLocation);
      }
      // Note: Font settings are read directly from VS Code's terminal/editor settings

      log('✅ [SETTINGS] Settings updated successfully');
      showSuccess('Settings updated successfully');

      // Reinitialize terminal with new settings to apply changes
      if (this._reinitializeTerminalCallback) {
        await this._reinitializeTerminalCallback();
      }
    } catch (error) {
      log('❌ [SETTINGS] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
    }
  }

  /**
   * Set the callback to reinitialize terminal after settings update
   */
  public setReinitializeCallback(callback: () => Promise<void>): void {
    this._reinitializeTerminalCallback = callback;
  }
}
