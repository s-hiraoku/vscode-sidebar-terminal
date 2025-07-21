import { terminal as log } from '../utils/logger';
import type { TerminalManager } from '../terminals/TerminalManager';
import * as vscode from 'vscode';

/**
 * CLI Agent の種別
 */
export type CliAgentType = 'claude' | 'gemini';

/**
 * CLI Agent の状態
 */
export enum CliAgentStatus {
  NONE = 'none', // CLI Agentが検出されていない、または終了済み
  CONNECTED = 'connected', // CLI Agentが実行中でグローバルアクティブ
  DISCONNECTED = 'disconnected', // CLI Agentが実行中だが他のターミナルがアクティブ
}

/**
 * CLI Agent の状態情報
 */
interface CliAgentInfo {
  type: CliAgentType;
  status: CliAgentStatus;
  startTime: Date;
  lastActivity: Date;
}

/**
 * CLI Agent状態変更イベントの型
 */
export interface CliAgentStatusEvent {
  terminalId: string;
  type: CliAgentType | null;
  status: CliAgentStatus;
}

/**
 * サイドバーターミナル内のCLI Agents検出を担当するクラス
 * 複数のCLI Agents（claude code / gemini cli）に対応
 */
export class SecondaryCliAgentDetector {
  // CLI Agents detection and command history
  private readonly _commandHistory = new Map<string, string[]>(); // terminalId -> commands
  private readonly _cliAgentsInfo = new Map<string, CliAgentInfo>(); // terminalId -> agent info
  private _currentInputBuffer = new Map<string, string>(); // terminalId -> partial input
  private readonly MAX_HISTORY_SIZE = 100;

  // Activity monitoring (タイムアウト機能は削除 - CLI Agentが存在する限り送信対象として維持)

  // Additional monitoring for more accurate detection
  private readonly _lastOutputTime = new Map<string, number>();
  private readonly _promptDetectionBuffer = new Map<string, string[]>(); // Store recent output lines for prompt detection

  // Global state management for mutual exclusion
  private _globalActiveAgent: { terminalId: string; type: CliAgentType } | null = null; // Only one CLI Agent active globally

  // Event emitter for CLI Agent status changes
  private readonly _cliAgentStatusEmitter = new vscode.EventEmitter<CliAgentStatusEvent>();

  public readonly onCliAgentStatusChange = this._cliAgentStatusEmitter.event;

  constructor(private readonly terminalManager: TerminalManager) {
    // TerminalManagerの入出力イベントを監視
    this.setupEventListeners();
  }

  /**
   * TerminalManagerのイベントリスナーを設定
   */
  private setupEventListeners(): void {
    // TerminalManagerが既に直接handleTerminalOutputを呼び出しているため、
    // 追加のイベントリスナーは不要（重複を避けるため）
    log('✅ [CLI-AGENTS-DETECTOR] Event listeners setup completed for multiple CLI Agents');
  }

  /**
   * Track input for command history and CLI Agents detection
   * TerminalManagerのsendInputから呼び出される
   */
  public trackInput(terminalId: string, data: string): void {
    // Get or create input buffer for this terminal
    let buffer = this._currentInputBuffer.get(terminalId) || '';
    buffer += data;
    this._currentInputBuffer.set(terminalId, buffer);

    // Check if we have a complete command (ends with newline)
    if (data.includes('\r') || data.includes('\n')) {
      // Extract the command from buffer
      const command = buffer.trim();

      if (command) {
        // Add to command history
        this._addToCommandHistory(terminalId, command);

        // Check for CLI Agents commands
        const agentType = this._detectAgentFromCommand(command);
        if (agentType) {
          log(
            `🚀 [CLI-AGENTS-DETECTOR] ${agentType.toUpperCase()} CLI command detected in terminal ${terminalId}: ${command}`
          );
          this._activateCliAgent(terminalId, agentType);
        }
      }

      // Clear the buffer
      this._currentInputBuffer.set(terminalId, '');
    }

    // Update last activity time for reference (no timeout action)
    this._updateLastActivityTime(terminalId);
  }

