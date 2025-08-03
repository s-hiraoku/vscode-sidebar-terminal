/**
 * AI Agent切り替えボタンのテスト (Issue #122)
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { HeaderFactory, TerminalHeaderElements } from '../../../webview/factories/HeaderFactory';
import { MessageManager } from '../../../webview/managers/MessageManager';
import { IManagerCoordinator } from '../../../webview/interfaces/ManagerInterfaces';

// Mock DOM utilities
const mockDOMUtils = {
  createElement: vi.fn(),
  appendChildren: vi.fn(),
};

// Mock VS Code API
const mockVSCodeAPI = {
  postMessage: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
};

vi.mock('../../../webview/utils/DOMUtils', () => ({
  DOMUtils: mockDOMUtils,
}));

vi.mock('../../../utils/logger', () => ({
  terminal: vi.fn(),
  webview: vi.fn(),
  provider: vi.fn(),
}));

describe('AI Agent Toggle Button (Issue #122)', () => {
  let terminalManager: TerminalManager;
  let messageManager: MessageManager;
  let mockCoordinator: IManagerCoordinator;

  beforeAll(() => {
    // Setup DOM environment
    Object.defineProperty(global, 'document', {
      value: {
        createElement: vi.fn(() => ({
          style: {},
          addEventListener: vi.fn(),
          setAttribute: vi.fn(),
          hasAttribute: vi.fn(),
          querySelector: vi.fn(),
          textContent: '',
          offsetHeight: 100,
        })),
        getElementById: vi.fn(),
        querySelectorAll: vi.fn(() => []),
      },
    });

    Object.defineProperty(global, 'window', {
      value: {
        vscodeApi: mockVSCodeAPI,
      },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    terminalManager = new TerminalManager();
    messageManager = new MessageManager();
    
    mockCoordinator = {
      getActiveTerminalId: vi.fn(),
      getTerminalInstance: vi.fn(),
      postMessageToExtension: vi.fn(),
      createTerminal: vi.fn(),
      ensureTerminalFocus: vi.fn(),
      switchToTerminal: vi.fn(),
      closeTerminal: vi.fn(),
      updateSettings: vi.fn(),
      writeToTerminal: vi.fn(),
      resizeTerminal: vi.fn(),
      updateState: vi.fn(),
    };

    // Mock DOM element creation
    mockDOMUtils.createElement.mockImplementation((tag, styles, attributes) => ({
      tagName: tag.toUpperCase(),
      style: styles || {},
      ...attributes,
      addEventListener: vi.fn(),
      setAttribute: vi.fn(),
      hasAttribute: vi.fn(),
      textContent: attributes?.textContent || '',
      className: attributes?.className || '',
      dataset: { terminalId: attributes?.['data-terminal-id'] },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TerminalManager.switchAiAgentConnection', () => {
    it('現在接続されているエージェントを切断できる', () => {
      const terminalId = 'test-terminal-1';
      
      // Create terminal first
      const createdTerminalId = terminalManager.createTerminal();
      
      // Manually set connected agent
      (terminalManager as any)._connectedAgentTerminalId = createdTerminalId;
      (terminalManager as any)._connectedAgentType = 'claude';

      const result = terminalManager.switchAiAgentConnection(createdTerminalId);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('disconnected');
      expect(result.agentType).toBe('claude');
      expect(terminalManager.getConnectedAgentTerminalId()).toBe(null);
    });

    it('存在しないターミナルIDに対してエラーを返す', () => {
      const result = terminalManager.switchAiAgentConnection('non-existent-terminal');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Terminal not found');
      expect(result.newStatus).toBe('none');
    });

    it('AI Agentが検出されていないターミナルに対してエラーを返す', () => {
      const createdTerminalId = terminalManager.createTerminal();
      
      const result = terminalManager.switchAiAgentConnection(createdTerminalId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('No AI Agent detected in this terminal');
      expect(result.newStatus).toBe('none');
    });

    it('切断されたエージェントを再接続できる', () => {
      const terminalId = 'test-terminal-1';
      
      // Create terminal
      const createdTerminalId = terminalManager.createTerminal();
      
      // Set up disconnected agent
      (terminalManager as any)._disconnectedAgents.set(createdTerminalId, {
        type: 'gemini',
        startTime: new Date(),
        terminalName: 'Terminal 1',
      });

      const result = terminalManager.switchAiAgentConnection(createdTerminalId);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('connected');
      expect(result.agentType).toBe('gemini');
      expect(terminalManager.getConnectedAgentTerminalId()).toBe(createdTerminalId);
    });
  });

  describe('HeaderFactory AI Agent Toggle Button', () => {
    it('AI Agent切り替えボタンを含むヘッダーを作成する', () => {
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'test-terminal-1',
        terminalName: 'Terminal 1',
      });

      expect(headerElements.aiAgentToggleButton).toBeDefined();
      expect(headerElements.aiAgentToggleButton?.className).toBe('terminal-control ai-agent-toggle-btn');
      expect(headerElements.aiAgentToggleButton?.innerHTML).toContain('<svg');
    });

    it('AI Agent検出時にボタンを表示する', () => {
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'test-terminal-1',
        terminalName: 'Terminal 1',
      });

      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'connected');

      expect(headerElements.aiAgentToggleButton?.style.display).toBe('flex');
      expect(headerElements.aiAgentToggleButton?.style.color).toBe('#4CAF50');
      expect(headerElements.aiAgentToggleButton?.title).toBe('Disconnect AI Agent');
    });

    it('AI Agent未検出時にボタンを非表示にする', () => {
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'test-terminal-1',
        terminalName: 'Terminal 1',
      });

      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, false);

      expect(headerElements.aiAgentToggleButton?.style.display).toBe('none');
    });
  });

  describe('MessageManager.sendSwitchAiAgentMessage', () => {
    it('switchAiAgentメッセージを正しく送信する', () => {
      const terminalId = 'test-terminal-1';
      const queueMessageSpy = vi.spyOn(messageManager as any, 'queueMessage');

      messageManager.sendSwitchAiAgentMessage(terminalId, mockCoordinator);

      expect(queueMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'switchAiAgent',
          terminalId,
          timestamp: expect.any(Number),
        }),
        mockCoordinator
      );
    });
  });

  describe('統合テスト', () => {
    it('AI Agent切り替えボタンクリック → Extension通信 → 状態更新のフロー', async () => {
      // 1. Create terminal with AI Agent
      const terminalId = terminalManager.createTerminal();
      
      // 2. Set up connected agent
      (terminalManager as any)._connectedAgentTerminalId = terminalId;
      (terminalManager as any)._connectedAgentType = 'claude';

      // 3. Create header with toggle button
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId,
        terminalName: 'Terminal 1',
      });

      // 4. Show toggle button
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'connected');
      expect(headerElements.aiAgentToggleButton?.style.display).toBe('flex');

      // 5. Simulate button click (extension side)
      const result = terminalManager.switchAiAgentConnection(terminalId);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('disconnected');

      // 6. Update button appearance for disconnected state
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'disconnected');
      expect(headerElements.aiAgentToggleButton?.title).toBe('Connect AI Agent');
    });
  });
});