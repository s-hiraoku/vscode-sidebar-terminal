/**
 * Extension Terminal Creation Handler
 *
 * Handles terminal creation and split requests from WebView (Extension-side).
 */

import { WebviewMessage } from '../../types/common';
import {
  BaseExtensionMessageHandler,
  IExtensionMessageHandlerContext,
  ExtensionMessagePriority,
} from '../ExtensionMessageDispatcher';
import { TERMINAL_CONSTANTS } from '../../constants';

export class ExtensionTerminalCreationHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(
      [
        'createTerminal',
        TERMINAL_CONSTANTS.COMMANDS.CREATE_TERMINAL,
        'splitTerminal',
        'requestInitialTerminal',
      ],
      ExtensionMessagePriority.HIGH
    );
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    switch (message.command) {
      case 'createTerminal':
      case TERMINAL_CONSTANTS.COMMANDS.CREATE_TERMINAL:
        await this.handleCreateTerminal(message, context);
        break;
      case 'splitTerminal':
        await this.handleSplitTerminal(message, context);
        break;
      case 'requestInitialTerminal':
        await this.handleRequestInitialTerminal(message, context);
        break;
    }
  }

  private async handleCreateTerminal(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    this.log('Creating new terminal from webview...');

    try {
      const newTerminalId = context.terminalManager.createTerminal();
      if (newTerminalId) {
        this.log(`Terminal created from webview: ${newTerminalId}`);

        const terminalInstance = context.terminalManager.getTerminalById(newTerminalId);
        if (terminalInstance) {
          this.log(
            `Mapped Extension ID ${newTerminalId} → WebView ID ${message.terminalId || newTerminalId}`
          );
        }
      } else {
        this.log(`Terminal ${message.terminalId} already exists, skipping creation`);
      }
    } catch (error) {
      this.logError('Failed to create PTY terminal', error);
    }
  }

  private async handleSplitTerminal(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    this.log('Splitting terminal from webview...');

    try {
      const newTerminalId = context.terminalManager.createTerminal();
      this.log(`Split terminal created: ${newTerminalId}`);
    } catch (error) {
      this.logError('Failed to split terminal', error);
    }
  }

  private async handleRequestInitialTerminal(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    this.log('WebView requested initial terminal creation');

    try {
      if (context.terminalManager.getTerminals().length === 0) {
        const terminalId = context.terminalManager.createTerminal();
        this.log(`Initial terminal created: ${terminalId}`);
        context.terminalManager.setActiveTerminal(terminalId);

        // Send terminal update to WebView
        await context.sendMessage({
          command: 'stateUpdate',
          state: context.terminalManager.getCurrentState(),
        });
      } else {
        this.log(
          `Terminals already exist (${context.terminalManager.getTerminals().length}), skipping creation`
        );
      }
    } catch (error) {
      this.logError('Failed to create requested initial terminal', error);
    }
  }
}
