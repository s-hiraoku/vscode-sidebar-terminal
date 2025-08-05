/**
 * Message Manager - Handles WebView ↔ Extension communication and command processing
 */

import { webview as log } from '../../utils/logger';
import { TerminalInteractionEvent } from '../../types/common';
import { WebViewFontSettings } from '../../types/shared';
import { IMessageManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
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

interface MessageCommand {
  command: string;
  cliAgentStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
    terminalId?: string; // 🛠️ FIX: Add terminalId for reliable status updates
  };
  [key: string]: unknown;
}

export class MessageManager implements IMessageManager {
  // Message processing queue for reliability
  private messageQueue: unknown[] = [];
  private isProcessingQueue = false;

  // Unified managers
  // Use direct communication instead of CommunicationManager to avoid circular dependency
  // Use direct logger instead of LoggerManager to avoid circular dependency

  /**
   * Handle incoming messages from the extension
   */
  public handleMessage(message: MessageEvent, coordinator: IManagerCoordinator): void {
    try {
      const msg = message.data as MessageCommand;
      log(`📨 [MESSAGE] Received: ${msg.command}`);

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
          this.handleTerminalCreatedMessage(msg, coordinator);
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

        // extractScrollbackData case removed - using VS Code standard approach with automatic persistence
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
   * Issue #122: AI Agent切り替え要求メッセージを送信
   */
  public sendSwitchAiAgentMessage(terminalId: string, coordinator: IManagerCoordinator): void {
    log(`📤 [MESSAGE] ========== SENDING SWITCH AI AGENT MESSAGE ==========`);
    log(`📤 [MESSAGE] Terminal ID: ${terminalId}`);
    log(`📤 [MESSAGE] Coordinator available:`, !!coordinator);

    const message = {
      command: 'switchAiAgent',
      terminalId,
      timestamp: Date.now(),
    };

    log(`📤 [MESSAGE] Message to send:`, message);

    try {
      this.queueMessage(message, coordinator);
      log(`📤 [MESSAGE] Switch AI Agent message queued successfully for: ${terminalId}`);
    } catch (error) {
      log(`❌ [MESSAGE] Error queueing switch AI Agent message:`, error);
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
        // 🚨 OPTIMIZATION 8: Reduced debug logging - only log significant CLI agent patterns
        if (
          data.length > 2000 &&
          (data.includes('Gemini') || data.includes('gemini') || data.includes('Claude'))
        ) {
          console.log(`🔍 [WEBVIEW] CLI Agent output detected:`, {
            terminalId,
            dataLength: data.length,
            containsGeminiPattern: data.includes('Gemini') || data.includes('gemini'),
            containsClaudePattern: data.includes('Claude') || data.includes('claude'),
          });
        }

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
    log(`📨 [MESSAGE] CLI Agent Status Update received`);

    const cliAgentStatus = msg.cliAgentStatus;
    if (cliAgentStatus) {
      log(
        `🔄 [MESSAGE] Processing status update: ${cliAgentStatus.status} for ${cliAgentStatus.activeTerminalName} (ID: ${cliAgentStatus.terminalId})`
      );

      try {
        // 🛠️ FIX: Use terminalId directly if available, fallback to extracting from name
        let terminalId: string;

        if (cliAgentStatus.terminalId) {
          // Use the provided terminalId directly (most reliable)
          terminalId = cliAgentStatus.terminalId;
          log(`🎯 [MESSAGE] Using provided terminalId: ${terminalId}`);
        } else if (cliAgentStatus.activeTerminalName) {
          // Fallback: Extract terminal ID from terminal name (e.g., "Terminal 1" -> "1")
          terminalId = cliAgentStatus.activeTerminalName.replace('Terminal ', '') || '1';
          log(`🔍 [MESSAGE] Extracted terminalId from name: ${terminalId}`);
        } else {
          // Last resort: Find terminal by status (for termination cases)
          const allTerminals = coordinator.getAllTerminalInstances();
          const connectedTerminal = Array.from(allTerminals.keys())[0]; // Use first terminal as fallback
          terminalId = connectedTerminal || '1';
          log(`⚠️ [MESSAGE] Using fallback terminalId: ${terminalId}`);
        }

        // Map legacy status to new status format
        const mappedStatus = this.mapLegacyStatus(cliAgentStatus.status);

        // Call the centralized status management method
        coordinator.updateCliAgentStatus(
          terminalId,
          mappedStatus,
          cliAgentStatus.agentType || null
        );

        log(
          `✅ [MESSAGE] CLI Agent status updated successfully: ${mappedStatus} for terminal ${terminalId}`
        );
      } catch (error) {
        log(`❌ [MESSAGE] Error updating CLI Agent status:`, error);
      }
    } else {
      log('⚠️ [MESSAGE] No CLI Agent status data in message');
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
        log(`⚠️ [MESSAGE] Unknown legacy status: ${legacyStatus}, defaulting to 'none'`);
        return 'none';
    }
  }

  /**
   * 🔧 NEW: Handle full CLI Agent state sync message from extension
   * Solves DISCONNECTED terminals showing as "none" instead of "disconnected"
   */
  private handleCliAgentFullStateSyncMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    log(`📡 [MESSAGE] CLI Agent Full State Sync received`);
    log(`🔍 [MESSAGE] Full message data:`, msg);

    const terminalStates = msg.terminalStates;
    const connectedAgentId = msg.connectedAgentId;
    const connectedAgentType = msg.connectedAgentType;
    const disconnectedCount = msg.disconnectedCount;

    log(`🔍 [MESSAGE] Extracted data:`, {
      terminalStates,
      connectedAgentId,
      connectedAgentType,
      disconnectedCount,
    });

    if (terminalStates) {
      log(
        `🔄 [MESSAGE] Processing full state sync: CONNECTED=${String(connectedAgentId)} (${String(connectedAgentType)}), DISCONNECTED=${String(disconnectedCount)}`
      );
      log(`📋 [MESSAGE] Terminal states:`, terminalStates);

      try {
        // Apply all terminal states at once
        for (const [terminalId, stateInfo] of Object.entries(terminalStates)) {
          const typedStateInfo = stateInfo as {
            status: 'connected' | 'disconnected' | 'none';
            agentType: string | null;
          };
          log(`🔄 [MESSAGE] About to update terminal ${terminalId}:`, typedStateInfo);

          try {
            coordinator.updateCliAgentStatus(
              terminalId,
              typedStateInfo.status,
              typedStateInfo.agentType
            );

            log(
              `✅ [MESSAGE] Applied state: Terminal ${terminalId} -> ${typedStateInfo.status} (${typedStateInfo.agentType})`
            );
          } catch (error) {
            log(`❌ [MESSAGE] Error updating terminal ${terminalId}:`, error);
          }
        }

        log(`🎯 [MESSAGE] Full CLI Agent state sync completed successfully`);
      } catch (error) {
        log(`❌ [MESSAGE] Error during full state sync:`, error);
      }
    } else {
      log('⚠️ [MESSAGE] No terminal states data in full state sync message');
    }
  }

  /**
   * Queue message for reliable delivery
   */
  private queueMessage(message: unknown, coordinator: IManagerCoordinator): void {
    const msgObj = message as { command?: string };
    log(
      `📤 [MESSAGE] Queueing message: ${msgObj?.command || 'unknown'} (queue size: ${this.messageQueue.length})`
    );
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
        log(`❌ [MESSAGE] Failed to restore terminal session ${terminalId}: ${String(error)}`);
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

  private async handleTerminalRestoreErrorMessage(msg: MessageCommand): Promise<void> {
    const terminalName = (msg.terminalName as string) || 'Unknown terminal';
    const error = (msg.error as string) || 'Unknown error';
    log(`⚠️ [MESSAGE] Terminal restore error: ${terminalName} - ${error}`);

    // Import the function here to avoid circular dependencies
    const { showTerminalRestoreError } = await import('../utils/NotificationUtils');
    showTerminalRestoreError(terminalName, error);
  }

  /**
   * Handle scrollback data extraction request (new unified interface)
   */
  private handleExtractScrollbackDataMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    log('📋 [MESSAGE] ========== EXTRACT SCROLLBACK DATA MESSAGE RECEIVED ==========');
    log('📋 [MESSAGE] Full message:', msg);
    log('📋 [MESSAGE] Message keys:', Object.keys(msg || {}));

    const terminalId = msg.terminalId as string;
    const maxLines = (msg.maxLines as number) || 1000;
    const requestId = msg.requestId as string;

    log(
      `📋 [MESSAGE] Extracted parameters: terminalId=${terminalId}, maxLines=${maxLines}, requestId=${requestId}`
    );

    if (!terminalId) {
      log('❌ [MESSAGE] No terminal ID provided for scrollback extraction');
      return;
    }

    if (!requestId) {
      log('❌ [MESSAGE] No request ID provided for scrollback extraction');
      return;
    }

    // Debug coordinator state
    log(
      '📋 [MESSAGE] Coordinator available terminals:',
      coordinator.getAllTerminalInstances().size
    );
    const allTerminals = coordinator.getAllTerminalInstances();
    for (const [id, terminal] of allTerminals) {
      log(`📋 [MESSAGE] Available terminal: ${id} (name: ${terminal.name})`);
    }

    // Get terminal instance
    const terminalInstance = coordinator.getTerminalInstance(terminalId);
    log(`📋 [MESSAGE] Terminal instance found: ${!!terminalInstance}`);
    if (terminalInstance) {
      log(
        `📋 [MESSAGE] Terminal instance details: id=${terminalInstance.id}, name=${terminalInstance.name}, hasTerminal=${!!terminalInstance.terminal}`
      );
    }

    if (!terminalInstance) {
      log(`❌ [MESSAGE] Terminal instance not found for ID: ${terminalId}`);
      log('❌ [MESSAGE] Sending error response...');

      // Send error response
      this.queueMessage(
        {
          command: 'scrollbackDataCollected',
          terminalId,
          requestId,
          scrollbackData: [],
          success: false,
          error: `Terminal not found: ${terminalId}`,
          timestamp: Date.now(),
        },
        coordinator
      );
      log('❌ [MESSAGE] Error response queued');
      return;
    }

    try {
      log('📋 [MESSAGE] Starting scrollback extraction process...');

      // Try to extract scrollback from persistence manager first (if available)
      let scrollbackData: Array<{ content: string; type?: string; timestamp?: number }> = [];

      try {
        log('📋 [MESSAGE] Attempting persistence manager extraction...');
        scrollbackData = this.extractScrollbackFromPersistenceManager(
          coordinator,
          terminalId,
          maxLines
        );
        log(`📋 [MESSAGE] Extracted ${scrollbackData.length} lines from persistence manager`);
      } catch (persistenceError) {
        log(
          `⚠️ [MESSAGE] Persistence manager extraction failed, falling back to xterm buffer: ${String(persistenceError)}`
        );

        try {
          log('📋 [MESSAGE] Attempting xterm buffer extraction...');
          scrollbackData = this.extractScrollbackFromXterm(terminalInstance.terminal, maxLines);
          log(`📋 [MESSAGE] Extracted ${scrollbackData.length} lines from xterm buffer`);
        } catch (xtermError) {
          log(`❌ [MESSAGE] Xterm buffer extraction also failed: ${String(xtermError)}`);
          throw xtermError;
        }
      }

      log('📋 [MESSAGE] Preparing to send scrollbackDataCollected response...');

      // Send scrollback data back to extension with correct command name
      const responseMessage = {
        command: 'scrollbackDataCollected',
        terminalId,
        requestId,
        scrollbackData,
        success: true,
        timestamp: Date.now(),
      };

      log('📋 [MESSAGE] Response message prepared:', responseMessage);

      this.queueMessage(responseMessage, coordinator);

      log(
        `✅ [MESSAGE] Scrollback data collected for terminal ${terminalId}: ${scrollbackData.length} lines (requestId: ${requestId})`
      );
      log('✅ [MESSAGE] Response has been queued and should be sent to extension');
    } catch (error) {
      log(
        `❌ [MESSAGE] Error extracting scrollback data: ${error instanceof Error ? error.message : String(error)}`
      );

      this.queueMessage(
        {
          command: 'scrollbackDataCollected',
          terminalId,
          requestId,
          scrollbackData: [],
          success: false,
          error: `Failed to extract scrollback: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
        },
        coordinator
      );
    }
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

    // Get terminal instance instead of element
    const terminalInstance = coordinator.getTerminalInstance(terminalId);
    if (!terminalInstance) {
      log(`❌ [MESSAGE] Terminal instance not found for ID: ${terminalId}`);
      return;
    }

    try {
      // Extract scrollback from xterm.js
      const scrollbackContent = this.extractScrollbackFromXterm(
        terminalInstance.terminal,
        maxLines
      );

      // Send scrollback data back to extension
      this.queueMessage(
        {
          command: 'scrollbackExtracted',
          terminalId,
          scrollbackContent,
          timestamp: Date.now(),
        },
        coordinator
      );

      log(
        `✅ [MESSAGE] Scrollback extracted for terminal ${terminalId}: ${scrollbackContent.length} lines`
      );
    } catch (error) {
      log(
        `❌ [MESSAGE] Error extracting scrollback: ${error instanceof Error ? error.message : String(error)}`
      );

      this.queueMessage(
        {
          command: 'error',
          error: `Failed to extract scrollback: ${error instanceof Error ? error.message : String(error)}`,
          terminalId,
          timestamp: Date.now(),
        },
        coordinator
      );
    }
  }

  /**
   * Handle scrollback restoration request
   */
  private handleRestoreScrollbackMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
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
      // Get terminal instance
      const terminalInstance = coordinator.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        throw new Error(`Terminal instance not found for ID: ${terminalId}`);
      }

      // Restore scrollback to the terminal
      this.restoreScrollbackToXterm(terminalInstance.terminal, scrollbackContent);

      // Send confirmation back to extension
      this.queueMessage(
        {
          command: 'scrollbackRestored',
          terminalId,
          restoredLines: scrollbackContent.length,
          timestamp: Date.now(),
        },
        coordinator
      );

      log(
        `✅ [MESSAGE] Scrollback restored for terminal ${terminalId}: ${scrollbackContent.length} lines`
      );
    } catch (error) {
      log(
        `❌ [MESSAGE] Error restoring scrollback: ${error instanceof Error ? error.message : String(error)}`
      );

      this.queueMessage(
        {
          command: 'error',
          error: `Failed to restore scrollback: ${error instanceof Error ? error.message : String(error)}`,
          terminalId,
          timestamp: Date.now(),
        },
        coordinator
      );
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
    log(
      `📊 [MESSAGE] Scrollback progress: ${progressInfo.progress}% (${progressInfo.currentLines}/${progressInfo.totalLines})`
    );

    // TODO: Update progress UI if needed
  }

  /**
   * Extract scrollback content from xterm terminal (improved version)
   */
  private extractScrollbackFromXterm(
    terminal: Terminal,
    maxLines: number
  ): Array<{ content: string; type?: 'output' | 'input' | 'error'; timestamp?: number }> {
    log(`🔍 [MESSAGE] Extracting scrollback from xterm terminal (max ${maxLines} lines)`);

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

      log(
        `🔍 [MESSAGE] Buffer info: length=${bufferLength}, viewportY=${viewportY}, baseY=${baseY}`
      );

      // Calculate range to extract (include scrollback + viewport)
      const startLine = Math.max(0, bufferLength - maxLines);
      const endLine = bufferLength;

      log(
        `🔍 [MESSAGE] Extracting lines ${startLine} to ${endLine} (${endLine - startLine} lines)`
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
                type: 'output', // Default type - could be enhanced to detect input/error patterns
                timestamp: Date.now(),
              });
            }
          }
        } catch (lineError) {
          log(`⚠️ [MESSAGE] Error extracting line ${i}: ${String(lineError)}`);
          continue;
        }
      }

      // 最後の不要な空行を削除
      while (scrollbackLines.length > 0) {
        const lastLine = scrollbackLines[scrollbackLines.length - 1];
        if (!lastLine || !lastLine.content.trim()) {
          scrollbackLines.pop();
        } else {
          break;
        }
      }

      log(
        `✅ [MESSAGE] Successfully extracted ${scrollbackLines.length} lines from terminal buffer`
      );
    } catch (error) {
      log(`❌ [MESSAGE] Error accessing terminal buffer: ${String(error)}`);
      throw error;
    }

    return scrollbackLines;
  }

  /**
   * Extract scrollback from persistence manager (if available)
   */
  private extractScrollbackFromPersistenceManager(
    coordinator: IManagerCoordinator,
    terminalId: string,
    maxLines: number
  ): Array<{ content: string; type?: 'output' | 'input' | 'error'; timestamp?: number }> {
    log(
      `🔍 [MESSAGE] Attempting to extract scrollback from persistence manager for terminal ${terminalId}`
    );

    // Access persistence manager through coordinator
    const terminalManager = coordinator as {
      persistenceManager?: { serializeTerminal: (id: string, options: unknown) => unknown };
    };
    const persistenceManager = terminalManager.persistenceManager;

    if (!persistenceManager) {
      throw new Error('Persistence manager not available');
    }

    // Try to serialize the terminal using the persistence manager
    try {
      const serializedData = persistenceManager.serializeTerminal(terminalId, {
        scrollback: maxLines,
        excludeModes: false,
        excludeAltBuffer: true,
      });

      const typedData = serializedData as { content?: string };
      if (!serializedData || !typedData.content) {
        throw new Error('No serialized content returned from persistence manager');
      }

      // Parse the serialized content into line data
      const lines = typedData.content.split('\n');
      const scrollbackData: Array<{
        content: string;
        type?: 'output' | 'input' | 'error';
        timestamp?: number;
      }> = [];

      for (const line of lines) {
        if (line.trim() || scrollbackData.length > 0) {
          scrollbackData.push({
            content: line,
            type: 'output',
            timestamp: Date.now(),
          });
        }
      }

      // Remove trailing empty lines
      while (scrollbackData.length > 0) {
        const lastLine = scrollbackData[scrollbackData.length - 1];
        if (!lastLine || !lastLine.content.trim()) {
          scrollbackData.pop();
        } else {
          break;
        }
      }

      log(`✅ [MESSAGE] Persistence manager extracted ${scrollbackData.length} lines`);
      return scrollbackData;
    } catch (error) {
      log(`❌ [MESSAGE] Error in persistence manager extraction: ${String(error)}`);
      throw error;
    }
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
    log(`🔄 [MESSAGE] Restoring ${scrollbackContent.length} lines to terminal`);

    if (!terminal) {
      throw new Error('Terminal instance not provided');
    }

    // Clear current content and restore scrollback
    // Note: This is a simplified implementation
    // In practice, we might want to preserve the current prompt

    for (const line of scrollbackContent) {
      // Write each line to the terminal
      terminal.writeln(line.content);
    }

    log(`✅ [MESSAGE] Restored ${scrollbackContent.length} lines to terminal`);
  }

  /**
   * Handle terminal serialization request
   */
  private handleSerializeTerminalMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    log('📋 [MESSAGE] Handling serialize terminal message');

    const terminalId = msg.terminalId as string;
    const scrollbackLines = (msg.scrollbackLines as number) || 100;

    if (!terminalId) {
      log('❌ [MESSAGE] Invalid serialize terminal request - missing terminalId');
      return;
    }

    try {
      // Get persistence manager from the coordinator
      const terminalManager = coordinator as {
        persistenceManager?: {
          serializeTerminal: (
            id: string,
            options: unknown
          ) => { content: string; html: string } | null;
        };
      };
      const persistenceManager = terminalManager.persistenceManager;

      if (!persistenceManager) {
        throw new Error('Persistence manager not available');
      }

      // Serialize the terminal content
      const serializedData = persistenceManager.serializeTerminal(terminalId, {
        scrollback: scrollbackLines,
        excludeModes: false,
        excludeAltBuffer: true,
      });

      if (!serializedData) {
        throw new Error(`Failed to serialize terminal ${terminalId}`);
      }

      // Send response back to extension
      const content = String(serializedData.content || '');
      const html = String(serializedData.html || '');

      this.queueMessage(
        {
          command: 'serializationResponse',
          terminalId,
          serializedContent: content,
          serializedHtml: html,
          timestamp: Date.now(),
        },
        coordinator
      );

      log(`✅ [MESSAGE] Terminal ${terminalId} serialized: ${content.length} chars`);
    } catch (error) {
      log(
        `❌ [MESSAGE] Error serializing terminal: ${error instanceof Error ? error.message : String(error)}`
      );

      this.queueMessage(
        {
          command: 'serializationError',
          terminalId,
          error: `Failed to serialize terminal: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
        },
        coordinator
      );
    }
  }

  /**
   * Handle restore serialized content request
   */
  private handleRestoreSerializedContentMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    log('🔄 [MESSAGE] Handling restore serialized content message');

    const terminalId = msg.terminalId as string;
    const serializedContent = msg.serializedContent as string;

    if (!terminalId || !serializedContent) {
      log('❌ [MESSAGE] Invalid restore serialized content request');
      return;
    }

    try {
      // Get persistence manager from the coordinator
      const terminalManager = coordinator as {
        persistenceManager?: { restoreTerminalContent: (id: string, content: string) => boolean };
      };
      const persistenceManager = terminalManager.persistenceManager;

      if (!persistenceManager) {
        throw new Error('Persistence manager not available');
      }

      // Restore the serialized content
      const success = persistenceManager.restoreTerminalContent(terminalId, serializedContent);

      if (!success) {
        throw new Error(`Failed to restore content to terminal ${terminalId}`);
      }

      log(
        `✅ [MESSAGE] Serialized content restored to terminal ${terminalId}: ${serializedContent.length} chars`
      );
    } catch (error) {
      log(
        `❌ [MESSAGE] Error restoring serialized content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle terminal restore info message (WebView初期化後の状態復元)
   */
  private handleTerminalRestoreInfoMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    log('🔄 [MESSAGE] Handling terminal restore info message');

    const terminals = msg.terminals as Array<{
      id: string;
      name: string;
      number: number;
      cwd: string;
      isActive: boolean;
    }>;
    const _activeTerminalId = msg.activeTerminalId as string;

    if (!terminals || !Array.isArray(terminals)) {
      log('❌ [MESSAGE] Invalid terminal restore info - no terminals array');
      return;
    }

    try {
      log(`📋 [MESSAGE] Processing restore info for ${terminals.length} terminals`);

      // 各ターミナルについて状態復元を試行
      for (const terminalInfo of terminals) {
        try {
          log(
            `🔄 [MESSAGE] Attempting restore for terminal ${terminalInfo.name} (${terminalInfo.id})`
          );

          // 現在のターミナル一覧と照合して、対応するターミナルを見つける
          const existingTerminals = coordinator.getAllTerminalInstances();
          const matchingTerminal = Array.from(existingTerminals.values()).find(
            (t, index) => index === terminalInfo.number - 1 // Terminal numbering starts from 1
          );

          if (matchingTerminal) {
            log(`✅ [MESSAGE] Found matching terminal for ${terminalInfo.name}`);

            // Persistence Managerを使用してコンテンツ復元
            const terminalManager = coordinator as {
              persistenceManager?: { restoreTerminalFromStorage: (id: string) => boolean };
            };
            const persistenceManager = terminalManager.persistenceManager;

            if (persistenceManager) {
              // 少し遅延を入れてターミナルが完全に初期化されるのを待つ
              setTimeout(() => {
                const restored = persistenceManager.restoreTerminalFromStorage(matchingTerminal.id);
                if (restored) {
                  log(`✅ [MESSAGE] Content restored for terminal ${terminalInfo.name}`);
                } else {
                  log(`⚠️ [MESSAGE] No saved content for terminal ${terminalInfo.name}`);
                }
              }, 100);
            }

            // アクティブターミナルの設定
            if (terminalInfo.isActive) {
              coordinator.setActiveTerminalId(matchingTerminal.id);
              log(`🎯 [MESSAGE] Set active terminal: ${terminalInfo.name}`);
            }
          } else {
            log(`⚠️ [MESSAGE] No matching terminal found for ${terminalInfo.name}`);
          }
        } catch (terminalError) {
          log(
            `❌ [MESSAGE] Error processing terminal ${terminalInfo.name}: ${String(terminalError)}`
          );
        }
      }

      log(`✅ [MESSAGE] Terminal restore info processing completed`);
    } catch (error) {
      log(
        `❌ [MESSAGE] Error processing terminal restore info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle save all terminal sessions message
   */
  private handleSaveAllTerminalSessionsMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    log('💾 [MESSAGE] Handling save all terminal sessions message');

    try {
      const terminalManager = coordinator as {
        persistenceManager?: { saveTerminalContent: (id: string) => void };
      };
      const persistenceManager = terminalManager.persistenceManager;

      if (!persistenceManager) {
        log('⚠️ [MESSAGE] No persistence manager available');
        return;
      }

      // 全ターミナルの保存を強制実行
      const terminals = coordinator.getAllTerminalInstances();
      let savedCount = 0;

      for (const [terminalId, _terminal] of terminals) {
        try {
          // 手動で保存メソッドを呼び出す
          persistenceManager.saveTerminalContent(terminalId);
          savedCount++;
        } catch (error) {
          log(`❌ [MESSAGE] Failed to save terminal ${terminalId}:`, error);
        }
      }

      log(`✅ [MESSAGE] Saved ${savedCount}/${terminals.size} terminal sessions`);
    } catch (error) {
      log(`❌ [MESSAGE] Error saving all terminal sessions: ${String(error)}`);
    }
  }

  public dispose(): void {
    log('🧹 [MESSAGE] Disposing message manager');

    // Clear queue
    this.messageQueue = [];
    this.isProcessingQueue = false;

    log('✅ [MESSAGE] Message manager disposed');
  }
}
