import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { TerminalConfig } from '../../../types/shared';
import {
  IManagerCoordinator,
  IRenderingOptimizer,
  TerminalInstance,
} from '../../interfaces/ManagerInterfaces';
import { LifecycleController } from '../../controllers/LifecycleController';
import {
  TerminalContainerFactory,
  TerminalHeaderElements,
} from '../../factories/TerminalContainerFactory';
import { TerminalEventManager } from '../../managers/TerminalEventManager';
import { TerminalLinkManager } from '../../managers/TerminalLinkManager';
import { SplitManager } from '../../managers/SplitManager';
import { RenderingOptimizer } from '../../optimizers/RenderingOptimizer';
import { DOMUtils } from '../../utils/DOMUtils';
import { terminalLogger } from '../../utils/ManagerLogger';
import { MouseTrackingService } from './MouseTrackingService';
import { TerminalAutoSaveService } from './TerminalAutoSaveService';
import { TerminalScrollbarService } from './TerminalScrollbarService';
import { TerminalScrollIndicatorService } from './TerminalScrollIndicatorService';

interface IUIManager {
  headerElementsCache?: Map<string, TerminalHeaderElements>;
}

export interface IDependencies {
  splitManager: SplitManager;
  coordinator: Pick<
    IManagerCoordinator,
    | 'postMessageToExtension'
    | 'getTerminalContainerManager'
    | 'getDisplayModeManager'
    | 'getActiveTerminalId'
  > & {
    inputManager?: IManagerCoordinator['inputManager'];
  };
  linkManager: TerminalLinkManager;
  scrollbarService: TerminalScrollbarService;
  mouseTrackingService: MouseTrackingService;
  scrollIndicatorService: TerminalScrollIndicatorService;
  autoSaveService: TerminalAutoSaveService;
  lifecycleController: LifecycleController;
  eventManager: TerminalEventManager;
  scrollIndicatorDisposables: Map<string, () => void>;
}

const CssClasses = {
  XTERM: 'xterm',
  XTERM_VIEWPORT: 'xterm-viewport',
} as const;

const RenderingConfig = {
  RESIZE_DEBOUNCE_MS: 100,
  MIN_WIDTH: 50,
  MIN_HEIGHT: 50,
} as const;

const Timings = {
  CREATION_RETRY_DELAY_MS: 500,
  RESIZE_RETRY_DELAYS: [0, 50, 100, 200, 500] as readonly number[],
  POST_RESIZE_DELAY_MS: 300,
  MOUSE_TRACKING_RETRY_DELAY_MS: 50,
} as const;

const Limits = {
  MAX_RESIZE_RETRIES: 5,
  MIN_CONTAINER_DIMENSION: 50,
  MAX_MOUSE_TRACKING_SETUP_ATTEMPTS: 10,
} as const;

export class TerminalLifecycleService {
  constructor(private readonly dependencies: IDependencies) {}

