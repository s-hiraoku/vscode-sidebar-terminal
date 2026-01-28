/** Manages terminal split layout and distribution. */

import { SPLIT_CONSTANTS } from '../constants/webview';
import { showSplitLimitWarning } from '../utils/NotificationUtils';
import { BaseManager } from './BaseManager';
import { TerminalInstance } from '../interfaces/ManagerInterfaces';
import { ISplitLayoutController } from '../interfaces/ISplitLayoutController';

// Re-export TerminalInstance for tests
export { TerminalInstance };
import { splitLogger } from '../utils/ManagerLogger';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { DOMUtils } from '../utils/DOMUtils';

export class SplitManager extends BaseManager implements ISplitLayoutController {
  private readonly splitManagerLogger = splitLogger;
  private readonly coordinator: IManagerCoordinator;

  constructor(coordinator: IManagerCoordinator) {
    super('SplitManager', {
      enableLogging: true,
      enableValidation: false,
      enableErrorRecovery: true,
    });

    this.coordinator = coordinator;
    this.splitManagerLogger.lifecycle('initialization', 'starting');
  }

  protected doInitialize(): void {
    this.splitManagerLogger.lifecycle('initialization', 'completed');
  }

  protected doDispose(): void {
    this.splitManagerLogger.lifecycle('disposal', 'starting');
    this.terminals.clear();
    this.terminalContainers.clear();
    this.isSplitMode = false;
    this.splitDirection = null;
    this.splitManagerLogger.lifecycle('disposal', 'completed');
  }

  public isSplitMode = false;
  private splitDirection: 'horizontal' | 'vertical' | null = null;
  private currentPanelLocation: 'sidebar' | 'panel' = 'sidebar';
  public terminals = new Map<string, TerminalInstance>();
  private terminalContainers = new Map<string, HTMLElement>();
  private maxSplitCount = SPLIT_CONSTANTS.MAX_SPLIT_COUNT;
  private minTerminalHeight = SPLIT_CONSTANTS.MIN_TERMINAL_HEIGHT;

  private requestSplitLayoutUpdate(): void {
    const containerManager = this.coordinator?.getTerminalContainerManager?.();
    if (!containerManager) {
      return;
    }

    const orderedIds = containerManager.getContainerOrder();
    containerManager.applyDisplayState({
      mode: 'split',
      activeTerminalId: this.coordinator?.getActiveTerminalId?.() ?? null,
      orderedTerminalIds: orderedIds,
      splitDirection: this.splitDirection ?? 'vertical',
    });
  }

  public calculateSplitLayout(): { canSplit: boolean; terminalHeight: number; reason?: string } {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      return { canSplit: false, terminalHeight: 0, reason: 'Terminal body not found' };
    }

    // Get the current terminal body height (this is what we want to split)
    const availableHeight = terminalBody.clientHeight;

    // Use actual terminal count from our terminals map
    const currentTerminalCount = this.terminals.size;
    const totalTerminalCount = currentTerminalCount + 1; // Include new terminal being added

    // Check maximum split limit
    if (totalTerminalCount > this.maxSplitCount) {
      return {
        canSplit: false,
        terminalHeight: 0,
        reason: `Cannot split terminal: Maximum of ${this.maxSplitCount} terminals reached`,
      };
    }

    // Simple equal division: available height / total number of terminals
    const terminalHeight = Math.floor(availableHeight / totalTerminalCount);

    // Check minimum height constraint
    if (terminalHeight < this.minTerminalHeight) {
      return {
        canSplit: false,
        terminalHeight: 0,
        reason: `Terminal height would be too small (${terminalHeight}px < ${this.minTerminalHeight}px min)`,
      };
    }

