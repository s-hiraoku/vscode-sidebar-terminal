/**
 * Display Mode Manager
 *
 * ターミナルの表示モード（normal/fullscreen/split）を管理
 *
 * 責務:
 * - 表示モードの状態管理
 * - フルスクリーンモードの制御
 * - 分割モードの切り替え
 * - TerminalContainerManagerとSplitManagerの協調
 *
 * 連携:
 * - TerminalContainerManager: コンテナの表示制御
 * - SplitManager (ISplitLayoutController): 分割レイアウト制御
 *
 * Migrated to constructor injection pattern (Issue #216)
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { BaseManager } from './BaseManager';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { ISplitLayoutController } from '../interfaces/ISplitLayoutController';

/**
 * 表示モードの種類
 */
export type DisplayMode = 'normal' | 'fullscreen' | 'split';

/**
 * Display Mode Manager Interface
 */
export interface IDisplayModeManager {
  initialize(): void;

  // モード切り替え
  setDisplayMode(mode: DisplayMode): void;
  toggleSplitMode(): void;

  // フルスクリーン
  showTerminalFullscreen(terminalId: string): void;

  // 分割ビュー
  showAllTerminalsSplit(): void;

  // 可視性
  hideAllTerminalsExcept(terminalId: string): void;
  showAllTerminals(): void;

  // 状態
  getCurrentMode(): DisplayMode;
  isTerminalVisible(terminalId: string): boolean;

  dispose(): void;
}

/**
 * DisplayModeManager
 *
 * ターミナルの表示モードを一元管理
 * Uses constructor injection for coordinator dependency (Issue #216)
 */
export class DisplayModeManager extends BaseManager implements IDisplayModeManager {
  private readonly coordinator: IManagerCoordinator;

  // 現在の表示モード
  private currentMode: DisplayMode = 'normal';

  // フルスクリーンモード時のターミナルID
  private fullscreenTerminalId: string | null = null;

  // 前回のモード（トグル用）
  private previousMode: DisplayMode = 'normal';

  // ターミナルの可視性マップ
  private terminalVisibility = new Map<string, boolean>();

