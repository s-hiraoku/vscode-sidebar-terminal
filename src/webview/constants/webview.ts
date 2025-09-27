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
  MAX_TERMINALS: 5, // Maximum number of terminals
  MIN_TERMINAL_HEIGHT: 100,
  BUFFER_FLUSH_INTERVAL: 16, // 60fps equivalent - optimized for performance while maintaining responsiveness
  MAX_BUFFER_SIZE: 50, // Reduced from 100 to 50 for faster small input processing
  RESIZE_DEBOUNCE_DELAY: 100, // Reduced from 150ms to 100ms for quicker resize response
};
