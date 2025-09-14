import * as vscode from 'vscode';
import { PartialTerminalSettings, WebViewFontSettings } from '../types/shared';
import { getConfigManager } from '../config/ConfigManager';
// import { getTerminalConfig } from '../utils/common'; // unused
import { showSuccess, showError } from '../utils/feedback';
import { provider as log } from '../utils/logger';
import { WebviewMessage } from '../types/common';

/**
 * WebView Settings Manager Service
 *
 * Extracted from SecondaryTerminalProvider to handle:
 * - VS Code settings integration and monitoring
 * - Font settings management
 * - Alt+Click settings
 * - Dynamic panel location detection
 * - Settings persistence and updates
 */

export interface IWebViewSettingsManagerService {
  getCurrentSettings(): PartialTerminalSettings;
  getCurrentFontSettings(): WebViewFontSettings;
  getCurrentPanelLocation(): 'sidebar' | 'panel';
  updateSettings(settings: PartialTerminalSettings): Promise<void>;
  setupConfigurationChangeListeners(): void;
  getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string };
  dispose(): void;
}

export class WebViewSettingsManagerService implements IWebViewSettingsManagerService {
  private configChangeDisposables: vscode.Disposable[] = [];

  constructor(
    private sendMessage: (message: WebviewMessage) => Promise<void>,
    private extensionContext: vscode.ExtensionContext,
    private requestPanelLocationDetection?: () => void
  ) {}

  public getCurrentSettings(): PartialTerminalSettings {
    const settings = getConfigManager().getCompleteTerminalSettings();
    const altClickSettings = getConfigManager().getAltClickSettings();
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
  }

  public getCurrentFontSettings(): WebViewFontSettings {
    const configManager = getConfigManager();

    return {
      fontSize: configManager.getFontSize(),
      fontFamily: configManager.getFontFamily(),
      fontWeight: configManager.getFontWeight(),
      fontWeightBold: configManager.getFontWeightBold(),
      lineHeight: configManager.getLineHeight(),
      letterSpacing: configManager.getLetterSpacing(),
    };
  }

  public getCurrentPanelLocation(): 'sidebar' | 'panel' {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');

    // Check if dynamic split direction feature is enabled
    const isDynamicSplitEnabled = config.get<boolean>('dynamicSplitDirection', true);
    if (!isDynamicSplitEnabled) {
      log('📍 [SETTINGS-MANAGER] Dynamic split direction is disabled, defaulting to sidebar');
      return 'sidebar';
    }

    // Get manual panel location setting
    const manualPanelLocation = config.get<'sidebar' | 'panel' | 'auto'>('panelLocation', 'auto');

    if (manualPanelLocation !== 'auto') {
      log(`📍 [SETTINGS-MANAGER] Using manual panel location: ${manualPanelLocation}`);
      return manualPanelLocation;
    }

    // For auto-detection, default to sidebar
    // Actual detection will be done asynchronously via WebView
    log('📍 [SETTINGS-MANAGER] Auto mode - defaulting to sidebar, will detect via WebView');
    return 'sidebar';
  }

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

  public async updateSettings(settings: PartialTerminalSettings): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('secondaryTerminal');
      // Note: ConfigManager handles reading, but writing must still use VS Code API

      // Update VS Code settings (font settings are managed by VS Code directly)
      if (settings.cursorBlink !== undefined) {
        await config.update('cursorBlink', settings.cursorBlink, vscode.ConfigurationTarget.Global);
      }
      if (settings.theme) {
        await config.update('theme', settings.theme, vscode.ConfigurationTarget.Global);
      }
      if (settings.enableCliAgentIntegration !== undefined) {
        await config.update(
          'enableCliAgentIntegration',
          settings.enableCliAgentIntegration,
          vscode.ConfigurationTarget.Global
        );
        log(
          '🔧 [SETTINGS-MANAGER] CLI Agent integration setting updated:',
          settings.enableCliAgentIntegration
        );
      }
      if (settings.dynamicSplitDirection !== undefined) {
        await config.update(
          'dynamicSplitDirection',
          settings.dynamicSplitDirection,
          vscode.ConfigurationTarget.Global
        );
        log(
          '🔧 [SETTINGS-MANAGER] Dynamic split direction setting updated:',
          settings.dynamicSplitDirection
        );
      }
      if (settings.panelLocation) {
        await config.update(
          'panelLocation',
          settings.panelLocation,
          vscode.ConfigurationTarget.Global
        );
        log('🔧 [SETTINGS-MANAGER] Panel location setting updated:', settings.panelLocation);
      }

      log('✅ [SETTINGS-MANAGER] Settings updated successfully');
      showSuccess('Settings updated successfully');

