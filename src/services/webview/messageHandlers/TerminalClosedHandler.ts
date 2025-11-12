import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';

/**
 * Handles terminal closed notifications from WebView
 */
export class TerminalClosedHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['terminalClosed'];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'TerminalClosed');

    const terminalId = (message as any).terminalId;
    if (!terminalId) {
      log('⚠️ [TerminalClosed] No terminalId provided');
      return;
    }

    try {
      log(`🗑️ [TerminalClosed] Terminal closed from webview: ${terminalId}`);

      // Check if terminal still exists before removing
      const terminal = context.terminalManager.getTerminal(terminalId);
      if (terminal) {
        log(`🗑️ [TerminalClosed] Removing terminal from manager: ${terminalId}`);
        await context.terminalManager.deleteTerminal(terminalId);
        log(`✅ [TerminalClosed] Terminal removed: ${terminalId}`);
      } else {
        log(`⚠️ [TerminalClosed] Terminal ${terminalId} not found in manager, already removed`);
      }
    } catch (error) {
      await this.handleError(error, message, 'TerminalClosed');
    }
  }
}
