/**
 * シンプルなステータス管理クラス
 */
export class SimpleStatusManager {
  private statusElement: HTMLElement | null = null;
  private hideTimer: number | null = null;
  private readonly DEFAULT_DISPLAY_DURATION = 3000;
  private readonly ERROR_DISPLAY_DURATION = 5000;

  public showStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
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
    // Disabled: Do not re-show status on activity to maintain toast behavior
    console.log('📱 [STATUS] Activity detected but auto re-show disabled');
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
    // Status styles are now defined in CSS - no need for duplicate styles
    console.log('📱 [STATUS] Using CSS-defined status styles');
  }

  private clearTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private showStatusElement(): void {
    if (this.statusElement) {
      // Start with slide-in animation from top
      this.statusElement.style.display = 'block';
      this.statusElement.style.opacity = '0';
      this.statusElement.style.transform = 'translateY(-100%)';

      // Trigger reflow and animate in
      setTimeout(() => {
        if (this.statusElement) {
          this.statusElement.style.opacity = '1';
          this.statusElement.style.transform = 'translateY(0)';
        }
      }, 10);
    }
  }

  private hideStatusElement(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';

      // Reset styles for next show
      this.statusElement.style.opacity = '1';
      this.statusElement.style.transform = 'translateY(0)';
    }
  }
}
