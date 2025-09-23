/**
 * Test suite for refactored architecture
 * Demonstrates the improved maintainability and testability
 */

import { describe, it, expect, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';

// Import the refactored services
import { TerminalCoordinator, TerminalCoordinatorFactory } from '../../../webview/services/TerminalCoordinator';
import { UIController, UIControllerFactory } from '../../../webview/services/UIController';
import { MessageRouter, MessageRouterFactory } from '../../../services/MessageRouter';
import { RefactoredWebviewCoordinator } from '../../../webview/RefactoredWebviewCoordinator';
import {
  CreateTerminalHandler,
  DeleteTerminalHandler,
  TerminalInputHandler
} from '../../../services/handlers/TerminalMessageHandlers';

describe('Refactored Architecture', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('TerminalCoordinator Service', () => {
    let coordinator: TerminalCoordinator;

    beforeEach(() => {
      coordinator = TerminalCoordinatorFactory.createDefault() as TerminalCoordinator;
    });

    afterEach(() => {
      coordinator.dispose();
    });

    it('should create and manage terminals independently', async () => {
      await coordinator.initialize();

      // Create a terminal
      const terminalId = await coordinator.createTerminal();

      expect(coordinator.hasTerminals()).to.be.true;
      expect(coordinator.getTerminalCount()).to.equal(1);
      expect(coordinator.getActiveTerminalId()).to.equal(terminalId);

      // Create another terminal
      const terminalId2 = await coordinator.createTerminal();
      expect(coordinator.getTerminalCount()).to.equal(2);

      // Remove a terminal
      const removed = await coordinator.removeTerminal(terminalId);
      expect(removed).to.be.true;
      expect(coordinator.getTerminalCount()).to.equal(1);
    });

    it('should enforce terminal limits', async () => {
      await coordinator.initialize();

      // Create maximum number of terminals
      const maxTerminals = 5; // From default config
      const terminalIds: string[] = [];

      for (let i = 0; i < maxTerminals; i++) {
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
      }

      expect(coordinator.canCreateTerminal()).to.be.false;
      expect(coordinator.getAvailableSlots()).to.equal(0);

      // Attempting to create another should fail
      try {
        await coordinator.createTerminal();
        expect.fail('Should have thrown error for terminal limit');
      } catch (error) {
        expect(error.message).to.include('maximum');
      }
    });

    it('should handle terminal activation correctly', async () => {
      await coordinator.initialize();

      const terminalId1 = await coordinator.createTerminal();
      const terminalId2 = await coordinator.createTerminal();

      // First terminal should be active initially
      expect(coordinator.getActiveTerminalId()).to.equal(terminalId1);

      // Activate second terminal
      coordinator.activateTerminal(terminalId2);
      expect(coordinator.getActiveTerminalId()).to.equal(terminalId2);

      // Get terminal info to verify activation state
      const info1 = coordinator.getTerminalInfo(terminalId1);
      const info2 = coordinator.getTerminalInfo(terminalId2);

      expect(info1?.isActive).to.be.false;
      expect(info2?.isActive).to.be.true;
    });
  });

  describe('UIController Service', () => {
    let uiController: UIController;

    beforeEach(() => {
      // Setup DOM elements for testing
      document.body.innerHTML = `
        <div id="terminal-tabs-container"></div>
        <div id="terminal-count-display"></div>
        <div id="system-status-indicator"></div>
        <button id="create-terminal-button"></button>
        <div id="notification-container"></div>
      `;

      uiController = UIControllerFactory.createDefault() as UIController;
    });

    afterEach(() => {
      uiController.dispose();
      document.body.innerHTML = '';
    });

    it('should update terminal tabs display', async () => {
      await uiController.initialize();

      const terminalInfos = [
        { id: 'terminal-1', number: 1, isActive: true },
        { id: 'terminal-2', number: 2, isActive: false }
      ];

      uiController.updateTerminalTabs(terminalInfos);

      const tabsContainer = document.getElementById('terminal-tabs-container');
      expect(tabsContainer?.children.length).to.equal(2);

      const activeTab = tabsContainer?.querySelector('.terminal-tab.active');
      expect(activeTab?.getAttribute('data-terminal-id')).to.equal('terminal-1');
    });

    it('should show notifications correctly', async () => {
      await uiController.initialize();

      uiController.showNotification({
        type: 'info',
        message: 'Test notification',
        duration: 1000
      });

      const notificationContainer = document.getElementById('notification-container');
      expect(notificationContainer?.children.length).to.equal(1);

      const notification = notificationContainer?.querySelector('.notification');
      expect(notification?.textContent).to.include('Test notification');
    });

    it('should update system status indicator', async () => {
      await uiController.initialize();

      uiController.updateSystemStatus('BUSY');

      const statusIndicator = document.getElementById('system-status-indicator');
      expect(statusIndicator?.textContent).to.equal('BUSY');
      expect(statusIndicator?.className).to.include('status-busy');
    });

    it('should manage create button state', async () => {
      await uiController.initialize();

      const createButton = document.getElementById('create-terminal-button') as HTMLButtonElement;

      uiController.setCreateButtonEnabled(false);
      expect(createButton.disabled).to.be.true;

      uiController.setCreateButtonEnabled(true);
      expect(createButton.disabled).to.be.false;
    });
  });

  describe('MessageRouter Service', () => {
    let messageRouter: MessageRouter;

    beforeEach(() => {
      messageRouter = MessageRouterFactory.createDefault();
    });

    afterEach(() => {
      messageRouter.dispose();
    });

    it('should register and route messages correctly', async () => {
      const mockHandler = {
        handle: sandbox.stub().resolves({ success: true })
      };

      messageRouter.registerHandler('testCommand', mockHandler);
      expect(messageRouter.hasHandler('testCommand')).to.be.true;

      const result = await messageRouter.routeMessage('testCommand', { data: 'test' });

      expect(result.success).to.be.true;
      expect(mockHandler.handle.calledOnce).to.be.true;
      expect(mockHandler.handle.firstCall.args[0]).to.deep.equal({ data: 'test' });
    });

    it('should handle message routing errors gracefully', async () => {
      const mockHandler = {
        handle: sandbox.stub().rejects(new Error('Handler error'))
      };

      messageRouter.registerHandler('errorCommand', mockHandler);

      const result = await messageRouter.routeMessage('errorCommand', {});

      expect(result.success).to.be.false;
      expect(result.error).to.include('Handler error');
    });

    it('should handle unregistered commands', async () => {
      const result = await messageRouter.routeMessage('unknownCommand', {});

      expect(result.success).to.be.false;
      expect(result.error).to.include('No handler registered');
    });

    it('should enforce concurrent handler limits', async () => {
      const slowHandler = {
        handle: () => new Promise(resolve => setTimeout(resolve, 100))
      };

      messageRouter.registerHandler('slowCommand', slowHandler);

      // Start multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 15; i++) { // More than maxConcurrentHandlers (10)
        promises.push(messageRouter.routeMessage('slowCommand', {}));
      }

      const results = await Promise.all(promises);

      // Some should succeed, some should fail due to concurrency limit
      const failures = results.filter(r => !r.success);
      expect(failures.length).to.be.greaterThan(0);

      const concurrencyFailures = failures.filter(r =>
        r.error?.includes('Maximum concurrent handlers reached')
      );
      expect(concurrencyFailures.length).to.be.greaterThan(0);
    });
  });

  describe('Terminal Message Handlers', () => {
    let mockDependencies: any;

    beforeEach(() => {
      mockDependencies = {
        terminalManager: {
          createTerminal: sandbox.stub().resolves('terminal-123'),
          deleteTerminal: sandbox.stub().resolves(true),
          sendInput: sandbox.stub(),
          resize: sandbox.stub(),
          focusTerminal: sandbox.stub()
        },
        persistenceService: {
          getLastSession: sandbox.stub().resolves({ terminals: [] })
        },
        configService: {
          getCurrentSettings: sandbox.stub().returns({}),
          updateSettings: sandbox.stub().resolves()
        },
        notificationService: {
          showNotification: sandbox.stub()
        }
      };
    });

    it('should handle terminal creation correctly', async () => {
      const handler = new CreateTerminalHandler(mockDependencies);

      const result = await handler.handle({
        profile: 'default',
        workingDirectory: '/home/user'
      });

      expect(result.terminalId).to.equal('terminal-123');
      expect(mockDependencies.terminalManager.createTerminal.calledOnce).to.be.true;
    });

    it('should handle terminal deletion correctly', async () => {
      const handler = new DeleteTerminalHandler(mockDependencies);

      const result = await handler.handle({
        terminalId: 'terminal-123',
        force: true
      });

      expect(result.success).to.be.true;
      expect(mockDependencies.terminalManager.deleteTerminal.calledWith('terminal-123', true)).to.be.true;
    });

    it('should validate required fields', async () => {
      const handler = new TerminalInputHandler(mockDependencies);

      try {
        handler.handle({ terminalId: 'test' } as any); // Missing 'input' field
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).to.include('Required field');
      }
    });
  });

  describe('RefactoredWebviewCoordinator Integration', () => {
    let coordinator: RefactoredWebviewCoordinator;

    beforeEach(() => {
      // Setup DOM for testing
      document.body.innerHTML = `
        <div id="terminal-area"></div>
        <div id="terminal-tabs-container"></div>
        <div id="notification-container"></div>
      `;

      // Mock VS Code API
      (window as any).acquireVsCodeApi = () => ({
        postMessage: sandbox.stub()
      });

      coordinator = new RefactoredWebviewCoordinator();
    });

    afterEach(() => {
      coordinator.dispose();
      document.body.innerHTML = '';
      delete (window as any).acquireVsCodeApi;
    });

    it('should initialize all services correctly', async () => {
      await coordinator.initialize();

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.isInitialized).to.be.true;
      expect(debugInfo.terminalCount).to.equal(0);
      expect(debugInfo.registeredCommands.length).to.be.greaterThan(0);
    });

    it('should create terminals through the service layer', async () => {
      await coordinator.initialize();

      const terminalId = await coordinator.createTerminal();

      expect(terminalId).to.be.a('string');

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(1);
      expect(debugInfo.activeTerminalId).to.equal(terminalId);
    });

    it('should handle terminal switching', async () => {
      await coordinator.initialize();

      const terminalId1 = await coordinator.createTerminal();
      const terminalId2 = await coordinator.createTerminal();

      await coordinator.switchToTerminal(terminalId1);

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.activeTerminalId).to.equal(terminalId1);
    });

    it('should enforce terminal limits in coordinator', async () => {
      await coordinator.initialize();

      // Create maximum terminals
      const terminalIds = [];
      for (let i = 0; i < 5; i++) { // Default max is 5
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
      }

      // Attempting to create another should fail
      try {
        await coordinator.createTerminal();
        expect.fail('Should have thrown error for terminal limit');
      } catch (error) {
        expect(error.message).to.include('limit reached');
      }
    });
  });

  describe('Architecture Benefits Demonstration', () => {
    it('should allow testing services in isolation', () => {
      // Each service can be tested independently without complex setup
      const terminalCoordinator = TerminalCoordinatorFactory.createDefault();
      const uiController = UIControllerFactory.createDefault();
      const messageRouter = MessageRouterFactory.createDefault();

      expect(terminalCoordinator).to.be.instanceOf(TerminalCoordinator);
      expect(uiController).to.be.instanceOf(UIController);
      expect(messageRouter).to.be.instanceOf(MessageRouter);

      // Clean up
      terminalCoordinator.dispose();
      uiController.dispose();
      messageRouter.dispose();
    });

    it('should demonstrate clear separation of concerns', () => {
      // Terminal coordination is separate from UI concerns
      const terminalCoordinator = TerminalCoordinatorFactory.createDefault();

      // UI is separate from business logic
      const uiController = UIControllerFactory.createDefault();

      // Message routing is separate from handling
      const messageRouter = MessageRouterFactory.createDefault();

      // Each service has a single, well-defined responsibility
      expect(typeof terminalCoordinator.createTerminal).to.equal('function');
      expect(typeof uiController.showNotification).to.equal('function');
      expect(typeof messageRouter.routeMessage).to.equal('function');

      // Clean up
      terminalCoordinator.dispose();
      uiController.dispose();
      messageRouter.dispose();
    });

    it('should show improved error handling', async () => {
      const messageRouter = MessageRouterFactory.createDefault();

      // Errors are handled gracefully and don't crash the system
      const result = await messageRouter.routeMessage('nonexistentCommand', {});

      expect(result.success).to.be.false;
      expect(result.error).to.be.a('string');
      expect(result.duration).to.be.a('number');

      messageRouter.dispose();
    });

    it('should demonstrate easier configuration', () => {
      // Services can be configured independently
      const customCoordinator = TerminalCoordinatorFactory.create({
        maxTerminals: 10,
        defaultShell: '/bin/zsh',
        workingDirectory: '/custom/path',
        enablePerformanceOptimization: false,
        bufferSize: 2000,
        debugMode: true
      });

      const customUI = UIControllerFactory.create({
        enableDebugPanel: false,
        enableNotifications: true,
        enableCliAgentStatus: false,
        defaultTheme: { '--background': '#000' },
        animationDuration: 500
      });

      expect(customCoordinator).to.be.instanceOf(TerminalCoordinator);
      expect(customUI).to.be.instanceOf(UIController);

      // Clean up
      customCoordinator.dispose();
      customUI.dispose();
    });
  });
});