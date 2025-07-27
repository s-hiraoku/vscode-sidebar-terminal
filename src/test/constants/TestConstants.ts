/**
 * テスト用定数定義
 * 
 * TDD (Test-Driven Development) のベストプラクティスに従い、
 * テストで使用するマジックナンバーや文字列を定数として定義
 */

// ========== セッション復元テスト用定数 ==========

/** セッション復元で使用するターミナル数 */
export const TEST_TERMINAL_COUNTS = {
  /** 基本的なテスト用ターミナル数 */
  BASIC: 3,
  /** ペアテスト用ターミナル数 */
  PAIR: 2,
  /** 単一ターミナルテスト用 */
  SINGLE: 1,
  /** 空のセッション */
  EMPTY: 0,
} as const;

/** テスト用ターミナルID */
export const TEST_TERMINAL_IDS = {
  TERM1: 'term1',
  TERM2: 'term2',
  TERM3: 'term3',
  NEW_TERM: 'new-term',
  EXISTING_TERM: 'existing-term',
  ORIGINAL_TERM1: 'original-term1',
  ORIGINAL_TERM2: 'original-term2',
  RESTORED_TERM: 'restored-term',
} as const;

/** テスト用ターミナル名 */
export const TEST_TERMINAL_NAMES = {
  TERMINAL_1: 'Terminal 1',
  TERMINAL_2: 'Terminal 2',
  TERMINAL_3: 'Terminal 3',
} as const;

/** テスト用ディレクトリパス */
export const TEST_PATHS = {
  TEST_CWD: '/test',
  TEST_CWD_1: '/test1',
  TEST_CWD_2: '/test2',
  EXTENSION_PATH: '/test/path',
} as const;

/** セッションデータバージョン */
export const SESSION_DATA_VERSION = '1.0.0' as const;

// ========== Scrollbackテスト用定数 ==========

/** Scrollback復元の遅延時間（ミリ秒） */
export const SCROLLBACK_DELAY_MS = {
  /** 基本的な復元遅延 */
  BASIC_RESTORE: 1500,
  /** 待機時間（基本遅延より長く） */
  WAIT_TIME: 2000,
  /** 短い待機時間 */
  SHORT_WAIT: 100,
} as const;

/** テスト用Scrollbackコンテンツ */
export const TEST_SCROLLBACK_CONTENT = {
  ECHO_HELLO: 'echo hello',
  HELLO_OUTPUT: 'hello',
  SESSION_RESTORE_PREFIX: 'Previous session for',
  SESSION_RESTORE_COMMAND: 'echo "Session restored"',
  SESSION_RESTORE_OUTPUT: 'Session restored',
} as const;

/** テスト用Scrollbackタイプ */
export const SCROLLBACK_TYPES = {
  INPUT: 'input',
  OUTPUT: 'output',
  ERROR: 'error',
} as const;

// ========== セッション期限テスト用定数 ==========

/** セッション期限計算用定数（ミリ秒） */
export const SESSION_EXPIRY_MS = {
  /** 1日のミリ秒数 */
  ONE_DAY: 24 * 60 * 60 * 1000,
  /** 期限切れとみなす日数（8日前） */
  EXPIRED_DAYS: 8,
} as const;

// ========== 無限ループ検出テスト用定数 ==========

/** 無限ループ検出用の閾値 */
export const INFINITE_LOOP_THRESHOLDS = {
  /** 異常とみなすcreateTerminal呼び出し回数 */
  MAX_CREATE_TERMINAL_CALLS: 10,
  /** テストタイムアウト時間（ミリ秒） */
  TEST_TIMEOUT_MS: 5000,
  /** 監視間隔（ミリ秒） */
  MONITORING_INTERVAL_MS: 100,
} as const;

// ========== TDDワークフロー用定数 ==========

/** TDDフェーズ識別子 */
export const TDD_PHASES = {
  /** Red: テスト失敗フェーズ */
  RED: 'RED',
  /** Green: テスト成功フェーズ */
  GREEN: 'GREEN',
  /** Refactor: リファクタリングフェーズ */
  REFACTOR: 'REFACTOR',
} as const;

