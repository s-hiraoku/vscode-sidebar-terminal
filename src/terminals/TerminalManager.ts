/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as vscode from 'vscode';
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import {
  TerminalInstance,
  TerminalEvent,
  TerminalState,
  TerminalInfo,
  DeleteResult,
} from '../types/common';
import { TERMINAL_CONSTANTS, ERROR_MESSAGES } from '../constants';
import { terminal as log } from '../utils/logger';
import {
  getTerminalConfig,
  getShellForPlatform,
  getWorkingDirectory,
  generateTerminalId,
  generateTerminalName,
  showErrorMessage,
  showWarningMessage,
  ActiveTerminalManager,
  getFirstValue,
} from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';
import { CliAgentDetectionService } from '../services/CliAgentDetectionService';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';
import {
  TerminalLifecycleManager,
  ITerminalLifecycleManager,
} from '../services/TerminalLifecycleManager';
import {
  TerminalDataBufferingService,
  ITerminalDataBufferingService,
} from '../services/TerminalDataBufferingService';
import { TerminalStateManager, ITerminalStateManager } from '../services/TerminalStateManager';

export class TerminalManager {
  private readonly _terminals = new Map<string, TerminalInstance>();
  private readonly _activeTerminalManager = new ActiveTerminalManager();
  private readonly _dataEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _exitEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _terminalCreatedEmitter = new vscode.EventEmitter<TerminalInstance>();
  private readonly _terminalRemovedEmitter = new vscode.EventEmitter<string>();
  private readonly _stateUpdateEmitter = new vscode.EventEmitter<TerminalState>();
  private readonly _terminalFocusEmitter = new vscode.EventEmitter<string>();
  private readonly _terminalNumberManager: TerminalNumberManager;
  // CLI Agent Detection Service (extracted for SRP)
  private readonly _cliAgentService: ICliAgentDetectionService;

  // 操作の順序保証のためのキュー
  private operationQueue: Promise<void> = Promise.resolve();

  // Track terminals being killed to prevent infinite loops
  private readonly _terminalBeingKilled = new Set<string>();

  // Performance optimization: Data batching for high-frequency output
  private readonly _dataBuffers = new Map<string, string[]>();
  private readonly _dataFlushTimers = new Map<string, NodeJS.Timeout>();
  private readonly DATA_FLUSH_INTERVAL = 8; // ~125fps for improved responsiveness
  private readonly MAX_BUFFER_SIZE = 50;

  // CLI Agent detection moved to service - cache removed from TerminalManager

  public readonly onData = this._dataEmitter.event;
  public readonly onExit = this._exitEmitter.event;
  public readonly onTerminalCreated = this._terminalCreatedEmitter.event;
  public readonly onTerminalRemoved = this._terminalRemovedEmitter.event;
  public readonly onStateUpdate = this._stateUpdateEmitter.event;
  public readonly onTerminalFocus = this._terminalFocusEmitter.event;

  constructor(cliAgentService?: ICliAgentDetectionService) {
    // Initialize terminal number manager with max terminals config
    const config = getTerminalConfig();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);

