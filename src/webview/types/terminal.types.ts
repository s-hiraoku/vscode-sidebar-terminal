import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';

export interface TerminalConfig {
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly theme: TerminalTheme;
  readonly cursorBlink: boolean;
  readonly shell?: string;
  readonly cwd?: string;
}

export interface TerminalInstance {
  readonly id: string;
  readonly name: string;
  readonly terminal: Terminal;
  readonly fitAddon: FitAddon;
  readonly container: HTMLElement;
  readonly createdAt: Date;
  isActive: boolean;
}

export type TerminalTheme = 'auto' | 'dark' | 'light';
export type SplitDirection = 'horizontal' | 'vertical';
export type StatusType = 'info' | 'success' | 'error' | 'warning';

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  theme?: string;
  cursorBlink: boolean;
  confirmBeforeKill?: boolean;
  protectLastTerminal?: boolean;
  minTerminalCount?: number;
}

export interface SplitLayout {
  direction: SplitDirection;
  containerCount: number;
  minHeight: number;
  splitterSize: number;
}