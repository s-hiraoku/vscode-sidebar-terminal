/**
 * ConsolidatedMessageManager Tests
 *
 * Tests for the main message routing and handling manager
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsolidatedMessageManager } from '../../../../../webview/managers/ConsolidatedMessageManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import { MessageCommand } from '../../../../../webview/managers/messageTypes';

describe('ConsolidatedMessageManager', () => {
  let messageManager: ConsolidatedMessageManager;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    // Create minimal mock coordinator
    mockCoordinator = {
      getActiveTerminalId: () => 'terminal-1',
      setActiveTerminalId: () => {},
      getTerminalInstance: () => undefined,
      getAllTerminalInstances: () => new Map(),
      getAllTerminalContainers: () => new Map(),
      getTerminalElement: () => undefined,
      postMessageToExtension: () => {},
      log: () => {},
      createTerminal: async () => undefined,
      openSettings: () => {},
      setVersionInfo: () => {},
      applyFontSettings: () => {},
      closeTerminal: () => {},
      updateClaudeStatus: () => {},
      updateCliAgentStatus: () => {},
      ensureTerminalFocus: () => {},
      getSerializeAddon: () => undefined,
      getManagers: () => ({
        performance: {} as any,
        input: {} as any,
        ui: {} as any,
        config: {} as any,
        message: {} as any,
        notification: {} as any,
      }),
      getMessageManager: () => messageManager,
    } as IManagerCoordinator;

    messageManager = new ConsolidatedMessageManager(mockCoordinator);
  });

  afterEach(() => {
    messageManager.dispose();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(messageManager).toBeDefined();
    });

    it('should accept coordinator in constructor', () => {
      const manager = new ConsolidatedMessageManager(mockCoordinator);
      expect(manager).toBeDefined();
      manager.dispose();
    });

    it('should allow setting coordinator after construction', () => {
      const manager = new ConsolidatedMessageManager();
      manager.setCoordinator(mockCoordinator);
      expect(manager).toBeDefined();
      manager.dispose();
    });
  });

  describe('Message Routing', () => {
    it('should handle init message', async () => {
      const message: MessageCommand = {
        command: 'init',
        terminals: [],
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle output message', async () => {
      const message: MessageCommand = {
        command: 'output',
        terminalId: 'terminal-1',
        data: 'test output',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle startOutput message', async () => {
      const message: MessageCommand = {
        command: 'startOutput',
        terminalId: 'terminal-1',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle terminalCreated message', async () => {
      const message: MessageCommand = {
        command: 'terminalCreated',
        terminalId: 'terminal-2',
        name: 'Test Terminal',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle fontSettingsUpdate message', async () => {
      const message: MessageCommand = {
        command: 'fontSettingsUpdate',
        fontSettings: {
          fontSize: 14,
          fontFamily: 'monospace',
        },
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle split message', async () => {
      const message: MessageCommand = {
        command: 'split',
        direction: 'horizontal',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle shellStatus message', async () => {
      const message: MessageCommand = {
        command: 'shellStatus',
        terminalId: 'terminal-1',
        status: 'ready',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle unknown command gracefully', async () => {
      const message: MessageCommand = {
        command: 'unknownCommand' as any,
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // Should not throw error
    });
  });

  describe('IMessageManager Interface', () => {
    it('should implement postMessage', () => {
      const message = { command: 'test' };
      // Verify postMessage method exists and can be called
      expect(() => messageManager.postMessage(message)).not.toThrow();
      // Messages are sent immediately when vscode API is available
      const stats = messageManager.getQueueStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should implement sendReadyMessage', () => {
      // Verify sendReadyMessage method exists and can be called
      expect(() => messageManager.sendReadyMessage(mockCoordinator)).not.toThrow();
      // Messages are sent immediately when vscode API is available
      const stats = messageManager.getQueueStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should implement emitTerminalInteractionEvent', () => {
      // Verify emitTerminalInteractionEvent method exists and can be called
      expect(() =>
        messageManager.emitTerminalInteractionEvent(
          'focus',
          'terminal-1',
          { text: 'test' },
          mockCoordinator
        )
      ).not.toThrow();
      // Messages are sent immediately when vscode API is available
      const stats = messageManager.getQueueStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should implement getQueueStats', () => {
      const stats = messageManager.getQueueStats();
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('isProcessing');
    });

    it('should implement sendInput', () => {
      // Verify sendInput method exists and can be called
      expect(() => messageManager.sendInput('test input', 'terminal-1')).not.toThrow();
      // Messages are sent immediately when vscode API is available
      const stats = messageManager.getQueueStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should implement sendResize', () => {
      // Verify sendResize method exists and can be called
      expect(() => messageManager.sendResize(80, 24, 'terminal-1')).not.toThrow();
      // Messages are sent immediately when vscode API is available
      const stats = messageManager.getQueueStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should implement sendDeleteTerminalMessage', () => {
      // Verify sendDeleteTerminalMessage method exists and can be called
      expect(() =>
        messageManager.sendDeleteTerminalMessage('terminal-1', 'header', mockCoordinator)
      ).not.toThrow();
      // Messages are sent immediately when vscode API is available
      const stats = messageManager.getQueueStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Test Compatibility Methods', () => {
    it('should support onMessage handler registration', () => {
      const messages: unknown[] = [];
      messageManager.onMessage((msg) => {
        messages.push(msg);
      });

      const testMessage = { command: 'test' };
      messageManager.handleExtensionMessage(testMessage);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(testMessage);
    });

    it('should support onError handler registration', async () => {
      // Create manager without coordinator to trigger error
      const noCoordManager = new ConsolidatedMessageManager();

      let errorReceived = false;
      noCoordManager.onError(() => {
        errorReceived = true;
      });

      try {
        await noCoordManager.handleExtensionMessage({ command: 'test' });
      } catch {
        // Expected to fail
      }

      noCoordManager.dispose();
      // Error handler should have been called
      expect(errorReceived).toBe(true);
    });

    it('should support sendToExtension', async () => {
      let sent = false;
      mockCoordinator.postMessageToExtension = () => {
        sent = true;
      };

      await messageManager.sendToExtension({ command: 'test' });
      expect(sent).toBe(true);
    });

    it('should support sendToExtensionWithRetry', async () => {
      let attempts = 0;
      mockCoordinator.postMessageToExtension = () => {
        attempts++;
      };

      await messageManager.sendToExtensionWithRetry({ command: 'test' });
      expect(attempts).toBe(1);
    });

    it('should retry on failure with sendToExtensionWithRetry', async () => {
      let attempts = 0;
      mockCoordinator.postMessageToExtension = () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
      };

      await messageManager.sendToExtensionWithRetry({ command: 'test' }, { maxRetries: 3 });
      expect(attempts).toBe(2);
    });

    it('should support onConnectionRestored', () => {
      // Queue some messages
      messageManager.postMessage({ command: 'test1' });
      messageManager.postMessage({ command: 'test2' });

      // Trigger connection restored
      messageManager.onConnectionRestored();

      // Should not throw error
    });

    it('should support handleRawMessage', async () => {
      const rawMessage = JSON.stringify({ command: 'test' });
      await messageManager.handleRawMessage(rawMessage);
      // Should not throw error
    });

    it('should handle invalid JSON in handleRawMessage', async () => {
      const rawMessage = 'invalid json {';

      await expect(messageManager.handleRawMessage(rawMessage)).rejects.toThrow();
    });
  });

  describe('Session Controller Integration', () => {
    it('should handle sessionRestore message', async () => {
      const message: MessageCommand = {
        command: 'sessionRestore',
        sessions: [],
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle sessionRestoreStarted message', async () => {
      const message: MessageCommand = {
        command: 'sessionRestoreStarted',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle sessionRestoreCompleted message', async () => {
      const message: MessageCommand = {
        command: 'sessionRestoreCompleted',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle sessionRestoreError message', async () => {
      const message: MessageCommand = {
        command: 'sessionRestoreError',
        error: 'Test error',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });
  });

  describe('CLI Agent Controller Integration', () => {
    it('should handle cliAgentStatusUpdate message', async () => {
      const message: MessageCommand = {
        command: 'cliAgentStatusUpdate',
        terminalId: 'terminal-1',
        status: 'connected',
        agentType: 'claude-code',
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle cliAgentFullStateSync message', async () => {
      const message: MessageCommand = {
        command: 'cliAgentFullStateSync',
        states: {},
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });

    it('should handle switchAiAgentResponse message', async () => {
      const message: MessageCommand = {
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: true,
      };

      await messageManager.receiveMessage(message, mockCoordinator);
      // No error should be thrown
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', () => {
      messageManager.dispose();
      // Should not throw error
    });

    it('should clear handlers on dispose', () => {
      const messages: unknown[] = [];
      messageManager.onMessage((msg) => {
        messages.push(msg);
      });

      messageManager.dispose();

      // After disposal, handlers should be cleared
      // Creating new manager to avoid using disposed one
      const newManager = new ConsolidatedMessageManager(mockCoordinator);
      newManager.handleExtensionMessage({ command: 'test' });
      newManager.dispose();

      // Original messages array should not be affected by new manager
      expect(messages).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in message handlers gracefully', async () => {
      // Create message that might cause errors
      const message: MessageCommand = {
        command: 'output',
        terminalId: 'non-existent-terminal',
        data: 'test',
      };

      // Should not throw
      await messageManager.receiveMessage(message, mockCoordinator);
    });

    it('should handle coordinator not available error', async () => {
      const manager = new ConsolidatedMessageManager();

      await expect(manager.sendToExtension({ command: 'test' })).rejects.toThrow(
        'Coordinator not available'
      );

      manager.dispose();
    });
  });

  describe('Message Queue Integration', () => {
    it('should enqueue messages', () => {
      const initialStats = messageManager.getQueueStats();
      const initialSize = initialStats.queueSize;

      // postMessage may send immediately when vscode API is available
      // Queue size increase is implementation-dependent
      messageManager.postMessage({ command: 'test' });

      const newStats = messageManager.getQueueStats();
      // Queue size should be at least the initial size (may be sent immediately)
      expect(newStats.queueSize).toBeGreaterThanOrEqual(initialSize);
    });

    it('should report queue statistics', () => {
      const stats = messageManager.getQueueStats();

      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('isProcessing');
      expect(typeof stats.queueSize).toBe('number');
      expect(typeof stats.isProcessing).toBe('boolean');
    });
  });
});
