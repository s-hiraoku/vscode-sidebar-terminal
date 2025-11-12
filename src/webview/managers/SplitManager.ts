/**
 * ターミナル分割管理クラス
 */
import { SPLIT_CONSTANTS } from '../constants/webview';
import { showSplitLimitWarning } from '../utils/NotificationUtils';
import { BaseManager } from './BaseManager';
import { TerminalInstance } from '../interfaces/ManagerInterfaces';
import { ISplitLayoutController } from '../interfaces/ISplitLayoutController';

// Re-export TerminalInstance for tests
export { TerminalInstance };
import { splitLogger } from '../utils/ManagerLogger';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';

export class SplitManager extends BaseManager implements ISplitLayoutController {
  // Specialized logger for Split Manager
  private readonly splitManagerLogger = splitLogger;

  // Internal coordinator reference (Issue #216: constructor injection)
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

  /**
   * Initialize the SplitManager (BaseManager abstract method implementation)
   */
  protected doInitialize(): void {
    this.splitManagerLogger.lifecycle('initialization', 'completed');
  }

  /**
   * Dispose SplitManager resources (BaseManager abstract method implementation)
   */
  protected doDispose(): void {
    this.splitManagerLogger.lifecycle('disposal', 'starting');

    // Clear all terminals and containers
    this.terminals.clear();
    this.terminalContainers.clear();

    // Reset split state
    this.isSplitMode = false;
    this.splitDirection = null;

    this.splitManagerLogger.lifecycle('disposal', 'completed');
  }

  // Split functionality
  public isSplitMode = false;
  private splitDirection: 'horizontal' | 'vertical' | null = null;

  // 🆕 Current panel location (for optimal split direction)
  private currentPanelLocation: 'sidebar' | 'panel' = 'sidebar';

  // Multiple terminal management
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

