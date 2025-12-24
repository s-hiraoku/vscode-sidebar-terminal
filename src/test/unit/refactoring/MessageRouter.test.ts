/**
 * Comprehensive test suite for MessageRouter service
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  MessageRouter,
  MessageRouterFactory,
  BaseMessageHandler,
  MessageRouterConfig,
} from '../../../services/MessageRouter';

describe('MessageRouter Service', () => {
  let sandbox: sinon.SinonSandbox;
  let messageRouter: MessageRouter;
  let mockConfig: MessageRouterConfig;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockConfig = {
      enableLogging: true,
      enableValidation: true,
      timeoutMs: 1000,
      maxConcurrentHandlers: 3,
    };

    messageRouter = new MessageRouter(mockConfig);
  });

  afterEach(() => {
    messageRouter.dispose();
    sandbox.restore();
  });

  describe('Initialization and Configuration', () => {
    it('should create router with default configuration', () => {
      const defaultRouter = MessageRouterFactory.createDefault();

      expect(defaultRouter).to.be.instanceOf(MessageRouter);
      expect(defaultRouter.getRegisteredCommands()).to.deep.equal([]);
      expect(defaultRouter.getActiveHandlerCount()).to.equal(0);

      defaultRouter.dispose();
    });

    it('should create router with custom configuration', () => {
      const customConfig: Partial<MessageRouterConfig> = {
        enableLogging: false,
        timeoutMs: 5000,
        maxConcurrentHandlers: 20,
      };

      const customRouter = MessageRouterFactory.create(customConfig);

      expect(customRouter).to.be.instanceOf(MessageRouter);

      customRouter.dispose();
    });

    it('should use provided configuration correctly', () => {
      expect(messageRouter.getActiveHandlerCount()).to.equal(0);
      expect(messageRouter.hasHandler('nonexistent')).to.be.false;
    });
  });

  describe('Handler Registration', () => {
    it('should register handler successfully', () => {
      const mockHandler = {
        handle: sandbox.stub().resolves('success'),
      };

      messageRouter.registerHandler('testCommand', mockHandler);

      expect(messageRouter.hasHandler('testCommand')).to.be.true;
      expect(messageRouter.getRegisteredCommands()).to.include('testCommand');
    });

    it('should prevent duplicate handler registration', () => {
      const handler1 = { handle: sandbox.stub() };
      const handler2 = { handle: sandbox.stub() };

      messageRouter.registerHandler('testCommand', handler1);

      expect(() => {
        messageRouter.registerHandler('testCommand', handler2);
      }).to.throw('already registered');
    });

    it('should unregister handler successfully', () => {
      const mockHandler = { handle: sandbox.stub() };

      messageRouter.registerHandler('testCommand', mockHandler);
      expect(messageRouter.hasHandler('testCommand')).to.be.true;

      const removed = messageRouter.unregisterHandler('testCommand');

      expect(removed).to.be.true;
      expect(messageRouter.hasHandler('testCommand')).to.be.false;
      expect(messageRouter.getRegisteredCommands()).to.not.include('testCommand');
    });

    it('should handle unregistering non-existent handler', () => {
      const removed = messageRouter.unregisterHandler('nonexistent');

      expect(removed).to.be.false;
    });

    it('should register multiple handlers', () => {
      const handlers = {
        command1: { handle: sandbox.stub() },
        command2: { handle: sandbox.stub() },
        command3: { handle: sandbox.stub() },
      };

      for (const [command, handler] of Object.entries(handlers)) {
        messageRouter.registerHandler(command, handler);
      }

      expect(messageRouter.getRegisteredCommands()).to.have.length(3);
      expect(messageRouter.getRegisteredCommands()).to.include.members([
        'command1',
        'command2',
        'command3',
      ]);
    });

    it('should clear all handlers', () => {
      messageRouter.registerHandler('command1', { handle: sandbox.stub() });
      messageRouter.registerHandler('command2', { handle: sandbox.stub() });

      expect(messageRouter.getRegisteredCommands()).to.have.length(2);

      messageRouter.clearHandlers();

      expect(messageRouter.getRegisteredCommands()).to.have.length(0);
    });
  });

  describe('Message Routing', () => {
    let mockHandler: any;

    beforeEach(() => {
      mockHandler = {
        handle: sandbox.stub().resolves({ result: 'success' }),
      };

      messageRouter.registerHandler('testCommand', mockHandler);
    });

    it('should route message to correct handler', async () => {
      const testData = { input: 'test data' };

      const result = await messageRouter.routeMessage('testCommand', testData);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ result: 'success' });
      expect(result.duration).to.be.a('number');
      expect(mockHandler.handle.calledOnce).to.be.true;
      expect(mockHandler.handle.firstCall.args[0]).to.deep.equal(testData);
    });

    it('should handle synchronous handlers', async () => {
      const syncHandler = {
        handle: sandbox.stub().returns({ sync: 'result' }),
      };

      messageRouter.registerHandler('syncCommand', syncHandler);

      const result = await messageRouter.routeMessage('syncCommand', {});

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ sync: 'result' });
    });

    it('should handle handler errors', async () => {
      const errorHandler = {
        handle: sandbox.stub().rejects(new Error('Handler error')),
      };

      messageRouter.registerHandler('errorCommand', errorHandler);

      const result = await messageRouter.routeMessage('errorCommand', {});

      expect(result.success).to.be.false;
      expect(result.error).to.include('Handler error');
      expect(result.duration).to.be.a('number');
    });

    it('should handle non-Error exceptions', async () => {
      const errorHandler = {
        handle: sandbox.stub().rejects('String error'),
      };

      messageRouter.registerHandler('stringErrorCommand', errorHandler);

      const result = await messageRouter.routeMessage('stringErrorCommand', {});

      expect(result.success).to.be.false;
      expect(result.error).to.equal('String error');
    });

    it('should handle unregistered commands', async () => {
      const result = await messageRouter.routeMessage('unknownCommand', {});

      expect(result.success).to.be.false;
      expect(result.error).to.include('No handler registered');
      expect(result.duration).to.be.a('number');
    });

    it('should handle message without data', async () => {
      const result = await messageRouter.routeMessage('testCommand');

      expect(result.success).to.be.true;
      expect(mockHandler.handle.calledWith(undefined)).to.be.true;
    });

    it('should track execution duration', async () => {
      const slowHandler = {
        handle: () => new Promise((resolve) => setTimeout(() => resolve('done'), 50)),
      };

      messageRouter.registerHandler('slowCommand', slowHandler);

      const result = await messageRouter.routeMessage('slowCommand', {});

      expect(result.success).to.be.true;
      expect(result.duration).to.be.greaterThan(40);
    });
  });

  describe('Message Validation', () => {
    beforeEach(() => {
      const mockHandler = { handle: sandbox.stub().resolves('success') };
      messageRouter.registerHandler('createTerminal', mockHandler);
      messageRouter.registerHandler('terminalInput', mockHandler);
      messageRouter.registerHandler('terminalResize', mockHandler);
      messageRouter.registerHandler('unknownCommand', mockHandler);
    });

    it('should validate terminal input data', async () => {
      const validData = {
        terminalId: 'terminal-1',
        input: 'ls -la',
      };

      const result = await messageRouter.routeMessage('terminalInput', validData);
      expect(result.success).to.be.true;
    });

    it('should reject invalid terminal input data', async () => {
      const invalidData = {
        terminalId: 'terminal-1',
        // Missing 'input' field
      };

      const result = await messageRouter.routeMessage('terminalInput', invalidData);
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid data');
    });

    it('should validate terminal resize data', async () => {
      const validData = {
        terminalId: 'terminal-1',
        cols: 80,
        rows: 24,
      };

      const result = await messageRouter.routeMessage('terminalResize', validData);
      expect(result.success).to.be.true;
    });

    it('should reject invalid resize data', async () => {
      const invalidData = {
        terminalId: 'terminal-1',
        cols: 80,
        // Missing 'rows' field
      };

      const result = await messageRouter.routeMessage('terminalResize', invalidData);
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid data');
    });

    it('should allow unknown commands by default', async () => {
      const result = await messageRouter.routeMessage('unknownCommand', 'any data');
      expect(result.success).to.be.true;
    });

    it('should bypass validation when disabled', async () => {
      const noValidationRouter = new MessageRouter({
        ...mockConfig,
        enableValidation: false,
      });

      const mockHandler = { handle: sandbox.stub().resolves('success') };
      noValidationRouter.registerHandler('terminalInput', mockHandler);

      const invalidData = { terminalId: 'test' }; // Missing 'input'

      const result = await noValidationRouter.routeMessage('terminalInput', invalidData);
      expect(result.success).to.be.true;

      noValidationRouter.dispose();
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running handlers', async () => {
      const timeoutRouter = new MessageRouter({
        ...mockConfig,
        timeoutMs: 100,
      });

      const slowHandler = {
        handle: () => new Promise((resolve) => setTimeout(resolve, 200)),
      };

      timeoutRouter.registerHandler('slowCommand', slowHandler);

      const result = await timeoutRouter.routeMessage('slowCommand', {});

      expect(result.success).to.be.false;
      expect(result.error).to.include('timeout');
      expect(result.duration).to.be.greaterThan(95);

      timeoutRouter.dispose();
    });

    it('should not timeout fast handlers', async () => {
      const timeoutRouter = new MessageRouter({
        ...mockConfig,
        timeoutMs: 100,
      });

      const fastHandler = {
        handle: () => Promise.resolve('fast result'),
      };

      timeoutRouter.registerHandler('fastCommand', fastHandler);

      const result = await timeoutRouter.routeMessage('fastCommand', {});

      expect(result.success).to.be.true;
      expect(result.data).to.equal('fast result');

      timeoutRouter.dispose();
    });

    it('should handle timeout with custom timeout value', async () => {
      const customTimeoutRouter = new MessageRouter({
        ...mockConfig,
        timeoutMs: 50,
      });

      const mediumHandler = {
        handle: () => new Promise((resolve) => setTimeout(resolve, 75)),
      };

      customTimeoutRouter.registerHandler('mediumCommand', mediumHandler);

      const result = await customTimeoutRouter.routeMessage('mediumCommand', {});

      expect(result.success).to.be.false;
      expect(result.error).to.include('timeout after 50ms');

      customTimeoutRouter.dispose();
    });
  });

  describe('Concurrency Management', () => {
    it('should enforce concurrent handler limits', async () => {
      const limitedRouter = new MessageRouter({
        ...mockConfig,
        maxConcurrentHandlers: 2,
      });

      const slowHandler = {
        handle: () => new Promise((resolve) => setTimeout(resolve, 100)),
      };

      limitedRouter.registerHandler('slowCommand', slowHandler);

      // Start 3 concurrent requests (more than limit of 2)
      const promises = [
        limitedRouter.routeMessage('slowCommand', { id: 1 }),
        limitedRouter.routeMessage('slowCommand', { id: 2 }),
        limitedRouter.routeMessage('slowCommand', { id: 3 }),
      ];

      const results = await Promise.all(promises);

      // At least one should fail due to concurrency limit
      const failures = results.filter((r) => !r.success);
      expect(failures.length).to.be.greaterThan(0);

      const concurrencyFailures = failures.filter((r) =>
        r.error?.includes('Maximum concurrent handlers reached')
      );
      expect(concurrencyFailures.length).to.be.greaterThan(0);

      limitedRouter.dispose();
    });

    it('should track active handler count correctly', async () => {
      expect(messageRouter.getActiveHandlerCount()).to.equal(0);

      const slowHandler = {
        handle: () => new Promise((resolve) => setTimeout(resolve, 50)),
      };

      messageRouter.registerHandler('slowCommand', slowHandler);

      const promise = messageRouter.routeMessage('slowCommand', {});

      // Should be active during execution
      expect(messageRouter.getActiveHandlerCount()).to.equal(1);

      await promise;

      // Should be reset after completion
      expect(messageRouter.getActiveHandlerCount()).to.equal(0);
    });

    it('should handle concurrent successes correctly', async () => {
      const fastHandler = {
        handle: (data: any) => Promise.resolve(`result-${data.id}`),
      };

      messageRouter.registerHandler('fastCommand', fastHandler);

      const promises = [
        messageRouter.routeMessage('fastCommand', { id: 1 }),
        messageRouter.routeMessage('fastCommand', { id: 2 }),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).to.exist;
      expect(results[1]).to.exist;
      expect(results[0]?.success).to.be.true;
      expect(results[1]?.success).to.be.true;
      expect(results[0]?.data).to.equal('result-1');
      expect(results[1]?.data).to.equal('result-2');
    });

    it('should reset active count on handler errors', async () => {
      const errorHandler = {
        handle: () => Promise.reject(new Error('Handler error')),
      };

      messageRouter.registerHandler('errorCommand', errorHandler);

      await messageRouter.routeMessage('errorCommand', {});

      expect(messageRouter.getActiveHandlerCount()).to.equal(0);
    });
  });

  describe('Logging', () => {
    it('should log when logging is enabled', async () => {
      // Use existing console.log stub from TestSetup (reset call history)
      const consoleLogStub = console.log as sinon.SinonStub;
      if (consoleLogStub.resetHistory) consoleLogStub.resetHistory();

      const mockHandler = { handle: sandbox.stub().resolves('success') };
      messageRouter.registerHandler('loggedCommand', mockHandler);

      await messageRouter.routeMessage('loggedCommand', {});

      expect(consoleLogStub.called).to.be.true;
    });

    it('should not log when logging is disabled', async () => {
      const silentRouter = new MessageRouter({
        ...mockConfig,
        enableLogging: false,
      });

      // Use existing console.log stub from TestSetup (reset call history)
      const consoleLogStub = console.log as sinon.SinonStub;
      if (consoleLogStub.resetHistory) consoleLogStub.resetHistory();

      const mockHandler = { handle: sandbox.stub().resolves('success') };
      silentRouter.registerHandler('silentCommand', mockHandler);

      await silentRouter.routeMessage('silentCommand', {});

      const routerLogs = (consoleLogStub.getCalls?.() || []).filter(
        (call: sinon.SinonSpyCall) => call.args[0]?.includes?.('[MessageRouter]')
      );
      expect(routerLogs).to.have.length(0);

      silentRouter.dispose();
    });
  });

  describe('BaseMessageHandler', () => {
    class TestHandler extends BaseMessageHandler<any, string> {
      public handle(data: any): string {
        this.validateRequired(data, ['requiredField']);
        this.log('Handler executed');
        return 'test result';
      }
    }

    it('should create base handler correctly', () => {
      const handler = new TestHandler('TestHandler');
      expect(handler).to.be.instanceOf(BaseMessageHandler);
    });

    it('should validate required fields', () => {
      const handler = new TestHandler('TestHandler');

      expect(() => {
        handler.handle({ requiredField: 'value' });
      }).to.not.throw();

      expect(() => {
        handler.handle({});
      }).to.throw('Required field');

      expect(() => {
        handler.handle({ requiredField: null });
      }).to.throw('Required field');
    });

    it('should log messages with handler name', () => {
      // Use existing console.log stub if present
      const consoleLog = console.log as sinon.SinonStub;
      const isAlreadyStubbed = typeof consoleLog?.resetHistory === 'function';
      if (isAlreadyStubbed) {
        consoleLog.resetHistory();
      }

      const handler = new TestHandler('TestHandler');
      handler.handle({ requiredField: 'value' });

      // Verify logging if stub is available
      if (isAlreadyStubbed) {
        const wasCalled = consoleLog.getCalls().some(
          (call: sinon.SinonSpyCall) => call.args[0] === '[TestHandler] Handler executed'
        );
        expect(wasCalled).to.be.true;
      }
    });

    it('should integrate with message router', async () => {
      const handler = new TestHandler('TestHandler');
      messageRouter.registerHandler('testHandler', handler);

      const result = await messageRouter.routeMessage('testHandler', { requiredField: 'test' });

      expect(result.success).to.be.true;
      expect(result.data).to.equal('test result');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from handler disposal errors', () => {
      const mockHandler = {
        handle: sandbox.stub().resolves('success'),
        dispose: sandbox.stub().throws(new Error('Dispose error')),
      };

      messageRouter.registerHandler('disposableCommand', mockHandler);

      // Should not throw despite dispose error
      expect(() => messageRouter.dispose()).to.not.throw();
    });

    it('should handle malformed message data', async () => {
      const mockHandler = {
        handle: sandbox.stub().resolves('success'),
      };

      messageRouter.registerHandler('testCommand', mockHandler);

      // Test with various malformed data
      const malformedData = [null, undefined, Symbol('test'), function () {}];

      for (const data of malformedData) {
        const result = await messageRouter.routeMessage('testCommand', data);
        expect(result).to.exist;
        expect(result).to.have.property('success');
        expect(result).to.have.property('duration');
      }
    });

    it('should handle circular reference data', async () => {
      const mockHandler = {
        handle: sandbox.stub().resolves('success'),
      };

      messageRouter.registerHandler('circularCommand', mockHandler);

      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      const result = await messageRouter.routeMessage('circularCommand', circularData);

      expect(result.success).to.be.true;
      expect(mockHandler.handle.calledOnce).to.be.true;
    });
  });

  describe('Resource Management', () => {
    it('should dispose cleanly', () => {
      const handler1 = { handle: sandbox.stub() };
      const handler2 = { handle: sandbox.stub() };

      messageRouter.registerHandler('command1', handler1);
      messageRouter.registerHandler('command2', handler2);

      expect(messageRouter.getRegisteredCommands()).to.have.length(2);

      messageRouter.dispose();

      expect(messageRouter.getRegisteredCommands()).to.have.length(0);
      expect(messageRouter.getActiveHandlerCount()).to.equal(0);
    });

    it('should handle multiple disposals', () => {
      messageRouter.dispose();
      messageRouter.dispose(); // Should not throw
    });

    it('should prevent operations after disposal', async () => {
      messageRouter.dispose();

      const mockHandler = { handle: sandbox.stub() };

      // Should not throw but operations should be no-ops
      messageRouter.registerHandler('postDisposeCommand', mockHandler);
      expect(messageRouter.getRegisteredCommands()).to.have.length(0);
    });
  });

  describe('Performance', () => {
    it('should handle many rapid messages', async () => {
      const fastHandler = {
        handle: (data: any) => Promise.resolve(data.id),
      };

      messageRouter.registerHandler('rapidCommand', fastHandler);

      const messageCount = 100;
      const promises = [];

      for (let i = 0; i < messageCount; i++) {
        promises.push(messageRouter.routeMessage('rapidCommand', { id: i }));
      }

      const results = await Promise.all(promises);

      expect(results).to.have.length(messageCount);
      expect(results.every((r) => r.success)).to.be.true;
    });

    it('should maintain performance with many handlers', () => {
      const handlerCount = 1000;

      for (let i = 0; i < handlerCount; i++) {
        messageRouter.registerHandler(`command${i}`, {
          handle: () => `result${i}`,
        });
      }

      expect(messageRouter.getRegisteredCommands()).to.have.length(handlerCount);

      // Lookup should still be fast
      const start = performance.now();
      const exists = messageRouter.hasHandler('command500');
      const duration = performance.now() - start;

      expect(exists).to.be.true;
      expect(duration).to.be.lessThan(10); // Should be very fast
    });
  });
});
