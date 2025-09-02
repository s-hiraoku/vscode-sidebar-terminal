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
import { TerminalContainerFactory, TerminalContainerConfig, TerminalHeaderConfig } from '../factories/TerminalContainerFactory';
import { getWebviewTheme } from '../utils/WebviewThemeUtils';
import { ThemeManager } from '../utils/ThemeManager';

/**
 * Simplified terminal lifecycle management using centralized utilities
 * Focus on reliable terminal display and resize handling
 */
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
    try {
      terminalLogger.info(`Creating terminal: ${terminalId} (${terminalName})`);

      // Check DOM readiness
      const terminalBody = document.getElementById('terminal-body');
      if (!terminalBody) {
        terminalLogger.error('Main terminal container not found');
        return null;
      }

      // Merge configuration
      const terminalConfig = { ...this.DEFAULT_TERMINAL_CONFIG, ...config };

      // Create xterm.js instance with VS Code Standard Configuration
      const terminal = new Terminal({
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
        
        // Scrolling and Navigation
        fastScrollModifier: terminalConfig.fastScrollModifier,
        fastScrollSensitivity: terminalConfig.fastScrollSensitivity,
        scrollSensitivity: terminalConfig.scrollSensitivity,
        scrollback: terminalConfig.scrollback || 1000,
        scrollOnUserInput: terminalConfig.scrollOnUserInput,
        
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
        
        // Bell Configuration - bellStyle is not supported by xterm.js ITerminalOptions
        
        // Advanced Options
        windowOptions: terminalConfig.windowOptions,
      });

      // Apply theme using existing getWebviewTheme
      const themeValue = typeof terminalConfig.theme === 'string' ? terminalConfig.theme : undefined;
      const theme = getWebviewTheme({ theme: themeValue });
      terminal.options.theme = theme;

      // Add VS Code Standard Addons
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();
      
      // Optional high-performance addons
      let webglAddon: WebglAddon | null = null;
      let unicode11Addon: Unicode11Addon | null = null;
      
      // Load essential addons
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.loadAddon(searchAddon);
      
      // Load optional addons if supported
      try {
        unicode11Addon = new Unicode11Addon();
        terminal.loadAddon(unicode11Addon);
        terminalLogger.info(`Unicode11 addon loaded for terminal ${terminalId}`);
      } catch (error) {
        terminalLogger.warn(`Unicode11 addon failed to load: ${error}`);
      }
      
      // GPU acceleration (conditional)
      if (terminalConfig.enableGpuAcceleration !== false) {
        try {
          webglAddon = new WebglAddon();
          terminal.loadAddon(webglAddon);
          terminalLogger.info(`WebGL addon loaded for terminal ${terminalId}`);
        } catch (error) {
          terminalLogger.warn(`WebGL addon failed to load: ${error}`);
        }
      }

      // Note: Keyboard input handling (onData) is set up by InputManager.addXtermClickHandler

      // Create container using TerminalContainerFactory
      const containerConfig: TerminalContainerConfig = {
        id: terminalId,
        name: terminalName,
        className: 'terminal-container',
        isSplit: false,
        isActive: false
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true,
        showSplitButton: false,  // Split button disabled as requested
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
          terminalLogger.info(`🗑️ Header close button clicked, using safe deletion: ${clickedTerminalId}`);
          if (this.coordinator && 'deleteTerminalSafely' in this.coordinator) {
            void (this.coordinator as any).deleteTerminalSafely(clickedTerminalId);
          } else {
            // Fallback to standard closeTerminal
            void this.coordinator?.closeTerminal(clickedTerminalId);
          }
        },
        onAiAgentToggleClick: (clickedTerminalId) => {
          terminalLogger.info(`🔌 AI Agent toggle clicked for terminal: ${clickedTerminalId}`);
          if (this.coordinator && 'handleAiAgentToggle' in this.coordinator) {
            (this.coordinator as any).handleAiAgentToggle(clickedTerminalId);
          }
        }
      };

      const containerElements = TerminalContainerFactory.createContainer(containerConfig, headerConfig);
      const mainContainer = containerElements.container; // Use the main container
      const terminalContentBody = containerElements.body; // Terminal goes in the body

      // Open terminal in the body element (this is where xterm.js will render)
      terminal.open(terminalContentBody);

      // 🎯 FIX: Add click handler directly to xterm.js terminal element
      // This ensures clicking anywhere in the terminal area activates it
      // Delay event handler setup to avoid interfering with terminal initialization
      setTimeout(() => {
        const xtermElement = terminalContentBody.querySelector('.xterm');
        if (xtermElement) {
          // 🔧 VS CODE STANDARD: Use click event with hasSelection() check
          // This mirrors VS Code's built-in terminal behavior exactly
          xtermElement.addEventListener('click', (_event: Event) => {
            // Use a small delay to allow xterm.js to process selection first
            setTimeout(() => {
              // Only activate terminal if no text is selected (VS Code standard behavior)
              if (!terminal.hasSelection()) {
                terminalLogger.info(`🎯 Terminal clicked for activation (no selection): ${terminalId}`);
                this.coordinator?.setActiveTerminalId(terminalId);
                
                // Only focus if not already focused to avoid interrupting output
                if (!terminal.textarea?.hasAttribute('focused')) {
                  terminal.focus();
                }
              } else {
                terminalLogger.debug(`🎯 Click ignored due to text selection in terminal: ${terminalId}`);
              }
            }, 10); // Small delay to ensure xterm.js selection state is updated
          });
          
          // Store handler for cleanup
          const clickHandler = (_event: Event) => {
            setTimeout(() => {
              if (!terminal.hasSelection()) {
                this.coordinator?.setActiveTerminalId(terminalId);
                if (!terminal.textarea?.hasAttribute('focused')) {
                  terminal.focus();
                }
              }
            }, 10);
          };
          
          this.eventRegistry.register(`terminal-${terminalId}-click`, xtermElement, 'click', clickHandler);
          
          terminalLogger.info(`✅ VS Code standard mouse handling enabled for terminal: ${terminalId}`);
        }
        
        // 🔧 FIX: Handle terminal focus events for proper state sync
        // These don't interfere with terminal output
        // NOTE: xterm.js doesn't have onFocus/onBlur methods, commenting out
        // terminal.onFocus(() => {
        //   terminalLogger.info(`🔍 Terminal gained focus: ${terminalId}`);
        //   // Update active state when terminal gains focus
        //   if (this.activeTerminalId !== terminalId) {
        //     this.coordinator?.setActiveTerminalId(terminalId);
        //   }
        // });
        
        // terminal.onBlur(() => {
        //   terminalLogger.info(`🔍 Terminal lost focus: ${terminalId}`);
        // });
      }, 100); // Small delay to ensure terminal is fully initialized

      // Make container visible
      mainContainer.style.display = 'flex';
      mainContainer.style.visibility = 'visible';

      // Initial resize with ResizeManager
      ResizeManager.debounceResize(
        `initial-${terminalId}`,
        () => this.performInitialResize(terminal, fitAddon, mainContainer, terminalId),
        { delay: 100 }
      );

      // Use provided terminal number or extract from ID (terminal-X format)
      const finalTerminalNumber = terminalNumber || this.extractTerminalNumber(terminalId);
      
      terminalLogger.info(`Terminal number: ${finalTerminalNumber} (${terminalNumber ? 'from Extension' : 'extracted from ID'})`);
      
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
          (uiManager as any).headerElementsCache.set(terminalId, containerElements.headerElements);
          terminalLogger.info(`✅ Header elements registered with UIManager for AI Agent support: ${terminalId}`);
        }
      }

      // 🔍 DEBUG: Verify DOM structure and visibility
      const mainTerminalBody = document.getElementById('terminal-body');
      if (mainTerminalBody) {
        terminalLogger.info(`✅ terminal-body exists, children count: ${mainTerminalBody.children.length}`);
        terminalLogger.info(`✅ container added to DOM, display: ${mainContainer.style.display}, visibility: ${mainContainer.style.visibility}`);
        terminalLogger.info(`✅ container dimensions: ${mainContainer.offsetWidth}x${mainContainer.offsetHeight}`);
        
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

      terminalLogger.info(`Terminal created successfully: ${terminalId}`);
      return terminal;
    } catch (error) {
      terminalLogger.error(`Failed to create terminal ${terminalId}:`, error);
      return null;
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

        terminalLogger.debug(`Terminal initial size: ${terminalId} (${terminal.cols}x${terminal.rows})`);

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

      terminalLogger.debug(`Sent resize notification: ${terminalId} (${terminal.cols}x${terminal.rows})`);
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
    
    terminalLogger.warn(`Could not extract terminal number from ID: ${terminalId}, defaulting to 1`);
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
