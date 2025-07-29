import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SimpleSessionManager } from '../../../sessions/SimpleSessionManager';

/**
 * 復元機能の確実性を担保するテスト
 * これらのテストが全て通ることで、復元機能が確実に動作することを保証します
 */
describe('🎯 RESTORE FUNCTIONALITY GUARANTEE TESTS', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockTerminalManager: any;
  let mockGlobalState: any;
  let sessionManager: SimpleSessionManager;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockGlobalState = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves(),
      keys: sandbox.stub(),
      setKeysForSync: sandbox.stub(),
    };

    mockContext = {
      globalState: mockGlobalState,
      subscriptions: [],
      extensionPath: '/test/path',
    };

    mockTerminalManager = {
      getTerminals: sandbox.stub().returns([]),
      getActiveTerminalId: sandbox.stub().returns(undefined),
      createTerminal: sandbox.stub(),
      setActiveTerminal: sandbox.stub(),
    };

    sessionManager = new SimpleSessionManager(mockContext, mockTerminalManager);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('🎯 CRITICAL: Basic Restore Guarantees', () => {
    it('MUST restore correct number of terminals', async () => {
      // Arrange: 3つのターミナルがあるセッション
      const sessionData = {
        terminals: [
          { id: 'term1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true },
          { id: 'term2', name: 'Terminal 2', number: 2, cwd: '/test', isActive: false },
          { id: 'term3', name: 'Terminal 3', number: 3, cwd: '/test', isActive: false },
        ],
        activeTerminalId: 'term1',
        timestamp: Date.now(),
        version: '1.0.0',
      };

      mockGlobalState.get.returns(sessionData);
      mockTerminalManager.createTerminal.returns('new-term');

      // Act
      const result = await sessionManager.restoreSession();

      // Assert: 確実に3つのターミナルが復元される
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(3, 'CRITICAL: Must restore exactly 3 terminals');
      expect(mockTerminalManager.createTerminal.callCount).to.equal(
        3,
        'createTerminal must be called 3 times'
      );

      console.log('✅ PASS: Correct number of terminals restored');
    });

    it('MUST set active terminal correctly', async () => {
      // Arrange: 2番目のターミナルがアクティブなセッション
      const sessionData = {
        terminals: [
          { id: 'term1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: false },
          { id: 'term2', name: 'Terminal 2', number: 2, cwd: '/test', isActive: true },
        ],
        activeTerminalId: 'term2',
        timestamp: Date.now(),
        version: '1.0.0',
      };

      mockGlobalState.get.returns(sessionData);
      mockTerminalManager.createTerminal.returns('new-term');

      // Act
      const result = await sessionManager.restoreSession();

      // Assert: アクティブターミナルが確実に設定される
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(2);
      expect(mockTerminalManager.setActiveTerminal.calledOnce).to.be.true;

      console.log('✅ PASS: Active terminal set correctly');
    });

    it('MUST restore with scrollback data when available', async () => {
      // Arrange: Scrollbackデータ付きセッション
      const sessionData = {
        terminals: [
          {
            id: 'term1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: true,
            scrollback: [
              { content: 'echo hello', type: 'input', timestamp: Date.now() },
              { content: 'hello', type: 'output', timestamp: Date.now() },
            ],
          },
        ],
        activeTerminalId: 'term1',
        timestamp: Date.now(),
        version: '1.0.0',
      };

      mockGlobalState.get.returns(sessionData);
      mockTerminalManager.createTerminal.returns('new-term');

      // Mock sidebar provider for scrollback restoration
      const mockSidebarProvider = {
        _sendMessage: sandbox.stub(),
      };
      sessionManager.setSidebarProvider(mockSidebarProvider);

      // Act
      const result = await sessionManager.restoreSession();

      // Assert: 基本復元は成功
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(1);

      // Wait for scrollback restoration (it's delayed by 1.5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Assert: Scrollback復元メッセージが送信される
      expect(mockSidebarProvider._sendMessage.calledOnce).to.be.true;
      const sentMessage = mockSidebarProvider._sendMessage.firstCall.args[0];
      expect(sentMessage.command).to.equal('restoreScrollback');
      expect(sentMessage.terminalId).to.equal('new-term');
      expect(sentMessage.scrollbackContent).to.have.length(2);

      console.log('✅ PASS: Scrollback data restored correctly');
    });
  });

  describe('🎯 CRITICAL: Edge Cases and Error Handling', () => {
    it('MUST handle empty session gracefully', async () => {
      // Arrange: 空のセッション
      mockGlobalState.get.returns(undefined);

      // Act
      const result = await sessionManager.restoreSession();

      // Assert: エラーではなく成功として処理
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
      expect(result.skippedCount).to.equal(0);
      expect(mockTerminalManager.createTerminal.called).to.be.false;

      console.log('✅ PASS: Empty session handled gracefully');
    });

    it('MUST skip restore when terminals already exist', async () => {
      // Arrange: 既存ターミナルがある状態
      const sessionData = {
        terminals: [{ id: 'term1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true }],
        activeTerminalId: 'term1',
        timestamp: Date.now(),
        version: '1.0.0',
      };

      mockGlobalState.get.returns(sessionData);
      mockTerminalManager.getTerminals.returns([{ id: 'existing-term' }]); // 既存ターミナル

      // Act
      const result = await sessionManager.restoreSession();

      // Assert: 復元をスキップ
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
      expect(result.skippedCount).to.equal(1);
      expect(mockTerminalManager.createTerminal.called).to.be.false;

      console.log('✅ PASS: Existing terminals handled correctly');
    });

    it('MUST handle corrupt session data', async () => {
      // Arrange: 破損したセッションデータ
      const corruptData = {
        terminals: 'not-an-array',
        activeTerminalId: 123,
        timestamp: 'invalid-timestamp',
      };

      mockGlobalState.get.returns(corruptData);

      // Act
      const result = await sessionManager.restoreSession();

      // Assert: 破損データを検出して安全に処理
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
      expect(mockTerminalManager.createTerminal.called).to.be.false;

      console.log('✅ PASS: Corrupt session data handled safely');
    });

    it('MUST handle expired session data', async () => {
      // Arrange: 期限切れのセッションデータ（8日前）
      const expiredData = {
        terminals: [{ id: 'term1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true }],
        activeTerminalId: 'term1',
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        version: '1.0.0',
      };

      mockGlobalState.get.returns(expiredData);

      // Act
      const result = await sessionManager.restoreSession();

      // Assert: 期限切れデータをクリア
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
      expect(mockTerminalManager.createTerminal.called).to.be.false;

      console.log('✅ PASS: Expired session data handled correctly');
    });
  });

  describe('🎯 CRITICAL: Save Functionality Guarantees', () => {
    it('MUST save session with correct data structure', async () => {
      // Arrange: 複数ターミナルがある状態
      const mockTerminals = [
        {
          id: 'term1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/test1',
          isActive: true,
          ptyProcess: {},
        },
        {
          id: 'term2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/test2',
          isActive: false,
          ptyProcess: {},
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('term1');

      // Act
      const result = await sessionManager.saveCurrentSession();

      // Assert: 保存成功
      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(2);
      expect(mockGlobalState.update.calledOnce).to.be.true;

      // 保存されたデータの構造を確認
      const savedData = mockGlobalState.update.firstCall.args[1];
      expect(savedData).to.have.property('terminals');
      expect(savedData.terminals).to.have.length(2);
      expect(savedData).to.have.property('activeTerminalId', 'term1');
      expect(savedData).to.have.property('timestamp');
      expect(savedData).to.have.property('version', '1.0.0');

      // 各ターミナルデータの構造確認
      savedData.terminals.forEach((terminal: any, index: number) => {
        expect(terminal).to.have.property('id', mockTerminals[index]?.id);
        expect(terminal).to.have.property('name', mockTerminals[index]?.name);
        expect(terminal).to.have.property('number', mockTerminals[index]?.number);
        expect(terminal).to.have.property('cwd', mockTerminals[index]?.cwd);
        expect(terminal).to.have.property('isActive', mockTerminals[index]?.isActive);
        expect(terminal).to.have.property('scrollback');
      });

      console.log('✅ PASS: Session saved with correct data structure');
    });

    it('MUST generate scrollback data for each terminal', async () => {
      // Arrange
      const mockTerminals = [
        {
          id: 'term1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/test',
          isActive: true,
          ptyProcess: {},
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('term1');

      // Act
      const result = await sessionManager.saveCurrentSession();

      // Assert
      expect(result.success).to.be.true;
      const savedData = mockGlobalState.update.firstCall.args[1];
      const terminal = savedData.terminals[0];

      // Scrollbackデータが生成されていることを確認
      expect(terminal.scrollback).to.be.an('array');
      expect(terminal.scrollback).to.have.length.greaterThan(0);

      // Scrollbackデータの構造確認
      terminal.scrollback.forEach((line: any) => {
        expect(line).to.have.property('content');
        expect(line).to.have.property('type');
        expect(line).to.have.property('timestamp');
      });

      console.log('✅ PASS: Scrollback data generated correctly');
    });
  });

  describe('🎯 CRITICAL: End-to-End Restore Flow', () => {
    it('MUST complete full save-restore cycle', async () => {
      // Phase 1: Save session
      const mockTerminals = [
        {
          id: 'original-term1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/test',
          isActive: true,
          ptyProcess: {},
        },
        {
          id: 'original-term2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/test',
          isActive: false,
          ptyProcess: {},
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('original-term1');

      const saveResult = await sessionManager.saveCurrentSession();
      expect(saveResult.success).to.be.true;

      // 保存されたデータを取得
      const savedData = mockGlobalState.update.firstCall.args[1];

      // Phase 2: Simulate restart (no existing terminals)
      mockTerminalManager.getTerminals.returns([]);
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.createTerminal.returns('restored-term');

      // Phase 3: Restore session
      const restoreResult = await sessionManager.restoreSession();

      // Assert: 完全なサイクル成功
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(2);
      expect(mockTerminalManager.createTerminal.callCount).to.equal(2);
      expect(mockTerminalManager.setActiveTerminal.calledOnce).to.be.true;

      console.log('✅ PASS: Full save-restore cycle completed successfully');
    });
  });
});
