import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';
import { hasDirection } from '../../../types/type-guards';
import { TerminalErrorHandler } from '../../../utils/feedback';

/**
 * Handles terminal split requests
 */
export class SplitTerminalHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['splitTerminal'];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'SplitTerminal');

    try {
      log('🔀 [SplitTerminal] Splitting terminal from webview...');
      const direction = hasDirection(message) ? message.direction : undefined;

      const provider = (context as any).provider;
      if (provider && provider.splitTerminal) {
        if (direction) {
          provider.splitTerminal(direction);
        } else {
          provider.splitTerminal();
        }
        log(`✅ [SplitTerminal] Terminal split successfully, direction: ${direction || 'default'}`);
      } else {
        log('⚠️ [SplitTerminal] Provider.splitTerminal not available');
      }
    } catch (error) {
      log('❌ [SplitTerminal] Failed to split terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
      await this.handleError(error, message, 'SplitTerminal');
    }
  }
}
