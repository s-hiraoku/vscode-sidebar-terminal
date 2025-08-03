/**
 * ターミナルデータバッファリングサービス
 * 
 * 高頻度のターミナル出力を効率的に処理するための
 * 適応的バッファリングシステムを提供します。
 */

import { extension as log } from '../utils/logger';

export interface ITerminalDataBufferingService {
  bufferData(terminalId: string, data: string): void;
  flushBuffer(terminalId: string): void;
  flushAllBuffers(): void;
  scheduleFlush(terminalId: string): void;
  isBufferEmpty(terminalId: string): boolean;
  getBufferSize(terminalId: string): number;
  clearBuffer(terminalId: string): void;
  addFlushHandler(handler: DataFlushHandler): void;
  removeFlushHandler(handler: DataFlushHandler): void;
  getAllStats(): Record<string, unknown>;
  dispose(): void;
}

export interface BufferingConfig {
  normalFlushInterval: number;    // 通常時のフラッシュ間隔 (ms)
  fastFlushInterval: number;      // 高頻度時のフラッシュ間隔 (ms)  
  maxBufferSize: number;          // バッファ最大サイズ
  adaptiveThreshold: number;      // 適応的調整のしきい値
  cliAgentFlushInterval: number;  // CLI Agent用フラッシュ間隔 (ms)
}

export interface DataFlushHandler {
  (terminalId: string, data: string): void;
}

/**
 * ターミナルデータバッファリングサービス
 */
export class TerminalDataBufferingService implements ITerminalDataBufferingService {
  private readonly _dataBuffers = new Map<string, string[]>();
  private readonly _dataFlushTimers = new Map<string, NodeJS.Timeout>();
  private readonly _flushHandlers = new Set<DataFlushHandler>();
  
  // パフォーマンストラッキング
  private readonly _bufferStats = new Map<string, {
    lastFlushTime: number;
    flushCount: number;
    dataVolume: number;
    averageInterval: number;
  }>();
  
  // 適応的バッファリング設定
  private readonly config: BufferingConfig;
  
