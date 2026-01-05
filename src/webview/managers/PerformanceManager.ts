/**
 * Performance Manager - Handles output buffering, debouncing, and performance optimizations
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/226
 * マジックナンバーをSystemConstantsから参照するように変更しました。
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { BaseManager } from './BaseManager';
// import { performanceLogger } from '../utils/ManagerLogger';
import { ResizeManager } from '../utils/ResizeManager';
import { DOMUtils } from '../utils/DOMUtils';

const ENABLE_WEBVIEW_DEBUG_LOGS = Boolean(
  typeof globalThis !== 'undefined' &&
    (((globalThis as Record<string, unknown>).SECONDARY_TERMINAL_DEBUG_LOGS as
      | boolean
      | undefined) === true ||
      (typeof localStorage !== 'undefined' &&
        typeof localStorage.getItem === 'function' &&
        localStorage.getItem('SECONDARY_TERMINAL_DEBUG_LOGS') === 'true'))
);

export class PerformanceManager extends BaseManager {
  constructor() {
    super('PerformanceManager', {
      enableLogging: ENABLE_WEBVIEW_DEBUG_LOGS,
      enableValidation: false,
      enableErrorRecovery: true,
      customLogger: ENABLE_WEBVIEW_DEBUG_LOGS ? undefined : () => {},
    });

    // Logger is automatically provided by BaseManager

    if (this.debugLoggingEnabled) {
      this.logger('initialization', 'starting');
    }
  }

  // Performance optimization: Buffer output and batch writes per terminal
  private readonly bufferEntries = new Map<
    Terminal,
    {
      data: string[];
      timer: number | null;
    }
  >();
  private readonly BUFFER_FLUSH_INTERVAL = SPLIT_CONSTANTS.BUFFER_FLUSH_INTERVAL;
  private readonly MAX_BUFFER_SIZE = SPLIT_CONSTANTS.MAX_BUFFER_SIZE;
  private readonly debugLoggingEnabled = ENABLE_WEBVIEW_DEBUG_LOGS;

  // CLI Agent mode for performance optimization
  private isCliAgentMode = false;

  // DSR (Device Status Report) sequence pattern
  // \x1b[6n queries cursor position, terminal should respond with \x1b[row;colR
  private static readonly DSR_PATTERN = /\x1b\[6n/;

  /**
   * Schedule output to be written to terminal with intelligent buffering
   */
  public scheduleOutputBuffer(data: string, targetTerminal: Terminal): void {
    const entry = this.getOrCreateBufferEntry(targetTerminal);

    const normalizedData =
      data.indexOf('\f') === -1 ? data : data.replace(/\f+/g, '\u001b[2J\u001b[H');

    // Enhanced buffering strategy for CLI Agent compatibility
    const isLargeOutput = normalizedData.length >= 500; // Reduced from 1000 to 500 for better responsiveness
    const bufferFull = entry.data.length >= this.MAX_BUFFER_SIZE;
    const isSmallInput = normalizedData.length <= 10; // Immediate flush for small inputs (typing)
    const isModerateOutput = normalizedData.length >= 50; // Reduced from 100 to 50

    // Immediate flush conditions (prioritized for cursor accuracy and input responsiveness)
    const shouldFlushImmediately =
      isLargeOutput || bufferFull || isSmallInput || (this.isCliAgentMode && isModerateOutput);

    if (shouldFlushImmediately) {
      this.flushEntry(targetTerminal, entry);

      // xterm.js automatically preserves scroll position if user has scrolled up
      try {
        targetTerminal.write(normalizedData);
      } catch (error) {
        if (this.debugLoggingEnabled) {
          this.logger(`Error during immediate write: ${error}`);
        } else {
          console.error('[PerformanceManager] Error during immediate write:', error);
        }
      }

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
      entry.data.push(normalizedData);
      this.scheduleEntryFlush(targetTerminal, entry);
      if (this.debugLoggingEnabled) {
        this.logger(
          `Buffered write: ${normalizedData.length} chars (buffer: ${entry.data.length}, CLI Agent: ${this.isCliAgentMode})`
        );
      }
    }
  }

  private getOrCreateBufferEntry(terminal: Terminal): { data: string[]; timer: number | null } {
    let entry = this.bufferEntries.get(terminal);
    if (!entry) {
      entry = { data: [], timer: null };
      this.bufferEntries.set(terminal, entry);
    }
    return entry;
  }

  private scheduleEntryFlush(
    terminal: Terminal,
    entry: { data: string[]; timer: number | null }
  ): void {
    if (entry.timer === null) {
      // Dynamic flush interval based on CLI Agent state and output frequency
      let flushInterval: number = this.BUFFER_FLUSH_INTERVAL; // Default 16ms (optimized for performance)

      if (this.isCliAgentMode) {
        flushInterval = Math.max(8, this.BUFFER_FLUSH_INTERVAL / 2); // 8ms when CLI agent active
      } else if (entry.data.length > 3) {
        flushInterval = Math.max(12, this.BUFFER_FLUSH_INTERVAL * 0.75); // 12ms for high-frequency output
      }

      entry.timer = window.setTimeout(() => {
        try {
          this.flushEntryByTerminal(terminal);
        } catch (error) {
          if (this.debugLoggingEnabled) {
            this.logger(`Error during buffer flush: ${error}`);
          } else {
            console.error('[PerformanceManager] Error during buffer flush:', error);
          }
          const currentEntry = this.bufferEntries.get(terminal);
          if (currentEntry) {
            currentEntry.timer = null;
            currentEntry.data.length = 0;
          }
        }
      }, flushInterval);

      if (this.debugLoggingEnabled) {
        this.logger(
          `Scheduled flush in ${flushInterval}ms (CLI Agent: ${this.isCliAgentMode}, buffer size: ${entry.data.length})`
        );
      }
    }
  }

  private flushEntryByTerminal(terminal: Terminal): void {
    const entry = this.bufferEntries.get(terminal);
    if (entry) {
      this.flushEntry(terminal, entry);
    }
  }

  private flushEntry(terminal: Terminal, entry: { data: string[]; timer: number | null }): void {
    if (entry.timer !== null) {
      window.clearTimeout(entry.timer);
      entry.timer = null;
    }

    if (entry.data.length === 0) {
      return;
    }

    const bufferedData = entry.data.join('');
    entry.data.length = 0;

    try {
      terminal.write(bufferedData);
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
  }

  /**
   * Flush all buffered output to the current terminal
   */
  public flushOutputBuffer(): void {
    this.bufferEntries.forEach((entry, terminal) => {
      this.flushEntry(terminal, entry);
    });
  }

  /**
   * Buffered write with scroll preservation (main API method)
   */
  public bufferedWrite(data: string, targetTerminal: Terminal, terminalId: string): void {
    // Check for DSR (Device Status Report) query and respond BEFORE writing
    // This ensures we capture the cursor position before new output moves it
    // DSR query \x1b[6n requests cursor position, we respond with \x1b[row;colR
    // Wrapped in try-catch to ensure DSR handling errors don't break output
    try {
      this.handleDSRQuery(data, targetTerminal, terminalId);
    } catch (error) {
      // Log error but don't break output flow
      if (this.debugLoggingEnabled) {
        this.logger(`Error handling DSR query: ${error}`);
      }
    }

    this.scheduleOutputBuffer(data, targetTerminal);
  }

  /**
   * Handle DSR (Device Status Report) escape sequence
   *
   * When CLI tools like codex send \x1b[6n to query cursor position,
   * we respond with \x1b[row;colR format.
   *
   * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/341
   */
  private handleDSRQuery(data: string, terminal: Terminal, terminalId: string): void {
    if (!PerformanceManager.DSR_PATTERN.test(data)) {
      return;
    }

    if (!this.coordinator) {
      if (this.debugLoggingEnabled) {
        this.logger('DSR query detected but coordinator not available');
      }
      return;
    }

    // Defensive check: ensure terminal buffer is available
    if (!terminal?.buffer?.active) {
      if (this.debugLoggingEnabled) {
        this.logger('DSR query detected but terminal buffer not available');
      }
      return;
    }

    // Get cursor position from xterm.js buffer
    // Note: cursorY is 0-based but DSR response expects 1-based row number
    const buffer = terminal.buffer.active;
    const row = (buffer.cursorY ?? 0) + 1; // Convert to 1-based
    const col = (buffer.cursorX ?? 0) + 1; // Convert to 1-based

    // Send DSR response back to PTY via input channel
    // Format: \x1b[row;colR (e.g., \x1b[1;1R for row 1, column 1)
    const response = `\x1b[${row};${col}R`;

    if (this.debugLoggingEnabled) {
      this.logger(`DSR query detected, responding with cursor position: row=${row}, col=${col}`);
    }

    this.coordinator.postMessageToExtension({
      command: 'input',
      terminalId,
      data: response,
      timestamp: Date.now(),
    });
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

    // Clear any pending buffer flush timers and buffers
    this.bufferEntries.forEach((entry) => {
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      entry.data.length = 0;
    });
    this.bufferEntries.clear();
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
          // Reset xterm.js inline styles before fit to allow terminal expansion
          // terminal.element is the container element where terminal is opened
          const container = terminal.element?.parentElement;
          if (container) {
            DOMUtils.resetXtermInlineStyles(container);
          }
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
    let bufferSize = 0;
    let isFlushScheduled = false;
    this.bufferEntries.forEach((entry) => {
      bufferSize += entry.data.length;
      if (entry.timer !== null) {
        isFlushScheduled = true;
      }
    });

    return {
      bufferSize,
      isFlushScheduled,
      isCliAgentMode: this.isCliAgentMode,
      currentTerminal: this.bufferEntries.size > 0,
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
    this.bufferEntries.forEach((entry) => {
      entry.data.length = 0;
      if (entry.timer !== null) {
        window.clearTimeout(entry.timer);
        entry.timer = null;
      }
    });
  }

  /**
   * Optimize terminal performance by preloading next operations
   */
  public preloadNextOperation(): void {
    // Schedule a small flush to keep the pipeline moving
    this.bufferEntries.forEach((entry, terminal) => {
      if (entry.data.length > 0) {
        this.scheduleEntryFlush(terminal, entry);
      }
    });
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
    this.isCliAgentMode = false;
    this.bufferEntries.clear();

    // Call parent dispose
    super.dispose();

    // Safe lifecycle logging
    if (this.debugLoggingEnabled) {
      this.logger('PerformanceManager', 'completed');
    }
  }
}
