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
import { getWebviewTheme, WEBVIEW_THEME_CONSTANTS } from '../utils/WebviewThemeUtils';
import { IUIManager } from '../interfaces/ManagerInterfaces';
import { HeaderFactory, TerminalHeaderElements } from '../factories/HeaderFactory';
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
} from './ui';

export { NotificationConfig };

export class UIManager extends BaseManager implements IUIManager {
  // Theme cache for performance
  private currentTheme: string | null = null;
  private themeApplied = false;
  private readonly themeCache = new WeakMap<Terminal, string | null>();

  // Prevent rapid successive updates that could cause duplication
  private readonly UPDATE_DEBOUNCE_MS = 100;

  // Header elements cache for efficient CLI Agent status updates
  // Public for backward compatibility with TerminalCreationService
  public headerElementsCache = new Map<string, TerminalHeaderElements>();

  // Event registry for proper cleanup
  protected eventRegistry: EventHandlerRegistry;

  // 🔧 FIX: Track ResizeObserver keys for proper individual cleanup
  private resizeObserverKeys: Set<string> = new Set();

  // Extracted services
  private readonly notificationService: NotificationService;
  private readonly borderService: TerminalBorderService;
  private readonly cliAgentService: CliAgentStatusService;

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
    this.headerElementsCache.clear();

    // 🔧 FIX: Clear resize observer keys tracking
    this.resizeObserverKeys.clear();

