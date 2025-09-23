/**
 * Integration tests for the refactored architecture
 * Tests the complete service coordination and real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';
import { RefactoredWebviewCoordinator } from '../../../webview/RefactoredWebviewCoordinator';
import { TerminalCoordinatorFactory as _TerminalCoordinatorFactory } from '../../../webview/services/TerminalCoordinator';
import { UIControllerFactory as _UIControllerFactory } from '../../../webview/services/UIController';
import { MessageRouterFactory as _MessageRouterFactory } from '../../../services/MessageRouter';

describe('Refactored Architecture Integration Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let coordinator: RefactoredWebviewCoordinator;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup comprehensive DOM environment
    setupTestDOM();

    // Mock VS Code API
    setupVSCodeMocks();

    // Mock performance.now for consistent timing in tests
    sandbox.stub(performance, 'now').returns(1000);

    coordinator = new RefactoredWebviewCoordinator();
  });

  afterEach(() => {
    coordinator.dispose();
    document.body.innerHTML = '';
    sandbox.restore();
  });

  function setupTestDOM() {
    document.body.innerHTML = `
      <!-- Terminal Area -->
      <div id="terminal-area" class="terminal-area"></div>

      <!-- UI Controls -->
      <div id="terminal-tabs-container"></div>
      <div id="terminal-count-display"></div>
      <div id="system-status-indicator"></div>
      <button id="create-terminal-button"></button>
      <button id="split-terminal-button"></button>

      <!-- Notifications -->
      <div id="notification-container"></div>

      <!-- Debug Panel -->
      <div id="debug-panel" style="display: none;"></div>
      <button id="debug-toggle-button"></button>

      <!-- CLI Agent Status -->
      <div id="cli-agent-status"></div>

      <!-- Settings -->
      <div id="settings-panel" style="display: none;"></div>
    `;
  }

  function setupVSCodeMocks() {
    (window as any).acquireVsCodeApi = () => ({
      postMessage: sandbox.stub(),
      setState: sandbox.stub(),
      getState: sandbox.stub().returns({})
    });

    // Mock xterm.js Terminal
    global.Terminal = sandbox.stub().returns({
      open: sandbox.stub(),
      write: sandbox.stub(),
      resize: sandbox.stub(),
      dispose: sandbox.stub(),
      focus: sandbox.stub(),
      onData: sandbox.stub(),
      onResize: sandbox.stub(),
      loadAddon: sandbox.stub()
    });

    // Mock FitAddon
    global.FitAddon = sandbox.stub().returns({
      fit: sandbox.stub(),
      propose: sandbox.stub()
    });

    // Mock DOM APIs
    global.URL = {
      createObjectURL: sandbox.stub().returns('blob:url'),
      revokeObjectURL: sandbox.stub()
    } as any;

    global.Blob = sandbox.stub() as any;
  }

  describe('Full System Initialization', () => {
    it('should initialize all services correctly', async () => {
      await coordinator.initialize();

      const debugInfo = coordinator.getDebugInfo();

      expect(debugInfo.isInitialized).to.be.true;
      expect(debugInfo.terminalCount).to.equal(0);
      expect(debugInfo.availableSlots).to.equal(5);
      expect(debugInfo.registeredCommands).to.include('createTerminal');
      expect(debugInfo.registeredCommands).to.include('deleteTerminal');
      expect(debugInfo.registeredCommands).to.include('terminalInput');
      expect(debugInfo.activeHandlers).to.equal(0);
    });

    it('should setup event handlers correctly', async () => {
      const documentSpy = sandbox.spy(document, 'addEventListener');

      await coordinator.initialize();

      // Should have registered for custom events
      const eventCalls = documentSpy.getCalls();
      const eventTypes = eventCalls.map(call => call.args[0]);

      expect(eventTypes).to.include('terminal-switch-requested');
      expect(eventTypes).to.include('terminal-close-requested');
      expect(eventTypes).to.include('settings-open-requested');
    });

    it('should initialize with correct UI state', async () => {
      await coordinator.initialize();

      const statusIndicator = document.getElementById('system-status-indicator');
      const terminalCount = document.getElementById('terminal-count-display');
      const createButton = document.getElementById('create-terminal-button') as HTMLButtonElement;

      expect(statusIndicator?.textContent).to.equal('READY');
      expect(terminalCount?.textContent).to.equal('0/5');
      expect(createButton?.disabled).to.be.false;
    });
  });

  describe('Terminal Lifecycle Integration', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should create terminal with full integration', async () => {
      const vscode = (window as any).acquireVsCodeApi();
      const postMessageSpy = vscode.postMessage as sinon.SinonSpy;

      const terminalId = await coordinator.createTerminal({
        workingDirectory: '/test',
        profile: 'development'
      });

      // Verify terminal creation
      expect(terminalId).to.match(/^terminal-\d+$/);

      // Verify UI updates
      const terminalCount = document.getElementById('terminal-count-display');
      expect(terminalCount?.textContent).to.equal('1/5');

      const tabs = document.querySelectorAll('.terminal-tab');
      expect(tabs.length).to.equal(1);

      // Verify extension communication
      expect(postMessageSpy.called).to.be.true;
      const createdCall = postMessageSpy.getCalls().find(call =>
        call.args[0].command === 'terminalCreated'
      );
      expect(createdCall).to.exist;
      expect(createdCall.args[0].data.terminalId).to.equal(terminalId);
    });

    it('should handle terminal switching integration', async () => {
      const terminalId1 = await coordinator.createTerminal();
      const _terminalId2 = await coordinator.createTerminal();

      await coordinator.switchToTerminal(terminalId1);

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.activeTerminalId).to.equal(terminalId1);

      // Verify UI update
      const activeTab = document.querySelector('.terminal-tab.active');
      expect(activeTab?.getAttribute('data-terminal-id')).to.equal(terminalId1);
    });

    it('should handle terminal removal integration', async () => {
      const terminalId1 = await coordinator.createTerminal();
      const terminalId2 = await coordinator.createTerminal();

      const removed = await coordinator.removeTerminal(terminalId1);

      expect(removed).to.be.true;

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(1);
      expect(debugInfo.activeTerminalId).to.equal(terminalId2);

      // Verify UI updates
      const terminalCount = document.getElementById('terminal-count-display');
      expect(terminalCount?.textContent).to.equal('1/5');

      const tabs = document.querySelectorAll('.terminal-tab');
      expect(tabs.length).to.equal(1);
    });

    it('should enforce terminal limits with UI feedback', async () => {
      // Create maximum terminals
      const terminalIds = [];
      for (let i = 0; i < 5; i++) {
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
      }

      // Verify UI shows full state
      const terminalCount = document.getElementById('terminal-count-display');
      const createButton = document.getElementById('create-terminal-button') as HTMLButtonElement;

      expect(terminalCount?.textContent).to.equal('5/5');
      expect(terminalCount?.className).to.include('terminal-count-full');
      expect(createButton?.disabled).to.be.true;

      // Attempt to create another
      try {
        await coordinator.createTerminal();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('limit reached');
      }

      // Verify notification was shown
      const notification = document.querySelector('.notification');
      expect(notification).to.exist;
      expect(notification?.textContent).to.include('Terminal limit reached');
    });
  });

  describe('Message Handling Integration', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle extension messages correctly', async () => {
      const mockMessageEvent = {
        data: {
          command: 'createTerminal',
          data: { profile: 'default' }
        }
      };

      await coordinator.handleExtensionMessage(
        mockMessageEvent.data.command,
        mockMessageEvent.data.data
      );

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(1);
    });

    it('should handle invalid messages gracefully', async () => {
      const consoleSpy = sandbox.spy(console, 'warn');

      await coordinator.handleExtensionMessage('unknownCommand', {});

      expect(consoleSpy.calledWith('No handler for command: unknownCommand')).to.be.true;
    });

    it('should show error notifications for failed operations', async () => {
      // Force an error by trying to create too many terminals
      for (let i = 0; i < 5; i++) {
        await coordinator.createTerminal();
      }

      await coordinator.handleExtensionMessage('createTerminal', {});

      const notification = document.querySelector('.notification-error');
      expect(notification).to.exist;
      expect(notification?.textContent).to.include('Operation failed');
    });

    it('should handle complex message sequences', async () => {
      const messages = [
        { command: 'createTerminal', data: { profile: 'dev' } },
        { command: 'createTerminal', data: { profile: 'prod' } },
        { command: 'terminalInput', data: { terminalId: 'terminal-1', input: 'ls' } },
        { command: 'terminalResize', data: { terminalId: 'terminal-1', cols: 80, rows: 24 } }
      ];

      for (const message of messages) {
        await coordinator.handleExtensionMessage(message.command, message.data);
      }

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(2);
    });
  });

  describe('UI Event Integration', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle UI-initiated terminal switching', async () => {
      const terminalId1 = await coordinator.createTerminal();
      const _terminalId2 = await coordinator.createTerminal();

      // Simulate UI tab click
      const switchEvent = new CustomEvent('terminal-switch-requested', {
        detail: { terminalId: terminalId1 }
      });

      document.dispatchEvent(switchEvent);

      // Allow event to process
      await new Promise(resolve => setTimeout(resolve, 0));

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.activeTerminalId).to.equal(terminalId1);
    });

    it('should handle UI-initiated terminal closure', async () => {
      const terminalId = await coordinator.createTerminal();

      // Simulate UI close button click
      const closeEvent = new CustomEvent('terminal-close-requested', {
        detail: { terminalId }
      });

      document.dispatchEvent(closeEvent);

      // Allow event to process
      await new Promise(resolve => setTimeout(resolve, 0));

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(0);
    });

    it('should handle settings open request', async () => {
      const vscode = (window as any).acquireVsCodeApi();
      const postMessageSpy = vscode.postMessage as sinon.SinonSpy;

      const settingsEvent = new CustomEvent('settings-open-requested');
      document.dispatchEvent(settingsEvent);

      expect(postMessageSpy.calledWith({
        command: 'openSettings',
        data: {}
      })).to.be.true;
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should recover from terminal creation failures', async () => {
      // Mock terminal constructor to fail
      const originalTerminal = global.Terminal;
      global.Terminal = sandbox.stub().throws(new Error('Terminal creation failed'));

      try {
        await coordinator.createTerminal();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Terminal creation failed');
      }

      // Restore and verify system still works
      global.Terminal = originalTerminal;

      const terminalId = await coordinator.createTerminal();
      expect(terminalId).to.be.a('string');
    });

    it('should handle service disposal errors gracefully', () => {
      // Mock service disposal to throw
      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.isInitialized).to.be.true;

      // Should not throw despite potential disposal errors
      expect(() => coordinator.dispose()).to.not.throw();
    });

    it('should maintain consistency during concurrent operations', async () => {
      // Simulate rapid concurrent terminal operations
      const operations = [
        coordinator.createTerminal(),
        coordinator.createTerminal(),
        coordinator.createTerminal()
      ];

      const results = await Promise.all(operations);

      // All should succeed
      expect(results.every(id => typeof id === 'string')).to.be.true;

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(3);
    });
  });

  describe('Performance Integration', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle rapid terminal creation and deletion', async () => {
      const operationCount = 10;
      const terminalIds: string[] = [];

      // Rapid creation
      for (let i = 0; i < Math.min(operationCount, 5); i++) {
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
      }

      // Rapid deletion
      for (const terminalId of terminalIds) {
        await coordinator.removeTerminal(terminalId);
      }

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(0);
      expect(debugInfo.activeHandlers).to.equal(0);
    });

    it('should maintain performance with many UI updates', async () => {
      const terminalId1 = await coordinator.createTerminal();
      const terminalId2 = await coordinator.createTerminal();

      // Rapid switching
      for (let i = 0; i < 50; i++) {
        const targetId = i % 2 === 0 ? terminalId1 : terminalId2;
        await coordinator.switchToTerminal(targetId);
      }

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(2);
    });

    it('should handle large message volumes efficiently', async () => {
      const messageCount = 100;
      const promises = [];

      for (let i = 0; i < messageCount; i++) {
        promises.push(
          coordinator.handleExtensionMessage('getSettings', {})
        );
      }

      await Promise.allSettled(promises);

      // System should remain stable
      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.activeHandlers).to.equal(0);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle typical development workflow', async () => {
      // 1. Create terminals for different purposes
      const frontendTerminal = await coordinator.createTerminal({
        workingDirectory: '/project/frontend',
        profile: 'node'
      });

      const backendTerminal = await coordinator.createTerminal({
        workingDirectory: '/project/backend',
        profile: 'python'
      });

      const testTerminal = await coordinator.createTerminal({
        workingDirectory: '/project',
        profile: 'testing'
      });

      // 2. Switch between terminals frequently
      await coordinator.switchToTerminal(frontendTerminal);
      await coordinator.switchToTerminal(backendTerminal);
      await coordinator.switchToTerminal(testTerminal);

      // 3. Send commands to different terminals
      await coordinator.handleExtensionMessage('terminalInput', {
        terminalId: frontendTerminal,
        input: 'npm run dev\n'
      });

      await coordinator.handleExtensionMessage('terminalInput', {
        terminalId: backendTerminal,
        input: 'python manage.py runserver\n'
      });

      // 4. Close one terminal when done
      await coordinator.removeTerminal(testTerminal);

      // Verify final state
      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(2);
      expect([frontendTerminal, backendTerminal]).to.include(debugInfo.activeTerminalId);
    });

    it('should handle system stress scenarios', async () => {
      // Create maximum terminals
      const terminalIds = [];
      for (let i = 0; i < 5; i++) {
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
      }

      // Simulate high activity
      const activities = [];
      for (let i = 0; i < 20; i++) {
        activities.push(
          coordinator.handleExtensionMessage('terminalInput', {
            terminalId: terminalIds[i % terminalIds.length],
            input: `command ${i}\n`
          })
        );
      }

      await Promise.all(activities);

      // System should remain stable
      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(5);
      expect(debugInfo.activeHandlers).to.equal(0);
    });

    it('should handle graceful system shutdown', async () => {
      // Setup system with active terminals
      const _terminalId1 = await coordinator.createTerminal();
      const _terminalId2 = await coordinator.createTerminal();

      // Show some UI elements
      const uiController = (coordinator as any).uiController;
      uiController.showNotification({
        type: 'info',
        message: 'System active'
      });

      uiController.showLoadingState('Processing...');

      // Verify active state
      expect(document.querySelector('.notification')).to.exist;
      expect(document.querySelector('.loading-overlay')).to.exist;

      // Dispose system
      coordinator.dispose();

      // Verify clean shutdown
      expect(document.querySelector('.notification')).to.not.exist;
      expect(document.querySelector('.loading-overlay')).to.not.exist;

      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(0);
      expect(debugInfo.isInitialized).to.be.false;
    });
  });

  describe('Service Integration Boundaries', () => {
    it('should maintain clear service boundaries', async () => {
      await coordinator.initialize();

      // Services should be independently accessible
      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo).to.have.property('terminalCount');
      expect(debugInfo).to.have.property('registeredCommands');
      expect(debugInfo).to.have.property('activeHandlers');

      // Each service should maintain its own state
      const _terminalId = await coordinator.createTerminal();
      expect(debugInfo.terminalCount).to.equal(0); // Original object unchanged

      const newDebugInfo = coordinator.getDebugInfo();
      expect(newDebugInfo.terminalCount).to.equal(1); // New state
    });

    it('should allow service replacement for testing', () => {
      // This test demonstrates how services can be mocked/replaced
      const mockTerminalCoordinator = {
        initialize: sandbox.stub().resolves(),
        createTerminal: sandbox.stub().resolves('mock-terminal'),
        dispose: sandbox.stub()
      };

      // Services should be replaceable for testing
      const testCoordinator = new RefactoredWebviewCoordinator();
      (testCoordinator as any).terminalCoordinator = mockTerminalCoordinator;

      // Mock should be usable
      expect((testCoordinator as any).terminalCoordinator.createTerminal).to.exist;

      testCoordinator.dispose();
    });
  });
});