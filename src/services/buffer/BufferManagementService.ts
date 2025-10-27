/**
 * Buffer Management Service Implementation
 *
 * Manages terminal output buffering with adaptive flushing strategies.
 */

import type { EventBus } from '../../core/EventBus';
import { createEventType } from '../../core/EventBus';
import type {
  IBufferManagementService,
  BufferConfig,
  BufferStats,
} from './IBufferManagementService';

/**
 * Default buffer configuration
 */
const DEFAULT_BUFFER_CONFIG: BufferConfig = {
  flushInterval: 16, // 60fps for normal output
  maxBufferSize: 50, // characters
  adaptiveBuffering: true,
};

/**
 * CLI Agent mode configuration
 */
const CLI_AGENT_BUFFER_CONFIG: Partial<BufferConfig> = {
  flushInterval: 4, // 250fps for CLI agents
};

/**
 * Internal buffer state
 */
interface BufferState {
  buffer: string[];
  config: BufferConfig;
  timer: NodeJS.Timeout | null;
  stats: {
    flushCount: number;
    totalFlushTime: number;
    lastFlushAt: Date;
  };
  cliAgentActive: boolean;
}

/**
 * Buffer events
 */
export const BufferFlushedEvent = createEventType<{
  terminalId: number;
  data: string;
  size: number;
}>('buffer.flushed');

export const BufferOverflowEvent = createEventType<{
  terminalId: number;
  size: number;
  maxSize: number;
}>('buffer.overflow');

/**
 * Buffer Management Service Implementation
 */
export class BufferManagementService implements IBufferManagementService {
  private readonly _buffers = new Map<number, BufferState>();
  private _isDisposed = false;

  constructor(private readonly _eventBus: EventBus) {}

  initializeBuffer(terminalId: number, config?: Partial<BufferConfig>): void {
    this._ensureNotDisposed();

    if (this._buffers.has(terminalId)) {
      // Already initialized, just update config
      const state = this._buffers.get(terminalId)!;
      state.config = { ...state.config, ...config };
      return;
    }

    const fullConfig: BufferConfig = {
      ...DEFAULT_BUFFER_CONFIG,
      ...config,
    };

    const state: BufferState = {
      buffer: [],
      config: fullConfig,
      timer: null,
      stats: {
        flushCount: 0,
        totalFlushTime: 0,
        lastFlushAt: new Date(),
      },
      cliAgentActive: false,
    };

    this._buffers.set(terminalId, state);
    this._startFlushTimer(terminalId);
  }

  write(terminalId: number, data: string): boolean {
    this._ensureNotDisposed();

    const state = this._buffers.get(terminalId);
    if (!state) {
      // Initialize on-demand
      this.initializeBuffer(terminalId);
      return this.write(terminalId, data);
    }

    state.buffer.push(data);

    // Check for overflow
    const currentSize = state.buffer.join('').length;
    if (currentSize >= state.config.maxBufferSize) {
      this._eventBus.publish(BufferOverflowEvent, {
        terminalId,
        size: currentSize,
        maxSize: state.config.maxBufferSize,
      });

      // Flush immediately on overflow
      this.flush(terminalId);
      return false; // Flushed immediately
    }

    return true; // Buffered
  }

  flush(terminalId: number): string {
    this._ensureNotDisposed();

    const state = this._buffers.get(terminalId);
    if (!state || state.buffer.length === 0) {
      return '';
    }

    const data = state.buffer.join('');
    state.buffer = [];

    // Update stats
    state.stats.flushCount++;
    state.stats.lastFlushAt = new Date();

    // Publish event
    this._eventBus.publish(BufferFlushedEvent, {
      terminalId,
      data,
      size: data.length,
    });

    return data;
  }

  flushAll(): Map<number, string> {
    this._ensureNotDisposed();

    const result = new Map<number, string>();

    for (const [terminalId] of this._buffers) {
      const data = this.flush(terminalId);
      if (data) {
        result.set(terminalId, data);
      }
    }

    return result;
  }

