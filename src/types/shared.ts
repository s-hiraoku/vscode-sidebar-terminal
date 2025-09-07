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

/**
 * キーバインディング関連設定
 */
export interface KeybindingConfig {
  readonly sendKeybindingsToShell?: boolean;
  readonly commandsToSkipShell?: string[];
  readonly allowChords?: boolean;
  readonly allowMnemonics?: boolean;
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
  readonly cursor?: {
    style?: 'block' | 'underline' | 'bar';
    blink?: boolean;
  };
  readonly enableCliAgentIntegration?: boolean;
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
  // VS Code keybinding system settings
  sendKeybindingsToShell?: boolean;
  commandsToSkipShell?: string[];
  allowChords?: boolean;
  allowMnemonics?: boolean;
  shell?: string;
  shellArgs?: string[];
  cwd?: string;
  defaultDirectory?: string;
  maxTerminals?: number;
  cursor?: {
    style?: 'block' | 'underline' | 'bar';
    blink?: boolean;
  };
  // 🆕 Issue #148: Dynamic split direction settings
  dynamicSplitDirection?: boolean;
  panelLocation?: 'auto' | 'sidebar' | 'panel';
  // 🆕 Phase 5: Terminal Profiles System settings
  profilesWindows?: Record<string, TerminalProfile | null>;
  profilesLinux?: Record<string, TerminalProfile | null>;
  profilesOsx?: Record<string, TerminalProfile | null>;
  defaultProfileWindows?: string | null;
  defaultProfileLinux?: string | null;
  defaultProfileOsx?: string | null;
  inheritVSCodeProfiles?: boolean;
  enableProfileAutoDetection?: boolean;
}

/**
 * WebView用フォント設定値
 * 設定変更ではなく、現在の値を受信するためのインターフェース
 */
export interface WebViewFontSettings {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontWeightBold?: string;
  lineHeight?: number;
  letterSpacing?: number;
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

// ===== Terminal Profile System Types =====

/**
 * Platform types for VS Code terminal profiles
 */
export type TerminalPlatform = 'windows' | 'linux' | 'osx';

/**
 * Shell profile configuration for VS Code standard compliance
 * Based on VS Code's ITerminalProfile interface
 */
export interface TerminalProfile {
  /** Path to the shell executable */
  path: string;
  /** Arguments to pass to the shell */
  args?: string[];
  /** Override the shell's default working directory */
  cwd?: string;
  /** Environment variables to add to the shell session */
  env?: Record<string, string | null>;
  /** Icon identifier for this profile */
  icon?: string;
  /** Color identifier for this profile */
  color?: string;
  /** Whether this profile should be visible in the terminal dropdown */
  isVisible?: boolean;
  /** Override the args when the profile is contributed by an extension */
  overrideName?: boolean;
  /** Whether to use color in the terminal */
  useColor?: boolean;
}

/**
 * Platform-specific terminal profiles collection
 * Follows VS Code's terminal.integrated.profiles.* pattern
 */
export interface PlatformTerminalProfiles {
  /** Windows terminal profiles */
  windows: Record<string, TerminalProfile | null>;
  /** Linux terminal profiles */
  linux: Record<string, TerminalProfile | null>;
  /** macOS terminal profiles */
  osx: Record<string, TerminalProfile | null>;
}

/**
 * Default profile settings for each platform
 * Follows VS Code's terminal.integrated.defaultProfile.* pattern
 */
export interface DefaultProfileSettings {
  /** Default Windows terminal profile */
  windows: string | null;
  /** Default Linux terminal profile */
  linux: string | null;
  /** Default macOS terminal profile */
  osx: string | null;
}

/**
 * Auto-detection settings for terminal profiles
 */
export interface ProfileAutoDetectionSettings {
  /** Enable automatic profile detection */
  enabled: boolean;
  /** Paths to search for shell executables */
  searchPaths: string[];
  /** Cache detected profiles */
  useCache: boolean;
  /** Cache expiration time in milliseconds */
  cacheExpiration: number;
}

/**
 * Complete terminal profile system configuration
 * Integrates all profile-related settings
 */
export interface TerminalProfilesConfig {
  /** Platform-specific profile definitions */
  profiles: PlatformTerminalProfiles;
  /** Default profiles for each platform */
  defaultProfiles: DefaultProfileSettings;
  /** Auto-detection configuration */
  autoDetection: ProfileAutoDetectionSettings;
  /** Whether to inherit VS Code's terminal profiles */
  inheritVSCodeProfiles: boolean;
}

/**
 * Profile selection result
 * Used when resolving which profile to use for new terminals
 */
export interface ProfileSelectionResult {
  /** Selected profile configuration */
  profile: TerminalProfile;
  /** Name/key of the selected profile */
  profileName: string;
  /** Platform for which the profile was selected */
  platform: TerminalPlatform;
  /** Whether this was the default profile */
  isDefault: boolean;
  /** Selection source (user, default, auto-detected) */
  source: 'user' | 'default' | 'auto-detected';
}

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

