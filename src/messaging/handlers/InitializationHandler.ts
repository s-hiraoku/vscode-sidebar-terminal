/**
 * Initialization Handler
 *
 * Handles WebView initialization and initial terminal creation requests.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';
import { TERMINAL_CONSTANTS } from '../../constants';

export class InitializationHandler extends BaseMessageHandler {
  constructor() {
    super(
      ['webviewReady', TERMINAL_CONSTANTS.COMMANDS.READY, 'requestInitialTerminal'],
      MessagePriority.CRITICAL
    );
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing initialization message: ${message.command}`);

    try {
      switch (message.command) {
        case 'webviewReady':
        case TERMINAL_CONSTANTS.COMMANDS.READY:
          await this.handleWebViewReady(message, context);
          break;
        case 'requestInitialTerminal':
          await this.handleRequestInitialTerminal(message, context);
          break;
        default:
          context.logger.warn(`Unhandled initialization command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle WebView ready message
   */
  private async handleWebViewReady(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('WebView ready - initialization started');

    // Send initialization confirmation to extension
    await context.postMessage({
      command: 'webviewReady',
      timestamp: Date.now(),
    });

    context.logger.info('WebView ready signal sent to extension');
  }

  /**
   * Handle request for initial terminal creation
   */
  private async handleRequestInitialTerminal(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('WebView requested initial terminal creation');

    // Send request to extension
    await context.postMessage({
      command: 'requestInitialTerminal',
      timestamp: Date.now(),
    });

    context.logger.info('Initial terminal request sent to extension');
  }
}
