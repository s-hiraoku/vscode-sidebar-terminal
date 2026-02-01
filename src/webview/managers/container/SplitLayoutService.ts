/**
 * Split Layout Service
 *
 * Extracted from TerminalContainerManager for better maintainability.
 * Handles split layout creation, wrapper management, and resizer handling.
 */

import { containerLogger } from '../../utils/ManagerLogger';
import { SPLIT_LAYOUT_CONSTANTS } from '../../constants/webview';

/**
 * Interface for coordinator with updateSplitResizers method
 */
interface IResizeCoordinator {
  updateSplitResizers?(): void;
}

/**
 * Service for managing split terminal layouts
 */
export class SplitLayoutService {
  /** Cache of split wrapper elements by terminal ID */
  private splitWrapperCache = new Map<string, HTMLElement>();

  /** Set of split resizer elements */
  private splitResizers = new Set<HTMLElement>();

  /** Reference to coordinator for calling updateSplitResizers */
  private coordinator: IResizeCoordinator | null = null;

  /**
   * Set the coordinator reference for resizer initialization
   */
  public setCoordinator(coordinator: IResizeCoordinator): void {
    this.coordinator = coordinator;
  }

  /**
   * Get the split wrapper cache
   */
  public getSplitWrapperCache(): Map<string, HTMLElement> {
    return this.splitWrapperCache;
  }

  /**
   * Get the split resizers set
   */
  public getSplitResizers(): Set<HTMLElement> {
    return this.splitResizers;
  }

  /**
   * Get the cached wrapper for a terminal
   */
  public getWrapper(terminalId: string): HTMLElement | undefined {
    return this.splitWrapperCache.get(terminalId);
  }

  /**
   * Cache a wrapper for a terminal
   */
  public cacheWrapper(terminalId: string, wrapper: HTMLElement): void {
    this.splitWrapperCache.set(terminalId, wrapper);
  }

  /**
   * Remove a wrapper from cache
   */
  public removeWrapper(terminalId: string): boolean {
    return this.splitWrapperCache.delete(terminalId);
  }

