/**
 * Extension Terminal Resize Handler
 *
 * Handles terminal resize messages from WebView (Extension-side).
 */

import { WebviewMessage } from '../../types/common';
import {
  BaseExtensionMessageHandler,
  IExtensionMessageHandlerContext,
  ExtensionMessagePriority,
} from '../ExtensionMessageDispatcher';
import { TERMINAL_CONSTANTS } from '../../constants';

export class ExtensionTerminalResizeHandler extends BaseExtensionMessageHandler {
  constructor() {
    super([TERMINAL_CONSTANTS.COMMANDS.RESIZE, 'resize'], ExtensionMessagePriority.HIGH);
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const cols = message.cols as number;
    const rows = message.rows as number;
    const terminalId = message.terminalId as string;

    if (!cols || !rows || cols <= 0 || rows <= 0) {
      this.log('Invalid resize parameters');
      return;
    }

    this.log(`Terminal resize: ${cols}x${rows}, terminalId: ${terminalId || 'default'}`);

    // Resize terminal
    context.terminalManager.resizeTerminal(terminalId, cols, rows);
  }
}
