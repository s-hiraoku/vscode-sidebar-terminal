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
  // CLI Agent 状態管理（超シンプル）
  private _connectedAgentTerminalId: string | null = null;
  private _connectedAgentType: 'claude' | 'gemini' | null = null;
  private readonly _onCliAgentStatusChange = new vscode.EventEmitter<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }>();



  // 操作の順序保証のためのキュー
  private operationQueue: Promise<void> = Promise.resolve();

  // Track terminals being killed to prevent infinite loops
  private readonly _terminalBeingKilled = new Set<string>();



  // Performance optimization: Data batching for high-frequency output
  private readonly _dataBuffers = new Map<string, string[]>();
  private readonly _dataFlushTimers = new Map<string, NodeJS.Timeout>();
  private readonly DATA_FLUSH_INTERVAL = 16; // ~60fps
  private readonly MAX_BUFFER_SIZE = 50;

  public readonly onData = this._dataEmitter.event;
  public readonly onExit = this._exitEmitter.event;
  public readonly onTerminalCreated = this._terminalCreatedEmitter.event;
  public readonly onTerminalRemoved = this._terminalRemovedEmitter.event;
  public readonly onStateUpdate = this._stateUpdateEmitter.event;
  public readonly onTerminalFocus = this._terminalFocusEmitter.event;

  constructor() {
    // Initialize terminal number manager with max terminals config
    const config = getTerminalConfig();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);

    // Initialize CLI Agent integration manager
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
    return this._onCliAgentStatusChange.event;
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
        // Only log large data chunks or when debugging is specifically needed
        if (data.length > 1000) {
          log(
            '📤 [DEBUG] Large PTY data received:',
            data.length,
            'chars for terminal:',
            terminalId
          );
        }

        // CLI Agent コマンドを検出（超シンプル）
        this._detectCliAgent(terminalId, data);

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
        // If this terminal has a connected CLI agent, terminate it
        if (this._connectedAgentTerminalId === terminalId) {
          this._setAgentTerminated(terminalId);
        }

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
   */
  public focusTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      console.warn('⚠️ [WARN] Terminal not found for focus:', terminalId);
      return;
    }

    this._terminalFocusEmitter.fire(terminalId);
    log(`🎯 [TERMINAL] Focused: ${terminal.name}`);
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
      this._detectCliAgentFromInput(id, data);

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



    // Dispose CLI Agent integration manager
    this._connectedAgentTerminalId = null;
    this._connectedAgentType = null;
    this._onCliAgentStatusChange.dispose();

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

      // Send to CLI Agent manager for pattern detection and state management
      this._detectCliAgent(terminalId, combinedData);

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

    // CLI Agent関連データのクリーンアップ（超シンプル）
    if (this._connectedAgentTerminalId === terminalId) {
      this._connectedAgentTerminalId = null;
      this._connectedAgentType = null;
      this._onCliAgentStatusChange.fire({
        terminalId,
        status: 'none',
        type: null,
      });
    }

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
    return this._connectedAgentTerminalId === terminalId;
  }

  /**
   * Check if CLI Agent is running in a terminal (CONNECTED or DISCONNECTED)
   */
  public isCliAgentRunning(terminalId: string): boolean {
    return this._connectedAgentTerminalId === terminalId;
  }

  /**
   * Get currently globally active CLI Agent
   */
  public getCurrentGloballyActiveAgent(): { terminalId: string; type: string } | null {
    return this._connectedAgentTerminalId && this._connectedAgentType
      ? { terminalId: this._connectedAgentTerminalId, type: this._connectedAgentType }
      : null;
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
    this._detectCliAgent(terminalId, data);
  }

  /**
   * Get the active CLI Agent type for a terminal
   */
  public getAgentType(terminalId: string): string | null {
    return this._connectedAgentTerminalId === terminalId ? this._connectedAgentType : null;
  }

  /**
   * Get all active CLI Agents
   */
  public getConnectedAgents(): Array<{ terminalId: string; agentInfo: { type: string } }> {
    return this._connectedAgentTerminalId && this._connectedAgentType
      ? [
          {
            terminalId: this._connectedAgentTerminalId,
            agentInfo: { type: this._connectedAgentType },
          },
        ]
      : [];
  }

  // =================== CLI Agent Detection (Ultra Simple) ===================

  /**
   * Gemini CLI検知の改善されたパターンマッチング
   */
  // This method has been replaced by _detectGeminiCliStartup for better organization
  // Keeping this stub for backward compatibility during transition
  private _isGeminiCliDetected(cleanLine: string): boolean {
    return this._detectGeminiCliStartup(cleanLine);
  }

  /**
   * 超シンプルなCLI Agent検出（出力から）
   */
  private _detectCliAgent(terminalId: string, data: string): void {
    try {
      const lines = data.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        
        // 完全なANSIエスケープシーケンスクリーニング
        const cleanLine = this._cleanAnsiEscapeSequences(trimmed);
        
        // 追加のクリーニング：プロンプト記号とボックス文字を除去
        const fullyCleanLine = cleanLine
          .replace(/^[>$#%]\s+/, '') // プロンプト記号を除去
          .replace(/[│╭╰─╯]/g, '') // ボックス文字除去
          .trim();

        // デバッグログを強化
        if (fullyCleanLine && this._connectedAgentTerminalId === terminalId) {
          log(`🔍 [TERMINATION-DEBUG] Processing line: "${trimmed}" → cleaned: "${fullyCleanLine}"`);
        }

        // === TERMINATION DETECTION ===
        // Detect CLI Agent termination through shell prompt return or exit messages
        if (this._connectedAgentTerminalId === terminalId) {
          if (this._detectCliAgentTermination(terminalId, fullyCleanLine)) {
            log(`🔚 [CLI-AGENT] Termination detected from output: "${fullyCleanLine}" in terminal ${terminalId}`);
            return; // Exit early if termination detected
          }
        }

        // === STARTUP DETECTION ===
        // Claude Code startup patterns
        if (this._detectClaudeCodeStartup(fullyCleanLine)) {
          log(`🚀 [CLI-AGENT] Claude Code startup detected: "${fullyCleanLine}" in terminal ${terminalId}`);
          this._setCurrentAgent(terminalId, 'claude');
          break;
        }

        // Gemini CLI startup patterns
        if (this._detectGeminiCliStartup(fullyCleanLine)) {
          log(`🚀 [CLI-AGENT] Gemini CLI startup detected: "${fullyCleanLine}" in terminal ${terminalId}`);
          this._setCurrentAgent(terminalId, 'gemini');
          break;
        }
      }
    } catch (error) {
      // エラーは無視（ただしログ出力）
      log('ERROR: CLI Agent detection failed:', error);
    }
  }

  /**
   * Detect CLI Agent termination based on shell prompt return and exit patterns
   */
  private _detectCliAgentTermination(terminalId: string, cleanLine: string): boolean {
    // シンプルな終了判定: シェルプロンプトが表示されたら CLI エージェントは終了している
    log(`🔍 [TERMINATION-DEBUG] Checking termination for terminal ${terminalId}: "${cleanLine}"`);

    // Method 1: Shell prompt detection (primary method)
    // シェルプロンプトが表示されたら CLI エージェントは確実に終了している
    const isShellPrompt = this._detectShellPromptReturn(cleanLine);

    if (isShellPrompt) {
      log(`✅ [TERMINATION-SUCCESS] Shell prompt detected - CLI Agent terminated for terminal ${terminalId}`);
      this._setAgentTerminated(terminalId);
      return true;
    }

    // Method 2: User exit commands (/exit, /quit)
    // ユーザーが明示的に終了コマンドを入力した場合も検知
    const lowerLine = cleanLine.toLowerCase();
    const isUserExitCommand = 
      lowerLine === '/exit' ||
      lowerLine === '/quit' ||
      lowerLine === 'exit' ||
      lowerLine === 'quit';

    if (isUserExitCommand) {
      log(`✅ [TERMINATION-SUCCESS] User exit command detected - CLI Agent will terminate for terminal ${terminalId}`);
      // 注意: 実際の終了はシェルプロンプトの表示で確認されるまで待つ場合もある
      this._setAgentTerminated(terminalId);
      return true;
    }

    return false;
  }

  /**
   * Detect shell prompt return after CLI agent exits
   */
  private _detectShellPromptReturn(cleanLine: string): boolean {
    // Look for common shell prompt patterns that appear after CLI tools exit
    const shellPromptPatterns = [
      // Standard bash/zsh prompts
      /^[\w.-]+[@:].*[$>#]\s*$/,
      // Oh My Zsh themes - arrow character
      /^➜\s+[\w.-]+/,
      // Starship prompt - triangle character (❯)
      /^❯\s*$/,
      // Starship prompt - triangle character with trailing space
      /^❯\s+$/,
      // PowerShell
      /^PS\s+[\w:\\>]+>/,
      // Fish shell
      /^[\w.-]+\s+[\w/~]+>\s*$/,
      // Simple prompts
      /^[$>#]\s*$/,
    ];

    // Debug: Log the patterns being tested
    const matched = shellPromptPatterns.some((pattern, index) => {
      const result = pattern.test(cleanLine);
      if (result) {
        log(`✅ [DEBUG] Shell prompt matched pattern ${index}: ${pattern.source}`);
      }
      return result;
    });

    if (matched) {
      log(`✅ [DEBUG] Shell prompt detected: "${cleanLine}"`);
    } else {
      log(`❌ [DEBUG] No shell prompt match for: "${cleanLine}" (length: ${cleanLine.length})`);
      // Debug: Show character codes
      const charCodes = Array.from(cleanLine).map(c => `${c}(${c.charCodeAt(0)})`).join(' ');
      log(`❌ [DEBUG] Character breakdown: ${charCodes}`);
    }

    return matched;
  }

  /**
   * Set CLI agent as terminated and update status
   */
  private _setAgentTerminated(terminalId: string): void {
    if (this._connectedAgentTerminalId === terminalId) {
      const agentType = this._connectedAgentType;

      // Clear the connected agent
      this._connectedAgentTerminalId = null;
      this._connectedAgentType = null;

      // Fire status change to 'none'
      this._onCliAgentStatusChange.fire({
        terminalId,
        status: 'none',
        type: null,
        terminalName: this._terminals.get(terminalId)?.name,
      });

      console.log(`[CLI Agent] ${agentType} agent terminated in terminal: ${terminalId}`);
    }
  }

  /**
   * Detect Claude Code startup patterns
   */
  private _detectClaudeCodeStartup(cleanLine: string): boolean {
    return (
      cleanLine.includes('Welcome to Claude Code!') ||
      cleanLine.includes('Claude Opus') ||
      cleanLine.includes('Claude Sonnet') ||
      cleanLine.includes('Claude Haiku') ||
      cleanLine.includes('> Try "edit <filepath>') ||
      cleanLine.includes('Anthropic') ||
      cleanLine.includes('claude.ai') ||
      cleanLine.includes('Claude Code') ||
      cleanLine.includes("I'm Claude") ||
      cleanLine.includes('I am Claude') ||
      cleanLine.includes('anthropic claude') ||
      cleanLine.includes('Powered by Claude') ||
      cleanLine.includes('CLI tool for Claude') ||
      // Generic activation patterns
      (cleanLine.toLowerCase().includes('claude') &&
        (cleanLine.includes('activated') ||
          cleanLine.includes('connected') ||
          cleanLine.includes('ready') ||
          cleanLine.includes('started') ||
          cleanLine.includes('available')))
    );
  }

  /**
   * Detect Gemini CLI startup patterns
   */
  private _detectGeminiCliStartup(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase();

    // Basic Gemini keyword check with enhanced patterns
    if (line.includes('gemini')) {
      // Gemini context indicators
      if (
        line.includes('cli') ||
        line.includes('code') ||
        line.includes('chat') ||
        line.includes('api') ||
        line.includes('google') ||
        line.includes('activated') ||
        line.includes('connected') ||
        line.includes('ready') ||
        line.includes('started') ||
        line.includes('available') ||
        line.includes('welcome') ||
        line.includes('help') ||
        line.includes('initialized') ||
        line.includes('launching') ||
        line.includes('loading')
      ) {
        return true;
      }
    }

    // Specific Gemini CLI output patterns (enhanced)
    return (
      // Version patterns
      line.includes('gemini-2.5-pro') ||
      line.includes('gemini-1.5-pro') ||
      line.includes('gemini-pro') ||
      line.includes('gemini flash') ||
      
      // File and documentation patterns
      line.includes('gemini.md') ||
      line.includes('tips for getting started') ||
      
      // Company/service patterns
      line.includes('google ai') ||
      line.includes('google generative ai') ||
      line.includes('gemini api') ||
      line.includes('ai studio') ||
      line.includes('vertex ai') ||
      
      // Prompt patterns
      line.includes('gemini>') ||
      line.includes('gemini $') ||
      line.includes('gemini #') ||
      line.includes('gemini:') ||
      
      // Banner patterns (enhanced)
      (line.includes('█') && line.includes('gemini')) ||
      (line.includes('*') && line.includes('gemini') && line.includes('*')) ||
      (line.includes('=') && line.includes('gemini') && line.includes('=')) ||
      
      // Command execution confirmation
      line.includes('gemini --help') ||
      line.includes('gemini chat') ||
      line.includes('gemini code') ||
      line.includes('gemini repl') ||
      line.includes('gemini interactive') ||
      
      // Startup messages
      line.includes('gemini cli starting') ||
      line.includes('gemini session started') ||
      line.includes('connecting to gemini') ||
      line.includes('gemini model loaded') ||
      
      // Authentication patterns
      line.includes('gemini authenticated') ||
      line.includes('gemini login successful') ||
      
      // Additional model patterns
      line.includes('using gemini') ||
      (line.includes('model:') && line.includes('gemini'))
    );
  }

  /**
   * 超シンプルなCLI Agent検出（入力から）
   */
  private _detectCliAgentFromInput(terminalId: string, data: string): void {
    try {
      // === CLI AGENT STARTUP DETECTION ===
      if (data.includes('\r') || data.includes('\n')) {
        const command = data.replace(/[\r\n]/g, '').trim().toLowerCase();
        
        // Enhanced startup detection for both Claude and Gemini
        if (command.startsWith('claude') || 
            command.startsWith('gemini') ||
            command.includes('claude-code') ||
            command.includes('gemini code')) {
          
          let agentType: 'claude' | 'gemini';
          
          if (command.includes('claude') || command.includes('claude-code')) {
            agentType = 'claude';
          } else {
            agentType = 'gemini';
          }
          
          log(`🚀 [CLI-AGENT] ${agentType} startup command detected from input: "${command}"`);
          this._setCurrentAgent(terminalId, agentType);
        }
        
        // === CLI AGENT TERMINATION DETECTION FROM USER INPUT ===
        // If a CLI agent is currently connected to this terminal, check for exit commands
        if (this._connectedAgentTerminalId === terminalId) {
          const isExitCommand = 
            // Standard exit commands
            command === '/exit' ||
            command === '/quit' ||
            command === 'exit' ||
            command === 'quit' ||
            
            // Claude Code specific exit commands
            command === '/end' ||
            command === '/bye' ||
            command === '/goodbye' ||
            
            // Gemini CLI specific exit commands (enhanced)
            command === '/stop' ||
            command === '/close' ||
            command === '/disconnect' ||
            command.startsWith('/exit') ||
            command.startsWith('/quit') ||
            
            // Generic termination commands
            command === 'q' ||
            command === ':q' || // vim-style
            command === ':quit' ||
            command === ':exit' ||
            
            // Additional AI CLI patterns
            command === '/clear' && command.includes('exit') ||
            command === 'ctrl+c' ||
            command === 'ctrl-c';
            
          if (isExitCommand) {
            log(`🔚 [CLI-AGENT] Exit command detected from user input: "${command}" in terminal ${terminalId}`);
            // Mark for termination detection (will be confirmed when CLI agent actually exits)
            // Set a flag or timer to check for actual termination
            setTimeout(() => {
              // Give the CLI agent time to process the exit command and actually terminate
              // Then check if it's still connected and force termination if needed
              if (this._connectedAgentTerminalId === terminalId) {
                log(`🔚 [CLI-AGENT] Forcing termination after exit command timeout for terminal ${terminalId}`);
                this._setAgentTerminated(terminalId);
              }
            }, 2000); // 2 second timeout for CLI agent to actually exit
          }
        }
      }
    } catch (error) {
      log('ERROR: CLI Agent input detection failed:', error);
    }
  }

  /**
   * 現在のCLI Agentを設定（すべてのターミナル状態を更新）
   */
  private _setCurrentAgent(terminalId: string, type: 'claude' | 'gemini'): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      // Terminal not found
      return;
    }

    // 既に同じターミナルが同じタイプで設定されている場合はスキップ
    if (this._connectedAgentTerminalId === terminalId && this._connectedAgentType === type) {
      // Agent already set
      return;
    }

    // Setting current agent

    // 前のconnectedなAgentを保存
    const previousConnectedId = this._connectedAgentTerminalId;
    const previousType = this._connectedAgentType;

    // 新しいAgentを設定
    this._connectedAgentTerminalId = terminalId;
    this._connectedAgentType = type;

    // 1. 前にconnectedだったターミナルを先にdisconnectedにする
    if (previousConnectedId && previousConnectedId !== terminalId) {
      const previousTerminal = this._terminals.get(previousConnectedId);
      if (previousTerminal) {
        // Disconnecting previous terminal
        this._onCliAgentStatusChange.fire({
          terminalId: previousConnectedId,
          status: 'disconnected',
          type: previousType,
          terminalName: previousTerminal.name,
        });
      }
    }

    // 2. 新しく検知されたターミナルをconnectedにする
    console.log('[DEBUG] Connecting new terminal:', terminalId);
    this._onCliAgentStatusChange.fire({
      terminalId,
      status: 'connected',
      type,
      terminalName: terminal.name,
    });
  }

  /**
   * ANSIエスケープシーケンスを完全に除去
   */
  private _cleanAnsiEscapeSequences(text: string): string {
    return text
      // 基本的なANSIエスケープシーケンス（色、カーソル移動等）
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
      // OSCシーケンス（ウィンドウタイトル設定等）
      .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
      // エスケープシーケンス終了
      .replace(/\x1b\\/g, '')
      // キャリッジリターン除去
      .replace(/\r/g, '')
      // プライベートモード設定
      .replace(/\x1b\?[0-9]*[hl]/g, '')
      // アプリケーション/通常キーパッド
      .replace(/\x1b[=>]/g, '')
      // 制御文字を除去
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  }









}