  /**
   * Handle terminal output for CLI Agents detection
   * TerminalManagerのonDataイベントから呼び出される
   */
  public handleTerminalOutput(terminalId: string, data: string): void {
    // 詳細なデバッグログ（最初の100文字のみ表示）
    const shortData = data.substring(0, 100).replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    log(
      `📥 [CLI-AGENTS-DETECTOR] Terminal ${terminalId} output: "${shortData}${data.length > 100 ? '...' : ''}"`
    );

    // Update last output time for accurate timeout detection
    this._lastOutputTime.set(terminalId, Date.now());

    // Update prompt detection buffer
    this._updatePromptBuffer(terminalId, data);

    // 現在のエージェント状態をログ
    const currentAgent = this._cliAgentsInfo.get(terminalId);
    if (currentAgent) {
      log(
        `📊 [CLI-AGENTS-DETECTOR] Current agent status: ${currentAgent.type.toUpperCase()} - ${currentAgent.status.toUpperCase()}`
      );
    }

    // 各CLI Agentの出力パターンをチェック
    const detectedAgent = this._detectAgentFromOutput(data);

    if (detectedAgent) {
      if (!currentAgent || currentAgent.status === CliAgentStatus.NONE) {
        log(
          `🔍 [CLI-AGENTS-DETECTOR] ${detectedAgent.toUpperCase()} CLI pattern detected in output for terminal ${terminalId}`
        );
        this._activateCliAgent(terminalId, detectedAgent);
      } else {
        log(
          `🔄 [CLI-AGENTS-DETECTOR] ${detectedAgent.toUpperCase()} CLI already detected for terminal ${terminalId} (status: ${currentAgent.status})`
        );
      }
    }

    // 終了パターンをチェック（改良版）
    const hasExitPattern = this._detectExitPattern(data) || this._detectPromptReturn(terminalId);
    if (hasExitPattern) {
      const agentInfo = this._cliAgentsInfo.get(terminalId);
      if (agentInfo) {
        log(
          `👋 [CLI-AGENTS-DETECTOR] ${agentInfo.type.toUpperCase()} CLI exit pattern detected for terminal ${terminalId} (current status: ${agentInfo.status})`
        );
        this._deactivateCliAgent(terminalId);
      } else {
        log(
          `⚠️ [CLI-AGENTS-DETECTOR] Exit pattern detected but no agent found for terminal ${terminalId}`
        );
      }
    }

    // Update last activity time for reference (no timeout action)
    this._updateLastActivityTime(terminalId);
  }

  /**
   * コマンドからCLI Agentの種別を検出
   */
  private _detectAgentFromCommand(command: string): CliAgentType | null {
    const lowerCommand = command.toLowerCase().trim();

    // Claude Code CLI detection
    if (lowerCommand.startsWith('claude')) {
      return 'claude';
    }

    // Gemini CLI detection
    if (lowerCommand.startsWith('gemini')) {
      return 'gemini';
    }

    return null;
  }

  /**
   * 出力からCLI Agentの種別を検出
   */
  private _detectAgentFromOutput(data: string): CliAgentType | null {
    const lowerData = data.toLowerCase();

    // Claude Code CLI patterns
    const claudePatterns = [
      'welcome to claude code',
      'claude code cli',
      'claude.ai',
      'anthropic',
      'human:',
      'assistant:',
      'type your message',
      'to start a conversation',
    ];

    // Gemini CLI patterns
    const geminiPatterns = [
      'welcome to gemini',
      'gemini cli',
      'google ai',
      'bard',
      'user:',
      'model:',
      'enter your prompt',
      'gemini is ready',
    ];

    // Check Claude patterns
    for (const pattern of claudePatterns) {
      if (lowerData.includes(pattern)) {
        return 'claude';
      }
    }

    // Check Gemini patterns
    for (const pattern of geminiPatterns) {
      if (lowerData.includes(pattern)) {
        return 'gemini';
      }
    }

    return null;
  }