  setFlushInterval(terminalId: number, interval: number): void {
    this._ensureNotDisposed();

    const state = this._buffers.get(terminalId);
    if (!state) {
      return;
    }

    state.config.flushInterval = interval;

    // Restart timer with new interval
    this._stopFlushTimer(terminalId);
    this._startFlushTimer(terminalId);
  }

  getFlushInterval(terminalId: number): number {
    const state = this._buffers.get(terminalId);
    return state?.config.flushInterval ?? DEFAULT_BUFFER_CONFIG.flushInterval;
  }

  enableAdaptiveBuffering(terminalId: number): void {
    this._ensureNotDisposed();

    const state = this._buffers.get(terminalId);
    if (state) {
      state.config.adaptiveBuffering = true;
    }
  }

  disableAdaptiveBuffering(terminalId: number): void {
    this._ensureNotDisposed();

    const state = this._buffers.get(terminalId);
    if (state) {
      state.config.adaptiveBuffering = false;
    }
  }

  onCliAgentDetected(terminalId: number): void {
    this._ensureNotDisposed();

    const state = this._buffers.get(terminalId);
    if (!state) {
      return;
    }

    state.cliAgentActive = true;

    // Switch to high-performance mode if adaptive buffering is enabled
    if (state.config.adaptiveBuffering) {
      this.setFlushInterval(terminalId, CLI_AGENT_BUFFER_CONFIG.flushInterval!);
    }
  }

  onCliAgentDisconnected(terminalId: number): void {
    this._ensureNotDisposed();

    const state = this._buffers.get(terminalId);
    if (!state) {
      return;
    }

    state.cliAgentActive = false;

    // Return to normal mode if adaptive buffering is enabled
    if (state.config.adaptiveBuffering) {
      this.setFlushInterval(terminalId, DEFAULT_BUFFER_CONFIG.flushInterval);
    }
  }

  getBufferStats(terminalId: number): BufferStats | undefined {
    const state = this._buffers.get(terminalId);
    if (!state) {
      return undefined;
    }

    const currentSize = state.buffer.join('').length;
    const avgFlushInterval =
      state.stats.flushCount > 0
        ? state.stats.totalFlushTime / state.stats.flushCount
        : 0;

    return {
      terminalId,
      currentSize,
      flushCount: state.stats.flushCount,
      avgFlushInterval,
      lastFlushAt: state.stats.lastFlushAt,
    };
  }

  getAllBufferStats(): BufferStats[] {
    const stats: BufferStats[] = [];

    for (const [terminalId] of this._buffers) {
      const stat = this.getBufferStats(terminalId);
      if (stat) {
        stats.push(stat);
      }
    }

    return stats;
  }

  clearBuffer(terminalId: number): void {
    this._ensureNotDisposed();

    const state = this._buffers.get(terminalId);
    if (state) {
      state.buffer = [];
    }
  }

  disposeBuffer(terminalId: number): void {
    this._ensureNotDisposed();

    // Flush any remaining data
    this.flush(terminalId);

    // Stop timer
    this._stopFlushTimer(terminalId);

    // Remove buffer state
    this._buffers.delete(terminalId);
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    // Flush all buffers
    this.flushAll();

    // Stop all timers
    for (const [terminalId] of this._buffers) {
      this._stopFlushTimer(terminalId);
    }

    // Clear all buffers
    this._buffers.clear();

    this._isDisposed = true;
  }

  private _startFlushTimer(terminalId: number): void {
    const state = this._buffers.get(terminalId);
    if (!state) {
      return;
    }

    // Stop existing timer if any
    this._stopFlushTimer(terminalId);

    // Start new timer
    state.timer = setInterval(() => {
      if (state.buffer.length > 0) {
        this.flush(terminalId);
      }
    }, state.config.flushInterval);
  }

  private _stopFlushTimer(terminalId: number): void {
    const state = this._buffers.get(terminalId);
    if (state?.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  private _ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('Cannot use disposed BufferManagementService');
    }
  }
}
