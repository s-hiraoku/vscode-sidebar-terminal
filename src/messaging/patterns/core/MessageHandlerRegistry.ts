/**
 * Message Handler Registry
 *
 * Central registry for message handlers implementing Chain of Responsibility pattern.
 * Provides efficient dispatch with priority-based handler selection.
 *
 * Consolidates routing logic from:
 * - ConsolidatedMessageManager (switch statements)
 * - SecondaryTerminalMessageRouter (Map-based routing)
 * - MessageRouter (handler registry)
 * - UnifiedMessageDispatcher (priority-based dispatch)
 *
 * Related to: GitHub Issue #219
 */

import { WebviewMessage } from '../../../types/common';
import { IMessageHandler, IMessageHandlerContext, IMessageHandlerResult } from './IMessageHandler';
import { MessageLogger } from './MessageLogger';
import { MessageValidator } from './MessageValidator';

/**
 * Handler registration entry
 */
interface IHandlerEntry {
  handler: IMessageHandler;
  commands: Set<string>;
  priority: number;
}

/**
 * Registry statistics
 */
export interface IRegistryStats {
  readonly totalHandlers: number;
  readonly totalCommands: number;
  readonly commandsHandled: number;
  readonly averageProcessingTime: number;
  readonly errorCount: number;
}

/**
 * Dispatch options
 */
export interface IDispatchOptions {
  /** Whether to validate the message before dispatch */
  validate?: boolean;

  /** Whether to log dispatch operations */
  enableLogging?: boolean;

  /** Timeout for handler execution in milliseconds */
  timeout?: number;
}

/**
 * Message handler registry with Chain of Responsibility
 */
export class MessageHandlerRegistry {
  private readonly handlers: IHandlerEntry[] = [];
  private readonly commandMap = new Map<string, IHandlerEntry[]>();
  private readonly logger: MessageLogger;
  private readonly validator: MessageValidator;

  // Statistics
  private commandsHandled = 0;
  private errorCount = 0;
  private processingTimes: number[] = [];

  constructor(logger: MessageLogger, validator: MessageValidator) {
    this.logger = logger;
    this.validator = validator;
  }

  /**
   * Register a message handler
   */
  public register(handler: IMessageHandler): void {
    const entry: IHandlerEntry = {
      handler,
      commands: new Set(handler.getSupportedCommands()),
      priority: handler.getPriority(),
    };

    // Add to handlers list
    this.handlers.push(entry);

    // Sort by priority (descending)
    this.handlers.sort((a, b) => b.priority - a.priority);

    // Add to command map
    for (const command of entry.commands) {
      if (!this.commandMap.has(command)) {
        this.commandMap.set(command, []);
      }
      const commandHandlers = this.commandMap.get(command)!;
      commandHandlers.push(entry);

      // Sort command handlers by priority
      commandHandlers.sort((a, b) => b.priority - a.priority);
    }

    this.logger.info(
      'MessageHandlerRegistry',
      `Registered handler: ${handler.getName()} (priority: ${handler.getPriority()})`,
      { commands: Array.from(entry.commands) }
    );
  }

  /**
   * Unregister a message handler
   */
  public unregister(handler: IMessageHandler): void {
    // Remove from handlers list
    const index = this.handlers.findIndex((e) => e.handler === handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }

    // Remove from command map
    for (const command of handler.getSupportedCommands()) {
      const commandHandlers = this.commandMap.get(command);
      if (commandHandlers) {
        const handlerIndex = commandHandlers.findIndex((e) => e.handler === handler);
        if (handlerIndex !== -1) {
          commandHandlers.splice(handlerIndex, 1);
        }

        // Remove command entry if no handlers left
        if (commandHandlers.length === 0) {
          this.commandMap.delete(command);
        }
      }
    }

    this.logger.info('MessageHandlerRegistry', `Unregistered handler: ${handler.getName()}`);
  }

