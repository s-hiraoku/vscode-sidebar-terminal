/**
 * ターミナル状態管理サービス
 *
 * ターミナルの状態管理、バリデーション、アクティブターミナル管理を専門に行います。
 */

import * as vscode from 'vscode';
import { TerminalInstance, TerminalState } from '../types/common';
import { terminal as log } from '../utils/logger';
import { ActiveTerminalManager } from '../utils/common';
import { OperationResult, OperationResultHandler } from '../utils/OperationResultHandler';

export interface ITerminalStateManager {
  // アクティブターミナル管理
  setActiveTerminal(terminalId: string): OperationResult<void>;
  getActiveTerminalId(): string | null;
  getActiveTerminal(): TerminalInstance | null;

  // 状態管理
  getCurrentState(): TerminalState;
  updateTerminalState(terminals: TerminalInstance[]): void;

  // バリデーション
  validateOperation(terminalId: string, operation: string): OperationResult<void>;
  validateTerminalCreation(): OperationResult<void>;
  validateTerminalDeletion(terminalId: string): OperationResult<void>;

  // 状態分析
  getStateAnalysis(): {
    terminalCount: number;
    maxTerminals: number;
    utilization: number;
    availableSlots: number[];
    activeTerminalId: string | null;
    hasActiveTerminal: boolean;
    terminalNames: string[];
    duplicateNames: string[];
  };

  // イベント
  onStateUpdate: vscode.Event<TerminalState>;

  // リソース管理
  dispose(): void;
}

export interface StateValidationConfig {
  maxTerminals: number;
  allowDuplicateNames: boolean;
  validateBeforeOperations: boolean;
}

/**
 * ターミナル状態管理サービス
 */
export class TerminalStateManager implements ITerminalStateManager {
  private readonly _activeTerminalManager = new ActiveTerminalManager();
  private readonly _stateUpdateEmitter = new vscode.EventEmitter<TerminalState>();

  // 現在の状態
  private _currentState: TerminalState = {
    terminals: [],
    activeTerminalId: null,
    maxTerminals: 5,
    availableSlots: [1, 2, 3, 4, 5],
  };

  // 設定
  private readonly config: StateValidationConfig;

  // リソース管理
  private readonly _disposables: vscode.Disposable[] = [];

  constructor(config: Partial<StateValidationConfig> = {}) {
    this.config = {
      maxTerminals: 5,
      allowDuplicateNames: false,
      validateBeforeOperations: true,
      ...config,
    };

    this._currentState.maxTerminals = this.config.maxTerminals;
    this._currentState.availableSlots = Array.from(
      { length: this.config.maxTerminals },
      (_, i) => i + 1
    );

    log(`🎯 [STATE] Terminal state manager initialized with max: ${this.config.maxTerminals}`);
  }

  // === イベント公開 ===

  public get onStateUpdate(): vscode.Event<TerminalState> {
    return this._stateUpdateEmitter.event;
  }

  // === アクティブターミナル管理 ===

  /**
   * アクティブターミナルを設定
   */
  setActiveTerminal(terminalId: string): OperationResult<void> {
    if (this.config.validateBeforeOperations) {
      const validation = this.validateOperation(terminalId, 'setActive');
      if (!validation.success) {
        return validation;
      }
    }

    try {
      const previousActiveId = this._activeTerminalManager.getActive();

      // アクティブターミナルを設定
      this._activeTerminalManager.setActive(terminalId);

      // 状態を更新
      this._currentState.activeTerminalId = terminalId;

      // ターミナルのisActiveフラグを更新
      this.updateActiveFlags(terminalId);

      log(`🎯 [STATE] Active terminal changed: ${previousActiveId} → ${terminalId}`);

      // 状態更新イベントを発火
      this.emitStateUpdate();

      return OperationResultHandler.success();
    } catch (error) {
      return OperationResultHandler.failure(`Failed to set active terminal: ${String(error)}`);
    }
  }

  /**
   * アクティブターミナルIDを取得
   */
  getActiveTerminalId(): string | null {
    return this._activeTerminalManager.getActive() || null;
  }

