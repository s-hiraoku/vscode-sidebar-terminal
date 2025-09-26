/**
 * Unified Message Dispatcher
 *
 * Consolidates the three different message handling patterns:
 * - WebViewMessageHandlerService (Command pattern)
 * - RefactoredMessageManager (Queue-based switching)
 * - WebViewMessageRouter (Publisher-subscriber pattern)
 *
 * This provides a single, unified interface that preserves all functionality
 * while eliminating duplication across the 394 message handling occurrences.
 */

import { IManagerLifecycle, IManagerCoordinator } from '../webview/interfaces/ManagerInterfaces';
import { WebviewMessage, TerminalInteractionEvent } from '../types/common';
import { messageLogger } from '../webview/utils/ManagerLogger';
import { MessageQueue, MessageSender } from '../webview/utils/MessageQueue';

// Unified message handler interface combining all patterns
export interface IUnifiedMessageHandler {
  canHandle(message: WebviewMessage): boolean;
  handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;
  getPriority(): number;
  getSupportedCommands(): string[];
}

// Message handler context for dependency injection
export interface IMessageHandlerContext {
  coordinator: IManagerCoordinator;
  postMessage: (message: unknown) => void;
  logger: typeof messageLogger;
}

// Message processing statistics
export interface IMessageStats {
  queueSize: number;
  highPriorityQueueSize: number;
  isProcessing: boolean;
  registeredHandlers: number;
  totalHandlers: number;
  totalMessages: number;
  errorCount: number;
  averageProcessingTime: number;
}

// Message dispatch result
export interface IDispatchResult {
  success: boolean;
  handledBy?: string;
  processingTime: number;
  error?: string;
}

// Priority levels for message handling
export enum MessagePriority {
  CRITICAL = 100, // System messages, errors
  HIGH = 75, // Input, resize operations
  NORMAL = 50, // Output, status updates
  LOW = 25, // Notifications, logging
  BACKGROUND = 0, // Analytics, cleanup
}

/**
 * Unified Message Dispatcher
 *
 * Combines all message handling patterns into a single, efficient system:
 * - Command pattern handler registry
 * - Priority queue processing
 * - Publisher-subscriber routing
 * - Message validation and error handling
 * - Performance metrics and monitoring
 */
export class UnifiedMessageDispatcher implements IManagerLifecycle {
  private readonly logger = messageLogger;
  private readonly handlers = new Map<string, IUnifiedMessageHandler[]>();
  private messageQueue!: MessageQueue;
  private coordinator?: IManagerCoordinator;
  private disposed = false;

  // Performance monitoring
  private totalMessages = 0;
  private errorCount = 0;
  private processingTimes: number[] = [];

  // VS Code API for WebView communication
  private vscodeApi?: any;

  constructor(coordinator?: IManagerCoordinator) {
    this.logger.info('UnifiedMessageDispatcher initializing');

    this.coordinator = coordinator;
    this.setupVsCodeApi();
    this.initializeMessageQueue();

    this.logger.info('UnifiedMessageDispatcher initialized');
  }

  /**
   * Initialize VS Code API for WebView communication
   */
  private setupVsCodeApi(): void {
    if (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) {
      this.vscodeApi = (window as any).acquireVsCodeApi();
      this.logger.info('VS Code API acquired successfully');
    } else {
      this.logger.warn('VS Code API not available - running in test environment');
    }
  }

  /**
   * Initialize message queue with optimized sender
   */
  private initializeMessageQueue(): void {
    const messageSender: MessageSender = (message: unknown) => {
      this.sendToExtension(message);
    };

    this.messageQueue = new MessageQueue(messageSender, {
      maxRetries: 3,
      processingDelay: 1,
      maxQueueSize: 2000, // Increased for high-throughput scenarios
      enablePriority: true,
    });

    this.logger.info('Message queue initialized with priority support');
  }

  /**
   * Send message to Extension Host
   */
  private sendToExtension(message: unknown): void {
    if (this.disposed) {
      this.logger.warn('Cannot send message: dispatcher disposed');
      return;
    }

    try {
      if (this.vscodeApi) {
        this.vscodeApi.postMessage(message);
      } else if (this.coordinator) {
        this.coordinator.postMessageToExtension(message);
      } else {
        throw new Error('No communication channel available');
      }
    } catch (error) {
      this.logger.error('Failed to send message to extension:', error);
      this.errorCount++;
    }
  }

  // =================================================================
  // LIFECYCLE MANAGEMENT
  // =================================================================

