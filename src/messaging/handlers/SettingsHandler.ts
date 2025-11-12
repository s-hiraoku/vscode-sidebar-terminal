/**
 * Settings Handler
 *
 * Handles settings retrieval and updates from WebView.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

export class SettingsHandler extends BaseMessageHandler {
  constructor() {
    super(['getSettings', 'updateSettings'], MessagePriority.NORMAL);
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing settings message: ${message.command}`);

    try {
      switch (message.command) {
        case 'getSettings':
          await this.handleGetSettings(message, context);
          break;
        case 'updateSettings':
          await this.handleUpdateSettings(message, context);
          break;
        default:
          context.logger.warn(`Unhandled settings command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle get settings request
   */
  private async handleGetSettings(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Getting settings from WebView');

    // Forward to extension
    await context.postMessage({
      command: 'getSettings',
      timestamp: Date.now(),
    });
  }

  /**
   * Handle update settings request
   */
  private async handleUpdateSettings(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const settings = (message as any).settings;

    if (!settings) {
      context.logger.warn('No settings provided in updateSettings message');
      return;
    }

    context.logger.info('Updating settings from WebView', settings);

    // Forward to extension
    await context.postMessage({
      command: 'updateSettings',
      settings,
      timestamp: Date.now(),
    });
  }
}
