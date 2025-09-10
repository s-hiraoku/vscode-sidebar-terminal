/**
 * Consolidated Message Service
 * 
 * This service replaces and consolidates the functionality of:
 * - WebViewMessageHandlerService (Command pattern)
 * - RefactoredMessageManager (Queue-based message handling)  
 * - WebViewMessageRouter (Router pattern)
 * 
 * Provides a single, unified message handling system that eliminates
 * the 394 duplicate message handling occurrences across 56 files.
 */

import { IMessageManager, IManagerCoordinator, IManagerLifecycle } from '../webview/interfaces/ManagerInterfaces';
import { WebviewMessage, TerminalInteractionEvent } from '../types/common';
import { UnifiedMessageDispatcher, MessagePriority } from './UnifiedMessageDispatcher';
import { messageLogger } from '../webview/utils/ManagerLogger';

// Import unified message handlers
import { SystemMessageHandler } from './handlers/SystemMessageHandler';
import { TerminalOutputHandler } from './handlers/TerminalOutputHandler';
import { TerminalLifecycleHandler } from './handlers/TerminalLifecycleHandler';
import { CliAgentHandler } from './handlers/CliAgentHandler';
import { SessionHandler } from './handlers/SessionHandler';

/**
 * Consolidated Message Service
 * 
 * Single service that handles all message processing with:
 * - Unified handler registry (replaces WebViewMessageHandlerService)
 * - Priority queue processing (replaces RefactoredMessageManager)
 * - Publisher-subscriber routing (replaces WebViewMessageRouter)
 * - Complete backward compatibility with existing interfaces
 */
export class ConsolidatedMessageService implements IMessageManager, IManagerLifecycle {
  private readonly logger = messageLogger;
  private readonly dispatcher: UnifiedMessageDispatcher;
  private coordinator?: IManagerCoordinator;
  private initialized = false;

  constructor(coordinator?: IManagerCoordinator) {
    this.logger.info('ConsolidatedMessageService initializing');
    
    this.coordinator = coordinator;
    this.dispatcher = new UnifiedMessageDispatcher(coordinator);
    
    this.initializeHandlers();
    this.logger.info('ConsolidatedMessageService created');
  }

  /**
   * Initialize all unified message handlers
   */
  private initializeHandlers(): void {
    // Register all unified handlers with the dispatcher
    this.dispatcher.registerHandler(new SystemMessageHandler());
    this.dispatcher.registerHandler(new TerminalOutputHandler());
    this.dispatcher.registerHandler(new TerminalLifecycleHandler());
    this.dispatcher.registerHandler(new CliAgentHandler());
    this.dispatcher.registerHandler(new SessionHandler());

    this.logger.info(`📨 [ConsolidatedMessageService] Registered ${this.dispatcher.getSupportedCommands().length} command handlers`);
  }

  // =================================================================
  // LIFECYCLE MANAGEMENT
  // =================================================================

  async initialize(coordinator?: IManagerCoordinator): Promise<void> {
    if (this.initialized) {
      this.logger.warn('ConsolidatedMessageService already initialized');
      return;
    }

    if (coordinator) {
      this.coordinator = coordinator;
    }

    await this.dispatcher.initialize(this.coordinator);
    this.initialized = true;
    
    this.logger.info('ConsolidatedMessageService fully initialized');
  }

  dispose(): void {
    this.logger.info('Disposing ConsolidatedMessageService');
    
    this.dispatcher.dispose();
    this.coordinator = undefined;
    this.initialized = false;
    
    this.logger.info('ConsolidatedMessageService disposed');
  }

  // =================================================================
  // IMESSAGEMANAGER INTERFACE IMPLEMENTATION
  // =================================================================

