/**
 * Notification Manager - Handles user feedback, notifications, and visual alerts
 */

import { webview as log } from '../../utils/logger';
import { INotificationManager } from '../interfaces/ManagerInterfaces';

interface NotificationOptions {
  duration?: number;
  position?: 'top' | 'bottom' | 'center';
  type?: 'info' | 'success' | 'warning' | 'error';
  persistent?: boolean;
}

export class NotificationManager implements INotificationManager {
  // Active notifications tracking
  private activeNotifications: Map<string, HTMLElement> = new Map();
  private notificationCounter = 0;

  // Default notification settings
  private readonly DEFAULT_DURATION = 3000;
  private readonly DEFAULT_POSITION = 'top';

  /**
   * Show notification in terminal area
   */
  public showNotificationInTerminal(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): void {
    const notification = this.createNotification(message, {
      type,
      duration: this.DEFAULT_DURATION,
      position: 'top',
    });

    this.addNotificationToTerminal(notification);
    log(`📢 [NOTIFICATION] Showed ${type} notification: ${message}`);
  }

  /**
   * Show Claude Code activity notification
   */
  public showClaudeCodeNotification(isActive: boolean): void {
    const existingNotification = this.activeNotifications.get('claude-code-status');
    if (existingNotification) {
      this.removeNotification('claude-code-status');
    }

    if (isActive) {
      const notification = this.createNotification(
        '🤖 Claude Code Active - Alt+Click temporarily disabled',
        {
          type: 'info',
          persistent: true,
          position: 'top',
        }
      );
      notification.classList.add('claude-code-notification');
      notification.id = 'claude-code-notification';

      this.activeNotifications.set('claude-code-status', notification);
      this.addNotificationToTerminal(notification);
      log('🤖 [NOTIFICATION] Claude Code active notification shown');
    } else {
      const notification = this.createNotification(
        '✅ Claude Code session ended - Alt+Click re-enabled',
        {
          type: 'success',
          duration: 2000,
          position: 'top',
        }
      );

      this.addNotificationToTerminal(notification);
      log('✅ [NOTIFICATION] Claude Code ended notification shown');
    }
  }

  /**
   * Show terminal kill error
   */
  public showTerminalKillError(message: string): void {
    this.showNotificationInTerminal(`❌ Kill Error: ${message}`, 'error');
  }

  /**
   * Show terminal close error
   */
  public showTerminalCloseError(minCount: number): void {
    this.showNotificationInTerminal(
      `⚠️ Cannot close: Minimum ${minCount} terminal${minCount > 1 ? 's' : ''} required`,
      'warning'
    );
  }

