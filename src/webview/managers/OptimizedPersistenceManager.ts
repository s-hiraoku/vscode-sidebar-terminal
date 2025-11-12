import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { webview as log } from '../../utils/logger';

/**
 * 最適化済みターミナル永続化マネージャー（WebView側）
 * 高性能な永続化処理とメモリ効率を実現
 */
export interface PersistenceSettings {
  enableAutoSave: boolean;
  autoSaveIntervalMinutes: number;
  maxScrollbackLines: number;
  compressionEnabled: boolean;
  enableLazyLoading: boolean;
}

export interface PersistenceStats {
  lastSaveTime: number;
  lastRestoreTime: number;
  savedTerminalCount: number;
  restoredTerminalCount: number;
  compressionRatio: number;
  totalDataSize: number;
}

export class OptimizedPersistenceManager {
  private readonly DEFAULT_SETTINGS: PersistenceSettings = {
    enableAutoSave: true,
    autoSaveIntervalMinutes: 5,
    maxScrollbackLines: 1000,
    compressionEnabled: true,
    enableLazyLoading: true,
  };

  private settings: PersistenceSettings = { ...this.DEFAULT_SETTINGS };
  private stats: PersistenceStats = {
    lastSaveTime: 0,
    lastRestoreTime: 0,
    savedTerminalCount: 0,
    restoredTerminalCount: 0,
    compressionRatio: 0,
    totalDataSize: 0,
  };

  private autoSaveTimer?: NodeJS.Timeout;
  private readonly pendingOperations = new Set<string>();
  private isInitialized = false;

  constructor(private readonly coordinator: IManagerCoordinator) {
    log('🔧 [PERSISTENCE-WEBVIEW] OptimizedPersistenceManager initialized');
  }

  /**
   * 初期化処理
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        log('⚠️ [PERSISTENCE-WEBVIEW] Already initialized, skipping');
        return;
      }

      // 設定読み込み
      await this.loadSettings();

      // 自動保存設定
      if (this.settings.enableAutoSave) {
        this.startAutoSave();
      }

      // 初回復元試行
      await this.tryInitialRestore();

      this.isInitialized = true;
      log('✅ [PERSISTENCE-WEBVIEW] Initialization complete');
    } catch (error) {
      log(`❌ [PERSISTENCE-WEBVIEW] Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * セッション保存（最適化済み）
   */
  async saveSession(force: boolean = false): Promise<boolean> {
    if (!this.isInitialized && !force) {
      log('⚠️ [PERSISTENCE-WEBVIEW] Not initialized, skipping save');
      return false;
    }

    const operationId = `save-${Date.now()}`;
    if (this.pendingOperations.has('save') && !force) {
      log('⚠️ [PERSISTENCE-WEBVIEW] Save operation already pending');
      return false;
    }

    try {
      this.pendingOperations.add(operationId);
      log('💾 [PERSISTENCE-WEBVIEW] Starting session save...');

      // ターミナル情報収集
      const terminals = await this.collectTerminalData();
      if (terminals.length === 0) {
        log('📦 [PERSISTENCE-WEBVIEW] No terminals to save');
        return true;
      }

      // データ最適化
      const optimizedData = this.optimizeTerminalData(terminals);

      // Extension側に保存要求
      const response = await this.sendPersistenceMessage('saveSession', optimizedData);

      if (response.success) {
        this.updateSaveStats(optimizedData, terminals.length);
        log(`✅ [PERSISTENCE-WEBVIEW] Session saved: ${terminals.length} terminals`);
        return true;
      } 
        log(`❌ [PERSISTENCE-WEBVIEW] Save failed: ${response.error}`);
        return false;
      
    } catch (error) {
      log(`❌ [PERSISTENCE-WEBVIEW] Save operation failed: ${error}`);
      return false;
    } finally {
      this.pendingOperations.delete(operationId);
    }
  }

  /**
   * セッション復元（最適化済み）
   */
  async restoreSession(): Promise<boolean> {
    if (!this.isInitialized) {
      log('⚠️ [PERSISTENCE-WEBVIEW] Not initialized, skipping restore');
      return false;
    }

    const operationId = `restore-${Date.now()}`;
    if (this.pendingOperations.has('restore')) {
      log('⚠️ [PERSISTENCE-WEBVIEW] Restore operation already pending');
      return false;
    }

    try {
      this.pendingOperations.add(operationId);
      log('📦 [PERSISTENCE-WEBVIEW] Starting session restore...');

      // Extension側に復元要求
      const response = await this.sendPersistenceMessage('restoreSession');

      if (response.success && response.data && Array.isArray(response.data)) {
        // 遅延復元でパフォーマンス向上
        if (this.settings.enableLazyLoading) {
          await this.lazyRestoreTerminals(response.data);
        } else {
          await this.immediateRestoreTerminals(response.data);
        }

        this.updateRestoreStats(response.data.length);
        log(`✅ [PERSISTENCE-WEBVIEW] Session restored: ${response.data.length} terminals`);
        return true;
      } 
        log(`📦 [PERSISTENCE-WEBVIEW] No session to restore: ${response.error || 'No data'}`);
        return false;
      
    } catch (error) {
      log(`❌ [PERSISTENCE-WEBVIEW] Restore operation failed: ${error}`);
      return false;
    } finally {
      this.pendingOperations.delete(operationId);
    }
  }

