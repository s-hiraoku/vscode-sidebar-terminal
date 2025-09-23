/**
 * システム全体の定数定義
 * - 一貫した命名規則と明確な分類
 * - 型安全性を保証するenum活用
 * - 設定値の中央集権管理
 */

// =============================================================================
// パフォーマンス関連定数
// =============================================================================

export const PERFORMANCE_CONSTANTS = {
  // タイムアウト設定
  DEFAULT_INITIALIZATION_TIMEOUT_MS: 5000,
  DEFAULT_OPERATION_TIMEOUT_MS: 30000,
  WEBVIEW_COMMUNICATION_TIMEOUT_MS: 3000,

  // バッファリング設定
  OUTPUT_BUFFER_FLUSH_INTERVAL_MS: 16, // 60fps
  CLI_AGENT_FAST_FLUSH_INTERVAL_MS: 4, // 250fps for AI agents
  MAX_BUFFER_SIZE_BYTES: 1024 * 1024, // 1MB

  // リトライ設定
  DEFAULT_RETRY_COUNT: 3,
  RETRY_DELAY_BASE_MS: 1000,
  RETRY_DELAY_MULTIPLIER: 2,

  // パフォーマンス監視
  PERFORMANCE_SAMPLE_INTERVAL_MS: 1000,
  MAX_PERFORMANCE_HISTORY_COUNT: 100,

  // メモリ管理
  CLEANUP_INTERVAL_MS: 30000, // 30 seconds
  MAX_INACTIVE_RESOURCES: 50,
  MEMORY_PRESSURE_THRESHOLD_MB: 100
} as const;

// =============================================================================
// ターミナル関連定数
// =============================================================================

export const TERMINAL_CONSTANTS = {
  // ターミナル制限
  MAX_TERMINAL_COUNT: 5,
  MIN_TERMINAL_ID_NUMBER: 1,
  MAX_TERMINAL_ID_NUMBER: 5,

  // ターミナル設定
  DEFAULT_SHELL_TIMEOUT_MS: 10000,
  DEFAULT_TERMINAL_COLS: 80,
  DEFAULT_TERMINAL_ROWS: 24,

  // 名前とプレフィックス
  TERMINAL_NAME_PREFIX: 'Terminal',
  TERMINAL_ID_PREFIX: 'terminal-',
  SPLIT_TERMINAL_SUFFIX: '-split',

  // スクロールバック設定
  DEFAULT_SCROLLBACK_LINES: 1000,
  MAX_SCROLLBACK_LINES: 10000,
  SCROLLBACK_CHUNK_SIZE: 100,

  // CLI エージェント検出
  CLI_AGENT_DETECTION_DEBOUNCE_MS: 500,
  CLI_AGENT_PATTERNS: {
    CLAUDE_CODE: /Claude Code/i,
    GITHUB_COPILOT: /GitHub Copilot|copilot/i,
    GEMINI_CLI: /gemini|bard/i,
    GENERAL_AI: /AI|Assistant|Chat/i
  }
} as const;

// =============================================================================
// UI/UX 関連定数
// =============================================================================

export const UI_CONSTANTS = {
  // レイアウト
  HEADER_HEIGHT_PX: 32,
  STATUS_BAR_HEIGHT_PX: 22,
  BORDER_WIDTH_PX: 1,
  PADDING_STANDARD_PX: 8,
  MARGIN_STANDARD_PX: 4,

  // アニメーション
  ANIMATION_DURATION_FAST_MS: 150,
  ANIMATION_DURATION_NORMAL_MS: 300,
  ANIMATION_DURATION_SLOW_MS: 500,

  // 通知
  NOTIFICATION_DURATION_SHORT_MS: 3000,
  NOTIFICATION_DURATION_NORMAL_MS: 5000,
  NOTIFICATION_DURATION_LONG_MS: 10000,

  // フォント設定
  DEFAULT_FONT_SIZE_PX: 14,
  MIN_FONT_SIZE_PX: 8,
  MAX_FONT_SIZE_PX: 72,
  FONT_SIZE_STEP: 1,

  // 色テーマ
  THEME_TRANSITION_DURATION_MS: 200,
  OPACITY_DISABLED: 0.6,
  OPACITY_HOVER: 0.8
} as const;

