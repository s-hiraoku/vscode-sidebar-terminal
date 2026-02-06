/**
 * Terminal-specific types for WebView components
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalThemeData } from './theme.types';
import type { AgentType as CoreAgentType } from '../../types/shared';

// CLI Agent status types
export type CliAgentStatusType = 'connected' | 'disconnected' | 'none';

// Agent type definitions
export type AgentType =
  | CoreAgentType
  | 'codeium'
  | 'other'
  | null;

// Terminal state types
export type TerminalState = 'active' | 'inactive' | 'starting' | 'stopping' | 'error';

// Terminal session types
export interface TerminalSession {
  id: string;
  name: string;
  number: number;
  state: TerminalState;
  agentStatus: CliAgentStatusType;
  agentType: AgentType;
  createdAt: Date;
  lastActivity?: Date;
}

// Terminal theme data
/**
 * Terminal theme data
 * @deprecated Use TerminalTheme from theme.types.ts
 */
export type { TerminalThemeData, TerminalTheme } from './theme.types';

// Terminal event types
export type TerminalEventType =
  | 'created'
  | 'destroyed'
  | 'activated'
  | 'deactivated'
  | 'resized'
  | 'data'
  | 'title-changed'
  | 'selection-changed'
  | 'scroll'
  | 'agent-detected'
  | 'agent-status-changed';

// Terminal interaction event types
export type TerminalInteractionType =
  | 'click'
  | 'double-click'
  | 'right-click'
  | 'key-press'
  | 'paste'
  | 'drag'
  | 'drop';

// Terminal configuration
export interface TerminalConfig {
  shell: string;
  args: string[];
  maxScrollback: number;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontWeightBold?: string;
  lineHeight?: number;
  letterSpacing?: number;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  theme: TerminalThemeData;
  allowTransparency: boolean;
  drawBoldTextInBrightColors: boolean;
  rightClickSelectsWord: boolean;
  wordSeparator: string;
  /** Whether this terminal should be active on creation */
  isActive?: boolean;
}

// Export commonly used combinations
export type TerminalInstance = {
  id: string;
  name: string;
  number: number;
  terminal: Terminal;
  fitAddon: FitAddon;
  container: HTMLElement;
  isActive: boolean;
  session: TerminalSession;
  config: TerminalConfig;
};
