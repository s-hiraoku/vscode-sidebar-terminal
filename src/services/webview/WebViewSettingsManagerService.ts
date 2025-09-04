import * as vscode from 'vscode';
import { IWebViewSettingsManager, IMessageHandlerContext } from './interfaces';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { provider as log } from '../../utils/logger';
import { getConfigManager } from '../../config/ConfigManager';
import { showSuccess, showError } from '../../utils/feedback';

/**
 * Manages all WebView settings functionality
 * 
 * This service extracts settings management logic from SecondaryTerminalProvider
 * to provide a focused, testable settings management system.
 */
export class WebViewSettingsManagerService implements IWebViewSettingsManager {
  private _configChangeListener?: vscode.Disposable;

  constructor() {
    log('⚙️ [SettingsManager] WebView settings manager initialized');
  }

  /**
   * Get current terminal settings
   */
  getCurrentSettings(): PartialTerminalSettings {
    try {
      const settings = getConfigManager().getCompleteTerminalSettings();
      const altClickSettings = this.getAltClickSettings();
      const config = vscode.workspace.getConfiguration('secondaryTerminal');

      return {
        cursorBlink: settings.cursorBlink,
        theme: settings.theme || 'auto',
        // VS Code standard settings for Alt+Click functionality
        altClickMovesCursor: altClickSettings.altClickMovesCursor,
        multiCursorModifier: altClickSettings.multiCursorModifier,
        // CLI Agent integration settings
        enableCliAgentIntegration: config.get<boolean>('enableCliAgentIntegration', true),
        // Dynamic split direction settings (Issue #148)
        dynamicSplitDirection: config.get<boolean>('dynamicSplitDirection', true),
        panelLocation: config.get<'auto' | 'sidebar' | 'panel'>('panelLocation', 'auto'),
      };
    } catch (error) {
      log('❌ [SettingsManager] Error getting current settings:', error);
      
      // Return sensible defaults
      return {
        cursorBlink: true,
        theme: 'auto',
        altClickMovesCursor: false,
        multiCursorModifier: 'alt',
        enableCliAgentIntegration: true,
        dynamicSplitDirection: true,
        panelLocation: 'auto',
      };
    }
  }

  /**
   * Get current font settings
   */
  getCurrentFontSettings(): WebViewFontSettings {
    try {
      const configManager = getConfigManager();

      return {
        fontSize: configManager.getFontSize(),
        fontFamily: configManager.getFontFamily(),
        fontWeight: configManager.getFontWeight(),
        fontWeightBold: configManager.getFontWeightBold(),
        lineHeight: configManager.getLineHeight(),
        letterSpacing: configManager.getLetterSpacing(),
      };
    } catch (error) {
      log('❌ [SettingsManager] Error getting font settings:', error);
      
      // Return sensible defaults
      return {
        fontSize: 14,
        fontFamily: 'monospace',
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        lineHeight: 1.2,
        letterSpacing: 0,
      };
    }
  }