  /**
   * 終了パターンを検出
   */
  private _detectExitPattern(data: string): boolean {
    const lowerData = data.toLowerCase();

    // 共通の終了パターン
    const exitPatterns = [
      'goodbye',
      'chat ended',
      'session terminated',
      'exiting',
      'bye',
      'quit',
      'exit',
      'session closed',
      'connection closed',
    ];

    // EOF markers (プロセス終了)
    const eofPatterns = [
      '\u0004', // EOT (End of Transmission)
      '\u001a', // SUB (Substitute)
      'process exit',
      'command not found',
      'terminated',
      'killed',
    ];

    // 実用的な終了パターン（Ctrl+C、プロンプト復帰、エラー終了）
    const practicalExitPatterns = [
      '^c', // Ctrl+C中断
      'keyboardinterrupt', // Python KeyboardInterrupt
      'sigint', // SIGINT signal
      'interrupted', // 中断メッセージ
      'cancelled', // キャンセルメッセージ
    ];

    // プロンプト復帰パターン（CLI Agentからシェルに戻った）
    const promptPatterns = [
      /\$\s*$/, // bash prompt at end
      /%\s*$/, // zsh prompt at end
      />\s*$/, // cmd prompt at end
      /bash-\d+\.\d+\$/, // bash version prompt
      /➜\s+/, // oh-my-zsh prompt
    ];

    // Check text-based exit patterns
    for (const pattern of [...exitPatterns, ...eofPatterns, ...practicalExitPatterns]) {
      if (lowerData.includes(pattern)) {
        log(
          `🔍 [CLI-AGENTS-DETECTOR] Exit pattern detected: "${pattern}" in data: "${data.substring(0, 100)}..."`
        );
        return true;
      }
    }

    // Check regex-based prompt patterns
    for (const pattern of promptPatterns) {
      if (pattern.test(data)) {
        log(
          `🔍 [CLI-AGENTS-DETECTOR] Prompt pattern detected: ${pattern} in data: "${data.substring(0, 100)}..."`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * プロンプト検知バッファを更新
   */
  private _updatePromptBuffer(terminalId: string, data: string): void {
    const lines = data.split('\n');
    let buffer = this._promptDetectionBuffer.get(terminalId) || [];

    // Add new lines to buffer
    buffer.push(...lines);

    // Keep only last 10 lines for analysis
    if (buffer.length > 10) {
      buffer = buffer.slice(-10);
    }

    this._promptDetectionBuffer.set(terminalId, buffer);
  }

  /**
   * プロンプト復帰を検知（バッファ分析による）
   */
  private _detectPromptReturn(terminalId: string): boolean {
    const buffer = this._promptDetectionBuffer.get(terminalId) || [];
    const recentLines = buffer.slice(-3); // 最新3行を分析

    // 複数行にわたるプロンプトパターンをチェック
    const combinedText = recentLines.join('\n');

    // Shell prompt patterns at the end of output
    const shellPromptPatterns = [
      /\$\s*$/m, // bash prompt
      /%\s*$/m, // zsh prompt
      />\s*$/m, // cmd prompt
      /bash-[0-9.]+\$\s*$/m, // bash version prompt
      /➜\s+\w*\s*$/m, // oh-my-zsh prompt
      /\[\w+@\w+\s+[^\]]+\]\$\s*$/m, // [user@host dir]$ prompt
    ];

    for (const pattern of shellPromptPatterns) {
      if (pattern.test(combinedText)) {
        log(
          `🔍 [CLI-AGENTS-DETECTOR] Shell prompt return detected: ${pattern} in "${combinedText.replace(/\n/g, '\\n')}"`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * 最終活動時刻を更新（参考情報として記録）
   */
  private _updateLastActivityTime(terminalId: string): void {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    if (agentInfo) {
      agentInfo.lastActivity = new Date();
    }
  }

  /**
   * Add command to history
   */
  private _addToCommandHistory(terminalId: string, command: string): void {
    const history = this._commandHistory.get(terminalId) || [];
    history.push(command);

    // Limit history size
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }

    this._commandHistory.set(terminalId, history);
    log(`📝 [CLI-AGENTS-DETECTOR] Command added to history for ${terminalId}: ${command}`);
  }

  /**
   * Activate CLI Agent for a terminal (with mutual exclusion)
   */
  private _activateCliAgent(terminalId: string, type: CliAgentType): void {
    const now = new Date();

    // MUTUAL EXCLUSION: 既存のCONNECTEDをDISCONNECTEDに変更
    if (this._globalActiveAgent && this._globalActiveAgent.terminalId !== terminalId) {
      const previousTerminalId = this._globalActiveAgent.terminalId;
      const previousAgentInfo = this._cliAgentsInfo.get(previousTerminalId);

      if (previousAgentInfo && previousAgentInfo.status === CliAgentStatus.CONNECTED) {
        previousAgentInfo.status = CliAgentStatus.DISCONNECTED;
        log(
          `🔄 [CLI-AGENTS-DETECTOR] Changed ${this._globalActiveAgent.type.toUpperCase()} CLI in terminal ${previousTerminalId} from CONNECTED to DISCONNECTED`
        );

        // Emit status change event for previous terminal
        this._cliAgentStatusEmitter.fire({
          terminalId: previousTerminalId,
          type: previousAgentInfo.type,
          status: CliAgentStatus.DISCONNECTED,
        });
      }
    }

    // 既存のエージェント情報を取得または作成
    let agentInfo = this._cliAgentsInfo.get(terminalId);
    if (!agentInfo) {
      // 新しいエージェント情報を作成
      agentInfo = {
        type,
        status: CliAgentStatus.CONNECTED,
        startTime: now,
        lastActivity: now,
      };
      this._cliAgentsInfo.set(terminalId, agentInfo);
      log(
        `✨ [CLI-AGENTS-DETECTOR] Created new ${type.toUpperCase()} CLI agent for terminal: ${terminalId}`
      );
    } else {
      // 既存のエージェントをCONNECTEDに変更
      agentInfo.status = CliAgentStatus.CONNECTED;
      agentInfo.lastActivity = now;
      log(
        `🔄 [CLI-AGENTS-DETECTOR] Changed existing ${type.toUpperCase()} CLI in terminal ${terminalId} to CONNECTED`
      );
    }

    // Update global active agent state
    this._globalActiveAgent = { terminalId, type };

    log(
      `✅ [CLI-AGENTS-DETECTOR] ${type.toUpperCase()} CLI activated for terminal: ${terminalId} (now globally active)`
    );
    log(
      `📊 [CLI-AGENTS-DETECTOR] Global active agent: ${this._globalActiveAgent.type.toUpperCase()} in terminal ${this._globalActiveAgent.terminalId}`
    );

    // Emit status change event
    this._cliAgentStatusEmitter.fire({
      terminalId,
      type,
      status: CliAgentStatus.CONNECTED,
    });

    // Record initial activity time
    this._updateLastActivityTime(terminalId);
  }

  /**
   * Terminate CLI Agent for a terminal (complete removal and state promotion)
   */
  private _deactivateCliAgent(terminalId: string): void {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    if (!agentInfo) {
      return;
    }

    log(
      `❌ [CLI-AGENTS-DETECTOR] ${agentInfo.type.toUpperCase()} CLI terminated for terminal: ${terminalId} (status: ${agentInfo.status})`
    );

    // 完全に削除（NONE状態にする）
    this._cliAgentsInfo.delete(terminalId);

    // グローバルアクティブエージェントの更新
    let newGlobalAgent: { terminalId: string; type: CliAgentType } | null = null;

    if (this._globalActiveAgent && this._globalActiveAgent.terminalId === terminalId) {
      // 現在グローバルアクティブだったエージェントが終了した場合
      this._globalActiveAgent = null;

      // DISCONNECTEDの中から1つを選んでCONNECTEDに昇格
      newGlobalAgent = this._promoteDisconnectedAgent();
    }

    // 終了イベントを発火（NONE状態）
    this._cliAgentStatusEmitter.fire({
      terminalId,
      type: null, // 終了時はnull
      status: CliAgentStatus.NONE,
    });

    // 新しいグローバルエージェントがあれば、そのイベントも発火
    if (newGlobalAgent) {
      this._cliAgentStatusEmitter.fire({
        terminalId: newGlobalAgent.terminalId,
        type: newGlobalAgent.type,
        status: CliAgentStatus.CONNECTED,
      });
    }
  }

  /**
   * DISCONNECTEDエージェントの中から1つをCONNECTEDに昇格
   */
  private _promoteDisconnectedAgent(): { terminalId: string; type: CliAgentType } | null {
    // DISCONNECTEDなエージェントを探す
    for (const [terminalId, agentInfo] of this._cliAgentsInfo.entries()) {
      if (agentInfo.status === CliAgentStatus.DISCONNECTED) {
        // 最初に見つかったDISCONNECTEDをCONNECTEDに昇格
        agentInfo.status = CliAgentStatus.CONNECTED;
        this._globalActiveAgent = { terminalId, type: agentInfo.type };

        log(
          `⬆️ [CLI-AGENTS-DETECTOR] Promoted ${agentInfo.type.toUpperCase()} CLI in terminal ${terminalId} from DISCONNECTED to CONNECTED`
        );

        return this._globalActiveAgent;
      }
    }

    log(`📭 [CLI-AGENTS-DETECTOR] No DISCONNECTED agents found to promote`);
    return null;
  }

  /**
   * Check if any CLI Agent is connected (globally active) in a terminal
   */
  public isCliAgentConnected(terminalId: string): boolean {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    return agentInfo ? agentInfo.status === CliAgentStatus.CONNECTED : false;
  }

  /**
   * Get CLI Agent status for a terminal
   */
  public getCliAgentStatus(terminalId: string): CliAgentStatus {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    return agentInfo ? agentInfo.status : CliAgentStatus.NONE;
  }

  /**
   * Get the CLI Agent type for a terminal (regardless of status)
   */
  public getAgentType(terminalId: string): CliAgentType | null {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    return agentInfo ? agentInfo.type : null;
  }

  /**
   * Get agent info for a terminal
   */
  public getAgentInfo(terminalId: string): CliAgentInfo | undefined {
    return this._cliAgentsInfo.get(terminalId);
  }

  /**
   * Get the last executed command for a terminal
   */
  public getLastCommand(terminalId: string): string | undefined {
    const history = this._commandHistory.get(terminalId);
    return history && history.length > 0 ? history[history.length - 1] : undefined;
  }

  /**
   * Get all CLI Agents with their status
   */
  public getAllAgents(): Array<{ terminalId: string; agentInfo: CliAgentInfo }> {
    const allAgents: Array<{ terminalId: string; agentInfo: CliAgentInfo }> = [];

    for (const [terminalId, agentInfo] of this._cliAgentsInfo.entries()) {
      allAgents.push({ terminalId, agentInfo });
    }

    return allAgents;
  }

  /**
   * Get connected (globally active) CLI Agents
   */
  public getConnectedAgents(): Array<{ terminalId: string; agentInfo: CliAgentInfo }> {
    const connectedAgents: Array<{ terminalId: string; agentInfo: CliAgentInfo }> = [];

    for (const [terminalId, agentInfo] of this._cliAgentsInfo.entries()) {
      if (agentInfo.status === CliAgentStatus.CONNECTED) {
        connectedAgents.push({ terminalId, agentInfo });
      }
    }

    return connectedAgents;
  }

  /**
   * Get currently globally active agent
   */
  public getCurrentGloballyActiveAgent(): { terminalId: string; type: CliAgentType } | null {
    return this._globalActiveAgent;
  }

  /**
   * Check if a specific terminal has the globally active agent
   */
  public isGloballyActive(terminalId: string): boolean {
    return this._globalActiveAgent?.terminalId === terminalId || false;
  }

  /**
   * Force terminate all CLI Agents (for cleanup)
   */
  public deactivateAllAgents(): void {
    for (const [terminalId] of this._cliAgentsInfo.entries()) {
      this._deactivateCliAgent(terminalId);
    }

    // Clear global state
    this._globalActiveAgent = null;
    log('🧹 [CLI-AGENTS-DETECTOR] All CLI Agents terminated and global state cleared');
  }

  /**
   * Clean up resources for a terminal
   */
  public cleanupTerminal(terminalId: string): void {
    // CLI Agents関連データのクリーンアップ
    this._commandHistory.delete(terminalId);
    this._currentInputBuffer.delete(terminalId);
    this._lastOutputTime.delete(terminalId);
    this._promptDetectionBuffer.delete(terminalId);

    const agentInfo = this._cliAgentsInfo.get(terminalId);
    if (agentInfo) {
      // Check if this terminal was globally active and remove from global state
      if (this._globalActiveAgent && this._globalActiveAgent.terminalId === terminalId) {
        this._globalActiveAgent = null;
        log(
          `🧹 [CLI-AGENTS-DETECTOR] Removed ${agentInfo.type.toUpperCase()} CLI from global active state (terminal: ${terminalId})`
        );
      }

      // Deactivate if still exists
      this._deactivateCliAgent(terminalId);
    }

    this._cliAgentsInfo.delete(terminalId);
    log(`🧹 [CLI-AGENTS-DETECTOR] Cleaned up CLI Agents data for terminal: ${terminalId}`);
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    // Clear all data
    this._commandHistory.clear();
    this._currentInputBuffer.clear();
    this._lastOutputTime.clear();
    this._promptDetectionBuffer.clear();
    this._globalActiveAgent = null;
    this._cliAgentsInfo.clear();
    this._cliAgentStatusEmitter.dispose();
    log(
      '🧹 [CLI-AGENTS-DETECTOR] Disposed and cleaned up all CLI Agents data including global state'
    );
  }
}
