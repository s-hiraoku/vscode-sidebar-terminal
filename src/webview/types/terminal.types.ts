/**
 * Terminal-specific types for WebView components
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

// CLI Agent status types
export type CliAgentStatusType = 'connected' | 'disconnected' | 'none';

// Agent type definitions
export type AgentType = 'claude' | 'gemini' | 'copilot' | 'codeium' | 'other' | null;

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

// Terminal data structure for WebView
export interface WebViewTerminalData {
  id: string;
  name: string;
  number: number;
  isActive: boolean;
  hasContent: boolean;
  scrollback: string[];
  currentLine: string;
  cursorPosition: { col: number; row: number };
}

// Terminal creation options
export interface TerminalCreateOptions {
  id: string;
  name: string;
  number?: number;
  shell?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  restoreSession?: boolean;
}

// Terminal resize data
export interface TerminalResizeData {
  terminalId: string;
  cols: number;
  rows: number;
  dimensions: {
    width: number;
    height: number;
  };
}

// Terminal input data
export interface TerminalInputData {
  terminalId: string;
  data: string;
  timestamp: number;
  source: 'keyboard' | 'paste' | 'programmatic';
}

// Terminal output data
export interface TerminalOutputData {
  terminalId: string;
  data: string;
  timestamp: number;
  type: 'stdout' | 'stderr';
}

// CLI Agent detection data
export interface CliAgentDetectionData {
  terminalId: string;
  agentType: AgentType;
  status: CliAgentStatusType;
  detectedAt: Date;
  confidence: number;
  patterns: string[];
}

// Terminal performance metrics
export interface TerminalPerformanceMetrics {
  terminalId: string;
  outputRate: number; // chars per second
  bufferSize: number;
  renderFrames: number;
  memoryUsage: number;
  cpuTime: number;
}

// Terminal scroll data
export interface TerminalScrollData {
  terminalId: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  atBottom: boolean;
}

// Terminal selection data
export interface TerminalSelectionData {
  terminalId: string;
  hasSelection: boolean;
  selectedText: string;
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
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

// Terminal font data
export interface TerminalFontData {
  family: string;
  size: number;
  weight: string;
  lineHeight: number;
  letterSpacing: number;
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

// Terminal event data
export interface TerminalEvent {
  type: TerminalEventType;
  terminalId: string;
  timestamp: number;
  data?: unknown;
}

// Terminal interaction event types
export type TerminalInteractionType = 
  | 'click'
  | 'double-click'
  | 'right-click'
  | 'key-press'
  | 'paste'
  | 'drag'
  | 'drop';

// Terminal interaction event data
export interface TerminalInteractionEvent {
  type: TerminalInteractionType;
  terminalId: string;
  timestamp: number;
  position?: { x: number; y: number };
  key?: string;
  modifiers?: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
  data?: unknown;
}

// Terminal configuration
export interface TerminalConfig {
  shell: string;
  args: string[];
  maxScrollback: number;
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  theme: TerminalThemeData;
  allowTransparency: boolean;
  drawBoldTextInBrightColors: boolean;
  rightClickSelectsWord: boolean;
  wordSeparator: string;
}

// Terminal manager statistics
export interface TerminalManagerStats {
  totalTerminals: number;
  activeTerminals: number;
  memoryUsage: number;
  totalOutput: number;
  totalInput: number;
  averageResponseTime: number;
  errorCount: number;
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

export type TerminalMap = Map<string, TerminalInstance>;
export type TerminalContainerMap = Map<string, HTMLElement>;