  /**
   * Get Alt+Click settings
   */
  getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string } {
    try {
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
    } catch (error) {
      log('❌ [SettingsManager] Error getting Alt+Click settings:', error);
      return {
        altClickMovesCursor: false,
        multiCursorModifier: 'alt',
      };
    }
  }

  /**
   * Update terminal settings
   */
  async updateSettings(settings: PartialTerminalSettings): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('secondaryTerminal');
      log('⚙️ [SettingsManager] Updating settings:', settings);

      // Update VS Code settings (font settings are managed by VS Code directly)
      if (settings.cursorBlink !== undefined) {
        await config.update('cursorBlink', settings.cursorBlink, vscode.ConfigurationTarget.Global);
        log('✅ [SettingsManager] Updated cursorBlink:', settings.cursorBlink);
      }

      if (settings.theme) {
        await config.update('theme', settings.theme, vscode.ConfigurationTarget.Global);
        log('✅ [SettingsManager] Updated theme:', settings.theme);
      }

      if (settings.enableCliAgentIntegration !== undefined) {
        await config.update(
          'enableCliAgentIntegration',
          settings.enableCliAgentIntegration,
          vscode.ConfigurationTarget.Global
        );
        log('✅ [SettingsManager] Updated CLI Agent integration:', settings.enableCliAgentIntegration);
      }

      if (settings.dynamicSplitDirection !== undefined) {
        await config.update(
          'dynamicSplitDirection',
          settings.dynamicSplitDirection,
          vscode.ConfigurationTarget.Global
        );
        log('✅ [SettingsManager] Updated dynamic split direction:', settings.dynamicSplitDirection);
      }

      if (settings.panelLocation !== undefined) {
        await config.update(
          'panelLocation',
          settings.panelLocation,
          vscode.ConfigurationTarget.Global
        );
        log('✅ [SettingsManager] Updated panel location:', settings.panelLocation);
      }

      log('✅ [SettingsManager] All settings updated successfully');
      showSuccess('Settings updated successfully');

    } catch (error) {
      log('❌ [SettingsManager] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Set up configuration change listeners for VS Code standard settings
   */
  setupConfigurationChangeListeners(context: IMessageHandlerContext): vscode.Disposable {
    // Clear existing listener
    this.clearConfigurationChangeListeners();

    log('🎧 [SettingsManager] Setting up configuration change listeners');

    // Monitor VS Code settings changes
    this._configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
      let shouldUpdateSettings = false;
      let shouldUpdateFontSettings = false;
      let shouldUpdatePanelLocation = false;

      // Check for general settings changes
      if (
        event.affectsConfiguration('editor.multiCursorModifier') ||
        event.affectsConfiguration('terminal.integrated.altClickMovesCursor') ||
        event.affectsConfiguration('secondaryTerminal.altClickMovesCursor') ||
        event.affectsConfiguration('secondaryTerminal.theme') ||
        event.affectsConfiguration('secondaryTerminal.cursorBlink') ||
        event.affectsConfiguration('secondaryTerminal.enableCliAgentIntegration')
      ) {
        shouldUpdateSettings = true;
        log('⚙️ [SettingsManager] General settings change detected');
      }

      // Check for font settings changes
      if (
        event.affectsConfiguration('terminal.integrated.fontSize') ||
        event.affectsConfiguration('terminal.integrated.fontFamily') ||
        event.affectsConfiguration('terminal.integrated.fontWeight') ||
        event.affectsConfiguration('terminal.integrated.fontWeightBold') ||
        event.affectsConfiguration('terminal.integrated.lineHeight') ||
        event.affectsConfiguration('terminal.integrated.letterSpacing') ||
        event.affectsConfiguration('editor.fontSize') ||
        event.affectsConfiguration('editor.fontFamily') ||
        event.affectsConfiguration('secondaryTerminal.fontWeight') ||
        event.affectsConfiguration('secondaryTerminal.fontWeightBold') ||
        event.affectsConfiguration('secondaryTerminal.lineHeight') ||
        event.affectsConfiguration('secondaryTerminal.letterSpacing')
      ) {
        shouldUpdateFontSettings = true;
        log('🎨 [SettingsManager] Font settings change detected');
      }

      // Check for dynamic split direction settings changes (Issue #148)
      if (
        event.affectsConfiguration('secondaryTerminal.dynamicSplitDirection') ||
        event.affectsConfiguration('secondaryTerminal.panelLocation')
      ) {
        shouldUpdateSettings = true;
        shouldUpdatePanelLocation = true;
        log('📍 [SettingsManager] Panel location settings change detected');
      }

      // Send updates to WebView
      if (shouldUpdateSettings) {
        log('⚙️ [SettingsManager] Sending settings update to WebView');
        const settings = this.getCurrentSettings();
        context.sendMessage({
          command: 'settingsResponse',
          settings,
        }).catch(error => {
          log('❌ [SettingsManager] Failed to send settings update:', error);
        });
      }

      if (shouldUpdateFontSettings) {
        log('🎨 [SettingsManager] Sending font settings update to WebView');
        const fontSettings = this.getCurrentFontSettings();
        context.sendMessage({
          command: 'fontSettingsUpdate',
          fontSettings,
        }).catch(error => {
          log('❌ [SettingsManager] Failed to send font settings update:', error);
        });
      }

      // Handle panel location setting changes (Issue #148)
      if (shouldUpdatePanelLocation) {
        log('📍 [SettingsManager] Requesting panel location re-detection');
        setTimeout(() => {
          // Request panel location detection from state manager
          const stateManager = (context as any).stateManager;
          if (stateManager && stateManager.requestPanelLocationDetection) {
            stateManager.requestPanelLocationDetection(context);
          }
        }, 100); // Small delay to ensure settings are applied
      }
    });

    // Add to extension context subscriptions
    context.extensionContext.subscriptions.push(this._configChangeListener);
    
    log('✅ [SettingsManager] Configuration change listeners setup complete');
    return this._configChangeListener;
  }

  /**
   * Clear configuration change listeners
   */
  private clearConfigurationChangeListeners(): void {
    if (this._configChangeListener) {
      this._configChangeListener.dispose();
      this._configChangeListener = undefined;
      log('🧹 [SettingsManager] Configuration change listener cleared');
    }
  }

  /**
   * Send all current settings to WebView
   */
  async sendAllSettingsToWebView(context: IMessageHandlerContext): Promise<void> {
    try {
      log('📤 [SettingsManager] Sending all settings to WebView');

      // Send general settings
      const settings = this.getCurrentSettings();
      await context.sendMessage({
        command: 'settingsResponse',
        settings,
      });

      // Send font settings separately
      const fontSettings = this.getCurrentFontSettings();
      await context.sendMessage({
        command: 'fontSettingsUpdate',
        fontSettings,
      });

      // Send initial panel location
      const stateManager = (context as any).stateManager;
      if (stateManager && stateManager.getPanelLocation) {
        const panelLocation = stateManager.getPanelLocation();
        log(`📍 [SettingsManager] Sending initial panel location: ${panelLocation}`);
        await context.sendMessage({
          command: 'panelLocationUpdate',
          location: panelLocation,
        });

        // Also request WebView to detect actual panel location
        if (stateManager.requestPanelLocationDetection) {
          stateManager.requestPanelLocationDetection(context);
        }
      }

      log('✅ [SettingsManager] All settings sent to WebView successfully');

    } catch (error) {
      log('❌ [SettingsManager] Error sending settings to WebView:', error);
      throw error;
    }
  }

  /**
   * Get debug information about current settings
   */
  getDebugInfo(): object {
    return {
      currentSettings: this.getCurrentSettings(),
      fontSettings: this.getCurrentFontSettings(),
      altClickSettings: this.getAltClickSettings(),
      hasConfigListener: !!this._configChangeListener,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [SettingsManager] Disposing settings manager');
    this.clearConfigurationChangeListeners();
  }
}