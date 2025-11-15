/**
 * Terminal Lifecycle Message Handler
 *
 * Handles terminal creation, deletion, focus, and state management
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { MessageQueue } from '../../utils/MessageQueue';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { hasProperty } from '../../../types/type-guards';

interface AckTracker {
  attempt: number;
  acked: boolean;
  delay: number;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Terminal Lifecycle Message Handler
 *
 * Responsibilities:
 * - Terminal initialization and creation
 * - Terminal removal and cleanup
 * - Terminal focus management
 * - Active terminal state tracking
 * - Terminal deletion response handling
 */
export class TerminalLifecycleMessageHandler implements IMessageHandler {
  private readonly outputGates = new Map<string, { enabled: boolean; buffer: string[] }>();
  private readonly initAckTrackers = new Map<string, AckTracker>();
  private static readonly ACK_INITIAL_DELAY_MS = 200;
  private static readonly ACK_MAX_ATTEMPTS = 4;
  constructor(
    private readonly messageQueue: MessageQueue,
    private readonly logger: ManagerLogger
  ) {}

  /**
   * Handle terminal lifecycle related messages
   */
  public async handleMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    const command = (msg as { command?: string }).command;

    switch (command) {
      case 'init':
        this.handleInit(msg, coordinator);
        break;
      case 'terminalCreated':
        await this.handleTerminalCreated(msg, coordinator);
        break;
      case 'newTerminal':
        this.handleNewTerminal(msg, coordinator);
        break;
      case 'focusTerminal':
        this.handleFocusTerminal(msg, coordinator);
        break;
      case 'terminalRemoved':
        this.handleTerminalRemoved(msg, coordinator);
        break;
      case 'setRestoringSession':
        this.handleSetRestoringSession(msg, coordinator);
        break;
      case 'clear':
      case 'clearTerminal':
        this.handleClearTerminal(msg, coordinator);
        break;
      case 'setActiveTerminal':
        this.handleSetActiveTerminal(msg, coordinator);
        break;
      case 'deleteTerminalResponse':
        this.handleDeleteTerminalResponse(msg, coordinator);
        break;
      case 'output':
        this.handleOutput(msg, coordinator);
        break;
      case 'startOutput':
        this.handleStartOutput(msg, coordinator);
        break;
      default:
        this.logger.warn(`Unknown terminal lifecycle command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return [
      'init',
      'terminalCreated',
      'newTerminal',
      'focusTerminal',
      'terminalRemoved',
      'clearTerminal',
      'setActiveTerminal',
      'deleteTerminalResponse',
      'output',
      'startOutput',
    ];
  }

  /**
   * Handle init message - WebView initialization
   */
  private handleInit(msg: MessageCommand, coordinator: IManagerCoordinator): void {
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
   * Handle terminal created message from extension
   */
  private async handleTerminalCreated(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    const terminalId = msg.terminalId as string;
    const terminalName = msg.terminalName as string;
    const terminalNumber = msg.terminalNumber as number;
    const config = msg.config;
    const isActive = (msg as any).terminal?.isActive ?? false;

    if (terminalId && terminalName && config) {
      this.logger.info(
        `🔍 TERMINAL_CREATED message received: ${terminalId} (${terminalName}) #${terminalNumber || 'unknown'}${isActive ? ' [ACTIVE]' : ''}`
      );
      this.logger.info(
        `🔍 Current terminal count before creation: ${coordinator.getAllTerminalInstances().size}`
      );

      const result = await coordinator.createTerminal(
        terminalId,
        terminalName,
        config,
        terminalNumber,
        'extension'
      );

      this.logger.info(`🔍 Terminal creation result: ${result ? 'SUCCESS' : 'FAILED'}`);
      this.logger.info(
        `🔍 Current terminal count after creation: ${coordinator.getAllTerminalInstances().size}`
      );

      this.logger.debug('createTerminal result', {
        terminalId,
        terminalName,
        terminalNumber,
        success: !!result,
        isActive,
        existingTerminals: Array.from(coordinator.getAllTerminalInstances().keys()),
      });

      this.outputGates.set(terminalId, { enabled: false, buffer: [] });

      if (result) {
        this.scheduleInitializationAck(terminalId, coordinator);

        // 🎯 FIX: Activate terminal if Extension marked it as active
        if (isActive) {
          this.logger.info(`🎯 Activating terminal as requested by Extension: ${terminalId}`);
          coordinator.setActiveTerminalId(terminalId);
        }
      } else {
        this.logger.warn(
          `⚠️ [HANDSHAKE] Terminal ${terminalId} creation reported failure; skipping initialization ack`
        );
      }
    } else {
      this.logger.error('Invalid terminalCreated message', {
        hasTerminalId: !!terminalId,
        hasTerminalName: !!terminalName,
        hasTerminalNumber: !!terminalNumber,
        hasConfig: !!config,
      });
    }
  }

  /**
   * Handle new terminal creation request
   */
  private handleNewTerminal(msg: MessageCommand, coordinator: IManagerCoordinator): void {
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
   * Handle focus terminal request
   */
  private handleFocusTerminal(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    if (terminalId) {
      coordinator.ensureTerminalFocus(terminalId);
      this.logger.info(`Terminal focused: ${terminalId}`);
    }
  }

  /**
   * Handle terminal removed message from extension
   */
  private handleTerminalRemoved(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const terminalId = msg.terminalId as string;
    if (terminalId) {
      this.logger.info(`Terminal removed from extension: ${terminalId}`);
      this.handleTerminalRemovedFromExtension(terminalId, coordinator);
      this.outputGates.delete(terminalId);
      this.clearAckTracker(terminalId);
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
   * Handle set restoring session flag
   */
  private handleSetRestoringSession(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const isRestoring = (msg as { isRestoring?: boolean }).isRestoring || false;
    if (typeof coordinator.setRestoringSession === 'function') {
      coordinator.setRestoringSession(isRestoring);
      this.logger.info(`🔄 [SESSION-RESTORE] isRestoringSession flag set to: ${isRestoring}`);
    }
  }

  /**
   * Handle clear terminal request
   */
  private handleClearTerminal(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    // 🎯 FIX: Block terminal clear during session restore
    if (typeof coordinator.isRestoringSession === 'function' && coordinator.isRestoringSession()) {
      const terminalId = msg.terminalId as string;
      this.logger.warn(`⚠️ [SESSION-RESTORE] Terminal clear blocked during restore: ${terminalId || 'all'}`);
      return;
    }

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
   * Handle set active terminal request
   */
  private handleSetActiveTerminal(
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
   * Handle delete terminal response from extension
   */
  private handleDeleteTerminalResponse(
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
   * Handle output message from extension with robust validation
   */
  private handleOutput(msg: MessageCommand, coordinator: IManagerCoordinator): void {
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

    const gate = this.ensureOutputGate(terminalId);
    if (!gate.enabled) {
      gate.buffer.push(data);
      this.logger.info(
        `⏸️ [OUTPUT-GATE] Buffering output for ${terminalId} (chunks=${gate.buffer.length}, length=${data.length})`
      );
      return;
    }

    this.writeOutputToTerminal(terminalId, data, coordinator);
  }

  private handleStartOutput(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    if (!terminalId) {
      this.logger.warn('startOutput message missing terminalId');
      return;
    }

    this.markAckReceived(terminalId);

    const gate = this.ensureOutputGate(terminalId);
    if (gate.enabled) {
      this.logger.info(`⏭️ [OUTPUT-GATE] startOutput already processed for ${terminalId}`);
      return;
    }

    gate.enabled = true;
    this.logger.info(
      `▶️ [OUTPUT-GATE] Output enabled for ${terminalId}, flushing ${gate.buffer.length} buffered chunks`
    );

    while (gate.buffer.length > 0) {
      const chunk = gate.buffer.shift();
      if (chunk) {
        this.writeOutputToTerminal(terminalId, chunk, coordinator);
      }
    }
  }

  private scheduleInitializationAck(terminalId: string, coordinator: IManagerCoordinator): void {
    this.clearAckTracker(terminalId);

    const tracker: AckTracker = {
      attempt: 0,
      acked: false,
      delay: TerminalLifecycleMessageHandler.ACK_INITIAL_DELAY_MS,
    };

    this.initAckTrackers.set(terminalId, tracker);
    this.dispatchInitializationComplete(terminalId, coordinator, tracker);
  }

  private dispatchInitializationComplete(
    terminalId: string,
    coordinator: IManagerCoordinator,
    tracker: AckTracker
  ): void {
    tracker.attempt += 1;
    this.logger.info(
      `📡 [HANDSHAKE] Sending terminalInitializationComplete for ${terminalId} (attempt #${tracker.attempt})`
    );

    coordinator.postMessageToExtension({
      command: 'terminalInitializationComplete',
      terminalId,
      timestamp: Date.now(),
      attempt: tracker.attempt,
    });

    tracker.timer = setTimeout(() => {
      if (tracker.acked) {
        return;
      }

      if (tracker.attempt >= TerminalLifecycleMessageHandler.ACK_MAX_ATTEMPTS) {
        this.logger.error(
          `❌ [HANDSHAKE] startOutput ack not received for ${terminalId} after ${tracker.attempt} attempts`
        );
        this.initAckTrackers.delete(terminalId);
        return;
      }

      tracker.delay *= 2;
      this.logger.warn(
        `⏳ [HANDSHAKE] No startOutput ack yet for ${terminalId}. Retrying in ${tracker.delay}ms`
      );
      this.dispatchInitializationComplete(terminalId, coordinator, tracker);
    }, tracker.delay);
  }

  private markAckReceived(terminalId: string): void {
    const tracker = this.initAckTrackers.get(terminalId);
    if (!tracker) {
      this.logger.info(`📨 [HANDSHAKE] startOutput ack received for ${terminalId} (no tracker)`);
      return;
    }

    tracker.acked = true;
    if (tracker.timer) {
      clearTimeout(tracker.timer);
      tracker.timer = undefined;
    }

    this.logger.info(
      `📨 [HANDSHAKE] startOutput ack received for ${terminalId} (attempt #${tracker.attempt})`
    );
    this.initAckTrackers.delete(terminalId);
  }

  private clearAckTracker(terminalId: string): void {
    const tracker = this.initAckTrackers.get(terminalId);
    if (!tracker) {
      return;
    }

    if (tracker.timer) {
      clearTimeout(tracker.timer);
    }
    this.initAckTrackers.delete(terminalId);
  }

  private ensureOutputGate(terminalId: string): { enabled: boolean; buffer: string[] } {
    let gate = this.outputGates.get(terminalId);
    if (!gate) {
      gate = { enabled: false, buffer: [] };
      this.outputGates.set(terminalId, gate);
    }
    return gate;
  }

  private writeOutputToTerminal(
    terminalId: string,
    data: string,
    coordinator: IManagerCoordinator
  ): void {
    const terminal = coordinator.getTerminalInstance(terminalId);
    if (!terminal) {
      this.logger.error(`Output for non-existent terminal: ${terminalId}`, {
        availableTerminals: Array.from(coordinator.getAllTerminalInstances().keys()),
      });
      return;
    }

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
      const managers = coordinator.getManagers();
      if (managers && managers.performance) {
        managers.performance.bufferedWrite(data, terminal.terminal, terminalId);
        this.logger.debug(
          `Output buffered via PerformanceManager for ${terminal.name}: ${data.length} chars`
        );
      } else {
        terminal.terminal.write(data);
        this.logger.debug(`Output written directly to ${terminal.name}: ${data.length} chars`);
      }
    } catch (error) {
      this.logger.error(`Error writing output to terminal ${terminal.name}`, error);
    }
  }

  /**
   * Emit terminal interaction event
   */
  private emitTerminalInteractionEvent(
    eventType: string,
    terminalId: string,
    data: unknown,
    coordinator: IManagerCoordinator
  ): void {
    if (
      'emitTerminalInteractionEvent' in coordinator &&
      typeof coordinator.emitTerminalInteractionEvent === 'function'
    ) {
      coordinator.emitTerminalInteractionEvent(eventType, terminalId, data);
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.outputGates.clear();
  }
}
