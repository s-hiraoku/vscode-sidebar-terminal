import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';

/**
 * Handles terminal deletion requests (with response)
 */
export class DeleteTerminalHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['deleteTerminal'];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'DeleteTerminal');

    if (!this.hasTerminalId(message)) {
      log('❌ [DeleteTerminal] No terminal ID provided');
      return;
    }

    const terminalId = message.terminalId;
    const requestSource = ((message as any).requestSource as 'header' | 'panel') || 'panel';

    try {
      log(`🗑️ [DeleteTerminal] Deleting terminal: ${terminalId}, source: ${requestSource}`);

      const result = await context.terminalManager.deleteTerminal(terminalId, {
        source: requestSource,
      });

      if (result.success) {
        log(`✅ [DeleteTerminal] Terminal deletion succeeded: ${terminalId}`);
        await context.sendMessage({
          command: 'deleteTerminalResponse',
          terminalId,
          success: true,
        });
      } else {
        log(`⚠️ [DeleteTerminal] Terminal deletion failed: ${terminalId}, reason: ${result.reason}`);
        await context.sendMessage({
          command: 'deleteTerminalResponse',
          terminalId,
          success: false,
          reason: result.reason,
        });
      }
    } catch (error) {
      log('❌ [DeleteTerminal] Error during deletion:', error);
      await context.sendMessage({
        command: 'deleteTerminalResponse',
        terminalId,
        success: false,
        reason: `Delete failed: ${String(error)}`,
      });
      await this.handleError(error, message, 'DeleteTerminal');
    }
  }
}
