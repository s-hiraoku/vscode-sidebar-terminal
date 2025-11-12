/**
 * Extension Terminal Input Handler
 *
 * Handles terminal input messages from WebView (Extension-side).
 */

import { WebviewMessage } from '../../types/common';
import {
  BaseExtensionMessageHandler,
  IExtensionMessageHandlerContext,
  ExtensionMessagePriority,
} from '../ExtensionMessageDispatcher';
import { TERMINAL_CONSTANTS } from '../../constants';

export class ExtensionTerminalInputHandler extends BaseExtensionMessageHandler {
  constructor() {
    super([TERMINAL_CONSTANTS.COMMANDS.INPUT, 'input'], ExtensionMessagePriority.HIGH);
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const data = message.data as string;
    const terminalId = message.terminalId as string;

    if (!data) {
      this.log('No input data provided');
      return;
    }

    this.log(`Terminal input: ${data.length} chars, terminalId: ${terminalId || 'default'}`);

    // Send input to terminal
    context.terminalManager.sendInput(terminalId, data);
  }
}
