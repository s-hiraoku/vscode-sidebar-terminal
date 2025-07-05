/**
 * 共通の型定義とインターフェース
 */

export interface TerminalInfo {
  id: string;
  name: string;
  isActive: boolean;
}

export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  maxTerminals: number;
  shell: string;
  shellArgs: string[];
}

export interface WebviewMessage {
  command: 'init' | 'output' | 'clear' | 'exit' | 'split' | 'terminalCreated' | 'terminalRemoved';
  config?: TerminalConfig;
  data?: string;
  exitCode?: number;
  terminalId?: string;
  terminalName?: string;
  terminals?: TerminalInfo[];
}

export interface VsCodeMessage {
  command: 'ready' | 'input' | 'resize' | 'switchTerminal';
  data?: string;
  cols?: number;
  rows?: number;
  terminalId?: string;
}

export interface TerminalInstance {
  id: string;
  pty: any; // node-pty IPty
  name: string;
  isActive: boolean;
}

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

export interface TerminalEvent {
  terminalId: string;
  data?: string;
  exitCode?: number;
}