import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';

/**
 * Handles debug and test messages from WebView
 */
export class TestMessageHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['htmlScriptTest', 'timeoutTest', 'test'];

  async handle(message: WebviewMessage, _context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'TestMessage');

    try {
      switch (message.command) {
        case 'htmlScriptTest':
          log('🔥 [TestMessage] ========== HTML INLINE SCRIPT TEST ==========');
          log('🔥 [TestMessage] HTML script communication is working!');
          break;
        case 'timeoutTest':
          log('🔥 [TestMessage] ========== HTML TIMEOUT TEST ==========');
          log('🔥 [TestMessage] Timeout test communication is working!');
          break;
        case 'test':
          log('🔥 [TestMessage] ========== GENERIC TEST MESSAGE ==========');
          log('🔥 [TestMessage] Generic test communication is working!');
          break;
      }
      log('🔥 [TestMessage] Message content:', message);
    } catch (error) {
      await this.handleError(error, message, 'TestMessage');
    }
  }
}
