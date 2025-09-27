/**
 * Terminal Lifecycle Manager
 *
 * Simplified terminal lifecycle management using centralized utilities
 * Responsibilities: terminal creation, deletion, switching, and state management
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { TerminalConfig } from '../../types/shared';
import { TerminalInstance, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { SplitManager } from './SplitManager';

// New utilities
import { ResizeManager } from '../utils/ResizeManager';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { terminalLogger } from '../utils/ManagerLogger';
import {
  TerminalContainerFactory,
  TerminalContainerConfig,
  TerminalHeaderConfig,
} from '../factories/TerminalContainerFactory';
import { getWebviewTheme } from '../utils/WebviewThemeUtils';
import { ThemeManager } from '../utils/ThemeManager';

/**
 * Simplified terminal lifecycle management using centralized utilities
 * Focus on reliable terminal display and resize handling
 */
import { PerformanceMonitor } from '../../utils/PerformanceOptimizer';

export class TerminalLifecycleManager {
  private splitManager: SplitManager;
  private coordinator: IManagerCoordinator;
  private eventRegistry: EventHandlerRegistry;

  public activeTerminalId: string | null = null;
  public terminal: Terminal | null = null;
  public fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;

  // VS Code Standard Terminal Configuration
  private readonly DEFAULT_TERMINAL_CONFIG = {
    // Basic appearance
    cursorBlink: true,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'normal',
    fontWeightBold: 'bold',
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
    scrollback: 1000,
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
    // bellStyle: 'none' as const, // Removed - not supported by xterm.js

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

  constructor(splitManager: SplitManager, coordinator: IManagerCoordinator) {
    this.splitManager = splitManager;
    this.coordinator = coordinator;
    this.eventRegistry = new EventHandlerRegistry();

    // Initialize ThemeManager for color support
    try {
      ThemeManager.initialize();
    } catch (error) {
      terminalLogger.warn('Failed to initialize ThemeManager:', error);
    }

    terminalLogger.info('TerminalLifecycleManager initialized');
  }

  /**
   * Get active terminal ID
   */
  public getActiveTerminalId(): string | null {
    return this.activeTerminalId;
  }

  /**
   * Set active terminal ID
   */
  public setActiveTerminalId(terminalId: string | null): void {
    this.activeTerminalId = terminalId;
    terminalLogger.info(`Active terminal set to: ${terminalId}`);

    // 🎯 FIX: Only focus if terminal is not already focused
    // Avoid interrupting terminal output or initialization
    if (terminalId) {
      const terminalInstance = this.splitManager.getTerminals().get(terminalId);
      if (terminalInstance && terminalInstance.terminal) {
        // Check if terminal needs focus (avoid redundant focus calls)
        const terminal = terminalInstance.terminal;
        if (!terminal.textarea?.hasAttribute('focused')) {
          // Use setTimeout to avoid interrupting current operations
          setTimeout(() => {
            terminal.focus();
            terminalLogger.info(`🎯 Focused xterm.js terminal: ${terminalId}`);
          }, 10);
        }
      }
    }
  }

  /**
   * Get terminal instance
   */
  public getTerminalInstance(terminalId: string): TerminalInstance | undefined {
    return this.splitManager.getTerminals().get(terminalId);
  }

  /**
   * Get all terminal instances
   */
  public getAllTerminalInstances(): Map<string, TerminalInstance> {
    return this.splitManager.getTerminals();
  }

  /**
   * Get all terminal containers
   */
  public getAllTerminalContainers(): Map<string, HTMLElement> {
    return this.splitManager.getTerminalContainers();
  }

  /**
   * Get terminal element
   */
  public getTerminalElement(terminalId: string): HTMLElement | undefined {
    const terminalInstance = this.splitManager.getTerminals().get(terminalId);
    return terminalInstance?.container;
  }

  /**
   * Create new terminal using centralized utilities
   */
  public async createTerminal(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig,
    terminalNumber?: number // Optional terminal number from Extension
  ): Promise<Terminal | null> {
    // 🚀 PHASE 3: Enhanced error handling with recovery
    const performanceMonitor = PerformanceMonitor.getInstance();
    const maxRetries = 2;
    let currentRetry = 0;

    const attemptCreation = async (): Promise<Terminal | null> => {
      try {
        performanceMonitor.startTimer(`terminal-creation-attempt-${terminalId}-${currentRetry}`);
        terminalLogger.info(
          `Creating terminal: ${terminalId} (${terminalName}) - attempt ${currentRetry + 1}/${maxRetries + 1}`
        );

        // 🚀 PHASE 3: Enhanced DOM readiness check with recovery
        const terminalBody = document.getElementById('terminal-body');
        if (!terminalBody) {
          terminalLogger.error('Main terminal container not found');

          // 🚀 PHASE 3: Recovery - Try to create terminal-body if missing
          const mainDiv = document.querySelector('#terminal-view') || document.body;
          if (mainDiv) {
            const newTerminalBody = document.createElement('div');
            newTerminalBody.id = 'terminal-body';
            newTerminalBody.className = 'terminal-body';
            mainDiv.appendChild(newTerminalBody);
            terminalLogger.info('🔄 Created missing terminal-body element');
          } else {
            throw new Error('Cannot create terminal-body: parent element not found');
          }
        }

        // Merge configuration
        const terminalConfig = { ...this.DEFAULT_TERMINAL_CONFIG, ...config };

        // 🚀 PHASE 3: Enhanced xterm.js creation with validation
        let terminal: Terminal;
        try {
          // Create xterm.js instance with VS Code Standard Configuration
          terminal = new Terminal({
            // Basic appearance
            cursorBlink: terminalConfig.cursorBlink,
            fontFamily: terminalConfig.fontFamily || 'monospace',
            fontSize: terminalConfig.fontSize || 12,
            fontWeight: (terminalConfig.fontWeight || 'normal') as any,
            fontWeightBold: (terminalConfig.fontWeightBold || 'bold') as any,
            lineHeight: terminalConfig.lineHeight || 1.0,
            letterSpacing: terminalConfig.letterSpacing || 0,
            cols: 80,
            rows: 24,

            // VS Code Standard Options
            altClickMovesCursor: terminalConfig.altClickMovesCursor,
            drawBoldTextInBrightColors: terminalConfig.drawBoldTextInBrightColors,
            minimumContrastRatio: terminalConfig.minimumContrastRatio,
            tabStopWidth: terminalConfig.tabStopWidth,
            macOptionIsMeta: terminalConfig.macOptionIsMeta,
            rightClickSelectsWord: terminalConfig.rightClickSelectsWord,

            // Scrolling and Navigation - Enhanced VS Code Configuration
            fastScrollModifier: terminalConfig.fastScrollModifier || 'alt',
            fastScrollSensitivity: terminalConfig.fastScrollSensitivity || 5,
            scrollSensitivity: terminalConfig.scrollSensitivity || 1,
            scrollback: terminalConfig.scrollback || 1000,
            scrollOnUserInput: terminalConfig.scrollOnUserInput !== false, // Default to true

            // Word and Selection
            wordSeparator: terminalConfig.wordSeparator,

            // Rendering Options
            allowTransparency: terminalConfig.allowTransparency,
            allowProposedApi: terminalConfig.allowProposedApi,

            // Cursor Configuration
            cursorStyle: terminalConfig.cursorStyle || 'block',
            cursorInactiveStyle: terminalConfig.cursorInactiveStyle,
            cursorWidth: terminalConfig.cursorWidth || 1,

            // Terminal Behavior
            convertEol: terminalConfig.convertEol,
            disableStdin: terminalConfig.disableStdin,
            screenReaderMode: terminalConfig.screenReaderMode,

            // Advanced Options
            windowOptions: terminalConfig.windowOptions,
          });

          // 🚀 PHASE 3: Validate terminal instance
          if (!terminal || typeof terminal.open !== 'function') {
            throw new Error('Invalid terminal instance created');
          }
        } catch (error) {
          terminalLogger.error(`Failed to create Terminal instance: ${error}`);
          throw new Error(`Terminal instantiation failed: ${error}`);
        }

        // Apply theme using existing getWebviewTheme
        try {
          const themeValue =
            typeof terminalConfig.theme === 'string' ? terminalConfig.theme : undefined;
          const theme = getWebviewTheme({ theme: themeValue });
          terminal.options.theme = theme;
        } catch (error) {
          terminalLogger.warn(`Failed to apply theme, using defaults: ${error}`);
        }

        // 🚀 PHASE 3: Enhanced addon loading with error recovery
        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        const searchAddon = new SearchAddon();

        // Optional high-performance addons
        let webglAddon: WebglAddon | null = null;
        let unicode11Addon: Unicode11Addon | null = null;

        // Load essential addons with error handling
        try {
          terminal.loadAddon(fitAddon);
          terminal.loadAddon(webLinksAddon);
          terminal.loadAddon(searchAddon);
          terminalLogger.info(`✅ Essential addons loaded for terminal ${terminalId}`);
        } catch (error) {
          terminalLogger.error(`❌ Failed to load essential addons: ${error}`);
          throw error; // Essential addons are critical
        }

        // Initialize shell integration after essential addons
        if (this.coordinator?.shellIntegrationManager) {
          try {
            this.coordinator.shellIntegrationManager.initializeTerminalShellIntegration(
              terminal,
              terminalId
            );
            terminalLogger.info(`🐚 Shell integration initialized for terminal ${terminalId}`);
          } catch (error) {
            terminalLogger.warn(
              `⚠️ Shell integration failed to initialize (non-critical): ${error}`
            );
          }
        }

        // Load optional addons with graceful degradation
        if (terminalConfig.enableUnicode11 !== false) {
          try {
            unicode11Addon = new Unicode11Addon();
            terminal.loadAddon(unicode11Addon);
            terminalLogger.info(`✅ Unicode11 addon loaded for terminal ${terminalId}`);
          } catch (error) {
            terminalLogger.warn(`⚠️ Unicode11 addon failed to load (non-critical): ${error}`);
          }
        }

        // GPU acceleration (conditional with fallback)
        if (terminalConfig.enableGpuAcceleration !== false) {
          try {
            webglAddon = new WebglAddon();
            terminal.loadAddon(webglAddon);
            terminalLogger.info(`✅ WebGL addon loaded for terminal ${terminalId}`);
          } catch (error) {
            terminalLogger.warn(`⚠️ WebGL addon failed to load (fallback to canvas): ${error}`);
          }
        }

        // Create container using TerminalContainerFactory
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
          showSplitButton: false, // Split button disabled as requested
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
            // 仕様: ヘッダーのクローズボタンはそのヘッダーのターミナルを削除する
            terminalLogger.info(
              `🗑️ Header close button clicked, using safe deletion: ${clickedTerminalId}`
            );
            if (this.coordinator && 'deleteTerminalSafely' in this.coordinator) {
              void (this.coordinator as any).deleteTerminalSafely(clickedTerminalId);
            } else {
              // Fallback to standard closeTerminal
              void this.coordinator?.closeTerminal(clickedTerminalId);
            }
          },
          onAiAgentToggleClick: (clickedTerminalId) => {
            terminalLogger.info(`📎 AI Agent toggle clicked for terminal: ${clickedTerminalId}`);
            if (this.coordinator && 'handleAiAgentToggle' in this.coordinator) {
              (this.coordinator as any).handleAiAgentToggle(clickedTerminalId);
            }
          },
        };

        // 🚀 PHASE 3: Enhanced container creation with validation
        let containerElements;
        try {
          containerElements = TerminalContainerFactory.createContainer(
            containerConfig,
            headerConfig
          );
          if (!containerElements || !containerElements.container || !containerElements.body) {
            throw new Error('Invalid container elements created');
          }
        } catch (error) {
          terminalLogger.error(`Container creation failed: ${error}`);
          throw error;
        }

        const mainContainer = containerElements.container; // Use the main container
        const terminalContentBody = containerElements.body; // Terminal goes in the body

        // 🚀 PHASE 3: Enhanced terminal opening with validation
        try {
          terminal.open(terminalContentBody);

          // Validate terminal opened successfully
          const xtermElement = terminalContentBody.querySelector('.xterm');
          if (!xtermElement) {
            throw new Error('Terminal did not render properly - no .xterm element found');
          }

          terminalLogger.info(`✅ Terminal opened successfully in container: ${terminalId}`);
        } catch (error) {
          terminalLogger.error(`Terminal opening failed: ${error}`);
          throw error;
        }

        // 🎯 FIX: Add click handler directly to xterm.js terminal element
        // This ensures clicking anywhere in the terminal area activates it
        // 🚀 PHASE 3: Optimized timing - reduced from 100ms to 50ms
        setTimeout(() => {
          const xtermElement = terminalContentBody.querySelector('.xterm');
          if (xtermElement) {
            // 🔧 VS CODE STANDARD: Use click event with hasSelection() check
            // This mirrors VS Code's built-in terminal behavior exactly
            const clickHandler = (_event: Event) => {
              // 🚀 PHASE 3: Optimized timing - reduced from 10ms to 5ms
              setTimeout(() => {
                // Only activate terminal if no text is selected (VS Code standard behavior)
                if (!terminal.hasSelection()) {
                  terminalLogger.info(
                    `🎯 Terminal clicked for activation (no selection): ${terminalId}`
                  );
                  this.coordinator?.setActiveTerminalId(terminalId);

                  // Only focus if not already focused to avoid interrupting output
                  if (!terminal.textarea?.hasAttribute('focused')) {
                    terminal.focus();
                  }
                } else {
                  terminalLogger.debug(
                    `🎯 Click ignored due to text selection in terminal: ${terminalId}`
                  );
                }
              }, 5); // Optimized delay
            };

            xtermElement.addEventListener('click', clickHandler);
            this.eventRegistry.register(
              `terminal-${terminalId}-click`,
              xtermElement,
              'click',
              clickHandler
            );

            terminalLogger.info(
              `✅ VS Code standard mouse handling enabled for terminal: ${terminalId}`
            );
          }

          // Enable VS Code standard scrollbar display
          this.enableScrollbarDisplay(xtermElement, terminalId);
        }, 50); // Optimized delay

        // Make container visible
        mainContainer.style.display = 'flex';
        mainContainer.style.visibility = 'visible';

        // 🚀 PHASE 3: Optimized initial resize timing
        ResizeManager.debounceResize(
          `initial-${terminalId}`,
          () => this.performInitialResize(terminal, fitAddon, mainContainer, terminalId),
          { delay: 50 } // Reduced from 100ms to 50ms
        );

        // Use provided terminal number or extract from ID (terminal-X format)
        const finalTerminalNumber = terminalNumber || this.extractTerminalNumber(terminalId);

        terminalLogger.info(
          `Terminal number: ${finalTerminalNumber} (${terminalNumber ? 'from Extension' : 'extracted from ID'})`
        );

        // Create terminal instance with VS Code Standard Addons
        const terminalInstance: TerminalInstance = {
          id: terminalId,
          name: terminalName,
          number: finalTerminalNumber,
          terminal,
          container: mainContainer,
          fitAddon,
          isActive: false,
          // VS Code Standard Addons - keep as null if not loaded
          searchAddon,
          webglAddon: webglAddon || undefined,
          unicode11Addon: unicode11Addon || undefined,
        };

        // Register terminal
        this.splitManager.getTerminals().set(terminalId, terminalInstance);
        this.splitManager.getTerminalContainers().set(terminalId, mainContainer);

        // 🔧 AI Agent Support: Register header elements with UIManager for status updates
        if (containerElements.headerElements) {
          const uiManager = this.coordinator?.getManagers()?.ui;
          if (uiManager && 'headerElementsCache' in uiManager) {
            // Add header elements to UIManager cache for AI Agent status updates
            (uiManager as any).headerElementsCache.set(
              terminalId,
              containerElements.headerElements
            );
            terminalLogger.info(
              `✅ Header elements registered with UIManager for AI Agent support: ${terminalId}`
            );
          }
        }

        // 🔍 DEBUG: Verify DOM structure and visibility
        const mainTerminalBody = document.getElementById('terminal-body');
        if (mainTerminalBody) {
          terminalLogger.info(
            `✅ terminal-body exists, children count: ${mainTerminalBody.children.length}`
          );
          terminalLogger.info(
            `✅ container added to DOM, display: ${mainContainer.style.display}, visibility: ${mainContainer.style.visibility}`
          );
          terminalLogger.info(
            `✅ container dimensions: ${mainContainer.offsetWidth}x${mainContainer.offsetHeight}`
          );

          // Verify container is actually in DOM
          if (mainTerminalBody.contains(mainContainer)) {
            terminalLogger.info(`✅ container is properly attached to terminal-body`);
          } else {
            terminalLogger.error(`❌ container is NOT in terminal-body DOM tree`);
          }
        } else {
          terminalLogger.error(`❌ terminal-body element not found in DOM`);
        }

        // Setup resize observer using ResizeManager
        this.setupResizeObserver(terminalId, terminalInstance);

        // Set as active if first terminal
        if (!this.activeTerminalId) {
          this.setActiveTerminalId(terminalId);
          this.terminal = terminal;
          this.fitAddon = fitAddon;
          this.terminalContainer = mainContainer;
        }

        // Setup shell integration decorations
        this.setupShellIntegration(terminal, terminalId);

        const creationTime = performanceMonitor.endTimer(
          `terminal-creation-attempt-${terminalId}-${currentRetry}`
        );
        terminalLogger.info(
          `✅ Terminal created successfully: ${terminalId} (${creationTime?.toFixed(2)}ms)`
        );

        // 🎯 CRITICAL FIX: Notify Extension that WebView terminal initialization is complete
        // This ensures shell initialization starts only after xterm is fully ready
        setTimeout(() => {
          if (this.coordinator && 'postMessageToExtension' in this.coordinator) {
            (this.coordinator as any).postMessageToExtension({
              command: 'terminalInitializationComplete',
              terminalId: terminalId,
              timestamp: Date.now(),
            });
            terminalLogger.info(`📡 Terminal initialization completion notified to Extension: ${terminalId}`);
          }
        }, 50); // Small delay to ensure all rendering is complete

        return terminal;
      } catch (error) {
        performanceMonitor.endTimer(`terminal-creation-attempt-${terminalId}-${currentRetry}`);
        terminalLogger.error(
          `❌ Terminal creation attempt ${currentRetry + 1} failed for ${terminalId}:`,
          error
        );

        // 🚀 PHASE 3: Enhanced error recovery logic
        if (currentRetry < maxRetries) {
          currentRetry++;
          terminalLogger.info(
            `🔄 Retrying terminal creation: ${terminalId} (attempt ${currentRetry + 1}/${maxRetries + 1})`
          );

          // Clean up any partial state before retry
          const existingContainer = document.querySelector(`[data-terminal-id="${terminalId}"]`);
          if (existingContainer) {
            existingContainer.remove();
            terminalLogger.info(`🧹 Cleaned up partial container before retry: ${terminalId}`);
          }

          // Brief delay before retry
          await new Promise((resolve) => setTimeout(resolve, 100));
          return attemptCreation();
        }

        // All retries exhausted
        terminalLogger.error(`❌ All retry attempts exhausted for terminal ${terminalId}`);
        throw error;
      }
    };

