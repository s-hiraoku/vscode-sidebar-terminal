/**
 * UI Manager - Handles visual feedback, theming, borders, and terminal appearance
 */

import { Terminal } from 'xterm';
import { webview as log } from '../../utils/logger';
import { LoggerManager } from './LoggerManager';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { getWebviewTheme, WEBVIEW_THEME_CONSTANTS } from '../utils/WebviewThemeUtils';
import { IUIManager } from '../interfaces/ManagerInterfaces';
import { HeaderFactory, TerminalHeaderElements } from '../factories/HeaderFactory';
import { DOMUtils } from '../utils/DOMUtils';

export interface NotificationConfig {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  duration?: number;
  icon?: string;
}

export class UIManager implements IUIManager {
  // Theme cache for performance
  private currentTheme: string | null = null;
  private themeApplied = false;

  // Prevent rapid successive updates that could cause duplication
  private lastUpdateTimestamp = 0;
  private readonly UPDATE_DEBOUNCE_MS = 100;

  // Header elements cache for efficient CLI Agent status updates
  private headerElementsCache = new Map<string, TerminalHeaderElements>();

  // Logger manager
  private logger = LoggerManager.getInstance();

  /**
   * Update borders for all terminals based on active state
   */
  public updateTerminalBorders(
    activeTerminalId: string,
    allContainers: Map<string, HTMLElement>
  ): void {
    // Reset terminal-body border to avoid interference
    const terminalBody = document.getElementById('terminal-body');
    if (terminalBody) {
      terminalBody.style.setProperty('border-color', 'transparent', 'important');
      terminalBody.style.setProperty('border-width', '0px', 'important');
      terminalBody.classList.remove('active');
    }

    // First, ensure all terminals are marked as inactive
    allContainers.forEach((container, _terminalId) => {
      this.updateSingleTerminalBorder(container, false);
    });

    // Then, mark only the active terminal as active
    const activeContainer = allContainers.get(activeTerminalId);
    if (activeContainer) {
      this.updateSingleTerminalBorder(activeContainer, true);
    }

    log(`🎨 [UI] Updated borders, active terminal: ${activeTerminalId}`);
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
    log(`🎨 [UI] Updated split terminal borders, active: ${activeTerminalId}`);
  }

  /**
   * Update border for a single terminal container
   */
  private updateSingleTerminalBorder(container: HTMLElement, isActive: boolean): void {
    if (isActive) {
      container.classList.add('active');
      container.classList.remove('inactive');
      container.style.setProperty(
        'border-color',
        WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR,
        'important'
      );
      container.style.setProperty('border-width', '2px', 'important');
      container.style.setProperty('border-style', 'solid', 'important');
    } else {
      container.classList.remove('active');
      container.classList.add('inactive');
      // Keep same border width to prevent layout shift, but make it transparent
      container.style.setProperty('border-color', 'transparent', 'important');
      container.style.setProperty('border-width', '2px', 'important');
      container.style.setProperty('border-style', 'solid', 'important');
    }

    log(
      `🎨 [UI] Updated border for terminal: ${container.dataset.terminalId}, active: ${isActive}, color: ${isActive ? WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR : 'transparent'}`
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
      placeholder.innerHTML = `
        <div class="placeholder-content">
          <div class="placeholder-icon">⚡</div>
          <div class="placeholder-title">No Terminal Active</div>
          <div class="placeholder-subtitle">Create a new terminal to get started</div>
        </div>
      `;

      const terminalContainer = document.getElementById('terminal-container');
      if (terminalContainer) {
        terminalContainer.appendChild(placeholder);
      }
    }
    placeholder.style.display = 'flex';
    log('🎨 [UI] Terminal placeholder shown');
  }

  /**
   * Hide terminal placeholder when terminals exist
   */
  public hideTerminalPlaceholder(): void {
    const placeholder = document.getElementById('terminal-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
      log('🎨 [UI] Terminal placeholder hidden');
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
      log(`🎨 [UI] Applied theme to terminal: ${theme.background || 'default'}`);
    }
  }

  /**
   * Apply font settings to a terminal
   */
  public applyFontSettings(terminal: Terminal, fontSettings: WebViewFontSettings): void {
    // Use options property to properly update xterm.js settings (v5.0+ API)
    terminal.options.fontSize = fontSettings.fontSize;
    terminal.options.fontFamily = fontSettings.fontFamily;

    log(`🎨 [UI] Applied font settings: ${fontSettings.fontFamily}, ${fontSettings.fontSize}px`);
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
      log(`🎨 [UI] Applied cursor blink: ${settings.cursorBlink}`);
    }

