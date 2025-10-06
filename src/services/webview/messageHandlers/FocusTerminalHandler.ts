import { BaseMessageHandler } from '../../../messaging/handlers/BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';
import { TERMINAL_CONSTANTS } from '../../../constants';

/**
 * Handles terminal focus messages from WebView
 */
export class FocusTerminalHandler extends BaseMessageHandler {
  protected readonly supportedCommands = [
    'focusTerminal',
    TERMINAL_CONSTANTS?.COMMANDS?.FOCUS_TERMINAL || 'focusTerminal',
  ];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'FocusTerminal');

    try {
      if (!this.hasTerminalId(message)) {
        log('❌ [FocusTerminal] No terminal ID provided');
        return;
      }

      log(`🎯 [FocusTerminal] Focusing terminal: ${message.terminalId}`);

      // Get current active terminal for logging
      const currentActive = context.terminalManager.getActiveTerminalId();
      log(`🔍 [FocusTerminal] Current active: ${currentActive} → Requested: ${message.terminalId}`);

      // Set the terminal as active
      context.terminalManager.setActiveTerminal(message.terminalId);

      // Verify the change was successful
      const newActive = context.terminalManager.getActiveTerminalId();

      if (newActive === message.terminalId) {
        log(`✅ [FocusTerminal] Successfully focused terminal: ${message.terminalId}`);
      } else {
        log(
          `❌ [FocusTerminal] Failed to focus terminal. Expected: ${message.terminalId}, Got: ${newActive}`
        );
      }
    } catch (error) {
      await this.handleError(error, message, 'FocusTerminal');
    }
  }
}
