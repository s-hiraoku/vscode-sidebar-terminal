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

  // 出力履歴保存用バッファ（最大1000行/ターミナル）
  private readonly _outputHistory = new Map<string, string[]>();
  private readonly MAX_OUTPUT_HISTORY = 1000;

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

        // 🛡️ プロセス終了イベント（CLI Agent終了検出は無効化）

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

    // 出力履歴に追加
    this.addToOutputHistory(terminalId, data);

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

    // 出力履歴もクリア
    this.clearOutputHistory(terminalId);

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
  private _isGeminiCliDetected(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase();

    // 基本的なGeminiキーワード
    if (line.includes('gemini')) {
      // Gemini関連のコンテキスト
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
        line.includes('help')
      ) {
        return true;
      }
    }

    // 具体的なGemini CLI出力パターン
    return (
      line.includes('gemini-2.5-pro') ||
      line.includes('gemini.md') ||
      line.includes('tips for getting started') ||
      line.includes('google ai') ||
      line.includes('google generative ai') ||
      line.includes('gemini api') ||
      line.includes('ai studio') ||
      // プロンプト関連
      line.includes('gemini>') ||
      line.includes('gemini $') ||
      line.includes('gemini #') ||
      // バナー関連（ASCII artは除外して文字パターンで）
      (line.includes('█') && line.includes('gemini')) ||
      // コマンド実行確認
      line.includes('gemini --help') ||
      line.includes('gemini chat') ||
      line.includes('gemini code')
    );
  }

  /**
   * 超シンプルなCLI Agent検出（出力から）
   */
  private _detectCliAgent(terminalId: string, data: string): void {
    try {
      const lines = data.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        const cleanLine = trimmed.replace(/^[>$#%]\s*/, '');

        // デバッグ用ログを追加
        if (cleanLine.length > 0) {
          console.log('[DEBUG] Checking CLI Agent patterns for line:', { terminalId, cleanLine });
        }

        // Claude Codeが起動している時の特徴的なパターンをチェック
        if (
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
          // 実際のClaude Code CLIの起動パターンを追加
          cleanLine.includes('anthropic claude') ||
          cleanLine.includes('Powered by Claude') ||
          cleanLine.includes('CLI tool for Claude') ||
          // より広範なClaude検知パターン
          (cleanLine.toLowerCase().includes('claude') &&
            (cleanLine.includes('activated') ||
              cleanLine.includes('connected') ||
              cleanLine.includes('ready') ||
              cleanLine.includes('started') ||
              cleanLine.includes('available')))
        ) {
          console.log('[DEBUG] Claude pattern matched, setting current agent');
          this._setCurrentAgent(terminalId, 'claude');
          break;
        }
        // Geminiが起動している時の特徴的なパターンをチェック
        if (this._isGeminiCliDetected(cleanLine)) {
          console.log('[DEBUG] Gemini pattern matched, setting current agent');
          this._setCurrentAgent(terminalId, 'gemini');
          break;
        }

        // Gemini CLIのプロンプト準備状態をチェック（改善版）
        if (
          this._connectedAgentTerminalId === terminalId &&
          this._connectedAgentType === 'gemini'
        ) {
          // Gemini CLIの実際の出力をすべてログに記録
          console.log(`[DEBUG] 🔍 Gemini CLI output line: "${cleanLine}"`);

          // より包括的なプロンプト検知パターン
          const _isPromptReady =
            // 標準的なプロンプト文字
            cleanLine.includes('>') ||
            cleanLine.includes('$') ||
            cleanLine.includes('#') ||
            // Gemini CLI特有のパターン
            cleanLine.toLowerCase().includes('gemini:') ||
            cleanLine.toLowerCase().includes('gemini >') ||
            cleanLine.toLowerCase().includes('gemini$') ||
            cleanLine.toLowerCase().includes('gemini#') ||
            // 入力待機状態を示すパターン
            cleanLine.includes('Enter your prompt') ||
            cleanLine.includes('What would you like') ||
            cleanLine.includes('How can I help') ||
            // 空行または単純なプロンプト
            (cleanLine.length === 0 && data.includes('\n')) ||
            // カーソルのみの行
            cleanLine === '_' ||
            cleanLine === '|' ||
            // 最後の手段: 任意の対話的なパターン
            (cleanLine.length > 0 &&
              cleanLine.length < 5 &&
              (cleanLine.includes('>') || cleanLine.includes(':') || cleanLine.includes('?')));
        }
      }
    } catch (error) {
      // エラーは無視
    }
  }

  /**
   * 超シンプルなCLI Agent検出（入力から）
   */
  private _detectCliAgentFromInput(terminalId: string, data: string): void {
    try {
      if (data.includes('\r') || data.includes('\n')) {
        const command = data.replace(/[\r\n]/g, '').trim();
        console.log(`[DEBUG] CLI Agent input detection: "${command}" in terminal ${terminalId}`);

        if (command.startsWith('claude') || command.startsWith('gemini')) {
          const agentType = command.startsWith('claude') ? 'claude' : 'gemini';
          console.log(`[DEBUG] Detected ${agentType} CLI from input command`);
          this._setCurrentAgent(terminalId, agentType);
        }
      }
    } catch (error) {
      console.warn('[DEBUG] Error in CLI Agent input detection:', error);
    }
  }

  /**
   * 現在のCLI Agentを設定（すべてのターミナル状態を更新）
   */
  private _setCurrentAgent(terminalId: string, type: 'claude' | 'gemini'): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      console.log('[DEBUG] Terminal not found for ID:', terminalId);
      return;
    }

    // 既に同じターミナルが同じタイプで設定されている場合はスキップ
    if (this._connectedAgentTerminalId === terminalId && this._connectedAgentType === type) {
      console.log('[DEBUG] Agent already set for this terminal, skipping');
      return;
    }

    console.log('[DEBUG] Setting current agent:', {
      terminalId,
      type,
      terminalName: terminal.name,
      previousAgent: this._connectedAgentTerminalId,
      previousType: this._connectedAgentType,
    });

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
        console.log('[DEBUG] Disconnecting previous terminal:', previousConnectedId);
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

  // ==================== セッション復元関連のメソッド ====================

  /**
   * 全ターミナルの情報を取得（セッション保存用）
   */
  public getAllTerminals(): Array<{
    id: string;
    name: string;
    number: number;
    cwd: string;
    createdAt: number;
    isActive: boolean;
  }> {
    return Array.from(this._terminals.values()).map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      number: terminal.number,
      cwd: terminal.cwd || process.cwd(),
      createdAt: terminal.createdAt || Date.now(),
      isActive: terminal.isActive,
    }));
  }

  /**
   * 指定ターミナルのスクロールバック履歴を取得（セッション保存用）
   */
  // SESSION SCROLLBACK METHOD - DISABLED FOR DEBUGGING
  /*
  public async getTerminalScrollback(terminalId: string, maxLines: number): Promise<string[]> {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log(`⚠️ [SESSION] Terminal not found for scrollback: ${terminalId}`);
      return [];
    }

    try {
      // 現在はプレースホルダー実装
      // 実際の実装では、xterm.jsのbufferからスクロールバックを取得する必要がある
      // これはWebView側との連携が必要
      log(`📜 [SESSION] Getting scrollback for terminal ${terminalId} (max: ${maxLines} lines)`);

      // TODO: WebView側でxterm.js bufferからスクロールバックを取得する仕組みが必要
      // 現在は空配列を返す（Phase 2で実装予定）
      return [];
    } catch (error) {
      log(`❌ [SESSION] Error getting scrollback for ${terminalId}: ${error}`);
      return [];
    }
  }
  */

  /**
   * セッションデータからターミナルを作成（復元用）
   */
  // SESSION RESTORATION METHODS - DISABLED FOR DEBUGGING
  /*
  public async createTerminalFromSession(sessionInfo: {
    id: string;
    name: string;
    cwd: string;
    terminalNumber: number;
    restoreMessage: string;
    scrollbackHistory: string[];
  }): Promise<string | null> {
    try {
      log(`🔄 [SESSION] Creating terminal from session: ${sessionInfo.name}`);

      // 既存のターミナル数をチェック
      const config = getTerminalConfig();
      if (this._terminals.size >= config.maxTerminals) {
        log(`⚠️ [SESSION] Cannot restore terminal: max terminals reached (${config.maxTerminals})`);
        return null;
      }

      // セッション用の特別なターミナル作成
      return await this._createSessionTerminal(sessionInfo);
    } catch (error) {
      log(`❌ [SESSION] Error creating terminal from session: ${error}`);
      return null;
    }
  }
  */

  /**
   * セッション復元用のターミナルを内部的に作成 - DISABLED FOR DEBUGGING
   */
  /*
  private async _createSessionTerminal(sessionInfo: {
    id: string;
    name: string;
    cwd: string;
    terminalNumber: number;
    restoreMessage: string;
    scrollbackHistory: string[];
  }): Promise<string | null> {
    return new Promise((resolve) => {
      this.operationQueue = this.operationQueue.then(async () => {
        try {
          const config = getTerminalConfig();
          const shell = getShellForPlatform(config.shell);
          const shellArgs = config.shellArgs || [];

          // セッション用の新しいIDを生成（元のIDは参考用）
          const terminalId = generateTerminalId();

          // ターミナル番号を確保
          const terminalNumber = this._terminalNumberManager.allocateNumber(
            sessionInfo.terminalNumber,
            this._terminals
          );
          if (terminalNumber === 0) {
            log(`⚠️ [SESSION] Cannot allocate terminal number for restoration`);
            resolve(null);
            return;
          }

          // ワーキングディレクトリを設定（セッションのcwdを使用）
          const cwd =
            sessionInfo.cwd && require('fs').existsSync(sessionInfo.cwd)
              ? sessionInfo.cwd
              : getWorkingDirectory();

          log(
            `🚀 [SESSION] Creating session terminal: shell=${shell}, cwd=${cwd}, number=${terminalNumber}`
          );

          // PTYプロセスを作成
          const ptyProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-color',
            cols: TERMINAL_CONSTANTS.DEFAULT_COLS,
            rows: TERMINAL_CONSTANTS.DEFAULT_ROWS,
            cwd: cwd,
            env: { ...process.env },
            encoding: null,
          });

          // ターミナルインスタンスを作成（統一化のため両方設定）
          const terminal: TerminalInstance = {
            id: terminalId,
            name: sessionInfo.name,
            number: terminalNumber,
            pty: ptyProcess,      // 統一化のため両方設定
            ptyProcess,           // セッション復元用
            cwd,
            isActive: false,
            createdAt: Date.now(),
            isSessionRestored: true, // セッション復元フラグ
            sessionRestoreMessage: sessionInfo.restoreMessage,
            sessionScrollback: sessionInfo.scrollbackHistory,
          };

          // ターミナルをマップに追加
          this._terminals.set(terminalId, terminal);

          // PTYイベントを設定
          ptyProcess.onData((data: string) => {
            this._dataEmitter.fire({ terminalId, data });
            this._bufferData(terminalId, data);
          });

          ptyProcess.onExit((event: number | { exitCode: number; signal?: number }) => {
            const exitCode = typeof event === 'number' ? event : event.exitCode;
            log(`💀 [SESSION] Session terminal ${terminalId} exited with code: ${exitCode}`);
            this._exitEmitter.fire({ terminalId, exitCode });
          });

          // セッション復元処理をWebViewに通知
          this._terminalCreatedEmitter.fire(terminal);

          // 状態更新通知
          this._notifyStateUpdate();

          log(
            `✅ [SESSION] Session terminal created successfully: ${terminalId} (${sessionInfo.name})`
          );
          resolve(terminalId);
        } catch (error) {
          log(`❌ [SESSION] Failed to create session terminal: ${error}`);
          resolve(null);
        }
      });
    });
  }

  /**
   * セッション復元が完了した後の初期化処理 - DISABLED FOR DEBUGGING
   */
  /*
  public finalizeSessionRestore(): void {
    log('🎯 [SESSION] Finalizing session restore - DISABLED FOR DEBUGGING...');

    // DISABLED - No session restoration functionality
    // // 復元されたターミナルが1つ以上ある場合、最初のものをアクティブにする
    // const terminals = Array.from(this._terminals.values());
    // const restoredTerminals = terminals.filter((t) => (t as any).isSessionRestored);

    // if (restoredTerminals.length > 0) {
    //   const firstTerminal = restoredTerminals[0];
    //   if (firstTerminal) {
    //     this._activeTerminalManager.setActive(firstTerminal.id);
    //     firstTerminal.isActive = true;
    //     log(`🎯 [SESSION] Set first restored terminal as active: ${firstTerminal.id}`);
    //   }
    // }

    // // 状態更新通知
    // this._notifyStateUpdate();

    log(`✅ [SESSION] Session restore finalized - DISABLED FOR DEBUGGING`);
  }
  */

  // STUB METHODS TO PREVENT COMPILATION ERRORS - These prevent SessionManager compilation errors
  public getTerminalScrollback(_terminalId: string, _maxLines: number): Promise<string[]> {
    // Disabled - return empty array to prevent compilation errors
    return Promise.resolve([]);
  }

  public createTerminalFromSession(_sessionInfo: Record<string, unknown>): Promise<string | null> {
    // Disabled - return null to prevent compilation errors
    return Promise.resolve(null);
  }

  public finalizeSessionRestore(): void {
    // Disabled - do nothing to prevent compilation errors
    log('🎯 [SESSION] Finalizing session restore - STUB METHOD, DISABLED FOR DEBUGGING');
  }

  // =================== Output History Management ===================

  /**
   * ANSIエスケープシーケンスを除去
   */
  private cleanAnsiEscapeSequences(text: string): string {
    // ANSIエスケープシーケンスのパターン
    // \u001b[0-9;]*[A-Za-z] - カラー、カーソル移動等
    // \u001b]0;.*?\u0007 - ウィンドウタイトル設定
    // \u001b]1;.*?\u0007 - タブタイトル設定
    // \u001b]7;.*?\u0007 - 作業ディレクトリ設定
    // \u001b\\ - その他のエスケープシーケンス終了
    return text
      .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '') // 基本的なANSIエスケープシーケンス
      .replace(/\u001b\][0-9];[^\u0007]*\u0007/g, '') // OSCシーケンス
      .replace(/\u001b\\/g, '') // エスケープシーケンス終了
      .replace(/\r/g, '') // キャリッジリターン除去
      .replace(/\u001b\?[0-9]*[hl]/g, '') // プライベートモード設定
      .replace(/\u001b=/g, '') // アプリケーションキーパッド
      .replace(/\u001b>/g, '') // 通常キーパッド
      .trim();
  }

  /**
   * プロンプトパターンかどうかを判定
   */
  private isPromptPattern(text: string): boolean {
    // 一般的なプロンプトパターン
    const promptPatterns = [
      /^[\s~]*❯[\s\d.:]*$/, // ❯ with optional path and time
      /^[\s~]*\$[\s\d.:]*$/, // $ with optional path and time
      /^[\s~]*%[\s\d.:]*$/, // % with optional path and time
      /^[\s~]*#[\s\d.:]*$/, // # with optional path and time
      /^[\s~]*>[\s\d.:]*$/, // > with optional path and time
      /^[\w@-]+:[\w~/-]*[$#%>❯]\s*$/, // user@host:path$ format
      /^[\s\w~/.:-]*❯[\s\d.:]*$/, // path ❯ time format
      /^\s*[\d.:]+\s*$/, // time only (e.g., "00:30")
      /^[\s\w~/-]*\s+[\d.:]+\s*$/, // path + time format
    ];

    return promptPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * コマンドパターンかどうかを判定（除外するため）
   */
  private isCommandPattern(text: string): boolean {
    // 一般的なコマンドパターン（これらは除外したい）
    const commandPatterns = [
      /^[a-zA-Z][\w-]*(\s+.*)?$/, // starts with letter, followed by word chars
      /^\.\/[\w.-]+(\s+.*)?$/, // ./script execution
      /^\/[\w/-]+(\s+.*)?$/, // absolute path execution
      /^echo\s+.*$/, // echo commands specifically
      /^ls(\s+.*)?$/, // ls commands
      /^cat(\s+.*)?$/, // cat commands
      /^pwd(\s+.*)?$/, // pwd commands
      /^cd(\s+.*)?$/, // cd commands
      /^mkdir(\s+.*)?$/, // mkdir commands
      /^rm(\s+.*)?$/, // rm commands
      /^cp(\s+.*)?$/, // cp commands
      /^mv(\s+.*)?$/, // mv commands
      /^git(\s+.*)?$/, // git commands
      /^npm(\s+.*)?$/, // npm commands
      /^node(\s+.*)?$/, // node commands
      /^python(\s+.*)?$/, // python commands
    ];

    return commandPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * 入力エコーバック（部分入力）かどうかを判定
   */
  private isPartialInput(text: string): boolean {
    // 非常に短い文字列（1-3文字）で、完全なワードでない
    if (text.length <= 3 && !/^\w+$/.test(text)) {
      return true;
    }

    // 単一文字
    if (text.length === 1) {
      return true;
    }

    // 一般的なコマンドの部分入力パターン
    const partialPatterns = [
      /^e$/,
      /^ec$/,
      /^ech$/,
      /^echo$/,
      /^l$/,
      /^ls$/,
      /^c$/,
      /^ca$/,
      /^cat$/,
      /^p$/,
      /^pw$/,
      /^pwd$/,
      /^c$/,
      /^cd$/,
      /^m$/,
      /^mk$/,
      /^mkd$/,
      /^mkdi$/,
      /^r$/,
      /^rm$/,
      /^c$/,
      /^cp$/,
      /^m$/,
      /^mv$/,
    ];

    return partialPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * 有効な出力コンテンツかどうかを判定（出力のみ保存版）
   */
  private isSignificantContent(cleanText: string): boolean {
    if (!cleanText || cleanText.length < 1) {
      return false;
    }

    // 空白のみの行は除外
    if (/^\s*$/.test(cleanText)) {
      return false;
    }

    // プロンプトパターンは除外
    if (this.isPromptPattern(cleanText)) {
      return false;
    }

    // 入力エコーバック（部分入力）は除外
    if (this.isPartialInput(cleanText)) {
      return false;
    }

    // コマンド自体は除外（出力のみ保存したい）
    if (this.isCommandPattern(cleanText)) {
      return false;
    }

    // 単一記号のみは除外
    if (/^[^\w\s]+$/.test(cleanText) && cleanText.length <= 3) {
      return false;
    }

    // パス表示（/home/user など）は除外
    if (/^\/[\w/-]+$/.test(cleanText)) {
      return false;
    }

    // 最小長チェック：意味のある出力は通常2文字以上
    if (cleanText.length >= 2) {
      return true;
    }

    return false;
  }

  /**
   * 重複や類似行を除去
   */
  private isDuplicateOrSimilar(newLine: string, history: string[]): boolean {
    if (history.length === 0) {
      return false;
    }

    const lastLine = history[history.length - 1];
    if (!lastLine) {
      return false;
    }

    // 完全一致は重複
    if (lastLine === newLine) {
      return true;
    }

    // 短い行の場合、類似性をチェック
    if (newLine.length <= 5) {
      // 最後の行が現在の行を含んでいる場合（部分入力の可能性）
      if (lastLine.includes(newLine) || newLine.includes(lastLine)) {
        return true;
      }
    }

    // 直近の3行をチェック
    const recentLines = history.slice(-3);
    for (const recentLine of recentLines) {
      if (recentLine === newLine) {
        return true;
      }
    }

    return false;
  }

  /**
   * 出力データを履歴に追加（高度版）
   */
  private addToOutputHistory(terminalId: string, data: string): void {
    let history = this._outputHistory.get(terminalId);
    if (!history) {
      history = [];
      this._outputHistory.set(terminalId, history);
    }

    // データを行ごとに分割して追加
    const lines = data.split('\n');
    for (const line of lines) {
      // ANSIエスケープシーケンスを除去
      const cleanLine = this.cleanAnsiEscapeSequences(line);

      // 意味のあるコンテンツかつ重複でないもののみを保存
      if (this.isSignificantContent(cleanLine) && !this.isDuplicateOrSimilar(cleanLine, history)) {
        history.push(cleanLine);

        // バッファサイズ制限
        if (history.length > this.MAX_OUTPUT_HISTORY) {
          history.shift(); // 古い行を削除
        }

        // デバッグログ: 保存された行を記録
        log(`✅ [OUTPUT-ONLY] Saved output for ${terminalId}: "${cleanLine}"`);
      } else {
        // デバッグログ: 除外された行を記録
        if (cleanLine.length > 0) {
          let reason = 'unknown';
          if (!this.isSignificantContent(cleanLine)) {
            if (this.isPromptPattern(cleanLine)) reason = 'prompt';
            else if (this.isPartialInput(cleanLine)) reason = 'partial-input';
            else if (this.isCommandPattern(cleanLine)) reason = 'command';
            else reason = 'not-significant';
          } else if (this.isDuplicateOrSimilar(cleanLine, history)) {
            reason = 'duplicate';
          }
          log(`🚫 [OUTPUT-ONLY] Filtered out (${reason}) for ${terminalId}: "${cleanLine}"`);
        }
      }
    }
  }

  /**
   * 最近の出力履歴を取得
   */
  public getRecentOutput(terminalId: string, maxLines: number = 100): string[] | null {
    const history = this._outputHistory.get(terminalId);
    if (!history || history.length === 0) {
      return null;
    }

    // 最新のmaxLines行を返す
    const startIndex = Math.max(0, history.length - maxLines);
    return history.slice(startIndex);
  }

  /**
   * ターミナルの出力履歴をクリア
   */
  public clearOutputHistory(terminalId: string): void {
    this._outputHistory.delete(terminalId);
  }

  /**
   * 全ての出力履歴をクリア
   */
  public clearAllOutputHistory(): void {
    this._outputHistory.clear();
  }
}