  /**
   * Handle incoming messages (replaces RefactoredMessageManager functionality)
   */
  public async receiveMessage(message: unknown, coordinator: IManagerCoordinator): Promise<void> {
    this.logger.debug('receiveMessage called', {
      messageType: typeof message,
      command: (message as any)?.command,
      timestamp: Date.now(),
    });

    // Set coordinator if not already set
    if (!this.coordinator) {
      this.coordinator = coordinator;
    }

    // Convert to WebviewMessage format and process
    const webviewMessage = this.normalizeMessage(message);
    const result = await this.dispatcher.processMessage(webviewMessage);
    
    if (!result.success) {
      this.logger.error(`Message processing failed: ${result.error}`);
    } else {
      this.logger.debug(`Message processed successfully by ${result.handledBy} in ${result.processingTime}ms`);
    }
  }

  /**
   * Handle MessageEvent format (for compatibility)
   */
  public async handleMessage(
    message: MessageEvent,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    const webviewMessage = message.data as WebviewMessage;
    await this.receiveMessage(webviewMessage, coordinator);
  }

  /**
   * Send ready message to extension
   */
  public sendReadyMessage(_coordinator: IManagerCoordinator): void {
    this.dispatcher.sendMessage({
      command: 'ready',
      timestamp: Date.now(),
    }, MessagePriority.HIGH);
    this.logger.info('Ready message sent');
  }

  /**
   * Post message to extension
   */
  public postMessage(message: unknown): void {
    this.dispatcher.sendMessage(message, MessagePriority.NORMAL);
    this.logger.debug('Message posted to queue', { message });
  }

