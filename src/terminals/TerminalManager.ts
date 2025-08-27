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
import { ShellIntegrationService } from '../services/ShellIntegrationService';
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
  private _shellIntegrationService: ShellIntegrationService | null = null;
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

    // 🚨 FIX: Start heartbeat mechanism for state validation
    this._cliAgentService.startHeartbeat();
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
    
    // Force debug the actual terminal state before validation
    log('🔍 [TERMINAL] Current terminals in map:', this._terminals.size);
    for (const [id, terminal] of this._terminals.entries()) {
      log(`🔍 [TERMINAL] Map entry: ${id} -> ${terminal.name} (number: ${terminal.number})`);
    }
    
    // 🚨 CRITICAL DEBUG: Detailed canCreate analysis
    log('🔍 [TERMINAL] === DETAILED canCreate() ANALYSIS ===');
    log('🔍 [TERMINAL] this._terminals.size:', this._terminals.size);
    log('🔍 [TERMINAL] config.maxTerminals:', config.maxTerminals);
    
    // Call canCreate and get detailed information
    const canCreateResult = this._terminalNumberManager.canCreate(this._terminals);
    log('🔍 [TERMINAL] canCreate() returned:', canCreateResult);
    
    if (!canCreateResult) {
      log('🚨 [TERMINAL] Cannot create terminal: all slots used');
      log('🚨 [TERMINAL] Final canCreate check failed - investigating...');
      
      // Force re-check the numbers manually
      const usedNumbers = new Set<number>();
      log('🚨 [TERMINAL] Analyzing each terminal in map:');
      for (const [id, terminal] of this._terminals.entries()) {
        log(`🚨 [TERMINAL] Terminal ${id}:`, {
          name: terminal.name,
          number: terminal.number,
          hasValidNumber: typeof terminal.number === 'number' && !isNaN(terminal.number)
        });
        
        if (terminal.number && typeof terminal.number === 'number') {
          usedNumbers.add(terminal.number);
        }
      }
      log('🚨 [TERMINAL] Used numbers from current terminals:', Array.from(usedNumbers));
      log('🚨 [TERMINAL] Available slots should be:', Array.from({length: config.maxTerminals}, (_, i) => i + 1).filter(n => !usedNumbers.has(n)));
      
      // 🚨 CRITICAL: If terminals map is empty but canCreate returns false, there's a bug
      if (this._terminals.size === 0) {
        log('🚨🚨🚨 [TERMINAL] CRITICAL BUG: No terminals exist but canCreate returned FALSE!');
        log('🚨🚨🚨 [TERMINAL] This should NEVER happen - forcing creation');
        // Don't return early - continue with creation
      } else {
        showWarningMessage(`${ERROR_MESSAGES.MAX_TERMINALS_REACHED} (${config.maxTerminals})`);
        return this._activeTerminalManager.getActive() || '';
      }
    } else {
      log('✅ [TERMINAL] canCreate() returned TRUE - proceeding with creation');
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
          // TEMPORARY: Remove PS1 override to debug input issue
          // PS1: env.PS1 || '\\u@\\h:\\w\\$ ',
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
        // 🔍 DEBUGGING: Log all PTY data to identify shell prompt issues
        log(
          `📤 [PTY-DATA] Terminal ${terminalId} received ${data.length} chars:`,
          JSON.stringify(data.substring(0, 100))
        );

        // Process shell integration sequences if service is available
        try {
          if (this._shellIntegrationService) {
            this._shellIntegrationService.processTerminalData(terminalId, data);
          }
        } catch (error) {
          log(`⚠️ [TERMINAL] Shell integration processing error: ${error}`);
        }

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

      // Initialize terminal with minimal shell interaction
      setTimeout(() => {
        try {
          log(`🔍 [TERMINAL] Initializing shell for: ${terminalId}`);
          
          // Inject shell integration if service is available
          // TEMPORARY: Disable shell integration to debug input issue
          // try {
          //   if (this._shellIntegrationService) {
          //     log(`🔧 [TERMINAL] Injecting shell integration for: ${terminalId}`);
          //     this._shellIntegrationService.injectShellIntegration(terminalId, shell, ptyProcess);
          //   }
          // } catch (error) {
          //   log(`⚠️ [TERMINAL] Shell integration injection error: ${error}`);
          // }
          
          // Send only a single carriage return to trigger initial prompt
          ptyProcess.write('\r');
        } catch (error) {
          log(`⚠️ [TERMINAL] Failed to initialize shell for ${terminalId}:`, error);
        }
      }, 300); // 300ms delay to let shell initialize

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
    // ✅ CRITICAL FIX: Robust terminal ID resolution with complete validation
    let resolvedTerminalId: string;

    if (terminalId) {
      // Use provided terminal ID, but validate it exists and is active
      if (!this._terminals.has(terminalId)) {
        console.error(`🚨 [TERMINAL] Provided terminal ID does not exist: ${terminalId}`);
        console.log('🔍 [TERMINAL] Available terminals:', Array.from(this._terminals.keys()));

        // Fallback to active terminal
        const activeId = this._activeTerminalManager.getActive();
        if (!activeId) {
          console.error('🚨 [TERMINAL] No active terminal available as fallback');
          return;
        }
        resolvedTerminalId = activeId;
        console.warn(`⚠️ [TERMINAL] Using active terminal as fallback: ${resolvedTerminalId}`);
      } else {
        resolvedTerminalId = terminalId;
      }
    } else {
      // Get currently active terminal
      const activeId = this._activeTerminalManager.getActive();
      if (!activeId) {
        console.error('🚨 [TERMINAL] No active terminal ID available');
        console.log('🔍 [TERMINAL] Available terminals:', Array.from(this._terminals.keys()));
        return;
      }

      // Validate the active terminal still exists
      if (!this._terminals.has(activeId)) {
        console.error(`🚨 [TERMINAL] Active terminal ID ${activeId} no longer exists`);

        // Emergency: Find first available terminal
        const availableTerminals = Array.from(this._terminals.keys());
        if (availableTerminals.length === 0) {
          console.error('🚨 [TERMINAL] No terminals available at all');
          return;
        }

        const emergencyTerminal = availableTerminals[0];
        if (!emergencyTerminal) {
          console.error('🚨 [TERMINAL] Emergency terminal is undefined');
          return;
        }
        this._activeTerminalManager.setActive(emergencyTerminal);
        resolvedTerminalId = emergencyTerminal;
        console.warn(
          `⚠️ [TERMINAL] Emergency fallback to first available terminal: ${resolvedTerminalId}`
        );
      } else {
        resolvedTerminalId = activeId;
      }
    }

    // ✅ FINAL VALIDATION: Ensure terminal exists and get instance
    const terminal = this._terminals.get(resolvedTerminalId);
    if (!terminal) {
      console.error(`🚨 [TERMINAL] Terminal resolution failed for ID: ${resolvedTerminalId}`);
      return;
    }

    console.log(
      `⌨️ [TERMINAL] Sending input to ${terminal.name} (${resolvedTerminalId}): ${data.length} chars`
    );

    try {
      // CLI Agent コマンドを検出
      this._cliAgentService.detectFromInput(resolvedTerminalId, data);

      // ✅ ENHANCED: Robust PTY writing with comprehensive validation
      const result = this._writeToPtyWithValidation(terminal, data);
      if (!result.success) {
        console.error(`🚨 [TERMINAL] PTY write failed for ${terminal.name}: ${result.error}`);

        // Attempt recovery with alternative PTY instance
        console.log(`🔄 [TERMINAL] Attempting PTY recovery for ${terminal.name}...`);
        const recovered = this._attemptPtyRecovery(terminal, data);
        if (!recovered) {
          throw new Error(result.error || 'PTY write failed and recovery unsuccessful');
        }
        console.log(`✅ [TERMINAL] PTY recovery successful for ${terminal.name}`);
      } else {
        console.log(`✅ [TERMINAL] Input sent successfully to ${terminal.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `❌ [TERMINAL] Critical error sending input to ${terminal.name}:`,
        errorMessage
      );

      // Enhanced error logging with complete terminal state
      console.error('❌ [TERMINAL] Terminal state at failure:', {
        id: terminal.id,
        name: terminal.name,
        number: terminal.number,
        isActive: terminal.isActive,
        hasPty: !!terminal.pty,
        hasPtyProcess: !!terminal.ptyProcess,
        ptyType: terminal.pty ? typeof terminal.pty : 'undefined',
        ptyProcessType: terminal.ptyProcess ? typeof terminal.ptyProcess : 'undefined',
        ptyWritable: terminal.pty ? typeof terminal.pty.write : 'no pty',
        ptyProcessWritable:
          terminal.ptyProcess &&
          typeof terminal.ptyProcess === 'object' &&
          'write' in terminal.ptyProcess
            ? typeof (terminal.ptyProcess as any).write
            : 'no ptyProcess',
        createdAt: terminal.createdAt,
        cwd: terminal.cwd,
      });

      showErrorMessage(`Terminal input failed for ${terminal.name}: ${errorMessage}`, error);
    }
  }

  public resize(cols: number, rows: number, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();
    if (!id) {
      console.warn('⚠️ [WARN] No terminal ID provided and no active terminal for resize');
      return;
    }

    const terminal = this._terminals.get(id);
    if (!terminal) {
      console.warn('⚠️ [WARN] Terminal not found for resize:', id);
      return;
    }

    try {
      // Enhanced PTY resize with validation
      const result = this._resizePtyWithValidation(terminal, cols, rows);
      if (!result.success) {
        throw new Error(result.error || 'PTY resize failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [ERROR] Failed to resize terminal:', errorMessage);
      console.error('❌ [ERROR] Resize parameters:', { cols, rows, terminalId: id });
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

  /**
   * Set shell integration service after construction
   */
  public setShellIntegrationService(service: any): void {
    this._shellIntegrationService = service;
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
    // ✅ CRITICAL FIX: Strict terminal ID validation to prevent cross-terminal contamination
    if (!terminalId || typeof terminalId !== 'string') {
      console.error('🚨 [TERMINAL] Invalid terminalId for data buffering:', terminalId);
      return;
    }

    // Validate terminal exists before buffering data
    if (!this._terminals.has(terminalId)) {
      console.warn(
        `⚠️ [TERMINAL] Attempting to buffer data for non-existent terminal: ${terminalId}`
      );
      return;
    }

    if (!this._dataBuffers.has(terminalId)) {
      this._dataBuffers.set(terminalId, []);
      console.log(`📊 [TERMINAL] Created new data buffer for terminal: ${terminalId}`);
    }

    const buffer = this._dataBuffers.get(terminalId);
    if (!buffer) {
      console.error('🚨 [TERMINAL] Buffer creation failed for terminal:', terminalId);
      this._dataBuffers.set(terminalId, []);
      return;
    }

    // ✅ CRITICAL: Add terminal ID validation to each data chunk
    const validatedData = this._validateDataForTerminal(terminalId, data);
    buffer.push(validatedData);

    console.log(
      `📊 [TERMINAL] Data buffered for ${terminalId}: ${data.length} chars (buffer size: ${buffer.length})`
    );

    // Flush immediately if buffer is full or data is large
    if (buffer.length >= this.MAX_BUFFER_SIZE || data.length > 1000) {
      this._flushBuffer(terminalId);
    } else {
      this._scheduleFlush(terminalId);
    }
  }

  /**
   * ✅ NEW: Validate data belongs to specific terminal
   * Prevents cross-terminal data contamination
   */
  private _validateDataForTerminal(terminalId: string, data: string): string {
    // Basic validation - could be enhanced with more sophisticated checks
    if (data.includes('\x1b]0;') && !data.includes(terminalId)) {
      // Window title escape sequences might contain terminal context
      console.log(`🔍 [TERMINAL] Window title detected for ${terminalId}`);
    }

    // Return data as-is for now, but this method provides a hook for future validation
    return data;
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
    // ✅ CRITICAL FIX: Strict terminal ID validation before flushing
    if (!terminalId || typeof terminalId !== 'string') {
      console.error('🚨 [TERMINAL] Invalid terminalId for buffer flushing:', terminalId);
      return;
    }

    // Double-check terminal still exists
    if (!this._terminals.has(terminalId)) {
      console.warn(`⚠️ [TERMINAL] Cannot flush buffer for removed terminal: ${terminalId}`);
      // Clean up orphaned buffer and timer
      this._dataBuffers.delete(terminalId);
      const timer = this._dataFlushTimers.get(terminalId);
      if (timer) {
        clearTimeout(timer);
        this._dataFlushTimers.delete(terminalId);
      }
      return;
    }

    const timer = this._dataFlushTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this._dataFlushTimers.delete(terminalId);
    }

    const buffer = this._dataBuffers.get(terminalId);
    if (buffer && buffer.length > 0) {
      const combinedData = buffer.join('');
      buffer.length = 0; // Clear buffer

      // ✅ CRITICAL: Additional validation before emitting data
      const terminal = this._terminals.get(terminalId);
      if (!terminal) {
        console.error(`🚨 [TERMINAL] Terminal disappeared during flush: ${terminalId}`);
        return;
      }

      // Send to CLI Agent detection service with validation
      try {
        this._cliAgentService.detectFromOutput(terminalId, combinedData);
      } catch (error) {
        console.warn(`⚠️ [TERMINAL] CLI Agent detection failed for ${terminalId}:`, error);
      }

      // ✅ EMIT DATA WITH STRICT TERMINAL ID ASSOCIATION
      console.log(
        `📤 [TERMINAL] Flushing data for terminal ${terminal.name} (${terminalId}): ${combinedData.length} chars`
      );
      this._dataEmitter.fire({
        terminalId: terminalId, // Ensure exact ID match
        data: combinedData,
        timestamp: Date.now(), // Add timestamp for debugging
        terminalName: terminal.name, // Add terminal name for validation
      });
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
    log('🧹 [TERMINAL] === CLEANUP TERMINAL DATA START ===');
    log('🧹 [TERMINAL] Cleaning up terminal data:', terminalId);
    
    // Log terminal info before deletion
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      log('🧹 [TERMINAL] Deleting terminal:', {
        id: terminalId,
        name: terminal.name,
        number: terminal.number,
        exists: this._terminals.has(terminalId)
      });
    } else {
      log('⚠️ [TERMINAL] Terminal not found in map for cleanup:', terminalId);
    }
    
    log('🧹 [TERMINAL] Before deletion - terminals count:', this._terminals.size);
    log('🧹 [TERMINAL] Before deletion - terminal IDs:', Array.from(this._terminals.keys()));
    
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
    const deletionResult = this._terminals.delete(terminalId);
    log('🧹 [TERMINAL] Terminal deletion from map:', deletionResult ? 'SUCCESS' : 'FAILED');
    
    log('🧹 [TERMINAL] After deletion - terminals count:', this._terminals.size);
    log('🧹 [TERMINAL] After deletion - terminal IDs:', Array.from(this._terminals.keys()));

    this._terminalRemovedEmitter.fire(terminalId);

    log('🧹 [TERMINAL] Terminal data cleaned up:', terminalId);
    log('🧹 [TERMINAL] Remaining terminals:', Array.from(this._terminals.keys()));
    log('🧹 [TERMINAL] Remaining terminal numbers:', Array.from(this._terminals.values()).map(t => ({ id: t.id, number: t.number })));

    // Force check if terminals map is actually empty and can create should return true
    if (this._terminals.size === 0) {
      log('✅ [TERMINAL] All terminals deleted - canCreate should return TRUE');
    }

    // アクティブターミナルだった場合、別のターミナルをアクティブにする
    this._updateActiveTerminalAfterRemoval(terminalId);
    
    // Force state notification update
    log('🧹 [TERMINAL] Notifying state update after cleanup...');
    this._notifyStateUpdate();
    log('🧹 [TERMINAL] === CLEANUP TERMINAL DATA END ===');
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
   * 🚨 NEW: Refresh CLI Agent state (fallback for file reference issues)
   */
  public refreshCliAgentState(): boolean {
    return this._cliAgentService.refreshAgentState();
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
    return agentState.agentType;
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

  /**
   * Write to PTY with validation and error handling
   */
  private _writeToPtyWithValidation(
    terminal: TerminalInstance,
    data: string
  ): { success: boolean; error?: string } {
    // Prefer ptyProcess over pty for consistency
    const ptyInstance = terminal.ptyProcess || terminal.pty;

    // Comprehensive validation
    if (!ptyInstance) {
      return { success: false, error: 'No PTY instance available' };
    }

    if (typeof ptyInstance.write !== 'function') {
      return { success: false, error: 'PTY instance missing write method' };
    }

    // Check if PTY process is still alive
    if (
      terminal.ptyProcess &&
      typeof terminal.ptyProcess === 'object' &&
      'killed' in terminal.ptyProcess &&
      (terminal.ptyProcess as any).killed
    ) {
      return { success: false, error: 'PTY process has been killed' };
    }

    try {
      ptyInstance.write(data);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Write failed: ${errorMessage}` };
    }
  }

  /**
   * Attempt to recover from PTY write failure
   */
  private _attemptPtyRecovery(terminal: TerminalInstance, data: string): boolean {
    console.warn('⚠️ [RECOVERY] Attempting PTY recovery for terminal:', terminal.id);

    // Try alternative PTY instance if available
    const alternatives = [terminal.ptyProcess, terminal.pty].filter(Boolean);

    for (const ptyInstance of alternatives) {
      if (ptyInstance && typeof ptyInstance.write === 'function') {
        try {
          // Double-check that this instance wasn't already tried
          if (ptyInstance === (terminal.ptyProcess || terminal.pty)) {
            continue; // Skip the same instance that already failed
          }

          ptyInstance.write(data);
          console.log('✅ [RECOVERY] PTY write recovered using alternative instance');

          // Update the terminal to use the working instance
          if (ptyInstance === terminal.pty) {
            terminal.ptyProcess = undefined; // Clear the failing instance
          }

          return true;
        } catch (recoveryError) {
          console.warn('⚠️ [RECOVERY] Alternative PTY instance also failed:', recoveryError);
        }
      }
    }

    // If all alternatives failed, log the failure
    console.error('❌ [RECOVERY] All PTY recovery attempts failed for terminal:', terminal.id);
    return false;
  }

  /**
   * Resize PTY with validation and error handling
   */
  private _resizePtyWithValidation(
    terminal: TerminalInstance,
    cols: number,
    rows: number
  ): { success: boolean; error?: string } {
    // Validate dimensions first
    if (cols <= 0 || rows <= 0) {
      return { success: false, error: `Invalid dimensions: ${cols}x${rows}` };
    }

    if (cols > 500 || rows > 200) {
      return { success: false, error: `Dimensions too large: ${cols}x${rows}` };
    }

    // Get PTY instance
    const ptyInstance = terminal.ptyProcess || terminal.pty;

    if (!ptyInstance) {
      return { success: false, error: 'No PTY instance available' };
    }

    if (typeof ptyInstance.resize !== 'function') {
      return { success: false, error: 'PTY instance missing resize method' };
    }

    // Check if PTY process is still alive
    if (
      terminal.ptyProcess &&
      typeof terminal.ptyProcess === 'object' &&
      'killed' in terminal.ptyProcess &&
      (terminal.ptyProcess as any).killed
    ) {
      return { success: false, error: 'PTY process has been killed' };
    }

    try {
      ptyInstance.resize(cols, rows);
      log(`📏 [TERMINAL] Terminal resized: ${terminal.name} → ${cols}x${rows}`);

      // VS Code pattern: Force shell refresh after resize
      setTimeout(() => {
        try {
          // Send SIGWINCH signal to shell process to trigger prompt refresh
          if (ptyInstance.pid) {
            log(`🔄 [TERMINAL] Sending refresh signal to process ${ptyInstance.pid}`);
            ptyInstance.write('\x0c'); // Form feed character to refresh display
          }
        } catch (refreshError) {
          log(`⚠️ [TERMINAL] Failed to refresh shell for ${terminal.name}:`, refreshError);
        }
      }, 50);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Resize failed: ${errorMessage}` };
    }
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
  public get onStateUpdate(): vscode.Event<unknown> {
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

  public safeKillTerminal(_terminalId?: string): boolean {
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
    return agentState.agentType;
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
