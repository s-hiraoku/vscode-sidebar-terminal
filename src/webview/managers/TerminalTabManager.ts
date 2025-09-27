/**
 * Terminal Tab Manager
 * Manages terminal tabs with VS Code-style behavior
 * - Tab creation, switching, and closing
 * - Drag & drop reordering
 * - Tab state persistence
 */

import { Terminal } from '@xterm/xterm';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { TerminalTabList, TerminalTab, TerminalTabEvents } from '../components/TerminalTabList';

interface TabSyncInfo {
  id: string;
  name: string;
  isActive: boolean;
  isClosable?: boolean;
}

export interface TerminalTabState {
  tabs: TerminalTab[];
  activeTabId: string | null;
  tabsVisible: boolean;
}

/**
 * Terminal Tab Manager
 * Coordinates terminal tabs with the main terminal system
 */
export class TerminalTabManager implements TerminalTabEvents {
  private coordinator: IManagerCoordinator | null = null;
  private tabList: TerminalTabList | null = null;
  private tabContainer: HTMLElement | null = null;
  private tabs: Map<string, TerminalTab> = new Map();
  private tabOrder: string[] = [];
  private isEnabled: boolean = true;
  private hideWhenSingleTab: boolean = true;
  private isInitialized = false;

  constructor() {}

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
  }

  /**
   * Initialize tab system
   */
  public initialize(): void {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    if (this.isInitialized) {
      return;
    }

    this.setupTabContainer();

    if (!this.tabContainer) {
      console.warn('TerminalTabManager: Tab container not yet available');
      return;
    }

    if (!this.tabList) {
      this.tabList = new TerminalTabList(this.tabContainer, this);
    }

    this.isInitialized = true;
    this.updateTabVisibility();
    console.log('[Tabs] Terminal Tab Manager initialized');
  }

  private setupTabContainer(): void {
    const existing = document.getElementById('terminal-tabs-container');
    if (existing) {
      this.tabContainer = existing;
      if (existing.parentElement?.id !== 'terminal-body') {
        const terminalBody = document.getElementById('terminal-body');
        if (terminalBody) {
          terminalBody.insertBefore(existing, terminalBody.firstChild);
        }
      }
      existing.classList.add('terminal-tabs-root');
      return;
    }

    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      console.warn('TerminalTabManager: terminal-body not found, tabs will be created later');
      return;
    }

    const container = document.createElement('div');
    container.id = 'terminal-tabs-container';
    container.className = 'terminal-tabs-root';
    terminalBody.insertBefore(container, terminalBody.firstChild);

    this.tabContainer = container;
    console.log('[Tabs] Tab container created');
  }

  /**
   * TerminalTabEvents implementation
   */
  public onTabClick = (tabId: string): void => {
    console.log(`🗂️ Tab clicked: ${tabId}`);

    // Switch to the clicked terminal
    if (this.coordinator) {
      this.coordinator.setActiveTerminalId(tabId);
    }

    this.setActiveTab(tabId);
  };

  public onTabClose = (tabId: string): void => {
    console.log(`🗂️ Tab close requested: ${tabId}`);

    // Close the terminal via coordinator
    if (this.coordinator) {
      this.coordinator.closeTerminal(tabId);
    }
  };

  public onTabRename = (tabId: string, newName: string): void => {
    console.log(`🗂️ Tab rename: ${tabId} -> ${newName}`);

    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.name = newName;
      this.updateTab(tabId, { name: newName });

      // Notify coordinator about name change
      this.coordinator?.postMessageToExtension({
        command: 'renameTerminal',
        terminalId: tabId,
        newName: newName,
      });
    }
  };

  public onTabReorder = (fromIndex: number, toIndex: number): void => {
    console.log(`🗂️ Tab reorder: ${fromIndex} -> ${toIndex}`);

    if (fromIndex === toIndex) return;

    // Reorder the tab order array
    const [movedTabId] = this.tabOrder.splice(fromIndex, 1);
    if (movedTabId) {
      this.tabOrder.splice(toIndex, 0, movedTabId);
    }

    // Rebuild the tab UI in new order
    this.rebuildTabsInOrder();
  };

  public onNewTab = (): void => {
    console.log('🗂️ New tab requested');

    if (this.coordinator) {
      // Generate new terminal ID
      const newTerminalId = this.generateTerminalId();
      this.coordinator.createTerminal(newTerminalId, `Terminal ${this.tabs.size + 1}`);
    }
  };

  /**
   * Tab management methods
   */
  public addTab(terminalId: string, name: string, terminal?: Terminal): void {
    this.ensureInitialized();
    if (!this.tabList) {
      return;
    }
    const tab: TerminalTab = {
      id: terminalId,
      name: name,
      isActive: false,
      isClosable: true,
      terminal: terminal,
      icon: 'terminal',
    };

    this.tabs.set(terminalId, tab);
    this.tabOrder.push(terminalId);

    if (this.tabList) {
      this.tabList.addTab(tab);
    }

    this.updateTabVisibility();
    console.log(`🗂️ Tab added: ${terminalId} (${name})`);
  }

  public removeTab(terminalId: string): void {
    if (!this.tabs.has(terminalId)) return;

    this.ensureInitialized();
    if (!this.tabList) {
      return;
    }

    this.tabs.delete(terminalId);
    this.tabOrder = this.tabOrder.filter((id) => id !== terminalId);

    this.tabList.removeTab(terminalId);

    // If this was the active tab, activate another one
    const wasActive = this.getActiveTabId() === terminalId;
    if (wasActive && this.tabs.size > 0) {
      const nextTab = this.tabOrder[0] || Array.from(this.tabs.keys())[0];
      if (nextTab) {
        this.setActiveTab(nextTab);
      }
    }

    this.updateTabVisibility();
    console.log(`🗂️ Tab removed: ${terminalId}`);
  }

  public updateTab(terminalId: string, updates: Partial<TerminalTab>): void {
    const tab = this.tabs.get(terminalId);
    if (!tab) return;

    Object.assign(tab, updates);

    if (this.tabList) {
      this.tabList.updateTab(terminalId, updates);
    }
  }

  public setActiveTab(terminalId: string): void {
    if (!this.tabs.has(terminalId)) return;

    // Update tab states
    this.tabs.forEach((tab, id) => {
      tab.isActive = id === terminalId;
    });

    if (this.tabList) {
      this.tabList.setActiveTab(terminalId);
    }

    console.log(`🗂️ Active tab set: ${terminalId}`);
  }

  public getActiveTabId(): string | null {
    const activeTab = Array.from(this.tabs.values()).find((tab) => tab.isActive);
    return activeTab?.id || null;
  }

  public getActiveTab(): TerminalTab | undefined {
    return Array.from(this.tabs.values()).find((tab) => tab.isActive);
  }

  public getAllTabs(): TerminalTab[] {
    return this.tabOrder.map((id) => this.tabs.get(id)!).filter(Boolean);
  }

  public getTabCount(): number {
    return this.tabs.size;
  }

  /**
   * Tab configuration
   */
  public setTabsEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.updateTabVisibility();
  }

  public setHideWhenSingleTab(hide: boolean): void {
    this.hideWhenSingleTab = hide;
    this.updateTabVisibility();
  }

  public syncTabs(tabInfos: TabSyncInfo[]): void {
    if (tabInfos.length === 0 && this.tabs.size === 0) {
      return;
    }

    this.ensureInitialized();
    if (!this.tabList) {
      return;
    }

    const incomingIds = new Set(tabInfos.map((tab) => tab.id));

    // Remove tabs that no longer exist
    Array.from(this.tabs.keys()).forEach((tabId) => {
      if (!incomingIds.has(tabId)) {
        this.removeTab(tabId);
      }
    });

    // Add or update tabs
    tabInfos.forEach((info) => {
      const existing = this.tabs.get(info.id);
      if (!existing) {
        const tab: TerminalTab = {
          id: info.id,
          name: info.name,
          isActive: info.isActive,
          isClosable: info.isClosable ?? true,
          icon: 'terminal',
          terminal: undefined,
        };
        this.tabs.set(info.id, tab);
        this.tabOrder.push(info.id);
        this.tabList?.addTab(tab);
      } else {
        const updates: Partial<TerminalTab> = {};
        if (existing.name !== info.name) {
          updates.name = info.name;
        }
        if (existing.isActive !== info.isActive) {
          updates.isActive = info.isActive;
        }
        Object.assign(existing, updates);
        if (Object.keys(updates).length > 0) {
          this.tabList?.updateTab(info.id, updates);
        }
      }
    });

    // this.updateTabOrder(tabInfos.map((info) => info.id)); // Method not found
    this.updateTabVisibility();

    const activeTab = tabInfos.find((tab) => tab.isActive);
    if (activeTab) {
      this.setActiveTab(activeTab.id);
    } else if (this.tabOrder.length > 0) {
      this.setActiveTab(this.tabOrder[0]!);
    }
  }

  private updateTabVisibility(): void {
    if (!this.tabContainer) return;

    const shouldShow =
      this.isEnabled && (this.tabs.size > 1 || !this.hideWhenSingleTab) && this.tabs.size > 0;

    this.tabContainer.style.display = shouldShow ? 'block' : 'none';
  }

  private rebuildTabsInOrder(): void {
    if (!this.tabList) return;

    // Clear and rebuild tabs in new order
    this.tabs.forEach((_, tabId) => {
      this.tabList!.removeTab(tabId);
    });

    this.tabOrder.forEach((tabId) => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        this.tabList!.addTab(tab);
      }
    });
  }

  private generateTerminalId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `terminal-${timestamp}-${random}`;
  }

  /**
   * Integration with terminal events
   */
  public handleTerminalCreated(terminalId: string, name: string, terminal: Terminal): void {
    this.addTab(terminalId, name, terminal);

    // Make the new tab active
    setTimeout(() => {
      this.setActiveTab(terminalId);
    }, 100);
  }

  public handleTerminalClosed(terminalId: string): void {
    this.removeTab(terminalId);
  }

  public handleTerminalRenamed(terminalId: string, newName: string): void {
    this.updateTab(terminalId, { name: newName });
  }

  public handleTerminalActivated(terminalId: string): void {
    this.setActiveTab(terminalId);
  }

  /**
   * State management
   */
  public getState(): TerminalTabState {
    return {
      tabs: this.getAllTabs(),
      activeTabId: this.getActiveTabId(),
      tabsVisible: this.isEnabled && (this.tabs.size > 1 || !this.hideWhenSingleTab),
    };
  }

  public restoreState(state: TerminalTabState): void {
    // This would be called during session restoration
    console.log('🗂️ Restoring tab state:', state);

    // Clear current tabs
    this.tabs.clear();
    this.tabOrder = [];

    // Restore tabs
    state.tabs.forEach((tab) => {
      this.tabs.set(tab.id, { ...tab });
      this.tabOrder.push(tab.id);

      if (this.tabList) {
        this.tabList.addTab(tab);
      }
    });

    // Set active tab
    if (state.activeTabId) {
      this.setActiveTab(state.activeTabId);
    }

    this.updateTabVisibility();
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    if (this.tabList) {
      this.tabList.dispose();
      this.tabList = null;
    }

    if (this.tabContainer && this.tabContainer.parentNode) {
      this.tabContainer.parentNode.removeChild(this.tabContainer);
    }

    this.tabs.clear();
    this.tabOrder = [];
    this.coordinator = null;

    console.log('🗂️ Terminal Tab Manager disposed');
  }
}
