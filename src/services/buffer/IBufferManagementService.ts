/**
 * Buffer Management Service Interface
 *
 * Manages terminal output buffering and flushing strategies for optimal performance.
 * Provides adaptive buffering based on CLI agent detection and output patterns.
 */

import type { EventBus } from '../../core/EventBus';

/**
 * Buffer configuration for a terminal
 */
export interface BufferConfig {
  /** Flush interval in milliseconds */
  flushInterval: number;
  /** Maximum buffer size in characters */
  maxBufferSize: number;
  /** Enable adaptive buffering based on output patterns */
  adaptiveBuffering: boolean;
}

/**
 * Buffer statistics for monitoring
 */
export interface BufferStats {
  /** Terminal ID */
  terminalId: number;
  /** Current buffer size in characters */
  currentSize: number;
  /** Number of flushes performed */
  flushCount: number;
  /** Average flush interval in milliseconds */
  avgFlushInterval: number;
  /** Last flush timestamp */
  lastFlushAt: Date;
}

/**
 * Buffer Management Service
 *
 * Responsible for:
 * - Managing output buffering for each terminal
 * - Adaptive flush intervals based on CLI agent activity
 * - Performance optimization through batched writes
 * - Buffer overflow prevention
 */
export interface IBufferManagementService {
  /**
   * Initialize buffer for a terminal
   *
   * @param terminalId Terminal ID
   * @param config Initial buffer configuration
   */
  initializeBuffer(terminalId: number, config?: Partial<BufferConfig>): void;

  /**
   * Write data to terminal buffer
   *
   * @param terminalId Terminal ID
   * @param data Data to write
   * @returns True if data was buffered, false if flushed immediately
   */
  write(terminalId: number, data: string): boolean;

  /**
   * Flush terminal buffer immediately
   *
   * @param terminalId Terminal ID
   * @returns Buffered data that was flushed
   */
  flush(terminalId: number): string;

  /**
   * Flush all terminal buffers
   *
   * @returns Map of terminal IDs to flushed data
   */
  flushAll(): Map<number, string>;

  /**
   * Set flush interval for a terminal
   *
   * @param terminalId Terminal ID
   * @param interval Flush interval in milliseconds
   */
  setFlushInterval(terminalId: number, interval: number): void;

  /**
   * Get current flush interval
   *
   * @param terminalId Terminal ID
   * @returns Flush interval in milliseconds
   */
  getFlushInterval(terminalId: number): number;

  /**
   * Enable adaptive buffering for a terminal
   * Automatically adjusts flush intervals based on output patterns
   *
   * @param terminalId Terminal ID
   */
  enableAdaptiveBuffering(terminalId: number): void;

  /**
   * Disable adaptive buffering for a terminal
   *
   * @param terminalId Terminal ID
   */
  disableAdaptiveBuffering(terminalId: number): void;

  /**
   * Handle CLI agent detection event
   * Switches to high-performance buffering mode
   *
   * @param terminalId Terminal ID
   */
  onCliAgentDetected(terminalId: number): void;

  /**
   * Handle CLI agent disconnection event
   * Returns to normal buffering mode
   *
   * @param terminalId Terminal ID
   */
  onCliAgentDisconnected(terminalId: number): void;

  /**
   * Get buffer statistics for a terminal
   *
   * @param terminalId Terminal ID
   * @returns Buffer statistics
   */
  getBufferStats(terminalId: number): BufferStats | undefined;

  /**
   * Get buffer statistics for all terminals
   *
   * @returns Array of buffer statistics
   */
  getAllBufferStats(): BufferStats[];

  /**
   * Clear buffer for a terminal
   *
   * @param terminalId Terminal ID
   */
  clearBuffer(terminalId: number): void;

  /**
   * Dispose buffer for a terminal
   * Flushes any remaining data and cleans up resources
   *
   * @param terminalId Terminal ID
   */
  disposeBuffer(terminalId: number): void;

  /**
   * Dispose all buffers
   * Flushes all data and cleans up all resources
   */
  dispose(): void;
}

/**
 * Service token for dependency injection
 */
export const IBufferManagementService = Symbol('IBufferManagementService');
