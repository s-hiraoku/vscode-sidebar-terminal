/**
 * Terminal Lifecycle Manager
 *
 * Simplified terminal lifecycle management using centralized utilities
 * Responsibilities: terminal creation, deletion, switching, and state management
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalConfig } from '../../types/shared';
import { TerminalInstance, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { SplitManager } from './SplitManager';

// Services
import { TerminalCreationService } from '../services/TerminalCreationService';

// New utilities
import { ResizeManager } from '../utils/ResizeManager';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { terminalLogger } from '../utils/ManagerLogger';
import { ThemeManager } from '../utils/ThemeManager';

/**
 * Terminal Lifecycle Coordinator
 *
 * Refactored from TerminalLifecycleCoordinator to act as a lightweight coordinator.
 * Delegates operations to specialized services while maintaining the public API.
 *
 * Services:
 * - TerminalCreationService: Terminal creation, removal, switching
 * - TerminalAddonManager: Addon loading and disposal (via TerminalCreationService)
 * - TerminalEventManager: Event handling (via TerminalCreationService)
 * - TerminalLinkManager: Link detection and handling (via TerminalCreationService)
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/split-lifecycle-manager/spec.md
 */
export class TerminalLifecycleCoordinator {
  private splitManager: SplitManager;
  private coordinator: IManagerCoordinator;
  private eventRegistry: EventHandlerRegistry;
  private terminalCreationService: TerminalCreationService;

  public activeTerminalId: string | null = null;
  public terminal: Terminal | null = null;
  public fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;

  // VS Code Standard Terminal Configuration

  constructor(splitManager: SplitManager, coordinator: IManagerCoordinator) {
    this.splitManager = splitManager;
    this.coordinator = coordinator;
    this.eventRegistry = new EventHandlerRegistry();

    // Initialize TerminalCreationService
    this.terminalCreationService = new TerminalCreationService(
      this.splitManager,
      this.coordinator,
      this.eventRegistry
    );

    // Initialize ThemeManager for color support
    try {
      ThemeManager.initialize();
    } catch (error) {
      terminalLogger.warn('Failed to initialize ThemeManager:', error);
    }

    terminalLogger.info('TerminalLifecycleCoordinator initialized with TerminalCreationService');
  }

  /**
   * Get active terminal ID
   */
  public getActiveTerminalId(): string | null {
    return this.activeTerminalId;
  }

  /**
   * Set active terminal ID
   */
  public setActiveTerminalId(terminalId: string | null): void {
    this.activeTerminalId = terminalId;
    terminalLogger.info(`Active terminal set to: ${terminalId}`);

    // 🎯 PHASE 4: Optimized focus logic - only focus if truly needed
    // Avoid interrupting terminal output or initialization
    if (terminalId) {
      const terminalInstance = this.splitManager.getTerminals().get(terminalId);
      if (terminalInstance && terminalInstance.terminal) {
        const terminal = terminalInstance.terminal;

        // Check if terminal actually needs focus (avoid redundant focus calls)
        // Use hasAttribute instead of checking document.activeElement for better reliability
        const textArea = terminal.textarea;
        const needsFocus =
          textArea && !textArea.hasAttribute('focused') && document.activeElement !== textArea;

        if (needsFocus) {
          // 🎯 PHASE 4: Reduced delay from 10ms to 5ms for faster response
          setTimeout(() => {
            terminal.focus();
            terminalLogger.info(`🎯 Focused xterm.js terminal: ${terminalId}`);
          }, 5);
        } else {
          terminalLogger.debug(`🎯 Terminal ${terminalId} already focused, skipping focus call`);
        }
      }
    }
  }

  /**
   * Get terminal instance
   */
  public getTerminalInstance(terminalId: string): TerminalInstance | undefined {
    return this.splitManager.getTerminals().get(terminalId);
  }

  /**
   * Get all terminal instances
   */
  public getAllTerminalInstances(): Map<string, TerminalInstance> {
    return this.splitManager.getTerminals();
  }

  /**
   * Get all terminal containers
   */
  public getAllTerminalContainers(): Map<string, HTMLElement> {
    return this.splitManager.getTerminalContainers();
  }

  /**
   * Get terminal element
   */
  public getTerminalElement(terminalId: string): HTMLElement | undefined {
    const terminalInstance = this.splitManager.getTerminals().get(terminalId);
    return terminalInstance?.container;
  }

