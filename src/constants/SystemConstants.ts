/**
 * システム全体の定数定義
 * - 一貫した命名規則と明確な分類
 * - 型安全性を保証するenum活用
 * - 設定値の中央集権管理
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/226
 *
 * このファイルは、コードベース全体で使用されるマジックナンバーを排除し、
 * 各定数の目的、計算根拠、パフォーマンスへの影響を文書化することを目的としています。
 */

// =============================================================================
// パフォーマンス関連定数
// =============================================================================

/**
 * パフォーマンスに関連する定数群
 *
 * これらの定数は、システム全体のパフォーマンス特性を決定します。
 * 値の変更は、レスポンス性、スループット、リソース使用量に影響を与えます。
 */
export const PERFORMANCE_CONSTANTS = {
  // タイムアウト設定
  /**
   * デフォルトの初期化タイムアウト (5秒)
   *
   * @rationale 通常の環境でのVS Code拡張機能の初期化は1-2秒で完了しますが、
   * 低速なマシンやネットワーク遅延を考慮して5秒に設定しています。
   *
   * @performance 初期化が5秒を超える場合、エラーとして扱われ、
   * ユーザーに通知されます。
   */
  DEFAULT_INITIALIZATION_TIMEOUT_MS: 5000,

  /**
   * デフォルトの操作タイムアウト (30秒)
   *
   * @rationale 長時間実行されるターミナルコマンド（ビルド、テストなど）を考慮して
   * 30秒に設定していますが、通常の操作は数秒以内に完了します。
   *
   * @performance タイムアウト後、操作は中断され、エラーが報告されます。
   */
  DEFAULT_OPERATION_TIMEOUT_MS: 30000,

  /**
   * WebView通信タイムアウト (3秒)
   *
   * @rationale WebViewとの通信は通常100-200msで完了しますが、
   * レンダリング遅延やGCを考慮して3秒に設定しています。
   *
   * @performance タイムアウトが発生すると、UIの応答性に影響します。
   */
  WEBVIEW_COMMUNICATION_TIMEOUT_MS: 3000,

  // バッファリング設定
  /**
   * 出力バッファのフラッシュ間隔 (16ms = 60fps)
   *
   * @rationale 60fpsは、人間の目には滑らかな動きとして認識されます。
   * これより短い間隔は、CPUリソースを無駄にする可能性があります。
   *
   * @performance 16msのフラッシュ間隔により、1秒あたり約60回の画面更新が可能です。
   * より短い間隔（4ms、8ms）は、特定のユースケース（CLI Agent、高頻度出力）で使用されます。
   *
   * @tuning
   * - 高速な応答性が必要な場合: 4-8ms
   * - 標準的な用途: 16ms (推奨)
   * - 低リソース環境: 32ms
   */
  OUTPUT_BUFFER_FLUSH_INTERVAL_MS: 16,

  /**
   * CLI Agent用の高速フラッシュ間隔 (4ms = 250fps)
   *
   * @rationale AI Agentからの出力は、ユーザーがリアルタイムで読む必要があるため、
   * より高い更新頻度（250fps）を使用して即座のフィードバックを提供します。
   *
   * @performance 4msの間隔は、1秒あたり250回の更新を可能にし、
   * タイピングのような高頻度の小さな出力に最適化されています。
   *
   * @cost より高いCPU使用率（約1.5-2倍）ですが、UXの向上が優先されます。
   */
  CLI_AGENT_FAST_FLUSH_INTERVAL_MS: 4,

  /**
   * 最大バッファサイズ (1MB)
   *
   * @rationale 1MBは、ほとんどのターミナル出力を処理するのに十分なサイズです。
   * これを超える出力は、メモリ使用量とパフォーマンスのバランスを考慮して、
   * チャンクに分割されます。
   *
   * @performance 1MBを超えるデータは、複数のフラッシュサイクルに分割され、
   * メモリスパイクを防ぎます。
   */
  MAX_BUFFER_SIZE_BYTES: 1024 * 1024,

  /**
   * バッファチャンクサイズ (50チャンク)
   *
   * @rationale 50チャンクは、小さな入力の処理速度と大きな出力の効率の
   * バランスを取るために選択されました。
   *
   * @performance 50チャンクに達すると、バッファは自動的にフラッシュされます。
   * これにより、メモリ使用量が制御され、UIの応答性が維持されます。
   *
   * @tuning
   * - 高頻度の小さな入力: 30-40
   * - バランス型: 50 (推奨)
   * - 大量出力: 70-100
   */
  MAX_BUFFER_CHUNK_COUNT: 50,

  /**
   * 大量出力の閾値 (500バイト)
   *
   * @rationale 500バイト以上のデータは「大量出力」とみなされ、
   * より積極的なバッファリング戦略が適用されます。
   *
   * @performance この閾値を超えると、フラッシュ間隔が調整され、
   * スループットが優先されます。
   */
  LARGE_OUTPUT_THRESHOLD_BYTES: 500,

  /**
   * 小さな入力の閾値 (10バイト)
   *
   * @rationale 10バイト以下のデータ（キーストローク、小さなコマンド）は
   * 即座にフラッシュされ、タイピング時の遅延を最小化します。
   *
   * @performance この閾値以下のデータは、バッファリングせずに即座に処理されます。
   */
  SMALL_INPUT_THRESHOLD_BYTES: 10,

  /**
   * 中程度の出力の閾値 (50バイト)
   *
   * @rationale 50バイト以上のデータは「中程度の出力」とみなされ、
   * 標準的なバッファリング戦略が適用されます。
   *
   * @performance この閾値を超えると、バッファが蓄積され、
   * 効率的なバッチ処理が行われます。
   */
  MODERATE_OUTPUT_THRESHOLD_BYTES: 50,

  /**
   * 即時フラッシュの閾値 (1000バイト)
   *
   * @rationale 1000バイト以上のデータは、メモリ使用量を制御するために
   * 即座にフラッシュされます。
   *
   * @performance この閾値を超えると、バッファリングせずに即座に処理されます。
   */
  IMMEDIATE_FLUSH_THRESHOLD_BYTES: 1000,

  /**
   * 超高速フラッシュ間隔 (2ms = 500fps)
   *
   * @rationale CLI AgentやREPL環境での最高の応答性を提供します。
   *
   * @performance 2msの間隔は、1秒あたり500回の更新を可能にし、
   * リアルタイムフィードバックに最適化されています。
   *
   * @cost 高いCPU使用率（約3-4倍）ですが、特定のユースケースでは必要です。
   */
  ULTRA_FAST_FLUSH_INTERVAL_MS: 2,

  // リトライ設定
  /**
   * デフォルトのリトライ回数 (3回)
   *
   * @rationale ほとんどの一時的なエラー（ネットワーク遅延、リソース競合）は
   * 3回以内に解決されます。
   */
  DEFAULT_RETRY_COUNT: 3,

  /**
   * リトライ遅延の基本値 (1秒)
   *
   * @rationale 1秒の遅延は、システムリソースの回復とユーザー体験の
   * バランスを取ります。
   */
  RETRY_DELAY_BASE_MS: 1000,

  /**
   * リトライ遅延の乗数 (2倍)
   *
   * @rationale 指数バックオフ（1s, 2s, 4s）により、システムへの負荷を
   * 段階的に軽減します。
   */
  RETRY_DELAY_MULTIPLIER: 2,

  // パフォーマンス監視
  /**
   * パフォーマンスサンプリング間隔 (1秒)
   *
   * @rationale 1秒間隔でのサンプリングは、トレンドの把握と
   * オーバーヘッドの最小化のバランスを取ります。
   */
  PERFORMANCE_SAMPLE_INTERVAL_MS: 1000,

  /**
   * パフォーマンス履歴の最大保持数 (100サンプル)
   *
   * @rationale 100サンプル（約100秒 = 1.67分）は、短期的なトレンドを
   * 把握するのに十分です。
   */
  MAX_PERFORMANCE_HISTORY_COUNT: 100,

  // メモリ管理
  /**
   * クリーンアップ間隔 (30秒)
   *
   * @rationale 30秒ごとのクリーンアップは、メモリリークの防止と
   * パフォーマンスへの影響の最小化のバランスを取ります。
   */
  CLEANUP_INTERVAL_MS: 30000,

  /**
   * 非アクティブリソースの最大保持数 (50個)
   *
   * @rationale 50個のリソースは、再利用の効率とメモリ使用量の
   * バランスを取ります。
   */
  MAX_INACTIVE_RESOURCES: 50,

  /**
   * メモリ圧迫の閾値 (100MB)
   *
   * @rationale 100MBを超えると、積極的なクリーンアップが
   * トリガーされます。
   */
  MEMORY_PRESSURE_THRESHOLD_MB: 100
} as const;