  // 🆕 Phase 5: Terminal Profile System keys
  PROFILES_WINDOWS: 'profiles.windows',
  PROFILES_LINUX: 'profiles.linux',
  PROFILES_OSX: 'profiles.osx',
  DEFAULT_PROFILE_WINDOWS: 'defaultProfile.windows',
  DEFAULT_PROFILE_LINUX: 'defaultProfile.linux',
  DEFAULT_PROFILE_OSX: 'defaultProfile.osx',
  INHERIT_VSCODE_PROFILES: 'inheritVSCodeProfiles',
  ENABLE_PROFILE_AUTO_DETECTION: 'enableProfileAutoDetection',
} as const;

// ===== ターミナル管理型 =====

/**
 * ターミナル情報
 */
export interface TerminalInfo {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * ターミナル状態管理
 */
export interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  maxTerminals: number;
  availableSlots: number[];
}

/**
 * ターミナル削除結果
 */
export interface DeleteResult {
  success: boolean;
  reason?: string;
  newState?: TerminalState;
}

/**
 * ターミナルインスタンス
 */
export interface TerminalInstance {
  id: string;
  pty?: import('@homebridge/node-pty-prebuilt-multiarch').IPty; // Properly typed node-pty interface
  ptyProcess?: import('@homebridge/node-pty-prebuilt-multiarch').IPty; // 新しいpty参照名（セッション復元対応）
  process?: NodeJS.Process; // For lifecycle service compatibility
  name: string;
  number?: number; // ターミナル番号（1-5）
  cwd?: string; // 現在の作業ディレクトリ
  shell?: string; // Shell path
  shellArgs?: string[]; // Shell arguments
  pid?: number; // Process ID
  isActive: boolean;
  createdAt?: Date; // 作成日時

  // セッション復元関連のプロパティ
  isSessionRestored?: boolean; // セッション復元で作成されたターミナルかどうか
  sessionRestoreMessage?: string; // 復元メッセージ
  sessionScrollback?: string[]; // 復元時の履歴データ
}

/**
 * ターミナル寸法
 */
export interface TerminalDimensions {
  cols: number;
  rows: number;
}

/**
 * ターミナルイベント
 */
export interface TerminalEvent {
  terminalId: string;
  data?: string;
  exitCode?: number;
  timestamp?: number;
  terminalName?: string;
  wasManuallyKilled?: boolean; // Indicates if the terminal was killed manually vs naturally exited
}

/**
 * Alt+Click状態
 */
export interface AltClickState {
  isVSCodeAltClickEnabled: boolean;
  isAltKeyPressed: boolean;
}

/**
 * ターミナル操作イベント
 */
export interface TerminalInteractionEvent {
  type:
    | 'alt-click'
    | 'alt-click-blocked'
    | 'output-detected'
    | 'focus'
    | 'switch-next'
    | 'switch-previous'
    | 'webview-ready'
    | 'terminal-removed'
    | 'font-settings-update'
    | 'settings-update'
    | 'new-terminal'
    | 'create-terminal'
    | 'split-terminal'
    | 'kill-terminal'
    | 'clear-terminal'
    | 'toggle-terminal'
    | 'resize'
    | 'kill'
    | 'interrupt'
    | 'paste'
    | 'send-key';
  terminalId: string;
  timestamp: number;
  data?: unknown;
}

// ===== メッセージ通信型 =====

/**
 * WebView からExtension Host へのメッセージ
 */