  public async finalizeTerminalSetup(params: {
    terminalId: string;
    terminalName: string;
    terminal: Terminal;
    fitAddon: FitAddon;
    serializeAddon: SerializeAddon;
    searchAddon: SearchAddon | undefined;
    container: HTMLElement;
    terminalContent: HTMLElement;
    containerElements: ReturnType<typeof TerminalContainerFactory.createContainer>;
    terminalNumberToUse: number;
    terminalConfig: { enableGpuAcceleration?: boolean };
    linkModifier: 'alt' | 'ctrlCmd';
    config: TerminalConfig | undefined;
    uiManager: IUIManager | undefined;
  }): Promise<TerminalInstance> {
    const {
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
      uiManager,
    } = params;

    this.dependencies.linkManager.setLinkModifier(linkModifier);
    this.dependencies.linkManager.registerTerminalLinkHandlers(terminal, terminalId);

    const xtermElement = terminalContent.querySelector(`.${CssClasses.XTERM}`);
    this.dependencies.scrollbarService.enableScrollbarDisplay(xtermElement, terminalId);

    this.setupMouseTrackingDelayed(terminal, terminalId, container);

    const scrollIndicatorDispose = this.dependencies.scrollIndicatorService.attach(
      terminal,
      container,
      terminalId
    );
    this.dependencies.scrollIndicatorDisposables.set(terminalId, scrollIndicatorDispose);

    const renderingOptimizer = await this.setupRenderingOptimizer(
      terminalId,
      terminal,
      fitAddon,
      container,
      terminalConfig.enableGpuAcceleration ?? true
    );

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

    this.dependencies.splitManager.getTerminals().set(terminalId, terminalInstance);
    this.dependencies.splitManager.getTerminalContainers().set(terminalId, container);
    terminalLogger.info(`✅ Terminal registered with SplitManager: ${terminalId}`);

    const terminalReadyMessage = { command: 'terminalReady', terminalId, timestamp: Date.now() };
    terminalLogger.info(`📨 [WebView] Sending terminalReady for terminalId: ${terminalId}`);
    this.dependencies.coordinator.postMessageToExtension(terminalReadyMessage);
    terminalLogger.info('✅ [WebView] terminalReady sent successfully');

    const containerManager = this.dependencies.coordinator.getTerminalContainerManager?.();
    if (containerManager) {
      containerManager.registerContainer(terminalId, container);
      terminalLogger.info(`✅ Container registered with TerminalContainerManager: ${terminalId}`);
    }

    const displayModeOverride = (config as { displayModeOverride?: string } | undefined)
      ?.displayModeOverride;
    if (
      this.dependencies.splitManager.getIsSplitMode() &&
      displayModeOverride !== 'normal' &&
      displayModeOverride !== 'fullscreen'
    ) {
      this.dependencies.splitManager.addNewTerminalToSplit(terminalId, terminalName);
      this.dependencies.coordinator.getDisplayModeManager?.()?.showAllTerminalsSplit();
    } else if (
      (displayModeOverride === 'normal' || displayModeOverride === 'fullscreen') &&
      this.dependencies.splitManager.getIsSplitMode()
    ) {
      this.dependencies.splitManager.exitSplitMode();
    }

    if (containerElements.headerElements && this.hasHeaderElementsCache(uiManager)) {
      uiManager.headerElementsCache.set(terminalId, containerElements.headerElements);
      terminalLogger.info(
        `✅ Header elements registered with UIManager for AI Agent support: ${terminalId}`
      );
    }

    this.performInitialResize(terminal, fitAddon, container, terminalId);

    if (this.dependencies.coordinator.inputManager) {
      this.dependencies.coordinator.inputManager.addXtermClickHandler(
        terminal,
        terminalId,
        container,
        this.dependencies.coordinator as IManagerCoordinator
      );
      terminalLogger.info(`✅ Input handling setup for terminal: ${terminalId}`);
    } else {
      terminalLogger.error(`❌ InputManager not available for terminal: ${terminalId}`);
    }

    this.dependencies.autoSaveService.setupScrollbackAutoSave(terminal, terminalId, serializeAddon);

    return terminalInstance;
  }

