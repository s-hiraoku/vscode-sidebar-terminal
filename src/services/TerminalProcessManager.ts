/**
 * Terminal Process Manager Service
 *
 * Responsible for PTY process lifecycle management:
 * - PTY creation and configuration
 * - Process write operations
 * - Process resize operations
 * - Process termination
 * - Process state tracking
 * - Process recovery
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213
 */

import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import {
  ITerminalProcessManager,
  OperationResult,
  PtyCreationOptions,
} from '../interfaces/TerminalServices';
import { TerminalDimensions, ProcessState } from '../types/shared';
import { terminal as log } from '../utils/logger';

/**
 * Terminal Process Manager Implementation
 */
export class TerminalProcessManager implements ITerminalProcessManager {
  // PTY instance registry
  private readonly _ptyProcesses = new Map<string, IPty>();

  // Process state tracking
  private readonly _processStates = new Map<string, ProcessState>();

  // Track terminals being killed to prevent infinite loops
  private readonly _terminalsBeingKilled = new Set<string>();

  constructor() {
    log('🚀 [PROCESS-MGR] Terminal Process Manager initialized');
  }

  // =================== PTY Creation ===================

  /**
   * Create a new PTY process with the given options
   */
  async createPtyProcess(options: PtyCreationOptions): Promise<IPty> {
    log(
      `🔧 [PROCESS-MGR] Creating PTY process: shell=${options.shell}, cwd=${options.cwd}`
    );

    try {
      const ptyProcess = pty.spawn(options.shell, options.shellArgs, {
        name: 'xterm-256color',
        cols: options.cols,
        rows: options.rows,
        cwd: options.cwd,
        env: {
          ...options.env,
          // Ensure proper UTF-8 encoding
          LANG: options.env.LANG || 'en_US.UTF-8',
          LC_ALL: options.env.LC_ALL || 'en_US.UTF-8',
          LC_CTYPE: options.env.LC_CTYPE || 'en_US.UTF-8',
        },
      });

      log(`✅ [PROCESS-MGR] PTY process created successfully - PID: ${ptyProcess.pid}`);
      return ptyProcess;
    } catch (error) {
      log(`❌ [PROCESS-MGR] Failed to create PTY process: ${error}`);
      throw error;
    }
  }

  // =================== PTY Operations ===================

  /**
   * Write data to a PTY process
   */
  writeToPty(terminalId: string, data: string): OperationResult {
    const ptyProcess = this._ptyProcesses.get(terminalId);

    if (!ptyProcess) {
      log(`⚠️ [PROCESS-MGR] PTY not found for terminal: ${terminalId}`);
      return { success: false, error: 'PTY process not found' };
    }

    if (typeof ptyProcess.write !== 'function') {
      return { success: false, error: 'PTY instance missing write method' };
    }

    // Check if PTY process is still alive
    if (this.isPtyKilled(ptyProcess)) {
      return { success: false, error: 'PTY process has been killed' };
    }

    try {
      ptyProcess.write(data);
      log(`✅ [PROCESS-MGR] Successfully wrote ${data.length} chars to terminal ${terminalId}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [PROCESS-MGR] Write failed for ${terminalId}: ${errorMessage}`);
      return { success: false, error: `Write failed: ${errorMessage}` };
    }
  }

