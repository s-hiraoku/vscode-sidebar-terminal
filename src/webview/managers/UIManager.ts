/**
 * UI Manager - Handles visual feedback, theming, borders, and terminal appearance
 *
 * Phase 4 Update: Extracted services for better maintainability
 * - NotificationService: Notification display and CSS animations
 * - TerminalBorderService: Terminal border styling and highlighting
 * - CliAgentStatusService: CLI Agent status display
 */

import { Terminal } from '@xterm/xterm';
import { PartialTerminalSettings, WebViewFontSettings, ActiveBorderMode } from '../../types/shared';
import { getWebviewTheme, WEBVIEW_THEME_CONSTANTS, TerminalTheme } from '../utils/WebviewThemeUtils';
import { IUIManager } from '../interfaces/ManagerInterfaces';
import { TerminalHeaderElements } from '../factories/HeaderFactory';
import { DOMUtils } from '../utils/DOMUtils';
import { BaseManager } from './BaseManager';
import { uiLogger } from '../utils/ManagerLogger';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { ResizeManager } from '../utils/ResizeManager';
import { webview as log } from '../../utils/logger';

// Extracted services
import {
  NotificationService,
  NotificationConfig,
  TerminalBorderService,
  CliAgentStatusService,
  HeaderService,
  LoadingIndicatorService,
} from './ui';

export { NotificationConfig };

// ============================================================================
// Constants (simplified - service-specific constants are in their services)
// ============================================================================

/** Element IDs used in UIManager */
const ElementIds = {
  TERMINAL_CONTAINER: 'terminal-container',
  TERMINAL_BODY: 'terminal-body',
  WEBVIEW_HEADER: 'webview-header',
} as const;

/** CSS class names used in UIManager */
const CssClasses = {
  // Terminal structure
  TERMINAL_HEADER: 'terminal-header',
  TERMINAL_STATUS: 'terminal-status',
  TERMINAL_CONTROLS: 'terminal-controls',
  TERMINAL_CONTENT: 'terminal-content',
  TERMINAL_CONTAINER: 'terminal-container',
  // Focus & Status
  FOCUSED: 'focused',
  CLAUDE_STATUS: 'claude-status',
  CLOSE_BTN: 'close-btn',
  // xterm
  XTERM: 'xterm',
  XTERM_VIEWPORT: 'xterm-viewport',
  // Split
  SPLIT_SEPARATOR: 'split-separator',
} as const;

/** UI timing constants (in milliseconds) */
const Timing = {
  FOCUS_INDICATOR_DURATION: 300,
} as const;

/** UI dimension constants */
const Dimensions = {
  SEPARATOR_SIZE: '4px',
} as const;

/** Theme-related constants */
const ThemeColors = {
  LIGHT_FOREGROUND: '#000000',
  CLI_AGENT_STATUS_COLOR: '#007ACC',
  CLI_AGENT_STATUS_FONT_SIZE: '11px',
  CLI_AGENT_STATUS_MARGIN: '10px',
} as const;

/** Focus indicator styles */
const FocusStyles = {
  BOX_SHADOW: '0 0 8px rgba(0, 122, 255, 0.5)',
  TRANSITION: 'box-shadow 0.2s ease',
} as const;

export class UIManager extends BaseManager implements IUIManager {
  // Theme cache for performance
  private currentTheme: string | null = null;
  private themeApplied = false;
  private readonly themeCache = new WeakMap<Terminal, string | null>();

  // Prevent rapid successive updates that could cause duplication
  private readonly UPDATE_DEBOUNCE_MS = 100;

  // Event registry for proper cleanup
  protected eventRegistry: EventHandlerRegistry;

  // 🔧 FIX: Track ResizeObserver keys for proper individual cleanup
  private resizeObserverKeys: Set<string> = new Set();

  // Extracted services
  private readonly notificationService: NotificationService;
  private readonly borderService: TerminalBorderService;
  private readonly cliAgentService: CliAgentStatusService;
  private readonly headerService: HeaderService;
  private readonly loadingIndicatorService: LoadingIndicatorService;

  /**
   * Header elements cache for efficient CLI Agent status updates
   * Public getter for backward compatibility with TerminalCreationService
   */
  public get headerElementsCache(): Map<string, TerminalHeaderElements> {
    return this.headerService.getHeaderElementsCache();
  }

  // Callback for tab theme updates (set by coordinator)
  private tabThemeUpdater: ((theme: TerminalTheme) => void) | null = null;