    // Initialize CLI Agent detection service
    this._cliAgentService = cliAgentService || new CliAgentDetectionService();
  }

  /**
   * Get CLI Agent status change event
   */
  public get onCliAgentStatusChange(): vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }> {
    return this._cliAgentService.onCliAgentStatusChange;
  }

  public createTerminal(): string {
    log('🔍 [TERMINAL] === CREATE TERMINAL CALLED ===');

    const config = getTerminalConfig();
    log(`🔍 [TERMINAL] Config loaded: maxTerminals=${config.maxTerminals}`);

    log(`🔍 [TERMINAL] Current terminals count: ${this._terminals.size}`);
    if (!this._terminalNumberManager.canCreate(this._terminals)) {
      log('🔧 [TERMINAL] Cannot create terminal: all slots used');
      showWarningMessage(`${ERROR_MESSAGES.MAX_TERMINALS_REACHED} (${config.maxTerminals})`);
      return this._activeTerminalManager.getActive() || '';
    }

    log('🔍 [TERMINAL] Finding available terminal number...');
    const terminalNumber = this._terminalNumberManager.findAvailableNumber(this._terminals);
    log(`🔍 [TERMINAL] Found available terminal number: ${terminalNumber}`);

    log('🔍 [TERMINAL] Generating terminal ID...');
    const terminalId = generateTerminalId();
    log(`🔍 [TERMINAL] Generated terminal ID: ${terminalId}`);

    const shell = getShellForPlatform(config.shell);
    const shellArgs = config.shellArgs;
    const cwd = getWorkingDirectory();

    log(`🔍 [TERMINAL] Creating terminal: ID=${terminalId}, Shell=${shell}, CWD=${cwd}`);

    try {
      // Prepare environment variables with explicit PWD
      const env = {
        ...process.env,
        PWD: cwd,
        // Add VS Code workspace information if available
        ...(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0 && {
            VSCODE_WORKSPACE: vscode.workspace.workspaceFolders[0]?.uri.fsPath || '',
            VSCODE_PROJECT_NAME: vscode.workspace.workspaceFolders[0]?.name || '',
          }),
      } as { [key: string]: string };

      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: TERMINAL_CONSTANTS.DEFAULT_COLS,
        rows: TERMINAL_CONSTANTS.DEFAULT_ROWS,
        cwd,
        env: {
          ...env,
          // Ensure proper UTF-8 encoding for Japanese characters
          LANG: env.LANG || 'en_US.UTF-8',
          LC_ALL: env.LC_ALL || 'en_US.UTF-8',
          LC_CTYPE: env.LC_CTYPE || 'en_US.UTF-8',
          // Enhanced CLI compatibility flags
          FORCE_COLOR: '1',
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
        encoding: 'utf8',
      });

      const terminal: TerminalInstance = {
        id: terminalId,
        pty: ptyProcess,
        ptyProcess: ptyProcess,
        name: generateTerminalName(terminalNumber),
        number: terminalNumber,
        cwd: cwd,
        isActive: true,
        createdAt: Date.now(),
      };

      // Set all other terminals as inactive
      this._deactivateAllTerminals();

      this._terminals.set(terminalId, terminal);
      this._activeTerminalManager.setActive(terminalId);

      ptyProcess.onData((data: string) => {
        // 🚨 OPTIMIZATION 7: Only log extremely large data chunks to reduce noise
        if (data.length > 5000) {
          log('📤 [LARGE-DATA] PTY data received:', data.length, 'chars for terminal:', terminalId);
        }

        // 🚨 OPTIMIZED: Remove immediate detection to avoid duplication
        // Detection will only happen in _flushBuffer for efficiency

        // Performance optimization: Batch small data chunks
        this._bufferData(terminalId, data);
      });

      ptyProcess.onExit((event: number | { exitCode: number; signal?: number }) => {
        const exitCode = typeof event === 'number' ? event : event.exitCode;
        const signal = typeof event === 'object' ? event.signal : undefined;
        log(
          '🚪 [DEBUG] PTY process exited:',
          exitCode,
          'signal:',
          signal,
          'for terminal:',
          terminalId
        );

        // 🛡️ プロセス終了イベント（CLI Agent終了検出を含む）
        // Handle CLI agent termination on process exit
        this._cliAgentService.handleTerminalRemoved(terminalId);

        // Check if this terminal is being manually killed to prevent infinite loop
        if (this._terminalBeingKilled.has(terminalId)) {
          log('🗑️ [DEBUG] Terminal exit triggered by manual kill, cleaning up:', terminalId);
          this._terminalBeingKilled.delete(terminalId);
          this._cleanupTerminalData(terminalId);
        } else {
          log('🚪 [DEBUG] Terminal exited naturally, removing:', terminalId);
          this._exitEmitter.fire({ terminalId, exitCode });
          this._removeTerminal(terminalId);
        }
      });

      log(`✅ [TERMINAL] Terminal created successfully: ${terminal.name} (${terminalId})`);

      this._terminalCreatedEmitter.fire(terminal);

      // 状態更新を通知
      log('🔍 [TERMINAL] Notifying state update...');
      this._notifyStateUpdate();
      log('🔍 [TERMINAL] State update completed');

      log(`🔍 [TERMINAL] === CREATE TERMINAL FINISHED: ${terminalId} ===`);
      return terminalId;
    } catch (error) {
      log(
        `❌ [TERMINAL] Error creating terminal: ${error instanceof Error ? error.message : String(error)}`
      );
      log(`❌ [TERMINAL] Error stack: ${error instanceof Error ? error.stack : 'No stack'}`);
      showErrorMessage(ERROR_MESSAGES.TERMINAL_CREATION_FAILED, error);
      throw error;
    }
  }

  /**
   * ターミナルにフォーカスを移す
   * 🚨 IMPORTANT: Focus should NOT change CLI Agent status (spec compliance)
   */
  public focusTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      console.warn('⚠️ [WARN] Terminal not found for focus:', terminalId);
      return;
    }

    // 🚨 CRITICAL: フォーカス変更はCLI Agent状態に影響しない（仕様書準拠）
    // Only fire focus event, do not change CLI Agent status
    this._terminalFocusEmitter.fire(terminalId);
    log(`🎯 [TERMINAL] Focused: ${terminal.name} (NO status change - spec compliant)`);
  }

  public sendInput(data: string, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();

    if (!id) {
      console.warn('⚠️ [WARN] No terminal ID provided and no active terminal');
      return;
    }

    const terminal = this._terminals.get(id);
    if (!terminal) {
      console.warn('⚠️ [WARN] Terminal not found for id:', id);
      return;
    }

    try {
      // CLI Agent コマンドを検出
      this._cliAgentService.detectFromInput(id, data);

      // PTY入力処理（ptyProcess優先、フォールバックとしてpty）
      const ptyInstance = terminal.ptyProcess || terminal.pty;
      if (ptyInstance && ptyInstance.write) {
        ptyInstance.write(data);
      } else {
        console.error('❌ [ERROR] PTY instance not found or write method unavailable');
        console.error('❌ [ERROR] Terminal debug info:', {
          id: terminal.id,
          name: terminal.name,
          hasPty: !!terminal.pty,
          hasPtyProcess: !!terminal.ptyProcess,
          ptyType: terminal.pty ? typeof terminal.pty : 'undefined',
          ptyProcessType: terminal.ptyProcess ? typeof terminal.ptyProcess : 'undefined',
        });
      }
    } catch (error) {
      console.error('❌ [ERROR] Failed to write to pty:', error);
      showErrorMessage('Failed to send input to terminal', error);
    }
  }

  public resize(cols: number, rows: number, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();
    if (id) {
      const terminal = this._terminals.get(id);
      if (terminal) {
        const ptyInstance = terminal.ptyProcess || terminal.pty;
        if (ptyInstance && ptyInstance.resize) {
          ptyInstance.resize(cols, rows);
        } else {
          console.error('❌ [ERROR] PTY instance not found for resize:', terminal.id);
        }
      }
    }
  }

  public hasActiveTerminal(): boolean {
    return this._activeTerminalManager.hasActive();
  }

  public getActiveTerminalId(): string | undefined {
    return this._activeTerminalManager.getActive();
  }

  public getTerminals(): TerminalInstance[] {
    return Array.from(this._terminals.values());
  }

  /**
   * Get a specific terminal by ID
   */
  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._terminals.get(terminalId);
  }

  public setActiveTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      this._deactivateAllTerminals();
      terminal.isActive = true;
      this._activeTerminalManager.setActive(terminalId);
    }
  }

  public removeTerminal(terminalId: string): void {
    this._removeTerminal(terminalId);
  }

  /**
   * ターミナルが削除可能かチェック（統一された検証ロジック）
   */
  private _validateDeletion(terminalId: string): { canDelete: boolean; reason?: string } {
    if (!this._terminals.has(terminalId)) {
      return { canDelete: false, reason: 'Terminal not found' };
    }

    // 最低1つのターミナルは保持する
    if (this._terminals.size <= 1) {
      return { canDelete: false, reason: 'Must keep at least 1 terminal open' };
    }

    return { canDelete: true };
  }

  /**
   * ターミナルが削除可能かチェック（公開API、後方互換性のため維持）
   */
  public canRemoveTerminal(terminalId: string): { canRemove: boolean; reason?: string } {
    const validation = this._validateDeletion(terminalId);
    return { canRemove: validation.canDelete, reason: validation.reason };
  }

  /**
   * 安全なターミナル削除（削除前の検証付き、後方互換性のため維持）
   * @deprecated Use deleteTerminal() instead
   */
  public safeRemoveTerminal(terminalId: string): boolean {
    const result = this.deleteTerminal(terminalId, { source: 'panel' });
    return result.then((r) => r.success).catch(() => false) as unknown as boolean;
  }

  /**
   * 統一されたターミナル削除メソッド
   * 指定されたターミナルIDを削除し、新しい状態を返す
   */
  public async deleteTerminal(
    terminalId: string,
    options: {
      force?: boolean;
      source?: 'header' | 'panel' | 'command';
    } = {}
  ): Promise<DeleteResult> {
    // 操作をキューに追加してレースコンディションを防ぐ
    return new Promise<DeleteResult>((resolve, reject) => {
      this.operationQueue = this.operationQueue.then(() => {
        try {
          const result = this.performDeleteOperation(terminalId, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * アトミックな削除処理
   */
  private performDeleteOperation(
    terminalId: string,
    options: {
      force?: boolean;
      source?: 'header' | 'panel' | 'command';
    }
  ): DeleteResult {
    log(
      `🗑️ [DELETE] Starting delete operation for terminal: ${terminalId} (source: ${options.source || 'unknown'})`
    );

    // 1. 削除前の検証（forceオプションがない場合）
    if (!options.force) {
      const validation = this._validateDeletion(terminalId);
      if (!validation.canDelete) {
        log(`⚠️ [DELETE] Cannot delete terminal: ${validation.reason}`);
        showWarningMessage(validation.reason || 'Cannot delete terminal');
        return { success: false, reason: validation.reason };
      }
    }

    // 2. ターミナルの存在確認
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log(`⚠️ [DELETE] Terminal not found: ${terminalId}`);
      return { success: false, reason: 'Terminal not found' };
    }

    try {
      // 3. プロセスの終了
      log(`🗑️ [DELETE] Killing terminal process: ${terminalId}`);
      this._terminalBeingKilled.add(terminalId);
      terminal.pty.kill();

      // 4. 状態の更新は onExit ハンドラで行われる
      log(`✅ [DELETE] Delete operation completed for: ${terminalId}`);

      // 5. 新しい状態を返す (非同期なので現在の状態を返す)
      return { success: true, newState: this.getCurrentState() };
    } catch (error) {
      log(`❌ [DELETE] Error during delete operation:`, error);
      this._terminalBeingKilled.delete(terminalId);
      return { success: false, reason: `Delete failed: ${String(error)}` };
    }
  }

  /**
   * 現在の状態を取得
   */
  public getCurrentState(): TerminalState {
    const terminals: TerminalInfo[] = Array.from(this._terminals.values()).map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      isActive: terminal.isActive,
    }));

    return {
      terminals,
      activeTerminalId: this._activeTerminalManager.getActive() || null,
      maxTerminals: getTerminalConfig().maxTerminals,
      availableSlots: this._getAvailableSlots(),
    };
  }

  /**
   * 利用可能なスロットを取得
   */
  private _getAvailableSlots(): number[] {
    return this._terminalNumberManager.getAvailableSlots(this._terminals);
  }

  /**
   * WebView に状態更新を通知
   */
  private _notifyStateUpdate(): void {
    const state = this.getCurrentState();
    this._stateUpdateEmitter.fire(state);
    log(`📡 [STATE] State update notification sent:`, state);
  }

  /**
   * 安全なターミナルキル（削除前の検証付き、後方互換性のため維持）
   * 常にアクティブターミナルをkillする
   * @deprecated Use deleteTerminal() with active terminal ID
   */
  public safeKillTerminal(terminalId?: string): boolean {
    const activeId = this._activeTerminalManager.getActive();
    if (!activeId) {
      const message = 'No active terminal to kill';
      console.warn('⚠️ [WARN]', message);
      showWarningMessage(message);
      return false;
    }

    if (terminalId && terminalId !== activeId) {
      log(
        '🔄 [TERMINAL] Requested to safely kill:',
        terminalId,
        'but will kill active terminal:',
        activeId
      );
    }

    const result = this.deleteTerminal(activeId, { source: 'command' });
    return result.then((r) => r.success).catch(() => false) as unknown as boolean;
  }

  public killTerminal(terminalId?: string): void {
    // According to the spec: always kill the ACTIVE terminal, ignore provided ID
    const activeId = this._activeTerminalManager.getActive();
    if (!activeId) {
      console.warn('⚠️ [WARN] No active terminal to kill');
      showWarningMessage('No active terminal to kill');
      return;
    }

    if (terminalId && terminalId !== activeId) {
      log(
        '🔄 [TERMINAL] Requested to kill:',
        terminalId,
        'but will kill active terminal:',
        activeId
      );
    }

    // Use unified delete method with force option
    this.deleteTerminal(activeId, { force: true, source: 'command' }).catch((error) => {
      console.error('❌ [TERMINAL] Error killing terminal:', error);
    });
  }

  public dispose(): void {
    // Clean up data buffers and timers
    this._flushAllBuffers();
    for (const timer of this._dataFlushTimers.values()) {
      clearTimeout(timer);
    }
    this._dataBuffers.clear();
    this._dataFlushTimers.clear();

    // Clear kill tracking
    this._terminalBeingKilled.clear();

    // Dispose CLI Agent detection service
    this._cliAgentService.dispose();

    for (const terminal of this._terminals.values()) {
      terminal.pty.kill();
    }
    this._terminals.clear();
    this._dataEmitter.dispose();
    this._exitEmitter.dispose();
    this._terminalCreatedEmitter.dispose();
    this._terminalRemovedEmitter.dispose();
    this._stateUpdateEmitter.dispose();
    this._terminalFocusEmitter.dispose();
  }

  // Performance optimization: Buffer data to reduce event frequency
  private _bufferData(terminalId: string, data: string): void {
    if (!this._dataBuffers.has(terminalId)) {
      this._dataBuffers.set(terminalId, []);
    }

    const buffer = this._dataBuffers.get(terminalId);
    if (!buffer) {
      this._dataBuffers.set(terminalId, []);
      return;
    }
    buffer.push(data);

    // Flush immediately if buffer is full or data is large
    if (buffer.length >= this.MAX_BUFFER_SIZE || data.length > 1000) {
      this._flushBuffer(terminalId);
    } else {
      this._scheduleFlush(terminalId);
    }
  }

  private _scheduleFlush(terminalId: string): void {
    if (!this._dataFlushTimers.has(terminalId)) {
      const timer = setTimeout(() => {
        this._flushBuffer(terminalId);
      }, this.DATA_FLUSH_INTERVAL);
      this._dataFlushTimers.set(terminalId, timer);
    }
  }

  private _flushBuffer(terminalId: string): void {
    const timer = this._dataFlushTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._dataFlushTimers.delete(terminalId);
    }

    const buffer = this._dataBuffers.get(terminalId);
    if (buffer && buffer.length > 0) {
      const combinedData = buffer.join('');
      buffer.length = 0; // Clear buffer

      // Send to CLI Agent detection service
      this._cliAgentService.detectFromOutput(terminalId, combinedData);

      this._dataEmitter.fire({ terminalId, data: combinedData });
    }
  }

  private _flushAllBuffers(): void {
    for (const terminalId of this._dataBuffers.keys()) {
      this._flushBuffer(terminalId);
    }
  }

  /**
   * 全てのターミナルを非アクティブにする
   */
  private _deactivateAllTerminals(): void {
    for (const term of this._terminals.values()) {
      term.isActive = false;
    }
  }

  /**
   * ターミナルデータのクリーンアップのみを行う（プロセスはkillしない）
   */
  private _cleanupTerminalData(terminalId: string): void {
    log('🧹 [TERMINAL] Cleaning up terminal data:', terminalId);

    // Clean up data buffers for this terminal
    this._flushBuffer(terminalId);
    this._dataBuffers.delete(terminalId);
    const timer = this._dataFlushTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._dataFlushTimers.delete(terminalId);
    }

    // CLI Agent cleanup handled by service
    this._cliAgentService.handleTerminalRemoved(terminalId);

    // Remove from terminals map
    this._terminals.delete(terminalId);

    this._terminalRemovedEmitter.fire(terminalId);

    log('🧹 [TERMINAL] Terminal data cleaned up:', terminalId);
    log('🧹 [TERMINAL] Remaining terminals:', Array.from(this._terminals.keys()));

    // アクティブターミナルだった場合、別のターミナルをアクティブにする
    this._updateActiveTerminalAfterRemoval(terminalId);
  }

  /**
   * ターミナルを削除し、必要に応じて他のターミナルをアクティブにする
   */
  private _removeTerminal(terminalId: string): void {
    log('🗑️ [TERMINAL] Removing terminal:', terminalId);

    // Get terminal instance before removal
    const terminal = this._terminals.get(terminalId);

    // Kill the terminal process if it's still running (safety check)
    if (terminal) {
      try {
        terminal.pty.kill();
        log('🗑️ [TERMINAL] Process killed during removal:', terminalId);
      } catch (error) {
        console.warn('⚠️ [TERMINAL] Error killing process during removal:', error);
      }
    }

    // Clean up terminal data
    this._cleanupTerminalData(terminalId);
  }

  /**
   * ターミナル削除後のアクティブターミナル更新処理
   */
  private _updateActiveTerminalAfterRemoval(terminalId: string): void {
    if (this._activeTerminalManager.isActive(terminalId)) {
      const remaining = getFirstValue(this._terminals);
      if (remaining) {
        this._activeTerminalManager.setActive(remaining.id);
        remaining.isActive = true;
        log('🔄 [TERMINAL] Set new active terminal:', remaining.id);
      } else {
        this._activeTerminalManager.clearActive();
        log('🔄 [TERMINAL] No remaining terminals, cleared active');
      }
    }
  }

  /**
   * Check if CLI Agent is active in a terminal
   */
  public isCliAgentConnected(terminalId: string): boolean {
    const agentState = this._cliAgentService.getAgentState(terminalId);
    return agentState.status === 'connected';
  }

  /**
   * Check if CLI Agent is running in a terminal (CONNECTED or DISCONNECTED)
   */
  public isCliAgentRunning(terminalId: string): boolean {
    const agentState = this._cliAgentService.getAgentState(terminalId);
    return agentState.status !== 'none';
  }

  /**
   * Get currently globally active CLI Agent
   */
  public getCurrentGloballyActiveAgent(): { terminalId: string; type: string } | null {
    return this._cliAgentService.getConnectedAgent();
  }

  /**
   * Get the last executed command for a terminal (シンプル化で無効化)
   */
  public getLastCommand(_terminalId: string): string | undefined {
    return undefined; // シンプル化でコマンド履歴は無効化
  }

  /**
   * Handle terminal output for CLI Agent detection (public API)
   */
  public handleTerminalOutputForCliAgent(terminalId: string, data: string): void {
    this._cliAgentService.detectFromOutput(terminalId, data);
  }

  /**
   * Get the active CLI Agent type for a terminal
   */
  public getAgentType(terminalId: string): string | null {
    const agentState = this._cliAgentService.getAgentState(terminalId);
    return agentState.type;
  }

  /**
   * Get all active CLI Agents
   */
  public getConnectedAgents(): Array<{ terminalId: string; agentInfo: { type: string } }> {
    const connectedAgent = this._cliAgentService.getConnectedAgent();
    return connectedAgent
      ? [
          {
            terminalId: connectedAgent.terminalId,
            agentInfo: { type: connectedAgent.type },
          },
        ]
      : [];
  }

  /**
   * Get the map of disconnected agents for full state sync
   */
  public getDisconnectedAgents(): Map<
    string,
    { type: 'claude' | 'gemini'; startTime: Date; terminalName?: string }
  > {
    return this._cliAgentService.getDisconnectedAgents();
  }

  /**
   * Get the connected agent terminal ID
   */
  public getConnectedAgentTerminalId(): string | null {
    const connectedAgent = this._cliAgentService.getConnectedAgent();
    return connectedAgent ? connectedAgent.terminalId : null;
  }

  /**
   * Get the connected agent type
   */
  public getConnectedAgentType(): 'claude' | 'gemini' | null {
    const connectedAgent = this._cliAgentService.getConnectedAgent();
    return connectedAgent ? (connectedAgent.type as 'claude' | 'gemini') : null;
  }

  /**
   * 手動でAI Agent接続を切り替える
   * Issue #122: AI Agent接続切り替えボタン機能
   */
  public switchAiAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return {
        success: false,
        reason: 'Terminal not found',
        newStatus: 'none',
        agentType: null,
      };
    }

    // Delegate to the CLI Agent service
    return this._cliAgentService.switchAgentConnection(terminalId);
  }

  // =================== CLI Agent Detection - MOVED TO SERVICE ===================

  // All CLI Agent detection logic has been extracted to CliAgentDetectionService
  // for better separation of concerns and testability
}

