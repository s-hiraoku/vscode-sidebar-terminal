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
 *
 * Migrated to constructor injection pattern (Issue #216)
 * Refactored to use extracted services for better maintainability.
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { BaseManager } from './BaseManager';
import {
  IManagerCoordinator,
  ITerminalContainerManager,
  TerminalDisplayState,
  TerminalDisplaySnapshot,
} from '../interfaces/ManagerInterfaces';
import {
  SplitLayoutService,
  ContainerVisibilityService,
  type IResizeCoordinator,
} from './container';
import { DOMUtils } from '../utils/DOMUtils';
import { shouldUseGrid } from '../utils/GridLayoutCalculator';

/**
 * TerminalContainerManager
 *
 * ターミナルコンテナのライフサイクルと表示状態を管理
 * Uses constructor injection for coordinator dependency (Issue #216)
 */
export class TerminalContainerManager extends BaseManager implements ITerminalContainerManager {
  private readonly coordinator: IManagerCoordinator;

  // Extracted services
  private readonly splitLayoutService: SplitLayoutService;
  private readonly visibilityService: ContainerVisibilityService;

  // コンテナのキャッシュ（パフォーマンス最適化）
  private containerCache = new Map<string, HTMLElement>();

  // 現在の表示モードを追跡
  private containerModes = new Map<string, 'normal' | 'fullscreen' | 'split'>();

  // 現在の表示状態
  private currentDisplayState: TerminalDisplayState = {
    mode: 'normal',
    activeTerminalId: null,
    orderedTerminalIds: [],
  };

  constructor(coordinator: IManagerCoordinator) {
    super('TerminalContainerManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.coordinator = coordinator;
    this.splitLayoutService = new SplitLayoutService();
    this.visibilityService = new ContainerVisibilityService();
  }

  /**
   * 初期化処理
   */
  protected doInitialize(): void {
    this.log('Initializing TerminalContainerManager');
    this.discoverExistingContainers();

    // 🔧 FIX: Pass coordinator to SplitLayoutService for resizer initialization
    // This enables automatic resizer initialization after split layout activation
    // Create a type-safe adapter implementing IResizeCoordinator
    const resizeCoordinator: IResizeCoordinator = {
      updateSplitResizers:
        'updateSplitResizers' in this.coordinator
          ? () => (this.coordinator as { updateSplitResizers: () => void }).updateSplitResizers()
          : undefined,
    };
    this.splitLayoutService.setCoordinator(resizeCoordinator);

    this.log('TerminalContainerManager initialized successfully');
  }

  /**
   * 既存のコンテナを検出してキャッシュに登録
   */
  private discoverExistingContainers(): void {
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
    this.log(
      `✅ [REGISTER] Container registered: ${terminalId}, cache size: ${this.containerCache.size}`
    );
  }

  /**
   * コンテナの登録を解除
   */
  public unregisterContainer(terminalId: string): void {
    const existed = this.containerCache.has(terminalId);
    this.containerCache.delete(terminalId);
    this.containerModes.delete(terminalId);
    this.unregisterSplitWrapper(terminalId);
    this.log(`🗑️ [UNREGISTER] Container unregistered: ${terminalId}, existed: ${existed}`);
  }

  /**
   * Splitレイアウト用のラッパーを登録
   */
  public registerSplitWrapper(terminalId: string, wrapper: HTMLElement): void {
    if (!wrapper) return;
    wrapper.classList.add('split-terminal-container');
    wrapper.setAttribute('data-terminal-wrapper-id', terminalId);
    this.splitLayoutService.cacheWrapper(terminalId, wrapper);
    this.log(`Registered split wrapper: ${terminalId}`);
  }

  /**
   * Splitラッパーの登録解除
   */
  public unregisterSplitWrapper(terminalId: string): void {
    const wrapper = this.splitLayoutService.getWrapper(terminalId);
    if (wrapper) {
      wrapper.remove();
      this.splitLayoutService.removeWrapper(terminalId);
    }
  }

  /**
   * Splitレイアウト用のリサイズハンドルを登録
   */
  public registerSplitResizer(resizer: HTMLElement): void {
    if (!resizer) return;
    resizer.classList.add('split-resizer');
    this.splitLayoutService.getSplitResizers().add(resizer);
  }

  /**
   * コンテナの表示/非表示を設定
   */
  public setContainerVisibility(terminalId: string, visible: boolean): void {
    const container = this.getContainer(terminalId);
    if (!container) {
      this.log(`❌ [VISIBILITY] Container not found: ${terminalId}`, 'warn');
      return;
    }

    const terminalBody = this.getTerminalBody();
    if (visible) {
      this.visibilityService.showContainer(container);
    } else if (terminalBody) {
      this.visibilityService.hideContainer(container, terminalBody);
    }
  }

  /**
   * 表示状態を適用
   */
  public applyDisplayState(state: TerminalDisplayState): void {
    const terminalBody = this.getTerminalBody();
    if (!terminalBody) {
      this.log('Terminal body not found, cannot apply display state', 'error');
      return;
    }

    this.splitLayoutService.refreshSplitArtifacts();
    const orderedIds = this.resolveOrderedIds(state.orderedTerminalIds);

    if (state.mode === 'split') {
      // 🔧 FIX: Clear fullscreen inline heights before building split layout
      // This prevents the previously fullscreen container from occupying full height.
      this.containerCache.forEach((container) => {
        container.style.removeProperty('height');
        container.style.removeProperty('maxHeight');
        container.style.removeProperty('minHeight');
        DOMUtils.resetXtermInlineStyles(container, false);
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      document.body.offsetWidth;
    }

    if (state.mode === 'split') {
      this.clearSplitArtifacts();
      const splitDirection = state.splitDirection ?? 'vertical';
      const panelLocation: 'sidebar' | 'panel' = splitDirection === 'horizontal' ? 'panel' : 'sidebar';

      if (shouldUseGrid(orderedIds.length, panelLocation, true)) {
        this.splitLayoutService.activateGridLayout(
          terminalBody,
          orderedIds,
          (id) => this.containerCache.get(id)
        );
      } else {
        this.splitLayoutService.activateSplitLayout(
          terminalBody,
          orderedIds,
          splitDirection,
          (id) => this.containerCache.get(id)
        );
      }
    } else {
      this.clearSplitArtifacts();
    }

    this.applyModeToContainers(state, orderedIds, terminalBody);

    this.currentDisplayState = {
      mode: state.mode,
      activeTerminalId: state.activeTerminalId,
      orderedTerminalIds: orderedIds,
      splitDirection: state.splitDirection,
    };

    this.log(`Display state applied: ${state.mode}`);

    if (state.mode === 'fullscreen') {
      this.visibilityService.enforceFullscreenState(
        state.activeTerminalId,
        terminalBody,
        this.containerCache
      );
    } else if (state.mode === 'normal') {
      this.visibilityService.normalizeTerminalBody(terminalBody, this.containerCache);
    }
  }

  /**
   * Apply mode to all containers
   */
  private applyModeToContainers(
    state: TerminalDisplayState,
    orderedIds: string[],
    terminalBody: HTMLElement
  ): void {
    this.containerCache.forEach((container, terminalId) => {
      switch (state.mode) {
        case 'fullscreen': {
          const isActive = state.activeTerminalId === terminalId;
          this.setContainerMode(terminalId, isActive ? 'fullscreen' : 'normal');
          this.setContainerVisibility(terminalId, isActive);
          container.classList.toggle('terminal-container--fullscreen', isActive);
          container.classList.remove('terminal-container--split');
          if (isActive) {
            this.visibilityService.ensureContainerInBody(container, terminalBody);
            container.style.flex = '1 1 auto';
            container.style.width = '100%';
            container.style.height = '100%';
          } else {
            container.style.removeProperty('flex');
            container.style.removeProperty('height');
          }
          break;
        }
        case 'split': {
          const isVisible = orderedIds.includes(terminalId);
          this.setContainerMode(terminalId, 'split');
          this.setContainerVisibility(terminalId, isVisible);
          container.classList.toggle('terminal-container--split', isVisible);
          container.classList.remove('terminal-container--fullscreen');
          if (isVisible) {
            container.style.display = 'flex';
            container.style.flex = '1 1 auto';
            container.style.width = '100%';
            // 🔧 FIX: Clear fullscreen inline height so split layout can shrink containers
            container.style.removeProperty('height');
            container.style.removeProperty('maxHeight');
          }
          break;
        }
        default: {
          this.setContainerMode(terminalId, 'normal');
          this.setContainerVisibility(terminalId, true);
          container.classList.remove('terminal-container--split', 'terminal-container--fullscreen');
          this.visibilityService.ensureContainerInBody(container, terminalBody);
          container.style.removeProperty('flex');
          container.style.removeProperty('height');
        }
      }
    });
  }

  /**
   * Splitアーティファクトを全て除去
   */
  public clearSplitArtifacts(): void {
    const terminalBody = this.getTerminalBody();
    const targetBody = terminalBody ?? document.getElementById('terminal-body');

    // Clear tracked resizers first
    this.splitLayoutService.getSplitResizers().forEach((resizer) => resizer.remove());
    this.splitLayoutService.getSplitResizers().clear();

    // Remove any stale resizers still in the DOM (e.g., after restore or reorder)
    targetBody?.querySelectorAll<HTMLElement>('.split-resizer').forEach((resizer) => {
      resizer.remove();
    });

    // Clear wrappers and move containers back
    const splitWrapperCache = this.splitLayoutService.getSplitWrapperCache();
    splitWrapperCache.forEach((wrapper, terminalId) => {
      const container = this.containerCache.get(terminalId);
      if (container) {
        const area = this.splitLayoutService.getWrapperArea(wrapper, terminalId);
        if (area && area.contains(container)) {
          const terminalsWrapper = document.getElementById('terminals-wrapper') || targetBody;
          terminalsWrapper?.appendChild(container);
        }
      }
      wrapper.remove();
    });
    splitWrapperCache.clear();

    if (targetBody) {
      targetBody.style.display = 'flex';
      targetBody.style.flexDirection = 'column';
      targetBody.style.height = '100%';
      targetBody.style.overflow = 'hidden';

      if (this.coordinator) {
        const updated = (
          this.coordinator as { updatePanelLocationIfNeeded?: () => boolean }
        ).updatePanelLocationIfNeeded?.();
        if (updated !== undefined) {
          this.log(
            `🎨 [CLEAR-SPLIT] Flex-direction ${updated ? 'updated by central handler' : 'already correct'}`
          );
        }
      }

      this.visibilityService.normalizeTerminalBody(targetBody, this.containerCache);
    }
  }

  /**
   * コンテナの表示モードを設定
   */
  public setContainerMode(terminalId: string, mode: 'normal' | 'fullscreen' | 'split'): void {
    const container = this.getContainer(terminalId);
    if (!container) {
      this.log(`Container not found: ${terminalId}`, 'warn');
      return;
    }

    container.classList.remove('normal-mode', 'fullscreen-mode', 'split-mode');
    container.classList.add(`${mode}-mode`);
    this.containerModes.set(terminalId, mode);
    this.log(`Container mode set: ${terminalId} -> ${mode}`);
  }

  /**
   * コンテナを取得（キャッシュ優先）
   */
  public getContainer(terminalId: string): HTMLElement | null {
    let container: HTMLElement | undefined | null = this.containerCache.get(terminalId);

    if (container) {
      if (document.contains(container)) {
        return container;
      } else {
        this.containerCache.delete(terminalId);
        this.log(`Stale cache entry removed: ${terminalId}`, 'warn');
      }
    }

    container = this.findContainerInDOM(terminalId);
    if (container) {
      this.containerCache.set(terminalId, container);
      this.log(`Container found and cached: ${terminalId}`);
    }

    return container ?? null;
  }

  /**
   * DOMからコンテナを検索
   */
  private findContainerInDOM(terminalId: string): HTMLElement | null {
    const selector = `.terminal-container[data-terminal-id="${terminalId}"]`;
    const container = document.querySelector(selector);

    if (container instanceof HTMLElement) {
      return container;
    }

    // IDベースでフォールバック検索
    const idSelectors = [
      `#terminal-${terminalId}`,
      `#split-terminal-${terminalId}`,
      `#primary-terminal`,
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
    const validContainers = new Map<string, HTMLElement>();
    this.containerCache.forEach((container, terminalId) => {
      if (document.contains(container)) {
        validContainers.set(terminalId, container);
      } else {
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
    this.containerCache.forEach((_, terminalId) => {
      this.setContainerMode(terminalId, 'normal');
      this.setContainerVisibility(terminalId, true);
    });
    this.log('All containers reset to normal mode');
  }

  /**
   * コンテナのDOM順序を変更し、containerCacheの順序も更新
   * これにより getContainerOrder() が正しい順序を返すようになる
   */
  public reorderContainers(order: string[]): void {
    if (!Array.isArray(order) || order.length === 0) {
      this.log('Invalid order array provided', 'warn');
      return;
    }

    const reorderedContainers: HTMLElement[] = [];
    // Create new ordered cache to preserve drag-drop order
    const newContainerCache = new Map<string, HTMLElement>();
    const orderedIds: string[] = [];

    for (const terminalId of order) {
      const container = this.containerCache.get(terminalId);
      if (container && document.contains(container)) {
        reorderedContainers.push(container);
        newContainerCache.set(terminalId, container);
        orderedIds.push(terminalId);
      } else if (container) {
        this.containerCache.delete(terminalId);
      }
    }

    // Add any remaining containers not in order array (preserves containers not explicitly reordered)
    for (const [terminalId, container] of this.containerCache) {
      if (!newContainerCache.has(terminalId)) {
        newContainerCache.set(terminalId, container);
        orderedIds.push(terminalId);
      }
    }

    if (reorderedContainers.length === 0) {
      this.log('No containers to reorder', 'warn');
      return;
    }

    // Update containerCache with new order (ES2015 Map preserves insertion order)
    this.containerCache = newContainerCache;

    // Split mode: rebuild layout based on new order to keep wrappers/resizers consistent
    if (this.currentDisplayState.mode === 'split') {
      this.applyDisplayState({
        mode: 'split',
        activeTerminalId: this.currentDisplayState.activeTerminalId,
        orderedTerminalIds: orderedIds,
        splitDirection: this.currentDisplayState.splitDirection ?? 'vertical',
      });
      return;
    }

    // Fullscreen mode: keep cache order but avoid DOM moves that break visibility
    if (this.currentDisplayState.mode === 'fullscreen') {
      this.log('Skipping DOM reorder in fullscreen mode');
      return;
    }

    let parentContainer = document.getElementById('terminals-wrapper');
    if (!parentContainer) {
      parentContainer = document.getElementById('terminal-body');
      this.log('terminals-wrapper not found, falling back to terminal-body', 'warn');
    }

    if (!parentContainer) {
      this.log('Neither terminals-wrapper nor terminal-body found', 'error');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const container of reorderedContainers) {
      fragment.appendChild(container);
    }
    parentContainer.appendChild(fragment);

    this.log(`✅ Successfully reordered ${reorderedContainers.length} containers, cache order updated`);
  }

  /**
   * デバッグ情報を取得
   */
  public getDebugInfo(): { cachedContainers: number; modes: Record<string, string> } {
    const snapshot = this.getDisplaySnapshot();
    return {
      cachedContainers: snapshot.registeredContainers,
      modes: Object.fromEntries(this.containerModes.entries()),
    };
  }

  /**
   * 表示スナップショットを取得
   */
  public getDisplaySnapshot(): TerminalDisplaySnapshot {
    const visibleTerminals: string[] = [];
    this.containerCache.forEach((container, terminalId) => {
      if (this.visibilityService.isElementVisible(container)) {
        visibleTerminals.push(terminalId);
      }
    });

    const splitWrapperCache = this.splitLayoutService.getSplitWrapperCache();
    const knownNodes = this.containerCache.size + splitWrapperCache.size;
    const domNodes = document.querySelectorAll('.terminal-container').length;

    return {
      mode: this.currentDisplayState.mode,
      activeTerminalId: this.currentDisplayState.activeTerminalId,
      visibleTerminals,
      registeredContainers: this.containerCache.size,
      registeredWrappers: splitWrapperCache.size,
      orphanNodeCount: Math.max(domNodes - knownNodes, 0),
    };
  }

  /**
   * 登録順にターミナルIDを取得
   */
  public getContainerOrder(): string[] {
    return Array.from(this.containerCache.keys());
  }

  /**
   * ログ出力のヘルパー
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this.logger(message);
    if (level === 'error') {
      console.error(`[TerminalContainerManager] ${message}`);
    } else if (level === 'warn') {
      console.warn(`[TerminalContainerManager] ${message}`);
    }
  }

  /**
   * クリーンアップ処理
   */
  protected doDispose(): void {
    this.log('Disposing TerminalContainerManager');
    this.resetAllToNormalMode();
    this.containerCache.clear();
    this.containerModes.clear();
    this.splitLayoutService.clear();
    this.visibilityService.clearHiddenStorage();
    this.log('TerminalContainerManager disposed successfully');
  }

  private getTerminalBody(): HTMLElement | null {
    return document.getElementById('terminal-body');
  }

  private resolveOrderedIds(candidate?: string[]): string[] {
    if (candidate && candidate.length > 0) {
      return candidate;
    }
    return this.getContainerOrder();
  }
}
