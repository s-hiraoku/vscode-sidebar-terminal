/**
 * Integration tests for refactored service architecture
 * Validates that services work together correctly
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { RefactoredWebviewCoordinator } from '../../../webview/RefactoredWebviewCoordinator';

describe('Service Integration Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let coordinator: RefactoredWebviewCoordinator;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup comprehensive DOM environment
    const mockElement = {
      id: '',
      className: '',
      style: { display: '' },
      addEventListener: sandbox.stub(),
      removeEventListener: sandbox.stub(),
      appendChild: sandbox.stub(),
      removeChild: sandbox.stub(),
      querySelector: sandbox.stub(),
      querySelectorAll: sandbox.stub().returns([]),
      innerHTML: '',
      textContent: '',
      setAttribute: sandbox.stub(),
      getAttribute: sandbox.stub(),
      focus: sandbox.stub(),
      blur: sandbox.stub(),
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      offsetHeight: 0,
      getBoundingClientRect: sandbox.stub().returns({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 800
      })
    };

    global.document = {
      createElement: sandbox.stub().returns(mockElement),
      getElementById: sandbox.stub().returns(mockElement),
      querySelector: sandbox.stub().returns(mockElement),
      querySelectorAll: sandbox.stub().returns([mockElement]),
      body: mockElement,
      head: mockElement,
      addEventListener: sandbox.stub(),
      removeEventListener: sandbox.stub(),
      createTextNode: sandbox.stub().returns({ textContent: '' })
    } as unknown as Document;

    (global as any).window = {
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout,
      setInterval: global.setInterval,
      clearInterval: global.clearInterval,
      performance: {
        now: () => Date.now()
      },
      addEventListener: sandbox.stub(),
      removeEventListener: sandbox.stub()
    } as unknown as Window;

    // Mock xterm.js Terminal and FitAddon
    (global as any).Terminal = sandbox.stub().returns({
      open: sandbox.stub(),
      write: sandbox.stub(),
      resize: sandbox.stub(),
      dispose: sandbox.stub(),
      focus: sandbox.stub(),
      onData: sandbox.stub(),
      onResize: sandbox.stub(),
      loadAddon: sandbox.stub(),
      cols: 80,
      rows: 24
    });

    (global as any).FitAddon = sandbox.stub().returns({
      fit: sandbox.stub(),
      propose: sandbox.stub().returns({ cols: 80, rows: 24 })
    });

    // Mock VS Code API
    (global as any).acquireVsCodeApi = () => ({
      postMessage: sandbox.stub(),
      setState: sandbox.stub(),
      getState: sandbox.stub().returns({})
    });

    coordinator = new RefactoredWebviewCoordinator();
  });

  afterEach(() => {
    if (coordinator) {
      coordinator.dispose();
    }
    sandbox.restore();
    delete (global as any).document;
    delete (global as any).window;
    delete (global as any).Terminal;
    delete (global as any).FitAddon;
    delete (global as any).acquireVsCodeApi;
  });

  describe('Coordinator Initialization', () => {
    it('should initialize all services successfully', async () => {
      await coordinator.initialize();

      // Verify coordinator is initialized
      expect(coordinator['isInitialized']).to.be.true;
    });

    it('should throw error if initialized twice', async () => {
      await coordinator.initialize();

      await expect(coordinator.initialize()).to.be.rejectedWith(
        'RefactoredWebviewCoordinator is already initialized'
      );
    });

    it('should dispose all services properly', async () => {
      await coordinator.initialize();

      // Should not throw when disposing
      expect(() => coordinator.dispose()).to.not.throw();
    });
  });

  describe('Service Coordination', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should coordinate terminal creation between services', async () => {
      // Create a terminal
      const terminalId = await coordinator.createTerminal();

      // Verify terminal was created
      expect(terminalId).to.be.a('string');
      expect(terminalId).to.match(/^terminal-\d+$/);
    });

    it('should handle terminal removal coordination', async () => {
      // Create then remove a terminal
      const terminalId = await coordinator.createTerminal();
      const removed = await coordinator.removeTerminal(terminalId);

      expect(removed).to.be.true;
    });

    it('should coordinate terminal switching', async () => {
      // Create multiple terminals
      const terminal1 = await coordinator.createTerminal();
      const terminal2 = await coordinator.createTerminal();

      // Switch between terminals
      await coordinator.switchToTerminal(terminal1);
      await coordinator.switchToTerminal(terminal2);

      // Should not throw errors
      expect(true).to.be.true;
    });

    it('should handle message routing integration', async () => {
      // Test message handling
      const result = await coordinator.handleExtensionMessage('getSettings', {});

      expect(result).to.be.an('object');
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle terminal creation errors gracefully', async () => {
      // Create maximum terminals to trigger error
      const maxTerminals = 5;
      const terminals = [];

      for (let i = 0; i < maxTerminals; i++) {
        const terminalId = await coordinator.createTerminal();
        terminals.push(terminalId);
      }

      // Next creation should fail gracefully
      await expect(coordinator.createTerminal()).to.be.rejected;
    });

    it('should handle unknown message commands', async () => {
      const result = await coordinator.handleExtensionMessage('unknownCommand', {});

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });

    it('should handle terminal removal of non-existent terminal', async () => {
      const result = await coordinator.removeTerminal('non-existent-terminal');

      expect(result).to.be.false;
    });
  });

  describe('Performance Integration', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle rapid terminal operations efficiently', async () => {
      const startTime = performance.now();

      // Create and remove terminals rapidly
      for (let i = 0; i < 5; i++) {
        const terminalId = await coordinator.createTerminal();
        await coordinator.removeTerminal(terminalId);
      }

      const duration = performance.now() - startTime;
      expect(duration).to.be.lessThan(1000); // Should complete in under 1 second
    });

    it('should handle concurrent operations', async () => {
      // Start multiple operations concurrently
      const operations = [
        coordinator.createTerminal(),
        coordinator.createTerminal(),
        coordinator.handleExtensionMessage('getSettings', {}),
        coordinator.handleExtensionMessage('getState', {})
      ];

      const results = await Promise.allSettled(operations);

      // Most operations should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).to.be.greaterThan(2);
    });

    it('should provide debug information', () => {
      const debugInfo = coordinator.getDebugInfo();

      expect(debugInfo).to.be.an('object');
      expect(debugInfo).to.have.property('terminalCount');
      expect(debugInfo).to.have.property('activeHandlers');
      expect(debugInfo).to.have.property('systemStatus');
    });
  });

  describe('Real-world Workflow Simulation', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle typical development workflow', async () => {
      // Simulate a typical VS Code terminal workflow

      // 1. Create initial terminal
      const terminal1 = await coordinator.createTerminal();
      expect(terminal1).to.be.a('string');

      // 2. Switch to it
      await coordinator.switchToTerminal(terminal1);

      // 3. Create another terminal for different task
      const terminal2 = await coordinator.createTerminal();
      expect(terminal2).to.be.a('string');

      // 4. Switch between terminals
      await coordinator.switchToTerminal(terminal1);
      await coordinator.switchToTerminal(terminal2);

      // 5. Handle some extension messages
      await coordinator.handleExtensionMessage('getSettings', {});
      await coordinator.handleExtensionMessage('getState', {});

      // 6. Clean up one terminal
      const removed = await coordinator.removeTerminal(terminal1);
      expect(removed).to.be.true;

      // 7. Continue with remaining terminal
      await coordinator.switchToTerminal(terminal2);

      // Workflow should complete without errors
      expect(true).to.be.true;
    });

    it('should handle system state transitions', async () => {
      // Initial state should be ready
      const initialDebug = coordinator.getDebugInfo();
      expect(initialDebug.terminalCount).to.equal(0);

      // Create terminals and verify state changes
      await coordinator.createTerminal();
      const afterCreate = coordinator.getDebugInfo();
      expect(afterCreate.terminalCount).to.equal(1);

      await coordinator.createTerminal();
      const afterSecond = coordinator.getDebugInfo();
      expect(afterSecond.terminalCount).to.equal(2);
    });
  });
});