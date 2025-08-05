/**
 * Infrastructure Layer - VS Code Terminal Service Implementation
 *
 * Domain層のITerminalServiceを実装し、実際のVS Code統合を提供
 */

import {
  ITerminalService,
  Terminal,
  TerminalCreationOptions,
  TerminalOperationResult,
} from '../domain/interfaces/TerminalService';
import { ITerminalLifecycleManager } from '../services/TerminalLifecycleManager';
import { ITerminalStateManager } from '../services/TerminalStateManager';
import { OperationResultHandler as _OperationResultHandler } from '../utils/OperationResultHandler';
import { extension as log } from '../utils/logger';

/**
 * VS Code実装のターミナルサービス
 */
export class VSCodeTerminalService implements ITerminalService {
  private readonly callbacks = {
    onTerminalCreated: new Set<(terminal: Terminal) => void>(),
    onTerminalDeleted: new Set<(terminalId: string) => void>(),
    onTerminalDataReceived: new Set<(terminalId: string, data: string) => void>(),
  };

  constructor(
    private readonly lifecycleManager: ITerminalLifecycleManager,
    private readonly stateManager: ITerminalStateManager
  ) {
    this.setupEventListeners();
    log('🏗️ [INFRASTRUCTURE] VS Code terminal service initialized');
  }

  // === ターミナル管理 ===

  /**
   * ターミナルを作成
   */
  createTerminal(options?: TerminalCreationOptions): Promise<TerminalOperationResult<string>> {
    try {
      log('🚀 [INFRASTRUCTURE] Creating terminal with options:', options);

      // TODO: optionsをlifecycleManagerの形式に変換
      const terminalId = this.lifecycleManager.createTerminal();

      return Promise.resolve({ success: true, data: terminalId });
    } catch (error) {
      return Promise.resolve({
        success: false,
        error: `Failed to create terminal: ${String(error)}`,
      });
    }
  }

  /**
   * ターミナルを削除
   */
  async deleteTerminal(terminalId: string): Promise<TerminalOperationResult> {
    try {
      log(`🗑️ [INFRASTRUCTURE] Deleting terminal: ${terminalId}`);

      const result = await this.lifecycleManager.killTerminal(terminalId);

      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.reason || 'Failed to delete terminal' };
      }
    } catch (error) {
      return { success: false, error: `Failed to delete terminal: ${String(error)}` };
    }
  }

  /**
   * ターミナルを取得
   */
  getTerminal(terminalId: string): Terminal | null {
    const terminal = this.lifecycleManager.getTerminal(terminalId);
    if (!terminal) {
      return null;
    }

    return this.mapToTerminal(terminal);
  }

  /**
   * 全ターミナルを取得
   */
  getAllTerminals(): Terminal[] {
    const terminals = this.lifecycleManager.getAllTerminals();
    return terminals.map((t) => this.mapToTerminal(t));
  }

  // === ターミナル操作 ===

  /**
   * ターミナルにデータを書き込み
   */
  writeToTerminal(terminalId: string, data: string): TerminalOperationResult {
    const result = this.lifecycleManager.writeToTerminal(terminalId, data);

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.reason || 'Failed to write to terminal' };
    }
  }

  /**
   * ターミナルをリサイズ
   */
  resizeTerminal(terminalId: string, cols: number, rows: number): TerminalOperationResult {
    const result = this.lifecycleManager.resizeTerminal(terminalId, cols, rows);

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.reason || 'Failed to resize terminal' };
    }
  }

  // === 状態管理 ===

  /**
   * アクティブターミナルを設定
   */
  setActiveTerminal(terminalId: string): TerminalOperationResult {
    const result = this.stateManager.setActiveTerminal(terminalId);

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.reason || 'Failed to set active terminal' };
    }
  }

  /**
   * アクティブターミナルを取得
   */
  getActiveTerminal(): Terminal | null {
    const activeTerminal = this.stateManager.getActiveTerminal();
    if (!activeTerminal) {
      return null;
    }

    return this.mapToTerminal(activeTerminal);
  }

  // === イベント ===

  /**
   * ターミナル作成イベントを購読
   */
  onTerminalCreated(callback: (terminal: Terminal) => void): void {
    this.callbacks.onTerminalCreated.add(callback);
  }

  /**
   * ターミナル削除イベントを購読
   */
  onTerminalDeleted(callback: (terminalId: string) => void): void {
    this.callbacks.onTerminalDeleted.add(callback);
  }

  /**
   * ターミナルデータ受信イベントを購読
   */
  onTerminalDataReceived(callback: (terminalId: string, data: string) => void): void {
    this.callbacks.onTerminalDataReceived.add(callback);
  }

  // === プライベートメソッド ===

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    // ターミナル作成イベント
    this.lifecycleManager.onTerminalCreated((terminal) => {
      const domainTerminal = this.mapToTerminal(terminal);
      this.callbacks.onTerminalCreated.forEach((callback) => {
        try {
          callback(domainTerminal);
        } catch (error) {
          log(`❌ [INFRASTRUCTURE] Error in terminal created callback: ${String(error)}`);
        }
      });
    });

    // ターミナル削除イベント
    this.lifecycleManager.onTerminalRemoved((terminalId) => {
      this.callbacks.onTerminalDeleted.forEach((callback) => {
        try {
          callback(terminalId);
        } catch (error) {
          log(`❌ [INFRASTRUCTURE] Error in terminal deleted callback: ${String(error)}`);
        }
      });
    });

    // ターミナルデータイベント
    this.lifecycleManager.onTerminalData((event) => {
      this.callbacks.onTerminalDataReceived.forEach((callback) => {
        try {
          callback(event.terminalId, event.data);
        } catch (error) {
          log(`❌ [INFRASTRUCTURE] Error in terminal data callback: ${String(error)}`);
        }
      });
    });
  }

  /**
   * インフラ層のターミナルをドメイン層のターミナルにマッピング
   */
  private mapToTerminal(infraTerminal: {
    id: string;
    name: string;
    number: number;
    isActive: boolean;
    cwd?: string;
    createdAt?: number;
  }): Terminal {
    return {
      id: infraTerminal.id,
      name: infraTerminal.name,
      number: infraTerminal.number,
      isActive: infraTerminal.isActive,
      cwd: infraTerminal.cwd || process.cwd(),
      createdAt: infraTerminal.createdAt,
    };
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.callbacks.onTerminalCreated.clear();
    this.callbacks.onTerminalDeleted.clear();
    this.callbacks.onTerminalDataReceived.clear();

    log('🗑️ [INFRASTRUCTURE] VS Code terminal service disposed');
  }
}
