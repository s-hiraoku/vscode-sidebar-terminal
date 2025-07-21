import { EventEmitter } from 'vscode';
import { terminal as log } from '../utils/logger';

/**
 * CLI Agent の状態定義
 */
export enum CliAgentStatus {
  NONE = 'none',           // CLI Agentが検出されていない、または終了済み
  CONNECTED = 'connected', // CLI Agentが実行中でグローバルアクティブ
  DISCONNECTED = 'disconnected', // CLI Agentが実行中だが他のターミナルがアクティブ
}

/**
 * CLI Agent の種別
 */
export type CliAgentType = 'claude' | 'gemini';

/**
 * CLI Agent の状態情報
 */
export interface CliAgentInfo {
  terminalId: string;
  type: CliAgentType;
  status: CliAgentStatus;
  startTime: Date;
  lastActivity: Date;
}

/**
 * CLI Agent状態変更イベント
 */
export interface CliAgentStateChangeEvent {
  terminalId: string;
  type: CliAgentType | null;
  status: CliAgentStatus;
  previousStatus: CliAgentStatus;
}

/**
 * CLI Agent状態管理サービス
 * 
 * 責務：
 * - 全CLI Agentの状態を一元管理
 * - 相互排他制御の実装
 * - 自動昇格システム
 * - 状態変更イベントの発火
 */
export class CliAgentStateService {
  private readonly _agents = new Map<string, CliAgentInfo>();
  private _globalActiveAgent: { terminalId: string; type: CliAgentType } | null = null;
  private readonly _onStateChange = new EventEmitter<CliAgentStateChangeEvent>();

  public readonly onStateChange = this._onStateChange.event;

  /**
   * CLI Agentを登録/アクティブ化
   */
  public activateAgent(terminalId: string, type: CliAgentType): void {
    const now = new Date();
    const previousStatus = this.getStatus(terminalId);

    // 相互排他制御: 既存のCONNECTEDをDISCONNECTEDに変更
    if (this._globalActiveAgent && this._globalActiveAgent.terminalId !== terminalId) {
      this._changeAgentStatus(this._globalActiveAgent.terminalId, CliAgentStatus.DISCONNECTED);
    }

    // エージェント情報を作成/更新
    const agentInfo: CliAgentInfo = {
      terminalId,
      type,
      status: CliAgentStatus.CONNECTED,
      startTime: this._agents.get(terminalId)?.startTime || now,
      lastActivity: now,
    };

    this._agents.set(terminalId, agentInfo);
    this._globalActiveAgent = { terminalId, type };

    log(`✅ [CLI-AGENT-STATE] Activated ${type.toUpperCase()} CLI in terminal ${terminalId}`);

    // イベント発火
    this._onStateChange.fire({
      terminalId,
      type,
      status: CliAgentStatus.CONNECTED,
      previousStatus,
    });
  }

  /**
   * CLI Agentを非アクティブ化/削除
   */
  public deactivateAgent(terminalId: string): void {
    const agentInfo = this._agents.get(terminalId);
    if (!agentInfo) {
      return;
    }

    const previousStatus = agentInfo.status;
    const agentType = agentInfo.type;

    // エージェント削除
    this._agents.delete(terminalId);

    // グローバルアクティブエージェントの更新
    if (this._globalActiveAgent && this._globalActiveAgent.terminalId === terminalId) {
      this._globalActiveAgent = null;
      
      // 自動昇格: DISCONNECTEDの中から1つを選択
      this._promoteNextAgent();
    }

    log(`❌ [CLI-AGENT-STATE] Deactivated ${agentType.toUpperCase()} CLI in terminal ${terminalId}`);

    // イベント発火
    this._onStateChange.fire({
      terminalId,
      type: null,
      status: CliAgentStatus.NONE,
      previousStatus,
    });
  }

  /**
   * ターミナル削除時のクリーンアップ
   */
  public cleanupTerminal(terminalId: string): void {
    if (this._agents.has(terminalId)) {
      this.deactivateAgent(terminalId);
    }
  }

  /**
   * エージェント状態の取得
   */
  public getStatus(terminalId: string): CliAgentStatus {
    return this._agents.get(terminalId)?.status || CliAgentStatus.NONE;
  }

  public getAgentType(terminalId: string): CliAgentType | null {
    return this._agents.get(terminalId)?.type || null;
  }

  public getAgentInfo(terminalId: string): CliAgentInfo | null {
    return this._agents.get(terminalId) || null;
  }

  /**
   * 便利メソッド
   */
  public isConnected(terminalId: string): boolean {
    return this.getStatus(terminalId) === CliAgentStatus.CONNECTED;
  }

  public isRunning(terminalId: string): boolean {
    const status = this.getStatus(terminalId);
    return status === CliAgentStatus.CONNECTED || status === CliAgentStatus.DISCONNECTED;
  }

  public isGloballyActive(terminalId: string): boolean {
    return this._globalActiveAgent?.terminalId === terminalId || false;
  }

  /**
   * グローバル状態の取得
   */
  public getCurrentGloballyActiveAgent(): { terminalId: string; type: CliAgentType } | null {
    return this._globalActiveAgent;
  }

  public getAllAgents(): CliAgentInfo[] {
    return Array.from(this._agents.values());
  }

  public getConnectedAgents(): CliAgentInfo[] {
    return this.getAllAgents().filter(agent => agent.status === CliAgentStatus.CONNECTED);
  }

  /**
   * 全エージェントの強制終了
   */
  public deactivateAllAgents(): void {
    const terminalIds = Array.from(this._agents.keys());
    terminalIds.forEach(terminalId => this.deactivateAgent(terminalId));
  }

  /**
   * リソースクリーンアップ
   */
  public dispose(): void {
    this._agents.clear();
    this._globalActiveAgent = null;
    this._onStateChange.dispose();
    log('🧹 [CLI-AGENT-STATE] Disposed CLI Agent state service');
  }

  // =================== Private Methods ===================

  /**
   * エージェント状態を変更（内部用）
   */
  private _changeAgentStatus(terminalId: string, status: CliAgentStatus): void {
    const agentInfo = this._agents.get(terminalId);
    if (!agentInfo || agentInfo.status === status) {
      return;
    }

    const previousStatus = agentInfo.status;
    agentInfo.status = status;
    agentInfo.lastActivity = new Date();

    log(`🔄 [CLI-AGENT-STATE] Changed ${agentInfo.type.toUpperCase()} CLI in terminal ${terminalId} from ${previousStatus} to ${status}`);

    // イベント発火
    this._onStateChange.fire({
      terminalId,
      type: agentInfo.type,
      status,
      previousStatus,
    });
  }

  /**
   * 次のエージェントを自動昇格
   */
  private _promoteNextAgent(): void {
    // DISCONNECTEDエージェントを探して昇格
    for (const [terminalId, agentInfo] of this._agents.entries()) {
      if (agentInfo.status === CliAgentStatus.DISCONNECTED) {
        this._changeAgentStatus(terminalId, CliAgentStatus.CONNECTED);
        this._globalActiveAgent = { terminalId, type: agentInfo.type };
        
        log(`⬆️ [CLI-AGENT-STATE] Promoted ${agentInfo.type.toUpperCase()} CLI in terminal ${terminalId} to CONNECTED`);
        return;
      }
    }

    log('📭 [CLI-AGENT-STATE] No agents available for promotion');
  }
}