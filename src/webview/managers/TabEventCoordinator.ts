/**
 * TabEventCoordinator
 *
 * Handles tab event coordination logic extracted from TerminalTabManager.
 * Responsible for: tab click, close, rename, reorder, new tab, mode toggle,
 * and display mode transition handling.
 */

import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { webview as log } from '../../utils/logger';

/**
 * Dependencies required by TabEventCoordinator
 */
export interface ITabEventCoordinatorDependencies {
  getCoordinator(): IManagerCoordinator | null;
  getTabCount(): number;
  getTabOrder(): string[];
  hasTab(tabId: string): boolean;
  setActiveTab(tabId: string): void;
  setTabOrder(order: string[]): void;
  rebuildTabsInOrder(): void;
  hasPendingDeletion(tabId: string): boolean;
  addPendingDeletion(tabId: string): void;
}

/**
 * Coordinates tab events with the terminal system and display mode management.
 */
export class TabEventCoordinator {
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  private activeTabIdGetter: (() => string | null) | null = null;

  constructor(private readonly deps: ITabEventCoordinatorDependencies) {}

  /**
   * Set a getter for the active tab ID (used by onModeToggle)
   */
  public setActiveTabIdGetter(getter: () => string | null): void {
    this.activeTabIdGetter = getter;
  }

