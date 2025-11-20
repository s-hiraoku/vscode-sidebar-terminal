/**
 * ターミナルプロセスマネージャーサービス
 *
 * PTY (Pseudo-Terminal) 操作を専門に扱います。
 * ターミナルプロセスへの読み書き、リサイズ、プロセス管理を担当します。
 */

import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { TerminalInstance } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { OperationResult, OperationResultHandler } from '../utils/OperationResultHandler';

export interface ITerminalProcessManager {
  /**
   * PTYにデータを書き込む
   */
  writeToPty(terminal: TerminalInstance, data: string): OperationResult<void>;

  /**
   * PTYをリサイズする
   */
  resizePty(terminal: TerminalInstance, cols: number, rows: number): OperationResult<void>;

  /**
   * PTYプロセスを終了する
   */
  killPty(terminal: TerminalInstance): OperationResult<void>;

  /**
   * PTYプロセスの状態を確認する
   */
  isPtyAlive(terminal: TerminalInstance): boolean;

  /**
   * PTY書き込みの再試行
   */
  retryWrite(terminal: TerminalInstance, data: string, maxRetries?: number): Promise<OperationResult<void>>;

  /**
   * PTYリカバリを試行する
   */
  attemptRecovery(terminal: TerminalInstance): OperationResult<void>;
}

/**
 * ターミナルプロセスマネージャー実装
 */
export class TerminalProcessManager implements ITerminalProcessManager {
  private readonly WRITE_RETRY_DELAY_MS = 500;
  private readonly DEFAULT_MAX_RETRIES = 3;

