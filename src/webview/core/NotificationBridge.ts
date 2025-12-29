/**
 * 既存NotificationUtilsと新NotificationSystemの橋渡し
 * 段階的移行を可能にし、後方互換性を保証
 */

import { NotificationSystem } from './NotificationSystem';
import type { NotificationConfig } from '../utils/NotificationUtils';
import { NOTIFICATION_DURATION_CONSTANTS } from '../constants/webview';

/**
 * 移行用ブリッジクラス
 * 既存のNotificationUtilsのAPIを保持しつつ、内部では新システムを使用
 */
export class NotificationBridge {
  private static _instance: NotificationBridge | null = null;
  private readonly _notificationSystem: NotificationSystem;
  private _migrationMode: 'legacy' | 'hybrid' | 'unified' = 'legacy';

  private constructor() {
    this._notificationSystem = NotificationSystem.getInstance();
  }

  public static getInstance(): NotificationBridge {
    if (!NotificationBridge._instance) {
      NotificationBridge._instance = new NotificationBridge();
    }
    return NotificationBridge._instance;
  }

  /**
   * 移行モードの設定
   * - legacy: 既存システムのみ使用（デフォルト）
   * - hybrid: 両システムを並行使用
   * - unified: 新システムのみ使用
   */
  public setMigrationMode(mode: 'legacy' | 'hybrid' | 'unified'): void {
    this._migrationMode = mode;

    switch (mode) {
      case 'legacy':
        this._notificationSystem.setEnabled(false);
        this._notificationSystem.setFallbackMode(true);
        break;
      case 'hybrid':
        this._notificationSystem.setEnabled(true);
        this._notificationSystem.setFallbackMode(true);
        break;
      case 'unified':
        this._notificationSystem.setEnabled(true);
        this._notificationSystem.setFallbackMode(false);
        break;
    }
  }

  public getMigrationMode(): 'legacy' | 'hybrid' | 'unified' {
    return this._migrationMode;
  }

  /**
   * 既存NotificationUtilsのAPIと互換性のあるshow関数
   */
  public showNotification(config: NotificationConfig): string | undefined {
    const source = this._determineSource();

    switch (this._migrationMode) {
      case 'legacy':
        return this._callLegacyShowNotification(config);

      case 'hybrid': {
        // 両方のシステムで通知
        this._callLegacyShowNotification(config);
        const unifiedId = this._notificationSystem.notify({
          ...config,
          source,
        });
        return unifiedId; // 新システムのIDを返す
      }

      case 'unified':
        return this._notificationSystem.notify({
          ...config,
          source,
        });

      default:
        return this._callLegacyShowNotification(config);
    }
  }

  /**
   * 既存の特定通知関数との互換性
   */
  public showTerminalCloseError(minCount: number): string | undefined {
    return this.showNotification({
      type: 'warning',
      title: 'Cannot close terminal',
      message: `Must keep at least ${minCount} terminal${minCount > 1 ? 's' : ''} open`,
      icon: '⚠️',
    });
  }

  public showTerminalKillError(reason: string): string | undefined {
    return this.showNotification({
      type: 'error',
      title: 'Terminal kill failed',
      message: reason,
      icon: '❌',
    });
  }

  public showSplitLimitWarning(reason: string): string | undefined {
    return this.showNotification({
      type: 'warning',
      title: 'Split Limit Reached',
      message: reason,
      icon: '⚠️',
    });
  }

  public showCliAgentDetected(): string | undefined {
    return this.showNotification({
      type: 'info',
      title: 'CLI Agent Detected',
      message: 'Alt+Click temporarily disabled for optimal performance during AI interaction',
      icon: '🤖',
      duration: NOTIFICATION_DURATION_CONSTANTS.CLI_AGENT_DETECTED_MS,
    });
  }

  public showCliAgentEnded(): string | undefined {
    return this.showNotification({
      type: 'success',
      title: 'CLI Agent Session Ended',
      message: 'Alt+Click cursor positioning re-enabled',
      icon: '✅',
      duration: NOTIFICATION_DURATION_CONSTANTS.CLI_AGENT_ENDED_MS,
    });
  }

  public showAltClickDisabledWarning(reason?: string): string | undefined {
    return this.showNotification({
      type: 'warning',
      title: 'Alt+Click Disabled',
      message: reason || 'Alt+Click cursor positioning is currently disabled',
      icon: '🚫',
      duration: NOTIFICATION_DURATION_CONSTANTS.ALT_CLICK_DISABLED_MS,
    });
  }

