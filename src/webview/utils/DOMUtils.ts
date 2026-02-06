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
   * Clear width/height/maxWidth/minWidth inline styles from an element.
   */
  function clearDimensionStyles(el: HTMLElement): void {
    el.style.width = '';
    el.style.height = '';
    el.style.maxWidth = '';
    el.style.minWidth = '';
  }

  /**
   * Selector cache: avoids repeated querySelector calls on the same container.
   * Uses WeakMap so entries are automatically GC'd when the container is removed from DOM.
   */
  const selectorCache = new WeakMap<
    HTMLElement,
    Map<string, HTMLElement | null>
  >();

  /**
   * Query a selector within a container, using a WeakMap cache to avoid repeated DOM queries.
   * Cache is per-container so it's automatically cleaned up when the container is GC'd.
   */
  function cachedQuery(container: HTMLElement, selector: string): HTMLElement | null {
    let cache = selectorCache.get(container);
    if (!cache) {
      cache = new Map();
      selectorCache.set(container, cache);
    }
    if (cache.has(selector)) {
      const cached = cache.get(selector)!;
      // Validate the cached element is still in the container (prevents stale references)
      if (cached === null || container.contains(cached)) {
        return cached;
      }
      // Stale — re-query
    }
    const result = container.querySelector(selector) as HTMLElement | null;
    cache.set(selector, result);
    return result;
  }

  /**
   * Invalidate the selector cache for a container.
   * Call this when the container's DOM structure changes (e.g., terminal removal).
   */
  export function invalidateSelectorCache(container: HTMLElement): void {
    selectorCache.delete(container);
  }

  /**
   * Reset xterm.js internal element inline styles (optimized).
   *
   * Consolidates all DOM queries into cached single-pass operations and
   * reduces forced browser reflows from 2 to 1.
   *
   * xterm.js sets fixed pixel widths on internal elements which prevents
   * the terminal from expanding beyond its initial size. This function
   * clears those inline styles to allow CSS flex/100% to work properly.
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

    // Reset container itself
    container.style.width = '';
    container.style.maxWidth = '';
    container.style.minWidth = '';

    // Batch all child element queries using cache
    const xtermEl = cachedQuery(container, '.xterm');
    const viewport = cachedQuery(container, '.xterm-viewport');
    const screen = cachedQuery(container, '.xterm-screen');
    const terminalContent = cachedQuery(container, '.terminal-content');
    const xtermRows = cachedQuery(container, '.xterm-rows');
    const xtermHelpers = cachedQuery(container, '.xterm-helpers');

    // Reset dimension styles on all xterm internal elements in one pass
    if (terminalContent) { clearDimensionStyles(terminalContent); }
    if (xtermEl) {
      clearDimensionStyles(xtermEl);
      // Copy background color from viewport to eliminate visible gap
      if (viewport && viewport.style.backgroundColor) {
        xtermEl.style.backgroundColor = viewport.style.backgroundColor;
      }
    }
    if (viewport) { clearDimensionStyles(viewport); }
    if (screen) { clearDimensionStyles(screen); }
    if (xtermRows) { xtermRows.style.width = ''; }
    if (xtermHelpers) { xtermHelpers.style.width = ''; }

    // Reset canvas elements (not cached — NodeList changes with addons)
    const canvasElements = screen?.querySelectorAll('canvas');
    if (canvasElements) {
      canvasElements.forEach((canvas) => {
        (canvas as HTMLCanvasElement).style.width = '100%';
      });
    }

    // Reset parent/wrapper elements (outside container — not cached in WeakMap)
    const terminalsWrapper = document.getElementById('terminals-wrapper');
    if (terminalsWrapper) {
      terminalsWrapper.style.width = '';
      terminalsWrapper.style.maxWidth = '';
    }

    const splitWrapper = container.closest('.terminal-split-wrapper') as HTMLElement;
    if (splitWrapper) {
      clearDimensionStyles(splitWrapper);
    }

    const terminalArea = container.closest('[data-terminal-area-id]') as HTMLElement;
    if (terminalArea) {
      clearDimensionStyles(terminalArea);
    }

    // Single forced reflow (reduced from 2 reads to 1)
    if (forceReflow) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      container.offsetHeight;
    }

    return true;
  }

  /**
   * Schedule an xterm style reset on the next animation frame.
   * Coalesces multiple calls for the same container within a single frame.
   *
   * @param container - The terminal container element
   * @returns true if scheduled, false if container is null
   */
  const pendingResets = new WeakSet<HTMLElement>();

  export function scheduleXtermStyleReset(container: HTMLElement | null): boolean {
    if (!container) {
      return false;
    }
    if (pendingResets.has(container)) {
      return true; // Already scheduled for this frame
    }
    pendingResets.add(container);
    requestAnimationFrame(() => {
      pendingResets.delete(container);
      resetXtermInlineStyles(container, true);
    });
    return true;
  }

  /**
   * Clear split-related inline height styles from a container.
   * Used when transitioning between display modes (split -> fullscreen/normal).
   *
   * @param container - The terminal container element
   */
  export function clearContainerHeightStyles(container: HTMLElement): void {
    container.style.removeProperty('height');
    container.style.removeProperty('flex-basis');
    container.style.removeProperty('flex');
    container.style.removeProperty('max-height');
  }

  /**
   * Force browser reflow by reading offsetHeight.
   * Call this after CSS changes to ensure layout is recalculated before reading dimensions.
   *
   * @param element - Element to read offsetHeight from (defaults to document.body)
   */
  export function forceReflow(element?: HTMLElement | null): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (element ?? document.body).offsetHeight;
  }
}
