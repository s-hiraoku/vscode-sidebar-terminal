/**
 * Comprehensive test suite for UIController service
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { UIController, UIControllerFactory } from '../../../../../src/webview/services/UIController';
import { UIControllerConfig } from '../../../../../src/webview/services/IUIController';

describe('UIController Service', () => {
  let uiController: UIController;
  let mockConfig: UIControllerConfig;
  let dom: JSDOM;

  beforeEach(() => {
    // Setup JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
    });
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.CustomEvent = dom.window.CustomEvent;

    // Setup DOM environment
    document.body.innerHTML = `
      <div id="terminal-tabs-container"></div>
      <div id="terminal-count-display"></div>
      <div id="system-status-indicator"></div>
      <button id="create-terminal-button"></button>
      <button id="split-terminal-button"></button>
      <div id="notification-container"></div>
      <div id="debug-panel" style="display: none;"></div>
      <button id="debug-toggle-button"></button>
      <div id="cli-agent-status"></div>
      <div id="terminal-area"></div>
    `;

    mockConfig = {
      enableDebugPanel: true,
      enableNotifications: true,
      enableCliAgentStatus: true,
      defaultTheme: {
        '--terminal-background': '#1e1e1e',
        '--terminal-foreground': '#d4d4d4',
      },
      animationDuration: 300,
    };

    uiController = new UIController(mockConfig);
  });

  afterEach(() => {
    uiController.dispose();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with required UI elements', async () => {
      await uiController.initialize();

      const requiredElements = [
        'terminal-tabs-container',
        'terminal-count-display',
        'system-status-indicator',
        'create-terminal-button',
        'split-terminal-button',
        'notification-container',
      ];

      for (const elementId of requiredElements) {
        const element = document.getElementById(elementId);
        expect(element).toBeTruthy();
      }
    });

    it('should create missing elements during initialization', async () => {
      // Remove some elements
      document.getElementById('terminal-tabs-container')?.remove();
      document.getElementById('notification-container')?.remove();

      await uiController.initialize();

      // Should recreate them
      expect(document.getElementById('terminal-tabs-container')).toBeTruthy();
      expect(document.getElementById('notification-container')).toBeTruthy();
    });

    it('should setup debug panel when enabled', async () => {
      await uiController.initialize();

      const debugPanel = document.getElementById('debug-panel');
      const debugToggle = document.getElementById('debug-toggle-button');

      expect(debugPanel).toBeTruthy();
      expect(debugToggle).toBeTruthy();
    });

    it('should setup CLI agent status when enabled', async () => {
      await uiController.initialize();

      const cliAgentStatus = document.getElementById('cli-agent-status');
      expect(cliAgentStatus).toBeTruthy();
    });

    it('should use factory defaults correctly', () => {
      const defaultController = UIControllerFactory.createDefault();
      expect(defaultController).toBeInstanceOf(UIController);
      defaultController.dispose();
    });

    it('should use custom configuration', () => {
      const customConfig: UIControllerConfig = {
        enableDebugPanel: false,
        enableNotifications: false,
        enableCliAgentStatus: false,
        defaultTheme: { '--background': '#000' },
        animationDuration: 500,
      };

      const customController = UIControllerFactory.create(customConfig);
      expect(customController).toBeInstanceOf(UIController);
      customController.dispose();
    });
  });

  describe('Terminal Tabs Management', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should update terminal tabs display', () => {
      const terminalInfos = [
        { id: 'terminal-1', number: 1, isActive: true },
        { id: 'terminal-2', number: 2, isActive: false },
        { id: 'terminal-3', number: 3, isActive: false },
      ];

      uiController.updateTerminalTabs(terminalInfos);

      const tabsContainer = document.getElementById('terminal-tabs-container');
      expect(tabsContainer?.children.length).toBe(3);

      const tabs = tabsContainer?.querySelectorAll('.terminal-tab');
      expect(tabs).toBeTruthy();
      if (tabs) {
        expect(tabs[0]?.getAttribute('data-terminal-id')).toBe('terminal-1');
        expect(tabs[1]?.getAttribute('data-terminal-id')).toBe('terminal-2');
        expect(tabs[2]?.getAttribute('data-terminal-id')).toBe('terminal-3');
      }
    });

    it('should show active terminal correctly', () => {
      const terminalInfos = [
        { id: 'terminal-1', number: 1, isActive: false },
        { id: 'terminal-2', number: 2, isActive: true },
      ];

      uiController.updateTerminalTabs(terminalInfos);

      const activeTab = document.querySelector('.terminal-tab.active');
      expect(activeTab?.getAttribute('data-terminal-id')).toBe('terminal-2');
    });

    it('should handle empty terminal list', () => {
      uiController.updateTerminalTabs([]);

      const tabsContainer = document.getElementById('terminal-tabs-container');
      expect(tabsContainer?.children.length).toBe(0);
    });

    it('should emit events when tabs are clicked', () => {
      const eventSpy = vi.spyOn(document, 'dispatchEvent');

      const terminalInfos = [{ id: 'terminal-1', number: 1, isActive: true }];

      uiController.updateTerminalTabs(terminalInfos);

      const tab = document.querySelector('.terminal-tab') as HTMLElement;
      tab.click();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit close events when close button clicked', () => {
      const eventSpy = vi.spyOn(document, 'dispatchEvent');

      const terminalInfos = [{ id: 'terminal-1', number: 1, isActive: true }];

      uiController.updateTerminalTabs(terminalInfos);

      const closeButton = document.querySelector('.tab-close') as HTMLElement;
      closeButton.click();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should update active terminal indicator when terminalId is undefined', () => {
      const terminalInfos = [{ id: 'terminal-1', number: 1, isActive: true }];
      uiController.updateTerminalTabs(terminalInfos);
      
      uiController.updateActiveTerminalIndicator(undefined);
      const activeTab = document.querySelector('.terminal-tab.active');
      expect(activeTab).toBeFalsy();
    });
  });

  describe('System Status Management', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should update system status indicator', () => {
      uiController.updateSystemStatus('BUSY');

      const indicator = document.getElementById('system-status-indicator');
      expect(indicator?.textContent).toBe('BUSY');
      expect(indicator?.className).toContain('status-busy');
    });

    it('should handle different status types', () => {
      const statuses = ['READY', 'BUSY', 'ERROR'] as const;

      for (const status of statuses) {
        uiController.updateSystemStatus(status);

        const indicator = document.getElementById('system-status-indicator');
        expect(indicator?.textContent).toBe(status);
        expect(indicator?.className).toContain(`status-${status.toLowerCase()}`);
      }
    });

    it('should update terminal count display', () => {
      uiController.updateTerminalCountDisplay(3, 5);

      const display = document.getElementById('terminal-count-display');
      expect(display?.textContent).toBe('3/5');
      expect(display?.className).toContain('terminal-count-normal');
    });

    it('should show full state when at capacity', () => {
      uiController.updateTerminalCountDisplay(5, 5);

      const display = document.getElementById('terminal-count-display');
      expect(display?.textContent).toBe('5/5');
      expect(display?.className).toContain('terminal-count-full');
    });
  });

  describe('Terminal Container Management', () => {
    let mockContainer: HTMLElement;

    beforeEach(async () => {
      await uiController.initialize();

      mockContainer = document.createElement('div');
      mockContainer.id = 'terminal-container-test';
      mockContainer.className = 'terminal-container';
      mockContainer.style.display = 'none';
    });

    it('should show terminal container', () => {
      uiController.showTerminalContainer('test', mockContainer);

      expect(mockContainer.style.display).toBe('block');

      const terminalArea = document.getElementById('terminal-area');
      expect(terminalArea?.contains(mockContainer)).toBe(true);
    });

    it('should hide other containers when showing one', () => {
      // Create additional containers
      const container1 = document.createElement('div');
      container1.className = 'terminal-container';
      container1.style.display = 'block';

      const container2 = document.createElement('div');
      container2.className = 'terminal-container';
      container2.style.display = 'block';

      document.body.appendChild(container1);
      document.body.appendChild(container2);

      uiController.showTerminalContainer('test', mockContainer);

      expect(container1.style.display).toBe('none');
      expect(container2.style.display).toBe('none');
      expect(mockContainer.style.display).toBe('block');
    });

    it('should hide terminal container', () => {
      mockContainer.style.display = 'block';
      document.body.appendChild(mockContainer);

      uiController.hideTerminalContainer('test');

      const container = document.getElementById('terminal-container-test');
      expect(container?.style.display).toBe('none');
    });

    it('should highlight active terminal', () => {
      mockContainer.id = 'terminal-container-active-test';
      document.body.appendChild(mockContainer);

      uiController.highlightActiveTerminal('active-test');

      expect(mockContainer.classList.contains('active-terminal')).toBe(true);
    });

    it('should handle terminal container not in terminal area', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';
      uiController.showTerminalContainer('test-3', container);
      
      const terminalArea = document.getElementById('terminal-area');
      expect(terminalArea?.contains(container)).toBe(true);
    });

    it('should handle missing terminal area gracefully', () => {
      document.getElementById('terminal-area')?.remove();
      const container = document.createElement('div');
      container.className = 'terminal-container';
      
      uiController.showTerminalContainer('test-4', container);
      // Should not throw
    });
  });

  describe('Control Elements', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should enable/disable create button', () => {
      const button = document.getElementById('create-terminal-button') as HTMLButtonElement;

      uiController.setCreateButtonEnabled(false);
      expect(button.disabled).toBe(true);
      expect(button.className).toContain('button-disabled');

      uiController.setCreateButtonEnabled(true);
      expect(button.disabled).toBe(false);
      expect(button.className).toContain('button-enabled');
    });

    it('should show/hide split button', () => {
      const button = document.getElementById('split-terminal-button');

      uiController.updateSplitButtonVisibility(false);
      expect(button?.style.display).toBe('none');

      uiController.updateSplitButtonVisibility(true);
      expect(button?.style.display).toBe('block');
    });

    it('should show terminal limit message', () => {
      uiController.showTerminalLimitMessage(5, 5);

      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();
      expect(notification?.textContent).toContain('Terminal limit reached');
      expect(notification?.textContent).toContain('5/5');
    });

    it('should clear terminal limit message', () => {
      uiController.showTerminalLimitMessage(5, 5);
      expect(document.querySelector('.notification')).toBeTruthy();

      uiController.clearTerminalLimitMessage();
      expect(document.querySelector('.notification')).toBeFalsy();
    });
  });

  describe('Debug Panel', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should toggle debug panel visibility', () => {
      const debugPanel = document.getElementById('debug-panel');

      uiController.toggleDebugPanel();
      expect(debugPanel?.style.display).toBe('block');

      uiController.toggleDebugPanel();
      expect(debugPanel?.style.display).toBe('none');
    });

    it('should update debug info', () => {
      const debugInfo = {
        systemStatus: 'READY' as const,
        activeTerminal: 'terminal-1',
        terminalCount: 3,
        availableSlots: 2,
        uptime: '5 minutes',
        performanceMetrics: {
          memoryUsage: 50,
          cpuUsage: 25,
          renderFrames: 60,
          averageResponseTime: 10,
          bufferSize: 1024,
        },
        pendingOperations: ['create-terminal', 'delete-terminal'],
      };

      uiController.updateDebugInfo(debugInfo);

      const debugPanel = document.getElementById('debug-panel');
      expect(debugPanel?.innerHTML).toContain('READY');
      expect(debugPanel?.innerHTML).toContain('terminal-1');
      expect(debugPanel?.innerHTML).toContain('3');
      expect(debugPanel?.innerHTML).toContain('2');
      expect(debugPanel?.innerHTML).toContain('5 minutes');
      expect(debugPanel?.innerHTML).toContain('create-terminal');
      expect(debugPanel?.innerHTML).toContain('delete-terminal');
    });

    it('should handle empty pending operations', () => {
      const debugInfo = {
        systemStatus: 'READY' as const,
        activeTerminal: undefined,
        terminalCount: 0,
        availableSlots: 5,
        uptime: '0 seconds',
        performanceMetrics: {
          memoryUsage: 30,
          cpuUsage: 15,
          renderFrames: 60,
          averageResponseTime: 8,
          bufferSize: 512,
        },
        pendingOperations: [],
      };

      uiController.updateDebugInfo(debugInfo);

      const debugPanel = document.getElementById('debug-panel');
      expect(debugPanel?.innerHTML).toContain('None');
      expect(debugPanel?.innerHTML).toContain('0');
    });

    it('should export system diagnostics', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const clickSpy = vi.fn();

      // Mock the created anchor element
      createElementSpy.mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return {
            href: '',
            download: '',
            click: clickSpy,
          } as unknown as HTMLElement;
        }
        return dom.window.document.createElement(tagName);
      });

      global.URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:url'),
        revokeObjectURL: vi.fn(),
      } as any;

      global.Blob = vi.fn().mockImplementation(function(this: any) { return {}; }) as any;

      uiController.exportSystemDiagnostics();

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should not show debug panel when disabled', async () => {
      const disabledController = new UIController({
        ...mockConfig,
        enableDebugPanel: false,
      });

      await disabledController.initialize();

      disabledController.toggleDebugPanel();

      const debugPanel = document.getElementById('debug-panel');
      expect(debugPanel?.style.display).not.toBe('block');

      disabledController.dispose();
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
        duration: 5000,
      });

      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();
      expect(notification?.className).toContain('notification-info');
      expect(notification?.textContent).toContain('Test notification');
    });

    it('should show different notification types', () => {
      const types = ['info', 'warning', 'error', 'success'] as const;

      for (const type of types) {
        uiController.showNotification({
          type,
          message: `${type} message`,
          duration: 1000,
        });

        const notification = document.querySelector(`.notification-${type}`);
        expect(notification).toBeTruthy();
        expect(notification?.textContent).toContain(`${type} message`);
      }
    });

    it('should auto-remove notification after duration', async () => {
      vi.useFakeTimers();
      uiController.showNotification({
        type: 'info',
        message: 'Auto-remove test',
        duration: 50,
      });

      expect(document.querySelector('.notification')).toBeTruthy();

      await vi.advanceTimersByTimeAsync(100);
      
      expect(document.querySelector('.notification')).toBeFalsy();
      vi.useRealTimers();
    });

    it('should show notification with action buttons', () => {
      const actionSpy = vi.fn();

      uiController.showNotification({
        type: 'info',
        message: 'Test with actions',
        actions: [
          { label: 'Action 1', action: actionSpy },
          { label: 'Action 2', action: () => {} },
        ],
      });

      const actions = document.querySelectorAll('.notification-action');
      expect(actions.length).toBe(2);
      expect(actions[0]?.textContent).toBe('Action 1');

      (actions[0] as HTMLElement).click();
      expect(actionSpy).toHaveBeenCalled();
    });

    it('should close notification when close button clicked', () => {
      uiController.showNotification({
        type: 'info',
        message: 'Closeable notification',
      });

      const closeButton = document.querySelector('.notification-close') as HTMLElement;
      expect(closeButton).toBeTruthy();

      closeButton.click();
      expect(document.querySelector('.notification')).toBeFalsy();
    });

    it('should clear all notifications', () => {
      uiController.showNotification({
        type: 'info',
        message: 'Notification 1',
      });

      uiController.showNotification({
        type: 'warning',
        message: 'Notification 2',
      });

      expect(document.querySelectorAll('.notification').length).toBe(2);

      uiController.clearNotifications();
      expect(document.querySelectorAll('.notification').length).toBe(0);
    });

    it('should handle notification removal when already removed from DOM', () => {
      uiController.showNotification({ type: 'info', message: 'test' });
      const notification = document.querySelector('.notification') as HTMLElement;
      notification.remove(); // Manually remove from DOM
      
      uiController.clearNotifications(); // Should not throw
      expect(document.querySelector('.notification')).toBeFalsy();
    });

    it('should not show notifications when disabled', () => {
      const disabledController = new UIController({
        ...mockConfig,
        enableNotifications: false,
      });

      disabledController.showNotification({
        type: 'info',
        message: 'Should not show',
      });

      expect(document.querySelector('.notification')).toBeFalsy();

      disabledController.dispose();
    });
  });

  describe('Settings and Theme', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should open settings', () => {
      const eventSpy = vi.spyOn(document, 'dispatchEvent');

      uiController.openSettings();

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('settings-open-requested');
    });

    it('should update theme', () => {
      const theme = {
        '--terminal-background': '#000000',
        '--terminal-foreground': '#ffffff',
        '--custom-property': '#ff0000',
      };

      uiController.updateTheme(theme);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--terminal-background')).toBe('#000000');
      expect(root.style.getPropertyValue('--terminal-foreground')).toBe('#ffffff');
      expect(root.style.getPropertyValue('--custom-property')).toBe('#ff0000');
    });

    it('should update font settings', () => {
      uiController.updateFontSettings('Monaco', 16);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--terminal-font-family')).toBe('Monaco');
      expect(root.style.getPropertyValue('--terminal-font-size')).toBe('16px');
    });
  });

  describe('CLI Agent Status', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should update CLI agent status', () => {
      uiController.updateCliAgentStatus(true, 'Claude Code');

      const status = document.getElementById('cli-agent-status');
      expect(status?.textContent).toBe('Claude Code Connected');
      expect(status?.className).toContain('connected');
    });

    it('should update CLI agent status without agent type', () => {
      uiController.updateCliAgentStatus(true);
      const status = document.getElementById('cli-agent-status');
      expect(status?.textContent).toBe('CLI Agent Connected');
    });

    it('should show disconnected status', () => {
      uiController.updateCliAgentStatus(false);

      const status = document.getElementById('cli-agent-status');
      expect(status?.textContent).toBe('CLI Agent Disconnected');
      expect(status?.className).toContain('disconnected');
    });

    it('should show/hide CLI agent indicator', () => {
      const indicator = document.getElementById('cli-agent-status');

      uiController.showCliAgentIndicator(false);
      expect(indicator?.style.display).toBe('none');

      uiController.showCliAgentIndicator(true);
      expect(indicator?.style.display).toBe('block');
    });
  });

  describe('Layout Management', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should update split layout', () => {
      const terminalArea = document.getElementById('terminal-area');

      uiController.updateSplitLayout('horizontal');
      expect(terminalArea?.className).toContain('layout-horizontal');

      uiController.updateSplitLayout('vertical');
      expect(terminalArea?.className).toContain('layout-vertical');

      uiController.updateSplitLayout('grid');
      expect(terminalArea?.className).toContain('layout-grid');
    });

    it('should resize terminal containers', () => {
      const container1 = document.createElement('div') as any;
      container1.className = 'terminal-container';
      container1._terminal = { resize: vi.fn() };

      const container2 = document.createElement('div') as any;
      container2.className = 'terminal-container';
      container2._terminal = { resize: vi.fn() };

      document.body.appendChild(container1);
      document.body.appendChild(container2);

      uiController.resizeTerminalContainers(80, 24);

      expect(container1._terminal.resize).toHaveBeenCalledWith(80, 24);
      expect(container2._terminal.resize).toHaveBeenCalledWith(80, 24);
    });

    it('should handle containers without terminal instance during resize', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';
      document.body.appendChild(container);
      
      uiController.resizeTerminalContainers(80, 24);
      // Should not throw
    });
  });

  describe('Loading States', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should show loading state', () => {
      uiController.showLoadingState('Loading terminals...');

      const loadingOverlay = document.querySelector('.loading-overlay');
      expect(loadingOverlay).toBeTruthy();
      expect(loadingOverlay?.textContent).toContain('Loading terminals...');
    });

    it('should hide loading state', () => {
      uiController.showLoadingState('Loading...');
      expect(document.querySelector('.loading-overlay')).toBeTruthy();

      uiController.hideLoadingState();
      expect(document.querySelector('.loading-overlay')).toBeFalsy();
    });

    it('should replace existing loading state', () => {
      uiController.showLoadingState('Loading 1...');
      uiController.showLoadingState('Loading 2...');

      const loadingOverlays = document.querySelectorAll('.loading-overlay');
      expect(loadingOverlays.length).toBe(1);
      expect(loadingOverlays[0]?.textContent).toContain('Loading 2...');
    });
  });

  describe('Resource Management', () => {
    it('should dispose cleanly', async () => {
      await uiController.initialize();

      uiController.showNotification({
        type: 'info',
        message: 'Test notification',
      });

      uiController.showLoadingState('Loading...');

      expect(document.querySelector('.notification')).toBeTruthy();
      expect(document.querySelector('.loading-overlay')).toBeTruthy();

      uiController.dispose();

      expect(document.querySelector('.notification')).toBeFalsy();
      expect(document.querySelector('.loading-overlay')).toBeFalsy();
    });

    it('should handle disposal when already disposed', () => {
      uiController.dispose();
      uiController.dispose(); // Should not throw
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should handle missing DOM elements gracefully', () => {
      document.getElementById('terminal-tabs-container')?.remove();

      // Should not throw
      uiController.updateTerminalTabs([{ id: 'terminal-1', number: 1, isActive: true }]);
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        enableDebugPanel: 'invalid',
        animationDuration: 'not-a-number',
      } as any;

      const controller = new UIController(invalidConfig);
      expect(controller).toBeInstanceOf(UIController);
      controller.dispose();
    });
  });
});
