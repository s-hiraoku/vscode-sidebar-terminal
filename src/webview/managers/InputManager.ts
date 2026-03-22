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
import { TerminalOperationsService } from './input/services/TerminalOperationsService';
import { VSCodeCommandDispatcher } from './input/handlers/VSCodeCommandDispatcher';
import { AltClickCoordinator } from './input/handlers/AltClickCoordinator';
import { InputFlushingService } from './input/services/InputFlushingService';
import { PanelNavigationHandler } from './input/handlers/PanelNavigationHandler';
import { TerminalClipboardHandler } from './input/handlers/TerminalClipboardHandler';
import { KeyboardShortcutSetupHandler } from './input/handlers/KeyboardShortcutSetupHandler';
import { SpecialKeysHandler } from './input/handlers/SpecialKeysHandler';

/**
 * Timing constants for input handling
 */
const InputTimings = {
  /** Debounce delay for input events (ms) */
  INPUT_DEBOUNCE_DELAY_MS: 50,
} as const;

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
  private vsCodeCommandDispatcher: VSCodeCommandDispatcher;
  private altClickCoordinator: AltClickCoordinator;
  private inputFlushingService: InputFlushingService;
  private panelNavigationHandler: PanelNavigationHandler;
  private terminalClipboardHandler: TerminalClipboardHandler;
  private keyboardShortcutSetupHandler: KeyboardShortcutSetupHandler;
  private specialKeysHandler: SpecialKeysHandler;

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

    // Initialize TerminalClipboardHandler
    this.terminalClipboardHandler = new TerminalClipboardHandler({
      logger: (message: string) => this.logger(message),
      terminalOperationsService: this.terminalOperationsService,
    });

    // Initialize VSCodeCommandDispatcher
    this.vsCodeCommandDispatcher = new VSCodeCommandDispatcher({
      logger: (message: string) => this.logger(message),
      emitTerminalInteractionEvent: (type, terminalId, data, manager) =>
        this.emitTerminalInteractionEvent(type, terminalId, data, manager),
      terminalOperationsService: this.terminalOperationsService,
      handleTerminalCopy: (manager) => this.terminalClipboardHandler.handleTerminalCopy(manager),
      handleTerminalPaste: (manager) => this.terminalClipboardHandler.handleTerminalPaste(manager),
      handleTerminalSelectAll: (manager) =>
        this.terminalClipboardHandler.handleTerminalSelectAll(manager),
      handleTerminalFind: (manager) => this.terminalClipboardHandler.handleTerminalFind(manager),
      handleTerminalFindNext: (manager) =>
        this.terminalClipboardHandler.handleTerminalFindNext(manager),
      handleTerminalFindPrevious: (manager) =>
        this.terminalClipboardHandler.handleTerminalFindPrevious(manager),
      handleTerminalHideFind: (manager) =>
        this.terminalClipboardHandler.handleTerminalHideFind(manager),
      handleTerminalClear: (manager) =>
        this.terminalClipboardHandler.handleTerminalClear(manager),
    });

    // Initialize InputFlushingService
    this.inputFlushingService = new InputFlushingService({
      logger: (message: string) => this.logger(message),
      sendInput: (data: string, terminalId: string) => {
        const messageManager = this.coordinator.getMessageManager?.();
        if (messageManager && typeof messageManager.sendInput === 'function') {
          messageManager.sendInput(data, terminalId);
          return;
        }
        this.coordinator.postMessageToExtension({
          command: 'input',
          terminalId,
          data,
          timestamp: Date.now(),
        });
      },
    });

    // Initialize AltClickCoordinator
    this.altClickCoordinator = new AltClickCoordinator({
      logger: (message: string) => this.logger(message),
      eventRegistry: this.eventRegistry,
      stateManager: this.stateManager,
    });

    // Initialize PanelNavigationHandler
    this.panelNavigationHandler = new PanelNavigationHandler({
      logger: (message: string) => this.logger(message),
      getActiveTerminalId: () => this.coordinator.getActiveTerminalId?.() || null,
      emitTerminalInteractionEvent: (type, terminalId, data) =>
        this.emitTerminalInteractionEvent(
          type as TerminalInteractionEvent['type'],
          terminalId,
          data,
          this.coordinator
        ),
    });

    // Initialize SpecialKeysHandler
    this.specialKeysHandler = new SpecialKeysHandler({
      logger: (message: string) => this.logger(message),
      isIMEComposing: () => this.imeHandler.isIMEComposing(),
      handleTerminalCopy: (manager: IManagerCoordinator) =>
        this.terminalClipboardHandler.handleTerminalCopy(manager),
      handleTerminalPaste: (manager: IManagerCoordinator) =>
        this.terminalClipboardHandler.handleTerminalPaste(manager),
      emitTerminalInteractionEvent: (type, terminalId, data, manager) =>
        this.emitTerminalInteractionEvent(type, terminalId, data, manager),
      queueInputData: (terminalId: string, data: string, flushImmediately: boolean) =>
        this.queueInputData(terminalId, data, flushImmediately),
      getTerminalInstance: (terminalId: string) => {
        // This will be called with manager context; use coordinator
        return this.coordinator.getTerminalInstance?.(terminalId) as
          | { terminal: { hasSelection(): boolean } }
          | null
          | undefined;
      },
    });

    // Initialize KeyboardShortcutSetupHandler
    this.keyboardShortcutSetupHandler = new KeyboardShortcutSetupHandler({
      logger: (message: string) => this.logger(message),
      eventRegistry: this.eventRegistry,
      isIMEComposing: () => this.imeHandler.isIMEComposing(),
      resolveKeybinding: (event: KeyboardEvent) => this.resolveKeybinding(event),
      shouldSkipShell: (event: KeyboardEvent, resolvedCommand?: string) =>
        this.shouldSkipShell(event, resolvedCommand),
      handleVSCodeCommand: (command: string, manager: IManagerCoordinator) =>
        this.handleVSCodeCommand(command, manager),
      handlePanelNavigationKey: (event: KeyboardEvent) =>
        this.panelNavigationHandler.handlePanelNavigationKey(event),
      handleSpecialKeys: (
        event: KeyboardEvent,
        terminalId: string,
        manager: IManagerCoordinator
      ) => this.handleSpecialKeys(event, terminalId, manager),
      getActiveTerminalId: () => this.coordinator.getActiveTerminalId?.() || null,
    });

    // Initialize IME handler with new architecture
    this.imeHandler = new IMEHandler(
      this.eventDebounceTimers,
      this.stateManager,
      this.eventService
    );

    this.logger('initialization', 'starting');
  }

  // IME Handler for composition events
  private imeHandler: IIMEHandler;

  // Debounce timers for events
  private eventDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Terminal-specific disposables for xterm.js events (memory leak prevention)
  private terminalDisposables = new Map<string, Array<{ dispose(): void }>>();


  /**
   * Set the notification manager for Alt+Click feedback
   */
  public setNotificationManager(notificationManager: INotificationManager): void {
    this.altClickCoordinator.setNotificationManager(notificationManager);
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
   * Delegates to AltClickCoordinator
   */
  public setupAltKeyVisualFeedback(): void {
    this.altClickCoordinator.setupAltKeyVisualFeedback();
  }

  /**
   * Setup keyboard shortcuts for terminal navigation with VS Code keybinding system
   * Delegates to KeyboardShortcutSetupHandler
   */
  public setupKeyboardShortcuts(manager: IManagerCoordinator): void {
    this.keyboardShortcutSetupHandler.setupKeyboardShortcuts(manager);
  }

  /**
   * Handle VS Code commands resolved from keybindings
   * Delegates to VSCodeCommandDispatcher
   */
  private handleVSCodeCommand(command: string, manager: IManagerCoordinator): void {
    this.vsCodeCommandDispatcher.handleVSCodeCommand(command, manager);
  }

  /**
   * Handle legacy shortcuts for backward compatibility
   * Delegates to KeyboardShortcutSetupHandler
   */
  private handleLegacyShortcuts(event: KeyboardEvent, manager: IManagerCoordinator): void {
    this.keyboardShortcutSetupHandler.handleLegacyShortcuts(event, manager);
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

    // Focus/blur handling via DOM events on the terminal container
    // Sends terminalFocused/terminalBlurred messages to extension for context key management
    const focusInHandler = (): void => {
      this.logger(`Terminal ${terminalId} focused (focusin)`);
      manager.postMessageToExtension({
        command: 'terminalFocused',
        terminalId,
        timestamp: Date.now(),
      });
    };
    const focusOutHandler = (event: FocusEvent): void => {
      // Only send blur if focus moves outside this terminal container
      if (!container.contains(event.relatedTarget as Node | null)) {
        this.logger(`Terminal ${terminalId} blurred (focusout)`);
        manager.postMessageToExtension({
          command: 'terminalBlurred',
          terminalId,
          timestamp: Date.now(),
        });
      }
    };
    container.addEventListener('focusin', focusInHandler);
    container.addEventListener('focusout', focusOutHandler);
    disposables.push({
      dispose: () => {
        container.removeEventListener('focusin', focusInHandler);
        container.removeEventListener('focusout', focusOutHandler);
      },
    });

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

      // Alt+Click handling - delegate to AltClickCoordinator
      if (event.altKey && this.altClickCoordinator.handleAltClick(event.clientX, event.clientY, terminalId)) {
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
   * Delegates to AltClickCoordinator
   */
  private updateTerminalCursors(): void {
    this.altClickCoordinator.updateTerminalCursors();
  }

  /**
   * Check if VS Code Alt+Click is enabled based on settings
   * Delegates to AltClickCoordinator
   */
  public isVSCodeAltClickEnabled(settings: PartialTerminalSettings): boolean {
    return this.altClickCoordinator.isVSCodeAltClickEnabled(settings);
  }

  /**
   * Remove all handlers and event listeners for a specific terminal
   * This prevents memory leaks when terminals are destroyed
   */
  public removeTerminalHandlers(terminalId: string): void {
    this.logger(`Removing terminal handlers for ${terminalId}`);

    // Clear pending input buffers and timers for this terminal
    this.inputFlushingService.clearTerminalBuffer(terminalId);

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
   * Delegates to AltClickCoordinator
   */
  public updateAltClickSettings(settings: PartialTerminalSettings): void {
    this.altClickCoordinator.updateAltClickSettings(settings);
  }

  /**
   * Get current Alt+Click state
   * Delegates to AltClickCoordinator
   */
  public getAltClickState(): AltClickState {
    return this.altClickCoordinator.getAltClickState();
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
   * Delegates to KeyboardShortcutSetupHandler
   */
  public setAgentInteractionMode(enabled: boolean): void {
    this.keyboardShortcutSetupHandler.setAgentInteractionMode(enabled);
  }

  /**
   * Check if agent interaction mode is enabled
   * Delegates to KeyboardShortcutSetupHandler
   */
  public isAgentInteractionMode(): boolean {
    return this.keyboardShortcutSetupHandler.isAgentInteractionMode();
  }

  public setPanelNavigationEnabled(enabled: boolean): void {
    this.panelNavigationHandler.setPanelNavigationEnabled(enabled);
  }

  public setPanelNavigationMode(enabled: boolean): void {
    this.panelNavigationHandler.setPanelNavigationMode(enabled);
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
   * Handle special key combinations for terminal operations with IME awareness
   * Delegates to SpecialKeysHandler
   */
  public handleSpecialKeys(
    event: KeyboardEvent,
    terminalId: string,
    manager: IManagerCoordinator
  ): boolean {
    return this.specialKeysHandler.handleSpecialKeys(event, terminalId, manager);
  }

  private shouldFlushImmediately(data: string, domEvent: KeyboardEvent): boolean {
    return this.inputFlushingService.shouldFlushImmediately(data, domEvent);
  }

  /**
   * VS Code Standard: Determine if a key should be intercepted for VS Code handling
   * Delegates to VSCodeCommandDispatcher
   */
  private shouldInterceptKeyForVSCode(
    event: KeyboardEvent,
    terminal: Terminal,
    manager: IManagerCoordinator
  ): boolean {
    return this.vsCodeCommandDispatcher.shouldInterceptKeyForVSCode(event, terminal, manager);
  }

  private queueInputData(terminalId: string, data: string, flushImmediately: boolean): void {
    this.inputFlushingService.queueInputData(terminalId, data, flushImmediately);
  }

  /**
   * Initialize the InputManager (BaseManager abstract method implementation)
   */
  protected doInitialize(): void {
    this.logger('initialization', 'starting');

    // Set up keyboard event listener for global shortcuts
    this.keyboardShortcutSetupHandler.setupGlobalKeyboardListener();

    // Set up agent arrow key handler (VS Code standard)
    this.keyboardShortcutSetupHandler.setupAgentArrowKeyHandler();

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

    // Dispose input flushing service (clears all pending buffers and timers)
    this.inputFlushingService.dispose();

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

    // Dispose AltClickCoordinator
    this.altClickCoordinator.dispose();

    // Dispose PanelNavigationHandler
    this.panelNavigationHandler.dispose();

    // Dispose KeyboardShortcutSetupHandler
    this.keyboardShortcutSetupHandler.dispose();

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
