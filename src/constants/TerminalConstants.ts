/**
 * Terminal-specific constants
 *
 * This module centralizes all terminal configuration values including:
 * - Default terminal dimensions
 * - Terminal limits and constraints
 * - CLI agent detection patterns
 * - Terminal behavior settings
 *
 * @module TerminalConstants
 */

/**
 * Default terminal dimensions
 *
 * These values define the initial size of terminal instances.
 */
export const TERMINAL_DIMENSIONS = {
  /**
   * Default number of columns
   *
   * @value 80 columns
   * @rationale Industry standard terminal width. Matches POSIX standard
   *            and most terminal emulators. Ensures compatibility with
   *            applications that assume 80-column displays.
   */
  DEFAULT_COLS: 80,

  /**
   * Default number of rows
   *
   * @value 30 rows
   * @rationale Provides comfortable viewing area without excessive height.
   *            Balances between showing enough context and efficient
   *            screen real estate usage.
   */
  DEFAULT_ROWS: 30,

  /**
   * Alternative default rows (VS Code compatibility)
   *
   * @value 24 rows
   * @rationale Some systems use 24 rows as standard (traditional terminal
   *            size). Used for compatibility mode.
   */
  VSCODE_DEFAULT_ROWS: 24,
} as const;

/**
 * Terminal limits and constraints
 */
export const TERMINAL_LIMITS = {
  /**
   * Maximum number of simultaneous terminals
   *
   * @value 5 terminals
   * @rationale Balances functionality with resource usage. Most users
   *            don't need more than 5 terminals. Each terminal consumes
   *            significant memory (scrollback buffer, PTY process).
   */
  MAX_TERMINALS: 5,

  /**
   * Minimum terminal number
   *
   * @value 1
   * @rationale Terminal numbering starts at 1 (human-friendly).
   */
  MIN_TERMINAL_NUMBER: 1,

  /**
   * Maximum terminal number
   *
   * @value 5
   * @rationale Matches MAX_TERMINALS for sequential numbering (1-5).
   */
  MAX_TERMINAL_NUMBER: 5,

  /**
   * Minimum required terminals
   *
   * @value 1 terminal
   * @rationale At least one terminal must remain open to maintain
   *            extension functionality.
   */
  MIN_REQUIRED_TERMINALS: 1,
} as const;

/**
 * Terminal naming configuration
 */
export const TERMINAL_NAMING = {
  /**
   * Terminal name prefix
   *
   * @value "Terminal"
   * @rationale Clear, descriptive prefix for terminal instances.
   *            Displayed as "Terminal 1", "Terminal 2", etc.
   */
  NAME_PREFIX: 'Terminal',

  /**
   * Terminal ID prefix
   *
   * @value "terminal-"
   * @rationale Used for internal ID generation. Results in IDs like
   *            "terminal-abc123" for easier debugging.
   */
  ID_PREFIX: 'terminal-',

  /**
   * Split terminal suffix
   *
   * @value "-split"
   * @rationale Appended to split terminal IDs to distinguish from
   *            main terminals (e.g., "terminal-abc123-split").
   */
  SPLIT_SUFFIX: '-split',

  /**
   * Nonce length for secure identifiers
   *
   * @value 32 characters
   * @rationale Cryptographically secure random string length for
   *            WebView security. 32 chars provides 256 bits of entropy.
   */
  NONCE_LENGTH: 32,
} as const;

/**
 * CLI Agent detection configuration
 */
export const CLI_AGENT_DETECTION = {
  /**
   * Detection debounce interval
   *
   * @value 500ms
   * @rationale Wait 500ms after output stops before running detection
   *            to avoid false positives from partial output.
   */
  DEBOUNCE_MS: 500,

  /**
   * Heartbeat interval for state validation
   *
   * @value 5000ms (5 seconds)
   * @rationale Check CLI agent status every 5 seconds to detect
   *            disconnections or state changes.
   */
  HEARTBEAT_INTERVAL_MS: 5000,

  /**
   * Maximum detection attempts
   *
   * @value 3 attempts
   * @rationale Retry detection up to 3 times before marking as failed.
   */
  MAX_DETECTION_ATTEMPTS: 3,
} as const;

/**
 * Terminal behavior timeouts
 */
export const TERMINAL_TIMEOUTS = {
  /**
   * Terminal removal delay
   *
   * @value 2000ms (2 seconds)
   * @rationale Wait 2 seconds before removing terminal to allow
   *            cleanup operations and prevent race conditions.
   */
  REMOVAL_DELAY_MS: 2000,

  /**
   * Default shell initialization timeout
   *
   * @value 10000ms (10 seconds)
   * @rationale Maximum time allowed for shell to initialize.
   *            Sufficient for slow systems and complex RC files.
   */
  SHELL_INIT_TIMEOUT_MS: 10000,

  /**
   * Input debounce delay
   *
   * @value 50ms
   * @rationale Debounce rapid user input to prevent excessive
   *            processing. 50ms is imperceptible to users.
   */
  INPUT_DEBOUNCE_MS: 50,
} as const;

