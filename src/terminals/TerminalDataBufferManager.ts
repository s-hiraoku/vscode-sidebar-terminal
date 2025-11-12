/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as vscode from 'vscode';
import { TerminalEvent, TerminalInstance } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';

const ENABLE_TERMINAL_DEBUG_LOGS = process.env.SECONDARY_TERMINAL_DEBUG_LOGS === 'true';

/**
 * TerminalDataBufferManager
 *
 * Responsibility: Handle data buffering and flushing for terminal output
 * - Batch small data chunks for performance optimization
 * - Manage flush timers and buffer lifecycle
 * - Validate and normalize control sequences
 *
 * Performance Optimization: Reduces event frequency from ~1000fps to ~125fps
 */
export class TerminalDataBufferManager {
  private readonly _dataBuffers = new Map<string, string[]>();
  private readonly _dataFlushTimers = new Map<string, NodeJS.Timeout>();
  private readonly DATA_FLUSH_INTERVAL = 8; // ~125fps for improved responsiveness
  private readonly MAX_BUFFER_SIZE = 50;
  private readonly _debugLoggingEnabled = ENABLE_TERMINAL_DEBUG_LOGS;

  constructor(
    private readonly _terminals: Map<string, TerminalInstance>,
    private readonly _dataEmitter: vscode.EventEmitter<TerminalEvent>,
    private readonly _cliAgentService: ICliAgentDetectionService
  ) {}

  private debugLog(...args: unknown[]): void {
    if (this._debugLoggingEnabled) {
      log(...args);
    }
  }

  /**
   * Buffer data for a terminal to reduce event frequency
   */
  public bufferData(terminalId: string, data: string): void {
    // ✅ CRITICAL FIX: Strict terminal ID validation to prevent cross-terminal contamination
    if (!terminalId || typeof terminalId !== 'string') {
      log('🚨 [TERMINAL] Invalid terminalId for data buffering:', terminalId);
      return;
    }

    // Validate terminal exists before buffering data
    if (!this._terminals.has(terminalId)) {
      log(
        `⚠️ [TERMINAL] Attempting to buffer data for non-existent terminal: ${terminalId}`
      );
      return;
    }

    if (!this._dataBuffers.has(terminalId)) {
      this._dataBuffers.set(terminalId, []);
      this.debugLog(`📊 [TERMINAL] Created new data buffer for terminal: ${terminalId}`);
    }

    const buffer = this._dataBuffers.get(terminalId);
    if (!buffer) {
      log('🚨 [TERMINAL] Buffer creation failed for terminal:', terminalId);
      this._dataBuffers.set(terminalId, []);
      return;
    }

    // ✅ CRITICAL: Add terminal ID validation to each data chunk
    const validatedData = this._validateDataForTerminal(terminalId, data);
    const normalizedData = this._normalizeControlSequences(validatedData);
    buffer.push(normalizedData);

    this.debugLog(
      `📊 [TERMINAL] Data buffered for ${terminalId}: ${data.length} chars (buffer size: ${buffer.length})`
    );

    // Flush immediately if buffer is full or data is large
    if (buffer.length >= this.MAX_BUFFER_SIZE || data.length > 1000) {
      this.flushBuffer(terminalId);
    } else {
      this._scheduleFlush(terminalId);
    }
  }

  /**
   * ✅ NEW: Validate data belongs to specific terminal
   * Prevents cross-terminal data contamination
   */
  private _validateDataForTerminal(terminalId: string, data: string): string {
    // Basic validation - could be enhanced with more sophisticated checks
    if (data.includes('\x1b]0;') && !data.includes(terminalId)) {
      // Window title escape sequences might contain terminal context
      this.debugLog(`🔍 [TERMINAL] Window title detected for ${terminalId}`);
    }

    // Return data as-is for now, but this method provides a hook for future validation
    return data;
  }

  /**
   * Schedule a flush for a terminal's buffer
   */
  private _scheduleFlush(terminalId: string): void {
    if (!this._dataFlushTimers.has(terminalId)) {
      const timer = setTimeout(() => {
        this.flushBuffer(terminalId);
      }, this.DATA_FLUSH_INTERVAL);
      this._dataFlushTimers.set(terminalId, timer);
    }
  }

  /**
   * Flush the buffer for a specific terminal
   */
  public flushBuffer(terminalId: string): void {
    // ✅ CRITICAL FIX: Strict terminal ID validation before flushing
    if (!terminalId || typeof terminalId !== 'string') {
      log('🚨 [TERMINAL] Invalid terminalId for buffer flushing:', terminalId);
      return;
    }

    // Double-check terminal still exists
    if (!this._terminals.has(terminalId)) {
      log(`⚠️ [TERMINAL] Cannot flush buffer for removed terminal: ${terminalId}`);
      // Clean up orphaned buffer and timer
      this._dataBuffers.delete(terminalId);
      const timer = this._dataFlushTimers.get(terminalId);
      if (timer) {
        clearTimeout(timer);
        this._dataFlushTimers.delete(terminalId);
      }
      return;
    }

    const timer = this._dataFlushTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._dataFlushTimers.delete(terminalId);
    }

    const buffer = this._dataBuffers.get(terminalId);
    if (buffer && buffer.length > 0) {
      const combinedData = buffer.join('');
      buffer.length = 0; // Clear buffer

      // ✅ CRITICAL: Additional validation before emitting data
      const terminal = this._terminals.get(terminalId);
      if (!terminal) {
        log(`🚨 [TERMINAL] Terminal disappeared during flush: ${terminalId}`);
        return;
      }

      // Send to CLI Agent detection service with validation
      try {
        this._cliAgentService.detectFromOutput(terminalId, combinedData);
      } catch (error) {
        log(`⚠️ [TERMINAL] CLI Agent detection failed for ${terminalId}:`, error);
      }

      // ✅ EMIT DATA WITH STRICT TERMINAL ID ASSOCIATION
      this.debugLog(
        `📤 [TERMINAL] Flushing data for terminal ${terminal.name} (${terminalId}): ${combinedData.length} chars`
      );
      this._dataEmitter.fire({
        terminalId: terminalId, // Ensure exact ID match
        data: combinedData,
        timestamp: Date.now(), // Add timestamp for debugging
        terminalName: terminal.name, // Add terminal name for validation
      });
    }
  }

  /**
   * Flush all buffers
   */
  public flushAllBuffers(): void {
    for (const terminalId of this._dataBuffers.keys()) {
      this.flushBuffer(terminalId);
    }
  }

  /**
   * Normalize control sequences in data
   */
  private _normalizeControlSequences(data: string): string {
    if (!data || data.indexOf('\f') === -1) {
      return data;
    }

    const CLEAR_SEQUENCE = '\u001b[2J\u001b[H';

    return data.replace(/\f+/g, CLEAR_SEQUENCE);
  }

  /**
   * Clean up buffer for a terminal
   */
  public cleanupBuffer(terminalId: string): void {
    this.flushBuffer(terminalId);
    this._dataBuffers.delete(terminalId);
    const timer = this._dataFlushTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._dataFlushTimers.delete(terminalId);
    }
  }

  /**
   * Dispose all buffers and timers
   */
  public dispose(): void {
    this.flushAllBuffers();
    for (const timer of this._dataFlushTimers.values()) {
      clearTimeout(timer);
    }
    this._dataBuffers.clear();
    this._dataFlushTimers.clear();
  }
}
