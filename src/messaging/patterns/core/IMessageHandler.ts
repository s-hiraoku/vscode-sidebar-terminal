/**
 * Message Handler Interfaces
 *
 * Base interfaces and classes for message handler pattern.
 * Provides common functionality for command handlers.
 */

import { WebviewMessage } from '../../../types/common';

/**
 * Context provided to message handlers
 */
export interface IMessageHandlerContext {
  /** Send message to webview */
  postMessage: (message: WebviewMessage) => Promise<boolean>;
  /** Logger function */
  log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: unknown[]) => void;
  /** Additional context data */
  [key: string]: unknown;
}

/**
 * Interface for message handlers
 */
export interface IMessageHandler {
  /** Handler name for identification */
  readonly name: string;
  /** Commands this handler can process */
  readonly supportedCommands: readonly string[];
  /** Priority (higher = processed first) */
  readonly priority: number;
  /** Check if handler can process this message */
  canHandle(message: WebviewMessage): boolean;
  /** Process the message */
  handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;
}

/**
 * Base class for command handlers
 * Provides common functionality like logging and validation
 */
export abstract class BaseCommandHandler implements IMessageHandler {
  public readonly name: string;
  public readonly supportedCommands: readonly string[];
  public readonly priority: number;

  constructor(name: string, supportedCommands: string[], priority: number = 50) {
    this.name = name;
    this.supportedCommands = supportedCommands;
    this.priority = priority;
  }

  /**
   * Check if this handler can process the message
   */
  public canHandle(message: WebviewMessage): boolean {
    return this.supportedCommands.includes(message.command);
  }

  /**
   * Process the message - must be implemented by subclasses
   */
  public abstract handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;

  /**
   * Log a message using the context logger
   */
  protected log(
    context: IMessageHandlerContext,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    ...args: unknown[]
  ): void {
    if (context.log) {
      context.log(level, `[${this.name}] ${message}`, ...args);
    }
  }

  /**
   * Validate required fields in message data
   */
  protected validateRequired<T extends object>(
    data: T | undefined,
    requiredFields: (keyof T)[]
  ): data is T {
    if (!data) {
      return false;
    }
    return requiredFields.every((field) => field in data && data[field] !== undefined);
  }

  /**
   * Send success response
   */
  protected async sendSuccess(
    context: IMessageHandlerContext,
    command: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await context.postMessage({
      command: `${command}Success`,
      ...data,
    });
  }

  /**
   * Send error response
   */
  protected async sendError(
    context: IMessageHandlerContext,
    command: string,
    error: string | Error
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    await context.postMessage({
      command: `${command}Error`,
      error: errorMessage,
    });
  }
}
