/**
 * Terminal Container Manager
 *
 * ターミナルコンテナのDOM操作を一元管理するマネージャー
 *
 * 責務:
 * - コンテナの表示/非表示制御
 * - 表示モード (normal/fullscreen/split) の管理
 * - DOMクエリのキャッシング
 * - パフォーマンス最適化
 *
 * 利点:
 * - DOM操作の散在を防止
 * - DisplayModeManager実装の基盤
 * - テスト容易性の向上
 */

import { BaseManager } from './BaseManager';
import { IManagerCoordinator, ITerminalContainerManager } from '../interfaces/ManagerInterfaces';

/**
 * TerminalContainerManager
 *
 * ターミナルコンテナのライフサイクルと表示状態を管理
 */
export class TerminalContainerManager extends BaseManager implements ITerminalContainerManager {
  private coordinator: IManagerCoordinator | null = null;

  // コンテナのキャッシュ（パフォーマンス最適化）
  private containerCache = new Map<string, HTMLElement>();

  // 現在の表示モードを追跡
  private containerModes = new Map<string, 'normal' | 'fullscreen' | 'split'>();

  constructor() {
    super('TerminalContainerManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });
  }

  /**
   * コーディネーターを設定
   */
  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    this.log('Coordinator set');
  }

  /**
   * 初期化処理
   */
  protected doInitialize(): void {
    this.log('Initializing TerminalContainerManager');

    // 既存のコンテナをキャッシュに登録
    this.discoverExistingContainers();

    this.log('TerminalContainerManager initialized successfully');
  }

  /**
   * 既存のコンテナを検出してキャッシュに登録
   */
  private discoverExistingContainers(): void {
    // .terminal-container クラスを持つ要素をすべて検出
    const containers = document.querySelectorAll('.terminal-container');

    containers.forEach((container) => {
      const terminalId = container.getAttribute('data-terminal-id');
      if (terminalId && container instanceof HTMLElement) {
        this.containerCache.set(terminalId, container);
        this.log(`Discovered existing container: ${terminalId}`);
      }
    });

    this.log(`Discovered ${this.containerCache.size} existing containers`);
  }

  /**
   * コンテナを登録
   */
  public registerContainer(terminalId: string, container: HTMLElement): void {
    this.containerCache.set(terminalId, container);
    this.containerModes.set(terminalId, 'normal');
    this.log(`Registered container: ${terminalId}`);
  }

  /**
   * コンテナの登録を解除
   */
  public unregisterContainer(terminalId: string): void {
    this.containerCache.delete(terminalId);
    this.containerModes.delete(terminalId);
    this.log(`Unregistered container: ${terminalId}`);
  }

  /**
   * コンテナの表示/非表示を設定
   */
  public setContainerVisibility(terminalId: string, visible: boolean): void {
    const container = this.getContainer(terminalId);
    if (!container) {
      this.log(`Container not found: ${terminalId}`, 'warn');
      return;
    }

    if (visible) {
      container.classList.remove('hidden-mode');
      container.style.display = '';
      this.log(`Container visible: ${terminalId}`);
    } else {
      container.classList.add('hidden-mode');
      this.log(`Container hidden: ${terminalId}`);
    }
  }

  /**
   * コンテナの表示モードを設定
   */
  public setContainerMode(
    terminalId: string,
    mode: 'normal' | 'fullscreen' | 'split'
  ): void {
    const container = this.getContainer(terminalId);
    if (!container) {
      this.log(`Container not found: ${terminalId}`, 'warn');
      return;
    }

    // 既存のモードクラスを削除
    container.classList.remove('normal-mode', 'fullscreen-mode', 'split-mode');

    // 新しいモードクラスを追加
    container.classList.add(`${mode}-mode`);

    // モードを記録
    this.containerModes.set(terminalId, mode);

    this.log(`Container mode set: ${terminalId} -> ${mode}`);
  }

  /**
   * コンテナを取得（キャッシュ優先）
   */
  public getContainer(terminalId: string): HTMLElement | null {
    // キャッシュから取得を試みる
    let container: HTMLElement | undefined | null = this.containerCache.get(terminalId);

    if (container) {
      // DOMに存在するか確認
      if (document.contains(container)) {
        return container;
      } else {
        // キャッシュから削除
        this.containerCache.delete(terminalId);
        this.log(`Stale cache entry removed: ${terminalId}`, 'warn');
      }
    }

    // DOMから検索
    container = this.findContainerInDOM(terminalId);

    if (container) {
      // キャッシュに登録
      this.containerCache.set(terminalId, container);
      this.log(`Container found and cached: ${terminalId}`);
    }

    return container ?? null;
  }

  /**
   * DOMからコンテナを検索
   */
  private findContainerInDOM(terminalId: string): HTMLElement | null {
    // data-terminal-id 属性で検索
    const selector = `.terminal-container[data-terminal-id="${terminalId}"]`;
    const container = document.querySelector(selector);

    if (container instanceof HTMLElement) {
      return container;
    }

    // IDベースでフォールバック検索
    const idSelectors = [
      `#terminal-${terminalId}`,
      `#split-terminal-${terminalId}`,
      `#primary-terminal`, // 特殊ケース
    ];

    for (const idSelector of idSelectors) {
      const element = document.querySelector(idSelector);
      if (element instanceof HTMLElement) {
        const dataId = element.getAttribute('data-terminal-id');
        if (dataId === terminalId) {
          return element;
        }
      }
    }

    return null;
  }

  /**
   * すべてのコンテナを取得
   */
  public getAllContainers(): Map<string, HTMLElement> {
    // キャッシュを検証して返す
    const validContainers = new Map<string, HTMLElement>();

    this.containerCache.forEach((container, terminalId) => {
      if (document.contains(container)) {
        validContainers.set(terminalId, container);
      } else {
        // 無効なキャッシュエントリを削除
        this.containerCache.delete(terminalId);
        this.log(`Removed stale cache entry: ${terminalId}`, 'warn');
      }
    });

    return validContainers;
  }

  /**
   * コンテナのモードを取得
   */
  public getContainerMode(terminalId: string): 'normal' | 'fullscreen' | 'split' | null {
    return this.containerModes.get(terminalId) || null;
  }

  /**
   * すべてのコンテナを通常モードに戻す
   */
  public resetAllToNormalMode(): void {
    this.containerCache.forEach((container, terminalId) => {
      this.setContainerMode(terminalId, 'normal');
      this.setContainerVisibility(terminalId, true);
    });

    this.log('All containers reset to normal mode');
  }

  /**
   * デバッグ情報を取得
   */
  public getDebugInfo(): {
    cachedContainers: number;
    modes: Record<string, string>;
  } {
    const modes: Record<string, string> = {};
    this.containerModes.forEach((mode, terminalId) => {
      modes[terminalId] = mode;
    });

    return {
      cachedContainers: this.containerCache.size,
      modes,
    };
  }

  /**
   * ログ出力のヘルパー
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[TerminalContainerManager]';

    switch (level) {
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  /**
   * クリーンアップ処理
   */
  protected doDispose(): void {
    this.log('Disposing TerminalContainerManager');

    // すべてのコンテナを通常モードに戻す
    this.resetAllToNormalMode();

    // キャッシュをクリア
    this.containerCache.clear();
    this.containerModes.clear();

    this.coordinator = null;

    this.log('TerminalContainerManager disposed successfully');
  }
}
