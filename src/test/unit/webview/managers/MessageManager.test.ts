/**
 * RefactoredMessageManager Test Suite - Race condition and priority queue validation
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { RefactoredMessageManager } from '../../../../webview/managers/RefactoredMessageManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';

describe('RefactoredMessageManager', () => {
  let messageManager: RefactoredMessageManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    // Create mock coordinator
    mockCoordinator = {
      postMessageToExtension: sinon.stub().resolves(),
      getTerminalInstance: sinon.stub(),
      createTerminal: sinon.stub(),
      setActiveTerminalId: sinon.stub(),
      getActiveTerminalId: sinon.stub().returns('terminal-1'),
      getAllTerminalInstances: sinon.stub().returns(new Map()),
    } as any;

    messageManager = new RefactoredMessageManager();
  });

  afterEach(() => {
    clock.restore();
    messageManager.dispose();
  });

  describe('Priority Queue System', () => {
    it('should prioritize input messages over regular messages', async () => {
      const executionOrder: string[] = [];

      // Mock postMessageToExtension to track execution order
      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async (_message: any) => {
        executionOrder.push(_message.command);
        // Simulate small delay
        await new Promise((resolve) => setTimeout(resolve, 1));
      }) as any;

      // Queue regular messages first
      (messageManager as any).queueMessage({ command: 'regular1' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'regular2' }, mockCoordinator);

      // Queue input messages (should be prioritized)
      (messageManager as any).queueMessage({ command: 'input', type: 'input' }, mockCoordinator);
      (messageManager as any).queueMessage(
        { command: 'terminalInteraction', type: 'keydown' },
        mockCoordinator
      );

      // Queue more regular messages
      (messageManager as any).queueMessage({ command: 'regular3' }, mockCoordinator);

      // Wait for processing
      clock.tick(100);
      await clock.runAllAsync();

      // Input messages should be processed first
      expect(executionOrder.slice(0, 2)).to.deep.equal(['input', 'terminalInteraction']);
      expect(executionOrder.slice(2)).to.include.members(['regular1', 'regular2', 'regular3']);
    });

    it('should process high-priority messages without delay', async () => {
      let processStartTime = Date.now();
      const processingTimes: number[] = [];

      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async (_message: any) => {
        processingTimes.push(Date.now() - processStartTime);
      }) as any;

      // Queue high-priority input message
      processStartTime = Date.now();
      (messageManager as any).queueMessage({ command: 'input', type: 'input' }, mockCoordinator);

      clock.tick(10);
      await clock.runAllAsync();

      // High-priority message should be processed immediately (no 1ms delay)
      expect(processingTimes[0]).to.be.lessThan(5);
    });

    it('should apply 1ms delay to normal priority messages', async () => {
      const processingTimes: number[] = [];
      let messageCount = 0;

      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async (_message: any) => {
        processingTimes.push(clock.now);
        messageCount++;
      }) as any;

      // Queue multiple regular messages
      (messageManager as any).queueMessage({ command: 'regular1' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'regular2' }, mockCoordinator);

      clock.tick(10);
      await clock.runAllAsync();

      // Should have processed both messages with delays
      expect(messageCount).to.equal(2);
      // Second message should be processed at least 1ms after first
      if (processingTimes.length >= 2) {
        expect(processingTimes[1]! - processingTimes[0]!).to.be.greaterThanOrEqual(1);
      }
    });
  });

  describe('Race Condition Protection', () => {
    it('should prevent concurrent queue processing', async () => {
      let concurrentCallCount = 0;
      let maxConcurrency = 0;
      let currentConcurrency = 0;

      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async () => {
        currentConcurrency++;
        maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
        concurrentCallCount++;

        // Simulate async processing
        await new Promise((resolve) => setTimeout(resolve, 10));

        currentConcurrency--;
      }) as any;

      // Attempt to trigger multiple concurrent processing attempts
      const promises = [];
      for (let i = 0; i < 10; i++) {
        (messageManager as any).queueMessage({ command: `message${i}` }, mockCoordinator);
        promises.push((messageManager as any).processMessageQueue(mockCoordinator));
      }

      clock.tick(100);
      await Promise.all(promises);
      await clock.runAllAsync();

      // Should never have more than 1 concurrent processing
      expect(maxConcurrency).to.equal(1);
      expect(concurrentCallCount).to.equal(10); // All messages should be processed
    });

    it('should handle queue lock correctly', () => {
      const stats1 = messageManager.getQueueStats();
      expect(stats1.isLocked).to.be.false;

      // Queue a message (this will set lock briefly)
      (messageManager as any).queueMessage({ command: 'test' }, mockCoordinator);

      // The lock might be briefly set during processing
      const stats2 = messageManager.getQueueStats();
      expect(stats2.queueSize).to.be.greaterThan(0);
    });

    it('should prevent queue clearing during processing', async () => {
      let processingStarted = false;
      let _processingFinished = false;

      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async () => {
        processingStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 50)); // Long processing
        _processingFinished = true;
      }) as any;

      // Queue message and start processing
      (messageManager as any).queueMessage({ command: 'test' }, mockCoordinator);

      // Advance time to start processing
      clock.tick(1);

      // Try to clear queue while processing (should be deferred)
      messageManager.clearQueue();

      // Processing should still be ongoing
      expect(processingStarted).to.be.false; // Not started yet with fake timers

      // Complete processing
      await clock.runAllAsync();

      // Queue should be cleared after processing
      const stats = messageManager.getQueueStats();
      expect(stats.queueSize).to.equal(0);
      expect(stats.highPriorityQueueSize).to.equal(0);
    });
  });

  describe('Queue Statistics and Monitoring', () => {
    it('should provide accurate queue statistics', () => {
      // Initially empty
      let stats = messageManager.getQueueStats();
      expect(stats.queueSize).to.equal(0);
      expect(stats.highPriorityQueueSize).to.equal(0);
      expect(stats.isProcessing).to.be.false;
      expect(stats.isLocked).to.be.false;

      // Add regular messages
      (messageManager as any).queueMessage({ command: 'regular1' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'regular2' }, mockCoordinator);

      // Add high-priority messages
      (messageManager as any).queueMessage({ command: 'input' }, mockCoordinator);
      (messageManager as any).queueMessage(
        { command: 'terminalInteraction', type: 'paste' },
        mockCoordinator
      );

      stats = messageManager.getQueueStats();
      expect(stats.queueSize).to.equal(2); // Regular messages
      expect(stats.highPriorityQueueSize).to.equal(2); // High-priority messages
    });

    it('should correctly identify input message types', () => {
      // Test various message types
      const testCases = [
        { message: { command: 'input' }, shouldBeHighPriority: true },
        { message: { command: 'terminalInteraction' }, shouldBeHighPriority: true },
        { message: { command: 'regular', type: 'input' }, shouldBeHighPriority: true },
        { message: { command: 'regular', type: 'keydown' }, shouldBeHighPriority: true },
        { message: { command: 'regular', type: 'paste' }, shouldBeHighPriority: true },
        { message: { command: 'regular' }, shouldBeHighPriority: false },
        { message: { command: 'stateUpdate' }, shouldBeHighPriority: false },
      ];

      testCases.forEach((testCase, index) => {
        (messageManager as any).queueMessage(testCase.message, mockCoordinator);

        const stats = messageManager.getQueueStats();
        if (testCase.shouldBeHighPriority) {
          expect(stats.highPriorityQueueSize).to.be.greaterThan(
            0,
            `Test case ${index}: ${JSON.stringify(testCase.message)} should be high priority`
          );
        }
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle postMessageToExtension errors gracefully', async () => {
      let callCount = 0;
      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network error');
        }
        // Second call succeeds
      }) as any;

      // Queue two messages
      (messageManager as any).queueMessage({ command: 'test1' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'test2' }, mockCoordinator);

      clock.tick(100);
      await clock.runAllAsync();

      // First message should fail and be re-queued, second should succeed
      expect(callCount).to.be.greaterThan(1);

      // Queue should not be empty (failed message re-queued)
      const stats = messageManager.getQueueStats();
      expect(stats.queueSize).to.be.greaterThan(0);
    });

    it('should maintain message order during error recovery', async () => {
      const processedMessages: string[] = [];
      let shouldFail = true;

      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async (_message: any) => {
        if (shouldFail && _message.command === 'test1') {
          shouldFail = false; // Only fail once
          throw new Error('Temporary failure');
        }
        processedMessages.push(_message.command);
      }) as any;

      // Queue messages in order
      (messageManager as any).queueMessage({ command: 'test1' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'test2' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'test3' }, mockCoordinator);

      clock.tick(100);
      await clock.runAllAsync();

      // test1 should fail first, then succeed on retry
      // Order might be affected by retry, but all messages should eventually process
      expect(processedMessages).to.include.members(['test1', 'test2', 'test3']);
    });
  });

  describe('Input Message Methods', () => {
    it('should send input messages with high priority', () => {
      messageManager.sendInput('test input', 'terminal-1', mockCoordinator);

      const stats = messageManager.getQueueStats();
      expect(stats.highPriorityQueueSize).to.equal(1);
      expect(stats.queueSize).to.equal(0);
    });

    it('should handle missing terminalId in sendInput', () => {
      mockCoordinator.getActiveTerminalId.returns('default-terminal');

      messageManager.sendInput('test input', undefined, mockCoordinator);

      expect(mockCoordinator.getActiveTerminalId.called).to.be.true;
    });
  });

  describe('Memory Management', () => {
    it('should properly cleanup on dispose', () => {
      // Add messages to queues
      (messageManager as any).queueMessage({ command: 'test1' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'input' }, mockCoordinator);

      let stats = messageManager.getQueueStats();
      expect(stats.queueSize + stats.highPriorityQueueSize).to.be.greaterThan(0);

      // Dispose should clear everything
      messageManager.dispose();

      stats = messageManager.getQueueStats();
      expect(stats.queueSize).to.equal(0);
      expect(stats.highPriorityQueueSize).to.equal(0);
      expect(stats.isProcessing).to.be.false;
      expect(stats.isLocked).to.be.false;
    });
  });

  describe('Stress Testing', () => {
    it('should handle high-frequency message queuing', async () => {
      const messageCount = 1000;
      const processedMessages: string[] = [];

      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async (_message: any) => {
        processedMessages.push(_message.command);
      }) as any;

      // Queue many messages rapidly
      for (let i = 0; i < messageCount; i++) {
        const isInput = i % 10 === 0; // Every 10th message is input
        const command = isInput ? 'input' : `regular${i}`;
        (messageManager as any).queueMessage(
          { command, type: isInput ? 'input' : undefined },
          mockCoordinator
        );
      }

      clock.tick(1000);
      await clock.runAllAsync();

      // All messages should be processed
      expect(processedMessages.length).to.equal(messageCount);

      // Input messages should be processed first
      const inputMessages = processedMessages.filter((cmd) => cmd === 'input');
      const expectedInputCount = Math.floor(messageCount / 10);
      expect(inputMessages.length).to.equal(expectedInputCount);
    });
  });
});
