/**
 * Performance Manager - Handles output buffering, debouncing, and performance optimizations
 */

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { IPerformanceManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { BaseManager } from './BaseManager';

export class PerformanceManager extends BaseManager implements IPerformanceManager {
  constructor() {
    super('PerformanceManager', {
      enableLogging: true,
      enableValidation: false,
      enableErrorRecovery: true,
    });
  }

  private coordinator?: IManagerCoordinator;
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
    const isLargeOutput = data.length >= 500; // Reduced from 1000 to 500 for better responsiveness
    const bufferFull = this.outputBuffer.length >= this.MAX_BUFFER_SIZE;
    const isSmallInput = data.length <= 10; // New: Immediate flush for small inputs (typing)
    const isModerateOutput = data.length >= 50; // Reduced from 100 to 50

    // Immediate flush conditions (prioritized for cursor accuracy and input responsiveness)
    // Immediate flush for: large output, buffer full, small inputs (typing), or CLI Agent mode
    const shouldFlushImmediately =
      isLargeOutput || bufferFull || isSmallInput || (this.isCliAgentMode && isModerateOutput);

    if (shouldFlushImmediately) {
      this.flushOutputBuffer();

      // xterm.js automatically preserves scroll position if user has scrolled up
      // The terminal's internal isUserScrolling flag handles this behavior
      targetTerminal.write(data);

      const reason = isSmallInput
        ? 'small input (typing)'
        : this.isCliAgentMode
          ? 'CLI Agent mode'
          : isLargeOutput
            ? 'large output'
            : 'buffer full';
      this.log(`📤 [PERFORMANCE] Immediate write: ${data.length} chars (${reason})`);
    } else {
      this.outputBuffer.push(data);
      this.scheduleBufferFlush();
      this.log(
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
      let flushInterval = this.BUFFER_FLUSH_INTERVAL; // Default 4ms (improved from 16ms)

      if (this.isCliAgentMode) {
        // CLI Agent active: Use very aggressive flushing for cursor accuracy
        flushInterval = 2; // Reduced from 4ms to 2ms for CLI Agent output
      } else if (this.outputBuffer.length > 3) {
        // High-frequency output: Use shorter interval (reduced threshold from 5 to 3)
        flushInterval = 2; // Reduced from 8ms to 2ms for frequent output
      }

      this.bufferFlushTimer = window.setTimeout(() => {
        try {
          this.flushOutputBuffer();
        } catch (error) {
          this.log(`❌ [PERFORMANCE] Error during buffer flush:`, error);
          // Reset the timer to prevent stuck state
          this.bufferFlushTimer = null;
          // Clear the buffer to prevent memory issues
          this.outputBuffer = [];
        }
      }, flushInterval);

      this.log(
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
        try {
          // xterm.js automatically preserves scroll position if user has scrolled up
          this.currentBufferTerminal.write(bufferedData);
          this.log(`📤 [PERFORMANCE] Flushed buffer: ${bufferedData.length} chars`);
        } catch (error) {
          this.log(`❌ [PERFORMANCE] Error during buffer flush:`, error);
        }
      } else {
        this.log(
          `⚠️ [PERFORMANCE] No terminal available for buffer flush: ${bufferedData.length} chars lost`
        );
      }
    }
  }

  /**
   * Buffered write with scroll preservation (main API method)
   */
  public bufferedWrite(data: string, targetTerminal: Terminal, _terminalId: string): void {
    // Set the current terminal for buffering
    this.currentBufferTerminal = targetTerminal;

    // Use existing optimization logic
    this.scheduleOutputBuffer(data, targetTerminal);
  }

  /**
   * Initialize the performance manager
   */
  public initialize(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    this.log('✨ [PERFORMANCE] Manager initialized');
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
        this.log(`🔧 [PERFORMANCE] Debounced resize applied: ${cols}x${rows}`);
      } catch (error) {
        this.log(`❌ [PERFORMANCE] Error during debounced resize:`, error);
      } finally {
        // Always reset the timer to prevent stuck state
        this.resizeDebounceTimer = null;
      }
    }, this.RESIZE_DEBOUNCE_DELAY);

    this.log(`🔧 [PERFORMANCE] Debounced resize scheduled: ${cols}x${rows}`);
  }

  /**
   * Set CLI Agent mode for performance optimization
   */
  public setCliAgentMode(isActive: boolean): void {
    if (this.isCliAgentMode !== isActive) {
      this.isCliAgentMode = isActive;
      this.log(`⚡ [PERFORMANCE] CLI Agent mode: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);

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
    this.log('🚨 [PERFORMANCE] Force flushing all buffers');
    this.flushOutputBuffer();
  }

  /**
   * Clear all buffers without writing (emergency clear)
   */
  public clearBuffers(): void {
    this.log('🗑️ [PERFORMANCE] Clearing all buffers without writing');
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
  public override dispose(): void {
    this.log('🧹 [PERFORMANCE] Disposing performance manager');

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

    this.log('✅ [PERFORMANCE] Performance manager disposed');

    // Call parent dispose
    super.dispose();
  }
}
