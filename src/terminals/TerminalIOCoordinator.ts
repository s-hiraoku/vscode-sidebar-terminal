/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { TerminalInstance, TerminalInfo } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { ActiveTerminalManager } from '../utils/common';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';

const ENABLE_TERMINAL_DEBUG_LOGS = process.env.SECONDARY_TERMINAL_DEBUG_LOGS === 'true';

/** Handles terminal input/output operations */
export class TerminalIOCoordinator {
  private readonly _debugLoggingEnabled = ENABLE_TERMINAL_DEBUG_LOGS;
  private static readonly MAX_PTY_RETRY_ATTEMPTS = 3;
  private static readonly PTY_RETRY_DELAY_MS = 300;

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

  public sendInput(data: string, terminalId?: string): void {
    const resolvedTerminalId = this.resolveTerminalId(terminalId);
    if (!resolvedTerminalId) {
      return;
    }

    const terminal = this._terminals.get(resolvedTerminalId);
    if (!terminal) {
      return;
    }

    try {
      this._cliAgentService.detectFromInput(resolvedTerminalId, data);
      const result = this.writeToPtyWithValidation(terminal, data);
      if (!result.success && !this.attemptPtyRecovery(terminal, data)) {
        throw new Error(result.error || 'PTY write failed');
      }
    } catch (error) {
      log(`Error sending input to ${terminal.name}:`, error);
    }
  }

  private resolveTerminalId(terminalId?: string): string | undefined {
    if (terminalId && this._terminals.has(terminalId)) {
      return terminalId;
    }

    const activeId = this._activeTerminalManager.getActive();
    if (activeId && this._terminals.has(activeId)) {
      return activeId;
    }

    const availableTerminals = Array.from(this._terminals.keys());
    return availableTerminals[0];
  }

  public resize(cols: number, rows: number, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();
    if (!id) {
      return;
    }

    const terminal = this._terminals.get(id);
    if (!terminal) {
      return;
    }

    try {
      const result = this.resizePtyWithValidation(terminal, cols, rows);
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      log('Failed to resize terminal:', error);
    }
  }

  public getTerminalInfo(terminalId: string): TerminalInfo | undefined {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return undefined;
    }
    return { id: terminal.id, name: terminal.name, isActive: terminal.isActive };
  }

  public writeToTerminal(terminalId: string, data: string): boolean {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return false;
    }

    try {
      const ptyInstance = terminal.ptyProcess || terminal.pty;
      if (!ptyInstance || typeof ptyInstance.write !== 'function') {
        return false;
      }
      ptyInstance.write(data);
      return true;
    } catch {
      return false;
    }
  }

  public resizeTerminal(terminalId: string, cols: number, rows: number): boolean {
    try {
      this.resize(cols, rows, terminalId);
      return true;
    } catch {
      return false;
    }
  }

  private writeToPtyWithValidation(
    terminal: TerminalInstance,
    data: string,
    retryAttempt: number = 0
  ): { success: boolean; error?: string } {
    const ptyInstance = terminal.ptyProcess || terminal.pty;

    if (!ptyInstance) {
      if (retryAttempt >= TerminalIOCoordinator.MAX_PTY_RETRY_ATTEMPTS) {
        return { success: false, error: `PTY not ready after ${retryAttempt} retries` };
      }

      const delay = TerminalIOCoordinator.PTY_RETRY_DELAY_MS * Math.pow(1.5, retryAttempt);
      setTimeout(() => {
        const updatedTerminal = this._terminals.get(terminal.id);
        if (updatedTerminal) {
          this.writeToPtyWithValidation(updatedTerminal, data, retryAttempt + 1);
        }
      }, delay);

      return { success: false, error: 'PTY not ready, queued for retry' };
    }

    if (typeof ptyInstance.write !== 'function') {
      return { success: false, error: 'PTY missing write method' };
    }

    if (
      terminal.ptyProcess &&
      typeof terminal.ptyProcess === 'object' &&
      'killed' in terminal.ptyProcess &&
      (terminal.ptyProcess as { killed: boolean }).killed
    ) {
      return { success: false, error: 'PTY process killed' };
    }

    try {
      ptyInstance.write(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: `Write failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private attemptPtyRecovery(terminal: TerminalInstance, data: string): boolean {
    // Primary PTY is ptyProcess if available, otherwise pty
    const primary = terminal.ptyProcess;
    // Try alternative PTY instances (excluding the primary that already failed)
    const alternatives = [terminal.ptyProcess, terminal.pty].filter(
      (p): p is NonNullable<typeof p> => p != null && p !== primary
    );

    for (const ptyInstance of alternatives) {
      if (typeof ptyInstance.write === 'function') {
        try {
          ptyInstance.write(data);
          // If we succeeded with terminal.pty, clear the failed ptyProcess
          if (ptyInstance === terminal.pty) {
            terminal.ptyProcess = undefined;
          }
          return true;
        } catch {
          // Try next alternative
        }
      }
    }

    return false;
  }

  private resizePtyWithValidation(
    terminal: TerminalInstance,
    cols: number,
    rows: number
  ): { success: boolean; error?: string } {
    if (cols <= 0 || rows <= 0) {
      return { success: false, error: `Invalid dimensions: ${cols}x${rows}` };
    }

    if (cols > 500 || rows > 200) {
      return { success: false, error: `Dimensions too large: ${cols}x${rows}` };
    }

    const ptyInstance = terminal.ptyProcess || terminal.pty;
    if (!ptyInstance) {
      return { success: false, error: 'No PTY instance' };
    }

    if (typeof ptyInstance.resize !== 'function') {
      return { success: false, error: 'PTY missing resize method' };
    }

    if (
      terminal.ptyProcess &&
      typeof terminal.ptyProcess === 'object' &&
      'killed' in terminal.ptyProcess &&
      (terminal.ptyProcess as { killed: boolean }).killed
    ) {
      return { success: false, error: 'PTY process killed' };
    }

    try {
      ptyInstance.resize(cols, rows);
      return { success: true };
    } catch (error) {
      return { success: false, error: `Resize failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
