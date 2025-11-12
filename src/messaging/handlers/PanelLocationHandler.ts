/**
 * Panel Location Handler
 *
 * Handles panel location reporting from WebView.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

export class PanelLocationHandler extends BaseMessageHandler {
  constructor() {
    super(['reportPanelLocation'], MessagePriority.LOW);
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing panel location message: ${message.command}`);

    try {
      const location = (message as any).location;

      if (!location) {
        context.logger.warn('No location provided in reportPanelLocation message');
        return;
      }

      context.logger.info('Panel location reported from WebView:', location);

      // Forward to extension
      await context.postMessage({
        command: 'reportPanelLocation',
        location,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }
}
