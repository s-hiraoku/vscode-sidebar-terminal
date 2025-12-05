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
   * Refresh borders on all terminal containers based on current settings
   */
  private refreshAllBorders(): void {
    const allContainers = document.querySelectorAll('.terminal-container');
    const shouldShowBorder = this.shouldShowActiveBorder();

    allContainers.forEach((container) => {
      if (shouldShowBorder) {
        container.classList.remove('no-highlight-border');
      } else {
        container.classList.add('no-highlight-border');
      }
    });
  }

  /**
   * Determine if active border should be shown based on mode and terminal count
   */
  private shouldShowActiveBorder(): boolean {
    switch (this.activeBorderMode) {
      case 'none':
        return false;
      case 'always':
        return true;
      case 'multipleOnly':
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

    // Apply no-highlight-border class based on mode and terminal count
    if (shouldShow) {
      container.classList.remove('no-highlight-border');
    } else {
      container.classList.add('no-highlight-border');
    }

    if (isActive) {
      container.classList.add('active');
      container.classList.remove('inactive');

      if (shouldShow) {
        // Active border with highlight
        container.style.setProperty(
          'border',
          `1px solid ${WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR}`,
          'important'
        );
        container.style.setProperty('border-radius', '4px', 'important');
        container.style.setProperty(
          'box-shadow',
          `0 0 0 1px ${WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR}, 0 0 8px rgba(0, 122, 204, 0.2)`,
          'important'
        );
        container.style.setProperty('z-index', '2', 'important');
      } else {
        // Active but highlight disabled
        container.style.setProperty('border', '1px solid transparent', 'important');
        container.style.setProperty('border-radius', '4px', 'important');
        container.style.setProperty('box-shadow', 'none', 'important');
        container.style.setProperty('z-index', '1', 'important');
      }
    } else {
      container.classList.remove('active');
      container.classList.add('inactive');

      // Inactive terminal - transparent border
      container.style.setProperty('border', '1px solid transparent', 'important');
      container.style.setProperty('border-radius', '4px', 'important');
      container.style.setProperty('box-shadow', 'none', 'important');
      container.style.setProperty('z-index', '1', 'important');
    }

    uiLogger.debug(
      `Border updated: ${container.dataset.terminalId}, active: ${isActive}, visible: ${shouldShow}`
    );
  }
}
