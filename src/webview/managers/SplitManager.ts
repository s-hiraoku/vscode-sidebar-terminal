/**
 * ターミナル分割管理クラス
 */
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { showSplitLimitWarning } from '../utils/NotificationUtils';
import { BaseManager } from './BaseManager';
import { TerminalInstance } from '../interfaces/ManagerInterfaces';

// Re-export TerminalInstance for tests
export { TerminalInstance };
import { splitLogger } from '../utils/ManagerLogger';
import { TerminalContainerFactory } from '../factories/TerminalContainerFactory';

export class SplitManager extends BaseManager {
  // Specialized logger for Split Manager
  private readonly splitManagerLogger = splitLogger;

  constructor() {
    super('SplitManager', {
      enableLogging: true,
      enableValidation: false,
      enableErrorRecovery: true,
    });

    this.splitManagerLogger.lifecycle('initialization', 'starting');
  }

  // Split functionality
  public isSplitMode = false;
  private splitDirection: 'horizontal' | 'vertical' | null = null;

  // Multiple terminal management
  public terminals = new Map<string, TerminalInstance>();
  private terminalContainers = new Map<string, HTMLElement>();

  // Multi-split layout management
  private splitTerminals = new Map<string, HTMLElement>();
  private maxSplitCount = SPLIT_CONSTANTS.MAX_SPLIT_COUNT;
  private minTerminalHeight = SPLIT_CONSTANTS.MIN_TERMINAL_HEIGHT;

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
    location: 'sidebar' | 'panel'
  ): void {
    this.splitManagerLogger.info(
      `Applying new split layout: ${previousDirection} -> ${newDirection} (${this.terminals.size} terminals)`
    );

    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      this.splitManagerLogger.error('Terminal body not found');
      return;
    }

    try {
      // Update the flex direction of the terminal body
      const flexDirection = newDirection === 'horizontal' ? 'row' : 'column';
      terminalBody.style.flexDirection = flexDirection;

      this.splitManagerLogger.debug(`Updated terminal-body flex-direction to: ${flexDirection}`);

      // Update all terminal containers for the new layout
      this.terminalContainers.forEach((container, terminalId) => {
        this.updateTerminalContainerForDirection(container, terminalId, newDirection);
      });

      // Recalculate and apply sizing
      this.recalculateSplitSizing(newDirection, location);

      // Force layout recalculation and refit all terminals
      setTimeout(() => {
        this.refitAllTerminals();
      }, 100);

      this.splitManagerLogger.info(`New split layout applied: ${newDirection}`);
    } catch (error) {
      this.splitManagerLogger.error(`Error applying new split layout: ${error}`);
    }
  }

  /**
   * 🆕 Update individual terminal container for new split direction
   */
  private updateTerminalContainerForDirection(
    container: HTMLElement,
    terminalId: string,
    direction: 'horizontal' | 'vertical'
  ): void {
    if (direction === 'horizontal') {
      // Horizontal split: terminals side by side
      container.style.width = 'auto';
      container.style.height = '100%';
      container.style.flex = '1';
      container.style.minWidth = '200px';
      container.style.minHeight = '0';
    } else {
      // Vertical split: terminals stacked
      container.style.width = '100%';
      container.style.height = 'auto';
      container.style.flex = '1';
      container.style.minHeight = '100px';
      container.style.minWidth = '0';
    }

    this.splitManagerLogger.debug(`Updated container for terminal ${terminalId} (${direction})`);
  }

  /**
   * 🆕 Recalculate split sizing for new direction
   */
  private recalculateSplitSizing(
    direction: 'horizontal' | 'vertical',
    location: 'sidebar' | 'panel'
  ): void {
    const terminalCount = this.terminals.size;
    if (terminalCount <= 1) return;

    this.splitManagerLogger.info(
      `Recalculating sizing for ${terminalCount} terminals (${direction}, ${location})`
    );

    // Calculate optimal size per terminal
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) return;

    const availableWidth = terminalBody.clientWidth;
    const availableHeight = terminalBody.clientHeight;

    if (direction === 'horizontal') {
      // Horizontal split: equal width distribution
      const widthPerTerminal = Math.floor(availableWidth / terminalCount);
      this.terminalContainers.forEach((container, terminalId) => {
        container.style.width = `${widthPerTerminal}px`;
        container.style.height = '100%';
        this.splitManagerLogger.debug(`Set terminal ${terminalId} width: ${widthPerTerminal}px`);
      });
    } else {
      // Vertical split: equal height distribution
      const heightPerTerminal = Math.floor(availableHeight / terminalCount);
      this.terminalContainers.forEach((container, terminalId) => {
        container.style.width = '100%';
        container.style.height = `${heightPerTerminal}px`;
        this.splitManagerLogger.debug(`Set terminal ${terminalId} height: ${heightPerTerminal}px`);
      });
    }
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
    this.splitManagerLogger.debug(`Terminal containers: ${Array.from(this.terminalContainers.keys())}`);

    // Calculate equal height for all terminals
    const calculatedHeight = Math.floor(availableHeight / actualTerminalCount);
    this.splitManagerLogger.debug(`Calculated height per terminal: ${calculatedHeight}px`);

    return calculatedHeight;
  }

  public initializeMultiSplitLayout(): void {
    this.splitManagerLogger.info('Initializing multi-split layout');

    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      this.splitManagerLogger.error('Terminal body not found');
      return;
    }

    // Set up flex column layout for vertical splits
    terminalBody.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    `;

    // Find and adjust existing terminal container
    const existingPrimaryTerminal = document.getElementById('primary-terminal');
    if (existingPrimaryTerminal) {
      this.splitManagerLogger.debug('Adjusting existing primary terminal for split layout');

      // Calculate height for all terminals (existing + new one that will be added)
      const availableHeight = terminalBody.clientHeight;
      const totalTerminals = this.terminals.size + 1; // Include new terminal being added
      const heightPerTerminal = Math.floor(availableHeight / totalTerminals);

      // Set the existing terminal to calculated height
      existingPrimaryTerminal.style.cssText = `
        height: ${heightPerTerminal}px;
        background: #000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-bottom: 1px solid var(--vscode-widget-border, #454545);
        flex-shrink: 0;
      `;

      this.splitManagerLogger.debug(`Set existing terminal height to ${heightPerTerminal}px`);
    }

    this.isSplitMode = true;
    this.splitDirection = 'vertical';
    this.splitManagerLogger.lifecycle('multi-split layout', 'completed');
  }

  public createSplitTerminalContainer(id: string, name: string, height: number): HTMLElement {
    try {
      // Use TerminalContainerFactory for standardized container creation
      const containerConfig = {
        id: id,
        name: name,
        className: 'split-terminal-container terminal-container',
        height: height,
        isSplit: true,
        isActive: false,
        customStyles: {
          borderBottom: '1px solid var(--vscode-widget-border, #454545)',
          flexShrink: '0',
          transition: 'border-color 0.2s ease-in-out'
        }
      };

      const headerConfig = {
        showHeader: false, // Headers are disabled for split terminals in original implementation
        showCloseButton: false,
        showSplitButton: false,
        onContainerClick: (clickedTerminalId: string) => {
          splitLogger.info(`🎯 Split terminal container clicked: ${clickedTerminalId}`);
          this.coordinator?.setActiveTerminalId(clickedTerminalId);
        }
      };

      const elements = TerminalContainerFactory.createContainer(containerConfig, headerConfig);

      // Set specific attributes for split terminal
      elements.container.id = `split-terminal-${id}`;
      elements.container.setAttribute('data-terminal-id', id);

      // 🔧 AI Agent Support: Register header elements with UIManager for status updates
      if (elements.headerElements) {
        const uiManager = this.coordinator?.getManagers()?.ui;
        if (uiManager && 'headerElementsCache' in uiManager) {
          // Add header elements to UIManager cache for AI Agent status updates
          (uiManager as any).headerElementsCache.set(id, elements.headerElements);
          splitLogger.info(`✅ Split terminal header elements registered with UIManager for AI Agent support: ${id}`);
        }
      }

      // Create terminal area within the container body
      const terminalArea = document.createElement('div');
      terminalArea.id = `split-terminal-area-${id}`;
      terminalArea.style.cssText = `
        flex: 1;
        background: #000;
        overflow: hidden;
      `;
      
      // Replace the container body with our terminal area
      elements.body.innerHTML = '';
      elements.body.appendChild(terminalArea);

      this.splitManagerLogger.info(`Created container for ${name}: ${height}px total`);
      return elements.container;

    } catch (error) {
      this.splitManagerLogger.error(`Failed to create split terminal container for ${id}: ${error}`);
      
      // Fallback to original implementation
      const container = document.createElement('div');
      container.id = `split-terminal-${id}`;
      container.className = 'split-terminal-container terminal-container';
      container.setAttribute('data-terminal-id', id);
      
      container.style.cssText = `
        height: ${height}px;
        background: #000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-bottom: 1px solid var(--vscode-widget-border, #454545);
        flex-shrink: 0;
        border: 1px solid transparent;
        transition: border-color 0.2s ease-in-out;
      `;

      const terminalArea = document.createElement('div');
      terminalArea.id = `split-terminal-area-${id}`;
      terminalArea.style.cssText = `
        flex: 1;
        background: #000;
        overflow: hidden;
      `;

      container.appendChild(terminalArea);
      return container;
    }
  }

  public redistributeSplitTerminals(
    newHeight: number,
    mainTerminal?: Terminal,
    mainFitAddon?: FitAddon
  ): void {
    const totalTerminals = this.splitTerminals.size;

    // Include existing primary terminal if it exists
    const existingPrimaryTerminal = document.getElementById('primary-terminal');
    const actualTerminalCount = existingPrimaryTerminal ? totalTerminals + 1 : totalTerminals;

    this.splitManagerLogger.info(
      `Redistributing ${actualTerminalCount} terminals (${totalTerminals} split + ${existingPrimaryTerminal ? 1 : 0} primary) to ${newHeight}px each`
    );

    // Adjust existing primary terminal if it exists
    if (existingPrimaryTerminal) {
      existingPrimaryTerminal.style.height = `${newHeight}px`;

      // Resize main terminal instance
      if (mainTerminal && mainFitAddon) {
        setTimeout(() => {
          mainFitAddon?.fit();
        }, 100);
      }
    }

    // Adjust all split terminals
    this.splitTerminals.forEach((container, terminalId) => {
      container.style.height = `${newHeight}px`;

      // Resize terminal instance if it exists
      const terminalData = this.terminals.get(terminalId);
      if (terminalData?.fitAddon) {
        setTimeout(() => {
          terminalData.fitAddon.fit();
        }, 100);
      }
    });
  }

  public addToSplitDOM(container: HTMLElement): void {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      this.splitManagerLogger.error('Terminal body not found');
      return;
    }

    // Add splitter if this is not the first terminal
    if (this.splitTerminals.size > 0) {
      const splitter = this.createSplitter();
      terminalBody.appendChild(splitter);
    }

    terminalBody.appendChild(container);
  }

  private createSplitter(): HTMLElement {
    const splitter = document.createElement('div');
    splitter.className = 'split-resizer';
    splitter.style.cssText = `
      height: 4px;
      background: var(--vscode-widget-border, #454545);
      cursor: row-resize;
      flex-shrink: 0;
      transition: background-color 0.2s ease;
    `;

    splitter.addEventListener('mouseenter', (): void => {
      splitter.style.background = 'var(--vscode-focusBorder, #007acc)';
    });

    splitter.addEventListener('mouseleave', (): void => {
      splitter.style.background = 'var(--vscode-widget-border, #454545)';
    });

    return splitter;
  }

  public addTerminalToSplit(terminalId: string, terminalName: string): void {
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.splitManagerLogger.error('Cannot add terminal to split layout');
      return;
    }

    // Create split terminal container
    const splitContainer = this.createSplitTerminalContainer(
      terminalId,
      terminalName,
      layoutInfo.terminalHeight
    );

    // Add to split layout
    this.addToSplitDOM(splitContainer);

    // Store reference
    this.splitTerminals.set(terminalId, splitContainer);

    this.splitManagerLogger.info(`Terminal added to split layout: ${terminalId}`);
  }

  public addNewTerminalToSplit(terminalId: string, terminalName: string): void {
    this.splitManagerLogger.info(`Adding new terminal to split: ${terminalId} (${terminalName})`);

    // Check if we can split
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.splitManagerLogger.error(`Cannot add more terminals to split: ${layoutInfo.reason}`);
      return;
    }

    // Move the terminal container to split layout
    this.moveTerminalToSplitLayout(terminalId, terminalName);

    this.splitManagerLogger.info(`New terminal added to split layout: ${terminalId}`);
  }

  private moveTerminalToSplitLayout(terminalId: string, terminalName: string): void {
    // Get the existing terminal data
    const terminalData = this.terminals.get(terminalId);
    if (!terminalData) {
      this.splitManagerLogger.error(`Terminal data not found for: ${terminalId}`);
      return;
    }

    // Calculate layout
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.splitManagerLogger.error('Cannot move terminal to split layout');
      return;
    }

    // Create split container for this terminal
    const splitContainer = this.createSplitTerminalContainer(
      terminalId,
      terminalName,
      layoutInfo.terminalHeight
    );

    // Move the terminal container to the split area
    const terminalArea = splitContainer.querySelector(`#split-terminal-area-${terminalId}`);
    const terminalContainer = this.terminalContainers.get(terminalId);
    if (terminalArea && terminalContainer) {
      // Move the terminal container into the split area
      terminalArea.appendChild(terminalContainer);

      // Adjust container styles for split layout
      terminalContainer.style.cssText = `
        width: 100%;
        height: 100%;
      `;
    }

    // Add to split DOM
    this.addToSplitDOM(splitContainer);

    // Redistribute all terminals
    this.redistributeSplitTerminals(layoutInfo.terminalHeight);

    // Store reference
    this.splitTerminals.set(terminalId, splitContainer);
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

    // Initialize multi-split layout if this is the first split
    if (this.splitTerminals.size === 0) {
      this.initializeMultiSplitLayout();
    }

    this.splitManagerLogger.info('Split mode prepared, waiting for new terminal');
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    if (direction === 'vertical') {
      this.addTerminalToMultiSplit();
    } else {
      // Keep horizontal split as the old 2-pane split for now
      this.splitManagerLogger.info('Horizontal split not implemented in this version');
    }
  }

  private addTerminalToMultiSplit(): void {
    this.splitManagerLogger.info('Adding terminal to multi-split layout');

    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.showSplitLimitWarning(layoutInfo.reason || 'Cannot add more terminals');
      return;
    }

    // If this is the first split, convert to multi-split layout
    if (this.splitTerminals.size === 0) {
      this.initializeMultiSplitLayout();
    }

    this.splitManagerLogger.info('Terminal added to multi-split layout');
  }

  // Getters
  public getSplitTerminals(): Map<string, HTMLElement> {
    return this.splitTerminals;
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
    this.splitManagerLogger.debug(`Remaining containers: ${Array.from(this.terminalContainers.keys())}`);
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
    this.splitTerminals.clear();
    this.isSplitMode = false;
    this.splitDirection = null;

    // Call parent dispose
    super.dispose();

    this.splitManagerLogger.lifecycle('SplitManager', 'completed');
  }
}
