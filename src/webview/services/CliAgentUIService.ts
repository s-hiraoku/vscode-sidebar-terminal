/**
 * CLI Agent UI Service
 *
 * CLI Agent状態とUI表示を統合的に管理するサービス。
 * CliAgentStateManagerとUIManagerを連携させ、
 * 状態変更とUI更新を一元化します。
 */

import { webview as log } from '../../utils/logger';
import type { CliAgentStateManager } from '../managers/CliAgentStateManager';
import type { IUIManager } from '../interfaces/ManagerInterfaces';
import type { TerminalInstance } from '../interfaces/ManagerInterfaces';

export type CliAgentStatusType = 'connected' | 'disconnected' | 'none';

export interface CliAgentUIServiceDeps {
  cliAgentStateManager: CliAgentStateManager;
  uiManager: IUIManager;
  getActiveTerminalId: () => string | null;
  getAllTerminalInstances: () => Map<string, TerminalInstance>;
}

/**
 * CLI Agent UI Service
 *
 * CLI Agent状態管理とUI更新を統合するサービス
 */
export class CliAgentUIService {
  private readonly deps: CliAgentUIServiceDeps;

  constructor(deps: CliAgentUIServiceDeps) {
    this.deps = deps;
  }

  /**
   * ターミナル名からターミナルIDを取得
   */
  private resolveTerminalIdByName(terminalName: string | null): string | null {
    if (!terminalName) {
      return this.deps.getActiveTerminalId();
    }

    const allInstances = this.deps.getAllTerminalInstances();
    for (const [terminalId, instance] of allInstances) {
      if (instance.name === terminalName) {
        return terminalId;
      }
    }

    return this.deps.getActiveTerminalId();
  }

  /**
   * Claude状態を更新（ターミナル名ベース）
   */
  public updateClaudeStatus(
    activeTerminalName: string | null,
    status: CliAgentStatusType,
    agentType: string | null
  ): void {
    log(`🔄 [CLI-AGENT-UI] UpdateClaudeStatus: ${activeTerminalName}, ${status}, ${agentType}`);

    const targetTerminalId = this.resolveTerminalIdByName(activeTerminalName);

    if (targetTerminalId) {
      this.updateAgentStateAndUI(targetTerminalId, status, agentType, activeTerminalName);
      log(`✅ [CLI-AGENT-UI] Claude status updated for terminal: ${targetTerminalId}`);
    } else {
      log(`❌ [CLI-AGENT-UI] Could not find terminal for: ${activeTerminalName}`);
    }
  }

  /**
   * CLI Agent状態を更新（ターミナルIDベース）
   */
  public updateCliAgentStatus(
    terminalId: string,
    status: CliAgentStatusType,
    agentType: string | null
  ): void {
    log(`🔄 [CLI-AGENT-UI] UpdateCliAgentStatus: ${terminalId}, ${status}, ${agentType}`);

    this.updateAgentStateAndUI(terminalId, status, agentType);
    log(`✅ [CLI-AGENT-UI] CLI Agent status updated for terminal: ${terminalId}`);
  }

  /**
   * 内部: 状態とUIの両方を更新
   */
  private updateAgentStateAndUI(
    terminalId: string,
    status: CliAgentStatusType,
    agentType: string | null,
    terminalName?: string | null
  ): void {
    // CLI Agent状態を更新
    this.deps.cliAgentStateManager.setAgentState(terminalId, {
      status,
      terminalName: terminalName || `Terminal ${terminalId}`,
      agentType,
    });

    // UI表示を更新
    this.deps.uiManager.updateCliAgentStatusByTerminalId(terminalId, status, agentType);
  }

  /**
   * ターミナルのCLI Agent状態を取得
   */
  public getAgentState(terminalId: string) {
    return this.deps.cliAgentStateManager.getAgentState(terminalId);
  }

  /**
   * CLI Agent接続を設定
   */
  public setAgentConnected(terminalId: string, agentType: string, terminalName?: string): void {
    this.deps.cliAgentStateManager.setAgentConnected(terminalId, agentType, terminalName);
  }

  /**
   * CLI Agent切断を設定
   */
  public setAgentDisconnected(terminalId: string): void {
    this.deps.cliAgentStateManager.setAgentDisconnected(terminalId);
  }

  /**
   * ターミナル状態を削除
   */
  public removeTerminalState(terminalId: string): void {
    this.deps.cliAgentStateManager.removeTerminalState(terminalId);
  }

  /**
   * Agent活動を検出
   */
  public detectAgentActivity(data: string, terminalId: string) {
    return this.deps.cliAgentStateManager.detectAgentActivity(data, terminalId);
  }

  /**
   * 統計情報を取得
   */
  public getAgentStats() {
    return this.deps.cliAgentStateManager.getAgentStats();
  }
}