  /**
   * Create new terminal - Delegates to TerminalCreationService
   * @see TerminalCreationService.createTerminal() for implementation details
   */
  public async createTerminal(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig,
    terminalNumber?: number
  ): Promise<Terminal | null> {
    return this.terminalCreationService.createTerminal(
      terminalId,
      terminalName,
      config,
      terminalNumber
    );
  }

  /**
   * Enable VS Code standard scrollbar display
   */
  /**
   * Enable VS Code standard scrollbar display with correct viewport sizing
   */

  /**
   * Handle terminal resize using ResizeManager
   */
  private handleTerminalResize(terminalId: string, terminalInstance: TerminalInstance): void {
    ResizeManager.debounceResize(
      `resize-${terminalId}`,
      async () => {
        try {
          if (terminalInstance.fitAddon) {
            terminalInstance.fitAddon.fit();
            // Notify extension about new size
            this.notifyExtensionResize(terminalId, terminalInstance.terminal);
          }
        } catch (error) {
          terminalLogger.error(`Resize failed for ${terminalId}:`, error);
        }
      },
      { delay: 100 }
    );
  }

  /**
   * Notify extension about terminal resize
   */
  private notifyExtensionResize(terminalId: string, terminal: Terminal): void {
    try {
      this.coordinator.postMessageToExtension({
        command: 'resize',
        terminalId: terminalId,
        cols: terminal.cols,
        rows: terminal.rows,
      });

      terminalLogger.debug(
        `Sent resize notification: ${terminalId} (${terminal.cols}x${terminal.rows})`
      );
    } catch (error) {
      terminalLogger.error(`Failed to notify extension of resize for ${terminalId}:`, error);
    }
  }

  /**
   * Remove terminal - Delegates to TerminalCreationService
   * @see TerminalCreationService.removeTerminal() for implementation details
   */
  public async removeTerminal(terminalId: string): Promise<boolean> {
    return this.terminalCreationService.removeTerminal(terminalId);
  }

  /**
   * Switch to terminal - Delegates to TerminalCreationService
   * @see TerminalCreationService.switchToTerminal() for implementation details
   */
  public async switchToTerminal(terminalId: string): Promise<boolean> {
    return this.terminalCreationService.switchToTerminal(
      terminalId,
      this.activeTerminalId,
      (id: string) => {
        this.setActiveTerminalId(id);
        const terminalInstance = this.splitManager.getTerminals().get(id);
        if (terminalInstance) {
          this.terminal = terminalInstance.terminal;
          this.fitAddon = terminalInstance.fitAddon;
          this.terminalContainer = terminalInstance.container;
        }
      }
    );
  }

  /**
   * Write data to terminal
   */
  public writeToTerminal(data: string, terminalId?: string): boolean {
    try {
      const targetId = terminalId || this.activeTerminalId;
      if (!targetId) {
        terminalLogger.error('No terminal to write to');
        return false;
      }

      const terminalInstance = this.splitManager.getTerminals().get(targetId);
      if (!terminalInstance) {
        terminalLogger.error(`Terminal not found: ${targetId}`);
        return false;
      }

      terminalInstance.terminal.write(data);

      // Auto-scroll to bottom to match VS Code standard terminal behavior
      // This ensures users always see the latest output
      terminalInstance.terminal.scrollToBottom();

      return true;
    } catch (error) {
      terminalLogger.error(`Failed to write to terminal:`, error);
      return false;
    }
  }

  /**
   * Initialize terminal body container with theming
   */
  public initializeSimpleTerminal(): void {
    try {
      const container = document.getElementById('terminal-body');
      if (!container) {
        terminalLogger.error('Terminal container not found');
        return;
      }

      terminalLogger.info('Initializing terminal body container');

      // Apply basic theming
      // Note: Simplified approach without complex theme management

      // Get theme colors using ThemeManager
      const themeColors = ThemeManager.getThemeColors();

      // 🔧 FIX: terminal-body flex-direction is ALWAYS column
      // This ensures tab bar stays on top when in bottom panel
      container.style.cssText = `
        display: flex;
        flex-direction: column !important;
        background: ${themeColors.background};
        width: 100%;
        height: 100%;
        min-height: 200px;
        overflow: hidden;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        position: relative;
      `;

      container.className = 'terminal-body-container';

      // 🆕 Create terminals-wrapper container for terminal layout control
      // This container's flex-direction will be managed by PanelLocationHandler
      let terminalsWrapper = document.getElementById('terminals-wrapper');
      if (!terminalsWrapper) {
        terminalLogger.info('Creating terminals-wrapper container');

        terminalsWrapper = document.createElement('div');
        terminalsWrapper.id = 'terminals-wrapper';
        // 🔧 FIX: Set default flex-direction to column (vertical/sidebar)
        // PanelLocationHandler will add terminal-split-horizontal class for bottom panel
        terminalsWrapper.style.cssText = `
          display: flex;
          flex-direction: column;
          flex: 1;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          padding: 4px;
          gap: 4px;
          box-sizing: border-box;
        `;

        // Move existing terminal containers into terminals-wrapper
        const existingTerminals = Array.from(
          container.querySelectorAll('[data-terminal-container]')
        );
        container.appendChild(terminalsWrapper);
        existingTerminals.forEach((terminal) => {
          terminalsWrapper!.appendChild(terminal);
        });

        // 🎯 VS Code Pattern: PanelLocationHandler automatically detects via ResizeObserver
        // No manual update needed - this prevents duplicate updates
      }

      terminalLogger.info('Terminal body container initialized');
    } catch (error) {
      terminalLogger.error('Failed to initialize terminal body container:', error);
    }
  }

