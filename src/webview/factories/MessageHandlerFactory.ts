/**
 * MessageHandlerFactory - Centralized message handling to reduce duplication
 * Factory pattern for creating consistent message handlers across managers
 */

import { webview as log } from '../../utils/logger';
import { ValidationUtils, ValidationResult } from '../utils/ValidationUtils';
import type { WebviewMessage, VsCodeMessage } from '../../types/common';
import type { IManagerCoordinator } from '../interfaces/ManagerInterfaces';

/**
 * Message handler function type
 */
export type MessageHandler<T = unknown> = (
  message: WebviewMessage,
  coordinator: IManagerCoordinator
) => T | Promise<T>;

/**
 * Message handler configuration
 */
export interface MessageHandlerConfig {
  command: string;
  validator?: (message: WebviewMessage) => ValidationResult;
  requiresCoordinator?: boolean;
  async?: boolean;
  logPrefix?: string;
}

/**
 * Message handler registry entry
 */
interface HandlerEntry {
  config: MessageHandlerConfig;
  handler: MessageHandler;
}

/**
 * Centralized factory for creating consistent message handlers
 */
export class MessageHandlerFactory {
  private static handlers = new Map<string, HandlerEntry>();
  private static defaultLogPrefix = '[MESSAGE_HANDLER]';

  /**
   * Register a message handler
   */
  public static registerHandler<T = unknown>(
    config: MessageHandlerConfig,
    handler: MessageHandler<T>
  ): void {
    if (this.handlers.has(config.command)) {
      log(
        `⚠️ ${this.defaultLogPrefix} Handler for command '${config.command}' already exists, overriding`
      );
    }

    this.handlers.set(config.command, {
      config: {
        requiresCoordinator: true,
        async: false,
        logPrefix: this.defaultLogPrefix,
        ...config,
      },
      handler,
    });

    log(`✅ ${this.defaultLogPrefix} Registered handler for command: ${config.command}`);
  }

  /**
   * Create a standardized message processor
   */
  public static createMessageProcessor(
    coordinator?: IManagerCoordinator,
    logPrefix: string = this.defaultLogPrefix
  ): (message: WebviewMessage) => Promise<unknown> {
    return async (message: WebviewMessage) => {
      // Basic message validation
      const basicValidation = this.validateBasicMessage(message);
      if (!basicValidation.isValid) {
        log(`❌ ${logPrefix} ${basicValidation.error}`);
        throw new Error(basicValidation.error);
      }

      const command = message.command as string;
      const entry = this.handlers.get(command);

      if (!entry) {
        log(`⚠️ ${logPrefix} No handler registered for command: ${command}`);
        return this.createDefaultResponse(command, 'No handler registered');
      }

      const { config, handler } = entry;

      try {
        // Validate coordinator requirement
        if (config.requiresCoordinator && !coordinator) {
          throw new Error(`Handler for '${command}' requires coordinator but none provided`);
        }

        // Run custom validation if provided
        if (config.validator) {
          const validation = config.validator(message);
          if (!validation.isValid) {
            throw new Error(validation.error || 'Message validation failed');
          }
        }

        // Execute handler
        log(`🔄 ${config.logPrefix} Processing command: ${command}`);
        const result = config.async
          ? await handler(message, coordinator!)
          : handler(message, coordinator!);

        log(`✅ ${config.logPrefix} Successfully processed command: ${command}`);
        return result;
      } catch (error) {
        const errorMessage = `Handler for '${command}' failed: ${String(error)}`;
        log(`❌ ${config.logPrefix} ${errorMessage}`);

        // Return error response instead of throwing to prevent cascading failures
        return this.createErrorResponse(command, errorMessage);
      }
    };
  }

