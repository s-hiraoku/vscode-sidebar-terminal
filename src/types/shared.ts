/**
 * 共有型定義 - 全コンポーネントで使用する基本型
 * Extension Host と WebView 間で共有される型定義
 */

// ===== Result Pattern (Issue #224) =====
// Export Result pattern types for standardized error handling
export type { Result, ErrorDetails } from './result';

export {
  ErrorCode,
  ResultError,
  success,
  failure,
  failureFromDetails,
  failureFromError,
  isSuccess,
  isFailure,
  unwrap,
  unwrapOr,
  map,
  chain,
  mapError,
  onFailure,
  onSuccess,
  fromPromise,
  tryCatch,
  all,
} from './result';

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
  readonly highlightActiveBorder?: boolean;
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
  readonly highlightActiveBorder?: boolean;
  // Addon configuration for WebView terminal rendering
  readonly enableGpuAcceleration?: boolean;
  readonly enableSearchAddon?: boolean;
  readonly enableUnicode11?: boolean;
  // Font settings sent from Extension to WebView
  readonly fontSettings?: WebViewFontSettings;
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
  highlightActiveBorder?: boolean;
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
 * WebView settings payload sent via 'settingsResponse' command
 * Used by TerminalEventCoordinator for configuration change notifications
 * 🔧 FIX: Added for type safety - replaces Record<string, unknown>
 */
export interface WebViewSettingsPayload {
  readonly cursorBlink: boolean;
  readonly theme: string;
  readonly altClickMovesCursor: boolean;
  readonly multiCursorModifier: string;
  readonly enableCliAgentIntegration: boolean;
  readonly highlightActiveBorder: boolean;
  readonly dynamicSplitDirection: boolean;
  readonly panelLocation: 'auto' | 'sidebar' | 'panel';
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
  HIGHLIGHT_ACTIVE_BORDER: 'highlightActiveBorder',
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
/**
 * Terminal process states based on VS Code's implementation
 * Improves process lifecycle tracking and error handling
 */
export enum ProcessState {
  /** Process has not yet been initialized */
  Uninitialized = 0,
  /** Process is currently starting up */
  Launching = 1,
  /** Process is executing normally */
  Running = 2,
  /** Process terminated prematurely during launch */
  KilledDuringLaunch = 3,
  /** Process was explicitly terminated by the user */
  KilledByUser = 4,
  /** Process terminated on its own */
  KilledByProcess = 5,
}

/**
 * Terminal interaction state for persistent processes
 */
export enum InteractionState {
  /** No interaction */
  None = 0,
  /** Replay only mode */
  ReplayOnly = 1,
  /** Session interaction mode */
  Session = 2,
}

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

  // プロセス状態管理（VS Code準拠）
  processState?: ProcessState; // プロセスの現在の状態
  interactionState?: InteractionState; // インタラクション状態
  persistentProcessId?: string; // 永続プロセスID
  shouldPersist?: boolean; // プロセスを永続化するかどうか