/**
 * Refactored TerminalManager using dependency injection and service composition.
 *
 * This version dramatically reduces complexity from 1600+ lines to ~400 lines
 * by delegating responsibilities to specialized services while maintaining
 * full backward compatibility with the original API.
 *
 * Architecture:
 * - TerminalLifecycleManager: Handle terminal creation/deletion
 * - CliAgentDetectionService: Manage CLI agent detection and state
 * - TerminalDataBufferingService: Handle data buffering and performance
 * - TerminalStateManager: Manage terminal state and validation
 */
export class RefactoredTerminalManager {
  // =================== Service Dependencies ===================
  private readonly lifecycleManager: ITerminalLifecycleManager;
  private readonly cliAgentService: ICliAgentDetectionService;
  private readonly bufferingService: ITerminalDataBufferingService;
  private readonly stateManager: ITerminalStateManager;

  // =================== Event Emitters (Facade) ===================
  private readonly _dataEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _exitEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _terminalCreatedEmitter = new vscode.EventEmitter<TerminalInstance>();
  private readonly _terminalRemovedEmitter = new vscode.EventEmitter<string>();
  private readonly _terminalFocusEmitter = new vscode.EventEmitter<string>();

  // =================== Operation Queue for Thread Safety ===================
  private operationQueue: Promise<void> = Promise.resolve();

