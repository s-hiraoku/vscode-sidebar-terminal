/**
 * Persistence Handler (WebView Side)
 *
 * Handles terminal persistence messages from WebView.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

export class PersistenceHandler extends BaseMessageHandler {
  constructor() {
    super(
      ['persistenceSaveSession', 'persistenceRestoreSession', 'persistenceClearSession'],
      MessagePriority.NORMAL
    );
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing persistence message: ${message.command}`);

    try {
      switch (message.command) {
        case 'persistenceSaveSession':
          await this.handleSaveSession(message, context);
          break;
        case 'persistenceRestoreSession':
          await this.handleRestoreSession(message, context);
          break;
        case 'persistenceClearSession':
          await this.handleClearSession(message, context);
          break;
        default:
          context.logger.warn(`Unhandled persistence command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle save session request
   */
  private async handleSaveSession(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalData = (message as any).terminalData;

    context.logger.info('Save session request received');

    // Forward to extension
    await context.postMessage({
      command: 'persistenceSaveSession',
      terminalData,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle restore session request
   */
  private async handleRestoreSession(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Restore session request received');

    // Forward to extension
    await context.postMessage({
      command: 'persistenceRestoreSession',
      timestamp: Date.now(),
    });
  }

  /**
   * Handle clear session request
   */
  private async handleClearSession(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Clear session request received');

    // Forward to extension
    await context.postMessage({
      command: 'persistenceClearSession',
      timestamp: Date.now(),
    });
  }
}
