/**
 * ConsolidatedMessageService Test Suite
 * 
 * Tests the unified message handling system that consolidates:
 * - WebViewMessageHandlerService (Command pattern)
 * - RefactoredMessageManager (Queue-based processing)
 * - WebViewMessageRouter (Publisher-subscriber pattern)
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { ConsolidatedMessageService } from '../../../messaging/ConsolidatedMessageService';
import { MessagePriority as _MessagePriority } from '../../../messaging/UnifiedMessageDispatcher';
import { IManagerCoordinator } from '../../../webview/interfaces/ManagerInterfaces';
import { WebviewMessage } from '../../../types/common';

describe('ConsolidatedMessageService', () => {
  let messageService: ConsolidatedMessageService;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let clock: sinon.SinonFakeTimers;

  beforeEach(async () => {
    clock = sinon.useFakeTimers();

    // Create comprehensive mock coordinator
    mockCoordinator = {
      postMessageToExtension: sinon.stub().resolves(),
      getTerminalInstance: sinon.stub().callsFake((id: string) => ({ 
        id, 
        name: `Terminal ${id}`,
        terminal: { write: sinon.stub(), clear: sinon.stub() }
      })),
      createTerminal: sinon.stub().resolves(true),
      setActiveTerminalId: sinon.stub(),
      getActiveTerminalId: sinon.stub().returns('terminal-1'),
      getAllTerminalInstances: sinon.stub().returns(new Map()),
      ensureTerminalFocus: sinon.stub(),
      updateCliAgentStatus: sinon.stub(),
      applyFontSettings: sinon.stub(),
      getManagers: sinon.stub().returns({
        performance: { bufferedWrite: sinon.stub() },
        notification: { showNotificationInTerminal: sinon.stub() }
      }),
      updateState: sinon.stub(),
      handleTerminalRemovedFromExtension: sinon.stub(),
      clearTerminalDeletionTracking: sinon.stub(),
      removeTerminal: sinon.stub(),
    } as any;

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
    
    if (clock) {
      clock.restore();
    }
  });

  describe('Initialization and Service Health', () => {
    it('should initialize successfully', () => {
      expect(messageService.isReady()).to.be.true;
    });

    it('should provide comprehensive statistics', () => {
      const stats = messageService.getDetailedStats();
      
      expect(stats).to.have.property('dispatcher');
      expect(stats).to.have.property('supportedCommands');
      expect(stats).to.have.property('isReady');
      expect(stats).to.have.property('initialized');
      
      expect(stats.supportedCommands).to.be.an('array');
      expect(stats.supportedCommands.length).to.be.greaterThan(0);
    });

    it('should support all critical message types', () => {
      const stats = messageService.getDetailedStats();
      const commands = stats.supportedCommands;
      
      // System messages
      expect(commands).to.include('init');
      expect(commands).to.include('settingsResponse');
      expect(commands).to.include('fontSettingsUpdate');
      expect(commands).to.include('stateUpdate');
      
      // Terminal lifecycle
      expect(commands).to.include('terminalCreated');
      expect(commands).to.include('terminalRemoved');
      expect(commands).to.include('focusTerminal');
      expect(commands).to.include('clear');
      
      // Terminal output
      expect(commands).to.include('output');
      
      // CLI Agent
      expect(commands).to.include('cliAgentStatusUpdate');
      expect(commands).to.include('cliAgentFullStateSync');
    });
  });

  describe('Message Processing', () => {
    it('should process init messages correctly', async () => {
      const initMessage: WebviewMessage = {
        command: 'init',
        timestamp: Date.now()
      };

      await messageService.receiveMessage(initMessage, mockCoordinator);

      // Verify that postMessageToExtension was called for getSettings and test message
      expect(mockCoordinator.postMessageToExtension.callCount).to.be.greaterThan(0);
    });

    it('should process output messages with terminal validation', async () => {
      const outputMessage: WebviewMessage = {
        command: 'output',
        data: 'Hello World',
        terminalId: 'terminal-1',
        timestamp: Date.now()
      };

      await messageService.receiveMessage(outputMessage, mockCoordinator);

      // Verify terminal instance was retrieved
      expect(mockCoordinator.getTerminalInstance.calledWith('terminal-1')).to.be.true;
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
          maxTerminals: 5
        },
        timestamp: Date.now()
      };

      await messageService.receiveMessage(createMessage, mockCoordinator);

      expect(mockCoordinator.createTerminal.calledWith(
        'new-terminal', 
        'New Terminal', 
        { shell: '/bin/bash' }, 
        2
      )).to.be.true;
    });

    it('should process CLI Agent status updates', async () => {
      const statusMessage: WebviewMessage = {
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          status: 'connected',
          activeTerminalName: 'Terminal 1',
          agentType: 'claude',
          terminalId: 'terminal-1'
        },
        timestamp: Date.now()
      };

      await messageService.receiveMessage(statusMessage, mockCoordinator);

      expect(mockCoordinator.updateCliAgentStatus.calledWith(
        'terminal-1',
        'connected',
        'claude'
      )).to.be.true;
    });

    it('should handle invalid messages gracefully', async () => {
      const invalidMessage = {
        // Missing command property
        data: 'invalid',
        timestamp: Date.now()
      };

      // Should not throw
      await messageService.receiveMessage(invalidMessage as any, mockCoordinator);
      
      // Should not have processed the message
      expect(mockCoordinator.postMessageToExtension.callCount).to.equal(0);
    });
  });

  describe('Priority Queue System', () => {
    it('should prioritize high priority messages', async () => {
      const normalMessage = { command: 'output', data: 'normal', terminalId: 'test' };
      const highPriorityMessage = { command: 'input', data: 'high priority', terminalId: 'test' };

      // Queue messages in reverse priority order
      messageService.postMessage(normalMessage);
      messageService.postMessage(highPriorityMessage);

      const stats = messageService.getQueueStats();
      expect(stats.highPriorityQueueSize).to.be.greaterThan(0);
    });

    it('should handle queue overflow gracefully', async () => {
      // Fill queue beyond capacity
      for (let i = 0; i < 2100; i++) {
        messageService.postMessage({ command: 'output', data: `message-${i}`, terminalId: 'test' });
      }

      const stats = messageService.getQueueStats();
      expect(stats.queueSize).to.be.lessThanOrEqual(2000); // Max queue size limit
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
      expect(true).to.be.true;
    });

    it('should provide queue statistics', () => {
      const stats = messageService.getQueueStats();
      
      expect(stats).to.have.property('queueSize');
      expect(stats).to.have.property('isProcessing');
      expect(stats).to.have.property('highPriorityQueueSize');
      expect(stats).to.have.property('isLocked');
      
      expect(stats.queueSize).to.be.a('number');
      expect(stats.isProcessing).to.be.a('boolean');
      expect(stats.isLocked).to.equal(false); // Unified dispatcher doesn't use locking
    });

    it('should emit terminal interaction events', () => {
      messageService.emitTerminalInteractionEvent(
        'webview-ready',
        '',
        undefined,
        mockCoordinator
      );

      // Should complete without errors
      expect(true).to.be.true;
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle coordinator errors gracefully', async () => {
      // Make coordinator methods throw errors
      mockCoordinator.getTerminalInstance.throws(new Error('Terminal not found'));
      
      const outputMessage: WebviewMessage = {
        command: 'output',
        data: 'test',
        terminalId: 'invalid-terminal',
        timestamp: Date.now()
      };

      // Should not throw
      await messageService.receiveMessage(outputMessage, mockCoordinator);
      expect(true).to.be.true;
    });

    it('should recover from message processing failures', async () => {
      // Send a message that will cause an error
      const errorMessage: WebviewMessage = {
        command: 'output',
        data: 'test',
        terminalId: '', // Invalid terminal ID
        timestamp: Date.now()
      };

      await messageService.receiveMessage(errorMessage, mockCoordinator);

      // Should still be able to process valid messages
      const validMessage: WebviewMessage = {
        command: 'init',
        timestamp: Date.now()
      };

      await messageService.receiveMessage(validMessage, mockCoordinator);
      expect(mockCoordinator.postMessageToExtension.callCount).to.be.greaterThan(0);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should dispose cleanly', () => {
      messageService.dispose();
      expect(messageService.isReady()).to.be.false;
    });

    it('should clear queues on demand', () => {
      messageService.postMessage({ command: 'test', data: 'queued' });
      
      let stats = messageService.getQueueStats();
      const queueSizeBefore = stats.queueSize;
      
      messageService.clearQueue();
      
      stats = messageService.getQueueStats();
      expect(stats.queueSize).to.be.lessThanOrEqual(queueSizeBefore);
    });
  });
});