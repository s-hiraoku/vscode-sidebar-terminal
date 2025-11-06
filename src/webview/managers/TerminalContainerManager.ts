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
import {
  IManagerCoordinator,
  ITerminalContainerManager,
  TerminalDisplayState,
  TerminalDisplaySnapshot,
} from '../interfaces/ManagerInterfaces';

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

  // Splitレイアウト用アーティファクト
  private splitWrapperCache = new Map<string, HTMLElement>();
  private splitResizers = new Set<HTMLElement>();

  // フルスクリーン時に退避させるためのストレージ
  private hiddenContainerStorage: HTMLElement | null = null;

  // 現在の表示状態
  private currentDisplayState: TerminalDisplayState = {
    mode: 'normal',
    activeTerminalId: null,
    orderedTerminalIds: [],
  };

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
    this.unregisterSplitWrapper(terminalId);
    this.log(`Unregistered container: ${terminalId}`);
  }

  /**
   * Splitレイアウト用のラッパーを登録
   */
  public registerSplitWrapper(terminalId: string, wrapper: HTMLElement): void {
    if (!wrapper) {
      return;
    }

    wrapper.classList.add('split-terminal-container');
    wrapper.setAttribute('data-terminal-wrapper-id', terminalId);
    this.splitWrapperCache.set(terminalId, wrapper);
    this.log(`Registered split wrapper: ${terminalId}`);
  }

  /**
   * Splitラッパーの登録解除
   */
  public unregisterSplitWrapper(terminalId: string): void {
    const wrapper = this.splitWrapperCache.get(terminalId);
    if (wrapper) {
      wrapper.remove();
      this.splitWrapperCache.delete(terminalId);
    }
  }

  /**
   * Splitレイアウト用のリサイズハンドルを登録
   */
  public registerSplitResizer(resizer: HTMLElement): void {
    if (!resizer) {
      return;
    }

    resizer.classList.add('split-resizer');
    this.splitResizers.add(resizer);
  }

  /**
   * コンテナの表示/非表示を設定
   */
  public setContainerVisibility(terminalId: string, visible: boolean): void {
    this.log(`🔍 [VISIBILITY] setContainerVisibility called: ${terminalId}, visible: ${visible}`);

    const container = this.getContainer(terminalId);
    if (!container) {
      this.log(`❌ [VISIBILITY] Container not found: ${terminalId}`, 'warn');
      return;
    }

    this.log(`✅ [VISIBILITY] Container found for ${terminalId}, current display: ${container.style.display}, classes: ${container.className}`);

    if (visible) {
      // 表示: hidden-modeクラスを削除し、displayを明示的に設定
      container.classList.remove('hidden-mode');
      // flexまたはblockを明示的に設定（デフォルトはflex）
      container.style.display = 'flex';
      this.log(`✅ [VISIBILITY] Container visible: ${terminalId}, new display: ${container.style.display}, classes: ${container.className}`);
    } else {
      // 非表示: hidden-modeクラスを追加し、displayをnoneに
      container.classList.add('hidden-mode');
      container.style.display = 'none';
      this.log(`🔒 [VISIBILITY] Container hidden: ${terminalId}, new display: ${container.style.display}, classes: ${container.className}`);
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

    this.refreshSplitArtifacts();

    const orderedIds = this.resolveOrderedIds(state.orderedTerminalIds);

    if (state.mode === 'split') {
      this.clearSplitArtifacts();
      this.activateSplitLayout(terminalBody, orderedIds, state.splitDirection ?? 'vertical');
    } else {
      this.clearSplitArtifacts();
    }

    const containerMap = this.getAllContainers();

    containerMap.forEach((container, terminalId) => {
      switch (state.mode) {
        case 'fullscreen': {
          const isActive = state.activeTerminalId === terminalId;
          this.setContainerMode(terminalId, isActive ? 'fullscreen' : 'normal');
          this.setContainerVisibility(terminalId, isActive);
          container.classList.toggle('terminal-container--fullscreen', isActive);
          container.classList.remove('terminal-container--split');
          if (isActive) {
            this.ensureContainerInBody(container, terminalBody);
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
          }
          break;
        }
        default: {
          this.setContainerMode(terminalId, 'normal');
          this.setContainerVisibility(terminalId, true);
          container.classList.remove('terminal-container--split', 'terminal-container--fullscreen');
          this.ensureContainerInBody(container, terminalBody);
          container.style.removeProperty('flex');
          container.style.removeProperty('height');
        }
      }
    });

    this.currentDisplayState = {
      mode: state.mode,
      activeTerminalId: state.activeTerminalId,
      orderedTerminalIds: orderedIds,
      splitDirection: state.splitDirection,
    };

    this.log(`Display state applied: ${state.mode}${state.activeTerminalId ? ` (active ${state.activeTerminalId})` : ''}`);

    if (state.mode === 'fullscreen') {
      this.enforceFullscreenState(state.activeTerminalId, terminalBody);
    } else if (state.mode === 'normal') {
      this.normalizeTerminalBody(terminalBody);
    }
  }

  /**
   * Splitアーティファクトを全て除去
   */
  public clearSplitArtifacts(): void {
    const terminalBody = this.getTerminalBody();
    const targetBody = terminalBody ?? document.getElementById('terminal-body');

    this.splitResizers.forEach((resizer) => {
      resizer.remove();
    });
    this.splitResizers.clear();

    this.splitWrapperCache.forEach((wrapper, terminalId) => {
      const container = this.containerCache.get(terminalId);
      if (container) {
        const area = this.getWrapperArea(wrapper, terminalId);
        if (area && area.contains(container)) {
          // 🔧 FIX: Append to terminals-wrapper instead of terminal-body
          const terminalsWrapper = document.getElementById('terminals-wrapper') || targetBody;
          terminalsWrapper?.appendChild(container);
        }
      }
      wrapper.remove();
    });
    this.splitWrapperCache.clear();

    if (targetBody) {
      // 🔧 FIX: terminal-body flexDirection is ALWAYS column
      targetBody.style.display = 'flex';
      targetBody.style.flexDirection = 'column';
      targetBody.style.height = '100%';
      targetBody.style.overflow = 'hidden';

      // 🎯 Use central handler to reset flex-direction (VS Code pattern)
      if (this.coordinator) {
        const updated = (this.coordinator as { updatePanelLocationIfNeeded?: () => boolean }).updatePanelLocationIfNeeded?.();
        if (updated !== undefined) {
          this.log(`🎨 [CLEAR-SPLIT] Flex-direction ${updated ? 'updated by central handler' : 'already correct'}`);
        }
      }

      this.normalizeTerminalBody(targetBody);
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
    this.log(`🔍 [DOM-SEARCH] Searching for container: ${terminalId}`);

    // data-terminal-id 属性で検索
    const selector = `.terminal-container[data-terminal-id="${terminalId}"]`;
    this.log(`🔍 [DOM-SEARCH] Using selector: ${selector}`);

    const container = document.querySelector(selector);

    if (container instanceof HTMLElement) {
      this.log(`✅ [DOM-SEARCH] Found container via data-terminal-id: ${terminalId}`);
      return container;
    }

    // IDベースでフォールバック検索
    const idSelectors = [
      `#terminal-${terminalId}`,
      `#split-terminal-${terminalId}`,
      `#primary-terminal`, // 特殊ケース
    ];

    this.log(`🔍 [DOM-SEARCH] Trying fallback selectors: ${idSelectors.join(', ')}`);

    for (const idSelector of idSelectors) {
      const element = document.querySelector(idSelector);
      if (element instanceof HTMLElement) {
        const dataId = element.getAttribute('data-terminal-id');
        this.log(`🔍 [DOM-SEARCH] Found element ${idSelector}, data-terminal-id: ${dataId}`);
        if (dataId === terminalId) {
          this.log(`✅ [DOM-SEARCH] Found container via ID selector: ${terminalId}`);
          return element;
        }
      }
    }

    this.log(`❌ [DOM-SEARCH] Container not found in DOM: ${terminalId}`);
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
   * コンテナのDOM順序を変更
   */
  public reorderContainers(order: string[]): void {
    if (!Array.isArray(order) || order.length === 0) {
      this.log('Invalid order array provided', 'warn');
      return;
    }

    // 🔧 FIX: Use terminals-wrapper as parent container (containers are now children of terminals-wrapper)
    let parentContainer = document.getElementById('terminals-wrapper');
    if (!parentContainer) {
      // Fallback to terminal-body for backward compatibility
      parentContainer = document.getElementById('terminal-body');
      this.log('terminals-wrapper not found, falling back to terminal-body', 'warn');
    }

    if (!parentContainer) {
      this.log('Neither terminals-wrapper nor terminal-body found', 'error');
      return;
    }

    this.log(`🔁 [REORDER] Reordering ${order.length} terminals in parent: ${parentContainer.id}`);

    // 順序に従ってコンテナを並べ替え
    const reorderedContainers: HTMLElement[] = [];

    for (const terminalId of order) {
      const container = this.containerCache.get(terminalId);
      if (container && container.parentElement === parentContainer) {
        reorderedContainers.push(container);
        this.log(`🔁 [REORDER]   Found container for terminal: ${terminalId}`);
      } else {
        this.log(`🔁 [REORDER]   ⚠️ Container not found or wrong parent: ${terminalId}`, 'warn');
      }
    }

    if (reorderedContainers.length === 0) {
      this.log('🔁 [REORDER] No containers to reorder', 'warn');
      return;
    }

    // 既存のコンテナを一時的に退避
    const fragment = document.createDocumentFragment();

    // 新しい順序でフラグメントに追加
    for (const container of reorderedContainers) {
      fragment.appendChild(container);
    }

    // フラグメントを親に追加（既存の要素は自動的に削除される）
    parentContainer.appendChild(fragment);

    this.log(`🔁 [REORDER] ✅ Successfully reordered ${reorderedContainers.length} containers`);
  }

  /**
   * デバッグ情報を取得
   */
  public getDebugInfo(): {
    cachedContainers: number;
    modes: Record<string, string>;
  } {
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
      if (this.isElementVisible(container)) {
        visibleTerminals.push(terminalId);
      }
    });

    const knownNodes = this.containerCache.size + this.splitWrapperCache.size;
    const domNodes = document.querySelectorAll('.terminal-container').length;

    return {
      mode: this.currentDisplayState.mode,
      activeTerminalId: this.currentDisplayState.activeTerminalId,
      visibleTerminals,
      registeredContainers: this.containerCache.size,
      registeredWrappers: this.splitWrapperCache.size,
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
   * ログ出力のヘルパー（BaseManagerのloggerを使用）
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    // BaseManagerのloggerを活用
    this.logger(message);

    // エラーレベルの場合は追加でconsole.errorに出力
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

    // すべてのコンテナを通常モードに戻す
    this.resetAllToNormalMode();

    // キャッシュをクリア
    this.containerCache.clear();
    this.containerModes.clear();
    this.splitWrapperCache.clear();
    this.splitResizers.clear();

    this.coordinator = null;

    this.log('TerminalContainerManager disposed successfully');
  }

  private getTerminalBody(): HTMLElement | null {
    return document.getElementById('terminal-body');
  }

  private ensureContainerInBody(container: HTMLElement, terminalBody: HTMLElement): void {
    // 🔧 FIX: Append to terminals-wrapper instead of terminal-body
    const terminalsWrapper = document.getElementById('terminals-wrapper') || terminalBody;
    if (container.parentElement !== terminalsWrapper) {
      terminalsWrapper.appendChild(container);
    }
  }

  private refreshSplitArtifacts(): void {
    const wrappers = document.querySelectorAll<HTMLElement>('[data-terminal-wrapper-id]');
    wrappers.forEach((wrapper) => {
      const terminalId = wrapper.getAttribute('data-terminal-wrapper-id');
      if (terminalId) {
        this.splitWrapperCache.set(terminalId, wrapper);
      }
    });

    const resizers = document.querySelectorAll<HTMLElement>('.split-resizer');
    if (resizers.length > 0) {
      this.splitResizers.clear();
      resizers.forEach((resizer) => this.splitResizers.add(resizer));
    }
  }

  private resolveOrderedIds(candidate?: string[]): string[] {
    if (candidate && candidate.length > 0) {
      return candidate;
    }
    return this.getContainerOrder();
  }

  private activateSplitLayout(
    terminalBody: HTMLElement,
    orderedTerminalIds: string[],
    splitDirection: 'vertical' | 'horizontal'
  ): void {
    const terminalCount = orderedTerminalIds.length;

    if (terminalCount === 0) {
      this.log('No terminals to display in split mode', 'warn');
      return;
    }

    this.log('🎨 [LAYOUT] ==================== ACTIVATING SPLIT LAYOUT ====================');
    this.log(`🎨 [LAYOUT] Terminal count: ${terminalCount}`);
    this.log(`🎨 [LAYOUT] Split direction: ${splitDirection}`);

    // 🎯 CORRECT MAPPING:
    // Panel (horizontal) → row (横並び) - wide layout needs side-by-side
    // Sidebar (vertical) → column (縦並び) - tall layout needs stacked
    const flexDirection = splitDirection === 'horizontal' ? 'row' : 'column';
    this.log(`🎨 [LAYOUT] CSS flexDirection will be set to: ${flexDirection}`);
    this.log(`🎨 [LAYOUT] Explanation: ${splitDirection} → ${flexDirection} → ${flexDirection === 'row' ? '横並び (side by side)' : '縦並び (stacked)'}`);

    // 🔧 FIX: terminal-body flex-direction is ALWAYS column (for tab bar positioning)
    // We change terminals-wrapper flex-direction instead
    terminalBody.style.display = 'flex';
    terminalBody.style.flexDirection = 'column';
    terminalBody.style.height = '100%';
    terminalBody.style.width = '100%';
    terminalBody.style.overflow = 'hidden';
    terminalBody.style.padding = '0';
    terminalBody.style.margin = '0';

    this.log(`🎨 [LAYOUT] ✅ Terminal body flexDirection fixed to: column (tab bar on top)`);

    // 🆕 Get or create terminals-wrapper and apply layout direction
    let terminalsWrapper = document.getElementById('terminals-wrapper');
    if (!terminalsWrapper) {
      this.log('⚠️ [LAYOUT] terminals-wrapper not found, creating it');
      terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = 'terminals-wrapper';
      terminalsWrapper.style.cssText = `
        display: flex;
        flex: 1;
        width: 100%;
        height: 100%;
        overflow: hidden;
        padding: 4px;
        gap: 4px;
        box-sizing: border-box;
      `;

      // Move existing terminals into wrapper
      const existingTerminals = Array.from(terminalBody.querySelectorAll('[data-terminal-container]'));
      terminalBody.appendChild(terminalsWrapper);
      existingTerminals.forEach((terminal) => {
        terminalsWrapper!.appendChild(terminal);
      });
    }

    // Apply flex-direction to terminals-wrapper
    terminalsWrapper.style.flexDirection = flexDirection;
    this.log(`🎨 [LAYOUT] ✅ terminals-wrapper flexDirection applied: ${terminalsWrapper.style.flexDirection}`);

    // Get actual computed style to verify
    const computedStyle = window.getComputedStyle(terminalsWrapper);
    this.log(`🎨 [LAYOUT] Computed flexDirection: ${computedStyle.flexDirection}`);
    this.log('🎨 [LAYOUT] =================================================================');

    // 🔧 FIX: Before creating wrappers, ensure all containers are in terminals-wrapper
    orderedTerminalIds.forEach((terminalId) => {
      const container = this.getContainer(terminalId);
      if (container && container.parentElement !== terminalsWrapper) {
        this.log(`🔧 [SPLIT-FIX] Moving ${terminalId} container to terminals-wrapper before split layout`);
        terminalsWrapper!.appendChild(container);
      }
    });

    orderedTerminalIds.forEach((terminalId, index) => {
      const container = this.getContainer(terminalId);
      if (!container) {
        this.log(`Container not found for terminal: ${terminalId}`, 'error');
        return;
      }

      this.log(`🎨 [SPLIT-LAYOUT] Processing terminal ${index + 1}/${terminalCount}: ${terminalId}`);
      this.log(`🎨 [SPLIT-LAYOUT]   Container size before: ${container.offsetWidth}x${container.offsetHeight}`);

      // Create wrapper with equal flex distribution
      const wrapper = this.createSplitWrapper(terminalId, splitDirection, terminalCount);
      const area = this.getWrapperArea(wrapper, terminalId, true);
      if (area) {
        area.appendChild(container);
      }

      // Setup container styles for split mode
      container.classList.remove('terminal-container--fullscreen', 'hidden-mode');
      container.classList.add('terminal-container--split');
      container.style.display = 'flex';
      container.style.flex = '1 1 auto';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '0';

      // 🔧 FIX: Append wrapper to terminals-wrapper instead of terminal-body
      terminalsWrapper!.appendChild(wrapper);
      this.splitWrapperCache.set(terminalId, wrapper);

      this.log(`🎨 [SPLIT-LAYOUT]   Wrapper appended to DOM`);

      // Add resizer between terminals (not after the last one)
      if (index < orderedTerminalIds.length - 1) {
        const resizer = this.createSplitResizer(splitDirection);
        // 🔧 FIX: Append resizer to terminals-wrapper instead of terminal-body
        terminalsWrapper!.appendChild(resizer);
        this.splitResizers.add(resizer);
      }
    });

    this.log(`Split layout activated: ${orderedTerminalIds.length} wrappers, ${this.splitResizers.size} resizers`);
  }

  private createSplitWrapper(
    terminalId: string,
    splitDirection: 'vertical' | 'horizontal',
    _terminalCount: number
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'terminal-split-wrapper';
    wrapper.setAttribute('data-terminal-wrapper-id', terminalId);

    // Wrapper contains terminal content
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';

    // Equal flex distribution - let flexbox handle the math
    // flex: 1 1 0 means: grow equally, shrink equally, base size 0
    wrapper.style.flex = '1 1 0';

    if (splitDirection === 'vertical') {
      wrapper.style.width = '100%';
      wrapper.style.minHeight = '0'; // Allow shrinking below content size
    } else {
      wrapper.style.height = '100%';
      wrapper.style.minWidth = '0'; // Allow shrinking below content size
    }

    this.getWrapperArea(wrapper, terminalId, true);
    return wrapper;
  }

  private createSplitResizer(direction: 'vertical' | 'horizontal'): HTMLElement {
    const resizer = document.createElement('div');
    resizer.className = 'split-resizer';
    if (direction === 'horizontal') {
      resizer.style.width = '4px';
      resizer.style.cursor = 'col-resize';
    } else {
      resizer.style.height = '4px';
      resizer.style.cursor = 'row-resize';
    }
    resizer.style.background = 'var(--vscode-widget-border, #454545)';
    resizer.style.flexShrink = '0';
    return resizer;
  }

  private isElementVisible(element: HTMLElement): boolean {
    if (!element) {
      return false;
    }
    return element.style.display !== 'none' && !element.classList.contains('hidden-mode');
  }

  private getWrapperArea(wrapper: HTMLElement, terminalId: string, createIfMissing = false): HTMLElement | null {
    let area = wrapper.querySelector<HTMLElement>(`[data-terminal-area-id="${terminalId}"]`);
    if (!area && createIfMissing) {
      area = document.createElement('div');
      area.setAttribute('data-terminal-area-id', terminalId);
      area.style.flex = '1 1 auto';
      area.style.display = 'flex';
      area.style.flexDirection = 'column';
      wrapper.appendChild(area);
    }
    return area ?? null;
  }

  private enforceFullscreenState(activeTerminalId: string | null, terminalBody: HTMLElement): void {
    const containers = terminalBody.querySelectorAll<HTMLElement>('.terminal-container');
    const hiddenStorage = this.getHiddenStorage(terminalBody, true);

    containers.forEach((container) => {
      const containerId = container.getAttribute('data-terminal-id');
      const isActive = containerId !== null && containerId === activeTerminalId;

      if (isActive) {
        container.style.display = 'flex';
        container.style.width = '100%';
        container.style.height = '100%';
        container.classList.remove('hidden-mode');
        container.classList.add('terminal-container--fullscreen');
        // 🔧 FIX: Append to terminals-wrapper instead of terminal-body
        const terminalsWrapper = document.getElementById('terminals-wrapper') || terminalBody;
        terminalsWrapper.appendChild(container);
      } else {
        container.style.display = 'none';
        container.classList.add('hidden-mode');
        container.classList.remove('terminal-container--fullscreen', 'terminal-container--split');
        if (hiddenStorage && container.parentElement !== hiddenStorage) {
          hiddenStorage.appendChild(container);
        }
      }
    });

    terminalBody.querySelectorAll<HTMLElement>('[data-terminal-wrapper-id]').forEach((wrapper) => {
      wrapper.remove();
    });

    terminalBody.querySelectorAll<HTMLElement>('.split-resizer').forEach((resizer) => {
      resizer.remove();
    });
  }

  private normalizeTerminalBody(terminalBody: HTMLElement): void {
    const storage = this.getHiddenStorage(terminalBody, false);
    if (storage) {
      this.containerCache.forEach((container) => {
        if (container.parentElement === storage) {
          // 🔧 FIX: Append to terminals-wrapper instead of terminal-body
          const terminalsWrapper = document.getElementById('terminals-wrapper') || terminalBody;
          terminalsWrapper.appendChild(container);
        }
      });
      storage.innerHTML = '';
    }

    this.containerCache.forEach((container) => {
      container.classList.remove('terminal-container--fullscreen');
      container.style.removeProperty('height');
      container.style.removeProperty('width');
      if (container.classList.contains('hidden-mode')) {
        container.style.display = 'none';
      } else {
        container.style.removeProperty('display');
      }
    });
  }

  private getHiddenStorage(terminalBody: HTMLElement, createIfMissing: boolean): HTMLElement | null {
    if (this.hiddenContainerStorage && document.contains(this.hiddenContainerStorage)) {
      return this.hiddenContainerStorage;
    }

    if (!createIfMissing) {
      return null;
    }

    const storage = document.createElement('div');
    storage.id = 'terminal-hidden-storage';
    storage.style.display = 'none';
    terminalBody.appendChild(storage);
    this.hiddenContainerStorage = storage;
    return storage;
  }
}
