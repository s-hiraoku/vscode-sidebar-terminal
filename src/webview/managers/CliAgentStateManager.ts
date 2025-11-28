/**
 * CLI Agent State Manager
 *
 * CLI Agent（Claude Code、Gemini Code等）の状態管理を担当
 * 責務：エージェント状態追跡、接続管理、出力検出、状態同期
 */

import { webview as log } from '../../utils/logger';

/**
 * CLI Agentの状態定義
 */
export interface CliAgentState {
  status: 'connected' | 'disconnected' | 'none';
  terminalName: string;
  agentType: string | null;
  preserveScrollPosition: boolean;
  isDisplayingChoices?: boolean;
  lastChoiceDetected?: number;
}

/**
 * CLI Agent状態管理クラス
 * 各ターミナルのCLI Agent状態を追跡・管理
 */
export class CliAgentStateManager {
  // ターミナル毎のCLI Agent状態
  private cliAgentStates = new Map<string, CliAgentState>();
  private currentConnectedAgentId: string | null = null;

  // エージェント出力検出パターン
  private readonly AGENT_OUTPUT_PATTERNS = [
    /Claude\s+Code/, // "Claude Code" (大文字のみ)
    /gemini.*code/i,
    /Thinking|Processing|Analyzing/i,
    /Select|Choose|Option/i,
  ];

  // エージェント種別検出パターン
  private readonly AGENT_TYPE_PATTERNS = {
    claude: /Claude\s+Code/, // "Claude Code" (大文字のみ)
    gemini: /gemini.*code/i,
    generic: /AI|Assistant|Agent/i,
  };

  constructor() {
    log('🤖 CliAgentStateManager initialized');
  }

  /**
   * ターミナルのCLI Agent状態を取得
   */
  public getAgentState(terminalId: string): CliAgentState | null {
    return this.cliAgentStates.get(terminalId) || null;
  }

  /**
   * ターミナルのCLI Agent状態を設定
   */
  public setAgentState(terminalId: string, state: Partial<CliAgentState>): void {
    const currentState = this.cliAgentStates.get(terminalId);
    const newState: CliAgentState = {
      status: 'none',
      terminalName: `Terminal ${terminalId}`,
      agentType: null,
      preserveScrollPosition: false,
      isDisplayingChoices: false,
      lastChoiceDetected: undefined,
      ...currentState,
      ...state,
    };

    this.cliAgentStates.set(terminalId, newState);

    // 接続状態の更新
    if (newState.status === 'connected') {
      this.currentConnectedAgentId = terminalId;
    } else if (this.currentConnectedAgentId === terminalId) {
      this.currentConnectedAgentId = null;
    }

    log(`🔄 Agent state updated for terminal ${terminalId}:`, newState);
  }

  /**
   * 現在接続中のエージェントIDを取得
   */
  public getCurrentConnectedAgentId(): string | null {
    return this.currentConnectedAgentId;
  }

  /**
   * 全てのCLI Agent状態を取得
   */
  public getAllAgentStates(): Map<string, CliAgentState> {
    return new Map(this.cliAgentStates);
  }

  /**
   * 出力からCLI Agentアクティビティを検出
   */
  public detectAgentActivity(
    output: string,
    terminalId: string
  ): {
    isAgentOutput: boolean;
    agentType: string | null;
    isDisplayingChoices: boolean;
  } {
    try {
      // エージェント出力かチェック
      const isAgentOutput = this.AGENT_OUTPUT_PATTERNS.some((pattern) => pattern.test(output));

      // エージェント種別を検出
      let agentType: string | null = null;
      for (const [type, pattern] of Object.entries(this.AGENT_TYPE_PATTERNS)) {
        if (pattern.test(output)) {
          agentType = type;
          break;
        }
      }

      // 選択肢表示の検出
      const isDisplayingChoices = /Select|Choose|Option|\[1\]|\[2\]|\[3\]/i.test(output);

      // 状態を更新
      if (isAgentOutput) {
        const currentState = this.getAgentState(terminalId);
        this.setAgentState(terminalId, {
          status: 'connected',
          agentType: agentType || currentState?.agentType || 'generic',
          isDisplayingChoices,
          lastChoiceDetected: isDisplayingChoices ? Date.now() : currentState?.lastChoiceDetected,
        });
      }

      return {
        isAgentOutput,
        agentType,
        isDisplayingChoices,
      };
    } catch (error) {
      log(`❌ Failed to detect agent activity for terminal ${terminalId}:`, error);
      return {
        isAgentOutput: false,
        agentType: null,
        isDisplayingChoices: false,
      };
    }
  }

