/**
 * Terminal Tab List Component
 * Implements VS Code-style terminal tabs with switching, drag & drop, and management
 */

import { Terminal } from '@xterm/xterm';

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
  onTabReorder: (fromIndex: number, toIndex: number) => void;
  onNewTab: () => void;
}

/**
 * Terminal Tab List Component
 * Manages terminal tabs with VS Code-style UI and interactions
 */
export class TerminalTabList {
  private container: HTMLElement;
  private tabsContainer!: HTMLElement;
  private addButton!: HTMLElement;
  private tabs: Map<string, TerminalTab> = new Map();
  private events: TerminalTabEvents;
  private draggedTab: string | null = null;
  private dropIndicator: HTMLElement;

  constructor(container: HTMLElement, events: TerminalTabEvents) {
    this.container = container;
    this.events = events;
    this.dropIndicator = this.createDropIndicator();
    this.setup();
  }

  private setup(): void {
    this.container.className = 'terminal-tabs-container';
    this.container.innerHTML = `
      <div class="terminal-tabs-list" role="tablist">
        <div class="terminal-tabs-scroll">
          <div class="terminal-tabs-wrapper">
            <!-- Tabs will be inserted here -->
          </div>
        </div>
        <div class="terminal-tab-actions">
          <button class="terminal-tab-add" title="New Terminal" role="button">
            <span class="codicon codicon-plus"></span>
          </button>
        </div>
      </div>
    `;

    this.tabsContainer = this.container.querySelector('.terminal-tabs-wrapper')!;
    this.addButton = this.container.querySelector('.terminal-tab-add')!;

    this.addButton.addEventListener('click', () => {
      this.events.onNewTab();
    });

    this.setupStyles();
    this.setupKeyboardNavigation();
  }

  private setupStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .terminal-tabs-container {
        display: flex;
        flex-direction: column;
        background: var(--vscode-tab-inactiveBackground);
        border-bottom: 1px solid var(--vscode-tab-border);
        height: 32px;
        min-height: 32px;
        overflow: hidden;
      }

      .terminal-tabs-list {
        display: flex;
        flex: 1;
        align-items: stretch;
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
      }

      .terminal-tab {
        display: flex;
        align-items: center;
        padding: 0 12px;
        min-width: 120px;
        max-width: 240px;
        height: 32px;
        background: var(--vscode-tab-inactiveBackground);
        color: var(--vscode-tab-inactiveForeground);
        border-right: 1px solid var(--vscode-tab-border);
        cursor: pointer;
        user-select: none;
        position: relative;
        transition: background-color 0.1s ease;
      }

      .terminal-tab:hover {
        background: var(--vscode-tab-inactiveHoverBackground);
        color: var(--vscode-tab-inactiveHoverForeground);
      }

      .terminal-tab.active {
        background: var(--vscode-tab-activeBackground);
        color: var(--vscode-tab-activeForeground);
        border-bottom: 2px solid var(--vscode-tab-activeBorder, var(--vscode-focusBorder));
      }

      .terminal-tab.dragging {
        opacity: 0.5;
        transform: rotate(5deg);
        z-index: 1000;
      }

      .terminal-tab-icon {
        width: 16px;
        height: 16px;
        margin-right: 6px;
        flex-shrink: 0;
      }