  // =================== Public Events (API Compatibility) ===================
  public readonly onData = this._dataEmitter.event;
  public readonly onExit = this._exitEmitter.event;
  public readonly onTerminalCreated = this._terminalCreatedEmitter.event;
  public readonly onTerminalRemoved = this._terminalRemovedEmitter.event;
  public readonly onTerminalFocus = this._terminalFocusEmitter.event;

  // onStateUpdate will be initialized after stateManager is created
  public get onStateUpdate() {
    return this.stateManager.onStateUpdate;
  }

  // =================== Constructor with Dependency Injection ===================
  constructor(
    lifecycleManager?: ITerminalLifecycleManager,
    cliAgentService?: ICliAgentDetectionService,
    bufferingService?: ITerminalDataBufferingService,
    stateManager?: ITerminalStateManager
  ) {
    log('🔧 [REFACTORED-TERMINAL-MANAGER] Initializing with dependency injection...');

    // Initialize services with defaults if not provided
    this.lifecycleManager = lifecycleManager || new TerminalLifecycleManager();
    this.cliAgentService = cliAgentService || new CliAgentDetectionService();
    this.bufferingService = bufferingService || new TerminalDataBufferingService();
    this.stateManager = stateManager || new TerminalStateManager();

    this.setupServiceIntegration();
    log('✅ [REFACTORED-TERMINAL-MANAGER] Initialization complete');
  }

