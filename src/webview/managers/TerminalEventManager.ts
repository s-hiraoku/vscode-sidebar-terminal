/**
 * Terminal Event Manager
 *
 * Extracted from TerminalLifecycleCoordinator to centralize event handling.
 *
 * Responsibilities:
 * - Terminal click event handling for activation
 * - Focus management and optimization
 * - Mouse and keyboard event coordination
 * - Event handler registration and cleanup
 *
 * Extended BaseManager for consistent lifecycle management (Issue #216)
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/split-lifecycle-manager/spec.md
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { Terminal } from '@xterm/xterm';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { terminalLogger } from '../utils/ManagerLogger';
import { BaseManager } from './BaseManager';

/**
 * Event handler callbacks for terminal container
 */
export interface TerminalContainerCallbacks {
  onHeaderClick: (terminalId: string) => void;
  onContainerClick: (terminalId: string) => void;
  onCloseClick: (terminalId: string) => void;
  onAiAgentToggleClick: (terminalId: string) => void;
}

/**
 * Service responsible for managing terminal events
 * Uses constructor injection pattern for dependencies
 */
export class TerminalEventManager extends BaseManager {
  private readonly eventRegistry: EventHandlerRegistry;
  private readonly coordinator: IManagerCoordinator;
  private readonly disposables: Array<{ dispose: () => void }> = [];

  constructor(coordinator: IManagerCoordinator, eventRegistry: EventHandlerRegistry) {
    super('TerminalEventManager', {
      enableLogging: false, // Use terminalLogger instead
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });

    this.coordinator = coordinator;
    this.eventRegistry = eventRegistry;
  }

  /**
   * Initialize manager
   */
  protected doInitialize(): void {
    this.logger('TerminalEventManager initialized');
    terminalLogger.info('✅ TerminalEventManager ready');
  }

  /**
   * Setup all event handlers for a terminal
   */
  public setupTerminalEvents(terminal: Terminal, terminalId: string, container: HTMLElement): void {
    if (this.shouldUseLegacyInputHandler()) {
      // Setup user input handler (send to Extension) when InputManager is unavailable
      this.setupInputHandler(terminal, terminalId);
    } else {
      terminalLogger.debug(
        `⏭️ Skipping legacy onData handler for ${terminalId}; InputManager controls keyboard input`
      );
    }

    // Setup click handler for terminal activation
    this.setupTerminalClickHandler(terminal, terminalId, container);

    // Setup focus optimization
    this.setupFocusOptimization(terminal, terminalId);

    terminalLogger.info(`✅ Event handlers setup for terminal: ${terminalId}`);
  }

  private shouldUseLegacyInputHandler(): boolean {
    try {
      if (this.coordinator?.inputManager) {
        return false;
      }

      const managers = this.coordinator?.getManagers?.();
      if (managers?.input) {
        return false;
      }
    } catch (error) {
      terminalLogger.warn(
        '⚠️ Failed to detect InputManager availability, defaulting to legacy handler',
        error
      );
    }

    return true;
  }

  /**
   * Setup input handler to send user input to Extension
   */
  private setupInputHandler(terminal: Terminal, terminalId: string): void {
    try {
      terminalLogger.info(`🔧 Setting up input handler for ${terminalId}...`);

      const inputDisposable = terminal.onData((data: string) => {
        // 🔍 CRITICAL DEBUG: Log every keystroke to verify handler is called
        console.log(`🔍 [INPUT-DEBUG] onData fired for ${terminalId}:`, {
          dataLength: data.length,
          data: data,
          charCodes: Array.from(data).map((c) => c.charCodeAt(0)),
          timestamp: Date.now(),
        });
        terminalLogger.debug(`⌨️ User input for ${terminalId}: ${data.length} chars`);

        // Send input to Extension
        const message = {
          command: 'input',
          data,
          terminalId,
        };

        console.log(`🔍 [INPUT-DEBUG] Sending to Extension:`, message);
        this.coordinator?.postMessageToExtension(message);
        console.log(`🔍 [INPUT-DEBUG] Message sent`);
      });

      this.disposables.push(inputDisposable);

      // 🔍 CRITICAL DEBUG: Verify handler was registered
      console.log(`🔍 [INPUT-DEBUG] Input handler registered for ${terminalId}`, {
        hasCoordinator: !!this.coordinator,
        disposableCount: this.disposables.length,
      });

      terminalLogger.info(`✅ Input handler enabled for terminal: ${terminalId}`);
    } catch (error) {
      console.error(`🔍 [INPUT-DEBUG] FAILED to setup input handler:`, error);
      terminalLogger.error(`Failed to setup input handler for ${terminalId}:`, error);
    }
  }