export interface WebviewMessage {
  command:
    | 'init'
    | 'input'
    | 'resize'
    | 'output'
    | 'clear'
    | 'exit'
    | 'split'
    | 'terminalCreated'
    | 'terminalRemoved'
    | 'settingsResponse'
    | 'fontSettingsUpdate'
    | 'openSettings'
    | 'stateUpdate'
    | 'claudeStatusUpdate'
    | 'cliAgentStatusUpdate'
    | 'cliAgentFullStateSync'
    | 'killTerminal'
    | 'deleteTerminal'
    | 'getSettings'
    | 'altClickSettings'
    | 'focusTerminal'
    | 'switchAiAgent'
    | 'test'
    | 'timeoutTest'
    | 'sessionRestore'
    | 'sessionRestoreStarted'
    | 'sessionRestoreProgress'
    | 'sessionRestoreCompleted'
    | 'sessionRestoreError'
    | 'sessionRestoreSkipped'
    | 'sessionSaved'
    | 'sessionSaveError'
    | 'sessionCleared'
    | 'terminalRestoreError'
    | 'getScrollback'
    | 'restoreScrollback'
    | 'scrollbackExtracted'
    | 'scrollbackRestored'
    | 'scrollbackProgress'
    | 'saveAllTerminalSessions'
    | 'extractScrollbackData'
    | 'performScrollbackRestore'
    | 'scrollbackDataCollected'
    | 'panelLocationUpdate'
    | 'requestPanelLocationDetection'
    | 'reportPanelLocation'
    | 'sessionRestorationData'
    | 'requestInitialTerminal'
    | 'requestState'
    | 'updateShellStatus'
    | 'updateCwd'
    | 'commandHistory'
    | 'deleteTerminalResponse'  // 🎯 FIX: 削除処理統一化で追加
    | 'switchAiAgentResponse'  // AIエージェント切り替えレスポンス
    | 'phase8ServicesReady'   // Phase 8: Terminal Decorations & Links service ready notification
    | 'htmlScriptTest'        // HTML script test message
    | 'webviewReady'          // WebView ready notification
    | 'ready'                 // General ready notification
    | 'createTerminal'        // Create terminal request
    | 'splitTerminal'         // Split terminal request
    | 'updateSettings'        // Update settings request
    | 'terminalClosed'        // Terminal closed notification
    | 'customEvent'           // Custom event for extensibility
    | 'error'
    // Terminal Profile commands
    | 'getProfiles'           // Get available terminal profiles
    | 'profilesResponse'      // Response with available profiles
    | 'createTerminalWithProfile' // Create terminal with specific profile
    | 'showProfileSelector'   // Show profile selector UI
    | 'selectProfile'         // Profile selected from UI
    | 'createProfile'         // Create new profile
    | 'updateProfile'         // Update existing profile
    | 'deleteProfile'         // Delete profile
    | 'setDefaultProfile'     // Set default profile
    | 'find';                 // Terminal search functionality
  config?: TerminalConfig;
  data?: string;
  exitCode?: number;
  terminalId?: string;
  terminalName?: string;
  terminalNumber?: number; // ターミナル番号（1-5）- Extension → WebView 通信用
  
  // Shell Integration properties
  status?: string;
  cwd?: string;
  history?: Array<{ command: string; exitCode?: number; duration?: number }>;
  
  // Phase 8: Advanced Terminal Features
  capabilities?: {
    decorations?: boolean;
    links?: boolean;
    navigation?: boolean;
    accessibility?: boolean;
  };

  // ターミナル情報（復元用）
  terminalInfo?: {
    originalId: string;
    name: string;
    number: number;
    cwd: string;
    isActive: boolean;
  };
  // Session management properties
  terminalCount?: number;
  restored?: number;
  total?: number;
  restoredCount?: number;
  skippedCount?: number;
  error?: string;
  partialSuccess?: boolean;
  reason?: string;
  terminals?: TerminalInfo[];
  activeTerminalId?: string;
  settings?: PartialTerminalSettings; // 部分的な設定を受け取るよう修正
  fontSettings?: WebViewFontSettings; // フォント設定を受け取る
  state?: TerminalState; // 新しいアーキテクチャ用の状態更新
  claudeStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  }; // CLI Agent接続状態の情報
  cliAgentStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
    terminalId?: string; // 🛠️ FIX: Add terminalId for reliable status updates
  }; // CLI Agent接続状態の情報（新しい名前）
  
  forceReconnect?: boolean; // Force reconnect flag for CLI Agent switching

  // 🔧 NEW: Full CLI Agent State Sync
  terminalStates?: Record<
    string,
    {
      status: 'connected' | 'disconnected' | 'none';
      agentType: string | null;
      terminalName: string;
    }
  >;
  connectedAgentId?: string | null;
  connectedAgentType?: string | null;
  disconnectedCount?: number;

  cols?: number; // リサイズ用
  rows?: number; // リサイズ用
  requestSource?: 'header' | 'panel'; // 削除リクエストの送信元
  timestamp?: number; // エラー報告用
  type?: string; // For test messages and error reporting
  message?: string; // エラー報告用
  context?: string; // エラー報告用
  stack?: string; // エラー報告用

  // Panel location for dynamic split direction (Issue #148)
  location?: 'sidebar' | 'panel'; // Panel location information
  direction?: 'horizontal' | 'vertical'; // Split direction for terminal splitting

  // セッション復元関連
  sessionRestoreMessage?: string; // 復元メッセージ
  sessionScrollback?: string[]; // 復元する履歴データ
  scrollbackLines?: number; // 取得する履歴行数
  scrollbackData?: string[]; // 取得された履歴データ
  errorType?: string; // エラータイプ (file, corruption, permission, network, unknown)
  recoveryAction?: string; // 回復処理の説明
  requestId?: string; // リクエストID（応答待機用）

  // Scrollback復元関連
  scrollbackContent?:
    | Array<{
        content: string;
        type?: 'output' | 'input' | 'error';
        timestamp?: number;
      }>
    | string[]; // 復元するscrollback内容

  // WebView側のコマンド名拡張（重複削除）
  scrollbackProgress?: {
    terminalId: string;
    progress: number;
    currentLines: number;
    totalLines: number;
    stage: 'loading' | 'decompressing' | 'restoring';
  }; // scrollback復元の進捗
  maxLines?: number; // 取得する最大行数
  useCompression?: boolean; // 圧縮を使用するか
  cursorPosition?: {
    x: number;
    y: number;
  }; // カーソル位置

  // セッション関連の追加プロパティ
  sessionData?: unknown; // セッションデータ
  
  // 🎯 FIX: 削除処理統一化で追加
  success?: boolean;  // 削除処理の成功/失敗

  // Custom event properties
  eventType?: string;  // Custom event type for extensibility
  eventData?: unknown; // Custom event data
  // reason?: string; // 失敗理由 - 重複のためコメント化（上部のreasonを使用）

  // AIエージェント切り替え関連プロパティ
  action?: string; // switchAiAgentコマンドのアクション
  newStatus?: 'connected' | 'disconnected' | 'none'; // AIエージェントの新しいステータス
  agentType?: string | null; // エージェントタイプ

  // Terminal Profile properties
  profiles?: Array<{
    id: string;
    name: string;
    description?: string;
    icon?: string;
    path: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    color?: string;
    isDefault?: boolean;
    source?: 'builtin' | 'user' | 'extension';
  }>; // Available terminal profiles
  profileId?: string; // Selected profile ID
  profile?: {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    path: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    color?: string;
    isDefault?: boolean;
    source?: 'builtin' | 'user' | 'extension';
  }; // Profile data for create/update operations
  profileOptions?: {
    name?: string;
    cwd?: string;
    env?: Record<string, string>;
    shellArgs?: string[];
  }; // Profile options for terminal creation
}

