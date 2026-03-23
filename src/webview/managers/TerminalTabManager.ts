/**
 * Terminal Tab Manager
 * Manages terminal tabs with VS Code-style behavior
 * - Tab creation, switching, and closing
 * - Drag & drop reordering
 * - Tab state persistence
 *
 * Event coordination is delegated to TabEventCoordinator.
 */

import { Terminal } from '@xterm/xterm';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { TerminalTabList, TerminalTab, TerminalTabEvents } from '../components/TerminalTabList';
import { webview as log } from '../../utils/logger';
import { arraysEqual } from '../../utils/arrayUtils';
import { TerminalTheme } from '../types/theme.types';
import { TabEventCoordinator } from './TabEventCoordinator';

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
  private currentDisplayMode: 'normal' | 'fullscreen' | 'split' = 'normal';

  // 🔧 FIX: Track tabs being deleted to prevent race conditions with syncTabs
  private pendingDeletions: Set<string> = new Set();
  // 🔧 FIX: Track tabs being created to prevent duplicate additions
  private pendingCreations: Set<string> = new Set();

  // Delegated event coordinator
  private eventCoordinator: TabEventCoordinator;

  constructor() {
    this.eventCoordinator = new TabEventCoordinator({
      getCoordinator: () => this.coordinator,
      getTabCount: () => this.tabs.size,
      getTabOrder: () => this.tabOrder,
      hasTab: (tabId: string) => this.tabs.has(tabId),
      setActiveTab: (tabId: string) => this.setActiveTab(tabId),
      setTabOrder: (order: string[]) => {
        this.tabOrder = order;
      },
      rebuildTabsInOrder: () => this.rebuildTabsInOrder(),
      hasPendingDeletion: (tabId: string) => this.pendingDeletions.has(tabId),
      addPendingDeletion: (tabId: string) => this.pendingDeletions.add(tabId),
    });
    this.eventCoordinator.setActiveTabIdGetter(() => this.getActiveTabId());
  }

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
      this.tabList.setModeIndicator(this.currentDisplayMode);
    }

    this.isInitialized = true;
    this.updateTabVisibility();
    log('[Tabs] Terminal Tab Manager initialized');
  }

  private setupTabContainer(): void {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      console.warn('TerminalTabManager: terminal-body not found, tabs will be created later');
      return;
    }

    // Check for existing container
    const existing = document.getElementById('terminal-tabs-container');
    if (existing) {
      // 🔧 FIX: Only reuse if this is our container (check for marker attribute)
      if (existing.hasAttribute('data-tab-manager-initialized')) {
        // Already initialized by this manager, just use it
        this.tabContainer = existing;
        log('[Tabs] Reusing already initialized tab container');
        return;
      }

      // Container exists but wasn't initialized by us - remove it
      log('[Tabs] Removing orphaned tab container');
      existing.remove();
    }

    // Create new container
    const container = document.createElement('div');
    container.id = 'terminal-tabs-container';
    container.className = 'terminal-tabs-root';
    container.setAttribute('data-tab-manager-initialized', 'true');
    terminalBody.insertBefore(container, terminalBody.firstChild);

    this.tabContainer = container;
    log('[Tabs] Tab container created (new)');
  }

  /**
   * TerminalTabEvents implementation - delegated to TabEventCoordinator
   */
  public onTabClick = (tabId: string): void => {
    this.eventCoordinator.onTabClick(tabId);
  };

  public onTabClose = (tabId: string): void => {
    this.eventCoordinator.onTabClose(tabId);
  };

  public onTabRename = (tabId: string, newName: string): void => {
    // Update local tab state, then delegate to coordinator for extension notification
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.name = newName;
      this.updateTab(tabId, { name: newName });
    }
    this.eventCoordinator.onTabRename(tabId, newName);
  };

  public onTabReorder = (fromIndex: number, toIndex: number, nextOrder: string[]): void => {
    this.eventCoordinator.onTabReorder(fromIndex, toIndex, nextOrder);
  };

  public onNewTab = (): void => {
    this.eventCoordinator.onNewTab();
  };

  public onModeToggle = (): void => {
    this.eventCoordinator.onModeToggle();
  };

  /**
   * Tab management methods
   */
  public addTab(terminalId: string, name: string, terminal?: Terminal): void {
    this.ensureInitialized();
    if (!this.tabList) {
      return;
    }

    if (this.tabs.has(terminalId)) {
      const existing = this.tabs.get(terminalId)!;
      const updates: Partial<TerminalTab> = {};

      if (existing.name !== name) {
        updates.name = name;
      }

      if (terminal && existing.terminal !== terminal) {
        updates.terminal = terminal;
      }

      if (Object.keys(updates).length > 0) {
        Object.assign(existing, updates);
        this.tabList.updateTab(terminalId, updates);
      }

      log(`🗂️ Duplicate tab add ignored: ${terminalId}`);
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
    // 🔧 FIX: Only push to tabOrder if not already present (defensive)
    if (!this.tabOrder.includes(terminalId)) {
      this.tabOrder.push(terminalId);
    }

    if (this.tabList) {
      this.tabList.addTab(tab);
    }

    this.updateTabVisibility();
    log(`🗂️ Tab added: ${terminalId} (${name})`);
  }

  public removeTab(terminalId: string): void {
    // 🔧 FIX: Check if tab exists and log if already removed
    if (!this.tabs.has(terminalId)) {
      log(`🗂️ [TAB-REMOVE] Tab already removed or doesn't exist: ${terminalId}`);
      // Clear from pending deletions if it was tracked
      this.pendingDeletions.delete(terminalId);
      return;
    }

    this.ensureInitialized();
    if (!this.tabList) {
      return;
    }

    // 🔧 FIX: Mark as pending deletion before removal
    this.pendingDeletions.add(terminalId);
    log(`🗂️ [TAB-REMOVE] Starting removal for: ${terminalId}`);

    // 🔧 FIX: Check if this was the active tab BEFORE deleting it
    const removingTab = this.tabs.get(terminalId);
    const wasActive = removingTab?.isActive ?? false;

    // Now delete the tab
    this.tabs.delete(terminalId);
    this.tabOrder = this.tabOrder.filter((id) => id !== terminalId);

    this.tabList.removeTab(terminalId);

    // 🔧 FIX: If this was the active tab, activate another one
    if (wasActive && this.tabs.size > 0) {
      const nextTab = this.tabOrder[0] || Array.from(this.tabs.keys())[0];
      if (nextTab) {
        log(`🗂️ [TAB-REMOVE] Activating next tab after removal: ${nextTab}`);
        this.setActiveTab(nextTab);

        // Also notify coordinator to switch active terminal
        if (this.coordinator) {
          this.coordinator.setActiveTerminalId(nextTab);
        }
      }
    }

    this.updateTabVisibility();

    // 🔧 FIX: Clear pending deletion after a delay to prevent race conditions
    // Extended from 300ms to 500ms to allow for async message processing
    this.eventCoordinator.scheduleTimeout(() => {
      this.pendingDeletions.delete(terminalId);
      log(`🗂️ [TAB-REMOVE] Deletion tracking cleared for: ${terminalId}`);
    }, 500);

    log(
      `🗂️ [TAB-REMOVE] Tab removed: ${terminalId}, remaining tabs: ${this.tabs.size}, wasActive: ${wasActive}`
    );
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

    log(`🗂️ Active tab set: ${terminalId}`);
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

  public updateModeIndicator(mode: 'normal' | 'fullscreen' | 'split'): void {
    this.currentDisplayMode = mode;
    this.ensureInitialized();
    this.tabList?.setModeIndicator(mode);
  }

  /**
   * Set the flex direction of the tab list container
   * @param direction - 'row' for horizontal tabs, 'column' for vertical tabs
   */
  public setTabListFlexDirection(direction: 'row' | 'column'): void {
    this.ensureInitialized();
    this.tabList?.setFlexDirection(direction);
  }

  public getTabCount(): number {
    return this.tabs.size;
  }

  /**
   * Check if a terminal ID is pending deletion
   * Used by TerminalStateDisplayManager to filter out pending deletions from state sync
   */
  public hasPendingDeletion(terminalId: string): boolean {
    return this.pendingDeletions.has(terminalId);
  }

  /**
   * Get all pending deletion IDs
   * Used for debugging and state verification
   */
  public getPendingDeletions(): Set<string> {
    return new Set(this.pendingDeletions);
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
    log(
      `🔄 [SYNC-TABS] syncTabs called with ${tabInfos.length} tabs:`,
      tabInfos.map((t) => t.id)
    );
    log(`🔄 [SYNC-TABS] Current tabs: ${this.tabs.size}:`, Array.from(this.tabs.keys()));
    log(
      `🔄 [SYNC-TABS] Pending deletions: ${this.pendingDeletions.size}:`,
      Array.from(this.pendingDeletions)
    );

    if (tabInfos.length === 0 && this.tabs.size === 0) {
      return;
    }

    this.ensureInitialized();
    if (!this.tabList) {
      return;
    }

    const incomingIds = new Set(tabInfos.map((tab) => tab.id));

    // 🔧 FIX: Only remove tabs if incoming state has terminals
    // This prevents clearing all tabs when Extension state is stale or empty
    if (tabInfos.length > 0) {
      // Remove tabs that no longer exist
      Array.from(this.tabs.keys()).forEach((tabId) => {
        if (!incomingIds.has(tabId)) {
          log(`🔄 [SYNC-TABS] Removing tab not in incoming: ${tabId}`);
          this.removeTab(tabId);
        }
      });
    } else {
      log(`🔄 [SYNC-TABS] ⚠️ Incoming tabs empty, skipping removal to preserve existing tabs`);
    }

    // Add or update tabs
    tabInfos.forEach((info) => {
      // 🔧 FIX: Skip tabs that are pending deletion to prevent race conditions
      if (this.pendingDeletions.has(info.id)) {
        log(`🔄 [SYNC-TABS] ⏭️ Skipping tab pending deletion: ${info.id}`);
        return;
      }

      const existing = this.tabs.get(info.id);
      if (!existing) {
        log(`🔄 [SYNC-TABS] Adding new tab: ${info.id}`);
        const tab: TerminalTab = {
          id: info.id,
          name: info.name,
          isActive: info.isActive,
          isClosable: info.isClosable ?? true,
          icon: 'terminal',
          terminal: undefined,
        };
        this.tabs.set(info.id, tab);
        // 🔧 FIX: Only push to tabOrder if not already present
        if (!this.tabOrder.includes(info.id)) {
          this.tabOrder.push(info.id);
        }
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

    // Sync tab order from Extension state
    const newTabOrder = tabInfos.map((info) => info.id);
    if (newTabOrder.length > 0 && !arraysEqual(this.tabOrder, newTabOrder)) {
      this.tabOrder = newTabOrder;
      this.rebuildTabsInOrder();
      log('🔄 [TABS] Tab order synced from Extension state:', newTabOrder);
    }

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

    log(`🔄 [REBUILD] Rebuilding tabs in order: ${this.tabOrder.join(', ')}`);

    // 🔧 FIX: Use reorderTabs method instead of remove/add cycle
    // This prevents duplicate DOM elements from being created
    this.tabList.reorderTabs(this.tabOrder);
  }

  // arraysEqual removed - using shared utility from utils/arrayUtils.ts

  /**
   * Integration with terminal events
   */
  public handleTerminalCreated(terminalId: string, name: string, terminal: Terminal): void {
    const previousCount = this.tabs.size;
    this.addTab(terminalId, name, terminal);
    const newCount = this.tabs.size;

    log(`🎯 Terminal created: ${terminalId}, terminals: ${previousCount} → ${newCount}`);

    // Delegate post-creation coordination (active tab, split refresh) to event coordinator
    this.eventCoordinator.handleTerminalCreated(terminalId);
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
    log('🗂️ Restoring tab state:', state);

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
   * Update tab list theme to match terminal theme
   * Ensures tabs are consistent with secondaryTerminal.theme setting
   */
  public updateTheme(theme: TerminalTheme): void {
    if (this.tabList) {
      this.tabList.updateTheme(theme);
      log(`🎨 [TAB-MANAGER] Theme updated`);
    }
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    // Dispose event coordinator (clears its pending timeouts)
    this.eventCoordinator.dispose();

    if (this.tabList) {
      this.tabList.dispose();
      this.tabList = null;
    }

    if (this.tabContainer && this.tabContainer.parentNode) {
      this.tabContainer.parentNode.removeChild(this.tabContainer);
    }

    this.tabs.clear();
    this.tabOrder = [];
    this.pendingDeletions.clear();
    this.pendingCreations.clear();
    this.coordinator = null;

    log('🗂️ Terminal Tab Manager disposed');
  }
}
