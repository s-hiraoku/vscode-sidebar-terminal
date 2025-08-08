/**
 * MessageHandlerFactory Tests - Enhanced test suite for centralized message handling
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { MessageHandlerFactory } from '../../../../webview/factories/MessageHandlerFactory';
import { 
  createMockCoordinator, 
  setupManagerTest, 
  cleanupManagerTest, 
  TestPatterns,
  DOMTestUtils,
  AsyncTestUtils,
  PerformanceTestUtils
} from '../../../../webview/utils/CommonTestHelpers';

describe('MessageHandlerFactory', () => {
  let coordinator: ReturnType<typeof createMockCoordinator>;

  beforeEach(() => {
    // Clear all handlers before each test
    MessageHandlerFactory.clearHandlers();
    coordinator = createMockCoordinator();
  });

  afterEach(() => {
    MessageHandlerFactory.clearHandlers();
  });

  describe('Handler Registration', () => {
    it('should register handlers with proper configuration', () => {
      const handler = sinon.stub().returns('test-result');
      
      MessageHandlerFactory.registerHandler(
        {
          command: 'testCommand',
          validator: (message) => ({ isValid: true }),
          requiresCoordinator: true,
          async: false
        },
        handler
      );
      
      const summary = MessageHandlerFactory.getHandlersSummary();
      expect(summary).to.have.lengthOf(1);
      expect(summary[0].command).to.equal('testCommand');
      expect(summary[0].config.requiresCoordinator).to.be.true;
    });

    it('should handle handler overriding with warning', () => {
      const handler1 = sinon.stub().returns('result1');
      const handler2 = sinon.stub().returns('result2');
      
      // Register first handler
      MessageHandlerFactory.registerHandler({ command: 'duplicate' }, handler1);
      
      // Register second handler (should override)
      MessageHandlerFactory.registerHandler({ command: 'duplicate' }, handler2);
      
      const summary = MessageHandlerFactory.getHandlersSummary();
      expect(summary).to.have.lengthOf(1);
    });

    it('should apply default configuration values', () => {
      const handler = sinon.stub();
      
      MessageHandlerFactory.registerHandler(
        { command: 'minimal' },
        handler
      );
      
      const summary = MessageHandlerFactory.getHandlersSummary();
      const config = summary[0].config;
      
      expect(config.requiresCoordinator).to.be.true;
      expect(config.async).to.be.false;
      expect(config.logPrefix).to.equal('[MESSAGE_HANDLER]');
    });
  });

  describe('Message Processing', () => {
    it('should process valid messages successfully', async () => {
      const handler = sinon.stub().returns('success');
      
      MessageHandlerFactory.registerHandler(
        { command: 'testProcess' },
        handler
      );
      
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      const result = await processor({
        command: 'testProcess',
        data: { test: true }
      });
      
      expect(handler.calledOnce).to.be.true;
      expect(result).to.equal('success');
    });

    it('should validate messages and reject invalid ones', async () => {
      const handler = sinon.stub().returns('success');
      
      MessageHandlerFactory.registerHandler(
        {
          command: 'validateTest',
          validator: (message) => {
            if (!message.data || !message.data.required) {
              return { isValid: false, error: 'Missing required field' };
            }
            return { isValid: true };
          }
        },
        handler
      );
      
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      
      // Test invalid message
      const result = await processor({
        command: 'validateTest',
        data: { optional: true }
      });
      
      expect(handler.called).to.be.false;
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });

    it('should handle coordinator requirement validation', async () => {
      const handler = sinon.stub().returns('success');
      
      MessageHandlerFactory.registerHandler(
        {
          command: 'needsCoordinator',
          requiresCoordinator: true
        },
        handler
      );
      
      const processor = MessageHandlerFactory.createMessageProcessor(); // No coordinator
      const result = await processor({ command: 'needsCoordinator' });
      
      expect(handler.called).to.be.false;
      expect(result).to.have.property('success', false);
      expect(result.error).to.include('requires coordinator');
    });

    it('should handle async handlers properly', async () => {
      const handler = sinon.stub().resolves('async-success');
      
      MessageHandlerFactory.registerHandler(
        {
          command: 'asyncTest',
          async: true
        },
        handler
      );
      
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      const result = await processor({ command: 'asyncTest' });
      
      expect(handler.calledOnce).to.be.true;
      expect(result).to.equal('async-success');
    });

    it('should return error responses for unregistered commands', async () => {
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      const result = await processor({ command: 'unregistered' });
      
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('command', 'unregistered');
      expect(result.error).to.include('No handler registered');
    });

    it('should handle handler errors gracefully', async () => {
      const handler = sinon.stub().throws(new Error('Handler failed'));
      
      MessageHandlerFactory.registerHandler(
        { command: 'errorTest' },
        handler
      );
      
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      const result = await processor({ command: 'errorTest' });
      
      expect(result).to.have.property('success', false);
      expect(result.error).to.include('Handler failed');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple messages in parallel', async () => {
      const handler1 = sinon.stub().returns('result1');
      const handler2 = sinon.stub().returns('result2');
      
      MessageHandlerFactory.registerHandler({ command: 'batch1' }, handler1);
      MessageHandlerFactory.registerHandler({ command: 'batch2' }, handler2);
      
      const batchProcessor = MessageHandlerFactory.createBatchProcessor(coordinator);
      
      const results = await batchProcessor([
        { command: 'batch1' },
        { command: 'batch2' },
        { command: 'invalid' }
      ]);
      
      expect(results).to.have.lengthOf(3);
      expect(results[0]).to.equal('result1');
      expect(results[1]).to.equal('result2');
      expect(results[2]).to.have.property('success', false);
    });

    it('should measure batch processing performance', async () => {
      const handler = sinon.stub().returns('fast');
      MessageHandlerFactory.registerHandler({ command: 'perf' }, handler);
      
      const batchProcessor = MessageHandlerFactory.createBatchProcessor(coordinator);
      
      // Create a batch of messages
      const messages = Array(50).fill(0).map((_, i) => ({ command: 'perf', data: { id: i } }));
      
      const { duration } = PerformanceTestUtils.measureTime(async () => {
        await batchProcessor(messages);
      });
      
      // Should process 50 messages quickly (< 100ms)
      expect(duration).to.be.lessThan(100);
      expect(handler.callCount).to.equal(50);
    });
  });

  describe('Queue Processing', () => {
    it('should process messages with concurrent limits', async () => {
      const handler = sinon.stub().callsFake(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'queued';
      });
      
      MessageHandlerFactory.registerHandler({ command: 'queue' }, handler);
      
      const queueProcessor = MessageHandlerFactory.createQueueProcessor(coordinator, {
        maxConcurrent: 2,
        retryAttempts: 1
      });
      
      // Process multiple messages
      const promises = Array(5).fill(0).map(() => 
        queueProcessor.process({ command: 'queue' })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).to.have.lengthOf(5);
      results.forEach(result => expect(result).to.equal('queued'));
      expect(handler.callCount).to.equal(5);
    });

    it('should retry failed messages', async () => {
      let callCount = 0;
      const handler = sinon.stub().callsFake(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Temporary failure');
        }
        return 'success after retry';
      });
      
      MessageHandlerFactory.registerHandler({ command: 'retry' }, handler);
      
      const queueProcessor = MessageHandlerFactory.createQueueProcessor(coordinator, {
        retryAttempts: 3,
        retryDelay: 10
      });
      
      const result = await queueProcessor.process({ command: 'retry' });
      
      expect(result).to.equal('success after retry');
      expect(handler.callCount).to.equal(3);
    });

    it('should manage queue size and clearing', () => {
      const handler = sinon.stub().resolves('queued');
      MessageHandlerFactory.registerHandler({ command: 'manage' }, handler);
      
      const queueProcessor = MessageHandlerFactory.createQueueProcessor(coordinator);
      
      // Add messages to queue
      queueProcessor.process({ command: 'manage' });
      queueProcessor.process({ command: 'manage' });
      
      expect(queueProcessor.getQueueSize()).to.be.greaterThan(0);
      
      queueProcessor.clearQueue();
      expect(queueProcessor.getQueueSize()).to.equal(0);
    });
  });

  describe('Common Validators', () => {
    it('should provide terminal ID validation', () => {
      const validators = MessageHandlerFactory.createCommonValidators();
      
      // Test valid terminal ID
      const validResult = validators.terminalId({ terminalId: 'terminal-1' });
      expect(validResult.isValid).to.be.true;
      
      // Test invalid terminal ID
      const invalidResult = validators.terminalId({ terminalId: '' });
      expect(invalidResult.isValid).to.be.false;
    });

    it('should provide required data validation', () => {
      const validators = MessageHandlerFactory.createCommonValidators();
      
      // Test with data
      const validResult = validators.requiredData({ data: { test: true } });
      expect(validResult.isValid).to.be.true;
      
      // Test without data
      const invalidResult = validators.requiredData({});
      expect(invalidResult.isValid).to.be.false;
      expect(invalidResult.error).to.include('required');
    });

    it('should provide terminal output validation with size limits', () => {
      const validators = MessageHandlerFactory.createCommonValidators();
      
      // Test normal output
      const validResult = validators.terminalOutput({
        data: 'normal output',
        terminalId: 'terminal-1'
      });
      expect(validResult.isValid).to.be.true;
      
      // Test oversized output
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const invalidResult = validators.terminalOutput({ data: largeData });
      expect(invalidResult.isValid).to.be.false;
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle basic message validation errors', async () => {
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      
      // Test null message
      const result1 = await processor(null as any);
      expect(result1).to.have.property('success', false);
      
      // Test message without command
      const result2 = await processor({ data: 'no command' } as any);
      expect(result2).to.have.property('success', false);
    });

    it('should create appropriate error responses', async () => {
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      const result = await processor({ command: 'nonexistent' });
      
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('command', 'nonexistent');
      expect(result).to.have.property('error');
      expect(result).to.have.property('timestamp');
      expect(result.timestamp).to.be.a('number');
    });

    it('should maintain stability during concurrent error conditions', async () => {
      const errorHandler = sinon.stub().throws(new Error('Consistent failure'));
      MessageHandlerFactory.registerHandler({ command: 'error' }, errorHandler);
      
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      
      // Process multiple failing messages concurrently
      const promises = Array(10).fill(0).map(() => 
        processor({ command: 'error' })
      );
      
      const results = await Promise.all(promises);
      
      // All should fail gracefully
      results.forEach(result => {
        expect(result).to.have.property('success', false);
        expect(result.error).to.include('Consistent failure');
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle high-volume message processing efficiently', async () => {
      const handler = sinon.stub().returns('processed');
      MessageHandlerFactory.registerHandler({ command: 'volume' }, handler);
      
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      
      // Test memory usage patterns
      PerformanceTestUtils.testMemoryUsage(() => {
        const tempProcessor = MessageHandlerFactory.createMessageProcessor(coordinator);
        return {
          dispose: () => {
            // Processor cleanup (if needed)
          }
        };
      }, 20);
      
      // Process many messages
      const { duration } = PerformanceTestUtils.measureTime(async () => {
        const promises = Array(100).fill(0).map((_, i) => 
          processor({ command: 'volume', data: { id: i } })
        );
        await Promise.all(promises);
      });
      
      // Should process 100 messages quickly
      expect(duration).to.be.lessThan(200);
      expect(handler.callCount).to.equal(100);
    });

    it('should clean up handlers properly', () => {
      // Register multiple handlers
      MessageHandlerFactory.registerHandler({ command: 'cleanup1' }, sinon.stub());
      MessageHandlerFactory.registerHandler({ command: 'cleanup2' }, sinon.stub());
      MessageHandlerFactory.registerHandler({ command: 'cleanup3' }, sinon.stub());
      
      expect(MessageHandlerFactory.getHandlersSummary()).to.have.lengthOf(3);
      
      MessageHandlerFactory.clearHandlers();
      expect(MessageHandlerFactory.getHandlersSummary()).to.have.lengthOf(0);
    });
  });

  describe('Integration with WebView Architecture', () => {
    it('should integrate properly with coordinator interface', async () => {
      const handler = sinon.stub().callsFake((message, coord) => {
        coord.updateActiveTerminal('test-terminal');
        return 'integrated';
      });
      
      MessageHandlerFactory.registerHandler({ command: 'integrate' }, handler);
      
      const processor = MessageHandlerFactory.createMessageProcessor(coordinator);
      const result = await processor({ command: 'integrate' });
      
      expect(result).to.equal('integrated');
      expect(coordinator.updateActiveTerminal.calledWith('test-terminal')).to.be.true;
    });

    it('should support custom log prefixes for different managers', async () => {
      const handler = sinon.stub().returns('logged');
      
      MessageHandlerFactory.registerHandler({
        command: 'customLog',
        logPrefix: '[CUSTOM_MANAGER]'
      }, handler);
      
      const processor = MessageHandlerFactory.createMessageProcessor(
        coordinator,
        '[CUSTOM_MANAGER]'
      );
      
      const result = await processor({ command: 'customLog' });
      expect(result).to.equal('logged');
    });
  });
});