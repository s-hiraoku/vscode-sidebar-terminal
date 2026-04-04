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
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';

import { TerminalConfig } from '../../types/shared';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { SplitManager } from '../managers/SplitManager';
import { TerminalAddonManager } from '../managers/TerminalAddonManager';
import { TerminalEventManager } from '../managers/TerminalEventManager';
import { TerminalLinkManager } from '../managers/TerminalLinkManager';
import { ResizeManager } from '../utils/ResizeManager';
import { LifecycleController } from '../controllers/LifecycleController';
import { PerformanceMonitor } from '../../utils/PerformanceOptimizer';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { terminalLogger } from '../utils/ManagerLogger';

// Extracted services
import {
  TerminalAutoSaveService,
  TerminalAppearanceService,
  TerminalDomService,
  TerminalFocusService,
  TerminalInteractionService,
  TerminalLifecycleService,
  MouseTrackingService,
  TerminalScrollbarService,
} from './terminal';
import { TerminalScrollIndicatorService } from './terminal/TerminalScrollIndicatorService';
import { WebViewTerminalConfig } from './terminal/TerminalConfigService';

interface Disposable {
  dispose(): void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * CSS class names for terminal elements
 */
const CssClasses = {
  ACTIVE: 'active',
} as const;

/**
 * Timing constants for terminal operations
 */
const Timings = {
  /** Initial retry delay for terminal creation */
  CREATION_RETRY_DELAY_MS: 500,
} as const;

const RenderingConfig = {
  RESIZE_DEBOUNCE_MS: 100,
} as const;

/**
 * Limits for terminal operations
 */
const Limits = {
  /** Maximum retry attempts for terminal creation */
  MAX_CREATION_RETRIES: 2,
} as const;

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
   * Clear restoration state for a terminal immediately.
   */
  public static clearTerminalRestorationState(terminalId: string): void {
    TerminalAutoSaveService.clearTerminalRestorationState(terminalId);
  }

