/**
 * Notification Manager - Handles user feedback, notifications, and visual alerts
 */

import { INotificationManager } from '../interfaces/ManagerInterfaces';
import { BaseManager } from './BaseManager';

interface NotificationOptions {
  duration?: number;
  position?: 'top' | 'bottom' | 'center';
  type?: 'info' | 'success' | 'warning' | 'error';
  persistent?: boolean;
}

export class NotificationManager extends BaseManager implements INotificationManager {
  constructor() {
    super('NotificationManager', {
      enableLogging: true,
      enableValidation: false,
      enableErrorRecovery: true,
    });
  }

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
    this.logger(`📢 [NOTIFICATION] Showed ${type} notification: ${message}`);
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

    this.logger(`⌨️ [NOTIFICATION] Alt+Click feedback shown at (${x}, ${y})`);
  }

  /**
   * Show warning notification
   */
  public showWarning(message: string): void {
    this.showNotificationInTerminal(`⚠️ ${message}`, 'warning');
  }

  /**
   * Clear warning notifications
   */
  public clearWarnings(): void {
    // Clear warning-specific notifications
    const warnings = document.querySelectorAll('.notification-warning');
    warnings.forEach((warning) => {
      warning.remove();
    });
    this.logger('⚠️ [NOTIFICATION] Warning notifications cleared');
  }

  /**
   * Clear all notifications
   */
  public clearNotifications(): void {
    this.activeNotifications.forEach((notification, id) => {
      this.removeNotification(id);
    });

    // Clear any remaining notification elements
    const notifications = document.querySelectorAll('.notification, .alt-click-feedback');
    notifications.forEach((notification) => {
      notification.remove();
    });

    this.logger('🧹 [NOTIFICATION] All notifications cleared');
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

    // Apply subtle styling - more integrated with VS Code
    notification.style.cssText = `
      position: absolute;
      ${options.position === 'top' ? 'top: 10px' : options.position === 'bottom' ? 'bottom: 10px' : 'top: 50%'};
      left: 50%;
      transform: translateX(-50%) ${options.position === 'center' ? 'translateY(-50%)' : ''};
      background: ${this.getNotificationBackground(options.type || 'info')};
      color: rgba(255, 255, 255, 0.95);
      padding: 6px 12px;
      border-radius: 3px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 9999;
      max-width: 70%;
      text-align: center;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      opacity: 0.75;
      animation: subtleSlideIn 0.2s ease-out;
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
        return 'rgba(40, 167, 69, 0.7)';
      case 'warning':
        return 'rgba(255, 193, 7, 0.7)';
      case 'error':
        return 'rgba(220, 53, 69, 0.7)';
      case 'info':
      default:
        return 'rgba(0, 123, 255, 0.7)';
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
    notification.style.animation = 'subtleSlideOut 0.2s ease-in forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 200);
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

    this.logger(`⏳ [NOTIFICATION] Loading notification shown: ${message}`);
    return id;
  }

  /**
   * Hide loading notification
   */
  public hideLoading(id: string): void {
    this.removeNotification(id);
    this.logger(`✅ [NOTIFICATION] Loading notification hidden: ${id}`);
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

    this.logger(`🍞 [NOTIFICATION] Toast shown: ${message} (${type})`);
  }

  /**
   * Setup CSS animations
   */
  public setupNotificationStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes subtleSlideIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
        to { opacity: 0.85; transform: translateX(-50%) translateY(0); }
      }
      
      @keyframes subtleSlideOut {
        from { opacity: 0.85; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-5px); }
      }
      
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
    this.logger('🎨 [NOTIFICATION] Notification styles setup');
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
   * Initialize the NotificationManager (BaseManager abstract method implementation)
   */
  protected doInitialize(): void {
    this.logger('🚀 NotificationManager initialized');
  }

  /**
   * Dispose NotificationManager resources (BaseManager abstract method implementation)
   */
  protected doDispose(): void {
    this.logger('🧹 Disposing NotificationManager resources');

    // Clear all notifications
    this.clearNotifications();

    // Reset counters
    this.notificationCounter = 0;

    this.logger('✅ NotificationManager resources disposed');
  }

  /**
   * Dispose and cleanup
   */
  public override dispose(): void {
    this.logger('🧹 [NOTIFICATION] Disposing notification manager');

    // Call parent dispose which will call doDispose()
    super.dispose();

    this.logger('✅ [NOTIFICATION] Notification manager disposed');
  }
}
