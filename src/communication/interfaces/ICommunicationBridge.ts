/**
 * Communication Layer - Communication Bridge Interface
 *
 * Defines the interface for bidirectional communication between Extension and WebView layers.
 * This interface provides a clear abstraction for message passing without exposing
 * internal implementation details.
 *
 * @see Issue #223 - Phase 1: Communication Layer Definition
 */

import { Message, MessageProcessingResult } from '../protocols/MessageProtocol';

/**
 * Communication Bridge Interface
 * Provides abstraction for Extension-WebView communication
 */
export interface ICommunicationBridge {
  /**
   * Send a message to the other layer
   * @param message The message to send
   */
  sendMessage(message: Message): void;

  /**
   * Process an incoming message
   * @param message The message to process
   * @returns Promise with processing result
   */
  processMessage(message: Message): Promise<MessageProcessingResult>;

  /**
   * Register a message handler
   * @param command The command to handle
   * @param handler The handler function
   */
  registerHandler(
    command: string,
    handler: (message: Message) => Promise<MessageProcessingResult>
  ): void;

  /**
   * Unregister a message handler
   * @param command The command to unregister
   */
  unregisterHandler(command: string): void;

  /**
   * Check if the bridge is ready for communication
   * @returns true if ready, false otherwise
   */
  isReady(): boolean;

  /**
   * Initialize the communication bridge
   */
  initialize(): Promise<void>;

  /**
   * Dispose of the communication bridge
   */
  dispose(): void;
}

/**
 * Extension-side communication bridge interface
 * Specific to Extension layer
 */
export interface IExtensionCommunicationBridge extends ICommunicationBridge {
  /**
   * Send message to WebView
   * @param message The message to send
   */
  sendToWebView(message: Message): void;

  /**
   * Handle message from WebView
   * @param message The message from WebView
   */
  handleFromWebView(message: Message): Promise<MessageProcessingResult>;
}

/**
 * WebView-side communication bridge interface
 * Specific to WebView layer
 */
export interface IWebViewCommunicationBridge extends ICommunicationBridge {
  /**
   * Send message to Extension
   * @param message The message to send
   */
  sendToExtension(message: Message): void;

  /**
   * Handle message from Extension
   * @param message The message from Extension
   */
  handleFromExtension(message: Message): Promise<MessageProcessingResult>;
}
