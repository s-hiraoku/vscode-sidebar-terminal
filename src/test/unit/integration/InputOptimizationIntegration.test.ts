/**
 * Input Optimization Integration Test Suite
 * Tests the complete input flow from InputManager through RefactoredMessageManager to PerformanceManager
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { InputManager } from '../../../webview/managers/InputManager';
import { RefactoredMessageManager } from '../../../webview/managers/RefactoredMessageManager';
import { PerformanceManager } from '../../../webview/managers/PerformanceManager';
import {
  IManagerCoordinator,
  IUIManager,
  IConfigManager,
  INotificationManager,
} from '../../../webview/interfaces/ManagerInterfaces';

describe('Input Optimization Integration', () => {
  let inputManager: InputManager;
  let messageManager: RefactoredMessageManager;
  let performanceManager: PerformanceManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let mockTerminal: any;
  let jsdom: JSDOM;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    // Setup JSDOM environment
    jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    global.window = jsdom.window as any;
    global.document = jsdom.window.document;
    global.Event = jsdom.window.Event;
    global.CompositionEvent = jsdom.window.CompositionEvent;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;
    global.MouseEvent = jsdom.window.MouseEvent;

    clock = sinon.useFakeTimers();

    // Create mock terminal
    mockTerminal = {
      write: sinon.stub(),
      resize: sinon.stub(),
      hasSelection: sinon.stub().returns(false),
    };

    // Create comprehensive mock coordinator
    mockCoordinator = {
      getActiveTerminalId: sinon.stub().returns('terminal-1'),
      setActiveTerminalId: sinon.stub(),
      postMessageToExtension: sinon.stub().resolves(),
      getTerminalInstance: sinon.stub().returns({
        terminal: mockTerminal,
        id: 'terminal-1',
        name: 'Terminal 1',
      }),
      getAllTerminalInstances: sinon.stub().returns(new Map()),
      createTerminal: sinon.stub(),
      getManagers: sinon.stub().returns({
        performance: null, // Will be set after creation
      }),
    } as any;

    // Initialize managers
    inputManager = new InputManager();
    messageManager = new RefactoredMessageManager();
    performanceManager = new PerformanceManager();
    performanceManager.initialize({ coordinator: mockCoordinator });

    // Update coordinator to include all required managers
    mockCoordinator.getManagers.returns({
      performance: performanceManager as any,
      input: inputManager,
      ui: {} as IUIManager,
      config: {} as IConfigManager,
      message: messageManager,
      notification: {} as INotificationManager,
    });

    // Setup managers
    inputManager.setupIMEHandling();
    inputManager.setupKeyboardShortcuts(mockCoordinator);
  });

  afterEach(() => {
    clock.restore();
    inputManager.dispose();
    messageManager.dispose();
    performanceManager.dispose();
    jsdom.window.close();
  });

  describe('End-to-End Input Flow', () => {
    it('should process typing input with optimized timing', async () => {
      const inputSequence = 'Hello World!';
      const writeCalls: string[] = [];

      // Track all writes to terminal
      mockTerminal.write.callsFake((data: string) => {
        writeCalls.push(data);
      });

      // Simulate typing each character
      for (const char of inputSequence) {
        // Use PerformanceManager directly as it would be used by output handling
        performanceManager.bufferedWrite(char, mockTerminal, 'terminal-1');
      }

      // All single characters should be written immediately (small input optimization)
      expect(writeCalls.length).to.equal(inputSequence.length);
      expect(writeCalls.join('')).to.equal(inputSequence);
    });

    it('should handle high-priority input messages correctly', async () => {
      const executionOrder: string[] = [];

      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async (message: any) => {
        executionOrder.push(`${message.command}-${message.type || 'none'}`);
      }) as any;

      // Queue mixed priority messages through messageManager
      (messageManager as any).queueMessage({ command: 'stateUpdate' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'input', data: 'a' }, mockCoordinator);
      (messageManager as any).queueMessage(
        { command: 'terminalInteraction', type: 'paste' },
        mockCoordinator
      );
      (messageManager as any).queueMessage({ command: 'fontSettingsUpdate' }, mockCoordinator);

      clock.tick(10);
      await clock.runAllAsync();

      // Input-related messages should be processed first
      expect(executionOrder.slice(0, 2)).to.deep.equal(['input-none', 'terminalInteraction-paste']);
    });

    it('should handle IME composition without interrupting buffer flow', () => {
      const outputData: string[] = [];
      mockTerminal.write.callsFake((data: string) => outputData.push(data));

      // Start IME composition
      document.dispatchEvent(new jsdom.window.CompositionEvent('compositionstart', { data: 'あ' }));
      expect(inputManager.isIMEComposing()).to.be.true;

      // Buffer output during composition (should still work)
      performanceManager.bufferedWrite('output during IME', mockTerminal, 'terminal-1');

      // Update composition
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionupdate', { data: 'あい' })
      );
      expect(inputManager.isIMEComposing()).to.be.true;

      // End composition
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionend', { data: 'あいう' })
      );

      // After delay, should not be composing
      clock.tick(10);
      expect(inputManager.isIMEComposing()).to.be.false;

      // Output should have been processed normally
      expect(outputData).to.include('output during IME');
    });

    it('should maintain responsiveness during CLI Agent activity', () => {
      // Enable CLI Agent mode
      performanceManager.setCliAgentMode(true);

      const processingTimes: number[] = [];
      mockTerminal.write.callsFake(() => {
        processingTimes.push(clock.now);
      });

      // Mix of small inputs (typing) and moderate CLI Agent output
      const startTime = clock.now;

      // User typing (should be immediate)
      performanceManager.bufferedWrite('a', mockTerminal, 'terminal-1');
      performanceManager.bufferedWrite('b', mockTerminal, 'terminal-1');

      // CLI Agent output (should be immediate due to moderate size in CLI mode)
      const cliOutput = 'CLI Agent response: '.repeat(5); // ~100 chars
      performanceManager.bufferedWrite(cliOutput, mockTerminal, 'terminal-1');

      // More user typing
      performanceManager.bufferedWrite('c', mockTerminal, 'terminal-1');

      // All should be processed immediately
      expect(mockTerminal.write.callCount).to.equal(4);

      // Verify timing - all should be processed within first millisecond
      processingTimes.forEach((time) => {
        expect(time - startTime).to.be.lessThan(1);
      });
    });

    it('should handle rapid focus changes with optimized debouncing', () => {
      const focusMessages: any[] = [];
      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async (message: any) => {
        if (message.command === 'terminalInteraction' && message.type === 'focus') {
          focusMessages.push(message);
        }
      }) as any;

      // Rapid focus changes (as would happen with quick clicks)
      const terminals = ['terminal-1', 'terminal-2', 'terminal-3'];
      terminals.forEach((terminalId) => {
        (inputManager as any).emitTerminalInteractionEvent(
          'focus',
          terminalId,
          undefined,
          mockCoordinator
        );
      });

      // Should not send any messages yet (debounced)
      expect(focusMessages.length).to.equal(0);

      // After optimized debounce time (50ms)
      clock.tick(50);

      // Should send only the last focus message
      expect(focusMessages.length).to.equal(1);
      expect(focusMessages[0].terminalId).to.equal('terminal-3');
    });

    it('should prevent race conditions in concurrent operations', async () => {
      const operationLog: string[] = [];
      let concurrentOperations = 0;
      let maxConcurrency = 0;

      // Mock operations that track concurrency
      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async (message: any) => {
        concurrentOperations++;
        maxConcurrency = Math.max(maxConcurrency, concurrentOperations);
        operationLog.push(`start-${message.command}`);

        await new Promise((resolve) => setTimeout(resolve, 5));

        operationLog.push(`end-${message.command}`);
        concurrentOperations--;
      }) as any;

      // Trigger multiple concurrent operations
      const promises = [];
      for (let i = 0; i < 10; i++) {
        (messageManager as any).queueMessage({ command: `op${i}` }, mockCoordinator);
        promises.push((messageManager as any).processMessageQueue(mockCoordinator));
      }

      clock.tick(100);
      await Promise.all(promises);
      await clock.runAllAsync();

      // Should never have more than 1 concurrent operation
      expect(maxConcurrency).to.equal(1);

      // All operations should complete
      const completedOps = operationLog.filter((log) => log.startsWith('end-')).length;
      expect(completedOps).to.equal(10);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from terminal write failures', () => {
      let failureCount = 0;
      mockTerminal.write.callsFake(() => {
        failureCount++;
        if (failureCount <= 2) {
          throw new Error('Write failed');
        }
        // Third attempt succeeds
      });

      // Should not throw even with failures
      expect(() => {
        performanceManager.bufferedWrite('a', mockTerminal, 'terminal-1');
        performanceManager.bufferedWrite('b', mockTerminal, 'terminal-1');
        performanceManager.bufferedWrite('c', mockTerminal, 'terminal-1');
      }).to.not.throw();

      // Third write should succeed
      expect(failureCount).to.equal(3);
    });

    it('should handle IME events during message queue processing', async () => {
      let imeInterrupted = false;
      mockCoordinator.postMessageToExtension = sinon.stub().callsFake(async () => {
        // Simulate IME event during message processing
        if (!imeInterrupted) {
          imeInterrupted = true;
          document.dispatchEvent(
            new jsdom.window.CompositionEvent('compositionstart', { data: 'test' })
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }) as any;

      // Queue message and start processing
      (messageManager as any).queueMessage({ command: 'test' }, mockCoordinator);

      clock.tick(20);
      await clock.runAllAsync();

      // IME should be in composing state
      expect(inputManager.isIMEComposing()).to.be.true;

      // Message should still be processed
      expect(mockCoordinator.postMessageToExtension.called).to.be.true;
    });
  });

  describe('Performance Benchmarks', () => {
    it('should maintain <5ms response time for single character input', () => {
      const responseTime = performance.now();

      performanceManager.bufferedWrite('x', mockTerminal, 'terminal-1');

      const elapsed = performance.now() - responseTime;

      expect(elapsed).to.be.lessThan(5);
      expect(mockTerminal.write.calledOnce).to.be.true;
    });

    it('should process 1000 rapid inputs without significant delay accumulation', () => {
      const startTime = clock.now;
      const inputs = Array.from({ length: 1000 }, (_, i) => String.fromCharCode(65 + (i % 26))); // A-Z cycle

      inputs.forEach((char) => {
        performanceManager.bufferedWrite(char, mockTerminal, 'terminal-1');
      });

      const totalTime = clock.now - startTime;

      // Should process all inputs very quickly (immediate for single chars)
      expect(totalTime).to.be.lessThan(100); // Less than 100ms for 1000 chars
      expect(mockTerminal.write.callCount).to.equal(1000);
    });

    it('should handle mixed input sizes efficiently', () => {
      const inputs = [
        'a', // Small (immediate)
        'b'.repeat(600), // Large (immediate)
        'c'.repeat(30), // Medium (buffered)
        'd', // Small (immediate)
        'e'.repeat(800), // Large (immediate)
        'f'.repeat(40), // Medium (buffered)
      ];

      let immediateWrites = 0;
      const beforeCount = mockTerminal.write.callCount;

      inputs.forEach((input) => {
        const before = mockTerminal.write.callCount;
        performanceManager.bufferedWrite(input, mockTerminal, 'terminal-1');
        const after = mockTerminal.write.callCount;

        if (after > before) {
          immediateWrites++;
        }
      });

      // Should have 4 immediate writes (small + large)
      expect(immediateWrites).to.equal(4);

      // Process buffered content
      clock.tick(4);

      // All should be written eventually
      expect(mockTerminal.write.callCount - beforeCount).to.equal(6);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should properly cleanup all managers without memory leaks', () => {
      // Create some pending operations
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        'terminal-1',
        undefined,
        mockCoordinator
      );
      performanceManager.bufferedWrite('test output', mockTerminal, 'terminal-1');
      (messageManager as any).queueMessage({ command: 'test' }, mockCoordinator);

      // Get initial stats
      const messageStats = messageManager.getQueueStats();
      const _performanceStats = performanceManager.getBufferStats();

      // Should have pending operations
      expect(messageStats.queueSize + (messageStats.highPriorityQueueSize || 0)).to.be.greaterThan(
        0
      );

      // Dispose all managers
      inputManager.dispose();
      messageManager.dispose();
      performanceManager.dispose();

      // Stats should show clean state
      const finalMessageStats = messageManager.getQueueStats();
      const finalPerformanceStats = performanceManager.getBufferStats();

      expect(finalMessageStats.queueSize).to.equal(0);
      expect(finalMessageStats.highPriorityQueueSize).to.equal(0);
      expect(finalPerformanceStats.bufferSize).to.equal(0);
      expect(finalPerformanceStats.isFlushScheduled).to.be.false;
    });
  });
});
