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
  defaultDirectory?: string;
}

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  theme?: string;
  cursorBlink: boolean;
  confirmBeforeKill?: boolean;
  protectLastTerminal?: boolean;
  minTerminalCount?: number;
}

export interface WebviewMessage {
  command:
    | 'init'
    | 'output'
    | 'clear'
    | 'exit'
    | 'split'
    | 'terminalCreated'
    | 'terminalRemoved'
    | 'settingsResponse'
    | 'openSettings';
  config?: TerminalConfig;
  data?: string;
  exitCode?: number;
  terminalId?: string;
  terminalName?: string;
  terminals?: TerminalInfo[];
  activeTerminalId?: string;
  settings?: TerminalSettings;
}

export interface VsCodeMessage {
  command:
    | 'ready'
    | 'input'
    | 'resize'
    | 'switchTerminal'
    | 'createTerminal'
    | 'splitTerminal'
    | 'clear'
    | 'getSettings'
    | 'updateSettings'
    | 'terminalClosed';
  data?: string;
  cols?: number;
  rows?: number;
  terminalId?: string;
  settings?: TerminalSettings;
}

export interface TerminalInstance {
  id: string;
  pty: import('node-pty').IPty;
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