    this.splitManagerLogger.info(
      `Equal split: ${availableHeight}px ÷ ${totalTerminalCount} terminals = ${terminalHeight}px per terminal`
    );
    return { canSplit: true, terminalHeight };
  }

  public updateSplitDirection(
    direction: 'horizontal' | 'vertical',
    location: 'sidebar' | 'panel'
  ): void {
    this.splitManagerLogger.info(
      `Updating split direction: ${this.splitDirection} -> ${direction} (location: ${location})`
    );

    this.setPanelLocation(location);

    if (this.splitDirection === direction) {
      this.splitManagerLogger.debug(`Split direction unchanged: ${direction}`);
      return;
    }

    const previousDirection = this.splitDirection;
    this.splitDirection = direction;

    // If we're in split mode, update the layout immediately
    if (this.isSplitMode && this.terminals.size > 1) {
      this.applyNewSplitLayout(direction, previousDirection, location);
    }

    this.splitManagerLogger.info(`Split direction updated to: ${direction}`);
  }

  private applyNewSplitLayout(
    newDirection: 'horizontal' | 'vertical',
    previousDirection: 'horizontal' | 'vertical' | null,
    _location: 'sidebar' | 'panel'
  ): void {
    this.splitManagerLogger.info(
      `Applying new split layout: ${previousDirection} -> ${newDirection} (${this.terminals.size} terminals)`
    );

    this.splitDirection = newDirection;
    this.requestSplitLayoutUpdate();

    setTimeout(() => {
      this.refitAllTerminals();
    }, 100);
  }

  private refitAllTerminals(): void {
    this.splitManagerLogger.info(`Refitting all ${this.terminals.size} terminals`);

    // 🔧 FIX (Issue #368): Use coordinator's refitAllTerminals for proper PTY notification
    // The coordinator's version includes double-fit pattern and PTY resize notification
    // which is critical for TUI applications (vim, htop, zellij) to receive correct dimensions
    if (this.coordinator?.refitAllTerminals) {
      this.splitManagerLogger.debug('Using coordinator refitAllTerminals for PTY notification');
      this.coordinator.refitAllTerminals();
      return;
    }

    // Fallback: original implementation (without PTY notification)
    this.splitManagerLogger.warn('Coordinator refitAllTerminals not available, using fallback');

    const terminalsWrapper = document.getElementById('terminals-wrapper');
    const terminalBody = document.getElementById('terminal-body');
    if (terminalsWrapper) {
      terminalsWrapper.style.width = '';
      terminalsWrapper.style.maxWidth = '';
    }
    if (terminalBody) {
      terminalBody.style.width = '';
      terminalBody.style.maxWidth = '';
    }

    this.terminals.forEach((_terminalData, terminalId) => {
      const container = this.terminalContainers.get(terminalId);
      if (container) {
        DOMUtils.resetXtermInlineStyles(container, false);
      }
    });
    DOMUtils.forceReflow();

    requestAnimationFrame(() => {
      this.terminals.forEach((terminalData, terminalId) => {
        if (terminalData.fitAddon && terminalData.terminal) {
          try {
            terminalData.fitAddon.fit();
            terminalData.terminal.refresh(0, terminalData.terminal.rows - 1);
            this.splitManagerLogger.debug(`Refitted terminal ${terminalId}`);
          } catch (error) {
            this.splitManagerLogger.error(`Error refitting terminal ${terminalId}: ${error}`);
          }
        }
      });
    });
  }

  public calculateTerminalHeightPercentage(): string {
    const terminalCount = this.terminals.size;
    if (terminalCount <= 1) {
      return '100%';
    }
    return `${Math.floor(100 / terminalCount)}%`;
  }

  public calculateTerminalHeightPixels(): number {
    // Use terminal-body as the reference for available height
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      this.splitManagerLogger.warn('Terminal body not found, using fallback');
      return 100; // Fallback
    }

    // Get the actual available height from terminal-body
    const bodyRect = terminalBody.getBoundingClientRect();
    const availableHeight = bodyRect.height;

    // Always use the current number of terminal containers
    const actualTerminalCount = Math.max(1, this.terminalContainers.size);

    this.splitManagerLogger.debug(
      `Terminal-body height: ${availableHeight}px, Terminal count: ${actualTerminalCount}`
    );
    this.splitManagerLogger.debug(`Body rect: ${JSON.stringify(bodyRect)}`);
    this.splitManagerLogger.debug(
      `Terminal containers: ${Array.from(this.terminalContainers.keys())}`
    );

    // Calculate equal height for all terminals
    const calculatedHeight = Math.floor(availableHeight / actualTerminalCount);
    this.splitManagerLogger.debug(`Calculated height per terminal: ${calculatedHeight}px`);

    return calculatedHeight;
  }

  public addTerminalToSplit(terminalId: string, _terminalName: string): void {
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.splitManagerLogger.error('Cannot add terminal to split layout');
      return;
    }

    this.requestSplitLayoutUpdate();
    this.splitManagerLogger.info(`Terminal added to split layout: ${terminalId}`);
  }

  public addNewTerminalToSplit(terminalId: string, _terminalName: string): void {
    this.splitManagerLogger.info(`Adding new terminal to split: ${terminalId} (${_terminalName})`);

    // Check if we can split
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.splitManagerLogger.error(`Cannot add more terminals to split: ${layoutInfo.reason}`);
      return;
    }

    this.requestSplitLayoutUpdate();
    this.splitManagerLogger.info(`New terminal added to split layout: ${terminalId}`);
  }

  public showSplitLimitWarning(reason: string): void {
    this.splitManagerLogger.warn(`Split limit reached: ${reason}`);
    showSplitLimitWarning(reason);
  }

  public prepareSplitMode(direction: 'horizontal' | 'vertical'): void {
    this.splitManagerLogger.info(`Preparing split mode: ${direction}`);
    this.isSplitMode = true;
    this.splitDirection = direction;
    this.requestSplitLayoutUpdate();
    this.splitManagerLogger.info('Split mode prepared');
  }

  public exitSplitMode(): void {
    this.splitManagerLogger.info('Exiting split mode');
    this.isSplitMode = false;
    this.splitDirection = null;

    const containerManager = this.coordinator?.getTerminalContainerManager?.();
    containerManager?.clearSplitArtifacts();

    setTimeout(() => {
      this.refitAllTerminals();
    }, 100);

    this.splitManagerLogger.info('Split mode exited successfully');
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    this.splitManagerLogger.info(`Splitting terminal with direction: ${direction}`);
    this.isSplitMode = true;
    this.splitDirection = direction;
    this.addTerminalToMultiSplit();
  }

  private addTerminalToMultiSplit(): void {
    this.splitManagerLogger.info('Adding terminal to multi-split layout');

    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.showSplitLimitWarning(layoutInfo.reason || 'Cannot add more terminals');
      return;
    }
    this.requestSplitLayoutUpdate();
    this.splitManagerLogger.info('Terminal added to multi-split layout');
  }

  public redistributeSplitTerminals(newHeight: number): void {
    this.splitManagerLogger.info(`Redistributing split terminals with new height: ${newHeight}px`);

    const terminalsWrapper = document.getElementById('terminals-wrapper');
    const terminalBody = document.getElementById('terminal-body');

    // Force reflow to ensure CSS changes are applied before reading dimensions
    DOMUtils.forceReflow(terminalsWrapper);

    const wrapperTargets = terminalsWrapper
      ? Array.from(
          terminalsWrapper.querySelectorAll<HTMLElement>('[data-terminal-wrapper-id]')
        )
      : [];

    const containerTargets = terminalsWrapper
      ? Array.from(
          terminalsWrapper.querySelectorAll<HTMLElement>('[data-terminal-container]')
        ).filter((container) =>
          container.style.display !== 'none' && !container.classList.contains('hidden-mode')
        )
      : Array.from(
          (terminalBody ?? document.body).querySelectorAll<HTMLElement>('[data-terminal-container]')
        ).filter(
          (container) =>
            container.style.display !== 'none' && !container.classList.contains('hidden-mode')
        );

    const targets = wrapperTargets.length > 0 ? wrapperTargets : containerTargets;
    const targetCount = targets.length;

    if (!this.isSplitMode && targetCount === 0) {
      return;
    }

    if (targetCount <= 1) {
      return;
    }

    // Clear existing inline height styles to allow CSS flex layout to recalculate
    targets.forEach((target) => {
      target.style.removeProperty('height');
      target.style.removeProperty('flex-basis');
      target.style.removeProperty('flex');
    });
    DOMUtils.forceReflow(terminalsWrapper);

    const baseHeight =
      newHeight > 0 ? newHeight : terminalsWrapper?.clientHeight ?? terminalBody?.clientHeight ?? 0;

    this.splitManagerLogger.debug(`baseHeight=${baseHeight}px, targetCount=${targetCount}`);

    if (baseHeight <= 0) {
      return;
    }

    const wrapperStyles = terminalsWrapper ? window.getComputedStyle(terminalsWrapper) : null;
    const paddingTop = wrapperStyles ? parseFloat(wrapperStyles.paddingTop) || 0 : 0;
    const paddingBottom = wrapperStyles ? parseFloat(wrapperStyles.paddingBottom) || 0 : 0;
    const rowGapValue = wrapperStyles?.rowGap || wrapperStyles?.gap || '0px';
    const rowGap = parseFloat(rowGapValue) || 0;

    const availableHeight = Math.max(
      0,
      baseHeight - paddingTop - paddingBottom - rowGap * (targetCount - 1)
    );
    const terminalHeight = Math.floor(availableHeight / targetCount);

    this.splitManagerLogger.debug(`availableHeight=${availableHeight}px, terminalHeight=${terminalHeight}px`);

    targets.forEach((target) => {
      target.style.setProperty('flex', '0 0 auto', 'important');
      target.style.setProperty('flex-basis', `${terminalHeight}px`, 'important');
      target.style.setProperty('height', `${terminalHeight}px`, 'important');
      target.style.minHeight = '0';
    });

    if (wrapperTargets.length > 0) {
      wrapperTargets.forEach((wrapper) => {
        const area = wrapper.querySelector<HTMLElement>('[data-terminal-area-id]');
        if (area) {
          area.style.flex = '1 1 auto';
          area.style.minHeight = '0';
          area.style.height = '100%';
        }
      });
    }

    this.refitAllTerminals();
  }

  public getSplitTerminals(): Map<string, HTMLElement> {
    return this.terminalContainers;
  }

  public getIsSplitMode(): boolean {
    return this.isSplitMode;
  }

  /**
   * Get current split direction
   * Returns 'vertical' for sidebar (stacked), 'horizontal' for panel (side-by-side)
   */
  public getSplitDirection(): 'horizontal' | 'vertical' {
    // If split direction is set, return it
    if (this.splitDirection) {
      return this.splitDirection;
    }
    // Otherwise, derive from panel location
    return this.currentPanelLocation === 'panel' ? 'horizontal' : 'vertical';
  }

  public getTerminals(): Map<string, TerminalInstance> {
    return this.terminals;
  }

  public getTerminalContainers(): Map<string, HTMLElement> {
    return this.terminalContainers;
  }

  /**
   * Get optimal split direction based on panel location
   */
  public getOptimalSplitDirection(
    location: 'sidebar' | 'panel' | string
  ): 'vertical' | 'horizontal' {
    if (location === 'panel') {
      return 'horizontal'; // Wide layout - horizontal split
    } else {
      return 'vertical'; // Sidebar or unknown - vertical split
    }
  }

  public setPanelLocation(location: 'sidebar' | 'panel'): void {
    this.splitManagerLogger.info(
      `📍 [SPLIT] Panel location updated: ${this.currentPanelLocation} → ${location}`
    );
    this.currentPanelLocation = location;
  }

  public getCurrentPanelLocation(): 'sidebar' | 'panel' {
    return this.currentPanelLocation;
  }

  public setTerminal(id: string, terminal: TerminalInstance): void {
    const terminalWithId: TerminalInstance = { ...terminal, id };
    this.terminals.set(id, terminalWithId);
  }

  public setTerminalContainer(id: string, container: HTMLElement): void {
    this.terminalContainers.set(id, container);
  }

  public removeTerminal(id: string): void {
    const terminal = this.terminals.get(id);
    const container = this.terminalContainers.get(id);

    this.splitManagerLogger.info(
      `Removing terminal ${id}, terminal: ${!!terminal}, container: ${!!container}`
    );

    const wasInSplitMode = this.isSplitMode;
    const remainingAfterRemoval = this.terminals.size - (terminal ? 1 : 0);

    if (terminal) {
      try {
        terminal.terminal.dispose();
        this.splitManagerLogger.debug(`Terminal ${id} disposed successfully`);
      } catch (error) {
        this.splitManagerLogger.error(`Error disposing terminal ${id}: ${error}`);
      }
      this.terminals.delete(id);
    }

    if (container) {
      try {
        container.remove();
        this.splitManagerLogger.debug(`Container for terminal ${id} removed from DOM`);
      } catch (error) {
        this.splitManagerLogger.error(`Error removing container for terminal ${id}: ${error}`);
      }
      this.terminalContainers.delete(id);
    }

    this.splitManagerLogger.info(`Terminal ${id} fully removed from SplitManager`);
    this.splitManagerLogger.debug(`Remaining terminals: ${Array.from(this.terminals.keys())}`);
    this.splitManagerLogger.debug(
      `Remaining containers: ${Array.from(this.terminalContainers.keys())}`
    );

    if (wasInSplitMode) {
      setTimeout(() => {
        if (remainingAfterRemoval <= 1) {
          this.splitManagerLogger.info(
            `Exiting split mode after removal (${this.terminals.size} terminal remaining)`
          );
          this.isSplitMode = false;
          this.splitDirection = null;
        } else if (this.terminals.size > 1) {
          this.splitManagerLogger.info(
            `Refreshing split layout after removal (${this.terminals.size} terminals remaining)`
          );
          this.requestSplitLayoutUpdate();
          setTimeout(() => this.refitAllTerminals(), 50);
        }
      }, 50);
    }
  }

  public override dispose(): void {
    this.splitManagerLogger.info('Disposing split manager');

    for (const [id, terminal] of this.terminals) {
      try {
        terminal.terminal.dispose();
      } catch (error) {
        this.splitManagerLogger.error(`Error disposing terminal ${id}: ${String(error)}`);
      }
    }

    this.terminals.clear();
    this.terminalContainers.clear();
    this.isSplitMode = false;
    this.splitDirection = null;
    super.dispose();
    this.splitManagerLogger.lifecycle('SplitManager', 'completed');
  }
}
