/**
 * VSCodeCommandDispatcher - Dispatches VS Code commands and intercepts keys
 *
 * Extracted from InputManager to reduce method size and improve testability.
 * Contains:
 * - handleVSCodeCommand: Routes VS Code commands resolved from keybindings (~159 LOC)
 * - shouldInterceptKeyForVSCode: Determines if a key should be intercepted for VS Code (~109 LOC)
 */

import { Terminal } from '@xterm/xterm';
import { IManagerCoordinator } from '../../../interfaces/ManagerInterfaces';
import { TerminalInteractionEvent } from '../../../../types/common';
import { TerminalOperationsService, ScrollDirection } from '../services/TerminalOperationsService';
import { isMacPlatform } from '../../../utils/PlatformUtils';

/**
 * Dependencies required by the dispatcher from InputManager
 */
export interface IVSCodeCommandDispatcherDeps {
  /** Logger function */
  logger: (message: string, ...args: unknown[]) => void;
  /** Emit a terminal interaction event */
  emitTerminalInteractionEvent: (
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    manager: IManagerCoordinator
  ) => void;
  /** Terminal operations service for scroll/clear/word/line operations */
  terminalOperationsService: TerminalOperationsService;
  /** Handle terminal copy */
  handleTerminalCopy: (manager: IManagerCoordinator) => void;
  /** Handle terminal paste */
  handleTerminalPaste: (manager: IManagerCoordinator) => void;
  /** Handle terminal select all */
  handleTerminalSelectAll: (manager: IManagerCoordinator) => void;
  /** Handle terminal find */
  handleTerminalFind: (manager: IManagerCoordinator) => void;
  /** Handle terminal find next */
  handleTerminalFindNext: (manager: IManagerCoordinator) => void;
  /** Handle terminal find previous */
  handleTerminalFindPrevious: (manager: IManagerCoordinator) => void;
  /** Handle terminal hide find */
  handleTerminalHideFind: (manager: IManagerCoordinator) => void;
  /** Handle terminal clear */
  handleTerminalClear: (manager: IManagerCoordinator) => void;
}

/**
 * VSCodeCommandDispatcher - Routes VS Code commands and determines key interception
 */
export class VSCodeCommandDispatcher {
  constructor(private readonly deps: IVSCodeCommandDispatcherDeps) {}

