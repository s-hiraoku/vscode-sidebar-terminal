/**
 * WebView Communication Service
 *
 * Handles message sending to WebView with error handling
 * Extracted from SecondaryTerminalProvider for better separation of concerns
 */

import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { TerminalErrorHandler } from '../../utils/feedback';
import { WebviewMessage } from '../../types/common';

/**
 * WebView Communication Service
 *
 * Responsibilities:
 * - Message sending to WebView
 * - Error handling for disposed WebViews
 * - Message logging and debugging
 */
export class WebViewCommunicationService {
  private _view?: vscode.WebviewView;
  private _isReady = false;
  private _pendingMessages: WebviewMessage[] = [];
  private static readonly MAX_QUEUE_SIZE = 100;

  /**
   * Set the WebView view
   */
  public setView(view: vscode.WebviewView | undefined): void {
    this._view = view;

    if (!view) {
      log('⚠️ [COMMUNICATION] Webview cleared - resetting ready state and queue');
      this._isReady = false;
      this._pendingMessages = [];
      return;
    }

    this._isReady = false;
    log('✅ [COMMUNICATION] Webview reference set - awaiting ready signal');
  }

  /**
   * Get the current WebView view
   */
  public getView(): vscode.WebviewView | undefined {
    return this._view;
  }

  /**
   * Check if WebView is available
   */
  public isViewAvailable(): boolean {
    return this._view !== undefined;
  }

  /**
   * Send message to WebView
   *
   * Public API for external components (e.g., StandardTerminalSessionManager)
   */
  public async sendMessageToWebview(message: WebviewMessage): Promise<void> {
    log(`📤 [COMMUNICATION] Public sendMessageToWebview called: ${message.command}`);
    await this.sendMessage(message);
  }

  /**
   * Send message to WebView (internal method)
   */
  public async sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._view || !this._isReady) {
      this._enqueueMessage(message);
      return;
    }

    await this._sendMessageDirect(message);
  }

  /**
   * Send message directly to WebView
   */
  private async _sendMessageDirect(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      log('⚠️ [COMMUNICATION] No webview available to send message');
      return;
    }

    try {
      await this._view.webview.postMessage(message);
      log(`📤 [COMMUNICATION] Sent message: ${message.command}`);
    } catch (error) {
      // Handle disposed WebView gracefully
      if (
        error instanceof Error &&
        (error.message.includes('disposed') || error.message.includes('Webview is disposed'))
      ) {
        log('⚠️ [COMMUNICATION] Webview disposed during message send');
        return;
      }

      log('❌ [COMMUNICATION] Failed to send message to webview:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * Send version information to WebView
   */
  public async sendVersionInfo(): Promise<void> {
    try {
      const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
      const version = extension?.packageJSON?.version || 'unknown';
      const formattedVersion = version === 'unknown' ? version : `v${version}`;

      await this.sendMessage({
        command: 'versionInfo',
        version: formattedVersion,
      });
      log(`📤 [COMMUNICATION] Sent version info to WebView: ${formattedVersion}`);
    } catch (error) {
      log('❌ [COMMUNICATION] Error sending version info:', error);
    }
  }

  /**
   * Send settings to WebView
   */
  public async sendSettings(settings: unknown, fontSettings?: unknown): Promise<void> {
    await this.sendMessage({
      command: 'updateSettings',
      settings,
      fontSettings,
    });
    log('📤 [COMMUNICATION] Settings sent to WebView');
  }

  /**
   * Send initialization complete message
   */
  public async sendInitializationComplete(terminalCount: number): Promise<void> {
    try {
      await this.sendMessage({
        command: 'initializationComplete',
        terminalCount,
      });
      log(`📤 [COMMUNICATION] Sent initialization complete (${terminalCount} terminals)`);
    } catch (error) {
      log('❌ [COMMUNICATION] Failed to send initialization complete:', error);
    }
  }

  /**
   * Request panel location detection
   */
  public async requestPanelLocationDetection(): Promise<void> {
    try {
      await this.sendMessage({
        command: 'requestPanelLocationDetection',
      });
      log('📤 [COMMUNICATION] Requested panel location detection from WebView');
    } catch (error) {
      log('❌ [COMMUNICATION] Failed to request panel location detection:', error);
    }
  }

  /**
   * Clear the view reference
   */
  public clearView(): void {
    this._view = undefined;
    this._isReady = false;
    this._pendingMessages = [];
  }

  /**
   * Mark the current webview as ready and flush any queued messages
   */
  public async markWebviewReady(): Promise<void> {
    if (!this._view) {
      log('⚠️ [COMMUNICATION] Cannot mark webview ready - no view set');
      return;
    }

    if (this._isReady) {
      return;
    }

    this._isReady = true;
    log(`✅ [COMMUNICATION] Webview marked ready - flushing ${this._pendingMessages.length} queued messages`);
    await this._flushPendingMessages();
  }

  private _enqueueMessage(message: WebviewMessage): void {
    if (this._pendingMessages.length >= WebViewCommunicationService.MAX_QUEUE_SIZE) {
      const dropped = this._pendingMessages.shift();
      log(
        `⚠️ [COMMUNICATION] Message queue full. Dropping oldest message: ${
          dropped?.command ?? 'unknown'
        }`
      );
    }

    this._pendingMessages.push(message);
    log(
      `⏳ [COMMUNICATION] Queued message: ${message.command} (pending: ${this._pendingMessages.length})`
    );
  }

  private async _flushPendingMessages(): Promise<void> {
    if (!this._view || !this._isReady || this._pendingMessages.length === 0) {
      return;
    }

    const queuedMessages = [...this._pendingMessages];
    this._pendingMessages = [];

    for (const queuedMessage of queuedMessages) {
      await this._sendMessageDirect(queuedMessage);
    }
  }
}
