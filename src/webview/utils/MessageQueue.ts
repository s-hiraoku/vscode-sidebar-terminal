/**
 * MessageQueue Utility
 *
 * Extracted from ConsolidatedMessageManager to provide centralized
 * message queuing with priority handling and race condition protection
 */

import { messageLogger } from './ManagerLogger';

export interface QueuedMessage {
  id: string;
  data: unknown;
  priority: 'high' | 'normal';
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface MessageQueueConfig {
  maxRetries?: number;
  processingDelay?: number;
  maxQueueSize?: number;
  enablePriority?: boolean;
}

export interface MessageSender {
  (message: unknown): void | Promise<void>;
}

interface Disposable {
  dispose(): void;
}

/**
 * Centralized message queue with priority handling and reliability features
 */
export class MessageQueue implements Disposable {
  private highPriorityQueue: QueuedMessage[] = [];
  private normalQueue: QueuedMessage[] = [];
  private queueLock = false;
  private isProcessing = false;
  private messageIdCounter = 0;
  private config: Required<MessageQueueConfig>;

  constructor(
    private sender: MessageSender,
    config: MessageQueueConfig = {}
  ) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      processingDelay: config.processingDelay ?? 1,
      maxQueueSize: config.maxQueueSize ?? 1000,
      enablePriority: config.enablePriority ?? true,
    };

