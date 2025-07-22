import { EventEmitter } from 'vscode';
import {
  CliAgentStateService,
  CliAgentStatus,
  CliAgentType,
  CliAgentInfo,
} from './CliAgentStateService';
import { CliAgentDetectionService } from './CliAgentDetectionService';
import { CliAgentDisplayService, DisplayUpdateEvent } from './CliAgentDisplayService';
import { terminal as log } from '../utils/logger';

/**
 * 出力バッファ管理
 */
interface OutputBuffer {
  lines: string[];
  lastUpdate: number;
}

/**
 * 統合イベント（外部APIとの互換性のため）
 */
export interface CliAgentStatusEvent {
  terminalId: string;
  type: CliAgentType | null;
  status: CliAgentStatus;
}

/**
 * CLI Agent統合管理サービス
 *
 * 責務：
 * - 各サービスの統合と調整
 * - 外部APIの提供（TerminalManager向け）
 * - 入力/出力の処理とバッファリング
 * - コマンド履歴の管理
 */
export class CliAgentIntegrationManager {
  private readonly _stateService: CliAgentStateService;
  private readonly _detectionService: CliAgentDetectionService;
  private readonly _displayService: CliAgentDisplayService;

  // バッファ管理
  private readonly _commandHistory = new Map<string, string[]>();
  private readonly _inputBuffers = new Map<string, string>();
  private readonly _outputBuffers = new Map<string, OutputBuffer>();

  // 設定
  private readonly MAX_HISTORY_SIZE = 100;
  private readonly OUTPUT_BUFFER_SIZE = 10;
  private readonly OUTPUT_BUFFER_TTL = 5000; // 5秒

  // イベント
  private readonly _onStatusChange = new EventEmitter<CliAgentStatusEvent>();
  public readonly onCliAgentStatusChange = this._onStatusChange.event;

  constructor() {
    this._stateService = new CliAgentStateService();
    this._detectionService = new CliAgentDetectionService();
    this._displayService = new CliAgentDisplayService();

    this._setupEventListeners();

    log('✅ [CLI-AGENT-MANAGER] Initialized CLI Agent integration manager');
  }

  // =================== Public API (TerminalManager向け) ===================

  /**
   * 入力追跡（コマンド検出）
   */
  public trackInput(terminalId: string, data: string): void {
    try {
      // 入力バッファを更新
      let buffer = this._inputBuffers.get(terminalId) || '';
      buffer += data;
      this._inputBuffers.set(terminalId, buffer);

      // 完全なコマンドかチェック（改行で終了）
      if (data.includes('\r') || data.includes('\n')) {
        const command = buffer.trim();

        if (command) {
          // コマンド履歴に追加
          this._addToCommandHistory(terminalId, command);

          // CLI Agent検出
          const detectionResult = this._detectionService.detectFromCommand(command);
          if (detectionResult) {
            this._stateService.activateAgent(terminalId, detectionResult.type);
          }
        }

        // バッファをクリア
        this._inputBuffers.set(terminalId, '');
      }
    } catch (error) {
      log(`❌ [CLI-AGENT-MANAGER] Error tracking input: ${error}`);
    }
  }

  /**
   * 出力処理（CLI Agent検出と終了検出）
   */
  public handleTerminalOutput(terminalId: string, data: string): void {
    try {
      // 出力バッファを更新
      this._updateOutputBuffer(terminalId, data);

      const currentAgent = this._stateService.getAgentInfo(terminalId);

      // CLI Agent検出（まだ検出されていない場合）
      if (!currentAgent) {
        const detectionResult = this._detectionService.detectFromOutput(data);
        if (detectionResult) {
          this._stateService.activateAgent(terminalId, detectionResult.type);
          return;
        }
      }

      // 終了検出（CONNECTEDなエージェントのみ対象）
      if (currentAgent && currentAgent.status === CliAgentStatus.CONNECTED) {
        const hasExit = this._detectExit(terminalId, data);
        if (hasExit) {
          this._stateService.deactivateAgent(terminalId);
        }
      }
    } catch (error) {
      log(`❌ [CLI-AGENT-MANAGER] Error handling output: ${error}`);
    }
  }

  /**
   * ターミナル削除時のクリーンアップ
   */
  public cleanupTerminal(terminalId: string): void {
    this._stateService.cleanupTerminal(terminalId);
    this._displayService.cleanupTerminal(terminalId);
    this._commandHistory.delete(terminalId);
    this._inputBuffers.delete(terminalId);
    this._outputBuffers.delete(terminalId);

    log(`🧹 [CLI-AGENT-MANAGER] Cleaned up terminal: ${terminalId}`);
  }

  /**
   * ターミナル名設定（表示用）
   */
  public setTerminalName(terminalId: string, name: string): void {
    this._displayService.setTerminalName(terminalId, name);
  }

  // =================== Query API ===================

