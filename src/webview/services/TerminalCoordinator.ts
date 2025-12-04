/**
 * Terminal Coordinator Service Implementation
 * Extracted from RefactoredTerminalWebviewManager to handle pure terminal coordination
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  ITerminalCoordinator,
  TerminalInfo,
  TerminalCreationOptions,
  TerminalCoordinatorEvents,
  TerminalCoordinatorConfig,
} from './ITerminalCoordinator';
import { BaseManager } from '../managers/BaseManager';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { safeProcessCwd } from '../../utils/common';
import { DOMUtils } from '../utils/DOMUtils';

interface InternalTerminalInfo extends TerminalInfo {
  container: HTMLElement;
  fitAddon: FitAddon;
}

/**
 * Core terminal coordination service
 * Handles terminal lifecycle without UI concerns
 */
export class TerminalCoordinator extends BaseManager implements ITerminalCoordinator {
  private readonly terminals = new Map<string, InternalTerminalInfo>();
  private readonly eventListeners = new Map<keyof TerminalCoordinatorEvents, Set<Function>>();
  private activeTerminalId: string | undefined;
  private readonly config: TerminalCoordinatorConfig;
  private terminalCounter = 0;

  constructor(config: TerminalCoordinatorConfig) {
    super('TerminalCoordinator', {
      enableLogging: config.debugMode,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.config = config;
    this.initializeEventListeners();
  }

  /**
   * Public initialize method to satisfy interface
   */
  public override async initialize(): Promise<void> {
    // Call the base manager initialization
    this.doInitialize();
  }

  protected doInitialize(): void {
    this.logger('Terminal coordinator initialized');
  }

  protected doDispose(): void {
    // Dispose all terminals
    for (const [terminalId] of this.terminals) {
      this.removeTerminal(terminalId);
    }
    this.terminals.clear();
    this.eventListeners.clear();
    this.activeTerminalId = undefined;
    this.logger('Terminal coordinator disposed');
  }

  private initializeEventListeners(): void {
    const eventTypes: (keyof TerminalCoordinatorEvents)[] = [
      'onTerminalCreated',
      'onTerminalRemoved',
      'onTerminalActivated',
      'onTerminalOutput',
      'onTerminalResize',
    ];

    for (const eventType of eventTypes) {
      this.eventListeners.set(eventType, new Set());
    }
  }

  private emitEvent<K extends keyof TerminalCoordinatorEvents>(
    event: K,
    ...args: Parameters<TerminalCoordinatorEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          (listener as any)(...args);
        } catch (error) {
          this.logger(`Error in event listener for ${event}: ${error}`);
        }
      }
    }
  }

  // Terminal lifecycle management
  public async createTerminal(_options: TerminalCreationOptions = {}): Promise<string> {
    if (!this.canCreateTerminal()) {
      throw new Error(
        `Cannot create terminal: maximum of ${this.config.maxTerminals} terminals reached`
      );
    }

    const terminalId = `terminal-${++this.terminalCounter}`;

    try {
      // Create terminal instance
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: 'var(--vscode-terminal-background)',
          foreground: 'var(--vscode-terminal-foreground)',
        },
        scrollback: 10000,
        allowProposedApi: true,
      });

      // Create fit addon
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Create container
      const container = document.createElement('div');
      container.id = `terminal-container-${terminalId}`;
      container.className = 'terminal-container';
      container.style.display = 'none'; // Hidden by default

      // Open terminal in container
      terminal.open(container);

      // Reset xterm.js inline styles before fit to allow terminal expansion
      DOMUtils.resetXtermInlineStyles(container);
      fitAddon.fit();

      // 🔧 FIX: Refresh to ensure cursor and decorations are rendered
      // Do NOT call terminal.clear() as it interferes with shell prompt
      terminal.refresh(0, terminal.rows - 1);

      // Setup terminal event handlers
      this.setupTerminalEventHandlers(terminal, terminalId);

      // Create terminal info
      const terminalInfo: InternalTerminalInfo = {
        id: terminalId,
        terminal,
        fitAddon,
        container,
        number: this.terminalCounter,
        isActive: false,
      };

      // Store terminal
      this.terminals.set(terminalId, terminalInfo);

      // Set as active if it's the first terminal
      if (this.terminals.size === 1) {
        this.activateTerminal(terminalId);
      }

      // Emit creation event
      this.emitEvent('onTerminalCreated', terminalInfo);

      this.logger(`Terminal created: ${terminalId}`);
      return terminalId;
    } catch (error) {
      this.logger(`Failed to create terminal: ${error}`);
      throw error;
    }
  }

  public async removeTerminal(terminalId: string): Promise<boolean> {
    const terminalInfo = this.terminals.get(terminalId);
    if (!terminalInfo) {
      return false;
    }

    try {
      // Dispose terminal
      terminalInfo.terminal.dispose();

      // Remove container from DOM
      if (terminalInfo.container.parentNode) {
        terminalInfo.container.parentNode.removeChild(terminalInfo.container);
      }

      // Remove from map
      this.terminals.delete(terminalId);

      // Update active terminal if necessary
      if (this.activeTerminalId === terminalId) {
        this.selectNewActiveTerminal();
      }

      // Emit removal event
      this.emitEvent('onTerminalRemoved', terminalId);

      this.logger(`Terminal removed: ${terminalId}`);
      return true;
    } catch (error) {
      this.logger(`Failed to remove terminal ${terminalId}: ${error}`);
      return false;
    }
  }

  public activateTerminal(terminalId: string): void {
    const terminalInfo = this.terminals.get(terminalId);
    if (!terminalInfo) {
      this.logger(`Cannot activate terminal: ${terminalId} not found`);
      return;
    }

    // Deactivate current active terminal
    if (this.activeTerminalId) {
      const currentActive = this.terminals.get(this.activeTerminalId);
      if (currentActive) {
        (currentActive as any).isActive = false;
        currentActive.container.style.display = 'none';
      }
    }

    // Activate new terminal
    this.activeTerminalId = terminalId;
    (terminalInfo as any).isActive = true;
    terminalInfo.container.style.display = 'block';
    terminalInfo.terminal.focus();
    // Reset xterm.js inline styles before fit to allow terminal expansion
    DOMUtils.resetXtermInlineStyles(terminalInfo.container);
    terminalInfo.fitAddon.fit();

    // Emit activation event
    this.emitEvent('onTerminalActivated', terminalId);

    this.logger(`Terminal activated: ${terminalId}`);
  }

  private selectNewActiveTerminal(): void {
    if (this.terminals.size === 0) {
      this.activeTerminalId = undefined;
      return;
    }

    // Select the first available terminal
    const firstTerminalId = this.terminals.keys().next().value;
    if (firstTerminalId) {
      this.activateTerminal(firstTerminalId);
    }
  }

  private setupTerminalEventHandlers(terminal: Terminal, terminalId: string): void {
    // Resize handler
    terminal.onResize((dimensions) => {
      this.emitEvent('onTerminalResize', terminalId, dimensions.cols, dimensions.rows);
    });
  }

  // Terminal access methods
  public getTerminal(terminalId: string): Terminal | undefined {
    return this.terminals.get(terminalId)?.terminal;
  }

  public getTerminalInfo(terminalId: string): TerminalInfo | undefined {
    return this.terminals.get(terminalId);
  }

  public getAllTerminalInfos(): TerminalInfo[] {
    return Array.from(this.terminals.values());
  }

  public getActiveTerminalId(): string | undefined {
    return this.activeTerminalId;
  }

  // Terminal operations
  public writeToTerminal(terminalId: string, data: string): void {
    const terminal = this.getTerminal(terminalId);
    if (terminal) {
      terminal.write(data);
      // Auto-scroll to bottom to match VS Code standard terminal behavior
      terminal.scrollToBottom();
    } else {
      this.logger(`Cannot write to terminal: ${terminalId} not found`);
    }
  }

  public resizeTerminal(terminalId: string, cols: number, rows: number): void {
    const terminalInfo = this.terminals.get(terminalId);
    if (terminalInfo) {
      terminalInfo.terminal.resize(cols, rows);
      // Reset xterm.js inline styles before fit to allow terminal expansion
      DOMUtils.resetXtermInlineStyles(terminalInfo.container);
      terminalInfo.fitAddon.fit();
      this.emitEvent('onTerminalResize', terminalId, cols, rows);
    } else {
      this.logger(`Cannot resize terminal: ${terminalId} not found`);
    }
  }

  public async switchToTerminal(terminalId: string): Promise<void> {
    if (this.terminals.has(terminalId)) {
      this.activateTerminal(terminalId);
    } else {
      throw new Error(`Terminal ${terminalId} not found`);
    }
  }

  // State queries
  public hasTerminals(): boolean {
    return this.terminals.size > 0;
  }

  public canCreateTerminal(): boolean {
    return this.terminals.size < this.config.maxTerminals;
  }

  public getTerminalCount(): number {
    return this.terminals.size;
  }

  public getAvailableSlots(): number {
    return Math.max(0, this.config.maxTerminals - this.terminals.size);
  }

  // Event management
  public addEventListener<K extends keyof TerminalCoordinatorEvents>(
    event: K,
    listener: TerminalCoordinatorEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener as Function);
    }
  }

  public removeEventListener<K extends keyof TerminalCoordinatorEvents>(
    event: K,
    listener: TerminalCoordinatorEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as Function);
    }
  }
}

/**
 * Factory for creating terminal coordinators
 */
export class TerminalCoordinatorFactory {
  public static create(config: TerminalCoordinatorConfig): ITerminalCoordinator {
    return new TerminalCoordinator(config);
  }

  public static createDefault(): ITerminalCoordinator {
    const defaultConfig: TerminalCoordinatorConfig = {
      maxTerminals: SPLIT_CONSTANTS.MAX_TERMINALS || 5,
      defaultShell: '/bin/bash',
      workingDirectory: safeProcessCwd(),
      enablePerformanceOptimization: true,
      bufferSize: 1000,
      debugMode: false,
    };

    return new TerminalCoordinator(defaultConfig);
  }
}

// Re-export the interface for convenience
export { ITerminalCoordinator } from './ITerminalCoordinator';
