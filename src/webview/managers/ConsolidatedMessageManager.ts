/**
 * Consolidated Message Manager
 *
 * 統合されたメッセージマネージャー - 最高のアーキテクチャと完全な機能性を組み合わせ
 *
 * 主な特徴:
 * - ハンドラーベースのクリーンアーキテクチャ
 * - 完全なメッセージ処理機能（元のMessageManagerから）
 * - 責務分離と拡張性を兼ね備えた設計
 * - プライオリティキューとエラーハンドリング
 */

import { IMessageManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { messageLogger } from '../utils/ManagerLogger';
import { MessageQueue, MessageSender } from '../utils/MessageQueue';
import { isNonNullObject } from '../../types/type-guards';
import { SessionMessageController } from './controllers/SessionMessageController';
import { CliAgentMessageController } from './controllers/CliAgentMessageController';
import { MessageCommand } from './messageTypes';

// Message Handlers
import { PanelLocationHandler } from './handlers/PanelLocationHandler';
import { SplitHandler } from './handlers/SplitHandler';
import { ScrollbackMessageHandler } from './handlers/ScrollbackMessageHandler';
import { SerializationMessageHandler } from './handlers/SerializationMessageHandler';
import { TerminalLifecycleMessageHandler } from './handlers/TerminalLifecycleMessageHandler';
import { SettingsAndConfigMessageHandler } from './handlers/SettingsAndConfigMessageHandler';
import { ShellIntegrationMessageHandler } from './handlers/ShellIntegrationMessageHandler';
import { ProfileMessageHandler } from './handlers/ProfileMessageHandler';

/**
 * Consolidated Message Manager
 *
 * 統合されたメッセージマネージャー：
 * - ハンドラーベースのクリーンアーキテクチャ
 * - 元のMessageManagerの全機能を保持
 * - 拡張性とメンテナンス性を両立
 * - プライオリティキューとロバストなエラーハンドリング
 */
export class ConsolidatedMessageManager implements IMessageManager {
  // Specialized logger for Message Manager
  private readonly logger = messageLogger;

  // MessageQueue utility for centralized queue management
  private messageQueue: MessageQueue;
  private coordinator?: IManagerCoordinator;
  private cachedTerminalRestoreInfo: {
    terminals: Array<Record<string, unknown>>;
    activeTerminalId: string | null;
    config?: unknown;
    timestamp: number;
  } | null = null;
  private readonly sessionController: SessionMessageController;
  private readonly cliAgentController: CliAgentMessageController;

  // Message Handlers
  private readonly panelLocationHandler: PanelLocationHandler;
  private readonly splitHandler: SplitHandler;
  private readonly scrollbackHandler: ScrollbackMessageHandler;
  private readonly serializationHandler: SerializationMessageHandler;
  private readonly lifecycleHandler: TerminalLifecycleMessageHandler;
  private readonly settingsHandler: SettingsAndConfigMessageHandler;
  private readonly shellIntegrationHandler: ShellIntegrationMessageHandler;
  private readonly profileHandler: ProfileMessageHandler;

  constructor(coordinator?: IManagerCoordinator) {
    this.logger.lifecycle('initialization', 'starting');

    if (coordinator) {
      this.coordinator = coordinator;
    }

    // Initialize MessageQueue with proper sender function
    const messageSender: MessageSender = (message: unknown) => {
      if (this.coordinator) {
        this.coordinator.postMessageToExtension(message);
      } else {
        throw new Error('Coordinator not available for sending messages');
      }
    };

    this.messageQueue = new MessageQueue(messageSender, {
      maxRetries: 3,
      processingDelay: 1,
      maxQueueSize: 1000,
      enablePriority: true,
    });

    this.sessionController = new SessionMessageController({
      logger: this.logger,
    });

    this.cliAgentController = new CliAgentMessageController({
      logger: this.logger,
    });

    // Initialize message handlers
    this.panelLocationHandler = new PanelLocationHandler(this.messageQueue, this.logger);
    this.splitHandler = new SplitHandler(this.logger);
    this.scrollbackHandler = new ScrollbackMessageHandler(this.messageQueue, this.logger);
    this.serializationHandler = new SerializationMessageHandler(this.logger);
    this.lifecycleHandler = new TerminalLifecycleMessageHandler(this.messageQueue, this.logger);
    this.settingsHandler = new SettingsAndConfigMessageHandler(this.logger);
    this.shellIntegrationHandler = new ShellIntegrationMessageHandler(this.logger);
    this.profileHandler = new ProfileMessageHandler(this.logger);

    this.logger.lifecycle('initialization', 'completed');
  }

  /**
   * Set coordinator after construction (for dependency injection)
   */
  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    this.logger.lifecycle('coordinator', 'completed');
  }

  /**
   * Initialize with coordinator
   */
  public initialize(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    this.logger.info('Initialized with coordinator');
  }

  /**
   * Legacy interface compatibility method
   */
  public receiveMessage(message: unknown, coordinator: IManagerCoordinator): Promise<void> {
    // 🔍 DEBUG: Fix message handling - message is the data, not MessageEvent
    this.logger.debug('receiveMessage called', {
      messageType: typeof message,
      command:
        isNonNullObject(message) && 'command' in message
          ? (message as MessageCommand).command
          : 'unknown',
      timestamp: Date.now(),
    });

    // Create fake MessageEvent structure to maintain compatibility
    const fakeEvent = {
      data: message,
      type: 'message',
      origin: 'vscode-webview',
    } as MessageEvent;

    return this.handleMessage(fakeEvent, coordinator);
  }

  /**
   * Handle incoming messages from the extension with comprehensive command support
   */
  public async handleMessage(
    message: MessageEvent,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    try {
      const msg = message.data as MessageCommand;
      this.logger.debug(`Message received: ${msg.command}`);

      switch (msg.command) {
        // Terminal Lifecycle Messages
        case 'init':
        case 'output':
        case 'terminalCreated':
        case 'newTerminal':
        case 'focusTerminal':
        case 'setActiveTerminal':
        case 'deleteTerminalResponse':
        case 'terminalRemoved':
        case 'clear':
          this.lifecycleHandler.handleMessage(msg, coordinator);
          break;

        // Settings and Configuration Messages
        case 'fontSettingsUpdate':
        case 'settingsResponse':
        case 'openSettings':
        case 'versionInfo':
        case 'stateUpdate':
          this.settingsHandler.handleMessage(msg, coordinator);
          break;
        case 'cliAgentStatusUpdate':
          this.cliAgentController.handleStatusUpdateMessage(msg, coordinator);
          break;
        case 'cliAgentFullStateSync':
          this.cliAgentController.handleFullStateSyncMessage(msg, coordinator);
          break;
        case 'sessionRestore':
          await this.sessionController.handleSessionRestoreMessage(msg, coordinator);
          break;
        case 'switchAiAgentResponse':
          this.cliAgentController.handleSwitchResponseMessage(msg, coordinator);
          break;
        case 'sessionRestoreStarted':
          this.sessionController.handleSessionRestoreStartedMessage(msg);
          break;
        case 'sessionRestoreProgress':
          this.sessionController.handleSessionRestoreProgressMessage(msg);
          break;
        case 'sessionRestoreCompleted':
          this.sessionController.handleSessionRestoreCompletedMessage(msg);
          break;
        case 'sessionRestoreError':
          this.sessionController.handleSessionRestoreErrorMessage(msg);
          break;

        // Scrollback Messages
        case 'getScrollback':
        case 'restoreScrollback':
        case 'scrollbackProgress':
        case 'extractScrollbackData':
          this.scrollbackHandler.handleMessage(msg, coordinator);
          break;
        case 'sessionSaved':
          this.sessionController.handleSessionSavedMessage(msg);
          break;
        case 'sessionSaveError':
          this.sessionController.handleSessionSaveErrorMessage(msg);
          break;
        case 'sessionCleared':
          this.sessionController.handleSessionClearedMessage();
          break;
        case 'sessionRestored':
          this.sessionController.handleSessionRestoredMessage(msg);
          break;

        // Shell Integration Messages
        case 'shellStatus':
        case 'cwdUpdate':
        case 'commandHistory':
        case 'find':
          this.shellIntegrationHandler.handleMessage(msg, coordinator);
          break;

        // Terminal Serialization Messages
        case 'serializeTerminal':
        case 'restoreSerializedContent':
        case 'terminalRestoreInfo':
        case 'saveAllTerminalSessions':
        case 'requestTerminalSerialization':
        case 'restoreTerminalSerialization':
        case 'sessionRestorationData':
        case 'persistenceSaveSessionResponse':
        case 'persistenceRestoreSessionResponse':
        case 'persistenceClearSessionResponse':
          this.serializationHandler.handleMessage(msg, coordinator);
          break;
        case 'sessionRestoreSkipped':
          this.sessionController.handleSessionRestoreSkippedMessage(msg);
          break;
        case 'terminalRestoreError':
          void this.sessionController.handleTerminalRestoreErrorMessage(msg);
          break;

        // Panel Location Messages
        case 'panelLocationUpdate':
        case 'requestPanelLocationDetection':
          this.panelLocationHandler.handleMessage(msg, coordinator);
          break;

        // Split and Layout Messages
        case 'split':
        case 'relayoutTerminals':
          this.logger.info(`🔄 [MESSAGE-MANAGER] Routing ${msg.command} to SplitHandler`);
          this.splitHandler.handleMessage(msg, coordinator);
          break;

        // Profile Management Messages
        case 'showProfileSelector':
        case 'profilesUpdated':
        case 'defaultProfileChanged':
          this.profileHandler.handleMessage(msg, coordinator);
          break;
        default:
          this.logger.warn(`Unknown command: ${msg.command}`);
      }
    } catch (error) {
      this.logger.error('Error handling message', error);
    }
  }

  /**
   * Test compatibility methods
   */
  private messageHandlers: Array<(message: unknown) => void> = [];
  private errorHandlers: Array<(error: unknown) => void> = [];

  /**
   * Add message handler (for test compatibility)
   */
  public onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Add error handler (for test compatibility)
   */
  public onError(handler: (error: unknown) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Handle extension message (for test compatibility)
   */
  public async handleExtensionMessage(message: unknown): Promise<void> {
    if (!this.coordinator) {
      const error = new Error('Coordinator not available');
      this.errorHandlers.forEach(handler => {
        try {
          handler(error);
        } catch (err) {
          this.logger.error('Error in error handler:', err);
        }
      });
      throw error;
    }

    try {
      // Trigger message handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          this.logger.error('Error in message handler:', error);
          this.errorHandlers.forEach(errorHandler => {
            try {
              errorHandler(error);
            } catch (err) {
              this.logger.error('Error in error handler:', err);
            }
          });
        }
      });

      // Process the message using the existing logic
      await this.receiveMessage(message, this.coordinator);
    } catch (error) {
      this.errorHandlers.forEach(handler => {
        try {
          handler(error);
        } catch (err) {
          this.logger.error('Error in error handler:', err);
        }
      });
      throw error;
    }
  }

  /**
   * Send message to extension (for test compatibility)
   */
  public async sendToExtension(message: unknown): Promise<void> {
    if (!this.coordinator) {
      throw new Error('Coordinator not available');
    }

    this.coordinator.postMessageToExtension(message);
  }

  /**
   * Send message to extension with retry (for test compatibility)
   */
  public async sendToExtensionWithRetry(message: unknown, options?: { maxRetries?: number }): Promise<void> {
    const maxRetries = options?.maxRetries ?? 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.sendToExtension(message);
        return;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  /**
   * Resource cleanup and disposal
   */

  public dispose(): void {
    this.logger.info('Disposing ConsolidatedMessageManager');

    // Dispose all message handlers
    this.panelLocationHandler.dispose();
    this.splitHandler.dispose();
    this.scrollbackHandler.dispose();
    this.serializationHandler.dispose();
    this.lifecycleHandler.dispose();
    this.settingsHandler.dispose();
    this.shellIntegrationHandler.dispose();
    this.profileHandler.dispose();

    // Clear message handlers
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.connectionLostHandlers = [];

    // Dispose MessageQueue - this will clean up all queued messages and processing
    this.messageQueue.dispose();

    // Clear coordinator reference
    this.coordinator = undefined;

    this.logger.lifecycle('ConsolidatedMessageManager', 'completed');
  }

  private connectionLostHandlers: Array<() => void> = [];

  /**
   * Add connection lost handler (for test compatibility)
   */
  public onConnectionLost(handler: () => void): void {
    this.connectionLostHandlers.push(handler);
  }

  /**
   * Handle connection restored (for test compatibility)
   */
  public onConnectionRestored(): void {
    this.logger.info('Connection restored, flushing queued messages');
    // Flush the message queue when connection is restored
    void this.messageQueue.flush();
  }

  /**
   * Handle raw message (for test compatibility)
   */
  public async handleRawMessage(rawMessage: string): Promise<void> {
    try {
      const message = JSON.parse(rawMessage);
      await this.handleExtensionMessage(message);
    } catch (error) {
      const parseError = new Error(`Invalid JSON message: ${error instanceof Error ? error.message : String(error)}`);
      this.errorHandlers.forEach(handler => {
        try {
          handler(parseError);
        } catch (err) {
          this.logger.error('Error in error handler:', err);
        }
      });
      throw parseError;
    }
  }

  /**
   * Post message to extension (IMessageManager interface requirement)
   */
  public postMessage(message: unknown): void {
    this.messageQueue.enqueue(message);
  }

  /**
   * Send ready message to extension (IMessageManager interface requirement)
   */
  public sendReadyMessage(_coordinator: IManagerCoordinator): void {
    this.messageQueue.enqueue({ command: 'ready' });
  }

  /**
   * Emit terminal interaction event (IMessageManager interface requirement)
   */
  public emitTerminalInteractionEvent(
    type: import('../../types/common').TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    _coordinator: IManagerCoordinator
  ): void {
    this.messageQueue.enqueue({
      command: 'terminalInteraction',
      type,
      terminalId,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get queue statistics (IMessageManager interface requirement)
   */
  public getQueueStats(): {
    queueSize: number;
    isProcessing: boolean;
    highPriorityQueueSize?: number;
    isLocked?: boolean;
  } {
    const stats = this.messageQueue.getQueueStats();
    return {
      queueSize: stats.total,
      isProcessing: stats.isProcessing,
      highPriorityQueueSize: stats.highPriority,
      isLocked: false
    };
  }

  /**
   * Send input to terminal (IMessageManager interface requirement)
   */
  public sendInput(input: string, terminalId?: string, _coordinator?: IManagerCoordinator): void {
    this.messageQueue.enqueue({
      command: 'input',
      data: input,
      terminalId: terminalId || this.coordinator?.getActiveTerminalId()
    });
  }

  /**
   * Send resize command (IMessageManager interface requirement)
   */
  public sendResize(
    cols: number,
    rows: number,
    terminalId?: string,
    _coordinator?: IManagerCoordinator
  ): void {
    this.messageQueue.enqueue({
      command: 'resize',
      cols,
      rows,
      terminalId: terminalId || this.coordinator?.getActiveTerminalId()
    });
  }

  /**
   * Send delete terminal message (IMessageManager interface requirement)
   */
  public sendDeleteTerminalMessage(
    terminalId: string,
    requestSource: 'header' | 'panel',
    _coordinator: IManagerCoordinator
  ): void {
    this.messageQueue.enqueue({
      command: 'deleteTerminal',
      terminalId,
      requestSource
    });
  }
}

/**
 * Legacy compatibility methods for factory patterns (if needed)
 */
export class MessageManagerFactory {
  /**
   * Create ConsolidatedMessageManager instance
   */
  public static create(): ConsolidatedMessageManager {
    return new ConsolidatedMessageManager();
  }

  /**
   * Create test MessageManager instance
   */
  public static createForTesting(): ConsolidatedMessageManager {
    const manager = new ConsolidatedMessageManager();
    messageLogger.info('🧪 Test MessageManager created');
    return manager;
  }
}
