/**
 * Unified Base Message Handler
 *
 * Abstract base class for all message handlers (both Extension and WebView).
 * Provides common functionality and enforces consistent patterns.
 *
 * Unified from:
 * - messaging/handlers/BaseMessageHandler.ts (priority system, generic validation)
 * - services/webview/messageHandlers/BaseMessageHandler.ts (WebView-specific helpers)
 */

import { WebviewMessage } from '../../types/common';
import {
  IUnifiedMessageHandler,
  MessagePriority,
} from '../UnifiedMessageDispatcher';
import { IMessageHandler, IMessageHandlerContext as WebViewContext } from '../../services/webview/interfaces';
import { provider as log } from '../../utils/logger';

// Union type for context to support both Extension and WebView handlers
export type IMessageHandlerContext = WebViewContext | {
  logger: {
    debug: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  };
};

/**
 * Abstract base class for unified message handlers
 * Implements both IUnifiedMessageHandler and IMessageHandler for compatibility
 */
export abstract class BaseMessageHandler implements IUnifiedMessageHandler, IMessageHandler {
  protected readonly priority: number;
  protected readonly supportedCommands: string[];

  constructor(supportedCommands: string[], priority: number = MessagePriority.NORMAL) {
    this.supportedCommands = supportedCommands;
    this.priority = priority;
  }

  /**
   * Check if this handler can process the given message
   */
  canHandle(message: WebviewMessage): boolean {
    return this.supportedCommands.includes(message.command);
  }

  /**
   * Get handler priority
   */
  getPriority(): number {
    return this.priority;
  }

  /**
   * Get supported commands
   */
  getSupportedCommands(): string[] {
    return [...this.supportedCommands]; // Return copy to prevent modification
  }

  /**
   * Abstract method that subclasses must implement
   */
  abstract handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;

  // =============================================================================
  // Generic Validation Methods
  // =============================================================================

  /**
   * Validate required message properties
   */
  protected validateMessage(message: WebviewMessage, requiredProps: string[]): void {
    for (const prop of requiredProps) {
      if (!(prop in message) || (message as any)[prop] === undefined) {
        throw new Error(`Missing required property: ${prop}`);
      }
    }
  }

  // =============================================================================
  // WebView-Specific Type Guards (from services/webview/messageHandlers)
  // =============================================================================

  /**
   * Validate message has terminal ID
   */
  protected hasTerminalId(
    message: WebviewMessage
  ): message is WebviewMessage & { terminalId: string } {
    return (
      typeof (message as any).terminalId === 'string' && (message as any).terminalId.length > 0
    );
  }

  /**
   * Validate message has resize parameters
   */
  protected hasResizeParams(
    message: WebviewMessage
  ): message is WebviewMessage & { cols: number; rows: number } {
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

  // =============================================================================
  // Logging Methods
  // =============================================================================

  /**
   * Log handler activity
   */
  protected logActivity(context: IMessageHandlerContext, message: string, data?: unknown): void {
    if ('logger' in context && context.logger) {
      context.logger.debug(`[${this.constructor.name}] ${message}`, data);
    } else {
      log(`[${this.constructor.name}] ${message}`, data);
    }
  }

  /**
   * Log message handling (WebView-style)
   */
  protected logMessageHandling(message: WebviewMessage, handlerName: string): void {
    log(`📨 [${handlerName}] Processing message: ${message.command}`);
  }

  // =============================================================================
  // Error Handling Methods
  // =============================================================================

  /**
   * Handle errors consistently (throws for control flow)
   */
  protected handleError(context: IMessageHandlerContext, command: string, error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if ('logger' in context && context.logger) {
      context.logger.error(
        `[${this.constructor.name}] Error handling ${command}: ${errorMessage}`,
        error
      );
    } else {
      log(`❌ [${this.constructor.name}] Error handling ${command}: ${errorMessage}`, error);
    }
    throw new Error(`Handler ${this.constructor.name} failed: ${errorMessage}`);
  }

  /**
   * Handle errors in message processing (WebView-style, async)
   */
  protected async handleErrorAsync(
    error: unknown,
    message: WebviewMessage,
    handlerName: string
  ): Promise<void> {
    log(`❌ [${handlerName}] Error handling message ${message.command}:`, error);

    // Import error handler dynamically to avoid circular dependencies
    try {
      const { TerminalErrorHandler } = await import('../../utils/feedback');
      TerminalErrorHandler.handleWebviewError(error);
    } catch (importError) {
      console.error(`Failed to import TerminalErrorHandler:`, importError);
    }
  }
}
