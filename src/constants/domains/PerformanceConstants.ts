/**
 * パフォーマンス関連定数
 *
 * システム全体のパフォーマンス特性を決定する定数群。
 * 値の変更は、レスポンス性、スループット、リソース使用量に影響を与えます。
 *
 * @see SystemConstants.ts - 元の統合定数ファイル
 */

export const PERFORMANCE_CONSTANTS = {
  // タイムアウト設定
  /**
   * デフォルトの初期化タイムアウト (5秒)
   *
   * @rationale 通常の環境でのVS Code拡張機能の初期化は1-2秒で完了しますが、
   * 低速なマシンやネットワーク遅延を考慮して5秒に設定しています。
   */
  DEFAULT_INITIALIZATION_TIMEOUT_MS: 5000,

  /**
   * デフォルトの操作タイムアウト (30秒)
   *
   * @rationale 長時間実行されるターミナルコマンド（ビルド、テストなど）を考慮して
   * 30秒に設定していますが、通常の操作は数秒以内に完了します。
   */
  DEFAULT_OPERATION_TIMEOUT_MS: 30000,

  /**
   * WebView通信タイムアウト (3秒)
   *
   * @rationale WebViewとの通信は通常100-200msで完了しますが、
   * レンダリング遅延やGCを考慮して3秒に設定しています。
   */
  WEBVIEW_COMMUNICATION_TIMEOUT_MS: 3000,

  // バッファリング設定
  /**
   * 出力バッファのフラッシュ間隔 (16ms = 60fps)
   */
  OUTPUT_BUFFER_FLUSH_INTERVAL_MS: 16,

  /**
   * CLI Agent用の高速フラッシュ間隔 (4ms = 250fps)
   */
  CLI_AGENT_FAST_FLUSH_INTERVAL_MS: 4,

  /**
   * 最大バッファサイズ (1MB)
   */
  MAX_BUFFER_SIZE_BYTES: 1024 * 1024,

  /**
   * バッファチャンクサイズ (50チャンク)
   */
  MAX_BUFFER_CHUNK_COUNT: 50,

  /**
   * 大量出力の閾値 (500バイト)
   */
  LARGE_OUTPUT_THRESHOLD_BYTES: 500,

  /**
   * 小さな入力の閾値 (10バイト)
   */
  SMALL_INPUT_THRESHOLD_BYTES: 10,

  /**
   * 中程度の出力の閾値 (50バイト)
   */
  MODERATE_OUTPUT_THRESHOLD_BYTES: 50,

  /**
   * 即時フラッシュの閾値 (1000バイト)
   */
  IMMEDIATE_FLUSH_THRESHOLD_BYTES: 1000,

  /**
   * 超高速フラッシュ間隔 (2ms = 500fps)
   */
  ULTRA_FAST_FLUSH_INTERVAL_MS: 2,

  // リトライ設定
  /**
   * デフォルトのリトライ回数 (3回)
   */
  DEFAULT_RETRY_COUNT: 3,

  /**
   * リトライ遅延の基本値 (1秒)
   */
  RETRY_DELAY_BASE_MS: 1000,

  /**
   * リトライ遅延の乗数 (2倍)
   */
  RETRY_DELAY_MULTIPLIER: 2,

  // パフォーマンス監視
  /**
   * パフォーマンスサンプリング間隔 (1秒)
   */
  PERFORMANCE_SAMPLE_INTERVAL_MS: 1000,

  /**
   * パフォーマンス履歴の最大保持数 (100サンプル)
   */
  MAX_PERFORMANCE_HISTORY_COUNT: 100,

  // メモリ管理
  /**
   * クリーンアップ間隔 (30秒)
   */
  CLEANUP_INTERVAL_MS: 30000,

  /**
   * 非アクティブリソースの最大保持数 (50個)
   */
  MAX_INACTIVE_RESOURCES: 50,

  /**
   * メモリ圧迫の閾値 (100MB)
   */
  MEMORY_PRESSURE_THRESHOLD_MB: 100,
} as const;

export type PerformanceConstantsType = typeof PERFORMANCE_CONSTANTS;
