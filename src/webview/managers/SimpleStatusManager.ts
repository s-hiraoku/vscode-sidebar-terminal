/**
 * シンプルなステータス管理クラス
 */
export class SimpleStatusManager {
  private statusElement: HTMLElement | null = null;
  private hideTimer: number | null = null;
  private readonly DEFAULT_DISPLAY_DURATION = 3000;
  private readonly ERROR_DISPLAY_DURATION = 5000;
  private lastMessage = '';
  private lastType: 'info' | 'success' | 'error' = 'info';
  private isStatusVisible = false;

  public showStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.lastMessage = message;
    this.lastType = type;

    // Get or create status element
    const statusEl = this.getOrCreateStatusElement();
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;

    // Show status with animation
    this.showStatusElement();

    // Clear existing timer
    this.clearTimer();

    // Set timer based on message type
    const duration = type === 'error' ? this.ERROR_DISPLAY_DURATION : this.DEFAULT_DISPLAY_DURATION;

    this.hideTimer = window.setTimeout(() => {
      this.hideStatusWithAnimation();
    }, duration);

    console.log(`🎯 [STATUS] [${type.toUpperCase()}]`, message);
  }

  public hideStatus(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
    }
    this.clearTimer();
  }

  public showLastStatusOnActivity(): void {
    if (this.lastMessage && this.statusElement?.style.display === 'none') {
      console.log('📱 [STATUS] Showing status due to user activity');
      this.showStatus(this.lastMessage, this.lastType);
    }
  }

  private hideStatusWithAnimation(): void {
    if (this.statusElement) {
      // Fade out animation
      this.statusElement.style.opacity = '0';
      this.statusElement.style.transform = 'translateY(-100%)';

      // Hide after animation completes
      setTimeout(() => {
        this.hideStatusElement();
      }, 300);
    }
    this.clearTimer();
  }

  private getOrCreateStatusElement(): HTMLElement {
    if (!this.statusElement) {
      this.statusElement = document.getElementById('status');
      if (this.statusElement) {
        this.setupStatusInteraction();
        this.addStatusStyles();
      }
    }
    return this.statusElement || document.createElement('div');
  }

  private setupStatusInteraction(): void {
    if (this.statusElement) {
      // Mouse hover stops the timer
      this.statusElement.addEventListener('mouseenter', () => {
        this.clearTimer();
      });

      // Mouse leave restarts timer (shorter duration)
      this.statusElement.addEventListener('mouseleave', () => {
        this.hideTimer = window.setTimeout(() => {
          this.hideStatusWithAnimation();
        }, 1000);
      });

      // Click to immediately hide
      this.statusElement.addEventListener('click', () => {
        this.hideStatusWithAnimation();
      });
    }
  }

  private addStatusStyles(): void {
    // Add status styling if not already added
    if (!document.getElementById('status-styles')) {
      const style = document.createElement('style');
      style.id = 'status-styles';
      style.textContent = `
        .status {
          transition: opacity 0.3s ease, transform 0.3s ease;
          cursor: pointer;
          position: absolute;
          top: 5px;
          left: 5px;
          z-index: 1000;
          color: #00ff00;
          font-size: 11px;
          font-family: monospace;
          background: rgba(0, 0, 0, 0.8);
          padding: 2px 6px;
          border-radius: 3px;
          max-width: 300px;
          word-break: break-all;
        }
        .status-info {
          background: var(--vscode-statusBar-background, #007acc);
          color: var(--vscode-statusBar-foreground, #ffffff);
        }
        .status-success {
          background: var(--vscode-statusBarItem-prominentBackground, #16825d);
          color: var(--vscode-statusBarItem-prominentForeground, #ffffff);
        }
        .status-error {
          background: var(--vscode-errorBackground, #f14c4c);
          color: var(--vscode-errorForeground, #ffffff);
        }
        .status:hover {
          opacity: 0.8;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private clearTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private showStatusElement(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'block';
      this.statusElement.style.opacity = '1';
      this.statusElement.style.transform = 'translateY(0)';
      this.isStatusVisible = true;
    }
  }

  private hideStatusElement(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
      this.isStatusVisible = false;

      // Reset styles for next show
      this.statusElement.style.opacity = '1';
      this.statusElement.style.transform = 'translateY(0)';
    }
  }
}