  /**
   * セッションクリア
   */
  async clearSession(): Promise<boolean> {
    try {
      log('🗑️ [PERSISTENCE-WEBVIEW] Clearing session...');

      const response = await this.sendPersistenceMessage('clearSession');

      if (response.success) {
        this.resetStats();
        log('✅ [PERSISTENCE-WEBVIEW] Session cleared successfully');
        return true;
      } 
        log(`❌ [PERSISTENCE-WEBVIEW] Clear failed: ${response.error}`);
        return false;
      
    } catch (error) {
      log(`❌ [PERSISTENCE-WEBVIEW] Clear operation failed: ${error}`);
      return false;
    }
  }

  /**
   * 永続化統計情報取得
   */
  getStats(): PersistenceStats {
    return { ...this.stats };
  }

  /**
   * 設定更新
   */
  updateSettings(newSettings: Partial<PersistenceSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    // 自動保存設定の更新
    if (this.settings.enableAutoSave) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }

    log('🔧 [PERSISTENCE-WEBVIEW] Settings updated');
  }

  /**
   * リソース解放
   */
  dispose(): void {
    this.stopAutoSave();
    this.pendingOperations.clear();

    // 待機中のレスポンスをクリア
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_messageId, pending] of Array.from(this.pendingResponses.entries())) {
      clearTimeout(pending.timeout);
      pending.resolve({ success: false, error: 'Manager disposed' });
    }
    this.pendingResponses.clear();

    this.isInitialized = false;
    log('🧹 [PERSISTENCE-WEBVIEW] OptimizedPersistenceManager disposed');
  }

  /**
   * プライベートメソッド
   */

  /**
   * ターミナルデータ収集
   */
  private async collectTerminalData(): Promise<any[]> {
    try {
      const terminals = this.coordinator.getAllTerminalInstances();
      if (!terminals || terminals.size === 0) {
        return [];
      }

      return Array.from(terminals.values()).map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        scrollback: this.extractScrollback(terminal),
        workingDirectory: '', // Will be updated by shell integration
        shellCommand: '', // Will be determined by shell integration
        isActive: terminal.id === this.coordinator.getActiveTerminalId(),
      }));
    } catch (error) {
      log(`❌ [PERSISTENCE-WEBVIEW] Failed to collect terminal data: ${error}`);
      return [];
    }
  }

  /**
   * スクロールバック抽出（最適化済み）
   */
  private extractScrollback(terminal: any): string[] {
    try {
      if (!terminal.terminal) {
        return [];
      }

      const xtermInstance = terminal.terminal;

      // xterm.js serialize addon使用（利用可能な場合）
      if (xtermInstance.serialize) {
        const serialized = xtermInstance.serialize();
        return serialized.split('\n').slice(-this.settings.maxScrollbackLines);
      }

      // フォールバック: バッファから直接読み取り
      if (xtermInstance.buffer?.active) {
        const buffer = xtermInstance.buffer.active;
        const lines: string[] = [];

        for (let i = 0; i < Math.min(buffer.length, this.settings.maxScrollbackLines); i++) {
          const line = buffer.getLine(i);
          if (line) {
            lines.push(line.translateToString());
          }
        }

        return lines;
      }

      return [];
    } catch (error) {
      log(`⚠️ [PERSISTENCE-WEBVIEW] Failed to extract scrollback: ${error}`);
      return [];
    }
  }

  /**
   * データ最適化
   */
  private optimizeTerminalData(terminals: any[]): any[] {
    if (!this.settings.compressionEnabled) {
      return terminals;
    }

    return terminals.map((terminal) => ({
      ...terminal,
      scrollback: terminal.scrollback.filter((line: string) => line.trim().length > 0),
    }));
  }

  /**
   * 遅延復元（大量ターミナル対応）
   */
  private async lazyRestoreTerminals(terminalData: any[]): Promise<void> {
    const BATCH_SIZE = 2;

    for (let i = 0; i < terminalData.length; i += BATCH_SIZE) {
      const batch = terminalData.slice(i, i + BATCH_SIZE);

      for (const terminal of batch) {
        await this.restoreTerminalInstance(terminal);
        await this.delay(50); // UI応答性維持
      }

      if (i + BATCH_SIZE < terminalData.length) {
        await this.delay(100); // バッチ間遅延
      }
    }
  }

  /**
   * 即座復元
   */
  private async immediateRestoreTerminals(terminalData: any[]): Promise<void> {
    const restorePromises = terminalData.map((terminal) => this.restoreTerminalInstance(terminal));

    await Promise.all(restorePromises);
  }

  /**
   * ターミナルインスタンス復元
   */
  private async restoreTerminalInstance(terminal: any): Promise<void> {
    try {
      // 新しいターミナル作成要求
      await this.coordinator.getMessageManager().postMessage({
        command: 'createTerminal',
        data: {
          id: terminal.id,
          name: terminal.name,
          workingDirectory: terminal.workingDirectory,
        },
      });

      // スクロールバック復元
      if (terminal.scrollback && terminal.scrollback.length > 0) {
        await this.coordinator.getMessageManager().postMessage({
          command: 'restoreScrollback',
          terminalId: terminal.id,
          data: terminal.scrollback,
        });
      }
    } catch (error) {
      log(`⚠️ [PERSISTENCE-WEBVIEW] Failed to restore terminal ${terminal.id}: ${error}`);
    }
  }

  private readonly pendingResponses = new Map<
    string,
    { resolve: (value: any) => void; timeout: NodeJS.Timeout }
  >();

  /**
   * Extension側との通信 - 実際のレスポンスを待機
   */
  private async sendPersistenceMessage(command: string, data?: any): Promise<any> {
    return new Promise((resolve) => {
      const messageId = `${command}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // タイムアウト設定
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(messageId);
        resolve({ success: false, error: 'Operation timeout (10s)' });
      }, 10000);

      // レスポンス待機登録
      this.pendingResponses.set(messageId, { resolve, timeout });

      // メッセージ送信（messageIdを含む）
      this.coordinator.getMessageManager().postMessage({
        command: `persistence${command.charAt(0).toUpperCase() + command.slice(1)}`,
        data,
        messageId,
      });

      log(`📤 [PERSISTENCE-WEBVIEW] Sent message: ${command} (ID: ${messageId})`);
    });
  }

  /**
   * Extension からのレスポンス処理
   */
  public handlePersistenceResponse(messageId: string, response: any): void {
    const pending = this.pendingResponses.get(messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingResponses.delete(messageId);
      pending.resolve(response);
      log(`📥 [PERSISTENCE-WEBVIEW] Received response for ${messageId}:`, response);
    } else {
      log(`⚠️ [PERSISTENCE-WEBVIEW] No pending request for messageId: ${messageId}`);
    }
  }

  /**
   * 自動保存管理
   */
  private startAutoSave(): void {
    this.stopAutoSave();

    if (this.settings.autoSaveIntervalMinutes > 0) {
      const interval = this.settings.autoSaveIntervalMinutes * 60 * 1000;
      this.autoSaveTimer = setInterval(() => {
        this.saveSession().catch((error) =>
          log(`❌ [PERSISTENCE-WEBVIEW] Auto-save failed: ${error}`)
        );
      }, interval);
    }
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * 統計更新
   */
  private updateSaveStats(data: any[], terminalCount: number): void {
    this.stats.lastSaveTime = Date.now();
    this.stats.savedTerminalCount = terminalCount;
    this.stats.totalDataSize = JSON.stringify(data).length;
    this.stats.compressionRatio = this.calculateCompressionRatio(data);
  }

  private updateRestoreStats(terminalCount: number): void {
    this.stats.lastRestoreTime = Date.now();
    this.stats.restoredTerminalCount = terminalCount;
  }

  private resetStats(): void {
    this.stats = {
      lastSaveTime: 0,
      lastRestoreTime: 0,
      savedTerminalCount: 0,
      restoredTerminalCount: 0,
      compressionRatio: 0,
      totalDataSize: 0,
    };
  }

  private calculateCompressionRatio(data: any[]): number {
    try {
      const original = JSON.stringify(data);
      const compressed = this.settings.compressionEnabled
        ? JSON.stringify(data).replace(/\s+/g, ' ')
        : original;

      return original.length > 0 ? compressed.length / original.length : 1;
    } catch {
      return 1;
    }
  }

  /**
   * ヘルパーメソッド
   */
  private async loadSettings(): Promise<void> {
    // VS Code設定から読み込み（実装時に具体化）
    this.settings = { ...this.DEFAULT_SETTINGS };
  }

  private async tryInitialRestore(): Promise<void> {
    try {
      await this.restoreSession();
    } catch (error) {
      log(`⚠️ [PERSISTENCE-WEBVIEW] Initial restore failed: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
