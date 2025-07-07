import * as vscode from 'vscode';
import * as pty from 'node-pty';
import { TerminalInstance, TerminalEvent } from '../types/common';
import { TERMINAL_CONSTANTS, ERROR_MESSAGES } from '../constants';
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

  constructor(private readonly _context: vscode.ExtensionContext) {
    // Context may be used in future for storing state
  }

  public createTerminal(): string {
    console.log('🔧 [DEBUG] TerminalManager.createTerminal called');
    const config = getTerminalConfig();
    console.log('🔧 [DEBUG] Terminal config:', config);

    if (this._terminals.size >= config.maxTerminals) {
      showWarningMessage(`${ERROR_MESSAGES.MAX_TERMINALS_REACHED} (${config.maxTerminals})`);
      return this._activeTerminalManager.getActive() || '';
    }

    const terminalId = generateTerminalId();
    const shell = getShellForPlatform(config.shell);
    const shellArgs = config.shellArgs;
    const cwd = getWorkingDirectory();

    console.log('📁 [TERMINAL] Creating terminal with:');
    console.log('📁 [TERMINAL] - ID:', terminalId);
    console.log('📁 [TERMINAL] - Shell:', shell);
    console.log('📁 [TERMINAL] - Shell Args:', shellArgs);
    console.log('📁 [TERMINAL] - Working Directory (cwd):', cwd);

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

      console.log('📁 [TERMINAL] Environment variables:');
      console.log('📁 [TERMINAL] - PWD:', env.PWD);
      console.log('📁 [TERMINAL] - VSCODE_WORKSPACE:', env.VSCODE_WORKSPACE);
      console.log('📁 [TERMINAL] - VSCODE_PROJECT_NAME:', env.VSCODE_PROJECT_NAME);

      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-color',
        cols: TERMINAL_CONSTANTS.DEFAULT_COLS,
        rows: TERMINAL_CONSTANTS.DEFAULT_ROWS,
        cwd,
        env,
      });

      const terminal: TerminalInstance = {
        id: terminalId,
        pty: ptyProcess,
        name: generateTerminalName(this._terminals.size + 1),
        isActive: true,
      };

      // Set all other terminals as inactive
      this._deactivateAllTerminals();

      this._terminals.set(terminalId, terminal);
      this._activeTerminalManager.setActive(terminalId);

      ptyProcess.onData((data) => {
        console.log(
          '📤 [DEBUG] PTY data received:',
          data.length,
          'chars for terminal:',
          terminalId
        );

        // Performance optimization: Batch small data chunks
        this._bufferData(terminalId, data);
      });

      ptyProcess.onExit((exitCode) => {
        console.log(
          '🚪 [DEBUG] PTY process exited:',
          exitCode.exitCode,
          'for terminal:',
          terminalId
        );
        
        // Check if this terminal is being manually killed to prevent infinite loop
        if (this._terminalBeingKilled.has(terminalId)) {
          console.log('🗑️ [DEBUG] Terminal exit triggered by manual kill, cleaning up:', terminalId);
          this._terminalBeingKilled.delete(terminalId);
          this._cleanupTerminalData(terminalId);
        } else {
          console.log('🚪 [DEBUG] Terminal exited naturally, removing:', terminalId);
          this._exitEmitter.fire({ terminalId, exitCode: exitCode.exitCode });
          this._removeTerminal(terminalId);
        }
      });

      console.log('✅ [TERMINAL] Terminal created successfully with ID:', terminalId);
      console.log('📁 [TERMINAL] Expected working directory:', cwd);

      this._terminalCreatedEmitter.fire(terminal);
      return terminalId;
    } catch (error) {
      showErrorMessage(ERROR_MESSAGES.TERMINAL_CREATION_FAILED, error);
      throw error;
    }
  }

  public sendInput(data: string, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();
    console.log(
      '🔧 [DEBUG] TerminalManager.sendInput called with data:',
      JSON.stringify(data),
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
      console.log('🔧 [DEBUG] Writing to pty:', JSON.stringify(data));
      terminal.pty.write(data);
      console.log('✅ [DEBUG] Successfully wrote to pty');
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
      console.log(
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
      console.log(
        '🔄 [TERMINAL] Requested to kill:',
        terminalId,
        'but will kill active terminal:',
        activeId
      );
    }

    // Prevent infinite loop by tracking kill state
    if (this._terminalBeingKilled.has(activeId)) {
      console.log('🗑️ [WARN] Active terminal already being killed:', activeId);
      return;
    }

    console.log('🗑️ [TERMINAL] Killing active terminal:', activeId);
    const terminal = this._terminals.get(activeId);
    if (terminal) {
      try {
        // Mark terminal as being killed before killing the process
        this._terminalBeingKilled.add(activeId);

        // Kill the actual terminal process
        terminal.pty.kill();
        console.log('🗑️ [TERMINAL] Terminal process killed:', activeId);

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
    console.log('🧹 [TERMINAL] Cleaning up terminal data:', terminalId);

    // Clean up data buffers for this terminal
    this._flushBuffer(terminalId);
    this._dataBuffers.delete(terminalId);
    const timer = this._dataFlushTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._dataFlushTimers.delete(terminalId);
    }

    // Remove from terminals map
    this._terminals.delete(terminalId);
    this._terminalRemovedEmitter.fire(terminalId);

    console.log('🧹 [TERMINAL] Terminal data cleaned up:', terminalId);
    console.log('🧹 [TERMINAL] Remaining terminals:', Array.from(this._terminals.keys()));

    // アクティブターミナルだった場合、別のターミナルをアクティブにする
    this._updateActiveTerminalAfterRemoval(terminalId);
  }

  /**
   * ターミナルを削除し、必要に応じて他のターミナルをアクティブにする
   */
  private _removeTerminal(terminalId: string): void {
    console.log('🗑️ [TERMINAL] Removing terminal:', terminalId);

    // Get terminal instance before removal
    const terminal = this._terminals.get(terminalId);

    // Kill the terminal process if it's still running (safety check)
    if (terminal) {
      try {
        terminal.pty.kill();
        console.log('🗑️ [TERMINAL] Process killed during removal:', terminalId);
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
        console.log('🔄 [TERMINAL] Set new active terminal:', remaining.id);
      } else {
        this._activeTerminalManager.clearActive();
        console.log('🔄 [TERMINAL] No remaining terminals, cleared active');
      }
    }
  }
}
