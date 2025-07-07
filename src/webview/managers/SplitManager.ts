/**
 * ターミナル分割管理クラス
 */
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SPLIT_CONSTANTS } from '../constants/webview';

export interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  name: string;
}

export class SplitManager {
  // Split functionality
  public secondaryTerminal: Terminal | null = null;
  public secondaryTerminalId: string | null = null;
  public secondaryFitAddon: FitAddon | null = null;
  private secondaryContainer: HTMLElement | null = null;
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

    // Include existing primary terminal in the count
    const existingPrimaryTerminal = document.getElementById('primary-terminal');
    const currentTerminalCount = existingPrimaryTerminal ? 1 : 0;
    const nextSplitCount = this.splitTerminals.size + 1; // New terminal to be added
    const totalTerminalCount = currentTerminalCount + nextSplitCount;

    // Check maximum split limit
    if (totalTerminalCount > this.maxSplitCount) {
      return {
        canSplit: false,
        terminalHeight: 0,
        reason: `Split view supports up to ${this.maxSplitCount} terminals`,
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

      // Calculate height for 2 terminals (existing + new one that will be added)
      const availableHeight = terminalBody.clientHeight;
      const heightPerTerminal = Math.floor(availableHeight / 2);

      // Set the existing terminal to half height
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
    container.className = 'split-terminal-container';

    // Simple: use the calculated height directly
    container.style.cssText = `
      height: ${height}px;
      background: #000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
      flex-shrink: 0;
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

    container.appendChild(header);
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

    const warning = document.createElement('div');
    warning.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--vscode-notifications-background, #1e1e1e);
      border: 2px solid var(--vscode-notificationWarning-border, #ffcc02);
      border-radius: 6px;
      padding: 12px 16px;
      color: var(--vscode-notificationWarning-foreground, #ffffff);
      font-size: 11px;
      z-index: 10000;
      max-width: 300px;
      text-align: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    `;

    warning.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; justify-content: center;">
        <span>⚠️</span>
        <strong>Split Limit Reached</strong>
      </div>
      <div style="font-size: 10px;">${reason}</div>
    `;

    document.body.appendChild(warning);

    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
      }
    }, 4000);
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
    this.terminals.set(id, terminal);
  }

  public setTerminalContainer(id: string, container: HTMLElement): void {
    this.terminalContainers.set(id, container);
  }
}