  // =================== Service Integration Setup ===================
  private setupServiceIntegration(): void {
    log('🔗 [REFACTORED-TERMINAL-MANAGER] Setting up service integration...');

    // Connect lifecycle events to state management
    this.lifecycleManager.onTerminalCreated((terminal) => {
      this.stateManager.updateTerminalState([terminal]);
      this._terminalCreatedEmitter.fire(terminal);
    });

    this.lifecycleManager.onTerminalRemoved((terminalId) => {
      this.cliAgentService.handleTerminalRemoved(terminalId);
      this.bufferingService.clearBuffer(terminalId);
      this._terminalRemovedEmitter.fire(terminalId);
    });

    this.lifecycleManager.onTerminalExit((event) => {
      this._exitEmitter.fire(event);
    });

    // Connect data buffering to CLI agent detection and output
    this.bufferingService.addFlushHandler((terminalId, data) => {
      // CLI Agent detection on buffered data
      this.cliAgentService.detectFromOutput(terminalId, data);

      // Emit buffered data
      this._dataEmitter.fire({ terminalId, data });
    });

    // Connect lifecycle data to buffering service
    this.lifecycleManager.onTerminalData((event) => {
      this.bufferingService.bufferData(event.terminalId, event.data || '');
    });

    log('✅ [REFACTORED-TERMINAL-MANAGER] Service integration complete');
  }

