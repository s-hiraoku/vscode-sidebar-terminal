/**
 * 統一通知システム - Observer/Publisher-Subscriber パターン実装
 * 既存NotificationUtilsとの互換性を保持しつつ段階的移行を可能にする
 */

import { NOTIFICATION_DURATION_CONSTANTS } from '../constants/webview';

export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  icon?: string;
  timestamp: number;
  source?: string; // 通知の発生源を追跡
}

export interface NotificationObserver {
  onNotification(notification: NotificationData): void;
  onNotificationRemoved?(id: string): void;
}

export interface NotificationFilter {
  type?: NotificationType[];
  source?: string[];
  maxAge?: number; // milliseconds
}

/**
 * 統一通知システム - 既存システムとの共存を前提とした設計
 */
export class NotificationSystem {
  private static _instance: NotificationSystem | null = null;
  private readonly _observers = new Set<NotificationObserver>();
  private readonly _notifications = new Map<string, NotificationData>();
  private readonly _filters = new Map<string, NotificationFilter>();

  // Feature flag for gradual migration
  private _enabled = false;
  private _fallbackMode = true; // 既存システムへのフォールバック

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): NotificationSystem {
    if (!NotificationSystem._instance) {
      NotificationSystem._instance = new NotificationSystem();
    }
    return NotificationSystem._instance;
  }

  /**
   * 段階的移行のためのFeature Flag
   */
  public setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  public isEnabled(): boolean {
    return this._enabled;
  }

  public setFallbackMode(enabled: boolean): void {
    this._fallbackMode = enabled;
  }

  /**
   * 通知オブザーバーの登録
   */
  public subscribe(observer: NotificationObserver, filter?: NotificationFilter): string {
    this._observers.add(observer);

    if (filter) {
      const filterId = this._generateFilterId();
      this._filters.set(filterId, filter);
      return filterId;
    }

    return 'default';
  }

  /**
   * 通知オブザーバーの解除
   */
  public unsubscribe(observer: NotificationObserver): void {
    this._observers.delete(observer);
  }

  /**
   * 通知の発信 - 既存システムとの互換性を保持
   */
  public notify(config: {
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;
    icon?: string;
    source?: string;
  }): string {
    const notification: NotificationData = {
      id: this._generateNotificationId(),
      type: config.type,
      title: config.title,
      message: config.message,
      duration: config.duration || NOTIFICATION_DURATION_CONSTANTS.DEFAULT_DURATION_MS,
      icon: config.icon,
      timestamp: Date.now(),
      source: config.source || 'unknown',
    };

    // 新システムが有効な場合のみ処理
    if (this._enabled) {
      this._notifications.set(notification.id, notification);
      this._notifyObservers(notification);

      // 自動削除の設定
      if (notification.duration && notification.duration > 0) {
        setTimeout(() => {
          this.removeNotification(notification.id);
        }, notification.duration);
      }
    }

    // フォールバックモードの場合は既存システムも呼び出し
    if (this._fallbackMode && this._isLegacyNotificationUtilsAvailable()) {
      this._callLegacyNotificationSystem(config);
    }

    return notification.id;
  }

  /**
   * 通知の削除
   */
  public removeNotification(id: string): boolean {
    const notification = this._notifications.get(id);
    if (!notification) {
      return false;
    }

    this._notifications.delete(id);
    this._notifyObserversOfRemoval(id);
    return true;
  }

  /**
   * アクティブな通知の取得
   */
  public getActiveNotifications(filter?: NotificationFilter): NotificationData[] {
    const notifications = Array.from(this._notifications.values());

    if (!filter) {
      return notifications;
    }

    return notifications.filter((notification) => this._matchesFilter(notification, filter));
  }

  /**
   * 通知履歴のクリア
   */
  public clearAll(): void {
    const notificationIds = Array.from(this._notifications.keys());
    this._notifications.clear();

    notificationIds.forEach((id) => {
      this._notifyObserversOfRemoval(id);
    });
  }

  /**
   * システム統計の取得（デバッグ用）
   */
  public getStats(): {
    totalNotifications: number;
    activeObservers: number;
    byType: Record<NotificationType, number>;
    bySource: Record<string, number>;
  } {
    const notifications = Array.from(this._notifications.values());

    const byType = notifications.reduce(
      (acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      },
      {} as Record<NotificationType, number>
    );

    const bySource = notifications.reduce(
      (acc, n) => {
        const source = n.source || 'unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalNotifications: this._notifications.size,
      activeObservers: this._observers.size,
      byType,
      bySource,
    };
  }

  // Private methods

  private _notifyObservers(notification: NotificationData): void {
    this._observers.forEach((observer) => {
      try {
        observer.onNotification(notification);
      } catch (error) {
        console.error('NotificationSystem: Observer error:', error);
      }
    });
  }

  private _notifyObserversOfRemoval(id: string): void {
    this._observers.forEach((observer) => {
      try {
        observer.onNotificationRemoved?.(id);
      } catch (error) {
        console.error('NotificationSystem: Observer removal error:', error);
      }
    });
  }

  private _matchesFilter(notification: NotificationData, filter: NotificationFilter): boolean {
    if (filter.type && !filter.type.includes(notification.type)) {
      return false;
    }

    if (filter.source && notification.source && !filter.source.includes(notification.source)) {
      return false;
    }

    if (filter.maxAge) {
      const age = Date.now() - notification.timestamp;
      if (age > filter.maxAge) {
        return false;
      }
    }

    return true;
  }

  private _generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private _generateFilterId(): string {
    return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private _isLegacyNotificationUtilsAvailable(): boolean {
    // 既存NotificationUtilsの存在確認
    try {
      return (
        typeof window !== 'undefined' &&
        'showNotification' in (globalThis as unknown as Record<string, unknown>)
      );
    } catch {
      return false;
    }
  }

  private _callLegacyNotificationSystem(config: {
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;
    icon?: string;
  }): void {
    try {
      // 既存のNotificationUtilsのshowNotification関数を呼び出し
      const globalAny = globalThis as unknown as Record<string, unknown>;
      const showNotification = globalAny['showNotification'];
      if (typeof showNotification === 'function') {
        (showNotification as (config: unknown) => void)(config);
      }
    } catch (error) {
      console.warn('NotificationSystem: Legacy fallback failed:', error);
    }
  }
}

/**
 * 既存システムとの互換性を保つためのファクトリー関数
 */
export function createNotificationSystem(): NotificationSystem {
  return NotificationSystem.getInstance();
}

/**
 * 段階的移行のためのヘルパー関数
 */
export function enableUnifiedNotifications(): void {
  NotificationSystem.getInstance().setEnabled(true);
}

export function disableUnifiedNotifications(): void {
  NotificationSystem.getInstance().setEnabled(false);
}

export function enableFallbackMode(): void {
  NotificationSystem.getInstance().setFallbackMode(true);
}

export function disableFallbackMode(): void {
  NotificationSystem.getInstance().setFallbackMode(false);
}