    this.logger('✅ UIManager resources disposed');
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
   */
  public showTerminalPlaceholder(): void {
    let placeholder = document.getElementById('terminal-placeholder');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.id = 'terminal-placeholder';
      placeholder.className = 'terminal-placeholder';

      // SECURITY: Build DOM structure safely to prevent XSS
      const contentDiv = document.createElement('div');
      contentDiv.className = 'placeholder-content';

      const iconDiv = document.createElement('div');
      iconDiv.className = 'placeholder-icon';
      iconDiv.textContent = '⚡';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'placeholder-title';
      titleDiv.textContent = 'No Terminal Active';

      const subtitleDiv = document.createElement('div');
      subtitleDiv.className = 'placeholder-subtitle';
      subtitleDiv.textContent = 'Create a new terminal to get started';

      contentDiv.appendChild(iconDiv);
      contentDiv.appendChild(titleDiv);
      contentDiv.appendChild(subtitleDiv);
      placeholder.appendChild(contentDiv);

      const terminalContainer = document.getElementById('terminal-container');
      if (terminalContainer) {
        terminalContainer.appendChild(placeholder);
      }
    }
    placeholder.style.display = 'flex';
    uiLogger.info('Terminal placeholder shown');
  }

  /**
   * Hide terminal placeholder when terminals exist
   */
  public hideTerminalPlaceholder(): void {
    const placeholder = document.getElementById('terminal-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
      uiLogger.info('Terminal placeholder hidden');
    }
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
        const terminalContainer = terminalElement.closest('.terminal-container');

        if (terminalContainer) {
          // Update only this terminal's content element
          const terminalContent = terminalContainer.querySelector<HTMLElement>('.terminal-content');
          if (terminalContent) {
            terminalContent.style.backgroundColor = backgroundColor;
          }
        }

        // Update xterm-viewport within this terminal
        const xtermViewport = terminalElement.querySelector<HTMLElement>('.xterm-viewport');
        if (xtermViewport) {
          xtermViewport.style.backgroundColor = backgroundColor;
        }

        // Update the xterm element itself
        terminalElement.style.backgroundColor = backgroundColor;

        uiLogger.debug(`Updated specific terminal container background to: ${backgroundColor}`);
        return;
      }

      // Fallback: Update all terminal-content elements (for global theme changes)
      const terminalContents = document.querySelectorAll<HTMLElement>('.terminal-content');
      terminalContents.forEach((element) => {
        element.style.backgroundColor = backgroundColor;
      });

      // Update all xterm-viewport elements
      const xtermViewports = document.querySelectorAll<HTMLElement>('.xterm-viewport');
      xtermViewports.forEach((element) => {
        element.style.backgroundColor = backgroundColor;
      });

      // Update all xterm elements (the main xterm container)
      const xtermElements = document.querySelectorAll<HTMLElement>('.xterm');
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
   */
  public showLoadingIndicator(message: string = 'Loading...'): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'loading-indicator';

    // SECURITY: Build DOM structure safely to prevent XSS
    const spinnerDiv = document.createElement('div');
    spinnerDiv.className = 'loading-spinner';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'loading-message';
    messageDiv.textContent = message; // Safe: textContent escapes HTML

    indicator.appendChild(spinnerDiv);
    indicator.appendChild(messageDiv);

    const terminalContainer = document.getElementById('terminal-container');
    if (terminalContainer) {
      terminalContainer.appendChild(indicator);
    }

    uiLogger.info(`Loading indicator shown: ${message}`);
    return indicator;
  }

  /**
   * Remove loading indicator
   */
  public hideLoadingIndicator(indicator?: HTMLElement): void {
    if (indicator) {
      indicator.remove();
    } else {
      const indicators = document.querySelectorAll('.loading-indicator');
      indicators.forEach((el) => el.remove());
    }
    uiLogger.info('Loading indicator hidden');
  }

  /**
   * Add visual focus indicator to terminal
   */
  public addFocusIndicator(container: HTMLElement): void {
    container.classList.add('focused');

    // Add subtle glow effect
    const style = container.style;
    style.boxShadow = '0 0 8px rgba(0, 122, 255, 0.5)';
    style.transition = 'box-shadow 0.2s ease';

    // Remove after animation
    setTimeout(() => {
      style.boxShadow = '';
      container.classList.remove('focused');
    }, 300);

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
   */
  public createTerminalHeader(
    terminalId: string,
    terminalName: string,
    onAiAgentToggleClick?: (terminalId: string) => void
  ): HTMLElement {
    // 🔍 DEBUG: Enhanced header creation logging
    log(`🔍 [DEBUG] Creating terminal header:`, {
      terminalId,
      terminalName,
      timestamp: Date.now(),
    });

    // HeaderFactoryを使用してシンプルな構造を作成
    const headerElements = HeaderFactory.createTerminalHeader({
      terminalId,
      terminalName,
      onAiAgentToggleClick,
    });

    // 🔍 FIX: Ensure header visibility with explicit styling
    const container = headerElements.container;
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('visibility', 'visible', 'important');
    container.style.setProperty('opacity', '1', 'important');
    container.style.setProperty('height', 'auto', 'important');
    container.style.setProperty('min-height', '28px', 'important');
    container.style.setProperty('z-index', '10', 'important');

    // 🔍 DEBUG: Log header creation success
    log(`🔍 [DEBUG] Header created successfully:`, {
      headerId: container.id,
      headerClass: container.className,
      headerDisplay: container.style.display,
      headerVisibility: container.style.visibility,
      headerDimensions: {
        width: container.offsetWidth,
        height: container.offsetHeight,
      },
    });

    // ヘッダー要素をキャッシュ（CLI Agent status更新用）
    this.headerElementsCache.set(terminalId, headerElements);

    uiLogger.info(`Terminal header created using HeaderFactory for ${terminalId}`);
    return headerElements.container;
  }

  /**
   * Update terminal header title
   */
  public updateTerminalHeader(terminalId: string, newName: string): void {
    const headerElements = this.headerElementsCache.get(terminalId);
    if (headerElements) {
      // HeaderFactoryを使用して名前を更新
      HeaderFactory.updateTerminalName(headerElements, newName);
    } else {
      // フォールバック: 直接DOMを更新
      const header = document.querySelector(`[data-terminal-id="${terminalId}"] .terminal-name`);
      if (header) {
        header.textContent = newName;
        uiLogger.info(`Updated terminal header (fallback) for ${terminalId}: ${newName}`);
      }
    }
  }

  /**
   * Remove terminal header from cache when terminal is closed
   */
  public removeTerminalHeader(terminalId: string): void {
    if (this.headerElementsCache.has(terminalId)) {
      this.headerElementsCache.delete(terminalId);
      uiLogger.debug(`Removed terminal header cache for ${terminalId}`);
    }
  }

  /**
   * Clear all cached header elements
   */
  public clearHeaderCache(): void {
    this.headerElementsCache.clear();
    uiLogger.debug('Cleared all header cache');
  }

  /**
   * Find all terminal headers in the DOM (moved from DOMManager)
   */
  public findTerminalHeaders(): HTMLElement[] {
    const headers = Array.from(document.querySelectorAll<HTMLElement>('.terminal-header'));
    uiLogger.debug(`Found ${headers.length} terminal headers`);
    return headers;
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
    separator.className = `split-separator split-separator-${direction}`;
    separator.style.background = WEBVIEW_THEME_CONSTANTS.SEPARATOR_COLOR;
    separator.style.cursor = direction === 'horizontal' ? 'row-resize' : 'col-resize';

    if (direction === 'horizontal') {
      separator.style.height = '4px';
      separator.style.width = '100%';
    } else {
      separator.style.width = '4px';
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
      `[data-terminal-id="${terminalId}"] .terminal-header`
    ) as HTMLElement;
    if (!header) return;

    // HeaderFactory構造なので適切なstatusセクションを使用
    const statusSection = header.querySelector('.terminal-status');
    if (statusSection) {
      statusSection.textContent = ''; // Safe: clearing content
    }

    if (isActive) {
      const statusSpan = DOMUtils.createElement(
        'span',
        {
          color: '#007ACC',
          fontWeight: 'bold',
          marginLeft: '10px',
          fontSize: '11px',
        },
        {
          className: 'claude-status',
          textContent: 'CLI Agent Active',
        }
      );

      const controlsContainer = header.querySelector('.terminal-controls');
      if (controlsContainer) {
        header.insertBefore(statusSpan, controlsContainer);
      } else {
        const closeButton = header.querySelector('.close-btn');
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
