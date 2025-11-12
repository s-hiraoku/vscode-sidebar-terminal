import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';
import { getUnifiedConfigurationService } from '../../../config/UnifiedConfigurationService';

/**
 * Handles requests for current settings
 */
export class GetSettingsHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['getSettings'];

  async handle(_message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(_message, 'GetSettings');

    try {
      log('⚙️ [GetSettings] Getting settings...');
      const settings = this.getCurrentSettings();
      const fontSettings = this.getCurrentFontSettings();

      await context.sendMessage({
        command: 'settingsResponse',
        settings,
      });

      // Send font settings separately
      await context.sendMessage({
        command: 'fontSettingsUpdate',
        fontSettings,
      });

      // Send initial panel location (Issue #148)
      const panelLocation = this.getCurrentPanelLocation();
      log(`📍 [GetSettings] Sending initial panel location: ${panelLocation}`);
      await context.sendMessage({
        command: 'panelLocationUpdate',
        location: panelLocation,
      });

      // Request WebView to detect actual panel location
      await context.sendMessage({
        command: 'requestPanelLocationDetection',
      });

      log('✅ [GetSettings] Settings sent successfully');
    } catch (error) {
      await this.handleError(error, _message, 'GetSettings');
    }
  }

  /**
   * Get current terminal settings
   */
  private getCurrentSettings() {
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
  private getCurrentFontSettings() {
    const configService = getUnifiedConfigurationService();
    return configService.getWebViewFontSettings();
  }

  /**
   * Determine current panel location
   */
  private getCurrentPanelLocation(): 'sidebar' | 'panel' {
    const configService = getUnifiedConfigurationService();
    const isDynamicSplitEnabled = configService.isFeatureEnabled('dynamicSplitDirection');

    if (!isDynamicSplitEnabled) {
      log('📍 [GetSettings] Dynamic split direction disabled, defaulting to sidebar');
      return 'sidebar';
    }

    const manualLocation = configService.get('sidebarTerminal', 'panelLocation', 'auto');
    if (manualLocation !== 'auto') {
      log(`📍 [GetSettings] Using manual panel location: ${manualLocation}`);
      return manualLocation as 'sidebar' | 'panel';
    }

    // Default to sidebar
    return 'sidebar';
  }
}