      // Send updated settings to WebView
      await this.sendSettingsToWebView();
    } catch (error) {
      log('❌ [SETTINGS-MANAGER] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
      throw error;
    }
  }

  public setupConfigurationChangeListeners(): void {
    // Monitor VS Code settings changes
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      void this.handleConfigurationChange(event);
    });

    this.configChangeDisposables.push(configChangeDisposable);
    this.extensionContext.subscriptions.push(configChangeDisposable);

    log('✅ [SETTINGS-MANAGER] Configuration change listeners setup complete');
  }

  private async handleConfigurationChange(event: vscode.ConfigurationChangeEvent): Promise<void> {
    let shouldUpdateSettings = false;
    let shouldUpdateFontSettings = false;
    let shouldUpdatePanelLocation = false;

    // Check for general settings changes
    if (this.isGeneralSettingsChange(event)) {
      shouldUpdateSettings = true;
    }

    // Check for font settings changes
    if (this.isFontSettingsChange(event)) {
      shouldUpdateFontSettings = true;
    }

    // Check for dynamic split direction settings changes (Issue #148)
    if (this.isPanelLocationSettingsChange(event)) {
      shouldUpdateSettings = true;
      shouldUpdatePanelLocation = true;
    }

    // Send updates to WebView
    if (shouldUpdateSettings) {
      log('⚙️ [SETTINGS-MANAGER] VS Code settings changed, updating webview...');
      await this.sendSettingsToWebView();
    }

    if (shouldUpdateFontSettings) {
      log('🎨 [SETTINGS-MANAGER] VS Code font settings changed, updating webview...');
      await this.sendFontSettingsToWebView();
    }

    // Handle panel location setting changes (Issue #148)
    if (shouldUpdatePanelLocation && this.requestPanelLocationDetection) {
      log('📍 [SETTINGS-MANAGER] Panel location settings changed, re-detecting and updating...');
      setTimeout(() => {
        this.requestPanelLocationDetection?.();
      }, 100); // Small delay to ensure settings are applied
    }
  }

  private isGeneralSettingsChange(event: vscode.ConfigurationChangeEvent): boolean {
    return (
      event.affectsConfiguration('editor.multiCursorModifier') ||
      event.affectsConfiguration('terminal.integrated.altClickMovesCursor') ||
      event.affectsConfiguration('secondaryTerminal.altClickMovesCursor') ||
      event.affectsConfiguration('secondaryTerminal.theme') ||
      event.affectsConfiguration('secondaryTerminal.cursorBlink') ||
      event.affectsConfiguration('secondaryTerminal.enableCliAgentIntegration')
    );
  }

  private isFontSettingsChange(event: vscode.ConfigurationChangeEvent): boolean {
    return (
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
    );
  }

  private isPanelLocationSettingsChange(event: vscode.ConfigurationChangeEvent): boolean {
    return (
      event.affectsConfiguration('secondaryTerminal.dynamicSplitDirection') ||
      event.affectsConfiguration('secondaryTerminal.panelLocation')
    );
  }

  private async sendSettingsToWebView(): Promise<void> {
    const settings = this.getCurrentSettings();
    await this.sendMessage({
      command: 'settingsResponse',
      settings,
    });
  }

  private async sendFontSettingsToWebView(): Promise<void> {
    const fontSettings = this.getCurrentFontSettings();
    await this.sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    });
  }

  /**
   * Send initial settings to WebView including panel location detection
   */
  public async sendInitialSettingsToWebView(): Promise<void> {
    // Send settings
    await this.sendSettingsToWebView();

    // Send font settings
    await this.sendFontSettingsToWebView();

    // Send initial panel location and request detection (Issue #148)
    const panelLocation = this.getCurrentPanelLocation();
    log(`📍 [SETTINGS-MANAGER] Sending initial panel location: ${panelLocation}`);

    await this.sendMessage({
      command: 'panelLocationUpdate',
      location: panelLocation,
    });

    // Also request WebView to detect actual panel location
    if (this.requestPanelLocationDetection) {
      this.requestPanelLocationDetection();
    }
  }

  /**
   * Handle panel location reporting from WebView
   */
  public async handlePanelLocationReport(location: 'sidebar' | 'panel'): Promise<void> {
    log('📍 [SETTINGS-MANAGER] Panel location reported from WebView:', location);

    // Update VS Code context key
    await vscode.commands.executeCommand('setContext', 'secondaryTerminal.panelLocation', location);

    // Notify WebView of the updated location
    await this.sendMessage({
      command: 'panelLocationUpdate',
      location: location,
    });

    log('📍 [SETTINGS-MANAGER] Panel location context key and WebView updated:', location);
  }

  /**
   * Get complete settings for restoration scenarios
   */
  public getCompleteSettings(): PartialTerminalSettings & {
    fontSettings: WebViewFontSettings;
    altClickSettings: { altClickMovesCursor: boolean; multiCursorModifier: string };
    panelLocation: 'sidebar' | 'panel';
  } {
    return {
      ...this.getCurrentSettings(),
      fontSettings: this.getCurrentFontSettings(),
      altClickSettings: this.getAltClickSettings(),
      panelLocation: this.getCurrentPanelLocation(),
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    log('🔧 [SETTINGS-MANAGER] Disposing WebView settings manager...');

    // Dispose all configuration change disposables
    for (const disposable of this.configChangeDisposables) {
      disposable.dispose();
    }
    this.configChangeDisposables.length = 0;

    log('✅ [SETTINGS-MANAGER] WebView settings manager disposed');
  }
}
