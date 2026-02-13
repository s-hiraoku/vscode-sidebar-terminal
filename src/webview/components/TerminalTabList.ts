/**
 * Terminal Tab List Component
 * Implements VS Code-style terminal tabs with switching, drag & drop, and management
 */

import { Terminal } from '@xterm/xterm';
import { webview as log } from '../../utils/logger';
import { TerminalTheme } from '../types/theme.types';

/**
 * Escape HTML special characters to prevent XSS when interpolating into innerHTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface TerminalTab {
  id: string;
  name: string;
  isActive: boolean;
  isDirty?: boolean;
  icon?: string;
  color?: string;
  isClosable: boolean;
  terminal?: Terminal;
}

export interface TerminalTabEvents {
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabRename: (tabId: string, newName: string) => void;
  onTabReorder: (fromIndex: number, toIndex: number, nextOrder: string[]) => void;
  onNewTab: () => void;
  onModeToggle?: () => void;
}

/**
 * Terminal Tab List Component
 * Manages terminal tabs with VS Code-style UI and interactions
 */
export class TerminalTabList {
  private container: HTMLElement;
  private tabsContainer!: HTMLElement;
  private modeIndicatorContainer!: HTMLElement;
  private modeIndicatorSymbol!: HTMLElement;
  private tabs: Map<string, TerminalTab> = new Map();
  private events: TerminalTabEvents;
  private draggedTab: string | null = null;
  private dropIndicator: HTMLElement;
  private dropTargetInfo: { id: string; position: 'before' | 'after' } | null = null;
  private currentMode: 'normal' | 'fullscreen' | 'split' = 'normal';
  // 🔧 FIX: Store current theme for use in setActiveTab
  private currentTheme: TerminalTheme | null = null;

  constructor(container: HTMLElement, events: TerminalTabEvents) {
    this.container = container;
    this.events = events;
    this.dropIndicator = this.createDropIndicator();
    this.setup();
  }

  private setup(): void {
    this.container.className = 'terminal-tabs-container';
    this.container.setAttribute('role', 'navigation');
    this.container.setAttribute('aria-label', 'Terminal tabs navigation');
    this.container.innerHTML = `
      <div class="terminal-tabs-list" role="tablist" aria-label="Terminal tabs">
        <div class="terminal-mode-indicator" role="status" aria-live="polite" data-mode="normal" aria-label="Single terminal layout" tabindex="0">
          <span class="terminal-mode-indicator-symbol" aria-hidden="true"></span>
        </div>
        <div class="terminal-tabs-scroll" role="region" aria-label="Terminal tabs list">
          <div class="terminal-tabs-wrapper">
            <!-- Tabs will be inserted here -->
          </div>
        </div>
      </div>
    `;
    this.tabsContainer = this.container.querySelector('.terminal-tabs-wrapper')!;
    this.modeIndicatorContainer = this.container.querySelector('.terminal-mode-indicator')!;
    this.modeIndicatorSymbol = this.container.querySelector('.terminal-mode-indicator-symbol')!;

    // 🆕 Mode indicator click -> toggle display mode
    this.modeIndicatorContainer.addEventListener('click', () => {
      log('🖥️ Mode indicator clicked - toggling display mode');
      if (this.events.onModeToggle) {
        this.events.onModeToggle();
      }
    });

    this.setupStyles();
    this.setupKeyboardNavigation();
    this.setupGlobalEventDelegation(); // 🆕 Global event delegation
  }

