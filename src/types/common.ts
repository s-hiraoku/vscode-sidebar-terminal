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

// 新しいアーキテクチャ用の状態管理
export interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  maxTerminals: number;
  availableSlots: number[];
}

export interface DeleteResult {
  success: boolean;
  reason?: string;
  newState?: TerminalState;
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
    | 'input'
    | 'resize'
    | 'output'
    | 'clear'
    | 'exit'
    | 'split'
    | 'terminalCreated'
    | 'terminalRemoved'
    | 'settingsResponse'
    | 'fontSettingsUpdate'
    | 'openSettings'
    | 'stateUpdate'
    | 'claudeStatusUpdate'
    | 'killTerminal'
    | 'deleteTerminal'
    | 'getSettings'
    | 'altClickSettings'
    | 'error';
  config?: TerminalConfig;
  data?: string;
  exitCode?: number;
  terminalId?: string;
  terminalName?: string;
  terminals?: TerminalInfo[];
  activeTerminalId?: string;
  settings?: PartialTerminalSettings; // 部分的な設定を受け取るよう修正
  fontSettings?: WebViewFontSettings; // フォント設定を受け取る
  state?: TerminalState; // 新しいアーキテクチャ用の状態更新
  claudeStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  }; // CLI Agent接続状態の情報
  cols?: number; // リサイズ用
  rows?: number; // リサイズ用
  requestSource?: 'header' | 'panel'; // 削除リクエストの送信元
  timestamp?: number; // エラー報告用
  type?: string; // エラー報告用
  message?: string; // エラー報告用
  context?: string; // エラー報告用
  stack?: string; // エラー報告用
}

export interface VsCodeMessage {
  command:
    | 'ready'
    | 'webviewReady'
    | 'htmlScriptTest'
    | 'timeoutTest'
    | 'test'
    | 'input'
    | 'resize'
    | 'switchTerminal'
    | 'createTerminal'
    | 'splitTerminal'
    | 'clear'
    | 'getSettings'
    | 'updateSettings'
    | 'terminalClosed'
    | 'terminalInteraction'
    | 'killTerminal'
    | 'deleteTerminal'
    | 'requestStateRestoration'
    | 'error';
  data?: string;
  cols?: number;
  rows?: number;
  terminalId?: string;
  type?: TerminalInteractionEvent['type'];
  settings?: PartialTerminalSettings; // 部分的な設定を送信するよう修正
  requestSource?: 'header' | 'panel'; // 新しいアーキテクチャ用の削除要求元
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

export interface AltClickState {
  isVSCodeAltClickEnabled: boolean;
  isAltKeyPressed: boolean;
}

export interface TerminalInteractionEvent {
  type:
    | 'alt-click'
    | 'alt-click-blocked'
    | 'output-detected'
    | 'focus'
    | 'switch-next'
    | 'webview-ready'
    | 'terminal-removed'
    | 'font-settings-update'
    | 'settings-update'
    | 'new-terminal'
    | 'resize'
    | 'kill'
    | 'interrupt'
    | 'paste';
  terminalId: string;
  timestamp: number;
  data?: unknown;
}
