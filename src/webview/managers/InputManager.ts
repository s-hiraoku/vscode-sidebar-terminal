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
// import { inputLogger } from '../utils/ManagerLogger';
import { IMEHandler } from './input/handlers/IMEHandler';
import { IIMEHandler } from './input/interfaces/IInputHandlers';
import { InputStateManager } from './input/services/InputStateManager';
import { InputEventService } from './input/services/InputEventService';
import { KeybindingService } from './input/services/KeybindingService';
import {
  TerminalOperationsService,
  ScrollDirection,
} from './input/services/TerminalOperationsService';

// ============================================================================
// Constants
// ============================================================================

/**
 * Keyboard event constants
 */
const KeyboardConstants = {
  /** IME composition keycode (when IME is processing input) */
  IME_COMPOSITION_KEYCODE: 229,
  /** Maximum ASCII code for control characters (0-31) */
  CONTROL_CHAR_THRESHOLD: 32,
} as const;

/**
 * Timing constants for input handling
 */
const InputTimings = {
  /** Debounce delay for input events (ms) */
  INPUT_DEBOUNCE_DELAY_MS: 50,
} as const;

/**
 * Key sets for panel navigation mode directional movement.
 * Hoisted to module scope to avoid recreating on every keypress.
 */
const PREVIOUS_NAVIGATION_KEYS = new Set(['h', 'k', 'ArrowLeft', 'ArrowUp']);
const NEXT_NAVIGATION_KEYS = new Set(['j', 'l', 'ArrowRight', 'ArrowDown']);

export class InputManager extends BaseManager implements IInputManager {
  // Event handler registry for centralized event management
  protected readonly eventRegistry = new EventHandlerRegistry();

  // Coordinator for accessing other managers (Issue #216: constructor injection)
  private readonly coordinator: IManagerCoordinator;

  // New architecture services
  private stateManager: InputStateManager;
  private eventService: InputEventService;
  private keybindingService: KeybindingService;
  private terminalOperationsService: TerminalOperationsService;

