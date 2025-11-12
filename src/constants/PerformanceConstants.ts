/**
 * Performance-related constants for the terminal application
 *
 * This module centralizes all performance tuning values including:
 * - Data flush intervals for output optimization
 * - Debounce delays for user input handling
 * - Timeout values for async operations
 * - Retry configurations for error recovery
 *
 * @module PerformanceConstants
 */

/**
 * Data buffering and flush intervals
 *
 * These values control how frequently terminal output is flushed to the UI.
 * Lower values provide better responsiveness but higher CPU usage.
 * Higher values reduce CPU usage but may feel less responsive.
 */
export const DATA_FLUSH_INTERVALS = {
  /**
   * Standard flush interval for normal terminal output
   *
   * @value 8ms (~125fps)
   * @rationale Balances responsiveness with CPU efficiency. Tested to provide
   *            smooth scrolling for typical terminal output without excessive
   *            CPU usage. 125fps is above typical monitor refresh rates (60Hz)
   *            while still being efficient.
   */
  STANDARD: 8,

  /**
   * Normal flush interval for typical terminal operations
   *
   * @value 16ms (~60fps)
   * @rationale Matches typical monitor refresh rates for smooth visual updates
   *            while maintaining good CPU efficiency for standard operations.
   */
  NORMAL: 16,

  /**
   * Fast flush interval for high-frequency output
   *
   * @value 8ms (~125fps)
   * @rationale Used during high-volume output scenarios (e.g., log streaming)
   *            to prevent UI lag while maintaining visual smoothness.
   */
  FAST: 8,

  /**
   * Ultra-fast flush interval for CLI Agent operations
   *
   * @value 4ms (~250fps)
   * @rationale CLI Agents (like Claude Code, GitHub Copilot) require
   *            near-instantaneous feedback. This aggressive interval ensures
   *            minimal perceived latency during AI interactions.
   */
  CLI_AGENT: 4,
} as const;

/**
 * Buffer size limits
 *
 * Controls how many data chunks are buffered before forcing a flush.
 */
export const BUFFER_LIMITS = {
  /**
   * Maximum number of buffered data chunks before forcing flush
   *
   * @value 50 chunks
   * @rationale Prevents memory buildup during high-output scenarios.
   *            50 chunks typically represents 1-5KB of data, which is
   *            safe to hold in memory while waiting for the next flush.
   */
  MAX_BUFFER_SIZE: 50,

  /**
   * Data size threshold for immediate flush (bypassing buffer)
   *
   * @value 1000 bytes
   * @rationale Large data chunks (>1KB) are flushed immediately to prevent
   *            UI lag from batch processing. This handles paste operations
   *            and bulk output efficiently.
   */
  LARGE_DATA_THRESHOLD: 1000,

  /**
   * Adaptive buffering threshold
   *
   * @value 100 characters
   * @rationale When buffer growth rate exceeds this threshold, switch to
   *            fast flush mode to maintain responsiveness during output bursts.
   */
  ADAPTIVE_THRESHOLD: 100,
} as const;

/**
 * Operation timeouts for async operations
 */
export const OPERATION_TIMEOUTS = {
  /**
   * Terminal process launch timeout
   *
   * @value 10000ms (10 seconds)
   * @rationale Sufficient time for shell initialization, even on slow systems
   *            or with complex shell configurations (e.g., ESP-IDF environment).
   */
  TERMINAL_LAUNCH: 10000,

  /**
   * Health check timeout for safe mode (retry attempt)
   *
   * @value 2000ms (2 seconds)
   * @rationale Shorter timeout for retry attempts to fail fast if shell
   *            configuration issues persist.
   */
  HEALTH_CHECK_SAFE_MODE: 2000,

  /**
   * Health check timeout for normal mode (first attempt)
   *
   * @value 3000ms (3 seconds)
   * @rationale Allows time for shell initialization and RC file execution
   *            during normal startup.
   */
  HEALTH_CHECK_NORMAL: 3000,

  /**
   * WebView communication timeout
   *
   * @value 3000ms (3 seconds)
   * @rationale Maximum wait time for WebView responses to prevent UI freezes.
   */
  WEBVIEW_COMMUNICATION: 3000,

  /**
   * Operation timeout for async tasks
   *
   * @value 30000ms (30 seconds)
   * @rationale General timeout for long-running operations like session restore.
   */
  OPERATION_DEFAULT: 30000,
} as const;

