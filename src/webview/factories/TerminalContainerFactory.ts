/**
 * TerminalContainerFactory
 *
 * Centralized terminal container creation and styling to eliminate
 * code duplication across TerminalLifecycleCoordinator and SplitManager
 */

import { terminalLogger } from '../utils/ManagerLogger';
import { HeaderFactory, TerminalHeaderElements } from './HeaderFactory';

export interface TerminalContainerConfig {
  id: string;
  name: string;
  className?: string;
  height?: number;
  width?: number;
  isSplit?: boolean;
  isActive?: boolean;
  customStyles?: Partial<CSSStyleDeclaration>;
}

export interface TerminalHeaderConfig {
  showHeader?: boolean;
  showCloseButton?: boolean;
  showSplitButton?: boolean;
  customTitle?: string;
  onHeaderClick?: (terminalId: string) => void;
  onContainerClick?: (terminalId: string) => void;
  onCloseClick?: (terminalId: string) => void;
  onSplitClick?: (terminalId: string) => void;
  onAiAgentToggleClick?: (terminalId: string) => void;
}

export interface ContainerElements {
  container: HTMLElement;
  header?: HTMLElement;
  body: HTMLElement;
  closeButton?: HTMLElement;
  splitButton?: HTMLElement;
  headerElements?: TerminalHeaderElements; // AI Agent status support
}

/**
 * Factory for creating standardized terminal containers
 * Eliminates duplicate container creation and styling logic
 */
