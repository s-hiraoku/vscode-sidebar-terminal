/**
 * Message Manager - Handles WebView ↔ Extension communication and command processing
 */

import { webview as log } from '../../utils/logger';
import { TerminalInteractionEvent } from '../../types/common';
import { WebViewFontSettings } from '../../types/shared';
import { IMessageManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';

interface MessageCommand {
  command: string;
  claudeStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
  };
  [key: string]: unknown;
}

export class MessageManager implements IMessageManager {
  // Message processing queue for reliability
  private messageQueue: unknown[] = [];
  private isProcessingQueue = false;

  /**
   * Handle incoming messages from the extension
   */
  public handleMessage(message: unknown, coordinator: IManagerCoordinator): void {
    log(`📨 [MESSAGE] ========== MESSAGE MANAGER HANDLE MESSAGE ==========`);
    log(`📨 [MESSAGE] Raw message:`, message);
    log(`📨 [MESSAGE] Message type:`, typeof message);
    log(`📨 [MESSAGE] Message is null/undefined:`, message == null);

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

        case 'switchTerminal':
          this.handleSwitchTerminalMessage(msg, coordinator);
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

        case 'claudeStatusUpdate':
          this.handleClaudeStatusUpdateMessage(msg, coordinator);
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

    // Request current settings
    this.queueMessage(
      {
        command: 'getSettings',
      },
      coordinator
    );

    // Emit ready event
    this.emitTerminalInteractionEvent('webview-ready', '', undefined, coordinator);
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
        // Write directly to terminal (performance manager would handle buffering in a full implementation)
        terminal.terminal.write(data);
        log(`📥 [MESSAGE] Output written to terminal ${terminalId}: ${data.length} chars`);

        // Claude Code detection disabled
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
   * Handle switch terminal message
   */
  private handleSwitchTerminalMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const terminalId = msg.terminalId as string;
    if (terminalId) {
      coordinator.setActiveTerminalId(terminalId);
      log(`🔄 [MESSAGE] Switch to terminal: ${terminalId}`);
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
    log(`📨 [MESSAGE] Message claudeStatus: ${JSON.stringify(msg.claudeStatus)}`);
    log(`📨 [MESSAGE] Message claudeStatus type: ${typeof msg.claudeStatus}`);

    const claudeStatus = msg.claudeStatus;
    if (claudeStatus) {
      log(`🔄 [MESSAGE] Claude status data found:`);
      log(
        `🔄 [MESSAGE]   - activeTerminalName: "${claudeStatus.activeTerminalName}" (${typeof claudeStatus.activeTerminalName})`
      );
      log(`🔄 [MESSAGE]   - status: "${claudeStatus.status}" (${typeof claudeStatus.status})`);
      log(`🔄 [MESSAGE] About to call coordinator.updateClaudeStatus...`);
      log(`🔄 [MESSAGE] Coordinator available: ${!!coordinator}`);
      log(`🔄 [MESSAGE] Coordinator type: ${typeof coordinator}`);
      log(
        `🔄 [MESSAGE] Coordinator.updateClaudeStatus method: ${typeof coordinator.updateClaudeStatus}`
      );

      try {
        const result = coordinator.updateClaudeStatus(
          claudeStatus.activeTerminalName,
          claudeStatus.status
        );
        log(`✅ [MESSAGE] coordinator.updateClaudeStatus called successfully, result: ${result}`);
      } catch (error) {
        log(`❌ [MESSAGE] Error calling coordinator.updateClaudeStatus:`, error);
        log(`❌ [MESSAGE] Error name: ${error instanceof Error ? error.name : 'unknown'}`);
        log(
          `❌ [MESSAGE] Error message: ${error instanceof Error ? error.message : String(error)}`
        );
        log(`❌ [MESSAGE] Error stack: ${error instanceof Error ? error.stack : 'no stack'}`);
      }
    } else {
      log('⚠️ [MESSAGE] No Claude status data in claudeStatusUpdate message');
      log(`⚠️ [MESSAGE] Message keys: ${Object.keys(msg)}`);
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
   * Dispose and cleanup
   */
  public dispose(): void {
    log('🧹 [MESSAGE] Disposing message manager');

    // Clear queue
    this.messageQueue = [];
    this.isProcessingQueue = false;

    log('✅ [MESSAGE] Message manager disposed');
  }
}
