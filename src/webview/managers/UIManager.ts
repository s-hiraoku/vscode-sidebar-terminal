/**
 * UI Manager - Handles visual feedback, theming, borders, and terminal appearance
 */

import { Terminal } from 'xterm';
import { webview as log } from '../../utils/logger';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { getWebviewTheme, WEBVIEW_THEME_CONSTANTS } from '../utils/WebviewThemeUtils';
import { IUIManager } from '../interfaces/ManagerInterfaces';

export class UIManager implements IUIManager {
  // Theme cache for performance
  private currentTheme: string | null = null;
  private themeApplied = false;

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
    const header = document.createElement('div');
    header.className = 'terminal-header';
    header.dataset.terminalId = terminalId;

    header.innerHTML = `
      <div class="terminal-title">
        <span class="terminal-icon">⚡</span>
        <span class="terminal-name">${terminalName}</span>
        <span class="terminal-id">(${terminalId})</span>
      </div>
      <div class="terminal-controls">
        <button class="terminal-control split-btn" title="Split Terminal">⊞</button>
        <button class="terminal-control close-btn" title="Close Terminal">✕</button>
      </div>
    `;

    log(`🎨 [UI] Terminal header created for ${terminalId}`);
    return header;
  }

  /**
   * Update terminal header title
   */
  public updateTerminalHeader(terminalId: string, newName: string): void {
    const header = document.querySelector(`[data-terminal-id="${terminalId}"] .terminal-name`);
    if (header) {
      header.textContent = newName;
      log(`🎨 [UI] Updated terminal header for ${terminalId}: ${newName}`);
    }
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
