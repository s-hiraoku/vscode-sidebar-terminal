/**
 * Base Message Handler
 *
 * Abstract base class for all message handlers with common patterns and utilities.
 *
 * Provides:
 * - Common validation logic
 * - Standardized error handling using ErrorHandler
 * - Common disposal pattern
 * - Logger integration
 * - Type-safe message handling
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/unify-message-handlers/spec.md
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { MessageQueue } from '../../utils/MessageQueue';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { ErrorHandler } from '../../utils/ErrorHandler';

/**
 * Abstract base class for message handlers
 *
 * Provides common functionality and enforces consistent patterns across all handlers.
 *
 * @example
 * class MyCustomHandler extends BaseMessageHandler {
 *   protected supportedCommands = ['myCommand1', 'myCommand2'];
 *
 *   public async handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): Promise<void> {
 *     const command = this.getCommand(msg);
 *     switch (command) {
 *       case 'myCommand1':
 *         this.handleMyCommand1(msg, coordinator);
 *         break;
 *       default:
 *         this.handleUnknownCommand(command);
 *     }
 *   }
 * }
 */
export abstract class BaseMessageHandler implements IMessageHandler {
  /**
   * List of commands supported by this handler
   * Subclasses must define this
   */
  protected abstract readonly supportedCommands: string[];

  constructor(
    protected readonly messageQueue: MessageQueue,
    protected readonly logger: ManagerLogger
  ) {}

  /**
   * Handle a message command
   * Subclasses must implement this method
   */
  public abstract handleMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void | Promise<void>;

  /**
   * Get the command types that this handler supports
   */
  public getSupportedCommands(): string[] {
    return this.supportedCommands;
  }

  /**
   * Extract command from message
   * Common utility for all handlers
   */
  protected getCommand(msg: MessageCommand): string | undefined {
    return (msg as { command?: string }).command;
  }

  /**
   * Validate message structure
   * Override in subclasses for custom validation
   */
  protected validate(msg: MessageCommand): boolean {
    const command = this.getCommand(msg);
    if (!command) {
      this.logger.warn('Message missing command field');
      return false;
    }

    if (!this.supportedCommands.includes(command)) {
      return false;
    }

    return true;
  }

  /**
   * Handle validation failure
   * Common pattern for all handlers
   */
  protected handleValidationError(msg: MessageCommand): void {
    const command = this.getCommand(msg);
    this.logger.warn(`Validation failed for command: ${command}`);
  }

  /**
   * Handle unknown command
   * Common pattern for all handlers
   */
  protected handleUnknownCommand(command: string | undefined): void {
    this.logger.warn(`Unknown command: ${command}`);
  }

  /**
   * Handle errors with standardized ErrorHandler
   * Common error handling for all handlers
   */
  protected handleError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): void {
    ErrorHandler.handleOperationError(operation, error, {
      severity: 'error',
      context,
      rethrow: false,
    });
  }

  /**
   * Handle errors with warning severity
   * For non-critical errors
   */
  protected handleWarning(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): void {
    ErrorHandler.handleOperationError(operation, error, {
      severity: 'warn',
      context,
      rethrow: false,
    });
  }

  /**
   * Execute operation with error handling
   * Wraps operation in try-catch with standardized error handling
   */
  protected async safeExecute<T>(
    operation: () => T | Promise<T>,
    operationName: string,
    context?: Record<string, unknown>
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, operationName, context);
      return undefined;
    }
  }

  /**
   * Check if property exists on message
   * Type-safe property check
   */
  protected hasProperty<T extends MessageCommand, K extends string>(
    msg: T,
    prop: K
  ): msg is T & Record<K, unknown> {
    return prop in msg;
  }

  /**
   * Extract typed property from message
   * Returns undefined if property doesn't exist
   */
  protected getProperty<T>(msg: MessageCommand, prop: string): T | undefined {
    if (this.hasProperty(msg, prop)) {
      return msg[prop] as T;
    }
    return undefined;
  }

  /**
   * Extract required property from message
   * Logs warning if property is missing
   */
  protected getRequiredProperty<T>(msg: MessageCommand, prop: string): T | undefined {
    const value = this.getProperty<T>(msg, prop);
    if (value === undefined) {
      this.logger.warn(`Required property '${prop}' missing from message`);
    }
    return value;
  }

  /**
   * Clean up resources
   * Override in subclasses if custom cleanup is needed
   */
  public dispose(): void {
    // Default implementation - no cleanup needed
    // Subclasses can override for custom cleanup
  }
}
