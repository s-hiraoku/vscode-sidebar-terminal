import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIController } from '../../../../../../src/webview/services/UIController';
import { UIControllerConfig } from '../../../../../../src/webview/services/IUIController';

describe('UIController', () => {
  let uiController: UIController;
  let config: UIControllerConfig;

  beforeEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';

    // Default config
    config = {
      enableDebugPanel: true,
      enableNotifications: true,
      enableCliAgentStatus: true,
      defaultTheme: {},
      animationDuration: 300,
    };

    uiController = new UIController(config);
  });

  afterEach(() => {
    uiController.dispose();
  });

  describe('Initialization', () => {
    it('should create required DOM elements on initialization', async () => {
      await uiController.initialize();

      expect(document.getElementById('terminal-tabs-container')).toBeTruthy();
      expect(document.getElementById('terminal-count-display')).toBeTruthy();
      expect(document.getElementById('system-status-indicator')).toBeTruthy();
      expect(document.getElementById('create-terminal-button')).toBeTruthy();
      expect(document.getElementById('split-terminal-button')).toBeTruthy();
      expect(document.getElementById('notification-container')).toBeTruthy();
      expect(document.getElementById('debug-panel')).toBeTruthy();
      expect(document.getElementById('cli-agent-status')).toBeTruthy();
    });

    it('should not create debug panel if disabled', async () => {
      config.enableDebugPanel = false;
      uiController = new UIController(config);
      await uiController.initialize();

      expect(document.getElementById('debug-panel')).toBeFalsy();
    });

    it('should not create cli agent status if disabled', async () => {
      config.enableCliAgentStatus = false;
      uiController = new UIController(config);
      await uiController.initialize();

      expect(document.getElementById('cli-agent-status')).toBeFalsy();
    });
  });

  describe('Terminal Tabs', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should update terminal tabs', () => {
      const terminals = [
        { id: 't1', number: 1, isActive: true },
        { id: 't2', number: 2, isActive: false },
      ];

      uiController.updateTerminalTabs(terminals);

      const tabsContainer = document.getElementById('terminal-tabs-container');
      expect(tabsContainer?.children.length).toBe(2);

      const tab1 = tabsContainer?.children[0] as HTMLElement;
      expect(tab1.getAttribute('data-terminal-id')).toBe('t1');
      expect(tab1.classList.contains('active')).toBe(true);

      const tab2 = tabsContainer?.children[1] as HTMLElement;
      expect(tab2.getAttribute('data-terminal-id')).toBe('t2');
      expect(tab2.classList.contains('active')).toBe(false);
    });

    it('should emit switch request when clicking a tab', () => {
      const terminals = [{ id: 't1', number: 1, isActive: false }];
      uiController.updateTerminalTabs(terminals);

      const listener = vi.fn();
      document.addEventListener('terminal-switch-requested', listener);

      const tab = document.querySelector('.terminal-tab') as HTMLElement;
      tab.click();

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toEqual({ terminalId: 't1' });
    });

    it('should emit close request when clicking close button', () => {
      const terminals = [{ id: 't1', number: 1, isActive: false }];
      uiController.updateTerminalTabs(terminals);

      const listener = vi.fn();
      document.addEventListener('terminal-close-requested', listener);

      const closeBtn = document.querySelector('.tab-close') as HTMLElement;
      closeBtn.click();

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toEqual({ terminalId: 't1' });
    });
  });

  describe('Notifications', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should show notification', () => {
      uiController.showNotification({
        type: 'info',
        message: 'Test notification',
      });

      const container = document.getElementById('notification-container');
      expect(container?.children.length).toBe(1);
      expect(container?.textContent).toContain('Test notification');
    });

    it('should remove notification on close click', () => {
      uiController.showNotification({
        type: 'info',
        message: 'Test notification',
      });

      const closeBtn = document.querySelector('.notification-close') as HTMLElement;
      closeBtn.click();

      const container = document.getElementById('notification-container');
      expect(container?.children.length).toBe(0);
    });

    it('should auto-remove notification after duration', () => {
      vi.useFakeTimers();
      uiController.showNotification({
        type: 'info',
        message: 'Test notification',
        duration: 1000,
      });

      const container = document.getElementById('notification-container');
      expect(container?.children.length).toBe(1);

      vi.advanceTimersByTime(1000);

      expect(container?.children.length).toBe(0);
      vi.useRealTimers();
    });
  });

  describe('Loading State', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should show and hide loading state', () => {
      uiController.showLoadingState('Loading...');
      expect(document.querySelector('.loading-overlay')).toBeTruthy();
      expect(document.querySelector('.loading-message')?.textContent).toBe('Loading...');

      uiController.hideLoadingState();
      expect(document.querySelector('.loading-overlay')).toBeFalsy();
    });
  });
});
