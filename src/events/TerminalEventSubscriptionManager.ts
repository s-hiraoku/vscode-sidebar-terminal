/**
 * ターミナルイベントサブスクリプション管理
 *
 * ターミナル関連のイベント購読を管理し、
 * WebView への通知を調整します。
 */

import * as vscode from 'vscode';
import { TerminalInstance, TerminalState } from '../types/common';
import { IWebViewMessageRouter } from '../messaging/WebViewMessageRouter';
import { MessageFactory } from '../messaging/MessageFactory';
import { ITerminalLifecycleManager } from '../services/TerminalLifecycleManager';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';
import { ITerminalStateManager } from '../services/TerminalStateManager';
import { ITerminalDataBufferingService } from '../services/TerminalDataBufferingService';
import { getTerminalConfig } from '../utils/common';
import { extension as log } from '../utils/logger';

export interface ITerminalEventSubscriptionManager {
  subscribeToTerminalEvents(): void;
  subscribeToCliAgentEvents(): void;
  subscribeToStateEvents(): void;
  subscribeToDataEvents(): void;
  unsubscribeAll(): void;
  dispose(): void;
}

export interface EventSubscriptionConfig {
  enableTerminalEvents: boolean;
  enableCliAgentEvents: boolean;
  enableStateEvents: boolean;
  enableDataEvents: boolean;
  debounceStateUpdates: boolean;
  stateUpdateDelay: number;
}

/**
 * ターミナルイベントサブスクリプション管理
 */
export class TerminalEventSubscriptionManager implements ITerminalEventSubscriptionManager {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly config: EventSubscriptionConfig;

