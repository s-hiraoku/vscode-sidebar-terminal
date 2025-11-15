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
 * SystemConstants.tsから詳細な定数グループをエクスポート
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/226
 */
export {
  PERFORMANCE_CONSTANTS,
  TIMING_CONSTANTS,
  UI_CONSTANTS,
  COMMUNICATION_CONSTANTS,
  ERROR_CONSTANTS,
} from './SystemConstants';

// SystemConstants.tsのTERMINAL_CONSTANTSを、既存のTERMINAL_CONSTANTSに優先して使用
// 既存のTERMINAL_CONSTANTSは後方互換性のために保持
export { TERMINAL_CONSTANTS as SYSTEM_TERMINAL_CONSTANTS } from './SystemConstants';
