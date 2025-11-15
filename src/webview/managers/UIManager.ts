/**
 * UI Manager - Handles visual feedback, theming, borders, and terminal appearance
 */

import { Terminal } from '@xterm/xterm';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { getWebviewTheme, WEBVIEW_THEME_CONSTANTS } from '../utils/WebviewThemeUtils';
import { IUIManager } from '../interfaces/ManagerInterfaces';
import { HeaderFactory, TerminalHeaderElements } from '../factories/HeaderFactory';
import { DOMUtils } from '../utils/DOMUtils';
import { BaseManager } from './BaseManager';
import { uiLogger } from '../utils/ManagerLogger';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { ResizeManager } from '../utils/ResizeManager';
import { webview as log } from '../../utils/logger';

export interface NotificationConfig {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  duration?: number;
  icon?: string;
}

export class UIManager extends BaseManager implements IUIManager {
  // Theme cache for performance
  private currentTheme: string | null = null;
  private themeApplied = false;

  // Prevent rapid successive updates that could cause duplication
  private lastUpdateTimestamp = 0;
  private readonly UPDATE_DEBOUNCE_MS = 100;

  // Header elements cache for efficient CLI Agent status updates
  private headerElementsCache = new Map<string, TerminalHeaderElements>();
  private highlightActiveBorderEnabled = true;

  // Event registry for proper cleanup
  protected eventRegistry: EventHandlerRegistry;

