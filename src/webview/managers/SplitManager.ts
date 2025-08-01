/**
 * ターミナル分割管理クラス
 */
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { showSplitLimitWarning } from '../utils/NotificationUtils';

export interface TerminalInstance {
  id: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  name: string;
  container: HTMLElement;
}

export class SplitManager {
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

    console.log(
      `📐 [SPLIT] Equal split: ${availableHeight}px ÷ ${totalTerminalCount} terminals = ${terminalHeight}px per terminal`
    );
    return { canSplit: true, terminalHeight };
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
      console.warn('⚠️ [HEIGHT] Terminal body not found, using fallback');
      return 100; // Fallback
    }

    // Get the actual available height from terminal-body
    const bodyRect = terminalBody.getBoundingClientRect();
    const availableHeight = bodyRect.height;

    // Always use the current number of terminal containers
    const actualTerminalCount = Math.max(1, this.terminalContainers.size);

    console.log(
      `📐 [HEIGHT] Terminal-body height: ${availableHeight}px, Terminal count: ${actualTerminalCount}`
    );
    console.log(`📐 [HEIGHT] Body rect:`, bodyRect);
    console.log(`📐 [HEIGHT] Terminal containers:`, Array.from(this.terminalContainers.keys()));

    // Calculate equal height for all terminals
    const calculatedHeight = Math.floor(availableHeight / actualTerminalCount);
    console.log(`📐 [HEIGHT] Calculated height per terminal: ${calculatedHeight}px`);

    return calculatedHeight;
  }

  public initializeMultiSplitLayout(): void {
    console.log('📐 [WEBVIEW] Initializing multi-split layout');

    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      console.error('❌ [WEBVIEW] Terminal body not found');
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
      console.log('📐 [WEBVIEW] Adjusting existing primary terminal for split layout');

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

      console.log(`📐 [WEBVIEW] Set existing terminal height to ${heightPerTerminal}px`);
    }

    this.isSplitMode = true;
    this.splitDirection = 'vertical';
    console.log('✅ [WEBVIEW] Multi-split layout initialized');
  }

  public createSplitTerminalContainer(id: string, name: string, height: number): HTMLElement {
    const container = document.createElement('div');
    container.id = `split-terminal-${id}`;
    container.className = 'split-terminal-container terminal-container';
    container.setAttribute('data-terminal-id', id);

    // Simple: use the calculated height directly
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

    // Create terminal header (small, fixed height)
    const header = document.createElement('div');
    header.style.cssText = `
      height: 20px;
      background: var(--vscode-tab-inactiveBackground, #2d2d30);
      color: var(--vscode-foreground, #cccccc);
      font-size: 10px;
      display: flex;
      align-items: center;
      padding: 0 6px;
      border-bottom: 1px solid var(--vscode-tab-border, #333);
      flex-shrink: 0;
    `;
    header.textContent = name;

    // Create terminal area (takes remaining space)
    const terminalArea = document.createElement('div');
    terminalArea.id = `split-terminal-area-${id}`;
    terminalArea.style.cssText = `
      flex: 1;
      background: #000;
      overflow: hidden;
    `;

    // container.appendChild(header);
    container.appendChild(terminalArea);

    console.log(`📐 [SPLIT] Created container for ${name}: ${height}px total`);
    return container;
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

    console.log(
      `📐 [WEBVIEW] Redistributing ${actualTerminalCount} terminals (${totalTerminals} split + ${existingPrimaryTerminal ? 1 : 0} primary) to ${newHeight}px each`
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
      console.error('❌ [WEBVIEW] Terminal body not found');
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
      console.error('❌ [WEBVIEW] Cannot add terminal to split layout');
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

    console.log('✅ [WEBVIEW] Terminal added to split layout:', terminalId);
  }

  public addNewTerminalToSplit(terminalId: string, terminalName: string): void {
    console.log('🔀 [WEBVIEW] Adding new terminal to split:', terminalId, terminalName);

    // Check if we can split
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      console.error('❌ [WEBVIEW] Cannot add more terminals to split:', layoutInfo.reason);
      return;
    }

    // Move the terminal container to split layout
    this.moveTerminalToSplitLayout(terminalId, terminalName);

    console.log('✅ [WEBVIEW] New terminal added to split layout:', terminalId);
  }

  private moveTerminalToSplitLayout(terminalId: string, terminalName: string): void {
    // Get the existing terminal data
    const terminalData = this.terminals.get(terminalId);
    if (!terminalData) {
      console.error('❌ [WEBVIEW] Terminal data not found for:', terminalId);
      return;
    }

    // Calculate layout
    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      console.error('❌ [WEBVIEW] Cannot move terminal to split layout');
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
    console.warn('⚠️ [WEBVIEW] Split limit reached:', reason);
    showSplitLimitWarning(reason);
  }

  public prepareSplitMode(direction: 'horizontal' | 'vertical'): void {
    console.log('🔀 [WEBVIEW] Preparing split mode:', direction);

    // Set split mode flag and direction
    this.isSplitMode = true;
    this.splitDirection = direction;

    // Initialize multi-split layout if this is the first split
    if (this.splitTerminals.size === 0) {
      this.initializeMultiSplitLayout();
    }

    console.log('✅ [WEBVIEW] Split mode prepared, waiting for new terminal');
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    if (direction === 'vertical') {
      this.addTerminalToMultiSplit();
    } else {
      // Keep horizontal split as the old 2-pane split for now
      console.log('🔀 [WEBVIEW] Horizontal split not implemented in this version');
    }
  }

  private addTerminalToMultiSplit(): void {
    console.log('📐 [WEBVIEW] Adding terminal to multi-split layout');

    const layoutInfo = this.calculateSplitLayout();
    if (!layoutInfo.canSplit) {
      this.showSplitLimitWarning(layoutInfo.reason || 'Cannot add more terminals');
      return;
    }

    // If this is the first split, convert to multi-split layout
    if (this.splitTerminals.size === 0) {
      this.initializeMultiSplitLayout();
    }

    console.log('✅ [WEBVIEW] Terminal added to multi-split layout');
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

  // Setters
  public setTerminal(id: string, terminal: TerminalInstance): void {
    // Ensure terminal has the correct id
    terminal.id = id;
    this.terminals.set(id, terminal);
  }

  public setTerminalContainer(id: string, container: HTMLElement): void {
    this.terminalContainers.set(id, container);
  }

  // Remove methods
  public removeTerminal(id: string): void {
    const terminal = this.terminals.get(id);
    const container = this.terminalContainers.get(id);

    console.log(
      '🗑️ [SPLIT] Removing terminal %s, terminal: %s, container: %s',
      id,
      !!terminal,
      !!container
    );

    if (terminal) {
      // Dispose terminal
      try {
        terminal.terminal.dispose();
        console.log('🗑️ [SPLIT] Terminal %s disposed successfully', id);
      } catch (error) {
        console.error(`Error disposing terminal ${id}:`, error);
      }

      // Remove from terminals map
      this.terminals.delete(id);
    }

    if (container) {
      try {
        // Remove container from DOM
        container.remove();
        console.log('🗑️ [SPLIT] Container for terminal %s removed from DOM', id);
      } catch (error) {
        console.error(`Error removing container for terminal ${id}:`, error);
      }

      // Remove from containers map
      this.terminalContainers.delete(id);
    }

    console.log('🗑️ [SPLIT] Terminal %s fully removed from SplitManager', id);
    console.log(`🗑️ [SPLIT] Remaining terminals:`, Array.from(this.terminals.keys()));
    console.log(`🗑️ [SPLIT] Remaining containers:`, Array.from(this.terminalContainers.keys()));
  }
}