  /**
   * Resize a PTY process
   */
  resizePty(terminalId: string, dimensions: TerminalDimensions): OperationResult {
    const { cols, rows } = dimensions;

    // Validate dimensions
    if (cols <= 0 || rows <= 0) {
      return { success: false, error: `Invalid dimensions: ${cols}x${rows}` };
    }

    if (cols > 500 || rows > 200) {
      return { success: false, error: `Dimensions too large: ${cols}x${rows}` };
    }

    const ptyProcess = this._ptyProcesses.get(terminalId);

    if (!ptyProcess) {
      return { success: false, error: 'PTY process not found' };
    }

    if (typeof ptyProcess.resize !== 'function') {
      return { success: false, error: 'PTY instance missing resize method' };
    }

    // Check if PTY process is still alive
    if (this.isPtyKilled(ptyProcess)) {
      return { success: false, error: 'PTY process has been killed' };
    }

    try {
      ptyProcess.resize(cols, rows);
      log(`📏 [PROCESS-MGR] Terminal resized: ${terminalId} → ${cols}x${rows}`);

      // Force shell refresh after resize
      setTimeout(() => {
        try {
          if (ptyProcess.pid) {
            log(`🔄 [PROCESS-MGR] Sending refresh signal to process ${ptyProcess.pid}`);
            ptyProcess.write('\x0c'); // Form feed character to refresh display
          }
        } catch (refreshError) {
          log(`⚠️ [PROCESS-MGR] Failed to refresh shell for ${terminalId}:`, refreshError);
        }
      }, 50);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Resize failed: ${errorMessage}` };
    }
  }

  /**
   * Kill a PTY process
   */
  async killPty(terminalId: string): Promise<OperationResult> {
    const ptyProcess = this._ptyProcesses.get(terminalId);

    if (!ptyProcess) {
      return { success: false, error: 'PTY process not found' };
    }

    // Prevent duplicate kill operations
    if (this._terminalsBeingKilled.has(terminalId)) {
      return { success: false, error: 'PTY process is already being killed' };
    }

    try {
      this._terminalsBeingKilled.add(terminalId);
      log(`🔪 [PROCESS-MGR] Killing PTY process for terminal: ${terminalId}`);

      if (typeof ptyProcess.kill === 'function') {
        ptyProcess.kill();
      }

      // Wait briefly before cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.unregisterPty(terminalId);

      log(`✅ [PROCESS-MGR] PTY process killed successfully: ${terminalId}`);
      return { success: true };
    } catch (error) {
      log(`❌ [PROCESS-MGR] Failed to kill PTY process: ${error}`);
      this._terminalsBeingKilled.delete(terminalId);
      return { success: false, error: String(error) };
    }
  }

  // =================== PTY Registry ===================

  /**
   * Get PTY process for a terminal
   */
  getPty(terminalId: string): IPty | undefined {
    return this._ptyProcesses.get(terminalId);
  }

  /**
   * Check if PTY process is alive
   */
  isPtyAlive(terminalId: string): boolean {
    const ptyProcess = this._ptyProcesses.get(terminalId);
    if (!ptyProcess) {
      return false;
    }
    return !this.isPtyKilled(ptyProcess);
  }

  /**
   * Register a PTY process for a terminal
   */
  registerPty(terminalId: string, pty: IPty): void {
    this._ptyProcesses.set(terminalId, pty);
    this._processStates.set(terminalId, ProcessState.Launching);
    log(`📝 [PROCESS-MGR] PTY registered for terminal: ${terminalId}`);
  }

  /**
   * Unregister a PTY process
   */
  unregisterPty(terminalId: string): void {
    this._ptyProcesses.delete(terminalId);
    this._processStates.delete(terminalId);
    this._terminalsBeingKilled.delete(terminalId);
    log(`🗑️ [PROCESS-MGR] PTY unregistered for terminal: ${terminalId}`);
  }

  // =================== Process State Management ===================

  /**
   * Get process state for a terminal
   */
  getProcessState(terminalId: string): ProcessState | undefined {
    return this._processStates.get(terminalId);
  }

  /**
   * Set process state for a terminal
   */
  setProcessState(terminalId: string, state: ProcessState): void {
    const previousState = this._processStates.get(terminalId);
    this._processStates.set(terminalId, state);

    log(
      `🔄 [PROCESS-MGR] Terminal ${terminalId} state change: ${previousState !== undefined ? ProcessState[previousState] : 'undefined'} → ${ProcessState[state]}`
    );
  }

  // =================== Process Recovery ===================

  /**
   * Attempt to recover a failed PTY process
   */
  async attemptPtyRecovery(terminalId: string, data: string): Promise<OperationResult> {
    log(`🔄 [PROCESS-MGR] Attempting PTY recovery for terminal: ${terminalId}`);

    const ptyProcess = this._ptyProcesses.get(terminalId);
    if (!ptyProcess) {
      return { success: false, error: 'PTY process not found for recovery' };
    }

    // Try to write the data again
    try {
      ptyProcess.write(data);
      log(`✅ [PROCESS-MGR] PTY write recovered successfully`);
      return { success: true };
    } catch (recoveryError) {
      log(`❌ [PROCESS-MGR] PTY recovery failed: ${recoveryError}`);
      return { success: false, error: String(recoveryError) };
    }
  }

  // =================== Helpers ===================

  /**
   * Check if PTY process has been killed
   */
  private isPtyKilled(ptyProcess: IPty): boolean {
    // Type assertion for node-pty implementation details
    const ptyAny = ptyProcess as any;
    return ptyAny.killed === true;
  }

  // =================== Disposal ===================

  /**
   * Dispose all PTY processes
   */
  dispose(): void {
    log('🗑️ [PROCESS-MGR] Disposing all PTY processes...');

    // Kill all PTY processes
    for (const [terminalId, ptyProcess] of this._ptyProcesses.entries()) {
      try {
        if (typeof ptyProcess.kill === 'function') {
          ptyProcess.kill();
        }
        log(`🔪 [PROCESS-MGR] Killed PTY process: ${terminalId}`);
      } catch (error) {
        log(`❌ [PROCESS-MGR] Error killing PTY process ${terminalId}: ${error}`);
      }
    }

    // Clear all data structures
    this._ptyProcesses.clear();
    this._processStates.clear();
    this._terminalsBeingKilled.clear();

    log('✅ [PROCESS-MGR] Terminal Process Manager disposed');
  }
}
