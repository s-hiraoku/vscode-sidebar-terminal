import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';
import { TERMINAL_CONSTANTS } from '../../../constants';

/**
 * Handles terminal input messages from WebView
 */
export class TerminalInputHandler extends BaseMessageHandler {
  protected readonly supportedCommands = [
    TERMINAL_CONSTANTS?.COMMANDS?.INPUT || 'input'
  ];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'TerminalInput');

    try {
      if (!this.hasInputData(message)) {
        log('⚠️ [TerminalInput] Invalid input data');
        return;
      }

      log(`⌨️ [TerminalInput] Sending input: ${message.data.length} chars to terminal: ${message.terminalId || 'active'}`);

      // Send input to terminal manager
      context.terminalManager.sendInput(message.data, message.terminalId);

      // Log successful input handling
      log(`✅ [TerminalInput] Successfully sent input to terminal`);

    } catch (error) {
      await this.handleError(error, message, 'TerminalInput');
    }
  }
}