  // デバウンス用
  private stateUpdateTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly messageRouter: IWebViewMessageRouter,
    private readonly lifecycleManager: ITerminalLifecycleManager,
    private readonly cliAgentService: ICliAgentDetectionService,
    private readonly stateManager: ITerminalStateManager,
    private readonly bufferingService: ITerminalDataBufferingService,
    config: Partial<EventSubscriptionConfig> = {}
  ) {
    this.config = {
      enableTerminalEvents: true,
      enableCliAgentEvents: true,
      enableStateEvents: true,
      enableDataEvents: true,
      debounceStateUpdates: true,
      stateUpdateDelay: 100,
      ...config,
    };

    log('🎧 [EVENT-SUBSCRIPTION] Event subscription manager initialized');
  }

  /**
   * ターミナルイベントを購読
   */
  subscribeToTerminalEvents(): void {
    if (!this.config.enableTerminalEvents) {
      return;
    }

    log('🎧 [EVENT-SUBSCRIPTION] Subscribing to terminal events...');

    // ターミナル作成イベント
    const createdDisposable = this.lifecycleManager.onTerminalCreated(
      (terminal: TerminalInstance) => this.handleTerminalCreated(terminal)
    );
    this.disposables.push(createdDisposable);

    // ターミナル削除イベント
    const removedDisposable = this.lifecycleManager.onTerminalRemoved((terminalId: string) =>
      this.handleTerminalRemoved(terminalId)
    );
    this.disposables.push(removedDisposable);

    // ターミナル終了イベント
    const exitDisposable = this.lifecycleManager.onTerminalExit(
      (event: { terminalId: string; exitCode?: number }) => this.handleTerminalExit(event)
    );
    this.disposables.push(exitDisposable);

    log('✅ [EVENT-SUBSCRIPTION] Terminal events subscribed');
  }

  /**
   * CLI Agent イベントを購読
   */
  subscribeToCliAgentEvents(): void {
    if (!this.config.enableCliAgentEvents) {
      return;
    }

    log('🎧 [EVENT-SUBSCRIPTION] Subscribing to CLI Agent events...');

    // CLI Agent状態変更イベント
    const statusChangeDisposable = this.cliAgentService.onCliAgentStatusChange(
      (event: {
        terminalId: string;
        status: 'connected' | 'disconnected' | 'none';
        type: string | null;
        terminalName?: string;
      }) => this.handleCliAgentStatusChange(event)
    );
    this.disposables.push(statusChangeDisposable);

    log('✅ [EVENT-SUBSCRIPTION] CLI Agent events subscribed');
  }

  /**
   * 状態イベントを購読
   */
  subscribeToStateEvents(): void {
    if (!this.config.enableStateEvents) {
      return;
    }

    log('🎧 [EVENT-SUBSCRIPTION] Subscribing to state events...');

    // 状態更新イベント
    const stateUpdateDisposable = this.stateManager.onStateUpdate((state: TerminalState) =>
      this.handleStateUpdate(state)
    );
    this.disposables.push(stateUpdateDisposable);

    log('✅ [EVENT-SUBSCRIPTION] State events subscribed');
  }

  /**
   * データイベントを購読
   */
  subscribeToDataEvents(): void {
    if (!this.config.enableDataEvents) {
      return;
    }

    log('🎧 [EVENT-SUBSCRIPTION] Subscribing to data events...');

    // ターミナルデータイベント
    const dataDisposable = this.lifecycleManager.onTerminalData(
      (event: { terminalId: string; data: string }) => this.handleTerminalData(event)
    );
    this.disposables.push(dataDisposable);

    // データフラッシュイベント（バッファリングサービスから）
    this.bufferingService.addFlushHandler((terminalId: string, data: string) => {
      void this.handleDataFlush(terminalId, data);
    });

    log('✅ [EVENT-SUBSCRIPTION] Data events subscribed');
  }

  /**
   * 全てのサブスクリプションを解除
   */
  unsubscribeAll(): void {
    log('🔇 [EVENT-SUBSCRIPTION] Unsubscribing from all events...');

    this.disposables.forEach((d) => {
      d.dispose();
    });
    this.disposables.length = 0;

    // デバウンスタイマーをクリア
    if (this.stateUpdateTimer) {
      clearTimeout(this.stateUpdateTimer);
      this.stateUpdateTimer = null;
    }

    log('✅ [EVENT-SUBSCRIPTION] All events unsubscribed');
  }

  /**
   * 全リソースを解放
   */
  dispose(): void {
    log('🗑️ [EVENT-SUBSCRIPTION] Disposing event subscription manager...');

    this.unsubscribeAll();

    log('✅ [EVENT-SUBSCRIPTION] Event subscription manager disposed');
  }

  // === イベントハンドラー ===

  /**
   * ターミナル作成イベントを処理
   */
  private async handleTerminalCreated(terminal: TerminalInstance): Promise<void> {
    try {
      log(`🎉 [EVENT-SUBSCRIPTION] Terminal created: ${terminal.name} (${terminal.id})`);

      // WebView にターミナル作成メッセージを送信
      // 設定を取得
      const config = getTerminalConfig();
      const message = MessageFactory.createTerminalCreatedMessage(terminal, config);

      await this.messageRouter.sendMessage(message);
    } catch (error) {
      log(`❌ [EVENT-SUBSCRIPTION] Error handling terminal created: ${String(error)}`);
    }
  }

  /**
   * ターミナル削除イベントを処理
   */
  private async handleTerminalRemoved(terminalId: string): Promise<void> {
    try {
      log(`🗑️ [EVENT-SUBSCRIPTION] Terminal removed: ${terminalId}`);

      // WebView にターミナル削除メッセージを送信
      const message = MessageFactory.createTerminalRemovedMessage(terminalId);
      await this.messageRouter.sendMessage(message);
    } catch (error) {
      log(`❌ [EVENT-SUBSCRIPTION] Error handling terminal removed: ${String(error)}`);
    }
  }

  /**
   * ターミナル終了イベントを処理
   */
  private handleTerminalExit(event: { terminalId: string; exitCode?: number }): void {
    try {
      log(`🔚 [EVENT-SUBSCRIPTION] Terminal exited: ${event.terminalId} (code: ${event.exitCode})`);

      // 必要に応じてWebViewに通知
      // 現在は自動的にremoveイベントが発火されるため、特別な処理は不要
    } catch (error) {
      log(`❌ [EVENT-SUBSCRIPTION] Error handling terminal exit: ${String(error)}`);
    }
  }

  /**
   * CLI Agent状態変更イベントを処理
   */
  private async handleCliAgentStatusChange(event: {
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }): Promise<void> {
    try {
      log(
        `🤖 [EVENT-SUBSCRIPTION] CLI Agent status changed: ${event.terminalId} -> ${event.status}`
      );

      // 🛠️ FIX: Get the correct terminal name from TerminalManager
      // This ensures we always have a valid terminal name for WebView status updates
      let terminalName = event.terminalName;

      if (!terminalName) {
        // Get terminal name from TerminalManager
        const terminal = this.lifecycleManager.getTerminal(event.terminalId);
        terminalName = terminal?.name || `Terminal ${event.terminalId}`;
        log(`🔍 [EVENT-SUBSCRIPTION] Retrieved terminal name from manager: ${terminalName}`);
      }

      // WebView にCLI Agent状態更新メッセージを送信
      const message = MessageFactory.createCliAgentStatusUpdate(
        terminalName,
        event.status,
        event.type,
        event.terminalId // 🛠️ FIX: Include terminalId for reliable lookups
      );

      await this.messageRouter.sendMessage(message);

      log(
        `✅ [EVENT-SUBSCRIPTION] CLI Agent status update sent: ${terminalName} (${event.terminalId}) -> ${event.status}`
      );
    } catch (error) {
      log(`❌ [EVENT-SUBSCRIPTION] Error handling CLI Agent status change: ${String(error)}`);
    }
  }

  /**
   * 状態更新イベントを処理
   */
  private async handleStateUpdate(state: TerminalState): Promise<void> {
    try {
      if (this.config.debounceStateUpdates) {
        // デバウンス処理
        if (this.stateUpdateTimer) {
          clearTimeout(this.stateUpdateTimer);
        }

        this.stateUpdateTimer = setTimeout(() => {
          void this.sendStateUpdate(state);
          this.stateUpdateTimer = null;
        }, this.config.stateUpdateDelay);
      } else {
        // 即座に送信
        await this.sendStateUpdate(state);
      }
    } catch (error) {
      log(`❌ [EVENT-SUBSCRIPTION] Error handling state update: ${String(error)}`);
    }
  }

  /**
   * ターミナルデータイベントを処理
   */
  private handleTerminalData(event: { terminalId: string; data: string }): void {
    try {
      // データをバッファリングサービスに送信
      this.bufferingService.bufferData(event.terminalId, event.data);

      // CLI Agent検出
      this.cliAgentService.detectFromOutput(event.data, event.terminalId);
    } catch (error) {
      log(`❌ [EVENT-SUBSCRIPTION] Error handling terminal data: ${String(error)}`);
    }
  }

  /**
   * データフラッシュイベントを処理
   */
  private async handleDataFlush(terminalId: string, data: string): Promise<void> {
    try {
      // WebView にターミナル出力メッセージを送信
      const message = MessageFactory.createTerminalOutputMessage(terminalId, data);
      await this.messageRouter.sendMessage(message);
    } catch (error) {
      log(`❌ [EVENT-SUBSCRIPTION] Error handling data flush: ${String(error)}`);
    }
  }

  // === プライベートメソッド ===

  /**
   * 状態更新メッセージを送信
   */
  private async sendStateUpdate(state: TerminalState): Promise<void> {
    try {
      log(`📊 [EVENT-SUBSCRIPTION] Sending state update: ${state.terminals.length} terminals`);

      const message = MessageFactory.createStateUpdateMessage(
        state,
        state.activeTerminalId || undefined
      );
      await this.messageRouter.sendMessage(message);
    } catch (error) {
      log(`❌ [EVENT-SUBSCRIPTION] Error sending state update: ${String(error)}`);
    }
  }
}
