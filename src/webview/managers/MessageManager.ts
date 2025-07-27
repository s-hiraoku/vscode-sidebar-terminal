/**
 * Message Manager - Handles WebView ↔ Extension communication and command processing
 */

import { webview as log } from '../../utils/logger';
import { TerminalInteractionEvent } from '../../types/common';
import { WebViewFontSettings } from '../../types/shared';
import { IMessageManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { CommunicationManager } from './CommunicationManager';
import { LoggerManager } from './LoggerManager';
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

interface MessageCommand {
  command: string;
  cliAgentStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  };
  [key: string]: unknown;
}

export class MessageManager implements IMessageManager {
  // Message processing queue for reliability
  private messageQueue: unknown[] = [];
  private isProcessingQueue = false;

  // Unified managers
  private commManager = CommunicationManager.getInstance();
  private logger = LoggerManager.getInstance();

  /**
   * Handle incoming messages from the extension
   */
  public handleMessage(message: unknown, coordinator: IManagerCoordinator): void {
    log(`📨 [MESSAGE] ========== MESSAGE MANAGER HANDLE MESSAGE ==========`);
    log(`📨 [MESSAGE] Raw message:`, message);
    log(`📨 [MESSAGE] Message type:`, typeof message);
    log(`📨 [MESSAGE] Message is null/undefined:`, message === null);

    try {
      const msg = message as MessageCommand;
      log(`📨 [MESSAGE] Casted message:`, msg);
      log(`📨 [MESSAGE] Message command:`, msg?.command);
      log(`📨 [MESSAGE] Message keys:`, Object.keys(msg || {}));
      log(`📨 [MESSAGE] Received command: ${msg.command}`);

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

        case 'clearTerminal':
          this.handleClearTerminalMessage(msg, coordinator);
          break;

        case 'fontSettingsUpdate':
          this.handleFontSettingsUpdateMessage(msg, coordinator);
          break;

        case 'settingsResponse':
          this.handleSettingsResponseMessage(msg, coordinator);
          break;

        case 'terminalCreated':
          this.handleTerminalCreatedMessage(msg, coordinator);
          break;

        case 'newTerminal':
          this.handleNewTerminalMessage(msg, coordinator);
          break;

        case 'focusTerminal':
          this.handleFocusTerminalMessage(msg, coordinator);
          break;

        case 'resizeTerminal':
          this.handleResizeTerminalMessage(msg, coordinator);
          break;

        case 'killTerminal':
          this.handleKillTerminalMessage(msg, coordinator);
          break;

        case 'openSettings':
          log('⚙️ [MESSAGE] Opening settings panel');
          coordinator.openSettings();
          break;

        case 'stateUpdate':
          this.handleStateUpdateMessage(msg, coordinator);
          break;

        case 'cliAgentStatusUpdate':
          this.handleClaudeStatusUpdateMessage(msg, coordinator);
          break;

        case 'sessionRestore':
          this.handleSessionRestoreMessage(msg, coordinator);
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

        case 'sessionRestoreSkipped':
          this.handleSessionRestoreSkippedMessage(msg);
          break;

        case 'terminalRestoreError':
          this.handleTerminalRestoreErrorMessage(msg);
          break;

        case 'getScrollback':
          this.handleGetScrollbackMessage(msg, coordinator);
          break;

        default:
          log(`⚠️ [MESSAGE] Unknown command: ${msg.command}`);
      }
    } catch (error) {
      log('❌ [MESSAGE] Error handling message:', error, message);
    }
  }

  /**
   * Send ready message to extension
   */
  public sendReadyMessage(coordinator: IManagerCoordinator): void {
    this.queueMessage(
      {
        command: 'ready',
        timestamp: Date.now(),
      },
      coordinator
    );
    log('📤 [MESSAGE] Ready message sent');
  }

  /**
   * Send kill terminal message to extension
   */
  public sendKillTerminalMessage(coordinator: IManagerCoordinator): void {
    this.queueMessage(
      {
        command: 'killTerminal',
        timestamp: Date.now(),
      },
      coordinator
    );
    log('📤 [MESSAGE] Kill terminal message sent');
  }

  /**
   * Send kill specific terminal message to extension
   */
  public sendKillSpecificTerminalMessage(
    terminalId: string,
    coordinator: IManagerCoordinator
  ): void {
    log(`📤 [MESSAGE] ========== SENDING KILL SPECIFIC TERMINAL MESSAGE ==========`);
    log(`📤 [MESSAGE] Terminal ID: ${terminalId}`);
    log(`📤 [MESSAGE] Coordinator available:`, !!coordinator);

    const message = {
      command: 'killTerminal',
      terminalId,
      timestamp: Date.now(),
    };

    log(`📤 [MESSAGE] Message to send:`, message);

    try {
      this.queueMessage(message, coordinator);
      log(`📤 [MESSAGE] Kill specific terminal message queued successfully for: ${terminalId}`);
    } catch (error) {
      log(`❌ [MESSAGE] Error queueing kill message:`, error);
    }
  }

  /**
   * 新しいアーキテクチャ: 統一された削除要求メッセージを送信
   */
  public sendDeleteTerminalMessage(
    terminalId: string,
    requestSource: 'header' | 'panel',
    coordinator: IManagerCoordinator
  ): void {
    log(`📤 [MESSAGE] ========== SENDING DELETE TERMINAL MESSAGE ==========`);
    log(`📤 [MESSAGE] Terminal ID: ${terminalId}`);
    log(`📤 [MESSAGE] Request source: ${requestSource}`);
    log(`📤 [MESSAGE] Coordinator available:`, !!coordinator);

    const message = {
      command: 'deleteTerminal',
      terminalId,
      requestSource,
      timestamp: Date.now(),
    };

    log(`📤 [MESSAGE] Message to send:`, message);

    try {
      this.queueMessage(message, coordinator);
      log(`📤 [MESSAGE] Delete terminal message queued successfully for: ${terminalId}`);
    } catch (error) {
      log(`❌ [MESSAGE] Error queueing delete message:`, error);
    }
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
    this.queueMessage(
      {
        command: 'terminalInteraction',
        type,
        terminalId,
        data,
        timestamp: Date.now(),
      },
      coordinator
    );
    log(`📤 [MESSAGE] Terminal interaction event: ${type} for ${terminalId}`);
  }

  /**
   * Handle init message from extension
   */
  private handleInitMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    log('🚀 [MESSAGE] Handling init message');

    try {
      // Request current settings
      this.queueMessage(
        {
          command: 'getSettings',
        },
        coordinator
      );

      // Emit ready event
      this.emitTerminalInteractionEvent('webview-ready', '', undefined, coordinator);

      // Send confirmation back to extension
      coordinator.postMessageToExtension({
        command: 'test',
        type: 'initComplete',
        data: 'WebView processed INIT message',
        timestamp: Date.now(),
      });

      log('✅ [MESSAGE] INIT processing completed');
    } catch (error) {
      log('❌ [MESSAGE] Error processing INIT message:', error);
    }
  }

  /**
   * Handle output message from extension
   */
  private handleOutputMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const data = msg.data as string;
    const terminalId = msg.terminalId as string;

    if (data && terminalId) {
      const terminal = coordinator.getTerminalInstance(terminalId);
      if (terminal) {
        // デバッグ: 出力データの詳細をログ
        console.log(`🔍 [WEBVIEW] Terminal output debug:`, {
          terminalId,
          dataLength: data.length,
          dataPreview: data.substring(0, 100),
          containsGeminiPattern: data.includes('Gemini') || data.includes('gemini'),
          hasEscapeSequences: data.includes('\x1b'),
          rawData: JSON.stringify(data.substring(0, 50)),
        });

        // Write directly to terminal (performance manager would handle buffering in a full implementation)
        terminal.terminal.write(data);
        log(`📥 [MESSAGE] Output written to terminal ${terminalId}: ${data.length} chars`);

        // CLI Agent detection disabled
      } else {
        log(`⚠️ [MESSAGE] Output for unknown terminal: ${terminalId}`);
      }
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
      log(`🗑️ [MESSAGE] Terminal removed from extension: ${terminalId}`);
      // Call the coordinator's method to handle terminal removal from UI
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
    log(`🗑️ [MESSAGE] Handling terminal removal from extension: ${terminalId}`);

    // Use the coordinator's method to handle terminal removal from UI
    if (
      'handleTerminalRemovedFromExtension' in coordinator &&
      typeof coordinator.handleTerminalRemovedFromExtension === 'function'
    ) {
      coordinator.handleTerminalRemovedFromExtension(terminalId);
    } else {
      log(`⚠️ [MESSAGE] handleTerminalRemovedFromExtension method not found on coordinator`);
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
        log(`🧹 [MESSAGE] Terminal cleared: ${terminalId}`);
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
      log('🎨 [MESSAGE] Font settings update received:', fontSettings);
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
      log('⚙️ [MESSAGE] Settings response received');
      this.emitTerminalInteractionEvent('settings-update', '', settings, coordinator);
    }
  }

  /**
   * Handle terminal created message from extension
   */
  private handleTerminalCreatedMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const terminalId = msg.terminalId as string;
    const terminalName = msg.terminalName as string;
    const config = msg.config;

    if (terminalId && terminalName && config) {
      log(`✅ [MESSAGE] Terminal created: ${terminalId} (${terminalName})`);
      // Create the terminal in the coordinator
      coordinator.createTerminal(terminalId, terminalName, config);
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
      log(`➕ [MESSAGE] New terminal request: ${terminalId} (${terminalName})`);
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
      log(`🎯 [MESSAGE] Terminal focused: ${terminalId}`);
    }
  }

  /**
   * Handle resize terminal message
   */
  private handleResizeTerminalMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    const cols = msg.cols as number;
    const rows = msg.rows as number;

    if (terminalId && typeof cols === 'number' && typeof rows === 'number') {
      log(`📐 [MESSAGE] Resize terminal ${terminalId}: ${cols}x${rows}`);
      this.emitTerminalInteractionEvent('resize', terminalId, { cols, rows }, coordinator);
    }
  }

  /**
   * Handle kill terminal message
   */
  private handleKillTerminalMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    log(`⚰️ [MESSAGE] Kill terminal command received`);
    // Kill the active terminal (no specific terminalId needed)
    coordinator.closeTerminal();
  }

  /**
   * 新しいアーキテクチャ: 状態更新メッセージを処理
   */
  private handleStateUpdateMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const state = msg.state;
    if (state) {
      log('🔄 [MESSAGE] State update received:', state);

      // IManagerCoordinatorにupdateStateメソッドがあることを確認
      if ('updateState' in coordinator && typeof coordinator.updateState === 'function') {
        coordinator.updateState(state);
      } else {
        log('⚠️ [MESSAGE] updateState method not found on coordinator');
      }
    } else {
      log('⚠️ [MESSAGE] No state data in stateUpdate message');
    }
  }

  /**
   * Handle Claude status update message from extension
   */
  private handleClaudeStatusUpdateMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    log(`📨 [MESSAGE] ========== CLAUDE STATUS UPDATE MESSAGE RECEIVED ==========`);
    log(`📨 [MESSAGE] Message received at: ${new Date().toISOString()}`);
    log(`📨 [MESSAGE] Full message received: ${JSON.stringify(msg, null, 2)}`);
    log(`📨 [MESSAGE] Message command: ${msg.command}`);
    log(`📨 [MESSAGE] Message cliAgentStatus: ${JSON.stringify(msg.cliAgentStatus)}`);
    log(`📨 [MESSAGE] Message cliAgentStatus type: ${typeof msg.cliAgentStatus}`);

    const cliAgentStatus = msg.cliAgentStatus;
    if (cliAgentStatus) {
      log(`🔄 [MESSAGE] Claude status data found:`);
      log(
        `🔄 [MESSAGE]   - activeTerminalName: "${cliAgentStatus.activeTerminalName}" (${typeof cliAgentStatus.activeTerminalName})`
      );
      log(`🔄 [MESSAGE]   - status: "${cliAgentStatus.status}" (${typeof cliAgentStatus.status})`);
      log(`🔄 [MESSAGE] About to call coordinator.updateClaudeStatus...`);
      log(`🔄 [MESSAGE] Coordinator available: ${!!coordinator}`);
      log(`🔄 [MESSAGE] Coordinator type: ${typeof coordinator}`);
      log(
        `🔄 [MESSAGE] Coordinator.updateClaudeStatus method: ${typeof coordinator.updateClaudeStatus}`
      );

      try {
        const result = coordinator.updateClaudeStatus(
          cliAgentStatus.activeTerminalName,
          cliAgentStatus.status,
          cliAgentStatus.agentType || null
        );
        log(
          `✅ [MESSAGE] coordinator.updateClaudeStatus called successfully, result: ${String(result)}`
        );
      } catch (error) {
        log(`❌ [MESSAGE] Error calling coordinator.updateClaudeStatus:`, error);
        log(`❌ [MESSAGE] Error name: ${error instanceof Error ? error.name : 'unknown'}`);
        log(
          `❌ [MESSAGE] Error message: ${error instanceof Error ? error.message : String(error)}`
        );
        log(`❌ [MESSAGE] Error stack: ${error instanceof Error ? error.stack : 'no stack'}`);
      }
    } else {
      log('⚠️ [MESSAGE] No Claude status data in cliAgentStatusUpdate message');
      log(`⚠️ [MESSAGE] Message keys: ${Object.keys(msg).join(', ')}`);
      log(`⚠️ [MESSAGE] Message properties check:`);
      for (const [key, value] of Object.entries(msg)) {
        log(`⚠️ [MESSAGE]   - ${key}: ${JSON.stringify(value)} (${typeof value})`);
      }
      log(`⚠️ [MESSAGE] Full message structure: ${JSON.stringify(msg, null, 2)}`);
    }

    log(`📨 [MESSAGE] ========== CLAUDE STATUS UPDATE PROCESSING COMPLETE ==========`);
  }

  /**
   * Queue message for reliable delivery
   */
  private queueMessage(message: unknown, coordinator: IManagerCoordinator): void {
    this.messageQueue.push(message);
    void this.processMessageQueue(coordinator);
  }

  /**
   * Process message queue with error handling
   */
  private async processMessageQueue(coordinator: IManagerCoordinator): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      try {
        coordinator.postMessageToExtension(message);
        await this.delay(1); // Small delay to prevent overwhelming the extension
      } catch (error) {
        log('❌ [MESSAGE] Error sending message:', error);
        // Re-queue message for retry
        this.messageQueue.unshift(message);
        break;
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Send input to terminal
   */
  public sendInput(input: string, terminalId?: string, coordinator?: IManagerCoordinator): void {
    if (coordinator) {
      this.queueMessage(
        {
          command: 'input',
          data: input,
          terminalId: terminalId || coordinator.getActiveTerminalId(),
        },
        coordinator
      );
      log(`⌨️ [MESSAGE] Input sent: ${input.length} chars to ${terminalId || 'active terminal'}`);
    }
  }

  /**
   * Request settings from extension
   */
  public requestSettings(coordinator: IManagerCoordinator): void {
    this.queueMessage(
      {
        command: 'getSettings',
      },
      coordinator
    );
    log('⚙️ [MESSAGE] Settings requested');
  }

  /**
   * Send settings update to extension
   */
  public updateSettings(settings: unknown, coordinator: IManagerCoordinator): void {
    this.queueMessage(
      {
        command: 'updateSettings',
        settings,
      },
      coordinator
    );
    log('⚙️ [MESSAGE] Settings update sent');
  }

  /**
   * Send resize request to extension
   */
  public sendResize(
    cols: number,
    rows: number,
    terminalId?: string,
    coordinator?: IManagerCoordinator
  ): void {
    if (coordinator) {
      this.queueMessage(
        {
          command: 'resize',
          cols,
          rows,
          terminalId: terminalId || coordinator.getActiveTerminalId(),
        },
        coordinator
      );
      log(
        `📐 [MESSAGE] Resize request sent: ${cols}x${rows} for ${terminalId || 'active terminal'}`
      );
    }
  }

  /**
   * Request terminal creation
   */
  public requestNewTerminal(coordinator: IManagerCoordinator): void {
    this.queueMessage(
      {
        command: 'createTerminal',
        timestamp: Date.now(),
      },
      coordinator
    );
    log('➕ [MESSAGE] New terminal requested');
  }

  /**
   * Small delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get message queue statistics
   */
  public getQueueStats(): { queueSize: number; isProcessing: boolean } {
    return {
      queueSize: this.messageQueue.length,
      isProcessing: this.isProcessingQueue,
    };
  }

  /**
   * Clear message queue (emergency)
   */
  public clearQueue(): void {
    this.messageQueue = [];
    this.isProcessingQueue = false;
    log('🗑️ [MESSAGE] Message queue cleared');
  }

  /**
   * Handle session restore message from extension
   */
  private handleSessionRestoreMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    log('🔄 [MESSAGE] Session restore message received');

    const terminalId = msg.terminalId as string;
    const terminalName = msg.terminalName as string;
    const config = msg.config;
    const sessionRestoreMessage = msg.sessionRestoreMessage as string;
    const sessionScrollback = msg.sessionScrollback as string[];

    if (terminalId && terminalName && config) {
      log(`🔄 [MESSAGE] Restoring terminal session: ${terminalId} (${terminalName})`);
      log(`🔄 [MESSAGE] Restore message: ${sessionRestoreMessage}`);
      log(`🔄 [MESSAGE] Scrollback lines: ${sessionScrollback?.length || 0}`);

      try {
        // Simple approach: Create terminal normally, then restore scrollback
        coordinator.createTerminal(terminalId, terminalName, config);
        log(`✅ [MESSAGE] Created terminal for session restore: ${terminalId}`);

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
              log(`✅ [MESSAGE] Restored scrollback for terminal: ${terminalId}`);
            } else {
              log('⚠️ [MESSAGE] restoreTerminalScrollback method not found');
            }
          }, 100);
        }
      } catch (error) {
        log(`❌ [MESSAGE] Failed to restore terminal session ${terminalId}: ${error}`);
        // Continue with regular terminal creation as fallback
        coordinator.createTerminal(terminalId, terminalName, config);
      }
    } else {
      log('❌ [MESSAGE] Invalid session restore data received');
    }
  }


  /**
   * Request scrollback data from extension for a terminal
   */
  public requestScrollbackData(
    terminalId: string,
    lines: number,
    coordinator: IManagerCoordinator
  ): void {
    this.queueMessage(
      {
        command: 'getScrollbackData',
        terminalId,
        scrollbackLines: lines,
      },
      coordinator
    );
    log(`📜 [MESSAGE] Scrollback data requested for terminal ${terminalId}: ${lines} lines`);
  }

  /**
   * Dispose and cleanup
   */
  /**
   * Session restore notification handlers
   */
  private handleSessionRestoreStartedMessage(msg: MessageCommand): void {
    const terminalCount = (msg.terminalCount as number) || 0;
    log(`🔄 [MESSAGE] Session restore started for ${terminalCount} terminals`);
    showSessionRestoreStarted(terminalCount);
  }

  private handleSessionRestoreProgressMessage(msg: MessageCommand): void {
    const restored = (msg.restored as number) || 0;
    const total = (msg.total as number) || 0;
    log(`⏳ [MESSAGE] Session restore progress: ${restored}/${total}`);
    showSessionRestoreProgress(restored, total);
  }

  private handleSessionRestoreCompletedMessage(msg: MessageCommand): void {
    const restoredCount = (msg.restoredCount as number) || 0;
    const skippedCount = (msg.skippedCount as number) || 0;
    log(
      `✅ [MESSAGE] Session restore completed: ${restoredCount} restored, ${skippedCount} skipped`
    );
    showSessionRestoreCompleted(restoredCount, skippedCount);
  }

  private handleSessionRestoreErrorMessage(msg: MessageCommand): void {
    const error = (msg.error as string) || 'Unknown error';
    const partialSuccess = (msg.partialSuccess as boolean) || false;
    const errorType = (msg.errorType as string) || undefined;
    log(
      `❌ [MESSAGE] Session restore error: ${error} (partial: ${partialSuccess}, type: ${errorType})`
    );
    showSessionRestoreError(error, partialSuccess, errorType);
  }

  private handleSessionSavedMessage(msg: MessageCommand): void {
    const terminalCount = (msg.terminalCount as number) || 0;
    log(`💾 [MESSAGE] Session saved with ${terminalCount} terminals`);
    showSessionSaved(terminalCount);
  }

  private handleSessionSaveErrorMessage(msg: MessageCommand): void {
    const error = (msg.error as string) || 'Unknown error';
    log(`💾❌ [MESSAGE] Session save error: ${error}`);
    showSessionSaveError(error);
  }

  private handleSessionClearedMessage(): void {
    log('🗑️ [MESSAGE] Session cleared');
    showSessionCleared();
  }

  private handleSessionRestoreSkippedMessage(msg: MessageCommand): void {
    const reason = (msg.reason as string) || 'Unknown reason';
    log(`⏭️ [MESSAGE] Session restore skipped: ${reason}`);
    showSessionRestoreSkipped(reason);
  }

  private handleTerminalRestoreErrorMessage(msg: MessageCommand): void {
    const terminalName = (msg.terminalName as string) || 'Unknown terminal';
    const error = (msg.error as string) || 'Unknown error';
    log(`⚠️ [MESSAGE] Terminal restore error: ${terminalName} - ${error}`);

    // Import the function here to avoid circular dependencies
    const { showTerminalRestoreError } = require('../utils/NotificationUtils');
    showTerminalRestoreError(terminalName, error);
  }

  /**
   * Handle scrollback extraction request
   */
  private handleGetScrollbackMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    log('📋 [MESSAGE] Handling get scrollback message');
    
    const terminalId = msg.terminalId as string;
    const maxLines = (msg.maxLines as number) || 1000;
    
    if (!terminalId) {
      log('❌ [MESSAGE] No terminal ID provided for scrollback extraction');
      return;
    }

    // Get scrollback data from the current terminal
    const terminalElement = coordinator.getTerminalElement(terminalId);
    if (!terminalElement) {
      log(`❌ [MESSAGE] Terminal element not found for ID: ${terminalId}`);
      return;
    }

    try {
      // Extract scrollback from xterm.js
      const scrollbackContent = this.extractScrollbackFromTerminal(terminalElement, maxLines);
      
      // Send scrollback data back to extension
      this.queueMessage({
        command: 'scrollbackExtracted',
        terminalId,
        scrollbackContent,
        timestamp: Date.now()
      }, coordinator);
      
      log(`✅ [MESSAGE] Scrollback extracted for terminal ${terminalId}: ${scrollbackContent.length} lines`);
      
    } catch (error) {
      log(`❌ [MESSAGE] Error extracting scrollback: ${error instanceof Error ? error.message : String(error)}`);
      
      this.queueMessage({
        command: 'error',
        error: `Failed to extract scrollback: ${error instanceof Error ? error.message : String(error)}`,
        terminalId,
        timestamp: Date.now()
      }, coordinator);
    }
  }

  /**
   * Handle scrollback restoration request
   */
  private handleRestoreScrollbackMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    log('🔄 [MESSAGE] Handling restore scrollback message');
    
    const terminalId = msg.terminalId as string;
    const scrollbackContent = msg.scrollbackContent as Array<{
      content: string;
      type?: 'output' | 'input' | 'error';
      timestamp?: number;
    }>;
    
    if (!terminalId || !scrollbackContent) {
      log('❌ [MESSAGE] Invalid scrollback restore request');
      return;
    }

    try {
      // Restore scrollback to the terminal
      this.restoreScrollbackToTerminal(terminalId, scrollbackContent, coordinator);
      
      // Send confirmation back to extension
      this.queueMessage({
        command: 'scrollbackRestored',
        terminalId,
        restoredLines: scrollbackContent.length,
        timestamp: Date.now()
      }, coordinator);
      
      log(`✅ [MESSAGE] Scrollback restored for terminal ${terminalId}: ${scrollbackContent.length} lines`);
      
    } catch (error) {
      log(`❌ [MESSAGE] Error restoring scrollback: ${error instanceof Error ? error.message : String(error)}`);
      
      this.queueMessage({
        command: 'error',
        error: `Failed to restore scrollback: ${error instanceof Error ? error.message : String(error)}`,
        terminalId,
        timestamp: Date.now()
      }, coordinator);
    }
  }

  /**
   * Handle scrollback progress updates
   */
  private handleScrollbackProgressMessage(msg: MessageCommand): void {
    log('📊 [MESSAGE] Handling scrollback progress message');
    
    const progressInfo = msg.scrollbackProgress as {
      terminalId: string;
      progress: number;
      currentLines: number;
      totalLines: number;
      stage: 'loading' | 'decompressing' | 'restoring';
    };
    
    if (!progressInfo) {
      log('❌ [MESSAGE] No progress information provided');
      return;
    }

    // Show progress notification
    log(`📊 [MESSAGE] Scrollback progress: ${progressInfo.progress}% (${progressInfo.currentLines}/${progressInfo.totalLines})`);
    
    // TODO: Update progress UI if needed
  }

  /**
   * Extract scrollback content from terminal element
   */
  private extractScrollbackFromTerminal(
    terminalElement: HTMLElement, 
    maxLines: number
  ): Array<{ content: string; type?: 'output' | 'input' | 'error'; timestamp?: number }> {
    log(`🔍 [MESSAGE] Extracting scrollback from terminal (max ${maxLines} lines)`);
    
    // Access xterm.js instance
    const xtermInstance = (terminalElement as any).xterm;
    if (!xtermInstance) {
      throw new Error('xterm.js instance not found');
    }

    const scrollbackLines: Array<{ content: string; type?: 'output' | 'input' | 'error'; timestamp?: number }> = [];
    
    // Get buffer content
    const buffer = xtermInstance.buffer.active;
    const totalLines = Math.min(buffer.length, maxLines);
    
    for (let i = Math.max(0, buffer.length - totalLines); i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        const content = line.translateToString();
        if (content.trim()) { // Skip empty lines
          scrollbackLines.push({
            content,
            type: 'output', // Default to output, could be enhanced to detect input/error
            timestamp: Date.now()
          });
        }
      }
    }
    
    log(`✅ [MESSAGE] Extracted ${scrollbackLines.length} lines from terminal`);
    return scrollbackLines;
  }

  /**
   * Restore scrollback content to terminal
   */
  private restoreScrollbackToTerminal(
    terminalId: string,
    scrollbackContent: Array<{ content: string; type?: 'output' | 'input' | 'error'; timestamp?: number }>,
    coordinator: IManagerCoordinator
  ): void {
    log(`🔄 [MESSAGE] Restoring ${scrollbackContent.length} lines to terminal ${terminalId}`);
    
    const terminalElement = coordinator.getTerminalElement(terminalId);
    if (!terminalElement) {
      throw new Error(`Terminal element not found for ID: ${terminalId}`);
    }

    const xtermInstance = (terminalElement as any).xterm;
    if (!xtermInstance) {
      throw new Error('xterm.js instance not found');
    }

    // Clear current content and restore scrollback
    // Note: This is a simplified implementation
    // In practice, we might want to preserve the current prompt
    
    for (const line of scrollbackContent) {
      // Write each line to the terminal
      xtermInstance.writeln(line.content);
    }
    
    log(`✅ [MESSAGE] Restored ${scrollbackContent.length} lines to terminal ${terminalId}`);
  }

  public dispose(): void {
    log('🧹 [MESSAGE] Disposing message manager');

    // Clear queue
    this.messageQueue = [];
    this.isProcessingQueue = false;

    log('✅ [MESSAGE] Message manager disposed');
  }
}
