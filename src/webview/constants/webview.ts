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
  UI_CONSTANTS,
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
  MAX_TERMINALS: TERMINAL_CONSTANTS.MAX_TERMINAL_COUNT,
  MIN_TERMINAL_HEIGHT: TERMINAL_CONSTANTS.MIN_TERMINAL_HEIGHT_PX,
  BUFFER_FLUSH_INTERVAL: PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS,
  MAX_BUFFER_SIZE: PERFORMANCE_CONSTANTS.MAX_BUFFER_CHUNK_COUNT,
  RESIZE_DEBOUNCE_DELAY: TIMING_CONSTANTS.RESIZE_DEBOUNCE_DELAY_MS,
};

/**
 * WebView タイミング定数
 * setTimeout/setIntervalで使用されるマジックナンバーを集約
 */
export const WEBVIEW_TIMING = {
  /** Terminal focus delay after creation (ms) */
  FOCUS_DELAY_MS: 20,
  /** Session save delay after terminal operations (ms) */
  SESSION_SAVE_DELAY_MS: 200,
  /** Split layout transition delay (ms) */
  SPLIT_LAYOUT_DELAY_MS: 150,
  /** Parent container resize debounce (ms) */
  PARENT_RESIZE_DEBOUNCE_MS: 50,
  /** Panel location refit delay (ms) */
  PANEL_REFIT_DELAY_MS: 150,
  /** Split mode state update delay (ms) */
  SPLIT_STATE_DELAY_MS: 50,
  /** Terminal refit after removal delay (ms) */
  REFIT_AFTER_REMOVAL_MS: 50,
  /** Animation duration for UI transitions */
  ANIMATION_DURATION_MS: UI_CONSTANTS.ANIMATION_DURATION_NORMAL_MS,
} as const;

/**
 * Rendering Optimizer 定数
 */
export const RENDERING_CONSTANTS = {
  /** Trackpad smooth scroll duration (ms) - 0 for instant */
  TRACKPAD_SMOOTH_SCROLL_MS: 0,
  /** Mouse wheel smooth scroll duration (ms) */
  MOUSE_SCROLL_DURATION_MS: 125,
  /** Default resize debounce (ms) */
  DEFAULT_RESIZE_DEBOUNCE_MS: TIMING_CONSTANTS.RESIZE_DEBOUNCE_DELAY_MS,
  /** Minimum terminal dimension (px) */
  MIN_DIMENSION_PX: 50,
} as const;

/**
 * Panel Location 定数
 */
export const PANEL_LOCATION_CONSTANTS = {
  /** Aspect ratio threshold for panel detection (width/height) */
  ASPECT_RATIO_THRESHOLD: 1.2,
} as const;

/**
 * Split Layout 定数
 */
export const SPLIT_LAYOUT_CONSTANTS = {
  /** Resizer width/height (px) */
  RESIZER_SIZE_PX: 4,
  /** Wrapper padding (px) */
  WRAPPER_PADDING_PX: 4,
  /** Wrapper gap (px) */
  WRAPPER_GAP_PX: 4,
} as const;