  /**
   * 🆕 Update split direction dynamically based on panel location (Issue #148)
   * @param direction - New split direction
   * @param location - Panel location that triggered the change
   */
  public updateSplitDirection(
    direction: 'horizontal' | 'vertical',
    location: 'sidebar' | 'panel'
  ): void {
    this.splitManagerLogger.info(
      `Updating split direction: ${this.splitDirection} -> ${direction} (location: ${location})`
    );

    // 🆕 Update current panel location
    this.setPanelLocation(location);

    // Check if direction actually changed
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

  /**
   * 🆕 Apply new split layout while preserving terminal state
   * @param newDirection - New split direction
   * @param previousDirection - Previous split direction
   * @param location - Panel location
   */
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

  /**
   * 🆕 Update individual terminal container for new split direction
   */
  private updateTerminalContainerForDirection(
    container: HTMLElement,
    terminalId: string,
    direction: 'horizontal' | 'vertical'
  ): void {
    this.splitManagerLogger.debug(
      `updateTerminalContainerForDirection invoked for ${terminalId} (${direction})`
    );
  }

  /**
   * 🆕 Recalculate split sizing for new direction
   */
  private recalculateSplitSizing(
    direction: 'horizontal' | 'vertical',
    location: 'sidebar' | 'panel'
  ): void {
    const terminalCount = this.terminals.size;
    if (terminalCount <= 1) {
      return;
    }

    this.splitManagerLogger.info(
      `Recalculating sizing for ${terminalCount} terminals (${direction}, ${location})`
    );
  }

  /**
   * 🆕 Refit all terminals after layout change
   */
  private refitAllTerminals(): void {
    this.splitManagerLogger.info(`Refitting all ${this.terminals.size} terminals`);

    this.terminals.forEach((terminalData, terminalId) => {
      if (terminalData.fitAddon && terminalData.terminal) {
        try {
          // Force layout recalculation
          const container = this.terminalContainers.get(terminalId);
          if (container) {
            container.offsetHeight; // Trigger reflow
          }

          // Refit the terminal
          terminalData.fitAddon.fit();
          terminalData.terminal.refresh(0, terminalData.terminal.rows - 1);

          this.splitManagerLogger.debug(`Refitted terminal ${terminalId}`);
        } catch (error) {
          this.splitManagerLogger.error(`Error refitting terminal ${terminalId}: ${error}`);
        }
      }
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
    this.splitManagerLogger.info(
      `Adding new terminal to split: ${terminalId} (${_terminalName})`
    );

    // Check if we can split
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.splitManagerLogger.error(`Cannot add more terminals to split: ${layoutInfo.reason}`);
      return;
    }

    this.requestSplitLayoutUpdate();
    this.splitManagerLogger.info(`New terminal added to split layout: ${terminalId}`);
  }

  private moveTerminalToSplitLayout(terminalId: string, _terminalName: string): void {
    this.splitManagerLogger.info(
      `Rebalancing split layout for terminal ${terminalId} (${_terminalName})`
    );
    this.requestSplitLayoutUpdate();
  }

  public showSplitLimitWarning(reason: string): void {
    this.splitManagerLogger.warn(`Split limit reached: ${reason}`);
    showSplitLimitWarning(reason);
  }

  public prepareSplitMode(direction: 'horizontal' | 'vertical'): void {
    this.splitManagerLogger.info(`Preparing split mode: ${direction}`);

    // Set split mode flag and direction
    this.isSplitMode = true;
    this.splitDirection = direction;

    this.requestSplitLayoutUpdate();

    this.splitManagerLogger.info('Split mode prepared');
  }

  /**
   * 🆕 Exit split mode and return all terminals to normal layout
   * ISplitLayoutController implementation
   */
  public exitSplitMode(): void {
    this.splitManagerLogger.info('Exiting split mode');

    // Disable split mode
    this.isSplitMode = false;
    this.splitDirection = null;

    const containerManager = this.coordinator?.getTerminalContainerManager?.();
    containerManager?.clearSplitArtifacts();

    // Refit all terminals after layout change
    setTimeout(() => {
      this.refitAllTerminals();
    }, 100);

    this.splitManagerLogger.info('Split mode exited successfully');
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    this.splitManagerLogger.info(`Splitting terminal with direction: ${direction}`);

    // Ensure internal state reflects that split mode is now active
    this.isSplitMode = true;

    // Set split direction for layout calculation
    this.splitDirection = direction;

    // Add terminal to multi-split layout (works for both directions)
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

  /**
   * 分割ターミナルのサイズを再配分
   * @param newHeight 新しい高さ（ピクセル）
   */
  public redistributeSplitTerminals(newHeight: number): void {
    this.splitManagerLogger.info(`Redistributing split terminals with new height: ${newHeight}px`);

    if (!this.isSplitMode || this.terminals.size <= 1) {
      return;
    }

    // Equal distribution
    const terminalHeight = Math.floor(newHeight / this.terminals.size);

    this.terminalContainers.forEach((container) => {
      container.style.height = `${terminalHeight}px`;
    });

    // Refit all terminals
    this.refitAllTerminals();
  }

  // Getters
  public getSplitTerminals(): Map<string, HTMLElement> {
    return this.terminalContainers;
  }

  public getIsSplitMode(): boolean {
    return this.isSplitMode;
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

  /**
   * 🆕 Set current panel location
   */
  public setPanelLocation(location: 'sidebar' | 'panel'): void {
    this.splitManagerLogger.info(`📍 [SPLIT] Panel location updated: ${this.currentPanelLocation} → ${location}`);
    this.currentPanelLocation = location;
  }

  /**
   * 🆕 Get current panel location
   */
  public getCurrentPanelLocation(): 'sidebar' | 'panel' {
    return this.currentPanelLocation;
  }

  // Setters
  public setTerminal(id: string, terminal: TerminalInstance): void {
    // Create a new terminal instance with the correct id if needed
    const terminalWithId: TerminalInstance = {
      ...terminal,
      id: id,
    };
    this.terminals.set(id, terminalWithId);
  }

  public setTerminalContainer(id: string, container: HTMLElement): void {
    this.terminalContainers.set(id, container);
  }

  // Remove methods
  public removeTerminal(id: string): void {
    const terminal = this.terminals.get(id);
    const container = this.terminalContainers.get(id);

    this.splitManagerLogger.info(
      `Removing terminal ${id}, terminal: ${!!terminal}, container: ${!!container}`
    );

    if (terminal) {
      // Dispose terminal
      try {
        terminal.terminal.dispose();
        this.splitManagerLogger.debug(`Terminal ${id} disposed successfully`);
      } catch (error) {
        this.splitManagerLogger.error(`Error disposing terminal ${id}: ${error}`);
      }

      // Remove from terminals map
      this.terminals.delete(id);
    }

    if (container) {
      try {
        // Remove container from DOM
        container.remove();
        this.splitManagerLogger.debug(`Container for terminal ${id} removed from DOM`);
      } catch (error) {
        this.splitManagerLogger.error(`Error removing container for terminal ${id}: ${error}`);
      }

      // Remove from containers map
      this.terminalContainers.delete(id);
    }

    this.splitManagerLogger.info(`Terminal ${id} fully removed from SplitManager`);
    this.splitManagerLogger.debug(`Remaining terminals: ${Array.from(this.terminals.keys())}`);
    this.splitManagerLogger.debug(
      `Remaining containers: ${Array.from(this.terminalContainers.keys())}`
    );
  }

  /**
   * Dispose and cleanup all resources
   */
  public override dispose(): void {
    this.splitManagerLogger.info('Disposing split manager');

    // Dispose all terminals
    for (const [id, terminal] of this.terminals) {
      try {
        terminal.terminal.dispose();
      } catch (error) {
        this.splitManagerLogger.error(`Error disposing terminal ${id}: ${String(error)}`);
      }
    }

    // Clear all maps and reset state
    this.terminals.clear();
    this.terminalContainers.clear();
    this.isSplitMode = false;
    this.splitDirection = null;

    // Call parent dispose
    super.dispose();

    this.splitManagerLogger.lifecycle('SplitManager', 'completed');
  }
}
