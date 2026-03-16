/**
 * TerminalOperationsCoordinator
 *
 * ターミナルのCRUD操作を一元管理するコーディネーター
 * LightweightTerminalWebviewManagerから抽出された責務:
 * - ターミナル作成（安全な作成、キュー管理）
 * - ターミナル削除（トラッキング、同期）
 * - 削除待機中の作成リクエストのキュー管理
 */

import { Terminal } from '@xterm/xterm';
import { webview as log } from '../../utils/logger';
import { TerminalConfig, TerminalState } from '../../types/shared';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { TerminalInstance } from '../interfaces/ManagerInterfaces';

// ============================================================================
// Constants
// ============================================================================

/**
 * Timing constants for terminal operations
 */
const OperationTimings = {
  /** Delay before saving session after creation/deletion (ms) */
  SESSION_SAVE_DELAY_MS: 100,
  /** Delay before focusing terminal after creation (ms) */
  FOCUS_DELAY_MS: 25,
  /** Retry delay when creation is blocked (ms) */
  CREATION_RETRY_DELAY_MS: 500,
  /** Timeout for queued creation requests (ms) */
  QUEUE_TIMEOUT_MS: 10000,
  /** Timeout for deletion tracking (ms) */
  DELETION_TRACKING_TIMEOUT_MS: 5000,
} as const;

/**
 * ターミナル作成リクエスト
 */
interface PendingCreationRequest {
  id: string;
  name: string;
  timestamp: number;
  resolve: (result: boolean) => void;
  reject: (error: Error) => void;
}

/**
 * ターミナル操作に必要な外部依存
 */
export interface ITerminalOperationsDependencies {
  getActiveTerminalId(): string | null;
  setActiveTerminalId(terminalId: string | null): void;
  getTerminalInstance(terminalId: string): TerminalInstance | undefined;
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  getTerminalStats(): {
    totalTerminals: number;
    activeTerminalId: string | null;
    terminalIds: string[];
  };
  postMessageToExtension(message: unknown): void;
  showWarning(message: string): void;

  // ターミナル作成・削除の実際の実装
  createTerminalInstance(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig,
    terminalNumber?: number
  ): Promise<Terminal | null>;
  removeTerminalInstance(terminalId: string): Promise<boolean>;

  // Split mode 管理
  getTerminalCount(): number;
  ensureSplitModeBeforeCreation(): Promise<void>;
  refreshSplitLayout(): void;
  prepareDisplayForDeletion(
    terminalId: string,
    stats: { totalTerminals: number; activeTerminalId: string | null; terminalIds: string[] }
  ): void;

  // UI更新
  updateTerminalBorders(terminalId: string): void;
  focusTerminal(terminalId: string): void;
  addTab(terminalId: string, terminalName: string, terminal: Terminal): void;
  setActiveTab(terminalId: string): void;
  removeTab(terminalId: string): void;
  saveSession(): Promise<boolean>;

  // CLI Agent
  removeCliAgentState(terminalId: string): void;
}

export class TerminalOperationsCoordinator {
  // 作成中のターミナルID追跡
  private pendingTerminalCreations = new Set<string>();

  // 削除トラッキング
  private deletionTracker = new Set<string>();
  private deletionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  // 作成リクエストキュー
  private pendingCreationRequests: PendingCreationRequest[] = [];

  // 現在の状態キャッシュ
  private currentTerminalState: TerminalState | null = null;

  constructor(private readonly deps: ITerminalOperationsDependencies) {
    log('✅ TerminalOperationsCoordinator initialized');
  }

  /**
   * 状態を更新
   */
  public updateState(state: TerminalState): void {
    this.currentTerminalState = state;
    this.handleStateUpdateWithDeletionSync(state);
  }

  /**
   * ターミナル作成が可能か確認
   */
  public canCreateTerminal(): boolean {
    const maxTerminals = this.currentTerminalState?.maxTerminals ?? SPLIT_CONSTANTS.MAX_TERMINALS;
    const localCount = this.deps.getTerminalCount();
    const pending = this.pendingTerminalCreations.size;

    if (!this.currentTerminalState) {
      log('⚠️ [STATE] No cached state available for creation check, using local count');
      return localCount + pending < maxTerminals;
    }

    if (this.currentTerminalState.availableSlots.length > 0) {
      return true;
    }

    return localCount + pending < maxTerminals;
  }