// =============================================================================
// 通信関連定数
// =============================================================================

export const COMMUNICATION_CONSTANTS = {
  // メッセージプロトコル
  MESSAGE_PROTOCOL_VERSION: '1.0.0',
  MAX_MESSAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB

  // WebView通信
  WEBVIEW_READY_TIMEOUT_MS: 5000,
  MESSAGE_QUEUE_MAX_SIZE: 1000,

  // セッション管理
  SESSION_SAVE_DEBOUNCE_MS: 1000,
  SESSION_RESTORE_TIMEOUT_MS: 10000,
  SESSION_CLEANUP_INTERVAL_MS: 60000, // 1 minute

  // 設定同期
  CONFIG_SYNC_DEBOUNCE_MS: 500,
  CONFIG_VALIDATION_TIMEOUT_MS: 2000
} as const;

// =============================================================================
// エラー関連定数
// =============================================================================

export const ERROR_CONSTANTS = {
  // エラー分類
  MAX_ERROR_COUNT_BEFORE_UNHEALTHY: 10,
  ERROR_LOG_MAX_LENGTH: 1000,

  // リカバリー設定
  AUTO_RECOVERY_ENABLED: true,
  RECOVERY_ATTEMPT_DELAY_MS: 2000,
  MAX_RECOVERY_ATTEMPTS: 3,

  // エラーメッセージの最大長
  MAX_ERROR_MESSAGE_LENGTH: 500,
  MAX_STACK_TRACE_LENGTH: 2000
} as const;

// =============================================================================
// 列挙型定義 - 型安全な定数グループ
// =============================================================================

/**
 * システム状態の列挙型
 */
export enum SystemStatus {
  INITIALIZING = 'initializing',
  READY = 'ready',
  BUSY = 'busy',
  ERROR = 'error',
  DISPOSING = 'disposing',
  DISPOSED = 'disposed'
}

/**
 * ターミナル操作の種類
 */
export enum TerminalAction {
  CREATE = 'create',
  DELETE = 'delete',
  ACTIVATE = 'activate',
  RESIZE = 'resize',
  CLEAR = 'clear',
  SPLIT = 'split',
  KILL = 'kill',
  RESTART = 'restart'
}

/**
 * メッセージの重要度レベル
 */
export enum MessageSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * 通知の種類
 */
export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * CLIエージェントの状態
 */
export enum CliAgentStatus {
  INACTIVE = 'inactive',
  DETECTING = 'detecting',
  ACTIVE = 'active',
  PROCESSING = 'processing',
  IDLE = 'idle',
  ERROR = 'error'
}

/**
 * ターミナルの状態
 */
export enum TerminalState {
  CREATING = 'creating',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BUSY = 'busy',
  CLOSING = 'closing',
  CLOSED = 'closed',
  ERROR = 'error'
}

/**
 * セッション操作の種類
 */
export enum SessionOperation {
  SAVE = 'save',
  RESTORE = 'restore',
  CLEAR = 'clear',
  EXPORT = 'export',
  IMPORT = 'import'
}

/**
 * パフォーマンスメトリクスの種類
 */
export enum PerformanceMetric {
  INITIALIZATION_TIME = 'initializationTime',
  OPERATION_COUNT = 'operationCount',
  AVERAGE_OPERATION_TIME = 'averageOperationTime',
  ERROR_RATE = 'errorRate',
  MEMORY_USAGE = 'memoryUsage',
  CPU_USAGE = 'cpuUsage'
}

/**
 * リソースの種類
 */
export enum ResourceType {
  EVENT_LISTENER = 'eventListener',
  TIMER = 'timer',
  INTERVAL = 'interval',
  SUBSCRIPTION = 'subscription',
  CONNECTION = 'connection',
  STREAM = 'stream',
  OBSERVER = 'observer'
}

/**
 * 設定カテゴリ
 */
export enum ConfigurationCategory {
  TERMINAL = 'terminal',
  APPEARANCE = 'appearance',
  BEHAVIOR = 'behavior',
  PERFORMANCE = 'performance',
  ADVANCED = 'advanced',
  DEBUG = 'debug'
}

// =============================================================================
// 正規表現パターン定数
// =============================================================================

