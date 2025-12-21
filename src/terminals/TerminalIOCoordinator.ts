/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { TerminalInstance, TerminalInfo } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { showErrorMessage, ActiveTerminalManager } from '../utils/common';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';

const ENABLE_TERMINAL_DEBUG_LOGS = process.env.SECONDARY_TERMINAL_DEBUG_LOGS === 'true';

/**
 * TerminalIOCoordinator
 *
 * Responsibility: Handle terminal input/output operations
 * - Send input to terminals
 * - Resize terminal dimensions
 * - PTY write validation and recovery
 * - Terminal information retrieval
 *
 * Single Responsibility Principle: Focused on I/O operations only
 */
export class TerminalIOCoordinator {
  private readonly _debugLoggingEnabled = ENABLE_TERMINAL_DEBUG_LOGS;

  constructor(
    private readonly _terminals: Map<string, TerminalInstance>,
    private readonly _activeTerminalManager: ActiveTerminalManager,
    private readonly _cliAgentService: ICliAgentDetectionService
  ) {}

  private debugLog(...args: unknown[]): void {
    if (this._debugLoggingEnabled) {
      log(...args);
    }
  }

  /**
   * Send input to a terminal
   */
  public sendInput(data: string, terminalId?: string): void {
    // ✅ CRITICAL FIX: Robust terminal ID resolution with complete validation
    let resolvedTerminalId: string;

    if (terminalId) {
      // Use provided terminal ID, but validate it exists and is active
      if (!this._terminals.has(terminalId)) {
        log(`🚨 [TERMINAL] Provided terminal ID does not exist: ${terminalId}`);
        this.debugLog('🔍 [TERMINAL] Available terminals:', Array.from(this._terminals.keys()));

        // Fallback to active terminal
        const activeId = this._activeTerminalManager.getActive();
        if (!activeId) {
          log('🚨 [TERMINAL] No active terminal available as fallback');
          return;
        }
        resolvedTerminalId = activeId;
        log(`⚠️ [TERMINAL] Using active terminal as fallback: ${resolvedTerminalId}`);
      } else {
        resolvedTerminalId = terminalId;
      }
    } else {
      // Get currently active terminal
      const activeId = this._activeTerminalManager.getActive();
      if (!activeId) {
        log('🚨 [TERMINAL] No active terminal ID available');
        this.debugLog('🔍 [TERMINAL] Available terminals:', Array.from(this._terminals.keys()));
        return;
      }

      // Validate the active terminal still exists
      if (!this._terminals.has(activeId)) {
        log(`🚨 [TERMINAL] Active terminal ID ${activeId} no longer exists`);

        // Emergency: Find first available terminal
        const availableTerminals = Array.from(this._terminals.keys());
        if (availableTerminals.length === 0) {
          log('🚨 [TERMINAL] No terminals available at all');
          return;
        }

        const emergencyTerminal = availableTerminals[0];
        if (!emergencyTerminal) {
          log('🚨 [TERMINAL] Emergency terminal is undefined');
          return;
        }
        this._activeTerminalManager.setActive(emergencyTerminal);
        resolvedTerminalId = emergencyTerminal;
        log(`⚠️ [TERMINAL] Emergency fallback to first available terminal: ${resolvedTerminalId}`);
      } else {
        resolvedTerminalId = activeId;
      }
    }

    // ✅ FINAL VALIDATION: Ensure terminal exists and get instance
    const terminal = this._terminals.get(resolvedTerminalId);
    if (!terminal) {
      log(`🚨 [TERMINAL] Terminal resolution failed for ID: ${resolvedTerminalId}`);
      return;
    }

    this.debugLog(
      `⌨️ [TERMINAL] Sending input to ${terminal.name} (${resolvedTerminalId}): ${data.length} chars`
    );

    try {
      // CLI Agent コマンドを検出
      this._cliAgentService.detectFromInput(resolvedTerminalId, data);

      // ✅ ENHANCED: Robust PTY writing with comprehensive validation
      const result = this.writeToPtyWithValidation(terminal, data);
      if (!result.success) {
        log(`🚨 [TERMINAL] PTY write failed for ${terminal.name}: ${result.error}`);

        // Attempt recovery with alternative PTY instance
        this.debugLog(`🔄 [TERMINAL] Attempting PTY recovery for ${terminal.name}...`);
        const recovered = this.attemptPtyRecovery(terminal, data);
        if (!recovered) {
          throw new Error(result.error || 'PTY write failed and recovery unsuccessful');
        }
        this.debugLog(`✅ [TERMINAL] PTY recovery successful for ${terminal.name}`);
      } else {
        this.debugLog(`✅ [TERMINAL] Input sent successfully to ${terminal.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [TERMINAL] Critical error sending input to ${terminal.name}:`, errorMessage);

      // Enhanced error logging with complete terminal state
      log('❌ [TERMINAL] Terminal state at failure:', {
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
            ? typeof (terminal.ptyProcess as { write: unknown }).write
            : 'no ptyProcess',
        createdAt: terminal.createdAt,
        cwd: terminal.cwd,
      });

      showErrorMessage(
        `Terminal input failed for ${terminal.name}: ${errorMessage}`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Resize a terminal
   */
  public resize(cols: number, rows: number, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();
    if (!id) {
      log('⚠️ [WARN] No terminal ID provided and no active terminal for resize');
      return;
    }

    const terminal = this._terminals.get(id);
    if (!terminal) {
      log('⚠️ [WARN] Terminal not found for resize:', id);
      return;
    }

    try {
      // Enhanced PTY resize with validation
      const result = this.resizePtyWithValidation(terminal, cols, rows);
      if (!result.success) {
        throw new Error(result.error || 'PTY resize failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('❌ [ERROR] Failed to resize terminal:', errorMessage);
      log('❌ [ERROR] Resize parameters:', { cols, rows, terminalId: id });
    }
  }

  /**
   * Get terminal information
   */
  public getTerminalInfo(terminalId: string): TerminalInfo | undefined {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return undefined;
    }

    return {
      id: terminal.id,
      name: terminal.name,
      isActive: terminal.isActive,
    };
  }

  /**
   * Write to terminal (public API)
   */
  public writeToTerminal(terminalId: string, data: string): boolean {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log(`❌ [TERMINAL] Cannot write to terminal ${terminalId}: not found`);
      return false;
    }

    try {
      // 🔧 FIX: Get PTY instance with null check
      const ptyInstance = terminal.ptyProcess || terminal.pty;

      // 🔧 FIX: Add explicit null check for ptyInstance
      if (!ptyInstance) {
        log(`❌ [TERMINAL] Cannot write to terminal ${terminalId}: no PTY instance`);
        return false;
      }

      // 🔧 FIX: Check if write method exists before calling
      if (typeof ptyInstance.write !== 'function') {
        log(`❌ [TERMINAL] Cannot write to terminal ${terminalId}: PTY missing write method`);
        return false;
      }

      ptyInstance.write(data);
      log(`✍️ [TERMINAL] Data written to terminal ${terminalId}: ${data.length} bytes`);
      return true;
    } catch (error) {
      log(`❌ [TERMINAL] Failed to write to terminal ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * Resize terminal (public API)
   */
  public resizeTerminal(terminalId: string, cols: number, rows: number): boolean {
    try {
      this.resize(cols, rows, terminalId);
      return true;
    } catch {
      return false;
    }
  }

  // 🔧 FIX: Max retry attempts for PTY write operations
  private static readonly MAX_PTY_RETRY_ATTEMPTS = 3;
  private static readonly PTY_RETRY_DELAY_MS = 300;

  /**
   * Write to PTY with validation and error handling
   * 🔧 FIX: Enhanced retry mechanism with configurable attempts
   */
  private writeToPtyWithValidation(
    terminal: TerminalInstance,
    data: string,
    retryAttempt: number = 0
  ): { success: boolean; error?: string } {
    // 🛡️ PTY READINESS CHECK: Handle case where PTY is not yet ready
    const ptyInstance = terminal.ptyProcess || terminal.pty;

    if (!ptyInstance) {
      // 🔧 FIX: Check if we've exceeded max retries
      if (retryAttempt >= TerminalIOCoordinator.MAX_PTY_RETRY_ATTEMPTS) {
        log(
          `❌ [PTY-TIMEOUT] PTY not ready for terminal ${terminal.id} after ${retryAttempt} attempts`
        );
        return { success: false, error: `PTY not ready after ${retryAttempt} retry attempts` };
      }

      log(
        `⏳ [PTY-WAIT] PTY not ready for terminal ${terminal.id}, queuing input (attempt ${retryAttempt + 1}/${TerminalIOCoordinator.MAX_PTY_RETRY_ATTEMPTS})...`
      );

      // 🔧 FIX: Queue the input and try again with exponential backoff
      const delay = TerminalIOCoordinator.PTY_RETRY_DELAY_MS * Math.pow(1.5, retryAttempt);
      setTimeout(() => {
        const updatedTerminal = this._terminals.get(terminal.id);
        if (updatedTerminal && (updatedTerminal.ptyProcess || updatedTerminal.pty)) {
          log(`🔄 [PTY-RETRY] Retrying input for terminal ${terminal.id} (attempt ${retryAttempt + 1})`);
          this.writeToPtyWithValidation(updatedTerminal, data, retryAttempt + 1);
        } else {
          // 🔧 FIX: Recursively retry with incremented attempt counter
          this.writeToPtyWithValidation(updatedTerminal || terminal, data, retryAttempt + 1);
        }
      }, delay);

      return { success: false, error: 'PTY not ready, input queued for retry' };
    }

    if (typeof ptyInstance.write !== 'function') {
      return { success: false, error: 'PTY instance missing write method' };
    }

    // Check if PTY process is still alive
    if (
      terminal.ptyProcess &&
      typeof terminal.ptyProcess === 'object' &&
      'killed' in terminal.ptyProcess &&
      (terminal.ptyProcess as { killed: boolean }).killed
    ) {
      return { success: false, error: 'PTY process has been killed' };
    }

    try {
      ptyInstance.write(data);
      log(`✅ [PTY-WRITE] Successfully wrote ${data.length} chars to terminal ${terminal.id}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Write failed: ${errorMessage}` };
    }
  }

  /**
   * Attempt to recover from PTY write failure
   */
  private attemptPtyRecovery(terminal: TerminalInstance, data: string): boolean {
    log('⚠️ [RECOVERY] Attempting PTY recovery for terminal:', terminal.id);

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
          this.debugLog('✅ [RECOVERY] PTY write recovered using alternative instance');

          // Update the terminal to use the working instance
          if (ptyInstance === terminal.pty) {
            terminal.ptyProcess = undefined; // Clear the failing instance
          }

          return true;
        } catch (recoveryError) {
          log('⚠️ [RECOVERY] Alternative PTY instance also failed:', recoveryError);
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
  private resizePtyWithValidation(
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

    // 🔧 FIX: Add explicit null check for ptyInstance
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
      (terminal.ptyProcess as { killed: boolean }).killed
    ) {
      return { success: false, error: 'PTY process has been killed' };
    }

    try {
      ptyInstance.resize(cols, rows);
      log(`📏 [TERMINAL] Terminal resized: ${terminal.name} → ${cols}x${rows}`);

      // Note: SIGWINCH is automatically sent by PTY on resize
      // Removed \x0c (form feed) as it causes ^L to be displayed on some shells
      log(`📏 [TERMINAL] Resize complete for ${terminal.name}, SIGWINCH sent by PTY`);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Resize failed: ${errorMessage}` };
    }
  }
}
