/**
 * CLI Agent State Management Service
 * CLI Agentの状態管理とグローバルアクティブエージェントの管理
 */

import { EventEmitter } from 'events';

export enum CliAgentStatus {
  NONE = 'none',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
}

export interface CliAgentState {
  terminalId: string;
  type: 'claude' | 'gemini' | 'codex';
  status: CliAgentStatus;
  previousStatus: CliAgentStatus;
}

export interface ActiveAgent {
  terminalId: string;
  type: 'claude' | 'gemini' | 'codex';
}

/**
 * CLI Agentの状態を管理するサービス
 * - 各ターミナルのAgentタイプと状態を追跡
 * - グローバルに1つのCONNECTEDエージェントのみ許可
 * - 状態変更イベントの発火
 */
export class CliAgentStateService extends EventEmitter {
  private agentStates = new Map<string, { type: 'claude' | 'gemini' | 'codex'; status: CliAgentStatus }>();
  private currentGloballyActive: ActiveAgent | null = null;

  /**
   * エージェントをアクティブ化（CONNECTED状態に変更）
   * 既存のCONNECTEDエージェントは自動的にDISCONNECTEDになる
   */
  activateAgent(terminalId: string, type: 'claude' | 'gemini' | 'codex'): void {
    const currentStatus = this.getStatus(terminalId);

    // Deactivate current globally active agent
    if (this.currentGloballyActive && this.currentGloballyActive.terminalId !== terminalId) {
      const prevTerminalId = this.currentGloballyActive.terminalId;
      const prevAgent = this.agentStates.get(prevTerminalId);
      if (prevAgent && prevAgent.status === CliAgentStatus.CONNECTED) {
        const prevStatus = prevAgent.status;
        prevAgent.status = CliAgentStatus.DISCONNECTED;
        this.emit('stateChange', {
          terminalId: prevTerminalId,
          type: prevAgent.type,
          status: CliAgentStatus.DISCONNECTED,
          previousStatus: prevStatus,
        });
      }
    }

    // Set new agent as CONNECTED
    this.agentStates.set(terminalId, { type, status: CliAgentStatus.CONNECTED });
    this.currentGloballyActive = { terminalId, type };

    // Emit state change event
    this.emit('stateChange', {
      terminalId,
      type,
      status: CliAgentStatus.CONNECTED,
      previousStatus: currentStatus,
    });
  }

  /**
   * エージェントを非アクティブ化（NONE状態に変更）
   * CONNECTEDエージェントが非アクティブ化された場合、DISCONNECTEDエージェントを昇格
   */
  deactivateAgent(terminalId: string): void {
    const agent = this.agentStates.get(terminalId);
    if (!agent) return;

    const previousStatus = agent.status;
    const wasGloballyActive = this.currentGloballyActive?.terminalId === terminalId;

    // Remove agent
    this.agentStates.delete(terminalId);

    // Clear globally active if this was it
    if (wasGloballyActive) {
      this.currentGloballyActive = null;

      // Promote a DISCONNECTED agent to CONNECTED
      for (const [id, state] of this.agentStates) {
        if (state.status === CliAgentStatus.DISCONNECTED) {
          state.status = CliAgentStatus.CONNECTED;
          this.currentGloballyActive = { terminalId: id, type: state.type };

          this.emit('stateChange', {
            terminalId: id,
            type: state.type,
            status: CliAgentStatus.CONNECTED,
            previousStatus: CliAgentStatus.DISCONNECTED,
          });
          break;
        }
      }
    }

    // Emit deactivation event
    this.emit('stateChange', {
      terminalId,
      type: agent.type,
      status: CliAgentStatus.NONE,
      previousStatus,
    });
  }

  /**
   * 指定ターミナルの状態を取得
   */
  getStatus(terminalId: string): CliAgentStatus {
    return this.agentStates.get(terminalId)?.status || CliAgentStatus.NONE;
  }

  /**
   * 指定ターミナルのエージェントタイプを取得
   */
  getAgentType(terminalId: string): 'claude' | 'gemini' | 'codex' | null {
    return this.agentStates.get(terminalId)?.type || null;
  }

  /**
   * 現在グローバルにアクティブなエージェントを取得
   */
  getCurrentGloballyActiveAgent(): ActiveAgent | null {
    return this.currentGloballyActive;
  }

  /**
   * 全エージェントの状態を取得
   */
  getAllAgentStates(): Map<string, { type: 'claude' | 'gemini' | 'codex'; status: CliAgentStatus }> {
    return new Map(this.agentStates);
  }

  /**
   * 状態変更イベントリスナーを登録
   */
  onStateChange(callback: (state: CliAgentState) => void): void {
    this.on('stateChange', callback);
  }

  /**
   * リソースの解放
   */
  dispose(): void {
    this.removeAllListeners();
    this.agentStates.clear();
    this.currentGloballyActive = null;
  }
}
