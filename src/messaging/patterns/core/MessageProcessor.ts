/**
 * Message Processor
 *
 * Facade that coordinates all message handling components.
 * Provides a single, simplified interface for message processing.
 *
 * This is the main entry point that consolidates:
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
import {
  IMessageHandler,
  IMessageHandlerContext,
  IMessageHandlerResult,
} from './IMessageHandler';
import { MessageHandlerRegistry, IRegistryStats, IDispatchOptions } from './MessageHandlerRegistry';
import { MessageLogger, LogLevel, createMessageLogger } from './MessageLogger';
import { MessageValidator, createMessageValidator } from './MessageValidator';

/**
 * Message processor configuration
 */
export interface IMessageProcessorConfig {
  /** Coordinator for accessing terminal state */
  coordinator?: IManagerCoordinator;

  /** Whether to validate messages before processing */
  enableValidation?: boolean;

  /** Whether to log message processing */
  enableLogging?: boolean;

  /** Minimum log level */
  logLevel?: LogLevel;

  /** Timeout for handler execution in milliseconds */
  handlerTimeout?: number;

  /** Custom logger instance */
  logger?: MessageLogger;

  /** Custom validator instance */
  validator?: MessageValidator;
}

/**
 * Processor statistics
 */
export interface IProcessorStats extends IRegistryStats {
  readonly isInitialized: boolean;
  readonly registeredCommands: string[];
}

/**
 * Message processor facade
 */
export class MessageProcessor {
  private readonly logger: MessageLogger;
  private readonly validator: MessageValidator;
  private readonly registry: MessageHandlerRegistry;
  private coordinator?: IManagerCoordinator;
  private readonly config: Required<Omit<IMessageProcessorConfig, 'coordinator' | 'logger' | 'validator'>>;
  private initialized = false;

  constructor(config: IMessageProcessorConfig = {}) {
    // Initialize logger
    this.logger = config.logger || createMessageLogger({
      minLevel: config.logLevel ?? LogLevel.INFO,
    });

    // Initialize validator
    this.validator = config.validator || createMessageValidator();

    // Initialize registry
    this.registry = new MessageHandlerRegistry(this.logger, this.validator);

    // Store coordinator
    this.coordinator = config.coordinator;

    // Store configuration
    this.config = {
      enableValidation: config.enableValidation ?? true,
      enableLogging: config.enableLogging ?? true,
      logLevel: config.logLevel ?? LogLevel.INFO,
      handlerTimeout: config.handlerTimeout ?? 30000, // 30 seconds default
    };

    this.logger.info('MessageProcessor', 'Message processor created');
  }

  /**
   * Initialize the processor
   */
  public async initialize(coordinator?: IManagerCoordinator): Promise<void> {
    if (this.initialized) {
      this.logger.warn('MessageProcessor', 'Already initialized');
      return;
    }

    if (coordinator) {
      this.coordinator = coordinator;
    }

    this.initialized = true;
    this.logger.info('MessageProcessor', 'Message processor initialized');
  }

  /**
   * Register a message handler
   */
  public registerHandler(handler: IMessageHandler): void {
    this.registry.register(handler);
  }

  /**
   * Register multiple handlers at once
   */
  public registerHandlers(handlers: IMessageHandler[]): void {
    for (const handler of handlers) {
      this.registry.register(handler);
    }
  }

  /**
   * Unregister a message handler
   */
  public unregisterHandler(handler: IMessageHandler): void {
    this.registry.unregister(handler);
  }

  /**
   * Process a message
   */
  public async processMessage(message: WebviewMessage): Promise<IMessageHandlerResult> {
    if (!this.initialized) {
      this.logger.warn('MessageProcessor', 'Processor not initialized');
      return {
        success: false,
        handledBy: 'none',
        processingTime: 0,
        error: 'Processor not initialized',
      };
    }

    // Create handler context
    const context: IMessageHandlerContext = {
      coordinator: this.coordinator,
      logger: {
        debug: (msg, data) => this.logger.debug('MessageHandler', msg, data),
        info: (msg, data) => this.logger.info('MessageHandler', msg, data),
        warn: (msg, data) => this.logger.warn('MessageHandler', msg, data),
        error: (msg, err) => this.logger.error('MessageHandler', msg, err),
      },
      postMessage: this.coordinator
        ? (msg) => this.coordinator!.postMessageToExtension(msg)
        : undefined,
      metadata: {},
    };

    // Dispatch options
    const options: IDispatchOptions = {
      validate: this.config.enableValidation,
      enableLogging: this.config.enableLogging,
      timeout: this.config.handlerTimeout,
    };

    // Dispatch to registry
    return await this.registry.dispatch(message, context, options);
  }

  /**
   * Process multiple messages in batch
   */
  public async processMessages(messages: WebviewMessage[]): Promise<IMessageHandlerResult[]> {
    return Promise.all(messages.map((msg) => this.processMessage(msg)));
  }

  /**
   * Check if a command has a registered handler
   */
  public hasHandler(command: string): boolean {
    return this.registry.hasHandler(command);
  }

  /**
   * Get all registered commands
   */
  public getRegisteredCommands(): string[] {
    return this.registry.getRegisteredCommands();
  }

  /**
   * Get handlers for a specific command
   */
  public getHandlersForCommand(command: string): readonly IMessageHandler[] {
    return this.registry.getHandlersForCommand(command);
  }

  /**
   * Get processor statistics
   */
  public getStats(): IProcessorStats {
    const registryStats = this.registry.getStats();
    return {
      ...registryStats,
      isInitialized: this.initialized,
      registeredCommands: this.getRegisteredCommands(),
    };
  }

  /**
   * Set coordinator (for late binding)
   */
  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    this.logger.info('MessageProcessor', 'Coordinator set');
  }

  /**
   * Get the logger instance
   */
  public getLogger(): MessageLogger {
    return this.logger;
  }

  /**
   * Get the validator instance
   */
  public getValidator(): MessageValidator {
    return this.validator;
  }

  /**
   * Get the registry instance
   */
  public getRegistry(): MessageHandlerRegistry {
    return this.registry;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<IMessageProcessorConfig>): void {
    if (config.coordinator !== undefined) {
      this.coordinator = config.coordinator;
    }

    if (config.enableValidation !== undefined) {
      this.config.enableValidation = config.enableValidation;
    }

    if (config.enableLogging !== undefined) {
      this.config.enableLogging = config.enableLogging;
    }

    if (config.logLevel !== undefined) {
      this.config.logLevel = config.logLevel;
      this.logger.setMinLevel(config.logLevel);
    }

    if (config.handlerTimeout !== undefined) {
      this.config.handlerTimeout = config.handlerTimeout;
    }

    this.logger.info('MessageProcessor', 'Configuration updated', config);
  }

  /**
   * Clear all handlers
   */
  public clearHandlers(): void {
    this.registry.clear();
    this.logger.info('MessageProcessor', 'All handlers cleared');
  }

  /**
   * Reset the processor to initial state
   */
  public reset(): void {
    this.clearHandlers();
    this.initialized = false;
    this.coordinator = undefined;
    this.logger.info('MessageProcessor', 'Processor reset');
  }

  /**
   * Dispose the processor and clean up resources
   */
  public dispose(): void {
    this.registry.dispose();
    this.initialized = false;
    this.coordinator = undefined;
    this.logger.info('MessageProcessor', 'Processor disposed');
  }
}

/**
 * Create a pre-configured message processor
 */
export function createMessageProcessor(config?: IMessageProcessorConfig): MessageProcessor {
  return new MessageProcessor(config);
}
