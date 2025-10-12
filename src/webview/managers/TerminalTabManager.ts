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
import { webview as log } from '../../utils/logger';
import { arraysEqual } from '../../utils/arrayUtils';

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
      this.tabList.setModeIndicator(this.currentDisplayMode);
    }

    this.isInitialized = true;
    this.updateTabVisibility();
    log('[Tabs] Terminal Tab Manager initialized');
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
    log('[Tabs] Tab container created');
  }

  /**
   * TerminalTabEvents implementation
   */
  public onTabClick = (tabId: string): void => {
    log(`🗂️ Tab clicked: ${tabId}`);

    // Switch to the clicked terminal
    if (this.coordinator) {
      this.coordinator.setActiveTerminalId(tabId);

      // If in fullscreen mode, switch the fullscreen terminal
      this.handleFullscreenModeSwitch(tabId);
    }

    this.setActiveTab(tabId);
  };

  public onTabClose = (tabId: string): void => {
    log(`🗂️ Tab close requested: ${tabId}`);

    // Protect the last tab from being closed
    if (this.tabs.size <= 1) {
      console.warn('⚠️ Cannot close the last terminal tab');
      this.showNotification('Cannot close the last terminal');
      return;
    }

    // Handle display mode transition before closing
    this.handleDisplayModeAfterClose(tabId);

    // Close the terminal via coordinator
    this.closeTerminalSafely(tabId);
  };

  public onTabRename = (tabId: string, newName: string): void => {
    log(`🗂️ Tab rename: ${tabId} -> ${newName}`);

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

  public onTabReorder = (fromIndex: number, toIndex: number, nextOrder: string[]): void => {
    log(`🗂️ Tab reorder: ${fromIndex} -> ${toIndex}`, nextOrder);

    if (!Array.isArray(nextOrder) || nextOrder.length === 0) {
      return;
    }

    const normalizedOrder = nextOrder.filter((id) => this.tabs.has(id));
    const remaining = this.tabOrder.filter((id) => !normalizedOrder.includes(id));
    const finalOrder = [...normalizedOrder, ...remaining];

    if (finalOrder.length === 0) {
      return;
    }

    if (
      finalOrder.length === this.tabOrder.length &&
      finalOrder.every((id, index) => this.tabOrder[index] === id)
    ) {
      return;
    }

    this.tabOrder = finalOrder;

    // Rebuild the tab UI in new order
    this.rebuildTabsInOrder();

    // Reorder terminal containers in the DOM
    if (this.coordinator) {
      const managers = this.coordinator.getManagers();
      if (managers.terminalContainer) {
        managers.terminalContainer.reorderContainers(this.tabOrder);
      }

      // Refresh split mode layout if active
      this.refreshSplitModeIfActive();
    }

    // Notify extension host so state updates preserve the new order
    if (this.coordinator && typeof this.coordinator.postMessageToExtension === 'function') {
      this.coordinator.postMessageToExtension({
        command: 'reorderTerminals',
        order: [...this.tabOrder],
      });
    }
  };

  public onNewTab = (): void => {
    log('🗂️ New tab requested');

    if (!this.coordinator) {
      return;
    }

    const currentMode = this.getCurrentMode();
    const currentTerminalCount = this.tabs.size;
    const newTerminalId = this.generateTerminalId();
    const terminalName = `Terminal ${currentTerminalCount + 1}`;

    log(`📊 Current state: mode=${currentMode}, terminals=${currentTerminalCount}`);

    // If in fullscreen mode with 1+ terminals, switch to split mode first
    if (currentMode === 'fullscreen' && currentTerminalCount > 0) {
      log(`🔀 Fullscreen → Split: Showing ${currentTerminalCount} existing terminals first`);

      const displayManager = this.getDisplayManager();
      if (displayManager) {
        // Step 1: Show all existing terminals in split mode
        displayManager.showAllTerminalsSplit();

        // Step 2: Wait for layout to complete, then add new terminal
        // Increased delay to ensure split layout is fully applied
        setTimeout(() => {
          log(`➕ Adding new terminal (${currentTerminalCount + 1}/${currentTerminalCount + 1}): ${newTerminalId}`);
          this.coordinator!.createTerminal(newTerminalId, terminalName);
        }, 250);
      }
    } else {
      // Normal or split mode: directly create terminal
      log(`➕ Adding new terminal directly: ${newTerminalId}`);
      this.coordinator.createTerminal(newTerminalId, terminalName);
    }
  };

  public onModeToggle = (): void => {
    log('🖥️ Mode toggle requested');

    if (this.coordinator) {
      const displayManager = this.coordinator.getDisplayModeManager?.();
      if (displayManager) {
        const currentMode = displayManager.getCurrentMode();
        const activeTabId = this.getActiveTabId();

        if (currentMode === 'fullscreen' && this.tabs.size > 1) {
          log('🔀 Fullscreen -> Split mode');
          displayManager.toggleSplitMode();
        } else if (activeTabId) {
          log(`🔍 Switching to fullscreen mode for: ${activeTabId}`);
          displayManager.showTerminalFullscreen(activeTabId);
        }
      }
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
    this.tabOrder.push(terminalId);

    if (this.tabList) {
      this.tabList.addTab(tab);
    }

    this.updateTabVisibility();
    log(`🗂️ Tab added: ${terminalId} (${name})`);
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
    log(`🗂️ Tab removed: ${terminalId}`);
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
   * Helper: Get DisplayModeManager instance
   */
  private getDisplayManager() {
    return this.coordinator?.getDisplayModeManager?.();
  }

  /**
   * Helper: Get current display mode
   */
  private getCurrentMode(): 'normal' | 'fullscreen' | 'split' | null {
    return this.getDisplayManager()?.getCurrentMode() ?? null;
  }

  /**
   * Helper: Switch fullscreen to specific terminal
   */
  private handleFullscreenModeSwitch(terminalId: string): void {
    const displayManager = this.getDisplayManager();
    if (displayManager && displayManager.getCurrentMode() === 'fullscreen') {
      displayManager.showTerminalFullscreen(terminalId);
    }
  }

  /**
   * Helper: Handle display mode transition after closing a terminal
   */
  private handleDisplayModeAfterClose(tabId: string): void {
    const displayManager = this.getDisplayManager();
    const currentMode = this.getCurrentMode();
    const remainingCount = this.tabs.size - 1;

    if (!displayManager) {
      return;
    }

    if (currentMode === 'fullscreen') {
      this.handleFullscreenModeAfterClose(tabId, remainingCount, displayManager);
    } else if (currentMode === 'split') {
      this.handleSplitModeAfterClose(remainingCount, displayManager);
    }
  }

  /**
   * Helper: Handle fullscreen mode after closing terminal
   */
  private handleFullscreenModeAfterClose(
    closedTabId: string,
    remainingCount: number,
    displayManager: ReturnType<NonNullable<IManagerCoordinator['getDisplayModeManager']>>
  ): void {
    if (!displayManager) {
      return;
    }

    if (remainingCount === 1) {
      // Keep fullscreen with remaining terminal
      const remainingTerminalId = Array.from(this.tabs.keys()).find(id => id !== closedTabId);
      if (remainingTerminalId) {
        setTimeout(() => displayManager.showTerminalFullscreen(remainingTerminalId), 50);
      } else {
        displayManager.setDisplayMode('normal');
      }
    } else {
      // Multiple terminals remain, switch to split
      displayManager.setDisplayMode('split');
    }
  }

  /**
   * Helper: Handle split mode after closing terminal
   */
  private handleSplitModeAfterClose(
    remainingCount: number,
    displayManager: ReturnType<NonNullable<IManagerCoordinator['getDisplayModeManager']>>
  ): void {
    if (!displayManager) {
      return;
    }

    if (remainingCount === 1) {
      setTimeout(() => displayManager.setDisplayMode('normal'), 50);
    } else {
      setTimeout(() => displayManager.showAllTerminalsSplit(), 50);
    }
  }

  /**
   * Helper: Close terminal safely
   */
  private closeTerminalSafely(tabId: string): void {
    if (!this.coordinator) {
      return;
    }

    if ('deleteTerminalSafely' in this.coordinator) {
      (this.coordinator as any).deleteTerminalSafely(tabId);
    } else {
      this.coordinator.closeTerminal(tabId);
    }
  }

  /**
   * Helper: Show notification to user
   */
  private showNotification(message: string): void {
    if (this.coordinator) {
      const managers = this.coordinator.getManagers();
      if (managers.notification) {
        managers.notification.showWarning(message);
      }
    }
  }

  /**
   * Helper: Check if should switch to split mode (when in fullscreen)
   */
  private shouldSwitchToSplitMode(): boolean {
    return this.getCurrentMode() === 'fullscreen';
  }

  /**
   * Helper: Switch to split mode and execute callback
   */
  private switchToSplitModeAndExecute(callback: () => void, delay: number = 250): void {
    const displayManager = this.getDisplayManager();
    if (displayManager) {
      log('🔀 Switching to split mode...');
      // Show all terminals in split mode (not just set the mode)
      displayManager.showAllTerminalsSplit();
      log(`⏱️ Waiting ${delay}ms for layout to complete...`);
      setTimeout(callback, delay);
    }
  }

  /**
   * Helper: Refresh split mode layout if currently active
   */
  private refreshSplitModeIfActive(): void {
    const displayManager = this.getDisplayManager();
    if (displayManager && displayManager.getCurrentMode() === 'split') {
      setTimeout(() => displayManager.showAllTerminalsSplit(), 50);
    }
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

    // Make the new tab active and refresh split mode if needed
    setTimeout(() => {
      this.setActiveTab(terminalId);

      // If in split mode, refresh layout to include new terminal
      const currentMode = this.getCurrentMode();
      if (currentMode === 'split') {
        log(`🔄 Refreshing split layout with ${newCount} terminals`);
        this.refreshSplitModeIfActive();
      }
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

    log('🗂️ Terminal Tab Manager disposed');
  }
}