export const REGEX_PATTERNS = {
  // ターミナルID
  TERMINAL_ID: /^terminal-\d+(-split)?$/,

  // セッションID
  SESSION_ID: /^session-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,

  // ANSI エスケープシーケンス
  ANSI_ESCAPE: /\x1b\[[0-9;]*[a-zA-Z]/g,

  // CLI エージェント検出パターン
  CLI_AGENTS: {
    CLAUDE_CODE: /Claude\s+Code|claude-code|@claude/i,
    GITHUB_COPILOT: /GitHub\s+Copilot|copilot\s+chat|@copilot/i,
    GEMINI: /Gemini|Bard|@gemini/i,
    CHATGPT: /ChatGPT|OpenAI|@chatgpt/i
  },

  // ファイルパス
  FILE_PATH: /^[a-zA-Z]:[\\\/](?:[^<>:"|?*\r\n]+[\\\/])*[^<>:"|?*\r\n]*$|^\/(?:[^\/\0]+\/)*[^\/\0]*$/,

  // URL
  URL: /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?$/,

  // セマンティックバージョン
  SEMANTIC_VERSION: /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?:[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
} as const;

// =============================================================================
// 設定デフォルト値
// =============================================================================

export const DEFAULT_SETTINGS = {
  // ターミナル設定
  terminal: {
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
    fontSize: UI_CONSTANTS.DEFAULT_FONT_SIZE_PX,
    fontFamily: 'monospace',
    scrollback: TERMINAL_CONSTANTS.DEFAULT_SCROLLBACK_LINES,
    cursorBlink: true,
    cursorStyle: 'block' as const
  },

  // パフォーマンス設定
  performance: {
    enableBuffering: true,
    bufferFlushInterval: PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS,
    enablePerformanceTracking: true,
    maxBufferSize: PERFORMANCE_CONSTANTS.MAX_BUFFER_SIZE_BYTES
  },

  // UI設定
  ui: {
    showHeader: true,
    showStatusBar: true,
    enableAnimations: true,
    notificationDuration: UI_CONSTANTS.NOTIFICATION_DURATION_NORMAL_MS
  },

  // デバッグ設定
  debug: {
    enableLogging: false,
    logLevel: MessageSeverity.INFO,
    enablePerformanceMonitoring: false,
    enableErrorTracking: true
  }
} as const;

// =============================================================================
// イベント名定数
// =============================================================================

export const EVENT_NAMES = {
  // システムイベント
  SYSTEM_READY: 'system:ready',
  SYSTEM_ERROR: 'system:error',
  SYSTEM_DISPOSING: 'system:disposing',

  // ターミナルイベント
  TERMINAL_CREATED: 'terminal:created',
  TERMINAL_DELETED: 'terminal:deleted',
  TERMINAL_ACTIVATED: 'terminal:activated',
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_RESIZED: 'terminal:resized',

  // セッションイベント
  SESSION_SAVED: 'session:saved',
  SESSION_RESTORED: 'session:restored',
  SESSION_CLEARED: 'session:cleared',

  // 設定イベント
  CONFIG_CHANGED: 'config:changed',
  THEME_CHANGED: 'theme:changed',

  // パフォーマンスイベント
  PERFORMANCE_UPDATED: 'performance:updated',
  RESOURCE_CLEANUP: 'resource:cleanup',

  // エラーイベント
  ERROR_OCCURRED: 'error:occurred',
  ERROR_RECOVERED: 'error:recovered'
} as const;

// =============================================================================
// 型定義のエクスポート
// =============================================================================

export type SystemStatusType = keyof typeof SystemStatus;
export type TerminalActionType = keyof typeof TerminalAction;
export type MessageSeverityType = keyof typeof MessageSeverity;
export type NotificationTypeType = keyof typeof NotificationType;
export type CliAgentStatusType = keyof typeof CliAgentStatus;
export type TerminalStateType = keyof typeof TerminalState;
export type SessionOperationType = keyof typeof SessionOperation;
export type PerformanceMetricType = keyof typeof PerformanceMetric;
export type ResourceTypeType = keyof typeof ResourceType;
export type ConfigurationCategoryType = keyof typeof ConfigurationCategory;