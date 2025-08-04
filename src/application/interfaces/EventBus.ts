/**
 * Event Bus Interface
 *
 * イベント駆動アーキテクチャの中核となるイベントバス
 */

export type EventCallback<T = any> = (data: T) => void | Promise<void>;

export interface IEventBus {
  // イベント発行
  publish<T>(eventType: string, data: T): Promise<void>;
  publishSync<T>(eventType: string, data: T): void;

  // イベント購読
  subscribe<T>(eventType: string, callback: EventCallback<T>): string;
  subscribeOnce<T>(eventType: string, callback: EventCallback<T>): string;

  // 購読解除
  unsubscribe(subscriptionId: string): void;
  unsubscribeAll(eventType?: string): void;

  // イベントバス状態
  getSubscriberCount(eventType: string): number;
  getAllEventTypes(): string[];

  // リソース管理
  dispose(): void;
}

/**
 * Event Bus Implementation
 */
export class EventBus implements IEventBus {
  private subscribers = new Map<string, Map<string, EventCallback>>();
  private subscriptionIdCounter = 0;

  /**
   * イベントを非同期で発行
   */
  async publish<T>(eventType: string, data: T): Promise<void> {
    const eventSubscribers = this.subscribers.get(eventType);
    if (!eventSubscribers || eventSubscribers.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];

    for (const callback of eventSubscribers.values()) {
      try {
        const result = callback(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`Error in event callback for ${eventType}:`, error);
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /**
   * イベントを同期で発行
   */
  publishSync<T>(eventType: string, data: T): void {
    const eventSubscribers = this.subscribers.get(eventType);
    if (!eventSubscribers || eventSubscribers.size === 0) {
      return;
    }

    for (const callback of eventSubscribers.values()) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in sync event callback for ${eventType}:`, error);
      }
    }
  }

  /**
   * イベントを購読
   */
  subscribe<T>(eventType: string, callback: EventCallback<T>): string {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Map());
    }

    const subscriptionId = `${eventType}-${++this.subscriptionIdCounter}`;
    this.subscribers.get(eventType)!.set(subscriptionId, callback);

    return subscriptionId;
  }

  /**
   * 一度だけイベントを購読
   */
  subscribeOnce<T>(eventType: string, callback: EventCallback<T>): string {
    const onceCallback: EventCallback<T> = (data) => {
      callback(data);
      this.unsubscribe(subscriptionId);
    };

    const subscriptionId = this.subscribe(eventType, onceCallback);
    return subscriptionId;
  }

  /**
   * 購読を解除
   */
  unsubscribe(subscriptionId: string): void {
    for (const [eventType, eventSubscribers] of this.subscribers) {
      if (eventSubscribers.has(subscriptionId)) {
        eventSubscribers.delete(subscriptionId);

        // イベントタイプの購読者がいなくなったらマップから削除
        if (eventSubscribers.size === 0) {
          this.subscribers.delete(eventType);
        }

        break;
      }
    }
  }

  /**
   * 全ての購読を解除
   */
  unsubscribeAll(eventType?: string): void {
    if (eventType) {
      this.subscribers.delete(eventType);
    } else {
      this.subscribers.clear();
    }
  }

  /**
   * 購読者数を取得
   */
  getSubscriberCount(eventType: string): number {
    const eventSubscribers = this.subscribers.get(eventType);
    return eventSubscribers ? eventSubscribers.size : 0;
  }

  /**
   * 全てのイベントタイプを取得
   */
  getAllEventTypes(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.subscribers.clear();
    this.subscriptionIdCounter = 0;
  }
}
