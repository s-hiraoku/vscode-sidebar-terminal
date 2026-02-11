/**
 * Shared Constants
 * Constants used by both Extension and WebView to eliminate duplication
 */

/**
 * Terminal command constants (shared between Extension and WebView)
 */
export const SHARED_TERMINAL_COMMANDS = {
  READY: 'ready',
  INIT: 'init',
  INPUT: 'input',
  OUTPUT: 'output',
  START_OUTPUT: 'startOutput',
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
  CREATE_TERMINAL: 'createTerminal',
} as const;

/**
 * Shared timing constants
 */
export const SHARED_DELAYS = {
  TERMINAL_REMOVE_DELAY: 2000,
  BUFFER_FLUSH_INTERVAL: 16,
  RESIZE_DEBOUNCE_DELAY: 150,
  STATUS_HIDE_DELAY: 3000,
  ERROR_STATUS_DELAY: 5000,
  HOVER_STATUS_DELAY: 1000,
  FADE_DURATION: 200,
} as const;

/**
 * Shared size constants
 */
export const SHARED_SIZES = {
  MIN_TERMINAL_HEIGHT: 100,
  STATUS_BAR_HEIGHT: 24,
  HEADER_HEIGHT: 36,
  TERMINAL_HEADER_HEIGHT: 32,
  SPLITTER_HEIGHT: 4,
  MIN_CONTAINER_WIDTH: 200,
  MIN_CONTAINER_HEIGHT: 100,
} as const;

/**
 * Shared default values
 */
export const SHARED_DEFAULTS = {
  MAX_TERMINALS: 10,
  DEFAULT_COLS: 80,
  DEFAULT_ROWS: 30,
  SCROLLBACK_LINES: 10000,
  TERMINAL_NAME_PREFIX: 'Terminal',
} as const;

/**
 * Platform constants
 */
export const PLATFORMS = {
  WINDOWS: 'win32',
  DARWIN: 'darwin',
  LINUX: 'linux',
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];
