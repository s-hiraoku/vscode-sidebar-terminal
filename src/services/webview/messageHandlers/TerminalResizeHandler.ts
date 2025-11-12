import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';
import { TERMINAL_CONSTANTS } from '../../../constants';

/**
 * Handles terminal resize messages from WebView
 */
export class TerminalResizeHandler extends BaseMessageHandler {
  protected readonly supportedCommands = [TERMINAL_CONSTANTS.COMMANDS.RESIZE || 'resize'];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'TerminalResize');

    try {
      if (!this.hasResizeParams(message)) {
        log('⚠️ [TerminalResize] Invalid resize parameters');
        return;
      }

      log(
        `📏 [TerminalResize] Resizing terminal: ${message.cols}x${message.rows} (terminal: ${message.terminalId || 'active'})`
      );

      // Resize terminal through terminal manager
      context.terminalManager.resize(message.cols, message.rows, message.terminalId);

      // Log successful resize
      log(`✅ [TerminalResize] Successfully resized terminal to ${message.cols}x${message.rows}`);
    } catch (error) {
      await this.handleError(error, message, 'TerminalResize');
    }
  }
}
