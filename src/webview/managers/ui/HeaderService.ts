/**
 * Header Service
 *
 * Extracted from UIManager for better maintainability.
 * Handles terminal header creation, caching, and DOM operations.
 */

import { HeaderFactory, TerminalHeaderElements } from '../../factories/HeaderFactory';
import { uiLogger } from '../../utils/ManagerLogger';
import { webview as log } from '../../../utils/logger';

// ============================================================================
// Constants
// ============================================================================

/** Header dimension constants */
const HeaderDimensions = {
  MIN_HEIGHT: '28px',
  Z_INDEX: '10',
} as const;

/** CSS class names for headers */
const HeaderCssClasses = {
  TERMINAL_HEADER: 'terminal-header',
} as const;

/** Theme-related constants */
const HeaderThemeColors = {
  LIGHT_FOREGROUND: '#000000',
  BORDER_OPACITY_SUFFIX: '33',
} as const;

/**
 * Service for managing terminal headers
 */
export class HeaderService {
  /** Cache for header elements (for efficient updates) */
  private headerElementsCache = new Map<string, TerminalHeaderElements>();

  /**
   * Get the header elements cache (for external access by UIManager)
   */
  public getHeaderElementsCache(): Map<string, TerminalHeaderElements> {
    return this.headerElementsCache;
  }

  /**
   * Create terminal header with title and controls
   */
  public createTerminalHeader(
    terminalId: string,
    terminalName: string,
    options: {
      currentTheme?: string | null;
      onAiAgentToggleClick?: (terminalId: string) => void;
    } = {}
  ): HTMLElement {
    // DEBUG: Enhanced header creation logging
    log(`🔍 [DEBUG] Creating terminal header:`, {
      terminalId,
      terminalName,
      timestamp: Date.now(),
    });

    // Determine theme colors based on current theme
    const isLight = options.currentTheme ? this.isLightBackground(options.currentTheme) : false;
    const backgroundColor = options.currentTheme || undefined;
    const foregroundColor = isLight ? HeaderThemeColors.LIGHT_FOREGROUND : undefined;

    // Use HeaderFactory to create the header structure
    const headerElements = HeaderFactory.createTerminalHeader({
      terminalId,
      terminalName,
      onAiAgentToggleClick: options.onAiAgentToggleClick,
      backgroundColor,
      foregroundColor,
    });

    // FIX: Ensure header visibility with explicit styling
    const container = headerElements.container;
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('visibility', 'visible', 'important');
    container.style.setProperty('opacity', '1', 'important');
    container.style.setProperty('height', 'auto', 'important');
    container.style.setProperty('min-height', HeaderDimensions.MIN_HEIGHT, 'important');
    container.style.setProperty('z-index', HeaderDimensions.Z_INDEX, 'important');

    // DEBUG: Log header creation success
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

    // Cache header elements for efficient updates
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
      // Use HeaderFactory to update the name
      HeaderFactory.updateTerminalName(headerElements, newName);
    } else {
      // Fallback: Update DOM directly
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
   * Find all terminal headers in the DOM
   */
  public findTerminalHeaders(): HTMLElement[] {
    const headers = Array.from(
      document.querySelectorAll<HTMLElement>(`.${HeaderCssClasses.TERMINAL_HEADER}`)
    );
    uiLogger.debug(`Found ${headers.length} terminal headers`);
    return headers;
  }

  /**
   * Get cached header elements for a specific terminal
   */
  public getHeaderElements(terminalId: string): TerminalHeaderElements | undefined {
    return this.headerElementsCache.get(terminalId);
  }

  /**
   * Check if a terminal header is cached
   */
  public hasHeaderElements(terminalId: string): boolean {
    return this.headerElementsCache.has(terminalId);
  }

  /**
   * Get the number of cached headers
   */
  public getCacheSize(): number {
    return this.headerElementsCache.size;
  }

  /**
   * Update header theme colors for a specific terminal
   */
  public updateHeaderThemeColors(
    terminalId: string,
    backgroundColor: string,
    foregroundColor: string
  ): void {
    const elements = this.headerElementsCache.get(terminalId);
    if (!elements) return;

    const container = elements.container;
    const borderColor = foregroundColor + HeaderThemeColors.BORDER_OPACITY_SUFFIX;

    // Update header background and foreground
    container.style.backgroundColor = backgroundColor;
    container.style.color = foregroundColor;
    container.style.borderBottomColor = borderColor;

    // Update terminal name text color explicitly
    if (elements.nameSpan) {
      elements.nameSpan.style.color = foregroundColor;
    }

    // Update title section color
    if (elements.titleSection) {
      elements.titleSection.style.color = foregroundColor;
    }

    // Update button colors
    if (elements.closeButton) {
      elements.closeButton.style.color = foregroundColor;
    }
    if (elements.aiAgentToggleButton) {
      elements.aiAgentToggleButton.style.color = foregroundColor;
    }
    if (elements.splitButton) {
      elements.splitButton.style.color = foregroundColor;
    }

    uiLogger.debug(`Updated header theme for terminal ${terminalId}`);
  }

  /**
   * Update all cached header theme colors
   */
  public updateAllHeaderThemeColors(backgroundColor: string, foregroundColor: string): void {
    this.headerElementsCache.forEach((_, terminalId) => {
      this.updateHeaderThemeColors(terminalId, backgroundColor, foregroundColor);
    });
    uiLogger.info(`Updated ${this.headerElementsCache.size} headers to match terminal theme`);
  }

  /**
   * Update all terminal headers using VS Code CSS variables (fallback for uncached)
   */
  public updateHeadersFromCssVariables(headerBg: string, headerFg: string): void {
    // Update from cache
    this.headerElementsCache.forEach((headerElements) => {
      if (headerElements.container) {
        if (headerBg) {
          headerElements.container.style.backgroundColor = headerBg;
        }
        if (headerFg) {
          headerElements.container.style.color = headerFg;
        }
        if (headerElements.nameSpan && headerFg) {
          headerElements.nameSpan.style.color = headerFg;
        }
      }
    });

    // Also update all terminal headers by CSS class (fallback for uncached elements)
    const allTerminalHeaders = document.querySelectorAll(`.${HeaderCssClasses.TERMINAL_HEADER}`);
    allTerminalHeaders.forEach((header) => {
      const el = header as HTMLElement;
      if (headerBg) {
        el.style.backgroundColor = headerBg;
      }
      if (headerFg) {
        el.style.color = headerFg;
      }
    });

    log(`🎨 [UI] Updated ${allTerminalHeaders.length} terminal headers`);
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
}
