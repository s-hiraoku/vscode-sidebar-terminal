/**
 * アプリケーション定数
 */

export const TERMINAL_CONSTANTS = {
  // デフォルト値
  DEFAULT_MAX_TERMINALS: 5,
  DEFAULT_COLS: 80,
  DEFAULT_ROWS: 30,

  // ターミナル設定
  TERMINAL_NAME_PREFIX: 'Terminal',
  SCROLLBACK_LINES: 10000,

  // タイミング
  TERMINAL_REMOVE_DELAY: 2000,
  NONCE_LENGTH: 32,

  // プラットフォーム固有
  PLATFORMS: {
    WINDOWS: 'win32',
    DARWIN: 'darwin',
    LINUX: 'linux',
  } as const,

  // 設定キー
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

  // イベント名
  EVENTS: {
    DATA: 'data',
    EXIT: 'exit',
    RESIZE: 'resize',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
  } as const,

  // メッセージコマンド
  COMMANDS: {
    READY: 'ready',
    INIT: 'init',
    INPUT: 'input',
    OUTPUT: 'output',
    RESIZE: 'resize',
    EXIT: 'exit',
    SPLIT: 'split',
    FOCUS_TERMINAL: 'focusTerminal',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
  } as const,
} as const;

export const WEBVIEW_CONSTANTS = {
  // CSS変数
  CSS_VARS: {
    TAB_INACTIVE_BACKGROUND: 'var(--vscode-tab-inactiveBackground)',
    TAB_ACTIVE_BACKGROUND: 'var(--vscode-tab-activeBackground)',
    TAB_INACTIVE_FOREGROUND: 'var(--vscode-tab-inactiveForeground)',
    TAB_ACTIVE_FOREGROUND: 'var(--vscode-tab-activeForeground)',
    TAB_BORDER: 'var(--vscode-tab-border)',
    EDITOR_BACKGROUND: 'var(--vscode-editor-background)',
  } as const,

  // デフォルトテーマ
  DARK_THEME: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#000000',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  } as const,

  LIGHT_THEME: {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#000000',
    cursorAccent: '#ffffff',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5',
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