/**
 * Terminal display settings
 */
export const TERMINAL_DISPLAY = {
  /**
   * Default font size
   *
   * @value 14 pixels
   * @rationale Readable on most displays without being too large.
   *            Matches VS Code's default terminal font size.
   */
  DEFAULT_FONT_SIZE: 14,

  /**
   * Minimum font size
   *
   * @value 8 pixels
   * @rationale Smallest readable font size. Below this becomes
   *            difficult to read.
   */
  MIN_FONT_SIZE: 8,

  /**
   * Maximum font size
   *
   * @value 72 pixels
   * @rationale Upper limit to prevent absurdly large terminals.
   */
  MAX_FONT_SIZE: 72,

  /**
   * Font size adjustment step
   *
   * @value 1 pixel
   * @rationale Fine-grained font size control.
   */
  FONT_SIZE_STEP: 1,

  /**
   * Default font family
   *
   * @value "monospace"
   * @rationale Generic monospace font ensures consistent character
   *            width across all glyphs (required for terminal).
   */
  DEFAULT_FONT_FAMILY: 'monospace',

  /**
   * Default font weight
   *
   * @value "normal"
   * @rationale Standard weight for regular text.
   */
  DEFAULT_FONT_WEIGHT: 'normal',

  /**
   * Bold font weight
   *
   * @value "bold"
   * @rationale Used for bold text and bright colors.
   */
  BOLD_FONT_WEIGHT: 'bold',

  /**
   * Line height multiplier
   *
   * @value 1.0
   * @rationale No extra line spacing (1.0x font size).
   *            Maximizes content density.
   */
  LINE_HEIGHT: 1.0,

  /**
   * Letter spacing
   *
   * @value 0 pixels
   * @rationale No extra spacing between characters.
   */
  LETTER_SPACING: 0,

  /**
   * Cursor width
   *
   * @value 1 pixel
   * @rationale Standard cursor width. Visible but not obtrusive.
   */
  CURSOR_WIDTH: 1,

  /**
   * Tab stop width
   *
   * @value 8 spaces
   * @rationale POSIX standard tab width. Most systems use 8.
   */
  TAB_STOP_WIDTH: 8,

  /**
   * Fast scroll sensitivity
   *
   * @value 5 lines per scroll event
   * @rationale When holding Alt/Option, scroll 5 lines at a time
   *            for faster navigation.
   */
  FAST_SCROLL_SENSITIVITY: 5,

  /**
   * Normal scroll sensitivity
   *
   * @value 1 line per scroll event
   * @rationale Standard scrolling moves one line at a time.
   */
  SCROLL_SENSITIVITY: 1,
} as const;

/**
 * Terminal encoding configuration
 */
export const TERMINAL_ENCODING = {
  /**
   * Default locale
   *
   * @value "en_US.UTF-8"
   * @rationale UTF-8 encoding with US English locale.
   *            Supports international characters while maintaining
   *            compatibility with English-centric tools.
   */
  DEFAULT_LOCALE: 'en_US.UTF-8',

  /**
   * Terminal type
   *
   * @value "xterm-256color"
   * @rationale Standard terminal type with 256 color support.
   *            Widely supported by applications.
   */
  TERM_TYPE: 'xterm-256color',

  /**
   * Color term capability
   *
   * @value "truecolor"
   * @rationale Advertises 24-bit color support (16 million colors).
   */
  COLORTERM: 'truecolor',
} as const;

/**
 * Word and selection configuration
 */
export const TERMINAL_SELECTION = {
  /**
   * Word separator characters
   *
   * @value ' ()[]{}\'"`,;'
   * @rationale Characters that delimit words for double-click selection.
   *            Includes common punctuation and brackets.
   */
  WORD_SEPARATORS: ' ()[]{}\'"`,;',

  /**
   * Minimum contrast ratio for readability
   *
   * @value 1 (disabled)
   * @rationale Let users control contrast. Value of 1 means no
   *            automatic contrast adjustment.
   */
  MIN_CONTRAST_RATIO: 1,
} as const;

/**
 * Platform-specific configurations
 */
export const PLATFORM_CONFIG = {
  /**
   * Platform identifiers
   */
  PLATFORMS: {
    WINDOWS: 'win32',
    MACOS: 'darwin',
    LINUX: 'linux',
  } as const,

  /**
   * Default shells by platform
   */
  DEFAULT_SHELLS: {
    WINDOWS: 'cmd.exe',
    MACOS: '/bin/zsh',
    LINUX: '/bin/bash',
  } as const,
} as const;

/**
 * Terminal state constants
 */
export const TERMINAL_STATES = {
  /**
   * Process states for lifecycle tracking
   */
  PROCESS_STATES: {
    UNINITIALIZED: 0,
    LAUNCHING: 1,
    RUNNING: 2,
    KILLED_DURING_LAUNCH: 3,
    KILLED_BY_USER: 4,
    KILLED_BY_PROCESS: 5,
  } as const,

  /**
   * Connection states for agents
   */
  AGENT_STATES: {
    NONE: 'none',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
  } as const,
} as const;