  public async removeTerminal(terminalId: string): Promise<boolean> {
    try {
      terminalLogger.info(`Removing terminal: ${terminalId}`);

      const terminalInstance = this.dependencies.splitManager.getTerminals().get(terminalId);
      if (!terminalInstance) {
        terminalLogger.warn(`Terminal not found: ${terminalId}`);
        return false;
      }

      terminalInstance.renderingOptimizer?.dispose();
      TerminalAutoSaveService.clearPeriodicSaveTimer(terminalId);

      const disposeScrollIndicator =
        this.dependencies.scrollIndicatorDisposables.get(terminalId);
      if (disposeScrollIndicator) {
        disposeScrollIndicator();
        this.dependencies.scrollIndicatorDisposables.delete(terminalId);
      }

      this.dependencies.mouseTrackingService.cleanup(terminalId);
      this.dependencies.lifecycleController.disposeTerminal(terminalId);
      this.dependencies.eventManager.removeTerminalEvents(terminalId);

      if (this.dependencies.coordinator.inputManager) {
        try {
          this.dependencies.coordinator.inputManager.removeTerminalHandlers?.(terminalId);
          terminalLogger.info(`✅ Input handlers removed via InputManager for: ${terminalId}`);
        } catch (error) {
          terminalLogger.warn(
            `⚠️ Failed to remove InputManager handlers for ${terminalId}`,
            error
          );
        }
      }

      this.dependencies.linkManager.unregisterTerminalLinkProvider(terminalId);
      terminalInstance.terminal.dispose();

      if (terminalInstance.container?.parentNode) {
        terminalInstance.container.parentNode.removeChild(terminalInstance.container);
      }

      this.dependencies.splitManager.getTerminals().delete(terminalId);
      this.dependencies.splitManager.getTerminalContainers().delete(terminalId);

      const containerManager = this.dependencies.coordinator.getTerminalContainerManager?.();
      if (containerManager) {
        containerManager.unregisterContainer(terminalId);
        terminalLogger.info(
          `✅ Container unregistered from TerminalContainerManager: ${terminalId}`
        );

        const remainingTerminals = this.dependencies.splitManager.getTerminals().size;
        const displayManager = this.dependencies.coordinator.getDisplayModeManager?.();
        const currentMode = displayManager?.getCurrentMode?.() ?? 'normal';

        terminalLogger.info(
          `🔧 [CLEANUP] Current mode: ${currentMode}, remaining: ${remainingTerminals}`
        );

        if (remainingTerminals <= 1) {
          containerManager.clearSplitArtifacts();
          terminalLogger.info(
            `✅ Split artifacts cleared (remaining terminals: ${remainingTerminals})`
          );

          if (currentMode === 'split' && displayManager && remainingTerminals === 1) {
            displayManager.setDisplayMode('normal');
            terminalLogger.info('✅ Switched to normal mode after deletion');
          }
        } else if (currentMode === 'split') {
          const orderedIds = Array.from(this.dependencies.splitManager.getTerminals().keys());
          const activeId =
            this.dependencies.coordinator.getActiveTerminalId?.() ?? orderedIds[0] ?? null;
          const currentLocation =
            (this.dependencies.splitManager as {
              getCurrentPanelLocation?: () => 'sidebar' | 'panel';
            }).getCurrentPanelLocation?.() || 'sidebar';
          const splitDirection =
            this.dependencies.splitManager.getOptimalSplitDirection(currentLocation);
          containerManager.applyDisplayState({
            mode: 'split',
            activeTerminalId: activeId,
            orderedTerminalIds: orderedIds,
            splitDirection,
          });
          terminalLogger.info(`✅ Split layout rebuilt with ${remainingTerminals} terminals`);
        } else {
          containerManager.clearSplitArtifacts();
          terminalLogger.info(`✅ Cleared stray split artifacts in ${currentMode} mode`);
        }
      }

      terminalLogger.info(`Terminal removed successfully: ${terminalId}`);
      return true;
    } catch (error) {
      terminalLogger.error(`Failed to remove terminal ${terminalId}:`, error);
      return false;
    }
  }

  private hasHeaderElementsCache(
    manager: unknown
  ): manager is { headerElementsCache: Map<string, TerminalHeaderElements> } {
    if (typeof manager === 'object' && manager !== null && 'headerElementsCache' in manager) {
      return (manager as { headerElementsCache?: unknown }).headerElementsCache instanceof Map;
    }
    return false;
  }