  /**
   * アクティブターミナルインスタンスを取得
   */
  getActiveTerminal(): TerminalInstance | null {
    const activeId = this.getActiveTerminalId();
    if (!activeId) {
      return null;
    }

    const terminalInfo = this._currentState.terminals.find((t) => t.id === activeId);
    if (!terminalInfo) {
      return null;
    }
    // Convert TerminalInfo to TerminalInstance (add missing properties)
    return {
      ...terminalInfo,
      pty: undefined,
      ptyProcess: undefined,
      number: 1, // Default number
      cwd: undefined,
      createdAt: Date.now(),
    } as TerminalInstance;
  }

  // === 状態管理 ===

  /**
   * 現在の状態を取得
   */
  getCurrentState(): TerminalState {
    return { ...this._currentState };
  }

  /**
   * ターミナル状態を更新
   */
  updateTerminalState(terminals: TerminalInstance[]): void {
    // ターミナル情報を更新
    this._currentState.terminals = terminals.map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      isActive: terminal.isActive,
    }));

    // 利用可能スロットを計算
    this.calculateAvailableSlots(terminals);

    // アクティブターミナルの整合性確認
    this.validateActiveTerminalConsistency(terminals);

    log(
      `📊 [STATE] State updated: ${terminals.length} terminals, active: ${this._currentState.activeTerminalId}`
    );

    // 状態更新イベントを発火
    this.emitStateUpdate();
  }

  // === バリデーション ===

  /**
   * 操作のバリデーション
   */
  validateOperation(terminalId: string, operation: string): OperationResult<void> {
    // ターミナルIDの形式確認
    if (!terminalId || typeof terminalId !== 'string') {
      return OperationResultHandler.failure(`Invalid terminal ID for operation ${operation}`);
    }

    // ターミナルの存在確認
    const terminalExists = this._currentState.terminals.some((t) => t.id === terminalId);
    if (!terminalExists) {
      return OperationResultHandler.failure(
        `Terminal ${terminalId} not found for operation ${operation}`
      );
    }

    return OperationResultHandler.success();
  }

  /**
   * ターミナル作成のバリデーション
   */
  validateTerminalCreation(): OperationResult<void> {
    // 最大数チェック
    if (this._currentState.terminals.length >= this.config.maxTerminals) {
      return OperationResultHandler.failure(
        `Cannot create terminal: maximum limit reached (${this.config.maxTerminals})`
      );
    }

    // 利用可能スロットの確認
    if (this._currentState.availableSlots.length === 0) {
      return OperationResultHandler.failure('No available terminal slots');
    }

    return OperationResultHandler.success();
  }

  /**
   * ターミナル削除のバリデーション
   */
  validateTerminalDeletion(terminalId: string): OperationResult<void> {
    // 基本バリデーション
    const basicValidation = this.validateOperation(terminalId, 'delete');
    if (!basicValidation.success) {
      return basicValidation;
    }

    // 削除可能な状態かチェック（必要に応じて追加条件を設定）
    return OperationResultHandler.success();
  }

  // === リソース管理 ===

  /**
   * 全リソースを解放
   */
  dispose(): void {
    log('🗑️ [STATE] Disposing terminal state manager...');

    // イベントエミッターを解放
    this._stateUpdateEmitter.dispose();

    // Disposableを解放
    this._disposables.forEach((d) => {
      d.dispose();
    });
    this._disposables.length = 0;

    // 状態をリセット
    this._currentState = {
      terminals: [],
      activeTerminalId: null,
      maxTerminals: this.config.maxTerminals,
      availableSlots: Array.from({ length: this.config.maxTerminals }, (_, i) => i + 1),
    };

    log('✅ [STATE] Terminal state manager disposed');
  }

  // === 状態分析・レポート ===

  /**
   * 状態分析レポートを取得
   */
  getStateAnalysis(): {
    terminalCount: number;
    maxTerminals: number;
    utilization: number;
    availableSlots: number[];
    activeTerminalId: string | null;
    hasActiveTerminal: boolean;
    terminalNames: string[];
    duplicateNames: string[];
  } {
    const terminalNames = this._currentState.terminals.map((t) => t.name);
    const duplicateNames = this.findDuplicateNames(terminalNames);

    return {
      terminalCount: this._currentState.terminals.length,
      maxTerminals: this.config.maxTerminals,
      utilization: (this._currentState.terminals.length / this.config.maxTerminals) * 100,
      availableSlots: [...this._currentState.availableSlots],
      activeTerminalId: this._currentState.activeTerminalId,
      hasActiveTerminal: this._currentState.activeTerminalId !== null,
      terminalNames,
      duplicateNames,
    };
  }

  /**
   * 状態の健全性チェック
   */
  validateStateHealth(): {
    isHealthy: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // アクティブターミナルの整合性
    if (this._currentState.activeTerminalId) {
      const activeExists = this._currentState.terminals.some(
        (t) => t.id === this._currentState.activeTerminalId
      );
      if (!activeExists) {
        issues.push('Active terminal ID does not match any existing terminal');
      }
    }

    // 重複名前チェック
    if (!this.config.allowDuplicateNames) {
      const duplicates = this.findDuplicateNames(this._currentState.terminals.map((t) => t.name));
      if (duplicates.length > 0) {
        warnings.push(`Duplicate terminal names found: ${duplicates.join(', ')}`);
      }
    }

    // 利用率チェック
    const utilization = (this._currentState.terminals.length / this.config.maxTerminals) * 100;
    if (utilization >= 90) {
      warnings.push(`High terminal utilization: ${utilization.toFixed(1)}%`);
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      warnings,
    };
  }

  // === プライベートメソッド ===

  /**
   * アクティブフラグを更新
   */
  private updateActiveFlags(activeTerminalId: string): void {
    this._currentState.terminals.forEach((terminal) => {
      terminal.isActive = terminal.id === activeTerminalId;
    });
  }

  /**
   * 利用可能スロットを計算
   */
  private calculateAvailableSlots(terminals: TerminalInstance[]): void {
    const usedNumbers = new Set(terminals.map((t) => t.number));
    this._currentState.availableSlots = [];

    for (let i = 1; i <= this.config.maxTerminals; i++) {
      if (!usedNumbers.has(i)) {
        this._currentState.availableSlots.push(i);
      }
    }
  }

  /**
   * アクティブターミナルの整合性を確認
   */
  private validateActiveTerminalConsistency(terminals: TerminalInstance[]): void {
    const activeId = this._currentState.activeTerminalId;

    if (activeId) {
      const activeTerminal = terminals.find((t) => t.id === activeId);
      if (!activeTerminal) {
        // アクティブターミナルが存在しない場合はクリア
        log(`⚠️ [STATE] Active terminal ${activeId} not found, clearing active state`);
        this._currentState.activeTerminalId = null;
        this._activeTerminalManager.clearActive();
      }
    } else if (terminals.length > 0) {
      // アクティブターミナルが設定されていない場合は最初のターミナルを設定
      const firstTerminal = terminals[0];
      if (firstTerminal) {
        log(`🎯 [STATE] No active terminal, setting first terminal as active: ${firstTerminal.id}`);
        this.setActiveTerminal(firstTerminal.id);
      }
    }
  }

  /**
   * 重複名前を検出
   */
  private findDuplicateNames(names: string[]): string[] {
    const nameCount = new Map<string, number>();
    const duplicates: string[] = [];

    names.forEach((name) => {
      const count = nameCount.get(name) || 0;
      nameCount.set(name, count + 1);

      if (count === 1) {
        // 2回目の出現で重複と判定
        duplicates.push(name);
      }
    });

    return duplicates;
  }

  /**
   * 状態更新イベントを発火
   */
  private emitStateUpdate(): void {
    try {
      this._stateUpdateEmitter.fire(this.getCurrentState());
    } catch (error) {
      log(`❌ [STATE] Error emitting state update: ${String(error)}`);
    }
  }
}
