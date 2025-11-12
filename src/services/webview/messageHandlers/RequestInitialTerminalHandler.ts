import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';

/**
 * Handles requests for initial terminal creation
 */
export class RequestInitialTerminalHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['requestInitialTerminal'];

  async handle(_message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(_message, 'RequestInitialTerminal');

    try {
      log('🚨 [RequestInitialTerminal] WebView requested initial terminal creation');

      if (context.terminalManager.getTerminals().length === 0) {
        log('🎯 [RequestInitialTerminal] Creating initial terminal as requested');
        const terminalId = context.terminalManager.createTerminal();
        log(`✅ [RequestInitialTerminal] Initial terminal created: ${terminalId}`);
        context.terminalManager.setActiveTerminal(terminalId);

        // Send terminal update to WebView
        await context.sendMessage({
          command: 'stateUpdate',
          state: context.terminalManager.getCurrentState(),
        });
      } else {
        log(
          `🔍 [RequestInitialTerminal] Terminals already exist (${context.terminalManager.getTerminals().length}), skipping creation`
        );
      }
    } catch (error) {
      log(`❌ [RequestInitialTerminal] Failed to create initial terminal:`, error);
      await this.handleError(error, _message, 'RequestInitialTerminal');
    }
  }
}
