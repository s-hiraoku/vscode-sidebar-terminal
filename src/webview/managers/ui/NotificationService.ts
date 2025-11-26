/**
 * Notification Service
 *
 * Extracted from UIManager for better maintainability.
 * Handles notification display and CSS animations.
 */

import { DOMUtils } from '../../utils/DOMUtils';
import { uiLogger } from '../../utils/ManagerLogger';

export interface NotificationConfig {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  duration?: number;
  icon?: string;
}

interface NotificationColors {
  background: string;
  border: string;
  foreground: string;
}

/**
 * Service for managing notifications and CSS animations
 */
export class NotificationService {
  private animationsLoaded = false;

  /**
   * Create notification element with consistent styling
   */
  public createNotificationElement(config: NotificationConfig): HTMLElement {
    const colors = this.getNotificationColors(config.type);
    const notification = this.createNotificationContainer(colors);
    const content = this.createNotificationContent(config, colors);

    notification.appendChild(content);
    uiLogger.info(`Created notification: ${config.type} - ${config.title}`);
    return notification;
  }

  /**
   * Add CSS animations to document if not already present
   */
  public ensureAnimationsLoaded(): void {
    if (this.animationsLoaded) {
      return;
    }

    if (!document.querySelector('#ui-manager-animations')) {
      const style = document.createElement('style');
      style.id = 'ui-manager-animations';
      style.textContent = this.getAnimationCSS();
      document.head.appendChild(style);
      uiLogger.debug('CSS animations loaded');
    }

    this.animationsLoaded = true;
  }

  /**
   * Get notification colors based on type
   */
  public getNotificationColors(type: string): NotificationColors {
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
   * Get default icon for notification type
   */
  public getDefaultIcon(type: string): string {
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

  private createNotificationContainer(colors: NotificationColors): HTMLElement {
    return DOMUtils.createElement(
      'div',
      {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: colors.background,
        border: `2px solid ${colors.border}`,
        borderRadius: '6px',
        padding: '12px 16px',
        color: colors.foreground,
        fontSize: '11px',
        zIndex: '10000',
        maxWidth: '300px',
        minWidth: '200px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        animation: 'slideInFromRight 0.3s ease-out',
      },
      {
        className: 'terminal-notification',
      }
    );
  }

  private createNotificationContent(config: NotificationConfig, colors: NotificationColors): HTMLElement {
    const container = document.createElement('div');
    const icon = config.icon || this.getDefaultIcon(config.type);

    // SECURITY: Build DOM structure safely to prevent XSS
    // Create header with icon and title
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';

    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '14px';
    iconSpan.textContent = icon; // Safe: textContent escapes HTML

    const titleStrong = document.createElement('strong');
    titleStrong.textContent = config.title; // Safe: textContent escapes HTML

    headerDiv.appendChild(iconSpan);
    headerDiv.appendChild(titleStrong);

    // Create message div
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'font-size: 10px; line-height: 1.4;';
    messageDiv.textContent = config.message; // Safe: textContent escapes HTML

    container.appendChild(headerDiv);
    container.appendChild(messageDiv);

    const closeBtn = this.createNotificationCloseButton(colors);
    container.appendChild(closeBtn);

    return container;
  }

  private createNotificationCloseButton(colors: NotificationColors): HTMLButtonElement {
    return DOMUtils.createElement(
      'button',
      {
        position: 'absolute',
        top: '4px',
        right: '6px',
        background: 'none',
        border: 'none',
        color: colors.foreground,
        cursor: 'pointer',
        fontSize: '12px',
        padding: '2px',
        opacity: '0.7',
        transition: 'opacity 0.2s',
      },
      {
        textContent: '✕',
        className: 'notification-close',
      }
    );
  }

  private getAnimationCSS(): string {
    return `
      @keyframes slideInFromRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutToRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
      @keyframes fadeInOut {
        0% { opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
  }
}