  constructor(
    config: Partial<BufferingConfig> = {},
    initialHandlers: DataFlushHandler[] = []
  ) {
    this.config = {
      normalFlushInterval: 16,      // 60fps for standard operation
      fastFlushInterval: 8,         // 125fps for high-frequency data
      maxBufferSize: 50,            // Maximum buffer entries
      adaptiveThreshold: 100,       // Characters per flush to trigger fast mode
      cliAgentFlushInterval: 4,     // 250fps for CLI Agent operations
      ...config
    };
    
    // 初期フラッシュハンドラーを設定
    initialHandlers.forEach(handler => this.addFlushHandler(handler));
    
    log(`🚀 [DATA-BUFFER] Service initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * データフラッシュハンドラーを追加
   */
  addFlushHandler(handler: DataFlushHandler): void {
    this._flushHandlers.add(handler);
  }

  /**
   * データフラッシュハンドラーを削除
   */
  removeFlushHandler(handler: DataFlushHandler): void {
    this._flushHandlers.delete(handler);
  }

  /**
   * データをバッファに追加
   */
  bufferData(terminalId: string, data: string): void {
    if (!data || data.length === 0) {
      return;
    }

    // バッファが存在しない場合は作成
    if (!this._dataBuffers.has(terminalId)) {
      this._dataBuffers.set(terminalId, []);
      this.initializeStats(terminalId);
    }

    const buffer = this._dataBuffers.get(terminalId)!;
    buffer.push(data);

    // 統計情報を更新
    this.updateStats(terminalId, data.length);

    // バッファサイズ制限チェック
    if (buffer.length >= this.config.maxBufferSize) {
      log(`📊 [DATA-BUFFER] Buffer size limit reached for ${terminalId}, forcing flush`);
      this.flushBuffer(terminalId);
      return;
    }

    // 適応的フラッシュスケジューリング
    this.scheduleAdaptiveFlush(terminalId, data.length);
  }

  /**
   * 指定されたターミナルのバッファをフラッシュ
   */
  flushBuffer(terminalId: string): void {
    const buffer = this._dataBuffers.get(terminalId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    // タイマーをクリア
    this.clearFlushTimer(terminalId);

    // バッファ内容を結合
    const data = buffer.join('');
    buffer.length = 0; // バッファをクリア

    // 統計情報を更新
    this.updateFlushStats(terminalId);

    // フラッシュハンドラーに通知
    this._flushHandlers.forEach(handler => {
      try {
        handler(terminalId, data);
      } catch (error) {
        log(`❌ [DATA-BUFFER] Flush handler error for ${terminalId}: ${String(error)}`);
      }
    });

    log(`💨 [DATA-BUFFER] Flushed ${data.length} chars for ${terminalId}`);
  }

  /**
   * 全てのバッファをフラッシュ
   */
  flushAllBuffers(): void {
    const terminalIds = Array.from(this._dataBuffers.keys());
    log(`💨 [DATA-BUFFER] Flushing all buffers for ${terminalIds.length} terminals`);
    
    terminalIds.forEach(terminalId => {
      this.flushBuffer(terminalId);
    });
  }

  /**
   * フラッシュをスケジュール
   */
  scheduleFlush(terminalId: string): void {
    this.scheduleAdaptiveFlush(terminalId, 0);
  }

  /**
   * バッファが空かどうか確認
   */
  isBufferEmpty(terminalId: string): boolean {
    const buffer = this._dataBuffers.get(terminalId);
    return !buffer || buffer.length === 0;
  }

  /**
   * バッファサイズを取得
   */
  getBufferSize(terminalId: string): number {
    const buffer = this._dataBuffers.get(terminalId);
    return buffer ? buffer.length : 0;
  }

  /**
   * バッファをクリア
   */
  clearBuffer(terminalId: string): void {
    this.clearFlushTimer(terminalId);
    this._dataBuffers.delete(terminalId);
    this._bufferStats.delete(terminalId);
    log(`🧹 [DATA-BUFFER] Cleared buffer for ${terminalId}`);
  }

  /**
   * 全リソースを解放
   */
  dispose(): void {
    // 全てのタイマーをクリア
    this._dataFlushTimers.forEach(timer => clearTimeout(timer));
    this._dataFlushTimers.clear();

    // 残りのバッファをフラッシュ
    this.flushAllBuffers();

    // データ構造をクリア
    this._dataBuffers.clear();
    this._bufferStats.clear();
    this._flushHandlers.clear();

    log(`🗑️ [DATA-BUFFER] Service disposed`);
  }

  /**
   * バッファ統計を取得
   */
  getBufferStats(terminalId: string): {
    bufferSize: number;
    flushCount: number;
    dataVolume: number;
    averageInterval: number;
    lastFlushTime: number;
  } | null {
    const stats = this._bufferStats.get(terminalId);
    if (!stats) {
      return null;
    }

    return {
      bufferSize: this.getBufferSize(terminalId),
      flushCount: stats.flushCount,
      dataVolume: stats.dataVolume,
      averageInterval: stats.averageInterval,
      lastFlushTime: stats.lastFlushTime,
    };
  }

  /**
   * 全ターミナルの統計情報を取得
   */
  getAllStats(): Record<string, ReturnType<typeof this.getBufferStats>> {
    const result: Record<string, ReturnType<typeof this.getBufferStats>> = {};
    
    this._dataBuffers.forEach((_, terminalId) => {
      result[terminalId] = this.getBufferStats(terminalId);
    });

    return result;
  }

  // === プライベートメソッド ===

  /**
   * 適応的フラッシュをスケジュール
   */
  private scheduleAdaptiveFlush(terminalId: string, dataSize: number): void {
    // 既存のタイマーをクリア
    this.clearFlushTimer(terminalId);

    // フラッシュ間隔を決定
    const interval = this.calculateFlushInterval(terminalId, dataSize);

    // 新しいタイマーを設定
    const timer = setTimeout(() => {
      this.flushBuffer(terminalId);
    }, interval);

    this._dataFlushTimers.set(terminalId, timer);
  }

  /**
   * フラッシュ間隔を計算
   */
  private calculateFlushInterval(terminalId: string, dataSize: number): number {
    const stats = this._bufferStats.get(terminalId);
    
    // CLI Agent検出パターン（高頻度出力）
    if (this.isHighFrequencyOutput(terminalId, dataSize)) {
      return this.config.cliAgentFlushInterval;
    }

    // 大量データの場合は即座にフラッシュ
    if (dataSize >= this.config.adaptiveThreshold) {
      return this.config.fastFlushInterval;
    }

    // 統計に基づく適応的調整
    if (stats && stats.averageInterval < this.config.normalFlushInterval) {
      return this.config.fastFlushInterval;
    }

    return this.config.normalFlushInterval;
  }

  /**
   * 高頻度出力かどうか判定
   */
  private isHighFrequencyOutput(terminalId: string, dataSize: number): boolean {
    const stats = this._bufferStats.get(terminalId);
    if (!stats) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastFlush = now - stats.lastFlushTime;
    
    // 短時間に大量データの場合
    return timeSinceLastFlush < 100 && dataSize > 50;
  }

  /**
   * フラッシュタイマーをクリア
   */
  private clearFlushTimer(terminalId: string): void {
    const timer = this._dataFlushTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._dataFlushTimers.delete(terminalId);
    }
  }

  /**
   * 統計情報を初期化
   */
  private initializeStats(terminalId: string): void {
    this._bufferStats.set(terminalId, {
      lastFlushTime: Date.now(),
      flushCount: 0,
      dataVolume: 0,
      averageInterval: this.config.normalFlushInterval,
    });
  }

  /**
   * 統計情報を更新
   */
  private updateStats(terminalId: string, dataSize: number): void {
    const stats = this._bufferStats.get(terminalId);
    if (stats) {
      stats.dataVolume += dataSize;
    }
  }

  /**
   * フラッシュ統計を更新
   */
  private updateFlushStats(terminalId: string): void {
    const stats = this._bufferStats.get(terminalId);
    if (!stats) {
      return;
    }

    const now = Date.now();
    const interval = now - stats.lastFlushTime;
    
    stats.flushCount++;
    stats.lastFlushTime = now;
    
    // 移動平均でインターバルを計算
    stats.averageInterval = (stats.averageInterval * 0.8) + (interval * 0.2);
  }
}