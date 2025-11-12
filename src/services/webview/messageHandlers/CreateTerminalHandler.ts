import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';
import { TERMINAL_CONSTANTS } from '../../../constants';

/**
 * Handles terminal creation requests from WebView
 */
export class CreateTerminalHandler extends BaseMessageHandler {
  protected readonly supportedCommands = [
    'createTerminal',
    TERMINAL_CONSTANTS?.COMMANDS?.CREATE_TERMINAL || '',
  ].filter((cmd) => cmd.length > 0);

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'CreateTerminal');

    const terminalId = (message as any).terminalId;
    const terminalName = (message as any).terminalName;

    if (!terminalId || !terminalName) {
      log('⚠️ [CreateTerminal] Missing terminalId or terminalName');
      return;
    }

    try {
      log(
        '🚀 [CreateTerminal] Creating terminal from WebView request:',
        terminalId,
        terminalName
      );

      // Check if terminal already exists
      const existingTerminal = context.terminalManager.getTerminal(terminalId);
      if (existingTerminal) {
        log(`⚠️ [CreateTerminal] Terminal ${terminalId} already exists, skipping creation`);
        return;
      }

      // Create new terminal
      const newTerminalId = context.terminalManager.createTerminal();
      log(`✅ [CreateTerminal] PTY terminal created: ${newTerminalId}`);

      // Map Extension ID to WebView ID
      const terminalInstance = context.terminalManager.getTerminal(newTerminalId);
      if (terminalInstance && context.terminalIdMapping) {
        context.terminalIdMapping.set(newTerminalId, terminalId);
        log(`🔗 [CreateTerminal] Mapped Extension ID ${newTerminalId} → WebView ID ${terminalId}`);
      } else if (!terminalInstance) {
        log(`❌ [CreateTerminal] Failed to get terminal instance for ${newTerminalId}`);
      }
    } catch (error) {
      await this.handleError(error, message, 'CreateTerminal');
    }
  }
}
