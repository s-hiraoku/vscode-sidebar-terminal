/**
 * Input Manager - Handles keyboard shortcuts, IME composition, Alt+Click interactions, and mouse events
 */

import { Terminal } from '@xterm/xterm';
import { AltClickState, TerminalInteractionEvent } from '../../types/common';
import { PartialTerminalSettings } from '../../types/shared';
import { IInputManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { INotificationManager } from '../interfaces/ManagerInterfaces';
import { BaseManager } from './BaseManager';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { inputLogger } from '../utils/ManagerLogger';
import { IMEHandler } from './input/handlers/IMEHandler';
import { IIMEHandler } from './input/interfaces/IInputHandlers';

export class InputManager extends BaseManager implements IInputManager {
  // Specialized logger for Input Manager
  protected override readonly logger = inputLogger;

  // Event handler registry for centralized event management
  protected override readonly eventRegistry = new EventHandlerRegistry();

  constructor() {
    super('InputManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    // Initialize IME handler
    this.imeHandler = new IMEHandler(this.eventDebounceTimers);

    this.logger.lifecycle('initialization', 'starting');
  }

  // Alt+Click state management
  private altClickState: AltClickState = {
    isVSCodeAltClickEnabled: false,
    isAltKeyPressed: false,
  };

  // Notification manager for Alt+Click feedback
  private notificationManager: INotificationManager | null = null;

  // IME Handler for composition events
  private imeHandler: IIMEHandler;

  // Debounce timers for events
  private eventDebounceTimers = new Map<string, number>();
  // Simple arrow key handling for agent interactions
  private agentInteractionMode = false;

  // VS Code keybinding system state
  private sendKeybindingsToShell = false;
  private commandsToSkipShell = new Set<string>();
  private isInChordMode = false;
  private allowChords = true;
  private allowMnemonics = true;

  // VS Code standard terminal commands to skip shell (DEFAULT_COMMANDS_TO_SKIP_SHELL equivalent)
  private readonly DEFAULT_COMMANDS_TO_SKIP_SHELL = new Set([
    'workbench.action.quickOpen',
    'workbench.action.showCommands',
    'workbench.action.terminal.new',
    'workbench.action.terminal.split',
    'workbench.action.terminal.kill',
    'workbench.action.terminal.clear',
    'workbench.action.terminal.scrollUp',
    'workbench.action.terminal.scrollDown',
    'workbench.action.terminal.scrollToTop',
    'workbench.action.terminal.scrollToBottom',
    'workbench.action.terminal.focusNext',
    'workbench.action.terminal.focusPrevious',
    'workbench.action.terminal.toggleTerminal',
    'workbench.action.closePanel',
    'workbench.action.maximizePanel',
    'workbench.action.toggleDevTools',
    'workbench.action.reloadWindow',
    'workbench.action.zoomIn',
    'workbench.action.zoomOut',
    'workbench.action.zoomReset',
  ]);

  /**
   * Set the notification manager for Alt+Click feedback
   */
  public setNotificationManager(notificationManager: INotificationManager): void {
    this.notificationManager = notificationManager;
    this.logger.info('Notification manager set for Alt+Click feedback');
  }

  /**
   * Update VS Code keybinding system settings
   */
  public updateKeybindingSettings(settings: {
    sendKeybindingsToShell?: boolean;
    commandsToSkipShell?: string[];
    allowChords?: boolean;
    allowMnemonics?: boolean;
  }): void {
    if (settings.sendKeybindingsToShell !== undefined) {
      this.sendKeybindingsToShell = settings.sendKeybindingsToShell;
      this.logger.info(`sendKeybindingsToShell updated: ${this.sendKeybindingsToShell}`);
    }

    if (settings.commandsToSkipShell) {
      this.commandsToSkipShell.clear();
      
      // Start with default commands
      this.DEFAULT_COMMANDS_TO_SKIP_SHELL.forEach(cmd => this.commandsToSkipShell.add(cmd));
      
      // Process custom commands
      for (const command of settings.commandsToSkipShell) {
        if (command.startsWith('-')) {
          // Remove command (override default)
          const commandToRemove = command.substring(1);
          this.commandsToSkipShell.delete(commandToRemove);
          this.logger.debug(`Removed command from skip list: ${commandToRemove}`);
        } else {
          // Add command to skip
          this.commandsToSkipShell.add(command);
          this.logger.debug(`Added command to skip list: ${command}`);
        }
      }
      
      this.logger.info(`commandsToSkipShell updated: ${this.commandsToSkipShell.size} commands`);
    }

    if (settings.allowChords !== undefined) {
      this.allowChords = settings.allowChords;
      this.logger.info(`allowChords updated: ${this.allowChords}`);
    }

    if (settings.allowMnemonics !== undefined) {
      this.allowMnemonics = settings.allowMnemonics;
      this.logger.info(`allowMnemonics updated: ${this.allowMnemonics}`);
    }
  }

  /**
   * VS Code keybinding resolution system - determines if keybinding should be handled by VS Code or shell
   */
  private shouldSkipShell(event: KeyboardEvent, resolvedCommand?: string): boolean {
    // Check for chord mode
    if (this.isInChordMode && this.allowChords && event.key !== 'Escape') {
      this.logger.debug('In chord mode - skipping shell');
      return true;
    }

    // Check specific command skip list
    if (resolvedCommand && this.commandsToSkipShell.has(resolvedCommand) && !this.sendKeybindingsToShell) {
      this.logger.debug(`Command ${resolvedCommand} in skip list - skipping shell`);
      return true;
    }

    // Check for mnemonics (Alt key on Windows/Linux)
    if (this.allowMnemonics && event.altKey && (navigator.platform.includes('Win') || navigator.platform.includes('Linux'))) {
      this.logger.debug('Alt key mnemonic detected - skipping shell');
      return true;
    }

    // Hardcoded system keybindings
    if (this.isSystemKeybinding(event)) {
      this.logger.debug('System keybinding detected - skipping shell');
      return true;
    }

    return false;
  }

  /**
   * Check if keybinding is a system-level keybinding that should always be handled by VS Code
   */
  private isSystemKeybinding(event: KeyboardEvent): boolean {
    // Alt+F4 on Windows
    if (navigator.platform.includes('Win') && event.altKey && event.key === 'F4') {
      return true;
    }

    // Cmd+Q on macOS
    if (navigator.platform.includes('Mac') && event.metaKey && event.key === 'q') {
      return true;
    }

    // Ctrl+V without clipboard API support (for pasting)
    if (event.ctrlKey && event.key === 'v' && !navigator.clipboard?.readText) {
      return true;
    }

    return false;
  }

  /**
   * Resolve keyboard event to VS Code command (comprehensive version)
   */
  private resolveKeybinding(event: KeyboardEvent): string | null {
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey;
    const alt = event.altKey;
    const shift = event.shiftKey;
    const meta = event.metaKey;

    // Cross-platform key handling
    const isMac = navigator.platform.includes('Mac');

    // VS Code standard terminal keybindings - comprehensive collection with scrolling
    const keybindingMap: Record<string, string> = {
      // Terminal management - cross-platform
      [`${isMac ? 'meta' : 'ctrl'}+shift+\``]: 'workbench.action.terminal.new',
      [`${isMac ? 'meta' : 'ctrl'}+shift+5`]: 'workbench.action.terminal.split',
      [`${isMac ? 'meta' : 'ctrl'}+shift+w`]: 'workbench.action.terminal.kill',
      [`${isMac ? 'meta' : 'ctrl'}+shift+k`]: 'workbench.action.terminal.clear',
      
      // Navigation - cross-platform
      [`${isMac ? 'meta' : 'ctrl'}+p`]: 'workbench.action.quickOpen',
      [`${isMac ? 'meta' : 'ctrl'}+shift+p`]: 'workbench.action.showCommands',
      [`${isMac ? 'meta' : 'ctrl'}+tab`]: 'workbench.action.terminal.focusNext',
      [`${isMac ? 'meta' : 'ctrl'}+shift+tab`]: 'workbench.action.terminal.focusPrevious',
      [`${isMac ? 'meta' : 'ctrl'}+\``]: 'workbench.action.terminal.toggleTerminal',
      
      // VS Code Standard Scrolling - Enhanced Implementation
      // Line scrolling with Shift+PageUp/PageDown
      'shift+pageup': 'workbench.action.terminal.scrollUp',
      'shift+pagedown': 'workbench.action.terminal.scrollDown',
      
      // Windows/Linux specific scrolling
      'ctrl+alt+pageup': 'workbench.action.terminal.scrollUp',
      'ctrl+alt+pagedown': 'workbench.action.terminal.scrollDown',
      'ctrl+shift+arrowup': 'workbench.action.terminal.scrollUp',
      'ctrl+shift+arrowdown': 'workbench.action.terminal.scrollDown',
      'ctrl+home': 'workbench.action.terminal.scrollToTop',
      'ctrl+end': 'workbench.action.terminal.scrollToBottom',
      'shift+home': 'workbench.action.terminal.scrollToTop',
      'shift+end': 'workbench.action.terminal.scrollToBottom',
      
      // macOS specific scrolling
      'meta+alt+pageup': 'workbench.action.terminal.scrollUp',
      'meta+alt+pagedown': 'workbench.action.terminal.scrollDown',
      'meta+home': 'workbench.action.terminal.scrollToTop',
      'meta+end': 'workbench.action.terminal.scrollToBottom',
      
      // Command navigation (Mac style)
      'meta+arrowup': 'workbench.action.terminal.scrollToPreviousCommand',
      'meta+arrowdown': 'workbench.action.terminal.scrollToNextCommand',
      'ctrl+arrowup': 'workbench.action.terminal.scrollToPreviousCommand',
      'ctrl+arrowdown': 'workbench.action.terminal.scrollToNextCommand',
      
      // Panel management
      [`${isMac ? 'meta' : 'ctrl'}+j`]: 'workbench.action.togglePanel',
      [`${isMac ? 'meta' : 'ctrl'}+shift+u`]: 'workbench.action.closePanel',
      [`${isMac ? 'meta' : 'ctrl'}+shift+e`]: 'workbench.action.toggleSidebarVisibility',
      
      // Development tools
      'f12': 'workbench.action.toggleDevTools',
      [`${isMac ? 'meta' : 'ctrl'}+r`]: 'workbench.action.reloadWindow',
      [`${isMac ? 'meta' : 'ctrl'}+shift+r`]: 'workbench.action.reloadWindowWithExtensionsDisabled',
      
      // Zoom
      [`${isMac ? 'meta' : 'ctrl'}+=`]: 'workbench.action.zoomIn',
      [`${isMac ? 'meta' : 'ctrl'}+-`]: 'workbench.action.zoomOut',
      [`${isMac ? 'meta' : 'ctrl'}+0`]: 'workbench.action.zoomReset',
      
      // Copy/paste (when appropriate)
      [`${isMac ? 'meta' : 'ctrl'}+c`]: 'workbench.action.terminal.copySelection',
      [`${isMac ? 'meta' : 'ctrl'}+v`]: 'workbench.action.terminal.paste',
      [`${isMac ? 'meta' : 'ctrl'}+a`]: 'workbench.action.terminal.selectAll',
      
      // Find
      [`${isMac ? 'meta' : 'ctrl'}+f`]: 'workbench.action.terminal.focusFind',
      [`${isMac ? 'meta' : 'ctrl'}+g`]: 'workbench.action.terminal.findNext',
      [`${isMac ? 'meta' : 'ctrl'}+shift+g`]: 'workbench.action.terminal.findPrevious',
      
      // Terminal size
      [`${isMac ? 'meta' : 'ctrl'}+shift+=`]: 'workbench.action.terminal.sizeToContentWidth',
      
      // Additional shortcuts
      [`${isMac ? 'meta' : 'ctrl'}+shift+c`]: 'workbench.action.terminal.openNativeConsole',
      'f1': 'workbench.action.showCommands',
      'escape': 'workbench.action.terminal.hideFind',
      
      // Platform specific alternatives
      ...(isMac ? {
        'meta+k': 'workbench.action.terminal.clear',
        'meta+backspace': 'workbench.action.terminal.deleteWordLeft',
        'meta+delete': 'workbench.action.terminal.deleteWordRight',
        'meta+arrowleft': 'workbench.action.terminal.moveToLineStart',
        'meta+arrowright': 'workbench.action.terminal.moveToLineEnd',
      } : {
        'ctrl+l': 'workbench.action.terminal.clear',
        'ctrl+backspace': 'workbench.action.terminal.deleteWordLeft',
        'ctrl+delete': 'workbench.action.terminal.deleteWordRight',
        'home': 'workbench.action.terminal.moveToLineStart',
        'end': 'workbench.action.terminal.moveToLineEnd',
      })
    };

    // Create key combination string
    const parts = [];
    if (ctrl && !isMac) parts.push('ctrl');
    if (meta && isMac) parts.push('meta');
    if (alt) parts.push('alt');
    if (shift) parts.push('shift');
    parts.push(key);

    const keyCombo = parts.join('+');
    const resolved = keybindingMap[keyCombo];
    
    if (resolved) {
      this.logger.debug(`Resolved keybinding: ${keyCombo} → ${resolved}`);
    }
    
    return resolved || null;
  }

  /**
   * Setup IME composition handling with improved processing
   */
  public setupIMEHandling(): void {
    // Delegate to IME handler
    this.imeHandler.initialize();
  }

  /**
   * Clear any pending input events that might conflict with IME
   */
  private clearPendingInputEvents(): void {
    // Delegate to IME handler
    this.imeHandler.clearPendingInputEvents();
  }

  /**
   * Setup Alt key visual feedback for terminals
   */
  public setupAltKeyVisualFeedback(): void {
    this.logger.info('Setting up Alt key visual feedback');

    const keydownHandler = (event: KeyboardEvent): void => {
      if (event.altKey && !this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = true;
        this.updateTerminalCursors();
        this.logger.debug('Alt key pressed - updating cursor styles');
      }
    };

    const keyupHandler = (event: KeyboardEvent): void => {
      if (!event.altKey && this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = false;
        this.updateTerminalCursors();
        this.logger.debug('Alt key released - resetting cursor styles');
      }
    };

    // Register Alt key handlers using EventHandlerRegistry
    this.eventRegistry.register('alt-key-down', document, 'keydown', keydownHandler as EventListener);
    this.eventRegistry.register('alt-key-up', document, 'keyup', keyupHandler as EventListener);

    this.logger.lifecycle('Alt key visual feedback', 'completed');
  }

  /**
   * Setup keyboard shortcuts for terminal navigation with VS Code keybinding system
   */
  public setupKeyboardShortcuts(manager: IManagerCoordinator): void {
    this.logger.info('Setting up VS Code compatible keyboard shortcuts');

    const shortcutHandler = (event: KeyboardEvent): void => {
      // Ignore if IME is composing - more thorough check
      if (this.imeHandler.isIMEComposing()) {
        this.logger.debug('Ignoring keyboard shortcut during IME composition');
        return;
      }

      // VS Code keybinding resolution
      const resolvedCommand = this.resolveKeybinding(event);
      const shouldSkip = this.shouldSkipShell(event, resolvedCommand || undefined);

      this.logger.debug(`Keybinding: ${event.key}, Command: ${resolvedCommand}, Skip Shell: ${shouldSkip}`);

      // If should skip shell, handle as VS Code command
      if (shouldSkip && resolvedCommand) {
        event.preventDefault();
        event.stopPropagation();
        this.handleVSCodeCommand(resolvedCommand, manager);
        return;
      }

      // Legacy shortcuts for compatibility
      this.handleLegacyShortcuts(event, manager);
    };

    // Register shortcut handler using EventHandlerRegistry
    this.eventRegistry.register('keyboard-shortcuts', document, 'keydown', shortcutHandler as EventListener);

    this.logger.lifecycle('VS Code compatible keyboard shortcuts', 'completed');
  }

  /**
   * Handle VS Code commands resolved from keybindings
   */
  private handleVSCodeCommand(command: string, manager: IManagerCoordinator): void {
    this.logger.info(`Handling VS Code command: ${command}`);

    switch (command) {
      // Terminal management
      case 'workbench.action.terminal.new':
        this.emitTerminalInteractionEvent('create-terminal', '', undefined, manager);
        break;
      case 'workbench.action.terminal.split':
        this.emitTerminalInteractionEvent('split-terminal', manager.getActiveTerminalId() || '', undefined, manager);
        break;
      case 'workbench.action.terminal.kill':
        this.emitTerminalInteractionEvent('kill-terminal', manager.getActiveTerminalId() || '', undefined, manager);
        break;
      case 'workbench.action.terminal.clear':
        this.handleTerminalClear(manager);
        break;

      // Navigation
      case 'workbench.action.terminal.focusNext':
        this.emitTerminalInteractionEvent('switch-next', manager.getActiveTerminalId() || '', undefined, manager);
        break;
      case 'workbench.action.terminal.focusPrevious':
        this.emitTerminalInteractionEvent('switch-previous', manager.getActiveTerminalId() || '', undefined, manager);
        break;
      case 'workbench.action.terminal.toggleTerminal':
        this.emitTerminalInteractionEvent('toggle-terminal', '', undefined, manager);
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
        this.handleTerminalCopy(manager);
        break;
      case 'workbench.action.terminal.paste':
        this.handleTerminalPaste(manager);
        break;
      case 'workbench.action.terminal.selectAll':
        this.handleTerminalSelectAll(manager);
        break;

      // Find functionality
      case 'workbench.action.terminal.focusFind':
        this.handleTerminalFind(manager);
        break;
      case 'workbench.action.terminal.findNext':
        this.handleTerminalFindNext(manager);
        break;
      case 'workbench.action.terminal.findPrevious':
        this.handleTerminalFindPrevious(manager);
        break;
      case 'workbench.action.terminal.hideFind':
        this.handleTerminalHideFind(manager);
        break;

      // Word/Line operations
      case 'workbench.action.terminal.deleteWordLeft':
        this.handleTerminalDeleteWordLeft(manager);
        break;
      case 'workbench.action.terminal.deleteWordRight':
        this.handleTerminalDeleteWordRight(manager);
        break;
      case 'workbench.action.terminal.moveToLineStart':
        this.handleTerminalMoveToLineStart(manager);
        break;
      case 'workbench.action.terminal.moveToLineEnd':
        this.handleTerminalMoveToLineEnd(manager);
        break;

      // Terminal size
      case 'workbench.action.terminal.sizeToContentWidth':
        this.handleTerminalSizeToContent(manager);
        break;

      // Panel/UI management
      case 'workbench.action.togglePanel':
        this.logger.info('Panel toggle not available in webview context');
        break;
      case 'workbench.action.closePanel':
        this.logger.info('Panel close not available in webview context');
        break;
      case 'workbench.action.toggleSidebarVisibility':
        this.logger.info('Sidebar toggle not available in webview context');
        break;

      // Development tools
      case 'workbench.action.toggleDevTools':
        this.logger.info('Dev Tools toggle not available in webview context');
        break;
      case 'workbench.action.reloadWindow':
        this.logger.info('Window reload not available in webview context');
        break;
      case 'workbench.action.reloadWindowWithExtensionsDisabled':
        this.logger.info('Window reload with disabled extensions not available in webview context');
        break;

      // Zoom
      case 'workbench.action.zoomIn':
      case 'workbench.action.zoomOut':
      case 'workbench.action.zoomReset':
        this.logger.info(`Zoom commands (${command}) not available in webview context`);
        break;

      // Quick actions
      case 'workbench.action.quickOpen':
        this.logger.info('Quick Open not implemented in terminal webview');
        break;
      case 'workbench.action.showCommands':
        this.logger.info('Command Palette not implemented in terminal webview');
        break;

      // Native console
      case 'workbench.action.terminal.openNativeConsole':
        this.logger.info('Native console not available in webview context');
        break;

      default:
        this.logger.warn(`Unhandled VS Code command: ${command}`);
    }
  }

  /**
   * Handle terminal scrolling
   */
  private scrollTerminal(direction: 'up' | 'down' | 'top' | 'bottom' | 'previousCommand' | 'nextCommand', manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) {
      this.logger.warn('No active terminal for scrolling');
      return;
    }

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance) {
      this.logger.warn(`Terminal instance not found: ${activeTerminalId}`);
      return;
    }

    const terminal = terminalInstance.terminal;
    
    // VS Code standard scrolling behavior
    switch (direction) {
      case 'up':
        // Scroll up one line (VS Code standard)
        terminal.scrollLines(-1);
        break;
      case 'down':
        // Scroll down one line (VS Code standard)
        terminal.scrollLines(1);
        break;
      case 'top':
        // Scroll to the beginning of the buffer (VS Code standard)
        terminal.scrollToTop();
        break;
      case 'bottom':
        // Scroll to the end of the buffer (VS Code standard)
        terminal.scrollToBottom();
        break;
      case 'previousCommand':
        // Scroll to previous command output (approximate)
        // VS Code uses command detection, we use larger scroll increments
        const terminalRows = terminal.rows || 24;
        terminal.scrollLines(-Math.floor(terminalRows / 2));
        break;
      case 'nextCommand':
        // Scroll to next command output (approximate)
        // VS Code uses command detection, we use larger scroll increments  
        const rows = terminal.rows || 24;
        terminal.scrollLines(Math.floor(rows / 2));
        break;
    }

    this.logger.debug(`Scrolled terminal ${activeTerminalId} ${direction}`);
  }

  /**
   * Handle terminal clear operation
   */
  private handleTerminalClear(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) {
      this.logger.warn('No active terminal for clear operation');
      return;
    }

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (terminalInstance) {
      terminalInstance.terminal.clear();
      this.logger.debug(`Cleared terminal ${activeTerminalId}`);
    }
  }

  /**
   * Handle terminal copy selection
   */
  private handleTerminalCopy(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance) return;

    const terminal = terminalInstance.terminal;
    if (terminal.hasSelection()) {
      const selection = terminal.getSelection();
      if (selection && navigator.clipboard) {
        navigator.clipboard.writeText(selection).then(() => {
          this.logger.debug(`Copied selection from terminal ${activeTerminalId}`);
        }).catch(error => {
          this.logger.error(`Failed to copy selection: ${error}`);
        });
      }
    }
  }

  /**
   * Handle terminal paste operation
   */
  private handleTerminalPaste(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    if (navigator.clipboard) {
      navigator.clipboard.readText().then(text => {
        if (text) {
          this.emitTerminalInteractionEvent('paste', activeTerminalId, { text }, manager);
          this.logger.debug(`Pasted text to terminal ${activeTerminalId}`);
        }
      }).catch(error => {
        this.logger.error(`Failed to paste: ${error}`);
      });
    }
  }

  /**
   * Handle terminal select all operation
   */
  private handleTerminalSelectAll(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance) return;

    terminalInstance.terminal.selectAll();
    this.logger.debug(`Selected all in terminal ${activeTerminalId}`);
  }

  /**
   * Handle terminal find operation
   */
  private handleTerminalFind(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance || !terminalInstance.searchAddon) {
      this.logger.warn(`Search addon not available for terminal ${activeTerminalId}`);
      return;
    }

    // Use search addon if available
    try {
      // Simple find interface - could be enhanced with search UI
      const searchTerm = prompt('Find in terminal:');
      if (searchTerm) {
        terminalInstance.searchAddon.findNext(searchTerm);
        this.logger.debug(`Searching for "${searchTerm}" in terminal ${activeTerminalId}`);
      }
    } catch (error) {
      this.logger.error(`Find operation failed: ${error}`);
    }
  }

  /**
   * Handle terminal find next
   */
  private handleTerminalFindNext(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (terminalInstance?.searchAddon) {
      terminalInstance.searchAddon.findNext('', { incremental: false });
      this.logger.debug(`Find next in terminal ${activeTerminalId}`);
    }
  }

  /**
   * Handle terminal find previous
   */
  private handleTerminalFindPrevious(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (terminalInstance?.searchAddon) {
      terminalInstance.searchAddon.findPrevious('', { incremental: false });
      this.logger.debug(`Find previous in terminal ${activeTerminalId}`);
    }
  }

  /**
   * Handle hide terminal find
   */
  private handleTerminalHideFind(_manager: IManagerCoordinator): void {
    // Hide find UI - this would be enhanced with actual find UI
    this.logger.debug('Hide terminal find requested');
  }

  /**
   * Handle terminal word deletion operations
   */
  private handleTerminalDeleteWordLeft(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    // Send Ctrl+W to delete word left (standard shell behavior)
    this.emitTerminalInteractionEvent('send-key', activeTerminalId, { key: '\x17' }, manager);
    this.logger.debug(`Delete word left in terminal ${activeTerminalId}`);
  }

  private handleTerminalDeleteWordRight(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    // Send Alt+D to delete word right (standard shell behavior)
    this.emitTerminalInteractionEvent('send-key', activeTerminalId, { key: '\x1bd' }, manager);
    this.logger.debug(`Delete word right in terminal ${activeTerminalId}`);
  }

  /**
   * Handle terminal line movement operations
   */
  private handleTerminalMoveToLineStart(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    // Send Ctrl+A to move to line start (standard shell behavior)
    this.emitTerminalInteractionEvent('send-key', activeTerminalId, { key: '\x01' }, manager);
    this.logger.debug(`Move to line start in terminal ${activeTerminalId}`);
  }

  private handleTerminalMoveToLineEnd(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    // Send Ctrl+E to move to line end (standard shell behavior)
    this.emitTerminalInteractionEvent('send-key', activeTerminalId, { key: '\x05' }, manager);
    this.logger.debug(`Move to line end in terminal ${activeTerminalId}`);
  }

  /**
   * Handle terminal size to content
   */
  private handleTerminalSizeToContent(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (terminalInstance) {
      // Trigger a resize using fit addon
      terminalInstance.fitAddon.fit();
      this.logger.debug(`Resized terminal ${activeTerminalId} to content`);
    }
  }

  /**
   * Handle legacy shortcuts for backward compatibility
   */
  private handleLegacyShortcuts(event: KeyboardEvent, manager: IManagerCoordinator): void {
    // Escape: Clear notifications (always handle, don't send to shell)
    if (event.key === 'Escape') {
      this.logger.info('Escape key detected, clearing notifications');
      this.clearNotifications();
    }

    // Ctrl+Shift+D: Toggle debug panel (always handle, don't send to shell)
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      this.logger.info('Ctrl+Shift+D shortcut detected, toggling debug panel');
      if ('toggleDebugPanel' in manager && typeof manager.toggleDebugPanel === 'function') {
        (manager as { toggleDebugPanel: () => void }).toggleDebugPanel();
      }
    }
  }

  /**
   * Add complete input handling to xterm.js terminal (click, keyboard, focus)
   */
  public addXtermClickHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    manager: IManagerCoordinator
  ): void {
    this.logger.info(`Setting up complete input handling for terminal ${terminalId}`);

    // CRITICAL: Set up keyboard input handling for terminal
    terminal.onData((data: string) => {
      // Enhanced IME handling: Skip processing during composition OR if data matches composition end buffer
      if (this.imeHandler.isIMEComposing()) {
        this.logger.debug(`Terminal ${terminalId} skipping input during IME composition: ${data.length} chars`);
        return;
      }
      
      // Additional check: Skip if this data was just generated by IME composition end
      if (this.imeHandler.isCompositionEndData(data)) {
        this.logger.debug(`Terminal ${terminalId} skipping composition end data to prevent duplication: "${data}"`);
        return;
      }
      
      this.logger.debug(`Terminal ${terminalId} data: ${data.length} chars`);
      manager.postMessageToExtension({
        command: 'input',
        terminalId: terminalId,
        data: data,
        timestamp: Date.now(),
      });
    });

    // Set up focus handling - xterm.js doesn't have onFocus/onBlur, comment out
    // terminal.onFocus(() => {
    //   this.logger.debug(`Terminal ${terminalId} focused`);
    //   manager.setActiveTerminalId(terminalId);
    //   this.emitTerminalInteractionEvent('focus', terminalId, undefined, manager);
    // });

    // Set up blur handling - xterm.js doesn't have onFocus/onBlur, comment out  
    // terminal.onBlur(() => {
    //   this.logger.debug(`Terminal ${terminalId} blurred`);
    // });

    const clickHandler = (event: MouseEvent): void => {
      // Regular click: Focus terminal
      if (!event.altKey) {
        this.logger.debug(`Regular click on terminal ${terminalId}`);
        manager.setActiveTerminalId(terminalId);
        terminal.focus(); // Ensure terminal gets focus for keyboard input
        this.emitTerminalInteractionEvent('focus', terminalId, undefined, manager);
        return;
      }

      // Alt+Click handling
      if (event.altKey && this.altClickState.isVSCodeAltClickEnabled) {
        // VS Code standard Alt+Click behavior
        this.logger.debug(
          `Alt+Click on terminal ${terminalId} at (${event.clientX}, ${event.clientY})`
        );

        // Show visual feedback
        if (this.notificationManager) {
          this.notificationManager.showAltClickFeedback(event.clientX, event.clientY);
        }

        // Let xterm.js handle the actual cursor positioning
        // No need to prevent default - xterm.js will handle it

        this.emitTerminalInteractionEvent(
          'alt-click',
          terminalId,
          {
            x: event.clientX,
            y: event.clientY,
          },
          manager
        );
      }
    };

    // Register click handler using EventHandlerRegistry
    this.eventRegistry.register(
      `terminal-click-${terminalId}`,
      container,
      'click',
      clickHandler as EventListener
    );

    this.logger.info(`Complete input handling configured for terminal ${terminalId}`);
  }

  /**
   * Update terminal cursor styles based on Alt key state
   */
  private updateTerminalCursors(): void {
    const terminals = document.querySelectorAll('.terminal-container .xterm');
    terminals.forEach((terminal) => {
      const element = terminal as HTMLElement;
      if (this.altClickState.isAltKeyPressed && this.altClickState.isVSCodeAltClickEnabled) {
        element.style.cursor = 'default';
      } else {
        element.style.cursor = '';
      }
    });
  }

  /**
   * Check if VS Code Alt+Click is enabled based on settings
   */
  public isVSCodeAltClickEnabled(settings: PartialTerminalSettings): boolean {
    const altClickMovesCursor = settings.altClickMovesCursor ?? false;
    const multiCursorModifier = settings.multiCursorModifier ?? 'alt';

    const isEnabled = altClickMovesCursor && multiCursorModifier === 'alt';
    this.logger.debug(
      `VS Code Alt+Click enabled: ${isEnabled} (altClick: ${altClickMovesCursor}, modifier: ${multiCursorModifier})`
    );

    return isEnabled;
  }

  /**
   * Update Alt+Click settings and state
   */
  public updateAltClickSettings(settings: PartialTerminalSettings): void {
    const wasEnabled = this.altClickState.isVSCodeAltClickEnabled;
    const isEnabled = this.isVSCodeAltClickEnabled(settings);

    if (wasEnabled !== isEnabled) {
      this.altClickState.isVSCodeAltClickEnabled = isEnabled;
      this.logger.info(`Alt+Click setting changed: ${wasEnabled} → ${isEnabled}`);

      // Update cursor styles immediately
      this.updateTerminalCursors();
    }
  }

  /**
   * Get current Alt+Click state
   */
  public getAltClickState(): AltClickState {
    return { ...this.altClickState };
  }

  /**
   * Check if IME is currently composing
   */
  public isIMEComposing(): boolean {
    return this.imeHandler.isIMEComposing();
  }

  /**
   * Enable/disable agent interaction mode
   * VS Code Standard: Always disabled for standard terminal functionality
   */
  public setAgentInteractionMode(_enabled: boolean): void {
    // VS Code Standard: Force disable to preserve terminal functionality
    // This ensures arrow keys work properly for bash history, completion, etc.
    const actualEnabled = false; // Always disabled for VS Code standard behavior

    if (this.agentInteractionMode !== actualEnabled) {
      this.agentInteractionMode = actualEnabled;
      this.logger.info(
        `Agent interaction mode: ${actualEnabled} (VS Code standard - always disabled)`
      );

      // Clean up any existing arrow key listener
      this.eventRegistry.unregister('agent-arrow-keys');
    }
  }

  /**
   * Check if agent interaction mode is enabled
   */
  public isAgentInteractionMode(): boolean {
    return this.agentInteractionMode;
  }

  /**
   * Setup simplified arrow key handler for agent interactions
   * VS Code Standard: Arrow keys should be handled by xterm.js and shell
   */
  private setupAgentArrowKeyHandler(): void {
    this.logger.info('Setting up agent arrow key handler (VS Code standard)');

    const arrowKeyHandler = (event: KeyboardEvent): void => {
      // Only log when in agent interaction mode for debugging
      if (!this.agentInteractionMode || this.imeHandler.isIMEComposing()) {
        return;
      }

      // Check if this is an arrow key for logging only
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        // Find active terminal for logging
        const activeTerminal = document.querySelector('.terminal-container.active');
        if (activeTerminal) {
          const terminalId = activeTerminal.getAttribute('data-terminal-id');
          if (terminalId) {
            this.logger.debug(
              `Arrow key ${event.key} in agent mode for terminal ${terminalId} - letting xterm.js handle`
            );
          }
        }
      }

      // VS Code Standard: Let xterm.js and shell handle all arrow keys naturally
      // Do NOT preventDefault() or stopPropagation() to preserve terminal functionality
      // This allows bash history, completion, and cursor movement to work properly
    };

    this.eventRegistry.register('agent-arrow-keys', document, 'keydown', arrowKeyHandler as EventListener, true);
  }

  /**
   * Emit terminal interaction event with debouncing for frequent events
   */
  private emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    manager: IManagerCoordinator
  ): void {
    try {
      // Debounce focus events to prevent spam
      if (type === 'focus') {
        const key = `${type}-${terminalId}`;
        if (this.eventDebounceTimers.has(key)) {
          clearTimeout(this.eventDebounceTimers.get(key));
        }

        const timer = window.setTimeout(() => {
          manager.postMessageToExtension({
            command: 'terminalInteraction',
            type,
            terminalId,
            data,
            timestamp: Date.now(),
          });
          this.eventDebounceTimers.delete(key);
        }, 50); // Reduced from 200ms to 50ms for better responsiveness

        this.eventDebounceTimers.set(key, timer);
      } else {
        // Emit other events immediately
        manager.postMessageToExtension({
          command: 'terminalInteraction',
          type,
          terminalId,
          data,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      this.logger.error(`Error emitting terminal interaction event: ${error}`);
    }
  }

  /**
   * Clear all notifications (placeholder for integration with NotificationManager)
   */
  private clearNotifications(): void {
    // This will be integrated with NotificationManager
    const notifications = document.querySelectorAll('.notification, .claude-code-notification');
    notifications.forEach((notification) => {
      notification.remove();
    });
  }

  /**
   * Handle special key combinations for terminal operations
   */
  public handleSpecialKeys(
    event: KeyboardEvent,
    terminalId: string,
    manager: IManagerCoordinator
  ): boolean {
    // Ignore if IME is composing
    if (this.imeHandler.isIMEComposing()) {
      return false;
    }

    // Ctrl+C: Copy (if selection exists) or interrupt
    if (event.ctrlKey && event.key === 'c') {
      const terminal = manager.getTerminalInstance(terminalId);
      if (terminal && terminal.terminal.hasSelection()) {
        // Let browser handle copy
        return false;
      }
      // Send interrupt signal
      this.logger.info(`Ctrl+C interrupt for terminal ${terminalId}`);
      this.emitTerminalInteractionEvent('interrupt', terminalId, undefined, manager);
      return true;
    }

    // Ctrl+V: Paste
    if (event.ctrlKey && event.key === 'v') {
      this.logger.info(`Ctrl+V paste for terminal ${terminalId}`);
      this.emitTerminalInteractionEvent('paste', terminalId, undefined, manager);
      return false; // Let browser handle paste
    }

    return false;
  }

  /**
   * Dispose of all event listeners and cleanup resources
   */
  public override dispose(): void {
    this.logger.info('Disposing input manager');

    // Dispose EventHandlerRegistry - this will clean up all registered event listeners
    this.eventRegistry.dispose();

    // Clear debounce timers
    for (const timer of this.eventDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.eventDebounceTimers.clear();

    // Reset Alt+Click state
    this.altClickState = {
      isVSCodeAltClickEnabled: false,
      isAltKeyPressed: false,
    };
    this.agentInteractionMode = false;

    // Dispose IME handler
    this.imeHandler.dispose();

    // Reset VS Code keybinding system state
    this.sendKeybindingsToShell = false;
    this.commandsToSkipShell.clear();
    this.isInChordMode = false;
    this.allowChords = true;
    this.allowMnemonics = true;

    // Clear references
    this.notificationManager = null;

    // Call parent dispose
    super.dispose();

    this.logger.lifecycle('InputManager', 'completed');
  }
}
