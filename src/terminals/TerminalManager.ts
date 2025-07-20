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

export class TerminalManager {
  private readonly _terminals = new Map<string, TerminalInstance>();
  private readonly _activeTerminalManager = new ActiveTerminalManager();
  private readonly _dataEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _exitEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _terminalCreatedEmitter = new vscode.EventEmitter<TerminalInstance>();
  private readonly _terminalRemovedEmitter = new vscode.EventEmitter<string>();
  private readonly _stateUpdateEmitter = new vscode.EventEmitter<TerminalState>();
  private readonly _cliAgentStatusEmitter = new vscode.EventEmitter<{
    terminalId: string;
    isActive: boolean;
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

  // CLI Agent detection and command history
  private readonly _commandHistory = new Map<string, string[]>(); // terminalId -> commands
  private readonly _cliAgentActiveTerminals = new Set<string>(); // terminalIds with active CLI Agent
  private _currentInputBuffer = new Map<string, string>(); // terminalId -> partial input
  private readonly MAX_HISTORY_SIZE = 100;

  public readonly onData = this._dataEmitter.event;
  public readonly onExit = this._exitEmitter.event;
  public readonly onTerminalCreated = this._terminalCreatedEmitter.event;
  public readonly onTerminalRemoved = this._terminalRemovedEmitter.event;
  public readonly onStateUpdate = this._stateUpdateEmitter.event;
  public readonly onCliAgentStatusChange = this._cliAgentStatusEmitter.event;

  constructor(private readonly _context: vscode.ExtensionContext) {
    // Context may be used in future for storing state
  }

  /**
   * 利用可能な最小番号を検索する
   */
  private _findAvailableTerminalNumber(): number {
    const config = getTerminalConfig();
    const usedNumbers = new Set<number>();

    // 既存のターミナル名から番号を抽出
    for (const terminal of this._terminals.values()) {
      const match = terminal.name.match(/Terminal (\d+)/);
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }

    // 1から最大ターミナル数まで空き番号を探す
    for (let i = 1; i <= config.maxTerminals; i++) {
      if (!usedNumbers.has(i)) {
        return i;
      }
    }

    // 見つからない場合は最大値を返す（エラーケース）
    return config.maxTerminals;
  }

  /**
   * 新しいターミナルを作成できるかどうかを判定する
   */
  private _canCreateTerminal(): boolean {
    const config = getTerminalConfig();
    const usedNumbers = new Set<number>();

    // 既存のターミナル名から番号を抽出
    for (const terminal of this._terminals.values()) {
      const match = terminal.name.match(/Terminal (\d+)/);
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }

    // 1から最大ターミナル数まで空き番号があるかチェック
    for (let i = 1; i <= config.maxTerminals; i++) {
      if (!usedNumbers.has(i)) {
        return true;
      }
    }

    return false;
  }

  public createTerminal(): string {
    log('🔧 [DEBUG] TerminalManager.createTerminal called');
    const config = getTerminalConfig();
    log('🔧 [DEBUG] Terminal config:', config);

    // デバッグ情報: 現在のターミナル状況を表示
    const existingTerminals = Array.from(this._terminals.values());
    log('🔧 [DEBUG] Existing terminals:');
    existingTerminals.forEach((terminal) => {
      log(`🔧 [DEBUG] - ${terminal.name} (ID: ${terminal.id})`);
    });

    if (!this._canCreateTerminal()) {
      log('🔧 [DEBUG] Cannot create terminal: all slots used');
      showWarningMessage(`${ERROR_MESSAGES.MAX_TERMINALS_REACHED} (${config.maxTerminals})`);
      return this._activeTerminalManager.getActive() || '';
    }

    const terminalNumber = this._findAvailableTerminalNumber();
    log(`🔧 [DEBUG] Found available terminal number: ${terminalNumber}`);

    const terminalId = generateTerminalId();
    const shell = getShellForPlatform(config.shell);
    const shellArgs = config.shellArgs;
    const cwd = getWorkingDirectory();

    log('📁 [TERMINAL] Creating terminal with:');
    log('📁 [TERMINAL] - ID:', terminalId);
    log('📁 [TERMINAL] - Shell:', shell);
    log('📁 [TERMINAL] - Shell Args:', shellArgs);
    log('📁 [TERMINAL] - Working Directory (cwd):', cwd);

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

      log('📁 [TERMINAL] Environment variables:');
      log('📁 [TERMINAL] - PWD:', env.PWD);
      log('📁 [TERMINAL] - VSCODE_WORKSPACE:', env.VSCODE_WORKSPACE);
      log('📁 [TERMINAL] - VSCODE_PROJECT_NAME:', env.VSCODE_PROJECT_NAME);

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
        },
        encoding: 'utf8',
      });

      const terminal: TerminalInstance = {
        id: terminalId,
        pty: ptyProcess,
        name: generateTerminalName(terminalNumber),
        isActive: true,
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

        // Performance optimization: Batch small data chunks
        this._bufferData(terminalId, data);

        // Check for CLI Agent patterns in output
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

      log('✅ [TERMINAL] Terminal created successfully:');
      log(`✅ [TERMINAL] - Name: ${terminal.name}`);
      log(`✅ [TERMINAL] - ID: ${terminalId}`);
      log('📁 [TERMINAL] Expected working directory:', cwd);

      this._terminalCreatedEmitter.fire(terminal);

      // 状態更新を通知
      this._notifyStateUpdate();

      return terminalId;
    } catch (error) {
      showErrorMessage(ERROR_MESSAGES.TERMINAL_CREATION_FAILED, error);
      throw error;
    }
  }

  public sendInput(data: string, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();
    log(
      '🔧 [DEBUG] TerminalManager.sendInput called with data:',
      JSON.stringify(data),
      'length:',
      data.length,
      'bytes:',
      new TextEncoder().encode(data).length,
      'terminalId:',
      id
    );

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
      // Ensure data is properly encoded as UTF-8
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      const decoder = new TextDecoder('utf-8');
      const validatedData = decoder.decode(bytes);

      log('🔧 [DEBUG] Writing to pty - original:', JSON.stringify(data));
      log('🔧 [DEBUG] Writing to pty - validated:', JSON.stringify(validatedData));
      log('🔧 [DEBUG] Byte count:', bytes.length);

      // Track input for command history and CLI Agent detection
      this._trackInput(id, validatedData);

      terminal.pty.write(validatedData);
      log('✅ [DEBUG] Successfully wrote to pty');
    } catch (error) {
      console.error('❌ [ERROR] Failed to write to pty:', error);
      showErrorMessage('Failed to send input to terminal', error);
    }
  }

  public resize(cols: number, rows: number, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();
    if (id) {
      const terminal = this._terminals.get(id);
      terminal?.pty.resize(cols, rows);
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
   * ターミナルが削除可能かチェック
   */
  public canRemoveTerminal(terminalId: string): { canRemove: boolean; reason?: string } {
    if (!this._terminals.has(terminalId)) {
      return { canRemove: false, reason: 'Terminal not found' };
    }

    // 最低1つのターミナルは保持する
    if (this._terminals.size <= 1) {
      return { canRemove: false, reason: 'Must keep at least 1 terminal open' };
    }

    return { canRemove: true };
  }

  /**
   * 安全なターミナル削除（削除前の検証付き）
   */
  public safeRemoveTerminal(terminalId: string): boolean {
    const validation = this.canRemoveTerminal(terminalId);
    if (!validation.canRemove) {
      console.warn('⚠️ [TERMINAL] Cannot remove terminal:', validation.reason);
      showWarningMessage(validation.reason || 'Cannot remove terminal');
      return false;
    }

    this._removeTerminal(terminalId);
    return true;
  }

  /**
   * 新しいアーキテクチャ: 統一されたターミナル削除メソッド
   * 指定されたターミナルIDを削除し、新しい状態を返す
   */
  public async deleteTerminal(
    terminalId: string,
    requestSource: 'header' | 'panel' = 'panel'
  ): Promise<DeleteResult> {
    // 操作をキューに追加してレースコンディションを防ぐ
    return new Promise<DeleteResult>((resolve, reject) => {
      this.operationQueue = this.operationQueue.then(() => {
        try {
          const result = this.performDeleteOperation(terminalId, requestSource);
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
    requestSource: 'header' | 'panel'
  ): DeleteResult {
    log(
      `🗑️ [DELETE] Starting delete operation for terminal: ${terminalId} (source: ${requestSource})`
    );

    // 1. 削除前の検証
    const validation = this.canRemoveTerminal(terminalId);
    if (!validation.canRemove) {
      log(`⚠️ [DELETE] Cannot delete terminal: ${validation.reason}`);
      showWarningMessage(validation.reason || 'Cannot delete terminal');
      return { success: false, reason: validation.reason };
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
    const config = getTerminalConfig();
    const usedNumbers = new Set<number>();

    // 既存のターミナル名から番号を抽出
    for (const terminal of this._terminals.values()) {
      const match = terminal.name.match(/Terminal (\d+)/);
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }

    // 利用可能なスロットを返す
    const availableSlots: number[] = [];
    for (let i = 1; i <= config.maxTerminals; i++) {
      if (!usedNumbers.has(i)) {
        availableSlots.push(i);
      }
    }

    return availableSlots;
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
   * 安全なターミナルキル（削除前の検証付き）
   * 常にアクティブターミナルをkillする
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

    const validation = this.canRemoveTerminal(activeId);
    if (!validation.canRemove) {
      console.warn('⚠️ [TERMINAL] Cannot kill active terminal:', validation.reason);
      showWarningMessage(validation.reason || 'Cannot kill active terminal');
      return false;
    }

    this.killTerminal(); // No ID needed, will use active terminal
    return true;
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

    // Prevent infinite loop by tracking kill state
    if (this._terminalBeingKilled.has(activeId)) {
      log('🗑️ [WARN] Active terminal already being killed:', activeId);
      return;
    }

    log('🗑️ [TERMINAL] Killing active terminal:', activeId);
    const terminal = this._terminals.get(activeId);
    if (terminal) {
      try {
        // Mark terminal as being killed before killing the process
        this._terminalBeingKilled.add(activeId);

        // Kill the actual terminal process
        terminal.pty.kill();
        log('🗑️ [TERMINAL] Terminal process killed:', activeId);

        // Note: cleanup will be handled by onExit handler to avoid double cleanup
      } catch (error) {
        console.error('❌ [TERMINAL] Error killing terminal:', error);
        // Remove from kill tracking and cleanup if kill fails
        this._terminalBeingKilled.delete(activeId);
        this._removeTerminal(activeId);
      }
    } else {
      console.warn('⚠️ [WARN] Active terminal not found for kill:', activeId);
    }
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

    for (const terminal of this._terminals.values()) {
      terminal.pty.kill();
    }
    this._terminals.clear();
    this._dataEmitter.dispose();
    this._exitEmitter.dispose();
    this._terminalCreatedEmitter.dispose();
    this._terminalRemovedEmitter.dispose();
    this._stateUpdateEmitter.dispose();
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

    // CLI Agent関連データのクリーンアップ
    this._commandHistory.delete(terminalId);
    this._currentInputBuffer.delete(terminalId);
    if (this._cliAgentActiveTerminals.has(terminalId)) {
      this._deactivateCliAgent(terminalId);
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
   * Track input for command history and CLI Agent detection
   */
  private _trackInput(terminalId: string, data: string): void {
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

        // Check for CLI Agent command
        if (command.toLowerCase().startsWith('claude')) {
          log(`🚀 [TERMINAL] CLI Agent command detected in terminal ${terminalId}: ${command}`);
          this._activateCliAgent(terminalId);
        }
      }

      // Clear the buffer
      this._currentInputBuffer.set(terminalId, '');
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
    log(`📝 [TERMINAL] Command added to history for ${terminalId}: ${command}`);
  }

  /**
   * Activate CLI Agent for a terminal
   */
  private _activateCliAgent(terminalId: string): void {
    this._cliAgentActiveTerminals.add(terminalId);
    log(`✅ [TERMINAL] CLI Agent activated for terminal: ${terminalId}`);

    // Notify CliAgentTerminalTracker if it exists
    this._notifyCliAgentActivation(terminalId, true);
  }

  /**
   * Deactivate CLI Agent for a terminal
   */
  private _deactivateCliAgent(terminalId: string): void {
    this._cliAgentActiveTerminals.delete(terminalId);
    log(`❌ [TERMINAL] CLI Agent deactivated for terminal: ${terminalId}`);

    // Notify CliAgentTerminalTracker if it exists
    this._notifyCliAgentActivation(terminalId, false);
  }

  /**
   * Check if CLI Agent is active in a terminal
   */
  public isCliAgentActive(terminalId: string): boolean {
    return this._cliAgentActiveTerminals.has(terminalId);
  }

  /**
   * Get the last executed command for a terminal
   */
  public getLastCommand(terminalId: string): string | undefined {
    const history = this._commandHistory.get(terminalId);
    return history && history.length > 0 ? history[history.length - 1] : undefined;
  }

  /**
   * Notify CLI Agent activation status change
   */
  private _notifyCliAgentActivation(terminalId: string, isActive: boolean): void {
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      log(`🔔 [TERMINAL] CLI Agent status: ${terminalId} -> ${isActive ? 'active' : 'inactive'}`);
      this._cliAgentStatusEmitter.fire({ terminalId, isActive });
    }
  }

  /**
   * Handle terminal output for CLI Agent detection
   */
  public handleTerminalOutputForCliAgent(terminalId: string, data: string): void {
    // CLI Agent output patterns
    const cliAgentPatterns = [
      'Welcome to CLI Agent',
      'CLI Agent Code',
      'Type your message',
      'To start a conversation',
      'claude.ai',
      /^\s*Human:/,
      /^\s*Assistant:/,
    ];

    // Check if output contains CLI Agent patterns
    const hasCliAgentPattern = cliAgentPatterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return data.toLowerCase().includes(pattern.toLowerCase());
      } else {
        return pattern.test(data);
      }
    });

    if (hasCliAgentPattern && !this._cliAgentActiveTerminals.has(terminalId)) {
      log(`🔍 [TERMINAL] CLI Agent pattern detected in output for terminal ${terminalId}`);
      this._activateCliAgent(terminalId);
    }

    // Check for CLI Agent exit patterns
    const exitPatterns = ['Goodbye!', 'Chat ended', 'Session terminated'];

    const hasExitPattern = exitPatterns.some((pattern) =>
      data.toLowerCase().includes(pattern.toLowerCase())
    );

    if (hasExitPattern && this._cliAgentActiveTerminals.has(terminalId)) {
      log(`👋 [TERMINAL] CLI Agent exit pattern detected for terminal ${terminalId}`);
      this._deactivateCliAgent(terminalId);
    }
  }
}
