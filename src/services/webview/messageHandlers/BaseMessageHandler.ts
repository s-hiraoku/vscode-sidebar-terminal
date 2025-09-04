import { IMessageHandler, IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';

/**
 * Base class for all message handlers providing common functionality
 */
export abstract class BaseMessageHandler implements IMessageHandler {
  protected abstract readonly supportedCommands: string[];

  /**
   * Check if this handler can handle the given message
   */
  canHandle(message: WebviewMessage): boolean {
    return this.supportedCommands.includes(message.command);
  }

  /**
   * Handle the message - implemented by subclasses
   */
  abstract handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;

  /**
   * Log message handling
   */
  protected logMessageHandling(message: WebviewMessage, handlerName: string): void {
    log(`📨 [${handlerName}] Processing message: ${message.command}`);
  }

  /**
   * Validate message has terminal ID
   */
  protected hasTerminalId(message: WebviewMessage): message is WebviewMessage & { terminalId: string } {
    return typeof (message as any).terminalId === 'string' && (message as any).terminalId.length > 0;
  }

  /**
   * Validate message has resize parameters
   */
  protected hasResizeParams(message: WebviewMessage): message is WebviewMessage & { cols: number; rows: number } {
    const { cols, rows } = message as any;
    return typeof cols === 'number' && typeof rows === 'number' && cols > 0 && rows > 0;
  }

  /**
   * Validate message has input data
   */
  protected hasInputData(message: WebviewMessage): message is WebviewMessage & { data: string } {
    return typeof (message as any).data === 'string' && (message as any).data.length > 0;
  }

  /**
   * Validate message has settings
   */
  protected hasSettings(message: WebviewMessage): message is WebviewMessage & { settings: any } {
    return !!(message as any).settings && typeof (message as any).settings === 'object';
  }

  /**
   * Handle errors in message processing
   */
  protected async handleError(error: unknown, message: WebviewMessage, handlerName: string): Promise<void> {
    log(`❌ [${handlerName}] Error handling message ${message.command}:`, error);
    
    // Import error handler dynamically to avoid circular dependencies
    try {
      const { TerminalErrorHandler } = await import('../../../utils/feedback');
      TerminalErrorHandler.handleWebviewError(error);
    } catch (importError) {
      console.error(`Failed to import TerminalErrorHandler:`, importError);
    }
  }
}