  private setupStyles(): void {
    // 🔧 FIX: Prevent duplicate style injection
    const existingStyle = document.getElementById('terminal-tab-list-styles');
    if (existingStyle) {
      return; // Styles already injected
    }

    const style = document.createElement('style');
    style.id = 'terminal-tab-list-styles';
    style.textContent = `
      .terminal-tabs-container {
        display: flex;
        flex-direction: column;
        background: var(--vscode-tab-inactiveBackground);
        border-bottom: 1px solid var(--vscode-tab-border);
        height: 24px;
        min-height: 24px;
        overflow: hidden;
      }

      .terminal-tabs-list {
        display: flex;
        flex: 1;
        align-items: stretch;
      }

      .terminal-mode-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        border-right: 1px solid var(--vscode-tab-border);
        color: var(--vscode-tab-activeForeground, var(--vscode-foreground));
        min-width: 28px;
        cursor: pointer;
        transition: background-color 0.1s ease;
      }

      .terminal-mode-indicator:hover {
        background: var(--vscode-toolbar-hoverBackground);
      }

      .terminal-mode-indicator-symbol {
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }

      .terminal-mode-indicator-symbol svg {
        width: 16px;
        height: 16px;
        display: block;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .terminal-tabs-scroll {
        flex: 1;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
      }

      .terminal-tabs-wrapper {
        display: flex;
        align-items: stretch;
        min-height: 100%;
        position: relative;
      }

      .terminal-tab {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 0 8px;
        min-width: 100px;
        max-width: 200px;
        height: 24px;
        gap: 4px;
        background: var(--vscode-tab-inactiveBackground);
        color: var(--vscode-tab-inactiveForeground);
        border-right: 1px solid var(--vscode-tab-border);
        cursor: pointer;
        user-select: none;
        position: relative;
        transition: background-color 0.1s ease;
        font-weight: normal;
      }

      .terminal-tab:hover {
        background: var(--vscode-tab-inactiveHoverBackground);
        color: var(--vscode-tab-inactiveHoverForeground);
      }

      .terminal-tab.active {
        background: var(--vscode-tab-activeBackground);
        color: var(--vscode-tab-activeForeground);
        border-bottom: 1px solid var(--vscode-tab-activeBorder, var(--vscode-focusBorder));
      }

      .terminal-tab.dragging {
        opacity: 0.5;
        z-index: 1000;
      }

      .terminal-tab-icon {
        width: 14px;
        height: 14px;
        margin-right: 4px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .terminal-tab-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        font-weight: normal;
        text-align: left;
        line-height: 24px;
        min-width: 0;
      }

      .terminal-tab-dirty-indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--vscode-gitDecoration-modifiedResourceForeground);
        margin-left: 4px;
        flex-shrink: 0;
      }

      .terminal-tab-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        margin-left: 4px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 2px;
        flex-shrink: 0;
        transition: background-color 0.1s ease;
        color: transparent !important;
        font-size: 16px !important;
        font-weight: normal !important;
        line-height: 16px !important;
        text-align: center;
      }

      .terminal-tab-close:hover {
        background: var(--vscode-toolbar-hoverBackground);
      }

      .terminal-tab:hover .terminal-tab-close {
        color: #ffffff !important;
      }

      .drop-indicator {
        position: absolute;
        width: 2px;
        height: 100%;
        background: var(--vscode-focusBorder);
        z-index: 999;
        opacity: 0;
        transition: opacity 0.1s ease;
      }

      .drop-indicator.visible {
        opacity: 1;
      }

      /* Scrollbar styling */
      .terminal-tabs-scroll::-webkit-scrollbar {
        height: 3px;
      }

      .terminal-tabs-scroll::-webkit-scrollbar-thumb {
        background: var(--vscode-scrollbarSlider-background);
        border-radius: 3px;
      }

      .terminal-tabs-scroll::-webkit-scrollbar-thumb:hover {
        background: var(--vscode-scrollbarSlider-hoverBackground);
      }
    `;
    document.head.appendChild(style);
  }

