/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as vscode from 'vscode';
import { TerminalInstance, TerminalEvent } from '../types/common';
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
import { getPlatformInfo, validatePlatformSupport } from '../utils/platform';

export class TerminalManager {
  private readonly _terminals = new Map<string, TerminalInstance>();
  private readonly _activeTerminalManager = new ActiveTerminalManager();
  private readonly _dataEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _exitEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _terminalCreatedEmitter = new vscode.EventEmitter<TerminalInstance>();
  private readonly _terminalRemovedEmitter = new vscode.EventEmitter<string>();

  // Track terminals being killed to prevent infinite loops
  private readonly _terminalBeingKilled = new Set<string>();

  // node-pty module with runtime validation
  private _pty: typeof import('node-pty') | null = null;
  private _ptyLoadError: Error | null = null;

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
    // Initialize node-pty with error handling
    void this._initializeNodePty();
  }

  private async _initializeNodePty(): Promise<void> {
    try {
      log('🔧 [DEBUG] Initializing node-pty module...');

      // Check platform support first
      const platformInfo = getPlatformInfo();
      const platformSupport = validatePlatformSupport();

      log('🔍 [PLATFORM] Current platform:', platformInfo.description);

      if (!platformSupport.supported) {
        throw new Error(`Platform not supported: ${platformSupport.message}`);
      }

      // Dynamic import with error handling
      this._pty = await import('node-pty');

      log('✅ [SUCCESS] node-pty module loaded successfully');
      log('🔧 [DEBUG] node-pty spawn function:', typeof this._pty?.spawn);

      // Test node-pty functionality
      const testResult = this._validateNodePty();
      if (!testResult.success) {
        throw new Error(`node-pty validation failed: ${testResult.error}`);
      }
    } catch (error) {
      this._ptyLoadError = error as Error;
      log('❌ [ERROR] Failed to load node-pty:', error);

      // Show user-friendly error message
      const errorMessage = this._getPtyErrorMessage(error as Error);
      void vscode.window
        .showErrorMessage(`Sidebar Terminal: ${errorMessage}`, 'Platform Diagnostics', 'Learn More')
        .then((selection) => {
          if (selection === 'Platform Diagnostics') {
            void import('../utils/platform').then(({ showPlatformDiagnostics }) => {
              void showPlatformDiagnostics();
            });
          } else if (selection === 'Learn More') {
            void vscode.env.openExternal(
              vscode.Uri.parse(
                'https://github.com/s-hiraoku/vscode-sidebar-terminal#troubleshooting'
              )
            );
          }
        });
    }
  }

  private _validateNodePty(): { success: boolean; error?: string } {
    if (!this._pty) {
      return { success: false, error: 'node-pty module not loaded' };
    }

    try {
      // Check if spawn function exists
      if (typeof this._pty.spawn !== 'function') {
        return { success: false, error: 'node-pty.spawn is not a function' };
      }

      log('✅ [SUCCESS] node-pty validation passed');
      return { success: true };
    } catch (error) {
      return { success: false, error: `Validation error: ${String(error)}` };
    }
  }

  private _getPtyErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('cannot find module') || message.includes('.node')) {
      return `Native module loading failed. Please ensure you have the correct platform-specific package installed. Platform: ${process.platform}-${process.arch}`;
    }

    if (message.includes('debug') && message.includes('release')) {
      return 'Native module build configuration issue. Please try reinstalling the extension.';
    }

    if (message.includes('permission')) {
      return 'Permission denied accessing native module. Please check file permissions.';
    }

    return `Failed to initialize terminal functionality: ${error.message}`;
  }

  public createTerminal(): string {
    log('🔧 [DEBUG] TerminalManager.createTerminal called');

    // Check if node-pty is available
    if (!this._pty) {
      const errorMsg = this._ptyLoadError
        ? `Terminal creation failed: ${this._ptyLoadError.message}`
        : 'Terminal creation failed: node-pty module not available';

      log('❌ [ERROR] Cannot create terminal:', errorMsg);
      showErrorMessage(errorMsg);
      return '';
    }

    const config = getTerminalConfig();
    log('🔧 [DEBUG] Terminal config:', config);

    if (this._terminals.size >= config.maxTerminals) {
      showWarningMessage(`${ERROR_MESSAGES.MAX_TERMINALS_REACHED} (${config.maxTerminals})`);
      return this._activeTerminalManager.getActive() || '';
    }

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

      const ptyProcess = this._pty.spawn(shell, shellArgs, {
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
        name: generateTerminalName(this._terminals.size + 1),
        isActive: true,
      };

      // Set all other terminals as inactive
      this._deactivateAllTerminals();

      this._terminals.set(terminalId, terminal);
      this._activeTerminalManager.setActive(terminalId);

      ptyProcess.onData((data: string) => {
        log('📤 [DEBUG] PTY data received:', data.length, 'chars for terminal:', terminalId);

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

      log('✅ [TERMINAL] Terminal created successfully with ID:', terminalId);
      log('📁 [TERMINAL] Expected working directory:', cwd);

      this._terminalCreatedEmitter.fire(terminal);
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
}