      .terminal-tab-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
      }

      .terminal-tab-dirty-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--vscode-gitDecoration-modifiedResourceForeground);
        margin-left: 6px;
        flex-shrink: 0;
      }

      .terminal-tab-close {
        display: none;
      }

      .terminal-tab-actions {
        display: flex;
        align-items: center;
        padding: 0 4px;
        border-left: 1px solid var(--vscode-tab-border);
      }

      .terminal-tab-add {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: var(--vscode-tab-inactiveForeground);
        cursor: pointer;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .terminal-tab-add:hover {
        background: var(--vscode-toolbar-hoverBackground);
        color: var(--vscode-tab-activeForeground);
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
        e.preventDefault();
        const activeTab = this.getActiveTab();
        if (activeTab && activeTab.isClosable) {
          this.events.onTabClose(activeTab.id);
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
    this.tabs.set(tab.id, tab);
    const tabElement = this.createTabElement(tab);
    this.tabsContainer.appendChild(tabElement);
    this.updateTabVisibility();
  }

  public removeTab(tabId: string): void {
    const tabElement = this.container.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabElement) {
      tabElement.remove();
    }
    this.tabs.delete(tabId);
    this.updateTabVisibility();
  }

  public updateTab(tabId: string, updates: Partial<TerminalTab>): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    Object.assign(tab, updates);
    const tabElement = this.container.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement;
    if (tabElement) {
      this.updateTabElement(tabElement, tab);
    }
  }

  public setActiveTab(tabId: string): void {
    // Deactivate all tabs
    this.tabs.forEach((tab, id) => {
      tab.isActive = id === tabId;
      const tabElement = this.container.querySelector(`[data-tab-id="${id}"]`);
      if (tabElement) {
        tabElement.classList.toggle('active', tab.isActive);
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
    tabElement.draggable = true;

    this.updateTabElement(tabElement, tab);
    this.attachTabEvents(tabElement, tab);

    return tabElement;
  }

  private updateTabElement(tabElement: HTMLElement, tab: TerminalTab): void {
    tabElement.innerHTML = `
      ${tab.icon ? `<span class="terminal-tab-icon codicon codicon-${tab.icon}"></span>` : ''}
      <span class="terminal-tab-label" title="${tab.name}">${tab.name}</span>
      ${tab.isDirty ? '<span class="terminal-tab-dirty-indicator"></span>' : ''}
    `;

    if (tab.color) {
      tabElement.style.setProperty('--tab-color', tab.color);
    }
  }

  private attachTabEvents(tabElement: HTMLElement, tab: TerminalTab): void {
    // Click to activate
    tabElement.addEventListener('click', (e) => {
      e.preventDefault();
      this.events.onTabClick(tab.id);
    });

    // Close button (removed)

    // Double-click to rename (disabled)

    // Drag and drop
    this.setupDragAndDrop(tabElement, tab);

    // Context menu
    tabElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, tab);
    });
  }

  private setupDragAndDrop(tabElement: HTMLElement, tab: TerminalTab): void {
    tabElement.addEventListener('dragstart', (e) => {
      this.draggedTab = tab.id;
      tabElement.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/terminal-tab-id', tab.id);
      }
    });

    tabElement.addEventListener('dragend', () => {
      tabElement.classList.remove('dragging');
      this.draggedTab = null;
      this.hideDropIndicator();
    });

    tabElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.draggedTab && this.draggedTab !== tab.id) {
        const rect = tabElement.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const insertPosition = e.clientX < midpoint ? 'before' : 'after';
        this.showDropIndicator(tabElement, insertPosition);
      }
    });

    tabElement.addEventListener('drop', (e) => {
      e.preventDefault();
      if (this.draggedTab && this.draggedTab !== tab.id) {
        const fromIndex = Array.from(this.tabs.keys()).indexOf(this.draggedTab);
        const toIndex = Array.from(this.tabs.keys()).indexOf(tab.id);
        this.events.onTabReorder(fromIndex, toIndex);
      }
      this.hideDropIndicator();
    });
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

    const finishRename = (save: boolean = true) => {
      if (save && input.value.trim() && input.value !== tab.name) {
        this.events.onTabRename(tabId, input.value.trim());
      } else {
        labelElement.textContent = tab.name;
      }
      input.replaceWith(labelElement);
    };

    input.addEventListener('blur', () => finishRename());
    input.addEventListener('keydown', (e) => {
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
      { label: 'Duplicate', action: () => console.log('Duplicate tab') },
      { label: 'Move to New Window', action: () => console.log('Move to new window') },
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

  public dispose(): void {
    this.tabs.clear();
    this.container.innerHTML = '';
  }
}
