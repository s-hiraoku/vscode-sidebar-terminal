/**
 * Terminal Border Service
 *
 * Extracted from UIManager for better maintainability.
 * Handles terminal border styling and active state highlighting.
 */

import { WEBVIEW_THEME_CONSTANTS } from '../../utils/WebviewThemeUtils';
import { uiLogger } from '../../utils/ManagerLogger';
import type { ActiveBorderMode } from '../../../types/shared';

/**
 * Service for managing terminal border styling
 */
export class TerminalBorderService {
  private activeBorderMode: ActiveBorderMode = 'multipleOnly';
  private currentTerminalCount = 1;
  private isFullscreen = false;
  private isLightTheme = false;

  /**
   * Update borders for all terminals based on active state
   */
  public updateTerminalBorders(
    activeTerminalId: string,
    allContainers: Map<string, HTMLElement>
  ): void {
    this.currentTerminalCount = allContainers.size;

    // Reset terminal-body border to avoid interference
    const terminalBody = document.getElementById('terminal-body');
    if (terminalBody) {
      terminalBody.style.setProperty('border-color', 'transparent', 'important');
      terminalBody.style.setProperty('border-width', '0px', 'important');
      terminalBody.classList.remove('active');
    }

    // Mark all terminals inactive, then set the active one
    allContainers.forEach((container) => {
      this.updateSingleTerminalBorder(container, false);
    });

    const activeContainer = allContainers.get(activeTerminalId);
    if (activeContainer) {
      this.updateSingleTerminalBorder(activeContainer, true);
    } else {
      uiLogger.warn(`Active container not found: ${activeTerminalId}`);
    }
  }

  /**
   * Update borders specifically for split terminals
   */
  public updateSplitTerminalBorders(activeTerminalId: string): void {
    const allContainers = document.querySelectorAll('.terminal-container');
    this.currentTerminalCount = allContainers.length;
    allContainers.forEach((container) => {
      const element = container as HTMLElement;
      const terminalId = element.dataset.terminalId;
      if (terminalId) {
        this.updateSingleTerminalBorder(element, terminalId === activeTerminalId);
      }
    });
  }

  /**
   * Set the active border display mode
   */
  public setActiveBorderMode(mode: ActiveBorderMode): void {
    this.activeBorderMode = mode;
    this.refreshAllBorders();
  }

  /**
   * Update the current terminal count (used for "multipleOnly" logic)
   */
  public setTerminalCount(count: number): void {
    this.currentTerminalCount = count;
    this.refreshAllBorders();
  }

  /**
   * Set fullscreen mode state (used for "multipleOnly" logic)
   * When in fullscreen mode, multipleOnly will hide the border
   */
  public setFullscreenMode(isFullscreen: boolean): void {
    this.isFullscreen = isFullscreen;
    this.refreshAllBorders();
  }

  /**
   * Set light theme state (used for inactive border color)
   * Light theme shows gray border, dark theme shows transparent
   */
  public setLightTheme(isLight: boolean): void {
    this.isLightTheme = isLight;
    this.refreshAllBorders();
  }

  /**
   * Update theme colors based on TerminalTheme
   * Detects light/dark theme from background color luminance
   */
  public updateThemeColors(theme: { background: string; foreground: string }): void {
    // Determine if light theme by checking background luminance
    const isLight = this.isLightBackground(theme.background);
    this.setLightTheme(isLight);
  }

