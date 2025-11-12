/**
 * Base Message Handler
 *
 * Abstract base class for all unified message handlers.
 * Provides common functionality and enforces consistent patterns.
 *
 * NOTE: This class now supports the standardized Result pattern for error handling.
 * New handlers should use handleWithResult() and related Result-based methods.
 */

import { WebviewMessage } from '../../types/common';
import {
  IUnifiedMessageHandler,
  IMessageHandlerContext,
  MessagePriority,
} from '../UnifiedMessageDispatcher';
import {
  Result,
  success,
  failure,
  ErrorDetail,
  ErrorCode,
  isSuccess,
  onFailure
} from '../../types/Result';

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
   * Handle errors consistently (legacy - throws exception)
   * @deprecated Use createErrorResult() instead for Result-based error handling
   */
  protected handleError(context: IMessageHandlerContext, command: string, error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(
      `[${this.constructor.name}] Error handling ${command}: ${errorMessage}`,
      error
    );
    throw new Error(`Handler ${this.constructor.name} failed: ${errorMessage}`);
  }

  // =============================================================================
  // Result Pattern Methods
  // =============================================================================

  /**
   * Optional method for handlers that support Result-based error handling
   * Subclasses can implement this for explicit, type-safe error handling
   */
  handleWithResult?(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<Result<void, ErrorDetail>>;

  /**
   * Validate message with Result pattern
   * Returns success if valid, failure with details if invalid
   */
  protected validateMessageWithResult(
    message: WebviewMessage,
    requiredProps: string[]
  ): Result<void, ErrorDetail> {
    for (const prop of requiredProps) {
      if (!(prop in message) || (message as any)[prop] === undefined) {
        return failure({
          code: ErrorCode.MESSAGE_INVALID,
          message: `Missing required property: ${prop}`,
          context: {
            command: message.command,
            missingProperty: prop,
            handler: this.constructor.name
          },
          recoverable: false
        });
      }
    }
    return success(undefined);
  }

  /**
   * Create an error result with consistent formatting
   */
  protected createErrorResult(
    context: IMessageHandlerContext,
    command: string,
    error: unknown,
    errorCode: ErrorCode = ErrorCode.MESSAGE_PROCESSING_FAILED
  ): Failure<ErrorDetail> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    context.logger.error(
      `[${this.constructor.name}] Error handling ${command}: ${errorMessage}`,
      error
    );

    return failure({
      code: errorCode,
      message: errorMessage,
      context: {
        command,
        handler: this.constructor.name
      },
      cause,
      recoverable: errorCode !== ErrorCode.RESOURCE_EXHAUSTED
    });
  }

  /**
   * Execute a handler operation with automatic error handling
   * Wraps the operation in try-catch and returns a Result
   */
  protected async executeWithResult<T>(
    context: IMessageHandlerContext,
    command: string,
    operation: () => Promise<T>
  ): Promise<Result<T, ErrorDetail>> {
    try {
      const value = await operation();
      return success(value);
    } catch (error) {
      return this.createErrorResult(context, command, error);
    }
  }

  /**
   * Log and handle a Result failure
   */
  protected logFailure(
    context: IMessageHandlerContext,
    result: Result<unknown, ErrorDetail>
  ): void {
    onFailure(result, (error) => {
      context.logger.error(
        `[${this.constructor.name}] Operation failed: ${error.message}`,
        error
      );
    });
  }
}

// Type import for Failure
import type { Failure } from '../../types/Result';
