/**
 * WebView Message Bridge
 *
 * Handles message communication on the WebView side.
 * Implements IWebViewCommunicationBridge for WebView-to-Extension communication.
 *
 * @see Issue #223 - Phase 3: Message Handling Separation
 */

import { IWebViewCommunicationBridge, Message, MessageProcessingResult } from '../../communication';

/**
 * VS Code API interface for WebView
 */
interface VSCodeAPI {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

/**
 * Acquire VS Code API
 */
declare function acquireVsCodeApi(): VSCodeAPI;

/**
 * WebView-side message bridge
 * Manages communication between WebView and Extension
 */
export class WebViewMessageBridge implements IWebViewCommunicationBridge {
  private readonly handlers = new Map<
    string,
    (message: Message) => Promise<MessageProcessingResult>
  >();
  private _isReady = false;
  private _vscodeApi: VSCodeAPI;

  constructor() {
    this._vscodeApi = acquireVsCodeApi();
  }

  /**
   * Send a message to Extension
   */
  sendMessage(message: Message): void {
    this.sendToExtension(message);
  }

  /**
   * Send message to Extension
   */
  sendToExtension(message: Message): void {
    try {
      this._vscodeApi.postMessage(message);
    } catch (error) {
      console.error('Failed to send message to Extension:', error);
    }
  }

  /**
   * Handle message from Extension
   */
  async handleFromExtension(message: Message): Promise<MessageProcessingResult> {
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
    return this._isReady;
  }

  /**
   * Initialize the bridge
   */
  async initialize(): Promise<void> {
    this._isReady = true;
    this.setupMessageListener();
  }

  /**
   * Dispose of the bridge
   */
  dispose(): void {
    this.handlers.clear();
    this._isReady = false;
  }

  /**
   * Setup message listener for incoming messages
   */
  private setupMessageListener(): void {
    window.addEventListener('message', async (event: MessageEvent) => {
      const message = event.data as Message;
      await this.handleFromExtension(message);
    });
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
