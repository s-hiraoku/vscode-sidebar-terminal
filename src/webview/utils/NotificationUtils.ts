/**
 * Webview内でのエラー・警告・情報メッセージ表示の統一ユーティリティ
 */

export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export interface NotificationConfig {
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // milliseconds, default 4000
  icon?: string;
}

const DEFAULT_DURATION = 4000;
const activeNotifications = new Set<HTMLElement>();

/**
 * ターミナル削除エラーの表示
 */
export function showTerminalCloseError(minCount: number): void {
  showNotification({
    type: 'warning',
    title: 'Cannot close terminal',
    message: `Must keep at least ${minCount} terminal${minCount > 1 ? 's' : ''} open`,
    icon: '⚠️',
  });
}

/**
 * ターミナルキルエラーの表示
 */
export function showTerminalKillError(reason: string): void {
  showNotification({
    type: 'error',
    title: 'Terminal kill failed',
    message: reason,
    icon: '❌',
  });
}

/**
 * 分割制限警告の表示
 */
export function showSplitLimitWarning(reason: string): void {
  showNotification({
    type: 'warning',
    title: 'Split Limit Reached',
    message: reason,
    icon: '⚠️',
  });
}

/**
 * 汎用的な通知表示
 */
export function showNotification(config: NotificationConfig): void {
  const notification = createNotificationElement(config);
  document.body.appendChild(notification);
  activeNotifications.add(notification);

  const duration = config.duration || DEFAULT_DURATION;
  setTimeout(() => {
    removeNotification(notification);
  }, duration);
}

/**
 * 通知要素の作成
 */
function createNotificationElement(config: NotificationConfig): HTMLElement {
  const notification = document.createElement('div');
  notification.className = 'terminal-notification';

  const colors = getNotificationColors(config.type);

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors.background};
    border: 2px solid ${colors.border};
    border-radius: 6px;
    padding: 12px 16px;
    color: ${colors.foreground};
    font-size: 11px;
    z-index: 10000;
    max-width: 300px;
    min-width: 200px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    animation: slideInFromRight 0.3s ease-out;
  `;

  const icon = config.icon || getDefaultIcon(config.type);

  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
      <span style="font-size: 14px;">${icon}</span>
      <strong>${config.title}</strong>
    </div>
    <div style="font-size: 10px; line-height: 1.4;">${config.message}</div>
  `;

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 4px;
    right: 6px;
    background: none;
    border: none;
    color: ${colors.foreground};
    cursor: pointer;
    font-size: 12px;
    padding: 2px;
    opacity: 0.7;
  `;
  closeBtn.addEventListener('click', () => {
    removeNotification(notification);
  });
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.opacity = '1';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.opacity = '0.7';
  });

  notification.appendChild(closeBtn);

  return notification;
}

/**
 * 通知の削除
 */
function removeNotification(notification: HTMLElement): void {
  if (notification.parentNode && activeNotifications.has(notification)) {
    notification.style.animation = 'slideOutToRight 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
      activeNotifications.delete(notification);
    }, 300);
  }
}

/**
 * 通知タイプに応じた色の取得
 */
function getNotificationColors(type: NotificationType): {
  background: string;
  border: string;
  foreground: string;
} {
  switch (type) {
    case 'error':
      return {
        background: 'var(--vscode-notifications-background, #1e1e1e)',
        border: 'var(--vscode-notificationError-border, #f44747)',
        foreground: 'var(--vscode-notificationError-foreground, #ffffff)',
      };
    case 'warning':
      return {
        background: 'var(--vscode-notifications-background, #1e1e1e)',
        border: 'var(--vscode-notificationWarning-border, #ffcc02)',
        foreground: 'var(--vscode-notificationWarning-foreground, #ffffff)',
      };
    case 'success':
      return {
        background: 'var(--vscode-notifications-background, #1e1e1e)',
        border: 'var(--vscode-notification-successIcon-foreground, #73c991)',
        foreground: 'var(--vscode-notification-foreground, #ffffff)',
      };
    case 'info':
    default:
      return {
        background: 'var(--vscode-notifications-background, #1e1e1e)',
        border: 'var(--vscode-notification-infoIcon-foreground, #3794ff)',
        foreground: 'var(--vscode-notification-foreground, #ffffff)',
      };
  }
}

/**
 * デフォルトアイコンの取得
 */
function getDefaultIcon(type: NotificationType): string {
  switch (type) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'success':
      return '✅';
    case 'info':
    default:
      return 'ℹ️';
  }
}

/**
 * 全ての通知をクリア
 */
export function clearAllNotifications(): void {
  activeNotifications.forEach((notification) => {
    removeNotification(notification);
  });
}

// Add CSS animations to the document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInFromRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutToRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
