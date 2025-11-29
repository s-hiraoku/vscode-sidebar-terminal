/**
 * Terminal Scroll-To-Bottom Indicator Service
 *
 * Aligns with VS Code standard terminal behaviour: when the user scrolls
 * away from the bottom, a small pill-style button appears in the bottom-right
 * corner to jump back to the latest output.
 */

import { Terminal } from '@xterm/xterm';
import { terminalLogger } from '../../utils/ManagerLogger';

type DisposableFn = () => void;

export class TerminalScrollIndicatorService {
  private static stylesInjected = false;

  /**
   * Attach scroll-to-bottom indicator to the given terminal/container.
   * Returns a cleanup function that removes listeners and DOM nodes.
   */
  public attach(terminal: Terminal, container: HTMLElement, terminalId: string): DisposableFn {
    try {
      const content = (container.querySelector('.terminal-content') as HTMLElement) ?? container;
      const viewport = container.querySelector('.xterm-viewport') as HTMLElement | null;

      if (!viewport) {
        terminalLogger.warn(`Scroll indicator skipped: viewport missing for ${terminalId}`);
        return () => {};
      }

      this.injectStyles();

      const indicator = document.createElement('button');
      indicator.type = 'button';
      indicator.className = 'terminal-scroll-indicator';
      indicator.setAttribute('aria-label', 'Scroll to bottom');
      indicator.innerHTML = `<span class="indicator-icon">▼</span><span class="indicator-text">Scroll</span>`;

      content.appendChild(indicator);

      const threshold = 2; // px tolerance for "at bottom"

      const isAtBottom = (): boolean =>
        viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - threshold;

      const updateVisibility = () => {
        const visible = !isAtBottom();
        indicator.classList.toggle('visible', visible);
      };

      const onViewportScroll = () => updateVisibility();
      viewport.addEventListener('scroll', onViewportScroll, { passive: true });

      const xtermScrollDisposable = terminal.onScroll(updateVisibility);

      const onClick = () => {
        try {
          terminal.scrollToBottom();
          viewport.scrollTop = viewport.scrollHeight;
          updateVisibility();
        } catch (error) {
          terminalLogger.warn(`Scroll indicator click failed for ${terminalId}:`, error);
        }
      };
      indicator.addEventListener('click', onClick);

      // Initial state
      updateVisibility();

      return () => {
        indicator.removeEventListener('click', onClick);
        viewport.removeEventListener('scroll', onViewportScroll);
        xtermScrollDisposable.dispose();
        indicator.remove();
      };
    } catch (error) {
      terminalLogger.error(`Failed to attach scroll indicator for ${terminalId}:`, error);
      return () => {};
    }
  }

  /**
   * Injects CSS once for the indicator button.
   */
  private injectStyles(): void {
    if (TerminalScrollIndicatorService.stylesInjected) {
      return;
    }

    if (document.head.querySelector('#terminal-scroll-indicator-styles')) {
      TerminalScrollIndicatorService.stylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = 'terminal-scroll-indicator-styles';
    style.textContent = `
      .terminal-scroll-indicator {
        position: absolute;
        right: 12px;
        bottom: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        font-size: 12px;
        line-height: 16px;
        background: var(--vscode-button-secondaryBackground, var(--vscode-button-background, #0e639c));
        color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground, #ffffff));
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transform: translateY(4px);
        transition: opacity 120ms ease, transform 120ms ease, background-color 120ms ease, border-color 120ms ease;
        z-index: 5;
      }

      .terminal-scroll-indicator.visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }

      .terminal-scroll-indicator:hover {
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground, #1177bb));
        border-color: var(--vscode-focusBorder, rgba(255, 255, 255, 0.2));
      }

      .terminal-scroll-indicator:active {
        transform: translateY(1px);
      }

      .terminal-scroll-indicator .indicator-icon {
        font-size: 14px;
        line-height: 14px;
      }
    `;

    document.head.appendChild(style);
    TerminalScrollIndicatorService.stylesInjected = true;
  }
}
