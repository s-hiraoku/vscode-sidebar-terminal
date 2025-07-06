/**
 * DOM操作のユーティリティクラス
 */
export class DOMUtils {
  /**
   * 要素を作成してスタイルを適用
   */
  public static createElement<T extends keyof HTMLElementTagNameMap>(
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
        element.setAttribute(key, value);
      });
    }
    
    return element;
  }

  /**
   * CSS文字列から要素にスタイルを適用
   */
  public static applyStyleString(element: HTMLElement, cssText: string): void {
    element.style.cssText = cssText;
  }

  /**
   * 要素を安全に削除
   */
  public static safeRemove(element: HTMLElement | null): void {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * 要素が存在するかチェック
   */
  public static exists(selector: string): boolean {
    return document.querySelector(selector) !== null;
  }

  /**
   * 要素を取得（存在しない場合はnull）
   */
  public static getElement<T extends HTMLElement>(selector: string): T | null {
    return document.querySelector(selector) as T | null;
  }

  /**
   * 要素を取得（存在しない場合は作成）
   */
  public static getOrCreateElement<T extends keyof HTMLElementTagNameMap>(
    selector: string,
    tagName: T,
    parent?: HTMLElement
  ): HTMLElementTagNameMap[T] {
    let element = document.querySelector(selector) as HTMLElementTagNameMap[T] | null;
    
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
  public static addEventListenerSafe<K extends keyof HTMLElementEventMap>(
    element: HTMLElement | null,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (element) {
      element.addEventListener(type, listener, options);
    }
  }

  /**
   * 複数の子要素を一度に追加
   */
  public static appendChildren(parent: HTMLElement, ...children: HTMLElement[]): void {
    children.forEach(child => parent.appendChild(child));
  }

  /**
   * 要素を最初の子として挿入
   */
  public static prependChild(parent: HTMLElement, child: HTMLElement): void {
    if (parent.firstChild) {
      parent.insertBefore(child, parent.firstChild);
    } else {
      parent.appendChild(child);
    }
  }

  /**
   * CSS変数を設定
   */
  public static setCSSVariable(name: string, value: string): void {
    document.documentElement.style.setProperty(`--${name}`, value);
  }

  /**
   * CSS変数を取得
   */
  public static getCSSVariable(name: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--${name}`)
      .trim();
  }
}