  constructor(coordinator: IManagerCoordinator) {
    super('DisplayModeManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.coordinator = coordinator;
  }

  /**
   * 初期化処理
   */
  protected doInitialize(): void {
    this.log('Initializing DisplayModeManager');

    // 初期状態はnormalモード
    this.currentMode = 'normal';
    this.fullscreenTerminalId = null;

    this.log('DisplayModeManager initialized successfully');
    this.notifyModeChanged('normal');
  }

  /**
   * 表示モードを設定
   */
  public setDisplayMode(mode: DisplayMode): void {
    this.log(`Setting display mode: ${this.currentMode} -> ${mode}`);

    // 前回のモードを記録
    this.previousMode = this.currentMode;

    // モードを更新
    this.currentMode = mode;

    // 表示を更新
    this.updateDisplay();

    this.log(`Display mode set: ${mode}`);

    this.refreshSplitToggleState();
    this.notifyModeChanged(mode);
  }

  /**
   * 分割モードをトグル
   */
  public toggleSplitMode(): void {
    this.log(`Toggling split mode: current=${this.currentMode}`);

    if (this.currentMode === 'split') {
      // 分割モード → 通常モードへ
      this.setDisplayMode('normal');
      this.exitSplitMode();
    } else {
      // 通常/フルスクリーン → 分割モードへ
      this.setDisplayMode('split');
      this.showAllTerminalsSplit();
    }
  }

  /**
   * ターミナルをフルスクリーン表示
   */
  public showTerminalFullscreen(terminalId: string): void {
    this.log(`Showing terminal fullscreen: ${terminalId}`);

    const containerManager = this.coordinator?.getTerminalContainerManager?.();
    if (!containerManager) {
      this.log('TerminalContainerManager not available', 'error');
      return;
    }

    this.previousMode = this.currentMode;

    const splitManager = this.getSplitManager();
    if (splitManager?.isSplitMode) {
      this.log('Ensuring split mode is exited before entering fullscreen');
      splitManager.exitSplitMode();
    }

    const displayState = {
      mode: 'fullscreen' as const,
      activeTerminalId: terminalId,
      orderedTerminalIds: containerManager.getContainerOrder(),
    };

    containerManager.applyDisplayState(displayState);

    this.currentMode = 'fullscreen';
    this.fullscreenTerminalId = terminalId;

    this.syncVisibilityFromSnapshot();
    this.refreshSplitToggleState();
    this.notifyModeChanged('fullscreen');

    this.log(`Terminal ${terminalId} is now in fullscreen mode`);
  }

  /**
   * すべてのターミナルを分割表示
   */
  public showAllTerminalsSplit(): void {
    this.log('Showing all terminals in split view');

    // SplitManagerを取得
    const splitManager = this.getSplitManager();
    if (!splitManager) {
      this.log('SplitManager not available', 'error');
      return;
    }

    // 🔧 FIX: Get current panel location from SplitManager instead of hardcoding
    const currentLocation = (splitManager as { getCurrentPanelLocation?: () => 'sidebar' | 'panel' }).getCurrentPanelLocation?.() || 'sidebar';
    this.log(`Current panel location: ${currentLocation}`);

    // 分割方向を決定（パネル位置に応じて）
    const direction = splitManager.getOptimalSplitDirection(currentLocation);

    // 分割モードを準備
    splitManager.prepareSplitMode(direction);
    const containerManager = this.coordinator?.getTerminalContainerManager?.();
    if (!containerManager) {
      this.log('TerminalContainerManager not available', 'error');
      return;
    }

    const displayState = {
      mode: 'split' as const,
      activeTerminalId: this.fullscreenTerminalId,
      orderedTerminalIds: containerManager.getContainerOrder(),
      splitDirection: direction,
    };

    containerManager.applyDisplayState(displayState);

    this.currentMode = 'split';
    this.previousMode = 'split';
    this.fullscreenTerminalId = null;

    this.syncVisibilityFromSnapshot();
    this.refreshSplitToggleState();

    // 🔧 FIX: Resize all terminals immediately after applying split layout
    // This ensures each terminal has the correct size in the split view
    // Note: Terminal resize is handled by the terminal container manager
    this.log('🔄 [SPLIT] Split layout applied, terminals will auto-resize');

    this.log('All terminals are now in split view');
    this.notifyModeChanged('split');
  }

  /**
   * 指定ターミナル以外を非表示
   */
  public hideAllTerminalsExcept(terminalId: string): void {
    const containerManager = this.coordinator?.getTerminalContainerManager?.();
    if (!containerManager) {
      this.log('TerminalContainerManager not available', 'error');
      return;
    }

    const displayState = {
      mode: 'fullscreen' as const,
      activeTerminalId: terminalId,
      orderedTerminalIds: containerManager.getContainerOrder(),
    };

    containerManager.applyDisplayState(displayState);
    this.syncVisibilityFromSnapshot();
  }

  /**
   * すべてのターミナルを表示
   */
  public showAllTerminals(): void {
    const containerManager = this.coordinator?.getTerminalContainerManager?.();
    if (!containerManager) {
      this.log('TerminalContainerManager not available', 'error');
      return;
    }

    const displayState = {
      mode: 'normal' as const,
      activeTerminalId: null,
      orderedTerminalIds: containerManager.getContainerOrder(),
    };

    containerManager.applyDisplayState(displayState);
    this.syncVisibilityFromSnapshot();
  }

  /**
   * 現在のモードを取得
   */
  public getCurrentMode(): DisplayMode {
    return this.currentMode;
  }

  /**
   * ターミナルが表示されているか確認
   */
  public isTerminalVisible(terminalId: string): boolean {
    return this.terminalVisibility.get(terminalId) ?? true;
  }

  /**
   * 表示を更新（モード変更時）
   */
  private updateDisplay(): void {
    this.log(`Updating display for mode: ${this.currentMode}`);

    switch (this.currentMode) {
      case 'normal':
        this.applyNormalMode();
        break;
      case 'fullscreen':
        // フルスクリーンは showTerminalFullscreen() で既に適用済み
        break;
      case 'split':
        // 分割モードは showAllTerminalsSplit() で既に適用済み
        break;
    }
  }

  /**
   * 通常モードを適用
   */
  private applyNormalMode(): void {
    this.log('Applying normal mode');

    // 分割モードを解除
    this.exitSplitMode();

    // すべてのターミナルを表示
    this.showAllTerminals();

    this.fullscreenTerminalId = null;

    this.log('Normal mode applied');

    this.refreshSplitToggleState();
    this.notifyModeChanged('normal');
  }

  /**
   * 分割モードを解除
   */
  private exitSplitMode(): void {
    const splitManager = this.getSplitManager();
    if (splitManager && splitManager.isSplitMode) {
      this.log('Exiting split mode via SplitManager');
      splitManager.exitSplitMode();
    }
  }

  /**
   * SplitManagerを取得
   */
  private getSplitManager(): ISplitLayoutController | null {
    // coordinatorからSplitManagerを取得
    if (this.coordinator && 'splitManager' in this.coordinator) {
      return (this.coordinator as any).splitManager as ISplitLayoutController;
    }
    return null;
  }

  /**
   * デバッグ情報を取得
   */
  public getDebugInfo(): {
    currentMode: DisplayMode;
    fullscreenTerminalId: string | null;
    previousMode: DisplayMode;
    visibleTerminals: string[];
  } {
    const visibleTerminals: string[] = [];
    this.terminalVisibility.forEach((visible, terminalId) => {
      if (visible) {
        visibleTerminals.push(terminalId);
      }
    });

    return {
      currentMode: this.currentMode,
      fullscreenTerminalId: this.fullscreenTerminalId,
      previousMode: this.previousMode,
      visibleTerminals,
    };
  }

  /**
   * ログ出力のヘルパー（BaseManagerのloggerを使用）
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    // BaseManagerのloggerを活用
    this.logger(message);

    // エラーレベルの場合は追加でconsole.errorに出力
    if (level === 'error') {
      console.error(`[DisplayModeManager] ${message}`);
    } else if (level === 'warn') {
      console.warn(`[DisplayModeManager] ${message}`);
    }
  }

  /**
   * クリーンアップ処理
   */
  protected doDispose(): void {
    this.log('Disposing DisplayModeManager');

    // 通常モードに戻す
    this.applyNormalMode();

    // 状態をクリア
    this.terminalVisibility.clear();
    this.fullscreenTerminalId = null;

    this.log('DisplayModeManager disposed successfully');
  }

  /**
   * Split toggle buttonの状態を同期
   * Note: Split button has been removed from the header
   */
  private refreshSplitToggleState(): void {
    // Split button removed - no-op
  }

  private syncVisibilityFromSnapshot(): void {
    const containerManager = this.coordinator?.getTerminalContainerManager?.();
    if (!containerManager) {
      return;
    }

    const snapshot = containerManager.getDisplaySnapshot();
    const visibleSet = new Set(snapshot.visibleTerminals);

    this.terminalVisibility.clear();
    containerManager.getAllContainers().forEach((_, terminalId) => {
      this.terminalVisibility.set(terminalId, visibleSet.has(terminalId));
    });
  }

  private notifyModeChanged(mode: DisplayMode): void {
    const tabs = this.coordinator?.getManagers()?.tabs;
    tabs?.updateModeIndicator(mode);
  }
}
