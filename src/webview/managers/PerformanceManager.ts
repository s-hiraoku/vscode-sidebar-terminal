/**
 * Performance Manager - Handles output buffering, debouncing, and performance optimizations
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { BaseManager } from './BaseManager';
// import { performanceLogger } from '../utils/ManagerLogger';
import { ResizeManager } from '../utils/ResizeManager';

const ENABLE_WEBVIEW_DEBUG_LOGS = Boolean(
  typeof globalThis !== 'undefined' &&
    (((globalThis as Record<string, unknown>).SECONDARY_TERMINAL_DEBUG_LOGS as boolean | undefined) === true ||
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('SECONDARY_TERMINAL_DEBUG_LOGS') === 'true'))
);

export class PerformanceManager extends BaseManager {
  constructor() {
    super('PerformanceManager', {
      enableLogging: ENABLE_WEBVIEW_DEBUG_LOGS,
      enableValidation: false,
      enableErrorRecovery: true,
      customLogger: ENABLE_WEBVIEW_DEBUG_LOGS ? undefined : () => {}
    });

    // Logger is automatically provided by BaseManager

    if (this.debugLoggingEnabled) {
      this.logger('initialization', 'starting');
    }
  }

  // Performance optimization: Buffer output and batch writes
  private outputBuffer: string[] = [];
  private bufferFlushTimer: number | null = null;
  private readonly BUFFER_FLUSH_INTERVAL = SPLIT_CONSTANTS.BUFFER_FLUSH_INTERVAL;
  private readonly MAX_BUFFER_SIZE = SPLIT_CONSTANTS.MAX_BUFFER_SIZE;
  private readonly debugLoggingEnabled = ENABLE_WEBVIEW_DEBUG_LOGS;

  // CLI Agent mode for performance optimization
  private isCliAgentMode = false;

  // Current terminal for buffer operations
  private currentBufferTerminal: Terminal | null = null;

  /**
   * Schedule output to be written to terminal with intelligent buffering
   */
  public scheduleOutputBuffer(data: string, targetTerminal: Terminal): void {
    this.currentBufferTerminal = targetTerminal;

    const normalizedData = data.indexOf('\f') === -1
      ? data
      : data.replace(/\f+/g, '\u001b[2J\u001b[H');

    // Enhanced buffering strategy for CLI Agent compatibility
    const isLargeOutput = normalizedData.length >= 500; // Reduced from 1000 to 500 for better responsiveness
    const bufferFull = this.outputBuffer.length >= this.MAX_BUFFER_SIZE;
    const isSmallInput = normalizedData.length <= 10; // New: Immediate flush for small inputs (typing)
    const isModerateOutput = normalizedData.length >= 50; // Reduced from 100 to 50

    // Immediate flush conditions (prioritized for cursor accuracy and input responsiveness)
    // Immediate flush for: large output, buffer full, small inputs (typing), or CLI Agent mode
    const shouldFlushImmediately =
      isLargeOutput || bufferFull || isSmallInput || (this.isCliAgentMode && isModerateOutput);

    if (shouldFlushImmediately) {
      this.flushOutputBuffer();

      // xterm.js automatically preserves scroll position if user has scrolled up
      // The terminal's internal isUserScrolling flag handles this behavior
      targetTerminal.write(normalizedData);

      if (this.debugLoggingEnabled) {
        const reason = isSmallInput
          ? 'small input (typing)'
          : this.isCliAgentMode
            ? 'CLI Agent mode'
            : isLargeOutput
              ? 'large output'
              : 'buffer full';
        this.logger(`Immediate write: ${normalizedData.length} chars (${reason})`);
      }
    } else {
      this.outputBuffer.push(normalizedData);
      this.scheduleBufferFlush();
      if (this.debugLoggingEnabled) {
        this.logger(
          `Buffered write: ${normalizedData.length} chars (buffer: ${this.outputBuffer.length}, CLI Agent: ${this.isCliAgentMode})`
        );
      }
    }
  }

  /**
   * Schedule buffer flush with dynamic interval based on activity
   */
  private scheduleBufferFlush(): void {
    if (this.bufferFlushTimer === null) {
      // Dynamic flush interval based on CLI Agent state and output frequency
      let flushInterval = this.BUFFER_FLUSH_INTERVAL; // Default 16ms (optimized for performance)

      if (this.isCliAgentMode) {
        // CLI Agent active: Use optimized flushing for cursor accuracy while maintaining performance
        flushInterval = Math.max(8, this.BUFFER_FLUSH_INTERVAL / 2); // Optimized: 8ms for CLI Agent output
      } else if (this.outputBuffer.length > 3) {
        // High-frequency output: Use shorter interval while avoiding CPU overload
        flushInterval = Math.max(12, this.BUFFER_FLUSH_INTERVAL * 0.75); // Optimized: 12ms for frequent output
      }

      this.bufferFlushTimer = window.setTimeout(() => {
        try {
          this.flushOutputBuffer();
        } catch (error) {
          if (this.debugLoggingEnabled) {
            this.logger(`Error during buffer flush: ${error}`);
          } else {
            console.error('[PerformanceManager] Error during buffer flush:', error);
          }
          // Reset the timer to prevent stuck state
          this.bufferFlushTimer = null;
          // Clear the buffer to prevent memory issues
          this.outputBuffer = [];
        }
      }, flushInterval);

      if (this.debugLoggingEnabled) {
        this.logger(
          `Scheduled flush in ${flushInterval}ms (CLI Agent: ${this.isCliAgentMode}, buffer size: ${this.outputBuffer.length})`
        );
      }
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
          if (this.debugLoggingEnabled) {
            this.logger(`Flushed buffer: ${bufferedData.length} chars`);
          }
        } catch (error) {
          if (this.debugLoggingEnabled) {
            this.logger(`Error during buffer flush: ${error}`);
          } else {
            console.error('[PerformanceManager] Error during buffer flush:', error);
          }
        }
      } else {
        if (this.debugLoggingEnabled) {
          this.logger(
            `No terminal available for buffer flush: ${bufferedData.length} chars lost`
          );
        }
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

  // Internal coordinator reference
  private coordinator: IManagerCoordinator | null = null;

  /**
   * Initialize the PerformanceManager (BaseManager abstract method implementation)
   */
  protected doInitialize(): void {
    if (this.debugLoggingEnabled) {
      this.logger('initialization', 'completed');
    }
  }

  /**
   * Dispose PerformanceManager resources (BaseManager abstract method implementation)
   */
  protected doDispose(): void {
    if (this.debugLoggingEnabled) {
      this.logger('disposal', 'starting');
    }

    // Clear any pending buffer flush
    if (this.bufferFlushTimer) {
      clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    // Clear buffers
    this.outputBuffer = [];
    this.currentBufferTerminal = null;
    this.coordinator = null;

    if (this.debugLoggingEnabled) {
      this.logger('disposal', 'completed');
    }
  }

  /**
   * Initialize the performance manager (IPerformanceManager interface)
   */
  public initializePerformance(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    if (this.debugLoggingEnabled) {
      this.logger('initialization', 'completed');
    }
  }

  /**
   * Debounced resize operation for performance optimization using ResizeManager
   */
  public debouncedResize(cols: number, rows: number, terminal: Terminal, fitAddon: FitAddon): void {
    const resizeKey = `terminal-resize-${cols}x${rows}`;

    if (this.debugLoggingEnabled) {
      this.logger(`Scheduling debounced resize: ${cols}x${rows}`);
    }

    ResizeManager.debounceResize(
      resizeKey,
      async () => {
        try {
          terminal.resize(cols, rows);
          fitAddon.fit();
          if (this.debugLoggingEnabled) {
            this.logger(`Debounced resize applied: ${cols}x${rows}`);
          }
        } catch (error) {
          if (this.debugLoggingEnabled) {
            this.logger(`Error during debounced resize: ${error}`);
          } else {
            console.error('[PerformanceManager] Error during debounced resize:', error);
          }
          throw error; // Let ResizeManager handle the error
        }
      },
      {
        delay: SPLIT_CONSTANTS.RESIZE_DEBOUNCE_DELAY,
        onStart: () => {
          if (this.debugLoggingEnabled) {
            this.logger(`Starting resize operation for ${cols}x${rows}`);
          }
        },
        onComplete: () => {
          if (this.debugLoggingEnabled) {
            this.logger(`Completed resize operation for ${cols}x${rows}`);
          }
        },
      }
    );
  }

  /**
   * Set CLI Agent mode for performance optimization
   */
  public setCliAgentMode(isActive: boolean): void {
    if (this.isCliAgentMode !== isActive) {
      this.isCliAgentMode = isActive;
      if (this.debugLoggingEnabled) {
        this.logger(`CLI Agent mode: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
      }

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
    if (this.debugLoggingEnabled) {
      this.logger('Force flushing all buffers');
    }
    this.flushOutputBuffer();
  }

  /**
   * Clear all buffers without writing (emergency clear)
   */
  public clearBuffers(): void {
    if (this.debugLoggingEnabled) {
      this.logger('Clearing all buffers without writing');
    }
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
    if (this.debugLoggingEnabled) {
      this.logger('Disposing performance manager');
    }

    // Flush any remaining output before disposal
    this.flushOutputBuffer();

    // Clear any pending resize operations using ResizeManager
    ResizeManager.clearResize('terminal-resize');

    // Clear references
    this.currentBufferTerminal = null;
    this.outputBuffer = [];
    this.isCliAgentMode = false;

    // Call parent dispose
    super.dispose();

    // Safe lifecycle logging
    if (this.debugLoggingEnabled) {
      this.logger('PerformanceManager', 'completed');
    }
  }
}
