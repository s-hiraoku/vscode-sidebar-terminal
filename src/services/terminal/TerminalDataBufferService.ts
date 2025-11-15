import * as vscode from 'vscode';
import { terminal as log } from '../../utils/logger';
import { TerminalEvent } from '../../types/shared';
import { PERFORMANCE_CONSTANTS } from '../../constants/SystemConstants';

/**
 * Interface for terminal data buffer configuration
 */
interface BufferConfig {
  flushInterval?: number;
  maxBufferSize?: number;
  cliAgentFlushInterval?: number;
}

/**
 * Service responsible for buffering and batching terminal data output
 *
 * This service extracts data buffering logic from TerminalManager to improve:
 * - Performance through intelligent batching
 * - Responsiveness during CLI Agent operations
 * - Memory efficiency with bounded buffers
 * - Testability with isolated buffer logic
 */
export class TerminalDataBufferService {
  private readonly _dataEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _dataBuffers = new Map<string, string[]>();
  private readonly _dataFlushTimers = new Map<string, NodeJS.Timeout>();

  private readonly _config: Required<BufferConfig>;

  // CLI Agent detection for adaptive buffering
  private _isCliAgentActive = false;

  public readonly onData = this._dataEmitter.event;

  constructor(config: BufferConfig = {}) {
    this._config = {
      flushInterval:
        config.flushInterval ?? PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS, // ~60fps default
      maxBufferSize: config.maxBufferSize ?? PERFORMANCE_CONSTANTS.MAX_BUFFER_CHUNK_COUNT,
      cliAgentFlushInterval:
        config.cliAgentFlushInterval ?? PERFORMANCE_CONSTANTS.CLI_AGENT_FAST_FLUSH_INTERVAL_MS, // ~250fps for CLI agents
    };

    log('🚰 [DataBuffer] Service initialized with config:', this._config);
  }

  /**
   * Buffer terminal data with intelligent batching
   */
  bufferData(terminalId: string, data: string): void {
    try {
      // Initialize buffer if needed
      if (!this._dataBuffers.has(terminalId)) {
        this._dataBuffers.set(terminalId, []);
      }

      const buffer = this._dataBuffers.get(terminalId)!;
      buffer.push(data);

      log(
        `📦 [DataBuffer] Buffered ${data.length} chars for terminal ${terminalId} (buffer: ${buffer.length}/${this._config.maxBufferSize})`
      );

      // Immediate flush for large data chunks or full buffers
      if (
        data.length >= PERFORMANCE_CONSTANTS.IMMEDIATE_FLUSH_THRESHOLD_BYTES ||
        buffer.length >= this._config.maxBufferSize
      ) {
        this.flushBuffer(terminalId);
        return;
      }

      // Set up delayed flush if not already pending
      if (!this._dataFlushTimers.has(terminalId)) {
        this.scheduleFlush(terminalId);
      }
    } catch (error) {
      log('❌ [DataBuffer] Error buffering data:', error);
      // Fallback: emit data immediately
      this.emitData(terminalId, data);
    }
  }

  /**
   * Set CLI Agent active state for adaptive buffering
   */
  setCliAgentActive(isActive: boolean): void {
    if (this._isCliAgentActive !== isActive) {
      this._isCliAgentActive = isActive;
      log(
        `🤖 [DataBuffer] CLI Agent mode: ${isActive ? 'ACTIVE' : 'INACTIVE'} (flush interval: ${this.getCurrentFlushInterval()}ms)`
      );

      // If CLI Agent becomes active, flush all pending buffers immediately for responsiveness
      if (isActive) {
        this.flushAllBuffers();
      }
    }
  }

  /**
   * Force flush buffer for a specific terminal
   */
  flushBuffer(terminalId: string): void {
    try {
      const buffer = this._dataBuffers.get(terminalId);
      const timer = this._dataFlushTimers.get(terminalId);

      if (timer) {
        clearTimeout(timer);
        this._dataFlushTimers.delete(terminalId);
      }

      if (buffer && buffer.length > 0) {
        const combinedData = buffer.join('');
        buffer.length = 0; // Clear buffer efficiently

        log(`🚰 [DataBuffer] Flushing ${combinedData.length} chars for terminal ${terminalId}`);
        this.emitData(terminalId, combinedData);
      }
    } catch (error) {
      log('❌ [DataBuffer] Error flushing buffer:', error);
    }
  }

  /**
   * Flush all pending buffers
   */
  flushAllBuffers(): void {
    log('🚰 [DataBuffer] Flushing all buffers');

    try {
      for (const terminalId of this._dataBuffers.keys()) {
        this.flushBuffer(terminalId);
      }
    } catch (error) {
      log('❌ [DataBuffer] Error flushing all buffers:', error);
    }
  }

  /**
   * Clear buffer for a terminated terminal
   */
  clearTerminalBuffer(terminalId: string): void {
    try {
      // Flush any pending data before clearing
      this.flushBuffer(terminalId);

      // Remove buffer and timer
      this._dataBuffers.delete(terminalId);

      const timer = this._dataFlushTimers.get(terminalId);
      if (timer) {
        clearTimeout(timer);
        this._dataFlushTimers.delete(terminalId);
      }

      log(`🧹 [DataBuffer] Cleared buffer for terminal ${terminalId}`);
    } catch (error) {
      log('❌ [DataBuffer] Error clearing terminal buffer:', error);
    }
  }

  /**
   * Get current buffer statistics for debugging
   */
  getBufferStats(): {
    activeBuffers: number;
    totalBufferedChars: number;
    pendingFlushes: number;
    isCliAgentActive: boolean;
    flushInterval: number;
  } {
    const totalBufferedChars = Array.from(this._dataBuffers.values()).reduce(
      (total, buffer) => total + buffer.reduce((sum, data) => sum + data.length, 0),
      0
    );

    return {
      activeBuffers: this._dataBuffers.size,
      totalBufferedChars,
      pendingFlushes: this._dataFlushTimers.size,
      isCliAgentActive: this._isCliAgentActive,
      flushInterval: this.getCurrentFlushInterval(),
    };
  }

  /**
   * Schedule flush with appropriate timing
   */
  private scheduleFlush(terminalId: string): void {
    const flushInterval = this.getCurrentFlushInterval();

    const timer = setTimeout(() => {
      this._dataFlushTimers.delete(terminalId);
      this.flushBuffer(terminalId);
    }, flushInterval);

    this._dataFlushTimers.set(terminalId, timer);
  }

  /**
   * Get current flush interval based on CLI Agent activity
   */
  private getCurrentFlushInterval(): number {
    return this._isCliAgentActive ? this._config.cliAgentFlushInterval : this._config.flushInterval;
  }

  /**
   * Emit data event
   */
  private emitData(terminalId: string, data: string): void {
    this._dataEmitter.fire({
      terminalId,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [DataBuffer] Disposing data buffer service');

    try {
      // Clear all timers
      for (const timer of this._dataFlushTimers.values()) {
        clearTimeout(timer);
      }
      this._dataFlushTimers.clear();

      // Clear all buffers
      this._dataBuffers.clear();

      // Dispose event emitter
      this._dataEmitter.dispose();

      log('✅ [DataBuffer] Data buffer service disposed');
    } catch (error) {
      log('❌ [DataBuffer] Error disposing data buffer service:', error);
    }
  }
}
