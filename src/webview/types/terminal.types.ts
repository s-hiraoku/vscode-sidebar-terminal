import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import {
  WebViewTerminalConfig,
  TerminalTheme,
  SplitDirection,
  CliAgentStatusType,
} from '../../types/shared';

/**
 * WebView用ターミナル設定
 * @deprecated shared.ts の WebViewTerminalConfig を使用してください
 */
export type TerminalConfig = WebViewTerminalConfig;

export interface TerminalInstance {
  readonly id: string;
  readonly name: string;
  readonly terminal: Terminal;
  readonly fitAddon: FitAddon;
  readonly container: HTMLElement;
  readonly createdAt: Date;
  isActive: boolean;
}

// 型エイリアスは shared.ts からインポート済み
export { TerminalTheme, SplitDirection, CliAgentStatusType };

/**
 * WebView用ターミナル設定（詳細版）
 * @deprecated shared.ts の CompleteTerminalSettings を使用してください
 */
export interface TerminalSettings {
  fontSize: number;
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
