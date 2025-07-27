/**
 * WebView用定数定義
 */

export const WEBVIEW_TERMINAL_CONSTANTS = {
  TERMINAL_REMOVE_DELAY: 2000,
  COMMANDS: {
    READY: 'ready',
    INIT: 'init',
    INPUT: 'input',
    OUTPUT: 'output',
    RESIZE: 'resize',
    EXIT: 'exit',
    SPLIT: 'split',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
    FOCUS_TERMINAL: 'focusTerminal',
  },
};

export const SPLIT_CONSTANTS = {
  MAX_SPLIT_COUNT: 5,
  MIN_TERMINAL_HEIGHT: 100,
  BUFFER_FLUSH_INTERVAL: 16, // ~60fps
  MAX_BUFFER_SIZE: 100,
  RESIZE_DEBOUNCE_DELAY: 150,
};
