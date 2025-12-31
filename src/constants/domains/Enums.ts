/**
 * システム全体の列挙型定義
 *
 * 型安全な定数グループを提供する列挙型集。
 *
 * @see SystemConstants.ts - 元の統合定数ファイル
 */

/**
 * システム状態の列挙型
 */
export enum SystemStatus {
  INITIALIZING = 'initializing',
  READY = 'ready',
  BUSY = 'busy',
  ERROR = 'error',
  DISPOSING = 'disposing',
  DISPOSED = 'disposed',
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
  RESTART = 'restart',
}

/**
 * メッセージの重要度レベル
 */
export enum MessageSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * 通知の種類
 */
export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
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
  ERROR = 'error',
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
  ERROR = 'error',
}

/**
 * セッション操作の種類
 */
export enum SessionOperation {
  SAVE = 'save',
  RESTORE = 'restore',
  CLEAR = 'clear',
  EXPORT = 'export',
  IMPORT = 'import',
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
  CPU_USAGE = 'cpuUsage',
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
  OBSERVER = 'observer',
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
  DEBUG = 'debug',
}
