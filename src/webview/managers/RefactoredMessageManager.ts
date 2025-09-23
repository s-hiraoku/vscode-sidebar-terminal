/**
 * Consolidated Message Manager
 *
 * 統合されたメッセージマネージャー - 最高のアーキテクチャと完全な機能性を組み合わせ
 *
 * 主な特徴:
 * - ハンドラーベースのクリーンアーキテクチャ（RefactoredMessageManagerから）
 * - 完全なメッセージ処理機能（元のMessageManagerから）
 * - 責務分離と拡張性を兼ね備えた設計
 * - プライオリティキューとエラーハンドリング
 */

import { IMessageManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { TerminalInteractionEvent } from '../../types/common';
import { WebViewFontSettings } from '../../types/shared';
import { messageLogger } from '../utils/ManagerLogger';
import { MessageQueue, MessageSender } from '../utils/MessageQueue';
import { Terminal } from '@xterm/xterm';
import {
  isNonNullObject,
  hasProperty,
  IShellIntegrationManager,
  ITerminalLifecycleManager,
  ITerminalWithAddons,
} from '../../types/type-guards';
import { SessionMessageController } from './controllers/SessionMessageController';
import { CliAgentMessageController } from './controllers/CliAgentMessageController';
import { MessageCommand } from './messageTypes';

/**
 * Consolidated Message Manager
 *
 * 統合されたメッセージマネージャー：
 * - ハンドラーベースのクリーンアーキテクチャ
 * - 元のMessageManagerの全機能を保持
 * - 拡張性とメンテナンス性を両立
 * - プライオリティキューとロバストなエラーハンドリング
 */
export class RefactoredMessageManager implements IMessageManager {
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

    this.logger.lifecycle('initialization', 'completed');
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
        case 'init':
          this.handleInitMessage(msg, coordinator);
          break;
        case 'output':
          this.handleOutputMessage(msg, coordinator);
          break;
        case 'terminalRemoved':
          this.handleTerminalRemovedMessage(msg, coordinator);
          break;
        case 'clear':
          this.handleClearTerminalMessage(msg, coordinator);
          break;
        case 'fontSettingsUpdate':
          this.handleFontSettingsUpdateMessage(msg, coordinator);
          break;
        case 'settingsResponse':
          this.handleSettingsResponseMessage(msg, coordinator);
          break;
        case 'terminalCreated':
          await this.handleTerminalCreatedMessage(msg, coordinator);
          break;
        case 'newTerminal':
          this.handleNewTerminalMessage(msg, coordinator);
          break;
        case 'focusTerminal':
          this.handleFocusTerminalMessage(msg, coordinator);
          break;
        case 'stateUpdate':
          this.handleStateUpdateMessage(msg, coordinator);
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
        case 'getScrollback':
          this.handleGetScrollbackMessage(msg, coordinator);
          break;
        case 'restoreScrollback':
          this.handleRestoreScrollbackMessage(msg, coordinator);
          break;
        case 'scrollbackProgress':
          this.handleScrollbackProgressMessage(msg);
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
        case 'setActiveTerminal':
          this.handleSetActiveTerminalMessage(msg, coordinator);
          break;
        // 🆕 NEW: Handle scrollback data extraction request
        case 'extractScrollbackData':
          await this.handleExtractScrollbackDataMessage(msg, coordinator);
          break;
        // Shell Integration Messages
        case 'updateShellStatus':
          this.handleShellStatusMessage(msg, coordinator);
          break;
        case 'updateCwd':
          this.handleCwdUpdateMessage(msg, coordinator);
          break;
        case 'commandHistory':
          this.handleCommandHistoryMessage(msg, coordinator);
          break;
        case 'find':
          this.handleFindMessage(msg, coordinator);
          break;
        case 'serializeTerminal':
          this.handleSerializeTerminalMessage(msg, coordinator);
          break;
        case 'restoreSerializedContent':
          this.handleRestoreSerializedContentMessage(msg, coordinator);
          break;
        case 'terminalRestoreInfo':
          this.handleTerminalRestoreInfoMessage(msg, coordinator);
          break;
        case 'saveAllTerminalSessions':
          this.handleSaveAllTerminalSessionsMessage(msg, coordinator);
          break;
        case 'sessionRestoreSkipped':
          this.sessionController.handleSessionRestoreSkippedMessage(msg);
          break;
        case 'terminalRestoreError':
          void this.sessionController.handleTerminalRestoreErrorMessage(msg);
          break;
        case 'panelLocationUpdate':
          this.handlePanelLocationUpdateMessage(msg, coordinator);
          break;
        case 'requestPanelLocationDetection':
          this.handleRequestPanelLocationDetectionMessage(coordinator);
          break;
        case 'requestTerminalSerialization':
          this.handleRequestTerminalSerializationMessage(msg, coordinator);
          break;
        case 'restoreTerminalSerialization':
          this.handleRestoreTerminalSerializationMessage(msg, coordinator);
          break;
        case 'sessionRestorationData':
          this.handleSessionRestorationDataMessage(msg, coordinator);
          break;
        case 'deleteTerminalResponse':
          this.handleDeleteTerminalResponseMessage(msg, coordinator);
          break;
        // Persistence response handlers
        case 'persistenceSaveSessionResponse':
          this.handlePersistenceSaveSessionResponseMessage(msg, coordinator);
          break;
        case 'persistenceRestoreSessionResponse':
          this.handlePersistenceRestoreSessionResponseMessage(msg, coordinator);
          break;
        case 'persistenceClearSessionResponse':
          this.handlePersistenceClearSessionResponseMessage(msg, coordinator);
          break;
        // Profile management messages
        case 'profilesUpdated':
          this.handleProfilesUpdatedMessage(msg, coordinator);
          break;
        case 'defaultProfileChanged':
          this.handleDefaultProfileChangedMessage(msg, coordinator);
          break;
        default:
          this.logger.warn(`Unknown command: ${msg.command}`);
      }
    } catch (error) {
      this.logger.error('Error handling message', error);
    }
  }

  // =================================================================
  // CORE MESSAGE HANDLERS - Complete implementation from original
  // =================================================================

  /**
   * Handle init message from extension
   */
  private handleInitMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    this.logger.info('Handling init message');

    try {
      // Request current settings
      void this.messageQueue.enqueue({
        command: 'getSettings',
      });

      // Emit ready event
      this.emitTerminalInteractionEvent('webview-ready', '', undefined, coordinator);

      // Send confirmation back to extension
      coordinator.postMessageToExtension({
        command: 'test',
        type: 'initComplete',
        data: 'WebView processed INIT message',
        timestamp: Date.now(),
      });

      this.logger.info('INIT processing completed');
    } catch (error) {
      this.logger.error('Error processing INIT message', error);
    }
  }

  /**
   * Handle output message from extension with robust validation
   */
  private handleOutputMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const data = msg.data as string;
    const terminalId = msg.terminalId as string;

    // Critical validation for output message handling
    if (!data || !terminalId) {
      this.logger.error('Invalid output message - missing data or terminalId', {
        hasData: !!data,
        hasTerminalId: !!terminalId,
        terminalId: terminalId,
      });
      return;
    }

    if (typeof terminalId !== 'string' || terminalId.trim() === '') {
      this.logger.error('Invalid terminalId format', terminalId);
      return;
    }

    // Validate terminal exists before processing output
    const terminal = coordinator.getTerminalInstance(terminalId);
    if (!terminal) {
      this.logger.error(`Output for non-existent terminal: ${terminalId}`, {
        availableTerminals: Array.from(coordinator.getAllTerminalInstances().keys()),
      });
      return;
    }

    this.logger.debug(
      `OUTPUT message received for terminal ${terminal.name} (${terminalId}): ${data.length} chars`
    );

    // Log significant CLI agent patterns for optimization
    if (
      data.length > 2000 &&
      (data.includes('Gemini') || data.includes('gemini') || data.includes('Claude'))
    ) {
      this.logger.info(`CLI Agent output detected for terminal ${terminal.name}`, {
        terminalId,
        terminalName: terminal.name,
        dataLength: data.length,
        containsGeminiPattern: data.includes('Gemini') || data.includes('gemini'),
        containsClaudePattern: data.includes('Claude') || data.includes('claude'),
      });
    }

    try {
      // Use PerformanceManager for buffered write with scroll preservation
      const managers = coordinator.getManagers();
      if (managers && managers.performance) {
        managers.performance.bufferedWrite(data, terminal.terminal, terminalId);
        this.logger.debug(
          `Output buffered via PerformanceManager for ${terminal.name}: ${data.length} chars`
        );
      } else {
        // Fallback to direct write if performance manager is not available
        terminal.terminal.write(data);
        this.logger.debug(`Output written directly to ${terminal.name}: ${data.length} chars`);
      }
    } catch (error) {
      this.logger.error(`Error writing output to terminal ${terminal.name}`, error);
    }
  }

  /**
   * Handle terminal removed message from extension
   */
  private handleTerminalRemovedMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const terminalId = msg.terminalId as string;
    if (terminalId) {
      this.logger.info(`Terminal removed from extension: ${terminalId}`);
      this.handleTerminalRemovedFromExtension(terminalId, coordinator);
    }
  }

  /**
   * Handle terminal removed from extension - clean up UI
   */
  private handleTerminalRemovedFromExtension(
    terminalId: string,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info(`Handling terminal removal from extension: ${terminalId}`);

    if (
      'handleTerminalRemovedFromExtension' in coordinator &&
      typeof coordinator.handleTerminalRemovedFromExtension === 'function'
    ) {
      coordinator.handleTerminalRemovedFromExtension(terminalId);
    } else {
      this.logger.warn('handleTerminalRemovedFromExtension method not found on coordinator');
    }
  }

  /**
   * Handle clear terminal message from extension
   */
  private handleClearTerminalMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    if (terminalId) {
      const terminal = coordinator.getTerminalInstance(terminalId);
      if (terminal) {
        terminal.terminal.clear();
        this.logger.info(`Terminal cleared: ${terminalId}`);
      }
    }
  }

  /**
   * Handle font settings update from extension
   */
  private handleFontSettingsUpdateMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const fontSettings = msg.fontSettings as WebViewFontSettings;
    if (fontSettings) {
      this.logger.info('Font settings update received', fontSettings);
      coordinator.applyFontSettings(fontSettings);
      this.emitTerminalInteractionEvent('font-settings-update', '', fontSettings, coordinator);
    }
  }

  /**
   * Handle settings response from extension
   */
  private handleSettingsResponseMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const settings = msg.settings;
    if (settings) {
      this.logger.info('Settings response received');
      this.emitTerminalInteractionEvent('settings-update', '', settings, coordinator);
    }
  }

  /**
   * Handle terminal created message from extension
   */
  private async handleTerminalCreatedMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    const terminalId = msg.terminalId as string;
    const terminalName = msg.terminalName as string;
    const terminalNumber = msg.terminalNumber as number; // Extract terminal number from Extension
    const config = msg.config;

    if (terminalId && terminalName && config) {
      this.logger.info(
        `🔍 TERMINAL_CREATED message received: ${terminalId} (${terminalName}) #${terminalNumber || 'unknown'}`
      );
      this.logger.info(
        `🔍 Current terminal count before creation: ${coordinator.getAllTerminalInstances().size}`
      );

      const result = await coordinator.createTerminal(
        terminalId,
        terminalName,
        config,
        terminalNumber
      );

      this.logger.info(`🔍 Terminal creation result: ${result ? 'SUCCESS' : 'FAILED'}`);
      this.logger.info(
        `🔍 Current terminal count after creation: ${coordinator.getAllTerminalInstances().size}`
      );

      this.logger.debug('createTerminal result', {
        terminalId,
        terminalName,
        terminalNumber, // Log the received terminal number
        success: !!result,
        existingTerminals: Array.from(coordinator.getAllTerminalInstances().keys()),
      });
    } else {
      this.logger.error('Invalid terminalCreated message', {
        hasTerminalId: !!terminalId,
        hasTerminalName: !!terminalName,
        hasTerminalNumber: !!terminalNumber, // Check terminal number presence
        hasConfig: !!config,
      });
    }
  }

  /**
   * Handle new terminal creation message
   */
  private handleNewTerminalMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    const terminalName = msg.terminalName as string;
    const config = msg.config;

    if (terminalId && terminalName) {
      this.logger.info(`New terminal request: ${terminalId} (${terminalName})`);
      this.emitTerminalInteractionEvent(
        'new-terminal',
        terminalId,
        { terminalName, config },
        coordinator
      );
    }
  }

  /**
   * Handle focus terminal message
   */
  private handleFocusTerminalMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    if (terminalId) {
      coordinator.ensureTerminalFocus(terminalId);
      this.logger.info(`Terminal focused: ${terminalId}`);
    }
  }

  /**
   * Handle state update message
   */
  private handleStateUpdateMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const state = msg.state;
    if (state) {
      this.logger.info('State update received');

      if ('updateState' in coordinator && typeof coordinator.updateState === 'function') {
        coordinator.updateState(state);
      } else {
        this.logger.warn('updateState method not found on coordinator');
      }
    } else {
      this.logger.warn('No state data in stateUpdate message');
    }
  }

  /**
   * Handle Claude status update message from extension
   */
  /**
   * Map legacy status values to new status format
   */
  /**
   * Handle full CLI Agent state sync message from extension
   */
  // =================================================================
  // IMESSAGEMANAGER INTERFACE IMPLEMENTATION
  // =================================================================

  public sendReadyMessage(_coordinator: IManagerCoordinator): void {
    void this.messageQueue.enqueue({
      command: 'ready',
      timestamp: Date.now(),
    });
    this.logger.info('Ready message sent');
  }

  public handleCliAgentFullStateSyncMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.cliAgentController.handleFullStateSyncMessage(msg, coordinator);
  }

  /**
   * Post message to extension (required by IMessageManager interface)
   */
  public postMessage(message: unknown): void {
    void this.messageQueue.enqueue(message);
    this.logger.debug('Message posted to queue', { message });
  }

  public emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    coordinator: IManagerCoordinator
  ): void {
    try {
      coordinator.postMessageToExtension({
        command: 'terminalInteraction',
        type,
        terminalId,
        data,
        timestamp: Date.now(),
      });
      this.logger.debug(`Terminal interaction event sent: ${type} for ${terminalId}`);
    } catch (error) {
      this.logger.error('Error emitting terminal interaction event', error);
    }
  }

  public getQueueStats(): {
    queueSize: number;
    isProcessing: boolean;
    highPriorityQueueSize?: number;
    isLocked?: boolean;
  } {
    const stats = this.messageQueue.getQueueStats();
    return {
      queueSize: stats.normal, // Return normal queue size as the main queue size
      isProcessing: stats.isProcessing,
      highPriorityQueueSize: stats.highPriority || 0,
      isLocked: false, // MessageQueue doesn't have lock concept, default to false
    };
  }

  /**
   * Internal method for queue manipulation (used by tests)
   */
  public queueMessage(message: unknown, coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    void this.messageQueue.enqueue(message);
  }

  /**
   * Process message queue manually (used by tests)
   */
  public async processMessageQueue(coordinator?: IManagerCoordinator): Promise<void> {
    if (coordinator) {
      this.coordinator = coordinator;
    }
    // MessageQueue processes automatically, but we can force a flush for testing
    await this.messageQueue.flush();
  }

  public sendInput(input: string, terminalId?: string, coordinator?: IManagerCoordinator): void {
    if (coordinator) {
      // Robust terminal ID resolution with validation
      let resolvedTerminalId: string;

      if (terminalId) {
        // Use provided terminal ID, but validate it exists
        const terminalInstance = coordinator.getTerminalInstance(terminalId);
        if (!terminalInstance) {
          this.logger.error(`Invalid terminal ID provided: ${terminalId}`);
          const activeId = coordinator.getActiveTerminalId();
          if (!activeId) {
            this.logger.error('No active terminal available for input');
            return;
          }
          resolvedTerminalId = activeId;
          this.logger.warn(`Falling back to active terminal: ${resolvedTerminalId}`);
        } else {
          resolvedTerminalId = terminalId;
        }
      } else {
        // Get active terminal with validation
        const activeId = coordinator.getActiveTerminalId();
        if (!activeId) {
          this.logger.error('No active terminal ID available for input');
          return;
        }

        // Double-check the active terminal exists
        const activeTerminal = coordinator.getTerminalInstance(activeId);
        if (!activeTerminal) {
          this.logger.error(`Active terminal ID ${activeId} does not exist`);
          const allTerminals = coordinator.getAllTerminalInstances();
          const firstTerminal = allTerminals.values().next().value;
          if (!firstTerminal) {
            this.logger.error('No terminals available at all');
            return;
          }
          resolvedTerminalId = firstTerminal.id;
          this.logger.warn(`Emergency fallback to first available terminal: ${resolvedTerminalId}`);
        } else {
          resolvedTerminalId = activeId;
        }
      }

      // Final validation before sending input
      const targetTerminal = coordinator.getTerminalInstance(resolvedTerminalId);
      if (!targetTerminal) {
        this.logger.error(`Failed to resolve terminal for input: ${resolvedTerminalId}`);
        return;
      }

      this.logger.info(
        `Sending input to terminal ${targetTerminal.name} (${resolvedTerminalId}): ${input.length} chars`
      );

      void this.messageQueue.enqueue(
        {
          command: 'input',
          data: input,
          terminalId: resolvedTerminalId,
          timestamp: Date.now(),
          terminalName: targetTerminal.name,
        },
        'high' // Input messages have high priority
      );

      this.logger.debug(`Input queued successfully for terminal: ${resolvedTerminalId}`);
    }
  }

  public sendResize(
    cols: number,
    rows: number,
    terminalId?: string,
    coordinator?: IManagerCoordinator
  ): void {
    try {
      const targetCoordinator = coordinator || this.coordinator;
      if (targetCoordinator) {
        targetCoordinator.postMessageToExtension({
          command: 'resize',
          cols,
          rows,
          terminalId: terminalId || targetCoordinator.getActiveTerminalId() || '',
          timestamp: Date.now(),
        });
      }
      this.logger.debug(`Resize sent to terminal: ${cols}x${rows}`);
    } catch (error) {
      this.logger.error('Error sending resize', error);
    }
  }

  public sendDeleteTerminalMessage(
    terminalId: string,
    requestSource: 'header' | 'panel',
    coordinator: IManagerCoordinator
  ): void {
    try {
      coordinator.postMessageToExtension({
        command: 'deleteTerminal',
        terminalId,
        requestSource,
        timestamp: Date.now(),
      });
      this.logger.info(`Delete terminal message sent: ${terminalId} from ${requestSource}`);
    } catch (error) {
      this.logger.error('Error sending delete terminal message', error);
    }
  }

  public sendSwitchAiAgentMessage(terminalId: string, coordinator: IManagerCoordinator): void {
    try {
      coordinator.postMessageToExtension({
        command: 'switchAiAgent',
        terminalId,
        timestamp: Date.now(),
      });
      this.logger.info(`Switch AI agent message sent for terminal: ${terminalId}`);
    } catch (error) {
      this.logger.error('Error sending switch AI agent message', error);
    }
  }

  public sendKillTerminalMessage(_coordinator: IManagerCoordinator): void {
    void this.messageQueue.enqueue({
      command: 'killTerminal',
      timestamp: Date.now(),
    });
    this.logger.info('Kill terminal message sent');
  }

  public sendKillSpecificTerminalMessage(
    terminalId: string,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info(`Sending kill specific terminal message for: ${terminalId}`);

    const message = {
      command: 'killTerminal',
      terminalId,
      timestamp: Date.now(),
    };

    try {
      void this.messageQueue.enqueue(message);
      this.logger.info(`Kill specific terminal message queued successfully for: ${terminalId}`);
    } catch (error) {
      this.logger.error('Error queueing kill message', error);
    }
  }

  public requestSettings(_coordinator: IManagerCoordinator): void {
    void this.messageQueue.enqueue({
      command: 'getSettings',
    });
    this.logger.info('Settings requested');
  }

  public updateSettings(settings: unknown, _coordinator: IManagerCoordinator): void {
    void this.messageQueue.enqueue({
      command: 'updateSettings',
      settings,
    });
    this.logger.info('Settings update sent');
  }

  public requestNewTerminal(_coordinator: IManagerCoordinator): void {
    void this.messageQueue.enqueue({
      command: 'createTerminal',
      timestamp: Date.now(),
    });
    this.logger.info('New terminal requested');
  }

  public clearQueue(): void {
    this.messageQueue.clear();
    this.logger.info('All message queues cleared');
  }

  // =================================================================
  // SESSION MANAGEMENT HANDLERS - Complete session restoration
  // =================================================================

  /**
   * Handle session restore message from extension
   */
  /**
   * Session restore notification handlers
   */
  private handleSetActiveTerminalMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const terminalId = msg.terminalId as string;

    if (!terminalId) {
      this.logger.error('No terminalId provided for setActiveTerminal');
      return;
    }

    this.logger.info(`🔥 [RESTORE-DEBUG] Setting active terminal: ${terminalId}`);

    try {
      coordinator.setActiveTerminalId(terminalId);
      this.logger.info(`✅ [RESTORE-DEBUG] Active terminal set successfully: ${terminalId}`);
    } catch (error) {
      this.logger.error(`❌ [RESTORE-DEBUG] Failed to set active terminal ${terminalId}:`, error);
    }
  }

  /**
   * Shell Integration Message Handlers
   */
  private handleShellStatusMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    const status = msg.status as string;

    if (!terminalId || !status) {
      this.logger.warn('Invalid shell status message', { terminalId, status });
      return;
    }

    // Forward to shell integration manager
    if (
      hasProperty(
        coordinator,
        'shellIntegrationManager',
        (value): value is IShellIntegrationManager =>
          isNonNullObject(value) && 'updateShellStatus' in value
      )
    ) {
      coordinator.shellIntegrationManager.updateShellStatus(terminalId, status);
    }
  }

  private handleCwdUpdateMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    const cwd = msg.cwd as string;

    if (!terminalId || !cwd) {
      this.logger.warn('Invalid CWD update message', { terminalId, cwd });
      return;
    }

    // Forward to shell integration manager
    if (
      hasProperty(
        coordinator,
        'shellIntegrationManager',
        (value): value is IShellIntegrationManager => isNonNullObject(value) && 'updateCwd' in value
      )
    ) {
      coordinator.shellIntegrationManager.updateCwd(terminalId, cwd);
    }
  }

  private handleCommandHistoryMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    const history = msg.history as Array<{ command: string; exitCode?: number; duration?: number }>;

    if (!terminalId || !history) {
      this.logger.warn('Invalid command history message', { terminalId, history });
      return;
    }

    // Forward to shell integration manager
    if (
      hasProperty(
        coordinator,
        'shellIntegrationManager',
        (value): value is IShellIntegrationManager =>
          isNonNullObject(value) && 'showCommandHistory' in value
      )
    ) {
      coordinator.shellIntegrationManager.showCommandHistory(terminalId, history);
    }
  }

  private handleFindMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const action = msg.action as string;

    this.logger.info('Handling find message', { action });

    // Get the active terminal and show search interface
    if (
      hasProperty(
        coordinator,
        'terminalLifecycleManager',
        (value): value is ITerminalLifecycleManager =>
          isNonNullObject(value) && 'getActiveTerminal' in value
      )
    ) {
      const activeTerminalId = coordinator.getActiveTerminalId();
      if (activeTerminalId) {
        const terminalInstance = coordinator.getAllTerminalInstances().get(activeTerminalId);
        if (terminalInstance?.terminal) {
          this.showSearchInterface(terminalInstance.terminal);
        } else {
          this.logger.warn('No terminal instance found for active terminal');
        }
      } else {
        this.logger.warn('No active terminal found for search');
      }
    }
  }

  private showSearchInterface(terminal: Terminal): void {
    // Get or create search addon
    const terminalWithAddons = terminal as ITerminalWithAddons;
    const searchAddon = terminalWithAddons._addonManager?._addons?.find(
      (addon) => addon.addon && addon.addon.findNext
    )?.addon;

    if (searchAddon) {
      // Create search UI
      this.createSearchUI(terminal, searchAddon);
    } else {
      this.logger.error('Search addon not found on terminal');
    }
  }

  private createSearchUI(
    terminal: Terminal,
    searchAddon: { findNext?: () => void; clearDecorations?: () => void }
  ): void {
    // Add CSS styles if not already added
    this.addSearchStyles();

    // Find or create search container
    let searchContainer = document.getElementById('terminal-search-container');
    if (!searchContainer) {
      searchContainer = document.createElement('div');
      searchContainer.id = 'terminal-search-container';
      searchContainer.className = 'terminal-search-container';

      searchContainer.innerHTML = `
        <div class="search-box">
          <input type="text" class="search-input" placeholder="Search..." />
          <button class="search-btn search-next" title="Find Next">↓</button>
          <button class="search-btn search-prev" title="Find Previous">↑</button>
          <button class="search-btn search-close" title="Close">×</button>
        </div>
      `;

      // Insert search container at the top of terminal container
      const terminalContainer = document.querySelector('.terminal-container');
      if (terminalContainer) {
        terminalContainer.insertBefore(searchContainer, terminalContainer.firstChild);
      }

      // Add search functionality
      this.setupSearchEventListeners(searchContainer, searchAddon);
    }

    // Show search container and focus input
    searchContainer.style.display = 'block';
    const searchInput = searchContainer.querySelector('.search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }

  private addSearchStyles(): void {
    if (document.getElementById('terminal-search-styles')) {
      return; // Styles already added
    }

    const style = document.createElement('style');
    style.id = 'terminal-search-styles';
    style.textContent = `
      .terminal-search-container {
        display: none;
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1000;
        background-color: var(--vscode-editor-background, #1e1e1e);
        border: 1px solid var(--vscode-panel-border, #454545);
        border-radius: 4px;
        padding: 4px;
        margin: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      
      .search-box {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .search-input {
        background-color: var(--vscode-input-background, #3c3c3c);
        border: 1px solid var(--vscode-input-border, #454545);
        color: var(--vscode-input-foreground, #cccccc);
        padding: 4px 8px;
        font-size: 13px;
        font-family: var(--vscode-editor-font-family, monospace);
        border-radius: 2px;
        width: 200px;
      }
      
      .search-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder, #007acc);
      }
      
      .search-btn {
        background-color: var(--vscode-button-background, #0e639c);
        border: none;
        color: var(--vscode-button-foreground, #ffffff);
        padding: 4px 8px;
        font-size: 12px;
        border-radius: 2px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
      }
      
      .search-btn:hover {
        background-color: var(--vscode-button-hoverBackground, #1177bb);
      }
      
      .search-btn:active {
        background-color: var(--vscode-button-background, #0e639c);
      }
      
      .search-close {
        background-color: var(--vscode-button-secondaryBackground, #5a5d5e);
      }
      
      .search-close:hover {
        background-color: var(--vscode-button-secondaryHoverBackground, #656565);
      }
    `;

    document.head.appendChild(style);
  }

  private setupSearchEventListeners(
    container: HTMLElement,
    searchAddon: { findNext?: () => void; clearDecorations?: () => void }
  ): void {
    const searchInput = container.querySelector('.search-input') as HTMLInputElement;
    const nextBtn = container.querySelector('.search-next') as HTMLButtonElement;
    const prevBtn = container.querySelector('.search-prev') as HTMLButtonElement;
    const closeBtn = container.querySelector('.search-close') as HTMLButtonElement;

    if (!searchInput || !nextBtn || !prevBtn || !closeBtn) {
      this.logger.error('Search UI elements not found');
      return;
    }

    // Search on input change
    searchInput.addEventListener('input', (e) => {
      const searchTerm = (e.target as HTMLInputElement).value;
      if (searchTerm) {
        searchAddon.findNext?.();
      } else {
        searchAddon.clearDecorations?.();
      }
    });

    // Search on Enter
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const searchTerm = searchInput.value;
        if (searchTerm) {
          if (e.shiftKey && (searchAddon as any).findPrevious) {
            (searchAddon as any).findPrevious();
          } else {
            searchAddon.findNext?.();
          }
        }
      } else if (e.key === 'Escape') {
        this.hideSearchInterface();
      }
    });

    // Next button
    nextBtn.addEventListener('click', () => {
      const searchTerm = searchInput.value;
      if (searchTerm) {
        searchAddon.findNext?.();
      }
    });

    // Previous button
    prevBtn.addEventListener('click', () => {
      const searchTerm = searchInput.value;
      if (searchTerm && (searchAddon as any).findPrevious) {
        (searchAddon as any).findPrevious();
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => {
      this.hideSearchInterface();
    });
  }

  private hideSearchInterface(): void {
    const searchContainer = document.getElementById('terminal-search-container');
    if (searchContainer) {
      searchContainer.style.display = 'none';

      // Clear any search decorations
      const terminals = document.querySelectorAll('.xterm');
      terminals.forEach((terminalElement) => {
        const elementWithTerminal = terminalElement as HTMLElement & {
          _terminal?: ITerminalWithAddons;
        };
        const terminal = elementWithTerminal._terminal;
        if (terminal) {
          const searchAddon = terminal._addonManager?._addons?.find(
            (addon) => addon.addon && addon.addon.clearDecorations
          )?.addon;
          if (searchAddon && searchAddon.clearDecorations) {
            searchAddon.clearDecorations();
          }
        }
      });
    }
  }

  // =================================================================
  // SCROLLBACK MANAGEMENT HANDLERS - Complete scrollback functionality
  // =================================================================

  /**
   * Handle scrollback extraction request
   */
  private handleGetScrollbackMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    this.logger.info('Handling get scrollback message');

    const terminalId = msg.terminalId as string;
    const maxLines = (msg.maxLines as number) || 1000;

    if (!terminalId) {
      this.logger.error('No terminal ID provided for scrollback extraction');
      return;
    }

    // Get terminal instance instead of element
    const terminalInstance = coordinator.getTerminalInstance(terminalId);
    if (!terminalInstance) {
      this.logger.error(`Terminal instance not found for ID: ${terminalId}`);
      return;
    }

    try {
      // Extract scrollback from xterm.js
      const scrollbackContent = this.extractScrollbackFromXterm(
        terminalInstance.terminal,
        maxLines
      );

      // Send scrollback data back to extension
      void this.messageQueue.enqueue({
        command: 'scrollbackExtracted',
        terminalId,
        scrollbackContent,
        timestamp: Date.now(),
      });

      this.logger.info(
        `Scrollback extracted for terminal ${terminalId}: ${scrollbackContent.length} lines`
      );
    } catch (error) {
      this.logger.error(
        `Error extracting scrollback: ${error instanceof Error ? error.message : String(error)}`
      );

      void this.messageQueue.enqueue({
        command: 'error',
        error: `Failed to extract scrollback: ${error instanceof Error ? error.message : String(error)}`,
        terminalId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle scrollback restoration request
   */
  private handleRestoreScrollbackMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Handling restore scrollback message');

    const terminalId = msg.terminalId as string;
    // 🔧 FIX: Handle both old and new message formats
    const scrollbackContent = (msg.scrollback || msg.scrollbackContent) as
      | string[]
      | Array<{
          content: string;
          type?: 'output' | 'input' | 'error';
          timestamp?: number;
        }>;

    if (!terminalId || !scrollbackContent) {
      this.logger.error('Invalid scrollback restore request', {
        terminalId,
        hasScrollback: !!scrollbackContent,
      });
      return;
    }

    try {
      // Get terminal instance
      const terminalInstance = coordinator.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        throw new Error(`Terminal instance not found for ID: ${terminalId}`);
      }

      // 🔧 FIX: Handle string array format (most common from persistence)
      let normalizedScrollback: Array<{
        content: string;
        type?: 'output' | 'input' | 'error';
        timestamp?: number;
      }>;

      if (Array.isArray(scrollbackContent) && scrollbackContent.length > 0) {
        if (typeof scrollbackContent[0] === 'string') {
          // Convert string array to object array
          normalizedScrollback = (scrollbackContent as string[]).map((line) => ({
            content: line,
            type: 'output' as const,
          }));
        } else {
          // Already in object format, ensure type is properly typed
          normalizedScrollback = (
            scrollbackContent as Array<{ content: string; type?: string; timestamp?: number }>
          ).map((item) => ({
            content: item.content,
            type: item.type === 'input' || item.type === 'error' ? item.type : ('output' as const),
            timestamp: item.timestamp,
          }));
        }
      } else {
        this.logger.warn('Empty scrollback content');
        return;
      }

      this.logger.info(
        `🔧 [RESTORE-DEBUG] Restoring ${normalizedScrollback.length} lines to terminal ${terminalId}`
      );

      // Restore scrollback to the terminal
      this.restoreScrollbackToXterm(terminalInstance.terminal, normalizedScrollback);

      // Send confirmation back to extension
      void this.messageQueue.enqueue({
        command: 'scrollbackRestored',
        terminalId,
        restoredLines: normalizedScrollback.length,
        timestamp: Date.now(),
      });

      this.logger.info(
        `✅ [RESTORE-DEBUG] Scrollback restored for terminal ${terminalId}: ${normalizedScrollback.length} lines`
      );
    } catch (error) {
      this.logger.error(
        `❌ [RESTORE-DEBUG] Error restoring scrollback: ${error instanceof Error ? error.message : String(error)}`
      );

      void this.messageQueue.enqueue({
        command: 'error',
        error: `Failed to restore scrollback: ${error instanceof Error ? error.message : String(error)}`,
        terminalId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle scrollback progress updates
   */
  private handleScrollbackProgressMessage(msg: MessageCommand): void {
    this.logger.info('Handling scrollback progress message');

    const progressInfo = msg.scrollbackProgress as {
      terminalId: string;
      progress: number;
      currentLines: number;
      totalLines: number;
      stage: 'loading' | 'decompressing' | 'restoring';
    };

    if (!progressInfo) {
      this.logger.error('No progress information provided');
      return;
    }

    // Show progress notification
    this.logger.info(
      `Scrollback progress: ${progressInfo.progress}% (${progressInfo.currentLines}/${progressInfo.totalLines})`
    );
  }

  /**
   * Extract scrollback content from xterm terminal (improved version)
   */
  private extractScrollbackFromXterm(
    terminal: Terminal,
    maxLines: number
  ): Array<{ content: string; type?: 'output' | 'input' | 'error'; timestamp?: number }> {
    this.logger.debug(`Extracting scrollback from xterm terminal (max ${maxLines} lines)`);

    if (!terminal) {
      throw new Error('Terminal instance not provided');
    }

    const scrollbackLines: Array<{
      content: string;
      type?: 'output' | 'input' | 'error';
      timestamp?: number;
    }> = [];

    try {
      // Get active buffer from xterm.js
      const buffer = terminal.buffer.active;
      const bufferLength = buffer.length;
      const viewportY = buffer.viewportY;
      const baseY = buffer.baseY;

      this.logger.debug(
        `Buffer info: length=${bufferLength}, viewportY=${viewportY}, baseY=${baseY}`
      );

      // Calculate range to extract (include scrollback + viewport)
      const startLine = Math.max(0, bufferLength - maxLines);
      const endLine = bufferLength;

      this.logger.debug(
        `Extracting lines ${startLine} to ${endLine} (${endLine - startLine} lines)`
      );

      for (let i = startLine; i < endLine; i++) {
        try {
          const line = buffer.getLine(i);
          if (line) {
            const content = line.translateToString(true); // trim whitespace

            // Include non-empty lines and preserve some empty lines for structure
            if (content.trim() || scrollbackLines.length > 0) {
              scrollbackLines.push({
                content: content,
                type: 'output',
                timestamp: Date.now(),
              });
            }
          }
        } catch (lineError) {
          this.logger.warn(`Error extracting line ${i}: ${String(lineError)}`);
          continue;
        }
      }

      // Remove trailing empty lines
      while (scrollbackLines.length > 0) {
        const lastLine = scrollbackLines[scrollbackLines.length - 1];
        if (!lastLine || !lastLine.content.trim()) {
          scrollbackLines.pop();
        } else {
          break;
        }
      }

      this.logger.info(
        `Successfully extracted ${scrollbackLines.length} lines from terminal buffer`
      );
    } catch (error) {
      this.logger.error(`Error accessing terminal buffer: ${String(error)}`);
      throw error;
    }

    return scrollbackLines;
  }

  /**
   * Restore scrollback content to xterm terminal
   */
  private restoreScrollbackToXterm(
    terminal: Terminal,
    scrollbackContent: Array<{
      content: string;
      type?: 'output' | 'input' | 'error';
      timestamp?: number;
    }>
  ): void {
    this.logger.info(`Restoring ${scrollbackContent.length} lines to terminal`);

    if (!terminal) {
      throw new Error('Terminal instance not provided');
    }

    // Write each line to the terminal
    for (const line of scrollbackContent) {
      terminal.writeln(line.content);
    }

    this.logger.info(`Restored ${scrollbackContent.length} lines to terminal`);
  }

  /**
   * 🆕 MANUAL RESET: Handle AI Agent toggle response from extension
   */
  // =================================================================
  // ADDITIONAL HANDLERS - Complete remaining functionality
  // =================================================================

  /**
   * Handle panel location update message
   */
  private handlePanelLocationUpdateMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    try {
      const location = ((msg as any).location as 'sidebar' | 'panel') || 'sidebar';
      this.logger.info(`Panel location update: ${location}`);

      // Get split manager from coordinator
      const splitManager = (coordinator as { getSplitManager?: () => unknown }).getSplitManager?.();
      if (!splitManager) {
        this.logger.warn('SplitManager not available on coordinator');
        return;
      }

      // Check if dynamic split direction is enabled via settings
      const configManager = (
        coordinator as { getManagers?: () => { config?: unknown } }
      ).getManagers?.()?.config;
      let isDynamicSplitEnabled = true; // Default to enabled

      if (configManager) {
        try {
          if (
            hasProperty(
              configManager,
              'loadSettings',
              (value): value is () => { dynamicSplitDirection?: boolean; [key: string]: unknown } =>
                typeof value === 'function'
            )
          ) {
            const settings = configManager.loadSettings();
            isDynamicSplitEnabled = settings.dynamicSplitDirection !== false;
          }
        } catch (error) {
          this.logger.warn('Could not load settings, using default behavior');
        }
      }

      if (!isDynamicSplitEnabled) {
        this.logger.info(
          'Dynamic split direction is disabled via settings, ignoring location update'
        );
        return;
      }

      // Update split direction based on panel location
      const newSplitDirection = location === 'panel' ? 'horizontal' : 'vertical';
      this.logger.info(`Updating split direction to: ${newSplitDirection} (location: ${location})`);

      // Update split direction if it has changed
      if (
        hasProperty(
          splitManager,
          'updateSplitDirection',
          (
            value
          ): value is (
            direction: 'horizontal' | 'vertical',
            location: 'sidebar' | 'panel'
          ) => void => typeof value === 'function'
        )
      ) {
        splitManager.updateSplitDirection(newSplitDirection, location);
      }
    } catch (error) {
      this.logger.error('Error handling panel location update', error);
    }
  }

  /**
   * Handle panel location detection request from Extension
   */
  private handleRequestPanelLocationDetectionMessage(_coordinator: IManagerCoordinator): void {
    try {
      this.logger.info('Handling panel location detection request');

      // Analyze WebView dimensions to determine likely panel location
      const detectedLocation = this.analyzeWebViewDimensions();

      this.logger.info(`Dimension analysis result: ${detectedLocation}`);

      // Report back to Extension
      void this.messageQueue.enqueue({
        command: 'reportPanelLocation',
        location: detectedLocation,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('Error in panel location detection', error);
      // Fallback to sidebar
      void this.messageQueue.enqueue({
        command: 'reportPanelLocation',
        location: 'sidebar',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Analyze WebView dimensions to determine panel location
   */
  private analyzeWebViewDimensions(): 'sidebar' | 'panel' {
    try {
      // Get WebView container dimensions
      const container = document.body;
      if (!container) {
        this.logger.warn('No container found, defaulting to sidebar');
        return 'sidebar';
      }

      const width = container.clientWidth;
      const height = container.clientHeight;

      this.logger.debug(`Container dimensions: ${width}x${height}`);

      if (width === 0 || height === 0) {
        this.logger.warn('Invalid dimensions, defaulting to sidebar');
        return 'sidebar';
      }

      // Calculate aspect ratio (width/height)
      const aspectRatio = width / height;

      this.logger.debug(`Aspect ratio: ${aspectRatio.toFixed(2)}`);

      // Heuristic: Sidebar usually narrow and tall, Bottom panel usually wide and short
      if (aspectRatio > 2.0) {
        this.logger.info('Wide layout detected → Bottom Panel');
        return 'panel';
      } else if (aspectRatio < 1.5) {
        this.logger.info('Tall layout detected → Sidebar');
        return 'sidebar';
      } else {
        // Ambiguous, default to sidebar
        this.logger.info('Ambiguous aspect ratio, defaulting to sidebar');
        return 'sidebar';
      }
    } catch (error) {
      this.logger.error('Error analyzing dimensions', error);
      return 'sidebar';
    }
  }

  // More handlers would continue here...

  /**
   * Handle serialization and restoration stub handlers
   */
  private handleSerializeTerminalMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Terminal serialization requested (single terminal)');

    const terminalIds: string[] = [];

    if (typeof msg.terminalId === 'string' && msg.terminalId.trim().length > 0) {
      terminalIds.push(msg.terminalId);
    }

    const additionalIds = (msg as any).terminalIds;
    if (Array.isArray(additionalIds)) {
      additionalIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .forEach((id) => terminalIds.push(id));
    }

    if (terminalIds.length === 0) {
      this.logger.warn('No terminalId provided for serialization request');
      coordinator.postMessageToExtension({
        command: 'terminalSerializationResponse',
        serializationData: {},
        error: 'missing-terminal-id',
        terminalId: msg.terminalId,
        requestId: (msg as any).requestId,
        messageId: (msg as any).messageId,
        timestamp: Date.now(),
      });
      return;
    }

    this.handleRequestTerminalSerializationMessage(
      {
        ...msg,
        terminalIds,
      },
      coordinator
    );
  }

  private handleRestoreSerializedContentMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Restore serialized content requested');

    const terminalId = typeof msg.terminalId === 'string' ? msg.terminalId : undefined;
    const serializedContent = (msg as any).serializedContent as string | undefined;
    const scrollbackData = Array.isArray((msg as any).scrollbackData)
      ? ((msg as any).scrollbackData as unknown[]).filter(
          (line): line is string => typeof line === 'string'
        )
      : undefined;
    const sessionRestoreMessage =
      typeof (msg as any).sessionRestoreMessage === 'string'
        ? ((msg as any).sessionRestoreMessage as string)
        : typeof (msg as any).resumeMessage === 'string'
        ? ((msg as any).resumeMessage as string)
        : undefined;
    const isActive = Boolean((msg as any).isActive);
    const requestId = (msg as any).requestId;
    const messageId = (msg as any).messageId;

    if (!terminalId) {
      this.logger.error('Restore serialized content request missing terminalId');
      coordinator.postMessageToExtension({
        command: 'terminalSerializationRestoreResponse',
        restoredCount: 0,
        totalCount: 0,
        error: 'missing-terminal-id',
        requestId,
        messageId,
        timestamp: Date.now(),
      });
      return;
    }

    const persistenceManager = (coordinator as any).persistenceManager;
    const restoreSessionFn =
      'restoreSession' in coordinator && typeof (coordinator as any).restoreSession === 'function'
        ? ((coordinator as any).restoreSession as (payload: {
            terminalId: string;
            terminalName: string;
            scrollbackData?: string[];
            sessionRestoreMessage?: string;
          }) => Promise<boolean>)
        : undefined;

    void (async () => {
      let restored = false;
      let errorMessage: string | undefined;

      try {
        if (persistenceManager && typeof serializedContent === 'string' && serializedContent.length > 0) {
          restored = Boolean(persistenceManager.restoreTerminalContent(terminalId, serializedContent));
        }

        if (!restored && scrollbackData && scrollbackData.length > 0 && restoreSessionFn) {
          restored = await restoreSessionFn({
            terminalId,
            terminalName:
              typeof msg.terminalName === 'string' ? (msg.terminalName as string) : `Terminal ${terminalId}`,
            scrollbackData,
            sessionRestoreMessage,
          });
        }

        if (restored && isActive) {
          coordinator.setActiveTerminalId(terminalId);
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to restore serialized content for ${terminalId}:`, error);
      } finally {
        coordinator.postMessageToExtension({
          command: 'terminalSerializationRestoreResponse',
          restoredCount: restored ? 1 : 0,
          totalCount: 1,
          success: restored,
          error: errorMessage,
          terminalId,
          requestId,
          messageId,
          timestamp: Date.now(),
        });
      }
    })();
  }

  private handleTerminalRestoreInfoMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Terminal restore info received');

    const terminals = Array.isArray((msg as any).terminals)
      ? ((msg as any).terminals as Array<Record<string, unknown>>)
      : [];
    const activeTerminalId =
      typeof (msg as any).activeTerminalId === 'string' ? ((msg as any).activeTerminalId as string) : null;
    const config = (msg as any).config;

    this.cachedTerminalRestoreInfo = {
      terminals,
      activeTerminalId,
      config,
      timestamp: Date.now(),
    };

    this.logger.debug('Cached terminal restore metadata', {
      terminalCount: terminals.length,
      activeTerminalId,
    });

    try {
      const notificationManager = coordinator.getManagers()?.notification;
      if (notificationManager && terminals.length > 0) {
        notificationManager.showNotificationInTerminal(
          `💾 Session data available for ${terminals.length} terminal${terminals.length === 1 ? '' : 's'}`,
          'info'
        );
      }
    } catch (notificationError) {
      this.logger.warn('Failed to show terminal restore notification', notificationError);
    }
  }

  private handleSaveAllTerminalSessionsMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Save all terminal sessions requested');

    const persistenceManager = (coordinator as any).persistenceManager;
    const requestId = (msg as any).requestId;
    const messageId = (msg as any).messageId;

    if (!persistenceManager) {
      this.logger.error('StandardTerminalPersistenceManager not available for save request');
      coordinator.postMessageToExtension({
        command: 'saveAllTerminalSessionsResponse',
        success: false,
        error: 'persistence-manager-unavailable',
        requestId,
        messageId,
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const terminalIds: string[] = typeof persistenceManager.getAvailableTerminals === 'function'
        ? persistenceManager.getAvailableTerminals()
        : [];

      terminalIds.forEach((terminalId) => {
        try {
          persistenceManager.saveTerminalContent(terminalId);
        } catch (saveError) {
          this.logger.error(`Failed to save session for terminal ${terminalId}:`, saveError);
        }
      });

      coordinator.postMessageToExtension({
        command: 'saveAllTerminalSessionsResponse',
        success: true,
        savedTerminals: terminalIds.length,
        requestId,
        messageId,
        timestamp: Date.now(),
      });

      const notificationManager = coordinator.getManagers()?.notification;
      if (notificationManager) {
        notificationManager.showNotificationInTerminal(
          terminalIds.length > 0
            ? `✅ Saved ${terminalIds.length} terminal session${terminalIds.length === 1 ? '' : 's'}`
            : 'ℹ️ No terminals available to save',
          terminalIds.length > 0 ? 'success' : 'info'
        );
      }
    } catch (error) {
      this.logger.error('Failed to save terminal sessions', error);
      coordinator.postMessageToExtension({
        command: 'saveAllTerminalSessionsResponse',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        requestId,
        messageId,
        timestamp: Date.now(),
      });
    }
  }

  private handleRequestTerminalSerializationMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Request terminal serialization');

    try {
      const terminalIds = Array.isArray((msg as any).terminalIds)
        ? ((msg as any).terminalIds as string[])
        : [];
      const scrollbackLines = (msg as any).scrollbackLines;
      const serializationData: Record<string, string> = {};
      const requestId = (msg as any).requestId;
      const messageId = (msg as any).messageId;

      // Use existing StandardTerminalPersistenceManager for serialization
      const persistenceManager = (coordinator as any).persistenceManager;
      if (!persistenceManager) {
        throw new Error('StandardTerminalPersistenceManager not available');
      }

      if (terminalIds.length === 0) {
        coordinator.postMessageToExtension({
          command: 'terminalSerializationResponse',
          serializationData: {},
          error: 'no-terminal-ids',
          requestId,
          messageId,
          timestamp: Date.now(),
        });
        return;
      }

      // Get serialized content from each terminal via persistence manager
      terminalIds.forEach((terminalId: string) => {
        try {
          // Use serializeTerminal method which returns the serialized content
          const serialized = persistenceManager.serializeTerminal(terminalId, {
            scrollback: typeof scrollbackLines === 'number' ? scrollbackLines : undefined,
          });
          const serializedContent = serialized?.content ?? '';

          if (serializedContent.length > 0) {
            serializationData[terminalId] = serializedContent;
            this.logger.info(
              `Serialized terminal ${terminalId}: ${serializedContent.length} chars`
            );
          } else {
            this.logger.warn(`No serialized content for terminal ${terminalId}`);
          }
        } catch (terminalError) {
          this.logger.error(`Error serializing terminal ${terminalId}:`, terminalError);
        }
      });

      // Send serialized data back to Extension
      coordinator.postMessageToExtension({
        command: 'terminalSerializationResponse',
        serializationData: serializationData,
        requestId,
        messageId,
        timestamp: Date.now(),
      });

      this.logger.info(
        `Terminal serialization completed for ${Object.keys(serializationData).length} terminals`
      );
    } catch (error) {
      this.logger.error('Error during terminal serialization:', error);

      // Send error response to Extension
      coordinator.postMessageToExtension({
        command: 'terminalSerializationResponse',
        serializationData: {},
        error: error instanceof Error ? error.message : String(error),
        requestId: (msg as any).requestId,
        messageId: (msg as any).messageId,
        timestamp: Date.now(),
      });
    }
  }

  private handleRestoreTerminalSerializationMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Restore terminal serialization');

    try {
      const terminalData = (msg as any).terminalData || [];
      let restoredCount = 0;

      // Use existing StandardTerminalPersistenceManager for restoration
      const persistenceManager = (coordinator as any).persistenceManager;
      if (!persistenceManager) {
        throw new Error('StandardTerminalPersistenceManager not available');
      }

      // Restore serialized content to each terminal via persistence manager
      terminalData.forEach((terminal: any) => {
        const { id, serializedContent, isActive } = terminal;

        if (serializedContent && serializedContent.length > 0) {
          try {
            // Use persistence manager to restore terminal content
            const restored = persistenceManager.restoreTerminalContent(id, serializedContent);

            if (restored) {
              // Set as active if needed
              if (isActive) {
                coordinator.setActiveTerminalId(id);
              }

              restoredCount++;
              this.logger.info(`Restored terminal ${id}: ${serializedContent.length} chars`);
            } else {
              this.logger.warn(`Failed to restore terminal ${id} content`);
            }
          } catch (restoreError) {
            this.logger.error(`Error restoring terminal ${id}:`, restoreError);
          }
        } else {
          this.logger.info(`No serialized content for terminal ${id}`);
        }
      });

      // Send restoration completion response
      coordinator.postMessageToExtension({
        command: 'terminalSerializationRestoreResponse',
        restoredCount: restoredCount,
        totalCount: terminalData.length,
        requestId: (msg as any).requestId,
        messageId: (msg as any).messageId,
        timestamp: Date.now(),
      });

      this.logger.info(
        `Terminal serialization restoration completed: ${restoredCount}/${terminalData.length} terminals`
      );
    } catch (error) {
      this.logger.error('Error during terminal serialization restoration:', error);

      // Send error response to Extension
      coordinator.postMessageToExtension({
        command: 'terminalSerializationRestoreResponse',
        restoredCount: 0,
        totalCount: 0,
        error: error instanceof Error ? error.message : String(error),
        requestId: (msg as any).requestId,
        messageId: (msg as any).messageId,
        timestamp: Date.now(),
      });
    }
  }

  private handleSessionRestorationDataMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Session restoration data received');

    const terminalId = typeof msg.terminalId === 'string' ? msg.terminalId : undefined;
    const sessionData = (msg as any).sessionData;
    const requestId = (msg as any).requestId;
    const messageId = (msg as any).messageId;

    if (!terminalId) {
      this.logger.error('Session restoration data missing terminalId');
      coordinator.postMessageToExtension({
        command: 'sessionRestorationDataResponse',
        success: false,
        error: 'missing-terminal-id',
        requestId,
        messageId,
        timestamp: Date.now(),
      });
      return;
    }

    let restorationPayload: unknown = sessionData;

    if (!restorationPayload && this.cachedTerminalRestoreInfo) {
      const fallback = this.cachedTerminalRestoreInfo.terminals.find((terminal) => {
        return isNonNullObject(terminal) && terminal.id === terminalId;
      });

      if (fallback) {
        this.logger.debug('Using cached terminal restore info as fallback payload');
        restorationPayload = fallback;
      }
    }

    if (!restorationPayload) {
      this.logger.warn(`No session data provided for terminal ${terminalId}`);
      coordinator.postMessageToExtension({
        command: 'sessionRestorationDataResponse',
        success: false,
        error: 'no-session-data',
        terminalId,
        requestId,
        messageId,
        timestamp: Date.now(),
      });
      return;
    }

    const normalizedPayload = this.normalizeSessionRestorationPayload(terminalId, restorationPayload);

    if (!normalizedPayload) {
      this.logger.warn('Unable to normalize session restoration payload', sessionData);
      coordinator.postMessageToExtension({
        command: 'sessionRestorationDataResponse',
        success: false,
        error: 'invalid-session-data',
        terminalId,
        requestId,
        messageId,
        timestamp: Date.now(),
      });
      return;
    }

    const persistenceManager = (coordinator as any).persistenceManager;
    const restoreSessionFn =
      'restoreSession' in coordinator && typeof (coordinator as any).restoreSession === 'function'
        ? ((coordinator as any).restoreSession as (payload: {
            terminalId: string;
            terminalName: string;
            scrollbackData?: string[];
            sessionRestoreMessage?: string;
          }) => Promise<boolean>)
        : undefined;

    void (async () => {
      let success = false;
      let errorMessage: string | undefined;

      try {
        if (
          persistenceManager &&
          typeof normalizedPayload.serializedContent === 'string' &&
          normalizedPayload.serializedContent.length > 0
        ) {
          success = Boolean(
            persistenceManager.restoreTerminalContent(terminalId, normalizedPayload.serializedContent)
          );
        }

        if (!success && restoreSessionFn) {
          success = await restoreSessionFn({
            terminalId,
            terminalName: normalizedPayload.terminalName,
            scrollbackData: normalizedPayload.scrollbackData,
            sessionRestoreMessage: normalizedPayload.sessionRestoreMessage,
          });
        }

        if (success && normalizedPayload.isActive) {
          coordinator.setActiveTerminalId(terminalId);
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to apply session restoration payload', error);
      } finally {
        coordinator.postMessageToExtension({
          command: 'sessionRestorationDataResponse',
          success,
          restored: success ? 1 : 0,
          terminalId,
          error: errorMessage,
          requestId,
          messageId,
          timestamp: Date.now(),
        });
      }
    })();
  }

  private normalizeSessionRestorationPayload(
    terminalId: string,
    sessionData: unknown
  ): {
    terminalId: string;
    terminalName: string;
    serializedContent?: string;
    scrollbackData?: string[];
    sessionRestoreMessage?: string;
    isActive?: boolean;
  } | null {
    if (!isNonNullObject(sessionData)) {
      return null;
    }

    const terminalNameCandidate =
      typeof sessionData.name === 'string' && sessionData.name.trim().length > 0
        ? sessionData.name
        : typeof (sessionData as { terminalName?: unknown }).terminalName === 'string'
        ? ((sessionData as { terminalName: string }).terminalName)
        : undefined;

    const serializedContent =
      typeof (sessionData as { serializedContent?: unknown }).serializedContent === 'string'
        ? ((sessionData as { serializedContent: string }).serializedContent)
        : undefined;

    let scrollbackData: string[] | undefined;
    const potentialScrollback = (sessionData as { scrollbackData?: unknown }).scrollbackData;
    if (Array.isArray(potentialScrollback)) {
      scrollbackData = potentialScrollback.filter((line): line is string => typeof line === 'string');
    }

    if (!scrollbackData || scrollbackData.length === 0) {
      const legacyScrollback = (sessionData as { scrollback?: unknown }).scrollback;
      if (Array.isArray(legacyScrollback)) {
        scrollbackData = legacyScrollback.filter((line): line is string => typeof line === 'string');
      }
    }

    const sessionRestoreMessage =
      typeof (sessionData as { sessionRestoreMessage?: unknown }).sessionRestoreMessage === 'string'
        ? ((sessionData as { sessionRestoreMessage: string }).sessionRestoreMessage)
        : typeof (sessionData as { resumeMessage?: unknown }).resumeMessage === 'string'
        ? ((sessionData as { resumeMessage: string }).resumeMessage)
        : undefined;

    const isActive =
      typeof (sessionData as { isActive?: unknown }).isActive === 'boolean'
        ? ((sessionData as { isActive: boolean }).isActive)
        : undefined;

    return {
      terminalId,
      terminalName: terminalNameCandidate || `Terminal ${terminalId}`,
      serializedContent,
      scrollbackData,
      sessionRestoreMessage,
      isActive,
    };
  }

  /**
   * Handle delete terminal response from extension
   */
  private handleDeleteTerminalResponseMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const terminalId = msg.terminalId as string;
    const success = msg.success as boolean;
    const reason = msg.reason as string;

    this.logger.info(
      `Delete terminal response: ${terminalId}, success: ${success}, reason: ${reason || 'none'}`
    );

    if (!success) {
      // Delete failed - restore terminal in WebView if it was removed prematurely
      this.logger.warn(`Terminal deletion failed: ${reason}`);

      // Clear deletion tracking since operation failed
      if (
        'clearTerminalDeletionTracking' in coordinator &&
        typeof coordinator.clearTerminalDeletionTracking === 'function'
      ) {
        coordinator.clearTerminalDeletionTracking(terminalId);
      }

      // Show user notification
      if (coordinator.getManagers && coordinator.getManagers().notification) {
        const notificationManager = coordinator.getManagers().notification;
        if (
          hasProperty(
            notificationManager,
            'showWarning',
            (value): value is (message: string) => void => typeof value === 'function'
          )
        ) {
          notificationManager.showWarning(reason || 'Terminal deletion failed');
        }
      }
    } else {
      // Delete succeeded - terminal should already be removed from WebView
      this.logger.info(`Terminal deletion confirmed by Extension: ${terminalId}`);

      // Ensure terminal is properly removed from WebView
      if ('removeTerminal' in coordinator && typeof coordinator.removeTerminal === 'function') {
        coordinator.removeTerminal(terminalId);
      }
    }
  }

  /**
   * Handle scrollback data extraction request
   */
  private async handleExtractScrollbackDataMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    try {
      const terminalId = msg.terminalId as string;
      const requestId = msg.requestId as string;
      const maxLines = msg.maxLines as number;

      if (!terminalId || !requestId) {
        this.logger.error('Missing terminalId or requestId for scrollback extraction');
        return;
      }

      this.logger.debug(`📦 Extracting scrollback data for terminal ${terminalId}`);

      // Get the terminal instance
      const terminalInstance = coordinator.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        this.logger.error(`Terminal ${terminalId} not found for scrollback extraction`);

        // Send empty response
        await this.postMessage({
          command: 'scrollbackDataCollected',
          terminalId,
          requestId,
          scrollbackData: [],
        });
        return;
      }

      // Extract scrollback data using similar logic to OptimizedPersistenceManager
      const scrollbackData = this.extractScrollbackFromTerminal(terminalInstance, maxLines || 1000);

      this.logger.debug(`📦 Extracted ${scrollbackData.length} lines for terminal ${terminalId}`);

      // Send the scrollback data back to Extension
      this.postMessage({
        command: 'scrollbackDataCollected',
        terminalId,
        requestId,
        scrollbackData,
      });
    } catch (error) {
      this.logger.error('Failed to extract scrollback data', error);

      // Send error response
      this.postMessage({
        command: 'scrollbackDataCollected',
        terminalId: msg.terminalId,
        requestId: msg.requestId,
        scrollbackData: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Extract scrollback data from terminal instance
   */
  private extractScrollbackFromTerminal(terminal: any, maxLines: number): string[] {
    try {
      if (!terminal || !terminal.instance) {
        return [];
      }

      // Try xterm.js serialize addon first (if available)
      if (terminal.instance.serialize) {
        const serialized = terminal.instance.serialize();
        return serialized.split('\n').slice(-maxLines);
      }

      // Fallback: Read from buffer directly
      if (terminal.instance.buffer && terminal.instance.buffer.normal) {
        const buffer = terminal.instance.buffer.normal;
        const lines: string[] = [];

        for (let i = 0; i < Math.min(buffer.length, maxLines); i++) {
          const line = buffer.getLine(i);
          if (line) {
            lines.push(line.translateToString());
          }
        }

        return lines;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to extract scrollback from terminal', error);
      return [];
    }
  }

  // =================================================================
  // PERSISTENCE RESPONSE HANDLERS - Handle Extension responses
  // =================================================================

  /**
   * Handle persistence save session response from extension
   */
  private handlePersistenceSaveSessionResponseMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const messageId = msg.messageId as string;
    const success = msg.success as boolean;
    const error = msg.error as string;
    const terminalCount = msg.terminalCount as number;

    this.logger.info(
      `Persistence save response: success=${success}, terminals=${terminalCount}, error=${error || 'none'}`
    );

    // Forward to OptimizedPersistenceManager if available
    const managers = coordinator.getManagers();
    if (managers?.persistence && 'handlePersistenceResponse' in managers.persistence) {
      (managers.persistence as any).handlePersistenceResponse(messageId, {
        success,
        error,
        terminalCount,
      });
    } else {
      this.logger.warn('OptimizedPersistenceManager not available for response handling');
    }
  }

  /**
   * Handle persistence restore session response from extension
   */
  private handlePersistenceRestoreSessionResponseMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const messageId = msg.messageId as string;
    const success = msg.success as boolean;
    const error = msg.error as string;
    const data = msg.data;
    const terminalCount = msg.terminalCount as number;

    this.logger.info(
      `Persistence restore response: success=${success}, terminals=${terminalCount}, error=${error || 'none'}`
    );

    // Forward to OptimizedPersistenceManager if available
    const managers = coordinator.getManagers();
    if (managers?.persistence && 'handlePersistenceResponse' in managers.persistence) {
      (managers.persistence as any).handlePersistenceResponse(messageId, {
        success,
        error,
        data,
        terminalCount,
      });
    } else {
      this.logger.warn('OptimizedPersistenceManager not available for response handling');
    }
  }

  /**
   * Handle persistence clear session response from extension
   */
  private handlePersistenceClearSessionResponseMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const messageId = msg.messageId as string;
    const success = msg.success as boolean;
    const error = msg.error as string;

    this.logger.info(`Persistence clear response: success=${success}, error=${error || 'none'}`);

    // Forward to OptimizedPersistenceManager if available
    const managers = coordinator.getManagers();
    if (managers?.persistence && 'handlePersistenceResponse' in managers.persistence) {
      (managers.persistence as any).handlePersistenceResponse(messageId, {
        success,
        error,
      });
    } else {
      this.logger.warn('OptimizedPersistenceManager not available for response handling');
    }
  }

  /**
   * Handle profiles updated message
   */
  private handleProfilesUpdatedMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Profiles updated');

    // Forward to ProfileManager if it exists
    const managers = coordinator.getManagers();
    if (managers.profile) {
      managers.profile.handleMessage(msg);
    }
  }

  /**
   * Handle default profile changed message
   */
  private handleDefaultProfileChangedMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Default profile changed');

    // Forward to ProfileManager if it exists
    const managers = coordinator.getManagers();
    if (managers.profile) {
      managers.profile.handleMessage(msg);
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
  /**
   * Handle profiles updated message from extension
   */
  private handleProfilesUpdatedMessage(msg: any, coordinator: IManagerCoordinator): void {
    this.logger.debug('Processing profilesUpdated message');

    try {
      const { profiles, defaultProfileId } = msg;

      if (coordinator.profileManager) {
        coordinator.profileManager.updateProfiles(profiles, defaultProfileId);
        this.logger.info(`Updated ${profiles?.length || 0} terminal profiles`);
      } else {
        this.logger.warn('ProfileManager not available for profiles update');
      }
    } catch (error) {
      this.logger.error('Failed to handle profiles updated message:', error);
    }
  }

  /**
   * Handle default profile changed message from extension
   */
  private handleDefaultProfileChangedMessage(msg: any, coordinator: IManagerCoordinator): void {
    this.logger.debug('Processing defaultProfileChanged message');

    try {
      const { profileId } = msg;

      if (coordinator.profileManager) {
        // Update via ProfileManager's message handler
        coordinator.profileManager.handleMessage({
          command: 'defaultProfileChanged',
          profileId: profileId,
        });
        this.logger.info(`Default profile changed to: ${profileId}`);
      } else {
        this.logger.warn('ProfileManager not available for default profile change');
      }
    } catch (error) {
      this.logger.error('Failed to handle default profile changed message:', error);
    }
  }

  public dispose(): void {
    this.logger.info('Disposing RefactoredMessageManager');

    // Clear message handlers
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.connectionLostHandlers = [];

    // Dispose MessageQueue - this will clean up all queued messages and processing
    this.messageQueue.dispose();

    // Clear coordinator reference
    this.coordinator = undefined;

    this.logger.lifecycle('RefactoredMessageManager', 'completed');
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
}

/**
 * Legacy compatibility methods for factory patterns (if needed)
 */
export class MessageManagerFactory {
  /**
   * Create RefactoredMessageManager instance
   */
  public static create(): RefactoredMessageManager {
    return new RefactoredMessageManager();
  }

  /**
   * Create test MessageManager instance
   */
  public static createForTesting(): RefactoredMessageManager {
    const manager = new RefactoredMessageManager();
    messageLogger.info('🧪 Test MessageManager created');
    return manager;
  }
}
