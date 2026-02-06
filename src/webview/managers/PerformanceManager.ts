/**
 * Handles output buffering, debouncing, and performance optimizations.
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

    if (this.debugLoggingEnabled) {
      this.logger('initialization', 'starting');
    }
  }

  private readonly bufferEntries = new Map<Terminal, BufferEntry>();
  private readonly BUFFER_FLUSH_INTERVAL = SPLIT_CONSTANTS.BUFFER_FLUSH_INTERVAL;
  private readonly MAX_BUFFER_SIZE = SPLIT_CONSTANTS.MAX_BUFFER_SIZE;
  private readonly debugLoggingEnabled = ENABLE_WEBVIEW_DEBUG_LOGS;

  // CLI Agent mode for performance optimization
  private isCliAgentMode = false;

  /** DSR (Device Status Report) sequence pattern - \x1b[6n queries cursor position */
  private static readonly DSR_PATTERN = /\x1b\[6n/;

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
        let reason: string;
        if (isLargeOutput) {
          reason = 'large output';
        } else if (bufferFull) {
          reason = 'buffer full';
        } else if (isSmallInput) {
          reason = 'small input (typing)';
        } else if (this.isCliAgentMode && isModerateOutput) {
          reason = 'CLI Agent mode';
        } else {
          reason = 'unknown';
        }
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

  private getOrCreateBufferEntry(terminal: Terminal): BufferEntry {
    let entry = this.bufferEntries.get(terminal);
    if (!entry) {
      entry = { data: [], timer: null, timerType: null };
      this.bufferEntries.set(terminal, entry);
    }
    return entry;
  }

  private scheduleEntryFlush(
    terminal: Terminal,
    entry: BufferEntry
  ): void {
    if (entry.timer === null) {
      // Use requestAnimationFrame for display-synchronized flushing.
      // For CLI Agent mode with very low latency needs, use setTimeout fallback.
      const useRAF = !this.isCliAgentMode;

      if (useRAF) {
        // requestAnimationFrame syncs with display refresh (typically ~16ms at 60Hz)
        entry.timer = requestAnimationFrame(() => {
          try {
            this.flushEntryByTerminal(terminal);
          } catch (error) {
            if (this.debugLoggingEnabled) {
              this.logger(`Error during rAF buffer flush: ${error}`);
            } else {
              console.error('[PerformanceManager] Error during rAF buffer flush:', error);
            }
            const currentEntry = this.bufferEntries.get(terminal);
            if (currentEntry) {
              currentEntry.timer = null;
              currentEntry.timerType = null;
              currentEntry.data.length = 0;
            }
          }
        });
        entry.timerType = 'raf';
      } else {
        // CLI Agent mode: use setTimeout with fast interval for lower latency
        const flushInterval = SPLIT_CONSTANTS.CLI_AGENT_FLUSH_INTERVAL ?? Math.max(8, this.BUFFER_FLUSH_INTERVAL / 2);

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
              currentEntry.timerType = null;
              currentEntry.data.length = 0;
            }
          }
        }, flushInterval);
        entry.timerType = 'timeout';
      }

      if (this.debugLoggingEnabled) {
        this.logger(
          `Scheduled flush via ${useRAF ? 'rAF' : 'setTimeout'} (CLI Agent: ${this.isCliAgentMode}, buffer size: ${entry.data.length})`
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

  private flushEntry(terminal: Terminal, entry: BufferEntry): void {
    this.clearEntryTimer(entry);

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

  public flushOutputBuffer(): void {
    this.bufferEntries.forEach((entry, terminal) => {
      this.flushEntry(terminal, entry);
    });
  }

  public bufferedWrite(data: string, targetTerminal: Terminal, terminalId: string): void {
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

  /** Handle DSR (Device Status Report) - respond with cursor position when \x1b[6n is received. */
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

    if (!terminal?.buffer?.active) {
      if (this.debugLoggingEnabled) {
        this.logger('DSR query detected but terminal buffer not available');
      }
      return;
    }

    const buffer = terminal.buffer.active;
    const row = (buffer.cursorY ?? 0) + 1;
    const col = (buffer.cursorX ?? 0) + 1;
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

  private coordinator: IManagerCoordinator | null = null;

  protected doInitialize(): void {
    if (this.debugLoggingEnabled) {
      this.logger('initialization', 'completed');
    }
  }

  protected doDispose(): void {
    if (this.debugLoggingEnabled) {
      this.logger('disposal', 'starting');
    }

    this.bufferEntries.forEach((entry) => {
      this.clearEntryTimer(entry);
      entry.data.length = 0;
    });
    this.bufferEntries.clear();
    this.coordinator = null;

    if (this.debugLoggingEnabled) {
      this.logger('disposal', 'completed');
    }
  }

  public initializePerformance(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    if (this.debugLoggingEnabled) {
      this.logger('initialization', 'completed');
    }
  }

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

  public setCliAgentMode(isActive: boolean): void {
    if (this.isCliAgentMode !== isActive) {
      this.isCliAgentMode = isActive;
      if (this.debugLoggingEnabled) {
        this.logger(`CLI Agent mode: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
      }

      if (!isActive) {
        this.flushOutputBuffer();
      }
    }
  }

  public getCliAgentMode(): boolean {
    return this.isCliAgentMode;
  }

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

  public forceFlush(): void {
    if (this.debugLoggingEnabled) {
      this.logger('Force flushing all buffers');
    }
    this.flushOutputBuffer();
  }

  public clearBuffers(): void {
    if (this.debugLoggingEnabled) {
      this.logger('Clearing all buffers without writing');
    }
    this.bufferEntries.forEach((entry) => {
      entry.data.length = 0;
      this.clearEntryTimer(entry);
    });
  }

  public preloadNextOperation(): void {
    this.bufferEntries.forEach((entry, terminal) => {
      if (entry.data.length > 0) {
        this.scheduleEntryFlush(terminal, entry);
      }
    });
  }

  public override dispose(): void {
    if (this.debugLoggingEnabled) {
      this.logger('Disposing performance manager');
    }

    this.flushOutputBuffer();
    ResizeManager.clearResize('terminal-resize');
    this.isCliAgentMode = false;
    this.bufferEntries.clear();
    super.dispose();

    if (this.debugLoggingEnabled) {
      this.logger('PerformanceManager', 'completed');
    }
  }

  private clearEntryTimer(entry: BufferEntry): void {
    if (entry.timer === null) {
      return;
    }

    if (entry.timerType === 'raf') {
      cancelAnimationFrame(entry.timer);
    } else {
      window.clearTimeout(entry.timer);
    }

    entry.timer = null;
    entry.timerType = null;
  }
}

type BufferEntry = {
  data: string[];
  timer: number | null;
  timerType: 'raf' | 'timeout' | null;
};
