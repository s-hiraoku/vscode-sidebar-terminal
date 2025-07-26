/**
 * ターミナルセッション復元機能の型定義
 * VS Code標準ターミナルと同等の永続化機能を提供
 */

/**
 * 単一ターミナルのセッションデータ
 */
export interface TerminalSessionInfo {
  /** ターミナルの一意識別子 */
  id: string;
  /** ターミナル名（例: "Terminal 1"） */
  name: string;
  /** 作業ディレクトリの絶対パス */
  cwd: string;
  /** スクロールバック履歴（保存対象の出力行） */
  scrollback: string[];
  /** アクティブ状態 */
  isActive: boolean;
  /** ターミナル作成日時（Unix timestamp） */
  createdAt: number;
  /** 最後の更新日時（Unix timestamp） */
  lastUpdated: number;
  /** ターミナル番号（1-5の範囲） */
  terminalNumber: number;
}

/**
 * 分割レイアウト情報
 */
export interface SplitLayoutInfo {
  /** 分割方向（水平/垂直） */
  direction: 'horizontal' | 'vertical' | 'none';
  /** 分割サイズ比率 */
  sizes: number[];
  /** 分割されたターミナルIDの配列 */
  terminalIds: string[];
}

/**
 * 完全なターミナルセッションデータ
 */
export interface TerminalSessionData {
  /** すべてのターミナル情報 */
  terminals: TerminalSessionInfo[];
  /** 現在アクティブなターミナルID */
  activeTerminalId: string | null;
  /** 分割レイアウト情報 */
  layoutInfo: SplitLayoutInfo;
  /** セッション保存日時（Unix timestamp） */
  timestamp: number;
  /** セッションデータのバージョン（将来の互換性のため） */
  version: string;
  /** ワークスペースパス（セッション識別用） */
  workspacePath: string | null;
}

/**
 * セッション復元設定
 */
export interface SessionRestoreOptions {
  /** 永続セッション機能の有効/無効 */
  enablePersistentSessions: boolean;
  /** 復元するスクロールバック行数 */
  persistentSessionScrollback: number;
  /** プロセス復活のタイミング */
  persistentSessionReviveProcess: 'never' | 'onExit' | 'onExitAndWindowClose';
  /** 起動時のターミナル表示設定 */
  hideOnStartup: 'never' | 'whenEmpty' | 'always';
}

/**
 * セッション保存結果
 */
export interface SessionSaveResult {
  /** 保存が成功したか */
  success: boolean;
  /** 保存されたターミナル数 */
  terminalCount: number;
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 保存されたデータサイズ（バイト） */
  dataSize?: number;
}

/**
 * セッション復元結果
 */
export interface SessionRestoreResult {
  /** 復元が成功したか */
  success: boolean;
  /** 復元されたターミナル数 */
  restoredTerminalCount: number;
  /** 復元をスキップしたターミナル数 */
  skippedTerminalCount: number;
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 復元されたセッションのタイムスタンプ */
  sessionTimestamp?: number;
  /** エラータイプ（失敗時） */
  errorType?: 'file' | 'permission' | 'corruption' | 'network' | 'unknown';
  /** 回復処理の説明（失敗時） */
  recoveryAction?: string;
}

/**
 * ターミナル復元メッセージのフォーマット情報
 */
export interface RestoreMessageInfo {
  /** 復元メッセージのテンプレート */
  template: string;
  /** 復元日時（表示用フォーマット） */
  formattedDate: string;
  /** 復元されたターミナル数 */
  terminalCount: number;
}

/**
 * セッションストレージのキー名定数
 */
export const SESSION_STORAGE_KEYS = {
  /** メインセッションデータ */
  SESSION_DATA: 'terminalSessionData',
  /** セッション設定 */
  SESSION_CONFIG: 'terminalSessionConfig',
  /** 最後の保存タイムスタンプ */
  LAST_SAVE_TIME: 'lastSessionSaveTime',
} as const;

/**
 * セッション復元メッセージの定数
 */
export const SESSION_RESTORE_MESSAGES = {
  /** VS Code標準形式の復元メッセージ */
  RESTORE_MESSAGE_TEMPLATE: '[Session contents restored from {date}]',
  /** 復元失敗時のメッセージ */
  RESTORE_FAILED_MESSAGE: '[Failed to restore session contents]',
  /** セッションが見つからない場合のメッセージ */
  NO_SESSION_MESSAGE: '[No previous session found]',
} as const;

/**
 * セッションデータの制限値
 */
export const SESSION_LIMITS = {
  /** 最大スクロールバック行数 */
  MAX_SCROLLBACK_LINES: 10000,
  /** 最小スクロールバック行数 */
  MIN_SCROLLBACK_LINES: 0,
  /** セッションデータの最大サイズ（MB） */
  MAX_SESSION_SIZE_MB: 50,
  /** セッション有効期限（日数） */
  SESSION_EXPIRY_DAYS: 30,
} as const;