  private setupKeyboardNavigation(): void {
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateTabs(e.key === 'ArrowRight' ? 1 : -1);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't close tab when editing rename input
        if ((e.target as HTMLElement).closest('.terminal-tab-rename-input')) return;
        e.preventDefault();
        const activeTab = this.getActiveTab();
        if (activeTab && activeTab.isClosable) {
          this.events.onTabClose(activeTab.id);
        }
      }
    });
  }

  /**
   * 🆕 Setup global event delegation for all tab events
   * This prevents duplicate listeners when updateTabElement is called
   */
  private setupGlobalEventDelegation(): void {
    // 🔧 FIX: Track closing state to prevent double-click issues
    const closingTabs = new Set<string>();

    // Delegate click events for tabs and close buttons
    this.tabsContainer.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      log('🗂️ Tab container clicked:', target.className);

      // Handle close button click
      const closeButton = target.closest('.terminal-tab-close');
      if (closeButton) {
        e.stopPropagation();
        e.preventDefault();
        const tabElement = closeButton.closest('.terminal-tab');
        if (tabElement) {
          const tabId = tabElement.getAttribute('data-tab-id');
          if (tabId) {
            // 🔧 FIX: Prevent double-click from triggering multiple deletions
            if (closingTabs.has(tabId)) {
              log('🗂️ Close already in progress, ignoring:', tabId);
              return;
            }
            closingTabs.add(tabId);

            log('🗂️ Close button clicked for tab:', tabId);
            this.events.onTabClose(tabId);

            // Reset after a short delay
            setTimeout(() => closingTabs.delete(tabId), 500);
          }
        }
        return;
      }

      // Handle tab click
      const tabElement = target.closest('.terminal-tab');
      if (tabElement) {
        e.preventDefault();
        const tabId = tabElement.getAttribute('data-tab-id');
        if (tabId) {
          log('🗂️ Tab clicked:', tabId);
          this.events.onTabClick(tabId);
        }
      }
    });

    // Delegate double-click for rename
    this.tabsContainer.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;

      // Ignore double-click on close button
      if (target.closest('.terminal-tab-close')) return;

      // Ignore if already renaming (input element)
      if (target.tagName === 'INPUT') return;

      const tabElement = target.closest('.terminal-tab');
      if (tabElement) {
        e.preventDefault();
        e.stopPropagation();
        const tabId = tabElement.getAttribute('data-tab-id');
        if (tabId) {
          this.startRename(tabId);
        }
      }
    });

    // Delegate context menu
    this.tabsContainer.addEventListener('contextmenu', (e) => {
      const target = e.target as HTMLElement;
      const tabElement = target.closest('.terminal-tab');
      if (tabElement) {
        e.preventDefault();
        const tabId = tabElement.getAttribute('data-tab-id');
        if (tabId) {
          const tab = this.tabs.get(tabId);
          if (tab) {
            this.showContextMenu(e as MouseEvent, tab);
          }
        }
      }
    });
  }

  private navigateTabs(direction: number): void {
    const tabIds = Array.from(this.tabs.keys());
    const activeTab = this.getActiveTab();
    if (!activeTab) return;

    const currentIndex = tabIds.indexOf(activeTab.id);
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < tabIds.length) {
      const tabId = tabIds[newIndex];
      if (tabId) {
        this.events.onTabClick(tabId);
      }
    }
  }

  public addTab(tab: TerminalTab): void {
    // 🔧 FIX: Check for existing tab to prevent duplicates
    if (this.tabs.has(tab.id)) {
      log(`🗂️ [TAB-LIST] Tab already exists, updating: ${tab.id}`);
      this.updateTab(tab.id, tab);
      return;
    }

    this.tabs.set(tab.id, tab);
    const tabElement = this.createTabElement(tab);
    this.tabsContainer.appendChild(tabElement);
    this.updateTabVisibility();
    log(`🗂️ [TAB-LIST] Tab added: ${tab.id}`);
  }

  public removeTab(tabId: string): void {
    const tabElement = this.container.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabElement) {
      tabElement.remove();
    }
    this.tabs.delete(tabId);
    this.updateTabVisibility();
  }

  /**
   * 🔧 FIX: Reorder existing tabs without recreating DOM elements
   * This prevents duplicate tabs from appearing
   */
  public reorderTabs(newOrder: string[]): void {
    log(`🔄 [TAB-LIST] Reordering tabs: ${newOrder.join(', ')}`);

    // Get existing tab elements in DOM
    const existingElements = new Map<string, HTMLElement>();
    this.tabsContainer.querySelectorAll('.terminal-tab').forEach((el) => {
      const tabId = el.getAttribute('data-tab-id');
      if (tabId) {
        existingElements.set(tabId, el as HTMLElement);
      }
    });

    // Reorder by appending in new order (appendChild moves existing elements)
    newOrder.forEach((tabId) => {
      const element = existingElements.get(tabId);
      if (element) {
        this.tabsContainer.appendChild(element);
      }
    });

    log(`🔄 [TAB-LIST] Tabs reordered successfully`);
  }

  public updateTab(tabId: string, updates: Partial<TerminalTab>): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    Object.assign(tab, updates);
    const tabElement = this.container.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement;
    if (tabElement) {
      this.updateTabElement(tabElement, tab);

      // 🔧 FIX: Update active class and inline styles when isActive changes
      // This was missing, causing the tab's visual state to not update on click
      if ('isActive' in updates) {
        tabElement.classList.toggle('active', tab.isActive);
        tabElement.setAttribute('aria-selected', tab.isActive.toString());
        tabElement.setAttribute('tabindex', tab.isActive ? '0' : '-1');

        // Update inline styles (required because updateTheme sets inline styles)
        if (this.currentTheme) {
          if (tab.isActive) {
            tabElement.style.backgroundColor = this.currentTheme.background;
            tabElement.style.color = this.currentTheme.foreground;
          } else {
            tabElement.style.backgroundColor = this.adjustBrightness(this.currentTheme.background, -10);
            tabElement.style.color = this.currentTheme.foreground + 'cc';
          }
        }
      }

      // No need to re-attach click/context menu events - they're handled by global delegation
      // Only drag-and-drop needs to be re-attached since it's specific to each element
      this.setupDragAndDrop(tabElement, tab);
    }
  }

  public setActiveTab(tabId: string): void {
    // Deactivate all tabs
    this.tabs.forEach((tab, id) => {
      tab.isActive = id === tabId;
      const tabElement = this.container.querySelector(`[data-tab-id="${id}"]`) as HTMLElement;
      if (tabElement) {
        tabElement.classList.toggle('active', tab.isActive);
        tabElement.setAttribute('aria-selected', tab.isActive.toString());
        tabElement.setAttribute('tabindex', tab.isActive ? '0' : '-1');

        // 🔧 FIX: Update inline styles when active state changes
        // This is necessary because updateTheme sets inline styles that override CSS classes
        if (this.currentTheme) {
          if (tab.isActive) {
            tabElement.style.backgroundColor = this.currentTheme.background;
            tabElement.style.color = this.currentTheme.foreground;
          } else {
            tabElement.style.backgroundColor = this.adjustBrightness(this.currentTheme.background, -10);
            tabElement.style.color = this.currentTheme.foreground + 'cc';
          }
        }

        // Focus the newly active tab for keyboard users
        if (tab.isActive) {
          tabElement.focus();
        }
      }
    });
  }

  public getActiveTab(): TerminalTab | undefined {
    return Array.from(this.tabs.values()).find((tab) => tab.isActive);
  }

  public getAllTabs(): TerminalTab[] {
    return Array.from(this.tabs.values());
  }

  private createTabElement(tab: TerminalTab): HTMLElement {
    const tabElement = document.createElement('div');
    tabElement.className = `terminal-tab ${tab.isActive ? 'active' : ''}`;
    tabElement.setAttribute('data-tab-id', tab.id);
    tabElement.setAttribute('role', 'tab');
    tabElement.setAttribute('aria-selected', tab.isActive.toString());
    tabElement.setAttribute(
      'aria-label',
      `Terminal: ${tab.name}${tab.isDirty ? ' (modified)' : ''}`
    );
    tabElement.setAttribute('tabindex', tab.isActive ? '0' : '-1');
    tabElement.setAttribute('aria-controls', `terminal-panel-${tab.id}`);
    tabElement.draggable = true;

    this.updateTabElement(tabElement, tab);
    this.attachTabEvents(tabElement, tab);

    return tabElement;
  }

  private updateTabElement(tabElement: HTMLElement, tab: TerminalTab): void {
    // Skip update if rename input is active to avoid destroying user's edit
    if (tabElement.querySelector('.terminal-tab-rename-input')) return;

    const safeName = escapeHtml(tab.name);
    const safeIcon = tab.icon ? escapeHtml(tab.icon) : '';
    tabElement.innerHTML = `
      ${safeIcon ? `<span class="terminal-tab-icon codicon codicon-${safeIcon}" aria-hidden="true"></span>` : ''}
      <span class="terminal-tab-label" title="${safeName}">${safeName}</span>
      ${tab.isDirty ? '<span class="terminal-tab-dirty-indicator" role="status" aria-label="Modified" title="This terminal has unsaved changes"></span>' : ''}
      ${
        tab.isClosable
          ? `
        <button class="terminal-tab-close" title="Close Terminal" aria-label="Close ${safeName}" type="button">×</button>
      `
          : ''
      }
    `;

    // Update ARIA attributes
    tabElement.setAttribute(
      'aria-label',
      `Terminal: ${tab.name}${tab.isDirty ? ' (modified)' : ''}`
    );

    if (tab.color) {
      tabElement.style.setProperty('--tab-color', tab.color);
    }
  }

  private attachTabEvents(tabElement: HTMLElement, tab: TerminalTab): void {
    // Click and context menu are now handled by global event delegation
    // Only drag and drop needs element-specific handlers
    this.setupDragAndDrop(tabElement, tab);
  }

  private setupDragAndDrop(tabElement: HTMLElement, tab: TerminalTab): void {
    tabElement.addEventListener('dragstart', (e) => {
      this.draggedTab = tab.id;
      tabElement.classList.add('dragging');
      this.dropTargetInfo = null;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/terminal-tab-id', tab.id);
      }
    });

    tabElement.addEventListener('dragend', () => {
      tabElement.classList.remove('dragging');
      this.draggedTab = null;
      this.dropTargetInfo = null;
      this.hideDropIndicator();
    });

    tabElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.draggedTab && this.draggedTab !== tab.id) {
        const rect = tabElement.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const insertPosition = e.clientX < midpoint ? 'before' : 'after';
        this.showDropIndicator(tabElement, insertPosition);
        this.dropTargetInfo = { id: tab.id, position: insertPosition };
      }
    });

    tabElement.addEventListener('drop', (e) => {
      e.preventDefault();
      if (this.draggedTab && this.draggedTab !== tab.id) {
        const currentOrder = this.getCurrentTabOrder();
        const fromIndex = currentOrder.indexOf(this.draggedTab);

        if (fromIndex !== -1) {
          const workingOrder = currentOrder.filter((id) => id !== this.draggedTab);
          const dropInfo =
            this.dropTargetInfo && this.dropTargetInfo.id === tab.id
              ? this.dropTargetInfo
              : { id: tab.id, position: 'before' as const };

          let targetIndex = workingOrder.indexOf(dropInfo.id);

          if (targetIndex === -1) {
            workingOrder.push(this.draggedTab);
          } else {
            if (dropInfo.position === 'after') {
              targetIndex += 1;
            }
            workingOrder.splice(targetIndex, 0, this.draggedTab);
          }

          const toIndex = workingOrder.indexOf(this.draggedTab);
          this.events.onTabReorder(fromIndex, toIndex, workingOrder);
        }
      }
      this.dropTargetInfo = null;
      this.hideDropIndicator();
    });
  }

  private getCurrentTabOrder(): string[] {
    const orderedIds = Array.from(this.tabsContainer.querySelectorAll('.terminal-tab'))
      .map((el) => el.getAttribute('data-tab-id'))
      .filter((id): id is string => Boolean(id));

    if (orderedIds.length > 0) {
      return orderedIds;
    }

    return Array.from(this.tabs.keys());
  }

  private createDropIndicator(): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    return indicator;
  }

  private showDropIndicator(tabElement: HTMLElement, position: 'before' | 'after'): void {
    const rect = tabElement.getBoundingClientRect();
    const containerRect = this.tabsContainer.getBoundingClientRect();

    this.dropIndicator.style.left = `${position === 'before' ? rect.left - containerRect.left - 1 : rect.right - containerRect.left - 1}px`;
    this.dropIndicator.style.top = '0';
    this.dropIndicator.classList.add('visible');

    if (!this.dropIndicator.parentElement) {
      this.tabsContainer.appendChild(this.dropIndicator);
    }
  }

  private hideDropIndicator(): void {
    this.dropIndicator.classList.remove('visible');
  }

  private getModeIndicatorIconSvg(icon: 'fullscreen' | 'grid'): string {
    if (icon === 'fullscreen') {
      // "Maximize" corners icon
      return `
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M6 1H1V6M10 1H15V6M1 10V15H6M10 15H15V10" />
        </svg>
      `.trim();
    }

    // "All terminals" grid icon
    return `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
        <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
        <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      </svg>
    `.trim();
  }

  public setModeIndicator(mode: 'normal' | 'fullscreen' | 'split'): void {
    this.currentMode = mode;
    if (!this.modeIndicatorContainer || !this.modeIndicatorSymbol) {
      return;
    }

    const config: Record<
      'normal' | 'fullscreen' | 'split',
      { label: string; icon: 'fullscreen' | 'grid' }
    > = {
      normal: {
        label: 'Show active terminal fullscreen',
        icon: 'fullscreen',
      },
      fullscreen: {
        label: 'Show all terminals',
        icon: 'grid',
      },
      split: {
        label: 'Show active terminal fullscreen',
        icon: 'fullscreen',
      },
    };

    const { label, icon } = config[mode];
    this.modeIndicatorContainer.setAttribute('aria-label', label);
    this.modeIndicatorContainer.setAttribute('title', label);
    this.modeIndicatorContainer.setAttribute('data-mode', mode);
    this.modeIndicatorSymbol.innerHTML = this.getModeIndicatorIconSvg(icon);

    // Always show the mode indicator
    this.modeIndicatorContainer.style.display = 'flex';
  }

  /**
   * Set the flex direction of the tab container
   * @param direction - 'row' for horizontal (side by side), 'column' for vertical (top)
   */
  public setFlexDirection(direction: 'row' | 'column'): void {
    if (!this.container) {
      log('⚠️ [TAB-LIST] Cannot set flex direction: container not initialized');
      return;
    }

    log(
      `📐 [TAB-LIST] Setting tab container flex-direction to: ${direction} (${direction === 'row' ? 'horizontal tabs' : 'vertical tabs'})`
    );
    this.container.style.flexDirection = direction;

    // Verify the change was applied
    const computedStyle = window.getComputedStyle(this.container);
    log(`📐 [TAB-LIST] ✅ Verified flex-direction: ${computedStyle.flexDirection}`);
  }

  private startRename(tabId: string): void {
    const tab = this.tabs.get(tabId);
    const tabElement = this.container.querySelector(`[data-tab-id="${tabId}"]`);
    const labelElement = tabElement?.querySelector('.terminal-tab-label');

    if (!tab || !labelElement) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = tab.name;
    input.className = 'terminal-tab-rename-input';
    input.style.cssText = `
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      font-size: 13px;
      padding: 2px 4px;
      width: 100%;
      box-sizing: border-box;
    `;

    let finished = false;
    let blurTimeout: ReturnType<typeof setTimeout> | null = null;

    const cancelBlurTimeout = () => {
      if (blurTimeout !== null) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      }
    };

    const finishRename = (save: boolean = true) => {
      if (finished) return;
      finished = true;
      cancelBlurTimeout();
      const trimmedValue = input.value.trim();
      // Restore label in DOM first (removes input guard in updateTabElement)
      input.replaceWith(labelElement);
      if (save && trimmedValue && trimmedValue !== tab.name) {
        labelElement.textContent = trimmedValue;
        this.events.onTabRename(tabId, trimmedValue);
      } else {
        labelElement.textContent = tab.name;
      }
    };

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('blur', () => {
      // Delay blur handling so that a scheduled terminal.focus() steal
      // (which fires ~20ms after tab click) does not immediately kill
      // the rename input. If the input regains focus within the window,
      // the pending finish is cancelled by the focus handler below.
      blurTimeout = setTimeout(() => {
        blurTimeout = null;
        finishRename();
      }, 50);
    });
    input.addEventListener('focus', () => {
      // Input regained focus (e.g. from the re-assert timeout below),
      // cancel the pending blur finish.
      cancelBlurTimeout();
    });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Prevent all keys from reaching container
      if (e.key === 'Enter') {
        e.preventDefault();
        finishRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishRename(false);
      }
    });

    labelElement.replaceWith(input);
    input.focus();
    input.select();

    // Re-assert focus after a short delay to survive terminal.focus() steal
    // triggered by setActiveTerminalId's 20ms setTimeout.
    // This mirrors the pattern used in HeaderFactory.setupHeaderEditor.
    setTimeout(() => {
      if (finished) return;
      if (document.activeElement !== input) {
        input.focus();
      }
    }, 30);
  }

  private showContextMenu(e: MouseEvent, _tab: TerminalTab): void {
    // This would integrate with VS Code's context menu system
    // For now, we'll create a simple context menu
    const menu = document.createElement('div');
    menu.className = 'terminal-tab-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      background: var(--vscode-menu-background);
      border: 1px solid var(--vscode-menu-border);
      border-radius: 3px;
      box-shadow: 0 2px 8px var(--vscode-widget-shadow);
      z-index: 10000;
      min-width: 180px;
    `;

    const menuItems = [
      { label: 'Duplicate', action: () => log('Duplicate tab') },
      { label: 'Move to New Window', action: () => log('Move to new window') },
    ];

    menuItems.forEach((item) => {
      if (item.label === '---') {
        const separator = document.createElement('div');
        separator.style.cssText =
          'height: 1px; background: var(--vscode-menu-separatorBackground); margin: 4px 0;';
        menu.appendChild(separator);
        return;
      }

      const menuItem = document.createElement('div');
      menuItem.className = 'terminal-tab-context-menu-item';
      menuItem.textContent = item.label;
      menuItem.style.cssText = `
        padding: 6px 12px;
        cursor: pointer;
        color: var(--vscode-menu-foreground);
      `;

      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.background = 'var(--vscode-menu-selectionBackground)';
      });
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.background = 'transparent';
      });
      menuItem.addEventListener('click', () => {
        if (item.action) {
          item.action();
        }
        document.body.removeChild(menu);
      });

      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        document.body.removeChild(menu);
        document.removeEventListener('click', closeMenu);
      }
    };

    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private updateTabVisibility(): void {
    // Show/hide tabs based on count and configuration
    const tabCount = this.tabs.size;
    this.container.style.display = tabCount > 1 ? 'flex' : 'none';
  }

  /**
   * Update tab list theme to match terminal theme
   * Ensures tabs are consistent with secondaryTerminal.theme setting
   */
  public updateTheme(theme: TerminalTheme): void {
    // 🔧 FIX: Store theme for use in setActiveTab
    this.currentTheme = theme;

    // Update container background
    this.container.style.backgroundColor = theme.background;
    this.container.style.borderBottomColor = theme.foreground + '33';

    // Update tabs list background
    const tabsList = this.container.querySelector('.terminal-tabs-list') as HTMLElement;
    if (tabsList) {
      tabsList.style.backgroundColor = theme.background;
    }

    // Update mode indicator
    if (this.modeIndicatorContainer) {
      this.modeIndicatorContainer.style.color = theme.foreground;
      this.modeIndicatorContainer.style.borderRightColor = theme.foreground + '33';
    }

    // Update all tab elements
    const tabElements = this.tabsContainer.querySelectorAll('.terminal-tab') as NodeListOf<HTMLElement>;
    tabElements.forEach((tabElement) => {
      const isActive = tabElement.classList.contains('active');
      if (isActive) {
        tabElement.style.backgroundColor = theme.background;
        tabElement.style.color = theme.foreground;
      } else {
        // Slightly different background for inactive tabs
        tabElement.style.backgroundColor = this.adjustBrightness(theme.background, -10);
        tabElement.style.color = theme.foreground + 'cc'; // Slightly transparent
      }
      tabElement.style.borderRightColor = theme.foreground + '33';

      // Update close button color
      const closeButton = tabElement.querySelector('.terminal-tab-close') as HTMLElement;
      if (closeButton) {
        closeButton.style.color = theme.foreground;
      }
    });

    log(`🎨 [TAB-LIST] Updated theme: bg=${theme.background}, fg=${theme.foreground}`);
  }

  /**
   * Adjust brightness of a hex color
   */
  private adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  public dispose(): void {
    this.tabs.clear();
    this.container.textContent = ''; // Safe: clearing content
  }
}
