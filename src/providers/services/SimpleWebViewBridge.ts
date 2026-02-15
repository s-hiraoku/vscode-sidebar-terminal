/**
 * Simple WebView Bridge
 *
 * Simplified communication bridge between Extension and WebView.
 * Based on VS Code standard terminal patterns.
 *
 * Replaces complex handshake protocols with simple, reliable message flow:
 * 1. Extension waits for 'webviewReady'
 * 2. Extension sends 'extensionReady'
 * 3. Extension sends 'createTerminal' for each terminal
 * 4. WebView sends 'terminalReady' when terminal is created
 * 5. Extension sends 'output' messages
 */

import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';

/**
 * Terminal configuration sent to WebView
 */
export interface SimpleTerminalConfig {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorBlink?: boolean;
  scrollback?: number;
}

/**
 * Terminal ready info from WebView
 */
export interface TerminalReadyInfo {
  terminalId: string;
  cols: number;
  rows: number;
}

/**
 * Message types from WebView
 */
export type WebViewMessage =
  | { command: 'webviewReady'; timestamp?: number }
  | { command: 'terminalReady'; terminalId: string; cols: number; rows: number; timestamp?: number }
  | { command: 'terminalCreationFailed'; terminalId: string; error: string; timestamp?: number }
  | { command: 'input'; terminalId: string; data: string; timestamp?: number }
  | { command: 'resize'; terminalId: string; cols: number; rows: number; timestamp?: number }
  | { command: 'deleteTerminal'; terminalId: string; source: string; timestamp?: number }
  | { command: 'terminalFocused'; terminalId: string; timestamp?: number }
  | { command: 'terminalBlurred'; terminalId: string; timestamp?: number }
  | { command: 'titleChange'; terminalId: string; title: string; timestamp?: number };

/**
 * Callback handlers for WebView events
 */
export interface SimpleWebViewCallbacks {
  onWebViewReady: () => void;
  onTerminalReady: (info: TerminalReadyInfo) => void;
  onTerminalCreationFailed: (terminalId: string, error: string) => void;
  onInput: (terminalId: string, data: string) => void;
  onResize: (terminalId: string, cols: number, rows: number) => void;
  onDeleteRequest: (terminalId: string, source: string) => void;
  onTerminalFocused: (terminalId: string) => void;
  onTerminalBlurred: (terminalId: string) => void;
  onTitleChange?: (terminalId: string, title: string) => void;
}

/**
 * Simple WebView Bridge
 *
 * Responsibilities:
 * - Send messages to WebView
 * - Handle messages from WebView
 * - Track ready state
 * - No complex queuing or retry logic
 */
export class SimpleWebViewBridge {
  private _view: vscode.WebviewView | undefined;
  private _isWebViewReady = false;
  private _callbacks: SimpleWebViewCallbacks | undefined;
  private _messageListener: vscode.Disposable | undefined;

  // Pending messages when WebView not ready (simple queue)
  private _pendingMessages: unknown[] = [];
  private readonly MAX_PENDING = 100;

  constructor() {
    log('[SimpleWebViewBridge] Created');
  }

  /**
   * Set the WebView view and setup message handling
   */
  public setView(view: vscode.WebviewView, callbacks: SimpleWebViewCallbacks): void {
    log('[SimpleWebViewBridge] Setting view');

    this._view = view;
    this._callbacks = callbacks;
    this._isWebViewReady = false;

    // Dispose previous listener
    this._messageListener?.dispose();

    // Setup message listener
    this._messageListener = view.webview.onDidReceiveMessage((message: WebViewMessage) => {
      this.handleMessage(message);
    });
  }

  /**
   * Clear the view reference
   */
  public clearView(): void {
    log('[SimpleWebViewBridge] Clearing view');

    this._messageListener?.dispose();
    this._messageListener = undefined;
    this._view = undefined;
    this._isWebViewReady = false;
    this._pendingMessages = [];
  }

