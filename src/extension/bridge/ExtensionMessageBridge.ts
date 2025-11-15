/**
 * Extension Message Bridge
 *
 * Handles message communication on the Extension side.
 * Implements IExtensionCommunicationBridge for Extension-to-WebView communication.
 *
 * @see Issue #223 - Phase 3: Message Handling Separation
 */

import * as vscode from 'vscode';
import {
  IExtensionCommunicationBridge,
  Message,
  MessageProcessingResult,
} from '../../communication';

/**
 * Extension-side message bridge
 * Manages communication between Extension and WebView
 */
export class ExtensionMessageBridge implements IExtensionCommunicationBridge {
  private readonly handlers = new Map<
    string,
    (message: Message) => Promise<MessageProcessingResult>
  >();
  private _isReady = false;
  private _webviewView?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Set the WebView for communication
   */
  setWebView(webviewView: vscode.WebviewView): void {
    this._webviewView = webviewView;
    this._isReady = true;
  }

  /**
   * Send a message to WebView
   */
  sendMessage(message: Message): void {
    this.sendToWebView(message);
  }

  /**
   * Send message to WebView
   */
  sendToWebView(message: Message): void {
    if (!this._webviewView || !this._isReady) {
      console.warn('WebView not ready, message not sent:', message.command);
      return;
    }

    try {
      this._webviewView.webview.postMessage(message);
    } catch (error) {
      console.error('Failed to send message to WebView:', error);
    }
  }

  /**
   * Handle message from WebView
   */
  async handleFromWebView(message: Message): Promise<MessageProcessingResult> {
    return await this.processMessage(message);
  }

  /**
   * Process an incoming message
   */
  async processMessage(message: Message): Promise<MessageProcessingResult> {
    const startTime = Date.now();

    try {
      const handler = this.handlers.get(message.command);

      if (!handler) {
        return {
          success: false,
          error: `No handler registered for command: ${message.command}`,
          processingTime: Date.now() - startTime,
        };
      }

      const result = await handler(message);
      return {
        ...result,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Register a message handler
   */
  registerHandler(
    command: string,
    handler: (message: Message) => Promise<MessageProcessingResult>
  ): void {
    if (this.handlers.has(command)) {
      console.warn(`Handler for command '${command}' already registered, overwriting`);
    }
    this.handlers.set(command, handler);
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(command: string): void {
    this.handlers.delete(command);
  }

  /**
   * Check if the bridge is ready
   */
  isReady(): boolean {
    return this._isReady && this._webviewView !== undefined;
  }

  /**
   * Initialize the bridge
   */
  async initialize(): Promise<void> {
    this._isReady = false;
    // Initialization logic
  }

  /**
   * Dispose of the bridge
   */
  dispose(): void {
    this.handlers.clear();
    this._webviewView = undefined;
    this._isReady = false;
  }

  /**
   * Get registered handlers count
   */
  getHandlerCount(): number {
    return this.handlers.size;
  }

  /**
   * Get registered commands
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }
}