  // セッション復元関連のプロパティ
  isSessionRestored?: boolean; // セッション復元で作成されたターミナルかどうか
  sessionRestoreMessage?: string; // 復元メッセージ
  sessionScrollback?: string[]; // 復元時の履歴データ
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
    | 'startOutput'
    | 'clear'
    | 'exit'
    | 'split'
    | 'terminalCreated'
    | 'newTerminal'
    | 'terminalRemoved'
    | 'settingsResponse'
    | 'fontSettingsUpdate'
    | 'openSettings'
    | 'openTerminalLink'
    | 'reorderTerminals'
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
    | 'pushScrollbackData'
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
    | 'relayoutTerminals' // Terminal relayout command
    | 'deleteTerminalResponse' // 🎯 FIX: 削除処理統一化で追加
    | 'copyToClipboard' // 📋 Clipboard: Copy text to system clipboard
    | 'requestClipboardContent' // 📋 Clipboard: Request clipboard content for paste
    | 'switchAiAgentResponse' // AIエージェント切り替えレスポンス
    | 'phase8ServicesReady' // Phase 8: Terminal Decorations & Links service ready notification
    | 'htmlScriptTest' // HTML script test message
    | 'webviewReady' // WebView ready notification
    | 'ready' // General ready notification
    | 'createTerminal' // Create terminal request
    | 'splitTerminal' // Split terminal request
    | 'updateSettings' // Update settings request
    | 'terminalClosed' // Terminal closed notification
    | 'customEvent' // Custom event for extensibility
    | 'error'
    // Terminal Profile commands
    | 'getProfiles' // Get available terminal profiles
    | 'profilesResponse' // Response with available profiles
    | 'createTerminalWithProfile' // Create terminal with specific profile
    | 'showProfileSelector' // Show profile selector UI
    | 'selectProfile' // Profile selected from UI
    | 'createProfile' // Create new profile
    | 'updateProfile' // Update existing profile
    | 'deleteProfile' // Delete profile
    | 'setDefaultProfile' // Set default profile
    | 'find' // Terminal search functionality
    | 'requestTerminalSerialization' // Request terminal serialization
    | 'terminalSerializationResponse' // Terminal serialization response
    | 'restoreTerminalSerialization' // Restore terminal serialization
    | 'terminalSerializationRestoreResponse' // Terminal serialization restore response
    // New optimized persistence commands
    | 'persistenceSaveSession' // Save current session
    | 'persistenceSaveSessionResponse' // Save session response
    | 'persistenceRestoreSession' // Restore last session
    | 'persistenceRestoreSessionResponse' // Restore session response
    | 'persistenceClearSession' // Clear stored session
    | 'persistenceClearSessionResponse' // Clear session response
    | 'sessionRestored' // Session restored notification
    | 'sessionAutoSave' // Auto-save trigger
    | 'sessionAutoSaveResponse' // Auto-save response
    | 'errorResponse' // Error response
    | 'terminalSerializationRequest' // Terminal serialization request
    | 'terminalSerializationRestoreRequest' // Terminal serialization restore request
    | 'terminalRestoreInfo' // Terminal restore info
    | 'resizeResponse' // Resize operation response
    | 'terminalRestoreInfoResponse' // Terminal restore info response
    | 'initResponse' // Init operation response
    | 'initializationComplete' // Initialization complete notification
    | 'setActiveTerminal' // Set active terminal command
    | 'versionInfo' // Version information from Extension to WebView
    | 'inputResponse' // Input operation response
    | 'outputResponse' // Output operation response
    | 'clearResponse' // Clear operation response
    | 'splitResponse' // Split operation response
    | 'killTerminalResponse' // Kill terminal response
    | 'focusTerminalResponse' // Focus terminal response
    | 'switchAiAgentResponseResponse' // Switch AI agent response (double response for backwards compatibility)
    | 'deleteTerminalResponseResponse' // Delete terminal response (double response for backwards compatibility)
    | 'sessionAutoSaveResponseResponse' // Session auto save response (double response for backwards compatibility)
    | 'terminalRestoreInfoResponseResponse' // Terminal restore info response (double response for backwards compatibility)
    | 'exitResponse' // Exit operation response
    | 'terminalCreatedResponse' // Terminal created response
    | 'terminalRemovedResponse' // Terminal removed response
    | 'stateUpdateResponse' // State update response
    | 'getScrollbackResponse' // Get scrollback response
    | 'restoreScrollbackResponse' // Restore scrollback response
    | 'scrollbackExtractedResponse' // Scrollback extracted response
    | 'scrollbackRestoredResponse' // Scrollback restored response
    | 'scrollbackProgressResponse' // Scrollback progress response
    | 'saveAllTerminalSessionsResponse' // Save all terminal sessions response
    | 'extractScrollbackDataResponse' // Extract scrollback data response
    | 'performScrollbackRestoreResponse' // Perform scrollback restore response
    | 'scrollbackDataCollectedResponse' // Scrollback data collected response
    | 'panelLocationUpdateResponse' // Panel location update response
    | 'requestPanelLocationDetectionResponse' // Request panel location detection response
    | 'reportPanelLocationResponse' // Report panel location response
    | 'sessionRestorationDataResponse' // Session restoration data response
    | 'requestInitialTerminalResponse' // Request initial terminal response
    | 'requestStateResponse' // Request state response
    | 'updateShellStatusResponse' // Update shell status response
    | 'updateCwdResponse' // Update CWD response
    | 'commandHistoryResponse' // Command history response
    // Additional commands for WebView initialization
    | 'webviewInitialized' // WebView initialization complete
    | 'terminalInitializationComplete' // Terminal initialization complete
    | 'terminalReady'; // Terminal ready for use
  config?: Partial<TerminalConfig>; // Allow partial config with fontSettings only
  data?: string | any[]; // Support both string and array data
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
  linkType?: 'file' | 'url';
  url?: string;
  filePath?: string;
  lineNumber?: number;
  columnNumber?: number;
  order?: string[];
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

