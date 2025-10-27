/**
 * IScrollbackService Interface
 *
 * VS Code-style scrollback buffer management.
 * Based on VS Code's TerminalRecorder pattern with size and time limits.
 *
 * Reference: src/vs/platform/terminal/common/terminalRecorder.ts
 */

/**
 * Scrollback service interface
 *
 * Manages terminal scrollback buffering, serialization, and restoration
 * with VS Code-compatible size and time limits.
 */
export interface IScrollbackService {
  /**
   * Start recording terminal output
   *
   * @param terminalId Terminal to record
   */
  startRecording(terminalId: string): void;

  /**
   * Stop recording terminal output
   *
   * @param terminalId Terminal to stop recording
   */
  stopRecording(terminalId: string): void;

  /**
   * Record terminal data
   *
   * @param terminalId Terminal ID
   * @param data Terminal output data
   */
  recordData(terminalId: string, data: string): void;

  /**
   * Get serialized scrollback data
   *
   * Returns VT sequences that can be written back to terminal
   *
   * @param terminalId Terminal ID
   * @param options Serialization options
   * @returns Serialized scrollback data
   */
  getSerializedData(terminalId: string, options?: IScrollbackSerializationOptions): string | null;

  /**
   * Get scrollback replay event
   *
   * VS Code pattern: Returns replay event with normalized entries
   *
   * @param terminalId Terminal ID
   * @returns Replay event data
   */
  getReplayEvent(terminalId: string): IScrollbackReplayEvent | null;

  /**
   * Clear scrollback data for terminal
   *
   * @param terminalId Terminal ID
   */
  clearScrollback(terminalId: string): void;

  /**
   * Get scrollback statistics
   *
   * @param terminalId Terminal ID
   * @returns Scrollback statistics
   */
  getScrollbackStats(terminalId: string): IScrollbackStats | null;

  /**
   * Dispose all scrollback data
   */
  dispose(): void;
}

/**
 * Scrollback serialization options
 */
export interface IScrollbackSerializationOptions {
  /**
   * Number of lines to serialize
   *
   * Default: Based on persistentSessionScrollback config
   */
  scrollback?: number;

  /**
   * Exclude terminal modes from serialization
   *
   * Default: false
   */
  excludeModes?: boolean;

  /**
   * Exclude alternate buffer from serialization
   *
   * Default: false
   */
  excludeAltBuffer?: boolean;

  /**
   * Specific line range to serialize
   */
  range?: {
    start: number;
    end: number;
  };
}

/**
 * Scrollback replay event
 *
 * VS Code pattern: Normalized replay entries with cols, rows, data
 */
export interface IScrollbackReplayEvent {
  /**
   * Replay entries
   */
  events: IScrollbackReplayEntry[];

  /**
   * Total data size in bytes
   */
  totalSize: number;

  /**
   * Recording duration in milliseconds
   */
  duration: number;

  /**
   * Whether data was truncated due to size limits
   */
  truncated: boolean;
}

/**
 * Single replay entry
 *
 * VS Code pattern: Contains terminal dimensions and data
 */
export interface IScrollbackReplayEntry {
  /**
   * Terminal columns at time of recording
   */
  cols: number;

  /**
   * Terminal rows at time of recording
   */
  rows: number;

  /**
   * Terminal data (VT sequences)
   */
  data: string;

  /**
   * Timestamp of this entry (milliseconds since recording start)
   */
  timestamp?: number;
}

/**
 * Scrollback statistics
 */
export interface IScrollbackStats {
  /**
   * Terminal ID
   */
  terminalId: string;

  /**
   * Number of recorded entries
   */
  entryCount: number;

  /**
   * Total data size in bytes
   */
  totalSize: number;

  /**
   * Recording duration in milliseconds
   */
  duration: number;

  /**
   * Whether recording is active
   */
  isRecording: boolean;

  /**
   * Whether size limit was reached
   */
  sizeLimitReached: boolean;

  /**
   * Whether time limit was reached
   */
  timeLimitReached: boolean;

  /**
   * Current scrollback line count
   */
  lineCount: number;
}

/**
 * Scrollback buffer configuration
 *
 * VS Code-compatible settings
 */
export interface IScrollbackConfig {
  /**
   * Maximum scrollback lines for active terminals
   *
   * VS Code default: 1000
   */
  scrollback: number;

  /**
   * Maximum scrollback lines for persistent sessions
   *
   * VS Code default: 100
   */
  persistentSessionScrollback: number;

  /**
   * Maximum recording size in bytes
   *
   * VS Code default: 10MB (10 * 1024 * 1024)
   */
  maxRecordingSize: number;

  /**
   * Maximum recording duration in milliseconds
   *
   * VS Code default: 10000 (10 seconds)
   */
  maxRecordingDuration: number;

  /**
   * Flow control: high watermark in characters
   *
   * VS Code default: 100000
   * Pause pty when unacknowledged chars exceed this
   */
  flowControlHighWatermark: number;

  /**
   * Flow control: low watermark in characters
   *
   * VS Code default: 5000
   * Resume pty when unacknowledged chars drop below this
   */
  flowControlLowWatermark: number;

  /**
   * Character count acknowledgment batch size
   *
   * VS Code default: 5000
   */
  charCountAckSize: number;

  /**
   * Maximum chunk size for writing
   *
   * VS Code default: 50
   * Prevents corruption during large pastes
   */
  writeMaxChunkSize: number;
}

/**
 * Default scrollback configuration
 *
 * VS Code-compatible defaults
 */
export const DEFAULT_SCROLLBACK_CONFIG: IScrollbackConfig = {
  scrollback: 1000,
  persistentSessionScrollback: 100,
  maxRecordingSize: 10 * 1024 * 1024, // 10MB
  maxRecordingDuration: 10000, // 10 seconds
  flowControlHighWatermark: 100000,
  flowControlLowWatermark: 5000,
  charCountAckSize: 5000,
  writeMaxChunkSize: 50,
};