// =============================================================================
// ターミナル関連定数
// =============================================================================

/**
 * ターミナルに関連する定数群
 *
 * これらの定数は、ターミナルの動作、制限、デフォルト設定を定義します。
 */
export const TERMINAL_CONSTANTS = {
  // ターミナル制限
  /**
   * 最大ターミナル数 (5個)
   *
   * @rationale VS Codeのサイドバーのスペース制約とパフォーマンスを考慮して、
   * 5個のターミナルを上限としています。
   *
   * @performance 5個を超えると、UIの応答性とメモリ使用量に影響します。
   */
  MAX_TERMINAL_COUNT: 5,

  /**
   * 最小ターミナルID番号 (1)
   *
   * @rationale ターミナルIDは1から始まり、ユーザーに分かりやすい番号体系を提供します。
   */
  MIN_TERMINAL_ID_NUMBER: 1,

  /**
   * 最大ターミナルID番号 (5)
   *
   * @rationale MAX_TERMINAL_COUNTと一致し、一貫性のあるID管理を提供します。
   */
  MAX_TERMINAL_ID_NUMBER: 5,

  // ターミナル設定
  /**
   * デフォルトのシェルタイムアウト (10秒)
   *
   * @rationale シェルの起動は通常1-2秒で完了しますが、
   * 初回起動時のセットアップや低速なマシンを考慮して10秒に設定しています。
   *
   * @performance タイムアウト後、シェルの起動は失敗とみなされ、
   * ユーザーに通知されます。
   */
  DEFAULT_SHELL_TIMEOUT_MS: 10000,

  /**
   * デフォルトのターミナル列数 (80列)
   *
   * @rationale 80列は、ターミナルの標準的な幅であり、
   * ほとんどのCLIツールがこの幅を前提としています。
   *
   * @compatibility UNIX系システムの伝統的な標準に準拠しています。
   */
  DEFAULT_TERMINAL_COLS: 80,

  /**
   * デフォルトのターミナル行数 (24行)
   *
   * @rationale 24行は、ターミナルの標準的な高さであり、
   * サイドバーの限られたスペースに適しています。
   *
   * @note VS Codeの設定によっては、30行まで拡張される場合があります。
   */
  DEFAULT_TERMINAL_ROWS: 24,

  /**
   * 代替のデフォルト行数 (30行)
   *
   * @rationale より広いサイドバーやフルスクリーンターミナルで使用されます。
   *
   * @usage WebView環境やユーザー設定による拡張時に使用されます。
   */
  ALTERNATE_DEFAULT_ROWS: 30,

  /**
   * 最小ターミナル高さ (100ピクセル)
   *
   * @rationale 100ピクセルは、少なくとも3-4行のテキストを表示できる
   * 最小限の高さです。
   *
   * @performance これより小さい高さでは、ユーザビリティが著しく低下します。
   */
  MIN_TERMINAL_HEIGHT_PX: 100,

  /**
   * 最小ターミナル幅閾値 (50ピクセル)
   *
   * @rationale 50ピクセルは、ターミナルが有効なサイズかどうかを
   * 判定するための最小閾値です。
   *
   * @usage リサイズイベントの妥当性チェックに使用されます。
   */
  MIN_TERMINAL_SIZE_THRESHOLD_PX: 50,

  /**
   * タブストップ幅 (8スペース)
   *
   * @rationale 8スペースは、ターミナルの標準的なタブストップ幅です。
   *
   * @compatibility UNIX系システムの標準に準拠しています。
   */
  TAB_STOP_WIDTH: 8,

  // 名前とプレフィックス
  /**
   * ターミナル名のプレフィックス
   *
   * @rationale ユーザーに分かりやすい名前体系を提供します。
   * 例: "Terminal 1", "Terminal 2"
   */
  TERMINAL_NAME_PREFIX: 'Terminal',

  /**
   * ターミナルIDのプレフィックス
   *
   * @rationale 内部的な識別子として使用され、DOM要素のIDなどに使用されます。
   * 例: "terminal-1", "terminal-2"
   */
  TERMINAL_ID_PREFIX: 'terminal-',

  /**
   * 分割ターミナルのサフィックス
   *
   * @rationale 分割されたターミナルを識別するために使用されます。
   * 例: "terminal-1-split"
   */
  SPLIT_TERMINAL_SUFFIX: '-split',

  // スクロールバック設定
  /**
   * デフォルトのスクロールバック行数 (2000行)
   *
   * @rationale 2000行は、十分な履歴を提供しつつ、
   * メモリ使用量を適切に管理します。
   *
   * @performance 2000行は約100-200KBのメモリを使用します（テキスト内容による）。
   *
   * @tuning
   * - 軽量な用途: 1000行
   * - 標準的な用途: 2000行 (推奨)
   * - ヘビーな用途: 5000-10000行
   */
  DEFAULT_SCROLLBACK_LINES: 2000,

  /**
   * 最大スクロールバック行数 (10000行)
   *
   * @rationale 10000行は、メモリ使用量（約500KB-1MB）とユーザビリティの
   * バランスを取った上限値です。
   *
   * @performance 10000行を超えると、スクロールパフォーマンスとメモリ使用量に
   * 顕著な影響が出ます。
   */
  MAX_SCROLLBACK_LINES: 10000,

  /**
   * スクロールバックチャンクサイズ (100行)
   *
   * @rationale 100行ずつのチャンク処理により、大量のスクロールバックデータの
   * 保存・復元を効率化します。
   *
   * @performance チャンクサイズが大きすぎると単一処理の遅延が増加し、
   * 小さすぎるとオーバーヘッドが増加します。
   */
  SCROLLBACK_CHUNK_SIZE: 100,

  // タイミング関連
  /**
   * ターミナル削除遅延 (2秒)
   *
   * @rationale ターミナルを削除する前に2秒の猶予を設けることで、
   * ユーザーが誤操作した場合に取り消すことができます。
   *
   * @ux アニメーションと視覚的フィードバックの時間を確保します。
   */
  TERMINAL_REMOVE_DELAY_MS: 2000,

  /**
   * ヘルスチェック標準タイムアウト (3秒)
   *
   * @rationale ターミナルの健全性チェックは通常100-500msで完了しますが、
   * システム負荷を考慮して3秒に設定しています。
   *
   * @performance タイムアウト後、ターミナルは不健全とみなされ、
   * リカバリー処理が開始されます。
   */
  HEALTH_CHECK_TIMEOUT_MS: 3000,

  /**
   * セーフモード時のヘルスチェックタイムアウト (2秒)
   *
   * @rationale セーフモード時は、より短いタイムアウトを使用して、
   * 迅速な問題検出とリカバリーを行います。
   */
  HEALTH_CHECK_TIMEOUT_SAFE_MODE_MS: 2000,

  // CLI エージェント検出
  /**
   * CLI Agent検出のデバウンス遅延 (500ms)
   *
   * @rationale 出力の連続的な変化を500msでデバウンスすることで、
   * 誤検出を防ぎ、検出精度を向上させます。
   *
   * @performance 500msは、ユーザーの入力パターンとAI Agentの
   * 出力パターンを識別するのに適切な時間です。
   */
  CLI_AGENT_DETECTION_DEBOUNCE_MS: 500,

  /**
   * CLI Agent検出パターン
   *
   * @rationale 各種CLI Agentを検出するための正規表現パターン。
   * 検出されたAgentに応じて、最適化されたバッファリング戦略が適用されます。
   */
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

