import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage, PartialTerminalSettings } from '../../../types/common';
import { provider as log } from '../../../utils/logger';
import { getUnifiedConfigurationService } from '../../../config/UnifiedConfigurationService';
import { showSuccess, showError } from '../../../utils/feedback';

/**
 * Handles setting update requests from WebView
 */
export class UpdateSettingsHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['updateSettings'];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'UpdateSettings');

    if (!this.hasSettings(message)) {
      log('⚠️ [UpdateSettings] No settings provided');
      return;
    }

    try {
      log('⚙️ [UpdateSettings] Updating settings:', message.settings);
      await this.updateSettings(message.settings, context);
      log('✅ [UpdateSettings] Settings updated successfully');
    } catch (error) {
      await this.handleError(error, message, 'UpdateSettings');
    }
  }

  /**
   * Update terminal settings
   */
  private async updateSettings(
    settings: PartialTerminalSettings,
    context: IMessageHandlerContext
  ): Promise<void> {
    try {
      const configService = getUnifiedConfigurationService();
      log('⚙️ [UpdateSettings] Updating settings via UnifiedConfigurationService:', settings);

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

      log('✅ [UpdateSettings] Settings updated successfully');
      showSuccess('Settings updated successfully');

      // Reinitialize terminal with new settings
      const provider = (context as any).provider;
      if (provider && provider._initializeTerminal) {
        await provider._initializeTerminal();
      }
    } catch (error) {
      log('❌ [UpdateSettings] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
      throw error;
    }
  }
}
