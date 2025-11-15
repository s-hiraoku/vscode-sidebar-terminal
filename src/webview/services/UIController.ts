/**
 * UI Controller Implementation
 * Handles all visual aspects of the terminal interface
 */

import {
  IUIController,
  DebugInfo,
  NotificationOptions,
  UIControllerConfig
} from './IUIController';
import { BaseManager } from '../managers/BaseManager';

/**
 * UI Controller manages all visual elements and interactions
 */
export class UIController extends BaseManager implements IUIController {
  private readonly config: UIControllerConfig;
  private isDebugPanelVisible = false;
  private currentNotifications = new Set<HTMLElement>();
  private loadingElement: HTMLElement | null = null;

  constructor(config: UIControllerConfig) {
    super('UIController', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.config = config;
  }

  /**
   * Public initialize method to satisfy interface
   */
  public override async initialize(): Promise<void> {
    // Call the base manager initialization
    this.doInitialize();
  }

  protected doInitialize(): void {
    this.initializeUIElements();
    this.setupEventHandlers();
    this.logger('UI Controller initialized');
  }

  protected doDispose(): void {
    this.clearNotifications();
    this.hideLoadingState();
    this.currentNotifications.clear();
    this.logger('UI Controller disposed');
  }

  private initializeUIElements(): void {
    // Ensure required UI elements exist
    this.ensureElement('terminal-tabs-container', 'div');
    this.ensureElement('terminal-count-display', 'div');
    this.ensureElement('system-status-indicator', 'div');
    this.ensureElement('create-terminal-button', 'button');
    this.ensureElement('split-terminal-button', 'button');
    this.ensureElement('notification-container', 'div');

    if (this.config.enableDebugPanel) {
      this.ensureElement('debug-panel', 'div');
      this.ensureElement('debug-toggle-button', 'button');
    }

    if (this.config.enableCliAgentStatus) {
      this.ensureElement('cli-agent-status', 'div');
    }
  }

  private ensureElement(id: string, tagName: string): HTMLElement {
    let element = document.getElementById(id);
    if (!element) {
      element = document.createElement(tagName);
      element.id = id;
      document.body.appendChild(element);
    }
    return element;
  }

  private setupEventHandlers(): void {
    if (this.config.enableDebugPanel) {
      const debugToggle = document.getElementById('debug-toggle-button');
      if (debugToggle) {
        debugToggle.addEventListener('click', () => this.toggleDebugPanel());
      }
    }
  }

  // UI State Management
  public updateTerminalTabs(terminalInfos: Array<{ id: string; number: number; isActive: boolean }>): void {
    const tabsContainer = document.getElementById('terminal-tabs-container');
    if (!tabsContainer) return;

    // Clear existing tabs
    tabsContainer.textContent = ''; // Safe: clearing content

    // Create tabs for each terminal
    for (const terminalInfo of terminalInfos) {
      const tab = this.createTerminalTab(terminalInfo);
      tabsContainer.appendChild(tab);
    }

    this.logger(`Updated terminal tabs: ${terminalInfos.length} terminals`);
  }

  private createTerminalTab(terminalInfo: { id: string; number: number; isActive: boolean }): HTMLElement {
    const tab = document.createElement('div');
    tab.className = `terminal-tab ${terminalInfo.isActive ? 'active' : ''}`;
    tab.setAttribute('data-terminal-id', terminalInfo.id);

    // SECURITY: Build DOM structure safely to prevent XSS
    const numberSpan = document.createElement('span');
    numberSpan.className = 'tab-number';
    numberSpan.textContent = String(terminalInfo.number);

    const closeSpan = document.createElement('span');
    closeSpan.className = 'tab-close';
    closeSpan.setAttribute('data-action', 'close');
    closeSpan.textContent = '×';

    tab.appendChild(numberSpan);
    tab.appendChild(closeSpan);

    // Add click handlers
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute('data-action') === 'close') {
        this.emitTerminalCloseRequest(terminalInfo.id);
      } else {
        this.emitTerminalSwitchRequest(terminalInfo.id);
      }
    });

    return tab;
  }

  private emitTerminalCloseRequest(terminalId: string): void {
    const event = new CustomEvent('terminal-close-requested', {
      detail: { terminalId }
    });
    document.dispatchEvent(event);
  }

  private emitTerminalSwitchRequest(terminalId: string): void {
    const event = new CustomEvent('terminal-switch-requested', {
      detail: { terminalId }
    });
    document.dispatchEvent(event);
  }

  public updateActiveTerminalIndicator(terminalId: string | undefined): void {
    const tabs = document.querySelectorAll('.terminal-tab');
    tabs.forEach(tab => {
      const tabElement = tab as HTMLElement;
      const tabTerminalId = tabElement.getAttribute('data-terminal-id');

      if (tabTerminalId === terminalId) {
        tabElement.classList.add('active');
      } else {
        tabElement.classList.remove('active');
      }
    });
  }

  public updateTerminalCountDisplay(count: number, maxCount: number): void {
    const display = document.getElementById('terminal-count-display');
    if (display) {
      display.textContent = `${count}/${maxCount}`;
      display.className = count >= maxCount ? 'terminal-count-full' : 'terminal-count-normal';
    }
  }

  public updateSystemStatus(status: 'READY' | 'BUSY' | 'ERROR'): void {
    const indicator = document.getElementById('system-status-indicator');
    if (indicator) {
      indicator.textContent = status;
      indicator.className = `system-status status-${status.toLowerCase()}`;
    }
  }

  // Terminal UI Operations
  public showTerminalContainer(terminalId: string, container: HTMLElement): void {
    // Hide all other containers
    const allContainers = document.querySelectorAll('.terminal-container');
    allContainers.forEach(c => {
      (c as HTMLElement).style.display = 'none';
    });

    // Show the specified container
    container.style.display = 'block';

    // Ensure container is in the terminal area
    const terminalArea = document.getElementById('terminal-area');
    if (terminalArea && !terminalArea.contains(container)) {
      terminalArea.appendChild(container);
    }

    this.logger(`Showing terminal container: ${terminalId}`);
  }

  public hideTerminalContainer(terminalId: string): void {
    const container = document.getElementById(`terminal-container-${terminalId}`);
    if (container) {
      container.style.display = 'none';
    }
  }

  public highlightActiveTerminal(terminalId: string): void {
    // Remove highlight from all containers
    const allContainers = document.querySelectorAll('.terminal-container');
    allContainers.forEach(c => c.classList.remove('active-terminal'));

    // Add highlight to active container
    const container = document.getElementById(`terminal-container-${terminalId}`);
    if (container) {
      container.classList.add('active-terminal');
    }
  }

  // Control Elements
  public setCreateButtonEnabled(enabled: boolean): void {
    const button = document.getElementById('create-terminal-button') as HTMLButtonElement;
    if (button) {
      button.disabled = !enabled;
      button.className = enabled ? 'button-enabled' : 'button-disabled';
    }
  }

  public updateSplitButtonVisibility(visible: boolean): void {
    const button = document.getElementById('split-terminal-button');
    if (button) {
      button.style.display = visible ? 'block' : 'none';
    }
  }

  public showTerminalLimitMessage(currentCount: number, maxCount: number): void {
    this.showNotification({
      type: 'warning',
      message: `Terminal limit reached (${currentCount}/${maxCount}). Close a terminal to create a new one.`,
      duration: 5000
    });
  }

  public clearTerminalLimitMessage(): void {
    // Remove any limit-related notifications
    this.currentNotifications.forEach(notification => {
      if (notification.textContent?.includes('Terminal limit reached')) {
        notification.remove();
        this.currentNotifications.delete(notification);
      }
    });
  }

  // Debug Panel
  public toggleDebugPanel(): void {
    if (!this.config.enableDebugPanel) return;

    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
      this.isDebugPanelVisible = !this.isDebugPanelVisible;
      debugPanel.style.display = this.isDebugPanelVisible ? 'block' : 'none';

      this.logger(`Debug panel ${this.isDebugPanelVisible ? 'shown' : 'hidden'}`);
    }
  }

  public updateDebugInfo(debugInfo: DebugInfo): void {
    if (!this.config.enableDebugPanel) return;

    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
      // SECURITY: Build DOM structure safely to prevent XSS
      debugPanel.textContent = ''; // Clear existing content

      const h3 = document.createElement('h3');
      h3.textContent = 'Debug Information';
      debugPanel.appendChild(h3);

      // System Status
      const statusSection = document.createElement('div');
      statusSection.className = 'debug-section';
      const statusLabel = document.createElement('strong');
      statusLabel.textContent = 'System Status: ';
      statusSection.appendChild(statusLabel);
      statusSection.appendChild(document.createTextNode(debugInfo.systemStatus));
      debugPanel.appendChild(statusSection);

      // Active Terminal
      const terminalSection = document.createElement('div');
      terminalSection.className = 'debug-section';
      const terminalLabel = document.createElement('strong');
      terminalLabel.textContent = 'Active Terminal: ';
      terminalSection.appendChild(terminalLabel);
      terminalSection.appendChild(document.createTextNode(debugInfo.activeTerminal || 'None'));
      debugPanel.appendChild(terminalSection);

      // Terminal Count
      const countSection = document.createElement('div');
      countSection.className = 'debug-section';
      const countLabel = document.createElement('strong');
      countLabel.textContent = 'Terminal Count: ';
      countSection.appendChild(countLabel);
      countSection.appendChild(document.createTextNode(String(debugInfo.terminalCount)));
      debugPanel.appendChild(countSection);

      // Available Slots
      const slotsSection = document.createElement('div');
      slotsSection.className = 'debug-section';
      const slotsLabel = document.createElement('strong');
      slotsLabel.textContent = 'Available Slots: ';
      slotsSection.appendChild(slotsLabel);
      slotsSection.appendChild(document.createTextNode(String(debugInfo.availableSlots)));
      debugPanel.appendChild(slotsSection);

      // Uptime
      const uptimeSection = document.createElement('div');
      uptimeSection.className = 'debug-section';
      const uptimeLabel = document.createElement('strong');
      uptimeLabel.textContent = 'Uptime: ';
      uptimeSection.appendChild(uptimeLabel);
      uptimeSection.appendChild(document.createTextNode(debugInfo.uptime));
      debugPanel.appendChild(uptimeSection);

      // Pending Operations
      const opsSection = document.createElement('div');
      opsSection.className = 'debug-section';
      const opsLabel = document.createElement('strong');
      opsLabel.textContent = 'Pending Operations: ';
      opsSection.appendChild(opsLabel);
      opsSection.appendChild(document.createTextNode(String(debugInfo.pendingOperations.length)));

      if (debugInfo.pendingOperations.length > 0) {
        const ul = document.createElement('ul');
        debugInfo.pendingOperations.forEach(op => {
          const li = document.createElement('li');
          li.textContent = op;
          ul.appendChild(li);
        });
        opsSection.appendChild(ul);
      }
      debugPanel.appendChild(opsSection);
    }
  }

  public exportSystemDiagnostics(): void {
    // Implementation for exporting diagnostics
    const diagnostics = {
      timestamp: new Date().toISOString(),
      debugPanelVisible: this.isDebugPanelVisible,
      notificationCount: this.currentNotifications.size,
      // Add more diagnostic information as needed
    };

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terminal-diagnostics.json';
    a.click();
    URL.revokeObjectURL(url);

    this.logger('System diagnostics exported');
  }

  // Notifications
  public showNotification(options: NotificationOptions): void {
    if (!this.config.enableNotifications) return;

    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification notification-${options.type}`;

    // SECURITY: Build DOM structure safely to prevent XSS
    const contentDiv = document.createElement('div');
    contentDiv.className = 'notification-content';

    const messageSpan = document.createElement('span');
    messageSpan.className = 'notification-message';
    messageSpan.textContent = options.message; // Safe: textContent escapes HTML

    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.textContent = '×';

    contentDiv.appendChild(messageSpan);
    contentDiv.appendChild(closeButton);
    notification.appendChild(contentDiv);

    // Add close handler
    closeButton.addEventListener('click', () => {
      this.removeNotification(notification);
    });

    // Add action buttons if provided
    if (options.actions) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'notification-actions';

      for (const action of options.actions) {
        const button = document.createElement('button');
        button.className = 'notification-action';
        button.textContent = action.label;
        button.addEventListener('click', () => {
          action.action();
          this.removeNotification(notification);
        });
        actionsContainer.appendChild(button);
      }

      notification.appendChild(actionsContainer);
    }

    container.appendChild(notification);
    this.currentNotifications.add(notification);

    // Auto-remove after duration
    if (options.duration && options.duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification);
      }, options.duration);
    }
  }

  private removeNotification(notification: HTMLElement): void {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
    this.currentNotifications.delete(notification);
  }

  public clearNotifications(): void {
    this.currentNotifications.forEach(notification => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
    this.currentNotifications.clear();
  }

  // Settings UI
  public openSettings(): void {
    const event = new CustomEvent('settings-open-requested');
    document.dispatchEvent(event);
  }

  public updateTheme(theme: Record<string, string>): void {
    const root = document.documentElement;
    for (const [property, value] of Object.entries(theme)) {
      root.style.setProperty(property, value);
    }
    this.logger('Theme updated');
  }

  public updateFontSettings(fontFamily: string, fontSize: number): void {
    const root = document.documentElement;
    root.style.setProperty('--terminal-font-family', fontFamily);
    root.style.setProperty('--terminal-font-size', `${fontSize}px`);
    this.logger(`Font settings updated: ${fontFamily}, ${fontSize}px`);
  }

  // CLI Agent Status
  public updateCliAgentStatus(isConnected: boolean, agentType?: string): void {
    if (!this.config.enableCliAgentStatus) return;

    const statusElement = document.getElementById('cli-agent-status');
    if (statusElement) {
      statusElement.className = `cli-agent-status ${isConnected ? 'connected' : 'disconnected'}`;
      statusElement.textContent = isConnected
        ? `${agentType || 'CLI Agent'} Connected`
        : 'CLI Agent Disconnected';
    }
  }

  public showCliAgentIndicator(visible: boolean): void {
    const indicator = document.getElementById('cli-agent-status');
    if (indicator) {
      indicator.style.display = visible ? 'block' : 'none';
    }
  }

  // Layout Management
  public updateSplitLayout(layout: 'horizontal' | 'vertical' | 'grid'): void {
    const terminalArea = document.getElementById('terminal-area');
    if (terminalArea) {
      terminalArea.className = `terminal-area layout-${layout}`;
    }
  }

  public resizeTerminalContainers(cols: number, rows: number): void {
    const containers = document.querySelectorAll('.terminal-container');
    containers.forEach(container => {
      const terminal = (container as HTMLElement & { _terminal?: { resize: (cols: number, rows: number) => void } })._terminal;
      if (terminal && terminal.resize) {
        terminal.resize(cols, rows);
      }
    });
  }

  // Loading States
  public showLoadingState(message: string): void {
    this.hideLoadingState(); // Remove any existing loading state

    this.loadingElement = document.createElement('div');
    this.loadingElement.className = 'loading-overlay';

    // SECURITY: Build DOM structure safely to prevent XSS
    const contentDiv = document.createElement('div');
    contentDiv.className = 'loading-content';

    const spinnerDiv = document.createElement('div');
    spinnerDiv.className = 'loading-spinner';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'loading-message';
    messageDiv.textContent = message; // Safe: textContent escapes HTML

    contentDiv.appendChild(spinnerDiv);
    contentDiv.appendChild(messageDiv);
    this.loadingElement.appendChild(contentDiv);

    document.body.appendChild(this.loadingElement);
  }

  public hideLoadingState(): void {
    if (this.loadingElement && this.loadingElement.parentNode) {
      this.loadingElement.parentNode.removeChild(this.loadingElement);
      this.loadingElement = null;
    }
  }
}

/**
 * Factory for creating UI controllers
 */
export class UIControllerFactory {
  public static create(config: UIControllerConfig): IUIController {
    return new UIController(config);
  }

  public static createDefault(): IUIController {
    const defaultConfig: UIControllerConfig = {
      enableDebugPanel: true,
      enableNotifications: true,
      enableCliAgentStatus: true,
      defaultTheme: {
        '--terminal-background': '#1e1e1e',
        '--terminal-foreground': '#d4d4d4',
      },
      animationDuration: 300,
    };

    return new UIController(defaultConfig);
  }
}

// Re-export the interface for convenience
export { IUIController } from './IUIController';