  /**
   * Schedule a timeout and track it for cleanup
   */
  public scheduleTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const timeoutId = setTimeout(() => {
      this.pendingTimeouts.delete(timeoutId);
      callback();
    }, delay);
    this.pendingTimeouts.add(timeoutId);
    return timeoutId;
  }

  /**
   * TerminalTabEvents implementation
   */
  public onTabClick = (tabId: string): void => {
    log(`🗂️ Tab clicked: ${tabId}`);

    const coordinator = this.deps.getCoordinator();
    if (coordinator) {
      coordinator.setActiveTerminalId(tabId);
      this.handleFullscreenModeSwitch(tabId);
    }

    this.deps.setActiveTab(tabId);
  };

  public onTabClose = (tabId: string): void => {
    log(`🗂️ Tab close requested: ${tabId}`);

    if (this.deps.hasPendingDeletion(tabId)) {
      log(`⏭️ [TAB-CLOSE] Deletion already in progress, skipping: ${tabId}`);
      return;
    }

    if (this.deps.getTabCount() <= 1) {
      console.warn('⚠️ Cannot close the last terminal tab');
      this.showNotification('Cannot close the last terminal');
      return;
    }

    this.deps.addPendingDeletion(tabId);
    log(`🗂️ [TAB-CLOSE] Marked as pending deletion: ${tabId}`);

    this.handleDisplayModeAfterClose(tabId);
    this.closeTerminalSafely(tabId);
  };

  public onTabRename = (tabId: string, newName: string): void => {
    log(`🗂️ Tab rename: ${tabId} -> ${newName}`);

    const coordinator = this.deps.getCoordinator();
    coordinator?.postMessageToExtension({
      command: 'renameTerminal',
      terminalId: tabId,
      newName: newName,
    });
  };

  public onTabReorder = (fromIndex: number, toIndex: number, nextOrder: string[]): void => {
    log(`🗂️ Tab reorder: ${fromIndex} -> ${toIndex}`, nextOrder);

    if (!Array.isArray(nextOrder) || nextOrder.length === 0) {
      return;
    }

    const currentOrder = this.deps.getTabOrder();
    const normalizedOrder = nextOrder.filter((id) => this.deps.hasTab(id));
    const remaining = currentOrder.filter((id) => !normalizedOrder.includes(id));
    const finalOrder = [...normalizedOrder, ...remaining];

    if (finalOrder.length === 0) {
      return;
    }

    if (
      finalOrder.length === currentOrder.length &&
      finalOrder.every((id, index) => currentOrder[index] === id)
    ) {
      return;
    }

    this.deps.setTabOrder(finalOrder);
    this.deps.rebuildTabsInOrder();

    const coordinator = this.deps.getCoordinator();
    if (coordinator) {
      const managers = coordinator.getManagers();
      if (managers.terminalContainer) {
        managers.terminalContainer.reorderContainers(finalOrder);
      }

      this.refreshSplitModeIfActive();
    }

    if (coordinator && typeof coordinator.postMessageToExtension === 'function') {
      coordinator.postMessageToExtension({
        command: 'reorderTerminals',
        order: [...finalOrder],
      });
    }
  };

  public onNewTab = (): void => {
    log('🗂️ New tab requested');

    const coordinator = this.deps.getCoordinator();
    if (!coordinator) {
      return;
    }

    const currentMode = this.getCurrentMode();
    const currentTerminalCount = this.deps.getTabCount();
    const newTerminalId = this.generateTerminalId();
    const terminalName = `Terminal ${currentTerminalCount + 1}`;

    log(`📊 Current state: mode=${currentMode}, terminals=${currentTerminalCount}`);

    if (currentMode === 'fullscreen' && currentTerminalCount > 0) {
      log(`🔀 Fullscreen → Split: Showing ${currentTerminalCount} existing terminals first`);

      const displayManager = this.getDisplayManager();
      if (displayManager) {
        displayManager.showAllTerminalsSplit();

        this.scheduleTimeout(() => {
          log(
            `➕ Adding new terminal (${currentTerminalCount + 1}/${currentTerminalCount + 1}): ${newTerminalId}`
          );
          coordinator.createTerminal(newTerminalId, terminalName);
        }, 250);
      }
    } else {
      log(`➕ Adding new terminal directly: ${newTerminalId}`);
      coordinator.createTerminal(newTerminalId, terminalName);
    }
  };

  public onModeToggle = (): void => {
    log('🖥️ Mode toggle requested');

    const coordinator = this.deps.getCoordinator();
    if (coordinator) {
      const displayManager = coordinator.getDisplayModeManager?.();
      if (displayManager) {
        const currentMode = displayManager.getCurrentMode();
        const activeTabId = this.activeTabIdGetter?.() ?? null;

        if (currentMode === 'fullscreen' && this.deps.getTabCount() > 1) {
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
   * Handle terminal creation event - set active tab and refresh split if needed
   */
  public handleTerminalCreated(terminalId: string): void {
    this.scheduleTimeout(() => {
      this.deps.setActiveTab(terminalId);

      const currentMode = this.getCurrentMode();
      if (currentMode === 'split') {
        log(`🔄 Refreshing split layout`);
        this.refreshSplitModeIfActive();
      }
    }, 100);
  }

  // --- Private helpers ---

  private getDisplayManager() {
    return this.deps.getCoordinator()?.getDisplayModeManager?.();
  }

  private getCurrentMode(): 'normal' | 'fullscreen' | 'split' | null {
    return this.getDisplayManager()?.getCurrentMode() ?? null;
  }

  private handleFullscreenModeSwitch(terminalId: string): void {
    const displayManager = this.getDisplayManager();
    if (displayManager && displayManager.getCurrentMode() === 'fullscreen') {
      displayManager.showTerminalFullscreen(terminalId);
    }
  }

  private handleDisplayModeAfterClose(tabId: string): void {
    const displayManager = this.getDisplayManager();
    const currentMode = this.getCurrentMode();
    const remainingCount = this.deps.getTabCount() - 1;

    if (!displayManager) {
      return;
    }

    if (currentMode === 'fullscreen') {
      this.handleFullscreenModeAfterClose(tabId, remainingCount, displayManager);
    } else if (currentMode === 'split') {
      this.handleSplitModeAfterClose(remainingCount, displayManager);
    }
  }

  private handleFullscreenModeAfterClose(
    closedTabId: string,
    _remainingCount: number,
    displayManager: ReturnType<NonNullable<IManagerCoordinator['getDisplayModeManager']>>
  ): void {
    if (!displayManager) {
      return;
    }

    const tabOrder = this.deps.getTabOrder();
    const remainingTerminalId = tabOrder.find((id) => id !== closedTabId);
    if (remainingTerminalId) {
      this.scheduleTimeout(() => displayManager.showTerminalFullscreen(remainingTerminalId), 50);
    } else {
      displayManager.setDisplayMode('normal');
    }
  }

  private handleSplitModeAfterClose(
    remainingCount: number,
    displayManager: ReturnType<NonNullable<IManagerCoordinator['getDisplayModeManager']>>
  ): void {
    if (!displayManager) {
      return;
    }

    if (remainingCount === 1) {
      this.scheduleTimeout(() => displayManager.setDisplayMode('normal'), 50);
    } else {
      this.scheduleTimeout(() => displayManager.showAllTerminalsSplit(), 50);
    }
  }

  private closeTerminalSafely(tabId: string): void {
    const coordinator = this.deps.getCoordinator();
    if (!coordinator) {
      return;
    }

    if ('deleteTerminalSafely' in coordinator) {
      (coordinator as unknown as { deleteTerminalSafely: (id: string) => void }).deleteTerminalSafely(tabId);
    } else {
      coordinator.closeTerminal(tabId);
    }
  }

  private showNotification(message: string): void {
    const coordinator = this.deps.getCoordinator();
    if (coordinator) {
      const managers = coordinator.getManagers();
      if (managers.notification) {
        managers.notification.showWarning(message);
      }
    }
  }

  private refreshSplitModeIfActive(): void {
    const displayManager = this.getDisplayManager();
    if (displayManager && displayManager.getCurrentMode() === 'split') {
      this.scheduleTimeout(() => displayManager.showAllTerminalsSplit(), 50);
    }
  }

  private generateTerminalId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `terminal-${timestamp}-${random}`;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.pendingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.pendingTimeouts.clear();
    this.activeTabIdGetter = null;
  }
}