  /**
   * Check if a color is a light background using luminance calculation
   */
  private isLightBackground(color: string): boolean {
    // Parse hex color
    let r = 0, g = 0, b = 0;

    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        const r0 = hex[0];
        const g0 = hex[1];
        const b0 = hex[2];
        if (r0 !== undefined && g0 !== undefined && b0 !== undefined) {
          r = parseInt(r0 + r0, 16);
          g = parseInt(g0 + g0, 16);
          b = parseInt(b0 + b0, 16);
        }
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    } else if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r0 = match[0];
        const g0 = match[1];
        const b0 = match[2];
        if (r0 !== undefined && g0 !== undefined && b0 !== undefined) {
          r = parseInt(r0, 10);
          g = parseInt(g0, 10);
          b = parseInt(b0, 10);
        }
      }
    }

    // Calculate relative luminance (WCAG formula)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5;
  }

  /**
   * Refresh borders on all terminal containers based on current settings
   *
   * 🔧 FIX: Actually update border styles, not just CSS classes.
   * The previous implementation only toggled the no-highlight-border class,
   * but the actual border/box-shadow styles are set inline by updateSingleTerminalBorder().
   */
  private refreshAllBorders(): void {
    const allContainers = document.querySelectorAll('.terminal-container');
    this.currentTerminalCount = allContainers.length;

    allContainers.forEach((container) => {
      const element = container as HTMLElement;
      const isActive = element.classList.contains('active');
      this.updateSingleTerminalBorder(element, isActive);
    });

    uiLogger.debug(
      `Refreshed all borders: mode=${this.activeBorderMode}, count=${this.currentTerminalCount}`
    );
  }

  /**
   * Determine if active border should be shown based on mode, terminal count, and fullscreen state
   */
  private shouldShowActiveBorder(): boolean {
    switch (this.activeBorderMode) {
      case 'none':
        return false;
      case 'always':
        return true;
      case 'multipleOnly':
        // In fullscreen mode, only one terminal is visible, so hide the border
        if (this.isFullscreen) {
          return false;
        }
        return this.currentTerminalCount >= 2;
      default:
        return true;
    }
  }

  /**
   * Get the current active border mode
   */
  public getActiveBorderMode(): ActiveBorderMode {
    return this.activeBorderMode;
  }

  /**
   * Update border for a single terminal container
   */
  public updateSingleTerminalBorder(container: HTMLElement, isActive: boolean): void {
    const shouldShow = this.shouldShowActiveBorder();
    const activeBorderColor = `var(--vscode-focusBorder, ${WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR})`;

    // Ensure a consistent border width regardless of prior inline styles
    container.style.setProperty('border-width', '2px', 'important');
    container.style.setProperty('border-style', 'solid', 'important');

    // Apply no-highlight-border class based on mode and terminal count
    if (shouldShow) {
      container.classList.remove('no-highlight-border');
    } else {
      container.classList.add('no-highlight-border');
    }

    // Inactive border color: gray for light theme, transparent for dark theme
    const inactiveBorderColor = this.isLightTheme ? '#999' : 'transparent';

    if (isActive) {
      container.classList.add('active');
      container.classList.remove('inactive');

      if (shouldShow) {
        // Active border with highlight (single thick line)
        container.style.setProperty('border-color', activeBorderColor, 'important');
        container.style.setProperty('border-radius', '4px', 'important');
        container.style.setProperty('box-shadow', 'none', 'important');
        container.style.setProperty('z-index', '2', 'important');
      } else {
        // Active but highlight disabled - use theme-aware border
        container.style.setProperty('border-color', inactiveBorderColor, 'important');
        container.style.setProperty('border-radius', '4px', 'important');
        container.style.setProperty('box-shadow', 'none', 'important');
        container.style.setProperty('z-index', '1', 'important');
      }
    } else {
      container.classList.remove('active');
      container.classList.add('inactive');

      // Inactive terminal - theme-aware border
      container.style.setProperty('border-color', inactiveBorderColor, 'important');
      container.style.setProperty('border-radius', '4px', 'important');
      container.style.setProperty('box-shadow', 'none', 'important');
      container.style.setProperty('z-index', '1', 'important');
    }

    uiLogger.debug(
      `Border updated: ${container.dataset.terminalId}, active: ${isActive}, visible: ${shouldShow}, lightTheme: ${this.isLightTheme}`
    );
  }
}