  public showAltClickSettingError(): string | undefined {
    return this.showNotification({
      type: 'warning',
      title: 'Alt+Click Configuration',
      message:
        'Check VS Code settings: terminal.integrated.altClickMovesCursor and editor.multiCursorModifier',
      icon: '⚙️',
      duration: NOTIFICATION_DURATION_CONSTANTS.ALT_CLICK_SETTING_ERROR_MS,
    });
  }

  public showTerminalInteractionIssue(details: string): string | undefined {
    return this.showNotification({
      type: 'warning',
      title: 'Terminal Interaction Issue',
      message: details,
      icon: '⚡',
      duration: NOTIFICATION_DURATION_CONSTANTS.TERMINAL_INTERACTION_ISSUE_MS,
    });
  }

  /**
   * 全通知のクリア（両システム対応）
   */
  public clearAllNotifications(): void {
    // 新システムのクリア
    if (this._migrationMode !== 'legacy') {
      this._notificationSystem.clearAll();
    }

    // 既存システムのクリア
    if (this._migrationMode !== 'unified') {
      this._callLegacyClearAll();
    }
  }

  /**
   * 移行状況の監視
   */
  public getMigrationStats(): {
    mode: string;
    unifiedSystemActive: boolean;
    legacySystemAvailable: boolean;
    unifiedStats: ReturnType<NotificationSystem['getStats']>;
  } {
    return {
      mode: this._migrationMode,
      unifiedSystemActive: this._notificationSystem.isEnabled(),
      legacySystemAvailable: this._isLegacySystemAvailable(),
      unifiedStats: this._notificationSystem.getStats(),
    };
  }

  // Private methods

  private _callLegacyShowNotification(config: NotificationConfig): undefined {
    try {
      // 既存のshowNotification関数を呼び出し
      if (this._isLegacySystemAvailable()) {
        const showNotification = this._getLegacyShowNotification();
        if (showNotification) {
          showNotification(config);
        }
      }
    } catch (error) {
      console.error('NotificationBridge: Legacy showNotification failed:', error);
    }
  }

  private _callLegacyClearAll(): void {
    try {
      if (this._isLegacySystemAvailable()) {
        const clearAllNotifications = this._getLegacyClearAll();
        if (clearAllNotifications) {
          clearAllNotifications();
        }
      }
    } catch (error) {
      console.error('NotificationBridge: Legacy clearAllNotifications failed:', error);
    }
  }

  private _isLegacySystemAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && this._getLegacyShowNotification() !== null;
    } catch {
      return false;
    }
  }

  private _getLegacyShowNotification(): ((config: NotificationConfig) => void) | null {
    try {
      const globalAny = globalThis as unknown as Record<string, unknown>;
      const showNotification = globalAny['showNotification'];
      return typeof showNotification === 'function'
        ? (showNotification as (config: NotificationConfig) => void)
        : null;
    } catch {
      return null;
    }
  }

  private _getLegacyClearAll(): (() => void) | null {
    try {
      const globalAny = globalThis as unknown as Record<string, unknown>;
      const clearAllNotifications = globalAny['clearAllNotifications'];
      return typeof clearAllNotifications === 'function'
        ? (clearAllNotifications as () => void)
        : null;
    } catch {
      return null;
    }
  }

  private _determineSource(): string {
    try {
      // スタックトレースから呼び出し元を推定
      const stack = new Error().stack;
      if (stack) {
        const stackLines = stack.split('\n');
        const callerLine = stackLines[3] || stackLines[2]; // 呼び出し元の行を取得

        if (callerLine?.includes('main.ts')) return 'webview-main';
        if (callerLine?.includes('SplitManager')) return 'split-manager';
        if (callerLine?.includes('HeaderManager')) return 'header-manager';
        if (callerLine?.includes('SettingsPanel')) return 'settings-panel';

        return 'webview-unknown';
      }
    } catch {
      // スタックトレース取得に失敗した場合
    }

    return 'unknown';
  }
}

/**
 * グローバルアクセス用のヘルパー関数
 */
export function getNotificationBridge(): NotificationBridge {
  return NotificationBridge.getInstance();
}

/**
 * 段階的移行のための設定関数
 */
export function enableHybridNotifications(): void {
  NotificationBridge.getInstance().setMigrationMode('hybrid');
}

export function enableUnifiedNotificationsOnly(): void {
  NotificationBridge.getInstance().setMigrationMode('unified');
}

export function revertToLegacyNotifications(): void {
  NotificationBridge.getInstance().setMigrationMode('legacy');
}