  /**
   * Setup click handler for terminal activation (VS Code standard behavior)
   */
  private setupTerminalClickHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement
  ): void {
    try {
      const xtermElement = container.querySelector('.xterm');
      if (!xtermElement) {
        terminalLogger.warn(`xterm element not found for terminal: ${terminalId}`);
        return;
      }

      // VS Code standard: Click activates terminal only if no text is selected
      const clickHandler = (_event: Event) => {
        try {
          if (!terminal.hasSelection()) {
            terminalLogger.debug(
              `🎯 Terminal clicked for activation (no selection): ${terminalId}`
            );
            this.coordinator?.setActiveTerminalId(terminalId);
          } else {
            terminalLogger.debug(
              `🎯 Click ignored due to text selection in terminal: ${terminalId}`
            );
          }
        } catch (error) {
          terminalLogger.warn(`Failed to handle terminal click for ${terminalId}:`, error);
        }
      };

      xtermElement.addEventListener('click', clickHandler);
      this.eventRegistry.register(
        `terminal-${terminalId}-click`,
        xtermElement as HTMLElement,
        'click',
        clickHandler
      );

      terminalLogger.info(`✅ VS Code standard click handling enabled for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.error(`Failed to setup click handler for ${terminalId}:`, error);
    }
  }

  /**
   * Setup focus optimization to avoid redundant focus calls
   */
  private setupFocusOptimization(terminal: Terminal, terminalId: string): void {
    try {
      const textArea = terminal.textarea;
      if (!textArea) {
        terminalLogger.warn(`Terminal textarea not found for: ${terminalId}`);
        return;
      }

      // Track focus state to avoid redundant focus operations
      const focusHandler = () => {
        terminalLogger.debug(`🎯 Terminal focused: ${terminalId}`);
      };

      const blurHandler = () => {
        terminalLogger.debug(`🎯 Terminal blurred: ${terminalId}`);
      };

      textArea.addEventListener('focus', focusHandler);
      textArea.addEventListener('blur', blurHandler);

      this.eventRegistry.register(`terminal-${terminalId}-focus`, textArea, 'focus', focusHandler);
      this.eventRegistry.register(`terminal-${terminalId}-blur`, textArea, 'blur', blurHandler);

      terminalLogger.debug(`✅ Focus optimization enabled for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.warn(`Failed to setup focus optimization for ${terminalId}:`, error);
    }
  }

  /**
   * Create container event callbacks that delegate to coordinator
   */
  public createContainerCallbacks(_terminalId: string): TerminalContainerCallbacks {
    return {
      onHeaderClick: (clickedTerminalId: string) => {
        terminalLogger.info(`🎯 Header clicked for terminal: ${clickedTerminalId}`);
        this.coordinator?.setActiveTerminalId(clickedTerminalId);
      },

      onContainerClick: (clickedTerminalId: string) => {
        terminalLogger.info(`🎯 Container clicked for terminal: ${clickedTerminalId}`);
        this.coordinator?.setActiveTerminalId(clickedTerminalId);
      },

      onCloseClick: (clickedTerminalId: string) => {
        terminalLogger.info(
          `🗑️ Header close button clicked, using safe deletion: ${clickedTerminalId}`
        );
        void this.coordinator.deleteTerminalSafely?.(clickedTerminalId);
      },

      onAiAgentToggleClick: (clickedTerminalId: string) => {
        terminalLogger.info(`📎 AI Agent toggle clicked for terminal: ${clickedTerminalId}`);
        this.coordinator.handleAiAgentToggle?.(clickedTerminalId);
      },
    };
  }

  /**
   * Focus terminal with optimization to avoid redundant calls
   */
  public focusTerminal(terminal: Terminal, terminalId: string): void {
    try {
      const textArea = terminal.textarea;
      if (!textArea) {
        terminalLogger.warn(`Cannot focus terminal ${terminalId}: textarea not found`);
        return;
      }

      // Check if terminal actually needs focus (avoid redundant focus calls)
      const needsFocus =
        textArea && !textArea.hasAttribute('focused') && document.activeElement !== textArea;

      if (needsFocus) {
        // Reduced delay from 10ms to 5ms for faster response
        setTimeout(() => {
          terminal.focus();
          terminalLogger.info(`🎯 Focused xterm.js terminal: ${terminalId}`);
        }, 5);
      } else {
        terminalLogger.debug(`🎯 Terminal ${terminalId} already focused, skipping focus call`);
      }
    } catch (error) {
      terminalLogger.error(`Failed to focus terminal ${terminalId}:`, error);
    }
  }

  /**
   * Blur terminal (remove focus)
   */
  public blurTerminal(terminal: Terminal, terminalId: string): void {
    try {
      if (terminal.textarea) {
        terminal.textarea.blur();
        terminalLogger.debug(`🎯 Blurred terminal: ${terminalId}`);
      }
    } catch (error) {
      terminalLogger.warn(`Failed to blur terminal ${terminalId}:`, error);
    }
  }

  /**
   * Setup wheel event handling for custom scrolling behavior
   */
  public setupWheelHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    onWheel?: (event: WheelEvent) => void
  ): void {
    try {
      const xtermElement = container.querySelector('.xterm');
      if (!xtermElement) {
        terminalLogger.warn(`xterm element not found for wheel handler: ${terminalId}`);
        return;
      }

      const wheelHandler = (event: WheelEvent) => {
        try {
          if (onWheel) {
            onWheel(event);
          }
          // Default xterm.js wheel behavior is preserved
        } catch (error) {
          terminalLogger.warn(`Wheel handler error for ${terminalId}:`, error);
        }
      };

      xtermElement.addEventListener('wheel', wheelHandler as EventListener);
      this.eventRegistry.register(
        `terminal-${terminalId}-wheel`,
        xtermElement as HTMLElement,
        'wheel',
        wheelHandler as EventListener
      );

      terminalLogger.debug(`✅ Wheel handler setup for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.error(`Failed to setup wheel handler for ${terminalId}:`, error);
    }
  }

  /**
   * Setup keyboard event handling
   */
  public setupKeyboardHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    onKey?: (event: KeyboardEvent) => void
  ): void {
    try {
      const keyHandler = (event: KeyboardEvent) => {
        try {
          if (onKey) {
            onKey(event);
          }
        } catch (error) {
          terminalLogger.warn(`Keyboard handler error for ${terminalId}:`, error);
        }
      };

      const textArea = terminal.textarea;
      if (textArea) {
        textArea.addEventListener('keydown', keyHandler);
        this.eventRegistry.register(
          `terminal-${terminalId}-keydown`,
          textArea,
          'keydown',
          keyHandler as EventListener
        );

        terminalLogger.debug(`✅ Keyboard handler setup for terminal: ${terminalId}`);
      }
    } catch (error) {
      terminalLogger.error(`Failed to setup keyboard handler for ${terminalId}:`, error);
    }
  }

  /**
   * Setup mouse event handling (beyond click)
   */
  public setupMouseHandlers(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    handlers?: {
      onMouseEnter?: (event: MouseEvent) => void;
      onMouseLeave?: (event: MouseEvent) => void;
      onMouseMove?: (event: MouseEvent) => void;
    }
  ): void {
    try {
      const xtermElement = container.querySelector('.xterm');
      if (!xtermElement) {
        terminalLogger.warn(`xterm element not found for mouse handlers: ${terminalId}`);
        return;
      }

      if (handlers?.onMouseEnter) {
        const enterHandler = (event: MouseEvent) => handlers.onMouseEnter!(event);
        xtermElement.addEventListener('mouseenter', enterHandler as EventListener);
        this.eventRegistry.register(
          `terminal-${terminalId}-mouseenter`,
          xtermElement as HTMLElement,
          'mouseenter',
          enterHandler as EventListener
        );
      }

      if (handlers?.onMouseLeave) {
        const leaveHandler = (event: MouseEvent) => handlers.onMouseLeave!(event);
        xtermElement.addEventListener('mouseleave', leaveHandler as EventListener);
        this.eventRegistry.register(
          `terminal-${terminalId}-mouseleave`,
          xtermElement as HTMLElement,
          'mouseleave',
          leaveHandler as EventListener
        );
      }

      if (handlers?.onMouseMove) {
        const moveHandler = (event: MouseEvent) => handlers.onMouseMove!(event);
        xtermElement.addEventListener('mousemove', moveHandler as EventListener);
        this.eventRegistry.register(
          `terminal-${terminalId}-mousemove`,
          xtermElement as HTMLElement,
          'mousemove',
          moveHandler as EventListener
        );
      }

      terminalLogger.debug(`✅ Mouse handlers setup for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.error(`Failed to setup mouse handlers for ${terminalId}:`, error);
    }
  }

  /**
   * Remove all event handlers for a terminal
   */
  public removeTerminalEvents(terminalId: string): void {
    try {
      // Event registry automatically cleans up by prefix
      // TODO: Implement unregisterByPrefix in EventHandlerRegistry
      // this.eventRegistry.unregisterByPrefix(`terminal-${terminalId}`);
      terminalLogger.info(`✅ Event handlers removed for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.error(`Failed to remove event handlers for ${terminalId}:`, error);
    }
  }

  /**
   * Cleanup and dispose
   * Called by BaseManager.dispose() for cleanup
   */
  protected doDispose(): void {
    // Dispose all input handlers
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      if (disposable) {
        try {
          disposable.dispose();
        } catch (error) {
          terminalLogger.warn('⚠️ Error disposing input handler:', error);
        }
      }
    }

    terminalLogger.info('🧹 TerminalEventManager disposed');
    // Event registry cleanup handled by caller
  }
}
