/**
 * AI Agent切り替えボタンのテスト (Issue #122)
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { HeaderFactory } from '../../../webview/factories/HeaderFactory';
import { RefactoredMessageManager } from '../../../webview/managers/RefactoredMessageManager';
import { IManagerCoordinator } from '../../../webview/interfaces/ManagerInterfaces';

describe('AI Agent Toggle Button (Issue #122)', () => {
  let terminalManager: TerminalManager;
  let messageManager: RefactoredMessageManager;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    terminalManager = new TerminalManager();
    messageManager = new RefactoredMessageManager();

    mockCoordinator = {
      getActiveTerminalId: sinon.stub(),
      setActiveTerminalId: sinon.stub(),
      getTerminalInstance: sinon.stub(),
      getAllTerminalInstances: sinon.stub(),
      getAllTerminalContainers: sinon.stub(),
      getTerminalElement: sinon.stub(),
      postMessageToExtension: sinon.stub(),
      log: sinon.stub(),
      createTerminal: sinon.stub(),
      openSettings: sinon.stub(),
      applyFontSettings: sinon.stub(),
      closeTerminal: sinon.stub(),
      getManagers: sinon.stub(),
      getMessageManager: sinon.stub(),
      updateState: sinon.stub(),
      handleTerminalRemovedFromExtension: sinon.stub(),
      updateClaudeStatus: sinon.stub(),
      updateCliAgentStatus: sinon.stub(),
      ensureTerminalFocus: sinon.stub(),
      createTerminalFromSession: sinon.stub(),
    };
  });

  afterEach(() => {
    terminalManager.dispose();
    sinon.restore();
  });

  describe('TerminalManager.switchAiAgentConnection', () => {
    it('現在接続されているエージェントに対するクリックを無視する', () => {
      // Create terminal first
      const createdTerminalId = terminalManager.createTerminal();

      // Manually set connected agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (terminalManager as any)._connectedAgentTerminalId = createdTerminalId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (terminalManager as any)._connectedAgentType = 'claude';

      const result = terminalManager.switchAiAgentConnection(createdTerminalId);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.newStatus, 'connected');
      assert.strictEqual(result.agentType, 'claude');
      assert.strictEqual(terminalManager.getConnectedAgentTerminalId(), createdTerminalId);
    });

    it('存在しないターミナルIDに対してエラーを返す', () => {
      const result = terminalManager.switchAiAgentConnection('non-existent-terminal');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'Terminal not found');
      assert.strictEqual(result.newStatus, 'none');
    });

    it('AI Agentが検出されていないターミナルに対してエラーを返す', () => {
      const createdTerminalId = terminalManager.createTerminal();

      const result = terminalManager.switchAiAgentConnection(createdTerminalId);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'No AI Agent detected in this terminal');
      assert.strictEqual(result.newStatus, 'none');
    });

    it('切断されたエージェントを再接続できる', () => {
      // Create terminal
      const createdTerminalId = terminalManager.createTerminal();

      // Set up disconnected agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (terminalManager as any)._disconnectedAgents.set(createdTerminalId, {
        type: 'gemini',
        startTime: new Date(),
        terminalName: 'Terminal 1',
      });

      const result = terminalManager.switchAiAgentConnection(createdTerminalId);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.newStatus, 'connected');
      assert.strictEqual(result.agentType, 'gemini');
      assert.strictEqual(terminalManager.getConnectedAgentTerminalId(), createdTerminalId);
    });
  });

  describe('HeaderFactory AI Agent Toggle Button', () => {
    it('AI Agent切り替えボタンを含むヘッダーを作成する', () => {
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'test-terminal-1',
        terminalName: 'Terminal 1',
      });

      assert.ok(headerElements.aiAgentToggleButton);
      assert.strictEqual(
        headerElements.aiAgentToggleButton?.className,
        'terminal-control ai-agent-toggle-btn'
      );
      assert.ok(headerElements.aiAgentToggleButton?.innerHTML.includes('<svg'));
    });

    it('AI Agent切断時にボタンを表示する', () => {
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'test-terminal-1',
        terminalName: 'Terminal 1',
      });

      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'disconnected');

      assert.strictEqual(headerElements.aiAgentToggleButton?.style.display, 'flex');
      assert.strictEqual(headerElements.aiAgentToggleButton?.title, 'Connect AI Agent');
    });

    it('AI Agent未検出時にボタンを非表示にする', () => {
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'test-terminal-1',
        terminalName: 'Terminal 1',
      });

      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, false);

      assert.strictEqual(headerElements.aiAgentToggleButton?.style.display, 'none');
    });
  });

  describe('MessageManager.sendSwitchAiAgentMessage', () => {
    it('switchAiAgentメッセージを正しく送信する', () => {
      const terminalId = 'test-terminal-1';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queueMessageSpy = sinon.spy(messageManager as any, 'queueMessage');

      messageManager.sendSwitchAiAgentMessage(terminalId, mockCoordinator);

      assert.ok(queueMessageSpy.calledOnce);
      const call = queueMessageSpy.getCall(0);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const message = call.args[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.strictEqual(message.command, 'switchAiAgent');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.strictEqual(message.terminalId, terminalId);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.ok(typeof message.timestamp === 'number');
    });
  });

  describe('統合テスト', () => {
    it('AI Agent切り替えボタンクリック → Extension通信 → 状態更新のフロー', () => {
      // 1. Create terminal with AI Agent
      const terminalId = terminalManager.createTerminal();

      // 2. Set up disconnected agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (terminalManager as any)._connectedAgentTerminalId = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (terminalManager as any)._connectedAgentType = null;

      // 3. Create header with toggle button
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId,
        terminalName: 'Terminal 1',
      });

      // 4. Show toggle button (only when disconnected)
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'disconnected');
      assert.strictEqual(headerElements.aiAgentToggleButton?.style.display, 'flex');

      // 5. Simulate button click (extension side) - should connect
      const result = terminalManager.switchAiAgentConnection(terminalId);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.newStatus, 'connected'); // Status becomes connected

      // 6. Button should remain visible when connected (always visible specification)
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'connected');
      assert.strictEqual(headerElements.aiAgentToggleButton?.style.display, 'flex');
    });
  });
});