  private performInitialResize(
    terminal: Terminal,
    fitAddon: FitAddon,
    container: HTMLElement,
    terminalId: string
  ): void {
    const maxRetries = Limits.MAX_RESIZE_RETRIES;
    const retryDelays = Timings.RESIZE_RETRY_DELAYS;
    let retryCount = 0;

    const attemptResize = (): void => {
      try {
        const rect = container.getBoundingClientRect();

        if (
          rect.width > Limits.MIN_CONTAINER_DIMENSION &&
          rect.height > Limits.MIN_CONTAINER_DIMENSION
        ) {
          DOMUtils.resetXtermInlineStyles(container);
          fitAddon.fit();

          requestAnimationFrame(() => {
            DOMUtils.resetXtermInlineStyles(container);
            fitAddon.fit();
          });

          terminal.refresh(0, terminal.rows - 1);

          setTimeout(() => {
            try {
              const finalRect = container.getBoundingClientRect();
              if (
                finalRect.width > Limits.MIN_CONTAINER_DIMENSION &&
                finalRect.height > Limits.MIN_CONTAINER_DIMENSION
              ) {
                DOMUtils.resetXtermInlineStyles(container);
                fitAddon.fit();
                terminal.refresh(0, terminal.rows - 1);
                terminalLogger.debug(
                  `Terminal delayed resize: ${terminalId} (${terminal.cols}x${terminal.rows})`
                );
              }
            } catch (error) {
              terminalLogger.warn(`Delayed resize failed for ${terminalId}:`, error);
            }
          }, Timings.POST_RESIZE_DELAY_MS);
        } else if (retryCount < maxRetries) {
          retryCount++;
          const delay = retryDelays[retryCount] || Timings.CREATION_RETRY_DELAY_MS;
          terminalLogger.debug(
            `Container too small, retry ${retryCount}/${maxRetries} in ${delay}ms: ${terminalId} (${rect.width}x${rect.height})`
          );
          setTimeout(attemptResize, delay);
        } else {
          terminalLogger.warn(
            `Container still too small after ${maxRetries} retries: ${terminalId} (${rect.width}x${rect.height})`
          );
          try {
            DOMUtils.resetXtermInlineStyles(container);
            fitAddon.fit();
            terminal.refresh(0, terminal.rows - 1);
            terminalLogger.info(`Forced fit for small container: ${terminalId}`);
          } catch (error) {
            terminalLogger.error(`Forced fit failed for ${terminalId}:`, error);
          }
        }
      } catch (error) {
        terminalLogger.error(`Failed initial resize for ${terminalId}:`, error);
      }
    };

    attemptResize();
  }

  private setupMouseTrackingDelayed(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement
  ): void {
    const maxAttempts = Limits.MAX_MOUSE_TRACKING_SETUP_ATTEMPTS;
    const delayMs = Timings.MOUSE_TRACKING_RETRY_DELAY_MS;
    let attempts = 0;

    const sendInput = (tid: string, data: string): void => {
      this.dependencies.coordinator.postMessageToExtension({
        command: 'input',
        terminalId: tid,
        data,
      });
    };

    const trySetup = (): void => {
      attempts++;
      const viewport = container.querySelector(`.${CssClasses.XTERM_VIEWPORT}`) as HTMLElement;

      if (viewport) {
        this.dependencies.mouseTrackingService.setup(terminal, terminalId, viewport, sendInput);
        terminalLogger.info(
          `[MouseTracking] Setup complete after ${attempts} attempt(s) for: ${terminalId}`
        );
      } else if (attempts < maxAttempts) {
        terminalLogger.debug(
          `[MouseTracking] Viewport not found, retry ${attempts}/${maxAttempts} for: ${terminalId}`
        );
        setTimeout(trySetup, delayMs);
      } else {
        terminalLogger.warn(
          `[MouseTracking] Could not find viewport after ${maxAttempts} attempts for: ${terminalId}`
        );
      }
    };

    requestAnimationFrame(trySetup);
  }

  private async setupRenderingOptimizer(
    terminalId: string,
    terminal: Terminal,
    fitAddon: FitAddon,
    container: HTMLElement,
    enableGpuAcceleration: boolean
  ): Promise<IRenderingOptimizer | null> {
    try {
      const renderingOptimizer = new RenderingOptimizer({
        enableWebGL: enableGpuAcceleration,
        resizeDebounceMs: RenderingConfig.RESIZE_DEBOUNCE_MS,
        minWidth: RenderingConfig.MIN_WIDTH,
        minHeight: RenderingConfig.MIN_HEIGHT,
      });

      renderingOptimizer.setupOptimizedResize(terminal, fitAddon, container, terminalId);

      if (enableGpuAcceleration) {
        await renderingOptimizer.enableWebGL(terminal, terminalId);
      }

      renderingOptimizer.setupSmoothScrolling(terminal, container, terminalId);
      terminalLogger.info(`✅ RenderingOptimizer setup completed for: ${terminalId}`);
      return renderingOptimizer;
    } catch (error) {
      terminalLogger.error(`Failed to setup RenderingOptimizer for ${terminalId}:`, error);
      return null;
    }
  }
}
