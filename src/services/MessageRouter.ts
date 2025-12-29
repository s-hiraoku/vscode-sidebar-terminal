/**
 * Message Router Service
 * Simplifies message handling extracted from SecondaryTerminalProvider
 */

import { log } from '../utils/logger';

export interface MessageHandler<TData = unknown, TResponse = unknown> {
  handle(data: TData): Promise<TResponse> | TResponse;
}

export interface MessageRouterConfig {
  readonly enableLogging: boolean;
  readonly enableValidation: boolean;
  readonly timeoutMs: number;
  readonly maxConcurrentHandlers: number;
}

export interface MessageContext<TData = unknown> {
  readonly command: string;
  readonly data: TData;
  readonly timestamp: number;
  readonly id: string;
}

export interface MessageResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly duration: number;
}

/**
 * Central message routing service
 * Handles all message routing with proper error handling and logging
 */
export class MessageRouter {
  private readonly handlers = new Map<string, MessageHandler>();
  private readonly config: MessageRouterConfig;
  private readonly activeHandlers = new Set<string>();
  private messageCounter = 0;
  private disposed = false;

  constructor(config: MessageRouterConfig) {
    this.config = config;
  }

  /**
   * Register a message handler for a specific command
   */
  public registerHandler<TData, TResponse>(
    command: string,
    handler: MessageHandler<TData, TResponse>
  ): void {
    if (this.disposed) {
      this.log(`Cannot register handler for '${command}': MessageRouter is disposed`);
      return;
    }

    if (this.handlers.has(command)) {
      throw new Error(`Handler for command '${command}' is already registered`);
    }

    this.handlers.set(command, handler);
    this.log(`Handler registered for command: ${command}`);
  }

  /**
   * Unregister a message handler
   */
  public unregisterHandler(command: string): boolean {
    if (this.disposed) {
      return false;
    }
    const removed = this.handlers.delete(command);
    if (removed) {
      this.log(`Handler unregistered for command: ${command}`);
    }
    return removed;
  }

  /**
   * Route a message to the appropriate handler
   */
  public async routeMessage<TData = unknown, TResponse = unknown>(
    command: string,
    data?: TData
  ): Promise<MessageResult<TResponse>> {
    const startTime = performance.now();

    if (this.disposed) {
      return this.createErrorResult<TResponse>(
        'MessageRouter is disposed',
        0
      );
    }

    const messageId = `msg-${++this.messageCounter}`;

    this.log(`Routing message: ${command} (${messageId})`);

    // Check if we're at the concurrent handler limit
    if (this.activeHandlers.size >= this.config.maxConcurrentHandlers) {
      return this.createErrorResult<TResponse>(
        `Maximum concurrent handlers reached (${this.config.maxConcurrentHandlers})`,
        performance.now() - startTime
      );
    }

    // Find handler
    const handler = this.handlers.get(command);
    if (!handler) {
      return this.createErrorResult<TResponse>(
        `No handler registered for command: ${command}`,
        performance.now() - startTime
      );
    }

    // Validate data if required
    if (this.config.enableValidation && !this.validateMessageData(command, data)) {
      return this.createErrorResult<TResponse>(
        `Invalid data for command: ${command}`,
        performance.now() - startTime
      );
    }

    this.activeHandlers.add(messageId);

    try {
      // Execute handler with timeout
      const result = await this.executeWithTimeout(
        () => handler.handle(data),
        this.config.timeoutMs
      );

      const duration = performance.now() - startTime;
      this.log(`Message handled successfully: ${command} (${duration.toFixed(2)}ms)`);

      return {
        success: true,
        data: result as TResponse,
        duration,
      } as MessageResult<TResponse>;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log(`Message handling failed: ${command} - ${errorMessage}`);

      return this.createErrorResult<TResponse>(errorMessage, duration);
    } finally {
      this.activeHandlers.delete(messageId);
    }
  }

  /**
   * Get all registered commands
   */
  public getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get active handler count
   */
  public getActiveHandlerCount(): number {
    return this.activeHandlers.size;
  }

  /**
   * Check if a command has a registered handler
   */
  public hasHandler(command: string): boolean {
    return this.handlers.has(command);
  }

  /**
   * Clear all handlers
   */
  public clearHandlers(): void {
    this.handlers.clear();
    this.log('All handlers cleared');
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T> | T, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Handler timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Validate message data
   */
  private validateMessageData(command: string, data: any): boolean {
    // Basic validation - can be extended with more sophisticated validation
    switch (command) {
      case 'createTerminal':
      case 'deleteTerminal':
      case 'killTerminal':
        return typeof data === 'object';

      case 'terminalInput':
        return data && typeof data.terminalId === 'string' && typeof data.input === 'string';

      case 'terminalResize':
        return (
          data &&
          typeof data.terminalId === 'string' &&
          typeof data.cols === 'number' &&
          typeof data.rows === 'number'
        );

      default:
        return true; // Allow unknown commands by default
    }
  }

  /**
   * Create error result
   */
  private createErrorResult<T = unknown>(error: string, duration: number): MessageResult<T> {
    return {
      success: false,
      error,
      duration,
    };
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      log(`[MessageRouter] ${message}`);
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.clearHandlers();
    this.activeHandlers.clear();
    this.disposed = true;
    this.log('Message router disposed');
  }
}

/**
 * Factory for creating message routers
 */
export class MessageRouterFactory {
  public static create(config: Partial<MessageRouterConfig> = {}): MessageRouter {
    const defaultConfig: MessageRouterConfig = {
      enableLogging: true,
      enableValidation: true,
      timeoutMs: 30000, // 30 seconds
      maxConcurrentHandlers: 10,
    };

    return new MessageRouter({ ...defaultConfig, ...config });
  }

  public static createDefault(): MessageRouter {
    return MessageRouterFactory.create();
  }
}

/**
 * Abstract base class for message handlers
 */
export abstract class BaseMessageHandler<TData = any, TResponse = any>
  implements MessageHandler<TData, TResponse>
{
  protected readonly handlerName: string;

  constructor(handlerName: string) {
    this.handlerName = handlerName;
  }

  public abstract handle(data: TData): Promise<TResponse> | TResponse;

  protected log(message: string): void {
    log(`[${this.handlerName}] ${message}`);
  }

  protected validateRequired(data: any, fields: string[]): void {
    for (const field of fields) {
      if (!(field in data) || data[field] === undefined || data[field] === null) {
        throw new Error(`Required field '${field}' is missing or null`);
      }
    }
  }
}