  /**
   * Dispatch a message to appropriate handler
   * Implements Chain of Responsibility pattern
   */
  public async dispatch(
    message: WebviewMessage,
    context: IMessageHandlerContext,
    options: IDispatchOptions = {}
  ): Promise<IMessageHandlerResult> {
    const startTime = Date.now();
    const enableLogging = options.enableLogging ?? true;

    try {
      // Validate message if requested
      if (options.validate !== false) {
        try {
          this.validator.validate(message);
        } catch (error) {
          this.errorCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (enableLogging) {
            this.logger.logValidationError('MessageHandlerRegistry', message, errorMessage);
          }

          return {
            success: false,
            handledBy: 'none',
            processingTime: Date.now() - startTime,
            error: `Validation failed: ${errorMessage}`,
          };
        }
      }

      if (enableLogging) {
        this.logger.logMessageReceived('MessageHandlerRegistry', message);
      }

      // Find handlers for this command
      const candidateEntries = this.commandMap.get(message.command) || [];

      if (candidateEntries.length === 0) {
        this.errorCount++;
        const processingTime = Date.now() - startTime;

        if (enableLogging) {
          this.logger.warn(
            'MessageHandlerRegistry',
            `No handler registered for command: ${message.command}`
          );
        }

        return {
          success: false,
          handledBy: 'none',
          processingTime,
          error: `No handler found for command: ${message.command}`,
        };
      }

      // Try handlers in priority order (Chain of Responsibility)
      for (const entry of candidateEntries) {
        if (entry.handler.canHandle(message, context)) {
          const handlerName = entry.handler.getName();

          if (enableLogging) {
            this.logger.logHandlingStarted('MessageHandlerRegistry', message, handlerName);
          }

          try {
            // Execute handler with optional timeout
            if (options.timeout) {
              await this.executeWithTimeout(
                () => entry.handler.handle(message, context),
                options.timeout
              );
            } else {
              await entry.handler.handle(message, context);
            }

            const processingTime = Date.now() - startTime;
            this.commandsHandled++;
            this.processingTimes.push(processingTime);

            // Keep only last 1000 processing times
            if (this.processingTimes.length > 1000) {
              this.processingTimes = this.processingTimes.slice(-1000);
            }

            if (enableLogging) {
              this.logger.logHandlingCompleted(
                'MessageHandlerRegistry',
                message,
                handlerName,
                processingTime
              );
            }

            return {
              success: true,
              handledBy: handlerName,
              processingTime,
            };
          } catch (error) {
            this.errorCount++;

            if (enableLogging) {
              this.logger.logHandlingFailed('MessageHandlerRegistry', message, handlerName, error);
            }

            // Continue to next handler in chain
            continue;
          }
        }
      }

      // No handler could process the message
      this.errorCount++;
      const processingTime = Date.now() - startTime;

      if (enableLogging) {
        this.logger.warn(
          'MessageHandlerRegistry',
          `No handler could process command: ${message.command}`
        );
      }

      return {
        success: false,
        handledBy: 'none',
        processingTime,
        error: `No suitable handler found for command: ${message.command}`,
      };
    } catch (error) {
      this.errorCount++;
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (enableLogging) {
        this.logger.error('MessageHandlerRegistry', `Dispatch error: ${errorMessage}`, error);
      }

      return {
        success: false,
        handledBy: 'none',
        processingTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
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
   * Check if a command has registered handlers
   */
  public hasHandler(command: string): boolean {
    const handlers = this.commandMap.get(command);
    return handlers !== undefined && handlers.length > 0;
  }

  /**
   * Get all registered commands
   */
  public getRegisteredCommands(): string[] {
    return Array.from(this.commandMap.keys()).sort();
  }

  /**
   * Get all handlers for a specific command
   */
  public getHandlersForCommand(command: string): readonly IMessageHandler[] {
    const entries = this.commandMap.get(command) || [];
    return entries.map((e) => e.handler);
  }

  /**
   * Get registry statistics
   */
  public getStats(): IRegistryStats {
    const avgTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
        : 0;

    return {
      totalHandlers: this.handlers.length,
      totalCommands: this.commandMap.size,
      commandsHandled: this.commandsHandled,
      averageProcessingTime: Math.round(avgTime * 100) / 100,
      errorCount: this.errorCount,
    };
  }

  /**
   * Clear all handlers
   */
  public clear(): void {
    // Dispose all handlers
    for (const entry of this.handlers) {
      entry.handler.dispose?.();
    }

    this.handlers.length = 0;
    this.commandMap.clear();
    this.commandsHandled = 0;
    this.errorCount = 0;
    this.processingTimes.length = 0;

    this.logger.info('MessageHandlerRegistry', 'All handlers cleared');
  }

  /**
   * Dispose the registry
   */
  public dispose(): void {
    this.clear();
    this.logger.info('MessageHandlerRegistry', 'Registry disposed');
  }
}
