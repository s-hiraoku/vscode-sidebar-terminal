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
import { ClipboardMessageHandler } from './handlers/ClipboardMessageHandler';

/**
 * Message handler function type
 */
type MessageHandlerFn = (
  msg: MessageCommand,
  coordinator: IManagerCoordinator
) => void | Promise<void>;

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
  private readonly clipboardHandler: ClipboardMessageHandler;

  // Message command to handler mapping for efficient dispatch
  private readonly messageHandlers: Map<string, MessageHandlerFn>;
  private readonly splitRecoveryTimeouts = new Set<ReturnType<typeof setTimeout>>();

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
    this.clipboardHandler = new ClipboardMessageHandler(this.logger);

    // Build message handler registry for O(1) lookup instead of O(n) switch statement
    this.messageHandlers = this.buildMessageHandlerRegistry();

    this.logger.lifecycle('initialization', 'completed');
  }

  /**
   * Build message handler registry
   * Maps message commands to their respective handlers
   * This replaces the large switch statement with a more maintainable approach
   */
  private buildMessageHandlerRegistry(): Map<string, MessageHandlerFn> {
    const registry = new Map<string, MessageHandlerFn>();

    // Terminal Lifecycle Messages
    const lifecycleCommands = [
      'init',
      'output',
      'terminalCreated',
      'newTerminal',
      'focusTerminal',
      'panelNavigationMode',
      'panelNavigationEnabledChanged',
      'setActiveTerminal',
      'deleteTerminalResponse',
      'terminalRemoved',
      'clear',
      'startOutput',
    ];
    lifecycleCommands.forEach((cmd) =>
      registry.set(cmd, (msg, coord) => this.lifecycleHandler.handleMessage(msg, coord))
    );

    // Settings and Configuration Messages
    const settingsCommands = [
      'fontSettingsUpdate',
      'settingsResponse',
      'openSettings',
      'versionInfo',
      'stateUpdate',
      'themeChanged',
    ];
    settingsCommands.forEach((cmd) =>
      registry.set(cmd, (msg, coord) => this.settingsHandler.handleMessage(msg, coord))
    );

    // CLI Agent Messages
    registry.set('cliAgentStatusUpdate', (msg, coord) =>
      this.cliAgentController.handleStatusUpdateMessage(msg, coord)
    );
    registry.set('cliAgentFullStateSync', (msg, coord) =>
      this.cliAgentController.handleFullStateSyncMessage(msg, coord)
    );
    registry.set('switchAiAgentResponse', (msg, coord) =>
      this.cliAgentController.handleSwitchResponseMessage(msg, coord)
    );

    // Session Messages
    registry.set('sessionRestore', async (msg, coord) =>
      this.sessionController.handleSessionRestoreMessage(msg, coord)
    );
    registry.set('sessionRestoreStarted', (msg) =>
      this.sessionController.handleSessionRestoreStartedMessage(msg)
    );
    registry.set('sessionRestoreProgress', (msg) =>
      this.sessionController.handleSessionRestoreProgressMessage(msg)
    );
    registry.set('sessionRestoreCompleted', (msg, coord) => {
      this.sessionController.handleSessionRestoreCompletedMessage(msg);
      this.scheduleSplitResizerRecovery(coord, 'sessionRestoreCompleted');
    });
    registry.set('sessionRestoreError', (msg) =>
      this.sessionController.handleSessionRestoreErrorMessage(msg)
    );
    registry.set('sessionSaved', (msg) => this.sessionController.handleSessionSavedMessage(msg));
    registry.set('sessionSaveError', (msg) =>
      this.sessionController.handleSessionSaveErrorMessage(msg)
    );
    registry.set('sessionCleared', () => this.sessionController.handleSessionClearedMessage());
    registry.set('sessionRestored', (msg, coord) => {
      this.sessionController.handleSessionRestoredMessage(msg);
      this.scheduleSplitResizerRecovery(coord, 'sessionRestored');
    });
    registry.set('sessionRestoreSkipped', (msg) =>
      this.sessionController.handleSessionRestoreSkippedMessage(msg)
    );
    registry.set('terminalRestoreError', (msg) =>
      this.sessionController.handleTerminalRestoreErrorMessage(msg)
    );

    // Scrollback Messages
    const scrollbackCommands = [
      'getScrollback',
      'restoreScrollback',
      'scrollbackProgress',
      'extractScrollbackData',
      'restoreTerminalSessions',
    ];
    scrollbackCommands.forEach((cmd) =>
      registry.set(cmd, (msg, coord) => this.scrollbackHandler.handleMessage(msg, coord))
    );

    // Shell Integration Messages
    const shellIntegrationCommands = ['shellStatus', 'cwdUpdate', 'commandHistory', 'find'];
    shellIntegrationCommands.forEach((cmd) =>
      registry.set(cmd, (msg, coord) => this.shellIntegrationHandler.handleMessage(msg, coord))
    );

    // Terminal Serialization Messages
    const serializationCommands = [
      'serializeTerminal',
      'restoreSerializedContent',
      'terminalRestoreInfo',
      'saveAllTerminalSessions',
      'requestTerminalSerialization',
      'restoreTerminalSerialization',
      'sessionRestorationData',
      'persistenceSaveSessionResponse',
      'persistenceRestoreSessionResponse',
      'persistenceClearSessionResponse',
    ];
    serializationCommands.forEach((cmd) =>
      registry.set(cmd, (msg, coord) => this.serializationHandler.handleMessage(msg, coord))
    );

    // Panel Location Messages
    const panelLocationCommands = ['panelLocationUpdate', 'requestPanelLocationDetection'];
    panelLocationCommands.forEach((cmd) =>
      registry.set(cmd, (msg, coord) => this.panelLocationHandler.handleMessage(msg, coord))
    );

    // Split and Layout Messages
    const splitCommands = ['split', 'setDisplayMode', 'relayoutTerminals'];
    splitCommands.forEach((cmd) =>
      registry.set(cmd, (msg, coord) => {
        this.logger.info(`🔄 [MESSAGE-MANAGER] Routing ${msg.command} to SplitHandler`);
        this.splitHandler.handleMessage(msg, coord);
      })
    );

    // Profile Management Messages
    const profileCommands = ['showProfileSelector', 'profilesUpdated', 'defaultProfileChanged'];
    profileCommands.forEach((cmd) =>
      registry.set(cmd, (msg, coord) => this.profileHandler.handleMessage(msg, coord))
    );

    // Clipboard Messages
    registry.set('clipboardContent', (msg, coord) =>
      this.clipboardHandler.handleMessage(msg, coord)
    );

    return registry;
  }

  private scheduleSplitResizerRecovery(coordinator: IManagerCoordinator, trigger: string): void {
    const initialDelayMs = 100;
    const retryDelayMs = 120;
    const maxAttempts = 4;

    const tryRecover = (attempt: number): void => {
      const result = this.recoverSplitResizersIfNeeded(coordinator, trigger, attempt);
      if (result !== 'retry' || attempt >= maxAttempts) {
        return;
      }
      this.scheduleSplitRecoveryTimeout(() => tryRecover(attempt + 1), retryDelayMs);
    };

    this.scheduleSplitRecoveryTimeout(() => tryRecover(1), initialDelayMs);
  }

  private scheduleSplitRecoveryTimeout(callback: () => void, delayMs: number): void {
    const timeoutId = setTimeout(() => {
      this.splitRecoveryTimeouts.delete(timeoutId);
      callback();
    }, delayMs);
    this.splitRecoveryTimeouts.add(timeoutId);
  }

  private recoverSplitResizersIfNeeded(
    coordinator: IManagerCoordinator,
    trigger: string,
    attempt: number
  ): 'recovered' | 'retry' | 'not-applicable' {
    try {
      const displayModeManager = coordinator.getDisplayModeManager?.();
      if (displayModeManager?.getCurrentMode?.() !== 'split') {
        return 'not-applicable';
      }

      const visibleCount = this.getVisibleTerminalCount(coordinator);
      if (visibleCount <= 1) {
        this.logger.debug(
          `Split resizer recovery deferred after ${trigger} (attempt=${attempt}, visible=${visibleCount})`
        );
        return 'retry';
      }

      displayModeManager.showAllTerminalsSplit?.();
      this.invokeUpdateSplitResizers(coordinator);

      this.logger.info(`Split resizers recovered after ${trigger} (attempt=${attempt})`);
      return 'recovered';
    } catch (error) {
      this.logger.error(`Failed to recover split resizers after ${trigger}`, error);
      return 'not-applicable';
    }
  }

  private getVisibleTerminalCount(coordinator: IManagerCoordinator): number {
    const containerManager = coordinator.getTerminalContainerManager?.();
    const snapshot = containerManager?.getDisplaySnapshot?.();
    const snapshotVisibleCount = Array.isArray(snapshot?.visibleTerminals)
      ? snapshot.visibleTerminals.length
      : 0;

    const terminalsWrapper = document.getElementById('terminals-wrapper');
    const domWrapperCount = terminalsWrapper
      ? terminalsWrapper.querySelectorAll('[data-terminal-wrapper-id]').length
      : 0;

    return Math.max(snapshotVisibleCount, domWrapperCount);
  }

  private invokeUpdateSplitResizers(coordinator: IManagerCoordinator): void {
    if ('updateSplitResizers' in coordinator) {
      (coordinator as { updateSplitResizers?: () => void }).updateSplitResizers?.();
    }
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
   * 🎯 PUBLIC API: Update panel location and flex-direction if changed
   * Single entry point for layout updates (VS Code pattern)
   *
   * @returns true if layout was updated, false if no change
   */
  public updatePanelLocationIfNeeded(): boolean {
    if (!this.coordinator) {
      this.logger.warn('Cannot update panel location: coordinator not initialized');
      return false;
    }

    return this.panelLocationHandler.updateFlexDirectionIfNeeded(this.coordinator);
  }

  /**
   * Get current panel location from handler
   */
  public getCurrentPanelLocation(): 'sidebar' | 'panel' | null {
    return this.panelLocationHandler.getCurrentPanelLocation();
  }

  /**
   * Get current flex-direction from handler
   */
  public getCurrentFlexDirection(): 'row' | 'column' | null {
    return this.panelLocationHandler.getCurrentFlexDirection();
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
   * Uses Map-based dispatch for O(1) lookup instead of O(n) switch statement
   */
  public async handleMessage(
    message: MessageEvent,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    try {
      const messageCommand = message.data as MessageCommand;

      this.logger.debug(`Message received: ${messageCommand.command}`);

      // Lookup handler in registry
      const handler = this.messageHandlers.get(messageCommand.command);

      if (handler) {
        // Execute handler (may be sync or async)
        await handler(messageCommand, coordinator);
      } else {
        this.logger.warn(`Unknown command: ${messageCommand.command}`);
      }
    } catch (error) {
      this.logger.error('Error handling message', error);
    }
  }

  /**
   * Test compatibility methods
   */
  private testMessageHandlers: Array<(message: unknown) => void> = [];
  private errorHandlers: Array<(error: unknown) => void> = [];

  /**
   * Add message handler (for test compatibility)
   */
  public onMessage(handler: (message: unknown) => void): void {
    this.testMessageHandlers.push(handler);
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
      this.errorHandlers.forEach((handler) => {
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
      this.testMessageHandlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          this.logger.error('Error in message handler:', error);
          this.errorHandlers.forEach((errorHandler) => {
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
      this.errorHandlers.forEach((handler) => {
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
  public async sendToExtensionWithRetry(
    message: unknown,
    options?: { maxRetries?: number }
  ): Promise<void> {
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
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  /**
   * Resource cleanup and disposal
   */

  public dispose(): void {
    this.logger.info('Disposing ConsolidatedMessageManager');

    this.splitRecoveryTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.splitRecoveryTimeouts.clear();

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
    this.testMessageHandlers = [];
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
      const parseError = new Error(
        `Invalid JSON message: ${error instanceof Error ? error.message : String(error)}`
      );
      this.errorHandlers.forEach((handler) => {
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
      timestamp: Date.now(),
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
      isLocked: false,
    };
  }

  /**
   * Send input to terminal (IMessageManager interface requirement)
   */
  public sendInput(input: string, terminalId?: string, _coordinator?: IManagerCoordinator): void {
    this.messageQueue.enqueue({
      command: 'input',
      data: input,
      terminalId: terminalId || this.coordinator?.getActiveTerminalId(),
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
      terminalId: terminalId || this.coordinator?.getActiveTerminalId(),
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
      requestSource,
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
