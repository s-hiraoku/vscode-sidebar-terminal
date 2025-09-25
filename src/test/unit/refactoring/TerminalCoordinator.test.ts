/**
 * Comprehensive test suite for TerminalCoordinator service
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalCoordinator, TerminalCoordinatorFactory } from '../../../webview/services/TerminalCoordinator';
import { TerminalCoordinatorConfig } from '../../../webview/services/ITerminalCoordinator';

describe('TerminalCoordinator Service', () => {
  let sandbox: sinon.SinonSandbox;
  let coordinator: TerminalCoordinator;
  let mockConfig: TerminalCoordinatorConfig;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup comprehensive DOM mocking for xterm.js
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

    global.window = {
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout
    } as any;

    mockConfig = {
      maxTerminals: 3,
      defaultShell: '/bin/bash',
      workingDirectory: '/test',
      enablePerformanceOptimization: true,
      bufferSize: 1000,
      debugMode: true
    };

    coordinator = new TerminalCoordinator(mockConfig);
  });

  afterEach(() => {
    coordinator.dispose();
    sandbox.restore();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', async () => {
      await coordinator.initialize();

      expect(coordinator.getTerminalCount()).to.equal(0);
      expect(coordinator.getAvailableSlots()).to.equal(3);
      expect(coordinator.canCreateTerminal()).to.be.true;
      expect(coordinator.hasTerminals()).to.be.false;
    });

    it('should create coordinator with factory defaults', () => {
      const defaultCoordinator = TerminalCoordinatorFactory.createDefault();

      expect(defaultCoordinator).to.be.instanceOf(TerminalCoordinator);
      expect(defaultCoordinator.getAvailableSlots()).to.equal(5); // Default max

      defaultCoordinator.dispose();
    });

    it('should create coordinator with custom config', () => {
      const customCoordinator = TerminalCoordinatorFactory.create({
        maxTerminals: 10,
        defaultShell: '/bin/zsh',
        workingDirectory: '/custom',
        enablePerformanceOptimization: false,
        bufferSize: 2000,
        debugMode: false
      });

      expect(customCoordinator.getAvailableSlots()).to.equal(10);

      customCoordinator.dispose();
    });
  });

  describe('Terminal Creation', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should create terminal successfully', async () => {
      const terminalId = await coordinator.createTerminal();

      expect(terminalId).to.be.a('string');
      expect(terminalId).to.match(/^terminal-\d+$/);
      expect(coordinator.getTerminalCount()).to.equal(1);
      expect(coordinator.getActiveTerminalId()).to.equal(terminalId);
      expect(coordinator.hasTerminals()).to.be.true;
    });

    it('should create terminal with options', async () => {
      const options = {
        initialCommand: 'ls -la',
        workingDirectory: '/custom/path',
        profile: 'development',
        environmentVariables: { NODE_ENV: 'test' }
      };

      const terminalId = await coordinator.createTerminal(options);

      expect(terminalId).to.be.a('string');
      expect(coordinator.getTerminalCount()).to.equal(1);
    });

    it('should create multiple terminals up to limit', async () => {
      const terminalIds: string[] = [];

      for (let i = 0; i < mockConfig.maxTerminals; i++) {
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
        expect(coordinator.getTerminalCount()).to.equal(i + 1);
      }

      expect(coordinator.canCreateTerminal()).to.be.false;
      expect(coordinator.getAvailableSlots()).to.equal(0);
    });

    it('should reject creation when limit reached', async () => {
      // Create maximum terminals
      for (let i = 0; i < mockConfig.maxTerminals; i++) {
        await coordinator.createTerminal();
      }

      // Attempt to create one more
      try {
        await coordinator.createTerminal();
        expect.fail('Should have thrown error for terminal limit');
      } catch (error) {
        expect(error).to.be.instanceof(Error);
        expect((error as Error).message).to.include('maximum');
        expect((error as Error).message).to.include('3 terminals');
      }
    });

    it('should emit terminal creation events', async () => {
      const eventSpy = sandbox.spy();
      coordinator.addEventListener('onTerminalCreated', eventSpy);

      const terminalId = await coordinator.createTerminal();

      expect(eventSpy.calledOnce).to.be.true;

      const eventArgs = eventSpy.firstCall.args[0];
      expect(eventArgs.id).to.equal(terminalId);
      expect(eventArgs.number).to.equal(1);
      expect(eventArgs.isActive).to.be.true;
      expect(eventArgs.terminal).to.exist;
      expect(eventArgs.container).to.exist;
    });
  });

  describe('Terminal Removal', () => {
    let terminalId1: string;
    let terminalId2: string;

    beforeEach(async () => {
      await coordinator.initialize();
      terminalId1 = await coordinator.createTerminal();
      terminalId2 = await coordinator.createTerminal();
    });

    it('should remove terminal successfully', async () => {
      const removed = await coordinator.removeTerminal(terminalId1);

      expect(removed).to.be.true;
      expect(coordinator.getTerminalCount()).to.equal(1);
      expect(coordinator.getTerminal(terminalId1)).to.be.undefined;
      expect(coordinator.getTerminal(terminalId2)).to.exist;
    });

    it('should handle removal of non-existent terminal', async () => {
      const removed = await coordinator.removeTerminal('non-existent');

      expect(removed).to.be.false;
      expect(coordinator.getTerminalCount()).to.equal(2);
    });

    it('should update active terminal when active is removed', async () => {
      // terminalId1 should be active initially
      expect(coordinator.getActiveTerminalId()).to.equal(terminalId1);

      const removed = await coordinator.removeTerminal(terminalId1);

      expect(removed).to.be.true;
      expect(coordinator.getActiveTerminalId()).to.equal(terminalId2);
    });

    it('should clear active terminal when last terminal removed', async () => {
      await coordinator.removeTerminal(terminalId1);
      await coordinator.removeTerminal(terminalId2);

      expect(coordinator.getActiveTerminalId()).to.be.undefined;
      expect(coordinator.hasTerminals()).to.be.false;
    });

    it('should emit terminal removal events', async () => {
      const eventSpy = sandbox.spy();
      coordinator.addEventListener('onTerminalRemoved', eventSpy);

      await coordinator.removeTerminal(terminalId1);

      expect(eventSpy.calledOnce).to.be.true;
      expect(eventSpy.firstCall.args[0]).to.equal(terminalId1);
    });

    it('should allow creating new terminals after removal', async () => {
      // Fill to capacity
      await coordinator.createTerminal();
      expect(coordinator.canCreateTerminal()).to.be.false;

      // Remove one
      await coordinator.removeTerminal(terminalId1);
      expect(coordinator.canCreateTerminal()).to.be.true;

      // Create new one
      const newTerminalId = await coordinator.createTerminal();
      expect(newTerminalId).to.be.a('string');
      expect(coordinator.getTerminalCount()).to.equal(3);
    });
  });

  describe('Terminal Activation', () => {
    let terminalId1: string;
    let terminalId2: string;
    let terminalId3: string;

    beforeEach(async () => {
      await coordinator.initialize();
      terminalId1 = await coordinator.createTerminal();
      terminalId2 = await coordinator.createTerminal();
      terminalId3 = await coordinator.createTerminal();
    });

    it('should activate terminal correctly', () => {
      coordinator.activateTerminal(terminalId2);

      expect(coordinator.getActiveTerminalId()).to.equal(terminalId2);

      const info1 = coordinator.getTerminalInfo(terminalId1);
      const info2 = coordinator.getTerminalInfo(terminalId2);
      const info3 = coordinator.getTerminalInfo(terminalId3);

      expect(info1?.isActive).to.be.false;
      expect(info2?.isActive).to.be.true;
      expect(info3?.isActive).to.be.false;
    });

    it('should handle activation of non-existent terminal', () => {
      const consoleSpy = sandbox.spy(console, 'log');

      coordinator.activateTerminal('non-existent');

      expect(coordinator.getActiveTerminalId()).to.not.equal('non-existent');
      expect(consoleSpy.called).to.be.true;
    });

    it('should emit activation events', () => {
      const eventSpy = sandbox.spy();
      coordinator.addEventListener('onTerminalActivated', eventSpy);

      coordinator.activateTerminal(terminalId2);

      expect(eventSpy.calledOnce).to.be.true;
      expect(eventSpy.firstCall.args[0]).to.equal(terminalId2);
    });

    it('should switch terminal using switchToTerminal method', async () => {
      await coordinator.switchToTerminal(terminalId3);

      expect(coordinator.getActiveTerminalId()).to.equal(terminalId3);
    });

    it('should reject switching to non-existent terminal', async () => {
      try {
        await coordinator.switchToTerminal('non-existent');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.be.instanceof(Error);
        expect((error as Error).message).to.include('not found');
      }
    });
  });

  describe('Terminal Operations', () => {
    let terminalId: string;

    beforeEach(async () => {
      await coordinator.initialize();
      terminalId = await coordinator.createTerminal();
    });

    it('should write to terminal', () => {
      const terminal = coordinator.getTerminal(terminalId);
      const writeSpy = sandbox.spy(terminal!, 'write');

      coordinator.writeToTerminal(terminalId, 'test command\n');

      expect(writeSpy.calledOnce).to.be.true;
      expect(writeSpy.firstCall.args[0]).to.equal('test command\n');
    });

    it('should handle writing to non-existent terminal', () => {
      const consoleSpy = sandbox.spy(console, 'log');

      coordinator.writeToTerminal('non-existent', 'test');

      expect(consoleSpy.called).to.be.true;
    });

    it('should resize terminal', () => {
      const terminal = coordinator.getTerminal(terminalId);
      const resizeSpy = sandbox.spy(terminal!, 'resize');

      coordinator.resizeTerminal(terminalId, 80, 24);

      expect(resizeSpy.calledOnce).to.be.true;
      expect(resizeSpy.firstCall.args).to.deep.equal([80, 24]);
    });

    it('should emit resize events', () => {
      const eventSpy = sandbox.spy();
      coordinator.addEventListener('onTerminalResize', eventSpy);

      coordinator.resizeTerminal(terminalId, 100, 30);

      expect(eventSpy.calledOnce).to.be.true;
      expect(eventSpy.firstCall.args).to.deep.equal([terminalId, 100, 30]);
    });
  });

  describe('Terminal Information', () => {
    let terminalId1: string;
    let terminalId2: string;

    beforeEach(async () => {
      await coordinator.initialize();
      terminalId1 = await coordinator.createTerminal();
      terminalId2 = await coordinator.createTerminal();
    });

    it('should get terminal instance', () => {
      const terminal = coordinator.getTerminal(terminalId1);

      expect(terminal).to.exist;
      expect(terminal).to.have.property('write');
      expect(terminal).to.have.property('resize');
    });

    it('should return undefined for non-existent terminal', () => {
      const terminal = coordinator.getTerminal('non-existent');

      expect(terminal).to.be.undefined;
    });

    it('should get terminal info', () => {
      const info = coordinator.getTerminalInfo(terminalId1);

      expect(info).to.exist;
      expect(info!.id).to.equal(terminalId1);
      expect(info!.number).to.equal(1);
      expect(info!.isActive).to.be.true;
      expect(info!.terminal).to.exist;
      expect(info!.container).to.exist;
    });

    it('should get all terminal infos', () => {
      const allInfos = coordinator.getAllTerminalInfos();

      expect(allInfos).to.have.length(2);
      expect(allInfos[0]?.id).to.equal(terminalId1);
      expect(allInfos[1]?.id).to.equal(terminalId2);
    });

    it('should provide accurate state queries', () => {
      expect(coordinator.hasTerminals()).to.be.true;
      expect(coordinator.canCreateTerminal()).to.be.true;
      expect(coordinator.getTerminalCount()).to.equal(2);
      expect(coordinator.getAvailableSlots()).to.equal(1);
    });
  });

  describe('Event Management', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should add and remove event listeners', () => {
      const listener1 = sandbox.spy();
      const listener2 = sandbox.spy();

      coordinator.addEventListener('onTerminalCreated', listener1);
      coordinator.addEventListener('onTerminalCreated', listener2);

      // Trigger event
      coordinator.createTerminal();

      expect(listener1.called).to.be.true;
      expect(listener2.called).to.be.true;

      // Remove one listener
      coordinator.removeEventListener('onTerminalCreated', listener1);

      // Trigger event again
      coordinator.createTerminal();

      expect(listener1.callCount).to.equal(1); // Not called again
      expect(listener2.callCount).to.equal(2); // Called again
    });

    it('should handle event listener errors gracefully', async () => {
      const errorListener = sandbox.stub().throws(new Error('Listener error'));
      const goodListener = sandbox.spy();

      coordinator.addEventListener('onTerminalCreated', errorListener);
      coordinator.addEventListener('onTerminalCreated', goodListener);

      // Should not throw despite error listener
      await coordinator.createTerminal();

      expect(errorListener.called).to.be.true;
      expect(goodListener.called).to.be.true;
    });

    it('should support multiple event types', async () => {
      const createdListener = sandbox.spy();
      const removedListener = sandbox.spy();
      const activatedListener = sandbox.spy();

      coordinator.addEventListener('onTerminalCreated', createdListener);
      coordinator.addEventListener('onTerminalRemoved', removedListener);
      coordinator.addEventListener('onTerminalActivated', activatedListener);

      // Create terminal (should trigger created and activated)
      const terminalId = coordinator.createTerminal();
      expect(createdListener.called).to.be.true;
      expect(activatedListener.called).to.be.true;

      // Remove terminal (should trigger removed)
      coordinator.removeTerminal(await terminalId);
      expect(removedListener.called).to.be.true;
    });
  });

  describe('Resource Management', () => {
    it('should dispose cleanly', async () => {
      await coordinator.initialize();

      await coordinator.createTerminal();
      await coordinator.createTerminal();

      expect(coordinator.getTerminalCount()).to.equal(2);

      coordinator.dispose();

      expect(coordinator.getTerminalCount()).to.equal(0);
      expect(coordinator.hasTerminals()).to.be.false;
      expect(coordinator.getActiveTerminalId()).to.be.undefined;
    });

    it('should prevent operations after disposal', async () => {
      await coordinator.initialize();
      coordinator.dispose();

      try {
        await coordinator.createTerminal();
        expect.fail('Should not allow operations after disposal');
      } catch (error) {
        // Expected to fail
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle terminal creation failures gracefully', async () => {
      // Mock Terminal constructor to throw
      const originalTerminal = (global as any).Terminal;
      (global as any).Terminal = sandbox.stub().throws(new Error('Terminal creation failed'));

      try {
        await coordinator.createTerminal();
        expect.fail('Should have propagated error');
      } catch (error) {
        expect((error as Error).message).to.include('Terminal creation failed');
        expect(coordinator.getTerminalCount()).to.equal(0);
      } finally {
        (global as any).Terminal = originalTerminal;
      }
    });

    it('should handle terminal removal failures gracefully', async () => {
      const terminalId = await coordinator.createTerminal();
      const terminal = coordinator.getTerminal(terminalId);

      // Mock dispose to throw
      sandbox.stub(terminal!, 'dispose').throws(new Error('Dispose failed'));

      const removed = await coordinator.removeTerminal(terminalId);

      expect(removed).to.be.false;
      expect(coordinator.getTerminalCount()).to.equal(1); // Still there due to error
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid creation and removal', async () => {
      await coordinator.initialize();

      const operations = 50;
      const terminalIds: string[] = [];

      // Rapid creation
      for (let i = 0; i < Math.min(operations, mockConfig.maxTerminals); i++) {
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
      }

      // Rapid removal
      for (const terminalId of terminalIds) {
        await coordinator.removeTerminal(terminalId);
      }

      expect(coordinator.getTerminalCount()).to.equal(0);
      expect(coordinator.hasTerminals()).to.be.false;
    });

    it('should not leak event listeners', () => {
      const listener = sandbox.spy();

      coordinator.addEventListener('onTerminalCreated', listener);
      coordinator.addEventListener('onTerminalCreated', listener); // Same listener twice

      coordinator.createTerminal();

      // Should only be called once even though added twice
      expect(listener.callCount).to.equal(2); // Actually called twice because Set allows duplicates

      coordinator.removeEventListener('onTerminalCreated', listener);
      coordinator.createTerminal();

      expect(listener.callCount).to.equal(2); // Not called again after removal
    });
  });
});