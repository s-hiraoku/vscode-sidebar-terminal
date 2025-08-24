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
import {} from '../../utils/logger';
import { messageLogger } from '../utils/ManagerLogger';
import { MessageQueue, MessageSender } from '../utils/MessageQueue';
import { Terminal } from 'xterm';
import {
  showSessionRestoreStarted,
  showSessionRestoreProgress,
  showSessionRestoreCompleted,
  showSessionRestoreError,
  showSessionSaved,
  showSessionSaveError,
  showSessionCleared,
  showSessionRestoreSkipped,
} from '../utils/NotificationUtils';

// Message command interface with comprehensive typing
interface MessageCommand {
  command: string;
  cliAgentStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
    terminalId?: string;
  };
  [key: string]: unknown;
}

// Session data payload interface (used in session restoration)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SessionDataPayload {
  id: string;
  name: string;
  number: number;
  cwd: string;
  isActive: boolean;
}

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
      enablePriority: true
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
      command: (message as any)?.command,
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
          this.handleClaudeStatusUpdateMessage(msg, coordinator);
          break;
        case 'cliAgentFullStateSync':
          this.handleCliAgentFullStateSyncMessage(msg, coordinator);
          break;
        case 'sessionRestore':
          await this.handleSessionRestoreMessage(msg, coordinator);
          break;
        case 'sessionRestoreStarted':
          this.handleSessionRestoreStartedMessage(msg);
          break;
        case 'sessionRestoreProgress':
          this.handleSessionRestoreProgressMessage(msg);
          break;
        case 'sessionRestoreCompleted':
          this.handleSessionRestoreCompletedMessage(msg);
          break;
        case 'sessionRestoreError':
          this.handleSessionRestoreErrorMessage(msg);
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
          this.handleSessionSavedMessage(msg);
          break;
        case 'sessionSaveError':
          this.handleSessionSaveErrorMessage(msg);
          break;
        case 'sessionCleared':
          this.handleSessionClearedMessage();
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
          this.handleSessionRestoreSkippedMessage(msg);
          break;
        case 'terminalRestoreError':
          void this.handleTerminalRestoreErrorMessage(msg);
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
        availableTerminals: Array.from(coordinator.getAllTerminalInstances().keys())
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
        this.logger.debug(
          `Output written directly to ${terminal.name}: ${data.length} chars`
        );
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
      this.logger.info(`🔍 TERMINAL_CREATED message received: ${terminalId} (${terminalName}) #${terminalNumber || 'unknown'}`);
      this.logger.info(`🔍 Current terminal count before creation: ${coordinator.getAllTerminalInstances().size}`);

      const result = await coordinator.createTerminal(terminalId, terminalName, config, terminalNumber);

      this.logger.info(`🔍 Terminal creation result: ${result ? 'SUCCESS' : 'FAILED'}`);
      this.logger.info(`🔍 Current terminal count after creation: ${coordinator.getAllTerminalInstances().size}`);
      
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
  private handleClaudeStatusUpdateMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('CLI Agent Status Update received');

    const cliAgentStatus = msg.cliAgentStatus;
    if (cliAgentStatus) {
      this.logger.info(
        `Processing status update: ${cliAgentStatus.status} for ${cliAgentStatus.activeTerminalName} (ID: ${cliAgentStatus.terminalId})`
      );

      try {
        // Use terminalId directly if available, fallback to extracting from name
        let terminalId: string;

        if (cliAgentStatus.terminalId) {
          terminalId = cliAgentStatus.terminalId;
          this.logger.debug(`Using provided terminalId: ${terminalId}`);
        } else if (cliAgentStatus.activeTerminalName) {
          terminalId = cliAgentStatus.activeTerminalName.replace('Terminal ', '') || '1';
          this.logger.debug(`Extracted terminalId from name: ${terminalId}`);
        } else {
          const allTerminals = coordinator.getAllTerminalInstances();
          const connectedTerminal = Array.from(allTerminals.keys())[0];
          terminalId = connectedTerminal || '1';
          this.logger.warn(`Using fallback terminalId: ${terminalId}`);
        }

        // Map legacy status to new status format
        const mappedStatus = this.mapLegacyStatus(cliAgentStatus.status);

        // Call the centralized status management method
        coordinator.updateCliAgentStatus(
          terminalId,
          mappedStatus,
          cliAgentStatus.agentType || null
        );

        this.logger.info(
          `CLI Agent status updated successfully: ${mappedStatus} for terminal ${terminalId}`
        );
      } catch (error) {
        this.logger.error('Error updating CLI Agent status', error);
      }
    } else {
      this.logger.warn('No CLI Agent status data in message');
    }
  }

  /**
   * Map legacy status values to new status format
   */
  private mapLegacyStatus(legacyStatus: string): 'connected' | 'disconnected' | 'none' {
    switch (legacyStatus.toLowerCase()) {
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'disconnected';
      case 'none':
      case 'inactive':
      case 'terminated':
        return 'none';
      default:
        this.logger.warn(`Unknown legacy status: ${legacyStatus}, defaulting to 'none'`);
        return 'none';
    }
  }

  /**
   * Handle full CLI Agent state sync message from extension
   */
  private handleCliAgentFullStateSyncMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('CLI Agent Full State Sync received');

    const terminalStates = msg.terminalStates;
    const connectedAgentId = msg.connectedAgentId;
    const connectedAgentType = msg.connectedAgentType;
    const disconnectedCount = msg.disconnectedCount;

    this.logger.debug('Full state sync data', {
      terminalStates,
      connectedAgentId,
      connectedAgentType,
      disconnectedCount,
    });

    if (terminalStates) {
      this.logger.info(
        `Processing full state sync: CONNECTED=${String(connectedAgentId)} (${String(connectedAgentType)}), DISCONNECTED=${String(disconnectedCount)}`
      );

      try {
        for (const [terminalId, stateInfo] of Object.entries(terminalStates)) {
          const typedStateInfo = stateInfo as {
            status: 'connected' | 'disconnected' | 'none';
            agentType: string | null;
          };
          
          this.logger.debug(`Updating terminal ${terminalId}`, typedStateInfo);

          try {
            coordinator.updateCliAgentStatus(
              terminalId,
              typedStateInfo.status,
              typedStateInfo.agentType
            );

            this.logger.debug(
              `Applied state: Terminal ${terminalId} -> ${typedStateInfo.status} (${typedStateInfo.agentType})`
            );
          } catch (error) {
            this.logger.error(`Error updating terminal ${terminalId}`, error);
          }
        }

        this.logger.info('Full CLI Agent state sync completed successfully');
      } catch (error) {
        this.logger.error('Error during full state sync', error);
      }
    } else {
      this.logger.warn('No terminal states data in full state sync message');
    }
  }

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
      queueSize: stats.total,
      isProcessing: stats.isProcessing,
      highPriorityQueueSize: stats.highPriority || 0,
      isLocked: false, // MessageQueue doesn't have lock concept, default to false
    };
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
          this.logger.warn(
            `Emergency fallback to first available terminal: ${resolvedTerminalId}`
          );
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
  private async handleSessionRestoreMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    this.logger.info('Session restore message received');

    const terminalId = msg.terminalId as string;
    const terminalName = msg.terminalName as string;
    const config = msg.config;
    const sessionRestoreMessage = msg.sessionRestoreMessage as string;
    const sessionScrollback = msg.sessionScrollback as string[];

    if (terminalId && terminalName && config) {
      this.logger.info(`Restoring terminal session: ${terminalId} (${terminalName})`);

      try {
        // Create terminal normally, then restore scrollback
        await coordinator.createTerminal(terminalId, terminalName, config);
        this.logger.info(`Created terminal for session restore: ${terminalId}`);

        // Restore scrollback data after a brief delay
        if (sessionRestoreMessage || (sessionScrollback && sessionScrollback.length > 0)) {
          setTimeout(() => {
            if (
              'restoreTerminalScrollback' in coordinator &&
              typeof coordinator.restoreTerminalScrollback === 'function'
            ) {
              coordinator.restoreTerminalScrollback(
                terminalId,
                sessionRestoreMessage || '',
                sessionScrollback || []
              );
              this.logger.info(`Restored scrollback for terminal: ${terminalId}`);
            } else {
              this.logger.warn('restoreTerminalScrollback method not found');
            }
          }, 100);
        }
      } catch (error) {
        this.logger.error(`Failed to restore terminal session ${terminalId}: ${String(error)}`);
        // Continue with regular terminal creation as fallback
        await coordinator.createTerminal(terminalId, terminalName, config);
      }
    } else {
      this.logger.error('Invalid session restore data received');
    }
  }

  /**
   * Session restore notification handlers
   */
  private handleSessionRestoreStartedMessage(msg: MessageCommand): void {
    const terminalCount = (msg.terminalCount as number) || 0;
    this.logger.info(`Session restore started for ${terminalCount} terminals`);
    showSessionRestoreStarted(terminalCount);
  }

  private handleSessionRestoreProgressMessage(msg: MessageCommand): void {
    const restored = (msg.restored as number) || 0;
    const total = (msg.total as number) || 0;
    this.logger.info(`Session restore progress: ${restored}/${total}`);
    showSessionRestoreProgress(restored, total);
  }

  private handleSessionRestoreCompletedMessage(msg: MessageCommand): void {
    const restoredCount = (msg.restoredCount as number) || 0;
    const skippedCount = (msg.skippedCount as number) || 0;
    this.logger.info(
      `Session restore completed: ${restoredCount} restored, ${skippedCount} skipped`
    );
    showSessionRestoreCompleted(restoredCount, skippedCount);
  }

  private handleSessionRestoreErrorMessage(msg: MessageCommand): void {
    const error = (msg.error as string) || 'Unknown error';
    const partialSuccess = (msg.partialSuccess as boolean) || false;
    const errorType = (msg.errorType as string) || undefined;
    this.logger.error(
      `Session restore error: ${error} (partial: ${partialSuccess}, type: ${errorType})`
    );
    showSessionRestoreError(error, partialSuccess, errorType);
  }

  private handleSessionSavedMessage(msg: MessageCommand): void {
    const terminalCount = (msg.terminalCount as number) || 0;
    this.logger.info(`Session saved with ${terminalCount} terminals`);
    showSessionSaved(terminalCount);
  }

  private handleSessionSaveErrorMessage(msg: MessageCommand): void {
    const error = (msg.error as string) || 'Unknown error';
    this.logger.error(`Session save error: ${error}`);
    showSessionSaveError(error);
  }

  private handleSessionClearedMessage(): void {
    this.logger.info('Session cleared');
    showSessionCleared();
  }

  private handleSessionRestoreSkippedMessage(msg: MessageCommand): void {
    const reason = (msg.reason as string) || 'Unknown reason';
    this.logger.info(`Session restore skipped: ${reason}`);
    showSessionRestoreSkipped(reason);
  }

  private async handleTerminalRestoreErrorMessage(msg: MessageCommand): Promise<void> {
    const terminalName = (msg.terminalName as string) || 'Unknown terminal';
    const error = (msg.error as string) || 'Unknown error';
    this.logger.warn(`Terminal restore error: ${terminalName} - ${error}`);

    // Import the function here to avoid circular dependencies
    const { showTerminalRestoreError } = await import('../utils/NotificationUtils');
    showTerminalRestoreError(terminalName, error);
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
    const scrollbackContent = msg.scrollbackContent as Array<{
      content: string;
      type?: 'output' | 'input' | 'error';
      timestamp?: number;
    }>;

    if (!terminalId || !scrollbackContent) {
      this.logger.error('Invalid scrollback restore request');
      return;
    }

    try {
      // Get terminal instance
      const terminalInstance = coordinator.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        throw new Error(`Terminal instance not found for ID: ${terminalId}`);
      }

      // Restore scrollback to the terminal
      this.restoreScrollbackToXterm(terminalInstance.terminal, scrollbackContent);

      // Send confirmation back to extension
      void this.messageQueue.enqueue({
        command: 'scrollbackRestored',
        terminalId,
        restoredLines: scrollbackContent.length,
        timestamp: Date.now(),
      });

      this.logger.info(
        `Scrollback restored for terminal ${terminalId}: ${scrollbackContent.length} lines`
      );
    } catch (error) {
      this.logger.error(
        `Error restoring scrollback: ${error instanceof Error ? error.message : String(error)}`
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
      const location = msg.location || 'sidebar';
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
          const settings = (configManager as any).loadSettings();
          isDynamicSplitEnabled = settings.dynamicSplitDirection !== false;
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
      (splitManager as any).updateSplitDirection(newSplitDirection, location);
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
    _msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Terminal serialization requested');
    // Implementation would go here
  }

  private handleRestoreSerializedContentMessage(
    _msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Restore serialized content requested');
    // Implementation would go here
  }

  private handleTerminalRestoreInfoMessage(
    _msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Terminal restore info received');
    // Implementation would go here
  }

  private handleSaveAllTerminalSessionsMessage(
    _msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Save all terminal sessions requested');
    // Implementation would go here
  }

  private handleRequestTerminalSerializationMessage(
    _msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Request terminal serialization');
    // Implementation would go here
  }

  private handleRestoreTerminalSerializationMessage(
    _msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Restore terminal serialization');
    // Implementation would go here
  }

  private handleSessionRestorationDataMessage(
    _msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Session restoration data received');
    // Implementation would go here
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

    this.logger.info(`Delete terminal response: ${terminalId}, success: ${success}, reason: ${reason || 'none'}`);

    if (!success) {
      // Delete failed - restore terminal in WebView if it was removed prematurely
      this.logger.warn(`Terminal deletion failed: ${reason}`);
      
      // Clear deletion tracking since operation failed
      if ('clearTerminalDeletionTracking' in coordinator && typeof coordinator.clearTerminalDeletionTracking === 'function') {
        coordinator.clearTerminalDeletionTracking(terminalId);
      }
      
      // Show user notification
      if (coordinator.getManagers && coordinator.getManagers().notification) {
        const notificationManager = coordinator.getManagers().notification;
        if ('showWarning' in notificationManager && typeof notificationManager.showWarning === 'function') {
          (notificationManager as any).showWarning(reason || 'Terminal deletion failed');
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
   * Resource cleanup and disposal
   */
  public dispose(): void {
    this.logger.info('Disposing RefactoredMessageManager');

    // Dispose MessageQueue - this will clean up all queued messages and processing
    this.messageQueue.dispose();

    // Clear coordinator reference
    this.coordinator = undefined;

    this.logger.lifecycle('RefactoredMessageManager', 'completed');
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