  /**
   * Clear all restoration state.
   */
  public static clearAllRestorationState(): void {
    TerminalAutoSaveService.clearAllRestorationState();
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
  private readonly addonManager: TerminalAddonManager;
  private readonly autoSaveService: TerminalAutoSaveService;
  private readonly eventManager: TerminalEventManager;
  private readonly linkManager: TerminalLinkManager;
  private readonly mouseTrackingService: MouseTrackingService;
  private readonly scrollIndicatorDisposables: Map<string, () => void> = new Map();
  private readonly appearanceService: TerminalAppearanceService;
  private readonly domService: TerminalDomService;
  private readonly interactionService: TerminalInteractionService;
  private readonly lifecycleService: TerminalLifecycleService;

  constructor(
    splitManager: SplitManager,
    coordinator: IManagerCoordinator,
    eventRegistry: EventHandlerRegistry
  ) {
    this.splitManager = splitManager;
    this.coordinator = coordinator;
    this.addonManager = new TerminalAddonManager();
    this.autoSaveService = new TerminalAutoSaveService(coordinator);

    const lifecycleController = new LifecycleController();
    this.eventManager = new TerminalEventManager(coordinator, eventRegistry);
    this.linkManager = new TerminalLinkManager(coordinator);
    const focusService = new TerminalFocusService();
    const scrollbarService = new TerminalScrollbarService();
    const scrollIndicatorService = new TerminalScrollIndicatorService();
    this.mouseTrackingService = new MouseTrackingService();

    this.appearanceService = new TerminalAppearanceService({
      coordinator: coordinator as any,
    });
    this.domService = new TerminalDomService({ splitManager, coordinator });
    this.interactionService = new TerminalInteractionService({
      coordinator,
      eventRegistry,
      lifecycleController,
      eventManager: this.eventManager,
      focusService,
    });
    this.lifecycleService = new TerminalLifecycleService({
      splitManager,
      coordinator,
      linkManager: this.linkManager,
      scrollbarService,
      mouseTrackingService: this.mouseTrackingService,
      scrollIndicatorService,
      autoSaveService: this.autoSaveService,
      lifecycleController,
      eventManager: this.eventManager,
      scrollIndicatorDisposables: this.scrollIndicatorDisposables,
    });
  }

  /**
   * Create new terminal using centralized utilities.
   *
   * Orchestrates 6 phases:
   * 1. ensureDomReady — DOM readiness check with recovery
   * 2. prepareTerminalConfig — Font, theme, and config merging
   * 3. createTerminalWithAddons — Terminal instance + addon loading
   * 4. createAndInsertContainer — Container factory, header callbacks, DOM insertion
   * 5. setupTerminalInteraction — Open terminal, paste handler, settings, events
   * 6. finalizeTerminalSetup — Links, rendering, registration, resize, notifications
   */
  public async createTerminal(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig,
    terminalNumber?: number
  ): Promise<Terminal | null> {
    const performanceMonitor = PerformanceMonitor.getInstance();
    const maxRetries = Limits.MAX_CREATION_RETRIES;
    let currentRetry = 0;

    const attemptCreation = async (): Promise<Terminal | null> => {
      ResizeManager.pauseObservers();
      terminalLogger.info(`⏸️ Paused all ResizeObservers during terminal creation: ${terminalId}`);

      try {
        performanceMonitor.startTimer(`terminal-creation-attempt-${terminalId}-${currentRetry}`);
        terminalLogger.info(
          `Creating terminal: ${terminalId} (${terminalName}) - attempt ${currentRetry + 1}/${maxRetries + 1}`
        );

        // Cache managers for reuse throughout terminal creation
        const managers = this.coordinator.getManagers?.();
        const configManager = managers?.config;
        const uiManager = managers?.ui;

        // Phase 1: DOM readiness
        this.domService.ensureDomReady();

        // Phase 2: Config preparation
        const { terminalConfig, currentSettings, currentFontSettings, linkModifier } =
          this.appearanceService.prepareTerminalConfig(config, configManager);

        // Phase 3: Terminal + addons
        const { terminal, fitAddon, serializeAddon, searchAddon } =
          await this.createTerminalWithAddons(terminalId, terminalConfig, linkModifier);

        // Phase 4: Container creation & DOM insertion
        const { container, terminalContent, containerElements, terminalNumberToUse } =
          this.domService.createAndInsertContainer({
            terminalId,
            terminalName,
            config,
            terminalNumber,
            currentSettings,
            uiManager,
          });

        // Phase 5: Terminal interaction setup
        this.interactionService.setupTerminalInteraction({
          terminalId,
          terminal,
          container,
          terminalContent,
          currentSettings,
          currentFontSettings,
          configManager,
          uiManager,
          applyPostOpenSettings: (params) =>
            this.appearanceService.applyPostOpenSettings(params as any),
        });

        // Phase 6: Rendering, registration & finalization
        const terminalInstance = await this.lifecycleService.finalizeTerminalSetup({
          terminalId,
          terminalName,
          terminal,
          fitAddon,
          serializeAddon,
          searchAddon,
          container,
          terminalContent,
          containerElements,
          terminalNumberToUse,
          terminalConfig,
          linkModifier,
          config,
          uiManager: uiManager as any,
        });

        const elapsed = performanceMonitor.endTimer(
          `terminal-creation-attempt-${terminalId}-${currentRetry}`
        );
        terminalLogger.info(`✅ Terminal creation completed: ${terminalId} in ${elapsed}ms`);

        // Final refresh after all setup (re-apply theme after WebGL/DOM renderer setup)
        this.appearanceService.schedulePostRendererRefresh({
          terminalId,
          terminal,
          container,
          terminalContent,
          configManager,
          uiManager: uiManager as any,
        });

        return terminalInstance.terminal;
      } catch (error) {
        terminalLogger.error(`Failed to create terminal ${terminalId}:`, error);

        if (currentRetry < maxRetries) {
          currentRetry++;
          terminalLogger.info(
            `Retrying terminal creation: ${terminalId} (${currentRetry}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, Timings.CREATION_RETRY_DELAY_MS));
          return attemptCreation();
        }

        return null;
      } finally {
        ResizeManager.resumeObservers();
        terminalLogger.info(
          `▶️ Resumed all ResizeObservers after terminal creation: ${terminalId}`
        );
      }
    };

    return attemptCreation();
  }

  // ============================================================================
  // Phase 3: Terminal + Addons Creation
  // ============================================================================

  /**
   * Create Terminal instance and load all addons.
   */
  private async createTerminalWithAddons(
    terminalId: string,
    terminalConfig: WebViewTerminalConfig,
    linkModifier: 'alt' | 'ctrlCmd'
  ): Promise<{
    terminal: Terminal;
    fitAddon: FitAddon;
    serializeAddon: SerializeAddon;
    searchAddon: SearchAddon | undefined;
  }> {
    const terminal = new Terminal(terminalConfig);
    terminalLogger.info(`✅ Terminal instance created: ${terminalId}`);

    const loadedAddons = await this.addonManager.loadAllAddons(terminal, terminalId, {
      enableGpuAcceleration: terminalConfig.enableGpuAcceleration,
      enableSearchAddon: terminalConfig.enableSearchAddon,
      enableUnicode11: terminalConfig.enableUnicode11,
      linkModifier,
      linkHandler: (_event, uri) => {
        try {
          this.coordinator?.postMessageToExtension({
            command: 'openTerminalLink',
            linkType: 'url',
            url: uri,
            terminalId,
            timestamp: Date.now(),
          });
        } catch {
          try {
            window.open(uri, '_blank');
          } catch {
            // swallow; extension path is primary
          }
        }
      },
    });

    const { fitAddon, serializeAddon, searchAddon } = loadedAddons;
    return { terminal, fitAddon, serializeAddon, searchAddon };
  }

  public async removeTerminal(terminalId: string): Promise<boolean> {
    return this.lifecycleService.removeTerminal(terminalId);
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
          currentInstance.container.classList.remove(CssClasses.ACTIVE);
        }
      }

      // Activate new terminal
      terminalInstance.isActive = true;
      terminalInstance.container.classList.add(CssClasses.ACTIVE);
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
        { delay: RenderingConfig.RESIZE_DEBOUNCE_MS }
      );

      terminalLogger.info(`Switched to terminal successfully: ${terminalId}`);
      return true;
    } catch (error) {
      terminalLogger.error(`Failed to switch to terminal ${terminalId}:`, error);
      return false;
    }
  }

  private notifyExtensionResize(terminalId: string, terminal: Terminal): void {
    try {
      this.coordinator.postMessageToExtension({
        command: 'resize',
        terminalId,
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

      // Dispose mouse tracking service
      this.mouseTrackingService.dispose();

      terminalLogger.info('TerminalCreationService disposed');
    } catch (error) {
      terminalLogger.error('Error disposing TerminalCreationService:', error);
    }
  }
}
