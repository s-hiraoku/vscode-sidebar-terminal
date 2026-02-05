/**
 * Terminal Lifecycle Message Handler
 *
 * Handles terminal creation, deletion, focus, and state management
 *
 * Uses registry-based dispatch pattern instead of switch-case
 * for better maintainability and extensibility.
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { MessageQueue } from '../../utils/MessageQueue';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { hasProperty } from '../../../types/type-guards';
import { TerminalCreationService } from '../../services/TerminalCreationService';

/**
 * Handler function type (supports both sync and async)
 */
type CommandHandler = (
  msg: MessageCommand,
  coordinator: IManagerCoordinator
) => void | Promise<void>;

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
  private readonly processingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly handlers: Map<string, CommandHandler>;
  private static readonly ACK_INITIAL_DELAY_MS = 200;
  private static readonly ACK_MAX_ATTEMPTS = 4;
  private static readonly PROCESSING_IDLE_TIMEOUT_MS = 1000;

  constructor(
    private readonly messageQueue: MessageQueue,
    private readonly logger: ManagerLogger
  ) {
    this.handlers = this.buildHandlerRegistry();
  }

  /**
   * Build handler registry - replaces switch-case pattern
   */
  private buildHandlerRegistry(): Map<string, CommandHandler> {
    const registry = new Map<string, CommandHandler>();

    // Lifecycle commands
    registry.set('init', (msg, coord) => this.handleInit(msg, coord));
    registry.set('terminalCreated', (msg, coord) => this.handleTerminalCreated(msg, coord));
    registry.set('newTerminal', (msg, coord) => this.handleNewTerminal(msg, coord));
    registry.set('focusTerminal', (msg, coord) => this.handleFocusTerminal(msg, coord));
    registry.set('terminalRemoved', (msg, coord) => this.handleTerminalRemoved(msg, coord));
    registry.set('setRestoringSession', (msg, coord) => this.handleSetRestoringSession(msg, coord));

    // Clear commands (aliases)
    const clearHandler: CommandHandler = (msg, coord) => this.handleClearTerminal(msg, coord);
    registry.set('clear', clearHandler);
    registry.set('clearTerminal', clearHandler);

    // State and response commands
    registry.set('setActiveTerminal', (msg, coord) => this.handleSetActiveTerminal(msg, coord));
    registry.set('deleteTerminalResponse', (msg, coord) =>
      this.handleDeleteTerminalResponse(msg, coord)
    );

    // Output commands
    registry.set('output', (msg, coord) => this.handleOutput(msg, coord));
    registry.set('startOutput', (msg, coord) => this.handleStartOutput(msg, coord));

    return registry;
  }

  /**
   * Handle terminal lifecycle related messages using registry dispatch
   */
  public async handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): Promise<void> {
    const command = (msg as { command?: string }).command;

    if (!command) {
      this.logger.warn('Message received without command property');
      return;
    }

    const handler = this.handlers.get(command);
    if (handler) {
      await handler(msg, coordinator);
    } else {
      this.logger.warn(`Unknown terminal lifecycle command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return Array.from(this.handlers.keys());
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
    // 🔧 FIX: Support both msg.terminalId and msg.terminal.id formats
    // Extension sends terminal: { id, name, ... } but handler expected terminalId
    const terminal = (msg as any).terminal;
    const terminalId = (msg.terminalId as string) || terminal?.id;
    const terminalName = (msg.terminalName as string) || terminal?.name;
    const terminalNumber = msg.terminalNumber as number;
    const config = msg.config;
    const isActive = terminal?.isActive ?? false;

    if (terminalId && terminalName) {
      this.logger.info(
        `🔍 TERMINAL_CREATED message received: ${terminalId} (${terminalName}) #${terminalNumber || 'unknown'}${isActive ? ' [ACTIVE]' : ''}`
      );
      this.logger.info(
        `🔍 Current terminal count before creation: ${coordinator.getAllTerminalInstances().size}`
      );

      const displayModeOverride = (config as { displayModeOverride?: string } | undefined)
        ?.displayModeOverride;

      if (displayModeOverride === 'normal') {
        if ('setForceNormalModeForNextCreate' in coordinator) {
          (
            coordinator as unknown as { setForceNormalModeForNextCreate: (enabled: boolean) => void }
          ).setForceNormalModeForNextCreate(true);
        }
        coordinator.getDisplayModeManager?.()?.setDisplayMode('normal');
      } else if (displayModeOverride === 'fullscreen') {
        if ('setForceFullscreenModeForNextCreate' in coordinator) {
          (
            coordinator as unknown as {
              setForceFullscreenModeForNextCreate: (enabled: boolean) => void;
            }
          ).setForceFullscreenModeForNextCreate(true);
        }
      }

      // 🔧 FIX: Include isActive in config so container is created with correct initial styling
      const indicatorColor = terminal?.indicatorColor;
      const configWithActive = config
        ? { ...config, isActive, ...(indicatorColor ? { indicatorColor } : {}) }
        : { isActive, ...(indicatorColor ? { indicatorColor } : {}) };

      const result = await coordinator.createTerminal(
        terminalId,
        terminalName,
        configWithActive,
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

        if (displayModeOverride === 'fullscreen') {
          // Ensure the new terminal is active before switching to fullscreen
          coordinator.setActiveTerminalId(terminalId);
          const displayModeManager = coordinator.getDisplayModeManager?.();
          // 🔧 CRITICAL FIX: Increase delay to ensure DOM operations complete
          // The createTerminal() has internal setTimeout(150) that was overriding fullscreen
          // Use 200ms to ensure fullscreen is applied AFTER all createTerminal() side effects
          setTimeout(() => {
            this.logger.info(`🔍 [FULLSCREEN-DEBUG] Applying fullscreen for ${terminalId} after delay`);
            displayModeManager?.showTerminalFullscreen?.(terminalId);
          }, 200);
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
  private async handleTerminalRemoved(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    const terminalId = msg.terminalId as string;
    if (terminalId) {
      this.logger.info(`Terminal removed from extension: ${terminalId}`);
      // ✅ await で削除完了を待つ
      await this.handleTerminalRemovedFromExtension(terminalId, coordinator);
      this.outputGates.delete(terminalId);
      this.clearProcessingTimer(terminalId);
      this.setProcessingIndicator(terminalId, false, coordinator);
      this.clearAckTracker(terminalId);
      this.logger.info(`✅ Cleanup completed for ${terminalId}`);
    }
  }

  /**
   * Handle terminal removed from extension - clean up UI
   */
  private async handleTerminalRemovedFromExtension(
    terminalId: string,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    this.logger.info(`Handling terminal removal from extension: ${terminalId}`);

    if (
      'handleTerminalRemovedFromExtension' in coordinator &&
      typeof coordinator.handleTerminalRemovedFromExtension === 'function'
    ) {
      // ✅ await して完了を待つ
      await coordinator.handleTerminalRemovedFromExtension(terminalId);
      this.logger.info(`✅ Terminal removal completed: ${terminalId}`);
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
      this.logger.warn(
        `⚠️ [SESSION-RESTORE] Terminal clear blocked during restore: ${terminalId || 'all'}`
      );
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
  private handleSetActiveTerminal(msg: MessageCommand, coordinator: IManagerCoordinator): void {
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
      // Delete succeeded - terminal should already be removed from WebView via terminalRemoved message
      this.logger.info(`Terminal deletion confirmed by Extension: ${terminalId}`);

      // 🔧 FIX: Do NOT call removeTerminal here - terminalRemoved message already handles removal
      // Calling removeTerminal here caused duplicate tab removal and state inconsistency
      // Just clear deletion tracking to allow future operations
      if (
        'clearTerminalDeletionTracking' in coordinator &&
        typeof coordinator.clearTerminalDeletionTracking === 'function'
      ) {
        coordinator.clearTerminalDeletionTracking(terminalId);
        this.logger.info(`🔧 Cleared deletion tracking for: ${terminalId}`);
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

    // Debug: Log output data for restored terminals
    // eslint-disable-next-line no-console
    console.log(
      `[OUTPUT-DEBUG] Received output for ${terminalId}: length=${data.length}, first100chars="${data.substring(0, 100).replace(/\x1b/g, '\\x1b').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`
    );

    const gate = this.ensureOutputGate(terminalId);
    this.markTerminalProcessing(terminalId, coordinator);
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

  private markTerminalProcessing(terminalId: string, coordinator: IManagerCoordinator): void {
    this.setProcessingIndicator(terminalId, true, coordinator);
    this.clearProcessingTimer(terminalId);

    const timer = setTimeout(() => {
      this.processingTimers.delete(terminalId);
      this.setProcessingIndicator(terminalId, false, coordinator);
    }, TerminalLifecycleMessageHandler.PROCESSING_IDLE_TIMEOUT_MS);

    this.processingTimers.set(terminalId, timer);
  }

  private clearProcessingTimer(terminalId: string): void {
    const timer = this.processingTimers.get(terminalId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.processingTimers.delete(terminalId);
  }

  private setProcessingIndicator(
    terminalId: string,
    isProcessing: boolean,
    coordinator: IManagerCoordinator
  ): void {
    const managers = coordinator.getManagers?.();
    const uiManager = managers?.ui as
      | {
          setTerminalProcessingIndicator?: (id: string, processing: boolean) => void;
        }
      | undefined;

    uiManager?.setTerminalProcessingIndicator?.(terminalId, isProcessing);
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

    // 🔒 Block ALL PTY output during restoration protection period
    // Shell initialization sends prompts, clear sequences, etc. that would overwrite restored scrollback
    // Instead of filtering specific sequences, we discard ALL output during the 5-second protection window
    if (TerminalCreationService.isTerminalRestoring(terminalId)) {
      // eslint-disable-next-line no-console
      console.log(
        `[OUTPUT-BLOCK] ⏭️ Blocking ALL output during restoration: ${terminalId}, length=${data.length}`
      );
      this.logger.info(
        `🛡️ [OUTPUT-BLOCK] Blocking output during restoration for: ${terminalId} (${data.length} chars)`
      );
      return; // Discard all PTY output during restoration protection period
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
        // Handle DSR query before direct write (fallback path)
        // DSR is normally handled by PerformanceManager, but we need to handle it here too
        // Wrapped in try-catch to ensure DSR handling errors don't break output
        try {
          this.handleDSRQueryFallback(data, terminal.terminal, terminalId, coordinator);
        } catch (error) {
          this.logger.warn('Error handling DSR query fallback', error);
        }
        terminal.terminal.write(data);
        this.logger.debug(`Output written directly to ${terminal.name}: ${data.length} chars`);
      }
    } catch (error) {
      this.logger.error(`Error writing output to terminal ${terminal.name}`, error);
    }
  }

  /**
   * Handle DSR (Device Status Report) escape sequence in fallback path
   *
   * When CLI tools send \x1b[6n to query cursor position,
   * we respond with \x1b[row;colR format.
   *
   * This is a fallback for when PerformanceManager is not available.
   * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/341
   */
  private handleDSRQueryFallback(
    data: string,
    terminal: import('@xterm/xterm').Terminal,
    terminalId: string,
    coordinator: IManagerCoordinator
  ): void {
    // DSR pattern: \x1b[6n
    if (!data.includes('\x1b[6n')) {
      return;
    }

    // Defensive check: ensure terminal buffer is available
    if (!terminal?.buffer?.active) {
      this.logger.warn('DSR query detected but terminal buffer not available');
      return;
    }

    // Get cursor position from xterm.js buffer
    // Note: cursorY is 0-based but DSR response expects 1-based row number
    const buffer = terminal.buffer.active;
    const row = (buffer.cursorY ?? 0) + 1; // Convert to 1-based
    const col = (buffer.cursorX ?? 0) + 1; // Convert to 1-based

    // Send DSR response back to PTY via input channel
    // Format: \x1b[row;colR (e.g., \x1b[1;1R for row 1, column 1)
    const response = `\x1b[${row};${col}R`;

    this.logger.info(`DSR query detected (fallback), responding: row=${row}, col=${col}`);

    coordinator.postMessageToExtension({
      command: 'input',
      terminalId,
      data: response,
      timestamp: Date.now(),
    });
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
    // Clear all pending ack trackers
    for (const tracker of this.initAckTrackers.values()) {
      if (tracker.timer) {
        clearTimeout(tracker.timer);
      }
    }
    this.initAckTrackers.clear();

    // Clear output gates
    this.outputGates.clear();

    // Clear processing timers
    for (const timer of this.processingTimers.values()) {
      clearTimeout(timer);
    }
    this.processingTimers.clear();

    // Clear handler registry
    this.handlers.clear();
  }
}
