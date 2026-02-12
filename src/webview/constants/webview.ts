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
  CLI_AGENT_FLUSH_INTERVAL: PERFORMANCE_CONSTANTS.CLI_AGENT_FAST_FLUSH_INTERVAL_MS,
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
 * ResizeCoordinator 定数
 */
export const RESIZE_COORDINATOR_CONSTANTS = {
  /** Parent container resize debounce delay (ms) */
  PARENT_RESIZE_DEBOUNCE_MS: 50,
  /** Window resize debounce delay (ms) */
  WINDOW_RESIZE_DEBOUNCE_MS: 100,
  /** Body resize debounce delay (ms) */
  BODY_RESIZE_DEBOUNCE_MS: 100,
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
  /** Maximum retry attempts for terminals-wrapper class sync */
  CLASS_SYNC_MAX_ATTEMPTS: 20,
  /** Retry interval for terminals-wrapper class sync (ms) */
  CLASS_SYNC_RETRY_INTERVAL_MS: 50,
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

/**
 * Command Registry 定数
 */
export const COMMAND_REGISTRY_CONSTANTS = {
  /** Slow command detection threshold (ms) - commands taking longer trigger warnings */
  SLOW_COMMAND_THRESHOLD_MS: 100,
} as const;

/**
 * Notification Duration 定数
 * 通知の表示時間を一元管理
 */
export const NOTIFICATION_DURATION_CONSTANTS = {
  /** Default notification duration when not specified (ms) */
  DEFAULT_DURATION_MS: 4000,
  /** CLI agent detected notification duration (ms) */
  CLI_AGENT_DETECTED_MS: 6000,
  /** CLI agent session ended notification duration (ms) */
  CLI_AGENT_ENDED_MS: 3000,
  /** Alt+Click disabled warning duration (ms) */
  ALT_CLICK_DISABLED_MS: 4000,
  /** Alt+Click setting error duration (ms) */
  ALT_CLICK_SETTING_ERROR_MS: 6000,
  /** Terminal interaction issue warning duration (ms) */
  TERMINAL_INTERACTION_ISSUE_MS: 5000,
} as const;

/**
 * Dependency Container 定数
 * メモリ使用量推定に使用する定数
 */
export const DEPENDENCY_CONTAINER_CONSTANTS = {
  /** Base memory overhead per registered service (bytes) */
  SERVICE_MEMORY_OVERHEAD_BYTES: 200,
  /** Memory overhead per item in initialization order tracking (bytes) */
  ORDER_TRACKING_OVERHEAD_BYTES: 50,
  /** Memory overhead per resolved instance (bytes) */
  INSTANCE_OVERHEAD_BYTES: 100,
} as const;

/**
 * Header Manager 定数
 * ターミナルカウントバッジの色変更しきい値
 */
export const HEADER_MANAGER_CONSTANTS = {
  /** Terminal count threshold for orange color (moderate usage) */
  TERMINAL_COUNT_ORANGE_THRESHOLD: 3,
  /** Terminal count threshold for warning color (high usage) */
  TERMINAL_COUNT_WARNING_THRESHOLD: 5,
} as const;

/**
 * Session Restore Manager 定数
 * セッション復元に関するタイミング設定
 */
export const SESSION_RESTORE_CONSTANTS = {
  /** Wait delay after terminal creation before proceeding with restoration (ms) */
  TERMINAL_CREATION_WAIT_MS: 100,
} as const;

/**
 * Grid Layout 定数
 * 6-10ターミナル時の2段グリッドレイアウト設定
 */
export const GRID_LAYOUT_CONSTANTS = {
  /** Minimum number of terminals to activate grid layout */
  MIN_TERMINALS_FOR_GRID: 6,
  /** Default grid template rows (2 equal rows) */
  GRID_TEMPLATE_ROWS: '1fr 1fr',
  /** Gap between grid cells (px) */
  GRID_GAP_PX: 4,
} as const;

/**
 * Split Resize Manager 定数
 * ドラッグリサイズ機能に関する設定
 */
export const SPLIT_RESIZE_CONSTANTS = {
  /** Minimum terminal size during resize (px) */
  MIN_RESIZE_SIZE_PX: 50,
  /** Throttle interval for pointermove events (~60fps) */
  RESIZE_THROTTLE_MS: 16,
  /** Debounce delay before notifying PTY of resize completion (ms) */
  PTY_NOTIFY_DEBOUNCE_MS: 100,
} as const;
