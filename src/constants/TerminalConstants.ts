/**
 * ターミナル関連定数
 *
 * ターミナルの動作、制限、デフォルト設定を定義する定数群
 */

export const TERMINAL_CONSTANTS = {
  // ========================================
  // ターミナル制限
  // ========================================

  /** 最大ターミナル数 (10個) */
  MAX_TERMINAL_COUNT: 10,

  /** デフォルトの最大ターミナル数 (10個) */
  DEFAULT_MAX_TERMINALS: 10,

  /** 最小ターミナルID番号 (1) */
  MIN_TERMINAL_ID_NUMBER: 1,

  /** 最大ターミナルID番号 (10) */
  MAX_TERMINAL_ID_NUMBER: 10,

  // ========================================
  // プラットフォーム設定
  // ========================================

  /** プラットフォーム別デフォルトシェル */
  PLATFORMS: {
    WINDOWS: 'win32',
    MACOS: 'darwin',
    LINUX: 'linux',
    DEFAULT_SHELLS: {
      win32: 'powershell.exe',
      darwin: '/bin/zsh',
      linux: '/bin/bash',
    },
  },

  // ========================================
  // ターミナル設定
  // ========================================

  /** デフォルトのシェルタイムアウト (10秒) */
  DEFAULT_SHELL_TIMEOUT_MS: 10000,

  /** デフォルトのターミナル列数 (80列) */
  DEFAULT_TERMINAL_COLS: 80,

  /** デフォルトのターミナル行数 (24行) */
  DEFAULT_TERMINAL_ROWS: 24,

  /** 代替のデフォルト行数 (30行) */
  ALTERNATE_DEFAULT_ROWS: 30,

  /** 最小ターミナル高さ (100ピクセル) */
  MIN_TERMINAL_HEIGHT_PX: 100,

  /** 最小ターミナル幅閾値 (50ピクセル) */
  MIN_TERMINAL_SIZE_THRESHOLD_PX: 50,

  /** タブストップ幅 (8スペース) */
  TAB_STOP_WIDTH: 8,

  // ========================================
  // 名前とプレフィックス
  // ========================================

  /** ターミナル名のプレフィックス */
  TERMINAL_NAME_PREFIX: 'Terminal',

  /** ターミナルIDのプレフィックス */
  TERMINAL_ID_PREFIX: 'terminal-',

  /** 分割ターミナルのサフィックス */
  SPLIT_TERMINAL_SUFFIX: '-split',

  // ========================================
  // スクロールバック設定
  // ========================================

  /** デフォルトのスクロールバック行数 (2000行) */
  DEFAULT_SCROLLBACK_LINES: 2000,

  /** 最大スクロールバック行数 (10000行) */
  MAX_SCROLLBACK_LINES: 10000,

  /** スクロールバックチャンクサイズ (100行) */
  SCROLLBACK_CHUNK_SIZE: 100,

  // ========================================
  // タイミング関連
  // ========================================

  /** ターミナル削除遅延 (2秒) */
  TERMINAL_REMOVE_DELAY_MS: 2000,

  /** ヘルスチェック標準タイムアウト (3秒) */
  HEALTH_CHECK_TIMEOUT_MS: 3000,

  /** セーフモード時のヘルスチェックタイムアウト (2秒) */
  HEALTH_CHECK_TIMEOUT_SAFE_MODE_MS: 2000,

  // ========================================
  // CLI エージェント検出
  // ========================================

  /** CLI Agent検出のデバウンス遅延 (500ms) */
  CLI_AGENT_DETECTION_DEBOUNCE_MS: 500,

  /** CLI Agent検出パターン */
  CLI_AGENT_PATTERNS: {
    CLAUDE_CODE: /Claude Code/i,
    GITHUB_COPILOT: /GitHub Copilot|copilot/i,
    GEMINI_CLI: /gemini|bard/i,
    GENERAL_AI: /AI|Assistant|Chat/i,
  },
} as const;

/** ターミナル定数の型 */
export type TerminalConstantsType = typeof TERMINAL_CONSTANTS;