  /**
   * エージェントの接続状態を設定
   */
  public setAgentConnected(terminalId: string, agentType: string, terminalName?: string): void {
    this.setAgentState(terminalId, {
      status: 'connected',
      agentType,
      terminalName: terminalName || `Terminal ${terminalId}`,
      preserveScrollPosition: true,
    });

    log(`🔗 Agent connected: ${agentType} in terminal ${terminalId}`);
  }

  /**
   * エージェントの切断状態を設定
   */
  public setAgentDisconnected(terminalId: string): void {
    const currentState = this.getAgentState(terminalId);
    if (currentState) {
      this.setAgentState(terminalId, {
        status: 'disconnected',
        preserveScrollPosition: false,
        isDisplayingChoices: false,
      });

      log(`✨ Agent disconnected in terminal ${terminalId}`);
    }
  }

  /**
   * エージェント状態をクリア
   */
  public clearAgentState(terminalId: string): void {
    this.setAgentState(terminalId, {
      status: 'none',
      agentType: null,
      preserveScrollPosition: false,
      isDisplayingChoices: false,
      lastChoiceDetected: undefined,
    });

    log(`🧹 Agent state cleared for terminal ${terminalId}`);
  }

  /**
   * ターミナル削除時のクリーンアップ
   */
  public removeTerminalState(terminalId: string): void {
    if (this.currentConnectedAgentId === terminalId) {
      this.currentConnectedAgentId = null;
    }

    this.cliAgentStates.delete(terminalId);
    log(`🗑️ Agent state removed for terminal ${terminalId}`);
  }

  /**
   * エージェントが選択肢を表示中かチェック
   */
  public isAgentDisplayingChoices(terminalId: string): boolean {
    const state = this.getAgentState(terminalId);
    return state?.isDisplayingChoices === true;
  }

  /**
   * エージェントのスクロール位置保持が必要かチェック
   */
  public shouldPreserveScrollPosition(terminalId: string): boolean {
    const state = this.getAgentState(terminalId);
    return state?.preserveScrollPosition === true;
  }

  /**
   * エージェント状態の統計情報
   */
  public getAgentStats(): {
    totalAgents: number;
    connectedAgents: number;
    disconnectedAgents: number;
    currentConnectedId: string | null;
    agentTypes: string[];
  } {
    const states = Array.from(this.cliAgentStates.values());
    const agentTypes = Array.from(
      new Set(states.map((state) => state.agentType).filter((type) => type !== null))
    ) as string[];

    return {
      totalAgents: this.cliAgentStates.size,
      connectedAgents: states.filter((state) => state.status === 'connected').length,
      disconnectedAgents: states.filter((state) => state.status === 'disconnected').length,
      currentConnectedId: this.currentConnectedAgentId,
      agentTypes,
    };
  }

  /**
   * エージェント状態をExtension向けに同期
   */
  public getStateForExtension(terminalId: string): {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
    terminalId: string;
  } | null {
    const state = this.getAgentState(terminalId);
    if (!state) {
      return null;
    }

    return {
      activeTerminalName: state.terminalName,
      status: state.status,
      agentType: state.agentType,
      terminalId,
    };
  }

  /**
   * 全エージェントの完全状態同期データを取得
   */
  public getFullStateSync(): {
    allAgents: Map<string, CliAgentState>;
    currentConnectedId: string | null;
    timestamp: number;
  } {
    return {
      allAgents: new Map(this.cliAgentStates),
      currentConnectedId: this.currentConnectedAgentId,
      timestamp: Date.now(),
    };
  }

  /**
   * 設定された状態から完全同期を実行
   */
  public applyFullStateSync(syncData: {
    allAgents: Map<string, CliAgentState>;
    currentConnectedId: string | null;
  }): void {
    try {
      // 既存状態をクリア
      this.cliAgentStates.clear();

      // 新しい状態を適用
      for (const [terminalId, state] of syncData.allAgents) {
        this.cliAgentStates.set(terminalId, state);
      }

      this.currentConnectedAgentId = syncData.currentConnectedId;

      log('🔄 Full agent state sync applied');
    } catch (error) {
      log('❌ Failed to apply full agent state sync:', error);
    }
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    log('🧹 Disposing CliAgentStateManager...');

    this.cliAgentStates.clear();
    this.currentConnectedAgentId = null;

    log('✅ CliAgentStateManager disposed');
  }
}