  /**
   * Resize all terminals using ResizeManager
   */
  public resizeAllTerminals(): void {
    try {
      const terminals = this.splitManager.getTerminals();
      terminalLogger.info(`Resizing ${terminals.size} terminals`);

      terminals.forEach((terminalInstance, terminalId) => {
        if (terminalInstance.terminal && terminalInstance.fitAddon && terminalInstance.container) {
          // Use ResizeManager for consistent resize behavior
          ResizeManager.debounceResize(
            `resize-all-${terminalId}`,
            async () => {
              try {
                terminalInstance.fitAddon.fit();
                this.notifyExtensionResize(terminalId, terminalInstance.terminal);
              } catch (error) {
                terminalLogger.error(`Failed to resize terminal ${terminalId}:`, error);
              }
            },
            { delay: 50 }
          );
        }
      });
    } catch (error) {
      terminalLogger.error('Failed to resize terminals:', error);
    }
  }

  /**
   * Extract terminal number from terminal ID (e.g., "terminal-3" -> 3)
   */
  private extractTerminalNumber(terminalId: string | undefined): number {
    if (!terminalId) {
      return 1; // Default to 1 if terminalId is undefined
    }
    const match = terminalId.match(/terminal-(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }

    // Fallback: find available number
    const existingNumbers = new Set<number>();
    const terminals = this.splitManager.getTerminals();
    terminals.forEach((terminal) => {
      if (terminal.number) {
        existingNumbers.add(terminal.number);
      }
    });

    // Find first available number (1-5)
    for (let i = 1; i <= 5; i++) {
      if (!existingNumbers.has(i)) {
        return i;
      }
    }

    terminalLogger.warn(
      `Could not extract terminal number from ID: ${terminalId}, defaulting to 1`
    );
    return 1;
  }

  /**
   * Get terminal statistics
   */
  public getTerminalStats(): {
    totalTerminals: number;
    activeTerminalId: string | null;
    terminalIds: string[];
  } {
    const terminals = this.splitManager.getTerminals();
    return {
      totalTerminals: terminals.size,
      activeTerminalId: this.activeTerminalId,
      terminalIds: Array.from(terminals.keys()),
    };
  }

  /**
   * Dispose all resources using centralized utilities
   */
  public dispose(): void {
    terminalLogger.info('Disposing TerminalLifecycleCoordinator...');

    try {
      // Clean up all ResizeManager operations
      const terminals = this.splitManager.getTerminals();
      terminals.forEach((_, terminalId) => {
        ResizeManager.unobserveResize(terminalId);
        ResizeManager.clearResize(`resize-${terminalId}`);
        ResizeManager.clearResize(`initial-${terminalId}`);
        ResizeManager.clearResize(`switch-${terminalId}`);
        ResizeManager.clearResize(`resize-all-${terminalId}`);
      });

      // Dispose event registry
      this.eventRegistry.dispose();

      // Remove all terminals
      const terminalKeys = Array.from(terminals.keys());
      terminalKeys.forEach((terminalId) => {
        this.removeTerminal(terminalId);
      });

      // Reset instance variables
      this.activeTerminalId = null;
      this.terminal = null;
      this.fitAddon = null;
      this.terminalContainer = null;

      terminalLogger.info('TerminalLifecycleCoordinator disposed');
    } catch (error) {
      terminalLogger.error('Error disposing TerminalLifecycleCoordinator:', error);
    }
  }
}
