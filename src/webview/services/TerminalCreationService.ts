/**
 * Terminal Creation Service
 *
 * Extracted from TerminalLifecycleCoordinator to follow Single Responsibility Principle.
 *
 * Responsibilities:
 * - Terminal instance creation with full xterm.js configuration
 * - Terminal removal with proper cleanup
 * - Terminal switching with state management
 * - Link provider registration and management
 * - Resize handling and observer setup
 * - Scrollback auto-save integration
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/split-lifecycle-manager/spec.md
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import { TerminalConfig } from '../../types/shared';
import { TerminalInstance, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { SplitManager } from '../managers/SplitManager';
import { TerminalAddonManager } from '../managers/TerminalAddonManager';
import { TerminalEventManager } from '../managers/TerminalEventManager';
import { TerminalLinkManager } from '../managers/TerminalLinkManager';
import { TerminalContainerFactory, TerminalContainerConfig, TerminalHeaderConfig } from '../factories/TerminalContainerFactory';
import { ResizeManager } from '../utils/ResizeManager';
import { RenderingOptimizer } from '../optimizers/RenderingOptimizer';
import { LifecycleController } from '../controllers/LifecycleController';
import { PerformanceMonitor } from '../../utils/PerformanceOptimizer';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { terminalLogger } from '../utils/ManagerLogger';
import { TerminalHeaderElements } from '../factories/HeaderFactory';

interface Disposable {
  dispose(): void;
}

/**
 * Service responsible for terminal creation, removal, and switching operations
 *
 * Phase 3 Update: Integrated LifecycleController for proper resource management
 */
export class TerminalCreationService implements Disposable {
  private readonly splitManager: SplitManager;
  private readonly coordinator: IManagerCoordinator;
  private readonly eventRegistry: EventHandlerRegistry;
  private readonly addonManager: TerminalAddonManager;
  private readonly eventManager: TerminalEventManager;
  private readonly linkManager: TerminalLinkManager;
  private readonly lifecycleController: LifecycleController;

  // VS Code Standard Terminal Configuration
  private readonly DEFAULT_TERMINAL_CONFIG = {
    // Basic appearance
    cursorBlink: true,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'normal' as const,
    fontWeightBold: 'bold' as const,
    lineHeight: 1.0,
    letterSpacing: 0,
    theme: {
      background: '#000000',
      foreground: '#ffffff',
    },

    // VS Code Standard Options - Core Features
    altClickMovesCursor: true,
    drawBoldTextInBrightColors: false,
    minimumContrastRatio: 1,
    tabStopWidth: 8,
    macOptionIsMeta: false,
    rightClickSelectsWord: true,

    // Scrolling and Navigation
    fastScrollModifier: 'alt' as const,
    fastScrollSensitivity: 5,
    scrollSensitivity: 1,
    scrollback: 2000,
    scrollOnUserInput: true,

    // Word and Selection
    wordSeparator: ' ()[]{}\'"`,;',

    // Rendering Options
    allowTransparency: false,
    rescaleOverlappingGlyphs: false,
    allowProposedApi: true,

    // Cursor Configuration
    cursorStyle: 'block' as const,
    cursorInactiveStyle: 'outline' as const,
    cursorWidth: 1,

    // Terminal Behavior
    convertEol: false,
    disableStdin: false,
    screenReaderMode: false,

    // Bell Configuration
    bellSound: undefined,

    // Advanced Options
    windowOptions: {
      restoreWin: false,
      minimizeWin: false,
      setWinPosition: false,
      setWinSizePixels: false,
      raiseWin: false,
      lowerWin: false,
      refreshWin: false,
      setWinSizeChars: false,
      maximizeWin: false,
      fullscreenWin: false,
    },

    // Addon Configuration
    enableGpuAcceleration: true,
    enableSearchAddon: true,
    enableUnicode11: true,
  };

