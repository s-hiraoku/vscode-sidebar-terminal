/**
 * DOM操作のユーティリティクラス
 */
/* eslint-disable @typescript-eslint/no-namespace */
export namespace DOMUtils {
  /**
   * 要素を作成してスタイルを適用
   */
  export function createElement<T extends keyof HTMLElementTagNameMap>(
    tagName: T,
    styles?: Partial<CSSStyleDeclaration>,
    attributes?: Record<string, string>
  ): HTMLElementTagNameMap[T] {
    const element = document.createElement(tagName);

    if (styles) {
      Object.assign(element.style, styles);
    }

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'textContent') {
          element.textContent = value;
        } else if (key === 'innerHTML') {
          // SECURITY: innerHTML is blocked to prevent XSS vulnerabilities
          // Use textContent instead, or build DOM structure with createElement/appendChild
          console.warn(
            '[SECURITY] DOMUtils.createElement: innerHTML attribute is not supported. Use textContent instead.'
          );
          element.textContent = value;
        } else if (key === 'className') {
          element.className = value;
        } else {
          element.setAttribute(key, value);
        }
      });
    }

    return element;
  }

  /**
   * CSS文字列から要素にスタイルを適用
   */
  export function applyStyleString(element: HTMLElement, cssText: string): void {
    element.style.cssText = cssText;
  }

  /**
   * 要素を安全に削除
   */
  export function safeRemove(element: HTMLElement | null): void {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * 要素が存在するかチェック
   */
  export function exists(selector: string): boolean {
    return document.querySelector(selector) !== null;
  }

  /**
   * 要素を取得（存在しない場合はnull）
   */
  export function getElement<T extends HTMLElement>(selector: string): T | null {
    return document.querySelector(selector);
  }

  /**
   * 要素を取得（存在しない場合は作成）
   */
  export function getOrCreateElement<T extends keyof HTMLElementTagNameMap>(
    selector: string,
    tagName: T,
    parent?: HTMLElement
  ): HTMLElementTagNameMap[T] {
    let element = document.querySelector(selector) as HTMLElementTagNameMap[T];

    if (!element) {
      element = document.createElement(tagName);
      element.id = selector.replace('#', '');

      if (parent) {
        parent.appendChild(element);
      }
    }

    return element;
  }

  /**
   * イベントリスナーを安全に追加
   */
  export function addEventListenerSafe<K extends keyof HTMLElementEventMap>(
    element: HTMLElement | null,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (element) {
      element.addEventListener(type, listener, options);
    }
  }

  /**
   * 複数の子要素を一度に追加
   */
  export function appendChildren(parent: HTMLElement, ...children: HTMLElement[]): void {
    children.forEach((child) => parent.appendChild(child));
  }

  /**
   * 要素を最初の子として挿入
   */
  export function prependChild(parent: HTMLElement, child: HTMLElement): void {
    if (parent.firstChild) {
      parent.insertBefore(child, parent.firstChild);
    } else {
      parent.appendChild(child);
    }
  }

  /**
   * CSS変数を設定
   */
  export function setCSSVariable(name: string, value: string): void {
    document.documentElement.style.setProperty(`--${name}`, value);
  }

  /**
   * CSS変数を取得
   */
  export function getCSSVariable(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  }

  /**
   * xterm.js internal element selectors that need style reset
   * These elements get fixed pixel widths set by xterm.js which prevents expansion
   *
   * 🔧 CRITICAL: xterm.js sets inline styles on these elements:
   * - .xterm: width and height in pixels
   * - .xterm-viewport: width and height in pixels
   * - .xterm-screen: width and height in pixels
   * - canvas elements: width and height attributes AND inline styles
   */
  const XTERM_STYLE_RESET_SELECTORS = [
    '.terminal-content',
    '.xterm',
    '.xterm-viewport',
    '.xterm-screen',
  ] as const;

  /**
   * Reset xterm.js internal element inline styles
   *
   * xterm.js sets fixed pixel widths on internal elements which prevents
   * the terminal from expanding beyond its initial size. This function
   * clears those inline styles to allow CSS flex/100% to work properly.
   *
   * 🔧 CRITICAL: This is called BEFORE fitAddon.fit() to allow terminal expansion.
   * xterm.js sets these inline styles which override CSS:
   * - .xterm: style="width: Xpx; height: Ypx"
   * - .xterm-viewport: style="width: Xpx; height: Ypx"
   * - .xterm-screen: style="width: Xpx; height: Ypx"
   * - canvas elements: width/height attributes AND inline styles
   *
   * By clearing these, we allow CSS (width: 100%, flex: 1) to determine size,
   * then fit() will recalculate based on new container dimensions.
   *
   * @param container - The terminal container element
   * @param forceReflow - Whether to force a browser layout reflow (default: true)
   * @returns true if styles were reset, false if container is null
   */
  export function resetXtermInlineStyles(
    container: HTMLElement | null,
    forceReflow = true
  ): boolean {
    if (!container) {
      return false;
    }

    // 🔧 CRITICAL FIX: Reset the container itself first
    // The container (.terminal-container) may have fixed width from previous fit()
    container.style.width = '';
    container.style.maxWidth = '';
    container.style.minWidth = '';

    // Reset inline styles on known xterm.js elements
    for (const selector of XTERM_STYLE_RESET_SELECTORS) {
      const element = container.querySelector(selector) as HTMLElement;
      if (element) {
        element.style.width = '';
        element.style.height = '';
        element.style.maxWidth = '';
        element.style.minWidth = '';
      }
    }

    // 🔧 CRITICAL FIX: Also reset the container's own max-width if set
    // Some parent containers may have max-width constraints
    const terminalContent = container.querySelector('.terminal-content') as HTMLElement;
    if (terminalContent) {
      terminalContent.style.maxWidth = '';
      terminalContent.style.width = '';
    }

    // 🔧 FIX: Reset the xterm element's maxWidth as well
    const xtermElement = container.querySelector('.xterm') as HTMLElement;
    if (xtermElement) {
      xtermElement.style.maxWidth = '';
      xtermElement.style.minWidth = '';
      xtermElement.style.width = '';
      xtermElement.style.height = '';
    }

    // 🔧 CRITICAL FIX: Reset xterm-viewport - this is the scrollable container
    // FitAddon uses this element's dimensions for calculation
    const xtermViewport = container.querySelector('.xterm-viewport') as HTMLElement;
    if (xtermViewport) {
      xtermViewport.style.width = '';
      xtermViewport.style.height = '';
      xtermViewport.style.maxWidth = '';
      xtermViewport.style.minWidth = '';
    }

    // 🔧 CRITICAL FIX: Reset xterm-screen - this contains the canvas layers
    const xtermScreen = container.querySelector('.xterm-screen') as HTMLElement;
    if (xtermScreen) {
      xtermScreen.style.width = '';
      xtermScreen.style.height = '';
      xtermScreen.style.maxWidth = '';
      xtermScreen.style.minWidth = '';
    }

    // 🔧 CRITICAL FIX: DO NOT reset canvas inline styles!
    // xterm.js sets inline styles on canvas elements for precise display size:
    // - style="width: XXXpx; height: YYYpx" - controls display size
    // - width/height attributes - controls rendering resolution
    //
    // Clearing inline styles breaks cursor and decoration rendering on macOS.
    // The container styles (.xterm-screen, .xterm-viewport) with width: 100%
    // are sufficient for expansion. Let fitAddon.fit() handle canvas sizing.
    //
    // Previous code that cleared canvas styles has been removed:
    // const canvasElements = container.querySelectorAll('.xterm-screen canvas');
    // canvasElements.forEach((canvas) => { canvasEl.style.width = ''; ... });

    // 🔧 FIX: Also reset xterm-rows element which contains the actual rendered text
    const xtermRows = container.querySelector('.xterm-rows') as HTMLElement;
    if (xtermRows) {
      xtermRows.style.width = '';
    }

    // 🔧 FIX: Reset parent elements that may have fixed widths
    // terminals-wrapper may have been set with fixed dimensions
    const terminalsWrapper = document.getElementById('terminals-wrapper');
    if (terminalsWrapper) {
      terminalsWrapper.style.width = '';
      terminalsWrapper.style.maxWidth = '';
    }

    // 🔧 CRITICAL FIX: Reset .xterm-helpers as well
    // This element may also have fixed dimensions set by xterm.js
    const xtermHelpers = container.querySelector('.xterm-helpers') as HTMLElement;
    if (xtermHelpers) {
      xtermHelpers.style.width = '';
    }

    // 🔧 CRITICAL FIX: Reset terminal-split-wrapper parent if it exists
    // Split layout may have fixed widths
    const splitWrapper = container.closest('.terminal-split-wrapper') as HTMLElement;
    if (splitWrapper) {
      splitWrapper.style.width = '';
      splitWrapper.style.maxWidth = '';
      splitWrapper.style.minWidth = '';
    }

    // 🔧 CRITICAL FIX: Reset terminal-area wrapper if it exists (in split layout)
    // This element wraps the terminal container and may have fixed dimensions
    const terminalArea = container.closest('[data-terminal-area-id]') as HTMLElement;
    if (terminalArea) {
      terminalArea.style.width = '';
      terminalArea.style.maxWidth = '';
      terminalArea.style.minWidth = '';
      terminalArea.style.height = '';
    }

    // Force browser layout reflow to ensure new sizes are calculated
    if (forceReflow) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      container.offsetHeight;
      // Also read clientWidth to force horizontal reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      container.clientWidth;
    }

    return true;
  }
}