    return attemptCreation();
  }

  /**
   * Enable VS Code standard scrollbar display
   */
  /**
   * Enable VS Code standard scrollbar display with correct viewport sizing
   */
  /**
   * Enable VS Code standard scrollbar display with full viewport sizing
   */
  private enableScrollbarDisplay(xtermElement: Element | null, terminalId: string): void {
    if (!xtermElement) return;

    try {
      // Find xterm viewport element (where scrollbar should appear)
      const viewport = xtermElement.querySelector('.xterm-viewport') as HTMLElement;
      const screen = xtermElement.querySelector('.xterm-screen') as HTMLElement;

      if (!viewport) {
        terminalLogger.warn(`Viewport not found for terminal ${terminalId}`);
        return;
      }

      // Apply VS Code standard viewport settings for maximum display area
      viewport.style.overflow = 'auto';
      viewport.style.scrollbarWidth = 'auto'; // Standard scrollbar width
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

      // Add VS Code standard scrollbar styling with full display area optimization
      const style = document.createElement('style');
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
          z-index: 30;
          background: transparent !important;
        }
        
        .terminal-container .xterm-screen {
          position: relative !important;
          z-index: 31;
          width: 100% !important;
          min-height: 100% !important;
          padding: 8px !important; /* VS Code standard terminal padding */
          box-sizing: border-box !important;
        }
        
        /* VS Code Standard Scrollbar Styling - 14px width as per VS Code */
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
        
        /* Ensure text selection is visible */
        .terminal-container .xterm .xterm-selection div {
          position: absolute;
          background-color: rgba(255, 255, 255, 0.3);
          pointer-events: none;
        }
        
        /* Override any existing height restrictions */
        #terminal-body,
        #terminal-body .terminal-container,
        #terminal-body .terminal-content {
          height: 100% !important;
          max-height: none !important;
        }
        
        /* Ensure cursor rendering is correct */
        .terminal-container .xterm .xterm-cursor-layer {
          z-index: 32;
        }
      `;

      // Append style if not already added
      if (!document.head.querySelector('#terminal-scrollbar-styles')) {
        style.id = 'terminal-scrollbar-styles';
        document.head.appendChild(style);
      }

      terminalLogger.info(
        `✅ VS Code standard full viewport and scrollbar enabled for terminal: ${terminalId}`
      );
    } catch (error) {
      terminalLogger.error(`Failed to enable scrollbar for terminal ${terminalId}:`, error);
    }
  }

  /**
   * Setup shell integration decorations and link providers
   */
  private setupShellIntegration(terminal: Terminal, terminalId: string): void {
    try {
      // Get shell integration manager from coordinator
      const manager = this.coordinator as any;
      if (manager?.shellIntegrationManager) {
        manager.shellIntegrationManager.decorateTerminalOutput(terminal, terminalId);
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
        // Use FitAddon for initial sizing - it's most reliable
        fitAddon.fit();

        terminalLogger.debug(
          `Terminal initial size: ${terminalId} (${terminal.cols}x${terminal.rows})`
        );

        // Focus the terminal
        terminal.focus();
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
   * Setup resize observer using ResizeManager
   */
  private setupResizeObserver(terminalId: string, terminalInstance: TerminalInstance): void {
    try {
      ResizeManager.observeResize(
        terminalId,
        terminalInstance.container,
        (entry) => {
          const { width, height } = entry.contentRect;
          if (width > 50 && height > 50) {
            this.handleTerminalResize(terminalId, terminalInstance);
          }
        },
        { delay: 100 }
      );

      terminalLogger.debug(`ResizeObserver setup for: ${terminalId}`);
    } catch (error) {
      terminalLogger.error(`Failed to setup ResizeObserver for ${terminalId}:`, error);
    }
  }

  /**
   * Handle terminal resize using ResizeManager
   */
  private handleTerminalResize(terminalId: string, terminalInstance: TerminalInstance): void {
    ResizeManager.debounceResize(
      `resize-${terminalId}`,
      async () => {
        try {
          if (terminalInstance.fitAddon) {
            terminalInstance.fitAddon.fit();
            // Notify extension about new size
            this.notifyExtensionResize(terminalId, terminalInstance.terminal);
          }
        } catch (error) {
          terminalLogger.error(`Resize failed for ${terminalId}:`, error);
        }
      },
      { delay: 100 }
    );
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

      // Cleanup resize observer using ResizeManager
      ResizeManager.unobserveResize(terminalId);
      ResizeManager.clearResize(`resize-${terminalId}`);
      ResizeManager.clearResize(`initial-${terminalId}`);

      // Dispose terminal
      terminalInstance.terminal.dispose();

      // Remove container
      if (terminalInstance.container && terminalInstance.container.parentNode) {
        terminalInstance.container.parentNode.removeChild(terminalInstance.container);
      }

      // Remove from maps
      this.splitManager.getTerminals().delete(terminalId);
      this.splitManager.getTerminalContainers().delete(terminalId);

      // Handle active terminal change
      if (this.activeTerminalId === terminalId) {
        this.activeTerminalId = null;
        this.terminal = null;
        this.fitAddon = null;
        this.terminalContainer = null;

        // Switch to next available terminal
        const remainingTerminals = this.splitManager.getTerminals();
        if (remainingTerminals.size > 0) {
          const nextTerminalId = Array.from(remainingTerminals.keys())[0];
          if (nextTerminalId) {
            await this.switchToTerminal(nextTerminalId);
          }
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
  public async switchToTerminal(terminalId: string): Promise<boolean> {
    try {
      terminalLogger.info(`Switching to terminal: ${terminalId}`);

      const terminalInstance = this.splitManager.getTerminals().get(terminalId);
      if (!terminalInstance) {
        terminalLogger.error(`Terminal not found: ${terminalId}`);
        return false;
      }

      // Deactivate current terminal
      if (this.activeTerminalId) {
        const currentInstance = this.splitManager.getTerminals().get(this.activeTerminalId);
        if (currentInstance) {
          currentInstance.isActive = false;
          currentInstance.container.classList.remove('active');
        }
      }

      // Activate new terminal
      terminalInstance.isActive = true;
      terminalInstance.container.classList.add('active');

      // Update instance variables
      this.setActiveTerminalId(terminalId);
      this.terminal = terminalInstance.terminal;
      this.fitAddon = terminalInstance.fitAddon;
      this.terminalContainer = terminalInstance.container;

      // Make container visible
      terminalInstance.container.style.display = 'flex';
      terminalInstance.container.style.visibility = 'visible';

      // Focus and resize with ResizeManager
      terminalInstance.terminal.focus();

      ResizeManager.debounceResize(
        `switch-${terminalId}`,
        async () => {
          if (terminalInstance.fitAddon) {
            terminalInstance.fitAddon.fit();
          }
        },
        { delay: 50 }
      );

      terminalLogger.info(`Switched to terminal: ${terminalId}`);
      return true;
    } catch (error) {
      terminalLogger.error(`Failed to switch to terminal ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * Write data to terminal
   */
  public writeToTerminal(data: string, terminalId?: string): boolean {
    try {
      const targetId = terminalId || this.activeTerminalId;
      if (!targetId) {
        terminalLogger.error('No terminal to write to');
        return false;
      }

      const terminalInstance = this.splitManager.getTerminals().get(targetId);
      if (!terminalInstance) {
        terminalLogger.error(`Terminal not found: ${targetId}`);
        return false;
      }

      terminalInstance.terminal.write(data);

      // Auto-scroll to bottom to match VS Code standard terminal behavior
      // This ensures users always see the latest output
      terminalInstance.terminal.scrollToBottom();

      return true;
    } catch (error) {
      terminalLogger.error(`Failed to write to terminal:`, error);
      return false;
    }
  }

  /**
   * Initialize terminal body container with theming
   */
  public initializeSimpleTerminal(): void {
    try {
      const container = document.getElementById('terminal-body');
      if (!container) {
        terminalLogger.error('Terminal container not found');
        return;
      }

      terminalLogger.info('Initializing terminal body container');

      // Apply basic theming
      // Note: Simplified approach without complex theme management

      // Get theme colors using ThemeManager
      const themeColors = ThemeManager.getThemeColors();

      container.style.cssText = `
        display: flex;
        flex-direction: column;
        background: ${themeColors.background};
        width: 100%;
        height: 100%;
        min-height: 200px;
        overflow: hidden;
        margin: 0;
        padding: 4px;
        gap: 4px;
        box-sizing: border-box;
        position: relative;
      `;

      container.className = 'terminal-body-container';
      terminalLogger.info('Terminal body container initialized');
    } catch (error) {
      terminalLogger.error('Failed to initialize terminal body container:', error);
    }
  }

  /**
   * Resize all terminals using ResizeManager
   */
  public resizeAllTerminals(): void {
    try {
      const terminals = this.splitManager.getTerminals();
      terminalLogger.info(`Resizing ${terminals.size} terminals`);

      terminals.forEach((terminalInstance, terminalId) => {
        if (terminalInstance.terminal && terminalInstance.fitAddon && terminalInstance.container) {
          // Use ResizeManager for consistent resize behavior
          ResizeManager.debounceResize(
            `resize-all-${terminalId}`,
            async () => {
              try {
                terminalInstance.fitAddon.fit();
                this.notifyExtensionResize(terminalId, terminalInstance.terminal);
              } catch (error) {
                terminalLogger.error(`Failed to resize terminal ${terminalId}:`, error);
              }
            },
            { delay: 50 }
          );
        }
      });
    } catch (error) {
      terminalLogger.error('Failed to resize terminals:', error);
    }
  }

  /**
   * Extract terminal number from terminal ID (e.g., "terminal-3" -> 3)
   */
  private extractTerminalNumber(terminalId: string | undefined): number {
    if (!terminalId) {
      return 1; // Default to 1 if terminalId is undefined
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
   * Get terminal statistics
   */
  public getTerminalStats(): {
    totalTerminals: number;
    activeTerminalId: string | null;
    terminalIds: string[];
  } {
    const terminals = this.splitManager.getTerminals();
    return {
      totalTerminals: terminals.size,
      activeTerminalId: this.activeTerminalId,
      terminalIds: Array.from(terminals.keys()),
    };
  }

  /**
   * Dispose all resources using centralized utilities
   */
  public dispose(): void {
    terminalLogger.info('Disposing TerminalLifecycleManager...');

    try {
      // Clean up all ResizeManager operations
      const terminals = this.splitManager.getTerminals();
      terminals.forEach((_, terminalId) => {
        ResizeManager.unobserveResize(terminalId);
        ResizeManager.clearResize(`resize-${terminalId}`);
        ResizeManager.clearResize(`initial-${terminalId}`);
        ResizeManager.clearResize(`switch-${terminalId}`);
        ResizeManager.clearResize(`resize-all-${terminalId}`);
      });

      // Dispose event registry
      this.eventRegistry.dispose();

      // Remove all terminals
      const terminalKeys = Array.from(terminals.keys());
      terminalKeys.forEach((terminalId) => {
        this.removeTerminal(terminalId);
      });

      // Reset instance variables
      this.activeTerminalId = null;
      this.terminal = null;
      this.fitAddon = null;
      this.terminalContainer = null;

      terminalLogger.info('TerminalLifecycleManager disposed');
    } catch (error) {
      terminalLogger.error('Error disposing TerminalLifecycleManager:', error);
    }
  }
}
