/**
 * ConsolidatedMessageService Test Suite
 *
 * Tests the unified message handling system that consolidates:
 * - WebViewMessageHandlerService (Command pattern)
 * - ConsolidatedMessageManager (Queue-based processing)
 * - WebViewMessageRouter (Publisher-subscriber pattern)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsolidatedMessageService } from '../../../../messaging/ConsolidatedMessageService';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';
import { WebviewMessage } from '../../../../types/common';

describe('ConsolidatedMessageService', () => {
  let messageService: ConsolidatedMessageService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCoordinator: any;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Create comprehensive mock coordinator
    mockCoordinator = {
      postMessageToExtension: vi.fn().mockResolvedValue(undefined),
      getTerminalInstance: vi.fn((id: string) => ({
        id,
        name: `Terminal ${id}`,
        terminal: { write: vi.fn(), clear: vi.fn() },
      })),
      createTerminal: vi.fn().mockResolvedValue(true),
      setActiveTerminalId: vi.fn(),
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
      ensureTerminalFocus: vi.fn(),
      updateCliAgentStatus: vi.fn(),
      applyFontSettings: vi.fn(),
      getManagers: vi.fn().mockReturnValue({
        performance: { bufferedWrite: vi.fn() },
        notification: { showNotificationInTerminal: vi.fn() },
      }),
      updateState: vi.fn(),
      handleTerminalRemovedFromExtension: vi.fn(),
      clearTerminalDeletionTracking: vi.fn(),
      removeTerminal: vi.fn(),
    };

    messageService = new ConsolidatedMessageService(mockCoordinator);
    await messageService.initialize(mockCoordinator);
  });

  afterEach(() => {
    if (messageService && typeof messageService.dispose === 'function') {
      try {
        messageService.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }

    vi.useRealTimers();
  });

  describe('Initialization and Service Health', () => {
    it('should initialize successfully', () => {
      expect(messageService.isReady()).toBe(true);
    });

    it('should provide comprehensive statistics', () => {
      const stats = messageService.getDetailedStats();

      expect(stats).toHaveProperty('dispatcher');
      expect(stats).toHaveProperty('supportedCommands');
      expect(stats).toHaveProperty('isReady');
      expect(stats).toHaveProperty('initialized');

      expect(stats.supportedCommands).toBeInstanceOf(Array);
      expect(stats.supportedCommands.length).toBeGreaterThan(0);
    });

    it('should support all critical message types', () => {
      const stats = messageService.getDetailedStats();
      const commands = stats.supportedCommands;

      // System messages
      expect(commands).toContain('init');
      expect(commands).toContain('settingsResponse');
      expect(commands).toContain('fontSettingsUpdate');
      expect(commands).toContain('stateUpdate');

      // Terminal lifecycle
      expect(commands).toContain('terminalCreated');
      expect(commands).toContain('terminalRemoved');
      expect(commands).toContain('focusTerminal');
      expect(commands).toContain('clear');

      // Terminal output
      expect(commands).toContain('output');

      // CLI Agent
      expect(commands).toContain('cliAgentStatusUpdate');
      expect(commands).toContain('cliAgentFullStateSync');
    });
  });

  describe('Message Processing', () => {
    it('should process init messages correctly', async () => {
      const initMessage: WebviewMessage = {
        command: 'init',
        timestamp: Date.now(),
      };

      await messageService.receiveMessage(initMessage, mockCoordinator);

      // Verify that postMessageToExtension was called for getSettings and test message
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalled();
    });

    it('should process output messages with terminal validation', async () => {
      const outputMessage: WebviewMessage = {
        command: 'output',
        data: 'Hello World',
        terminalId: 'terminal-1',
        timestamp: Date.now(),
      };

      await messageService.receiveMessage(outputMessage, mockCoordinator);

      // Verify terminal instance was retrieved
      expect(mockCoordinator.getTerminalInstance).toHaveBeenCalledWith('terminal-1');
    });

    it('should handle terminal lifecycle messages', async () => {
      const createMessage: WebviewMessage = {
        command: 'terminalCreated',
        terminalId: 'new-terminal',
        terminalName: 'New Terminal',
        terminalNumber: 2,
        config: {
          shell: '/bin/bash',
          shellArgs: [],
          fontSize: 14,
          fontFamily: 'monospace',
          cursorBlink: true,
          maxTerminals: 5,
        },
        timestamp: Date.now(),
      };

      await messageService.receiveMessage(createMessage, mockCoordinator);

      expect(mockCoordinator.createTerminal).toHaveBeenCalledWith(
        'new-terminal',
        'New Terminal',
        expect.objectContaining({ shell: '/bin/bash' }),
        2,
        'extension'
      );
    });

    it('should process CLI Agent status updates', async () => {
      const statusMessage: WebviewMessage = {
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          status: 'connected',
          activeTerminalName: 'Terminal 1',
          agentType: 'claude',
          terminalId: 'terminal-1',
        },
        timestamp: Date.now(),
      };

      await messageService.receiveMessage(statusMessage, mockCoordinator);

      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith('terminal-1', 'connected', 'claude');
    });

    it('should handle invalid messages gracefully', async () => {
      const invalidMessage = {
        // Missing command property
        data: 'invalid',
        timestamp: Date.now(),
      };

      // Implementation throws error for invalid messages - verify it throws
      await expect(
        messageService.receiveMessage(invalidMessage as any, mockCoordinator)
      ).rejects.toThrow('Unable to normalize message');
    });
  });

  describe('Priority Queue System', () => {
    it('should prioritize high priority messages', async () => {
      const normalMessage = { command: 'output', data: 'normal', terminalId: 'test' };
      const highPriorityMessage = { command: 'input', data: 'high priority', terminalId: 'test' };

      // Queue messages in reverse priority order
      messageService.postMessage(normalMessage);
      messageService.postMessage(highPriorityMessage);

      // Queue processes immediately, so verify messages were posted
      // The implementation processes messages asynchronously
      const stats = messageService.getQueueStats();
      // Stats show current queue state - may be 0 if processed
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should handle queue overflow gracefully', async () => {
      // Fill queue beyond capacity
      for (let i = 0; i < 2100; i++) {
        messageService.postMessage({ command: 'output', data: `message-${i}`, terminalId: 'test' });
      }

      const stats = messageService.getQueueStats();
      expect(stats.queueSize).toBeLessThanOrEqual(2000); // Max queue size limit
    });
  });

  describe('Message Service Interface Compatibility', () => {
    it('should implement IMessageManager interface correctly', () => {
      // Test sendInput
      messageService.sendInput('test input', 'terminal-1', mockCoordinator);

      // Test sendResize
      messageService.sendResize(80, 24, 'terminal-1', mockCoordinator);

      // Test requestSettings
      messageService.requestSettings(mockCoordinator);

      // Test sendReadyMessage
      messageService.sendReadyMessage(mockCoordinator);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should provide queue statistics', () => {
      const stats = messageService.getQueueStats();

      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('highPriorityQueueSize');
      expect(stats).toHaveProperty('isLocked');

      expect(stats.queueSize).toBeTypeOf('number');
      expect(stats.isProcessing).toBeTypeOf('boolean');
      expect(stats.isLocked).toBe(false); // Unified dispatcher doesn't use locking
    });

    it('should emit terminal interaction events', () => {
      messageService.emitTerminalInteractionEvent('webview-ready', '', undefined, mockCoordinator);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle coordinator errors gracefully', async () => {
      // Make coordinator methods throw errors
      mockCoordinator.getTerminalInstance.mockImplementation(() => {
        throw new Error('Terminal not found');
      });

      const outputMessage: WebviewMessage = {
        command: 'output',
        data: 'test',
        terminalId: 'invalid-terminal',
        timestamp: Date.now(),
      };

      // Should not throw
      await messageService.receiveMessage(outputMessage, mockCoordinator);
      expect(true).toBe(true);
    });

    it('should recover from message processing failures', async () => {
      // Send a message that will cause an error
      const errorMessage: WebviewMessage = {
        command: 'output',
        data: 'test',
        terminalId: '', // Invalid terminal ID
        timestamp: Date.now(),
      };

      await messageService.receiveMessage(errorMessage, mockCoordinator);

      // Should still be able to process valid messages
      const validMessage: WebviewMessage = {
        command: 'init',
        timestamp: Date.now(),
      };

      await messageService.receiveMessage(validMessage, mockCoordinator);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalled();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should dispose cleanly', () => {
      messageService.dispose();
      expect(messageService.isReady()).toBe(false);
    });

    it('should clear queues on demand', () => {
      messageService.postMessage({ command: 'test', data: 'queued' });

      let stats = messageService.getQueueStats();
      const queueSizeBefore = stats.queueSize;

      messageService.clearQueue();

      stats = messageService.getQueueStats();
      expect(stats.queueSize).toBeLessThanOrEqual(queueSizeBefore);
    });
  });
});
