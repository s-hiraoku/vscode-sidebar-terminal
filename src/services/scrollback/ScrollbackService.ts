/**
 * Scrollback Service - VS Code compatible implementation
 */

import { scrollback as log } from '../../utils/logger';
import {
  IScrollbackService,
  IScrollbackSerializationOptions,
  IScrollbackReplayEvent,
  IScrollbackReplayEntry,
  IScrollbackStats,
  IScrollbackConfig,
  DEFAULT_SCROLLBACK_CONFIG,
} from './IScrollbackService';

interface RecordingSession {
  terminalId: string;
  entries: IScrollbackReplayEntry[];
  startTime: number;
  totalSize: number;
  isRecording: boolean;
  sizeLimitReached: boolean;
  timeLimitReached: boolean;
  unacknowledgedChars: number;
}

export class ScrollbackService implements IScrollbackService {
  private readonly _sessions = new Map<string, RecordingSession>();
  private readonly _config: IScrollbackConfig;

  constructor(config?: Partial<IScrollbackConfig>) {
    this._config = { ...DEFAULT_SCROLLBACK_CONFIG, ...config };
    log(`📋 [SCROLLBACK] Service initialized`);
  }

  public startRecording(terminalId: string): void {
    if (this._sessions.has(terminalId)) return;
    
    this._sessions.set(terminalId, {
      terminalId,
      entries: [],
      startTime: Date.now(),
      totalSize: 0,
      isRecording: true,
      sizeLimitReached: false,
      timeLimitReached: false,
      unacknowledgedChars: 0,
    });
  }

  public stopRecording(terminalId: string): void {
    const session = this._sessions.get(terminalId);
    if (session) session.isRecording = false;
  }

  public recordData(terminalId: string, data: string): void {
    const session = this._sessions.get(terminalId);
    if (!session || !session.isRecording) return;

    const duration = Date.now() - session.startTime;
    if (duration > this._config.maxRecordingDuration) {
      session.timeLimitReached = true;
      return;
    }

    const dataSize = Buffer.byteLength(data, 'utf8');
    if (session.totalSize + dataSize > this._config.maxRecordingSize) {
      session.sizeLimitReached = true;
      return;
    }

    session.entries.push({ cols: 80, rows: 24, data, timestamp: duration });
    session.totalSize += dataSize;
    session.unacknowledgedChars += data.length;
  }

  public getSerializedData(terminalId: string, options?: IScrollbackSerializationOptions): string | null {
    const session = this._sessions.get(terminalId);
    if (!session || session.entries.length === 0) return null;

    const limit = options?.scrollback ?? this._config.persistentSessionScrollback;
    let entries = options?.range 
      ? session.entries.slice(options.range.start, options.range.end)
      : session.entries;

    let lineCount = 0;
    const limited: IScrollbackReplayEntry[] = [];

    for (let i = entries.length - 1; i >= 0 && lineCount < limit; i--) {
      const entry = entries[i];
      if (entry) {
        lineCount += (entry.data.match(/\n/g) || []).length;
        limited.unshift(entry);
      }
    }

    return limited.map(e => e.data).join('');
  }

  public getReplayEvent(terminalId: string): IScrollbackReplayEvent | null {
    const session = this._sessions.get(terminalId);
    if (!session) return null;

    return {
      events: [...session.entries],
      totalSize: session.totalSize,
      duration: Date.now() - session.startTime,
      truncated: session.sizeLimitReached || session.timeLimitReached,
    };
  }

  public clearScrollback(terminalId: string): void {
    this._sessions.delete(terminalId);
  }

  public getScrollbackStats(terminalId: string): IScrollbackStats | null {
    const session = this._sessions.get(terminalId);
    if (!session) return null;

    let lineCount = 0;
    for (const entry of session.entries) {
      lineCount += (entry.data.match(/\n/g) || []).length;
    }

    return {
      terminalId,
      entryCount: session.entries.length,
      totalSize: session.totalSize,
      duration: Date.now() - session.startTime,
      isRecording: session.isRecording,
      sizeLimitReached: session.sizeLimitReached,
      timeLimitReached: session.timeLimitReached,
      lineCount,
    };
  }

  public acknowledgeChars(terminalId: string, charCount: number): void {
    const session = this._sessions.get(terminalId);
    if (session) {
      session.unacknowledgedChars = Math.max(0, session.unacknowledgedChars - charCount);
    }
  }

  public updateTerminalDimensions(terminalId: string, cols: number, rows: number): void {
    const session = this._sessions.get(terminalId);
    if (session && session.entries.length > 0) {
      const last = session.entries[session.entries.length - 1];
      if (last) {
        last.cols = cols;
        last.rows = rows;
      }
    }
  }

  public shouldPausePty(terminalId: string): boolean {
    const session = this._sessions.get(terminalId);
    return session ? session.unacknowledgedChars >= this._config.flowControlHighWatermark : false;
  }

  public shouldResumePty(terminalId: string): boolean {
    const session = this._sessions.get(terminalId);
    return session ? session.unacknowledgedChars <= this._config.flowControlLowWatermark : false;
  }

  public dispose(): void {
    this._sessions.clear();
  }
}
