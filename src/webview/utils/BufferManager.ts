/**
 * Unified buffer management utility for terminal output
 * Eliminates duplicate buffering logic and provides configurable strategies
 */

export interface BufferOptions {
  maxBufferSize?: number;
  defaultFlushInterval?: number;
  claudeCodeFlushInterval?: number;
  highFrequencyFlushInterval?: number;
  highFrequencyThreshold?: number;
  largeOutputThreshold?: number;
  moderateOutputThreshold?: number;
}

export interface BufferMetrics {
  bufferSize: number;
  totalFlushes: number;
  averageFlushInterval: number;
  lastFlushTime: number;
}

export type FlushCallback = (data: string) => void;

/**
 * Manages buffered output with adaptive flushing strategies
 */
export class BufferManager {
  private buffer: string[] = [];
  private flushTimer: number | null = null;
  private readonly options: Required<BufferOptions>;
  private metrics: BufferMetrics;
  private flushCallback: FlushCallback | null = null;

  // Adaptive state tracking
  private isClaudeCodeActive = false;
  private recentFlushIntervals: number[] = [];

  constructor(options: BufferOptions = {}) {
    this.options = {
      maxBufferSize: options.maxBufferSize ?? 50,
      defaultFlushInterval: options.defaultFlushInterval ?? 16,
      claudeCodeFlushInterval: options.claudeCodeFlushInterval ?? 4,
      highFrequencyFlushInterval: options.highFrequencyFlushInterval ?? 8,
      highFrequencyThreshold: options.highFrequencyThreshold ?? 5,
      largeOutputThreshold: options.largeOutputThreshold ?? 1000,
      moderateOutputThreshold: options.moderateOutputThreshold ?? 100,
    };

    this.metrics = {
      bufferSize: 0,
      totalFlushes: 0,
      averageFlushInterval: this.options.defaultFlushInterval,
      lastFlushTime: 0,
    };
  }

  /**
   * Set the callback function to handle flushed data
   */
  public setFlushCallback(callback: FlushCallback): void {
    this.flushCallback = callback;
  }

  /**
   * Add data to buffer with intelligent flushing
   */
  public addData(data: string): void {
    const dataSize = data.length;
    const isLargeOutput = dataSize >= this.options.largeOutputThreshold;
    const isModerateOutput = dataSize >= this.options.moderateOutputThreshold;
    const bufferFull = this.buffer.length >= this.options.maxBufferSize;

    // Immediate flush conditions (prioritized for cursor accuracy)
    const shouldFlushImmediately =
      isLargeOutput || bufferFull || (this.isClaudeCodeActive && isModerateOutput);

    if (shouldFlushImmediately) {
      this.flush();
      if (this.flushCallback) {
        this.flushCallback(data);
      }

      const reason = this.isClaudeCodeActive
        ? 'Claude Code mode'
        : isLargeOutput
          ? 'large output'
          : 'buffer full';

      this.logFlush(`Immediate write: ${dataSize} chars (${reason})`);
    } else {
      this.buffer.push(data);
      this.scheduleFlush();
      this.logFlush(
        `Buffered write: ${dataSize} chars (buffer: ${this.buffer.length}, Claude Code: ${this.isClaudeCodeActive})`
      );
    }

    this.updateMetrics();
  }

  /**
   * Set Claude Code activity state for adaptive flushing
   */
  public setClaudeCodeActive(active: boolean): void {
    this.isClaudeCodeActive = active;
  }

  /**
   * Get current Claude Code activity state
   */
  public isClaudeCodeMode(): boolean {
    return this.isClaudeCodeActive;
  }

  /**
   * Schedule a buffer flush with adaptive timing
   */
  private scheduleFlush(): void {
    if (this.flushTimer === null) {
      const flushInterval = this.calculateFlushInterval();

      this.flushTimer = window.setTimeout(() => {
        this.flush();
      }, flushInterval);

      this.recentFlushIntervals.push(flushInterval);
      // Keep only recent intervals for average calculation
      if (this.recentFlushIntervals.length > 10) {
        this.recentFlushIntervals.shift();
      }

      this.logFlush(
        `Scheduled flush in ${flushInterval}ms (Claude Code: ${this.isClaudeCodeActive}, buffer size: ${this.buffer.length})`
      );
    }
  }

  /**
   * Calculate optimal flush interval based on current conditions
   */
  private calculateFlushInterval(): number {
    if (this.isClaudeCodeActive) {
      // Claude Code active: Use very aggressive flushing for cursor accuracy
      return this.options.claudeCodeFlushInterval;
    } else if (this.buffer.length > this.options.highFrequencyThreshold) {
      // High-frequency output: Use shorter interval
      return this.options.highFrequencyFlushInterval;
    }

    return this.options.defaultFlushInterval;
  }

  /**
   * Flush the buffer immediately
   */
  public flush(): void {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length > 0) {
      const bufferedData = this.buffer.join('');
      this.buffer = [];

      if (this.flushCallback) {
        this.flushCallback(bufferedData);
      }

      this.metrics.totalFlushes++;
      this.metrics.lastFlushTime = Date.now();
      this.logFlush(`Flushed buffer: ${bufferedData.length} chars`);
    }
  }

  /**
   * Clear buffer and cancel any pending flush
   */
  public clear(): void {
    this.buffer = [];
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Get current buffer metrics
   */
  public getMetrics(): BufferMetrics {
    return {
      ...this.metrics,
      bufferSize: this.buffer.length,
      averageFlushInterval:
        this.recentFlushIntervals.length > 0
          ? this.recentFlushIntervals.reduce((a, b) => a + b, 0) / this.recentFlushIntervals.length
          : this.options.defaultFlushInterval,
    };
  }

  /**
   * Check if buffer has pending data
   */
  public hasData(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * Get current buffer size
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(): void {
    this.metrics.bufferSize = this.buffer.length;
  }

  /**
   * Log buffer operations (can be overridden for custom logging)
   */
  protected logFlush(message: string): void {
    // Default implementation - can be overridden by subclasses
    if (typeof console !== 'undefined') {
      console.log(`📊 [BUFFER] ${message}`);
    }
  }

  /**
   * Dispose of resources and clear timers
   */
  public dispose(): void {
    this.clear();
    this.flushCallback = null;
  }
}

/**
 * Factory function for creating configured buffer managers
 */
export function createTerminalBufferManager(options?: BufferOptions): BufferManager {
  return new BufferManager({
    maxBufferSize: 50,
    defaultFlushInterval: 16, // ~60fps
    claudeCodeFlushInterval: 4, // Very aggressive for Claude Code
    highFrequencyFlushInterval: 8, // Faster for frequent output
    highFrequencyThreshold: 5,
    largeOutputThreshold: 1000,
    moderateOutputThreshold: 100,
    ...options,
  });
}

/**
 * Specialized buffer manager with logging integration
 */
export class LoggingBufferManager extends BufferManager {
  private logger?: (message: string) => void;

  constructor(options: BufferOptions = {}, logger?: (message: string) => void) {
    super(options);
    this.logger = logger;
  }

  protected override logFlush(message: string): void {
    if (this.logger) {
      this.logger(message);
    } else {
      super.logFlush(message);
    }
  }
}