  constructor() {
    super('UIManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    // Initialize event registry
    this.eventRegistry = new EventHandlerRegistry();

    // Initialize extracted services
    this.notificationService = new NotificationService();
    this.borderService = new TerminalBorderService();
    this.cliAgentService = new CliAgentStatusService();
    this.headerService = new HeaderService();
    this.loadingIndicatorService = new LoadingIndicatorService();
  }

  /**
   * Initialize the UIManager (BaseManager abstract method implementation)
   */
  protected doInitialize(): void {
    this.logger('🚀 UIManager initialized');
  }

  /**
   * Dispose UIManager resources (BaseManager abstract method implementation)
   */
  protected doDispose(): void {
    this.logger('🧹 Disposing UIManager resources');

    // Clear caches
    this.currentTheme = null;
    this.themeApplied = false;
    this.headerService.clearHeaderCache();
    this.tabThemeUpdater = null;

    // 🔧 FIX: Clear resize observer keys tracking
    this.resizeObserverKeys.clear();

    this.logger('✅ UIManager resources disposed');
  }

  /**
   * Set callback for tab theme updates
   * Called by coordinator to connect UIManager with TerminalTabManager
   */
  public setTabThemeUpdater(updater: (theme: TerminalTheme) => void): void {
    this.tabThemeUpdater = updater;
    uiLogger.info('Tab theme updater registered');
  }

  /**
   * Update theme for all UI components
   * Called when VS Code theme changes and settings.theme is 'auto'
   */
  public updateTheme(theme: TerminalTheme): void {
    log(`🎨 [UI] Updating UI theme`);

    // Update cached theme
    this.currentTheme = theme.background;
    this.themeApplied = true;

    // Update tab list theme
    if (this.tabThemeUpdater) {
      this.tabThemeUpdater(theme);
      log(`🎨 [UI] Tab theme updated`);
    }

    // Update terminal borders with new theme colors
    this.borderService.updateThemeColors(theme);
    log(`🎨 [UI] Border colors updated`);

    // Update header background colors using VS Code CSS variables
    this.updateAllHeaderThemes();
    log(`🎨 [UI] Header themes updated`);
  }

  /**
   * Update all header elements with VS Code theme colors
   */
  private updateAllHeaderThemes(): void {
    const style = getComputedStyle(document.documentElement);

    // Get header colors from VS Code CSS variables
    const headerBg = style.getPropertyValue('--vscode-sideBarSectionHeader-background').trim()
      || style.getPropertyValue('--vscode-editor-background').trim()
      || '';
    const headerFg = style.getPropertyValue('--vscode-sideBarSectionHeader-foreground').trim()
      || style.getPropertyValue('--vscode-editor-foreground').trim()
      || '';

    log(`🎨 [UI] Header theme colors: bg=${headerBg}, fg=${headerFg}`);

    // Delegate to HeaderService for cache and DOM updates
    this.headerService.updateHeadersFromCssVariables(headerBg, headerFg);

    // Also update the main webview header
    const webviewHeader = document.getElementById(ElementIds.WEBVIEW_HEADER);
    if (webviewHeader) {
      if (headerBg) {
        webviewHeader.style.backgroundColor = headerBg;
      }
      if (headerFg) {
        webviewHeader.style.color = headerFg;
      }
    }

    log(`🎨 [UI] Header themes updated`);
  }

  /**
   * Update borders for all terminals based on active state
   * Delegates to TerminalBorderService
   */
  public updateTerminalBorders(
    activeTerminalId: string,
    allContainers: Map<string, HTMLElement>
  ): void {
    // Auto-update terminal count for "only when multiple" border logic
    this.borderService.setTerminalCount(allContainers.size);
    this.borderService.updateTerminalBorders(activeTerminalId, allContainers);
  }

  /**
   * Update borders specifically for split terminals
   * Delegates to TerminalBorderService
   */
  public updateSplitTerminalBorders(activeTerminalId: string): void {
    this.borderService.updateSplitTerminalBorders(activeTerminalId);
  }

  /**
   * Set the active border display mode
   * Delegates to TerminalBorderService
   */
  public setActiveBorderMode(mode: ActiveBorderMode): void {
    this.borderService.setActiveBorderMode(mode);
  }

  /**
   * Update terminal count (used for "multipleOnly" border mode)
   * Delegates to TerminalBorderService
   */
  public setTerminalCount(count: number): void {
    this.borderService.setTerminalCount(count);
  }

  /**
   * Set fullscreen mode state (used for "multipleOnly" border mode)
   * When in fullscreen, multipleOnly mode will hide the active border
   * Delegates to TerminalBorderService
   */
  public setFullscreenMode(isFullscreen: boolean): void {
    this.borderService.setFullscreenMode(isFullscreen);
  }

  /**
   * Update border for a single terminal container
   * Delegates to TerminalBorderService
   * Used to apply initial active styling during terminal creation
   */
  public updateSingleTerminalBorder(container: HTMLElement, isActive: boolean): void {
    this.borderService.updateSingleTerminalBorder(container, isActive);
  }

  /**
   * Show terminal placeholder when no terminals exist
   * Delegates to LoadingIndicatorService
   */
  public showTerminalPlaceholder(): void {
    this.loadingIndicatorService.showTerminalPlaceholder();
  }

  /**
   * Hide terminal placeholder when terminals exist
   * Delegates to LoadingIndicatorService
   */
  public hideTerminalPlaceholder(): void {
    this.loadingIndicatorService.hideTerminalPlaceholder();
  }

  /**
   * Apply theme to a terminal based on current settings
   */
  public applyTerminalTheme(terminal: Terminal, settings: PartialTerminalSettings): void {
    const theme = getWebviewTheme(settings);

    // Always apply theme (removed caching that could cause issues)
    terminal.options.theme = theme;
    this.currentTheme = theme.background || null;
    this.themeApplied = true;
    uiLogger.info(`🎨 [THEME] Applied theme to terminal: bg=${theme.background}, fg=${theme.foreground}`);

    // Force terminal to redraw with new theme colors
    // This is necessary for xterm.js to update the rendered text and cursor
    terminal.refresh(0, terminal.rows - 1);

    // Only update this specific terminal's container backgrounds
    // Previously this updated ALL terminals, causing theme bleed when creating new terminals
    this.updateContainerBackgrounds(theme.background, terminal);

    // Update headers to match terminal theme (PR #317 follow-up)
    this.updateHeaderTheme(theme);
  }

  /**
   * Update all terminal headers to match the terminal theme
   * Ensures header colors are consistent with secondaryTerminal.theme setting
   */
  private updateHeaderTheme(theme: TerminalTheme): void {
    // Adjust foreground color for better contrast on light theme
    const isLightTheme = this.isLightBackground(theme.background);
    const headerForeground = isLightTheme ? ThemeColors.LIGHT_FOREGROUND : theme.foreground;

    // Update border service with theme state for inactive border colors
    this.borderService.setLightTheme(isLightTheme);

    // Delegate header theme updates to HeaderService
    this.headerService.updateAllHeaderThemeColors(theme.background, headerForeground);

    // Update terminal body/container background
    this.updateTerminalBodyBackground(theme.background);

    // Update tabs via callback
    if (this.tabThemeUpdater) {
      // Pass adjusted foreground for light theme
      const adjustedTheme = isLightTheme
        ? { ...theme, foreground: headerForeground }
        : theme;
      this.tabThemeUpdater(adjustedTheme);
    }
  }

  /**
   * Check if a background color is light (for contrast adjustment)
   */
  private isLightBackground(hexColor: string): boolean {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }

  /**
   * Update terminal body/container background to match theme
   *
   * Uses setProperty with 'important' priority to override initial theme CSS
   * that was injected with !important to prevent flash of wrong theme.
   */
  private updateTerminalBodyBackground(backgroundColor: string): void {
    // Update document.documentElement (html) and document.body
    // Use 'important' priority to override initial theme CSS with !important
    document.documentElement.style.setProperty('background-color', backgroundColor, 'important');
    document.body.style.setProperty('background-color', backgroundColor, 'important');

    const terminalBody = document.getElementById(ElementIds.TERMINAL_BODY);
    if (terminalBody) {
      terminalBody.style.setProperty('background-color', backgroundColor, 'important');
      terminalBody.style.setProperty('background', backgroundColor, 'important');
    }

    const terminalContainer = document.getElementById(ElementIds.TERMINAL_CONTAINER);
    if (terminalContainer) {
      terminalContainer.style.setProperty('background-color', backgroundColor, 'important');
    }

    uiLogger.debug(`🎨 [THEME] Updated all backgrounds to: ${backgroundColor}`);
  }

  /**
   * Update container backgrounds to match terminal theme
   * Ensures .terminal-content and .xterm-viewport backgrounds are consistent
   *
   * @param backgroundColor - The background color to apply
   * @param terminal - Optional: specific terminal to update. If not provided, updates all terminals.
   */
  private updateContainerBackgrounds(backgroundColor: string, terminal?: Terminal): void {
    try {
      // If a specific terminal is provided, only update its containers
      if (terminal && terminal.element) {
        const terminalElement = terminal.element;

        // Find the parent terminal-container
        const terminalContainer = terminalElement.closest(`.${CssClasses.TERMINAL_CONTAINER}`);

        if (terminalContainer) {
          // Update only this terminal's content element
          const terminalContent = terminalContainer.querySelector<HTMLElement>(`.${CssClasses.TERMINAL_CONTENT}`);
          if (terminalContent) {
            terminalContent.style.backgroundColor = backgroundColor;
          }
        }

        // Update xterm-viewport within this terminal
        const xtermViewport = terminalElement.querySelector<HTMLElement>(`.${CssClasses.XTERM_VIEWPORT}`);
        if (xtermViewport) {
          xtermViewport.style.backgroundColor = backgroundColor;
        }

        // Update the xterm element itself
        terminalElement.style.backgroundColor = backgroundColor;

        uiLogger.debug(`Updated specific terminal container background to: ${backgroundColor}`);
        return;
      }

      // Fallback: Update all terminal-content elements (for global theme changes)
      const terminalContents = document.querySelectorAll<HTMLElement>(`.${CssClasses.TERMINAL_CONTENT}`);
      terminalContents.forEach((element) => {
        element.style.backgroundColor = backgroundColor;
      });

      // Update all xterm-viewport elements
      const xtermViewports = document.querySelectorAll<HTMLElement>(`.${CssClasses.XTERM_VIEWPORT}`);
      xtermViewports.forEach((element) => {
        element.style.backgroundColor = backgroundColor;
      });

      // Update all xterm elements (the main xterm container)
      const xtermElements = document.querySelectorAll<HTMLElement>(`.${CssClasses.XTERM}`);
      xtermElements.forEach((element) => {
        element.style.backgroundColor = backgroundColor;
      });

      uiLogger.debug(`Updated all container backgrounds to: ${backgroundColor}`);
    } catch (error) {
      uiLogger.warn('Failed to update container backgrounds:', error);
    }
  }

  /**
   * Apply font settings to a terminal
   */
  public applyFontSettings(terminal: Terminal, fontSettings: WebViewFontSettings): void {
    // Use options property to properly update xterm.js settings (v5.0+ API)
    terminal.options.fontSize = fontSettings.fontSize;
    terminal.options.fontFamily = fontSettings.fontFamily;

    // Apply additional VS Code standard font settings if provided
    if (fontSettings.fontWeight !== undefined) {
      terminal.options.fontWeight = fontSettings.fontWeight as any;
    }
    if (fontSettings.fontWeightBold !== undefined) {
      terminal.options.fontWeightBold = fontSettings.fontWeightBold as any;
    }
    if (fontSettings.lineHeight !== undefined) {
      terminal.options.lineHeight = fontSettings.lineHeight;
    }
    if (fontSettings.letterSpacing !== undefined) {
      terminal.options.letterSpacing = fontSettings.letterSpacing;
    }

    uiLogger.info(
      `Applied font settings: ${fontSettings.fontFamily}, ${fontSettings.fontSize}px, weight: ${fontSettings.fontWeight || 'default'}, lineHeight: ${fontSettings.lineHeight || 'default'}`
    );
  }

  /**
   * Apply comprehensive visual settings to terminal
   */
  public applyAllVisualSettings(terminal: Terminal, settings: PartialTerminalSettings): void {
    // Apply theme
    this.applyTerminalTheme(terminal, settings);

    // Apply cursor settings
    if (settings.cursor && typeof settings.cursor === 'object') {
      if (settings.cursor.style) {
        terminal.options.cursorStyle = settings.cursor.style;
        uiLogger.debug(`Applied cursor style: ${settings.cursor.style}`);
      }
      if (settings.cursor.blink !== undefined) {
        terminal.options.cursorBlink = settings.cursor.blink;
        uiLogger.debug(`Applied cursor blink (nested): ${settings.cursor.blink}`);
      }
    }
    if (settings.cursorBlink !== undefined) {
      terminal.options.cursorBlink = settings.cursorBlink;
      uiLogger.debug(`Applied cursor blink: ${settings.cursorBlink}`);
    }

    // Apply scrollback
    if (settings.scrollback !== undefined) {
      terminal.options.scrollback = settings.scrollback;
      uiLogger.debug(`Applied scrollback: ${settings.scrollback}`);
    }

    // Bell sound is not supported in xterm.js options
    // Terminal bell handling would be implemented differently
  }

  /**
   * Create loading indicator for terminal operations
   * Delegates to LoadingIndicatorService
   */
  public showLoadingIndicator(message?: string): HTMLElement {
    return this.loadingIndicatorService.showLoadingIndicator(message);
  }

  /**
   * Remove loading indicator
   * Delegates to LoadingIndicatorService
   */
  public hideLoadingIndicator(indicator?: HTMLElement): void {
    this.loadingIndicatorService.hideLoadingIndicator(indicator);
  }

  /**
   * Add visual focus indicator to terminal
   */
  public addFocusIndicator(container: HTMLElement): void {
    container.classList.add(CssClasses.FOCUSED);

    // Add subtle glow effect
    const style = container.style;
    style.boxShadow = FocusStyles.BOX_SHADOW;
    style.transition = FocusStyles.TRANSITION;

    // Remove after animation
    setTimeout(() => {
      style.boxShadow = '';
      container.classList.remove(CssClasses.FOCUSED);
    }, Timing.FOCUS_INDICATOR_DURATION);

    uiLogger.info('Focus indicator added');
  }

  /**
   * Apply VS Code-like terminal styling
   */
  public applyVSCodeStyling(container: HTMLElement): void {
    container.style.fontFamily =
      'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)';
    container.style.fontSize = 'var(--vscode-editor-font-size, 14px)';
    container.style.backgroundColor = 'var(--vscode-terminal-background, #1e1e1e)';
    container.style.color = 'var(--vscode-terminal-foreground, #cccccc)';
    container.style.borderRadius = '4px';
    container.style.padding = '8px';

    uiLogger.info('VS Code styling applied');
  }

  /**
   * Create terminal header with title and controls
   * Delegates to HeaderService
   */
  public createTerminalHeader(
    terminalId: string,
    terminalName: string,
    onAiAgentToggleClick?: (terminalId: string) => void
  ): HTMLElement {
    return this.headerService.createTerminalHeader(terminalId, terminalName, {
      currentTheme: this.currentTheme,
      onAiAgentToggleClick,
    });
  }

  /**
   * Update terminal header title
   * Delegates to HeaderService
   */
  public updateTerminalHeader(
    terminalId: string,
    newName?: string,
    indicatorColor?: string
  ): void {
    this.headerService.updateTerminalHeader(terminalId, newName, indicatorColor);
  }

  public setTerminalProcessingIndicator(terminalId: string, isProcessing: boolean): void {
    this.headerService.setTerminalProcessingIndicator(terminalId, isProcessing);
  }

  /**
   * Remove terminal header from cache when terminal is closed
   * Delegates to HeaderService
   */
  public removeTerminalHeader(terminalId: string): void {
    this.headerService.removeTerminalHeader(terminalId);
  }

  /**
   * Clear all cached header elements
   * Delegates to HeaderService
   */
  public clearHeaderCache(): void {
    this.headerService.clearHeaderCache();
  }

  /**
   * Find all terminal headers in the DOM
   * Delegates to HeaderService
   */
  public findTerminalHeaders(): HTMLElement[] {
    return this.headerService.findTerminalHeaders();
  }

  /**
   * Create notification element with consistent styling
   * Delegates to NotificationService
   */
  public createNotificationElement(config: NotificationConfig): HTMLElement {
    return this.notificationService.createNotificationElement(config);
  }

  /**
   * Add CSS animations to document if not already present
   * Delegates to NotificationService
   */
  public ensureAnimationsLoaded(): void {
    this.notificationService.ensureAnimationsLoaded();
  }

  /**
   * Update CLI Agent status display in sidebar terminal headers
   * Delegates to CliAgentStatusService
   */
  public updateCliAgentStatusDisplay(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
  ): void {
    this.cliAgentService.updateCliAgentStatusDisplay(
      activeTerminalName,
      status,
      this.headerElementsCache,
      agentType
    );
  }

  /**
   * Update CLI Agent status by terminal ID (for Full State Sync)
   * Delegates to CliAgentStatusService
   */
  public updateCliAgentStatusByTerminalId(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
  ): void {
    this.cliAgentService.updateCliAgentStatusByTerminalId(
      terminalId,
      status,
      this.headerElementsCache,
      agentType
    );
  }

  /**
   * Get current theme information
   */
  public getCurrentTheme(): { background: string | null; applied: boolean } {
    return {
      background: this.currentTheme,
      applied: this.themeApplied,
    };
  }

  /**
   * Apply custom CSS to terminal container
   */
  public applyCustomCSS(container: HTMLElement, css: Partial<CSSStyleDeclaration>): void {
    Object.assign(container.style, css);
    uiLogger.info('Custom CSS applied to terminal container');
  }

  /**
   * Setup terminal resize observer for responsive design
   */
  public setupResizeObserver(
    container: HTMLElement,
    callback: (width: number, height: number) => void
  ): void {
    const key = `terminal-resize-${container.id || Date.now()}`;

    // 🔧 FIX: Track the key for proper cleanup on dispose
    this.resizeObserverKeys.add(key);

    ResizeManager.observeResize(
      key,
      container,
      (entry) => {
        const { width, height } = entry.contentRect;
        callback(width, height);
      },
      { delay: this.UPDATE_DEBOUNCE_MS }
    );

    uiLogger.info(`Resize observer setup for terminal container: ${key}`);
  }

  /**
   * Create visual separator between terminals in split view
   */
  public createSplitSeparator(direction: 'horizontal' | 'vertical'): HTMLElement {
    const separator = document.createElement('div');
    separator.className = `${CssClasses.SPLIT_SEPARATOR} ${CssClasses.SPLIT_SEPARATOR}-${direction}`;
    separator.style.background = WEBVIEW_THEME_CONSTANTS.SEPARATOR_COLOR;
    separator.style.cursor = direction === 'horizontal' ? 'row-resize' : 'col-resize';

    if (direction === 'horizontal') {
      separator.style.height = Dimensions.SEPARATOR_SIZE;
      separator.style.width = '100%';
    } else {
      separator.style.width = Dimensions.SEPARATOR_SIZE;
      separator.style.height = '100%';
    }

    uiLogger.info(`Split separator created: ${direction}`);
    return separator;
  }

  /**
   * Update legacy Claude status (moved from DOMManager)
   */
  public updateLegacyClaudeStatus(terminalId: string, isActive: boolean): void {
    const header = document.querySelector(
      `[data-terminal-id="${terminalId}"] .${CssClasses.TERMINAL_HEADER}`
    ) as HTMLElement;
    if (!header) return;

    // HeaderFactory構造なので適切なstatusセクションを使用
    const statusSection = header.querySelector(`.${CssClasses.TERMINAL_STATUS}`);
    if (statusSection) {
      statusSection.textContent = ''; // Safe: clearing content
    }

    if (isActive) {
      const statusSpan = DOMUtils.createElement(
        'span',
        {
          color: ThemeColors.CLI_AGENT_STATUS_COLOR,
          fontWeight: 'bold',
          marginLeft: ThemeColors.CLI_AGENT_STATUS_MARGIN,
          fontSize: ThemeColors.CLI_AGENT_STATUS_FONT_SIZE,
        },
        {
          className: CssClasses.CLAUDE_STATUS,
          textContent: 'CLI Agent Active',
        }
      );

      const controlsContainer = header.querySelector(`.${CssClasses.TERMINAL_CONTROLS}`);
      if (controlsContainer) {
        header.insertBefore(statusSpan, controlsContainer);
      } else {
        const closeButton = header.querySelector(`.${CssClasses.CLOSE_BTN}`);
        if (closeButton) {
          header.insertBefore(statusSpan, closeButton);
        } else {
          header.appendChild(statusSpan);
        }
      }
    }
  }

  /**
   * Cleanup and dispose of UI resources
   */
  public override dispose(): void {
    uiLogger.lifecycle('UIManager disposal', 'starting');

    try {
      // Dispose event registry
      this.eventRegistry.dispose();

      // 🔧 FIX: Unobserve individual ResizeObserver keys instead of global dispose
      // This prevents affecting other components that may use ResizeManager
      for (const key of this.resizeObserverKeys) {
        ResizeManager.unobserveResize(key);
      }
      this.resizeObserverKeys.clear();

      // Reset theme cache
      this.currentTheme = null;
      this.themeApplied = false;

      // Remove any remaining UI elements
      this.hideTerminalPlaceholder();
      this.hideLoadingIndicator();

      // Clear header cache
      this.clearHeaderCache();

      uiLogger.lifecycle('UIManager disposal', 'completed');
    } catch (error) {
      uiLogger.lifecycle('UIManager disposal', 'failed', error);
      throw error;
    }
  }
}