  public getCliAgentStatus(terminalId: string): CliAgentStatus {
    return this._stateService.getStatus(terminalId);
  }

  public isCliAgentConnected(terminalId: string): boolean {
    return this._stateService.isConnected(terminalId);
  }

  public isCliAgentRunning(terminalId: string): boolean {
    return this._stateService.isRunning(terminalId);
  }

  public getAgentType(terminalId: string): CliAgentType | null {
    return this._stateService.getAgentType(terminalId);
  }

  public isGloballyActive(terminalId: string): boolean {
    return this._stateService.isGloballyActive(terminalId);
  }

  public getCurrentGloballyActiveAgent(): { terminalId: string; type: CliAgentType } | null {
    return this._stateService.getCurrentGloballyActiveAgent();
  }

  public getAllAgents(): Array<{ terminalId: string; agentInfo: CliAgentInfo }> {
    return this._stateService.getAllAgents().map((info) => ({
      terminalId: info.terminalId,
      agentInfo: info,
    }));
  }

  public getConnectedAgents(): Array<{ terminalId: string; agentInfo: CliAgentInfo }> {
    return this._stateService.getConnectedAgents().map((info) => ({
      terminalId: info.terminalId,
      agentInfo: info,
    }));
  }

  public getLastCommand(terminalId: string): string | undefined {
    const history = this._commandHistory.get(terminalId);
    return history && history.length > 0 ? history[history.length - 1] : undefined;
  }

  // =================== Administrative API ===================

  public deactivateAllAgents(): void {
    this._stateService.deactivateAllAgents();
  }

  public dispose(): void {
    this._stateService.dispose();
    this._displayService.dispose();
    this._onStatusChange.dispose();

    this._commandHistory.clear();
    this._inputBuffers.clear();
    this._outputBuffers.clear();

    log('🧹 [CLI-AGENT-MANAGER] Disposed CLI Agent integration manager');
  }

  // =================== Display Integration ===================

  /**
   * 表示更新データを生成（WebView向け）
   */
  public generateDisplayUpdate(terminalId: string): DisplayUpdateEvent {
    const agentInfo = this._stateService.getAgentInfo(terminalId);
    return this._displayService.generateDisplayUpdate(terminalId, agentInfo);
  }

  /**
   * WebView向けメッセージを生成
   */
  public generateWebViewMessage(
    terminalId: string
  ): ReturnType<typeof this._displayService.generateWebViewMessage> {
    const agentInfo = this._stateService.getAgentInfo(terminalId);
    return this._displayService.generateWebViewMessage(terminalId, agentInfo);
  }

  // =================== Private Methods ===================

  /**
   * イベントリスナーの設定
   */
  private _setupEventListeners(): void {
    // 状態変更イベントを外部APIイベントに変換
    this._stateService.onStateChange((event) => {
      const compatibilityEvent: CliAgentStatusEvent = {
        terminalId: event.terminalId,
        type: event.type,
        status: event.status,
      };

      this._onStatusChange.fire(compatibilityEvent);
    });
  }

  /**
   * コマンド履歴に追加
   */
  private _addToCommandHistory(terminalId: string, command: string): void {
    const history = this._commandHistory.get(terminalId) || [];
    history.push(command);

    // サイズ制限
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }

    this._commandHistory.set(terminalId, history);
  }

  /**
   * 出力バッファを更新
   */
  private _updateOutputBuffer(terminalId: string, data: string): void {
    const now = Date.now();
    const buffer = this._outputBuffers.get(terminalId) || { lines: [], lastUpdate: now };

    // 新しい行を追加
    const lines = data.split('\n');
    buffer.lines.push(...lines);
    buffer.lastUpdate = now;

    // サイズ制限
    if (buffer.lines.length > this.OUTPUT_BUFFER_SIZE) {
      buffer.lines = buffer.lines.slice(-this.OUTPUT_BUFFER_SIZE);
    }

    this._outputBuffers.set(terminalId, buffer);

    // 古いバッファのクリーンアップ
    this._cleanupOldBuffers();
  }

  /**
   * 終了検出（統合版）
   */
  private _detectExit(terminalId: string, data: string): boolean {
    // テキストベースの終了パターン
    if (this._detectionService.detectExit(data)) {
      return true;
    }

    // プロンプト復帰パターン
    const buffer = this._outputBuffers.get(terminalId);
    if (buffer && buffer.lines.length > 0) {
      return this._detectionService.detectPromptReturn(buffer.lines);
    }

    return false;
  }

  /**
   * 古い出力バッファのクリーンアップ
   */
  private _cleanupOldBuffers(): void {
    const now = Date.now();

    for (const [terminalId, buffer] of this._outputBuffers.entries()) {
      if (now - buffer.lastUpdate > this.OUTPUT_BUFFER_TTL) {
        this._outputBuffers.delete(terminalId);
      }
    }
  }
}