/**
 * Delay intervals for various operations
 */
export const DELAY_INTERVALS = {
  /**
   * Shell prompt refresh delays after terminal initialization
   *
   * These staggered delays ensure the shell prompt displays correctly
   * even in complex environments (e.g., ESP-IDF with custom RC files).
   */
  PROMPT_REFRESH: {
    /**
     * First prompt request delay
     * @value 100ms
     */
    FIRST: 100,

    /**
     * Second prompt request delay (for ESP-IDF environments)
     * @value 500ms
     */
    SECOND: 500,

    /**
     * Safe mode confirmation delay
     * @value 1000ms (1 second)
     */
    SAFE_MODE: 1000,
  },

  /**
   * PTY readiness check delay
   *
   * @value 500ms
   * @rationale Wait time before retrying PTY operations if process not ready.
   */
  PTY_READY_CHECK: 500,

  /**
   * Health check command send delay
   *
   * @value 500ms
   * @rationale Brief delay before sending health check command to ensure
   *            PTY is ready to receive input.
   */
  HEALTH_CHECK_SEND: 500,

  /**
   * Retry attempt delay
   *
   * @value 100ms
   * @rationale Short pause between retry attempts to avoid tight retry loops.
   */
  RETRY_ATTEMPT: 100,

  /**
   * Shell refresh signal delay after resize
   *
   * @value 50ms
   * @rationale Brief delay to send SIGWINCH signal after terminal resize
   *            for proper shell prompt refresh.
   */
  SHELL_REFRESH: 50,
} as const;

/**
 * Retry configuration for error recovery
 */
export const RETRY_CONFIG = {
  /**
   * Maximum number of retry attempts for terminal creation
   *
   * @value 1 retry (2 total attempts)
   * @rationale One retry with safe mode is sufficient for most shell
   *            configuration issues. More retries unlikely to succeed.
   */
  MAX_TERMINAL_CREATION_RETRIES: 1,

  /**
   * Default retry count for general operations
   *
   * @value 3 retries
   * @rationale Standard retry count for transient failures.
   */
  DEFAULT_RETRY_COUNT: 3,

  /**
   * Base delay between retries
   *
   * @value 1000ms (1 second)
   * @rationale Starting delay for exponential backoff.
   */
  RETRY_DELAY_BASE_MS: 1000,

  /**
   * Exponential backoff multiplier
   *
   * @value 2x
   * @rationale Each retry waits 2x longer (1s, 2s, 4s, 8s...)
   */
  RETRY_DELAY_MULTIPLIER: 2,
} as const;

/**
 * Performance monitoring intervals
 */
export const MONITORING_INTERVALS = {
  /**
   * Cleanup interval for orphaned resources
   *
   * @value 30000ms (30 seconds)
   * @rationale Regular cleanup prevents memory leaks without excessive overhead.
   */
  CLEANUP: 30000,

  /**
   * Performance sampling interval
   *
   * @value 1000ms (1 second)
   * @rationale Collect performance metrics once per second for monitoring.
   */
  PERFORMANCE_SAMPLE: 1000,

  /**
   * Session save debounce interval
   *
   * @value 1000ms (1 second)
   * @rationale Prevents excessive saves during rapid terminal state changes.
   */
  SESSION_SAVE_DEBOUNCE: 1000,
} as const;

/**
 * Maximum limits for performance protection
 */
export const PERFORMANCE_LIMITS = {
  /**
   * Maximum terminal dimensions (columns)
   *
   * @value 500 columns
   * @rationale Prevents excessive memory usage from oversized terminals.
   */
  MAX_TERMINAL_COLS: 500,

  /**
   * Maximum terminal dimensions (rows)
   *
   * @value 200 rows
   * @rationale Prevents excessive memory usage from oversized terminals.
   */
  MAX_TERMINAL_ROWS: 200,

  /**
   * Maximum buffer size in bytes
   *
   * @value 1048576 bytes (1MB)
   * @rationale Prevents unbounded memory growth from output buffering.
   */
  MAX_BUFFER_SIZE_BYTES: 1024 * 1024,

  /**
   * Maximum performance history entries
   *
   * @value 100 entries
   * @rationale Limits memory usage while maintaining useful history.
   */
  MAX_PERFORMANCE_HISTORY: 100,
} as const;