  /**
   * 次に利用可能なターミナル番号を取得
   */
  public getNextAvailableNumber(): number | null {
    if (!this.currentTerminalState || this.currentTerminalState.availableSlots.length === 0) {
      return null;
    }
    return Math.min(...this.currentTerminalState.availableSlots);
  }

  /**
   * ターミナル作成（メインエントリーポイント）
   */
  public async createTerminal(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig,
    terminalNumber?: number,
    requestSource: 'webview' | 'extension' = 'webview'
  ): Promise<Terminal | null> {
    try {
      log(`🔍 [OPS] createTerminal called:`, { terminalId, terminalName, terminalNumber });

      // 重複作成防止
      if (this.pendingTerminalCreations.has(terminalId)) {
        log(`⏳ Terminal ${terminalId} creation already pending, skipping`);
        return this.deps.getTerminalInstance(terminalId)?.terminal ?? null;
      }

      // 既存チェック
      const existingInstance = this.deps.getTerminalInstance(terminalId);
      if (existingInstance) {
        log(`🔁 Terminal ${terminalId} already exists, reusing`);
        this.deps.setActiveTab(terminalId);
        return existingInstance.terminal ?? null;
      }

      // Split mode の確認
      await this.deps.ensureSplitModeBeforeCreation();

      // 作成可能チェック
      if (!this.canCreateTerminal() && requestSource !== 'extension') {
        const localCount = this.deps.getTerminalCount();
        const maxCount = this.currentTerminalState?.maxTerminals ?? SPLIT_CONSTANTS.MAX_TERMINALS;
        log(`❌ Terminal creation blocked (local=${localCount}, max=${maxCount})`);
        this.deps.showWarning(`Terminal limit reached (${localCount}/${maxCount})`);
        return null;
      }

      // 作成開始をマーク
      this.pendingTerminalCreations.add(terminalId);

      try {
        // 実際のターミナル作成
        const terminal = await this.deps.createTerminalInstance(
          terminalId,
          terminalName,
          config,
          terminalNumber
        );

        if (!terminal) {
          log(`❌ Failed to create terminal instance: ${terminalId}`);
          return null;
        }

        // タブ追加
        this.deps.addTab(terminalId, terminalName, terminal);
        this.deps.setActiveTab(terminalId);

        // セッション保存
        setTimeout(() => {
          this.deps.saveSession().then((success) => {
            if (success) {
              log(`💾 Session saved after terminal ${terminalId} creation`);
            }
          });
        }, OperationTimings.SESSION_SAVE_DELAY_MS);

        // アクティブ設定とボーダー更新
        this.deps.setActiveTerminalId(terminalId);
        this.deps.updateTerminalBorders(terminalId);

        // フォーカス
        setTimeout(() => {
          this.deps.focusTerminal(terminalId);
        }, OperationTimings.FOCUS_DELAY_MS);

        // Extension にリクエスト送信
        if (requestSource === 'webview') {
          this.deps.postMessageToExtension({
            command: 'createTerminal',
            terminalId,
            terminalName,
            timestamp: Date.now(),
          });
        }

        log(`✅ Terminal creation completed: ${terminalId}`);

        // Split レイアウト更新
        this.deps.refreshSplitLayout();

        return terminal;
      } finally {
        this.pendingTerminalCreations.delete(terminalId);
      }
    } catch (error) {
      log(`❌ Error creating terminal ${terminalId}:`, error);
      this.pendingTerminalCreations.delete(terminalId);
      return null;
    }
  }

