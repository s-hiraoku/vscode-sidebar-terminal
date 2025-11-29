/**
 * Simplified Terminal WebView Types
 *
 * Minimal type definitions for VS Code standard terminal pattern.
 * Reduces complexity by using clear, single-purpose message types.
 */

/**
 * VS Code API interface (acquired via acquireVsCodeApi)
 */
export interface VSCodeAPI {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

/**
 * Terminal configuration from Extension
 */
export interface TerminalConfig {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorBlink?: boolean;
  scrollback?: number;
  theme?: TerminalTheme;
}

/**
 * Terminal theme colors
 */
export interface TerminalTheme {
  background?: string;
  foreground?: string;
  cursor?: string;
  cursorAccent?: string;
  selectionBackground?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}

// ============================================================================
// Message Types - Simplified Protocol
// ============================================================================

/**
 * Base message structure
 */
export interface BaseMessage {
  command: string;
  timestamp?: number;
}

// ----------------------------------------------------------------------------
// WebView → Extension Messages
// ----------------------------------------------------------------------------

/**
 * WebView is ready to receive commands
 */
export interface WebViewReadyMessage extends BaseMessage {
  command: 'webviewReady';
}

/**
 * Terminal successfully created and ready for output
 */
export interface TerminalReadyMessage extends BaseMessage {
  command: 'terminalReady';
  terminalId: string;
  cols: number;
  rows: number;
}

/**
 * User input from terminal
 */
export interface TerminalInputMessage extends BaseMessage {
  command: 'input';
  terminalId: string;
  data: string;
}

/**
 * Terminal resized
 */
export interface TerminalResizeMessage extends BaseMessage {
  command: 'resize';
  terminalId: string;
  cols: number;
  rows: number;
}

/**
 * Request to delete terminal (from UI action)
 */
export interface DeleteTerminalRequestMessage extends BaseMessage {
  command: 'deleteTerminal';
  terminalId: string;
  source: 'header' | 'panel';
}

/**
 * Terminal focused by user
 */
export interface TerminalFocusedMessage extends BaseMessage {
  command: 'terminalFocused';
  terminalId: string;
}

// ----------------------------------------------------------------------------
// Extension → WebView Messages
// ----------------------------------------------------------------------------

/**
 * Extension is ready, WebView can initialize
 */
export interface ExtensionReadyMessage extends BaseMessage {
  command: 'extensionReady';
}

/**
 * Create new terminal
 */
export interface CreateTerminalMessage extends BaseMessage {
  command: 'createTerminal';
  terminalId: string;
  terminalName: string;
  terminalNumber: number;
  config: TerminalConfig;
  isActive?: boolean;
}

/**
 * Remove terminal
 */
export interface RemoveTerminalMessage extends BaseMessage {
  command: 'removeTerminal';
  terminalId: string;
}

/**
 * Terminal output data
 */
export interface TerminalOutputMessage extends BaseMessage {
  command: 'output';
  terminalId: string;
  data: string;
}

/**
 * Focus specific terminal
 */
export interface FocusTerminalMessage extends BaseMessage {
  command: 'focusTerminal';
  terminalId: string;
}

/**
 * Clear terminal
 */
export interface ClearTerminalMessage extends BaseMessage {
  command: 'clearTerminal';
  terminalId: string;
}

/**
 * Set active terminal
 */
export interface SetActiveTerminalMessage extends BaseMessage {
  command: 'setActiveTerminal';
  terminalId: string;
}

/**
 * Update theme
 */
export interface UpdateThemeMessage extends BaseMessage {
  command: 'updateTheme';
  theme: TerminalTheme;
}

/**
 * Update font settings
 */
export interface UpdateFontMessage extends BaseMessage {
  command: 'updateFont';
  fontFamily: string;
  fontSize: number;
  lineHeight?: number;
}

// ----------------------------------------------------------------------------
// Union Types
// ----------------------------------------------------------------------------

/**
 * All messages from WebView to Extension
 */
export type WebViewToExtensionMessage =
  | WebViewReadyMessage
  | TerminalReadyMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | DeleteTerminalRequestMessage
  | TerminalFocusedMessage;

/**
 * All messages from Extension to WebView
 */
export type ExtensionToWebViewMessage =
  | ExtensionReadyMessage
  | CreateTerminalMessage
  | RemoveTerminalMessage
  | TerminalOutputMessage
  | FocusTerminalMessage
  | ClearTerminalMessage
  | SetActiveTerminalMessage
  | UpdateThemeMessage
  | UpdateFontMessage;

/**
 * All message types
 */
export type Message = WebViewToExtensionMessage | ExtensionToWebViewMessage;

// ============================================================================
// State Types
// ============================================================================

/**
 * Persisted WebView state (via VS Code API setState/getState)
 */
export interface WebViewState {
  activeTerminalId: string | null;
  terminalIds: string[];
  config: TerminalConfig;
}

/**
 * Terminal instance info (for UI display)
 */
export interface TerminalInfo {
  id: string;
  name: string;
  number: number;
  isActive: boolean;
}
