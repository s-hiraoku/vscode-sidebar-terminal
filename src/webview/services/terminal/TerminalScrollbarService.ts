/**
 * Terminal Scrollbar Service
 *
 * Extracted from TerminalCreationService for better maintainability.
 * Handles VS Code standard scrollbar styling and viewport configuration.
 */

import { terminalLogger } from '../../utils/ManagerLogger';

/**
 * Service for managing terminal scrollbar display and styling
 */
export class TerminalScrollbarService {
  private static stylesInjected = false;

  /**
   * Enable VS Code standard scrollbar display for terminal
   */
  public enableScrollbarDisplay(xtermElement: Element | null, terminalId: string): void {
    if (!xtermElement) return;

    try {
      const viewport = xtermElement.querySelector('.xterm-viewport') as HTMLElement;
      const screen = xtermElement.querySelector('.xterm-screen') as HTMLElement;

      if (!viewport) {
        terminalLogger.warn(`Viewport not found for terminal ${terminalId}`);
        return;
      }

      // Apply VS Code standard viewport settings for maximum display area
      viewport.style.overflow = 'auto';
      viewport.style.scrollbarWidth = 'auto';
      viewport.style.position = 'absolute';
      viewport.style.top = '0';
      viewport.style.left = '0';
      viewport.style.right = '0';
      viewport.style.bottom = '0';

      // Ensure screen uses full available space
      if (screen) {
        screen.style.position = 'relative';
        screen.style.width = '100%';
        screen.style.height = '100%';
      }

      // Inject scrollbar styles once
      this.injectScrollbarStyles();

      terminalLogger.info(`VS Code standard full viewport and scrollbar enabled for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.error(`Failed to enable scrollbar for terminal ${terminalId}:`, error);
    }
  }

  /**
   * Inject VS Code standard scrollbar CSS styles (only once)
   */
  private injectScrollbarStyles(): void {
    if (TerminalScrollbarService.stylesInjected) {
      return;
    }

    if (document.head.querySelector('#terminal-scrollbar-styles')) {
      TerminalScrollbarService.stylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = 'terminal-scrollbar-styles';
    style.textContent = this.getScrollbarStylesheet();
    document.head.appendChild(style);

    TerminalScrollbarService.stylesInjected = true;
  }

  /**
   * Get VS Code standard scrollbar stylesheet
   */
  private getScrollbarStylesheet(): string {
    return `
      /* VS Code Terminal - Full Display Area Implementation */
      .terminal-container {
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        height: 100% !important;
        position: relative !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .terminal-content {
        flex: 1 1 auto !important;
        width: 100% !important;
        height: 100% !important;
        position: relative !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
      }

      .terminal-container .xterm {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
      }

      .terminal-container .xterm-viewport {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        overflow: auto !important;
        background: transparent !important;
      }

      .terminal-container .xterm-screen {
        position: relative !important;
        width: 100% !important;
        min-height: 100% !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }

      .terminal-container .xterm .xterm-rows {
        padding: 0 !important;
        line-height: 1 !important;
      }

      /* Let xterm manage overlay positioning; overriding can misalign hitboxes */
      .terminal-container .xterm .xterm-link-layer,
      .terminal-container .xterm .xterm-selection-layer,
      .terminal-container .xterm .xterm-decoration-container {
        top: initial !important;
        left: initial !important;
      }

      /* VS Code Standard Scrollbar Styling - 14px width */
      .terminal-container .xterm-viewport::-webkit-scrollbar {
        width: 14px;
        height: 14px;
      }

      .terminal-container .xterm-viewport::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 0px;
      }

      .terminal-container .xterm-viewport::-webkit-scrollbar-thumb {
        background-color: rgba(121, 121, 121, 0.4);
        border-radius: 0px;
        border: 3px solid transparent;
        background-clip: content-box;
        min-height: 20px;
      }

      .terminal-container .xterm-viewport::-webkit-scrollbar-thumb:hover {
        background-color: rgba(100, 100, 100, 0.7);
      }

      .terminal-container .xterm-viewport::-webkit-scrollbar-thumb:active {
        background-color: rgba(68, 68, 68, 0.8);
      }

      .terminal-container .xterm-viewport::-webkit-scrollbar-corner {
        background: transparent;
      }

      /* Firefox scrollbar styling */
      .terminal-container .xterm-viewport {
        scrollbar-width: auto !important;
        scrollbar-color: rgba(121, 121, 121, 0.4) rgba(0, 0, 0, 0.1);
      }

      /* Ensure text selection is visible - do not override pointer events to keep native selection */
      .terminal-container .xterm .xterm-selection div {
        position: absolute;
        background-color: rgba(255, 255, 255, 0.3);
      }

      /* Override any existing height restrictions */
      #terminal-body,
      #terminal-body .terminal-container,
      #terminal-body .terminal-content {
        height: 100% !important;
        max-height: none !important;
      }
    `;
  }
}
