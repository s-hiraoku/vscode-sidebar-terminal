/**
 * 共通の型定義とインターフェース
 *
 * NOTE: TerminalConfig と TerminalSettings は shared.ts に移行済み
 * 段階的移行のため、ここでは shared.ts からのインポートとエイリアスを提供
 */

// 新しい型システムからのインポート
import {
  ExtensionTerminalConfig,
  CompleteTerminalSettings,
  PartialTerminalSettings,
} from './shared';

// IPty interface for type safety when using node-pty or mocks
export interface IPty {
  pid: number;
  cols: number;
  rows: number;
  handleFlowControl?: boolean;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (exitCode: number, signal?: number) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  clear?: () => void;
}

export interface TerminalInfo {
  id: string;
  name: string;
  isActive: boolean;
}

// ===== 後方互換性のための型エイリアス =====
// 段階的移行期間中の後方互換性を保つため、shared.ts の型をエイリアス

/**
 * ターミナル設定インターフェース
 * @deprecated shared.ts の ExtensionTerminalConfig を使用してください
 */
export type TerminalConfig = ExtensionTerminalConfig;

/**
 * ターミナル設定の詳細インターフェース
 * @deprecated shared.ts の CompleteTerminalSettings を使用してください
 */
export type TerminalSettings = CompleteTerminalSettings;

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
  settings?: PartialTerminalSettings; // 部分的な設定を受け取るよう修正
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
  settings?: PartialTerminalSettings; // 部分的な設定を送信するよう修正
}

export interface TerminalInstance {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pty: any; // Using any for node-pty compatibility with both real and mock implementations
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

export interface ClaudeCodeState {
  isActive: boolean;
  terminalId?: string;
  startTime?: number;
  outputVolume?: number;
}

export interface AltClickState {
  isEnabled: boolean;
  isTemporarilyDisabled: boolean;
  disableReason?: string;
}

export interface TerminalInteractionEvent {
  type: 'alt-click' | 'output-detected' | 'claude-code-start' | 'claude-code-end';
  terminalId: string;
  timestamp: number;
  data?: unknown;
}
