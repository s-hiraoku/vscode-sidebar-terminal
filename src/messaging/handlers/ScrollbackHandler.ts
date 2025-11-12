/**
 * Scrollback Handler
 *
 * Handles scrollback data responses from WebView.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

export class ScrollbackHandler extends BaseMessageHandler {
  // Track pending scrollback requests
  private pendingScrollbackRequests = new Map<
    string,
    (data: { terminalId: string; scrollbackContent: string[] }) => void
  >();

  constructor() {
    super(['scrollbackDataCollected', 'scrollbackExtracted'], MessagePriority.HIGH);
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing scrollback message: ${message.command}`);

    try {
      switch (message.command) {
        case 'scrollbackDataCollected':
        case 'scrollbackExtracted':
          await this.handleScrollbackDataResponse(message, context);
          break;
        default:
          context.logger.warn(`Unhandled scrollback command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle scrollback data response from WebView
   */
  private async handleScrollbackDataResponse(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;
    const scrollbackContent = (message as any).scrollbackContent as string[];

    context.logger.info(
      `Scrollback data received for terminal ${terminalId}: ${scrollbackContent?.length || 0} lines`
    );

    if (!terminalId) {
      context.logger.error('No terminal ID in scrollback response');
      return;
    }

    // Resolve pending request if exists
    const resolver = this.pendingScrollbackRequests.get(terminalId);
    if (resolver) {
      resolver({ terminalId, scrollbackContent: scrollbackContent || [] });
      this.pendingScrollbackRequests.delete(terminalId);
      context.logger.info(`Resolved pending scrollback request for terminal ${terminalId}`);
    } else {
      context.logger.warn(`No pending scrollback request for terminal ${terminalId}`);
    }

    // Forward to extension
    await context.postMessage({
      command: 'scrollbackDataCollected',
      terminalId,
      scrollbackContent,
      timestamp: Date.now(),
    });
  }

  /**
   * Register a scrollback request
   */
  public registerScrollbackRequest(
    terminalId: string,
    resolver: (data: { terminalId: string; scrollbackContent: string[] }) => void
  ): void {
    this.pendingScrollbackRequests.set(terminalId, resolver);
  }

  /**
   * Get the scrollback handler instance (for external access)
   */
  public getPendingRequests(): Map<
    string,
    (data: { terminalId: string; scrollbackContent: string[] }) => void
  > {
    return this.pendingScrollbackRequests;
  }
}
