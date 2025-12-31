/**
 * 通信・メッセージング関連定数
 *
 * Extension Host ↔ WebView間の通信、メッセージプロトコル、セッション管理を制御する定数群。
 *
 * @see SystemConstants.ts - 元の統合定数ファイル
 */

export const COMMUNICATION_CONSTANTS = {
  // メッセージプロトコル
  /**
   * メッセージ送信タイムアウト（ミリ秒）
   */
  MESSAGE_TIMEOUT_MS: 5000,

  /**
   * メッセージ再送試行回数
   */
  MESSAGE_RETRY_COUNT: 3,

  /**
   * メッセージ再送待機時間（ミリ秒）
   */
  MESSAGE_RETRY_DELAY_MS: 1000,

  /**
   * メッセージキュー最大サイズ
   */
  MESSAGE_QUEUE_MAX_SIZE: 100,

  // WebView通信
  /**
   * WebView初期化タイムアウト（ミリ秒）
   */
  WEBVIEW_INIT_TIMEOUT_MS: 10000,

  /**
   * WebView readyメッセージ待機タイムアウト（ミリ秒）
   */
  WEBVIEW_READY_TIMEOUT_MS: 5000,

  /**
   * WebView再接続試行間隔（ミリ秒）
   */
  WEBVIEW_RECONNECT_INTERVAL_MS: 2000,

  /**
   * WebView最大再接続試行回数
   */
  WEBVIEW_MAX_RECONNECT_ATTEMPTS: 5,

  // セッション管理
  /**
   * セッションアイドルタイムアウト（ミリ秒）
   */
  SESSION_IDLE_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes

  /**
   * セッションハートビート間隔（ミリ秒）
   */
  SESSION_HEARTBEAT_INTERVAL_MS: 30000,

  /**
   * セッションクリーンアップ間隔（ミリ秒）
   */
  SESSION_CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
} as const;

export type CommunicationConstantsType = typeof COMMUNICATION_CONSTANTS;