  // =================== CLI Agent Status Integration ===================
  public get onCliAgentStatusChange(): vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }> {
    return this.cliAgentService.onCliAgentStatusChange;
  }

  // =================== Core Terminal Operations (Delegated to Services) ===================

  /**
   * Create a new terminal - delegates to TerminalLifecycleManager
   */
  public createTerminal(): string {
    log('🔧 [REFACTORED-TERMINAL-MANAGER] Creating terminal...');

    const terminalId = this.lifecycleManager.createTerminal();

    // Update state after creation
    const terminals = this.lifecycleManager.getAllTerminals();
    this.stateManager.updateTerminalState(terminals);

    log(`✅ [REFACTORED-TERMINAL-MANAGER] Terminal created: ${terminalId}`);
    return terminalId;
  }

  /**
   * Focus a terminal - updates state and emits focus event
   */
  public focusTerminal(terminalId: string): void {
    log(`🎯 [REFACTORED-TERMINAL-MANAGER] Focusing terminal: ${terminalId}`);

    const terminal = this.lifecycleManager.getTerminal(terminalId);
    if (!terminal) {
      console.warn('⚠️ [WARN] Terminal not found for focus:', terminalId);
      return;
    }

    // Update active terminal in state manager
    this.stateManager.setActiveTerminal(terminalId);

    // Emit focus event
    this._terminalFocusEmitter.fire(terminalId);

    log(`✅ [REFACTORED-TERMINAL-MANAGER] Terminal focused: ${terminal.name}`);
  }

  /**
   * Send input to terminal - delegates to lifecycle manager with CLI agent detection
   */
  public sendInput(data: string, terminalId?: string): void {
    const targetId = terminalId || this.stateManager.getActiveTerminalId();

    if (!targetId) {
      console.warn('⚠️ [WARN] No terminal ID provided and no active terminal');
      return;
    }

    try {
      // CLI Agent input detection
      this.cliAgentService.detectFromInput(targetId, data);

      // Delegate to lifecycle manager
      this.lifecycleManager.writeToTerminal(targetId, data);
    } catch (error) {
      console.error('❌ [ERROR] Failed to send input to terminal:', error);
      showErrorMessage('Failed to send input to terminal', error);
    }
  }

  /**
   * Resize terminal - delegates to lifecycle manager
   */
  public resize(cols: number, rows: number, terminalId?: string): void {
    const targetId = terminalId || this.stateManager.getActiveTerminalId();
    if (targetId) {
      this.lifecycleManager.resizeTerminal(targetId, cols, rows);
    }
  }

  /**
   * Delete terminal with validation and atomic operations
   */
  public async deleteTerminal(
    terminalId: string,
    options: {
      force?: boolean;
      source?: 'header' | 'panel' | 'command';
    } = {}
  ): Promise<DeleteResult> {
    log(
      `🗑️ [REFACTORED-TERMINAL-MANAGER] Deleting terminal: ${terminalId} (source: ${options.source || 'unknown'})`
    );

    // Queue operation to prevent race conditions
    return new Promise<DeleteResult>((resolve, reject) => {
      this.operationQueue = this.operationQueue.then(async () => {
        try {
          const result = await this.performDeleteOperation(terminalId, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Atomic delete operation with validation
   */
  private async performDeleteOperation(
    terminalId: string,
    options: {
      force?: boolean;
      source?: 'header' | 'panel' | 'command';
    }
  ): Promise<DeleteResult> {
    // Validate deletion using state manager
    if (!options.force) {
      const validation = this.stateManager.validateTerminalDeletion(terminalId);
      if (!validation.success) {
        showWarningMessage(validation.reason || 'Cannot delete terminal');
        return { success: false, reason: validation.reason };
      }
    }

    try {
      // Delegate to lifecycle manager
      await this.lifecycleManager.killTerminal(terminalId);

      // Update state
      const terminals = this.lifecycleManager.getAllTerminals();
      this.stateManager.updateTerminalState(terminals);

      log(`✅ [REFACTORED-TERMINAL-MANAGER] Terminal deleted: ${terminalId}`);
      return { success: true, newState: this.stateManager.getCurrentState() };
    } catch (error) {
      log(`❌ [REFACTORED-TERMINAL-MANAGER] Error deleting terminal:`, error);
      return { success: false, reason: `Delete failed: ${String(error)}` };
    }
  }

  // =================== State and Query Methods (Delegated) ===================

  public hasActiveTerminal(): boolean {
    return this.stateManager.getActiveTerminalId() !== null;
  }

  public getActiveTerminalId(): string | undefined {
    return this.stateManager.getActiveTerminalId() || undefined;
  }

  public getTerminals(): TerminalInstance[] {
    return this.lifecycleManager.getAllTerminals();
  }

  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this.lifecycleManager.getTerminal(terminalId);
  }

  public setActiveTerminal(terminalId: string): void {
    this.stateManager.setActiveTerminal(terminalId);
  }

  public getCurrentState(): TerminalState {
    return this.stateManager.getCurrentState();
  }

  // =================== Legacy API Compatibility ===================

  public removeTerminal(terminalId: string): void {
    this.deleteTerminal(terminalId, { source: 'command' }).catch((error) => {
      console.error('❌ [LEGACY-API] Error removing terminal:', error);
    });
  }

  public canRemoveTerminal(terminalId: string): { canRemove: boolean; reason?: string } {
    const validation = this.stateManager.validateTerminalDeletion(terminalId);
    return { canRemove: validation.success, reason: validation.reason };
  }

  public safeRemoveTerminal(terminalId: string): boolean {
    const result = this.deleteTerminal(terminalId, { source: 'panel' });
    return result.then((r) => r.success).catch(() => false) as unknown as boolean;
  }

  public killTerminal(terminalId?: string): void {
    const activeId = this.stateManager.getActiveTerminalId();
    if (!activeId) {
      console.warn('⚠️ [WARN] No active terminal to kill');
      showWarningMessage('No active terminal to kill');
      return;
    }

    if (terminalId && terminalId !== activeId) {
      log(
        '🔄 [REFACTORED-TERMINAL-MANAGER] Requested to kill:',
        terminalId,
        'but will kill active terminal:',
        activeId
      );
    }

    this.deleteTerminal(activeId, { force: true, source: 'command' }).catch((error) => {
      console.error('❌ [REFACTORED-TERMINAL-MANAGER] Error killing terminal:', error);
    });
  }

  public safeKillTerminal(terminalId?: string): boolean {
    const activeId = this.stateManager.getActiveTerminalId();
    if (!activeId) {
      const message = 'No active terminal to kill';
      console.warn('⚠️ [WARN]', message);
      showWarningMessage(message);
      return false;
    }

    const result = this.deleteTerminal(activeId, { source: 'command' });
    return result.then((r) => r.success).catch(() => false) as unknown as boolean;
  }

  // =================== CLI Agent Integration (Delegated) ===================

  public isCliAgentConnected(terminalId: string): boolean {
    const agentState = this.cliAgentService.getAgentState(terminalId);
    return agentState.status === 'connected';
  }

  public isCliAgentRunning(terminalId: string): boolean {
    const agentState = this.cliAgentService.getAgentState(terminalId);
    return agentState.status !== 'none';
  }

  public getCurrentGloballyActiveAgent(): { terminalId: string; type: string } | null {
    return this.cliAgentService.getConnectedAgent();
  }

  public getLastCommand(_terminalId: string): string | undefined {
    return undefined; // Simplified - no command history tracking
  }

  public handleTerminalOutputForCliAgent(terminalId: string, data: string): void {
    this.cliAgentService.detectFromOutput(terminalId, data);
  }

  public getAgentType(terminalId: string): string | null {
    const agentState = this.cliAgentService.getAgentState(terminalId);
    return agentState.type;
  }

  public getConnectedAgents(): Array<{ terminalId: string; agentInfo: { type: string } }> {
    const connectedAgent = this.cliAgentService.getConnectedAgent();
    return connectedAgent
      ? [{ terminalId: connectedAgent.terminalId, agentInfo: { type: connectedAgent.type } }]
      : [];
  }

  public getDisconnectedAgents(): Map<
    string,
    { type: 'claude' | 'gemini'; startTime: Date; terminalName?: string }
  > {
    return this.cliAgentService.getDisconnectedAgents();
  }

  public getConnectedAgentTerminalId(): string | null {
    const connectedAgent = this.cliAgentService.getConnectedAgent();
    return connectedAgent ? connectedAgent.terminalId : null;
  }

  public getConnectedAgentType(): 'claude' | 'gemini' | null {
    const connectedAgent = this.cliAgentService.getConnectedAgent();
    return connectedAgent ? (connectedAgent.type as 'claude' | 'gemini') : null;
  }

  public switchAiAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    const terminal = this.lifecycleManager.getTerminal(terminalId);
    if (!terminal) {
      return {
        success: false,
        reason: 'Terminal not found',
        newStatus: 'none',
        agentType: null,
      };
    }

    return this.cliAgentService.switchAgentConnection(terminalId);
  }

  // =================== Resource Management ===================

  public dispose(): void {
    log('🧹 [REFACTORED-TERMINAL-MANAGER] Disposing resources...');

    // Dispose all services
    this.bufferingService.dispose();
    this.cliAgentService.dispose();
    this.lifecycleManager.dispose();
    this.stateManager.dispose();

    // Dispose event emitters
    this._dataEmitter.dispose();
    this._exitEmitter.dispose();
    this._terminalCreatedEmitter.dispose();
    this._terminalRemovedEmitter.dispose();
    this._terminalFocusEmitter.dispose();

    log('✅ [REFACTORED-TERMINAL-MANAGER] Disposal complete');
  }
}
