/**
 * Terminal Interaction Handler
 *
 * Handles terminal input, resize, and AI agent switch requests.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';
import { TERMINAL_CONSTANTS } from '../../constants';

export class TerminalInteractionHandler extends BaseMessageHandler {
  constructor() {
    super(
      [
        TERMINAL_CONSTANTS.COMMANDS.INPUT,
        'input',
        TERMINAL_CONSTANTS.COMMANDS.RESIZE,
        'resize',
        'switchAiAgent',
      ],
      MessagePriority.HIGH
    );
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing interaction message: ${message.command}`);

    try {
      switch (message.command) {
        case TERMINAL_CONSTANTS.COMMANDS.INPUT:
        case 'input':
          await this.handleTerminalInput(message, context);
          break;
        case TERMINAL_CONSTANTS.COMMANDS.RESIZE:
        case 'resize':
          await this.handleTerminalResize(message, context);
          break;
        case 'switchAiAgent':
          await this.handleSwitchAiAgent(message, context);
          break;
        default:
          context.logger.warn(`Unhandled interaction command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle terminal input
   */
  private async handleTerminalInput(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const data = message.data as string;
    const terminalId = message.terminalId as string;

    if (!data) {
      context.logger.warn('No input data provided');
      return;
    }

    context.logger.info(
      `Terminal input: ${data.length} chars, terminalId: ${terminalId || 'default'}`
    );

    // Send input to extension via postMessage
    await context.postMessage({
      command: 'input',
      data,
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle terminal resize
   */
  private async handleTerminalResize(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const cols = message.cols as number;
    const rows = message.rows as number;
    const terminalId = message.terminalId as string;

    if (!cols || !rows || cols <= 0 || rows <= 0) {
      context.logger.warn('Invalid resize parameters');
      return;
    }

    context.logger.info(`Terminal resize: ${cols}x${rows}, terminalId: ${terminalId || 'default'}`);

    // Send resize to extension via postMessage
    await context.postMessage({
      command: 'resize',
      cols,
      rows,
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle AI agent switch request (from WebView to Extension)
   */
  private async handleSwitchAiAgent(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;
    const action = message.action as string;
    const forceReconnect = (message as any).forceReconnect as boolean;
    const agentType = (message as any).agentType as string;

    if (!terminalId) {
      context.logger.warn('switchAiAgent: terminalId missing');
      return;
    }

    context.logger.info(
      `Switching AI Agent for terminal: ${terminalId} (action: ${action}, forceReconnect: ${forceReconnect})`
    );

    // Forward to extension
    await context.postMessage({
      command: 'switchAiAgent',
      terminalId,
      action,
      forceReconnect,
      agentType,
      timestamp: Date.now(),
    });
  }
}
