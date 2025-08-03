/**
 * Unified Application Constants
 * Centralized constants to eliminate duplication across the codebase
 */

// Terminal-related constants
export const TERMINAL_CONSTANTS = {
  // Default values
  DEFAULT_MAX_TERMINALS: 5,
  DEFAULT_COLS: 80,
  DEFAULT_ROWS: 30,

  // Terminal settings
  TERMINAL_NAME_PREFIX: 'Terminal',
  SCROLLBACK_LINES: 10000,

  // Timing and delays
  TERMINAL_REMOVE_DELAY: 2000,
  NONCE_LENGTH: 32,

  // Platform-specific
  PLATFORMS: {
    WINDOWS: 'win32',
    DARWIN: 'darwin',
    LINUX: 'linux',
  } as const,

  // Configuration keys
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

  // WebView specific timing
  DELAYS: {
    TERMINAL_REMOVE_DELAY: 2000,
    BUFFER_FLUSH_INTERVAL: 16,
    RESIZE_DEBOUNCE_DELAY: 150,
    STATUS_HIDE_DELAY: 3000,
    ERROR_STATUS_DELAY: 5000,
    HOVER_STATUS_DELAY: 1000,
    FADE_DURATION: 200,
  },

  // UI sizing constants
  SIZES: {
    MIN_TERMINAL_HEIGHT: 100,
    STATUS_BAR_HEIGHT: 24,
    HEADER_HEIGHT: 36,
    TERMINAL_HEADER_HEIGHT: 32,
    SPLITTER_HEIGHT: 4,
    MIN_CONTAINER_WIDTH: 200,
    MIN_CONTAINER_HEIGHT: 100,
  },

  // Terminal number recycling
  NUMBER_RECYCLING: {
    ENABLED: true,
    MIN_NUMBER: 1,
    MAX_NUMBER: 5,
  } as const,

  // State management
  STATE_MANAGEMENT: {
    SYNC_INTERVAL: 1000,
    MAX_RETRY_ATTEMPTS: 3,
  } as const,

  // Events
  EVENTS: {
    DATA: 'data',
    EXIT: 'exit',
    RESIZE: 'resize',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
  } as const,

  // Commands for extension <-> webview communication
  COMMANDS: {
    READY: 'ready',
    INIT: 'init',
    INPUT: 'input',
    OUTPUT: 'output',
    RESIZE: 'resize',
    CLEAR: 'clear',
    EXIT: 'exit',
    SPLIT: 'split',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
    FOCUS_TERMINAL: 'focusTerminal',
    GET_SETTINGS: 'getSettings',
    UPDATE_SETTINGS: 'updateSettings',
    SETTINGS_RESPONSE: 'settingsResponse',
    TERMINAL_CLOSED: 'terminalClosed',
    KILL_TERMINAL: 'killTerminal',
    DELETE_TERMINAL: 'deleteTerminal',
    STATE_UPDATE: 'stateUpdate',
  } as const,
} as const;

// Theme constants
export const THEME_CONSTANTS = {
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
  },
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
  },
} as const;

// CLI Agent constants
export const CLI_AGENT_CONSTANTS = {
  AGENTS: {
    CLAUDE: {
      NAME: 'Claude Code',
      COMMAND_PATTERN: /claude-code\s+"/,
      COMPLETION_PATTERN: /Claude Code task completed successfully/,
    },
    GEMINI: {
      NAME: 'Gemini Code',
      COMMAND_PATTERN: /gemini\s+code\s+"/,
      COMPLETION_PATTERN: /Gemini Code task completed successfully/,
    },
  } as const,
  DETECTION: {
    PATTERNS: {
      CLAUDE_COMMAND: /claude-code\s+"/,
      GEMINI_COMMAND: /gemini\s+code\s+"/,
      CLAUDE_COMPLETION: /Claude Code task completed successfully/,
      GEMINI_COMPLETION: /Gemini Code task completed successfully/,
    },
    TIMEOUTS: {
      ACTIVITY_TIMEOUT: 10000, // 10 seconds
      COMMAND_TIMEOUT: 30000, // 30 seconds
    },
  },
  OUTPUT: {
    BUFFER_SIZE: 1000,
    FLUSH_INTERVAL: 4, // 4ms for CLI Agent output
    HIGH_FREQUENCY_THRESHOLD: 500, // chars in 2 seconds
  },
} as const;

// File reference constants
export const FILE_REFERENCE_CONSTANTS = {
  PATTERNS: {
    AT_MENTION: /@([^\s]+)/g,
    LINE_RANGE: /#L(\d+)-L(\d+)$/,
    SINGLE_LINE: /#L(\d+)$/,
  },
  FORMATS: {
    CLI_AGENT: '@',
    COPILOT: '#file:',
  },
} as const;

// Notification constants
export const NOTIFICATION_CONSTANTS = {
  TYPES: {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
  } as const,
  DURATIONS: {
    SHORT: 2000,
    MEDIUM: 5000,
    LONG: 8000,
  },
  POSITIONS: {
    TOP: 'top',
    BOTTOM: 'bottom',
    CENTER: 'center',
  } as const,
} as const;

// Test constants for shared use
export const TEST_CONSTANTS = {
  TIMEOUTS: {
    UNIT_TEST: 5000,
    INTEGRATION_TEST: 10000,
    E2E_TEST: 30000,
  },
  MOCK_DATA: {
    TERMINAL_ID: 'test-terminal-1',
    PROCESS_ID: 12345,
    TITLE: 'Test Terminal',
  },
} as const;

// WebView constants
export const WEBVIEW_CONSTANTS = {
  MESSAGE_TYPES: {
    INIT: 'init',
    OUTPUT: 'output',
    INPUT: 'input',
    RESIZE: 'resize',
    CLEAR: 'clear',
    KILL_TERMINAL: 'killTerminal',
    DELETE_TERMINAL: 'deleteTerminal',
    STATE_UPDATE: 'stateUpdate',
    FOCUS_TERMINAL: 'focusTerminal',
    CREATE_TERMINAL: 'createTerminal',
  } as const,
  PERFORMANCE: {
    BUFFER_FLUSH_INTERVAL: 16, // 60fps
    DEBOUNCE_DELAY: 150,
    MAX_BUFFER_SIZE: 1000,
  } as const,
  THEMES: {
    DARK: 'dark',
    LIGHT: 'light',
    HIGH_CONTRAST: 'high-contrast',
  } as const,
  CSS_CLASSES: {
    TERMINAL_CONTAINER: 'terminal-container',
    ACTIVE_TERMINAL: 'active-terminal',
    INACTIVE_TERMINAL: 'inactive-terminal',
    NOTIFICATION: 'notification',
    HEADER: 'terminal-header',
  } as const,
} as const;