    messageLogger.debug('MessageQueue initialized', this.config);
  }

  /**
   * Add message to queue with priority detection
   * @param message Message data to queue
   * @param priority Optional priority override
   */
  async enqueue(message: unknown, priority?: 'high' | 'normal'): Promise<void> {
    try {
      // Check queue size limits
      if (this.getTotalQueueSize() >= this.config.maxQueueSize) {
        messageLogger.warn(`Queue size limit reached (${this.config.maxQueueSize})`);
        this.clearOldestMessages(Math.floor(this.config.maxQueueSize * 0.1));
      }

      const detectedPriority = priority || this.detectMessagePriority(message);

      const queuedMessage: QueuedMessage = {
        id: this.generateMessageId(),
        data: message,
        priority: detectedPriority,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      };

      if (detectedPriority === 'high') {
        this.highPriorityQueue.push(queuedMessage);
        messageLogger.debug(
          `⚡ High priority message queued: ${queuedMessage.id} (hp queue: ${this.highPriorityQueue.length})`
        );
      } else {
        this.normalQueue.push(queuedMessage);
        messageLogger.debug(
          `📤 Normal message queued: ${queuedMessage.id} (normal queue: ${this.normalQueue.length})`
        );
      }

      // Start processing if not already running
      void this.processQueue();
    } catch (error) {
      messageLogger.error('Failed to enqueue message:', error);
    }
  }

  /**
   * Process queued messages with error handling and retry logic
   */
  private async processQueue(): Promise<void> {
    if (this.queueLock || this.isProcessing) {
      return;
    }

    if (this.highPriorityQueue.length === 0 && this.normalQueue.length === 0) {
      return;
    }

    this.queueLock = true;
    this.isProcessing = true;

    try {
      let processed = 0;
      const startTime = Date.now();

      // Process high-priority messages first
      while (this.highPriorityQueue.length > 0) {
        const message = this.highPriorityQueue.shift()!;
        const success = await this.sendMessage(message);

        if (!success) {
          if (message.retryCount < message.maxRetries) {
            message.retryCount++;
            this.highPriorityQueue.unshift(message);
            messageLogger.warn(
              `Retrying high priority message ${message.id} (attempt ${message.retryCount})`
            );
          } else {
            messageLogger.error(
              `High priority message ${message.id} failed after ${message.maxRetries} attempts`
            );
          }
          break;
        }
        processed++;
      }

      // Process normal priority messages with throttling
      while (this.normalQueue.length > 0) {
        const message = this.normalQueue.shift()!;
        const success = await this.sendMessage(message);

        if (!success) {
          if (message.retryCount < message.maxRetries) {
            message.retryCount++;
            this.normalQueue.unshift(message);
            messageLogger.warn(
              `Retrying normal message ${message.id} (attempt ${message.retryCount})`
            );
          } else {
            messageLogger.error(
              `Normal message ${message.id} failed after ${message.maxRetries} attempts`
            );
          }
          break;
        }

        processed++;

        // Add small delay between normal messages to prevent overwhelming
        if (this.config.processingDelay > 0) {
          await this.delay(this.config.processingDelay);
        }
      }

      if (processed > 0) {
        const duration = Date.now() - startTime;
        messageLogger.performance('Queue processing', duration, { processed });
      }
    } finally {
      this.isProcessing = false;
      this.queueLock = false;
    }
  }

  /**
   * Send individual message with error handling
   */
  private async sendMessage(queuedMessage: QueuedMessage): Promise<boolean> {
    try {
      await this.sender(queuedMessage.data);

      const age = Date.now() - queuedMessage.timestamp;
      messageLogger.debug(`✅ Message sent: ${queuedMessage.id} (age: ${age}ms)`);

      return true;
    } catch (error) {
      messageLogger.error(`Failed to send message ${queuedMessage.id}:`, error);
      return false;
    }
  }

  /**
   * Detect message priority based on content
   */
  private detectMessagePriority(message: unknown): 'high' | 'normal' {
    if (!this.config.enablePriority) {
      return 'normal';
    }

    try {
      const msgObj = message as { command?: string; type?: string };
      const messageType = msgObj?.command || msgObj?.type || 'unknown';

      // High priority message types (user input, interactions)
      const highPriorityTypes = [
        'input',
        'terminalInteraction',
        'keydown',
        'paste',
        'interrupt',
        'kill',
      ];

      return highPriorityTypes.includes(messageType) ? 'high' : 'normal';
    } catch {
      return 'normal';
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear oldest messages to free up queue space
   */
  private clearOldestMessages(count: number): void {
    let cleared = 0;

    // Clear from normal queue first
    while (cleared < count && this.normalQueue.length > 0) {
      const removed = this.normalQueue.shift();
      if (removed) {
        messageLogger.debug(`Cleared old message: ${removed.id}`);
        cleared++;
      }
    }

    // Clear from high priority if needed (less aggressive)
    while (cleared < count && this.highPriorityQueue.length > 10) {
      const removed = this.highPriorityQueue.shift();
      if (removed) {
        messageLogger.warn(`Cleared old high priority message: ${removed.id}`);
        cleared++;
      }
    }

    if (cleared > 0) {
      messageLogger.info(`Cleared ${cleared} old messages from queue`);
    }
  }

  // Public API methods

  /**
   * Get current queue sizes
   */
  getQueueStats(): {
    highPriority: number;
    normal: number;
    total: number;
    isProcessing: boolean;
  } {
    return {
      highPriority: this.highPriorityQueue.length,
      normal: this.normalQueue.length,
      total: this.getTotalQueueSize(),
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Get total queue size
   */
  private getTotalQueueSize(): number {
    return this.highPriorityQueue.length + this.normalQueue.length;
  }

  /**
   * Force flush all queues immediately
   */
  async flush(): Promise<void> {
    messageLogger.info('Flushing message queues...');

    // Temporarily disable processing delay for fast flush
    const originalDelay = this.config.processingDelay;
    this.config.processingDelay = 0;

    try {
      await this.processQueue();
    } finally {
      this.config.processingDelay = originalDelay;
    }
  }

  /**
   * Clear all queued messages
   */
  clear(): void {
    const totalCleared = this.getTotalQueueSize();

    this.highPriorityQueue = [];
    this.normalQueue = [];

    messageLogger.info(`Cleared ${totalCleared} messages from queues`);
  }

  /**
   * Check if queues are empty
   */
  isEmpty(): boolean {
    return this.getTotalQueueSize() === 0;
  }

  /**
   * Get pending messages (for debugging)
   */
  getPendingMessages(): {
    highPriority: QueuedMessage[];
    normal: QueuedMessage[];
  } {
    return {
      highPriority: [...this.highPriorityQueue],
      normal: [...this.normalQueue],
    };
  }

  /**
   * Update queue configuration
   */
  updateConfig(newConfig: Partial<MessageQueueConfig>): void {
    this.config = { ...this.config, ...newConfig };
    messageLogger.info('Queue configuration updated', newConfig);
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    this.clear();
    this.queueLock = false;
    this.isProcessing = false;

    messageLogger.lifecycle('MessageQueue', 'completed');
  }
}
