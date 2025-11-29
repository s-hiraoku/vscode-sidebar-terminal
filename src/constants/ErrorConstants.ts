/**
 * エラーハンドリング関連定数
 *
 * エラー検出、リトライ、回復処理、ログ記録を制御する定数群
 */

export const ERROR_CONSTANTS = {
  // ========================================
  // リトライ制御
  // ========================================

  /** デフォルトリトライ回数 */
  DEFAULT_RETRY_COUNT: 3,

  /** リトライ間隔（ミリ秒） */
  RETRY_DELAY_MS: 1000,

  /** 指数バックオフの最大遅延（ミリ秒） */
  MAX_RETRY_DELAY_MS: 30000,

  /** 指数バックオフの乗数 */
  RETRY_BACKOFF_MULTIPLIER: 2,

  // ========================================
  // エラーレート制限
  // ========================================

  /** エラーログレート制限（秒） */
  ERROR_LOG_RATE_LIMIT_SECONDS: 10,

  /** エラー通知レート制限（秒） */
  ERROR_NOTIFICATION_RATE_LIMIT_SECONDS: 30,

  /** エラーカウンターリセット間隔（ミリ秒） */
  ERROR_COUNTER_RESET_INTERVAL_MS: 60000,

  // ========================================
  // サーキットブレーカー
  // ========================================

  /** サーキットブレーカー開放しきい値 */
  CIRCUIT_BREAKER_THRESHOLD: 5,

  /** サーキットブレーカーリセットタイムアウト（ミリ秒） */
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 60000,

  // ========================================
  // タイムアウト
  // ========================================

  /** デフォルト操作タイムアウト（ミリ秒） */
  DEFAULT_OPERATION_TIMEOUT_MS: 30000,

  /** 長時間操作タイムアウト（5分） */
  LONG_OPERATION_TIMEOUT_MS: 5 * 60 * 1000,

  /** クリティカル操作タイムアウト（ミリ秒） */
  CRITICAL_OPERATION_TIMEOUT_MS: 5000,
} as const;

/** エラー定数の型 */
export type ErrorConstantsType = typeof ERROR_CONSTANTS;
