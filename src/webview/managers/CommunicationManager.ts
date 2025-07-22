/**
 * Unified Communication Manager - Consolidates all WebView ↔ Extension messaging
 * Eliminates code duplication across MessageManager and other components
 */

import { VsCodeMessage, WebviewMessage } from '../../types/common';
import { webview as log } from '../../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';

export interface MessageQueueItem {
  message: WebviewMessage;
  timestamp: number;
  retryCount: number;
}

export class CommunicationManager {
  private static instance: CommunicationManager;
  private vscode: any = null;
  private messageQueue: MessageQueueItem[] = [];
  private isReady = false;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY = 1000;

  public static getInstance(): CommunicationManager {
    if (!CommunicationManager.instance) {
      CommunicationManager.instance = new CommunicationManager();
    }
    return CommunicationManager.instance;
  }

  /**
   * Initialize VS Code API connection
   */
  public initialize(): void {
    try {
      if (typeof window !== 'undefined' && 'acquireVsCodeApi' in window) {
        this.vscode = (window as any).acquireVsCodeApi();
        this.isReady = true;
        log('✅ [COMM] VS Code API acquired successfully');
        this.processMessageQueue();
      } else {
        log('⚠️ [COMM] VS Code API not available in this environment');
        this.isReady = false;
      }
    } catch (error) {
      log('❌ [COMM] Failed to acquire VS Code API:', error);
      ErrorHandler.getInstance().handleCommunicationError(error as Error, 'initialize');
      this.isReady = false;
    }
  }

  /**
   * Send message to extension with automatic retry and error handling
   */
  public sendMessage(message: WebviewMessage): void {
    if (!this.isReady || !this.vscode) {
      log(`📦 [COMM] Queueing message (not ready): ${message.command}`);
      this.queueMessage(message);
      return;
    }

    try {
      this.vscode.postMessage(message);
      log(`📤 [COMM] Message sent: ${message.command}`, message);
    } catch (error) {
      log(`❌ [COMM] Failed to send message: ${message.command}`, error);
      ErrorHandler.getInstance().handleCommunicationError(
        error as Error,
        `sendMessage-${message.command}`
      );
      this.queueMessage(message);
    }
  }

  /**
   * Send initialization message to extension
   */
  public sendInitMessage(): void {
    this.sendMessage({ command: 'init' });
  }

  /**
   * Send terminal input to extension
   */
  public sendTerminalInput(data: string, terminalId?: string): void {
    this.sendMessage({
      command: 'input',
      data,
      terminalId,
    });
  }

  /**
   * Send terminal resize request to extension
   */
  public sendTerminalResize(cols: number, rows: number, terminalId?: string): void {
    this.sendMessage({
      command: 'resize',
      cols,
      rows,
      terminalId,
    });
  }

  /**
   * Send terminal clear request to extension
   */
  public sendTerminalClear(terminalId?: string): void {
    this.sendMessage({
      command: 'clear',
      terminalId,
    });
  }

  /**
   * Send terminal kill request to extension
   */
  public sendTerminalKill(terminalId?: string): void {
    this.sendMessage({
      command: 'killTerminal',
      terminalId,
    });
  }

  /**
   * Send terminal delete request to extension
   */
  public sendTerminalDelete(terminalId: string, requestSource: 'header' | 'panel' = 'panel'): void {
    this.sendMessage({
      command: 'deleteTerminal',
      terminalId,
      requestSource,
    });
  }

  /**
   * Send terminal split request to extension
   */
  public sendTerminalSplit(): void {
    this.sendMessage({
      command: 'split',
    });
  }

  /**
   * Send settings request to extension
   */
  public sendSettingsRequest(): void {
    this.sendMessage({
      command: 'getSettings',
    });
  }

  /**
   * Send error report to extension
   */
  public sendErrorReport(errorInfo: {
    type: string;
    message: string;
    context: string;
    stack?: string;
  }): void {
    this.sendMessage({
      command: 'error',
      ...errorInfo,
      timestamp: Date.now(),
    });
  }