  /**
   * PTYにデータを書き込む
   */
  writeToPty(terminal: TerminalInstance, data: string): OperationResult<void> {
    const ptyInstance = this.getPtyInstance(terminal);

    if (!ptyInstance) {
      log(`⏳ [PTY-PROCESS] PTY not ready for terminal ${terminal.id}, data will be queued`);
      return OperationResultHandler.failure('PTY not ready');
    }

    if (!this.validatePtyWrite(ptyInstance)) {
      return OperationResultHandler.failure('PTY instance missing write method or process killed');
    }

    try {
      ptyInstance.write(data);
      log(`✅ [PTY-PROCESS] Successfully wrote ${data.length} chars to terminal ${terminal.id}`);
      return OperationResultHandler.success();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [PTY-PROCESS] Write failed for terminal ${terminal.id}: ${errorMessage}`);
      return OperationResultHandler.failure(`Write failed: ${errorMessage}`);
    }
  }

  /**
   * PTYをリサイズする
   */
  resizePty(terminal: TerminalInstance, cols: number, rows: number): OperationResult<void> {
    // 寸法の検証
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

    // プロセスが生きているか確認
    if (!this.isPtyAlive(terminal)) {
      return OperationResultHandler.failure('PTY process has been killed');
    }

    try {
      ptyInstance.resize(cols, rows);
      log(`📏 [PTY-PROCESS] Terminal resized: ${terminal.name} → ${cols}x${rows}`);

      // シェルリフレッシュ（VS Codeパターン）
      this.refreshShellAfterResize(ptyInstance);

      return OperationResultHandler.success();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [PTY-PROCESS] Resize failed for terminal ${terminal.id}: ${errorMessage}`);
      return OperationResultHandler.failure(`Resize failed: ${errorMessage}`);
    }
  }

  /**
   * PTYプロセスを終了する
   */
  killPty(terminal: TerminalInstance): OperationResult<void> {
    const ptyInstance = this.getPtyInstance(terminal);

    if (!ptyInstance) {
      return OperationResultHandler.failure('No PTY instance to kill');
    }

    try {
      if (typeof ptyInstance.kill === 'function') {
        ptyInstance.kill();
        log(`🔪 [PTY-PROCESS] PTY process killed for terminal ${terminal.id}`);
        return OperationResultHandler.success();
      } else {
        return OperationResultHandler.failure('PTY instance missing kill method');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`❌ [PTY-PROCESS] Kill failed for terminal ${terminal.id}: ${errorMessage}`);
      return OperationResultHandler.failure(`Kill failed: ${errorMessage}`);
    }
  }

  /**
   * PTYプロセスが生きているか確認
   */
  isPtyAlive(terminal: TerminalInstance): boolean {
    const ptyInstance = this.getPtyInstance(terminal);

    if (!ptyInstance) {
      return false;
    }

    // node-ptyのkilledプロパティをチェック
    if (
      terminal.ptyProcess &&
      typeof terminal.ptyProcess === 'object' &&
      'killed' in terminal.ptyProcess &&
      (terminal.ptyProcess as any).killed
    ) {
      return false;
    }

    // pidが存在するか確認
    if (ptyInstance.pid && ptyInstance.pid > 0) {
      return true;
    }

    return false;
  }

  /**
   * PTY書き込みの再試行（非同期）
   */
  async retryWrite(
    terminal: TerminalInstance,
    data: string,
    maxRetries: number = this.DEFAULT_MAX_RETRIES
  ): Promise<OperationResult<void>> {
    let lastError: string | Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = this.writeToPty(terminal, data);

      if (result.success) {
        if (attempt > 0) {
          log(`✅ [PTY-PROCESS] Write succeeded on retry attempt ${attempt + 1}`);
        }
        return result;
      }

      lastError = result.error;
      log(`⚠️ [PTY-PROCESS] Write attempt ${attempt + 1}/${maxRetries} failed: ${lastError}`);

      if (attempt < maxRetries - 1) {
        // 次の試行前に待機
        await this.delay(this.WRITE_RETRY_DELAY_MS);

        // PTYが準備できるまで待つ
        const isPtyReady = await this.waitForPtyReady(terminal, this.WRITE_RETRY_DELAY_MS);
        if (!isPtyReady) {
          log(`⏳ [PTY-PROCESS] PTY still not ready after waiting`);
        }
      }
    }

    return OperationResultHandler.failure(
      `Write failed after ${maxRetries} attempts: ${lastError}`
    );
  }

  /**
   * PTYリカバリを試行する
   */
  attemptRecovery(terminal: TerminalInstance): OperationResult<void> {
    log(`🔄 [PTY-PROCESS] Attempting PTY recovery for terminal: ${terminal.id}`);

    // 代替のPTYインスタンスを試す
    const alternatives = [terminal.ptyProcess, terminal.pty].filter(Boolean);

    for (const ptyInstance of alternatives) {
      if (ptyInstance && typeof ptyInstance.write === 'function') {
        try {
          // 同じインスタンスはスキップ
          if (ptyInstance === (terminal.ptyProcess || terminal.pty)) {
            continue;
          }

          // 簡単な書き込みテスト
          ptyInstance.write('');
          log(`✅ [PTY-PROCESS] PTY recovery successful using alternative instance`);

          // 動作するインスタンスを更新
          if (ptyInstance === terminal.pty) {
            terminal.ptyProcess = undefined;
          }

          return OperationResultHandler.success();
        } catch (recoveryError) {
          log(`⚠️ [PTY-PROCESS] Alternative PTY instance also failed: ${recoveryError}`);
        }
      }
    }

    log(`❌ [PTY-PROCESS] All PTY recovery attempts failed for terminal: ${terminal.id}`);
    return OperationResultHandler.failure('All recovery attempts failed');
  }

  // === プライベートメソッド ===

  /**
   * PTYインスタンスを取得
   */
  private getPtyInstance(terminal: TerminalInstance): pty.IPty | undefined {
    return terminal.ptyProcess || terminal.pty;
  }

  /**
   * PTY書き込みの検証
   */
  private validatePtyWrite(ptyInstance: pty.IPty): boolean {
    if (typeof ptyInstance.write !== 'function') {
      return false;
    }

    // killedプロパティのチェック
    if ('killed' in ptyInstance && (ptyInstance as any).killed) {
      return false;
    }

    return true;
  }

  /**
   * 寸法の検証
   */
  private validateDimensions(cols: number, rows: number): OperationResult<void> {
    if (cols <= 0 || rows <= 0) {
      return OperationResultHandler.failure(`Invalid dimensions: ${cols}x${rows}`);
    }

    if (cols > 500 || rows > 200) {
      return OperationResultHandler.failure(`Dimensions too large: ${cols}x${rows}`);
    }

    return OperationResultHandler.success();
  }

  /**
   * リサイズ後のシェルリフレッシュ
   */
  private refreshShellAfterResize(ptyInstance: pty.IPty): void {
    setTimeout(() => {
      try {
        if (ptyInstance.pid) {
          log(`🔄 [PTY-PROCESS] Sending refresh signal to process ${ptyInstance.pid}`);
          ptyInstance.write('\x0c'); // Form feed character to refresh display
        }
      } catch (refreshError) {
        log(`⚠️ [PTY-PROCESS] Failed to refresh shell:`, refreshError);
      }
    }, 50);
  }

  /**
   * PTYが準備できるまで待つ
   */
  private async waitForPtyReady(
    terminal: TerminalInstance,
    timeoutMs: number
  ): Promise<boolean> {
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

  /**
   * 遅延ヘルパー
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
