/**
 * Refactored Message Manager - Demonstrates similarity-based refactoring
 * Uses BaseManager, ValidationUtils, and MessageHandlerFactory to eliminate duplication
 */

import { TerminalInteractionEvent } from '../../types/common';
import { IMessageManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { BaseManager } from './BaseManager';
import { MessageHandlerFactory } from '../factories/MessageHandlerFactory';
import { ValidationUtils } from '../utils/ValidationUtils';
import { Terminal } from 'xterm';

// Import proper message types
import { WebviewMessage } from '../../types/common';

export class RefactoredMessageManager extends BaseManager implements IMessageManager {
  // Message processing using MessageHandlerFactory
  private queueProcessor: ReturnType<typeof MessageHandlerFactory.createQueueProcessor>;

  constructor() {
    super('MessageManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.queueProcessor = MessageHandlerFactory.createQueueProcessor(undefined, {
      maxConcurrent: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      logPrefix: this.logPrefix,
    });

    this.registerMessageHandlers();
  }

  /**
   * Initialize with coordinator - enhanced BaseManager pattern
   */
  public override initialize(coordinator: IManagerCoordinator): Promise<void> {
    return super.initialize(coordinator).then(() => {
      // Update queue processor with coordinator
      this.queueProcessor = MessageHandlerFactory.createQueueProcessor(coordinator, {
        maxConcurrent: 5,
        retryAttempts: 3,
        retryDelay: 1000,
        logPrefix: this.logPrefix,
      });
    });
  }

  /**
   * Register message handlers using MessageHandlerFactory pattern
   */
  private registerMessageHandlers(): void {
    const validators = MessageHandlerFactory.createCommonValidators();

    // Init command handler
    MessageHandlerFactory.registerHandler(
      {
        command: 'init',
        requiresCoordinator: true,
        logPrefix: this.logPrefix,
      },
      (message, coordinator) => this.handleInitMessage(message, coordinator)
    );

    // Output command handler
    MessageHandlerFactory.registerHandler(
      {
        command: 'output',
        validator: validators.terminalOutput,
        requiresCoordinator: true,
        logPrefix: this.logPrefix,
      },
      (message, coordinator) => this.handleOutputMessage(message, coordinator)
    );

    // Clear terminal handler
    MessageHandlerFactory.registerHandler(
      {
        command: 'clear',
        validator: validators.terminalId,
        requiresCoordinator: true,
        logPrefix: this.logPrefix,
      },
      (message, coordinator) => this.handleClearTerminalMessage(message, coordinator)
    );

    // CLI Agent status update handler
    MessageHandlerFactory.registerHandler(
      {
        command: 'cliAgentStatusUpdate',
        requiresCoordinator: true,
        logPrefix: this.logPrefix,
      },
      (message, _coordinator) => this.handleCliAgentStatusUpdate(message, _coordinator)
    );

    // Settings response handler
    MessageHandlerFactory.registerHandler(
      {
        command: 'settingsResponse',
        validator: validators.settings,
        requiresCoordinator: true,
        logPrefix: this.logPrefix,
      },
      (message, coordinator) => this.handleSettingsResponseMessage(message, coordinator)
    );

    // Add more handlers as needed...
    this.log('All message handlers registered successfully');
  }

  /**
   * Handle incoming messages - simplified with validation
   */
  public handleMessage(message: MessageEvent, coordinator: IManagerCoordinator): void {
    return this.validateAndExecute(
      () => {
        const msg = message.data as WebviewMessage;
        this.log(`📨 Received: ${msg.command}`);

        // Process message using queue processor
        this.queueProcessor.process(msg).catch((error) => {
          this.handleError(error, `Failed to process command: ${msg.command}`);
        });
      },
      [
        () => this.validateMessage(message.data),
        () => ValidationUtils.validateCoordinator(coordinator),
      ],
      'Failed to handle message'
    );
  }

  /**
   * Individual message handlers using BaseManager patterns
   */
  private handleInitMessage(message: any, coordinator: IManagerCoordinator): void {
    return this.validateAndExecute(
      () => {
        const managers = coordinator.getManagers();
        if (managers?.ui) {
          // Use safe coordinator operation
          this.safeCoordinatorOperation((coord) => coord.log('UI Manager initialized'), undefined);
        }
        this.log('Init message processed successfully');
      },
      [],
      'Failed to handle init message'
    );
  }

  private handleOutputMessage(message: any, coordinator: IManagerCoordinator): void {
    return this.validateAndExecute(
      () => {
        const { data, terminalId } = message;

        if (!data) {
          throw new Error('Output data is required');
        }

        const terminalInstance = coordinator.getTerminalInstance(terminalId);
        if (!terminalInstance) {
          throw new Error(`Terminal ${terminalId} not found`);
        }

        // Use PerformanceManager for buffered write with scroll preservation
        const managers = coordinator.getManagers();
        if (managers?.performance) {
          managers.performance.bufferedWrite(data, terminalInstance.terminal, terminalId);
          this.log(`Output buffered to terminal ${terminalId}: ${data.length} chars`);
        } else {
          // Fallback to direct write
          terminalInstance.terminal.write(data);
          this.log(`Direct write to terminal ${terminalId}: ${data.length} chars`);
        }
      },
      [
        () => ValidationUtils.validateString(message.terminalId, 'Terminal ID'),
        () => ValidationUtils.sanitizeData(message.data, 1024 * 1024),
      ],
      'Failed to handle output message'
    );
  }

  private handleClearTerminalMessage(message: any, coordinator: IManagerCoordinator): void {
    return this.validateAndExecute(
      () => {
        const { terminalId } = message;
        const terminalInstance = coordinator.getTerminalInstance(terminalId);

        if (!terminalInstance) {
          throw new Error(`Terminal ${terminalId} not found`);
        }

        terminalInstance.terminal.clear();
        this.log(`Cleared terminal: ${terminalId}`);
      },
      [() => ValidationUtils.validateTerminalId(message.terminalId)],
      'Failed to clear terminal'
    );
  }

  private handleCliAgentStatusUpdate(message: any, _coordinator: IManagerCoordinator): void {
    return this.validateAndExecute(
      () => {
        const { cliAgentStatus } = message;

        if (!cliAgentStatus) {
          throw new Error('CLI agent status data is required');
        }

        // Use safe coordinator operation for status update
        this.safeCoordinatorOperation((coord) => {
          coord.updateCliAgentStatus(
            cliAgentStatus.activeTerminalName,
            cliAgentStatus.status,
            cliAgentStatus.agentType
          );
        }, undefined);

        this.log(`CLI Agent status updated: ${cliAgentStatus.status}`);
      },
      [],
      'Failed to update CLI agent status'
    );
  }

  private handleSettingsResponseMessage(message: any, coordinator: IManagerCoordinator): void {
    return this.validateAndExecute(
      () => {
        const { settings } = message;

        if (!settings) {
          throw new Error('Settings data is required');
        }

        // Apply settings to all terminals
        const terminals = coordinator.getAllTerminalInstances();
        for (const [terminalId, terminalInstance] of terminals) {
          try {
            this.applySettingsToTerminal(terminalInstance.terminal, settings);
            this.log(`Applied settings to terminal: ${terminalId}`);
          } catch (error) {
            this.handleError(error, `Failed to apply settings to terminal: ${terminalId}`);
          }
        }
      },
      [() => ValidationUtils.validateTerminalSettings(message.settings)],
      'Failed to handle settings response'
    );
  }

  /**
   * Helper method to apply settings using BaseManager patterns
   */
  private applySettingsToTerminal(terminal: Terminal, settings: any): void {
    this.safeDOMOperation(
      () => {
        // Apply theme
        if (settings.theme) {
          terminal.options.theme = settings.theme;
        }

        // Apply font settings
        if (settings.fontFamily) {
          terminal.options.fontFamily = settings.fontFamily;
        }

        if (settings.fontSize) {
          terminal.options.fontSize = settings.fontSize;
        }

        // Apply cursor settings
        if (typeof settings.cursorBlink === 'boolean') {
          terminal.options.cursorBlink = settings.cursorBlink;
        }

        return true;
      },
      false,
      'Failed to apply settings to terminal'
    );
  }

  /**
   * Queue message for processing - enhanced with validation
   */
  public queueMessage(message: unknown): void {
    return this.validateAndExecute(
      () => {
        this.queueProcessor.process(message as any).catch((error) => {
          this.handleError(error, 'Failed to queue message');
        });
      },
      [() => this.validateMessage(message)],
      'Failed to queue message'
    );
  }

  /**
   * Send switch AI agent message - using enhanced BaseManager
   */
  public sendSwitchAiAgentMessage(terminalId: string, _coordinator: IManagerCoordinator): void {
    return this.validateAndExecute(
      () => {
        const message = {
          command: 'switchAiAgent',
          terminalId,
          timestamp: Date.now(),
        };

        this.safeCoordinatorOperation((coord) => coord.postMessageToExtension(message), undefined);

        this.log(`Switch AI Agent message sent for terminal: ${terminalId}`);
      },
      [() => ValidationUtils.validateTerminalId(terminalId)],
      'Failed to send switch AI agent message'
    );
  }

  /**
   * Send ready message - required by IMessageManager
   */
  public sendReadyMessage(_coordinator: IManagerCoordinator): void {
    const message = {
      command: 'webviewReady',
      timestamp: Date.now(),
    };

    this.safeCoordinatorOperation((coord) => coord.postMessageToExtension(message), undefined);

    this.log('Ready message sent');
  }

  /**
   * Emit terminal interaction event - required by IMessageManager
   */
  public emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    coordinator: IManagerCoordinator
  ): void {
    this.log(`Terminal interaction event: ${type} for terminal ${terminalId}`);
    // Implementation would emit the event through coordinator
    coordinator.postMessageToExtension({
      command: 'terminalInteraction',
      type,
      terminalId,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get queue stats - required by IMessageManager
   */
  public getQueueStats(): { queueSize: number; isProcessing: boolean } {
    return {
      queueSize: this.queueProcessor.getQueueSize(),
      isProcessing: this.queueProcessor.getQueueSize() > 0,
    };
  }

  /**
   * Send input - required by IMessageManager
   */
  public sendInput(input: string, terminalId?: string, coordinator?: IManagerCoordinator): void {
    const message = {
      command: 'input' as const,
      terminalId: terminalId || this.coordinator?.getActiveTerminalId() || '',
      data: input,
      timestamp: Date.now(),
    };

    const coord = coordinator || this.coordinator;
    if (coord) {
      coord.postMessageToExtension(message);
    }
  }

  /**
   * Send delete terminal message - required by IMessageManager
   */
  public sendDeleteTerminalMessage(
    terminalId: string,
    requestSource: 'header' | 'panel',
    coordinator: IManagerCoordinator
  ): void {
    const message = {
      command: 'deleteTerminal' as const,
      terminalId,
      requestSource,
      timestamp: Date.now(),
    };

    coordinator.postMessageToExtension(message);
  }

  /**
   * Send resize - required by IMessageManager
   */
  public sendResize(
    cols: number,
    rows: number,
    terminalId?: string,
    coordinator?: IManagerCoordinator
  ): void {
    const message = {
      command: 'resize' as const,
      terminalId: terminalId || this.coordinator?.getActiveTerminalId() || '',
      cols,
      rows,
      timestamp: Date.now(),
    };

    const coord = coordinator || this.coordinator;
    if (coord) {
      coord.postMessageToExtension(message);
    }
  }

  /**
   * Enhanced dispose method
   */
  public override dispose(): void {
    // Clear queue processor
    this.queueProcessor.clearQueue();

    // Clear registered handlers
    MessageHandlerFactory.clearHandlers();

    // Call parent dispose
    super.dispose();

    this.log('RefactoredMessageManager disposed successfully');
  }

  /**
   * Get manager statistics for monitoring
   */
  public getStats(): {
    queueSize: number;
    registeredHandlers: number;
    status: ReturnType<BaseManager['getStatus']>;
  } {
    return {
      queueSize: this.queueProcessor.getQueueSize(),
      registeredHandlers: MessageHandlerFactory.getHandlersSummary().length,
      status: this.getStatus(),
    };
  }
}
