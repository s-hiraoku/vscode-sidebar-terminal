/**
 * VS Code Command Handler
 *
 * Handles VS Code terminal commands resolved from keybindings.
 * Extracted from InputManager for better separation of concerns.
 *
 * Key Features:
 * - Command registration via CommandRegistry pattern
 * - Categorized commands (lifecycle, navigation, scrolling, etc.)
 * - Delegation to specialized services
 * - Clear error handling
 */

import { IManagerCoordinator } from '../../../interfaces/ManagerInterfaces';
import { CommandRegistry } from '../../../core/CommandRegistry';
import {
  TerminalOperationsService,
  ScrollDirection,
} from '../services/TerminalOperationsService';
import { TerminalInteractionEvent } from '../../../../types/common';
import { getCleanedSelection } from '../../../utils/SelectionUtils';

export type EmitEventFn = (
  type: TerminalInteractionEvent['type'],
  terminalId: string,
  data: unknown,
  manager: IManagerCoordinator
) => void;

/**
 * VS Code Command Handler - manages VS Code terminal command routing
 */
export class VSCodeCommandHandler {
  private readonly registry: CommandRegistry;

  constructor(
    private readonly terminalOperations: TerminalOperationsService,
    private readonly emitEvent: EmitEventFn,
    private readonly logger: (msg: string, ...args: unknown[]) => void
  ) {
    this.registry = new CommandRegistry();
    this.registerCommands();
  }

  /**
   * Handle a VS Code command
   *
   * @param command VS Code command string
   * @param manager Manager coordinator
   * @returns true if command was handled
   */
  public async handleCommand(
    command: string,
    manager: IManagerCoordinator
  ): Promise<boolean> {
    this.logger(`Handling VS Code command: ${command}`);

    try {
      return await this.registry.dispatch({
        command,
        manager,
      });
    } catch (error) {
      this.logger(`Error handling command ${command}:`, error);
      return false;
    }
  }

  /**
   * Register all VS Code terminal commands
   */
  private registerCommands(): void {
    // Terminal Management
    this.registerLifecycleCommands();

    // Navigation
    this.registerNavigationCommands();

    // Scrolling
    this.registerScrollCommands();

    // Copy/Paste/Selection
    this.registerClipboardCommands();

    // Find functionality
    this.registerFindCommands();

    // Word/Line operations
    this.registerEditingCommands();

    // Panel/UI (not available in webview)
    this.registerUnavailableCommands();
  }

  /**
   * Terminal lifecycle commands
   */
  private registerLifecycleCommands(): void {
    this.registry.registerBulk(
      {
        'workbench.action.terminal.new': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.emitEvent('create-terminal', '', undefined, manager);
        },

        'workbench.action.terminal.split': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.emitEvent(
            'split-terminal',
            manager.getActiveTerminalId() || '',
            undefined,
            manager
          );
        },

        'workbench.action.terminal.kill': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.emitEvent(
            'kill-terminal',
            manager.getActiveTerminalId() || '',
            undefined,
            manager
          );
        },

