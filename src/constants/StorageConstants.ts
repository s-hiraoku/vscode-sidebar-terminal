/**
 * Storage and persistence-related constants
 *
 * This module centralizes all storage configuration values including:
 * - Terminal scrollback buffer sizes
 * - Session persistence settings
 * - Output retention limits
 * - Storage quotas and thresholds
 *
 * @module StorageConstants
 */

/**
 * Terminal scrollback configuration
 *
 * Controls how much terminal history is retained in memory.
 */
export const SCROLLBACK_CONFIG = {
  /**
   * Default scrollback lines for terminal
   *
   * @value 1000 lines
   * @rationale Balances memory usage with useful history. 1000 lines typically
   *            represents 50-100KB of text, which is reasonable for most systems.
   *            Provides sufficient history for typical debugging sessions.
   */
  DEFAULT_LINES: 1000,

  /**
   * Maximum scrollback lines allowed
   *
   * @value 10000 lines
   * @rationale Upper limit to prevent excessive memory usage. 10K lines
   *            (~500KB-1MB) is sufficient for most use cases while preventing
   *            unbounded growth.
   */
  MAX_LINES: 10000,

  /**
   * Standard scrollback for VS Code compatibility
   *
   * @value 2000 lines
   * @rationale Matches VS Code's integrated terminal default for consistency.
   */
  VSCODE_STANDARD: 2000,

  /**
   * Scrollback chunk size for pagination
   *
   * @value 100 lines
   * @rationale When loading or processing scrollback history, work in 100-line
   *            chunks to balance performance with memory efficiency.
   */
  CHUNK_SIZE: 100,
} as const;

/**
 * Terminal output buffer configuration
 */
export const OUTPUT_BUFFER_CONFIG = {
  /**
   * Maximum output length before truncation
   *
   * @value 1000 characters
   * @rationale Large output blocks are truncated for display efficiency.
   *            1000 chars (~1KB) is typically 10-20 lines of output.
   */
  MAX_OUTPUT_LENGTH: 1000,

  /**
   * Output retention period
   *
   * @value 3600000ms (1 hour)
   * @rationale Old output data is cleaned up after 1 hour to prevent
   *            memory leaks from long-running sessions.
   */
  RETENTION_PERIOD_MS: 3600000,

  /**
   * Maximum number of stored output entries per terminal
   *
   * @value 1000 entries
   * @rationale Limits memory usage while retaining sufficient history.
   */
  MAX_STORED_ENTRIES: 1000,
} as const;

/**
 * Session persistence configuration
 */
export const SESSION_PERSISTENCE = {
  /**
   * Session expiration time
   *
   * @value 86400000ms (24 hours)
   * @rationale Saved sessions expire after 24 hours to prevent stale
   *            state restoration on next launch.
   */
  EXPIRATION_MS: 86400000,

  /**
   * Session restore timeout
   *
   * @value 10000ms (10 seconds)
   * @rationale Maximum time allowed for session restoration to complete.
   *            Prevents hanging on corrupted or oversized session data.
   */
  RESTORE_TIMEOUT_MS: 10000,

  /**
   * Session cleanup interval
   *
   * @value 60000ms (1 minute)
   * @rationale Check for expired sessions once per minute.
   */
  CLEANUP_INTERVAL_MS: 60000,

  /**
   * Maximum session data size
   *
   * @value 10485760 bytes (10MB)
   * @rationale Upper limit for serialized session data to prevent
   *            storage quota issues and slow serialization.
   */
  MAX_SESSION_SIZE_BYTES: 10 * 1024 * 1024,
} as const;

/**
 * Terminal state storage limits
 */
export const STATE_STORAGE_LIMITS = {
  /**
   * Maximum number of terminal states to keep
   *
   * @value 5 terminals
   * @rationale Matches the default max terminal count. Each terminal
   *            state includes scrollback, configuration, and metadata.
   */
  MAX_TERMINAL_STATES: 5,

  /**
   * Maximum size per terminal state
   *
   * @value 2097152 bytes (2MB)
   * @rationale Each terminal can store up to 2MB of state (scrollback +
   *            configuration). Prevents individual terminals from consuming
   *            excessive storage.
   */
  MAX_STATE_SIZE_BYTES: 2 * 1024 * 1024,

  /**
   * Compression threshold for terminal state
   *
   * @value 10240 bytes (10KB)
   * @rationale Terminal states larger than 10KB are compressed before
   *            storage to save space. Smaller states aren't worth the
   *            compression overhead.
   */
  COMPRESSION_THRESHOLD_BYTES: 10 * 1024,
} as const;

/**
 * Memory management thresholds
 */
export const MEMORY_THRESHOLDS = {
  /**
   * Memory pressure threshold
   *
   * @value 104857600 bytes (100MB)
   * @rationale When total memory usage exceeds 100MB, trigger aggressive
   *            cleanup (reduce scrollback, clear old buffers).
   */
  PRESSURE_THRESHOLD_BYTES: 100 * 1024 * 1024,

  /**
   * Maximum inactive resources to keep
   *
   * @value 50 resources
   * @rationale Limit number of inactive resources (closed terminals,
   *            old timers) to prevent gradual memory growth.
   */
  MAX_INACTIVE_RESOURCES: 50,

  /**
   * Warning threshold for scrollback size
   *
   * @value 5000 lines
   * @rationale Warn users when scrollback exceeds 5000 lines as it may
   *            impact performance on slower systems.
   */
  SCROLLBACK_WARNING_THRESHOLD: 5000,
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  /**
   * Maximum cache entries
   *
   * @value 100 entries
   * @rationale LRU cache size for frequently accessed data (terminal
   *            metadata, configuration values).
   */
  MAX_CACHE_ENTRIES: 100,

  /**
   * Cache entry TTL (time to live)
   *
   * @value 300000ms (5 minutes)
   * @rationale Cache entries older than 5 minutes are evicted to
   *            prevent serving stale data.
   */
  CACHE_TTL_MS: 300000,

  /**
   * Cache cleanup interval
   *
   * @value 60000ms (1 minute)
   * @rationale Check for expired cache entries once per minute.
   */
  CACHE_CLEANUP_INTERVAL_MS: 60000,
} as const;

/**
 * Data serialization limits
 */
export const SERIALIZATION_LIMITS = {
  /**
   * Maximum message size for WebView communication
   *
   * @value 10485760 bytes (10MB)
   * @rationale Upper limit for messages sent between extension and WebView.
   *            Prevents hanging on oversized data transfers.
   */
  MAX_MESSAGE_SIZE_BYTES: 10 * 1024 * 1024,

  /**
   * Maximum error message length
   *
   * @value 500 characters
   * @rationale Truncate error messages to prevent UI clutter and
   *            storage bloat in logs.
   */
  MAX_ERROR_MESSAGE_LENGTH: 500,

  /**
   * Maximum stack trace length
   *
   * @value 2000 characters
   * @rationale Truncate stack traces to reasonable length while
   *            retaining useful debugging information.
   */
  MAX_STACK_TRACE_LENGTH: 2000,

  /**
   * Maximum error log entries
   *
   * @value 1000 entries
   * @rationale Keep last 1000 errors in memory for debugging.
   */
  MAX_ERROR_LOG_ENTRIES: 1000,
} as const;
