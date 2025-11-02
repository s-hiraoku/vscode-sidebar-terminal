/**
 * Comprehensive test suite for UIController service
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { UIController, UIControllerFactory } from '../../../webview/services/UIController';
import { UIControllerConfig } from '../../../webview/services/IUIController';

describe('UIController Service', () => {
  let sandbox: sinon.SinonSandbox;
  let uiController: UIController;
  let mockConfig: UIControllerConfig;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

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
    sandbox.restore();
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
        'notification-container'
      ];

      for (const elementId of requiredElements) {
        const element = document.getElementById(elementId);
        expect(element).to.exist;
      }
    });

    it('should create missing elements during initialization', async () => {
      // Remove some elements
      document.getElementById('terminal-tabs-container')?.remove();
      document.getElementById('notification-container')?.remove();

      await uiController.initialize();

      // Should recreate them
      expect(document.getElementById('terminal-tabs-container')).to.exist;
      expect(document.getElementById('notification-container')).to.exist;
    });

    it('should setup debug panel when enabled', async () => {
      await uiController.initialize();

      const debugPanel = document.getElementById('debug-panel');
      const debugToggle = document.getElementById('debug-toggle-button');

      expect(debugPanel).to.exist;
      expect(debugToggle).to.exist;
    });

    it('should setup CLI agent status when enabled', async () => {
      await uiController.initialize();

      const cliAgentStatus = document.getElementById('cli-agent-status');
      expect(cliAgentStatus).to.exist;
    });

    it('should use factory defaults correctly', () => {
      const defaultController = UIControllerFactory.createDefault();
      expect(defaultController).to.be.instanceOf(UIController);
      defaultController.dispose();
    });

    it('should use custom configuration', () => {
      const customConfig: UIControllerConfig = {
        enableDebugPanel: false,
        enableNotifications: false,
        enableCliAgentStatus: false,
        defaultTheme: { '--background': '#000' },
        animationDuration: 500
      };

      const customController = UIControllerFactory.create(customConfig);
      expect(customController).to.be.instanceOf(UIController);
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
        { id: 'terminal-3', number: 3, isActive: false }
      ];

      uiController.updateTerminalTabs(terminalInfos);

      const tabsContainer = document.getElementById('terminal-tabs-container');
      expect(tabsContainer?.children.length).to.equal(3);

      const tabs = tabsContainer?.querySelectorAll('.terminal-tab');
      expect(tabs).to.exist;
      if (tabs) {
        expect(tabs[0]?.getAttribute('data-terminal-id')).to.equal('terminal-1');
        expect(tabs[1]?.getAttribute('data-terminal-id')).to.equal('terminal-2');
        expect(tabs[2]?.getAttribute('data-terminal-id')).to.equal('terminal-3');
      }
    });

    it('should show active terminal correctly', () => {
      const terminalInfos = [
        { id: 'terminal-1', number: 1, isActive: false },
        { id: 'terminal-2', number: 2, isActive: true }
      ];

      uiController.updateTerminalTabs(terminalInfos);

      const activeTab = document.querySelector('.terminal-tab.active');
      expect(activeTab?.getAttribute('data-terminal-id')).to.equal('terminal-2');
    });

    it('should handle empty terminal list', () => {
      uiController.updateTerminalTabs([]);

      const tabsContainer = document.getElementById('terminal-tabs-container');
      expect(tabsContainer?.children.length).to.equal(0);
    });

    it('should emit events when tabs are clicked', () => {
      const eventSpy = sandbox.spy(document, 'dispatchEvent');

      const terminalInfos = [
        { id: 'terminal-1', number: 1, isActive: true }
      ];

      uiController.updateTerminalTabs(terminalInfos);

      const tab = document.querySelector('.terminal-tab') as HTMLElement;
      tab.click();

      expect(eventSpy.called).to.be.true;
    });

    it('should emit close events when close button clicked', () => {
      const eventSpy = sandbox.spy(document, 'dispatchEvent');

      const terminalInfos = [
        { id: 'terminal-1', number: 1, isActive: true }
      ];

      uiController.updateTerminalTabs(terminalInfos);

      const closeButton = document.querySelector('.tab-close') as HTMLElement;
      closeButton.click();

      expect(eventSpy.called).to.be.true;
    });

    it('should update active terminal indicator', () => {
      const terminalInfos = [
        { id: 'terminal-1', number: 1, isActive: false },
        { id: 'terminal-2', number: 2, isActive: false }
      ];

      uiController.updateTerminalTabs(terminalInfos);
      uiController.updateActiveTerminalIndicator('terminal-2');

      const activeTab = document.querySelector('.terminal-tab.active');
      expect(activeTab?.getAttribute('data-terminal-id')).to.equal('terminal-2');
    });
  });

  describe('System Status Management', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should update system status indicator', () => {
      uiController.updateSystemStatus('BUSY');

      const indicator = document.getElementById('system-status-indicator');
      expect(indicator?.textContent).to.equal('BUSY');
      expect(indicator?.className).to.include('status-busy');
    });

    it('should handle different status types', () => {
      const statuses = ['READY', 'BUSY', 'ERROR'] as const;

      for (const status of statuses) {
        uiController.updateSystemStatus(status);

        const indicator = document.getElementById('system-status-indicator');
        expect(indicator?.textContent).to.equal(status);
        expect(indicator?.className).to.include(`status-${status.toLowerCase()}`);
      }
    });

    it('should update terminal count display', () => {
      uiController.updateTerminalCountDisplay(3, 5);

      const display = document.getElementById('terminal-count-display');
      expect(display?.textContent).to.equal('3/5');
      expect(display?.className).to.include('terminal-count-normal');
    });

    it('should show full state when at capacity', () => {
      uiController.updateTerminalCountDisplay(5, 5);

      const display = document.getElementById('terminal-count-display');
      expect(display?.textContent).to.equal('5/5');
      expect(display?.className).to.include('terminal-count-full');
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

      expect(mockContainer.style.display).to.equal('block');

      const terminalArea = document.getElementById('terminal-area');
      expect(terminalArea?.contains(mockContainer)).to.be.true;
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

      expect(container1.style.display).to.equal('none');
      expect(container2.style.display).to.equal('none');
      expect(mockContainer.style.display).to.equal('block');
    });

    it('should hide terminal container', () => {
      mockContainer.style.display = 'block';
      document.body.appendChild(mockContainer);

      uiController.hideTerminalContainer('test');

      const container = document.getElementById('terminal-container-test');
      expect(container?.style.display).to.equal('none');
    });

    it('should highlight active terminal', () => {
      mockContainer.id = 'terminal-container-active-test';
      document.body.appendChild(mockContainer);

      uiController.highlightActiveTerminal('active-test');

      expect(mockContainer.classList.contains('active-terminal')).to.be.true;
    });
  });

  describe('Control Elements', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should enable/disable create button', () => {
      const button = document.getElementById('create-terminal-button') as HTMLButtonElement;

      uiController.setCreateButtonEnabled(false);
      expect(button.disabled).to.be.true;
      expect(button.className).to.include('button-disabled');

      uiController.setCreateButtonEnabled(true);
      expect(button.disabled).to.be.false;
      expect(button.className).to.include('button-enabled');
    });

    it('should show/hide split button', () => {
      const button = document.getElementById('split-terminal-button');

      uiController.updateSplitButtonVisibility(false);
      expect(button?.style.display).to.equal('none');

      uiController.updateSplitButtonVisibility(true);
      expect(button?.style.display).to.equal('block');
    });

    it('should show terminal limit message', () => {
      uiController.showTerminalLimitMessage(5, 5);

      const notification = document.querySelector('.notification');
      expect(notification).to.exist;
      expect(notification?.textContent).to.include('Terminal limit reached');
      expect(notification?.textContent).to.include('5/5');
    });

    it('should clear terminal limit message', () => {
      uiController.showTerminalLimitMessage(5, 5);
      expect(document.querySelector('.notification')).to.exist;

      uiController.clearTerminalLimitMessage();
      expect(document.querySelector('.notification')).to.not.exist;
    });
  });

  describe('Debug Panel', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should toggle debug panel visibility', () => {
      const debugPanel = document.getElementById('debug-panel');

      uiController.toggleDebugPanel();
      expect(debugPanel?.style.display).to.equal('block');

      uiController.toggleDebugPanel();
      expect(debugPanel?.style.display).to.equal('none');
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
          bufferSize: 1024
        },
        pendingOperations: ['create-terminal', 'delete-terminal']
      };

      uiController.updateDebugInfo(debugInfo);

      const debugPanel = document.getElementById('debug-panel');
      expect(debugPanel?.innerHTML).to.include('READY');
      expect(debugPanel?.innerHTML).to.include('terminal-1');
      expect(debugPanel?.innerHTML).to.include('3');
      expect(debugPanel?.innerHTML).to.include('2');
      expect(debugPanel?.innerHTML).to.include('5 minutes');
      expect(debugPanel?.innerHTML).to.include('create-terminal');
      expect(debugPanel?.innerHTML).to.include('delete-terminal');
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
          bufferSize: 512
        },
        pendingOperations: []
      };

      uiController.updateDebugInfo(debugInfo);

      const debugPanel = document.getElementById('debug-panel');
      expect(debugPanel?.innerHTML).to.include('None');
      expect(debugPanel?.innerHTML).to.include('0');
    });

    it('should export system diagnostics', () => {
      const createElementSpy = sandbox.spy(document, 'createElement');
      const clickSpy = sandbox.spy();

      // Mock the created anchor element
      (createElementSpy.withArgs('a') as any).returns({
        href: '',
        download: '',
        click: clickSpy
      } as any);

      global.URL = {
        createObjectURL: sandbox.stub().returns('blob:url'),
        revokeObjectURL: sandbox.stub()
      } as any;

      global.Blob = sandbox.stub().returns({}) as any;

      uiController.exportSystemDiagnostics();

      expect(clickSpy.called).to.be.true;
    });

    it('should not show debug panel when disabled', async () => {
      const disabledController = new UIController({
        ...mockConfig,
        enableDebugPanel: false
      });

      await disabledController.initialize();

      disabledController.toggleDebugPanel();

      const debugPanel = document.getElementById('debug-panel');
      expect(debugPanel?.style.display).to.not.equal('block');

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
        duration: 5000
      });

      const notification = document.querySelector('.notification');
      expect(notification).to.exist;
      expect(notification?.className).to.include('notification-info');
      expect(notification?.textContent).to.include('Test notification');
    });

    it('should show different notification types', () => {
      const types = ['info', 'warning', 'error', 'success'] as const;

      for (const type of types) {
        uiController.showNotification({
          type,
          message: `${type} message`,
          duration: 1000
        });

        const notification = document.querySelector(`.notification-${type}`);
        expect(notification).to.exist;
        expect(notification?.textContent).to.include(`${type} message`);
      }
    });

    it('should auto-remove notification after duration', (done) => {
      uiController.showNotification({
        type: 'info',
        message: 'Auto-remove test',
        duration: 50
      });

      expect(document.querySelector('.notification')).to.exist;

      setTimeout(() => {
        expect(document.querySelector('.notification')).to.not.exist;
        done();
      }, 100);
    });

    it('should show notification with action buttons', () => {
      const actionSpy = sandbox.spy();

      uiController.showNotification({
        type: 'info',
        message: 'Test with actions',
        actions: [
          { label: 'Action 1', action: actionSpy },
          { label: 'Action 2', action: () => {} }
        ]
      });

      const actions = document.querySelectorAll('.notification-action');
      expect(actions.length).to.equal(2);
      expect(actions[0]?.textContent).to.equal('Action 1');

      (actions[0] as HTMLElement).click();
      expect(actionSpy.called).to.be.true;
    });

    it('should close notification when close button clicked', () => {
      uiController.showNotification({
        type: 'info',
        message: 'Closeable notification'
      });

      const closeButton = document.querySelector('.notification-close') as HTMLElement;
      expect(closeButton).to.exist;

      closeButton.click();
      expect(document.querySelector('.notification')).to.not.exist;
    });

    it('should clear all notifications', () => {
      uiController.showNotification({
        type: 'info',
        message: 'Notification 1'
      });

      uiController.showNotification({
        type: 'warning',
        message: 'Notification 2'
      });

      expect(document.querySelectorAll('.notification').length).to.equal(2);

      uiController.clearNotifications();
      expect(document.querySelectorAll('.notification').length).to.equal(0);
    });

    it('should not show notifications when disabled', () => {
      const disabledController = new UIController({
        ...mockConfig,
        enableNotifications: false
      });

      disabledController.showNotification({
        type: 'info',
        message: 'Should not show'
      });

      expect(document.querySelector('.notification')).to.not.exist;

      disabledController.dispose();
    });
  });

  describe('Settings and Theme', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should open settings', () => {
      const eventSpy = sandbox.spy(document, 'dispatchEvent');

      uiController.openSettings();

      expect(eventSpy.called).to.be.true;
      const event = eventSpy.firstCall.args[0] as CustomEvent;
      expect(event.type).to.equal('settings-open-requested');
    });

    it('should update theme', () => {
      const theme = {
        '--terminal-background': '#000000',
        '--terminal-foreground': '#ffffff',
        '--custom-property': '#ff0000'
      };

      uiController.updateTheme(theme);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--terminal-background')).to.equal('#000000');
      expect(root.style.getPropertyValue('--terminal-foreground')).to.equal('#ffffff');
      expect(root.style.getPropertyValue('--custom-property')).to.equal('#ff0000');
    });

    it('should update font settings', () => {
      uiController.updateFontSettings('Monaco', 16);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--terminal-font-family')).to.equal('Monaco');
      expect(root.style.getPropertyValue('--terminal-font-size')).to.equal('16px');
    });
  });

  describe('CLI Agent Status', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should update CLI agent status', () => {
      uiController.updateCliAgentStatus(true, 'Claude Code');

      const status = document.getElementById('cli-agent-status');
      expect(status?.textContent).to.equal('Claude Code Connected');
      expect(status?.className).to.include('connected');
    });

    it('should show disconnected status', () => {
      uiController.updateCliAgentStatus(false);

      const status = document.getElementById('cli-agent-status');
      expect(status?.textContent).to.equal('CLI Agent Disconnected');
      expect(status?.className).to.include('disconnected');
    });

    it('should show/hide CLI agent indicator', () => {
      const indicator = document.getElementById('cli-agent-status');

      uiController.showCliAgentIndicator(false);
      expect(indicator?.style.display).to.equal('none');

      uiController.showCliAgentIndicator(true);
      expect(indicator?.style.display).to.equal('block');
    });
  });

  describe('Layout Management', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should update split layout', () => {
      const terminalArea = document.getElementById('terminal-area');

      uiController.updateSplitLayout('horizontal');
      expect(terminalArea?.className).to.include('layout-horizontal');

      uiController.updateSplitLayout('vertical');
      expect(terminalArea?.className).to.include('layout-vertical');

      uiController.updateSplitLayout('grid');
      expect(terminalArea?.className).to.include('layout-grid');
    });

    it('should resize terminal containers', () => {
      const container1 = document.createElement('div') as any;
      container1.className = 'terminal-container';
      container1._terminal = { resize: sandbox.spy() };

      const container2 = document.createElement('div') as any;
      container2.className = 'terminal-container';
      container2._terminal = { resize: sandbox.spy() };

      document.body.appendChild(container1);
      document.body.appendChild(container2);

      uiController.resizeTerminalContainers(80, 24);

      expect(container1._terminal.resize.calledWith(80, 24)).to.be.true;
      expect(container2._terminal.resize.calledWith(80, 24)).to.be.true;
    });
  });

  describe('Loading States', () => {
    beforeEach(async () => {
      await uiController.initialize();
    });

    it('should show loading state', () => {
      uiController.showLoadingState('Loading terminals...');

      const loadingOverlay = document.querySelector('.loading-overlay');
      expect(loadingOverlay).to.exist;
      expect(loadingOverlay?.textContent).to.include('Loading terminals...');
    });

    it('should hide loading state', () => {
      uiController.showLoadingState('Loading...');
      expect(document.querySelector('.loading-overlay')).to.exist;

      uiController.hideLoadingState();
      expect(document.querySelector('.loading-overlay')).to.not.exist;
    });

    it('should replace existing loading state', () => {
      uiController.showLoadingState('Loading 1...');
      uiController.showLoadingState('Loading 2...');

      const loadingOverlays = document.querySelectorAll('.loading-overlay');
      expect(loadingOverlays.length).to.equal(1);
      expect(loadingOverlays[0]?.textContent).to.include('Loading 2...');
    });
  });

  describe('Resource Management', () => {
    it('should dispose cleanly', async () => {
      await uiController.initialize();

      uiController.showNotification({
        type: 'info',
        message: 'Test notification'
      });

      uiController.showLoadingState('Loading...');

      expect(document.querySelector('.notification')).to.exist;
      expect(document.querySelector('.loading-overlay')).to.exist;

      uiController.dispose();

      expect(document.querySelector('.notification')).to.not.exist;
      expect(document.querySelector('.loading-overlay')).to.not.exist;
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
      uiController.updateTerminalTabs([
        { id: 'terminal-1', number: 1, isActive: true }
      ]);
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        enableDebugPanel: 'invalid',
        animationDuration: 'not-a-number'
      } as any;

      const controller = new UIController(invalidConfig);
      expect(controller).to.be.instanceOf(UIController);
      controller.dispose();
    });
  });
});