import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { TerminalInstance } from '../types/shared';
import { OperationResult, OperationResultHandler } from '../utils/OperationResultHandler';

export interface ITerminalProcessManager {
  writeToPty(terminal: TerminalInstance, data: string): OperationResult<void>;
  resizePty(terminal: TerminalInstance, cols: number, rows: number): OperationResult<void>;
  killPty(terminal: TerminalInstance): OperationResult<void>;
  isPtyAlive(terminal: TerminalInstance): boolean;
  retryWrite(
    terminal: TerminalInstance,
    data: string,
    maxRetries?: number
  ): Promise<OperationResult<void>>;
  attemptRecovery(terminal: TerminalInstance): OperationResult<void>;
}

/** Handles PTY process operations: read/write, resize, and lifecycle management */
export class TerminalProcessManager implements ITerminalProcessManager {
  private readonly WRITE_RETRY_DELAY_MS = 500;
  private readonly DEFAULT_MAX_RETRIES = 3;

  writeToPty(terminal: TerminalInstance, data: string): OperationResult<void> {
    const ptyInstance = this.getPtyInstance(terminal);

    if (!ptyInstance) {
      return OperationResultHandler.failure('PTY not ready');
    }

    if (!this.validatePtyWrite(ptyInstance)) {
      return OperationResultHandler.failure('PTY instance missing write method or process killed');
    }

    try {
      ptyInstance.write(data);
      return OperationResultHandler.success();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return OperationResultHandler.failure(`Write failed: ${errorMessage}`);
    }
  }

  resizePty(terminal: TerminalInstance, cols: number, rows: number): OperationResult<void> {
    const validation = this.validateDimensions(cols, rows);
    if (!validation.success) {
      return validation;
    }

    const ptyInstance = this.getPtyInstance(terminal);

    if (!ptyInstance) {
      return OperationResultHandler.failure('No PTY instance available');
    }

    if (typeof ptyInstance.resize !== 'function') {
      return OperationResultHandler.failure('PTY instance missing resize method');
    }

    if (!this.isPtyAlive(terminal)) {
      return OperationResultHandler.failure('PTY process has been killed');
    }

    try {
      ptyInstance.resize(cols, rows);
      return OperationResultHandler.success();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return OperationResultHandler.failure(`Resize failed: ${errorMessage}`);
    }
  }

  killPty(terminal: TerminalInstance): OperationResult<void> {
    const ptyInstance = this.getPtyInstance(terminal);

    if (!ptyInstance) {
      return OperationResultHandler.failure('No PTY instance to kill');
    }

    try {
      if (typeof ptyInstance.kill === 'function') {
        ptyInstance.kill();
        return OperationResultHandler.success();
      } else {
        return OperationResultHandler.failure('PTY instance missing kill method');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return OperationResultHandler.failure(`Kill failed: ${errorMessage}`);
    }
  }

  isPtyAlive(terminal: TerminalInstance): boolean {
    const ptyInstance = this.getPtyInstance(terminal);

    if (!ptyInstance) {
      return false;
    }

    if (
      terminal.ptyProcess &&
      typeof terminal.ptyProcess === 'object' &&
      'killed' in terminal.ptyProcess &&
      (terminal.ptyProcess as any).killed
    ) {
      return false;
    }

    return Boolean(ptyInstance.pid && ptyInstance.pid > 0);
  }

  async retryWrite(
    terminal: TerminalInstance,
    data: string,
    maxRetries: number = this.DEFAULT_MAX_RETRIES
  ): Promise<OperationResult<void>> {
    let lastError: string | Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = this.writeToPty(terminal, data);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      if (attempt < maxRetries - 1) {
        await this.delay(this.WRITE_RETRY_DELAY_MS);
        await this.waitForPtyReady(terminal, this.WRITE_RETRY_DELAY_MS);
      }
    }

    return OperationResultHandler.failure(
      `Write failed after ${maxRetries} attempts: ${lastError}`
    );
  }

  attemptRecovery(terminal: TerminalInstance): OperationResult<void> {
    const alternatives = [terminal.ptyProcess, terminal.pty].filter(Boolean);

    for (const ptyInstance of alternatives) {
      if (ptyInstance && typeof ptyInstance.write === 'function') {
        try {
          if (ptyInstance === (terminal.ptyProcess || terminal.pty)) {
            continue;
          }

          ptyInstance.write('');

          if (ptyInstance === terminal.pty) {
            terminal.ptyProcess = undefined;
          }

          return OperationResultHandler.success();
        } catch {
          // Alternative PTY instance also failed
        }
      }
    }

    return OperationResultHandler.failure('All recovery attempts failed');
  }

  private getPtyInstance(terminal: TerminalInstance): pty.IPty | undefined {
    return terminal.ptyProcess || terminal.pty;
  }

  private validatePtyWrite(ptyInstance: pty.IPty): boolean {
    if (typeof ptyInstance.write !== 'function') {
      return false;
    }

    if ('killed' in ptyInstance && (ptyInstance as any).killed) {
      return false;
    }

    return true;
  }

  private validateDimensions(cols: number, rows: number): OperationResult<void> {
    if (cols <= 0 || rows <= 0) {
      return OperationResultHandler.failure(`Invalid dimensions: ${cols}x${rows}`);
    }

    if (cols > 500 || rows > 200) {
      return OperationResultHandler.failure(`Dimensions too large: ${cols}x${rows}`);
    }

    return OperationResultHandler.success();
  }

  private async waitForPtyReady(terminal: TerminalInstance, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const ptyInstance = this.getPtyInstance(terminal);
      if (ptyInstance && this.validatePtyWrite(ptyInstance)) {
        return true;
      }
      await this.delay(100);
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
