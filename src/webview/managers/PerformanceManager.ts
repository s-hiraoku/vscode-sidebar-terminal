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

      // 🎯 NEW: Preserve scroll position for immediate writes too
      const wasAtBottom = this.isTerminalScrolledToBottom(
        targetTerminal as unknown as {
          buffer?: { active?: { length: number } };
          _core?: { _scrollService?: { scrollPosition: number } };
          rows: number;
        }
      );
      const scrollTop = this.getTerminalScrollTop(
        targetTerminal as unknown as {
          _core?: { _scrollService?: { scrollPosition: number } };
        }
      );

      targetTerminal.write(data);

      // Restore scroll position if user wasn't at bottom
      if (!wasAtBottom && scrollTop !== null) {
        this.restoreTerminalScrollPosition(targetTerminal, scrollTop);
      }

      const reason = this.isCliAgentMode
        ? 'CLI Agent mode'
        : isLargeOutput
          ? 'large output'
          : 'buffer full';
      log(
        `📤 [PERFORMANCE] Immediate write: ${data.length} chars (${reason}, scroll preserved: ${!wasAtBottom})`
      );
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
        try {
          this.flushOutputBuffer();
        } catch (error) {
          log(`❌ [PERFORMANCE] Error during buffer flush:`, error);
          // Reset the timer to prevent stuck state
          this.bufferFlushTimer = null;
          // Clear the buffer to prevent memory issues
          this.outputBuffer = [];
        }
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
        // 🎯 NEW: Preserve scroll position during agent output
        const wasAtBottom = this.isTerminalScrolledToBottom(
          this.currentBufferTerminal as unknown as {
            buffer?: { active?: { length: number } };
            _core?: { _scrollService?: { scrollPosition: number } };
            rows: number;
          }
        );
        const scrollTop = this.getTerminalScrollTop(
          this.currentBufferTerminal as unknown as {
            _core?: { _scrollService?: { scrollPosition: number } };
          }
        );

        this.currentBufferTerminal.write(bufferedData);

        // Restore scroll position if user wasn't at bottom
        if (!wasAtBottom && scrollTop !== null) {
          this.restoreTerminalScrollPosition(this.currentBufferTerminal, scrollTop);
        }

        log(
          `📤 [PERFORMANCE] Flushed buffer: ${bufferedData.length} chars (scroll preserved: ${!wasAtBottom})`
        );
      } else {
        log(
          `⚠️ [PERFORMANCE] No terminal available for buffer flush: ${bufferedData.length} chars lost`
        );
      }
    }
  }

  /**
   * Check if terminal is scrolled to bottom
   */
  private isTerminalScrolledToBottom(terminal: {
    buffer?: { active?: { length: number } };
    _core?: { _scrollService?: { scrollPosition: number } };
    rows: number;
  }): boolean {
    try {
      // xterm.js buffer API to check scroll position
      const buffer = terminal.buffer?.active;
      if (!buffer) return true;

      const scrollPosition = terminal._core?._scrollService?.scrollPosition || 0;
      const maxScrollPosition = Math.max(0, buffer.length - terminal.rows);

      // Consider "bottom" if within 3 lines of actual bottom
      const isAtBottom = scrollPosition >= maxScrollPosition - 3;

      log(
        `📊 [PERFORMANCE] Scroll check - position: ${scrollPosition}, max: ${maxScrollPosition}, atBottom: ${isAtBottom}`
      );
      return isAtBottom;
    } catch (error) {
      log(`⚠️ [PERFORMANCE] Error checking scroll position:`, error);
      return true; // Default to bottom behavior
    }
  }

  /**
   * Get current terminal scroll position
   */
  private getTerminalScrollTop(terminal: {
    _core?: { _scrollService?: { scrollPosition: number } };
  }): number | null {
    try {
      return terminal._core?._scrollService?.scrollPosition || 0;
    } catch (error) {
      log(`⚠️ [PERFORMANCE] Error getting scroll position:`, error);
      return null;
    }
  }

  /**
   * Restore terminal scroll position
   */
  private restoreTerminalScrollPosition(
    terminal: {
      _core?: { _scrollService?: { scrollPosition: number } };
      element?: { scrollTop: number };
    },
    scrollTop: number
  ): void {
    try {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        const coreService = terminal._core?._scrollService as
          | { scrollToLine?: (line: number) => void }
          | undefined;
        if (coreService && coreService.scrollToLine) {
          coreService.scrollToLine(scrollTop);
          log(`🔄 [PERFORMANCE] Restored scroll position to: ${scrollTop}`);
        } else {
          // Fallback: scroll the DOM element
          const element = terminal.element as
            | { querySelector?: (selector: string) => HTMLElement | null }
            | undefined;
          const xtermViewport = element?.querySelector?.('.xterm-viewport') as HTMLElement;
          if (xtermViewport) {
            const charHeight =
              (terminal._core as { _charMeasure?: { height: number } } | undefined)?._charMeasure
                ?.height || 0;
            xtermViewport.scrollTop = scrollTop * charHeight;
            log(`🔄 [PERFORMANCE] Restored scroll via DOM: ${scrollTop}`);
          }
        }
      });
    } catch (error) {
      log(`⚠️ [PERFORMANCE] Error restoring scroll position:`, error);
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
      } finally {
        // Always reset the timer to prevent stuck state
        this.resizeDebounceTimer = null;
      }
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