/**
 * Extension Host からWebView へのメッセージ
 */
export interface VsCodeMessage {
  command:
    | 'ready'
    | 'webviewReady'
    | 'htmlScriptTest'
    | 'timeoutTest'
    | 'test'
    | 'input'
    | 'resize'
    | 'focusTerminal'
    | 'createTerminal'
    | 'splitTerminal'
    | 'clear'
    | 'getSettings'
    | 'updateSettings'
    | 'terminalClosed'
    | 'switchAiAgent'
    | 'terminalInteraction'
    | 'killTerminal'
    | 'deleteTerminal'
    | 'requestStateRestoration'
    | 'getScrollbackData'
    | 'extractScrollback'
    | 'restoreScrollbackData'
    | 'scrollbackExtracted'
    | 'getTerminalScrollbackData'
    | 'extractScrollbackData'
    | 'performScrollbackRestore'
    | 'restoreTerminalScrollback'
    | 'scrollbackDataCollected'
    | 'reportPanelLocation'
    | 'terminalSerializationResponse'
    | 'requestSessionRestorationData'
    | 'requestInitialTerminal'
    | 'error';
  data?: string;
  cols?: number;
  rows?: number;
  terminalId?: string;
  terminalName?: string; // ターミナル名
  type?: TerminalInteractionEvent['type'];
  settings?: PartialTerminalSettings; // 部分的な設定を送信するよう修正
  requestSource?: 'header' | 'panel'; // 新しいアーキテクチャ用の削除要求元
  timestamp?: number; // エラー報告用
  message?: string; // エラー報告用
  context?: string; // エラー報告用
  stack?: string; // エラー報告用

  // ターミナル復元関連
  terminalInfo?: {
    originalId: string;
    name: string;
    number: number;
    cwd: string;
    isActive: boolean;
  };

  // セッション復元関連
  scrollbackLines?: number; // 取得する履歴行数
  scrollbackData?: string[]; // 履歴データ
  maxLines?: number; // 取得する最大行数
  scrollbackContent?: Array<{
    content: string;
    type?: 'output' | 'input' | 'error';
    timestamp?: number;
  }>; // 復元するscrollback内容
  requestId?: string; // リクエストID（応答待機用）

  // セッション関連の追加プロパティ
  serializedData?: Record<string, string>; // シリアライズされたデータ
  terminalCount?: number; // ターミナル数
  sessionData?: unknown; // セッションデータ

  // 🆕 Panel location (Issue #148)
  location?: 'sidebar' | 'panel'; // パネル位置情報

  // AIエージェント切り替え関連プロパティ
  action?: string; // switchAiAgentコマンドのアクション
  forceReconnect?: boolean; // Manual reset functionality
  agentType?: 'claude' | 'gemini' | 'codex'; // Agent type for force reconnect
  isForceReconnect?: boolean; // Alternative property name for compatibility
}

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
