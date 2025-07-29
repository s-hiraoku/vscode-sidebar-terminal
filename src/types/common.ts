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
    | 'cliAgentStatusUpdate'
    | 'killTerminal'
    | 'deleteTerminal'
    | 'getSettings'
    | 'altClickSettings'
    | 'focusTerminal'
    | 'test'
    | 'timeoutTest'
    | 'sessionRestore'
    | 'sessionRestoreStarted'
    | 'sessionRestoreProgress'
    | 'sessionRestoreCompleted'
    | 'sessionRestoreError'
    | 'sessionRestoreSkipped'
    | 'sessionSaved'
    | 'sessionSaveError'
    | 'sessionCleared'
    | 'terminalRestoreError'
    | 'getScrollback'
    | 'restoreScrollback'
    | 'scrollbackExtracted'
    | 'scrollbackRestored'
    | 'scrollbackProgress'
    | 'saveAllTerminalSessions'
    | 'extractScrollbackData'
    | 'performScrollbackRestore'
    | 'scrollbackDataCollected'
    | 'error';
  config?: TerminalConfig;
  data?: string;
  exitCode?: number;
  terminalId?: string;
  terminalName?: string;

  // ターミナル情報（復元用）
  terminalInfo?: {
    originalId: string;
    name: string;
    number: number;
    cwd: string;
    isActive: boolean;
  };
  // Session management properties
  terminalCount?: number;
  restored?: number;
  total?: number;
  restoredCount?: number;
  skippedCount?: number;
  error?: string;
  partialSuccess?: boolean;
  reason?: string;
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
  cliAgentStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  }; // CLI Agent接続状態の情報（新しい名前）
  cols?: number; // リサイズ用
  rows?: number; // リサイズ用
  requestSource?: 'header' | 'panel'; // 削除リクエストの送信元
  timestamp?: number; // エラー報告用
  type?: string; // For test messages and error reporting
  message?: string; // エラー報告用
  context?: string; // エラー報告用
  stack?: string; // エラー報告用

  // セッション復元関連
  sessionRestoreMessage?: string; // 復元メッセージ
  sessionScrollback?: string[]; // 復元する履歴データ
  scrollbackLines?: number; // 取得する履歴行数
  scrollbackData?: string[]; // 取得された履歴データ
  errorType?: string; // エラータイプ (file, corruption, permission, network, unknown)
  recoveryAction?: string; // 回復処理の説明
  requestId?: string; // リクエストID（応答待機用）

  // Scrollback復元関連
  scrollbackContent?:
    | Array<{
        content: string;
        type?: 'output' | 'input' | 'error';
        timestamp?: number;
      }>
    | string[]
    | any; // 復元するscrollback内容

  // WebView側のコマンド名拡張（重複削除）
  scrollbackProgress?: {
    terminalId: string;
    progress: number;
    currentLines: number;
    totalLines: number;
    stage: 'loading' | 'decompressing' | 'restoring';
  }; // scrollback復元の進捗
  maxLines?: number; // 取得する最大行数
  useCompression?: boolean; // 圧縮を使用するか
  cursorPosition?: {
    x: number;
    y: number;
  }; // カーソル位置
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
    | 'focusTerminal'
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
    | 'getScrollbackData'
    | 'extractScrollback'
    | 'restoreScrollbackData'
    | 'scrollbackExtracted'
    | 'getTerminalScrollbackData'
    | 'extractScrollbackData'
    | 'performScrollbackRestore'
    | 'restoreTerminalScrollback'
    | 'scrollbackDataCollected'
    | 'error';
  data?: string;
  cols?: number;
  rows?: number;
  terminalId?: string;
  type?: TerminalInteractionEvent['type'];
  settings?: PartialTerminalSettings; // 部分的な設定を送信するよう修正
  requestSource?: 'header' | 'panel'; // 新しいアーキテクチャ用の削除要求元
  timestamp?: number; // エラー報告用
  message?: string; // エラー報告用
  context?: string; // エラー報告用
  stack?: string; // エラー報告用

  // ターミナル復元関連
  terminalInfo?: {
    originalId: string;
    name: string;
    number: number;
    cwd: string;
    isActive: boolean;
  };

  // セッション復元関連
  scrollbackLines?: number; // 取得する履歴行数
  scrollbackData?: string[]; // 履歴データ
  maxLines?: number; // 取得する最大行数
  scrollbackContent?: Array<{
    content: string;
    type?: 'output' | 'input' | 'error';
    timestamp?: number;
  }>; // 復元するscrollback内容
  requestId?: string; // リクエストID（応答待機用）
}

export interface TerminalInstance {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pty?: any; // Using any for node-pty compatibility with both real and mock implementations (ptyProcessに移行中)
  ptyProcess?: unknown; // 新しいpty参照名（セッション復元対応）
  name: string;
  number: number; // ターミナル番号（1-5）
  cwd?: string; // 現在の作業ディレクトリ
  isActive: boolean;
  createdAt?: number; // 作成日時

  // セッション復元関連のプロパティ
  isSessionRestored?: boolean; // セッション復元で作成されたターミナルかどうか
  sessionRestoreMessage?: string; // 復元メッセージ
  sessionScrollback?: string[]; // 復元時の履歴データ
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
