/**
 * 共有型定義 - 全コンポーネントで使用する基本型
 * Extension Host と WebView 間で共有される型定義
 */

// ===== 基本ターミナル設定 =====

/**
 * 基本ターミナル設定インターフェース
 * 全てのターミナル設定の基盤となる型
 */
export interface BaseTerminalConfig {}

/**
 * 表示関連設定
 */
export interface DisplayConfig extends BaseTerminalConfig {
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly theme?: string;
  readonly cursorBlink: boolean;
}

/**
 * シェル関連設定
 */
export interface ShellConfig {
  readonly shell?: string;
  readonly shellArgs?: string[];
  readonly cwd?: string;
  readonly defaultDirectory?: string;
}

/**
 * ターミナル制限設定
 */
export interface TerminalLimitsConfig {
  readonly maxTerminals: number;
  readonly minTerminalCount?: number;
  readonly protectLastTerminal?: boolean;
}

/**
 * 操作関連設定
 */
export interface InteractionConfig {
  readonly confirmBeforeKill?: boolean;
  readonly altClickMovesCursor?: boolean;
  readonly multiCursorModifier?: string;
}

// ===== 統合型定義 =====

/**
 * Extension Host で使用するターミナル設定
 * 従来の TerminalConfig の置き換え
 */
export interface ExtensionTerminalConfig
  extends BaseTerminalConfig,
    DisplayConfig,
    ShellConfig,
    TerminalLimitsConfig {
  readonly shell: string; // Extension では必須
  readonly shellArgs: string[]; // Extension では必須
}

/**
 * WebView で使用するターミナル設定
 * xterm.js 固有の設定を含む
 */
export interface WebViewTerminalConfig extends DisplayConfig, ShellConfig {
  readonly theme: TerminalTheme; // WebView では必須
}

/**
 * 部分的なターミナル設定
 * WebView から Extension への設定更新で使用
 * フォント設定はVS Code設定から直接取得するため除外
 */
export interface PartialTerminalSettings {
  fontSize?: number;
  fontFamily?: string;
  theme?: string;
  cursorBlink?: boolean;
  scrollback?: number;
  bellSound?: boolean;
  altClickMovesCursor?: boolean;
  multiCursorModifier?: string;
  enableCliAgentIntegration?: boolean;
}

/**
 * WebView用フォント設定値
 * 設定変更ではなく、現在の値を受信するためのインターフェース
 */
export interface WebViewFontSettings {
  fontSize: number;
  fontFamily: string;
}

/**
 * WebView用統合設定
 * PartialTerminalSettings + フォント設定値
 */
export interface WebViewTerminalSettings extends PartialTerminalSettings {
  fontSize: number;
  fontFamily: string;
}

/**
 * 完全なターミナル設定
 * 全ての設定項目を含む統合型
 */
export interface CompleteTerminalSettings
  extends BaseTerminalConfig,
    DisplayConfig,
    ShellConfig,
    TerminalLimitsConfig,
    InteractionConfig {}

// ===== WebView 固有設定 =====

/**
 * WebView表示設定
 */
export interface WebViewDisplayConfig extends DisplayConfig {
  readonly minTerminalHeight: number;
  readonly autoHideStatus: boolean;
  readonly statusDisplayDuration: number;
  readonly showWebViewHeader: boolean;
  readonly webViewTitle: string;
  readonly showSampleIcons: boolean;
  readonly sampleIconOpacity: number;
  readonly headerFontSize: number;
  readonly headerIconSize: number;
  readonly sampleIconSize: number;
}

/**
 * 完全な拡張設定
 * 従来の ExtensionConfig の置き換え
 */
export interface CompleteExtensionConfig extends WebViewDisplayConfig, TerminalLimitsConfig {}

// ===== 型エイリアス =====

export type TerminalTheme = 'auto' | 'dark' | 'light';
export type SplitDirection = 'horizontal' | 'vertical';
export type CliAgentStatusType = 'info' | 'success' | 'error' | 'warning';

// ===== 後方互換性のためのエイリアス =====

/**
 * 後方互換性のための型エイリアス
 * 段階的移行で使用
 */
export type TerminalConfig = ExtensionTerminalConfig;
export type TerminalSettings = CompleteTerminalSettings;
export type ExtensionConfig = CompleteExtensionConfig;

// ===== 設定キー定数 =====

/**
 * 設定アクセス用のキー定数
 */
export const CONFIG_SECTIONS = {
  SIDEBAR_TERMINAL: 'secondaryTerminal',
  EDITOR: 'editor',
  TERMINAL_INTEGRATED: 'terminal.integrated',
} as const;

export const CONFIG_KEYS = {
  // secondaryTerminal セクション
  THEME: 'theme',
  CURSOR_BLINK: 'cursorBlink',
  MAX_TERMINALS: 'maxTerminals',
  MIN_TERMINAL_COUNT: 'minTerminalCount',
  SHELL: 'shell',
  SHELL_ARGS: 'shellArgs',
  DEFAULT_DIRECTORY: 'defaultDirectory',
  CONFIRM_BEFORE_KILL: 'confirmBeforeKill',
  PROTECT_LAST_TERMINAL: 'protectLastTerminal',

  // editor セクション
  MULTI_CURSOR_MODIFIER: 'multiCursorModifier',

  // terminal.integrated セクション
  ALT_CLICK_MOVES_CURSOR: 'altClickMovesCursor',
  SHELL_WINDOWS: 'shell.windows',
  SHELL_OSX: 'shell.osx',
  SHELL_LINUX: 'shell.linux',
} as const;

// ===== 型ガード関数 =====

/**
 * BaseTerminalConfig の型ガード
 */
export function isBaseTerminalConfig(obj: unknown): obj is BaseTerminalConfig {
  return typeof obj === 'object' && obj !== null;
}

/**
 * ExtensionTerminalConfig の型ガード
 */
export function isExtensionTerminalConfig(obj: unknown): obj is ExtensionTerminalConfig {
  return (
    isBaseTerminalConfig(obj) &&
    typeof (obj as ExtensionTerminalConfig).shell === 'string' &&
    Array.isArray((obj as ExtensionTerminalConfig).shellArgs) &&
    typeof (obj as ExtensionTerminalConfig).maxTerminals === 'number'
  );
}
