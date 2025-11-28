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
import {
  TerminalContainerFactory,
  TerminalContainerConfig,
  TerminalHeaderConfig,
} from '../factories/TerminalContainerFactory';
import { ResizeManager } from '../utils/ResizeManager';
import { RenderingOptimizer } from '../optimizers/RenderingOptimizer';
import { LifecycleController } from '../controllers/LifecycleController';
import { PerformanceMonitor } from '../../utils/PerformanceOptimizer';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { terminalLogger } from '../utils/ManagerLogger';
import { TerminalHeaderElements } from '../factories/HeaderFactory';

// Extracted services
import {
  TerminalConfigService,
  TerminalFocusService,
  TerminalScrollbarService,
  TerminalAutoSaveService,
} from './terminal';
import { TerminalScrollIndicatorService } from './terminal/TerminalScrollIndicatorService';

interface Disposable {
  dispose(): void;
}

/**
 * Service responsible for terminal creation, removal, and switching operations
 *
 * Phase 3 Update: Integrated LifecycleController for proper resource management
 * Phase 4 Update: Extracted config, focus, scrollbar, and auto-save services
 */
export class TerminalCreationService implements Disposable {
  /**
   * Mark a terminal as currently being restored (blocks auto-save)
   * Delegates to TerminalAutoSaveService
   */
  public static markTerminalRestoring(terminalId: string): void {
    TerminalAutoSaveService.markTerminalRestoring(terminalId);
  }

  /**
   * Mark a terminal as restored (ends protection period after delay)
   * Delegates to TerminalAutoSaveService
   */
  public static markTerminalRestored(terminalId: string): void {
    TerminalAutoSaveService.markTerminalRestored(terminalId);
  }

  /**
   * Check if a terminal is currently being restored
   * Delegates to TerminalAutoSaveService
   */
  public static isTerminalRestoring(terminalId: string): boolean {
    return TerminalAutoSaveService.isTerminalRestoring(terminalId);
  }

  private readonly splitManager: SplitManager;
  private readonly coordinator: IManagerCoordinator;
  private readonly eventRegistry: EventHandlerRegistry;
  private readonly addonManager: TerminalAddonManager;
  private readonly eventManager: TerminalEventManager;
  private readonly linkManager: TerminalLinkManager;
  private readonly lifecycleController: LifecycleController;

  // Extracted services
  private readonly focusService: TerminalFocusService;
  private readonly scrollbarService: TerminalScrollbarService;
  private readonly autoSaveService: TerminalAutoSaveService;
  private readonly scrollIndicatorService: TerminalScrollIndicatorService;
  private readonly scrollIndicatorDisposables: Map<string, () => void> = new Map();

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

    // Phase 4: Initialize extracted services
    this.focusService = new TerminalFocusService();
    this.scrollbarService = new TerminalScrollbarService();
    this.autoSaveService = new TerminalAutoSaveService(coordinator);
    this.scrollIndicatorService = new TerminalScrollIndicatorService();
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
        terminalLogger.info(
          `⏸️ Paused all ResizeObservers during terminal creation: ${terminalId}`
        );

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

