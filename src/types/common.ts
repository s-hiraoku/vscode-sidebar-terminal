/**
 * 共通の型定義とインターフェース
 *
 * NOTE: TerminalConfig と TerminalSettings は shared.ts に移行済み
 * 段階的移行のため、ここでは shared.ts からのインポートとエイリアスを提供
 */

// 新しい型システムからのインポート
import { PartialTerminalSettings, WebViewFontSettings, TerminalConfig } from './shared';

// IPty interface is now defined in node-pty.d.ts for @homebridge/node-pty-prebuilt-multiarch
// Import IPty from the node-pty module when needed

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
// TerminalConfig type alias is now centrally defined in shared.ts
// Use: import { TerminalConfig } from './shared' when needed

/**
 * ターミナル設定の詳細インターフェース
 * @deprecated shared.ts の CompleteTerminalSettings を使用してください
 */
// TerminalSettings type alias is now centrally defined in shared.ts
// Use: import { TerminalSettings } from './shared' when needed

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
    | 'fontSettingsUpdate'
    | 'openSettings';
  config?: TerminalConfig;
  data?: string;
  exitCode?: number;
  terminalId?: string;
  terminalName?: string;
  terminals?: TerminalInfo[];
  activeTerminalId?: string;
  settings?: PartialTerminalSettings; // 部分的な設定を受け取るよう修正
  fontSettings?: WebViewFontSettings; // フォント設定を受け取る
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
