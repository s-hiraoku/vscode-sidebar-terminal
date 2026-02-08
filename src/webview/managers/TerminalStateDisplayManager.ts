/**
 * Terminal State Display Manager
 *
 * Handles UI updates based on terminal state changes.
 * Extracted from LightweightTerminalWebviewManager for better separation of concerns.
 */

import { TerminalState } from '../../types/shared';
import { webview as log } from '../../utils/logger';
import {
  IUIManager,
  INotificationManager,
  ITerminalTabManager,
  ITerminalContainerManager,
} from '../interfaces/ManagerInterfaces';

export class TerminalStateDisplayManager {
  constructor(
    private uiManager: IUIManager,
    private notificationManager: INotificationManager,
    private terminalTabManager: ITerminalTabManager | null,
    private terminalContainerManager: ITerminalContainerManager | null
  ) {}

  /**
   * Update all UI elements based on terminal state
   */
  public updateFromState(state: TerminalState): void {
    try {
      // Sync terminal container order
      this.syncContainerOrder(state);

      // Update count display
      this.updateTerminalCount(state.terminals.length, state.maxTerminals);

      // Update available slots
      this.updateAvailableSlots(state.availableSlots);

      // Highlight active terminal
      if (state.activeTerminalId) {
        this.highlightActive(state.activeTerminalId);
      }

      // Sync tabs
      this.syncTabs(state);

      // Sync header colors
      this.syncHeaderIndicatorColors(state);

      log(`🎨 [UI] Updated: ${state.terminals.length}/${state.maxTerminals} terminals`);
    } catch (error) {
      log('❌ [UI] Error updating from state:', error);
    }
  }

  /**
   * Update terminal creation button state
   */
  public updateCreationState(state: TerminalState): void {
    const canCreate = state.availableSlots.length > 0;
    const currentCount = state.terminals.length;
    const maxCount = state.maxTerminals;

    this.setCreateButtonEnabled(canCreate);

    if (!canCreate) {
      this.showLimitMessage(currentCount, maxCount);
    } else {
      this.clearLimitMessage();
    }

    log(`🎯 [CREATION] ${canCreate ? 'ENABLED' : 'DISABLED'} (${currentCount}/${maxCount})`);
  }

  private syncContainerOrder(state: TerminalState): void {
    if (!this.terminalContainerManager) return;

    const terminalOrder = state.terminals.map((t) => t.id);
    if (terminalOrder.length > 0) {
      this.terminalContainerManager.reorderContainers(terminalOrder);
      log(`🔄 [STATE] Synced container order:`, terminalOrder);
    }
  }

  private updateTerminalCount(current: number, max: number): void {
    const elements = document.querySelectorAll('[data-terminal-count]');
    elements.forEach((el) => {
      el.textContent = `${current}/${max}`;
    });
  }

  private updateAvailableSlots(slots: number[]): void {
    const elements = document.querySelectorAll('[data-available-slots]');
    elements.forEach((el) => {
      el.textContent = slots.length > 0 ? `Available: ${slots.join(', ')}` : 'No slots available';
    });
  }

  public highlightActive(terminalId: string): void {
    // Remove previous highlighting
    document.querySelectorAll('.terminal-container.active').forEach((el) => {
      el.classList.remove('active');
    });

    // Add to current
    const container = document.querySelector(`[data-terminal-id="${terminalId}"]`);
    if (container) {
      container.classList.add('active');
    }

    this.uiManager.updateSplitTerminalBorders(terminalId);
  }

  private setCreateButtonEnabled(enabled: boolean): void {
    const buttons = document.querySelectorAll('[data-action="create-terminal"]');
    buttons.forEach((btn) => {
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = !enabled;
        btn.title = enabled ? 'Create new terminal' : 'Maximum terminals reached';
      }
    });
  }

  private showLimitMessage(current: number, max: number): void {
    const message = `Terminal limit reached (${current}/${max}). Delete a terminal to create new ones.`;

    if (this.notificationManager) {
      this.notificationManager.showWarning(message);
    }

    const elements = document.querySelectorAll('[data-terminal-status]');
    elements.forEach((el) => {
      el.textContent = message;
      el.className = 'terminal-status warning';
    });
  }

  private clearLimitMessage(): void {
    if (this.notificationManager) {
      this.notificationManager.clearWarnings();
    }

    const elements = document.querySelectorAll('[data-terminal-status]');
    elements.forEach((el) => {
      el.textContent = '';
      el.className = 'terminal-status';
    });
  }

  private syncTabs(state: TerminalState): void {
    if (!this.terminalTabManager) return;

    // 🔧 FIX: Filter out terminals that are pending deletion to prevent race conditions
    // This prevents deleted tabs from being re-added during state sync
    const filteredTerminals = state.terminals.filter(
      (terminal) => !this.terminalTabManager!.hasPendingDeletion(terminal.id)
    );

    const pendingDeletions = this.terminalTabManager.getPendingDeletions();
    if (pendingDeletions.size > 0) {
      log(
        `🔄 [SYNC-TABS] Filtering ${pendingDeletions.size} pending deletions:`,
        Array.from(pendingDeletions)
      );
    }

    this.terminalTabManager.syncTabs(
      filteredTerminals.map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        isActive: terminal.isActive,
        isClosable: filteredTerminals.length > 1,
      }))
    );
  }

  private syncHeaderIndicatorColors(state: TerminalState): void {
    state.terminals.forEach((terminal) => {
      this.uiManager.updateTerminalHeader(
        terminal.id,
        terminal.name,
        terminal.indicatorColor
      );
    });
  }
}