        // Merge config with defaults using TerminalConfigService
        // Cast config to WebViewTerminalConfig compatible type
        const terminalConfig = TerminalConfigService.mergeConfig(
          config as Parameters<typeof TerminalConfigService.mergeConfig>[0]
        );

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
            try {
              this.coordinator?.postMessageToExtension({
                command: 'openTerminalLink',
                linkType: 'url',
                url: uri,
                terminalId,
                timestamp: Date.now(),
              });
            } catch {
              // Fallback: attempt to open directly (may be blocked by CSP, but useful for debugging)
              try {
                window.open(uri, '_blank');
              } catch {
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
          showSplitButton: false,
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

        const containerElements = TerminalContainerFactory.createContainer(
          containerConfig,
          headerConfig
        );
        if (!containerElements || !containerElements.container || !containerElements.body) {
          throw new Error('Invalid container elements created');
        }

        const container = containerElements.container;
        const terminalContent = containerElements.body;
        terminalLogger.info(
          `✅ Container created: ${terminalId} with terminal number: ${terminalNumberToUse}`
        );

        // 🔧 CRITICAL FIX: Append container to DOM BEFORE opening terminal
        // xterm.js needs the element to be in the DOM to render correctly
        // 🔧 FIX: Prefer terminals-wrapper over terminal-body for proper layout
        const bodyElement = document.getElementById('terminal-body');
        if (!bodyElement) {
          terminalLogger.error(
            `❌ terminal-body not found, cannot append container: ${terminalId}`
          );
          throw new Error('terminal-body element not found');
        }

        // 🔧 FIX: Create terminals-wrapper if it doesn't exist (for session restore timing)
        // Note: Styles are defined in display-modes.css to avoid duplication
        let terminalsWrapper = document.getElementById('terminals-wrapper');
        if (!terminalsWrapper) {
          terminalLogger.info('🆕 Creating terminals-wrapper (not yet initialized)');
          terminalsWrapper = document.createElement('div');
          terminalsWrapper.id = 'terminals-wrapper';
          // 🔧 CRITICAL: Only set minimal inline styles, let CSS handle the rest
          // This prevents inline styles from overriding CSS rules
          terminalsWrapper.style.cssText = `
            display: flex;
            flex: 1 1 auto;
            gap: 4px;
            padding: 4px;
          `;
          bodyElement.appendChild(terminalsWrapper);
        }

        terminalsWrapper.appendChild(container);
        terminalLogger.info(`✅ Container appended to terminals-wrapper: ${terminalId}`);

        // Apply VS Code-like styling and visual settings before rendering (non-fatal)
        try {
          const managers = this.coordinator.getManagers?.();
          const uiManager = managers?.ui;
          if (uiManager) {
            uiManager.applyVSCodeStyling(container);

            const configManager = managers?.config;
            const currentSettings = configManager?.getCurrentSettings?.();
            const currentFontSettings = configManager?.getCurrentFontSettings?.();

            if (currentSettings) {
              uiManager.applyAllVisualSettings(terminal, currentSettings);
            }

            if (currentFontSettings) {
              uiManager.applyFontSettings(terminal, currentFontSettings);
            }
          }
        } catch (error) {
          terminalLogger.warn('⚠️ Styling application failed; continuing without styling', error);
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

        // CRITICAL FIX: Ensure terminal receives focus for keyboard input
        // Must wait for xterm.js to fully initialize the textarea
        this.focusService.ensureTerminalFocus(terminal, terminalId, terminalContent);

        // FIX: Re-focus terminal when container is clicked (VS Code standard)
        this.focusService.setupContainerFocusHandler(
          terminal,
          terminalId,
          container,
          terminalContent
        );

        // Setup shell integration
        this.setupShellIntegration(terminal, terminalId);

        // Register file link handlers using TerminalLinkManager
        this.linkManager.registerTerminalLinkHandlers(terminal, terminalId);

        // Enable VS Code standard scrollbar using TerminalScrollbarService
        const xtermElement = terminalContent.querySelector('.xterm');
        this.scrollbarService.enableScrollbarDisplay(xtermElement, terminalId);

        // Enable VS Code-style scroll-to-bottom indicator when scrolled away
        const scrollIndicatorDispose = this.scrollIndicatorService.attach(
          terminal,
          container,
          terminalId
        );
        this.scrollIndicatorDisposables.set(terminalId, scrollIndicatorDispose);

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

        // Notify extension that terminal is fully initialized and ready
        const terminalReadyMessage = {
          command: 'terminalReady',
          terminalId,
          timestamp: Date.now(),
        };

        terminalLogger.info(
          `📨 [WebView] Sending terminalReady for terminalId: ${terminalId}`
        );
        terminalLogger.debug('📨 [WebView] Message payload:', terminalReadyMessage);

        this.coordinator.postMessageToExtension(terminalReadyMessage);
        terminalLogger.info('✅ [WebView] terminalReady sent successfully');

        // Register container with TerminalContainerManager
        const containerManager = this.coordinator?.getTerminalContainerManager?.();
        if (containerManager) {
          containerManager.registerContainer(terminalId, container);
          terminalLogger.info(
            `✅ Container registered with TerminalContainerManager: ${terminalId}`
          );
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
            terminalLogger.info(
              `✅ Header elements registered with UIManager for AI Agent support: ${terminalId}`
            );
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

        // Setup scrollback auto-save using TerminalAutoSaveService
        this.autoSaveService.setupScrollbackAutoSave(terminal, terminalId, serializeAddon);

        const elapsed = performanceMonitor.endTimer(
          `terminal-creation-attempt-${terminalId}-${currentRetry}`
        );
        terminalLogger.info(`✅ Terminal creation completed: ${terminalId} in ${elapsed}ms`);

        // Resume ResizeObservers after terminal creation
        setTimeout(() => {
          ResizeManager.resumeObservers();
          terminalLogger.info(
            `▶️ Resumed all ResizeObservers after terminal creation: ${terminalId}`
          );
        }, 100);

        return terminal;
      } catch (error) {
        terminalLogger.error(`Failed to create terminal ${terminalId}:`, error);

        // Resume observers even on error
        ResizeManager.resumeObservers();

        if (currentRetry < maxRetries) {
          currentRetry++;
          terminalLogger.info(
            `Retrying terminal creation: ${terminalId} (${currentRetry}/${maxRetries})`
          );
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

      // Cleanup scroll indicator
      const disposeScrollIndicator = this.scrollIndicatorDisposables.get(terminalId);
      if (disposeScrollIndicator) {
        disposeScrollIndicator();
        this.scrollIndicatorDisposables.delete(terminalId);
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
        terminalLogger.info(
          `✅ Container unregistered from TerminalContainerManager: ${terminalId}`
        );
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
    if (typeof manager === 'object' && manager !== null && 'headerElementsCache' in manager) {
      const cache = (manager as { headerElementsCache?: unknown }).headerElementsCache;
      return cache instanceof Map;
    }
    return false;
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
   * Perform initial terminal resize with retry mechanism
   *
   * 🔧 FIX: Sometimes the container doesn't have valid dimensions during initial resize
   * (e.g., when WebView is in sidebar and being rendered). This retry mechanism
   * ensures the terminal gets properly resized once the container is ready.
   */
  private performInitialResize(
    terminal: Terminal,
    fitAddon: FitAddon,
    container: HTMLElement,
    terminalId: string
  ): void {
    const maxRetries = 5;
    const retryDelays = [0, 50, 100, 200, 500]; // Progressive delays
    let retryCount = 0;

    const attemptResize = (): void => {
      try {
        const rect = container.getBoundingClientRect();

        if (rect.width > 50 && rect.height > 50) {
          // 🔧 CRITICAL FIX: Reset xterm inline styles BEFORE fit() to allow width expansion
          DOMUtils.resetXtermInlineStyles(container);
          fitAddon.fit();
          terminalLogger.debug(
            `Terminal initial size: ${terminalId} (${terminal.cols}x${terminal.rows}) after ${retryCount} retries`
          );

          // 🔧 FIX: Schedule an additional resize after a short delay
          // This handles cases where CSS transitions or layout shifts occur after initial render
          setTimeout(() => {
            try {
              const finalRect = container.getBoundingClientRect();
              if (finalRect.width > 50 && finalRect.height > 50) {
                // 🔧 FIX: Reset xterm inline styles before delayed fit as well
                DOMUtils.resetXtermInlineStyles(container);
                fitAddon.fit();
                terminalLogger.debug(
                  `Terminal delayed resize: ${terminalId} (${terminal.cols}x${terminal.rows})`
                );
              }
            } catch (error) {
              terminalLogger.warn(`Delayed resize failed for ${terminalId}:`, error);
            }
          }, 300);
        } else {
          // Container not ready - retry with increasing delays
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = retryDelays[retryCount] || 500;
            terminalLogger.debug(
              `Container too small, retry ${retryCount}/${maxRetries} in ${delay}ms: ${terminalId} (${rect.width}x${rect.height})`
            );
            setTimeout(attemptResize, delay);
          } else {
            terminalLogger.warn(
              `Container still too small after ${maxRetries} retries: ${terminalId} (${rect.width}x${rect.height})`
            );
            // 🔧 FIX: Force a fit anyway as last resort - xterm.js may handle small dimensions
            try {
              DOMUtils.resetXtermInlineStyles(container);
              fitAddon.fit();
              terminalLogger.info(`Forced fit for small container: ${terminalId}`);
            } catch (e) {
              terminalLogger.error(`Forced fit failed for ${terminalId}:`, e);
            }
          }
        }
      } catch (error) {
        terminalLogger.error(`Failed initial resize for ${terminalId}:`, error);
      }
    };

    attemptResize();
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

      terminalLogger.debug(
        `Sent resize notification: ${terminalId} (${terminal.cols}x${terminal.rows})`
      );
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

    terminalLogger.warn(
      `Could not extract terminal number from ID: ${terminalId}, defaulting to 1`
    );
    return 1;
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
