/**
 * ターミナルライフサイクル管理サービス
 *
 * ターミナルの作成・削除・プロセス管理を専門に行います。
 * 単一責務の原則に従って、ライフサイクル管理のみに特化しています。
 */

import * as vscode from 'vscode';
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { TerminalInstance, DeleteResult } from '../types/common';
import { TERMINAL_CONSTANTS, ERROR_MESSAGES } from '../constants';
import { terminal as log } from '../utils/logger';
import {
  getTerminalConfig,
  getShellForPlatform,
  getWorkingDirectory,
  generateTerminalId,
  generateTerminalName,
} from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';
import { OperationResult, OperationResultHandler } from '../utils/OperationResultHandler';

export interface ITerminalLifecycleManager extends TerminalLifecycleEvents {
  createTerminal(): string;
  killTerminal(terminalId: string): Promise<OperationResult<void>>;
  removeTerminal(terminalId: string): void;
  resizeTerminal(terminalId: string, cols: number, rows: number): OperationResult<void>;
  writeToTerminal(terminalId: string, data: string): OperationResult<void>;
  getTerminal(terminalId: string): TerminalInstance | undefined;
  getAllTerminals(): TerminalInstance[];
  getTerminalCount(): number;
  hasTerminal(terminalId: string): boolean;
  dispose(): void;
}

export interface TerminalLifecycleEvents {
  onTerminalCreated: vscode.Event<TerminalInstance>;
  onTerminalRemoved: vscode.Event<string>;
  onTerminalExit: vscode.Event<{ terminalId: string; exitCode?: number }>;
  onTerminalData: vscode.Event<{ terminalId: string; data: string }>;
}

/**
 * ターミナルライフサイクル管理サービス
 */
export class TerminalLifecycleManager implements ITerminalLifecycleManager {
  private readonly _terminals = new Map<string, TerminalInstance>();
  private readonly _terminalNumberManager: TerminalNumberManager;

  // イベントエミッター
  private readonly _terminalCreatedEmitter = new vscode.EventEmitter<TerminalInstance>();
  private readonly _terminalRemovedEmitter = new vscode.EventEmitter<string>();
  private readonly _terminalExitEmitter = new vscode.EventEmitter<{
    terminalId: string;
    exitCode?: number;
  }>();
  private readonly _terminalDataEmitter = new vscode.EventEmitter<{
    terminalId: string;
    data: string;
  }>();

  // 操作の原子性保証
  private readonly _terminalBeingKilled = new Set<string>();
  private operationQueue: Promise<void> = Promise.resolve();

  // リソース管理
  private readonly _disposables: vscode.Disposable[] = [];

  constructor() {
    const config = getTerminalConfig();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);

