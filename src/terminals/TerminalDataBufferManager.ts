/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as vscode from 'vscode';
import { TerminalEvent, TerminalInstance } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';
import { PERFORMANCE_CONSTANTS } from '../constants/SystemConstants';

const ENABLE_TERMINAL_DEBUG_LOGS = process.env.SECONDARY_TERMINAL_DEBUG_LOGS === 'true';

/** Handles data buffering and flushing for terminal output (~125fps batch rate) */
export class TerminalDataBufferManager {
  private readonly _dataBuffers = new Map<string, string[]>();
  private readonly _dataFlushTimers = new Map<string, NodeJS.Timeout>();
  private readonly DATA_FLUSH_INTERVAL = PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS; // 16ms (60fps) - unified via PerformanceConstants
  private readonly MAX_BUFFER_SIZE = 50;
  private readonly _debugLoggingEnabled = ENABLE_TERMINAL_DEBUG_LOGS;
  private readonly _ansiFilterState = new Map<
    string,
    { mode: 'normal' | 'esc' | 'csi'; csiParams: string }
  >();

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

  public bufferData(terminalId: string, data: string): void {
    if (!terminalId || typeof terminalId !== 'string' || !this._terminals.has(terminalId)) {
      return;
    }

    if (!this._dataBuffers.has(terminalId)) {
      this._dataBuffers.set(terminalId, []);
    }

    const buffer = this._dataBuffers.get(terminalId);
    if (!buffer) {
      this._dataBuffers.set(terminalId, []);
      return;
    }

    const normalizedData = this._normalizeControlSequences(terminalId, data);
    buffer.push(normalizedData);

    if (buffer.length >= this.MAX_BUFFER_SIZE || data.length > 1000) {
      this.flushBuffer(terminalId);
    } else {
      this._scheduleFlush(terminalId);
    }
  }

  private _scheduleFlush(terminalId: string): void {
    if (!this._dataFlushTimers.has(terminalId)) {
      const timer = setTimeout(() => this.flushBuffer(terminalId), this.DATA_FLUSH_INTERVAL);
      this._dataFlushTimers.set(terminalId, timer);
    }
  }

  public flushBuffer(terminalId: string): void {
    if (!terminalId || typeof terminalId !== 'string') {
      return;
    }

    if (!this._terminals.has(terminalId)) {
      this._dataBuffers.delete(terminalId);
      this._ansiFilterState.delete(terminalId);
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
      buffer.length = 0;

      const terminal = this._terminals.get(terminalId);
      if (!terminal) {
        return;
      }

      try {
        this._cliAgentService.detectFromOutput(terminalId, combinedData);

        const getAgentState = (this._cliAgentService as unknown as {
          getAgentState?: (id: string) => { status: 'connected' | 'disconnected' | 'none' } | null;
        }).getAgentState;
        const detectTermination = (this._cliAgentService as unknown as {
          detectTermination?: (id: string, data: string) => { isTerminated: boolean } | null;
        }).detectTermination;

        if (typeof getAgentState === 'function' && typeof detectTermination === 'function') {
          const agentState = getAgentState(terminalId);
          if (agentState?.status && agentState.status !== 'none') {
            detectTermination(terminalId, combinedData);
          }
        }
      } catch {
        // Ignore CLI Agent detection errors
      }

      this._dataEmitter.fire({
        terminalId,
        data: combinedData,
        timestamp: Date.now(),
        terminalName: terminal.name,
      });
    }
  }

  public flushAllBuffers(): void {
    for (const terminalId of this._dataBuffers.keys()) {
      this.flushBuffer(terminalId);
    }
  }

  private _normalizeControlSequences(terminalId: string, data: string): string {
    if (!data) {
      return data;
    }

    // Normalize form-feed to clear screen + cursor home
    if (data.indexOf('\f') !== -1) {
      data = data.replace(/\f+/g, '\u001b[2J\u001b[H');
    }

    // Filter CSI 3 J (erase scrollback) to preserve scrollback like VS Code
    return this._filterEraseScrollbackSequence(terminalId, data);
  }

  private _filterEraseScrollbackSequence(terminalId: string, data: string): string {
    const state =
      this._ansiFilterState.get(terminalId) ?? { mode: 'normal' as const, csiParams: '' };

    let out = '';
    for (let i = 0; i < data.length; i++) {
      const ch = data.charAt(i);

      if (state.mode === 'normal') {
        if (ch === '\u001b') {
          state.mode = 'esc';
          continue;
        }
        out += ch;
        continue;
      }

      if (state.mode === 'esc') {
        if (ch === '[') {
          state.mode = 'csi';
          state.csiParams = '';
          continue;
        }
        out += '\u001b' + ch;
        state.mode = 'normal';
        continue;
      }

      // CSI mode: collect params until a final byte
      const isParamChar =
        (ch >= '0' && ch <= '9') || ch === ';' || ch === '?' || ch === ' ' || ch === '>';
      if (isParamChar) {
        state.csiParams += ch;
        continue;
      }

      const finalByte = ch;
      const params = state.csiParams;
      state.mode = 'normal';
      state.csiParams = '';

      // Skip CSI 3 J (erase scrollback)
      if (finalByte === 'J' && params === '3') {
        continue;
      }

      out += '\u001b[' + params + finalByte;
    }

    this._ansiFilterState.set(terminalId, state);
    return out;
  }

  public cleanupBuffer(terminalId: string): void {
    this.flushBuffer(terminalId);
    this._dataBuffers.delete(terminalId);
    this._ansiFilterState.delete(terminalId);
    const timer = this._dataFlushTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._dataFlushTimers.delete(terminalId);
    }
  }

  public dispose(): void {
    this.flushAllBuffers();
    for (const timer of this._dataFlushTimers.values()) {
      clearTimeout(timer);
    }
    this._dataBuffers.clear();
    this._dataFlushTimers.clear();
    this._ansiFilterState.clear();
  }
}
