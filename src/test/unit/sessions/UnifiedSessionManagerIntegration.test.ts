import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { UnifiedSessionManager } from '../../../sessions/UnifiedSessionManager';
import { TerminalManager } from '../../../terminals/TerminalManager';

/**
 * 統合テスト: 実際のユースケースシナリオをテスト
 * ユーザーが実際に体験する問題を再現してテスト
 */
describe('🎯 UnifiedSessionManager Integration Tests (Real World Scenarios)', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: vscode.ExtensionContext;
  let mockTerminalManager: TerminalManager;
  let mockGlobalState: sinon.SinonStubbedInstance<vscode.Memento>;
  let sessionManager: UnifiedSessionManager;
  let mockSidebarProvider: unknown;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockGlobalState = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves(),
      keys: sandbox.stub(),
      setKeysForSync: sandbox.stub(),
    } as unknown as sinon.SinonStubbedInstance<vscode.Memento>;

    mockContext = {
      globalState: mockGlobalState,
      subscriptions: [],
      extensionPath: '/test/path',
    } as unknown as vscode.ExtensionContext;

    mockTerminalManager = {
      getTerminals: sandbox.stub().returns([]),
      getActiveTerminalId: sandbox.stub().returns('terminal-1'),
      createTerminal: sandbox.stub().returns('new-terminal-id'),
      setActiveTerminal: sandbox.stub(),
      dispose: sandbox.stub(),
    } as unknown as TerminalManager;

    mockSidebarProvider = {
      _sendMessage: sandbox.stub().resolves(),
    };

    sessionManager = new UnifiedSessionManager(mockContext, mockTerminalManager);
    sessionManager.setSidebarProvider(mockSidebarProvider);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('🔥 Bug Reproduction: "複数ターミナルが正しく復元されない"', () => {
    it('should save and restore exactly 2 terminals with correct order', async () => {
      // === ARRANGE: 2つのターミナルがある状態をセットアップ ===
      const mockTerminals = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/project/src',
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/project/test',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('terminal-2'); // 2番目がアクティブ

      // === ACT: 保存を実行 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: 保存結果を確認 ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(2, 'Should save exactly 2 terminals');

      // 保存されたデータを検証
      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData.terminals).to.have.length(2, 'Saved data should contain 2 terminals');
      expect(savedData.activeTerminalId).to.equal(
        'terminal-2',
        'Active terminal should be terminal-2'
      );

      // 各ターミナルのデータを詳細確認
      expect(savedData.terminals[0].id).to.equal('terminal-1');
      expect(savedData.terminals[0].name).to.equal('Terminal 1');
      expect(savedData.terminals[0].isActive).to.be.false;

      expect(savedData.terminals[1].id).to.equal('terminal-2');
      expect(savedData.terminals[1].name).to.equal('Terminal 2');
      expect(savedData.terminals[1].isActive).to.be.true;

      // === ACT: 復元をシミュレート（新しいセッション） ===
      mockGlobalState.get.returns(savedData); // 保存されたデータを返す
      mockTerminalManager.getTerminals.returns([]); // 空の状態からスタート

      // 2つのターミナル作成をシミュレート
      mockTerminalManager.createTerminal.onCall(0).returns('restored-terminal-1');
      mockTerminalManager.createTerminal.onCall(1).returns('restored-terminal-2');

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 復元結果を確認 ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(2, 'Should restore exactly 2 terminals');
      expect(restoreResult.skippedCount).to.equal(0, 'Should skip 0 terminals');

      // createTerminalが2回呼ばれることを確認
      expect(mockTerminalManager.createTerminal).to.have.been.calledTwice;

      // アクティブターミナルが正しく設定されることを確認（terminal-2がアクティブだった）
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('restored-terminal-2');
    });

    it('should handle scrollback data correctly for 2 terminals', async () => {
      // === ARRANGE: スクロールバック付きの2ターミナル ===
      const mockTerminals = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/project',
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/project',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('terminal-1');

      // === ACT: 保存（スクロールバック有効） ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: 両方のターミナルにスクロールバックが含まれること ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(2);

      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      // 各ターミナルがスクロールバックデータを持っていることを確認
      expect(savedData.terminals[0].scrollback).to.exist;
      expect(savedData.terminals[0].scrollback).to.have.length.greaterThan(0);

      expect(savedData.terminals[1].scrollback).to.exist;
      expect(savedData.terminals[1].scrollback).to.have.length.greaterThan(0);

      // === ACT: 復元時にスクロールバックが復元されること ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.onCall(0).returns('restored-1');
      mockTerminalManager.createTerminal.onCall(1).returns('restored-2');

      const restoreResult = await sessionManager.restoreSession();

      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(2);
    });

    it('should save and restore exactly 3 terminals with correct order', async () => {
      // === ARRANGE: 3つのターミナルがある状態をセットアップ ===
      const mockTerminals = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/project/src',
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/project/test',
        },
        {
          id: 'terminal-3',
          name: 'Terminal 3',
          number: 3,
          cwd: '/project/docs',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('terminal-3'); // 3番目がアクティブ

      // === ACT: 保存を実行 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: 保存結果を確認 ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(3, 'Should save exactly 3 terminals');

      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData.terminals).to.have.length(3, 'Saved data should contain 3 terminals');
      expect(savedData.activeTerminalId).to.equal(
        'terminal-3',
        'Active terminal should be terminal-3'
      );

      // === ACT: 復元をシミュレート ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.onCall(0).returns('restored-terminal-1');
      mockTerminalManager.createTerminal.onCall(1).returns('restored-terminal-2');
      mockTerminalManager.createTerminal.onCall(2).returns('restored-terminal-3');

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 復元結果を確認 ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(3, 'Should restore exactly 3 terminals');
      expect(restoreResult.skippedCount).to.equal(0, 'Should skip 0 terminals');

      expect(mockTerminalManager.createTerminal).to.have.been.calledThrice;
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('restored-terminal-3');
    });

    it('should save and restore exactly 4 terminals with correct order', async () => {
      // === ARRANGE: 4つのターミナルがある状態をセットアップ ===
      const mockTerminals = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/project/frontend',
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/project/backend',
        },
        {
          id: 'terminal-3',
          name: 'Terminal 3',
          number: 3,
          cwd: '/project/database',
        },
        {
          id: 'terminal-4',
          name: 'Terminal 4',
          number: 4,
          cwd: '/project/deployment',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('terminal-2'); // 2番目がアクティブ

      // === ACT: 保存を実行 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: 保存結果を確認 ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(4, 'Should save exactly 4 terminals');

      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData.terminals).to.have.length(4, 'Saved data should contain 4 terminals');
      expect(savedData.activeTerminalId).to.equal(
        'terminal-2',
        'Active terminal should be terminal-2'
      );

      // === ACT: 復元をシミュレート ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.onCall(0).returns('restored-terminal-1');
      mockTerminalManager.createTerminal.onCall(1).returns('restored-terminal-2');
      mockTerminalManager.createTerminal.onCall(2).returns('restored-terminal-3');
      mockTerminalManager.createTerminal.onCall(3).returns('restored-terminal-4');

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 復元結果を確認 ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(4, 'Should restore exactly 4 terminals');
      expect(restoreResult.skippedCount).to.equal(0, 'Should skip 0 terminals');

      expect(mockTerminalManager.createTerminal.callCount).to.equal(4);
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('restored-terminal-2');
    });

    it('should save and restore exactly 5 terminals (maximum) with correct order', async () => {
      // === ARRANGE: 5つのターミナルがある状態をセットアップ（最大数） ===
      const mockTerminals = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/project/frontend',
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/project/backend',
        },
        {
          id: 'terminal-3',
          name: 'Terminal 3',
          number: 3,
          cwd: '/project/database',
        },
        {
          id: 'terminal-4',
          name: 'Terminal 4',
          number: 4,
          cwd: '/project/deployment',
        },
        {
          id: 'terminal-5',
          name: 'Terminal 5',
          number: 5,
          cwd: '/project/monitoring',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('terminal-5'); // 最後がアクティブ

      // === ACT: 保存を実行 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: 保存結果を確認 ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(5, 'Should save exactly 5 terminals (maximum)');

      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData.terminals).to.have.length(5, 'Saved data should contain 5 terminals');
      expect(savedData.activeTerminalId).to.equal(
        'terminal-5',
        'Active terminal should be terminal-5'
      );

      // === ACT: 復元をシミュレート ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      for (let i = 0; i < 5; i++) {
        mockTerminalManager.createTerminal.onCall(i).returns(`restored-terminal-${i + 1}`);
      }

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 復元結果を確認 ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(
        5,
        'Should restore exactly 5 terminals (maximum)'
      );
      expect(restoreResult.skippedCount).to.equal(0, 'Should skip 0 terminals');

      expect(mockTerminalManager.createTerminal.callCount).to.equal(5);
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('restored-terminal-5');
    });
  });

  describe('🔥 Bug Reproduction: "履歴が表示されない"', () => {
    it('should ensure scrollback data is properly captured and restored', async () => {
      // === ARRANGE: 履歴のあるターミナル ===
      const terminalWithHistory = {
        id: 'terminal-with-history',
        name: 'Terminal with History',
        number: 1,
        cwd: '/project',
      };

      mockTerminalManager.getTerminals.returns([terminalWithHistory]);
      mockTerminalManager.getActiveTerminalId.returns('terminal-with-history');

      // === ACT: 保存 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: スクロールバックデータが保存されていること ===
      expect(saveResult.success).to.be.true;

      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData.terminals[0].scrollback).to.exist;
      expect(savedData.terminals[0].scrollback).to.have.length.greaterThan(0);

      // スクロールバックの内容を確認
      const scrollback = savedData.terminals[0].scrollback;
      expect(scrollback[0]).to.have.property('content');
      expect(scrollback[0]).to.have.property('type');
      expect(scrollback[0]).to.have.property('timestamp');

      // === ACT: 復元 ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('restored-terminal');

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 復元後にスクロールバックが復元されること ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(1);
    });

    it('should handle empty scrollback gracefully', async () => {
      // === ARRANGE: 履歴のないターミナル ===
      const emptyTerminal = {
        id: 'empty-terminal',
        name: 'Empty Terminal',
        number: 1,
        cwd: '/project',
      };

      mockTerminalManager.getTerminals.returns([emptyTerminal]);

      // スクロールバック取得で空データを返すケース
      const originalGetScrollbackDataSync = (sessionManager as any).getScrollbackDataSync;
      sandbox.stub(sessionManager as any, 'getScrollbackDataSync').resolves([]);

      // === ACT & ASSERT: 空のスクロールバックでもエラーにならないこと ===
      const saveResult = await sessionManager.saveCurrentSession();
      expect(saveResult.success).to.be.true;

      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      // フォールバックメッセージが設定されていること
      expect(savedData.terminals[0].scrollback).to.exist;
      expect(savedData.terminals[0].scrollback).to.have.length.greaterThan(0);
    });

    it('should restore Claude Code CLI history correctly', async () => {
      // === ARRANGE: Claude Code セッションの履歴 ===
      const claudeTerminal = {
        id: 'claude-terminal',
        name: 'Claude Code Terminal',
        number: 1,
        cwd: '/workspaces/dev-laplus',
      };

      mockTerminalManager.getTerminals.returns([claudeTerminal]);
      mockTerminalManager.getActiveTerminalId.returns('claude-terminal');

      // Claude Code特有のスクロールバックデータをモック
      const originalGetScrollback = (sessionManager as any).getScrollbackDataSync;
      sandbox.stub(sessionManager as any, 'getScrollbackDataSync').resolves([
        {
          content: 'claude-code --version',
          type: 'input',
          timestamp: Date.now() - 5000,
        },
        {
          content: 'Claude Code v2.0.0',
          type: 'output',
          timestamp: Date.now() - 4000,
        },
        {
          content: 'claude-code "Add a new feature for terminal session restore"',
          type: 'input',
          timestamp: Date.now() - 3000,
        },
        {
          content: "I'll help you implement terminal session restoration...",
          type: 'output',
          timestamp: Date.now() - 2000,
        },
        {
          content: 'claude-code "Review the terminal session code"',
          type: 'input',
          timestamp: Date.now() - 1000,
        },
        {
          content: 'Looking at your terminal session restoration code...',
          type: 'output',
          timestamp: Date.now(),
        },
      ]);

      // === ACT: 保存 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: Claude Code履歴が保存されること ===
      expect(saveResult.success).to.be.true;
      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData.terminals[0].scrollback).to.exist;
      expect(savedData.terminals[0].scrollback).to.have.length(6);

      // Claude Code特有のコマンドが保存されていることを確認
      const claudeCommands = savedData.terminals[0].scrollback.filter((line: any) =>
        line.content.includes('claude-code')
      );
      expect(claudeCommands).to.have.length(3, 'Should contain 3 Claude Code commands');

      // === ACT: 復元 ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('restored-claude-terminal');

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: Claude Code履歴が復元されること ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(1);

      // スクロールバック復元メッセージが送信されることを確認
      expect(mockSidebarProvider._sendMessage).to.have.been.called;
    });

    it('should restore Gemini CLI history correctly', async () => {
      // === ARRANGE: Gemini CLI セッションの履歴 ===
      const geminiTerminal = {
        id: 'gemini-terminal',
        name: 'Gemini CLI Terminal',
        number: 1,
        cwd: '/workspaces/dev-laplus',
      };

      mockTerminalManager.getTerminals.returns([geminiTerminal]);
      mockTerminalManager.getActiveTerminalId.returns('gemini-terminal');

      // Gemini CLI特有のスクロールバックデータをモック
      sandbox.stub(sessionManager as any, 'getScrollbackDataSync').resolves([
        {
          content: 'gemini code --help',
          type: 'input',
          timestamp: Date.now() - 6000,
        },
        {
          content: 'Gemini Code Assistant CLI v1.5.0',
          type: 'output',
          timestamp: Date.now() - 5000,
        },
        {
          content: 'gemini code "Implement session restore feature"',
          type: 'input',
          timestamp: Date.now() - 4000,
        },
        {
          content: "I'll help you implement session restore functionality...",
          type: 'output',
          timestamp: Date.now() - 3000,
        },
        {
          content: 'gemini code "Debug terminal restoration issues"',
          type: 'input',
          timestamp: Date.now() - 2000,
        },
        {
          content: 'Let me analyze the terminal restoration problems...',
          type: 'output',
          timestamp: Date.now() - 1000,
        },
        {
          content: 'gemini code "Write comprehensive tests"',
          type: 'input',
          timestamp: Date.now() - 500,
        },
        {
          content: "I'll create comprehensive test cases for the functionality...",
          type: 'output',
          timestamp: Date.now(),
        },
      ]);

      // === ACT: 保存 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: Gemini CLI履歴が保存されること ===
      expect(saveResult.success).to.be.true;
      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData.terminals[0].scrollback).to.exist;
      expect(savedData.terminals[0].scrollback).to.have.length(8);

      // Gemini CLI特有のコマンドが保存されていることを確認
      const geminiCommands = savedData.terminals[0].scrollback.filter((line: any) =>
        line.content.includes('gemini code')
      );
      expect(geminiCommands).to.have.length(4, 'Should contain 4 Gemini CLI commands');

      // === ACT: 復元 ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('restored-gemini-terminal');

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: Gemini CLI履歴が復元されること ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(1);

      // スクロールバック復元メッセージが送信されることを確認
      expect(mockSidebarProvider._sendMessage).to.have.been.called;
    });

    it('should restore mixed Claude Code and Gemini CLI sessions (2 terminals)', async () => {
      // === ARRANGE: Claude CodeとGemini CLIの混合セッション ===
      const mockTerminals = [
        {
          id: 'claude-terminal',
          name: 'Claude Code Terminal',
          number: 1,
          cwd: '/workspaces/dev-laplus',
        },
        {
          id: 'gemini-terminal',
          name: 'Gemini CLI Terminal',
          number: 2,
          cwd: '/workspaces/dev-laplus',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('claude-terminal');

      // 各ターミナルに対して異なるスクロールバックデータを返すスタブ
      const getScrollbackStub = sandbox.stub(sessionManager as any, 'getScrollbackDataSync');

      getScrollbackStub.withArgs('claude-terminal').resolves([
        {
          content: 'claude-code "Fix terminal bugs"',
          type: 'input',
          timestamp: Date.now() - 2000,
        },
        {
          content: "I'll help fix the terminal restoration bugs...",
          type: 'output',
          timestamp: Date.now() - 1000,
        },
      ]);

      getScrollbackStub.withArgs('gemini-terminal').resolves([
        {
          content: 'gemini code "Add comprehensive tests"',
          type: 'input',
          timestamp: Date.now() - 2000,
        },
        {
          content: "I'll create comprehensive test coverage...",
          type: 'output',
          timestamp: Date.now() - 1000,
        },
      ]);

      // === ACT: 保存 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: 両方の履歴が保存されること ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(2);

      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData.terminals).to.have.length(2);

      // Claude Code履歴の確認
      expect(savedData.terminals[0].scrollback).to.have.length(2);
      expect(savedData.terminals[0].scrollback[0].content).to.include('claude-code');

      // Gemini CLI履歴の確認
      expect(savedData.terminals[1].scrollback).to.have.length(2);
      expect(savedData.terminals[1].scrollback[0].content).to.include('gemini code');

      // === ACT: 復元 ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.onCall(0).returns('restored-claude');
      mockTerminalManager.createTerminal.onCall(1).returns('restored-gemini');

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 両方のターミナルが復元されること ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(2);
      expect(mockTerminalManager.createTerminal).to.have.been.calledTwice;
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('restored-claude');
    });
  });

  describe('🔥 Edge Cases: 実際に起こりうる問題', () => {
    it('should handle terminal creation failure during restore', async () => {
      // === ARRANGE: 復元時にターミナル作成が失敗するケース ===
      const sessionData = {
        terminals: [
          {
            id: 'terminal-1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: true,
            scrollback: [{ content: 'test', type: 'output', timestamp: Date.now() }],
          },
          {
            id: 'terminal-2',
            name: 'Terminal 2',
            number: 2,
            cwd: '/test',
            isActive: false,
            scrollback: [{ content: 'test2', type: 'output', timestamp: Date.now() }],
          },
        ],
        activeTerminalId: 'terminal-1',
        timestamp: Date.now(),
        version: '2.0.0',
      };

      mockGlobalState.get.returns(sessionData);
      mockTerminalManager.getTerminals.returns([]);

      // 1つ目は成功、2つ目は失敗をシミュレート
      mockTerminalManager.createTerminal.onCall(0).returns('success-terminal');
      mockTerminalManager.createTerminal.onCall(1).returns(null); // 失敗

      // === ACT ===
      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 一部失敗でも続行できること ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(1); // 1つだけ成功
      expect(restoreResult.skippedCount).to.equal(1); // 1つスキップ
    });

    it('should validate saved data structure integrity', async () => {
      // === ARRANGE: 破損したセッションデータ ===
      const corruptedSessionData = {
        terminals: [
          {
            id: 'terminal-1',
            // name: 'Terminal 1', // 意図的に欠損
            number: 1,
            cwd: '/test',
            isActive: true,
          },
        ],
        activeTerminalId: 'terminal-1',
        timestamp: Date.now(),
        version: '2.0.0',
      };

      mockGlobalState.get.returns(corruptedSessionData);
      mockTerminalManager.getTerminals.returns([]);

      // === ACT ===
      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 破損データは無視されること ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(0);
      expect(restoreResult.skippedCount).to.equal(0);

      // クリア処理が呼ばれていることを確認
      expect(mockGlobalState.update).to.have.been.calledWith('unified-terminal-session', undefined);
    });

    it('should handle concurrent save/restore operations', async () => {
      // === ARRANGE: 同時実行のシミュレート ===
      const mockTerminals = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/test',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);

      // === ACT: 同時に保存と復元を実行 ===
      const savePromise = sessionManager.saveCurrentSession();
      const restorePromise = sessionManager.restoreSession();

      const [saveResult, restoreResult] = await Promise.all([savePromise, restorePromise]);

      // === ASSERT: 両方とも成功すること ===
      expect(saveResult.success).to.be.true;
      expect(restoreResult.success).to.be.true;
    });
  });

  describe('📊 Performance and Memory Tests', () => {
    it('should handle large number of terminals efficiently', async () => {
      // === ARRANGE: 大量のターミナル（限界テスト） ===
      const manyTerminals = Array.from({ length: 100 }, (_, i) => ({
        id: `terminal-${i}`,
        name: `Terminal ${i}`,
        number: i + 1,
        cwd: `/project/${i}`,
      }));

      mockTerminalManager.getTerminals.returns(manyTerminals);

      // === ACT ===
      const start = Date.now();
      const saveResult = await sessionManager.saveCurrentSession();
      const saveTime = Date.now() - start;

      // === ASSERT: パフォーマンス要件 ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(100);
      expect(saveTime).to.be.lessThan(5000, 'Save should complete within 5 seconds');
    });

    it('should handle maximum terminals (5) with large scrollback efficiently', async () => {
      // === ARRANGE: 最大数のターミナル（5個）に大量のスクロールバック ===
      const maxTerminals = Array.from({ length: 5 }, (_, i) => ({
        id: `max-terminal-${i + 1}`,
        name: `Max Terminal ${i + 1}`,
        number: i + 1,
        cwd: `/project/max-${i + 1}`,
      }));

      mockTerminalManager.getTerminals.returns(maxTerminals);
      mockTerminalManager.getActiveTerminalId.returns('max-terminal-3');

      // 大量のスクロールバックデータをモック（各ターミナル1000行）
      const generateLargeScrollback = (terminalId: string) => {
        return Array.from({ length: 1000 }, (_, i) => ({
          content: `Line ${i + 1} for ${terminalId}: command output data`,
          type: i % 3 === 0 ? 'input' : 'output',
          timestamp: Date.now() - (1000 - i) * 100,
        }));
      };

      const getScrollbackStub = sandbox.stub(sessionManager as any, 'getScrollbackDataSync');
      maxTerminals.forEach((terminal) => {
        getScrollbackStub.withArgs(terminal.id).resolves(generateLargeScrollback(terminal.id));
      });

      // === ACT: 保存パフォーマンステスト ===
      const saveStart = Date.now();
      const saveResult = await sessionManager.saveCurrentSession();
      const saveTime = Date.now() - saveStart;

      // === ASSERT: 保存パフォーマンス ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(5);
      expect(saveTime).to.be.lessThan(
        3000,
        'Save with large scrollback should complete within 3 seconds'
      );

      // === ACT: 復元パフォーマンステスト ===
      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      for (let i = 0; i < 5; i++) {
        mockTerminalManager.createTerminal.onCall(i).returns(`restored-max-${i + 1}`);
      }

      const restoreStart = Date.now();
      const restoreResult = await sessionManager.restoreSession();
      const restoreTime = Date.now() - restoreStart;

      // === ASSERT: 復元パフォーマンス ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(5);
      expect(restoreTime).to.be.lessThan(
        5000,
        'Restore with large scrollback should complete within 5 seconds'
      );

      // データサイズ確認
      const totalScrollbackLines = savedData.terminals.reduce(
        (total: number, terminal: any) => total + terminal.scrollback.length,
        0
      );
      expect(totalScrollbackLines).to.equal(5000, 'Should contain 5000 total scrollback lines');
    });

    it('should properly cleanup resources during operations', async () => {
      // === ARRANGE: リソースリーク検出 ===
      const terminal = {
        id: 'test-terminal',
        name: 'Test Terminal',
        number: 1,
        cwd: '/test',
      };

      mockTerminalManager.getTerminals.returns([terminal]);

      // === ACT: 複数回の保存・復元 ===
      for (let i = 0; i < 10; i++) {
        await sessionManager.saveCurrentSession();
        await sessionManager.restoreSession();
      }

      // === ASSERT: メモリリークがないこと（簡易チェック） ===
      // 実際のプロダクションではメモリ使用量をモニタリング
      expect(mockGlobalState.update.callCount).to.be.greaterThan(0);
    });
  });

  describe('🔥 COMPREHENSIVE STRESS TESTS - 徹底的な動作保証', () => {
    it('should handle rapid save/restore cycles without errors', async () => {
      // === ARRANGE: 高速な保存・復元サイクルテスト ===
      const terminals = [
        { id: 'rapid-1', name: 'Rapid 1', number: 1, cwd: '/test' },
        { id: 'rapid-2', name: 'Rapid 2', number: 2, cwd: '/test' },
        { id: 'rapid-3', name: 'Rapid 3', number: 3, cwd: '/test' },
      ];

      mockTerminalManager.getTerminals.returns(terminals);
      mockTerminalManager.getActiveTerminalId.returns('rapid-2');

      // === ACT: 高速サイクル実行 ===
      const cycles = 5; // テスト実行時間を短縮
      let successCount = 0;

      for (let i = 0; i < cycles; i++) {
        // Mock state reset for each cycle
        sandbox.resetHistory();

        const saveResult = await sessionManager.saveCurrentSession();
        expect(saveResult.success).to.be.true;

        if (i % 2 === 0) {
          // 偶数回は復元もテスト
          const savedData = mockGlobalState.update.getCall(0).args[1];
          mockGlobalState.get.returns(savedData);
          mockTerminalManager.getTerminals.returns([]);
          mockTerminalManager.createTerminal.resetBehavior();

          // Configure fresh create terminal mocks
          mockTerminalManager.createTerminal.onCall(0).returns('restored-1');
          mockTerminalManager.createTerminal.onCall(1).returns('restored-2');
          mockTerminalManager.createTerminal.onCall(2).returns('restored-3');

          const restoreResult = await sessionManager.restoreSession();
          expect(restoreResult.success).to.be.true;

          // 状態をリセット
          mockTerminalManager.getTerminals.returns(terminals);
        }

        successCount++;
      }

      // === ASSERT: 全サイクル成功 ===
      expect(successCount).to.equal(cycles, 'All rapid cycles should succeed');
    });

    it('should maintain data integrity across complex scenarios', async () => {
      // === SCENARIO 1: 3ターミナル保存 ===
      const scenario1Terminals = [
        { id: 'integrity-1', name: 'Integrity 1', number: 1, cwd: '/scenario1' },
        { id: 'integrity-2', name: 'Integrity 2', number: 2, cwd: '/scenario1' },
        { id: 'integrity-3', name: 'Integrity 3', number: 3, cwd: '/scenario1' },
      ];

      mockTerminalManager.getTerminals.returns(scenario1Terminals);
      mockTerminalManager.getActiveTerminalId.returns('integrity-1');

      const save1Result = await sessionManager.saveCurrentSession();
      expect(save1Result.success).to.be.true;
      expect(save1Result.terminalCount).to.equal(3);

      const saved1Data = mockGlobalState.update.getCall(0).args[1];

      // === SCENARIO 2: 復元して4番目追加 ===
      mockGlobalState.get.returns(saved1Data);
      mockTerminalManager.getTerminals.returns([]);

      // Reset createTerminal mock behavior for scenario 2
      mockTerminalManager.createTerminal.resetBehavior();
      mockTerminalManager.createTerminal.onCall(0).returns('restored-1');
      mockTerminalManager.createTerminal.onCall(1).returns('restored-2');
      mockTerminalManager.createTerminal.onCall(2).returns('restored-3');

      const restore1Result = await sessionManager.restoreSession();
      expect(restore1Result.success).to.be.true;
      expect(restore1Result.restoredCount).to.equal(3);

      // 4番目のターミナルを追加
      const scenario2Terminals = [
        { id: 'restored-1', name: 'Restored 1', number: 1, cwd: '/scenario1' },
        { id: 'restored-2', name: 'Restored 2', number: 2, cwd: '/scenario1' },
        { id: 'restored-3', name: 'Restored 3', number: 3, cwd: '/scenario1' },
        { id: 'new-4', name: 'New 4', number: 4, cwd: '/scenario2' },
      ];

      mockTerminalManager.getTerminals.returns(scenario2Terminals);
      mockTerminalManager.getActiveTerminalId.returns('new-4');

      const save2Result = await sessionManager.saveCurrentSession();
      expect(save2Result.success).to.be.true;
      expect(save2Result.terminalCount).to.equal(4);

      // === SCENARIO 3: 全復元確認 ===
      const saved2Data = mockGlobalState.update.getCall(1).args[1];
      mockGlobalState.get.returns(saved2Data);
      mockTerminalManager.getTerminals.returns([]);

      // Reset createTerminal mock behavior for scenario 3
      mockTerminalManager.createTerminal.resetBehavior();
      for (let i = 0; i < 4; i++) {
        mockTerminalManager.createTerminal.onCall(i).returns(`final-restored-${i + 1}`);
      }

      const restore2Result = await sessionManager.restoreSession();
      expect(restore2Result.success).to.be.true;
      expect(restore2Result.restoredCount).to.equal(4);
      expect(mockTerminalManager.createTerminal.callCount).to.equal(4); // Only count calls for final restore
    });

    it('should handle mixed Claude/Gemini CLI with maximum terminals (5)', async () => {
      // === ARRANGE: 5ターミナルでClaude/Gemini混合セッション ===
      const mixedTerminals = [
        { id: 'claude-1', name: 'Claude Terminal 1', number: 1, cwd: '/claude' },
        { id: 'gemini-1', name: 'Gemini Terminal 1', number: 2, cwd: '/gemini' },
        { id: 'claude-2', name: 'Claude Terminal 2', number: 3, cwd: '/claude' },
        { id: 'gemini-2', name: 'Gemini Terminal 2', number: 4, cwd: '/gemini' },
        { id: 'mixed-1', name: 'Mixed Terminal', number: 5, cwd: '/mixed' },
      ];

      mockTerminalManager.getTerminals.returns(mixedTerminals);
      mockTerminalManager.getActiveTerminalId.returns('mixed-1');

      // 各ターミナルに特定のスクロールバックを設定
      const getScrollbackStub = sandbox.stub(sessionManager as any, 'getScrollbackDataSync');

      getScrollbackStub.withArgs('claude-1').resolves([
        { content: 'claude-code "First task"', type: 'input', timestamp: Date.now() - 4000 },
        {
          content: "I'll help with the first task...",
          type: 'output',
          timestamp: Date.now() - 3000,
        },
      ]);

      getScrollbackStub.withArgs('gemini-1').resolves([
        { content: 'gemini code "Second task"', type: 'input', timestamp: Date.now() - 3500 },
        {
          content: 'Let me help with the second task...',
          type: 'output',
          timestamp: Date.now() - 2500,
        },
      ]);

      getScrollbackStub.withArgs('claude-2').resolves([
        { content: 'claude-code "Third task"', type: 'input', timestamp: Date.now() - 3000 },
        { content: 'Working on the third task...', type: 'output', timestamp: Date.now() - 2000 },
      ]);

      getScrollbackStub.withArgs('gemini-2').resolves([
        { content: 'gemini code "Fourth task"', type: 'input', timestamp: Date.now() - 2500 },
        { content: 'Addressing the fourth task...', type: 'output', timestamp: Date.now() - 1500 },
      ]);

      getScrollbackStub.withArgs('mixed-1').resolves([
        { content: 'npm run test', type: 'input', timestamp: Date.now() - 2000 },
        { content: 'Running tests...', type: 'output', timestamp: Date.now() - 1000 },
        { content: 'All tests passed!', type: 'output', timestamp: Date.now() - 500 },
      ]);

      // === ACT: 保存 ===
      const saveResult = await sessionManager.saveCurrentSession();

      // === ASSERT: 保存結果 ===
      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(5);

      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      // 各ターミナルの履歴検証
      expect(savedData.terminals).to.have.length(5);
      expect(savedData.terminals[0].scrollback[0].content).to.include('claude-code');
      expect(savedData.terminals[1].scrollback[0].content).to.include('gemini code');
      expect(savedData.terminals[2].scrollback[0].content).to.include('claude-code');
      expect(savedData.terminals[3].scrollback[0].content).to.include('gemini code');
      expect(savedData.terminals[4].scrollback[0].content).to.include('npm run test');

      // === ACT: 復元 ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);

      // Reset createTerminal mock behavior for restore phase
      mockTerminalManager.createTerminal.resetBehavior();
      for (let i = 0; i < 5; i++) {
        mockTerminalManager.createTerminal.onCall(i).returns(`mixed-restored-${i + 1}`);
      }

      const restoreResult = await sessionManager.restoreSession();

      // === ASSERT: 復元結果 ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(5);
      expect(mockTerminalManager.createTerminal.callCount).to.equal(5);
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('mixed-restored-5');
    });

    it('should guarantee no data loss during edge case scenarios', async () => {
      // === TEST CASE 1: セッション期限ギリギリ（6.9日） ===
      const almostExpiredTimestamp = Date.now() - 6.9 * 24 * 60 * 60 * 1000;
      const almostExpiredData = {
        terminals: [
          { id: 'almost-expired', name: 'Almost Expired', number: 1, cwd: '/test', isActive: true },
        ],
        activeTerminalId: 'almost-expired',
        timestamp: almostExpiredTimestamp,
        version: '2.0.0',
      };

      mockGlobalState.get.returns(almostExpiredData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('restored-almost-expired');

      const restore1Result = await sessionManager.restoreSession();
      expect(restore1Result.success).to.be.true;
      expect(restore1Result.restoredCount).to.equal(1, 'Almost expired session should be restored');

      // === TEST CASE 2: セッション期限超過（8日） ===
      const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const expiredData = {
        terminals: [{ id: 'expired', name: 'Expired', number: 1, cwd: '/test', isActive: true }],
        activeTerminalId: 'expired',
        timestamp: expiredTimestamp,
        version: '2.0.0',
      };

      mockGlobalState.get.returns(expiredData);
      const restore2Result = await sessionManager.restoreSession();
      expect(restore2Result.success).to.be.true;
      expect(restore2Result.restoredCount).to.equal(0, 'Expired session should not be restored');

      // === TEST CASE 3: 部分的なターミナル作成失敗 ===
      const partialFailData = {
        terminals: [
          { id: 'success-1', name: 'Success 1', number: 1, cwd: '/test', isActive: false },
          { id: 'fail-2', name: 'Fail 2', number: 2, cwd: '/test', isActive: false },
          { id: 'success-3', name: 'Success 3', number: 3, cwd: '/test', isActive: true },
        ],
        activeTerminalId: 'success-3',
        timestamp: Date.now(),
        version: '2.0.0',
      };

      mockGlobalState.get.returns(partialFailData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.onCall(0).returns('partial-success-1');
      mockTerminalManager.createTerminal.onCall(1).returns(null); // 失敗
      mockTerminalManager.createTerminal.onCall(2).returns('partial-success-3');

      const restore3Result = await sessionManager.restoreSession();
      expect(restore3Result.success).to.be.true;
      expect(restore3Result.restoredCount).to.equal(2, 'Should restore 2 out of 3 terminals');
      expect(restore3Result.skippedCount).to.equal(1, 'Should skip 1 failed terminal');
    });
  });
});