    log('🚀 [LIFECYCLE] Terminal lifecycle manager initialized');
  }

  // === イベント公開 ===

  public get onTerminalCreated(): vscode.Event<TerminalInstance> {
    return this._terminalCreatedEmitter.event;
  }

  public get onTerminalRemoved(): vscode.Event<string> {
    return this._terminalRemovedEmitter.event;
  }

  public get onTerminalExit(): vscode.Event<{ terminalId: string; exitCode?: number }> {
    return this._terminalExitEmitter.event;
  }

  public get onTerminalData(): vscode.Event<{ terminalId: string; data: string }> {
    return this._terminalDataEmitter.event;
  }

  // === ターミナル作成 ===

  /**
   * 新しいターミナルを作成
   */
  createTerminal(): string {
    const config = getTerminalConfig();

    // 最大数チェック
    if (this._terminals.size >= config.maxTerminals) {
      throw new Error(`Maximum terminal limit reached (${config.maxTerminals})`);
    }

    // ターミナル番号を取得
    const terminalNumber = this._terminalNumberManager.findAvailableNumber(this._terminals);
    if (terminalNumber === null) {
      throw new Error('No available terminal numbers');
    }

    try {
      // ターミナルIDと名前を生成
      const terminalId = generateTerminalId();
      const terminalName = generateTerminalName(terminalNumber);

      // pty プロセスを作成
      const ptyProcess = this.createPtyProcess({
        env: {},
        ptyOptions: {
          cols: TERMINAL_CONSTANTS.DEFAULT_COLS,
          rows: TERMINAL_CONSTANTS.DEFAULT_ROWS,
        },
        shellArgs: config.shellArgs,
      });

      // ターミナルインスタンスを作成
      const terminal: TerminalInstance = {
        id: terminalId,
        pty: ptyProcess,
        ptyProcess,
        name: terminalName,
        number: terminalNumber,
        cwd: getWorkingDirectory(),
        isActive: false,
        createdAt: Date.now(),
      };

      // イベントハンドラーを設定
      this.setupTerminalEventHandlers(terminal);

      // マップに追加
      this._terminals.set(terminalId, terminal);

      // 番号を使用中にマーク
      // Terminal number is automatically managed by the TerminalNumberManager

      log(`✅ [LIFECYCLE] Terminal created: ${terminalName} (${terminalId})`);

      // イベントを発火
      this._terminalCreatedEmitter.fire(terminal);

      return terminalId;
    } catch (error) {
      // エラー時は番号を解放
      // Terminal number is automatically released when terminal is removed from map
      log(`❌ [LIFECYCLE] Failed to create terminal: ${String(error)}`);
      throw error;
    }
  }

  // === ターミナル削除 ===

  /**
   * ターミナルを削除（プロセス終了）
   */
  async killTerminal(terminalId: string): Promise<OperationResult<void>> {
    return new Promise((resolve) => {
      // 操作キューに追加して原子性を保証
      this.operationQueue = this.operationQueue
        .then(async () => {
          try {
            const result = await this.performKillTerminal(terminalId);
            resolve(result);
          } catch (error) {
            resolve(OperationResultHandler.failure(`Kill operation failed: ${String(error)}`));
          }
        })
        .catch((error) => {
          resolve(OperationResultHandler.failure(`Queue operation failed: ${String(error)}`));
        });
    });
  }

  /**
   * ターミナルを削除（マップから除去のみ）
   */
  removeTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log(`⚠️ [LIFECYCLE] Terminal not found for removal: ${terminalId}`);
      return;
    }

    try {
      // マップから削除
      this._terminals.delete(terminalId);

      // 番号を解放
      // Terminal number is automatically released when terminal is removed from map

      // キル中状態をクリア
      this._terminalBeingKilled.delete(terminalId);

      log(`🗑️ [LIFECYCLE] Terminal removed: ${terminal.name} (${terminalId})`);

      // イベントを発火
      this._terminalRemovedEmitter.fire(terminalId);
    } catch (error) {
      log(`❌ [LIFECYCLE] Error removing terminal ${terminalId}: ${String(error)}`);
    }
  }

  // === ターミナル操作 ===

  /**
   * ターミナルをリサイズ
   */
  resizeTerminal(terminalId: string, cols: number, rows: number): OperationResult<void> {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return OperationResultHandler.failure(`Terminal not found: ${terminalId}`);
    }

    try {
      if (terminal.pty && typeof terminal.pty.resize === 'function') {
        terminal.pty.resize(cols, rows);
        log(`📏 [LIFECYCLE] Terminal resized: ${terminalId} (${cols}x${rows})`);
        return OperationResultHandler.success();
      } else {
        return OperationResultHandler.failure('Terminal pty not available for resize');
      }
    } catch (error) {
      return OperationResultHandler.failure(`Resize failed: ${String(error)}`);
    }
  }

  /**
   * ターミナルにデータを書き込み
   */
  writeToTerminal(terminalId: string, data: string): OperationResult<void> {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return OperationResultHandler.failure(`Terminal not found: ${terminalId}`);
    }

    try {
      if (terminal.pty && typeof terminal.pty.write === 'function') {
        terminal.pty.write(data);
        return OperationResultHandler.success();
      } else {
        return OperationResultHandler.failure('Terminal pty not available for write');
      }
    } catch (error) {
      return OperationResultHandler.failure(`Write failed: ${String(error)}`);
    }
  }

  // === ターミナル情報取得 ===

  /**
   * ターミナルを取得
   */
  getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._terminals.get(terminalId);
  }

  /**
   * 全ターミナルを取得
   */
  getAllTerminals(): TerminalInstance[] {
    return Array.from(this._terminals.values());
  }

  /**
   * ターミナル数を取得
   */
  getTerminalCount(): number {
    return this._terminals.size;
  }

  /**
   * ターミナルが存在するか確認
   */
  hasTerminal(terminalId: string): boolean {
    return this._terminals.has(terminalId);
  }

  // === リソース管理 ===

  /**
   * 全リソースを解放
   */
  dispose(): void {
    log('🗑️ [LIFECYCLE] Disposing terminal lifecycle manager...');

    // 全ターミナルを削除
    const terminalIds = Array.from(this._terminals.keys());
    terminalIds.forEach((terminalId) => {
      this.performKillTerminalSync(terminalId);
    });

    // イベントエミッターを解放
    this._terminalCreatedEmitter.dispose();
    this._terminalRemovedEmitter.dispose();
    this._terminalExitEmitter.dispose();
    this._terminalDataEmitter.dispose();

    // Disposableを解放
    this._disposables.forEach((d) => d.dispose());
    this._disposables.length = 0;

    // データ構造をクリア
    this._terminals.clear();
    this._terminalBeingKilled.clear();

    log('✅ [LIFECYCLE] Terminal lifecycle manager disposed');
  }

  // === プライベートメソッド ===

  /**
   * pty プロセスを作成
   */
  private createPtyProcess(config: any): any {
    const terminalConfig = getTerminalConfig();
    const shell = getShellForPlatform(terminalConfig.shell);
    const cwd = getWorkingDirectory();

    const ptyOptions = {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd,
      env: { ...process.env, ...config.env },
      ...config.ptyOptions,
    };

    log(`🔧 [LIFECYCLE] Creating pty: ${shell} with options:`, ptyOptions);

    return pty.spawn(shell, config.shellArgs || [], ptyOptions);
  }

  /**
   * ターミナルイベントハンドラーを設定
   */
  private setupTerminalEventHandlers(terminal: TerminalInstance): void {
    if (!terminal.pty) {
      return;
    }

    // データイベント
    const dataHandler = (data: string) => {
      this._terminalDataEmitter.fire({ terminalId: terminal.id, data });
    };
    terminal.pty.on('data', dataHandler);

    // 終了イベント
    const exitHandler = (exitCode: number) => {
      log(`🔚 [LIFECYCLE] Terminal exited: ${terminal.name} (code: ${exitCode})`);
      this._terminalExitEmitter.fire({ terminalId: terminal.id, exitCode });
      this.removeTerminal(terminal.id);
    };
    terminal.pty.on('exit', exitHandler);

    // エラーイベント
    const errorHandler = (error: Error) => {
      log(`❌ [LIFECYCLE] Terminal error: ${terminal.name} - ${String(error)}`);
      this.removeTerminal(terminal.id);
    };
    terminal.pty.on('error', errorHandler);
  }

  /**
   * ターミナル削除の実行
   */
  private async performKillTerminal(terminalId: string): Promise<OperationResult<void>> {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return OperationResultHandler.failure(`Terminal not found: ${terminalId}`);
    }

    // 既に削除中の場合はスキップ
    if (this._terminalBeingKilled.has(terminalId)) {
      return OperationResultHandler.failure(`Terminal ${terminalId} is already being killed`);
    }

    try {
      // 削除中状態にマーク
      this._terminalBeingKilled.add(terminalId);

      log(`🔪 [LIFECYCLE] Killing terminal: ${terminal.name} (${terminalId})`);

      // pty プロセスを終了
      if (terminal.pty && typeof terminal.pty.kill === 'function') {
        terminal.pty.kill();
      }

      // 少し待機してからマップから削除
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.removeTerminal(terminalId);

      return OperationResultHandler.success();
    } catch (error) {
      // エラー時も削除中状態をクリア
      this._terminalBeingKilled.delete(terminalId);
      return OperationResultHandler.failure(`Kill failed: ${String(error)}`);
    }
  }

  /**
   * 同期的なターミナル削除（dispose用）
   */
  private performKillTerminalSync(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return;
    }

    try {
      if (terminal.pty && typeof terminal.pty.kill === 'function') {
        terminal.pty.kill();
      }
      this.removeTerminal(terminalId);
    } catch (error) {
      log(`❌ [LIFECYCLE] Error in sync kill: ${String(error)}`);
      this.removeTerminal(terminalId); // 強制削除
    }
  }
}
