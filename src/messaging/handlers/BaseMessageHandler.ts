/**
 * Base Message Handler
 * 
 * Abstract base class for all unified message handlers.
 * Provides common functionality and enforces consistent patterns.
 */

import { WebviewMessage } from '../../types/common';
import { IUnifiedMessageHandler, IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';

/**
 * Abstract base class for unified message handlers
 */
export abstract class BaseMessageHandler implements IUnifiedMessageHandler {
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

  /**
   * Log handler activity
   */
  protected logActivity(context: IMessageHandlerContext, message: string, data?: unknown): void {
    context.logger.debug(`[${this.constructor.name}] ${message}`, data);
  }

  /**
   * Handle errors consistently
   */
  protected handleError(context: IMessageHandlerContext, command: string, error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(`[${this.constructor.name}] Error handling ${command}: ${errorMessage}`, error);
    throw new Error(`Handler ${this.constructor.name} failed: ${errorMessage}`);
  }
}