  /**
   * Add message listener for incoming messages from extension
   */
  public addMessageListener(callback: (message: VsCodeMessage) => void): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        try {
          const message = event.data as VsCodeMessage;
          log(`📨 [COMM] Message received: ${message.command}`, message);
          callback(message);
        } catch (error) {
          log('❌ [COMM] Error processing incoming message:', error);
          ErrorHandler.getInstance().handleCommunicationError(error as Error, 'messageListener');
        }
      });
      log('👂 [COMM] Message listener added');
    }
  }

  /**
   * Queue message for later sending when connection is ready
   */
  private queueMessage(message: WebviewMessage): void {
    const queueItem: MessageQueueItem = {
      message,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.messageQueue.push(queueItem);
    log(`📦 [COMM] Message queued: ${message.command} (queue size: ${this.messageQueue.length})`);

    // Limit queue size to prevent memory issues
    if (this.messageQueue.length > 100) {
      const removed = this.messageQueue.shift();
      log(`🗑️ [COMM] Queue overflow, removed oldest message: ${removed?.message.command}`);
    }
  }

  /**
   * Process all queued messages when connection becomes ready
   */
  private processMessageQueue(): void {
    if (!this.isReady || this.messageQueue.length === 0) {
      return;
    }

    log(`📦 [COMM] Processing message queue: ${this.messageQueue.length} messages`);

    const messagesToProcess = [...this.messageQueue];
    this.messageQueue = [];

    for (const queueItem of messagesToProcess) {
      try {
        this.vscode.postMessage(queueItem.message);
        log(`📤 [COMM] Queued message sent: ${queueItem.message.command}`);
      } catch (error) {
        log(`❌ [COMM] Failed to send queued message: ${queueItem.message.command}`, error);

        // Retry logic
        if (queueItem.retryCount < this.MAX_RETRY_COUNT) {
          queueItem.retryCount++;
          setTimeout(() => {
            this.messageQueue.push(queueItem);
            log(
              `🔄 [COMM] Retrying message: ${queueItem.message.command} (attempt ${queueItem.retryCount})`
            );
          }, this.RETRY_DELAY * queueItem.retryCount);
        } else {
          log(`❌ [COMM] Max retries exceeded for message: ${queueItem.message.command}`);
          ErrorHandler.getInstance().handleCommunicationError(
            error as Error,
            `processQueue-${queueItem.message.command}`
          );
        }
      }
    }
  }

  /**
   * Check if communication is ready
   */
  public isConnectionReady(): boolean {
    return this.isReady && this.vscode !== null;
  }

  /**
   * Get queue statistics for monitoring
   */
  public getQueueStats(): {
    queueSize: number;
    isReady: boolean;
    oldestMessageAge: number | null;
  } {
    const oldestMessage = this.messageQueue[0];
    return {
      queueSize: this.messageQueue.length,
      isReady: this.isReady,
      oldestMessageAge: oldestMessage ? Date.now() - oldestMessage.timestamp : null,
    };
  }

  /**
   * Force reconnection attempt
   */
  public forceReconnect(): void {
    log('🔄 [COMM] Forcing reconnection attempt');
    this.isReady = false;
    this.vscode = null;
    this.initialize();
  }

  /**
   * Clear message queue (emergency operation)
   */
  public clearQueue(): void {
    const cleared = this.messageQueue.length;
    this.messageQueue = [];
    log(`🗑️ [COMM] Message queue cleared: ${cleared} messages removed`);
  }

  /**
   * Get connection status information
   */
  public getConnectionInfo(): {
    isReady: boolean;
    hasVsCodeApi: boolean;
    queueSize: number;
    environment: string;
  } {
    return {
      isReady: this.isReady,
      hasVsCodeApi: this.vscode !== null,
      queueSize: this.messageQueue.length,
      environment: typeof window !== 'undefined' ? 'browser' : 'node',
    };
  }

  /**
   * Dispose and cleanup resources
   */
  public dispose(): void {
    log('🧹 [COMM] Disposing communication manager');
    this.clearQueue();
    this.isReady = false;
    this.vscode = null;
    log('✅ [COMM] Communication manager disposed');
  }
}