  /**
   * Handle VS Code commands resolved from keybindings.
   * Routes the command string to the appropriate handler.
   */
  public handleVSCodeCommand(command: string, manager: IManagerCoordinator): void {
    this.deps.logger(`Handling VS Code command: ${command}`);

    switch (command) {
      // Terminal management
      case 'workbench.action.terminal.new':
        this.deps.emitTerminalInteractionEvent('create-terminal', '', undefined, manager);
        break;
      case 'workbench.action.terminal.split':
        this.deps.emitTerminalInteractionEvent(
          'split-terminal',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        break;
      case 'workbench.action.terminal.kill':
        this.deps.emitTerminalInteractionEvent(
          'kill-terminal',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        break;
      case 'workbench.action.terminal.clear':
        this.deps.handleTerminalClear(manager);
        break;

      // Navigation
      case 'workbench.action.terminal.focusNext':
        this.deps.emitTerminalInteractionEvent(
          'switch-next',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        break;
      case 'workbench.action.terminal.focusPrevious':
        this.deps.emitTerminalInteractionEvent(
          'switch-previous',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        break;
      case 'workbench.action.terminal.toggleTerminal':
        this.deps.emitTerminalInteractionEvent('toggle-terminal', '', undefined, manager);
        break;

      // Scrolling
      case 'workbench.action.terminal.scrollUp':
        this.scrollTerminal('up', manager);
        break;
      case 'workbench.action.terminal.scrollDown':
        this.scrollTerminal('down', manager);
        break;
      case 'workbench.action.terminal.scrollToTop':
        this.scrollTerminal('top', manager);
        break;
      case 'workbench.action.terminal.scrollToBottom':
        this.scrollTerminal('bottom', manager);
        break;
      case 'workbench.action.terminal.scrollToPreviousCommand':
        this.scrollTerminal('previousCommand', manager);
        break;
      case 'workbench.action.terminal.scrollToNextCommand':
        this.scrollTerminal('nextCommand', manager);
        break;

      // Copy/Paste/Selection
      case 'workbench.action.terminal.copySelection':
        this.deps.handleTerminalCopy(manager);
        break;
      case 'workbench.action.terminal.paste':
        this.deps.handleTerminalPaste(manager);
        break;
      case 'workbench.action.terminal.selectAll':
        this.deps.handleTerminalSelectAll(manager);
        break;

      // Find functionality
      case 'workbench.action.terminal.focusFind':
        this.deps.handleTerminalFind(manager);
        break;
      case 'workbench.action.terminal.findNext':
        this.deps.handleTerminalFindNext(manager);
        break;
      case 'workbench.action.terminal.findPrevious':
        this.deps.handleTerminalFindPrevious(manager);
        break;
      case 'workbench.action.terminal.hideFind':
        this.deps.handleTerminalHideFind(manager);
        break;

      // Word/Line operations
      case 'workbench.action.terminal.deleteWordLeft':
        this.deps.terminalOperationsService.deleteWordLeft(manager);
        break;
      case 'workbench.action.terminal.deleteWordRight':
        this.deps.terminalOperationsService.deleteWordRight(manager);
        break;
      case 'workbench.action.terminal.moveToLineStart':
        this.deps.terminalOperationsService.moveToLineStart(manager);
        break;
      case 'workbench.action.terminal.moveToLineEnd':
        this.deps.terminalOperationsService.moveToLineEnd(manager);
        break;

      // Terminal size
      case 'workbench.action.terminal.sizeToContentWidth':
        this.deps.terminalOperationsService.sizeToContent(manager);
        break;

      // Panel/UI management
      case 'workbench.action.togglePanel':
        this.deps.logger('Panel toggle not available in webview context');
        break;
      case 'workbench.action.closePanel':
        this.deps.logger('Panel close not available in webview context');
        break;
      case 'workbench.action.toggleSidebarVisibility':
        this.deps.logger('Sidebar toggle not available in webview context');
        break;

      // Development tools
      case 'workbench.action.toggleDevTools':
        this.deps.logger('Dev Tools toggle not available in webview context');
        break;
      case 'workbench.action.reloadWindow':
        this.deps.logger('Window reload not available in webview context');
        break;
      case 'workbench.action.reloadWindowWithExtensionsDisabled':
        this.deps.logger('Window reload with disabled extensions not available in webview context');
        break;

      // Zoom
      case 'workbench.action.zoomIn':
      case 'workbench.action.zoomOut':
      case 'workbench.action.zoomReset':
        this.deps.logger(`Zoom commands (${command}) not available in webview context`);
        break;

      // Quick actions
      case 'workbench.action.quickOpen':
        this.deps.logger('Quick Open not implemented in terminal webview');
        break;
      case 'workbench.action.showCommands':
        this.deps.logger('Command Palette not implemented in terminal webview');
        break;

      // Native console
      case 'workbench.action.terminal.openNativeConsole':
        this.deps.logger('Native console not available in webview context');
        break;

      default:
        this.deps.logger(`Unhandled VS Code command: ${command}`);
    }
  }

  /**
   * VS Code Standard: Determine if a key should be intercepted for VS Code handling.
   * Returns true if VS Code should handle this key (not sent to shell).
   * Returns false if key should pass through to shell.
   *
   * This implements the VS Code terminal keybinding behavior where:
   * - Most keys go to shell (arrow keys, Ctrl+C for interrupt, etc.)
   * - Only specific shortcuts are intercepted (Ctrl+Shift+C for copy, Cmd+K for clear, etc.)
   */
  public shouldInterceptKeyForVSCode(
    event: KeyboardEvent,
    terminal: Terminal,
    manager: IManagerCoordinator
  ): boolean {
    // Use userAgentData if available (modern), fallback to userAgent (deprecated navigator.platform)
    const isMac = isMacPlatform();
    const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

    // NEVER intercept these - they must go to shell:
    // - Arrow keys (bash history, cursor movement)
    // - Tab (completion)
    // - Regular characters
    // - Ctrl+C without selection (interrupt)
    // - Ctrl+D (EOF)
    // - Ctrl+Z (suspend)
    // - Ctrl+A, Ctrl+E (line start/end in bash)
    // - Ctrl+U, Ctrl+K (line editing in bash)
    // - Ctrl+W (delete word in bash)
    // - Ctrl+R (reverse search in bash)
    // - Ctrl+L (clear screen in bash - should go to shell, not VS Code clear)

    // Arrow keys - ALWAYS pass to shell
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      // Exception: Ctrl+Shift+Arrow for scrolling
      if (event.ctrlKey && event.shiftKey) {
        this.handleVSCodeCommand(
          event.key === 'ArrowUp'
            ? 'workbench.action.terminal.scrollUp'
            : 'workbench.action.terminal.scrollDown',
          manager
        );
        return true;
      }
      // Pass to shell (bash history, cursor movement)
      return false;
    }

    // Tab - ALWAYS pass to shell (completion)
    if (event.key === 'Tab') {
      return false;
    }

    // Ctrl+C: Copy if selection exists, otherwise pass to shell for interrupt
    if (ctrlOrCmd && event.key === 'c' && !event.shiftKey) {
      if (terminal.hasSelection()) {
        this.deps.handleTerminalCopy(manager);
        return true;
      }
      // No selection - pass to shell for SIGINT
      return false;
    }

    // Ctrl+V: Paste
    if (ctrlOrCmd && event.key === 'v' && !event.shiftKey) {
      this.deps.handleTerminalPaste(manager);
      return true;
    }

    // Ctrl+Shift+C: Copy (VS Code style)
    if (ctrlOrCmd && event.shiftKey && event.key === 'c') {
      if (terminal.hasSelection()) {
        this.deps.handleTerminalCopy(manager);
        return true;
      }
      return false;
    }

    // Ctrl+Shift+V: Paste (VS Code style)
    if (ctrlOrCmd && event.shiftKey && event.key === 'v') {
      this.deps.handleTerminalPaste(manager);
      return true;
    }

    // Pass these shell-essential keys to shell:
    // Ctrl+D (EOF), Ctrl+Z (suspend), Ctrl+A, Ctrl+E, Ctrl+U, Ctrl+K, Ctrl+W, Ctrl+R, Ctrl+L
    const shellEssentialKeys = ['d', 'z', 'a', 'e', 'u', 'k', 'w', 'r', 'l'];
    if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      if (shellEssentialKeys.includes(event.key.toLowerCase())) {
        return false; // Pass to shell
      }
    }

    // macOS: Cmd+K for clear - intercept this one
    if (isMac && event.metaKey && event.key === 'k' && !event.shiftKey) {
      this.deps.handleTerminalClear(manager);
      return true;
    }

    // Ctrl+Insert / Shift+Insert for copy/paste (Windows/Linux)
    if (event.ctrlKey && event.key === 'Insert') {
      if (terminal.hasSelection()) {
        this.deps.handleTerminalCopy(manager);
        return true;
      }
      return false;
    }
    if (event.shiftKey && event.key === 'Insert') {
      this.deps.handleTerminalPaste(manager);
      return true;
    }

    // F12: Toggle dev tools (should be handled by VS Code, not shell)
    if (event.key === 'F12') {
      return true; // Intercept but don't handle - let VS Code handle
    }

    // All other keys - pass to shell
    return false;
  }

  /**
   * Handle terminal scrolling - delegates to TerminalOperationsService
   */
  private scrollTerminal(direction: ScrollDirection, manager: IManagerCoordinator): void {
    this.deps.terminalOperationsService.scrollTerminal(direction, manager);
  }
}
