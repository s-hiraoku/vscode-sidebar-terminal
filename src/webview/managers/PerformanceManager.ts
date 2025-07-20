/**
 * Performance Manager - Handles output buffering, debouncing, and performance optimizations
 */

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { webview as log } from '../../utils/logger';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { IPerformanceManager } from '../interfaces/ManagerInterfaces';

export class PerformanceManager implements IPerformanceManager {
  // Performance optimization: Buffer output and batch writes
  private outputBuffer: string[] = [];
  private bufferFlushTimer: number | null = null;
  private readonly BUFFER_FLUSH_INTERVAL = SPLIT_CONSTANTS.BUFFER_FLUSH_INTERVAL;
  private readonly MAX_BUFFER_SIZE = SPLIT_CONSTANTS.MAX_BUFFER_SIZE;

  // Performance optimization: Debounce resize operations
  private resizeDebounceTimer: number | null = null;
  private readonly RESIZE_DEBOUNCE_DELAY = SPLIT_CONSTANTS.RESIZE_DEBOUNCE_DELAY;

  // CLI Agent mode for performance optimization
  private isCliAgentMode = false;

  // Current terminal for buffer operations
  private currentBufferTerminal: Terminal | null = null;

  /**
   * Schedule output to be written to terminal with intelligent buffering
   */
  public scheduleOutputBuffer(data: string, targetTerminal: Terminal): void {
    this.currentBufferTerminal = targetTerminal;

    // Enhanced buffering strategy for CLI Agent compatibility
    const isLargeOutput = data.length >= 1000;
    const bufferFull = this.outputBuffer.length >= this.MAX_BUFFER_SIZE;
    const isModerateOutput = data.length >= 100; // Medium-sized chunks

    // Immediate flush conditions (prioritized for cursor accuracy)
    // Only flush immediately for large output (≥1000 chars) or buffer full
    // Moderate output (≥100 chars) should only flush immediately during CLI Agent mode
    const shouldFlushImmediately =
      isLargeOutput || bufferFull || (this.isCliAgentMode && isModerateOutput);

    if (shouldFlushImmediately) {
      this.flushOutputBuffer();
      targetTerminal.write(data);
      const reason = this.isCliAgentMode
        ? 'CLI Agent mode'
        : isLargeOutput
          ? 'large output'
          : 'buffer full';
      log(`📤 [PERFORMANCE] Immediate write: ${data.length} chars (${reason})`);
    } else {
      this.outputBuffer.push(data);
      this.scheduleBufferFlush();
      log(
        `📤 [PERFORMANCE] Buffered write: ${data.length} chars (buffer: ${this.outputBuffer.length}, CLI Agent: ${this.isCliAgentMode})`
      );
    }
  }

  /**
   * Schedule buffer flush with dynamic interval based on activity
   */
  private scheduleBufferFlush(): void {
    if (this.bufferFlushTimer === null) {
      // Dynamic flush interval based on CLI Agent state and output frequency
      let flushInterval = this.BUFFER_FLUSH_INTERVAL; // Default 16ms

      if (this.isCliAgentMode) {
        // CLI Agent active: Use very aggressive flushing for cursor accuracy
        flushInterval = 4; // 4ms for CLI Agent output
      } else if (this.outputBuffer.length > 5) {
        // High-frequency output: Use shorter interval
        flushInterval = 8; // 8ms for frequent output
      }

      this.bufferFlushTimer = window.setTimeout(() => {
        this.flushOutputBuffer();
      }, flushInterval);

      log(
        `📊 [PERFORMANCE] Scheduled flush in ${flushInterval}ms (CLI Agent: ${this.isCliAgentMode}, buffer size: ${this.outputBuffer.length})`
      );
    }
  }

  /**
   * Flush all buffered output to the current terminal
   */
  public flushOutputBuffer(): void {
    if (this.bufferFlushTimer !== null) {
      window.clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    if (this.outputBuffer.length > 0) {
      const bufferedData = this.outputBuffer.join('');
      this.outputBuffer = [];

      // Use the most recently set terminal for buffer output
      if (this.currentBufferTerminal) {
        this.currentBufferTerminal.write(bufferedData);
        log(`📤 [PERFORMANCE] Flushed buffer: ${bufferedData.length} chars`);
      } else {
        log(
          `⚠️ [PERFORMANCE] No terminal available for buffer flush: ${bufferedData.length} chars lost`
        );
      }
    }
  }

  /**
   * Debounced resize operation for performance optimization
   */
  public debouncedResize(cols: number, rows: number, terminal: Terminal, fitAddon: FitAddon): void {
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = window.setTimeout(() => {
      try {
        terminal.resize(cols, rows);
        fitAddon.fit();
        log(`🔧 [PERFORMANCE] Debounced resize applied: ${cols}x${rows}`);
      } catch (error) {
        log(`❌ [PERFORMANCE] Error during debounced resize:`, error);
      }
      this.resizeDebounceTimer = null;
    }, this.RESIZE_DEBOUNCE_DELAY);

    log(`🔧 [PERFORMANCE] Debounced resize scheduled: ${cols}x${rows}`);
  }

  /**
   * Set CLI Agent mode for performance optimization
   */
  public setCliAgentMode(isActive: boolean): void {
    if (this.isCliAgentMode !== isActive) {
      this.isCliAgentMode = isActive;
      log(`⚡ [PERFORMANCE] CLI Agent mode: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);

      // Flush immediately when mode changes
      if (!isActive) {
        this.flushOutputBuffer();
      }
    }
  }

  public getCliAgentMode(): boolean {
    return this.isCliAgentMode;
  }

  /**
   * Get current buffer statistics for monitoring
   */
  public getBufferStats(): {
    bufferSize: number;
    isFlushScheduled: boolean;
    isCliAgentMode: boolean;
    currentTerminal: boolean;
  } {
    return {
      bufferSize: this.outputBuffer.length,
      isFlushScheduled: this.bufferFlushTimer !== null,
      isCliAgentMode: this.isCliAgentMode,
      currentTerminal: this.currentBufferTerminal !== null,
    };
  }

  /**
   * Force immediate flush of all buffers (emergency flush)
   */
  public forceFlush(): void {
    log('🚨 [PERFORMANCE] Force flushing all buffers');
    this.flushOutputBuffer();
  }

  /**
   * Clear all buffers without writing (emergency clear)
   */
  public clearBuffers(): void {
    log('🗑️ [PERFORMANCE] Clearing all buffers without writing');
    this.outputBuffer = [];
    if (this.bufferFlushTimer !== null) {
      window.clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }
  }

  /**
   * Optimize terminal performance by preloading next operations
   */
  public preloadNextOperation(): void {
    // Schedule a small flush to keep the pipeline moving
    if (this.outputBuffer.length > 0) {
      this.scheduleBufferFlush();
    }
  }

  /**
   * Dispose of all timers and cleanup resources
   */
  public dispose(): void {
    log('🧹 [PERFORMANCE] Disposing performance manager');

    // Flush any remaining output before disposal
    this.flushOutputBuffer();

    // Clear resize timer
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    // Clear references
    this.currentBufferTerminal = null;
    this.outputBuffer = [];
    this.isCliAgentMode = false;

    log('✅ [PERFORMANCE] Performance manager disposed');
  }
}
