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

import { Terminal, ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import { TerminalConfig } from '../../types/shared';
import { cleanWrappedLineSelection } from '../utils/SelectionUtils';
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
import { DOMUtils } from '../utils/DOMUtils';
import { getWebviewTheme } from '../utils/WebviewThemeUtils';

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

// ============================================================================
// Constants
// ============================================================================

/**
 * Element IDs used throughout terminal creation
 */
const ElementIds = {
  TERMINAL_BODY: 'terminal-body',
  TERMINAL_VIEW: 'terminal-view',
  TERMINALS_WRAPPER: 'terminals-wrapper',
} as const;

/**
 * CSS class names for terminal elements
 */
const CssClasses = {
  TERMINAL_CONTAINER: 'terminal-container',
  ACTIVE: 'active',
  XTERM: 'xterm',
  XTERM_VIEWPORT: 'xterm-viewport',
} as const;

/**
 * Timing constants for terminal operations
 */
const Timings = {
  /** Delay after renderer setup before final theme re-application */
  POST_RENDERER_SETUP_DELAY_MS: 200,
  /** Initial retry delay for terminal creation */
  CREATION_RETRY_DELAY_MS: 500,
  /** Delay before resuming ResizeObservers after creation */
  RESIZE_OBSERVER_RESUME_DELAY_MS: 100,
  /** Delay for initial focus setup */
  FOCUS_SETUP_DELAY_MS: 50,
  /** Progressive delays for initial resize retries */
  RESIZE_RETRY_DELAYS: [0, 50, 100, 200, 500] as readonly number[],
  /** Delay for post-resize CSS transition handling */
  POST_RESIZE_DELAY_MS: 300,
} as const;

/**
 * Limits for terminal operations
 */
const Limits = {
  /** Maximum retry attempts for terminal creation */
  MAX_CREATION_RETRIES: 2,
  /** Maximum retry attempts for initial resize */
  MAX_RESIZE_RETRIES: 5,
  /** Minimum container dimension for valid resize */
  MIN_CONTAINER_DIMENSION: 50,
  /** Maximum terminal number for ID recycling */
  MAX_TERMINAL_NUMBER: 5,
} as const;

/**
 * Default font settings fallback values
 */
const FontDefaults = {
  FONT_WEIGHT: 'normal',
  FONT_WEIGHT_BOLD: 'bold',
  LINE_HEIGHT: 1,
  LETTER_SPACING: 0,
} as const;

/**
 * CSS color constants
 */
const CssColors = {
  /** Default terminal background color for fallback */
  DEFAULT_BACKGROUND: '#000000',
} as const;

/**
 * Rendering optimizer configuration defaults
 */
const RenderingConfig = {
  RESIZE_DEBOUNCE_MS: 100,
  MIN_WIDTH: Limits.MIN_CONTAINER_DIMENSION,
  MIN_HEIGHT: Limits.MIN_CONTAINER_DIMENSION,
} as const;

// Legacy constant for backward compatibility
const POST_RENDERER_SETUP_DELAY_MS = Timings.POST_RENDERER_SETUP_DELAY_MS;

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
    const maxRetries = Limits.MAX_CREATION_RETRIES;
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
        const terminalBody = document.getElementById(ElementIds.TERMINAL_BODY);
        if (!terminalBody) {
          terminalLogger.error('Main terminal container not found');

          // Recovery - Try to create terminal-body if missing
          const mainDiv = document.querySelector(`#${ElementIds.TERMINAL_VIEW}`) || document.body;
          if (mainDiv) {
            const newTerminalBody = document.createElement('div');
            newTerminalBody.id = ElementIds.TERMINAL_BODY;
            newTerminalBody.style.cssText = `
              display: flex;
              flex-direction: column;
              width: 100%;
              height: 100%;
              background: ${CssColors.DEFAULT_BACKGROUND};
            `;
            mainDiv.appendChild(newTerminalBody);
            terminalLogger.info('✅ Created missing terminal-body container');
          } else {
            throw new Error('Cannot find parent container for terminal-body');
          }
        }

        // Cache managers reference for reuse throughout terminal creation
        // This applies DRY pattern and avoids repeated getManagers?.() calls
        const managers = this.coordinator.getManagers?.();
        const configManager = managers?.config;
        const uiManager = managers?.ui;

        // Prepare font settings using extracted helper method
        const { fontSettings: currentFontSettings, fontOverrides } = this.prepareFontSettings(config, configManager);

        // Resolve current settings with theme (handles ConfigManager vs coordinator race conditions)
        const currentSettings = this.resolveCurrentSettings(configManager);
        const resolvedTheme = getWebviewTheme(currentSettings);
        terminalLogger.info(`🎨 [THEME] Creating terminal with theme: ${currentSettings?.theme} -> bg=${resolvedTheme.background}`);

        // Merge config with defaults using TerminalConfigService
        // Include font settings and theme in the merge to ensure they're applied from the start
        const configWithFonts = {
          ...(config as Parameters<typeof TerminalConfigService.mergeConfig>[0]),
          ...fontOverrides,
          theme: resolvedTheme, // Apply theme at creation time
        };
        const terminalConfig = TerminalConfigService.mergeConfig(configWithFonts);

        // Create Terminal instance
        const terminal = new Terminal(terminalConfig as any);
        terminalLogger.info(`✅ Terminal instance created: ${terminalId}`);

        // Get link modifier from settings (VS Code standard behavior)
        // When multiCursorModifier is 'alt', links open with Cmd/Ctrl+Click
        // When multiCursorModifier is 'ctrlCmd', links open with Alt+Click
        // Note: currentSettings already retrieved above for theme
        const multiCursorModifier = currentSettings?.multiCursorModifier ?? 'alt';
        const linkModifier = multiCursorModifier === 'alt' ? 'alt' : 'ctrlCmd';

        // Load all addons using TerminalAddonManager
        const loadedAddons = await this.addonManager.loadAllAddons(terminal, terminalId, {
          enableGpuAcceleration: terminalConfig.enableGpuAcceleration,
          enableSearchAddon: terminalConfig.enableSearchAddon,
          enableUnicode11: terminalConfig.enableUnicode11,
          linkModifier, // VS Code standard: pass link modifier setting
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

        // 🔧 FIX: Use isActive from config to set initial container styling correctly
        // This prevents Terminal 1 from having different styling on initial display
        const isActiveFromConfig = (config as any)?.isActive ?? false;

        const containerConfig: TerminalContainerConfig = {
          id: terminalId,
          name: terminalName,
          className: CssClasses.TERMINAL_CONTAINER,
          isSplit: false,
          isActive: isActiveFromConfig,
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
        const bodyElement = document.getElementById(ElementIds.TERMINAL_BODY);
        if (!bodyElement) {
          terminalLogger.error(
            `❌ ${ElementIds.TERMINAL_BODY} not found, cannot append container: ${terminalId}`
          );
          throw new Error(`${ElementIds.TERMINAL_BODY} element not found`);
        }

        // 🔧 FIX: Create terminals-wrapper if it doesn't exist (for session restore timing)
        // Note: Styles are defined in display-modes.css to avoid duplication
        let terminalsWrapper = document.getElementById(ElementIds.TERMINALS_WRAPPER);
        if (!terminalsWrapper) {
          terminalLogger.info(`🆕 Creating ${ElementIds.TERMINALS_WRAPPER} (not yet initialized)`);
          terminalsWrapper = document.createElement('div');
          terminalsWrapper.id = ElementIds.TERMINALS_WRAPPER;
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

        // Apply VS Code-like container styling before rendering (non-fatal)
        try {
          if (uiManager) {
            uiManager.applyVSCodeStyling(container);
          }
        } catch (error) {
          terminalLogger.warn('⚠️ Container styling application failed; continuing without styling', error);
        }

        // Make container visible
        container.style.display = 'flex';
        container.style.visibility = 'visible';

        // 🔧 FIX: Apply active border styling BEFORE terminal opens to prevent flicker
        // This ensures Terminal 1 has consistent styling from the start
        if (isActiveFromConfig) {
          try {
            if (uiManager) {
              uiManager.updateSingleTerminalBorder(container, true);
              terminalLogger.info(`✅ Active border applied to container: ${terminalId}`);
            }
          } catch (error) {
            terminalLogger.warn('⚠️ Active border application failed; continuing', error);
          }
        }

        // Open terminal in the body div (AFTER container is in DOM)
        terminal.open(terminalContent);
        terminalLogger.info(`✅ Terminal opened in container: ${terminalId}`);

        // 🎯 CRITICAL: Handle ALL paste events (text AND image)
        // VS Code WebView has clipboard API restrictions, so xterm.js can't read clipboard directly.
        // We intercept paste events to:
        // 1. For IMAGE paste: Send \x16 to trigger Claude Code's native clipboard read
        // 2. For TEXT paste: Read from clipboardData and send to extension for terminal input
        //
        // This works on ALL platforms, not just macOS.

        // Block xterm.js keydown handling for paste shortcuts to prevent double-handling
        terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          // Use userAgentData if available (modern), fallback to userAgent
          const isMac = (navigator as any).userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent);
          // Block Cmd+V on macOS and Ctrl+V on all platforms
          if ((isMac && event.metaKey && event.key === 'v') ||
              (event.ctrlKey && event.key === 'v' && !event.shiftKey)) {
            terminalLogger.info(`📋 Paste keydown - bypassing xterm.js key handler`);
            return false; // Let browser fire paste event, we'll handle it there
          }
          return true;
        });

        // Handle ALL paste events (text AND image)
        const pasteHandler = (event: ClipboardEvent) => {
          const clipboardData = event.clipboardData;
          if (!clipboardData) {
            terminalLogger.warn('📋 Paste event has no clipboardData');
            return;
          }

          const hasImage = Array.from(clipboardData.items).some(item => item.type.startsWith('image/'));

          if (hasImage) {
            // IMAGE paste: Send \x16 to trigger Claude Code's native clipboard read
            terminalLogger.info(`🖼️ Image in paste event - sending Ctrl+V escape for Claude Code`);
            event.preventDefault();
            event.stopImmediatePropagation();
            this.coordinator.postMessageToExtension({
              command: 'input',
              terminalId: terminalId,
              data: '\x16',
            });
            return;
          }

          // TEXT paste: Read from clipboardData and send to extension
          const text = clipboardData.getData('text/plain');
          if (text) {
            terminalLogger.info(`📋 Text paste (${text.length} chars) - sending to extension`);
            event.preventDefault();
            event.stopImmediatePropagation();
            // Send text directly to terminal via extension (bypasses xterm.js clipboard issues)
            this.coordinator.postMessageToExtension({
              command: 'pasteText',
              terminalId: terminalId,
              text: text,
            });
            return;
          }

          terminalLogger.warn('📋 Paste event has no text or image content');
        };

        // Register paste handler for automatic cleanup on terminal disposal
        this.eventRegistry.register(
          `terminal-${terminalId}-paste`,
          terminalContent,
          'paste',
          pasteHandler as EventListener,
          true // capture phase - intercept before xterm.js
        );

        // 🎯 CRITICAL: Handle COPY events to fix wrapped line newlines (xterm.js issue #443)
        // When copying text that spans wrapped lines or shell continuation lines,
        // the selection incorrectly includes newlines. We intercept the copy event
        // and clean the selection to produce proper single-line commands.
        const copyHandler = (event: ClipboardEvent) => {
          if (!terminal.hasSelection()) {
            return; // No selection, let browser handle normally
          }

          const rawSelection = terminal.getSelection();
          if (!rawSelection) {
            return;
          }

          // Clean wrapped line newlines using our utility
          const cleanedSelection = cleanWrappedLineSelection(terminal, rawSelection);

          event.preventDefault();
          event.clipboardData?.setData('text/plain', cleanedSelection);
        };

        // Register copy handler at document level for reliable interception
        document.addEventListener('copy', copyHandler, true);

        // Store reference for cleanup
        const copyCleanup = () => {
          document.removeEventListener('copy', copyHandler, true);
        };

        // Register cleanup handler - use a custom property to track
        (container as any).__copyCleanup = copyCleanup;

        // 🎯 VS Code Pattern: Apply font and visual settings AFTER terminal.open()
        // xterm.js requires the terminal to be attached to DOM before settings can be applied
        // Note: managers/uiManager/configManager already retrieved above
        try {
          if (uiManager) {
            // Use currentSettings already retrieved above, or get fresh copy
            const settingsForVisuals = currentSettings ?? configManager?.getCurrentSettings?.();
            // Use currentFontSettings already retrieved above, or get fresh copy
            const fontSettingsForApply = currentFontSettings ?? configManager?.getCurrentFontSettings?.();

            terminalLogger.info(`🎨 [DEBUG] Immediate settings check - theme: ${settingsForVisuals?.theme}`);

            if (settingsForVisuals) {
              uiManager.applyAllVisualSettings(terminal, settingsForVisuals);
              terminalLogger.info(`✅ Visual settings applied to terminal: ${terminalId}`);

              // 🔧 CRITICAL FIX: Explicitly update container backgrounds immediately
              // This ensures the correct theme is visible right away
              this.updateContainerBackgrounds(terminalId, container, terminalContent, settingsForVisuals);
            }

            if (fontSettingsForApply) {
              uiManager.applyFontSettings(terminal, fontSettingsForApply);
              terminalLogger.info(`✅ Font settings applied to terminal: ${terminalId} (${fontSettingsForApply.fontFamily}, ${fontSettingsForApply.fontSize}px)`);
            }
          }
        } catch (error) {
          terminalLogger.warn('⚠️ Terminal settings application failed; continuing with defaults', error);
        }

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
        // Set link modifier before registering handlers (VS Code standard behavior)
        this.linkManager.setLinkModifier(linkModifier);
        this.linkManager.registerTerminalLinkHandlers(terminal, terminalId);

        // Enable VS Code standard scrollbar using TerminalScrollbarService
        const xtermElement = terminalContent.querySelector(`.${CssClasses.XTERM}`);
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
        if (containerElements.headerElements && uiManager) {
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
        }, Timings.RESIZE_OBSERVER_RESUME_DELAY_MS);

        // 🔧 CRITICAL FIX: Final refresh after all setup is complete
        // This ensures text and cursor display correctly after WebGL/DOM renderer setup
        // Theme must be re-applied after RenderingOptimizer setup to ensure correct colors
        setTimeout(() => {
          try {
            // Use fresh settings to ensure we have the latest theme
            const finalSettings = configManager?.getCurrentSettings?.();

            terminalLogger.info(`🎨 [DEBUG] Final theme check - currentSettings.theme: ${finalSettings?.theme}`);

            if (uiManager && finalSettings) {
              // Re-apply theme to ensure correct colors after WebGL setup
              uiManager.applyTerminalTheme(terminal, finalSettings);
              terminalLogger.info(`🎨 Final theme re-application for terminal: ${terminalId}`);

              // 🔧 CRITICAL FIX: Explicitly update container backgrounds
              // terminal.element may not be available when applyTerminalTheme tries to scope the update
              this.updateContainerBackgrounds(terminalId, container, terminalContent, finalSettings);
            }

            // Force a full terminal refresh
            terminal.refresh(0, terminal.rows - 1);
            terminalLogger.info(`🔄 Final terminal refresh completed: ${terminalId}`);
          } catch (error) {
            terminalLogger.warn(`⚠️ Final refresh failed for terminal ${terminalId}:`, error);
          }
        }, POST_RENDERER_SETUP_DELAY_MS);

        return terminal;
      } catch (error) {
        terminalLogger.error(`Failed to create terminal ${terminalId}:`, error);
        
        // Restore ResizeObservers if they were paused

        if (currentRetry < maxRetries) {
          currentRetry++;
          terminalLogger.info(
            `Retrying terminal creation: ${terminalId} (${currentRetry}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, Timings.CREATION_RETRY_DELAY_MS));
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

      // 🔧 FIX: Clear periodic auto-save timer to prevent memory leaks
      TerminalAutoSaveService.clearPeriodicSaveTimer(terminalId);

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

        // 🔧 FIX: Refresh layout after terminal removal to clean up orphaned resizers
        const remainingTerminals = this.splitManager.getTerminals().size;
        const displayManager = this.coordinator?.getDisplayModeManager?.();
        const currentMode = displayManager?.getCurrentMode?.() ?? 'normal';

        terminalLogger.info(`🔧 [CLEANUP] Current mode: ${currentMode}, remaining: ${remainingTerminals}`);

        if (remainingTerminals <= 1) {
          // If only 1 or 0 terminals remain, clear all split artifacts including resizers
          containerManager.clearSplitArtifacts();
          terminalLogger.info(`✅ Split artifacts cleared (remaining terminals: ${remainingTerminals})`);

          // Switch to normal mode if we're in split mode with 1 terminal
          if (currentMode === 'split' && displayManager && remainingTerminals === 1) {
            displayManager.setDisplayMode('normal');
            terminalLogger.info(`✅ Switched to normal mode after deletion`);
          }
        } else if (currentMode === 'split') {
          // If multiple terminals remain and we're in split mode, rebuild layout
          const orderedIds = Array.from(this.splitManager.getTerminals().keys());
          const activeId = this.coordinator?.getActiveTerminalId?.() ?? orderedIds[0] ?? null;
          const currentLocation =
            (this.splitManager as { getCurrentPanelLocation?: () => 'sidebar' | 'panel' })
              .getCurrentPanelLocation?.() || 'sidebar';
          const splitDirection = this.splitManager.getOptimalSplitDirection(currentLocation);
          containerManager.applyDisplayState({
            mode: 'split',
            activeTerminalId: activeId,
            orderedTerminalIds: orderedIds,
            splitDirection,
          });
          terminalLogger.info(`✅ Split layout rebuilt with ${remainingTerminals} terminals`);
        } else {
          // Normal or fullscreen mode - just clear any stray split artifacts
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
    const maxRetries = Limits.MAX_RESIZE_RETRIES;
    const retryDelays = Timings.RESIZE_RETRY_DELAYS;
    let retryCount = 0;

    const attemptResize = (): void => {
      try {
        const rect = container.getBoundingClientRect();

        if (rect.width > Limits.MIN_CONTAINER_DIMENSION && rect.height > Limits.MIN_CONTAINER_DIMENSION) {
          // 🔧 CRITICAL FIX: Reset xterm inline styles BEFORE fit() to allow width expansion
          DOMUtils.resetXtermInlineStyles(container);
          fitAddon.fit();

          // 🔧 CRITICAL FIX: Call fit() twice with frame wait for correct canvas sizing
          // First fit() updates internal state, second fit() applies correct dimensions
          requestAnimationFrame(() => {
            DOMUtils.resetXtermInlineStyles(container);
            fitAddon.fit();
          });

          // 🔧 FIX: Refresh terminal to ensure cursor and decorations are rendered
          // Do NOT call terminal.clear() as it clears shell prompt output
          terminal.refresh(0, terminal.rows - 1);

          terminalLogger.debug(
            `Terminal initial size: ${terminalId} (${terminal.cols}x${terminal.rows}) after ${retryCount} retries`
          );

          // 🔧 FIX: Schedule an additional resize after a short delay
          // This handles cases where CSS transitions or layout shifts occur after initial render
          setTimeout(() => {
            try {
              const finalRect = container.getBoundingClientRect();
              if (finalRect.width > Limits.MIN_CONTAINER_DIMENSION && finalRect.height > Limits.MIN_CONTAINER_DIMENSION) {
                // 🔧 FIX: Reset xterm inline styles before delayed fit as well
                DOMUtils.resetXtermInlineStyles(container);
                fitAddon.fit();
                // Refresh after delayed fit to ensure cursor visibility
                terminal.refresh(0, terminal.rows - 1);
                terminalLogger.debug(
                  `Terminal delayed resize: ${terminalId} (${terminal.cols}x${terminal.rows})`
                );
              }
            } catch (error) {
              terminalLogger.warn(`Delayed resize failed for ${terminalId}:`, error);
            }
          }, Timings.POST_RESIZE_DELAY_MS);
        } else {
          // Container not ready - retry with increasing delays
          if (retryCount < maxRetries) {
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
            // 🔧 FIX: Force a fit anyway as last resort - xterm.js may handle small dimensions
            try {
              DOMUtils.resetXtermInlineStyles(container);
              fitAddon.fit();
              // Refresh to ensure cursor visibility (do NOT clear)
              terminal.refresh(0, terminal.rows - 1);
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
        resizeDebounceMs: RenderingConfig.RESIZE_DEBOUNCE_MS,
        minWidth: RenderingConfig.MIN_WIDTH,
        minHeight: RenderingConfig.MIN_HEIGHT,
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

    // Find first available number (1-MAX_TERMINAL_NUMBER)
    for (let i = 1; i <= Limits.MAX_TERMINAL_NUMBER; i++) {
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
   * Resolve current settings with theme, handling ConfigManager vs coordinator race conditions.
   *
   * If ConfigManager returns 'auto' theme, also check coordinator's currentSettings.
   * This handles the case where applySettings was called on coordinator but ConfigManager
   * hasn't been updated yet.
   *
   * @param configManager - Optional ConfigManager for settings retrieval
   * @returns Resolved settings object with theme
   */
  private resolveCurrentSettings(
    configManager: { getCurrentSettings?: () => any } | undefined
  ): any {
    let currentSettings = configManager?.getCurrentSettings?.();

    // If ConfigManager returns 'auto' theme, also check coordinator's currentSettings
    if (!currentSettings?.theme || currentSettings.theme === 'auto') {
      const coordinatorSettings = (this.coordinator as any)?.currentSettings;
      if (coordinatorSettings?.theme && coordinatorSettings.theme !== 'auto') {
        currentSettings = { ...currentSettings, ...coordinatorSettings };
        terminalLogger.info(`🎨 [THEME] Using coordinator settings (theme: ${coordinatorSettings.theme})`);
      }
    }

    return currentSettings;
  }

  /**
   * Prepare font settings from config, applying priority resolution and validation.
   *
   * Priority: config direct properties > config.fontSettings > ConfigManager
   * This ensures powerlevel10k icons and other Nerd Font characters display correctly.
   *
   * @param config - Terminal configuration from Extension
   * @param configManager - Optional ConfigManager for fallback settings
   * @returns Validated font overrides for ITerminalOptions
   */
  private prepareFontSettings(
    config: TerminalConfig | undefined,
    configManager: { getCurrentFontSettings?: () => any } | undefined
  ): { fontSettings: any; fontOverrides: Partial<ITerminalOptions> } {
    // Check BOTH config.fontSettings AND direct config properties
    // Extension sends fontFamily/fontSize directly in config, not nested in fontSettings
    const configFontSettings = (config as any)?.fontSettings;
    const directFontFamily = (config as any)?.fontFamily;
    const directFontSize = (config as any)?.fontSize;

    // Use direct config values if available, otherwise fall back to fontSettings or ConfigManager
    let currentFontSettings: any;
    if (directFontFamily || directFontSize) {
      // Extension sent font settings directly in config
      currentFontSettings = {
        fontFamily: directFontFamily || configFontSettings?.fontFamily || configManager?.getCurrentFontSettings?.()?.fontFamily,
        fontSize: directFontSize || configFontSettings?.fontSize || configManager?.getCurrentFontSettings?.()?.fontSize,
        fontWeight: (config as any)?.fontWeight || configFontSettings?.fontWeight || FontDefaults.FONT_WEIGHT,
        fontWeightBold: (config as any)?.fontWeightBold || configFontSettings?.fontWeightBold || FontDefaults.FONT_WEIGHT_BOLD,
        lineHeight: (config as any)?.lineHeight || configFontSettings?.lineHeight || FontDefaults.LINE_HEIGHT,
        letterSpacing: (config as any)?.letterSpacing ?? configFontSettings?.letterSpacing ?? FontDefaults.LETTER_SPACING,
      };
    } else if (configFontSettings) {
      currentFontSettings = configFontSettings;
    } else {
      currentFontSettings = configManager?.getCurrentFontSettings?.();
    }

    // Only apply non-empty font settings to prevent overwriting defaults with empty values
    const fontOverrides: Partial<ITerminalOptions> = {};
    if (currentFontSettings) {
      // Only include fontFamily if it's a non-empty string
      if (typeof currentFontSettings.fontFamily === 'string' && currentFontSettings.fontFamily.trim()) {
        fontOverrides.fontFamily = currentFontSettings.fontFamily.trim();
      }
      // Only include fontSize if it's a positive number
      if (typeof currentFontSettings.fontSize === 'number' && currentFontSettings.fontSize > 0) {
        fontOverrides.fontSize = currentFontSettings.fontSize;
      }
      // Only include fontWeight if it's a non-empty string
      if (typeof currentFontSettings.fontWeight === 'string' && currentFontSettings.fontWeight.trim()) {
        fontOverrides.fontWeight = currentFontSettings.fontWeight.trim() as ITerminalOptions['fontWeight'];
      }
      // Only include fontWeightBold if it's a non-empty string
      if (typeof currentFontSettings.fontWeightBold === 'string' && currentFontSettings.fontWeightBold.trim()) {
        fontOverrides.fontWeightBold = currentFontSettings.fontWeightBold.trim() as ITerminalOptions['fontWeightBold'];
      }
      // Only include lineHeight if it's a positive number
      if (typeof currentFontSettings.lineHeight === 'number' && currentFontSettings.lineHeight > 0) {
        fontOverrides.lineHeight = currentFontSettings.lineHeight;
      }
      // Only include letterSpacing if it's a number (can be 0 or negative)
      if (typeof currentFontSettings.letterSpacing === 'number') {
        fontOverrides.letterSpacing = currentFontSettings.letterSpacing;
      }
      // Cursor settings
      if (currentFontSettings.cursorStyle) {
        fontOverrides.cursorStyle = currentFontSettings.cursorStyle;
      }
      if (typeof currentFontSettings.cursorWidth === 'number' && currentFontSettings.cursorWidth > 0) {
        fontOverrides.cursorWidth = currentFontSettings.cursorWidth;
      }
      // Display settings
      if (typeof currentFontSettings.drawBoldTextInBrightColors === 'boolean') {
        fontOverrides.drawBoldTextInBrightColors = currentFontSettings.drawBoldTextInBrightColors;
      }
      if (typeof currentFontSettings.minimumContrastRatio === 'number') {
        fontOverrides.minimumContrastRatio = currentFontSettings.minimumContrastRatio;
      }
    }

    return { fontSettings: currentFontSettings, fontOverrides };
  }

  /**
   * Update container backgrounds with theme color
   *
   * 🔧 FIX: Extracted from duplicate code in createTerminal() and delayed renderer setup.
   * Explicitly updates container backgrounds since terminal.element may not be available
   * when applyTerminalTheme tries to scope the update.
   *
   * @param terminalId - Terminal identifier for logging
   * @param container - Terminal container element
   * @param terminalContent - Terminal content element
   * @param settings - Settings object containing theme property
   */
  private updateContainerBackgrounds(
    terminalId: string,
    container: HTMLElement | null,
    terminalContent: HTMLElement | null,
    settings: { theme?: string } | null | undefined
  ): void {
    if (!settings) {
      return;
    }

    const resolvedTheme = getWebviewTheme(settings);
    const backgroundColor = resolvedTheme.background;

    if (terminalContent) {
      terminalContent.style.backgroundColor = backgroundColor;
    }
    if (container) {
      const xtermElement = container.querySelector<HTMLElement>(`.${CssClasses.XTERM}`);
      if (xtermElement) {
        xtermElement.style.backgroundColor = backgroundColor;
      }
      const viewport = container.querySelector<HTMLElement>(`.${CssClasses.XTERM_VIEWPORT}`);
      if (viewport) {
        viewport.style.backgroundColor = backgroundColor;
      }
    }
    terminalLogger.info(`🎨 Container backgrounds updated: ${terminalId} (${backgroundColor})`);
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