  /**
   * Show Alt+Click feedback at cursor position
   */
  public showAltClickFeedback(x: number, y: number): void {
    const feedback = document.createElement('div');
    feedback.className = 'alt-click-feedback';
    feedback.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 4px;
      height: 4px;
      background: #007acc;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      animation: altClickFade 0.6s ease-out forwards;
    `;

    document.body.appendChild(feedback);

    // Remove after animation
    setTimeout(() => {
      feedback.remove();
    }, 600);

    log(`⌨️ [NOTIFICATION] Alt+Click feedback shown at (${x}, ${y})`);
  }

  /**
   * Show Claude Code Alt+Click blocked notification
   */
  public showClaudeCodeAltClickBlocked(x: number, y: number): void {
    const notification = document.createElement('div');
    notification.className = 'claude-code-blocked-notification';
    notification.textContent = '⚡ Claude Code Active';
    notification.style.cssText = `
      position: fixed;
      left: ${x - 50}px;
      top: ${y - 30}px;
      background: rgba(255, 165, 0, 0.9);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 10000;
      animation: fadeInOut 1.5s ease-out forwards;
    `;

    document.body.appendChild(notification);

    // Remove after animation
    setTimeout(() => {
      notification.remove();
    }, 1500);

    log(`🚫 [NOTIFICATION] Claude Code Alt+Click blocked notification shown at (${x}, ${y})`);
  }

  /**
   * Clear all notifications
   */
  public clearNotifications(): void {
    this.activeNotifications.forEach((notification, id) => {
      this.removeNotification(id);
    });

    // Clear any remaining notification elements
    const notifications = document.querySelectorAll(
      '.notification, .claude-code-notification, .alt-click-feedback'
    );
    notifications.forEach((notification) => {
      notification.remove();
    });

    log('🧹 [NOTIFICATION] All notifications cleared');
  }

  /**
   * Create notification element
   */
  private createNotification(message: string, options: NotificationOptions): HTMLElement {
    const notification = document.createElement('div');
    const id = `notification-${++this.notificationCounter}`;

    notification.id = id;
    notification.className = `notification notification-${options.type || 'info'}`;
    notification.textContent = message;

    // Apply styling
    notification.style.cssText = `
      position: absolute;
      ${options.position === 'top' ? 'top: 10px' : options.position === 'bottom' ? 'bottom: 10px' : 'top: 50%'};
      left: 50%;
      transform: translateX(-50%) ${options.position === 'center' ? 'translateY(-50%)' : ''};
      background: ${this.getNotificationBackground(options.type || 'info')};
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 9999;
      max-width: 80%;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      animation: notificationSlideIn 0.3s ease-out;
    `;

    // Auto-remove if not persistent
    if (!options.persistent) {
      setTimeout(() => {
        this.removeNotificationElement(notification);
      }, options.duration || this.DEFAULT_DURATION);
    }

    return notification;
  }

  /**
   * Get notification background color by type
   */
  private getNotificationBackground(type: string): string {
    switch (type) {
      case 'success':
        return '#28a745';
      case 'warning':
        return '#ffc107';
      case 'error':
        return '#dc3545';
      case 'info':
      default:
        return '#007bff';
    }
  }

  /**
   * Add notification to terminal container
   */
  private addNotificationToTerminal(notification: HTMLElement): void {
    const terminalContainer = document.getElementById('terminal-container') || document.body;
    terminalContainer.appendChild(notification);

    // Position relative to terminal container
    if (terminalContainer.id === 'terminal-container') {
      notification.style.position = 'absolute';
    }
  }

  /**
   * Remove notification by ID
   */
  private removeNotification(id: string): void {
    const notification = this.activeNotifications.get(id);
    if (notification) {
      this.removeNotificationElement(notification);
      this.activeNotifications.delete(id);
    }
  }

  /**
   * Remove notification element with animation
   */
  private removeNotificationElement(notification: HTMLElement): void {
    notification.style.animation = 'notificationSlideOut 0.3s ease-in forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * Show loading notification
   */
  public showLoading(message: string = 'Loading...'): string {
    const id = `loading-${++this.notificationCounter}`;
    const notification = this.createNotification(message, {
      type: 'info',
      persistent: true,
      position: 'center',
    });

    notification.classList.add('loading-notification');
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="loading-spinner" style="
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <span>${message}</span>
      </div>
    `;

    this.activeNotifications.set(id, notification);
    this.addNotificationToTerminal(notification);

    log(`⏳ [NOTIFICATION] Loading notification shown: ${message}`);
    return id;
  }

  /**
   * Hide loading notification
   */
  public hideLoading(id: string): void {
    this.removeNotification(id);
    log(`✅ [NOTIFICATION] Loading notification hidden: ${id}`);
  }

  /**
   * Show toast notification
   */
  public showToast(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    duration = 2000
  ): void {
    const notification = this.createNotification(message, {
      type,
      duration,
      position: 'top',
    });

    notification.classList.add('toast-notification');
    this.addNotificationToTerminal(notification);

    log(`🍞 [NOTIFICATION] Toast shown: ${message} (${type})`);
  }

  /**
   * Setup CSS animations
   */
  public setupNotificationStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes notificationSlideIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      
      @keyframes notificationSlideOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
      
      @keyframes altClickFade {
        0% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(3); }
      }
      
      @keyframes fadeInOut {
        0% { opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

    document.head.appendChild(style);
    log('🎨 [NOTIFICATION] Notification styles setup');
  }

  /**
   * Get notification statistics
   */
  public getStats(): { activeCount: number; totalCreated: number } {
    return {
      activeCount: this.activeNotifications.size,
      totalCreated: this.notificationCounter,
    };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    log('🧹 [NOTIFICATION] Disposing notification manager');

    // Clear all notifications
    this.clearNotifications();

    // Reset counters
    this.notificationCounter = 0;

    log('✅ [NOTIFICATION] Notification manager disposed');
  }
}