  constructor(
    splitManager: SplitManager,
    coordinator: IManagerCoordinator,
    eventRegistry: EventHandlerRegistry
  ) {
    this.splitManager = splitManager;
    this.coordinator = coordinator;
    this.eventRegistry = eventRegistry;
    this.addonManager = new TerminalAddonManager();
    this.eventManager = new TerminalEventManager(coordinator, eventRegistry);
    this.linkManager = new TerminalLinkManager(coordinator);
    this.lifecycleController = new LifecycleController(); // Phase 3: Lifecycle management
  }

  /**
   * Create new terminal using centralized utilities
   */
  public async createTerminal(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig,
    terminalNumber?: number
  ): Promise<Terminal | null> {
    const performanceMonitor = PerformanceMonitor.getInstance();
    const maxRetries = 2;
    let currentRetry = 0;

    const attemptCreation = async (): Promise<Terminal | null> => {
      try {
        // Pause all ResizeObservers during terminal creation
        ResizeManager.pauseObservers();
        terminalLogger.info(`⏸️ Paused all ResizeObservers during terminal creation: ${terminalId}`);

        performanceMonitor.startTimer(`terminal-creation-attempt-${terminalId}-${currentRetry}`);
        terminalLogger.info(
          `Creating terminal: ${terminalId} (${terminalName}) - attempt ${currentRetry + 1}/${maxRetries + 1}`
        );

        // Enhanced DOM readiness check with recovery
        const terminalBody = document.getElementById('terminal-body');
        if (!terminalBody) {
          terminalLogger.error('Main terminal container not found');

          // Recovery - Try to create terminal-body if missing
          const mainDiv = document.querySelector('#terminal-view') || document.body;
          if (mainDiv) {
            const newTerminalBody = document.createElement('div');
            newTerminalBody.id = 'terminal-body';
            newTerminalBody.style.cssText = `
              display: flex;
              flex-direction: column;
              width: 100%;
              height: 100%;
              background: #000000;
            `;
            mainDiv.appendChild(newTerminalBody);
            terminalLogger.info('✅ Created missing terminal-body container');
          } else {
            throw new Error('Cannot find parent container for terminal-body');
          }
        }

        // Merge config with defaults
        const terminalConfig = { ...this.DEFAULT_TERMINAL_CONFIG, ...config };

        // Create Terminal instance
        const terminal = new Terminal(terminalConfig as any);
        terminalLogger.info(`✅ Terminal instance created: ${terminalId}`);

        // Load all addons using TerminalAddonManager
      const loadedAddons = await this.addonManager.loadAllAddons(terminal, terminalId, {
        enableGpuAcceleration: terminalConfig.enableGpuAcceleration,
        enableSearchAddon: terminalConfig.enableSearchAddon,
        enableUnicode11: terminalConfig.enableUnicode11,
        linkHandler: (_event, uri) => {
          // Delegate to extension so it can honor workspace trust and external uri handling
          const sent = this.coordinator?.postMessageToExtension({
            command: 'openTerminalLink',
            linkType: 'url',
            url: uri,
            terminalId,
            timestamp: Date.now(),
          });

          if (!sent) {
            // Fallback: attempt to open directly (may be blocked by CSP, but useful for debugging)
            try {
              window.open(uri, '_blank');
            } catch (error) {
              // swallow; extension path is primary
            }
          }
        },
      });

        // Extract individual addons for convenience
        const { fitAddon, serializeAddon, searchAddon } = loadedAddons;

        // Create terminal container using factory with proper config
        const terminalNumberToUse = terminalNumber ?? this.extractTerminalNumber(terminalId);

        const containerConfig: TerminalContainerConfig = {
          id: terminalId,
          name: terminalName,
          className: 'terminal-container',
          isSplit: false,
          isActive: false,
        };

        const headerConfig: TerminalHeaderConfig = {
          showHeader: true,
          showCloseButton: true,
          showSplitButton: true,
          customTitle: terminalName,
          onHeaderClick: (clickedTerminalId) => {
            terminalLogger.info(`🎯 Header clicked for terminal: ${clickedTerminalId}`);
            this.coordinator?.setActiveTerminalId(clickedTerminalId);
          },
          onContainerClick: (clickedTerminalId) => {
            terminalLogger.info(`🎯 Container clicked for terminal: ${clickedTerminalId}`);
            this.coordinator?.setActiveTerminalId(clickedTerminalId);
          },
          onCloseClick: (clickedTerminalId) => {
            terminalLogger.info(`🗑️ Header close button clicked: ${clickedTerminalId}`);
            if (this.coordinator.deleteTerminalSafely) {
              void this.coordinator.deleteTerminalSafely(clickedTerminalId);
            } else {
              this.coordinator.closeTerminal(clickedTerminalId);
            }
          },
          onSplitClick: (_clickedTerminalId) => {
            terminalLogger.info(`⊞ Split button clicked, creating new terminal`);
            void this.coordinator.profileManager?.createTerminalWithDefaultProfile();
          },
          onAiAgentToggleClick: (clickedTerminalId) => {
            terminalLogger.info(`📎 AI Agent toggle clicked for terminal: ${clickedTerminalId}`);
            this.coordinator.handleAiAgentToggle?.(clickedTerminalId);
          },
        };

        const containerElements = TerminalContainerFactory.createContainer(containerConfig, headerConfig);
        if (!containerElements || !containerElements.container || !containerElements.body) {
          throw new Error('Invalid container elements created');
        }

        const container = containerElements.container;
        const terminalContent = containerElements.body;
        terminalLogger.info(`✅ Container created: ${terminalId} with terminal number: ${terminalNumberToUse}`);

        // 🔧 CRITICAL FIX: Append container to DOM BEFORE opening terminal
        // xterm.js needs the element to be in the DOM to render correctly
        const bodyElement = document.getElementById('terminal-body');
        if (bodyElement) {
          bodyElement.appendChild(container);
          terminalLogger.info(`✅ Container appended to DOM: ${terminalId}`);
        } else {
          terminalLogger.error(`❌ terminal-body not found, cannot append container: ${terminalId}`);
          throw new Error('terminal-body element not found');
        }

        // Make container visible
        container.style.display = 'flex';
        container.style.visibility = 'visible';

        // Open terminal in the body div (AFTER container is in DOM)
        terminal.open(terminalContent);
        terminalLogger.info(`✅ Terminal opened in container: ${terminalId}`);

        // Phase 3: Attach terminal to LifecycleController for resource management
        this.lifecycleController.attachTerminal(terminalId, terminal);

        // Setup event handlers for click, focus, keyboard, etc.
        this.eventManager.setupTerminalEvents(terminal, terminalId, container);

        // 🔧 CRITICAL FIX: Ensure terminal receives focus for keyboard input
        // Must wait for xterm.js to fully initialize the textarea
        this.ensureTerminalFocus(terminal, terminalId, terminalContent);

        // 🔧 FIX: Re-focus terminal when container is clicked (VS Code standard)
        container.addEventListener('click', (event) => {
          const target = event.target as HTMLElement;
          // Don't focus if clicking on buttons
          if (!target.closest('.terminal-control')) {
            this.ensureTerminalFocus(terminal, terminalId, terminalContent);
          }
        });

        // Setup shell integration
        this.setupShellIntegration(terminal, terminalId);

        // Register file link handlers using TerminalLinkManager
        this.linkManager.registerTerminalLinkHandlers(terminal, terminalId);

        // Enable VS Code standard scrollbar
        const xtermElement = terminalContent.querySelector('.xterm');
        this.enableScrollbarDisplay(xtermElement, terminalId);

        // Setup RenderingOptimizer for performance optimization
        const renderingOptimizer = await this.setupRenderingOptimizer(
          terminalId,
          terminal,
          fitAddon,
          container,
          terminalConfig.enableGpuAcceleration ?? true
        );

        // Create terminal instance record
        const terminalInstance: TerminalInstance = {
          id: terminalId,
          terminal,
          fitAddon,
          container,
          name: terminalName,
          isActive: false,
          number: terminalNumberToUse,
          searchAddon,
          serializeAddon,
          renderingOptimizer,
        };

        // Register with SplitManager
        this.splitManager.getTerminals().set(terminalId, terminalInstance);
        this.splitManager.getTerminalContainers().set(terminalId, container);
        terminalLogger.info(`✅ Terminal registered with SplitManager: ${terminalId}`);

        // Register container with TerminalContainerManager
        const containerManager = this.coordinator?.getTerminalContainerManager?.();
        if (containerManager) {
          containerManager.registerContainer(terminalId, container);
          terminalLogger.info(`✅ Container registered with TerminalContainerManager: ${terminalId}`);
        }

        // Ensure split layouts are refreshed when new terminals are created during split mode
        if (this.splitManager.getIsSplitMode()) {
          this.splitManager.addNewTerminalToSplit(terminalId, terminalName);
          const displayManager = this.coordinator.getDisplayModeManager?.();
          displayManager?.showAllTerminalsSplit();
        }

        // AI Agent Support: Register header elements with UIManager for status updates
        if (containerElements.headerElements) {
          const uiManager = this.coordinator.getManagers().ui;
          if (this.hasHeaderElementsCache(uiManager)) {
            uiManager.headerElementsCache.set(terminalId, containerElements.headerElements);
            terminalLogger.info(`✅ Header elements registered with UIManager for AI Agent support: ${terminalId}`);
          }
        }

        // Perform initial resize
        this.performInitialResize(terminal, fitAddon, container, terminalId);

        // Setup input handling via InputManager
        if (this.coordinator?.inputManager) {
          this.coordinator.inputManager.addXtermClickHandler(
            terminal,
            terminalId,
            container,
            this.coordinator
          );
          terminalLogger.info(`✅ Input handling setup for terminal: ${terminalId}`);
        } else {
          terminalLogger.error(`❌ InputManager not available for terminal: ${terminalId}`);
        }

        // Setup scrollback auto-save
        this.setupScrollbackAutoSave(terminal, terminalId, serializeAddon);

        const elapsed = performanceMonitor.endTimer(`terminal-creation-attempt-${terminalId}-${currentRetry}`);
        terminalLogger.info(`✅ Terminal creation completed: ${terminalId} in ${elapsed}ms`);

        // Resume ResizeObservers after terminal creation
        setTimeout(() => {
          ResizeManager.resumeObservers();
          terminalLogger.info(`▶️ Resumed all ResizeObservers after terminal creation: ${terminalId}`);
        }, 100);

        return terminal;
      } catch (error) {
        terminalLogger.error(`Failed to create terminal ${terminalId}:`, error);

        // Resume observers even on error
        ResizeManager.resumeObservers();

        if (currentRetry < maxRetries) {
          currentRetry++;
          terminalLogger.info(`Retrying terminal creation: ${terminalId} (${currentRetry}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          return attemptCreation();
        }

        return null;
      }
    };

    return attemptCreation();
  }

  /**
   * Remove terminal with proper cleanup
   */
  public async removeTerminal(terminalId: string): Promise<boolean> {
    try {
      terminalLogger.info(`Removing terminal: ${terminalId}`);

      const terminalInstance = this.splitManager.getTerminals().get(terminalId);
      if (!terminalInstance) {
        terminalLogger.warn(`Terminal not found: ${terminalId}`);
        return false;
      }

      // Cleanup RenderingOptimizer
      if (terminalInstance.renderingOptimizer) {
        terminalInstance.renderingOptimizer.dispose();
        terminalLogger.info(`✅ RenderingOptimizer disposed for: ${terminalId}`);
      }

      // Phase 3: Dispose terminal via LifecycleController for proper resource cleanup
      this.lifecycleController.disposeTerminal(terminalId);

      // Cleanup event handlers
      this.eventManager.removeTerminalEvents(terminalId);

      // Cleanup link providers
      this.linkManager.unregisterTerminalLinkProvider(terminalId);

      // Dispose terminal
      terminalInstance.terminal.dispose();

      // Remove container
      if (terminalInstance.container && terminalInstance.container.parentNode) {
        terminalInstance.container.parentNode.removeChild(terminalInstance.container);
      }

      // Remove from maps
      this.splitManager.getTerminals().delete(terminalId);
      this.splitManager.getTerminalContainers().delete(terminalId);

      // Unregister container from TerminalContainerManager
      const containerManager = this.coordinator?.getTerminalContainerManager?.();
      if (containerManager) {
        containerManager.unregisterContainer(terminalId);
        terminalLogger.info(`✅ Container unregistered from TerminalContainerManager: ${terminalId}`);
      }

      terminalLogger.info(`Terminal removed successfully: ${terminalId}`);
      return true;
    } catch (error) {
      terminalLogger.error(`Failed to remove terminal ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * Switch to terminal with ResizeManager integration
   */
  public async switchToTerminal(
    terminalId: string,
    currentActiveId: string | null,
    onActivate: (id: string) => void
  ): Promise<boolean> {
    try {
      terminalLogger.info(`Switching to terminal: ${terminalId}`);

      const terminalInstance = this.splitManager.getTerminals().get(terminalId);
      if (!terminalInstance) {
        terminalLogger.error(`Terminal not found: ${terminalId}`);
        return false;
      }

      // Deactivate current terminal
      if (currentActiveId) {
        const currentInstance = this.splitManager.getTerminals().get(currentActiveId);
        if (currentInstance) {
          currentInstance.isActive = false;
          currentInstance.container.classList.remove('active');
        }
      }

      // Activate new terminal
      terminalInstance.isActive = true;
      terminalInstance.container.classList.add('active');
      onActivate(terminalId);

      // Debounced resize for smooth transition
      ResizeManager.debounceResize(
        `switch-${terminalId}`,
        async () => {
          try {
            if (terminalInstance.fitAddon) {
              terminalInstance.fitAddon.fit();
              this.notifyExtensionResize(terminalId, terminalInstance.terminal);
            }
          } catch (error) {
            terminalLogger.error(`Switch resize failed for ${terminalId}:`, error);
          }
        },
        { delay: 100 }
      );

      terminalLogger.info(`Switched to terminal successfully: ${terminalId}`);
      return true;
    } catch (error) {
      terminalLogger.error(`Failed to switch to terminal ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * Check if manager has headerElementsCache for AI Agent support
   */
  private hasHeaderElementsCache(
    manager: unknown
  ): manager is { headerElementsCache: Map<string, TerminalHeaderElements> } {
    if (
      typeof manager === 'object' &&
      manager !== null &&
      'headerElementsCache' in manager
    ) {
      const cache = (manager as { headerElementsCache?: unknown }).headerElementsCache;
      return cache instanceof Map;
    }
    return false;
  }

  private enableScrollbarDisplay(xtermElement: Element | null, terminalId: string): void {
    if (!xtermElement) return;

    try {
      const viewport = xtermElement.querySelector('.xterm-viewport') as HTMLElement;
      const screen = xtermElement.querySelector('.xterm-screen') as HTMLElement;

      if (!viewport) {
        terminalLogger.warn(`Viewport not found for terminal ${terminalId}`);
        return;
      }

      // Apply VS Code standard viewport settings for maximum display area
      viewport.style.overflow = 'auto';
      viewport.style.scrollbarWidth = 'auto';
      viewport.style.position = 'absolute';
      viewport.style.top = '0';
      viewport.style.left = '0';
      viewport.style.right = '0';
      viewport.style.bottom = '0';

      // Ensure screen uses full available space
      if (screen) {
        screen.style.position = 'relative';
        screen.style.width = '100%';
        screen.style.height = '100%';
      }

      // Add VS Code standard scrollbar styling (only once)
      if (!document.head.querySelector('#terminal-scrollbar-styles')) {
        const style = document.createElement('style');
        style.id = 'terminal-scrollbar-styles';
        style.textContent = `
          /* VS Code Terminal - Full Display Area Implementation */
          .terminal-container {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: 100% !important;
            position: relative !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .terminal-content {
            flex: 1 1 auto !important;
            width: 100% !important;
            height: 100% !important;
            position: relative !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
          }

          .terminal-container .xterm {
            position: relative !important;
            width: 100% !important;
            height: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }

          .terminal-container .xterm-viewport {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            overflow: auto !important;
            background: transparent !important;
          }

          .terminal-container .xterm-screen {
            position: relative !important;
            width: 100% !important;
            min-height: 100% !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }

          .terminal-container .xterm .xterm-rows {
            padding: 0 !important;
            line-height: 1 !important;
          }

          /* Let xterm manage overlay positioning; overriding can misalign hitboxes */
          .terminal-container .xterm .xterm-link-layer,
          .terminal-container .xterm .xterm-selection-layer,
          .terminal-container .xterm .xterm-decoration-container {
            top: initial !important;
            left: initial !important;
          }

          /* VS Code Standard Scrollbar Styling - 14px width */
          .terminal-container .xterm-viewport::-webkit-scrollbar {
            width: 14px;
            height: 14px;
          }

          .terminal-container .xterm-viewport::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 0px;
          }

          .terminal-container .xterm-viewport::-webkit-scrollbar-thumb {
            background-color: rgba(121, 121, 121, 0.4);
            border-radius: 0px;
            border: 3px solid transparent;
            background-clip: content-box;
            min-height: 20px;
          }

          .terminal-container .xterm-viewport::-webkit-scrollbar-thumb:hover {
            background-color: rgba(100, 100, 100, 0.7);
          }

          .terminal-container .xterm-viewport::-webkit-scrollbar-thumb:active {
            background-color: rgba(68, 68, 68, 0.8);
          }

          .terminal-container .xterm-viewport::-webkit-scrollbar-corner {
            background: transparent;
          }

          /* Firefox scrollbar styling */
          .terminal-container .xterm-viewport {
            scrollbar-width: auto !important;
            scrollbar-color: rgba(121, 121, 121, 0.4) rgba(0, 0, 0, 0.1);
          }

          /* Ensure text selection is visible - do not override pointer events to keep native selection */
          .terminal-container .xterm .xterm-selection div {
            position: absolute;
            background-color: rgba(255, 255, 255, 0.3);
          }

          /* Override any existing height restrictions */
          #terminal-body,
          #terminal-body .terminal-container,
          #terminal-body .terminal-content {
            height: 100% !important;
            max-height: none !important;
          }

        `;
        document.head.appendChild(style);
      }

      terminalLogger.info(`✅ VS Code standard full viewport and scrollbar enabled for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.error(`Failed to enable scrollbar for terminal ${terminalId}:`, error);
    }
  }

  /**
   * Setup shell integration decorations and link providers
   */
  private setupShellIntegration(terminal: Terminal, terminalId: string): void {
    try {
      const shellManager = this.coordinator.shellIntegrationManager;
      if (shellManager) {
        shellManager.decorateTerminalOutput(terminal, terminalId);
        terminalLogger.info(`Shell integration decorations added for terminal: ${terminalId}`);
      }
    } catch (error) {
      terminalLogger.warn(`Failed to setup shell integration for terminal ${terminalId}:`, error);
    }
  }

  /**
   * Perform initial terminal resize
   */
  private performInitialResize(
    terminal: Terminal,
    fitAddon: FitAddon,
    container: HTMLElement,
    terminalId: string
  ): void {
    try {
      const rect = container.getBoundingClientRect();

      if (rect.width > 50 && rect.height > 50) {
        fitAddon.fit();
        terminalLogger.debug(`Terminal initial size: ${terminalId} (${terminal.cols}x${terminal.rows})`);
      } else {
        terminalLogger.warn(
          `Container too small for initial resize: ${terminalId} (${rect.width}x${rect.height})`
        );
      }
    } catch (error) {
      terminalLogger.error(`Failed initial resize for ${terminalId}:`, error);
    }
  }

  /**
   * Setup RenderingOptimizer for terminal performance optimization
   */
  private async setupRenderingOptimizer(
    terminalId: string,
    terminal: Terminal,
    fitAddon: FitAddon,
    container: HTMLElement,
    enableGpuAcceleration: boolean
  ): Promise<any> {
    try {
      // Create RenderingOptimizer instance
      const renderingOptimizer = new RenderingOptimizer({
        enableWebGL: enableGpuAcceleration,
        resizeDebounceMs: 100,
        minWidth: 50,
        minHeight: 50,
      });

      // Setup optimized resize with dimension validation and debouncing
      renderingOptimizer.setupOptimizedResize(terminal, fitAddon, container, terminalId);

      // Enable WebGL rendering if GPU acceleration is enabled
      if (enableGpuAcceleration) {
        await renderingOptimizer.enableWebGL(terminal, terminalId);
      }

      // Setup device-specific smooth scrolling (trackpad vs mouse)
      renderingOptimizer.setupSmoothScrolling(terminal, container, terminalId);

      terminalLogger.info(`✅ RenderingOptimizer setup completed for: ${terminalId}`);
      return renderingOptimizer;
    } catch (error) {
      terminalLogger.error(`Failed to setup RenderingOptimizer for ${terminalId}:`, error);
      return null;
    }
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

      terminalLogger.debug(`Sent resize notification: ${terminalId} (${terminal.cols}x${terminal.rows})`);
    } catch (error) {
      terminalLogger.error(`Failed to notify extension of resize for ${terminalId}:`, error);
    }
  }

  /**
   * Extract terminal number from terminal ID (e.g., "terminal-3" -> 3)
   */
  private extractTerminalNumber(terminalId: string | undefined): number {
    if (!terminalId) {
      return 1;
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

    terminalLogger.warn(`Could not extract terminal number from ID: ${terminalId}, defaulting to 1`);
    return 1;
  }

  /**
   * Ensure terminal receives keyboard focus
   * Critical fix: Properly focus xterm.js textarea for keyboard input
   *
   * Strategy:
   * 1. Wait for xterm.js to fully create the textarea DOM element
   * 2. Verify textarea exists before attempting focus
   * 3. Focus using both terminal.focus() and direct textarea.focus()
   * 4. Verify focus succeeded and log result
   *
   * This fixes the issue where terminal renders but doesn't accept keyboard input.
   */
  private ensureTerminalFocus(
    terminal: Terminal,
    terminalId: string,
    terminalContent: HTMLElement
  ): void {
    // Use requestAnimationFrame to ensure DOM is fully settled
    requestAnimationFrame(() => {
      try {
        // Find the xterm textarea
        const textarea = terminalContent.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;

        if (!textarea) {
          // Retry once after a short delay if textarea doesn't exist yet
          setTimeout(() => {
            const retryTextarea = terminalContent.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
            if (retryTextarea) {
              this.focusTerminalTextarea(terminal, retryTextarea, terminalId);
            } else {
              terminalLogger.error(`❌ xterm-helper-textarea never appeared for: ${terminalId}`);
            }
          }, 50);
          return;
        }

        this.focusTerminalTextarea(terminal, textarea, terminalId);
      } catch (error) {
        terminalLogger.error(`Failed to ensure terminal focus for ${terminalId}:`, error);
      }
    });
  }

  /**
   * Focus the terminal textarea and verify success
   */
  private focusTerminalTextarea(
    terminal: Terminal,
    textarea: HTMLTextAreaElement,
    terminalId: string
  ): void {
    try {
      console.log(`🔍 [FOCUS-DEBUG] Attempting to focus ${terminalId}...`);

      // Focus using xterm.js API (preferred method)
      terminal.focus();
      console.log(`🔍 [FOCUS-DEBUG] Called terminal.focus()`);

      // Double-check with direct textarea focus
      textarea.focus();
      console.log(`🔍 [FOCUS-DEBUG] Called textarea.focus()`);

      // Verify focus succeeded
      setTimeout(() => {
        const hasFocus = document.activeElement === textarea;
        const activeTag = document.activeElement?.tagName;
        const activeClass = document.activeElement?.className;

        console.log(`🔍 [FOCUS-DEBUG] Focus verification for ${terminalId}:`, {
          hasFocus,
          activeElement: `${activeTag}.${activeClass}`,
          textareaInDOM: document.body.contains(textarea),
          textareaVisible: textarea.offsetParent !== null
        });

        if (hasFocus) {
          console.log(`✅ [FOCUS-DEBUG] Terminal focused successfully: ${terminalId}`);
          terminalLogger.info(`✅ Terminal successfully focused and ready for input: ${terminalId}`);

          // 🔍 TEST: Simulate a keystroke to verify input handler
          setTimeout(() => {
            console.log(`🔍 [FOCUS-DEBUG] Testing input by simulating 'a' key...`);
            const event = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' });
            textarea.dispatchEvent(event);
          }, 100);
        } else {
          console.warn(`⚠️ [FOCUS-DEBUG] Focus failed for ${terminalId}`);
          console.warn(`   Active element: ${activeTag}.${activeClass}`);
          terminalLogger.warn(`⚠️ Terminal focus verification failed for: ${terminalId}`);
          terminalLogger.warn(`   Active element: ${activeTag}.${activeClass}`);

          // One final focus attempt
          textarea.focus();
          console.log(`🔍 [FOCUS-DEBUG] Retried textarea.focus()`);
        }
      }, 10);
    } catch (error) {
      console.error(`🔍 [FOCUS-DEBUG] Exception during focus:`, error);
      terminalLogger.error(`Failed to focus terminal textarea for ${terminalId}:`, error);
    }
  }

  /**
   * Setup automatic scrollback save on terminal output (VS Code standard approach)
   */
  private setupScrollbackAutoSave(
    terminal: Terminal,
    terminalId: string,
    serializeAddon: import('@xterm/addon-serialize').SerializeAddon
  ): void {
    let saveTimer: number | null = null;

    const pushScrollbackToExtension = (): void => {
      if (saveTimer) {
        window.clearTimeout(saveTimer);
      }

      saveTimer = window.setTimeout(() => {
        try {
          const serialized = serializeAddon.serialize({ scrollback: 1000 });
          const lines = serialized.split('\n');

          const windowWithApi = window as Window & {
            vscodeApi?: {
              postMessage: (message: unknown) => void;
            };
          };

          const message = {
            command: 'pushScrollbackData',
            terminalId,
            scrollbackData: lines,
            timestamp: Date.now(),
          };

          if (windowWithApi.vscodeApi) {
            windowWithApi.vscodeApi.postMessage(message);
            terminalLogger.info(
              `💾 [AUTO-SAVE] Pushed scrollback via vscodeApi for terminal ${terminalId}: ${lines.length} lines`
            );
          } else {
            if (this.coordinator && typeof this.coordinator.postMessageToExtension === 'function') {
              this.coordinator.postMessageToExtension(message);
              terminalLogger.info(
                `💾 [AUTO-SAVE] Pushed scrollback via MessageManager for terminal ${terminalId}: ${lines.length} lines`
              );
            } else {
              terminalLogger.error(
                `❌ [AUTO-SAVE] No message transport available for terminal ${terminalId}`
              );
            }
          }
        } catch (error) {
          terminalLogger.warn(`⚠️ [AUTO-SAVE] Failed to push scrollback for terminal ${terminalId}:`, error);
        }
      }, 3000);
    };

    // Capture both user input (onData) and process output (onLineFeed) so AI-generated output is saved
    terminal.onData(pushScrollbackToExtension);
    terminal.onLineFeed(pushScrollbackToExtension);
    setTimeout(pushScrollbackToExtension, 2000);

    terminalLogger.info(`✅ [AUTO-SAVE] Scrollback auto-save enabled for terminal: ${terminalId}`);
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    terminalLogger.info('Disposing TerminalCreationService...');

    try {
      // Dispose addon manager
      this.addonManager.dispose();

      // Dispose event manager
      this.eventManager.dispose();

      // Dispose link manager
      this.linkManager.dispose();

      terminalLogger.info('TerminalCreationService disposed');
    } catch (error) {
      terminalLogger.error('Error disposing TerminalCreationService:', error);
    }
  }
}
