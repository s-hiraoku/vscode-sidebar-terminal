/**
 * WebView メッセージルーター
 * 
 * WebView との双方向通信を管理し、メッセージルーティングを行います。
 * Provider から分離してメッセージ処理のみに特化しています。
 */

import * as vscode from 'vscode';
import { WebviewMessage, VsCodeMessage } from '../types/common';
import { MessageFactory } from './MessageFactory';
import { OperationResult, OperationResultHandler, NotificationService } from '../utils/OperationResultHandler';
import { extension as log } from '../utils/logger';

export interface IWebViewMessageRouter {
  setupMessageHandling(webviewView: vscode.WebviewView): void;
  sendMessage(message: WebviewMessage): Promise<void>;
  sendMessageDirect(message: WebviewMessage): Promise<void>;
  addMessageHandler(command: string, handler: MessageHandler): void;
  removeMessageHandler(command: string): void;
  getMessageStats(): { queueSize: number; isWebviewReady: boolean; handlerCount: number; maxQueueSize: number; };
  dispose(): void;
}

export type MessageHandler = (message: VsCodeMessage) => Promise<void> | void;

export interface MessageRouterConfig {
  enableMessageQueue: boolean;
  maxQueueSize: number;
  messageTimeout: number;
  retryAttempts: number;
  debugLogging: boolean;
}

/**
 * WebView メッセージルーター
 */
export class WebViewMessageRouter implements IWebViewMessageRouter {
  private webviewView: vscode.WebviewView | null = null;
  private readonly messageHandlers = new Map<string, MessageHandler>();
  private readonly messageQueue: WebviewMessage[] = [];
  private readonly config: MessageRouterConfig;
  private isWebviewReady = false;
  