  /**
   * 安全なターミナル作成
   * 🔧 FIX: WebView側でIDを生成せず、Extension側に作成をリクエストするだけ
   * Extension側が作成したターミナルはstateUpdateメッセージで同期される
   */
  public async createTerminalSafely(terminalName?: string): Promise<boolean> {
    try {
      log('🛡️ [SAFE-CREATE] Starting safe terminal creation...');

      // 作成可能チェック
      if (!this.canCreateTerminal()) {
        const currentState = this.currentTerminalState;
        if (currentState) {
          this.deps.showWarning(
            `Terminal limit reached (${currentState.terminals.length}/${currentState.maxTerminals})`
          );
        }
        return false;
      }

      // 削除待機中の場合はリクエストを遅延
      if (this.deletionTracker.size > 0) {
        log('⏳ [SAFE-CREATE] Deletion in progress, waiting before creation request...');
        // 作成再試行
        return new Promise((resolve) => {
          setTimeout(() => {
            this.createTerminalSafely(terminalName).then(resolve);
          }, OperationTimings.CREATION_RETRY_DELAY_MS);
        });
      }

      // 🔧 FIX: IDを生成せず、Extension側に作成をリクエスト
      // Extension側がIDを生成し、terminalCreatedメッセージでWebViewに通知する
      this.deps.postMessageToExtension({
        command: 'createTerminal',
        // terminalId は Extension 側で生成するため送らない
        terminalName: terminalName,
        timestamp: Date.now(),
      });

      log(`✅ [SAFE-CREATE] Creation request sent to Extension`);
      return true;
    } catch (error) {
      log('❌ Error in safe terminal creation:', error);
      return false;
    }
  }

