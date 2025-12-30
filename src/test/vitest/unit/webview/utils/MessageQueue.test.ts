import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageQueue, MessageSender } from '../../../../../webview/utils/MessageQueue';

// Mock logger
vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  messageLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    performance: vi.fn(),
    lifecycle: vi.fn(),
  },
}));

describe('MessageQueue', () => {
  let messageQueue: MessageQueue;
  let mockSender: MessageSender;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSender = vi.fn().mockResolvedValue(undefined);
    messageQueue = new MessageQueue(mockSender, {
      processingDelay: 10,
      maxRetries: 2,
      maxQueueSize: 5,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    messageQueue.dispose();
  });

  describe('enqueue', () => {
    it('should add message to queue', async () => {
      // Prevent processing
      (messageQueue as any).queueLock = true;
      
      await messageQueue.enqueue({ command: 'test' });
      const stats = messageQueue.getQueueStats();
      expect(stats.total).toBe(1);
      expect(stats.normal).toBe(1);
    });

    it('should respect priority override', async () => {
      (messageQueue as any).queueLock = true;
      
      await messageQueue.enqueue({ command: 'test' }, 'high');
      const stats = messageQueue.getQueueStats();
      expect(stats.highPriority).toBe(1);
    });

    it('should detect high priority messages automatically', async () => {
      (messageQueue as any).queueLock = true;
      
      await messageQueue.enqueue({ command: 'input', data: 'ls' });
      const stats = messageQueue.getQueueStats();
      expect(stats.highPriority).toBe(1);
    });

    it('should start processing automatically', async () => {
      // Allow processing but verify flag
      // enqueue is async and calls processQueue (async) without awaiting it
      // So we can check flag immediately? No, processQueue is async.
      
      // Mock sender to take time
      mockSender = vi.fn().mockImplementation(() => new Promise(r => setTimeout(r, 100)));
      messageQueue = new MessageQueue(mockSender);
      
      await messageQueue.enqueue({ command: 'test' });
      
      const stats = messageQueue.getQueueStats();
      expect(stats.isProcessing).toBe(true);
      
      // Finish
      await vi.runAllTimersAsync();
    });

    it('should respect max queue size', async () => {
      (messageQueue as any).queueLock = true;
      
      // Let's try with larger maxQueueSize
      messageQueue.dispose();
      messageQueue = new MessageQueue(mockSender, { maxQueueSize: 10 });
      (messageQueue as any).queueLock = true;
      
      for (let i = 0; i < 11; i++) {
        await messageQueue.enqueue({ command: 'test', id: i });
      }
      
      // 10 * 0.1 = 1. Should clear 1 message when adding 11th.
      // 10 items in queue -> add 11th -> trigger clear (1) -> 9 items -> add 11th -> 10 items.
      const stats = messageQueue.getQueueStats();
      expect(stats.total).toBe(10);
    });
  });

  describe('processing', () => {
    it('should process messages in order', async () => {
      const calls: number[] = [];
      mockSender = vi.fn().mockImplementation(async (msg: any) => {
        calls.push(msg.id);
      });
      messageQueue = new MessageQueue(mockSender);

      await messageQueue.enqueue({ id: 1 });
      await messageQueue.enqueue({ id: 2 });

      // Run pending promises
      await vi.runAllTimersAsync();

      expect(calls).toEqual([1, 2]);
    });

    it('should prioritize high priority messages', async () => {
      const calls: string[] = [];
      mockSender = vi.fn().mockImplementation(async (msg: any) => {
        calls.push(msg.type);
      });
      messageQueue = new MessageQueue(mockSender);

      // Stop auto processing for setup
      (messageQueue as any).queueLock = true;
      
      await messageQueue.enqueue({ type: 'normal1' });
      await messageQueue.enqueue({ type: 'high1' }, 'high');
      await messageQueue.enqueue({ type: 'normal2' });
      
      // Start processing
      (messageQueue as any).queueLock = false;
      (messageQueue as any).processQueue();
      
      await vi.runAllTimersAsync();
      
      // High priority should be processed before normal messages that were in queue
      expect(calls).toEqual(['high1', 'normal1', 'normal2']);
    });

    it('should retry failed messages', async () => {
      let attempts = 0;
      mockSender = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts <= 2) throw new Error('Fail');
      });
      messageQueue = new MessageQueue(mockSender, { maxRetries: 3 });

      await messageQueue.enqueue({ command: 'test' });
      
      // Since MessageQueue stops processing on failure, we need to trigger it again manually for retries
      // This confirms the "stop on failure" behavior but allows us to test the retry counter logic
      await vi.runAllTimersAsync(); // Attempt 1 -> Fail -> Break
      expect(attempts).toBe(1);
      
      (messageQueue as any).processQueue(); // Attempt 2 -> Fail -> Break
      await vi.runAllTimersAsync();
      expect(attempts).toBe(2);
      
      (messageQueue as any).processQueue(); // Attempt 3 -> Success
      await vi.runAllTimersAsync();
      expect(attempts).toBe(3);
    });

    it('should drop message after max retries', async () => {
      mockSender = vi.fn().mockRejectedValue(new Error('Fail'));
      messageQueue = new MessageQueue(mockSender, { maxRetries: 2 });

      await messageQueue.enqueue({ command: 'test' });
      
      // Attempt 1
      await vi.runAllTimersAsync();
      
      // Attempt 2
      (messageQueue as any).processQueue();
      await vi.runAllTimersAsync();
      
      // Attempt 3 (Max retries reached -> Drop)
      (messageQueue as any).processQueue();
      await vi.runAllTimersAsync();

      // Initial + 2 retries = 3 calls
      expect(mockSender).toHaveBeenCalledTimes(3);
      expect(messageQueue.isEmpty()).toBe(true);
    });
  });

  describe('flush', () => {
    it('should process all messages immediately', async () => {
      (messageQueue as any).queueLock = true; // Queue up
      await messageQueue.enqueue({ id: 1 });
      await messageQueue.enqueue({ id: 2 });
      (messageQueue as any).queueLock = false;
      
      expect(messageQueue.isEmpty()).toBe(false);
      
      await messageQueue.flush();
      
      expect(messageQueue.isEmpty()).toBe(true);
      expect(mockSender).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear', () => {
    it('should remove all messages', async () => {
      // Stop processing to accumulate messages
      (messageQueue as any).isProcessing = true;
      
      await messageQueue.enqueue({ id: 1 });
      await messageQueue.enqueue({ id: 2 });
      
      messageQueue.clear();
      
      expect(messageQueue.isEmpty()).toBe(true);
    });
  });
});
