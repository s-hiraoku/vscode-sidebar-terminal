/**
 * Serialization Handler
 *
 * Handles terminal serialization responses from WebView.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

export class SerializationHandler extends BaseMessageHandler {
  constructor() {
    super(
      ['terminalSerializationResponse', 'terminalSerializationRestoreResponse'],
      MessagePriority.HIGH
    );
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing serialization message: ${message.command}`);

    try {
      switch (message.command) {
        case 'terminalSerializationResponse':
          await this.handleSerializationResponse(message, context);
          break;
        case 'terminalSerializationRestoreResponse':
          await this.handleSerializationRestoreResponse(message, context);
          break;
        default:
          context.logger.warn(`Unhandled serialization command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle serialization response from WebView
   */
  private async handleSerializationResponse(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Terminal serialization response received');

    const serializationData = (message as any).serializationData || {};
    const error = (message as any).error;

    if (error) {
      context.logger.error(`Serialization error: ${error}`);
    } else {
      context.logger.info(
        `Received serialization data for ${Object.keys(serializationData).length} terminals`
      );
    }

    // Forward to extension (StandardTerminalSessionManager handles it)
    await context.postMessage({
      command: 'terminalSerializationResponse',
      serializationData,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle serialization restore response from WebView
   */
  private async handleSerializationRestoreResponse(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Terminal serialization restore response received');

    const restoredCount = (message as any).restoredCount || 0;
    const totalCount = (message as any).totalCount || 0;
    const error = (message as any).error;

    if (error) {
      context.logger.error(`Restore error: ${error}`);
    } else {
      context.logger.info(`Restored ${restoredCount}/${totalCount} terminals`);
    }

    // Forward to extension
    await context.postMessage({
      command: 'terminalSerializationRestoreResponse',
      restoredCount,
      totalCount,
      error,
      timestamp: Date.now(),
    });
  }
}
