/**
 * System Message Handler
 *
 * Handles critical system messages including initialization,
 * settings, and state updates.
 */

import { WebviewMessage, TerminalInteractionEvent } from '../../types/common';
import { WebViewFontSettings } from '../../types/shared';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

export class SystemMessageHandler extends BaseMessageHandler {
  constructor() {
    super(
      ['init', 'fontSettingsUpdate', 'settingsResponse', 'stateUpdate'],
      MessagePriority.CRITICAL
    );
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing system message: ${message.command}`);

    try {
      switch (message.command) {
        case 'init':
          await this.handleInitMessage(message, context);
          break;
        case 'fontSettingsUpdate':
          await this.handleFontSettingsUpdate(message, context);
          break;
        case 'settingsResponse':
          await this.handleSettingsResponse(message, context);
          break;
        case 'stateUpdate':
          await this.handleStateUpdate(message, context);
          break;
        default:
          context.logger.warn(`Unhandled system command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle init message from extension
   */
  private async handleInitMessage(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Handling init message');

    try {
      // Request current settings
      await context.postMessage({
        command: 'getSettings',
        timestamp: Date.now(),
      });

      // Emit ready event
      await this.emitTerminalInteractionEvent('webview-ready', '', undefined, context);

      // Send confirmation back to extension
      await context.postMessage({
        command: 'test',
        type: 'initComplete',
        data: 'WebView processed INIT message',
        timestamp: Date.now(),
      });

      context.logger.info('INIT processing completed');
    } catch (error) {
      context.logger.error('Error processing INIT message', error);
    }
  }

  /**
   * Handle font settings update from extension
   */
  private async handleFontSettingsUpdate(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const fontSettings = message.fontSettings as WebViewFontSettings;
    if (fontSettings) {
      context.logger.info('Font settings update received', fontSettings);
      context.coordinator.applyFontSettings(fontSettings);
      await this.emitTerminalInteractionEvent('font-settings-update', '', fontSettings, context);
    }
  }

  /**
   * Handle settings response from extension
   */
  private async handleSettingsResponse(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const settings = message.settings;
    if (settings) {
      context.logger.info('Settings response received');
      await this.emitTerminalInteractionEvent('settings-update', '', settings, context);
    }
  }

  /**
   * Handle state update message
   */
  private async handleStateUpdate(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const state = message.state;
    if (state) {
      context.logger.info('State update received');

      if (
        'updateState' in context.coordinator &&
        typeof context.coordinator.updateState === 'function'
      ) {
        context.coordinator.updateState(state);
      } else {
        context.logger.warn('updateState method not found on coordinator');
      }
    } else {
      context.logger.warn('No state data in stateUpdate message');
    }
  }

  /**
   * Emit terminal interaction event
   */
  private async emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    context: IMessageHandlerContext
  ): Promise<void> {
    try {
      await context.postMessage({
        command: 'terminalInteraction',
        type,
        terminalId,
        data,
        timestamp: Date.now(),
      });
      this.logActivity(context, `Terminal interaction event sent: ${type} for ${terminalId}`);
    } catch (error) {
      context.logger.error('Error emitting terminal interaction event', error);
    }
  }
}