    // Apply scrollback
    if (settings.scrollback !== undefined) {
      terminal.options.scrollback = settings.scrollback;
      log(`🎨 [UI] Applied scrollback: ${settings.scrollback}`);
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
    indicator.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">${message}</div>
    `;

    const terminalContainer = document.getElementById('terminal-container');
    if (terminalContainer) {
      terminalContainer.appendChild(indicator);
    }

    log(`🎨 [UI] Loading indicator shown: ${message}`);
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
    log('🎨 [UI] Loading indicator hidden');
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

    log('🎨 [UI] Focus indicator added');
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

    log('🎨 [UI] VS Code styling applied');
  }

  /**
   * Create terminal header with title and controls
   */
  public createTerminalHeader(terminalId: string, terminalName: string): HTMLElement {
    // HeaderFactoryを使用して統一された構造を作成
    const headerElements = HeaderFactory.createTerminalHeader({
      terminalId,
      terminalName,
      showId: true,
      showSplitButton: true,
    });

    // ヘッダー要素をキャッシュ（CLI Agent status更新用）
    this.headerElementsCache.set(terminalId, headerElements);

    log(`🎨 [UI] Terminal header created using HeaderFactory for ${terminalId}`);
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
        log(`🎨 [UI] Updated terminal header (fallback) for ${terminalId}: ${newName}`);
      }
    }
  }

  /**
   * Remove terminal header from cache when terminal is closed
   */
  public removeTerminalHeader(terminalId: string): void {
    if (this.headerElementsCache.has(terminalId)) {
      this.headerElementsCache.delete(terminalId);
      log(`🧹 [UI] Removed terminal header cache for ${terminalId}`);
    }
  }

  /**
   * Clear all cached header elements
   */
  public clearHeaderCache(): void {
    this.headerElementsCache.clear();
    log(`🧹 [UI] Cleared all header cache`);
  }

  /**
   * Find all terminal headers in the DOM (moved from DOMManager)
   */
  public findTerminalHeaders(): HTMLElement[] {
    const headers = Array.from(document.querySelectorAll('.terminal-header')) as HTMLElement[];
    log(`🔍 [UI] Found ${headers.length} terminal headers`);
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
    log(`📢 [UI] Created notification: ${config.type} - ${config.title}`);
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
      log('🎨 [UI] CSS animations loaded');
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
    return this.logger.performance.measure('updateCliAgentStatusDisplay', () => {
      // Debounce rapid successive calls
      if (!this._shouldProcessCliAgentUpdate()) return;

      let updatedCount = 0;

      // キャッシュされたヘッダー要素を使用（高速）
      for (const [_terminalId, headerElements] of this.headerElementsCache) {
        const terminalName = headerElements.nameSpan.textContent?.trim();
        const isTargetTerminal = terminalName === activeTerminalName;

        if (status === 'none') {
          // CLI Agent statusを削除 (全ターミナルから削除)
          HeaderFactory.removeCliAgentStatus(headerElements);
        } else if (isTargetTerminal) {
          // CLI Agent statusを挿入/更新 (該当ターミナルのみ)
          HeaderFactory.insertCliAgentStatus(headerElements, status, agentType);
        }
        updatedCount++;
      }

      if (updatedCount > 0) {
        this.logger.ui.info(
          `CLI Agent status updated: ${activeTerminalName} -> ${status} (${updatedCount} terminals)`
        );
      }
    });
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
    log('🎨 [UI] Custom CSS applied to terminal container');
  }

  /**
   * Setup terminal resize observer for responsive design
   */
  public setupResizeObserver(
    container: HTMLElement,
    callback: (width: number, height: number) => void
  ): ResizeObserver {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        callback(width, height);
      }
    });

    observer.observe(container);
    log('🎨 [UI] Resize observer setup for terminal container');
    return observer;
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

    log(`🎨 [UI] Split separator created: ${direction}`);
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
      statusSection.innerHTML = ''; // Clear existing status
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

  private createNotificationContainer(colors: any): HTMLElement {
    return DOMUtils.createElement(
      'div',
      {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: colors.background,
        border: `2px solid ${colors.border}`,
        borderRadius: '6px',
        padding: '12px 16px',
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

  private createNotificationContent(config: NotificationConfig, colors: any): HTMLElement {
    const container = document.createElement('div');
    const icon = config.icon || this.getDefaultIcon(config.type);

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="font-size: 14px;">${icon}</span>
        <strong>${config.title}</strong>
      </div>
      <div style="font-size: 10px; line-height: 1.4;">${config.message}</div>
    `;

    const closeBtn = this.createNotificationCloseButton(colors);
    container.appendChild(closeBtn);

    return container;
  }

  private createNotificationCloseButton(colors: any): HTMLButtonElement {
    return DOMUtils.createElement(
      'button',
      {
        position: 'absolute',
        top: '4px',
        right: '6px',
        background: 'none',
        border: 'none',
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
  public dispose(): void {
    log('🧹 [UI] Disposing UI manager');

    // Reset theme cache
    this.currentTheme = null;
    this.themeApplied = false;

    // Remove any remaining UI elements
    this.hideTerminalPlaceholder();
    this.hideLoadingIndicator();

    log('✅ [UI] UI manager disposed');
  }
}
