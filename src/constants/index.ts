/**
 * Application Constants
 * Using shared constants to eliminate duplication
 */

import {
  SHARED_TERMINAL_COMMANDS,
  SHARED_DELAYS,
  SHARED_DEFAULTS,
  PLATFORMS,
} from '../shared/constants';

export const TERMINAL_CONSTANTS = {
  // Import shared defaults
  DEFAULT_MAX_TERMINALS: SHARED_DEFAULTS.MAX_TERMINALS,
  DEFAULT_COLS: SHARED_DEFAULTS.DEFAULT_COLS,
  DEFAULT_ROWS: SHARED_DEFAULTS.DEFAULT_ROWS,
  TERMINAL_NAME_PREFIX: SHARED_DEFAULTS.TERMINAL_NAME_PREFIX,
  SCROLLBACK_LINES: SHARED_DEFAULTS.SCROLLBACK_LINES,

  // Import shared timing
  TERMINAL_REMOVE_DELAY: SHARED_DELAYS.TERMINAL_REMOVE_DELAY,

  // Extension-specific
  NONCE_LENGTH: 32,

  // Import shared platforms
  PLATFORMS,

  // Extension-specific config keys
  CONFIG_KEYS: {
    SIDEBAR_TERMINAL: 'secondaryTerminal',
    TERMINAL_INTEGRATED: 'terminal.integrated',
    MAX_TERMINALS: 'maxTerminals',
    SHELL: 'shell',
    SHELL_ARGS: 'shellArgs',
    SHELL_WINDOWS: 'shell.windows',
    SHELL_OSX: 'shell.osx',
    SHELL_LINUX: 'shell.linux',
  } as const,

  // Extension-specific events
  EVENTS: {
    DATA: 'data',
    EXIT: 'exit',
    RESIZE: 'resize',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
  } as const,

  // Import shared commands
  COMMANDS: SHARED_TERMINAL_COMMANDS,
} as const;

/**
 * WebView constants
 * Theme definitions moved to src/webview/types/theme.types.ts
 */
export const WEBVIEW_CONSTANTS = {
  // CSS variables
  CSS_VARS: {
    TAB_INACTIVE_BACKGROUND: 'var(--vscode-tab-inactiveBackground)',
    TAB_ACTIVE_BACKGROUND: 'var(--vscode-tab-activeBackground)',
    TAB_INACTIVE_FOREGROUND: 'var(--vscode-tab-inactiveForeground)',
    TAB_ACTIVE_FOREGROUND: 'var(--vscode-tab-activeForeground)',
    TAB_BORDER: 'var(--vscode-tab-border)',
    EDITOR_BACKGROUND: 'var(--vscode-editor-background)',
  } as const,
} as const;

export const ERROR_MESSAGES = {
  TERMINAL_CREATION_FAILED: 'Failed to create terminal',
  TERMINAL_CONTAINER_NOT_FOUND: 'Terminal container not found',
  MAX_TERMINALS_REACHED: 'Maximum number of terminals reached',
} as const;

/**
 * VS Code コマンド定数
 */
export const VSCODE_COMMANDS = {
  // Copilot Chat関連
  CHAT_OPEN: 'workbench.action.chat.open',
  CHAT_FOCUS_FALLBACK: 'workbench.panel.chat.view.copilot.focus',

  // Secondary Terminal関連
  SECONDARY_TERMINAL_FOCUS: 'secondaryTerminal.focus',
  SECONDARY_TERMINAL_CREATE: 'secondaryTerminal.createTerminal',
  SECONDARY_TERMINAL_KILL: 'secondaryTerminal.killTerminal',
  SECONDARY_TERMINAL_VIEW_FOCUS: 'secondaryTerminalView.focus',

  // Workbench関連
  SHOW_COMMANDS: 'workbench.action.showCommands',
  WORKBENCH_OPEN_SETTINGS: 'workbench.action.openSettings',
  WORKBENCH_RELOAD_WINDOW: 'workbench.action.reloadWindow',
} as const;

/**
 * ドメイン別定数ファイルからの詳細な定数グループをエクスポート
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/226
 *
 * リファクタリング: SystemConstants.ts を以下のドメイン別ファイルに分割
 * - PerformanceConstants.ts: パフォーマンス関連
 * - TerminalConstants.ts: ターミナル関連
 * - UIConstants.ts: UI/UX 関連
 * - CommunicationConstants.ts: 通信・メッセージング関連
 * - ErrorConstants.ts: エラーハンドリング関連
 * - TimingConstants.ts: タイミング関連
 * - ConfigCacheConstants.ts: 設定キャッシュ関連
 * - EnumConstants.ts: 列挙型定義
 */

// パフォーマンス関連定数
export { PERFORMANCE_CONSTANTS, type PerformanceConstantsType } from './PerformanceConstants';

// タイミング関連定数
export { TIMING_CONSTANTS, type TimingConstantsType } from './TimingConstants';

// UI/UX関連定数
export { UI_CONSTANTS, type UIConstantsType } from './UIConstants';

// 通信・メッセージング関連定数
export { COMMUNICATION_CONSTANTS, type CommunicationConstantsType } from './CommunicationConstants';

// エラーハンドリング関連定数
export { ERROR_CONSTANTS, type ErrorConstantsType } from './ErrorConstants';

// 設定キャッシュ関連定数
export { CONFIG_CACHE_CONSTANTS, type ConfigCacheConstantsType } from './ConfigCacheConstants';

// システムターミナル定数（詳細版）
export { TERMINAL_CONSTANTS as SYSTEM_TERMINAL_CONSTANTS, type TerminalConstantsType } from './TerminalConstants';

// 列挙型
export {
  SystemStatus,
  TerminalAction,
  MessageSeverity,
  NotificationType,
  CliAgentStatus,
  TerminalState,
  SessionOperation,
  PerformanceMetric,
  ResourceType,
  ConfigurationCategory,
} from './EnumConstants';

// 後方互換性のため SystemConstants.ts からもエクスポート
// 新しいコードでは上記のドメイン別インポートを推奨
export * from './SystemConstants';