/** テスト実行モード */
export const TEST_EXECUTION_MODES = {
  /** 単体テスト */
  UNIT: 'unit',
  /** 統合テスト */
  INTEGRATION: 'integration',
  /** E2Eテスト */
  E2E: 'e2e',
  /** ウォッチモード（TDD用） */
  WATCH: 'watch',
} as const;

// ========== アサーション用メッセージ ==========

/** クリティカルテスト用エラーメッセージ */
export const CRITICAL_TEST_MESSAGES = {
  MUST_RESTORE_EXACT_COUNT: 'CRITICAL: Must restore exactly',
  MUST_CREATE_TERMINAL_CALLS: 'createTerminal must be called',
  MUST_SET_ACTIVE_TERMINAL: 'CRITICAL: Must set active terminal correctly',
  MUST_RESTORE_SCROLLBACK: 'CRITICAL: Must restore scrollback data',
  MUST_HANDLE_GRACEFULLY: 'CRITICAL: Must handle edge cases gracefully',
  MUST_COMPLETE_CYCLE: 'CRITICAL: Must complete full save-restore cycle',
} as const;

/** テスト成功メッセージ */
export const TEST_SUCCESS_MESSAGES = {
  TERMINALS_RESTORED: '✅ PASS: Correct number of terminals restored',
  ACTIVE_TERMINAL_SET: '✅ PASS: Active terminal set correctly',
  SCROLLBACK_RESTORED: '✅ PASS: Scrollback data restored correctly',
  EMPTY_SESSION_HANDLED: '✅ PASS: Empty session handled gracefully',
  EXISTING_TERMINALS_HANDLED: '✅ PASS: Existing terminals handled correctly',
  CORRUPT_DATA_HANDLED: '✅ PASS: Corrupt session data handled safely',
  EXPIRED_DATA_HANDLED: '✅ PASS: Expired session data handled correctly',
  SESSION_SAVED: '✅ PASS: Session saved with correct data structure',
  SCROLLBACK_GENERATED: '✅ PASS: Scrollback data generated correctly',
  FULL_CYCLE_COMPLETED: '✅ PASS: Full save-restore cycle completed successfully',
} as const;

// ========== モック用定数 ==========

/** モックオブジェクトの設定値 */
export const MOCK_SETTINGS = {
  /** デフォルト戻り値 */
  DEFAULT_RETURN_UNDEFINED: undefined,
  /** 空配列戻り値 */
  EMPTY_ARRAY: [],
  /** Promise解決値 */
  PROMISE_RESOLVED: Promise.resolve(),
} as const;

// ========== パフォーマンステスト用定数 ==========

/** パフォーマンステスト用閾値 */
export const PERFORMANCE_THRESHOLDS = {
  /** セッション保存の最大実行時間（ミリ秒） */
  MAX_SAVE_TIME_MS: 1000,
  /** セッション復元の最大実行時間（ミリ秒） */
  MAX_RESTORE_TIME_MS: 2000,
  /** Scrollback復元の最大実行時間（ミリ秒） */
  MAX_SCROLLBACK_RESTORE_MS: 3000,
} as const;

// ========== エクスポート用型定義 ==========

/** テスト定数の型安全性確保 */
export type TestTerminalCount = typeof TEST_TERMINAL_COUNTS[keyof typeof TEST_TERMINAL_COUNTS];
export type TestTerminalId = typeof TEST_TERMINAL_IDS[keyof typeof TEST_TERMINAL_IDS];
export type TestTerminalName = typeof TEST_TERMINAL_NAMES[keyof typeof TEST_TERMINAL_NAMES];
export type TDDPhase = typeof TDD_PHASES[keyof typeof TDD_PHASES];
export type TestExecutionMode = typeof TEST_EXECUTION_MODES[keyof typeof TEST_EXECUTION_MODES];