  /**
   * Check if WebView is ready
   */
  public isReady(): boolean {
    return this._isWebViewReady && this._view !== undefined;
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  /**
   * Handle incoming messages from WebView
   */
  private handleMessage(message: WebViewMessage): void {
    if (!message || typeof message.command !== 'string') {
      log('[SimpleWebViewBridge] Invalid message received');
      return;
    }

    log(`[SimpleWebViewBridge] Received: ${message.command}`);

    switch (message.command) {
      case 'webviewReady':
        this.handleWebViewReady();
        break;

      case 'terminalReady':
        this._callbacks?.onTerminalReady({
          terminalId: message.terminalId,
          cols: message.cols,
          rows: message.rows,
        });
        break;

      case 'terminalCreationFailed':
        this._callbacks?.onTerminalCreationFailed(message.terminalId, message.error);
        break;

      case 'input':
        this._callbacks?.onInput(message.terminalId, message.data);
        break;

      case 'resize':
        this._callbacks?.onResize(message.terminalId, message.cols, message.rows);
        break;

      case 'deleteTerminal':
        this._callbacks?.onDeleteRequest(message.terminalId, message.source);
        break;

      case 'terminalFocused':
        this._callbacks?.onTerminalFocused(message.terminalId);
        break;

      case 'terminalBlurred':
        this._callbacks?.onTerminalBlurred(message.terminalId);
        break;

      case 'titleChange':
        this._callbacks?.onTitleChange?.(message.terminalId, message.title);
        break;

      default:
        log(`[SimpleWebViewBridge] Unknown command: ${(message as any).command}`);
    }
  }

  /**
   * Handle WebView ready message
   */
  private handleWebViewReady(): void {
    log('[SimpleWebViewBridge] WebView is ready');

    this._isWebViewReady = true;
    this._callbacks?.onWebViewReady();

    // Send extension ready
    this.sendExtensionReady();

    // Flush pending messages
    this.flushPendingMessages();
  }

  // ============================================================================
  // Send Methods
  // ============================================================================

  /**
   * Send extension ready message
   */
  private sendExtensionReady(): void {
    this.sendMessage({
      command: 'extensionReady',
      timestamp: Date.now(),
    });
  }

  /**
   * Create terminal in WebView
   */
  public createTerminal(
    terminalId: string,
    terminalName: string,
    terminalNumber: number,
    config: SimpleTerminalConfig,
    isActive: boolean = false
  ): void {
    this.sendMessage({
      command: 'createTerminal',
      terminalId,
      terminalName,
      terminalNumber,
      config,
      isActive,
      timestamp: Date.now(),
    });
  }

  /**
   * Remove terminal from WebView
   */
  public removeTerminal(terminalId: string): void {
    this.sendMessage({
      command: 'removeTerminal',
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Send output to terminal
   */
  public sendOutput(terminalId: string, data: string): void {
    this.sendMessage({
      command: 'output',
      terminalId,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Focus terminal
   */
  public focusTerminal(terminalId: string): void {
    this.sendMessage({
      command: 'focusTerminal',
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear terminal
   */
  public clearTerminal(terminalId: string): void {
    this.sendMessage({
      command: 'clearTerminal',
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Set active terminal
   */
  public setActiveTerminal(terminalId: string): void {
    this.sendMessage({
      command: 'setActiveTerminal',
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Update theme
   */
  public updateTheme(theme: Record<string, string>): void {
    this.sendMessage({
      command: 'updateTheme',
      theme,
      timestamp: Date.now(),
    });
  }

  /**
   * Update font settings
   */
  public updateFont(fontFamily: string, fontSize: number, lineHeight?: number): void {
    this.sendMessage({
      command: 'updateFont',
      fontFamily,
      fontSize,
      lineHeight,
      timestamp: Date.now(),
    });
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Send message to WebView
   */
  private sendMessage(message: unknown): void {
    if (!this._view) {
      log('[SimpleWebViewBridge] No view available, queueing message');
      this.queueMessage(message);
      return;
    }

    if (!this._isWebViewReady && (message as any).command !== 'extensionReady') {
      log('[SimpleWebViewBridge] WebView not ready, queueing message');
      this.queueMessage(message);
      return;
    }

    this.sendMessageDirect(message);
  }

  /**
   * Send message directly to WebView
   */
  private async sendMessageDirect(message: unknown): Promise<void> {
    if (!this._view) return;

    try {
      await this._view.webview.postMessage(message);
      log(`[SimpleWebViewBridge] Sent: ${(message as any).command}`);
    } catch (error) {
      // Handle disposed WebView gracefully
      if (error instanceof Error && error.message.includes('disposed')) {
        log('[SimpleWebViewBridge] WebView disposed');
        this._isWebViewReady = false;
        return;
      }

      log('[SimpleWebViewBridge] Failed to send message:', error);
    }
  }

  /**
   * Queue message for later sending
   */
  private queueMessage(message: unknown): void {
    if (this._pendingMessages.length >= this.MAX_PENDING) {
      // Drop oldest message
      this._pendingMessages.shift();
      log('[SimpleWebViewBridge] Queue full, dropping oldest message');
    }

    this._pendingMessages.push(message);
  }

  /**
   * Flush pending messages
   */
  private flushPendingMessages(): void {
    if (this._pendingMessages.length === 0) return;

    log(`[SimpleWebViewBridge] Flushing ${this._pendingMessages.length} pending messages`);

    const messages = [...this._pendingMessages];
    this._pendingMessages = [];

    for (const message of messages) {
      this.sendMessageDirect(message);
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    log('[SimpleWebViewBridge] Disposing');

    this._messageListener?.dispose();
    this._messageListener = undefined;
    this._view = undefined;
    this._callbacks = undefined;
    this._isWebViewReady = false;
    this._pendingMessages = [];
  }
}
