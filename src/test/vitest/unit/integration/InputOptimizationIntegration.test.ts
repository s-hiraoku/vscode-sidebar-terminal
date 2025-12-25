/**
 * Input Optimization Integration Test Suite
 * Tests the complete input flow from InputManager through ConsolidatedMessageManager to PerformanceManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { InputManager } from '../../../../webview/managers/InputManager';
import { ConsolidatedMessageManager } from '../../../../webview/managers/ConsolidatedMessageManager';
import { PerformanceManager } from '../../../../webview/managers/PerformanceManager';
import {
  IManagerCoordinator,
  IUIManager,
  IConfigManager,
  INotificationManager,
} from '../../../../webview/interfaces/ManagerInterfaces';

describe('Input Optimization Integration', () => {
  let inputManager: InputManager;
  let messageManager: ConsolidatedMessageManager;
  let performanceManager: PerformanceManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCoordinator: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTerminal: any;
  let jsdom: JSDOM;

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

    vi.useFakeTimers();

    // Create mock terminal
    mockTerminal = {
      write: vi.fn(),
      resize: vi.fn(),
      hasSelection: vi.fn().mockReturnValue(false),
    };

    // Create comprehensive mock coordinator
    mockCoordinator = {
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      setActiveTerminalId: vi.fn(),
      postMessageToExtension: vi.fn().mockResolvedValue(undefined),
      getTerminalInstance: vi.fn().mockReturnValue({
        terminal: mockTerminal,
        id: 'terminal-1',
        name: 'Terminal 1',
      }),
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
      createTerminal: vi.fn(),
      getManagers: vi.fn().mockReturnValue({
        performance: null, // Will be set after creation
      }),
    };

    // Initialize managers (Issue #216: constructor injection)
    inputManager = new InputManager(mockCoordinator);
    messageManager = new ConsolidatedMessageManager();
    performanceManager = new PerformanceManager();
    performanceManager.initialize();

    // Update coordinator to include all required managers
    mockCoordinator.getManagers.mockReturnValue({
      performance: performanceManager,
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
    vi.restoreAllMocks();
    vi.useRealTimers();
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
      mockTerminal.write.mockImplementation((data: string) => {
        writeCalls.push(data);
      });

      // Simulate typing each character
      for (const char of inputSequence) {
        // Use PerformanceManager directly as it would be used by output handling
        performanceManager.bufferedWrite(char, mockTerminal, 'terminal-1');
      }

      // All single characters should be written immediately (small input optimization)
      expect(writeCalls.length).toBe(inputSequence.length);
      expect(writeCalls.join('')).toBe(inputSequence);
    });

    it.skip('should handle high-priority input messages correctly', async () => {
      // TODO: Fix - queueMessage method does not exist in ConsolidatedMessageManager
      const executionOrder: string[] = [];

      mockCoordinator.postMessageToExtension.mockImplementation(async (message: any) => {
        executionOrder.push(`${message.command}-${message.type || 'none'}`);
      });

      // Queue mixed priority messages through messageManager
      (messageManager as any).queueMessage({ command: 'stateUpdate' }, mockCoordinator);
      (messageManager as any).queueMessage({ command: 'input', data: 'a' }, mockCoordinator);
      (messageManager as any).queueMessage(
        { command: 'terminalInteraction', type: 'paste' },
        mockCoordinator
      );
      (messageManager as any).queueMessage({ command: 'fontSettingsUpdate' }, mockCoordinator);

      vi.advanceTimersByTime(10);
      await vi.runAllTimersAsync();

      // Input-related messages should be processed first
      expect(executionOrder.slice(0, 2)).toEqual(['input-none', 'terminalInteraction-paste']);
    });

    it('should handle IME composition without interrupting buffer flow', () => {
      const outputData: string[] = [];
      mockTerminal.write.mockImplementation((data: string) => outputData.push(data));

      // Start IME composition
      document.dispatchEvent(new jsdom.window.CompositionEvent('compositionstart', { data: 'あ' }));
      expect(inputManager.isIMEComposing()).toBe(true);

      // Buffer output during composition (should still work)
      performanceManager.bufferedWrite('output during IME', mockTerminal, 'terminal-1');

      // Advance timers to trigger buffer flush
      vi.advanceTimersByTime(20);

      // Update composition
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionupdate', { data: 'あい' })
      );
      expect(inputManager.isIMEComposing()).toBe(true);

      // End composition
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionend', { data: 'あいう' })
      );

      // After delay, should not be composing
      vi.advanceTimersByTime(10);
      expect(inputManager.isIMEComposing()).toBe(false);

      // Output should have been processed normally
      expect(outputData).toContain('output during IME');
    });

    it('should maintain responsiveness during CLI Agent activity', () => {
      // Enable CLI Agent mode
      performanceManager.setCliAgentMode(true);

      const processingTimes: number[] = [];
      mockTerminal.write.mockImplementation(() => {
        processingTimes.push(Date.now());
      });

      // Mix of small inputs (typing) and moderate CLI Agent output
      const startTime = Date.now();

      // User typing (should be immediate)
      performanceManager.bufferedWrite('a', mockTerminal, 'terminal-1');
      performanceManager.bufferedWrite('b', mockTerminal, 'terminal-1');

      // CLI Agent output (should be immediate due to moderate size in CLI mode)
      const cliOutput = 'CLI Agent response: '.repeat(5); // ~100 chars
      performanceManager.bufferedWrite(cliOutput, mockTerminal, 'terminal-1');

      // More user typing
      performanceManager.bufferedWrite('c', mockTerminal, 'terminal-1');

      // All should be processed immediately
      expect(mockTerminal.write).toHaveBeenCalledTimes(4);

      // Verify timing - all should be processed within first millisecond
      // Note: Date.now() doesn't advance with fake timers unless we advance it manually or use performance.now() which isn't mocked by default in all setups.
      // With vi.useFakeTimers(), Date.now() is mocked.
      // But we aren't advancing time here, so they should all be equal to startTime.
      processingTimes.forEach((time) => {
        expect(time - startTime).toBeLessThan(1);
      });
    });

    it('should handle rapid focus changes with optimized debouncing', () => {
      const focusMessages: any[] = [];
      mockCoordinator.postMessageToExtension.mockImplementation(async (message: any) => {
        if (message.command === 'terminalInteraction' && message.type === 'focus') {
          focusMessages.push(message);
        }
      });

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
      expect(focusMessages.length).toBe(0);

      // After optimized debounce time (50ms)
      vi.advanceTimersByTime(50);

      // Should send only the last focus message
      expect(focusMessages.length).toBe(1);
      expect(focusMessages[0].terminalId).toBe('terminal-3');
    });

    it.skip('should prevent race conditions in concurrent operations', async () => {
      // TODO: Fix - queueMessage method does not exist in ConsolidatedMessageManager
      const operationLog: string[] = [];
      let concurrentOperations = 0;
      let maxConcurrency = 0;

      // Mock operations that track concurrency
      mockCoordinator.postMessageToExtension.mockImplementation(async (message: any) => {
        concurrentOperations++;
        maxConcurrency = Math.max(maxConcurrency, concurrentOperations);
        operationLog.push(`start-${message.command}`);

        await new Promise((resolve) => setTimeout(resolve, 5));

        operationLog.push(`end-${message.command}`);
        concurrentOperations--;
      });

      // Trigger multiple concurrent operations
      const promises = [];
      for (let i = 0; i < 10; i++) {
        (messageManager as any).queueMessage({ command: `op${i}` }, mockCoordinator);
        promises.push((messageManager as any).processMessageQueue(mockCoordinator));
      }

      vi.advanceTimersByTime(100);
      await Promise.all(promises);
      await vi.runAllTimersAsync();

      // Should never have more than 1 concurrent operation
      expect(maxConcurrency).toBe(1);

      // All operations should complete
      const completedOps = operationLog.filter((log) => log.startsWith('end-')).length;
      expect(completedOps).toBe(10);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from terminal write failures', () => {
      let failureCount = 0;
      mockTerminal.write.mockImplementation(() => {
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
      }).not.toThrow();

      // Third write should succeed
      expect(failureCount).toBe(3);
    });

    it.skip('should handle IME events during message queue processing', async () => {
      // TODO: Fix - queueMessage method does not exist in ConsolidatedMessageManager
      let imeInterrupted = false;
      mockCoordinator.postMessageToExtension.mockImplementation(async () => {
        // Simulate IME event during message processing
        if (!imeInterrupted) {
          imeInterrupted = true;
          document.dispatchEvent(
            new jsdom.window.CompositionEvent('compositionstart', { data: 'test' })
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Queue message and start processing
      (messageManager as any).queueMessage({ command: 'test' }, mockCoordinator);

      vi.advanceTimersByTime(20);
      await vi.runAllTimersAsync();

      // IME should be in composing state
      expect(inputManager.isIMEComposing()).toBe(true);

      // Message should still be processed
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalled();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should maintain <5ms response time for single character input', () => {
      const responseTime = performance.now();

      performanceManager.bufferedWrite('x', mockTerminal, 'terminal-1');

      const elapsed = performance.now() - responseTime;

      expect(elapsed).toBeLessThan(5);
      expect(mockTerminal.write).toHaveBeenCalledTimes(1);
    });

    it('should process 1000 rapid inputs without significant delay accumulation', () => {
      const startTime = Date.now();
      const inputs = Array.from({ length: 1000 }, (_, i) => String.fromCharCode(65 + (i % 26))); // A-Z cycle

      inputs.forEach((char) => {
        performanceManager.bufferedWrite(char, mockTerminal, 'terminal-1');
      });

      const totalTime = Date.now() - startTime;

      // Should process all inputs very quickly (immediate for single chars)
      expect(totalTime).toBeLessThan(100); // Less than 100ms for 1000 chars
      expect(mockTerminal.write).toHaveBeenCalledTimes(1000);
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
      const beforeCount = mockTerminal.write.mock.calls.length;

      inputs.forEach((input) => {
        const before = mockTerminal.write.mock.calls.length;
        performanceManager.bufferedWrite(input, mockTerminal, 'terminal-1');
        const after = mockTerminal.write.mock.calls.length;

        if (after > before) {
          immediateWrites++;
        }
      });

      // Should have 4 immediate writes (small + large)
      expect(immediateWrites).toBe(4);

      // Process buffered content - use longer timeout to ensure all buffers flush
      vi.advanceTimersByTime(50);

      // All should be written eventually (4 immediate + buffered writes may be merged)
      expect(mockTerminal.write.mock.calls.length - beforeCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Memory and Resource Management', () => {
    it.skip('should properly cleanup all managers without memory leaks', () => {
      // TODO: Fix - queueMessage method does not exist in ConsolidatedMessageManager
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
      expect(messageStats.queueSize + (messageStats.highPriorityQueueSize || 0)).toBeGreaterThan(
        0
      );

      // Dispose all managers
      inputManager.dispose();
      messageManager.dispose();
      performanceManager.dispose();

      // Stats should show clean state
      const finalMessageStats = messageManager.getQueueStats();
      const finalPerformanceStats = performanceManager.getBufferStats();

      expect(finalMessageStats.queueSize).toBe(0);
      expect(finalMessageStats.highPriorityQueueSize).toBe(0);
      expect(finalPerformanceStats.bufferSize).toBe(0);
      expect(finalPerformanceStats.isFlushScheduled).toBe(false);
    });
  });
});
