/**
 * Terminal-specific types for WebView components
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

// CLI Agent status types
export type CliAgentStatusType = 'connected' | 'disconnected' | 'none';

// Agent type definitions
export type AgentType = 'claude' | 'gemini' | 'codex' | 'copilot' | 'codeium' | 'other' | null;

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
export interface TerminalThemeData {
  foreground: string;
  background: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

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
