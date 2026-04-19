/**
 * Clipboard Message Handler
 * Handles clipboard-related messages from the extension
 */

import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { MessageCommand } from '../messageTypes';

export class ClipboardMessageHandler {
  constructor(private readonly logger: ManagerLogger) {}

  private debug(message: string, ...args: unknown[]): void {
    const loggerWithDebug = this.logger as ManagerLogger & {
      debug?: (message: string, ...args: unknown[]) => void;
    };

    loggerWithDebug.debug?.(message, ...args);
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
    this.debug('[CLIPBOARD] Received clipboardContent message:', msg);

    const terminalId = (msg as { terminalId?: string }).terminalId;
    const text = (msg as { text?: string }).text;

    this.debug('[CLIPBOARD] terminalId:', terminalId, 'text length:', text?.length);

    if (!terminalId || text === undefined) {
      this.debug('[CLIPBOARD] Invalid clipboardContent message - missing terminalId or text');
      return;
    }

    const terminalInstance = coordinator.getTerminalInstance(terminalId);
    this.debug('[CLIPBOARD] terminalInstance:', terminalInstance);

    if (!terminalInstance) {
      this.logger.warn(`📋 [CLIPBOARD] Terminal ${terminalId} not found for paste`);
      this.debug('[CLIPBOARD] Available terminals:', coordinator.getActiveTerminalId());
      return;
    }

    this.logger.info(`📋 [CLIPBOARD] Pasting ${text.length} characters to terminal ${terminalId}`);
    this.debug(
      '[CLIPBOARD] Calling terminal.paste() with text:',
      text.substring(0, 50) + (text.length > 50 ? '...' : '')
    );

    terminalInstance.terminal.paste(text);
    this.debug('[CLIPBOARD] Paste completed');
  }
}
