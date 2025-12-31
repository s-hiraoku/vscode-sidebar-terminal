/**
 * タイミング・遅延関連定数
 *
 * 各種遅延処理、デバウンス、スロットル、ポーリング間隔を制御する定数群。
 *
 * @see SystemConstants.ts - 元の統合定数ファイル
 */

export const TIMING_CONSTANTS = {
  // デバウンス・スロットル
  /**
   * リサイズデバウンス遅延（ミリ秒）
   */
  RESIZE_DEBOUNCE_DELAY_MS: 100,

  /**
   * 入力デバウンス遅延（ミリ秒）
   */
  INPUT_DEBOUNCE_DELAY_MS: 300,

  /**
   * スクロールスロットル間隔（ミリ秒）
   */
  SCROLL_THROTTLE_MS: 16,

  /**
   * 検索デバウンス遅延（ミリ秒）
   */
  SEARCH_DEBOUNCE_DELAY_MS: 500,

  // ポーリング間隔
  /**
   * 状態チェックポーリング間隔（ミリ秒）
   */
  STATE_CHECK_INTERVAL_MS: 1000,

  /**
   * ヘルスチェック間隔（ミリ秒）
   */
  HEALTH_CHECK_INTERVAL_MS: 30000,

  /**
   * リソース監視間隔（ミリ秒）
   */
  RESOURCE_MONITOR_INTERVAL_MS: 5000,

  // 遅延処理
  /**
   * 初期化遅延（ミリ秒）
   */
  INIT_DELAY_MS: 100,

  /**
   * クリーンアップ遅延（ミリ秒）
   */
  CLEANUP_DELAY_MS: 500,

  /**
   * フォーカス遅延（ミリ秒）
   */
  FOCUS_DELAY_MS: 50,

  /**
   * WebView初期化遅延（ミリ秒）
   */
  WEBVIEW_INIT_DELAY_MS: 200,

  // アイドル・スリープ
  /**
   * アイドル検出時間（ミリ秒）
   */
  IDLE_DETECTION_MS: 5000,

  /**
   * スリープ前の待機時間（ミリ秒）
   */
  SLEEP_DELAY_MS: 10000,
} as const;

export type TimingConstantsType = typeof TIMING_CONSTANTS;
