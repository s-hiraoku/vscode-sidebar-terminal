/**
 * Loading Indicator Service
 *
 * Extracted from UIManager for better maintainability.
 * Handles terminal placeholder and loading indicator display.
 */

import { uiLogger } from '../../utils/ManagerLogger';

// ============================================================================
// Constants
// ============================================================================

/** Element IDs */
const ElementIds = {
  TERMINAL_PLACEHOLDER: 'terminal-placeholder',
  TERMINAL_CONTAINER: 'terminal-container',
} as const;

/** CSS class names */
const CssClasses = {
  TERMINAL_PLACEHOLDER: 'terminal-placeholder',
  PLACEHOLDER_CONTENT: 'placeholder-content',
  PLACEHOLDER_ICON: 'placeholder-icon',
  PLACEHOLDER_TITLE: 'placeholder-title',
  PLACEHOLDER_SUBTITLE: 'placeholder-subtitle',
  LOADING_INDICATOR: 'loading-indicator',
  LOADING_SPINNER: 'loading-spinner',
  LOADING_MESSAGE: 'loading-message',
} as const;

/** Placeholder content */
const PlaceholderContent = {
  ICON: '\u26A1', // Lightning bolt emoji
  TITLE: 'No Terminal Active',
  SUBTITLE: 'Create a new terminal to get started',
  DEFAULT_LOADING_MESSAGE: 'Loading...',
} as const;

/**
 * Service for managing loading indicators and placeholders
 */
export class LoadingIndicatorService {
  /**
   * Show terminal placeholder when no terminals exist
   */
  public showTerminalPlaceholder(): void {
    let placeholder = document.getElementById(ElementIds.TERMINAL_PLACEHOLDER);
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.id = ElementIds.TERMINAL_PLACEHOLDER;
      placeholder.className = CssClasses.TERMINAL_PLACEHOLDER;

      // SECURITY: Build DOM structure safely to prevent XSS
      const contentDiv = document.createElement('div');
      contentDiv.className = CssClasses.PLACEHOLDER_CONTENT;

      const iconDiv = document.createElement('div');
      iconDiv.className = CssClasses.PLACEHOLDER_ICON;
      iconDiv.textContent = PlaceholderContent.ICON;

      const titleDiv = document.createElement('div');
      titleDiv.className = CssClasses.PLACEHOLDER_TITLE;
      titleDiv.textContent = PlaceholderContent.TITLE;

      const subtitleDiv = document.createElement('div');
      subtitleDiv.className = CssClasses.PLACEHOLDER_SUBTITLE;
      subtitleDiv.textContent = PlaceholderContent.SUBTITLE;

      contentDiv.appendChild(iconDiv);
      contentDiv.appendChild(titleDiv);
      contentDiv.appendChild(subtitleDiv);
      placeholder.appendChild(contentDiv);

      const terminalContainer = document.getElementById(ElementIds.TERMINAL_CONTAINER);
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
    const placeholder = document.getElementById(ElementIds.TERMINAL_PLACEHOLDER);
    if (placeholder) {
      placeholder.style.display = 'none';
      uiLogger.info('Terminal placeholder hidden');
    }
  }

  /**
   * Create loading indicator for terminal operations
   */
  public showLoadingIndicator(message: string = PlaceholderContent.DEFAULT_LOADING_MESSAGE): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = CssClasses.LOADING_INDICATOR;

    // SECURITY: Build DOM structure safely to prevent XSS
    const spinnerDiv = document.createElement('div');
    spinnerDiv.className = CssClasses.LOADING_SPINNER;

    const messageDiv = document.createElement('div');
    messageDiv.className = CssClasses.LOADING_MESSAGE;
    messageDiv.textContent = message; // Safe: textContent escapes HTML

    indicator.appendChild(spinnerDiv);
    indicator.appendChild(messageDiv);

    const terminalContainer = document.getElementById(ElementIds.TERMINAL_CONTAINER);
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
      const indicators = document.querySelectorAll(`.${CssClasses.LOADING_INDICATOR}`);
      indicators.forEach((el) => el.remove());
    }
    uiLogger.info('Loading indicator hidden');
  }

  /**
   * Check if terminal placeholder is currently visible
   */
  public isPlaceholderVisible(): boolean {
    const placeholder = document.getElementById(ElementIds.TERMINAL_PLACEHOLDER);
    return placeholder !== null && placeholder.style.display !== 'none';
  }

  /**
   * Check if loading indicator is currently visible
   */
  public hasLoadingIndicator(): boolean {
    return document.querySelectorAll(`.${CssClasses.LOADING_INDICATOR}`).length > 0;
  }
}
