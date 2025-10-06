/**
 * Type Guards and Type Safety Utilities
 *
 * This module provides type guards and utility functions to replace `any` types
 * with proper type checking throughout the codebase.
 */

import {
  WebviewMessage,
  PartialTerminalSettings,
} from './shared';

// ===== Type Guard Functions =====

/**
 * Type guard for WebviewMessage
 */
export function isWebviewMessage(value: unknown): value is WebviewMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WebviewMessage).command === 'string'
  );
}

/**
 * Type guard for WebviewMessage with terminalId
 */
export function hasTerminalId(msg: WebviewMessage): msg is WebviewMessage & { terminalId: string } {
  return typeof msg.terminalId === 'string' && msg.terminalId.length > 0;
}

/**
 * Type guard for WebviewMessage with resize parameters
 */
export function hasResizeParams(
  msg: WebviewMessage
): msg is WebviewMessage & { cols: number; rows: number } {
  return (
    typeof msg.cols === 'number' && typeof msg.rows === 'number' && msg.cols > 0 && msg.rows > 0
  );
}

/**
 * Type guard for WebviewMessage with settings
 */
export function hasSettings(
  msg: WebviewMessage
): msg is WebviewMessage & { settings: PartialTerminalSettings } {
  return msg.settings !== undefined && typeof msg.settings === 'object' && msg.settings !== null;
}

/**
 * Type guard for WebviewMessage with input data
 */
export function hasInputData(msg: WebviewMessage): msg is WebviewMessage & { data: string } {
  return typeof msg.data === 'string' && msg.data.length > 0;
}

// ===== Utility Types =====

/**
 * VS Code event handler types
 */
export type VSCodeEventHandler<T = unknown> = (event: T) => void | Promise<void>;

/**
 * Configuration value types
 */
export type ConfigurationValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | Record<string, unknown>
  | null
  | undefined;

/**
 * Message handler function type
 */
export type MessageHandler<T extends WebviewMessage = WebviewMessage> = (
  message: T
) => Promise<void> | void;

/**
 * Node-pty compatible process type
 */
export type PtyProcess = import('@homebridge/node-pty-prebuilt-multiarch').IPty;

/**
 * Node.js process reference
 */
export type NodeProcess = NodeJS.Process;

// ===== Runtime Type Checkers =====

/**
 * Checks if value is a non-null object
 */
export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks if value has a specific property with type
 */
export function hasProperty<K extends string, V>(
  obj: unknown,
  key: K,
  typeCheck: (value: unknown) => value is V
): obj is Record<K, V> {
  return isNonNullObject(obj) && key in obj && typeCheck((obj as Record<K, unknown>)[key]);
}

/**
 * Type guard for split direction
 */
export function isSplitDirection(value: unknown): value is 'horizontal' | 'vertical' {
  return value === 'horizontal' || value === 'vertical';
}

/**
 * Type guard for WebviewMessage with direction
 */
export function hasDirection(
  msg: WebviewMessage
): msg is WebviewMessage & { direction: 'horizontal' | 'vertical' } {
  return hasProperty(msg, 'direction', isSplitDirection);
}

/**
 * Type guard for boolean values
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for WebviewMessage with force reconnect
 */
export function hasForceReconnect(
  msg: WebviewMessage
): msg is WebviewMessage & { forceReconnect: boolean } {
  return hasProperty(msg, 'forceReconnect', isBoolean);
}

/**
 * AI Agent operation result type
 */
export interface AIAgentOperationResult {
  success: boolean;
  reason?: string;
  newStatus?: 'connected' | 'disconnected' | 'none';
  agentType?: string | null;
}

// ===== Manager Interface Extensions =====

/**
 * Shell Integration Manager interface
 */
export interface IShellIntegrationManager {
  updateShellStatus(terminalId: string, status: string): void;
  updateCwd(terminalId: string, cwd: string): void;
  showCommandHistory(
    terminalId: string,
    history: Array<{ command: string; exitCode?: number; duration?: number }>
  ): void;
}

/**
 * Enhanced Terminal interface with search addon
 */
export interface ITerminalWithAddons {
  _addonManager?: {
    _addons?: Array<{
      addon?: {
        findNext?: () => void;
        clearDecorations?: () => void;
      };
    }>;
  };
  _terminal?: any; // xterm.js Terminal instance
}

// ===== Terminal Manager Interfaces =====

/**
 * Terminal event data interface
 */
export interface ITerminalEventData {
  terminalId: string;
  data?: string;
  exitCode?: number;
  terminal?: ITerminalInstanceForEvents;
}

/**
 * Terminal instance for events
 */
export interface ITerminalInstanceForEvents {
  id: string;
  name: string;
  number?: number;
  isActive: boolean;
  cwd?: string;
  isSessionRestored?: boolean;
  sessionRestoreMessage?: string;
  sessionScrollback?: string[];
  pid?: number;
}

/**
 * Terminal state interface
 */
export interface ITerminalStateForEvents {
  terminals: ITerminalInstanceForEvents[];
  activeTerminalId: string | null;
  maxTerminals: number;
  [key: string]: unknown;
}

// ===== Error Types =====

/**
 * Enhanced error types for better error handling
 */
export interface ExtensionError extends Error {
  code?: string;
  context?: Record<string, unknown>;
  terminalId?: string;
}