  constructor(coordinator: IManagerCoordinator) {
    super('InputManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.coordinator = coordinator;

    // Initialize new architecture services
    this.stateManager = new InputStateManager((message: string) => this.logger(message));
    this.eventService = new InputEventService((message: string) => this.logger(message));
    this.keybindingService = new KeybindingService((message: string) => this.logger(message));
    this.terminalOperationsService = new TerminalOperationsService(
      (message: string) => this.logger(message),
      (type, terminalId, data, manager) =>
        this.emitTerminalInteractionEvent(
          type as TerminalInteractionEvent['type'],
          terminalId,
          data,
          manager
        )
    );

    // Initialize IME handler with new architecture
    this.imeHandler = new IMEHandler(
      this.eventDebounceTimers,
      this.stateManager,
      this.eventService
    );

    this.logger('initialization', 'starting');
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
  private eventDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingInputBuffers = new Map<
    string,
    { data: string[]; timer: ReturnType<typeof setTimeout> | null }
  >();

  // Terminal-specific disposables for xterm.js events (memory leak prevention)
  private terminalDisposables = new Map<string, Array<{ dispose(): void }>>();

  // Simple arrow key handling for agent interactions
  private agentInteractionMode = false;
  // Zellij-style panel navigation mode (Ctrl+P to toggle)
  private panelNavigationMode = false;
  private panelNavigationIndicator: HTMLElement | null = null;

  /**
   * Set the notification manager for Alt+Click feedback
   */
  public setNotificationManager(notificationManager: INotificationManager): void {
    this.notificationManager = notificationManager;
    this.logger('Notification manager set for Alt+Click feedback');
  }

  /**
   * Update VS Code keybinding system settings
   * Delegates to KeybindingService for settings management
   */
  public updateKeybindingSettings(settings: {
    sendKeybindingsToShell?: boolean;
    commandsToSkipShell?: string[];
    allowChords?: boolean;
    allowMnemonics?: boolean;
  }): void {
    this.keybindingService.updateSettings(settings);
  }

  /**
   * VS Code keybinding resolution system - determines if keybinding should be handled by VS Code or shell
   * Delegates to KeybindingService
   */
  private shouldSkipShell(event: KeyboardEvent, resolvedCommand?: string): boolean {
    return this.keybindingService.shouldSkipShell(event, resolvedCommand);
  }

  /**
   * Resolve keyboard event to VS Code command
   * Delegates to KeybindingService
   */
  private resolveKeybinding(event: KeyboardEvent): string | null {
    return this.keybindingService.resolveKeybinding(event);
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
    this.logger('Setting up Alt key visual feedback');

    const keydownHandler = (event: KeyboardEvent): void => {
      if (event.altKey && !this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = true;
        this.updateTerminalCursors();
        this.logger('Alt key pressed - updating cursor styles');
      }
    };

    const keyupHandler = (event: KeyboardEvent): void => {
      if (!event.altKey && this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = false;
        this.updateTerminalCursors();
        this.logger('Alt key released - resetting cursor styles');
      }
    };

    // Register Alt key handlers using EventHandlerRegistry
    this.eventRegistry.register(
      'alt-key-down',
      document,
      'keydown',
      keydownHandler as EventListener
    );
    this.eventRegistry.register('alt-key-up', document, 'keyup', keyupHandler as EventListener);

    this.logger('Alt key visual feedback', 'completed');
  }

  /**
   * Setup keyboard shortcuts for terminal navigation with VS Code keybinding system
   */
  public setupKeyboardShortcuts(manager: IManagerCoordinator): void {
    this.logger('Setting up VS Code compatible keyboard shortcuts');

    const shortcutHandler = (event: KeyboardEvent): void => {
      if (this.handlePanelNavigationKey(event, manager)) {
        return;
      }

      // VS Code standard: Check IME composition before processing shortcuts
      if (this.imeHandler.isIMEComposing()) {
        this.logger(`Keyboard shortcut blocked during IME composition: ${event.key}`);
        // During IME composition, don't process keyboard shortcuts
        // Let the IME system handle all key events
        return;
      }

      // Check for KEY_IN_COMPOSITION (VS Code standard)
      if (event.keyCode === KeyboardConstants.IME_COMPOSITION_KEYCODE) {
        // KeyCode.KEY_IN_COMPOSITION
        this.logger('KEY_IN_COMPOSITION detected - stopping propagation');
        event.stopPropagation();
        return;
      }

      // VS Code keybinding resolution
      const resolvedCommand = this.resolveKeybinding(event);
      const shouldSkip = this.shouldSkipShell(event, resolvedCommand || undefined);

      this.logger(
        `Keybinding: ${event.key}, Command: ${resolvedCommand}, Skip Shell: ${shouldSkip}, IME: ${this.imeHandler.isIMEComposing()}`
      );

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
    this.eventRegistry.register(
      'keyboard-shortcuts',
      document,
      'keydown',
      shortcutHandler as EventListener
    );

    this.logger('VS Code compatible keyboard shortcuts', 'completed');
  }

  /**
   * Handle VS Code commands resolved from keybindings
   */
  private handleVSCodeCommand(command: string, manager: IManagerCoordinator): void {
    this.logger(`Handling VS Code command: ${command}`);

    switch (command) {
      // Terminal management
      case 'workbench.action.terminal.new':
        this.emitTerminalInteractionEvent('create-terminal', '', undefined, manager);
        break;
      case 'workbench.action.terminal.split':
        this.emitTerminalInteractionEvent(
          'split-terminal',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        break;
      case 'workbench.action.terminal.kill':
        this.emitTerminalInteractionEvent(
          'kill-terminal',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        break;
      case 'workbench.action.terminal.clear':
        this.handleTerminalClear(manager);
        break;

      // Navigation
      case 'workbench.action.terminal.focusNext':
        this.emitTerminalInteractionEvent(
          'switch-next',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        break;
      case 'workbench.action.terminal.focusPrevious':
        this.emitTerminalInteractionEvent(
          'switch-previous',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
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
        this.logger('Panel toggle not available in webview context');
        break;
      case 'workbench.action.closePanel':
        this.logger('Panel close not available in webview context');
        break;
      case 'workbench.action.toggleSidebarVisibility':
        this.logger('Sidebar toggle not available in webview context');
        break;

      // Development tools
      case 'workbench.action.toggleDevTools':
        this.logger('Dev Tools toggle not available in webview context');
        break;
      case 'workbench.action.reloadWindow':
        this.logger('Window reload not available in webview context');
        break;
      case 'workbench.action.reloadWindowWithExtensionsDisabled':
        this.logger('Window reload with disabled extensions not available in webview context');
        break;

      // Zoom
      case 'workbench.action.zoomIn':
      case 'workbench.action.zoomOut':
      case 'workbench.action.zoomReset':
        this.logger(`Zoom commands (${command}) not available in webview context`);
        break;

      // Quick actions
      case 'workbench.action.quickOpen':
        this.logger('Quick Open not implemented in terminal webview');
        break;
      case 'workbench.action.showCommands':
        this.logger('Command Palette not implemented in terminal webview');
        break;

      // Native console
      case 'workbench.action.terminal.openNativeConsole':
        this.logger('Native console not available in webview context');
        break;

      default:
        this.logger(`Unhandled VS Code command: ${command}`);
    }
  }

  /**
   * Handle terminal scrolling - delegates to TerminalOperationsService
   */
  private scrollTerminal(direction: ScrollDirection, manager: IManagerCoordinator): void {
    this.terminalOperationsService.scrollTerminal(direction, manager);
  }

  /**
   * Handle terminal clear operation - delegates to TerminalOperationsService
   */
  private handleTerminalClear(manager: IManagerCoordinator): void {
    this.terminalOperationsService.clearTerminal(manager);
  }

  /**
   * Handle terminal copy selection
   * Note: In VS Code WebView, navigator.clipboard may not work.
   * We send selection to Extension to copy via VS Code API.
   */
  private handleTerminalCopy(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) {
      return;
    }

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance) {
      return;
    }

    const terminal = terminalInstance.terminal;
    const hasSelection = terminal.hasSelection();

    if (hasSelection) {
      const selection = terminal.getSelection();

      if (selection) {
        // Send selection to Extension to copy to clipboard
        this.logger(
          `📋 Copying selection from terminal ${activeTerminalId} (${selection.length} chars)`
        );

        manager.postMessageToExtension({
          command: 'copyToClipboard',
          terminalId: activeTerminalId,
          text: selection,
        });

        // Clear selection after copy (like VS Code terminal)
        terminal.clearSelection();
      }
    }
  }

  /**
   * Handle terminal paste operation
   * Note: In VS Code WebView, navigator.clipboard may not work.
   * We request clipboard content from Extension via messaging.
   */
  private handleTerminalPaste(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) {
      return;
    }

    // Request clipboard content from Extension
    this.logger(`📋 Requesting clipboard content from Extension for terminal ${activeTerminalId}`);

    // Send message to Extension to get clipboard content
    manager.postMessageToExtension({
      command: 'requestClipboardContent',
      terminalId: activeTerminalId,
    });

    // Extension will respond with 'clipboardContent' message
    // which is handled in message handler
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
    this.logger(`Selected all in terminal ${activeTerminalId}`);
  }

  /**
   * Handle terminal find operation
   */
  private handleTerminalFind(manager: IManagerCoordinator): void {
    const activeTerminalId = manager.getActiveTerminalId();
    if (!activeTerminalId) return;

    const terminalInstance = manager.getTerminalInstance(activeTerminalId);
    if (!terminalInstance || !terminalInstance.searchAddon) {
      this.logger(`Search addon not available for terminal ${activeTerminalId}`);
      return;
    }

    // Use search addon if available
    try {
      // Simple find interface - could be enhanced with search UI
      const searchTerm = prompt('Find in terminal:');
      if (searchTerm) {
        terminalInstance.searchAddon.findNext(searchTerm);
        this.logger(`Searching for "${searchTerm}" in terminal ${activeTerminalId}`);
      }
    } catch (error) {
      this.logger(`Find operation failed: ${error}`);
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
      this.logger(`Find next in terminal ${activeTerminalId}`);
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
      this.logger(`Find previous in terminal ${activeTerminalId}`);
    }
  }

  /**
   * Handle hide terminal find
   */
  private handleTerminalHideFind(_manager: IManagerCoordinator): void {
    // Hide find UI - this would be enhanced with actual find UI
    this.logger('Hide terminal find requested');
  }

  /**
   * Handle terminal word deletion operations - delegates to TerminalOperationsService
   */
  private handleTerminalDeleteWordLeft(manager: IManagerCoordinator): void {
    this.terminalOperationsService.deleteWordLeft(manager);
  }

  private handleTerminalDeleteWordRight(manager: IManagerCoordinator): void {
    this.terminalOperationsService.deleteWordRight(manager);
  }

  /**
   * Handle terminal line movement operations - delegates to TerminalOperationsService
   */
  private handleTerminalMoveToLineStart(manager: IManagerCoordinator): void {
    this.terminalOperationsService.moveToLineStart(manager);
  }

  private handleTerminalMoveToLineEnd(manager: IManagerCoordinator): void {
    this.terminalOperationsService.moveToLineEnd(manager);
  }

  /**
   * Handle terminal size to content - delegates to TerminalOperationsService
   */
  private handleTerminalSizeToContent(manager: IManagerCoordinator): void {
    this.terminalOperationsService.sizeToContent(manager);
  }

  /**
   * Handle legacy shortcuts for backward compatibility
   */
  private handleLegacyShortcuts(event: KeyboardEvent, manager: IManagerCoordinator): void {
    // Escape: Clear notifications (always handle, don't send to shell)
    if (event.key === 'Escape') {
      this.logger('Escape key detected, clearing notifications');
      this.clearNotifications();
    }

    // Ctrl+Shift+D: Toggle debug panel (always handle, don't send to shell)
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      this.logger('Ctrl+Shift+D shortcut detected, toggling debug panel');
      if ('toggleDebugPanel' in manager && typeof manager.toggleDebugPanel === 'function') {
        (manager as { toggleDebugPanel: () => void }).toggleDebugPanel();
      }
    }

    // Ctrl+Shift+P: Show profile selector (VS Code style)
    if (event.ctrlKey && event.shiftKey && event.key === 'P') {
      event.preventDefault();
      this.logger('Ctrl+Shift+P shortcut detected, showing profile selector');
      if (manager.profileManager) {
        manager.profileManager.showProfileSelector();
      }
    }

    // Ctrl+Alt+T: Create terminal with default profile (VS Code compatible)
    if (event.ctrlKey && event.altKey && event.key === 't') {
      event.preventDefault();
      this.logger('Ctrl+Alt+T shortcut detected, creating terminal with default profile');
      if (manager.profileManager) {
        manager.profileManager.createTerminalWithDefaultProfile().catch((error: any) => {
          this.logger('Failed to create terminal with default profile:', error);
        });
      }
    }

    // Ctrl+Shift+1-5: Quick profile switching by index
    if (event.ctrlKey && event.shiftKey && /^[1-5]$/.test(event.key)) {
      event.preventDefault();
      const profileIndex = parseInt(event.key) - 1;
      this.logger(
        `Ctrl+Shift+${event.key} shortcut detected, switching to profile index ${profileIndex}`
      );
      if (manager.profileManager) {
        manager.profileManager.switchToProfileByIndex(profileIndex).catch((error: any) => {
          this.logger(`Failed to switch to profile index ${profileIndex}:`, error);
        });
      }
    }
  }

  /**
   * Add complete input handling to xterm.js terminal (click, keyboard, focus)
   * Enhanced with VS Code standard IME handling pattern
   */
  public addXtermClickHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    manager: IManagerCoordinator
  ): void {
    this.logger(`Setting up VS Code standard input handling for terminal ${terminalId}`);

    // Clean up any existing handlers if this terminal is re-initialized
    this.removeTerminalHandlers(terminalId);

    const disposables: Array<{ dispose(): void }> = [];

    // CRITICAL: Set up keyboard input handling with IME awareness
    // Use onKey for regular keyboard input (non-IME)
    const onKeyDisposable = terminal.onKey((event: { key: string; domEvent: KeyboardEvent }) => {
      // VS Code standard: Check IME composition state before processing
      if (this.imeHandler.isIMEComposing()) {
        this.logger(
          `Terminal ${terminalId} key during IME composition - allowing xterm.js to handle`
        );
        // Let xterm.js handle IME composition internally
        // Don't send to extension during composition to avoid duplicate input
        return;
      }

      // Send only user keyboard input to extension (not PTY echo)
      this.logger(`Terminal ${terminalId} user input: ${event.key.length} chars`);
      const needsImmediateFlush = this.shouldFlushImmediately(event.key, event.domEvent);
      this.queueInputData(terminalId, event.key, needsImmediateFlush);
    });
    disposables.push(onKeyDisposable);

    // Handle mouse tracking escape sequences from TUI apps
    // onKey handles keyboard input; onData forwards mouse sequences to PTY
    const onDataDisposable = terminal.onData((data: string) => {
      const isMouseTracking = data.startsWith('\x1b[<') || data.startsWith('\x1b[M');

      if (isMouseTracking) {
        this.logger(`Terminal ${terminalId} mouse tracking: ${data.length} bytes`);
        this.queueInputData(terminalId, data, true);
        return;
      }

      // Ignore regular keyboard input - handled by onKey
    });
    disposables.push(onDataDisposable);

    // CRITICAL: Add compositionend listener for IME final text
    // This is the most reliable way to capture Japanese/Chinese/Korean input
    // The compositionend event fires with the final composed text
    const compositionEndHandler = (event: CompositionEvent): void => {
      const finalText = event.data;
      if (finalText) {
        this.logger(`Terminal ${terminalId} IME compositionend - final text: "${finalText}"`);
        this.queueInputData(terminalId, finalText, true);
      }
    };

    container.addEventListener('compositionend', compositionEndHandler as EventListener);

    // Wrap in disposable for cleanup
    const compositionEndDisposable = {
      dispose: () => {
        container.removeEventListener('compositionend', compositionEndHandler as EventListener);
      },
    };
    disposables.push(compositionEndDisposable);

    // Save disposables for terminal-specific cleanup
    this.terminalDisposables.set(terminalId, disposables);

    // Set up focus handling - xterm.js doesn't have onFocus/onBlur, comment out
    // terminal.onFocus(() => {
    //   this.logger(`Terminal ${terminalId} focused`);
    //   manager.setActiveTerminalId(terminalId);
    //   this.emitTerminalInteractionEvent('focus', terminalId, undefined, manager);
    // });

    // Set up blur handling - xterm.js doesn't have onFocus/onBlur, comment out
    // terminal.onBlur(() => {
    //   this.logger(`Terminal ${terminalId} blurred`);
    // });

    const shouldIgnoreActivationTarget = (event: MouseEvent | PointerEvent): boolean => {
      const target = event.target as HTMLElement | null;
      return Boolean(target?.closest('.terminal-control') || target?.closest('.terminal-header'));
    };

    const pointerDownHandler = (event: PointerEvent): void => {
      if (shouldIgnoreActivationTarget(event)) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      // Ensure activation even when click is suppressed by canvas/selection behavior
      manager.setActiveTerminalId(terminalId);
      terminal.focus();
    };

    const clickHandler = (event: MouseEvent): void => {
      if (shouldIgnoreActivationTarget(event)) {
        return;
      }

      // Regular click: Focus terminal
      if (!event.altKey) {
        this.logger(`Regular click on terminal ${terminalId}`);
        manager.setActiveTerminalId(terminalId);
        terminal.focus(); // Ensure terminal gets focus for keyboard input
        this.emitTerminalInteractionEvent('focus', terminalId, undefined, manager);
        return;
      }

      // Alt+Click handling
      if (event.altKey && this.altClickState.isVSCodeAltClickEnabled) {
        // VS Code standard Alt+Click behavior
        this.logger(`Alt+Click on terminal ${terminalId} at (${event.clientX}, ${event.clientY})`);

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
      clickHandler as EventListener,
      { capture: true }
    );

    this.eventRegistry.register(
      `terminal-pointerdown-${terminalId}`,
      container,
      'pointerdown',
      pointerDownHandler as EventListener,
      { capture: true }
    );

    this.logger(`Complete input handling configured for terminal ${terminalId}`);
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
    this.logger(
      `VS Code Alt+Click enabled: ${isEnabled} (altClick: ${altClickMovesCursor}, modifier: ${multiCursorModifier})`
    );

    return isEnabled;
  }

  /**
   * Remove all handlers and event listeners for a specific terminal
   * This prevents memory leaks when terminals are destroyed
   */
  public removeTerminalHandlers(terminalId: string): void {
    this.logger(`Removing terminal handlers for ${terminalId}`);

    // Clear pending input buffers and timers for this terminal
    const pendingBuffer = this.pendingInputBuffers.get(terminalId);
    if (pendingBuffer) {
      if (pendingBuffer.timer !== null) {
        clearTimeout(pendingBuffer.timer);
      }
      pendingBuffer.data = [];
      this.pendingInputBuffers.delete(terminalId);
    }

    // Dispose xterm.js event subscriptions (onKey, onData, compositionend)
    const disposables = this.terminalDisposables.get(terminalId);
    if (disposables) {
      for (const disposable of disposables) {
        try {
          disposable.dispose();
        } catch (error) {
          this.logger(`Error disposing handler for terminal ${terminalId}: ${error}`);
        }
      }
      this.terminalDisposables.delete(terminalId);
    }

    // Unregister DOM event handlers
    this.eventRegistry.unregister(`terminal-click-${terminalId}`);
    this.eventRegistry.unregister(`terminal-pointerdown-${terminalId}`);

    this.logger(`Terminal handlers removed for ${terminalId}`);
  }

  /**
   * Update Alt+Click settings and state
   */
  /**
   * Update Alt+Click settings and state using unified state management
   */
  public updateAltClickSettings(settings: PartialTerminalSettings): void {
    const wasEnabled = this.altClickState.isVSCodeAltClickEnabled;
    const isEnabled = this.isVSCodeAltClickEnabled(settings);

    if (wasEnabled !== isEnabled) {
      this.altClickState.isVSCodeAltClickEnabled = isEnabled;

      // Update unified state manager
      this.stateManager.updateAltClickState({
        isVSCodeAltClickEnabled: isEnabled,
      });

      this.logger(`Alt+Click setting changed: ${wasEnabled} → ${isEnabled}`);

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
  /**
   * Check if IME is currently composing using unified state management
   */
  public isIMEComposing(): boolean {
    return this.stateManager.getStateSection('ime').isActive;
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
      this.logger(`Agent interaction mode: ${actualEnabled} (VS Code standard - always disabled)`);

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
   * Setup global keyboard listener for shortcuts and commands
   */
  private setupGlobalKeyboardListener(): void {
    this.logger('Setting up global keyboard listener');

    const globalKeyHandler = (event: KeyboardEvent): void => {
      const manager = this.coordinator;
      if (manager && this.handlePanelNavigationKey(event, manager)) {
        return;
      }

      // Handle keyboard shortcuts and commands here
      // This will be populated with global shortcut handling logic
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        // Debug panel toggle handled elsewhere
        return;
      }

      // Handle special keys (Ctrl+C/V, etc.) for the active terminal
      if (manager) {
        const activeTerminalId = manager.getActiveTerminalId();
        if (activeTerminalId) {
          const handled = this.handleSpecialKeys(event, activeTerminalId, manager);
          if (handled) {
            // Event was handled, no need for further processing
            return;
          }
        }
      }

      // Additional global shortcuts can be added here
    };

    this.eventRegistry.register(
      'global-keyboard',
      document,
      'keydown',
      globalKeyHandler as EventListener,
      true
    );
  }

  private resolveNavigationTerminalId(manager: IManagerCoordinator): string | null {
    const activeTerminalId = manager.getActiveTerminalId?.();
    if (activeTerminalId) {
      return activeTerminalId;
    }

    const activeContainer = document.querySelector('.terminal-container.active');
    const fallbackTerminalId = activeContainer?.getAttribute('data-terminal-id');
    return fallbackTerminalId || null;
  }

  private handlePanelNavigationKey(event: KeyboardEvent, manager: IManagerCoordinator): boolean {
    const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const isToggleShortcut =
      !event.shiftKey &&
      !event.altKey &&
      normalizedKey === 'p' &&
      event.ctrlKey &&
      !event.metaKey;

    if (isToggleShortcut) {
      this.setPanelNavigationMode(!this.panelNavigationMode);
      event.preventDefault();
      event.stopPropagation();
      this.logger(`Panel navigation mode: ${this.panelNavigationMode ? 'enabled' : 'disabled'}`);
      return true;
    }

    if (!this.panelNavigationMode) {
      return false;
    }

    if (event.key === 'Escape') {
      this.setPanelNavigationMode(false);
      event.preventDefault();
      event.stopPropagation();
      this.logger('Panel navigation mode: disabled (Escape)');
      return true;
    }

    let interactionType: 'switch-next' | 'switch-previous' | null = null;
    if (PREVIOUS_NAVIGATION_KEYS.has(normalizedKey)) {
      interactionType = 'switch-previous';
    } else if (NEXT_NAVIGATION_KEYS.has(normalizedKey)) {
      interactionType = 'switch-next';
    } else {
      // Block non-navigation keys from reaching the terminal while in panel navigation mode
      event.preventDefault();
      event.stopPropagation();
      this.logger(`Ignored non-navigation key in panel navigation mode: ${event.key}`);
      return true;
    }

    event.preventDefault();
    event.stopPropagation();

    const activeTerminalId = this.resolveNavigationTerminalId(manager);
    if (activeTerminalId) {
      this.emitTerminalInteractionEvent(interactionType, activeTerminalId, undefined, manager);
    } else {
      this.logger('Panel navigation requested but no active terminal could be resolved');
    }

    return true;
  }

  public setPanelNavigationMode(enabled: boolean): void {
    this.panelNavigationMode = enabled;
    document.body.classList.toggle('panel-navigation-mode', enabled);

    const indicator = this.getOrCreatePanelNavigationIndicator();
    indicator.style.display = enabled ? 'block' : 'none';
  }

  private getOrCreatePanelNavigationIndicator(): HTMLElement {
    if (this.panelNavigationIndicator && document.body.contains(this.panelNavigationIndicator)) {
      return this.panelNavigationIndicator;
    }

    const indicator = document.createElement('div');
    indicator.className = 'panel-navigation-indicator';
    indicator.textContent = 'PANEL MODE (h/j/k/l, arrows, Esc)';
    Object.assign(indicator.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      zIndex: '10000',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: 'var(--vscode-badge-background, #0e639c)',
      color: 'var(--vscode-badge-foreground, #ffffff)',
      pointerEvents: 'none',
      display: 'none',
    });

    document.body.appendChild(indicator);
    this.panelNavigationIndicator = indicator;
    return indicator;
  }

  /**
   * Setup simplified arrow key handler for agent interactions
   * VS Code Standard: Arrow keys should be handled by xterm.js and shell
   */
  private setupAgentArrowKeyHandler(): void {
    this.logger('Setting up agent arrow key handler (VS Code standard)');

    const arrowKeyHandler = (event: KeyboardEvent): void => {
      // VS Code standard: Always respect IME composition state
      if (this.imeHandler.isIMEComposing()) {
        this.logger(`Arrow key ${event.key} during IME composition - letting IME handle`);
        return; // Let IME system handle all keys during composition
      }

      // Only log when in agent interaction mode for debugging
      if (!this.agentInteractionMode) {
        return;
      }

      // Check if this is an arrow key for logging only
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        // Find active terminal for logging
        const activeTerminal = document.querySelector('.terminal-container.active');
        if (activeTerminal) {
          const terminalId = activeTerminal.getAttribute('data-terminal-id');
          if (terminalId) {
            this.logger(
              `Arrow key ${event.key} in agent mode for terminal ${terminalId} - letting xterm.js handle`
            );
          }
        }
      }

      // VS Code Standard: Let xterm.js and shell handle all arrow keys naturally
      // Do NOT preventDefault() or stopPropagation() to preserve terminal functionality
      // This allows bash history, completion, and cursor movement to work properly
    };

    this.eventRegistry.register(
      'agent-arrow-keys',
      document,
      'keydown',
      arrowKeyHandler as EventListener,
      true
    );
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
        // Use a generic key for focus events to debounce across all terminals
        // This ensures that rapid switching (T1 -> T2 -> T3) only sends the final focus (T3)
        const key = `${type}-event`;
        if (this.eventDebounceTimers.has(key)) {
          clearTimeout(this.eventDebounceTimers.get(key));
        }

        const timer = setTimeout(() => {
          manager.postMessageToExtension({
            command: 'terminalInteraction',
            type,
            terminalId,
            data,
            timestamp: Date.now(),
          });
          this.eventDebounceTimers.delete(key);
        }, InputTimings.INPUT_DEBOUNCE_DELAY_MS); // Reduced from 200ms to 50ms for better responsiveness

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
      this.logger(`Error emitting terminal interaction event: ${error}`);
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
   * Handle special key combinations for terminal operations with IME awareness
   */
  public handleSpecialKeys(
    event: KeyboardEvent,
    terminalId: string,
    manager: IManagerCoordinator
  ): boolean {
    // VS Code standard: Check IME composition state first
    if (this.imeHandler.isIMEComposing()) {
      this.logger(`Special key ${event.key} blocked during IME composition`);
      return false; // Let IME handle all keys during composition
    }

    // Check for KEY_IN_COMPOSITION (VS Code standard)
    if (event.keyCode === KeyboardConstants.IME_COMPOSITION_KEYCODE) {
      // KeyCode.KEY_IN_COMPOSITION
      this.logger('KEY_IN_COMPOSITION in special keys - blocking');
      event.stopPropagation();
      return true;
    }

    // Ctrl+C (Windows/Linux) or Cmd+C (macOS): Copy (if selection exists) or interrupt
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      const terminal = manager.getTerminalInstance(terminalId);
      if (terminal && terminal.terminal.hasSelection()) {
        // Use Extension messaging for clipboard (navigator.clipboard doesn't work in VS Code WebView)
        this.logger(`${event.metaKey ? 'Cmd' : 'Ctrl'}+C copy for terminal ${terminalId}`);
        event.preventDefault();
        event.stopPropagation(); // Prevent xterm.js from also handling this event
        this.handleTerminalCopy(manager);
        return true;
      }
      // Send interrupt signal (only on Ctrl+C, not Cmd+C on macOS)
      // Note: Don't stopPropagation for interrupt - let it flow to shell
      if (!event.metaKey) {
        this.logger(`Ctrl+C interrupt for terminal ${terminalId}`);
        this.emitTerminalInteractionEvent('interrupt', terminalId, undefined, manager);
        return true;
      }
    }

    // Paste handling: Let paste event handler in TerminalCreationService handle clipboard
    // This ensures both text AND image paste work correctly:
    // - Text paste: Read from clipboardData and send to extension
    // - Image paste: Send \x16 to trigger Claude Code's native clipboard read
    // We don't intercept keydown here because the paste event needs to fire for clipboard access
    // Use userAgentData if available (modern), fallback to userAgent (deprecated navigator.platform)
    const isMac = (navigator as any).userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent);
    if (event.key === 'v') {
      if (isMac && event.metaKey) {
        // macOS Cmd+V: Let paste event handler deal with it
        // Don't preventDefault - we need the paste event to fire
        this.logger(`Cmd+V on macOS - letting paste event handler process`);
        return false; // Don't intercept
      } else if (!isMac && event.ctrlKey) {
        // Windows/Linux Ctrl+V: Let paste event handler deal with it
        this.logger(`Ctrl+V on non-Mac - letting paste event handler process`);
        return false; // Don't intercept
      }
    }

    // Ctrl+Insert (Windows/Linux): Copy - VS Code standard shortcut
    if (event.ctrlKey && event.key === 'Insert') {
      const terminal = manager.getTerminalInstance(terminalId);
      if (terminal && terminal.terminal.hasSelection()) {
        this.logger(`Ctrl+Insert copy for terminal ${terminalId}`);
        event.preventDefault();
        event.stopPropagation(); // Prevent xterm.js from also handling this event
        this.handleTerminalCopy(manager);
        return true;
      }
    }

    // Shift+Insert (Windows/Linux): Paste - VS Code standard shortcut
    if (event.shiftKey && event.key === 'Insert') {
      this.logger(`Shift+Insert paste for terminal ${terminalId}`);
      event.preventDefault();
      event.stopPropagation(); // Prevent xterm.js from also handling this event
      this.handleTerminalPaste(manager);
      return true;
    }

    // Shift+Enter or Option/Alt+Enter: Send newline for Claude Code multiline input
    // Claude Code uses these for inserting newlines without submitting
    if (event.key === 'Enter' && (event.shiftKey || event.altKey || event.metaKey)) {
      this.logger(
        `${event.shiftKey ? 'Shift' : event.altKey ? 'Alt' : 'Cmd'}+Enter - sending newline for multiline input`
      );
      event.preventDefault();
      event.stopPropagation();
      // Send literal newline character (not carriage return)
      // This allows Claude Code to recognize it as "insert newline" vs "submit"
      this.queueInputData(terminalId, '\n', true);
      return true;
    }

    return false;
  }

  private shouldFlushImmediately(data: string, domEvent: KeyboardEvent): boolean {
    if (!data) {
      return true;
    }

    const immediateKeys = new Set(['Enter', 'Backspace', 'Delete']);
    if (immediateKeys.has(domEvent.key)) {
      return true;
    }

    return /[\r\n]/.test(data);
  }

  /**
   * VS Code Standard: Determine if a key should be intercepted for VS Code handling
   * Returns true if VS Code should handle this key (not sent to shell)
   * Returns false if key should pass through to shell
   *
   * This implements the VS Code terminal keybinding behavior where:
   * - Most keys go to shell (arrow keys, Ctrl+C for interrupt, etc.)
   * - Only specific shortcuts are intercepted (Ctrl+Shift+C for copy, Cmd+K for clear, etc.)
   */
  private shouldInterceptKeyForVSCode(
    event: KeyboardEvent,
    terminal: Terminal,
    manager: IManagerCoordinator
  ): boolean {
    // Use userAgentData if available (modern), fallback to userAgent (deprecated navigator.platform)
    const isMac = (navigator as any).userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent);
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
        this.handleTerminalCopy(manager);
        return true;
      }
      // No selection - pass to shell for SIGINT
      return false;
    }