  /**
   * ターミナル作成をキューに追加
   * 🔧 FIX: IDはExtension側で生成されるため、WebView側ではIDを指定せず名前のみを保持
   */
  public queueTerminalCreation(terminalName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request: PendingCreationRequest = {
        id: `pending-${Date.now()}`, // 仮ID（Extension側で本当のIDが割り当てられる）
        name: terminalName,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      this.pendingCreationRequests.push(request);
      log(`📥 [QUEUE] Queued terminal creation request`);

      // タイムアウト設定
      setTimeout(() => {
        const index = this.pendingCreationRequests.findIndex((r) => r.id === request.id);
        if (index !== -1) {
          this.pendingCreationRequests.splice(index, 1);
          reject(new Error('Terminal creation request timed out'));
        }
      }, OperationTimings.QUEUE_TIMEOUT_MS);
    });
  }

  /**
   * キューの処理
   * 🔧 FIX: IDはExtension側で生成されるため、WebView側ではIDを送らない
   */
  public processPendingCreationRequests(): void {
    if (this.pendingCreationRequests.length === 0) {
      return;
    }

    log(`🔄 Processing ${this.pendingCreationRequests.length} pending creation requests`);

    const request = this.pendingCreationRequests.shift();
    if (!request) return;

    if (this.canCreateTerminal()) {
      log(`✅ Processing queued terminal creation request`);

      // 🔧 FIX: IDはExtension側で生成される
      this.deps.postMessageToExtension({
        command: 'createTerminal',
        terminalName: request.name,
        timestamp: Date.now(),
      });

      request.resolve(true);
    } else {
      log(`❌ Cannot create terminal yet, re-queueing request`);
      this.pendingCreationRequests.unshift(request);
      setTimeout(
        () => this.processPendingCreationRequests(),
        OperationTimings.CREATION_RETRY_DELAY_MS
      );
    }
  }

  /**
   * ターミナル削除
   */
  public async removeTerminal(terminalId: string): Promise<boolean> {
    log(`🗑️ [REMOVAL] Starting removal for: ${terminalId}`);

    // CLI Agent 状態クリア
    this.deps.removeCliAgentState(terminalId);

    // タブ削除
    this.deps.removeTab(terminalId);

    // 実際の削除
    const removed = await this.deps.removeTerminalInstance(terminalId);
    log(`🗑️ Lifecycle removal result for ${terminalId}: ${removed}`);

    // セッション更新
    setTimeout(() => {
      this.deps.saveSession().then((success) => {
        if (success) {
          log(`✅ Session updated after removal`);
        }
      });
    }, OperationTimings.SESSION_SAVE_DELAY_MS);

    return removed;
  }

  /**
   * 安全なターミナル削除
   */
  public async deleteTerminalSafely(terminalId?: string): Promise<boolean> {
    try {
      const targetId = terminalId || this.deps.getActiveTerminalId();
      if (!targetId) {
        log('❌ No terminal to delete');
        return false;
      }

      log(`🛡️ [SAFE-DELETE] Starting safe deletion: ${targetId}`);

      // 存在チェック
      const instance = this.deps.getTerminalInstance(targetId);
      if (!instance) {
        log(`❌ Terminal not found: ${targetId}`);
        return false;
      }

      // 最後のターミナル保護
      const stats = this.deps.getTerminalStats();
      if (stats.totalTerminals <= 1) {
        log(`🛡️ Cannot delete last terminal: ${targetId}`);
        this.deps.showWarning('Must keep at least 1 terminal open');
        return false;
      }

      // 表示モード準備
      this.deps.prepareDisplayForDeletion(targetId, stats);

      // 既に削除中かチェック
      if (this.isTerminalDeletionTracked(targetId)) {
        log(`⏳ Deletion already in progress: ${targetId}`);
        return false;
      }

      // 削除トラッキング開始
      this.trackTerminalDeletion(targetId);

      // Extension に削除リクエスト送信
      this.deps.postMessageToExtension({
        command: 'deleteTerminal',
        terminalId: targetId,
        requestSource: 'header',
        timestamp: Date.now(),
      });

      log(`✅ Deletion request sent: ${targetId}`);
      return true;
    } catch (error) {
      log('❌ Error in safe terminal deletion:', error);
      return false;
    }
  }

  // 削除トラッキング関連

  private trackTerminalDeletion(terminalId: string): void {
    this.deletionTracker.add(terminalId);

    const timeout = setTimeout(() => {
      this.clearTerminalDeletionTracking(terminalId);
    }, OperationTimings.DELETION_TRACKING_TIMEOUT_MS);

    this.deletionTimeouts.set(terminalId, timeout);
    log(`🎯 Started tracking deletion for: ${terminalId}`);
  }

  private isTerminalDeletionTracked(terminalId: string): boolean {
    return this.deletionTracker.has(terminalId);
  }

  private clearTerminalDeletionTracking(terminalId: string): void {
    this.deletionTracker.delete(terminalId);

    const timeout = this.deletionTimeouts.get(terminalId);
    if (timeout) {
      clearTimeout(timeout);
      this.deletionTimeouts.delete(terminalId);
    }

    log(`🎯 Cleared deletion tracking for: ${terminalId}`);
  }

  private handleStateUpdateWithDeletionSync(state: TerminalState): void {
    const trackedDeletions = Array.from(this.deletionTracker);

    for (const deletedTerminalId of trackedDeletions) {
      const stillExists = state.terminals.some((t) => t.id === deletedTerminalId);

      if (!stillExists) {
        log(`✅ Deletion confirmed for: ${deletedTerminalId}`);
        this.clearTerminalDeletionTracking(deletedTerminalId);
        this.processPendingCreationRequests();
      } else {
        log(`⏳ Terminal still exists, waiting: ${deletedTerminalId}`);
      }
    }
  }

  // システム状態

  public hasPendingDeletions(): boolean {
    return this.deletionTracker.size > 0;
  }

  public hasPendingCreations(): boolean {
    return this.pendingCreationRequests.length > 0;
  }

  public getPendingDeletions(): string[] {
    return Array.from(this.deletionTracker);
  }

  public getPendingCreationsCount(): number {
    return this.pendingCreationRequests.length;
  }

  // ターミナル作成追跡のパブリックAPI

  /**
   * ターミナル作成が進行中かチェック
   */
  public isTerminalCreationPending(terminalId: string): boolean {
    return this.pendingTerminalCreations.has(terminalId);
  }

  /**
   * ターミナル作成を進行中としてマーク
   */
  public markTerminalCreationPending(terminalId: string): void {
    this.pendingTerminalCreations.add(terminalId);
    log(`📝 Marked terminal creation as pending: ${terminalId}`);
  }

  /**
   * ターミナル作成の進行中マークをクリア
   */
  public clearTerminalCreationPending(terminalId: string): void {
    this.pendingTerminalCreations.delete(terminalId);
    log(`📝 Cleared terminal creation pending: ${terminalId}`);
  }

  /**
   * 強制同期
   */
  public forceSynchronization(): void {
    log('🔄 Forcing synchronization...');

    this.deletionTracker.clear();
    this.deletionTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.deletionTimeouts.clear();

    this.pendingCreationRequests.forEach((request) => {
      request.reject(new Error('System synchronization forced'));
    });
    this.pendingCreationRequests.length = 0;

    log('✅ Synchronization completed');
  }

  /**
   * リソース解放
   */
  public dispose(): void {
    this.deletionTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.deletionTimeouts.clear();
    this.deletionTracker.clear();
    this.pendingTerminalCreations.clear();
    this.pendingCreationRequests.length = 0;

    log('✅ TerminalOperationsCoordinator disposed');
  }
}