  /**
   * Create a batch message processor for handling multiple messages
   */
  public static createBatchProcessor(
    coordinator?: IManagerCoordinator,
    logPrefix: string = this.defaultLogPrefix
  ): (messages: WebviewMessage[]) => Promise<unknown[]> {
    const singleProcessor = this.createMessageProcessor(coordinator, logPrefix);

    return async (messages: WebviewMessage[]) => {
      log(`📦 ${logPrefix} Processing batch of ${messages.length} messages`);

      const results = await Promise.allSettled(messages.map((msg) => singleProcessor(msg)));

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - successful;

      log(`📊 ${logPrefix} Batch processing complete: ${successful} successful, ${failed} failed`);

      return results.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : this.createErrorResponse('batch', result.reason)
      );
    };
  }

  /**
   * Create a standardized queue processor
   */
  public static createQueueProcessor(
    coordinator?: IManagerCoordinator,
    options: {
      maxConcurrent?: number;
      retryAttempts?: number;
      retryDelay?: number;
      logPrefix?: string;
    } = {}
  ): {
    process: (message: WebviewMessage) => Promise<unknown>;
    processQueue: () => Promise<void>;
    getQueueSize: () => number;
    clearQueue: () => void;
  } {
    const {
      maxConcurrent = 5,
      retryAttempts = 3,
      retryDelay = 1000,
      logPrefix = this.defaultLogPrefix,
    } = options;

    const queue: Array<{
      message: WebviewMessage;
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      attempts: number;
    }> = [];
    const processor = this.createMessageProcessor(coordinator, logPrefix);
    let processing = false;

    const processQueue = async (): Promise<void> => {
      if (processing || queue.length === 0) return;

      processing = true;
      log(`🔄 ${logPrefix} Processing queue of ${queue.length} messages`);

      const concurrent = Math.min(maxConcurrent, queue.length);
      const batch = queue.splice(0, concurrent);

      await Promise.all(
        batch.map(async (item) => {
          try {
            const result = await processor(item.message);
            item.resolve(result);
          } catch (error) {
            item.attempts--;
            if (item.attempts > 0) {
              log(`🔄 ${logPrefix} Retrying message, ${item.attempts} attempts remaining`);
              setTimeout(() => {
                queue.unshift(item);
                processQueue();
              }, retryDelay);
            } else {
              item.reject(error instanceof Error ? error : new Error(String(error)));
            }
          }
        })
      );

      processing = false;

      // Process remaining queue
      if (queue.length > 0) {
        setTimeout(processQueue, 0);
      }
    };

    return {
      process: (message: WebviewMessage) => {
        return new Promise((resolve, reject) => {
          queue.push({
            message,
            resolve,
            reject,
            attempts: retryAttempts,
          });
          processQueue();
        });
      },
      processQueue,
      getQueueSize: () => queue.length,
      clearQueue: () => {
        queue.length = 0;
        processing = false;
      },
    };
  }

  /**
   * Create common validators
   */
  public static createCommonValidators() {
    return {
      terminalId: (message: WebviewMessage): ValidationResult => {
        return ValidationUtils.validateTerminalId(message.terminalId);
      },

      requiredData: (message: WebviewMessage): ValidationResult => {
        if (!message.data) {
          return { isValid: false, error: 'Message data is required' };
        }
        return { isValid: true, value: message.data };
      },

      settings: (message: WebviewMessage): ValidationResult => {
        return ValidationUtils.validateTerminalSettings(message.settings);
      },

      terminalOutput: (message: WebviewMessage): ValidationResult => {
        const dataValidation = ValidationUtils.sanitizeData(message.data, 1024 * 1024); // 1MB limit
        if (!dataValidation.isValid) {
          return dataValidation;
        }

        if (message.terminalId) {
          const idValidation = ValidationUtils.validateTerminalId(message.terminalId);
          if (!idValidation.isValid) {
            return idValidation;
          }
        }

        return { isValid: true };
      },
    };
  }

  /**
   * Get registered handlers summary
   */
  public static getHandlersSummary(): Array<{ command: string; config: MessageHandlerConfig }> {
    return Array.from(this.handlers.entries()).map(([command, entry]) => ({
      command,
      config: entry.config,
    }));
  }

  /**
   * Clear all registered handlers (useful for testing)
   */
  public static clearHandlers(): void {
    this.handlers.clear();
    log(`🧹 ${this.defaultLogPrefix} Cleared all registered handlers`);
  }

  /**
   * Basic message validation
   */
  private static validateBasicMessage(message: unknown): ValidationResult {
    if (!message || typeof message !== 'object') {
      return { isValid: false, error: 'Message must be an object' };
    }

    const msg = message as Record<string, unknown>;
    if (!msg.command || typeof msg.command !== 'string') {
      return { isValid: false, error: 'Message must have a string command' };
    }

    return { isValid: true };
  }

  /**
   * Create standardized default response
   */
  private static createDefaultResponse(command: string, message: string) {
    return {
      success: false,
      command,
      error: message,
      timestamp: Date.now(),
    };
  }

  /**
   * Create standardized error response
   */
  private static createErrorResponse(command: string, error: string) {
    return {
      success: false,
      command,
      error,
      timestamp: Date.now(),
    };
  }
}
