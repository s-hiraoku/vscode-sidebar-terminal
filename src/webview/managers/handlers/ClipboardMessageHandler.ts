/**
 * Clipboard Message Handler
 * Handles clipboard-related messages from the extension
 */

import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { MessageCommand } from '../messageTypes';

export class ClipboardMessageHandler {
  constructor(private readonly logger: ManagerLogger) {}

  private debug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  /**
   * Handle clipboard-related messages
   */
  public handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    switch (msg.command) {
      case 'clipboardContent':
        this.handleClipboardContent(msg, coordinator);
        break;
      default:
        this.logger.warn(`Unknown clipboard command: ${msg.command}`);
    }
  }

  /**
   * Handle clipboard content paste operation
   */
  private handleClipboardContent(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = (msg as { terminalId?: string }).terminalId;
    const text = (msg as { text?: string }).text;

    this.debug('[CLIPBOARD] Received clipboardContent message', {
      terminalId,
      textLength: text?.length,
    });

    if (!terminalId || text === undefined) {
      this.debug('[CLIPBOARD] Invalid clipboardContent message - missing terminalId or text');
      return;
    }

    const terminalInstance = coordinator.getTerminalInstance(terminalId);
    if (!terminalInstance) {
      this.logger.warn(`📋 [CLIPBOARD] Terminal ${terminalId} not found for paste`);
      return;
    }

    this.logger.info(`📋 [CLIPBOARD] Pasting ${text.length} characters to terminal ${terminalId}`);
    terminalInstance.terminal.paste(text);
    this.debug('[CLIPBOARD] Paste completed', { terminalId, textLength: text.length });
  }
}