  /**
   * Emit terminal interaction event
   */
  public emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    coordinator: IManagerCoordinator
  ): void {
    // Update coordinator if provided
    if (coordinator && !this.coordinator) {
      this.coordinator = coordinator;
    }

    this.dispatcher.sendTerminalInteractionEvent(
      type,
      terminalId,
      data,
      MessagePriority.NORMAL
    );
    
    this.logger.debug(`Terminal interaction event sent: ${type} for ${terminalId}`);
  }

  /**
   * Get message queue statistics
   */
  public getQueueStats(): { 
    queueSize: number; 
    isProcessing: boolean;
    highPriorityQueueSize?: number;
    isLocked?: boolean;
  } {
    const stats = this.dispatcher.getStats();
    return {
      queueSize: stats.queueSize,
      isProcessing: stats.isProcessing,
      highPriorityQueueSize: stats.highPriorityQueueSize,
      isLocked: false // Unified dispatcher doesn't use locking
    };
  }

  /**
   * Send input to terminal
   */
  public sendInput(input: string, terminalId?: string, coordinator?: IManagerCoordinator): void {
    if (coordinator && !this.coordinator) {
      this.coordinator = coordinator;
    }

    if (!this.coordinator) {
      this.logger.error('No coordinator available for sendInput');
      return;
    }

    // Use dispatcher's optimized input handling
    this.dispatcher.sendInput(input, terminalId, MessagePriority.HIGH);
    this.logger.info(`Input sent: ${input.length} chars to terminal ${terminalId || 'active'}`);
  }

  /**
   * Send resize command
   */
  public sendResize(
    cols: number,
    rows: number,
    terminalId?: string,
    coordinator?: IManagerCoordinator
  ): void {
    if (coordinator && !this.coordinator) {
      this.coordinator = coordinator;
    }

    this.dispatcher.sendResize(cols, rows, terminalId, MessagePriority.HIGH);
    this.logger.debug(`Resize sent: ${cols}x${rows} to terminal ${terminalId || 'active'}`);
  }

  /**
   * Send delete terminal message
   */
  public sendDeleteTerminalMessage(
    terminalId: string,
    requestSource: 'header' | 'panel',
    coordinator: IManagerCoordinator
  ): void {
    if (!this.coordinator) {
      this.coordinator = coordinator;
    }

    this.dispatcher.sendDeleteTerminalMessage(terminalId, requestSource, MessagePriority.HIGH);
    this.logger.info(`Delete terminal message sent: ${terminalId} from ${requestSource}`);
  }

  /**
   * Send switch AI agent message
   */
  public sendSwitchAiAgentMessage(terminalId: string, coordinator: IManagerCoordinator): void {
    if (!this.coordinator) {
      this.coordinator = coordinator;
    }

    this.dispatcher.sendMessage({
      command: 'switchAiAgent',
      terminalId,
      timestamp: Date.now(),
    }, MessagePriority.HIGH);
    
    this.logger.info(`Switch AI agent message sent for terminal: ${terminalId}`);
  }

  /**
   * Send kill terminal message
   */
  public sendKillTerminalMessage(_coordinator: IManagerCoordinator): void {
    this.dispatcher.sendMessage({
      command: 'killTerminal',
      timestamp: Date.now(),
    }, MessagePriority.HIGH);
    
    this.logger.info('Kill terminal message sent');
  }

  /**
   * Send kill specific terminal message
   */
  public sendKillSpecificTerminalMessage(
    terminalId: string,
    _coordinator: IManagerCoordinator
  ): void {
    this.dispatcher.sendMessage({
      command: 'killTerminal',
      terminalId,
      timestamp: Date.now(),
    }, MessagePriority.HIGH);
    
    this.logger.info(`Kill specific terminal message sent for: ${terminalId}`);
  }

  /**
   * Request settings from extension
   */
  public requestSettings(_coordinator: IManagerCoordinator): void {
    this.dispatcher.requestSettings(MessagePriority.NORMAL);
    this.logger.info('Settings requested');
  }

  /**
   * Update settings
   */
  public updateSettings(settings: unknown, _coordinator: IManagerCoordinator): void {
    this.dispatcher.updateSettings(settings, MessagePriority.NORMAL);
    this.logger.info('Settings update sent');
  }

  /**
   * Request new terminal creation
   */
  public requestNewTerminal(_coordinator: IManagerCoordinator): void {
    this.dispatcher.requestNewTerminal(MessagePriority.HIGH);
    this.logger.info('New terminal requested');
  }

  /**
   * Clear message queue
   */
  public clearQueue(): void {
    this.dispatcher.clearQueue();
    this.logger.info('All message queues cleared');
  }

  /**
   * Queue message manually (for testing)
   */
  public queueMessage(message: unknown, coordinator: IManagerCoordinator): void {
    if (!this.coordinator) {
      this.coordinator = coordinator;
    }
    this.postMessage(message);
  }

  /**
   * Process message queue manually (for testing)
   */
  public async processMessageQueue(coordinator?: IManagerCoordinator): Promise<void> {
    if (coordinator && !this.coordinator) {
      this.coordinator = coordinator;
    }
    await this.dispatcher.flush();
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Normalize different message formats to WebviewMessage
   */
  private normalizeMessage(message: unknown): WebviewMessage {
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format');
    }

    const msg = message as any;
    
    // Handle MessageEvent wrapper
    if (msg.data && typeof msg.data === 'object') {
      return msg.data as WebviewMessage;
    }

    // Handle direct WebviewMessage
    if (typeof msg.command === 'string') {
      return msg as WebviewMessage;
    }

    throw new Error('Unable to normalize message to WebviewMessage format');
  }

  /**
   * Get comprehensive statistics
   */
  public getDetailedStats(): {
    dispatcher: ReturnType<UnifiedMessageDispatcher['getStats']>;
    supportedCommands: string[];
    isReady: boolean;
    initialized: boolean;
  } {
    return {
      dispatcher: this.dispatcher.getStats(),
      supportedCommands: this.dispatcher.getSupportedCommands(),
      isReady: this.dispatcher.isReady(),
      initialized: this.initialized
    };
  }

  /**
   * Check if service is ready
   */
  public isReady(): boolean {
    return this.initialized && this.dispatcher.isReady();
  }
}

/**
 * Factory for creating ConsolidatedMessageService instances
 * (Maintains compatibility with existing factory patterns)
 */
export class ConsolidatedMessageServiceFactory {
  /**
   * Create ConsolidatedMessageService instance
   */
  public static create(coordinator?: IManagerCoordinator): ConsolidatedMessageService {
    return new ConsolidatedMessageService(coordinator);
  }

  /**
   * Create test instance
   */
  public static createForTesting(): ConsolidatedMessageService {
    const service = new ConsolidatedMessageService();
    messageLogger.info('🧪 Test ConsolidatedMessageService created');
    return service;
  }
}