export class TerminalContainerFactory {
  private static readonly DEFAULT_STYLES = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      width: '100%',
      height: '100%',
      minHeight: '200px',
      margin: '0',
      padding: '0',
      position: 'relative' as const,
      // 🔧 FIX: Remove default border, let UIManager handle it
      // border: '2px solid transparent',  // REMOVED - UIManager will handle borders
      borderRadius: '4px',
      boxSizing: 'border-box' as const,
      flex: '1 1 auto',
    },
    body: {
      display: 'block',
      width: '100%',
      height: '100%',
      position: 'relative' as const,
      overflow: 'hidden',
      background: '#000',
      padding: '0', // VS Code standard - no padding for full display area
      margin: '0',
      boxSizing: 'border-box' as const,
      flex: '1 1 auto',
    },
    split: {
      height: 'auto',
      minHeight: '150px',
      border: '1px solid #444',
    },
    active: {
      borderColor: '#007ACC',
      boxShadow: '0 0 8px rgba(0, 122, 204, 0.3)',
    },
  };

  /**
   * Create a complete terminal container with optional header
   * @param config Container configuration
   * @param headerConfig Optional header configuration
   */
  static createContainer(
    config: TerminalContainerConfig,
    headerConfig: TerminalHeaderConfig = {}
  ): ContainerElements {
    terminalLogger.debug(`Creating container: ${config.id}`);

    try {
      // Create main container
      const container = this.createMainContainer(config);

      // Create header if requested
      let header: HTMLElement | undefined;
      let closeButton: HTMLElement | undefined;
      let headerElements: TerminalHeaderElements | undefined;

      if (headerConfig.showHeader) {
        // Use HeaderFactory to create AI Agent-compatible headers
        headerElements = HeaderFactory.createTerminalHeader({
          terminalId: config.id,
          terminalName: headerConfig.customTitle || config.name,
          showSplitButton: headerConfig.showSplitButton,
          onHeaderClick: headerConfig.onHeaderClick,
          onCloseClick: headerConfig.onCloseClick,
          onSplitClick: headerConfig.onSplitClick,
          onAiAgentToggleClick: headerConfig.onAiAgentToggleClick,
        });
        header = headerElements.container;
        closeButton = headerElements.closeButton;
        container.appendChild(header);

        terminalLogger.info(`AI Agent-compatible header created for ${config.id}`);
      }

      // Create terminal body
      const body = this.createTerminalBody(config);
      container.appendChild(body);

      // 🔧 VS CODE STANDARD: Proper click handling for both header and split terminals
      if (headerConfig.onContainerClick) {
        if (header) {
          // For terminals with headers: only activate on header clicks
          header.addEventListener('click', (event: MouseEvent) => {
            // Only activate if clicking on the header itself, not buttons
            const target = event.target as HTMLElement;
            if (target.closest('.terminal-control')) {
              return;
            }

            headerConfig.onContainerClick!(config.id);
            terminalLogger.info(`🎯 Header area clicked, activating terminal: ${config.id}`);
          });
          terminalLogger.info(`Header click activation enabled for terminal: ${config.id}`);
        } else {
          // For split terminals without headers: Use VS Code standard approach
          // The TerminalLifecycleCoordinator will handle xterm.js hasSelection() logic
          // This preserves the onContainerClick functionality while allowing text selection
          terminalLogger.info(`Split terminal will use xterm hasSelection() logic: ${config.id}`);
        }
      }

      // 🔧 FIX: Don't append here! Let TerminalCreationService handle DOM append
      // after terminal.open() is called. Appending before terminal setup causes issues.
      // this.appendToMainContainer(container);  // REMOVED

      const elements: ContainerElements = {
        container,
        header,
        body,
        closeButton,
        splitButton: headerElements?.splitButton || undefined,
        headerElements,
      };

      terminalLogger.info(`Container created successfully: ${config.id}`);
      return elements;
    } catch (error) {
      terminalLogger.error(`Failed to create container ${config.id}:`, error);
      throw error;
    }
  }

  /**
   * Create the main container element
   */
  private static createMainContainer(config: TerminalContainerConfig): HTMLElement {
    const container = document.createElement('div');

    // Set basic attributes
    container.className = config.className || 'terminal-container';
    container.setAttribute('data-terminal-id', config.id);
    container.setAttribute('data-terminal-name', config.name);

    // Apply base styles
    this.applyStyles(container, this.DEFAULT_STYLES.container);

    // Apply split-specific styles
    if (config.isSplit) {
      this.applyStyles(container, this.DEFAULT_STYLES.split);

      if (config.height) {
        container.style.height = `${config.height}px`;
      }
    }

    // Apply active state styles
    if (config.isActive) {
      this.applyStyles(container, this.DEFAULT_STYLES.active);
    }

    // Apply custom styles
    if (config.customStyles) {
      this.applyStyles(container, config.customStyles);
    }

    return container;
  }

  // Removed: createHeader method - now using HeaderFactory for AI Agent support

  // Removed: createHeaderButton method - now using HeaderFactory for AI Agent support

  /**
   * Create the terminal body element
   */
  private static createTerminalBody(_config: TerminalContainerConfig): HTMLElement {
    const body = document.createElement('div');
    body.className = 'terminal-content';

    // Apply base body styles
    this.applyStyles(body, this.DEFAULT_STYLES.body);

    return body;
  }

  /**
   * Update container styles for active state
   */
  static setActiveState(container: HTMLElement, isActive: boolean): void {
    if (isActive) {
      this.applyStyles(container, this.DEFAULT_STYLES.active);
      container.setAttribute('data-active', 'true');
    } else {
      container.style.borderColor = 'transparent';
      container.style.boxShadow = 'none';
      container.removeAttribute('data-active');
    }
  }

  /**
   * Update container for split mode
   */
  static configureSplitMode(container: HTMLElement, height: number): void {
    this.applyStyles(container, this.DEFAULT_STYLES.split);
    container.style.height = `${height}px`;
    container.setAttribute('data-split', 'true');
  }

  /**
   * Remove split mode configuration
   */
  static removeFromSplitMode(container: HTMLElement): void {
    container.style.height = '100%';
    container.style.minHeight = '200px';
    container.style.border = '2px solid transparent';
    container.removeAttribute('data-split');
  }

  /**
   * Apply custom theme to container
   */
  static applyTheme(
    container: HTMLElement,
    theme: {
      background?: string;
      borderColor?: string;
      activeBorderColor?: string;
    }
  ): void {
    if (theme.background) {
      container.style.background = theme.background;

      // Also update body background
      const body = container.querySelector('.terminal-content') as HTMLElement;
      if (body) {
        body.style.background = theme.background;
      }
    }

    if (theme.borderColor) {
      container.style.borderColor = theme.borderColor;
    }

    // Update active border color if this container is active
    if (container.hasAttribute('data-active') && theme.activeBorderColor) {
      container.style.borderColor = theme.activeBorderColor;
    }
  }

  /**
   * Get the main container element to append terminals to
   */
  private static getMainContainer(): HTMLElement {
    return document.getElementById('terminal-body') || document.body;
  }

  /**
   * Append container to the main terminal container
   */
  private static appendToMainContainer(container: HTMLElement): void {
    const mainContainer = this.getMainContainer();
    mainContainer.appendChild(container);
  }

  /**
   * Utility method to apply styles to an element
   */
  private static applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
    Object.assign(element.style, styles);
  }

  /**
   * Create a lightweight container for testing or special cases
   */
  static createSimpleContainer(id: string, name: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'terminal-container-simple';
    container.setAttribute('data-terminal-id', id);
    container.setAttribute('data-terminal-name', name);

    this.applyStyles(container, {
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      padding: '8px',
    });

    return container;
  }

  /**
   * Clean up container and remove from DOM
   */
  static destroyContainer(container: HTMLElement): void {
    try {
      const terminalId = container.getAttribute('data-terminal-id');

      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }

      terminalLogger.info(`Container destroyed: ${terminalId}`);
    } catch (error) {
      terminalLogger.error('Failed to destroy container:', error);
    }
  }
}