  constructor() {
    super('UIManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    // Initialize event registry
    this.eventRegistry = new EventHandlerRegistry();
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

    this.logger('✅ UIManager resources disposed');
  }

  /**
   * Update borders for all terminals based on active state
   */
  public updateTerminalBorders(
    activeTerminalId: string,
    allContainers: Map<string, HTMLElement>
  ): void {
    uiLogger.info(
      `Updating terminal borders - Active: ${activeTerminalId}, Containers: ${allContainers.size}`
    );

    // Reset terminal-body border to avoid interference
    const terminalBody = document.getElementById('terminal-body');
    if (terminalBody) {
      terminalBody.style.setProperty('border-color', 'transparent', 'important');
      terminalBody.style.setProperty('border-width', '0px', 'important');
      terminalBody.classList.remove('active');
    }

    // Log all available containers
    allContainers.forEach((container, terminalId) => {
      uiLogger.debug(
        `Container ${terminalId}: ${container.tagName}#${container.id}.${container.className}`
      );
    });

    // First, ensure all terminals are marked as inactive
    allContainers.forEach((container, _terminalId) => {
      this.updateSingleTerminalBorder(container, false);
    });

    // Then, mark only the active terminal as active
    const activeContainer = allContainers.get(activeTerminalId);
    if (activeContainer) {
      uiLogger.debug(`Setting active border for: ${activeTerminalId}`);
      this.updateSingleTerminalBorder(activeContainer, true);
    } else {
      uiLogger.warn(`Active container not found for: ${activeTerminalId}`);
    }

    uiLogger.info(`Updated borders, active terminal: ${activeTerminalId}`);
  }

  /**
   * Update borders specifically for split terminals
   */
  public updateSplitTerminalBorders(activeTerminalId: string): void {
    const allContainers = document.querySelectorAll('.terminal-container');
    allContainers.forEach((container) => {
      const element = container as HTMLElement;
      const terminalId = element.dataset.terminalId;
      if (terminalId) {
        this.updateSingleTerminalBorder(element, terminalId === activeTerminalId);
      }
    });
    uiLogger.info(`Updated split terminal borders, active: ${activeTerminalId}`);
  }

  public setHighlightActiveBorder(enabled: boolean): void {
    this.highlightActiveBorderEnabled = enabled;
    uiLogger.info(`Active border highlight ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update border for a single terminal container
   */
  private updateSingleTerminalBorder(container: HTMLElement, isActive: boolean): void {
    // 🔍 DEBUG: Enhanced border debugging
    log(`🔍 [DEBUG] Updating border for terminal:`, {
      terminalId: container.dataset.terminalId,
      containerId: container.id,
      containerClass: container.className,
      isActive,
      currentBorderColor: container.style.borderColor,
      currentBorderWidth: container.style.borderWidth,
    });

    if (isActive) {
      container.classList.add('active');
      container.classList.remove('inactive');

      if (this.highlightActiveBorderEnabled) {
        // 🎯 FIX: Apply refined border styling - thinner border as requested
        // Use a single source of truth for active terminal borders
        container.style.setProperty(
          'border',
          `1px solid ${WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR}`,
          'important'
        );
        container.style.setProperty('border-radius', '4px', 'important');
        // Enhanced visibility with subtle shadow
        container.style.setProperty(
          'box-shadow',
          `0 0 0 1px ${WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR}, 0 0 8px rgba(0, 122, 204, 0.2)`,
          'important'
        );
        // Ensure proper z-index for visibility
        container.style.setProperty('z-index', '2', 'important');

        log(`🔍 [DEBUG] Applied ACTIVE border styles`, {
          borderColor: WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR,
          computedStyle: window.getComputedStyle(container).border,
        });
      } else {
        container.style.setProperty('border', '1px solid transparent', 'important');
        container.style.setProperty('border-radius', '4px', 'important');
        container.style.setProperty('box-shadow', 'none', 'important');
        container.style.setProperty('z-index', '1', 'important');

        log('🔍 [DEBUG] Active border highlight disabled; applied transparent border');
      }
    } else {
      container.classList.remove('active');
      container.classList.add('inactive');

      // 🔍 FIX: Keep consistent border structure but transparent for inactive - thinner border
      container.style.setProperty('border', '1px solid transparent', 'important');
      container.style.setProperty('border-radius', '4px', 'important');
      container.style.setProperty('box-shadow', 'none', 'important');
      container.style.setProperty('z-index', '1', 'important');

      log(`🔍 [DEBUG] Applied INACTIVE border styles`);
    }

    uiLogger.debug(
      `Updated border for terminal: ${container.dataset.terminalId}, active: ${isActive}, color: ${isActive ? WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR : 'transparent'}`
    );
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

    // Only apply if theme changed
    if (this.currentTheme !== theme.background) {
      terminal.options.theme = theme;
      this.currentTheme = theme.background || null;
      this.themeApplied = true;
      uiLogger.info(`Applied theme to terminal: ${theme.background || 'default'}`);
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
   * Create notification element with consistent styling (moved from DOMManager)
   */
  public createNotificationElement(config: NotificationConfig): HTMLElement {
    const colors = this.getNotificationColors(config.type);
    const notification = this.createNotificationContainer(colors);
    const content = this.createNotificationContent(config, colors);

    notification.appendChild(content);
    uiLogger.info(`Created notification: ${config.type} - ${config.title}`);
    return notification;
  }

  /**
   * Add CSS animations to document if not already present (moved from DOMManager)
   */
  public ensureAnimationsLoaded(): void {
    if (!document.querySelector('#ui-manager-animations')) {
      const style = document.createElement('style');
      style.id = 'ui-manager-animations';
      style.textContent = this.getAnimationCSS();
      document.head.appendChild(style);
      uiLogger.debug('CSS animations loaded');
    }
  }

  /**
   * Update CLI Agent status display in sidebar terminal headers (optimized)
   */
  public updateCliAgentStatusDisplay(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
  ): void {
    // Use performance measurement
    // Performance measurement removed for simplification
    // CLI Agentステータス更新は即座に処理する（デバウンスをスキップ）
    // 相互排他制御により短時間で複数のステータス変更が発生するため

    let updatedCount = 0;

    // キャッシュされたヘッダー要素を使用（高速）
    for (const [, headerElements] of this.headerElementsCache) {
      const terminalName = headerElements.nameSpan.textContent?.trim();
      const isTargetTerminal = terminalName === activeTerminalName;

      if (status === 'none') {
        // CLI Agent statusを削除 (全ターミナルから削除)
        HeaderFactory.removeCliAgentStatus(headerElements);
        // AI Agent切り替えボタンを常時表示 (none状態でも表示)
        HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true);
      } else if (isTargetTerminal) {
        // CLI Agent statusを挿入/更新 (該当ターミナルのみ)
        HeaderFactory.insertCliAgentStatus(headerElements, status, agentType);
        // AI Agent切り替えボタンを常時表示 (全ての状態で表示)
        HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, status);
      } else {
        // AI Agentステータスがないターミナルでもボタンを表示
        HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true);
      }
      updatedCount++;
    }

    if (updatedCount > 0) {
      uiLogger.info(
        `CLI Agent status updated: ${activeTerminalName} -> ${status} (${updatedCount} terminals)`
      );
    }
  }

  /**
   * Update CLI Agent status by terminal ID (for Full State Sync)
   */
  public updateCliAgentStatusByTerminalId(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
  ): void {
    uiLogger.info(`Updating CLI Agent status: ${terminalId} -> ${status} (${agentType})`);

    // シンプルにステータス更新のみ実行 - 複雑な判定は省略
    const headerElements = this.headerElementsCache.get(terminalId);
    if (!headerElements) {
      uiLogger.warn(`No header elements found for terminal: ${terminalId}`);
      return;
    }

    // ステータスに応じてシンプルに更新
    if (status === 'connected') {
      HeaderFactory.insertCliAgentStatus(headerElements, 'connected', agentType);
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'connected');
    } else if (status === 'disconnected') {
      HeaderFactory.insertCliAgentStatus(headerElements, 'disconnected', agentType);
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'disconnected');
    } else {
      // none状態
      HeaderFactory.removeCliAgentStatus(headerElements);
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true);
    }

    uiLogger.info(`CLI Agent status updated for terminal ${terminalId}: ${status}`);
  }

  /**
   * Check if CLI Agent update should be processed (debouncing)
   */
  private _shouldProcessCliAgentUpdate(): boolean {
    const now = Date.now();
    if (now - this.lastUpdateTimestamp < this.UPDATE_DEBOUNCE_MS) {
      return false;
    }
    this.lastUpdateTimestamp = now;
    return true;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createNotificationContainer(colors: any): HTMLElement {
    return DOMUtils.createElement(
      'div',
      {
        position: 'fixed',
        top: '20px',
        right: '20px',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        background: colors.background,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        border: `2px solid ${colors.border}`,
        borderRadius: '6px',
        padding: '12px 16px',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        color: colors.foreground,
        fontSize: '11px',
        zIndex: '10000',
        maxWidth: '300px',
        minWidth: '200px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        animation: 'slideInFromRight 0.3s ease-out',
      },
      {
        className: 'terminal-notification',
      }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createNotificationContent(config: NotificationConfig, colors: any): HTMLElement {
    const container = document.createElement('div');
    const icon = config.icon || this.getDefaultIcon(config.type);

    // SECURITY: Build DOM structure safely to prevent XSS
    // Create header with icon and title
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';

    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '14px';
    iconSpan.textContent = icon; // Safe: textContent escapes HTML

    const titleStrong = document.createElement('strong');
    titleStrong.textContent = config.title; // Safe: textContent escapes HTML

    headerDiv.appendChild(iconSpan);
    headerDiv.appendChild(titleStrong);

    // Create message div
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'font-size: 10px; line-height: 1.4;';
    messageDiv.textContent = config.message; // Safe: textContent escapes HTML

    container.appendChild(headerDiv);
    container.appendChild(messageDiv);

    const closeBtn = this.createNotificationCloseButton(colors);
    container.appendChild(closeBtn);

    return container;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createNotificationCloseButton(colors: any): HTMLButtonElement {
    return DOMUtils.createElement(
      'button',
      {
        position: 'absolute',
        top: '4px',
        right: '6px',
        background: 'none',
        border: 'none',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        color: colors.foreground,
        cursor: 'pointer',
        fontSize: '12px',
        padding: '2px',
        opacity: '0.7',
        transition: 'opacity 0.2s',
      },
      {
        textContent: '✕',
        className: 'notification-close',
      }
    );
  }

  /**
   * Get notification colors based on type
   */
  private getNotificationColors(type: string): {
    background: string;
    border: string;
    foreground: string;
  } {
    switch (type) {
      case 'error':
        return {
          background: 'var(--vscode-notifications-background, #1e1e1e)',
          border: 'var(--vscode-notificationError-border, #f44747)',
          foreground: 'var(--vscode-notificationError-foreground, #ffffff)',
        };
      case 'warning':
        return {
          background: 'var(--vscode-notifications-background, #1e1e1e)',
          border: 'var(--vscode-notificationWarning-border, #ffcc02)',
          foreground: 'var(--vscode-notificationWarning-foreground, #ffffff)',
        };
      case 'success':
        return {
          background: 'var(--vscode-notifications-background, #1e1e1e)',
          border: 'var(--vscode-notification-successIcon-foreground, #73c991)',
          foreground: 'var(--vscode-notification-foreground, #ffffff)',
        };
      case 'info':
      default:
        return {
          background: 'var(--vscode-notifications-background, #1e1e1e)',
          border: 'var(--vscode-notification-infoIcon-foreground, #3794ff)',
          foreground: 'var(--vscode-notification-foreground, #ffffff)',
        };
    }
  }

  /**
   * Get default icon for notification type
   */
  private getDefaultIcon(type: string): string {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
      default:
        return 'ℹ️';
    }
  }

  private getAnimationCSS(): string {
    return `
      @keyframes slideInFromRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutToRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
      @keyframes fadeInOut {
        0% { opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
  }

  /**
   * Cleanup and dispose of UI resources
   */
  public override dispose(): void {
    uiLogger.lifecycle('UIManager disposal', 'starting');

    try {
      // Dispose event registry
      this.eventRegistry.dispose();

      // Clear resize operations
      ResizeManager.dispose();

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
