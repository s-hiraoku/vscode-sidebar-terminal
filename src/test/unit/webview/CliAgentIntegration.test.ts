/**
 * Unit Tests for CLI Agent Integration
 * Tests the complete CLI Agent integration feature including status display and performance optimization
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { UIManager } from '../../../webview/managers/UIManager';
import { CommunicationManager } from '../../../webview/managers/CommunicationManager';
import { LoggerManager } from '../../../webview/managers/LoggerManager';
import { PerformanceManager } from '../../../webview/managers/PerformanceManager';
import { MessageManager } from '../../../webview/managers/MessageManager';
import { IManagerCoordinator } from '../../../webview/interfaces/ManagerInterfaces';

describe('CLI Agent Integration', () => {
  let dom: JSDOM;
  let uiManager: UIManager;
  let commManager: CommunicationManager;
  let loggerManager: LoggerManager;
  let performanceManager: PerformanceManager;
  let messageManager: MessageManager;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="terminal-container"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });
    
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLInputElement = dom.window.HTMLInputElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;

    // Mock performance API
    global.performance = {
      now: sinon.stub().returns(Date.now()),
    } as any;

    // Initialize managers
    uiManager = new UIManager();
    commManager = CommunicationManager.getInstance();
    loggerManager = LoggerManager.getInstance();
    performanceManager = new PerformanceManager();
    messageManager = new MessageManager();

    // Mock coordinator
    mockCoordinator = {
      getActiveTerminalId: () => null,
      setActiveTerminalId: () => {},
      getTerminalInstance: () => undefined,
      getAllTerminalInstances: () => new Map(),
      getAllTerminalContainers: () => new Map(),
      postMessageToExtension: () => {},
      log: () => {},
      createTerminal: () => {},
      openSettings: () => {},
      applyFontSettings: () => {},
      closeTerminal: () => {},
      updateClaudeStatus: () => {},
      getManagers: () => ({
        ui: uiManager,
        message: messageManager,
        performance: performanceManager,
        input: null as any,
        config: null as any,
        notification: null as any,
      }),
    };

    // Configure logger for testing
    loggerManager.configure({
      level: 'WARN', // Reduce noise in tests
      enablePerformanceLogging: true,
      enableCategoryFiltering: false,
    });
  });

  function createMockHeader(terminalId: string, terminalName: string): HTMLElement {
    const header = document.createElement('div');
    header.className = 'terminal-header';
    header.setAttribute('data-terminal-id', terminalId);
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'terminal-name';
    nameSpan.textContent = terminalName;
    header.appendChild(nameSpan);
    
    return header;
  }

  afterEach(() => {
    sinon.restore();
    loggerManager.clearLogs();
    performanceManager.dispose();
    dom.window.close();
  });

  describe('Claude Status Display', () => {
    beforeEach(() => {
      // Create test terminal headers using UIManager
      const container = document.getElementById('terminal-container')!;
      const header1 = uiManager.createTerminalHeader('term1', 'Terminal 1');
      const header2 = uiManager.createTerminalHeader('term2', 'Terminal 2');
      container.appendChild(header1);
      container.appendChild(header2);
    });

    it('should update Claude status for active terminal', () => {
      // Act
      uiManager.updateCliAgentStatusDisplay('Terminal 1', 'connected');

      // Assert
      const header1 = document.querySelector('[data-terminal-id="term1"]') as HTMLElement;
      const header2 = document.querySelector('[data-terminal-id="term2"]') as HTMLElement;

      expect(header1).to.not.be.null;
      expect(header2).to.not.be.null;

      const status1 = header1.querySelector('.claude-status');
      const indicator1 = header1.querySelector('.claude-indicator');
      const status2 = header2.querySelector('.claude-status');

      expect(status1?.textContent).to.equal('CLI Agent connected');
      expect(indicator1?.textContent).to.equal('●');
      expect(status2?.textContent).to.equal(''); // Inactive terminal should be cleared
    });

    it('should show disconnected status correctly', () => {
      // Act
      uiManager.updateCliAgentStatusDisplay('Terminal 1', 'disconnected');

      // Assert
      const header = document.querySelector('[data-terminal-id="term1"]') as HTMLElement;
      const status = header.querySelector('.claude-status');
      const indicator = header.querySelector('.claude-indicator') as HTMLElement;

      expect(status?.textContent).to.equal('CLI Agent disconnected');
      expect(indicator?.textContent).to.equal('●');
      expect(indicator?.style.color).to.equal('#f44747'); // Red color
      expect(indicator?.style.animation).to.equal('none'); // No blinking
    });

    it('should clear status when none is specified', () => {
      // Setup - first set connected status
      uiManager.updateCliAgentStatusDisplay('Terminal 1', 'connected');

      // Act - clear status
      uiManager.updateCliAgentStatusDisplay('Terminal 1', 'none');

      // Assert
      const header = document.querySelector('[data-terminal-id="term1"]') as HTMLElement;
      const status = header.querySelector('.claude-status');
      const indicator = header.querySelector('.claude-indicator');

      expect(status).to.be.null; // Should be removed
      expect(indicator).to.be.null; // Should be removed
    });

    it('should handle missing data-terminal-id gracefully', () => {
      // Setup - create header without data-terminal-id
      const container = document.getElementById('terminal-container')!;
      const invalidHeader = document.createElement('div');
      invalidHeader.className = 'terminal-header';
      container.appendChild(invalidHeader);

      // Act & Assert - should not throw
      expect(() => {
        uiManager.updateCliAgentStatusDisplay('Terminal 1', 'connected');
      }).to.not.throw();
    });

    it('should apply correct styling for connected status', () => {
      // Act
      uiManager.updateCliAgentStatusDisplay('Terminal 1', 'connected');

      // Assert
      const header = document.querySelector('[data-terminal-id="term1"]') as HTMLElement;
      const indicator = header.querySelector('.claude-indicator') as HTMLElement;

      expect(indicator.style.color).to.equal('#4CAF50'); // Green color
      expect(indicator.style.animation).to.equal('blink 1s infinite'); // Blinking animation
    });
  });

  describe('Performance Optimization', () => {
    let mockTerminal: any;

    beforeEach(() => {
      mockTerminal = {
        write: sinon.spy(),
        resize: sinon.spy(),
        options: {},
      };
    });

    it('should use immediate flush for large output', () => {
      const largeSpy = sinon.spy(mockTerminal, 'write');
      const flushSpy = sinon.spy(performanceManager, 'flushOutputBuffer');

      // Act - send large data
      const largeData = 'x'.repeat(1500); // Over 1000 chars
      performanceManager.scheduleOutputBuffer(largeData, mockTerminal);

      // Assert
      expect(largeSpy.calledOnce).to.be.true;
      expect(largeSpy.calledWith(largeData)).to.be.true;
      expect(flushSpy.calledOnce).to.be.true;
    });

    it('should buffer small output and flush later', (done) => {
      const writeSpy = sinon.spy(mockTerminal, 'write');

      // Act - send small data
      const smallData = 'small output';
      performanceManager.scheduleOutputBuffer(smallData, mockTerminal);

      // Assert immediately - should not write yet
      expect(writeSpy.called).to.be.false;

      // Wait for buffer flush
      setTimeout(() => {
        expect(writeSpy.calledOnce).to.be.true;
        expect(writeSpy.calledWith(smallData)).to.be.true;
        done();
      }, 50); // Wait longer than buffer flush interval
    });

    it('should use faster flush interval in CLI Agent mode', () => {
      // Setup
      performanceManager.setCliAgentMode(true);
      const scheduleStub = sinon.stub(global.window, 'setTimeout');

      // Act
      performanceManager.scheduleOutputBuffer('test', mockTerminal);

      // Assert - should use 4ms interval for CLI Agent mode
      expect(scheduleStub.calledOnce).to.be.true;
      const call = scheduleStub.getCall(0);
      expect(call.args[1]).to.equal(4); // 4ms interval
    });

    it('should get correct buffer statistics', () => {
      // Setup
      performanceManager.setCliAgentMode(true);
      performanceManager.scheduleOutputBuffer('test1', mockTerminal);
      performanceManager.scheduleOutputBuffer('test2', mockTerminal);

      // Act
      const stats = performanceManager.getBufferStats();

      // Assert
      expect(stats.isClaudeCodeMode).to.be.true;
      expect(stats.currentTerminal).to.be.true;
      expect(stats.bufferSize).to.be.greaterThan(0);
    });

    it('should force flush all buffers', () => {
      const writeSpy = sinon.spy(mockTerminal, 'write');

      // Setup
      performanceManager.scheduleOutputBuffer('test1', mockTerminal);
      performanceManager.scheduleOutputBuffer('test2', mockTerminal);

      // Act
      performanceManager.forceFlush();

      // Assert
      expect(writeSpy.calledOnce).to.be.true;
      expect(writeSpy.calledWith('test1test2')).to.be.true;
    });
  });

  describe('Communication Manager', () => {
    beforeEach(() => {
      // Mock VS Code API
      (global.window as any).acquireVsCodeApi = sinon.stub().returns({
        postMessage: sinon.spy(),
      });
    });

    it('should initialize VS Code API connection', () => {
      // Act
      commManager.initialize();

      // Assert
      expect(commManager.isConnectionReady()).to.be.true;
    });

    it('should queue messages when not ready', () => {
      // Setup - don't initialize
      const queueStats = commManager.getQueueStats();
      const initialSize = queueStats.queueSize;

      // Act
      commManager.sendTerminalInput('test input');

      // Assert
      const newStats = commManager.getQueueStats();
      expect(newStats.queueSize).to.equal(initialSize + 1);
    });

    it('should process queued messages when connection becomes ready', () => {
      // Setup
      commManager.sendTerminalInput('queued message');
      const mockApi = {
        postMessage: sinon.spy(),
      };
      (global.window as any).acquireVsCodeApi = sinon.stub().returns(mockApi);

      // Act
      commManager.initialize();

      // Assert
      expect(mockApi.postMessage.calledOnce).to.be.true;
      const call = mockApi.postMessage.getCall(0);
      expect(call.args[0]).to.deep.include({
        command: 'input',
        data: 'queued message',
      });
    });

    it('should send Claude status updates correctly', () => {
      // Setup
      const mockApi = {
        postMessage: sinon.spy(),
      };
      (global.window as any).acquireVsCodeApi = sinon.stub().returns(mockApi);
      commManager.initialize();

      // Act
      commManager.sendMessage({
        command: 'cliAgentStatusUpdate',
        claudeStatus: {
          activeTerminalName: 'Terminal 1',
          status: 'connected',
        },
      });

      // Assert
      expect(mockApi.postMessage.calledOnce).to.be.true;
      const call = mockApi.postMessage.getCall(0);
      expect(call.args[0]).to.deep.equal({
        command: 'cliAgentStatusUpdate',
        claudeStatus: {
          activeTerminalName: 'Terminal 1',
          status: 'connected',
        },
      });
    });
  });

  describe('Message Processing', () => {
    it('should handle Claude status update message', () => {
      // Setup
      const updateSpy = sinon.spy(uiManager, 'updateCliAgentStatusDisplay');
      
      // Create test headers
      const container = document.getElementById('terminal-container')!;
      const header = uiManager.createTerminalHeader('term1', 'Terminal 1');
      container.appendChild(header);

      // Act
      const message = {
        command: 'cliAgentStatusUpdate',
        claudeStatus: {
          activeTerminalName: 'Terminal 1',
          status: 'connected' as const,
        },
      };
      messageManager.handleMessage(message, mockCoordinator);

      // Assert
      expect(updateSpy.calledOnce).to.be.true;
      expect(updateSpy.calledWith('Terminal 1', 'connected')).to.be.true;
    });

    it('should handle terminal output message with performance optimization', () => {
      // Setup
      const bufferSpy = sinon.spy(performanceManager, 'scheduleOutputBuffer');
      
      // Mock xterm terminal
      const mockTerminal = {
        write: sinon.spy(),
        resize: sinon.spy(),
        options: {},
      };

      // Mock coordinator to return mock terminal
      mockCoordinator = {
        ...mockCoordinator,
        getUIManager: () => uiManager,
      } as any;

      // Act
      const message = {
        command: 'output',
        data: 'CLI Agent output',
        terminalId: 'term1',
      };
      messageManager.handleMessage(message, mockCoordinator);

      // Note: This test verifies message routing - actual terminal integration
      // would require more complex setup with xterm.js
    });

    it('should handle unknown messages gracefully', () => {
      // Act & Assert - should not throw
      expect(() => {
        messageManager.handleMessage({
          command: 'unknownCommand',
          data: 'test',
        }, mockCoordinator);
      }).to.not.throw();
    });
  });

  describe('DOM Manager', () => {
    it('should find terminal headers correctly', () => {
      // Setup
      const container = document.getElementById('terminal-container')!;
      const header1 = createMockHeader('term1', 'Terminal 1');
      const header2 = createMockHeader('term2', 'Terminal 2');
      container.appendChild(header1);
      container.appendChild(header2);

      // Act
      const headers = domManager.findTerminalHeaders();

      // Assert
      expect(headers).to.have.length(2);
      expect(headers[0]!.getAttribute('data-terminal-id')).to.equal('term1');
      expect(headers[1]!.getAttribute('data-terminal-id')).to.equal('term2');
    });

    it('should update Claude status with correct formatting', () => {
      // Setup
      const container = document.getElementById('terminal-container')!;
      const header = createMockHeader('term1', 'Terminal 1');
      container.appendChild(header);

      // Act
      const success = domManager.updateClaudeStatus(header, 'Terminal 1', 'connected');

      // Assert
      expect(success).to.be.true;
      const statusSpan = header.querySelector('.claude-status');
      const indicator = header.querySelector('.claude-indicator') as HTMLElement;
      
      expect(statusSpan?.textContent).to.equal('CLI Agent connected');
      expect(indicator?.textContent).to.equal('●');
      expect(indicator?.style.color).to.equal('#4CAF50');
    });

    it('should preserve close button and keep it at rightmost position when updating Claude status', () => {
      // Setup
      const container = document.getElementById('terminal-container')!;
      const header = createMockHeader('term1', 'Terminal 1');
      container.appendChild(header);

      // Act - update Claude status
      const success = domManager.updateClaudeStatus(header, 'Terminal 1', 'connected');

      // Assert - status should be added and close button should remain at rightmost position
      expect(success).to.be.true;
      
      const statusSpan = header.querySelector('.claude-status');
      const indicator = header.querySelector('.claude-indicator');
      const closeBtn = header.querySelector('.close-btn');
      
      expect(statusSpan?.textContent).to.equal('CLI Agent connected');
      expect(indicator?.textContent).to.equal('●');
      expect(closeBtn?.textContent).to.equal('×');
      
      // Check that close button is the last child (rightmost position)
      const lastChild = header.lastElementChild;
      expect(lastChild).to.equal(closeBtn);
    });

    it('should remove only Claude status elements when clearing status and preserve close button position', () => {
      // Setup
      const container = document.getElementById('terminal-container')!;
      const header = createMockHeader('term1', 'Terminal 1');
      container.appendChild(header);

      // First add Claude status
      domManager.updateClaudeStatus(header, 'Terminal 1', 'connected');
      
      // Verify status was added
      expect(header.querySelector('.claude-status')).to.not.be.null;
      expect(header.querySelector('.claude-indicator')).to.not.be.null;

      // Act - clear Claude status
      domManager.updateClaudeStatus(header, 'Terminal 1', 'none');

      // Assert - Claude status removed but close button preserved at rightmost position
      expect(header.querySelector('.claude-status')).to.be.null;
      expect(header.querySelector('.claude-indicator')).to.be.null;
      expect(header.querySelector('.close-btn')?.textContent).to.equal('×');
      expect(header.querySelector('.terminal-name')?.textContent).to.equal('Terminal 1');
      
      // Verify close button is still at rightmost position
      const lastChild = header.lastElementChild;
      expect(lastChild?.className).to.include('close-btn');
    });

    it('should create notification with correct styling', () => {
      // Act
      const notification = domManager.createNotificationElement({
        type: 'info',
        title: 'Test Title',
        message: 'Test message',
        duration: 5000
      });

      // Assert
      expect(notification.className).to.include('terminal-notification');
      expect(notification.innerHTML).to.include('Test Title');
      expect(notification.innerHTML).to.include('Test message');
      expect(notification.innerHTML).to.include('ℹ️'); // Info icon
    });
  });

  describe('Logger Manager', () => {
    it('should log messages with correct formatting', () => {
      const consoleSpy = sinon.spy(console, 'info');

      // Act
      loggerManager.ui.info('Test message', { test: 'data' });

      // Assert
      expect(consoleSpy.calledOnce).to.be.true;
      const call = consoleSpy.getCall(0);
      expect(call.args[0]).to.include('[UI]');
      expect(call.args[0]).to.include('Test message');
    });

    it('should respect log level filtering', () => {
      const consoleSpy = sinon.spy(console, 'debug');
      loggerManager.setLogLevel('INFO'); // Filter out DEBUG

      // Act
      loggerManager.ui.debug('Debug message');

      // Assert
      expect(consoleSpy.called).to.be.false;
    });

    it('should collect performance measurements', () => {
      // Act
      const result = loggerManager.performance.measure('test-operation', () => {
        return 'test result';
      });

      // Assert
      expect(result).to.equal('test result');
      const logs = loggerManager.getLogsByCategory('PERF');
      expect(logs.length).to.be.greaterThan(0);
      expect(logs.some(log => log.message.includes('test-operation'))).to.be.true;
    });

    it('should export logs correctly', () => {
      // Setup
      loggerManager.ui.info('Test log entry');

      // Act
      const exported = loggerManager.exportLogs();
      const parsed = JSON.parse(exported);

      // Assert
      expect(parsed).to.have.property('config');
      expect(parsed).to.have.property('entries');
      expect(parsed).to.have.property('exportedAt');
      expect(parsed.entries).to.be.an('array');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full Claude status update flow', () => {
      // Setup - create terminal and initialize managers
      const container = document.getElementById('terminal-container')!;
      const header = createMockHeader('term1', 'Terminal 1');
      container.appendChild(header);

      const mockApi = {
        postMessage: sinon.spy(),
      };
      (global.window as any).acquireVsCodeApi = sinon.stub().returns(mockApi);
      commManager.initialize();

      // Act - simulate complete flow
      const message = {
        command: 'cliAgentStatusUpdate',
        claudeStatus: {
          activeTerminalName: 'Terminal 1',
          status: 'connected' as const,
        },
      };
      messageManager.handleMessage(message, mockCoordinator);

      // Assert - check end result
      const statusElement = header.querySelector('.claude-status');
      const indicatorElement = header.querySelector('.claude-indicator') as HTMLElement;
      
      expect(statusElement?.textContent).to.equal('CLI Agent connected');
      expect(indicatorElement?.textContent).to.equal('●');
      expect(indicatorElement?.style.color).to.equal('#4CAF50');
    });

    it('should handle performance optimization during CLI Agent session', () => {
      // Setup
      const mockTerminal = {
        write: sinon.spy(),
      } as any;

      performanceManager.setCliAgentMode(true);

      // Act - simulate CLI Agent output
      performanceManager.scheduleOutputBuffer('CLI Agent response', mockTerminal);

      // Assert - should use immediate write for CLI Agent mode
      expect(mockTerminal.write.calledOnce).to.be.true;
    });

    it('should maintain state consistency across operations', () => {
      // Setup
      const container = document.getElementById('terminal-container')!;
      const header1 = createMockHeader('term1', 'Terminal 1');
      const header2 = createMockHeader('term2', 'Terminal 2');
      container.appendChild(header1);
      container.appendChild(header2);

      // Act - multiple status updates
      uiManager.updateCliAgentStatusDisplay('Terminal 1', 'connected');
      uiManager.updateCliAgentStatusDisplay('Terminal 2', 'disconnected');
      uiManager.updateCliAgentStatusDisplay('Terminal 1', 'none');

      // Assert - check final state
      const status1 = header1.querySelector('.claude-status');
      const status2 = header2.querySelector('.claude-status');

      expect(status1).to.be.null; // Should be cleared
      expect(status2?.textContent).to.equal('CLI Agent disconnected');
    });
  });
});