import { terminal as log } from '../utils/logger';
import type { TerminalManager } from '../terminals/TerminalManager';
import * as vscode from 'vscode';

/**
 * CLI Agent の種別
 */
export type CliAgentType = 'claude' | 'gemini';

/**
 * CLI Agent の状態情報
 */
interface CliAgentInfo {
  type: CliAgentType;
  isActive: boolean;
  startTime: Date;
  lastActivity: Date;
}

/**
 * CLI Agent状態変更イベントの型
 */
export interface CliAgentStatusEvent {
  terminalId: string;
  type: CliAgentType | null;
  isActive: boolean;
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

  // Activity monitoring for auto-deactivation
  private readonly _activityTimers = new Map<string, NodeJS.Timeout>();
  private readonly ACTIVITY_TIMEOUT = 30000; // 30秒間活動なしで自動終了検知

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

    // Update activity for active agents
    this._updateActivity(terminalId);
  }

  /**
   * Handle terminal output for CLI Agents detection
   * TerminalManagerのonDataイベントから呼び出される
   */
  public handleTerminalOutput(terminalId: string, data: string): void {
    // 各CLI Agentの出力パターンをチェック
    const detectedAgent = this._detectAgentFromOutput(data);

    if (detectedAgent) {
      const currentAgent = this._cliAgentsInfo.get(terminalId);
      if (!currentAgent || !currentAgent.isActive) {
        log(
          `🔍 [CLI-AGENTS-DETECTOR] ${detectedAgent.toUpperCase()} CLI pattern detected in output for terminal ${terminalId}`
        );
        this._activateCliAgent(terminalId, detectedAgent);
      }
    }

    // 終了パターンをチェック
    const hasExitPattern = this._detectExitPattern(data);
    if (hasExitPattern) {
      const agentInfo = this._cliAgentsInfo.get(terminalId);
      if (agentInfo && agentInfo.isActive) {
        log(
          `👋 [CLI-AGENTS-DETECTOR] ${agentInfo.type.toUpperCase()} CLI exit pattern detected for terminal ${terminalId}`
        );
        this._deactivateCliAgent(terminalId);
      }
    }

    // Update activity for active agents
    this._updateActivity(terminalId);
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

    // Check exit patterns
    for (const pattern of [...exitPatterns, ...eofPatterns]) {
      if (lowerData.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * CLI Agentの活動を更新
   */
  private _updateActivity(terminalId: string): void {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    if (!agentInfo || !agentInfo.isActive) {
      return;
    }

    // Update last activity time
    agentInfo.lastActivity = new Date();

    // Reset activity timer
    const existingTimer = this._activityTimers.get(terminalId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new activity timer for auto-deactivation
    const newTimer = setTimeout(() => {
      log(
        `⏰ [CLI-AGENTS-DETECTOR] Auto-deactivating ${agentInfo.type.toUpperCase()} CLI due to inactivity: ${terminalId}`
      );
      this._deactivateCliAgent(terminalId);
    }, this.ACTIVITY_TIMEOUT);

    this._activityTimers.set(terminalId, newTimer);
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
   * Activate CLI Agent for a terminal
   */
  private _activateCliAgent(terminalId: string, type: CliAgentType): void {
    const now = new Date();

    // Deactivate any existing agent in this terminal
    const existingAgent = this._cliAgentsInfo.get(terminalId);
    if (existingAgent && existingAgent.isActive) {
      this._deactivateCliAgent(terminalId);
    }

    // Create new agent info
    const agentInfo: CliAgentInfo = {
      type,
      isActive: true,
      startTime: now,
      lastActivity: now,
    };

    this._cliAgentsInfo.set(terminalId, agentInfo);
    log(`✅ [CLI-AGENTS-DETECTOR] ${type.toUpperCase()} CLI activated for terminal: ${terminalId}`);

    // Emit status change event
    this._cliAgentStatusEmitter.fire({
      terminalId,
      type,
      isActive: true,
    });

    // Start activity monitoring
    this._updateActivity(terminalId);
  }

  /**
   * Deactivate CLI Agent for a terminal
   */
  private _deactivateCliAgent(terminalId: string): void {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    if (!agentInfo) {
      return;
    }

    // Clear activity timer
    const timer = this._activityTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._activityTimers.delete(terminalId);
    }

    // Update agent info
    agentInfo.isActive = false;
    log(
      `❌ [CLI-AGENTS-DETECTOR] ${agentInfo.type.toUpperCase()} CLI deactivated for terminal: ${terminalId}`
    );

    // Emit status change event
    this._cliAgentStatusEmitter.fire({
      terminalId,
      type: agentInfo.type,
      isActive: false,
    });
  }

  /**
   * Check if any CLI Agent is active in a terminal
   */
  public isCliAgentActive(terminalId: string): boolean {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    return agentInfo ? agentInfo.isActive : false;
  }

  /**
   * Get the active CLI Agent type for a terminal
   */
  public getActiveAgentType(terminalId: string): CliAgentType | null {
    const agentInfo = this._cliAgentsInfo.get(terminalId);
    return agentInfo && agentInfo.isActive ? agentInfo.type : null;
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
   * Get all active CLI Agents
   */
  public getActiveAgents(): Array<{ terminalId: string; agentInfo: CliAgentInfo }> {
    const activeAgents: Array<{ terminalId: string; agentInfo: CliAgentInfo }> = [];

    for (const [terminalId, agentInfo] of this._cliAgentsInfo.entries()) {
      if (agentInfo.isActive) {
        activeAgents.push({ terminalId, agentInfo });
      }
    }

    return activeAgents;
  }

  /**
   * Force deactivate all CLI Agents (for cleanup)
   */
  public deactivateAllAgents(): void {
    for (const [terminalId, agentInfo] of this._cliAgentsInfo.entries()) {
      if (agentInfo.isActive) {
        this._deactivateCliAgent(terminalId);
      }
    }
  }

  /**
   * Clean up resources for a terminal
   */
  public cleanupTerminal(terminalId: string): void {
    // Clear activity timer
    const timer = this._activityTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._activityTimers.delete(terminalId);
    }

    // CLI Agents関連データのクリーンアップ
    this._commandHistory.delete(terminalId);
    this._currentInputBuffer.delete(terminalId);

    const agentInfo = this._cliAgentsInfo.get(terminalId);
    if (agentInfo && agentInfo.isActive) {
      this._deactivateCliAgent(terminalId);
    }

    this._cliAgentsInfo.delete(terminalId);
    log(`🧹 [CLI-AGENTS-DETECTOR] Cleaned up CLI Agents data for terminal: ${terminalId}`);
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    // Clear all activity timers
    for (const timer of this._activityTimers.values()) {
      clearTimeout(timer);
    }
    this._activityTimers.clear();

    // Clear all data
    this._commandHistory.clear();
    this._currentInputBuffer.clear();
    this._cliAgentsInfo.clear();
    this._cliAgentStatusEmitter.dispose();
    log('🧹 [CLI-AGENTS-DETECTOR] Disposed and cleaned up all CLI Agents data');
  }
}
