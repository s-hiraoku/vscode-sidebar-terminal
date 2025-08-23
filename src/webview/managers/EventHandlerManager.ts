/**
 * Event Handler Manager
 *
 * WebViewのイベント処理を管理
 * 責務：イベントリスナー登録・削除、イベント委譲、ライフサイクル管理
 */

import { webview as log } from '../../utils/logger';
import { WebviewMessage } from '../../types/common';

/**
 * イベントハンドラーの型定義
 */
export type EventHandler<T = Event> = (event: T) => void | Promise<void>;
export type MessageEventHandler = (event: MessageEvent<WebviewMessage>) => void | Promise<void>;

/**
 * イベント管理インターフェース
 */
interface RegisteredEventListener {
  element: EventTarget;
  eventType: string;
  handler: EventHandler;
  options?: boolean | AddEventListenerOptions;
}

/**
 * イベント処理管理クラス
 * WebViewの全イベント処理を一元管理
 */
export class EventHandlerManager {
  private registeredListeners: RegisteredEventListener[] = [];
  private messageHandler: MessageEventHandler | null = null;
  private isDisposed = false;

  constructor() {
    log('🎭 EventHandlerManager initialized');
  }

  /**
   * イベントリスナーを登録
   */
  public addEventListener<K extends keyof WindowEventMap>(
    element: Window,
    type: K,
    handler: (event: WindowEventMap[K]) => void | Promise<void>,
    options?: boolean | AddEventListenerOptions
  ): void;
  public addEventListener<K extends keyof DocumentEventMap>(
    element: Document,
    type: K,
    handler: (event: DocumentEventMap[K]) => void | Promise<void>,
    options?: boolean | AddEventListenerOptions
  ): void;
  public addEventListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void | Promise<void>,
    options?: boolean | AddEventListenerOptions
  ): void;
  public addEventListener(
    element: EventTarget,
    type: string,
    handler: EventHandler,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (this.isDisposed) {
      log('⚠️ Cannot add event listener - EventHandlerManager is disposed');
      return;
    }

    try {
      // ラップされたハンドラーでエラー処理
      const wrappedHandler: EventHandler = async (event) => {
        try {
          await handler(event);
        } catch (error) {
          log(`❌ Error in event handler for ${type}:`, error);
        }
      };

      element.addEventListener(type, wrappedHandler, options);

      // 登録されたリスナーを記録
      this.registeredListeners.push({
        element,
        eventType: type,
        handler: wrappedHandler,
        options,
      });

      log(`📡 Event listener registered: ${type}`);
    } catch (error) {
      log(`❌ Failed to register event listener for ${type}:`, error);
    }
  }

  /**
   * 特定のイベントリスナーを削除
   */
  public removeEventListener(element: EventTarget, type: string, handler: EventHandler): void {
    try {
      element.removeEventListener(type, handler);

      // 登録済みリストから削除
      this.registeredListeners = this.registeredListeners.filter(
        (listener) =>
          !(
            listener.element === element &&
            listener.eventType === type &&
            listener.handler === handler
          )
      );

      log(`📡 Event listener removed: ${type}`);
    } catch (error) {
      log(`❌ Failed to remove event listener for ${type}:`, error);
    }
  }

  /**
   * メッセージイベントハンドラーを設定
   */
  public setMessageEventHandler(handler: MessageEventHandler): void {
    if (this.messageHandler) {
      this.removeMessageEventHandler();
    }

    this.messageHandler = handler;

    // windowオブジェクトにメッセージリスナーを登録
    const wrappedMessageHandler: MessageEventHandler = async (event) => {
      try {
        await handler(event);
      } catch (error) {
        log('❌ Error in message event handler:', error);
      }
    };

    this.addEventListener(window, 'message', wrappedMessageHandler as EventHandler);

    log('📨 Message event handler registered');
  }

  /**
   * メッセージイベントハンドラーを削除
   */
  public removeMessageEventHandler(): void {
    if (this.messageHandler) {
      // 登録されたメッセージリスナーを検索・削除
      const messageListeners = this.registeredListeners.filter(
        (listener) => listener.element === window && listener.eventType === 'message'
      );

      for (const listener of messageListeners) {
        this.removeEventListener(listener.element, listener.eventType, listener.handler);
      }

      this.messageHandler = null;
      log('📨 Message event handler removed');
    }
  }

  /**
   * リサイズイベントハンドラーを設定 (レガシー - ResizeObserver推奨)
   */
  public setResizeEventHandler(handler: EventHandler<Event>): void {
    this.addEventListener(window, 'resize', handler);
    log('📏 Resize event handler registered (deprecated - use ResizeObserver)');
  }

  /**
   * フォーカスイベントハンドラーを設定
   */
  public setFocusEventHandlers(
    focusHandler?: EventHandler<FocusEvent>,
    blurHandler?: EventHandler<FocusEvent>
  ): void {
    if (focusHandler) {
      this.addEventListener(window, 'focus', focusHandler);
      log('🎯 Focus event handler registered');
    }

    if (blurHandler) {
      this.addEventListener(window, 'blur', blurHandler);
      log('🎯 Blur event handler registered');
    }
  }

  /**
   * キーボードイベントハンドラーを設定
   */
  public setKeyboardEventHandlers(
    keydownHandler?: EventHandler<KeyboardEvent>,
    keyupHandler?: EventHandler<KeyboardEvent>
  ): void {
    if (keydownHandler) {
      this.addEventListener(document, 'keydown', keydownHandler);
      log('⌨️ Keydown event handler registered');
    }

    if (keyupHandler) {
      this.addEventListener(document, 'keyup', keyupHandler);
      log('⌨️ Keyup event handler registered');
    }
  }

  /**
   * マウスイベントハンドラーを設定
   */
  public setMouseEventHandlers(
    clickHandler?: EventHandler<MouseEvent>,
    contextMenuHandler?: EventHandler<MouseEvent>
  ): void {
    if (clickHandler) {
      this.addEventListener(document, 'click', clickHandler);
      log('🖱️ Click event handler registered');
    }

    if (contextMenuHandler) {
      this.addEventListener(document, 'contextmenu', contextMenuHandler);
      log('🖱️ Context menu event handler registered');
    }
  }

  /**
   * DOM準備完了イベントの処理
   */
  public onDOMContentLoaded(handler: EventHandler): void {
    if (document.readyState === 'loading') {
      this.addEventListener(document, 'DOMContentLoaded', handler);
    } else {
      // 既にDOMが準備完了している場合は即座に実行
      setTimeout(() => handler(new Event('DOMContentLoaded')), 0);
    }
  }

  /**
   * ページ読み込み完了イベントの処理
   */
  public onPageLoaded(handler: EventHandler): void {
    if (document.readyState !== 'complete') {
      this.addEventListener(window, 'load', handler);
    } else {
      // 既にページが読み込み完了している場合は即座に実行
      setTimeout(() => handler(new Event('load')), 0);
    }
  }

  /**
   * ページ離脱イベントの処理
   */
  public onPageUnload(handler: EventHandler): void {
    this.addEventListener(window, 'beforeunload', handler);
    this.addEventListener(window, 'unload', handler);
    log('🚪 Page unload handlers registered');
  }

  /**
   * カスタムイベントの発行
   */
  public dispatchCustomEvent(
    eventType: string,
    detail?: unknown,
    target: EventTarget = window
  ): void {
    try {
      const customEvent = new CustomEvent(eventType, {
        detail,
        bubbles: true,
        cancelable: true,
      });

      target.dispatchEvent(customEvent);
      log(`🚀 Custom event dispatched: ${eventType}`);
    } catch (error) {
      log(`❌ Failed to dispatch custom event ${eventType}:`, error);
    }
  }

  /**
   * 全イベントリスナーの統計情報
   */
  public getEventStats(): {
    totalListeners: number;
    eventTypes: string[];
    targets: string[];
  } {
    const eventTypes = Array.from(
      new Set(this.registeredListeners.map((listener) => listener.eventType))
    );

    const targets = Array.from(
      new Set(
        this.registeredListeners.map((listener) => {
          if (listener.element === window) return 'window';
          if (listener.element === document) return 'document';
          if (listener.element instanceof HTMLElement)
            return listener.element.tagName.toLowerCase();
          return 'unknown';
        })
      )
    );

    return {
      totalListeners: this.registeredListeners.length,
      eventTypes,
      targets,
    };
  }

  /**
   * 登録されたイベントリスナーの詳細情報
   */
  public getRegisteredListeners(): {
    eventType: string;
    target: string;
    hasOptions: boolean;
  }[] {
    return this.registeredListeners.map((listener) => ({
      eventType: listener.eventType,
      target:
        listener.element === window
          ? 'window'
          : listener.element === document
            ? 'document'
            : listener.element instanceof HTMLElement
              ? listener.element.tagName.toLowerCase()
              : 'unknown',
      hasOptions: !!listener.options,
    }));
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    log('🧹 Disposing EventHandlerManager...');

    try {
      // 全ての登録されたイベントリスナーを削除
      for (const listener of this.registeredListeners) {
        listener.element.removeEventListener(
          listener.eventType,
          listener.handler,
          listener.options
        );
      }

      this.registeredListeners = [];
      this.messageHandler = null;
      this.isDisposed = true;

      log('✅ EventHandlerManager disposed');
    } catch (error) {
      log('❌ Error disposing EventHandlerManager:', error);
    }
  }
}
