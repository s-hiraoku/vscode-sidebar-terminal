/**
 * Terminal Management Handler
 *
 * Handles terminal creation, deletion, and management requests from WebView.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';
import { TERMINAL_CONSTANTS } from '../../constants';

export class TerminalManagementHandler extends BaseMessageHandler {
  constructor() {
    super(
      [
        'createTerminal',
        TERMINAL_CONSTANTS.COMMANDS.CREATE_TERMINAL,
        'splitTerminal',
        'killTerminal',
        'deleteTerminal',
        'terminalClosed',
      ],
      MessagePriority.HIGH
    );
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing terminal management message: ${message.command}`);

    try {
      switch (message.command) {
        case 'createTerminal':
        case TERMINAL_CONSTANTS.COMMANDS.CREATE_TERMINAL:
          await this.handleCreateTerminal(message, context);
          break;
        case 'splitTerminal':
          await this.handleSplitTerminal(message, context);
          break;
        case 'killTerminal':
          await this.handleKillTerminal(message, context);
          break;
        case 'deleteTerminal':
          await this.handleDeleteTerminal(message, context);
          break;
        case 'terminalClosed':
          await this.handleTerminalClosed(message, context);
          break;
        default:
          context.logger.warn(`Unhandled terminal management command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle create terminal request
   */
  private async handleCreateTerminal(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;
    const terminalName = message.terminalName as string;

    context.logger.info(`Create terminal request: ${terminalId} (${terminalName || 'default'})`);

    // Forward to extension
    await context.postMessage({
      command: 'createTerminal',
      terminalId,
      terminalName,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle split terminal request
   */
  private async handleSplitTerminal(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const direction = (message as any).direction;

    context.logger.info(`Split terminal request: direction=${direction || 'default'}`);

    // Forward to extension
    await context.postMessage({
      command: 'splitTerminal',
      direction,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle kill terminal request
   */
  private async handleKillTerminal(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;

    context.logger.info(`Kill terminal request: ${terminalId || 'active terminal'}`);

    // Forward to extension
    await context.postMessage({
      command: 'killTerminal',
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle delete terminal request
   */
  private async handleDeleteTerminal(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;
    const requestSource = (message as any).requestSource as 'header' | 'panel';

    if (!terminalId) {
      context.logger.warn('No terminal ID provided for delete');
      return;
    }

    context.logger.info(`Delete terminal request: ${terminalId} (source: ${requestSource})`);

    // Forward to extension
    await context.postMessage({
      command: 'deleteTerminal',
      terminalId,
      requestSource,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle terminal closed notification from WebView
   */
  private async handleTerminalClosed(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;

    if (!terminalId) {
      context.logger.warn('No terminal ID provided for terminalClosed');
      return;
    }

    context.logger.info(`Terminal closed in WebView: ${terminalId}`);

    // Forward to extension
    await context.postMessage({
      command: 'terminalClosed',
      terminalId,
      timestamp: Date.now(),
    });
  }
}
