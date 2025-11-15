/**
 * WebView用定数定義
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/226
 * マジックナンバーをSystemConstantsから参照するように変更しました。
 */

import {
  TERMINAL_CONSTANTS,
  PERFORMANCE_CONSTANTS,
  TIMING_CONSTANTS,
} from '../../constants/SystemConstants';

export const WEBVIEW_TERMINAL_CONSTANTS = {
  TERMINAL_REMOVE_DELAY: TERMINAL_CONSTANTS.TERMINAL_REMOVE_DELAY_MS,
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
  MAX_SPLIT_COUNT: TERMINAL_CONSTANTS.MAX_TERMINAL_COUNT,
  MAX_TERMINALS: TERMINAL_CONSTANTS.MAX_TERMINAL_COUNT, // Maximum number of terminals
  MIN_TERMINAL_HEIGHT: TERMINAL_CONSTANTS.MIN_TERMINAL_HEIGHT_PX,
  BUFFER_FLUSH_INTERVAL: PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS, // 16ms (60fps) - optimized for performance while maintaining responsiveness
  MAX_BUFFER_SIZE: PERFORMANCE_CONSTANTS.MAX_BUFFER_CHUNK_COUNT, // 50 for faster small input processing
  RESIZE_DEBOUNCE_DELAY: TIMING_CONSTANTS.RESIZE_DEBOUNCE_DELAY_MS, // 100ms for quicker resize response
};