    // Ctrl+V: Paste
    if (ctrlOrCmd && event.key === 'v' && !event.shiftKey) {
      this.handleTerminalPaste(manager);
      return true;
    }

    // Ctrl+Shift+C: Copy (VS Code style)
    if (ctrlOrCmd && event.shiftKey && event.key === 'c') {
      if (terminal.hasSelection()) {
        this.handleTerminalCopy(manager);
        return true;
      }
      return false;
    }

    // Ctrl+Shift+V: Paste (VS Code style)
    if (ctrlOrCmd && event.shiftKey && event.key === 'v') {
      this.handleTerminalPaste(manager);
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
      this.handleTerminalClear(manager);
      return true;
    }

    // Ctrl+Insert / Shift+Insert for copy/paste (Windows/Linux)
    if (event.ctrlKey && event.key === 'Insert') {
      if (terminal.hasSelection()) {
        this.handleTerminalCopy(manager);
        return true;
      }
      return false;
    }
    if (event.shiftKey && event.key === 'Insert') {
      this.handleTerminalPaste(manager);
      return true;
    }

    // F12: Toggle dev tools (should be handled by VS Code, not shell)
    if (event.key === 'F12') {
      return true; // Intercept but don't handle - let VS Code handle
    }

    // All other keys - pass to shell
    return false;
  }

  private queueInputData(terminalId: string, data: string, flushImmediately: boolean): void {
    if (!terminalId || data.length === 0) {
      return;
    }

    let entry = this.pendingInputBuffers.get(terminalId);
    if (!entry) {
      entry = { data: [], timer: null };
      this.pendingInputBuffers.set(terminalId, entry);
    }

    entry.data.push(data);

    if (flushImmediately) {
      this.flushPendingInput(terminalId);
      return;
    }

    if (entry.timer !== null) {
      return;
    }

    entry.timer = setTimeout(() => {
      entry!.timer = null;
      this.flushPendingInput(terminalId);
    }, 0);
  }

  private flushPendingInput(terminalId: string): void {
    const entry = this.pendingInputBuffers.get(terminalId);
    if (!entry || entry.data.length === 0) {
      return;
    }

    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    const payload = entry.data.join('');
    entry.data.length = 0;

    const messageManager = this.coordinator.getMessageManager?.();
    if (messageManager && typeof messageManager.sendInput === 'function') {
      messageManager.sendInput(payload, terminalId);
      return;
    }

    this.coordinator.postMessageToExtension({
      command: 'input',
      terminalId,
      data: payload,
      timestamp: Date.now(),
    });
  }

  /**
   * Initialize the InputManager (BaseManager abstract method implementation)
   */
  protected doInitialize(): void {
    this.logger('initialization', 'starting');

    // Set up keyboard event listener for global shortcuts
    this.setupGlobalKeyboardListener();

    // Set up agent arrow key handler (VS Code standard)
    this.setupAgentArrowKeyHandler();

    this.logger('initialization', 'completed');
  }

  /**
   * Dispose InputManager resources (BaseManager abstract method implementation)
   */
  /**
   * Dispose InputManager resources (BaseManager abstract method implementation)
   */
  protected doDispose(): void {
    this.logger('disposal', 'starting');

    // Dispose EventHandlerRegistry - this will clean up all registered event listeners
    this.eventRegistry.dispose();

    // Clear debounce timers
    for (const timer of this.eventDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.eventDebounceTimers.clear();

    // Flush and clear pending input buffers
    for (const entry of this.pendingInputBuffers.values()) {
      if (entry.timer !== null) {
        clearTimeout(entry.timer);
      }
      entry.data.length = 0;
    }
    this.pendingInputBuffers.clear();

    // Dispose all terminal-specific xterm.js subscriptions
    for (const [terminalId, disposables] of this.terminalDisposables) {
      for (const disposable of disposables) {
        try {
          disposable.dispose();
        } catch (error) {
          this.logger(`Error disposing handler for terminal ${terminalId}: ${error}`);
        }
      }
    }
    this.terminalDisposables.clear();

    // Reset Alt+Click state
    this.altClickState = {
      isVSCodeAltClickEnabled: false,
      isAltKeyPressed: false,
    };
    this.agentInteractionMode = false;
    this.setPanelNavigationMode(false);
    if (this.panelNavigationIndicator) {
      this.panelNavigationIndicator.remove();
      this.panelNavigationIndicator = null;
    }

    // Dispose IME handler
    this.imeHandler.dispose();

    // Dispose new architecture services
    if (this.eventService) {
      this.eventService.dispose();
    }

    if (this.stateManager) {
      this.stateManager.dispose();
    }

    // Note: KeybindingService and TerminalOperationsService don't need explicit dispose
    // as they don't hold any event listeners or timers

    // Clear references
    this.notificationManager = null;

    this.logger('disposal', 'completed');
  }

  /**
   * Dispose of all event listeners and cleanup resources
   */
  public override dispose(): void {
    this.logger('Disposing input manager');

    // Call parent dispose which will call doDispose()
    super.dispose();

    this.logger('InputManager', 'completed');
  }
}