  /**
   * Refresh split artifacts from DOM
   */
  public refreshSplitArtifacts(): void {
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

  /**
   * Activate split layout for terminals
   */
  public activateSplitLayout(
    terminalBody: HTMLElement,
    orderedTerminalIds: string[],
    splitDirection: 'vertical' | 'horizontal',
    getContainer: (terminalId: string) => HTMLElement | undefined
  ): void {
    const terminalCount = orderedTerminalIds.length;

    if (terminalCount === 0) {
      containerLogger.warn('No terminals to display in split mode');
      return;
    }

    containerLogger.info(
      '🎨 [LAYOUT] ==================== ACTIVATING SPLIT LAYOUT ===================='
    );
    containerLogger.info(`🎨 [LAYOUT] Terminal count: ${terminalCount}`);
    containerLogger.info(`🎨 [LAYOUT] Split direction: ${splitDirection}`);

    // 🎯 CORRECT MAPPING:
    // Panel (horizontal) → row (横並び) - wide layout needs side-by-side
    // Sidebar (vertical) → column (縦並び) - tall layout needs stacked
    const flexDirection = splitDirection === 'horizontal' ? 'row' : 'column';
    containerLogger.info(`🎨 [LAYOUT] CSS flexDirection will be set to: ${flexDirection}`);

    // 🔧 FIX: terminal-body flex-direction is ALWAYS column (for tab bar positioning)
    terminalBody.style.display = 'flex';
    terminalBody.style.flexDirection = 'column';
    terminalBody.style.height = '100%';
    terminalBody.style.width = '100%';
    terminalBody.style.overflow = 'hidden';
    terminalBody.style.padding = '0';
    terminalBody.style.margin = '0';

    // 🆕 Get or create terminals-wrapper and apply layout direction
    const terminalsWrapper = this.ensureTerminalsWrapper(terminalBody);

    // Sync CSS class for resizer orientation
    terminalsWrapper.classList.toggle('terminal-split-horizontal', splitDirection === 'horizontal');

    // Apply flex-direction to terminals-wrapper
    terminalsWrapper.style.flexDirection = flexDirection;
    containerLogger.info(
      `🎨 [LAYOUT] ✅ terminals-wrapper flexDirection applied: ${terminalsWrapper.style.flexDirection}`
    );

    // 🔧 FIX: Rebuild split layout from scratch to avoid leftover fullscreen sizing.
    // Collect containers first, then clear wrapper contents, then re-append in wrappers.
    const containersToWrap: Array<{ id: string; container: HTMLElement }> = [];
    orderedTerminalIds.forEach((terminalId) => {
      const container = getContainer(terminalId);
      if (container) {
        containersToWrap.push({ id: terminalId, container });
      } else {
        containerLogger.error(`Container not found for terminal: ${terminalId}`);
      }
    });

    terminalsWrapper.textContent = '';
    this.splitWrapperCache.clear();
    this.splitResizers.clear();

    containersToWrap.forEach(({ id: terminalId, container }, index) => {

      containerLogger.debug(
        `🎨 [SPLIT-LAYOUT] Processing terminal ${index + 1}/${terminalCount}: ${terminalId}`
      );

      // Create wrapper with equal flex distribution
      const wrapper = this.createSplitWrapper(terminalId, splitDirection);
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
      terminalsWrapper.appendChild(wrapper);
      this.splitWrapperCache.set(terminalId, wrapper);

      // Add resizer between terminals (not after the last one)
      // 🔧 FIX: Use containersToWrap instead of orderedTerminalIds to ensure
      // data-resizer-after always references an existing wrapper
      if (index < containersToWrap.length - 1) {
        const nextTerminalId = containersToWrap[index + 1].id;
        const resizer = this.createSplitResizer(splitDirection);
        // Add data attributes for drag-to-resize functionality
        resizer.setAttribute('data-resizer-before', terminalId);
        resizer.setAttribute('data-resizer-after', nextTerminalId);
        terminalsWrapper.appendChild(resizer);
        this.splitResizers.add(resizer);
      }
    });

    containerLogger.info(
      `Split layout activated: ${containersToWrap.length} wrappers, ${this.splitResizers.size} resizers`
    );

    // 🔧 FIX: Initialize split resizers for drag-to-resize functionality
    // Use setTimeout to ensure DOM is fully updated after layout creation
    if (this.coordinator?.updateSplitResizers) {
      setTimeout(() => {
        this.coordinator?.updateSplitResizers?.();
        containerLogger.info('Split resizers initialized after layout activation');
      }, 50);
    }
  }

  /**
   * Create a split wrapper element
   *
   * 🎯 LAYOUT STRATEGY:
   * - Sidebar (vertical): Terminals stacked vertically, each takes full width
   * - Panel (horizontal): Terminals side-by-side, each takes full height
   */
  public createSplitWrapper(
    terminalId: string,
    splitDirection: 'vertical' | 'horizontal'
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

    // 🎯 CRITICAL: Apply layout based on split direction
    if (splitDirection === 'vertical') {
      // Sidebar mode: Terminals stacked vertically
      // Each terminal takes FULL WIDTH of the sidebar
      wrapper.style.width = '100%';
      wrapper.style.minWidth = '0'; // 🔧 FIX: Allow content to determine min-width
      wrapper.style.minHeight = '0'; // Allow shrinking below content size
    } else {
      // Panel mode: Terminals side-by-side horizontally
      // Each terminal takes FULL HEIGHT of the panel
      wrapper.style.height = '100%';
      wrapper.style.minWidth = '0'; // Allow shrinking below content size
      wrapper.style.minHeight = '0'; // 🔧 FIX: Allow content to determine min-height
    }

    this.getWrapperArea(wrapper, terminalId, true);
    return wrapper;
  }

  /**
   * Create a split resizer element
   */
  public createSplitResizer(direction: 'vertical' | 'horizontal'): HTMLElement {
    const resizer = document.createElement('div');
    resizer.className = 'split-resizer';
    const resizerSize = `${SPLIT_LAYOUT_CONSTANTS.RESIZER_SIZE_PX}px`;
    if (direction === 'horizontal') {
      resizer.style.width = resizerSize;
      resizer.style.cursor = 'col-resize';
    } else {
      resizer.style.height = resizerSize;
      resizer.style.cursor = 'row-resize';
    }
    resizer.style.background = 'var(--vscode-widget-border, #454545)';
    resizer.style.flexShrink = '0';
    return resizer;
  }

  /**
   * Get or create wrapper area for a terminal
   */
  public getWrapperArea(
    wrapper: HTMLElement,
    terminalId: string,
    createIfMissing = false
  ): HTMLElement | null {
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

  /**
   * Ensure terminals-wrapper exists and return it
   */
  public ensureTerminalsWrapper(terminalBody: HTMLElement): HTMLElement {
    let terminalsWrapper = document.getElementById('terminals-wrapper');
    if (!terminalsWrapper) {
      containerLogger.warn('⚠️ [LAYOUT] terminals-wrapper not found, creating it');
      terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = 'terminals-wrapper';
      terminalsWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        flex: 1;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        padding: 4px;
        gap: 4px;
        box-sizing: border-box;
      `;

      // Move existing terminals into wrapper
      const existingTerminals = Array.from(
        terminalBody.querySelectorAll('[data-terminal-container]')
      );
      terminalBody.appendChild(terminalsWrapper);
      existingTerminals.forEach((terminal) => {
        terminalsWrapper!.appendChild(terminal);
      });
    }
    return terminalsWrapper;
  }

  /**
   * Remove all split artifacts from DOM
   */
  public removeSplitArtifacts(terminalBody: HTMLElement): void {
    terminalBody.querySelectorAll<HTMLElement>('[data-terminal-wrapper-id]').forEach((wrapper) => {
      wrapper.remove();
    });

    terminalBody.querySelectorAll<HTMLElement>('.split-resizer').forEach((resizer) => {
      resizer.remove();
    });

    this.splitWrapperCache.clear();
    this.splitResizers.clear();
  }

  /**
   * Clear all caches
   */
  public clear(): void {
    this.splitWrapperCache.clear();
    this.splitResizers.clear();
  }
}