  // Persistence-related properties
  terminalIds?: string[]; // Array of terminal IDs
  terminalData?: any; // Terminal data for persistence

  // 🎯 FIX: 削除処理統一化で追加
  success?: boolean; // 削除処理の成功/失敗

  // Additional WebView message properties
  terminal?: any; // Terminal object for responses
  scrollback?: any; // Scrollback data for terminal restore
  totalCount?: number; // Total count for terminal operations

  // Custom event properties
  eventType?: string; // Custom event type for extensibility
  eventData?: unknown; // Custom event data
  // reason?: string; // 失敗理由 - 重複のためコメント化（上部のreasonを使用）

  // Message ID for response tracking
  messageId?: string; // Unique message identifier for request-response correlation

  // AIエージェント切り替え関連プロパティ
  action?: string; // switchAiAgentコマンドのアクション
  newStatus?: 'connected' | 'disconnected' | 'none'; // AIエージェントの新しいステータス
  agentType?: string | null; // エージェントタイプ

  // 📋 Clipboard operation properties
  text?: string; // Text content for clipboard operations

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
  version?: string; // Extension version information
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
    | 'terminalSerializationRestoreResponse'
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

// ===== Parameter Object Pattern Interfaces (Issue #225) =====

/**
 * Terminal initialization options (Parameter Object Pattern)
 * Replaces multiple parameters in initializeShellForTerminal
 * @see TerminalManager.initializeShellForTerminal
 */
export interface TerminalInitOptions {
  /** Terminal ID to initialize */
  readonly terminalId: string;
  /** PTY process instance */
  readonly ptyProcess: any;
  /** Whether to run in safe mode (skip shell integration) */
  readonly safeMode: boolean;
}

/**
 * Terminal creation options (Parameter Object Pattern)
 * Consolidates parameters for terminal creation functions
 * @see createTerminal functions across multiple managers
 */
export interface TerminalCreationOptions {
  /** Terminal ID */
  readonly terminalId: string;
  /** Terminal name */
  readonly terminalName: string;
  /** Optional terminal configuration */
  readonly config?: PartialTerminalSettings;
  /** Terminal number (slot) */
  readonly terminalNumber?: number;
  /** Source of the creation request */
  readonly requestSource?: 'header' | 'panel' | 'command' | 'user';
}

/**
 * Terminal interaction event options (Parameter Object Pattern)
 * Consolidates parameters for emitting terminal interaction events
 * @see emitTerminalInteractionEvent functions
 */
export interface TerminalInteractionEventOptions {
  /** Type of terminal event */
  readonly type: string;
  /** Terminal ID */
  readonly terminalId: string;
  /** Event data */
  readonly data: any;
  /** Message coordinator instance */
  readonly coordinator?: any;
  /** Event context (for SystemMessageHandler) */
  readonly context?: any;
  /** Event priority (for UnifiedMessageDispatcher) */
  readonly priority?: 'high' | 'normal' | 'low';
}

/**
 * Terminal resize options (Parameter Object Pattern)
 * Consolidates parameters for terminal resize operations
 * @see sendResize, debouncedResize functions
 */
export interface TerminalResizeOptions {
  /** Number of columns */
  readonly cols: number;
  /** Number of rows */
  readonly rows: number;
  /** Optional terminal ID (defaults to active terminal) */
  readonly terminalId?: string;
  /** Message coordinator instance */
  readonly coordinator?: any;
  /** Event priority (for UnifiedMessageDispatcher) */
  readonly priority?: 'high' | 'normal' | 'low';
  /** Terminal instance (for debouncedResize) */
  readonly terminal?: any;
  /** Fit addon instance (for debouncedResize) */
  readonly fitAddon?: any;
}

/**
 * Terminal persistence add options (Parameter Object Pattern)
 * Consolidates parameters for adding terminal to persistence
 * @see addTerminal in persistence services
 */
export interface TerminalPersistenceAddOptions {
  /** Terminal ID */
  readonly terminalId: string;
  /** Terminal instance */
  readonly terminal: any;
  /** Serialize addon for xterm */
  readonly serializeAddon: any;
  /** Additional options */
  readonly options?: {
    readonly force?: boolean;
    readonly skipValidation?: boolean;
  };
}

/**
 * Configuration update options (Parameter Object Pattern)
 * Consolidates parameters for configuration updates
 * @see update method in configuration services
 */
export interface ConfigurationUpdateOptions {
  /** Configuration section (e.g., 'secondaryTerminal') */
  readonly section: string;
  /** Configuration key */
  readonly key: string;
  /** New value */
  readonly value: any;
  /** Configuration target scope */
  readonly target?: any;
}

/**
 * Event handler registration options (Parameter Object Pattern)
 * Consolidates parameters for event handler registration
 * @see registerEventHandler, addEventListener functions
 */
export interface EventHandlerRegistrationOptions {
  /** Unique identifier for this handler */
  readonly id?: string;
  /** DOM element or event target */
  readonly element: EventTarget | HTMLElement;
  /** Event type (e.g., 'click', 'keydown') */
  readonly eventType: string;
  /** Event handler function */
  readonly handler: EventListener | ((event: Event) => void);
  /** Event listener options */
  readonly options?: AddEventListenerOptions | boolean;
  /** Enable debouncing for this event */
  readonly enableDebounce?: boolean;
  /** Debounce delay in milliseconds */
  readonly debounceDelay?: number;
}

/**
 * Terminal link opening options (Parameter Object Pattern)
 * Consolidates parameters for opening files from terminal links
 * @see openFileFromTerminal in TerminalLinkManager
 */
export interface TerminalLinkOpenOptions {
  /** File path to open */
  readonly filePath: string;
  /** Line number to navigate to */
  readonly lineNumber?: number;
  /** Column number to navigate to */
  readonly columnNumber?: number;
  /** Terminal ID where link was clicked */
  readonly terminalId: string;
}

/**
 * Rendering optimizer setup options (Parameter Object Pattern)
 * Consolidates parameters for setting up rendering optimizations
 * @see setupOptimizedResize, setupRenderingOptimizer functions
 */
export interface RenderingOptimizerOptions {
  /** Terminal ID */
  readonly terminalId: string;
  /** XTerm terminal instance */
  readonly terminal: any;
  /** Fit addon instance */
  readonly fitAddon: any;
  /** Container element */
  readonly container: HTMLElement;
  /** Enable GPU acceleration */
  readonly enableGpuAcceleration?: boolean;
}

/**
 * Status update options (Parameter Object Pattern)
 * Consolidates parameters for CLI Agent status updates
 * @see sendStatusUpdate in CliAgentWebViewService
 */
export interface CliAgentStatusUpdateOptions {
  /** Active terminal name */
  readonly activeTerminalName: string;
  /** Agent status */
  readonly status: 'connected' | 'disconnected' | 'none';
  /** Agent type */
  readonly agentType: string | null;
  /** Status update context */
  readonly context?: any;
}

// ===== 型ガード関数 =====

/**
 * BaseTerminalConfig の型ガード
 */
export function isBaseTerminalConfig(obj: unknown): obj is BaseTerminalConfig {
  return typeof obj === 'object' && obj !== null;
}