        'workbench.action.terminal.clear': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.terminalOperations.clearTerminal(manager);
        },

        'workbench.action.terminal.sizeToContentWidth': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleSizeToContent(manager);
        },
      },
      { category: 'lifecycle' }
    );
  }

  /**
   * Terminal navigation commands
   */
  private registerNavigationCommands(): void {
    this.registry.registerBulk(
      {
        'workbench.action.terminal.focusNext': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.emitEvent(
            'switch-next',
            manager.getActiveTerminalId() || '',
            undefined,
            manager
          );
        },

        'workbench.action.terminal.focusPrevious': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.emitEvent(
            'switch-previous',
            manager.getActiveTerminalId() || '',
            undefined,
            manager
          );
        },

        'workbench.action.terminal.toggleTerminal': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.emitEvent('toggle-terminal', '', undefined, manager);
        },
      },
      { category: 'navigation' }
    );
  }

  /**
   * Terminal scroll commands
   */
  private registerScrollCommands(): void {
    const scrollCommands: Record<string, ScrollDirection> = {
      'workbench.action.terminal.scrollUp': 'up',
      'workbench.action.terminal.scrollDown': 'down',
      'workbench.action.terminal.scrollToTop': 'top',
      'workbench.action.terminal.scrollToBottom': 'bottom',
      'workbench.action.terminal.scrollToPreviousCommand': 'previousCommand',
      'workbench.action.terminal.scrollToNextCommand': 'nextCommand',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: Record<string, (msg: any) => void> = {};

    for (const [command, direction] of Object.entries(scrollCommands)) {
      handlers[command] = (msg) => {
        const manager = msg.manager as IManagerCoordinator;
        this.terminalOperations.scrollTerminal(direction, manager);
      };
    }

    this.registry.registerBulk(handlers, { category: 'scrolling' });
  }

  /**
   * Clipboard commands (copy/paste/select)
   */
  private registerClipboardCommands(): void {
    this.registry.registerBulk(
      {
        'workbench.action.terminal.copySelection': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleCopy(manager);
        },

        'workbench.action.terminal.paste': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handlePaste(manager);
        },

        'workbench.action.terminal.selectAll': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleSelectAll(manager);
        },
      },
      { category: 'clipboard' }
    );
  }

  /**
   * Find functionality commands
   */
  private registerFindCommands(): void {
    this.registry.registerBulk(
      {
        'workbench.action.terminal.focusFind': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleFind(manager);
        },

        'workbench.action.terminal.findNext': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleFindNext(manager);
        },

        'workbench.action.terminal.findPrevious': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleFindPrevious(manager);
        },

        'workbench.action.terminal.hideFind': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleHideFind(manager);
        },
      },
      { category: 'find' }
    );
  }

  /**
   * Word/Line editing commands
   */
  private registerEditingCommands(): void {
    this.registry.registerBulk(
      {
        'workbench.action.terminal.deleteWordLeft': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleDeleteWordLeft(manager);
        },

        'workbench.action.terminal.deleteWordRight': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleDeleteWordRight(manager);
        },

        'workbench.action.terminal.moveToLineStart': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleMoveToLineStart(manager);
        },

        'workbench.action.terminal.moveToLineEnd': (msg) => {
          const manager = msg.manager as IManagerCoordinator;
          this.handleMoveToLineEnd(manager);
        },
      },
      { category: 'editing' }
    );
  }

  /**
   * Commands not available in webview context
   */
  private registerUnavailableCommands(): void {
    const unavailableCommands = [
      'workbench.action.togglePanel',
      'workbench.action.closePanel',
      'workbench.action.toggleSidebarVisibility',
      'workbench.action.toggleDevTools',
      'workbench.action.reloadWindow',
      'workbench.action.reloadWindowWithExtensionsDisabled',
      'workbench.action.zoomIn',
      'workbench.action.zoomOut',
      'workbench.action.zoomReset',
      'workbench.action.quickOpen',
      'workbench.action.showCommands',
      'workbench.action.terminal.openNativeConsole',
    ];

    const handlers: Record<string, () => void> = {};

    for (const command of unavailableCommands) {
      handlers[command] = () => {
        this.logger(`${command} not available in webview context`);
      };
    }

    this.registry.registerBulk(handlers, { category: 'unavailable' });
  }

  // ========================================
  // Handler implementations
  // ========================================

  private handleSizeToContent(manager: IManagerCoordinator): void {
    const activeId = manager.getActiveTerminalId();
    if (!activeId) return;

    const instance = manager.getTerminalInstance(activeId);
    if (instance?.fitAddon) {
      instance.fitAddon.fit();
      this.logger('Terminal sized to content');
    }
  }

  /**
   * Handle copy command
   *
   * Uses getCleanedSelection() to fix xterm.js issue #443 where wrapped lines
   * incorrectly include newlines at visual wrap points.
   */
  private handleCopy(manager: IManagerCoordinator): void {
    const activeId = manager.getActiveTerminalId();
    if (!activeId) return;

    const instance = manager.getTerminalInstance(activeId);
    if (!instance?.terminal) return;

    const terminal = instance.terminal;

    // Use utility that fixes wrapped line newlines (xterm.js issue #443)
    const cleanedSelection = getCleanedSelection(terminal);

    if (cleanedSelection) {
      manager.postMessageToExtension({
        command: 'copyToClipboard',
        text: cleanedSelection,
      });
      this.logger('Selection copied to clipboard');
    }
  }

  private handlePaste(manager: IManagerCoordinator): void {
    manager.postMessageToExtension({
      command: 'requestPaste',
    });
    this.logger('Paste requested from Extension');
  }

  private handleSelectAll(manager: IManagerCoordinator): void {
    const activeId = manager.getActiveTerminalId();
    if (!activeId) return;

    const instance = manager.getTerminalInstance(activeId);
    if (instance?.terminal) {
      instance.terminal.selectAll();
      this.logger('Terminal content selected');
    }
  }

  private handleFind(manager: IManagerCoordinator): void {
    const managers = manager.getManagers();
    if (managers.findInTerminal) {
      managers.findInTerminal.show?.();
      this.logger('Find panel opened');
    }
  }

  private handleFindNext(manager: IManagerCoordinator): void {
    const managers = manager.getManagers();
    if (managers.findInTerminal) {
      managers.findInTerminal.findNext?.();
      this.logger('Find next');
    }
  }

  private handleFindPrevious(manager: IManagerCoordinator): void {
    const managers = manager.getManagers();
    if (managers.findInTerminal) {
      managers.findInTerminal.findPrevious?.();
      this.logger('Find previous');
    }
  }

  private handleHideFind(manager: IManagerCoordinator): void {
    const managers = manager.getManagers();
    if (managers.findInTerminal) {
      managers.findInTerminal.hide?.();
      this.logger('Find panel hidden');
    }
  }

  private handleDeleteWordLeft(manager: IManagerCoordinator): void {
    const activeId = manager.getActiveTerminalId();
    if (!activeId) return;

    const instance = manager.getTerminalInstance(activeId);
    if (instance?.terminal) {
      // Send Ctrl+W (delete word backward in most shells)
      instance.terminal.input('\x17');
      this.logger('Delete word left');
    }
  }

  private handleDeleteWordRight(manager: IManagerCoordinator): void {
    const activeId = manager.getActiveTerminalId();
    if (!activeId) return;

    const instance = manager.getTerminalInstance(activeId);
    if (instance?.terminal) {
      // Send Alt+D (delete word forward in most shells)
      instance.terminal.input('\x1bd');
      this.logger('Delete word right');
    }
  }

  private handleMoveToLineStart(manager: IManagerCoordinator): void {
    const activeId = manager.getActiveTerminalId();
    if (!activeId) return;

    const instance = manager.getTerminalInstance(activeId);
    if (instance?.terminal) {
      // Send Ctrl+A (move to line start in most shells)
      instance.terminal.input('\x01');
      this.logger('Move to line start');
    }
  }

  private handleMoveToLineEnd(manager: IManagerCoordinator): void {
    const activeId = manager.getActiveTerminalId();
    if (!activeId) return;

    const instance = manager.getTerminalInstance(activeId);
    if (instance?.terminal) {
      // Send Ctrl+E (move to line end in most shells)
      instance.terminal.input('\x05');
      this.logger('Move to line end');
    }
  }

  /**
   * Get command registry stats
   */
  public getStats(): ReturnType<CommandRegistry['getStats']> {
    return this.registry.getStats();
  }

  /**
   * Check if a command is registered
   */
  public hasCommand(command: string): boolean {
    return this.registry.has(command);
  }
}