  async initialize(coordinator?: IManagerCoordinator): Promise<void> {
    if (coordinator) {
      this.coordinator = coordinator;
    }

    // Setup message listener for incoming messages
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleIncomingMessage.bind(this));
    }

    this.logger.info('UnifiedMessageDispatcher fully initialized');
  }

  dispose(): void {
    if (this.disposed) return;

    this.logger.info('Disposing UnifiedMessageDispatcher');

    this.disposed = true;
    this.messageQueue.dispose();
    this.handlers.clear();
    this.coordinator = undefined;
    this.vscodeApi = null;

    this.logger.info('UnifiedMessageDispatcher disposed');
  }

  // =================================================================
  // HANDLER REGISTRATION (Command Pattern)
  // =================================================================

  /**
   * Register a unified message handler
   */
  registerHandler(handler: IUnifiedMessageHandler): void {
    if (this.disposed) {
      throw new Error('UnifiedMessageDispatcher has been disposed');
    }

    const commands = handler.getSupportedCommands();
    const priority = handler.getPriority();

    for (const command of commands) {
      if (!this.handlers.has(command)) {
        this.handlers.set(command, []);
      }

      const commandHandlers = this.handlers.get(command)!;
      commandHandlers.push(handler);

      // Sort by priority (higher priority first)
      commandHandlers.sort((a, b) => b.getPriority() - a.getPriority());
    }

    this.logger.info(
      `Registered handler for commands: [${commands.join(', ')}] with priority ${priority}`
    );
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(handler: IUnifiedMessageHandler): void {
    const commands = handler.getSupportedCommands();

    for (const command of commands) {
      const commandHandlers = this.handlers.get(command);
      if (commandHandlers) {
        const index = commandHandlers.indexOf(handler);
        if (index !== -1) {
          commandHandlers.splice(index, 1);
        }

        if (commandHandlers.length === 0) {
          this.handlers.delete(command);
        }
      }
    }

    this.logger.info(`Unregistered handler for commands: [${commands.join(', ')}]`);
  }

  // =================================================================
  // MESSAGE PROCESSING (Queue-based + Router Pattern)
  // =================================================================

  /**
   * Handle incoming message from Extension Host
   */
  private async handleIncomingMessage(event: MessageEvent): Promise<void> {
    if (this.disposed || !event.data) return;

    const message = event.data as WebviewMessage;
    await this.processMessage(message);
  }

  /**
   * Process a message through the unified dispatch system
   */
  async processMessage(message: WebviewMessage): Promise<IDispatchResult> {
    if (this.disposed || !this.coordinator) {
      return {
        success: false,
        processingTime: 0,
        error: 'Dispatcher not ready',
      };
    }

    const startTime = Date.now();
    this.totalMessages++;

    try {
      // Validate message
      if (!this.isValidMessage(message)) {
        this.errorCount++;
        return {
          success: false,
          processingTime: Date.now() - startTime,
          error: 'Invalid message format',
        };
      }

      // Create handler context
      const context: IMessageHandlerContext = {
        coordinator: this.coordinator,
        postMessage: this.sendToExtension.bind(this),
        logger: this.logger,
      };

      // Find and execute handler
      const result = await this.dispatchToHandler(message, context);

      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);

      // Keep only last 1000 processing times for average calculation
      if (this.processingTimes.length > 1000) {
        this.processingTimes = this.processingTimes.slice(-1000);
      }

      return {
        success: result.success,
        handledBy: result.handledBy,
        processingTime,
        error: result.error,
      };
    } catch (error) {
      this.errorCount++;
      const processingTime = Date.now() - startTime;

      this.logger.error(`Error processing message ${message.command}:`, error);

      return {
        success: false,
        processingTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Dispatch message to appropriate handler
   */
  private async dispatchToHandler(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<{ success: boolean; handledBy?: string; error?: string }> {
    const handlers = this.handlers.get(message.command);
    if (!handlers || handlers.length === 0) {
      this.logger.warn(`No handler registered for command: ${message.command}`);
      return {
        success: false,
        error: `No handler found for command: ${message.command}`,
      };
    }

    // Try handlers in priority order
    for (const handler of handlers) {
      if (handler.canHandle(message)) {
        try {
          await handler.handle(message, context);
          this.logger.debug(`Message ${message.command} handled by ${handler.constructor.name}`);

          return {
            success: true,
            handledBy: handler.constructor.name,
          };
        } catch (error) {
          this.logger.error(
            `Handler ${handler.constructor.name} failed for ${message.command}:`,
            error
          );
          // Continue to next handler
          continue;
        }
      }
    }

    return {
      success: false,
      error: `No handler could process command: ${message.command}`,
    };
  }

  /**
   * Validate message format
   */
  private isValidMessage(message: unknown): message is WebviewMessage {
    return !!(
      message &&
      typeof message === 'object' &&
      typeof (message as any).command === 'string' &&
      (message as any).command.length > 0
    );
  }

  // =================================================================
  // OUTBOUND MESSAGE API (Unified Interface)
  // =================================================================

  /**
   * Send message with priority support
   */
  async sendMessage(
    message: unknown,
    priority: MessagePriority = MessagePriority.NORMAL
  ): Promise<void> {
    const priorityLevel = this.mapPriorityToQueueLevel(priority);
    await this.messageQueue.enqueue(message, priorityLevel);
  }

  /**
   * Send terminal interaction event
   */
  async sendTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    priority: MessagePriority = MessagePriority.NORMAL
  ): Promise<void> {
    const message = {
      command: 'terminalInteraction',
      type,
      terminalId,
      data,
      timestamp: Date.now(),
    };

    await this.sendMessage(message, priority);
  }

  /**
   * Send input to terminal
   */
  async sendInput(
    input: string,
    terminalId?: string,
    priority: MessagePriority = MessagePriority.HIGH
  ): Promise<void> {
    if (!this.coordinator) {
      throw new Error('Coordinator not available');
    }

    const targetTerminalId = terminalId || this.coordinator.getActiveTerminalId();
    if (!targetTerminalId) {
      throw new Error('No active terminal available for input');
    }

    const message = {
      command: 'input',
      data: input,
      terminalId: targetTerminalId,
      timestamp: Date.now(),
    };

    await this.sendMessage(message, priority);
  }

  /**
   * Send resize command
   */
  async sendResize(
    cols: number,
    rows: number,
    terminalId?: string,
    priority: MessagePriority = MessagePriority.HIGH
  ): Promise<void> {
    if (!this.coordinator) {
      throw new Error('Coordinator not available');
    }

    const message = {
      command: 'resize',
      cols,
      rows,
      terminalId: terminalId || this.coordinator.getActiveTerminalId() || '',
      timestamp: Date.now(),
    };

    await this.sendMessage(message, priority);
  }

  /**
   * Request settings from Extension
   */
  async requestSettings(priority: MessagePriority = MessagePriority.NORMAL): Promise<void> {
    const message = {
      command: 'getSettings',
      timestamp: Date.now(),
    };

    await this.sendMessage(message, priority);
  }

  /**
   * Update settings
   */
  async updateSettings(
    settings: unknown,
    priority: MessagePriority = MessagePriority.NORMAL
  ): Promise<void> {
    const message = {
      command: 'updateSettings',
      settings,
      timestamp: Date.now(),
    };

    await this.sendMessage(message, priority);
  }

  /**
   * Request new terminal creation
   */
  async requestNewTerminal(priority: MessagePriority = MessagePriority.HIGH): Promise<void> {
    const message = {
      command: 'createTerminal',
      timestamp: Date.now(),
    };

    await this.sendMessage(message, priority);
  }

  /**
   * Send delete terminal request
   */
  async sendDeleteTerminalMessage(
    terminalId: string,
    requestSource: 'header' | 'panel',
    priority: MessagePriority = MessagePriority.HIGH
  ): Promise<void> {
    const message = {
      command: 'deleteTerminal',
      terminalId,
      requestSource,
      timestamp: Date.now(),
    };

    await this.sendMessage(message, priority);
  }

  // =================================================================
  // UTILITY AND MONITORING
  // =================================================================

  /**
   * Map MessagePriority to MessageQueue priority level
   */
  private mapPriorityToQueueLevel(priority: MessagePriority): 'high' | 'normal' {
    return priority >= MessagePriority.HIGH ? 'high' : 'normal';
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): IMessageStats {
    const queueStats = this.messageQueue.getQueueStats();
    const averageTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
        : 0;

    let totalHandlers = 0;
    for (const handlers of this.handlers.values()) {
      totalHandlers += handlers.length;
    }

    return {
      queueSize: queueStats.normal,
      highPriorityQueueSize: queueStats.highPriority || 0,
      isProcessing: queueStats.isProcessing,
      registeredHandlers: this.handlers.size,
      totalHandlers,
      totalMessages: this.totalMessages,
      errorCount: this.errorCount,
      averageProcessingTime: Math.round(averageTime * 100) / 100,
    };
  }

  /**
   * Clear all message queues
   */
  clearQueue(): void {
    this.messageQueue.clear();
    this.logger.info('All message queues cleared');
  }

  /**
   * Get all supported commands
   */
  getSupportedCommands(): string[] {
    return Array.from(this.handlers.keys()).sort();
  }

  /**
   * Check if dispatcher is ready
   */
  isReady(): boolean {
    return !this.disposed && (this.vscodeApi != null || this.coordinator != null);
  }

  /**
   * Flush all pending messages immediately
   */
  async flush(): Promise<void> {
    await this.messageQueue.flush();
  }
}
