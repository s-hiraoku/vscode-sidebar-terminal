/**
 * Terminal Border Service
 *
 * Extracted from UIManager for better maintainability.
 * Handles terminal border styling and active state highlighting.
 */

import { WEBVIEW_THEME_CONSTANTS } from '../../utils/WebviewThemeUtils';
import { uiLogger } from '../../utils/ManagerLogger';
import { webview as log } from '../../../utils/logger';

/**
 * Service for managing terminal border styling
 */
export class TerminalBorderService {
  private highlightActiveBorderEnabled = true;

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

  /**
   * Enable or disable active border highlight
   */
  public setHighlightActiveBorder(enabled: boolean): void {
    this.highlightActiveBorderEnabled = enabled;
    uiLogger.info(`Active border highlight ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if active border highlight is enabled
   */
  public isHighlightActiveBorderEnabled(): boolean {
    return this.highlightActiveBorderEnabled;
  }

  /**
   * Update border for a single terminal container
   */
  public updateSingleTerminalBorder(container: HTMLElement, isActive: boolean): void {
    // DEBUG: Enhanced border debugging
    log(`[DEBUG] Updating border for terminal:`, {
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
        // FIX: Apply refined border styling - thinner border as requested
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

        log(`[DEBUG] Applied ACTIVE border styles`, {
          borderColor: WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR,
          computedStyle: window.getComputedStyle(container).border,
        });
      } else {
        container.style.setProperty('border', '1px solid transparent', 'important');
        container.style.setProperty('border-radius', '4px', 'important');
        container.style.setProperty('box-shadow', 'none', 'important');
        container.style.setProperty('z-index', '1', 'important');

        log('[DEBUG] Active border highlight disabled; applied transparent border');
      }
    } else {
      container.classList.remove('active');
      container.classList.add('inactive');

      // FIX: Keep consistent border structure but transparent for inactive - thinner border
      container.style.setProperty('border', '1px solid transparent', 'important');
      container.style.setProperty('border-radius', '4px', 'important');
      container.style.setProperty('box-shadow', 'none', 'important');
      container.style.setProperty('z-index', '1', 'important');

      log(`[DEBUG] Applied INACTIVE border styles`);
    }

    uiLogger.debug(
      `Updated border for terminal: ${container.dataset.terminalId}, active: ${isActive}, color: ${isActive ? WEBVIEW_THEME_CONSTANTS.ACTIVE_BORDER_COLOR : 'transparent'}`
    );
  }
}