  // リソース管理
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    config: Partial<MessageRouterConfig> = {},
    private readonly notificationService?: NotificationService
  ) {
    this.config = {
      enableMessageQueue: true,
      maxQueueSize: 100,
      messageTimeout: 5000,
      retryAttempts: 3,
      debugLogging: false,
      ...config
    };
    
    log('📡 [MESSAGE-ROUTER] WebView message router initialized');
  }

  /**
   * WebView メッセージハンドリングを設定
   */
  setupMessageHandling(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    
    // メッセージ受信ハンドラーを設定
    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      (message: VsCodeMessage) => this.handleIncomingMessage(message)
    );
    this.disposables.push(messageDisposable);
    
    // WebView可視性変更ハンドラー
    const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.flushMessageQueue();
      }
    });
    this.disposables.push(visibilityDisposable);
    
    log('📡 [MESSAGE-ROUTER] Message handling setup complete');
  }

  /**
   * メッセージを送信（キュー対応）
   */
  async sendMessage(message: WebviewMessage): Promise<void> {
    if (this.config.debugLogging) {
      log(`📤 [MESSAGE-ROUTER] Sending message: ${message.command}`);
    }

    // WebView が準備できていない場合はキューに追加
    if (!this.isWebviewReady && this.config.enableMessageQueue) {
      this.enqueueMessage(message);
      return;
    }

    return this.sendMessageDirect(message);
  }

  /**
   * メッセージを直接送信
   */
  async sendMessageDirect(message: WebviewMessage): Promise<void> {
    if (!this.webviewView) {
      throw new Error('WebView not initialized');
    }

    try {
      // タイムスタンプを追加
      const messageWithTimestamp = MessageFactory.updateTimestamp(message);
      
      await this.webviewView.webview.postMessage(messageWithTimestamp);
      
      if (this.config.debugLogging) {
        log(`✅ [MESSAGE-ROUTER] Message sent successfully: ${message.command}`);
      }
    } catch (error) {
      log(`❌ [MESSAGE-ROUTER] Failed to send message ${message.command}: ${String(error)}`);
      
      if (this.notificationService) {
        this.notificationService.showError(`Failed to send message: ${message.command}`);
      }
      
      throw error;
    }
  }

  /**
   * メッセージハンドラーを追加
   */
  addMessageHandler(command: string, handler: MessageHandler): void {
    this.messageHandlers.set(command, handler);
    log(`📝 [MESSAGE-ROUTER] Handler added for command: ${command}`);
  }

  /**
   * メッセージハンドラーを削除
   */
  removeMessageHandler(command: string): void {
    this.messageHandlers.delete(command);
    log(`🗑️ [MESSAGE-ROUTER] Handler removed for command: ${command}`);
  }

  /**
   * 全リソースを解放
   */
  dispose(): void {
    log('🗑️ [MESSAGE-ROUTER] Disposing message router...');
    
    // Disposableを解放
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    // データ構造をクリア
    this.messageHandlers.clear();
    this.messageQueue.length = 0;
    this.webviewView = null;
    this.isWebviewReady = false;
    
    log('✅ [MESSAGE-ROUTER] Message router disposed');
  }

  // === バッチメッセージ送信 ===

  /**
   * 複数のメッセージを一括送信
   */
  async sendBatchMessages(messages: WebviewMessage[]): Promise<OperationResult<void>> {
    if (messages.length === 0) {
      return OperationResultHandler.success();
    }

    const errors: string[] = [];
    
    for (const message of messages) {
      try {
        await this.sendMessage(message);
      } catch (error) {
        errors.push(`${message.command}: ${String(error)}`);
      }
    }

    if (errors.length === 0) {
      log(`✅ [MESSAGE-ROUTER] Batch sent successfully: ${messages.length} messages`);
      return OperationResultHandler.success();
    } else {
      const errorMessage = `Batch send partially failed: ${errors.join(', ')}`;
      log(`⚠️ [MESSAGE-ROUTER] ${errorMessage}`);
      return OperationResultHandler.failure(errorMessage);
    }
  }

  // === ユーティリティメソッド ===

  /**
   * WebView の準備状態を設定
   */
  setWebviewReady(isReady: boolean): void {
    const wasReady = this.isWebviewReady;
    this.isWebviewReady = isReady;
    
    if (!wasReady && isReady) {
      log('🎯 [MESSAGE-ROUTER] WebView ready, flushing message queue');
      this.flushMessageQueue();
    }
  }

  /**
   * メッセージ統計を取得
   */
  getMessageStats(): {
    queueSize: number;
    isWebviewReady: boolean;
    handlerCount: number;
    maxQueueSize: number;
  } {
    return {
      queueSize: this.messageQueue.length,
      isWebviewReady: this.isWebviewReady,
      handlerCount: this.messageHandlers.size,
      maxQueueSize: this.config.maxQueueSize,
    };
  }

  // === プライベートメソッド ===

  /**
   * 受信メッセージを処理
   */
  private async handleIncomingMessage(message: VsCodeMessage): Promise<void> {
    if (this.config.debugLogging) {
      log(`📥 [MESSAGE-ROUTER] Received message: ${message.command}`);
    }

    // WebView準備完了メッセージの特別処理
    if (message.command === 'ready' || message.command === 'webviewReady') {
      this.setWebviewReady(true);
    }

    // ハンドラーを取得
    const handler = this.messageHandlers.get(message.command);
    if (!handler) {
      log(`⚠️ [MESSAGE-ROUTER] No handler found for command: ${message.command}`);
      return;
    }

    try {
      await handler(message);
      
      if (this.config.debugLogging) {
        log(`✅ [MESSAGE-ROUTER] Message handled successfully: ${message.command}`);
      }
    } catch (error) {
      log(`❌ [MESSAGE-ROUTER] Handler error for ${message.command}: ${String(error)}`);
      
      // エラーレスポンスを送信
      try {
        await this.sendMessage(MessageFactory.createErrorMessage(
          `Handler error: ${String(error)}`,
          `command-${message.command}`,
          message.terminalId
        ));
      } catch (sendError) {
        log(`❌ [MESSAGE-ROUTER] Failed to send error response: ${String(sendError)}`);
      }
    }
  }

  /**
   * メッセージをキューに追加
   */
  private enqueueMessage(message: WebviewMessage): void {
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      // キューがフルの場合は古いメッセージを削除
      const removed = this.messageQueue.shift();
      log(`⚠️ [MESSAGE-ROUTER] Message queue full, removing: ${removed?.command}`);
    }

    this.messageQueue.push(message);
    log(`📋 [MESSAGE-ROUTER] Message queued: ${message.command} (queue size: ${this.messageQueue.length})`);
  }

  /**
   * メッセージキューをフラッシュ
   */
  private async flushMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      return;
    }

    log(`🚀 [MESSAGE-ROUTER] Flushing message queue: ${this.messageQueue.length} messages`);

    const messages = [...this.messageQueue];
    this.messageQueue.length = 0;

    for (const message of messages) {
      try {
        await this.sendMessageDirect(message);
      } catch (error) {
        log(`❌ [MESSAGE-ROUTER] Failed to flush message ${message.command}: ${String(error)}`);
        
        // 重要なメッセージは再キューに追加
        if (this.isImportantMessage(message)) {
          this.enqueueMessage(message);
        }
      }
    }

    log('✅ [MESSAGE-ROUTER] Message queue flush completed');
  }

  /**
   * 重要なメッセージかどうか判定
   */
  private isImportantMessage(message: WebviewMessage): boolean {
    const importantCommands = [
      'terminalCreated',
      'terminalRemoved',
      'stateUpdate',
      'settingsResponse',
      'sessionRestoreCompleted',
      'sessionRestoreError'
    ];
    
    return importantCommands.includes(message.command);
  }
}