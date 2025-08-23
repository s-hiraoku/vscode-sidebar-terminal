/**
 * Refactored Notification Manager - Example implementation using Enhanced Base Manager
 *
 * This demonstrates how to refactor existing managers to use the enhanced patterns:
 * - Extends EnhancedBaseManager for common functionality
 * - Uses segregated interfaces for dependencies
 * - Implements standardized lifecycle management
 * - Consolidates notification patterns found across multiple managers
 */

import { EnhancedBaseManager, EnhancedManagerOptions } from './EnhancedBaseManager';
import {
  IEnhancedNotificationManager,
  ManagerDependencies,
  NotificationStatistics,
  ILoggingCoordinator,
} from '../interfaces/SegregatedManagerInterfaces';

/**
 * Notification types and configurations
 */
interface NotificationConfig {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
  position?: 'top' | 'bottom' | 'center';
  persistent?: boolean;
  icon?: string;
}

interface ActiveNotification {
  id: string;
  element: HTMLElement;
  config: NotificationConfig;
  createdAt: number;
  timeoutId?: number;
}

/**
 * Refactored Notification Manager implementing enhanced patterns
 */
export class RefactoredNotificationManager
  extends EnhancedBaseManager
  implements IEnhancedNotificationManager
{
  // Notification tracking
  private activeNotifications = new Map<string, ActiveNotification>();
  private notificationCounter = 0;
  private dismissedCount = 0;
  private errorNotificationCount = 0;

  // Configuration
  private readonly DEFAULT_DURATION = 3000;
  private readonly MAX_ACTIVE_NOTIFICATIONS = 5;

  // Dependencies
  private loggingCoordinator?: ILoggingCoordinator;

  constructor(options: EnhancedManagerOptions = {}) {
    super('RefactoredNotificationManager', {
      enableLogging: true,
      enableValidation: false,
      enableErrorRecovery: true,
      enablePerformanceMonitoring: true,
      ...options,
    });
  }

  // ============================================================================
  // ENHANCED BASE MANAGER IMPLEMENTATION
  // ============================================================================

  protected async onInitialize(dependencies: ManagerDependencies): Promise<void> {
    this.log('Initializing Refactored Notification Manager...');

    // Extract required dependencies
    this.loggingCoordinator = dependencies.loggingCoordinator;

    // Setup notification styles
    this.setupNotificationStyles();

    // Setup cleanup for page visibility changes
    this.addEventListenerManaged(
      document,
      'visibilitychange',
      this.handleVisibilityChange.bind(this),
      false,
      'visibility-change'
    );

    // Setup error recovery for DOM mutations
    this.addEventListenerManaged(
      document,
      'DOMNodeRemoved',
      this.handleDOMNodeRemoval.bind(this),
      false,
      'dom-mutation'
    );

    this.log('Notification Manager initialized successfully');
  }

  protected onDispose(): void {
    this.log('Disposing Refactored Notification Manager...');

    // Clear all active notifications
    this.clearAllNotifications();

    // Remove notification styles
    this.removeNotificationStyles();

    this.log('Notification Manager disposed successfully');
  }

  protected async validateDependencies(dependencies: ManagerDependencies): Promise<void> {
    // Logging coordinator is optional but recommended
    if (!dependencies.loggingCoordinator) {
      this.log('Logging coordinator not provided - using internal logging only', 'warn');
    }
  }

  // ============================================================================
  // CORE NOTIFICATION METHODS
  // ============================================================================

  /**
   * Show notification in terminal area
   */
  public showNotificationInTerminal(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): void {
    this.measurePerformance(() => {
      const notificationId = this.showNotification({
        type,
        message,
        duration: this.DEFAULT_DURATION,
        position: 'top',
      });

      this.log(`📢 Showed ${type} notification: ${message}`);
      return notificationId;
    }, 'show_terminal_notification');
  }

  /**
   * Show terminal kill error with enhanced formatting
   */
  public showTerminalKillError(message: string): void {
    this.errorNotificationCount++;
    this.showNotificationInTerminal(`❌ Kill Error: ${message}`, 'error');
  }

  /**
   * Show terminal close error with context
   */
  public showTerminalCloseError(minCount: number): void {
    this.errorNotificationCount++;
    const message = `⚠️ Cannot close: Minimum ${minCount} terminal${minCount > 1 ? 's' : ''} required`;
    this.showNotificationInTerminal(message, 'warning');
  }

  /**
   * Show Alt+Click feedback at cursor position with enhanced animation
   */
  public showAltClickFeedback(x: number, y: number): void {
    this.measurePerformance(() => {
      const feedback = this.createAltClickFeedbackElement(x, y);
      document.body.appendChild(feedback);

      // Enhanced animation with multiple phases
      this.animateAltClickFeedback(feedback);

      // Auto-cleanup with enhanced timing
      this.setTimer(
        'alt-click-cleanup',
        () => {
          this.safeExecute(() => {
            if (feedback.parentNode) {
              feedback.parentNode.removeChild(feedback);
            }
          });
        },
        800
      );

      this.log(`⌨️ Alt+Click feedback shown at (${x}, ${y})`);
    }, 'show_altclick_feedback');
  }

  /**
   * Show temporary notification with automatic cleanup
   */
  public showTemporaryNotification(message: string, duration: number = 2000): string {
    return this.showNotification({
      type: 'info',
      message,
      duration,
      position: 'top',
    });
  }

  /**
   * Hide specific notification by ID
   */
  public hideNotification(notificationId: string): void {
    const notification = this.activeNotifications.get(notificationId);
    if (notification) {
      this.removeNotification(notificationId);
      this.log(`🧹 Hidden notification: ${notificationId}`);
    }
  }

  /**
   * Clear all notifications with enhanced cleanup
   */
  public clearNotifications(): void {
    this.clearAllNotifications();
  }

  // ============================================================================
  // ENHANCED NOTIFICATION SYSTEM
  // ============================================================================

  /**
   * Core notification creation method with enhanced features
   */
  private showNotification(config: NotificationConfig): string {
    // Check notification limits
    if (this.activeNotifications.size >= this.MAX_ACTIVE_NOTIFICATIONS) {
      this.removeOldestNotification();
    }

    const notificationId = `notification-${++this.notificationCounter}`;
    const element = this.createNotificationElement(config);

    const notification: ActiveNotification = {
      id: notificationId,
      element,
      config,
      createdAt: Date.now(),
    };

    // Setup auto-removal if not persistent
    if (!config.persistent && config.duration && config.duration > 0) {
      notification.timeoutId = window.setTimeout(() => {
        this.removeNotification(notificationId);
      }, config.duration);
    }

    // Add to DOM with enhanced positioning
    this.addNotificationToContainer(element, config.position || 'top');

    // Track notification
    this.activeNotifications.set(notificationId, notification);

    // Apply entrance animation
    this.animateNotificationEntrance(element);

    return notificationId;
  }

  /**
   * Create notification element with enhanced styling
   */
  private createNotificationElement(config: NotificationConfig): HTMLElement {
    const notification = document.createElement('div');
    notification.className = `enhanced-notification enhanced-notification-${config.type}`;

    // Apply enhanced styling
    const colors = this.getNotificationColors(config.type);
    notification.style.cssText = `
      position: fixed;
      background: ${colors.background};
      color: ${colors.foreground};
      border: 2px solid ${colors.border};
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 14px;
      font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      z-index: 10000;
      max-width: 400px;
      min-width: 250px;
      word-wrap: break-word;
      backdrop-filter: blur(8px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    // Create notification content
    this.createNotificationContent(notification, config, colors);

    return notification;
  }

  /**
   * Create notification content with title and message
   */
  private createNotificationContent(
    notification: HTMLElement,
    config: NotificationConfig,
    colors: any
  ): void {
    const content = document.createElement('div');
    content.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    // Add icon and title if provided
    if (config.title || config.icon) {
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; align-items: center; gap: 8px; font-weight: 600;';

      if (config.icon || this.getDefaultIcon(config.type)) {
        const icon = document.createElement('span');
        icon.textContent = config.icon || this.getDefaultIcon(config.type);
        icon.style.fontSize = '16px';
        header.appendChild(icon);
      }

      if (config.title) {
        const title = document.createElement('span');
        title.textContent = config.title;
        header.appendChild(title);
      }

      content.appendChild(header);
    }

    // Add message
    const message = document.createElement('div');
    message.textContent = config.message;
    message.style.cssText = config.title ? 'font-size: 13px; opacity: 0.9;' : '';
    content.appendChild(message);

    // Add close button
    const closeButton = this.createCloseButton(colors);
    notification.appendChild(content);
    notification.appendChild(closeButton);
  }

  /**
   * Create close button with enhanced interaction
   */
  private createCloseButton(colors: any): HTMLElement {
    const button = document.createElement('button');
    button.textContent = '✕';
    button.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      color: ${colors.foreground};
      font-size: 14px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      opacity: 0.7;
      transition: all 0.2s ease;
    `;

    // Enhanced hover effects
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
      button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.opacity = '0.7';
      button.style.backgroundColor = 'transparent';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const notification = button.closest('.enhanced-notification') as HTMLElement;
      if (notification) {
        this.removeNotificationByElement(notification);
      }
    });

    return button;
  }

  /**
   * Enhanced Alt+Click feedback element
   */
  private createAltClickFeedbackElement(x: number, y: number): HTMLElement {
    const feedback = document.createElement('div');
    feedback.className = 'enhanced-alt-click-feedback';
    feedback.style.cssText = `
      position: fixed;
      left: ${x - 6}px;
      top: ${y - 6}px;
      width: 12px;
      height: 12px;
      background: #007acc;
      border: 2px solid #ffffff;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      box-shadow: 0 0 0 0 rgba(0, 122, 204, 0.7);
    `;

    return feedback;
  }

  // ============================================================================
  // ANIMATION SYSTEM
  // ============================================================================

  /**
   * Enhanced notification entrance animation
   */
  private animateNotificationEntrance(element: HTMLElement): void {
    element.style.transform = 'translateX(100%) scale(0.8)';
    element.style.opacity = '0';

    // Trigger entrance animation
    requestAnimationFrame(() => {
      element.style.transform = 'translateX(0) scale(1)';
      element.style.opacity = '1';
    });
  }

  /**
   * Enhanced Alt+Click feedback animation
   */
  private animateAltClickFeedback(element: HTMLElement): void {
    element.style.animation = 'enhanced-alt-click-pulse 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards';
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get notification colors with VS Code theme support
   */
  private getNotificationColors(type: string): {
    background: string;
    border: string;
    foreground: string;
  } {
    const baseColors = {
      error: {
        background: 'var(--vscode-notifications-background, #3c1e1e)',
        border: 'var(--vscode-notificationError-border, #f44747)',
        foreground: 'var(--vscode-notificationError-foreground, #ffffff)',
      },
      warning: {
        background: 'var(--vscode-notifications-background, #3c3c1e)',
        border: 'var(--vscode-notificationWarning-border, #ffcc02)',
        foreground: 'var(--vscode-notificationWarning-foreground, #ffffff)',
      },
      success: {
        background: 'var(--vscode-notifications-background, #1e3c1e)',
        border: 'var(--vscode-notification-successIcon-foreground, #73c991)',
        foreground: 'var(--vscode-notification-foreground, #ffffff)',
      },
      info: {
        background: 'var(--vscode-notifications-background, #1e1e3c)',
        border: 'var(--vscode-notification-infoIcon-foreground, #3794ff)',
        foreground: 'var(--vscode-notification-foreground, #ffffff)',
      },
    };

    return baseColors[type] || baseColors.info;
  }

  /**
   * Get default icon for notification type
   */
  private getDefaultIcon(type: string): string {
    const icons = {
      error: '❌',
      warning: '⚠️',
      success: '✅',
      info: 'ℹ️',
    };

    return icons[type] || icons.info;
  }

  /**
   * Add notification to appropriate container
   */
  private addNotificationToContainer(element: HTMLElement, position: string): void {
    const container = this.getOrCreateNotificationContainer();
    container.appendChild(element);

    // Update positioning
    this.updateNotificationPositions(position);
  }

  /**
   * Get or create notification container
   */
  private getOrCreateNotificationContainer(): HTMLElement {
    let container = document.getElementById('enhanced-notification-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'enhanced-notification-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      `;

      // Allow pointer events on children
      container.addEventListener('pointerdown', (e) => e.stopPropagation());

      const terminalContainer = document.getElementById('terminal-container') || document.body;
      terminalContainer.appendChild(container);
    }

    return container;
  }

  /**
   * Update notification positions for better stacking
   */
  private updateNotificationPositions(_position: string): void {
    const container = document.getElementById('enhanced-notification-container');
    if (!container) return;

    const notifications = Array.from(container.children) as HTMLElement[];

    notifications.forEach((notification, index) => {
      notification.style.pointerEvents = 'auto';
      notification.style.transform = `translateY(${index * 4}px)`;
      notification.style.opacity = Math.max(0.3, 1 - index * 0.1).toString();
    });
  }

  // ============================================================================
  // CLEANUP AND REMOVAL
  // ============================================================================

  /**
   * Remove specific notification
   */
  private removeNotification(notificationId: string): void {
    const notification = this.activeNotifications.get(notificationId);
    if (!notification) return;

    // Clear timeout if exists
    if (notification.timeoutId) {
      window.clearTimeout(notification.timeoutId);
    }

    // Animate removal
    this.animateNotificationExit(notification.element, () => {
      this.safeExecute(() => {
        if (notification.element.parentNode) {
          notification.element.parentNode.removeChild(notification.element);
        }
      });
    });

    // Update tracking
    this.activeNotifications.delete(notificationId);
    this.dismissedCount++;

    // Update positions
    this.updateNotificationPositions('top');
  }

  /**
   * Remove notification by element reference
   */
  private removeNotificationByElement(element: HTMLElement): void {
    for (const [id, notification] of this.activeNotifications) {
      if (notification.element === element) {
        this.removeNotification(id);
        break;
      }
    }
  }

  /**
   * Remove oldest notification when limit exceeded
   */
  private removeOldestNotification(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, notification] of this.activeNotifications) {
      if (notification.createdAt < oldestTime) {
        oldestTime = notification.createdAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.removeNotification(oldestId);
    }
  }

  /**
   * Clear all notifications with animation
   */
  private clearAllNotifications(): void {
    const notificationIds = Array.from(this.activeNotifications.keys());

    notificationIds.forEach((id, index) => {
      // Stagger removals for better visual effect
      this.setTimer(
        `clear-notification-${id}`,
        () => {
          this.removeNotification(id);
        },
        index * 100
      );
    });

    this.log('🧹 All notifications cleared');
  }

  /**
   * Animate notification exit
   */
  private animateNotificationExit(element: HTMLElement, onComplete: () => void): void {
    element.style.animation = 'enhanced-notification-exit 0.3s ease-in forwards';

    this.setTimer('notification-exit', onComplete, 300);
  }

  // ============================================================================
  // STYLES AND CSS
  // ============================================================================

  /**
   * Setup notification styles with enhanced animations
   */
  public setupNotificationStyles(): void {
    if (document.querySelector('#enhanced-notification-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'enhanced-notification-styles';
    style.textContent = `
      @keyframes enhanced-notification-entrance {
        from { 
          opacity: 0; 
          transform: translateX(100%) scale(0.8); 
        }
        to { 
          opacity: 1; 
          transform: translateX(0) scale(1); 
        }
      }
      
      @keyframes enhanced-notification-exit {
        from { 
          opacity: 1; 
          transform: translateX(0) scale(1); 
        }
        to { 
          opacity: 0; 
          transform: translateX(100%) scale(0.8); 
        }
      }
      
      @keyframes enhanced-alt-click-pulse {
        0% { 
          transform: scale(1); 
          box-shadow: 0 0 0 0 rgba(0, 122, 204, 0.7); 
        }
        50% { 
          transform: scale(1.2); 
          box-shadow: 0 0 0 8px rgba(0, 122, 204, 0.3); 
        }
        100% { 
          transform: scale(1.5); 
          opacity: 0; 
          box-shadow: 0 0 0 16px rgba(0, 122, 204, 0); 
        }
      }
      
      .enhanced-notification {
        animation: enhanced-notification-entrance 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .enhanced-notification:hover {
        transform: scale(1.02);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      }
    `;

    document.head.appendChild(style);
    this.log('🎨 Enhanced notification styles setup');
  }

  /**
   * Remove notification styles
   */
  private removeNotificationStyles(): void {
    const style = document.querySelector('#enhanced-notification-styles');
    if (style) {
      style.remove();
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle page visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Pause animations when page is hidden
      this.activeNotifications.forEach((notification) => {
        notification.element.style.animationPlayState = 'paused';
      });
    } else {
      // Resume animations when page is visible
      this.activeNotifications.forEach((notification) => {
        notification.element.style.animationPlayState = 'running';
      });
    }
  }

  /**
   * Handle DOM node removal to clean up orphaned notifications
   */
  private handleDOMNodeRemoval(event: Event): void {
    const target = event.target as HTMLElement;
    if (target?.classList?.contains('enhanced-notification')) {
      // Clean up tracking for removed notifications
      this.removeNotificationByElement(target);
    }
  }

  // ============================================================================
  // STATISTICS AND MONITORING
  // ============================================================================

  /**
   * Get notification statistics
   */
  public getStats(): NotificationStatistics {
    return {
      activeCount: this.activeNotifications.size,
      totalCreated: this.notificationCounter,
      dismissedCount: this.dismissedCount,
      errorNotifications: this.errorNotificationCount,
    };
  }
}
