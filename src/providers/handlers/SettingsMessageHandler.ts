/**
 * SettingsMessageHandler
 *
 * Settings-related message handling extracted from SecondaryTerminalProvider.
 * Handles getSettings, updateSettings messages and configuration change detection.
 *
 * Delegates to SettingsSyncService for actual settings retrieval/update,
 * and handles WebView message sending for settings synchronization.
 */

import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { hasSettings } from '../../types/type-guards';
import { provider as log } from '../../utils/logger';

/**
 * Settings service interface for settings operations
 */
export interface ISettingsService {
  getCurrentSettings(): PartialTerminalSettings;
  getCurrentFontSettings(): WebViewFontSettings;
  updateSettings(settings: PartialTerminalSettings): Promise<void>;
}

/**
 * Dependencies required by SettingsMessageHandler
 */
export interface ISettingsMessageHandlerDependencies {
  getSettingsService(): ISettingsService;
  sendMessage(message: WebviewMessage): Promise<void>;
}

export class SettingsMessageHandler {
  constructor(private readonly deps: ISettingsMessageHandlerDependencies) {}

  /**
   * Handle getSettings request from WebView.
   * Sends both general settings and font settings to the WebView.
   */
  public async handleGetSettings(): Promise<void> {
    const settingsService = this.deps.getSettingsService();

    const settings = settingsService.getCurrentSettings();
    const fontSettings = settingsService.getCurrentFontSettings();
    log(`📤 [SETTINGS] _handleGetSettings sending (theme: ${settings.theme})`);

    await this.deps.sendMessage({
      command: 'settingsResponse',
      settings,
    } as WebviewMessage);

    await this.deps.sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    } as WebviewMessage);
  }

  /**
   * Handle updateSettings request from WebView.
   * Validates the message and delegates to SettingsSyncService.
   */
  public async handleUpdateSettings(message: WebviewMessage): Promise<void> {
    if (!hasSettings(message)) {
      log('⚠️ [PROVIDER] Update settings message missing settings');
      return;
    }

    log('⚙️ [PROVIDER] Updating settings from WebView');
    const settingsService = this.deps.getSettingsService();
    await settingsService.updateSettings(message.settings);
  }

  /**
   * Check if a configuration change event affects WebView settings.
   */
  public isSettingsChangeAffectingWebView(event: vscode.ConfigurationChangeEvent): boolean {
    return (
      event.affectsConfiguration('secondaryTerminal.activeBorderMode') ||
      event.affectsConfiguration('secondaryTerminal.theme') ||
      event.affectsConfiguration('secondaryTerminal.cursorBlink') ||
      event.affectsConfiguration('secondaryTerminal.enableCliAgentIntegration') ||
      event.affectsConfiguration('secondaryTerminal.enableTerminalHeaderEnhancements') ||
      event.affectsConfiguration('secondaryTerminal.dynamicSplitDirection') ||
      event.affectsConfiguration('secondaryTerminal.panelLocation') ||
      event.affectsConfiguration('editor.multiCursorModifier') ||
      event.affectsConfiguration('terminal.integrated.altClickMovesCursor') ||
      event.affectsConfiguration('secondaryTerminal.altClickMovesCursor')
    );
  }

  /**
   * Check if a configuration change event affects font settings.
   */
  public isFontSettingsChange(event: vscode.ConfigurationChangeEvent): boolean {
    return (
      event.affectsConfiguration('secondaryTerminal.fontFamily') ||
      event.affectsConfiguration('secondaryTerminal.fontSize') ||
      event.affectsConfiguration('secondaryTerminal.fontWeight') ||
      event.affectsConfiguration('secondaryTerminal.fontWeightBold') ||
      event.affectsConfiguration('secondaryTerminal.lineHeight') ||
      event.affectsConfiguration('secondaryTerminal.letterSpacing') ||
      event.affectsConfiguration('terminal.integrated.fontSize') ||
      event.affectsConfiguration('terminal.integrated.fontFamily') ||
      event.affectsConfiguration('terminal.integrated.fontWeight') ||
      event.affectsConfiguration('terminal.integrated.fontWeightBold') ||
      event.affectsConfiguration('terminal.integrated.lineHeight') ||
      event.affectsConfiguration('terminal.integrated.letterSpacing') ||
      event.affectsConfiguration('editor.fontSize') ||
      event.affectsConfiguration('editor.fontFamily')
    );
  }

  /**
   * Send updated settings to WebView (triggered by configuration change).
   */
  public async sendSettingsUpdateToWebView(): Promise<void> {
    const settingsService = this.deps.getSettingsService();
    const settings = settingsService.getCurrentSettings();
    log(
      `📤 [PROVIDER] Sending settings update to WebView: activeBorderMode=${settings.activeBorderMode}`
    );
    await this.deps.sendMessage({
      command: 'settingsResponse',
      settings,
    } as WebviewMessage);
  }

  /**
   * Send updated font settings to WebView (triggered by configuration change).
   */
  public async sendFontSettingsUpdateToWebView(): Promise<void> {
    const settingsService = this.deps.getSettingsService();
    const fontSettings = settingsService.getCurrentFontSettings();
    log('📤 [PROVIDER] Sending font settings update to WebView');
    await this.deps.sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    } as WebviewMessage);
  }
}
