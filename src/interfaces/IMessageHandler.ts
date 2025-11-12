/**
 * Message Handler Interface
 *
 * Clean Architecture - Communication Layer
 * This interface defines the contract for message handling
 * that separates Extension and WebView message processing.
 *
 * Key Principles:
 * - Handler registry pattern
 * - Type-safe message handling
 * - No business logic in handlers (delegate to services)
 */

/**
 * Base message interface
 */
export interface BaseMessage {
  readonly command: string;
  readonly requestId?: string;
  readonly timestamp?: number;
}

/**
 * Message handler result
 */
export interface MessageHandlerResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

/**
 * Message handler interface
 * Each handler handles a specific message type
 */
export interface IMessageHandler<T extends BaseMessage = BaseMessage> {
  /**
   * Message command this handler processes
   */
  readonly command: string;

  /**
   * Handle the message
   */
  handle(message: T): Promise<MessageHandlerResult>;

  /**
   * Validate message before handling (optional)
   */
  validate?(message: T): boolean;
}

/**
 * Message dispatcher interface
 * Dispatches messages to appropriate handlers
 */
export interface IMessageDispatcher {
  /**
   * Register a message handler
   */
  registerHandler(handler: IMessageHandler): void;

  /**
   * Unregister a message handler
   */
  unregisterHandler(command: string): void;

  /**
   * Dispatch a message to its handler
   */
  dispatch(message: BaseMessage): Promise<MessageHandlerResult>;

  /**
   * Check if a handler exists for a command
   */
  hasHandler(command: string): boolean;
}

/**
 * Message router interface
 * Routes messages between Extension and WebView
 */
export interface IMessageRouter {
  /**
   * Send message from Extension to WebView
   */
  sendToWebView(message: BaseMessage): Promise<void>;

  /**
   * Send message from WebView to Extension
   */
  sendToExtension(message: BaseMessage): Promise<void>;

  /**
   * Set up message listener
   */
  onMessage(callback: (message: BaseMessage) => void): void;
}

/**
 * Extension-specific messages
 * Messages that originate from Extension
 */
export interface ExtensionMessage extends BaseMessage {
  command:
    | 'init'
    | 'output'
    | 'exit'
    | 'terminalCreated'
    | 'terminalRemoved'
    | 'settingsResponse'
    | 'fontSettingsUpdate'
    | 'stateUpdate'
    | 'cliAgentStatusUpdate'
    | 'cliAgentFullStateSync'
    | 'sessionRestoreCompleted'
    | 'sessionRestoreError'
    | 'sessionRestoreProgress'
    | 'sessionSaved'
    | 'sessionSaveError'
    | 'scrollbackRestored'
    | 'scrollbackProgress'
    | 'panelLocationUpdate';
}

/**
 * WebView-specific messages
 * Messages that originate from WebView
 */
export interface WebViewMessage extends BaseMessage {
  command:
    | 'input'
    | 'resize'
    | 'split'
    | 'clear'
    | 'killTerminal'
    | 'deleteTerminal'
    | 'focusTerminal'
    | 'getSettings'
    | 'altClickSettings'
    | 'switchAiAgent'
    | 'openSettings'
    | 'openTerminalLink'
    | 'reorderTerminals'
    | 'sessionRestore'
    | 'sessionRestoreStarted'
    | 'sessionRestoreSkipped'
    | 'sessionCleared'
    | 'getScrollback'
    | 'restoreScrollback'
    | 'saveAllTerminalSessions'
    | 'extractScrollbackData'
    | 'pushScrollbackData'
    | 'performScrollbackRestore';
}
