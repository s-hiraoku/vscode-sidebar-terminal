/**
 * Message Handler Interface
 *
 * Standard interface for all message handlers implementing Command pattern.
 * This is the foundation for consolidating message handling across:
 * - ConsolidatedMessageManager
 * - SecondaryTerminalMessageRouter
 * - MessageRouter
 * - UnifiedMessageDispatcher
 * - ConsolidatedMessageService
 *
 * Related to: GitHub Issue #219
 */

import { WebviewMessage } from '../../../types/common';
import { IManagerCoordinator } from '../../../webview/interfaces/ManagerInterfaces';

/**
 * Message handling context providing necessary dependencies
 */
export interface IMessageHandlerContext {
  /** Coordinator for accessing terminal instances and state */
  readonly coordinator?: IManagerCoordinator;

  /** Logger instance for consistent logging */
  readonly logger: {
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, error?: unknown): void;
  };

  /** Optional message posting function */
  readonly postMessage?: (message: unknown) => void;

  /** Additional context data */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result of message handling operation
 */
export interface IMessageHandlerResult {
  /** Whether the message was successfully handled */
  readonly success: boolean;

  /** Name of the handler that processed the message */
  readonly handledBy: string;

  /** Processing time in milliseconds */
  readonly processingTime: number;

  /** Error message if handling failed */
  readonly error?: string;

  /** Optional data returned by the handler */
  readonly data?: unknown;
}

/**
 * Standard message handler interface
 * Implements Command pattern for message processing
 */
export interface IMessageHandler {
  /**
   * Get the unique name of this handler
   */
  getName(): string;

  /**
   * Get the list of commands this handler supports
   */
  getSupportedCommands(): readonly string[];

  /**
   * Get the priority of this handler (higher = processed first)
   * Default priority is 50
   */
  getPriority(): number;

  /**
   * Check if this handler can process the given message
   * This allows for more complex matching logic beyond command name
   */
  canHandle(message: WebviewMessage, context: IMessageHandlerContext): boolean;

  /**
   * Handle the message
   * @throws Error if handling fails
   */
  handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;

  /**
   * Cleanup resources when the handler is disposed
   */
  dispose?(): void;
}

/**
 * Base abstract class implementing common handler functionality
 */
export abstract class BaseCommandHandler implements IMessageHandler {
  protected readonly supportedCommands: readonly string[];
  protected readonly priority: number;
  protected readonly handlerName: string;

  constructor(
    handlerName: string,
    supportedCommands: string[],
    priority: number = 50
  ) {
    this.handlerName = handlerName;
    this.supportedCommands = Object.freeze([...supportedCommands]);
    this.priority = priority;
  }

  getName(): string {
    return this.handlerName;
  }

  getSupportedCommands(): readonly string[] {
    return this.supportedCommands;
  }

  getPriority(): number {
    return this.priority;
  }

  canHandle(message: WebviewMessage, _context: IMessageHandlerContext): boolean {
    return this.supportedCommands.includes(message.command);
  }

  abstract handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;

  dispose(): void {
    // Default implementation - override if needed
  }

  /**
   * Validate required message properties
   */
  protected validateRequired(message: WebviewMessage, requiredProps: string[]): void {
    for (const prop of requiredProps) {
      if (!(prop in message) || (message as any)[prop] === undefined) {
        throw new Error(`Missing required property: ${prop}`);
      }
    }
  }

  /**
   * Log handler activity
   */
  protected log(context: IMessageHandlerContext, level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const fullMessage = `[${this.handlerName}] ${message}`;
    context.logger[level](fullMessage, data);
  }
}
