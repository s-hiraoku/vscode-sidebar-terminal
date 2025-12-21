/**
 * Communication Layer - Message Protocol
 *
 * Defines the message protocol for communication between Extension and WebView layers.
 * This layer provides clear separation of concerns following Clean Architecture principles.
 *
 * @see Issue #223 - Phase 1: Communication Layer Definition
 */

/**
 * Base message interface that all messages must implement
 */
export interface BaseMessage {
  /** Unique message identifier */
  messageId?: string;
  /** Timestamp when the message was created */
  timestamp: number;
  /** Message version for protocol evolution */
  version?: string;
}

/**
 * Extension-to-WebView message types
 * Messages sent from Extension layer to WebView layer
 */
export type ExtensionToWebViewCommand =
  | 'output'
  | 'terminalCreated'
  | 'terminalRemoved'
  | 'terminalClosed'
  | 'settingsResponse'
  | 'fontSettingsUpdate'
  | 'stateUpdate'
  | 'claudeStatusUpdate'
  | 'cliAgentStatusUpdate'
  | 'cliAgentFullStateSync'
  | 'sessionRestoreStarted'
  | 'sessionRestoreProgress'
  | 'sessionRestoreCompleted'
  | 'sessionRestoreError'
  | 'sessionRestoreSkipped'
  | 'sessionSaved'
  | 'sessionSaveError'
  | 'sessionCleared'
  | 'terminalRestoreError'
  | 'scrollbackExtracted'
  | 'scrollbackRestored'
  | 'scrollbackProgress'
  | 'scrollbackDataCollected'
  | 'panelLocationUpdate'
  | 'sessionRestorationData'
  | 'updateShellStatus'
  | 'updateCwd'
  | 'commandHistory'
  | 'deleteTerminalResponse'
  | 'switchAiAgentResponse'
  | 'phase8ServicesReady'
  | 'profilesResponse'
  | 'terminalSerializationResponse'
  | 'terminalSerializationRestoreResponse'
  | 'persistenceSaveSessionResponse'
  | 'persistenceRestoreSessionResponse'
  | 'persistenceClearSessionResponse'
  | 'sessionRestored'
  | 'sessionAutoSaveResponse'
  | 'errorResponse';

/**
 * WebView-to-Extension message types
 * Messages sent from WebView layer to Extension layer
 */
export type WebViewToExtensionCommand =
  | 'init'
  | 'input'
  | 'resize'
  | 'clear'
  | 'exit'
  | 'split'
  | 'openSettings'
  | 'openTerminalLink'
  | 'reorderTerminals'
  | 'killTerminal'
  | 'deleteTerminal'
  | 'getSettings'
  | 'altClickSettings'
  | 'focusTerminal'
  | 'switchAiAgent'
  | 'test'
  | 'timeoutTest'
  | 'sessionRestore'
  | 'getScrollback'
  | 'restoreScrollback'
  | 'saveAllTerminalSessions'
  | 'extractScrollbackData'
  | 'pushScrollbackData'
  | 'performScrollbackRestore'
  | 'requestPanelLocationDetection'
  | 'reportPanelLocation'
  | 'requestInitialTerminal'
  | 'requestState'
  | 'relayoutTerminals'
  | 'copyToClipboard'
  | 'pasteText'
  | 'requestClipboardContent'
  | 'pasteText'
  | 'pasteImage'
  | 'htmlScriptTest'
  | 'webviewReady'
  | 'ready'
  | 'createTerminal'
  | 'splitTerminal'
  | 'updateSettings'
  | 'customEvent'
  | 'error'
  | 'getProfiles'
  | 'createTerminalWithProfile'
  | 'showProfileSelector'
  | 'selectProfile'
  | 'createProfile'
  | 'updateProfile'
  | 'deleteProfile'
  | 'setDefaultProfile'
  | 'find'
  | 'requestTerminalSerialization'
  | 'restoreTerminalSerialization'
  | 'persistenceSaveSession'
  | 'persistenceRestoreSession'
  | 'persistenceClearSession'
  | 'sessionAutoSave';

/**
 * Message priority levels for queue processing
 */
export enum MessagePriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

/**
 * Extension-to-WebView message
 */
export interface ExtensionToWebViewMessage extends BaseMessage {
  command: ExtensionToWebViewCommand;
  data?: unknown;
  terminalId?: string;
  priority?: MessagePriority;
}

/**
 * WebView-to-Extension message
 */
export interface WebViewToExtensionMessage extends BaseMessage {
  command: WebViewToExtensionCommand;
  data?: unknown;
  terminalId?: string;
  priority?: MessagePriority;
}

/**
 * Union type for all messages
 */
export type Message = ExtensionToWebViewMessage | WebViewToExtensionMessage;

/**
 * Message processing result
 */
export interface MessageProcessingResult {
  success: boolean;
  error?: string;
  handledBy?: string;
  processingTime?: number;
}
