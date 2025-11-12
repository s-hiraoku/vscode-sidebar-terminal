import { IMessageHandler, IMessageHandlerContext } from './interfaces';
import { WebviewMessage } from '../../types/common';
import { provider as log } from '../../utils/logger';

// Import all message handlers
import { WebViewReadyHandler } from './messageHandlers/WebViewReadyHandler';
import { TerminalInputHandler } from './messageHandlers/TerminalInputHandler';
import { TerminalResizeHandler } from './messageHandlers/TerminalResizeHandler';
import { FocusTerminalHandler } from './messageHandlers/FocusTerminalHandler';
import { GetSettingsHandler } from './messageHandlers/GetSettingsHandler';
import { UpdateSettingsHandler } from './messageHandlers/UpdateSettingsHandler';
import { CreateTerminalHandler } from './messageHandlers/CreateTerminalHandler';
import { DeleteTerminalHandler } from './messageHandlers/DeleteTerminalHandler';
import { KillTerminalHandler } from './messageHandlers/KillTerminalHandler';
import { TerminalClosedHandler } from './messageHandlers/TerminalClosedHandler';
import { RequestInitialTerminalHandler } from './messageHandlers/RequestInitialTerminalHandler';
import { SplitTerminalHandler } from './messageHandlers/SplitTerminalHandler';
import { PanelLocationHandler } from './messageHandlers/PanelLocationHandler';
import { TestMessageHandler } from './messageHandlers/TestMessageHandler';
import { ProfileMessageHandler } from './handlers/ProfileMessageHandler';

/**
 * Service that manages all WebView message handling using the Command pattern
 *
 * This service replaces the massive switch statement in SecondaryTerminalProvider
 * with a modular, testable, and extensible handler system.
 */

export class WebViewMessageHandlerService {
  private readonly handlers: IMessageHandler[] = [];

  constructor() {
    this.initializeHandlers();
  }

  /**
   * Initialize all message handlers
   */
  private initializeHandlers(): void {
    this.handlers.push(
      // Initialization handlers
      new WebViewReadyHandler(),

      // Terminal operation handlers
      new TerminalInputHandler(),
      new TerminalResizeHandler(),
      new FocusTerminalHandler(),
      new CreateTerminalHandler(),
      new DeleteTerminalHandler(),
      new KillTerminalHandler(),
      new TerminalClosedHandler(),
      new RequestInitialTerminalHandler(),
      new SplitTerminalHandler(),

      // Settings handlers
      new GetSettingsHandler(),
      new UpdateSettingsHandler(),

      // Panel location handler
      new PanelLocationHandler(),

      // Profile handler
      new ProfileMessageHandler(),

      // Test/Debug handlers
      new TestMessageHandler()

      // Note: Persistence handlers are managed separately via PersistenceMessageHandler
      // Note: CliAgent handlers may be added in the future
    );

    log(`📨 [MessageHandler] Initialized ${this.handlers.length} message handlers`);
  }

  /**
   * Handle a message from WebView by finding the appropriate handler
   */
  async handleMessage(message: WebviewMessage, context: IMessageHandlerContext): Promise<boolean> {
    // Validate message
    if (!this.isValidMessage(message)) {
      log('⚠️ [MessageHandler] Invalid message received, ignoring');
      return false;
    }

    log(`📨 [MessageHandler] Processing message: ${message.command}`);

    // Find handler for this message
    const handler = this.findHandler(message);

    if (!handler) {
      log(`⚠️ [MessageHandler] No handler found for command: ${message.command}`);
      return false;
    }

    try {
      // Handle the message
      await handler.handle(message, context);
      log(`✅ [MessageHandler] Successfully processed: ${message.command}`);
      return true;
    } catch (error) {
      log(`❌ [MessageHandler] Error processing ${message.command}:`, error);

      // Import and use error handler
      try {
        const { TerminalErrorHandler } = await import('../../utils/feedback');
        TerminalErrorHandler.handleWebviewError(error);
      } catch (importError) {
        console.error('Failed to import TerminalErrorHandler:', importError);
      }

      return false;
    }
  }

  /**
   * Find the appropriate handler for a message
   */
  private findHandler(message: WebviewMessage): IMessageHandler | undefined {
    return this.handlers.find((handler) => handler.canHandle(message));
  }

  /**
   * Validate incoming message
   */
  private isValidMessage(message: unknown): message is WebviewMessage {
    return !!(
      message &&
      typeof message === 'object' &&
      typeof (message as any).command === 'string' &&
      (message as any).command.length > 0
    );
  }

  /**
   * Get list of supported commands for debugging
   */
  getSupportedCommands(): string[] {
    const commands: string[] = [];

    for (const handler of this.handlers) {
      // Access protected property through type assertion
      const supportedCommands = (handler as any).supportedCommands;
      if (Array.isArray(supportedCommands)) {
        commands.push(...supportedCommands);
      }
    }

    return [...new Set(commands)]; // Remove duplicates
  }

  /**
   * Get number of registered handlers
   */
  getHandlerCount(): number {
    return this.handlers.length;
  }
}
