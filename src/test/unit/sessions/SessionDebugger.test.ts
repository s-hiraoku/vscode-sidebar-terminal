import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { UnifiedSessionManager } from '../../../sessions/UnifiedSessionManager';

/**
 * セッション復元デバッガーテスト
 * 実際の問題を特定し、根本原因を明らかにする
 */
describe('🔍 Session Debugger Tests - Root Cause Analysis', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockTerminalManager: any;
  let mockGlobalState: any;
  let sessionManager: UnifiedSessionManager;
  let mockSidebarProvider: any;
  let capturedLogs: string[] = [];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    capturedLogs = [];

    // ログをキャプチャ
    const originalLog = console.log;
    sandbox.stub(console, 'log').callsFake((...args: any[]) => {
      capturedLogs.push(args.join(' '));
      originalLog.apply(console, args);
    });

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
      getActiveTerminalId: sandbox.stub().returns(null),
      createTerminal: sandbox.stub().returns('new-terminal-id'),
      setActiveTerminal: sandbox.stub(),
      dispose: sandbox.stub(),
    };

    mockSidebarProvider = {
      _sendMessage: sandbox.stub().resolves(),
    };

    sessionManager = new UnifiedSessionManager(mockContext, mockTerminalManager);
    sessionManager.setSidebarProvider(mockSidebarProvider);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('🔍 Debug: ターミナルカウント問題', () => {
    it('should track exact terminal count throughout save/restore cycle', async () => {
      console.log('🔍 [DEBUG TEST] Starting terminal count tracking test');

      // === Phase 1: 初期状態 ===
      expect(mockTerminalManager.getTerminals()).to.have.length(0);
      console.log('🔍 [DEBUG TEST] Initial terminal count: 0');

      // === Phase 2: 2つのターミナルを作成（ユーザー操作をシミュレート） ===
      const terminal1 = {
        id: 'user-terminal-1',
        name: 'User Terminal 1',
        number: 1,
        cwd: '/workspace/project',
      };
      const terminal2 = {
        id: 'user-terminal-2',
        name: 'User Terminal 2',
        number: 2,
        cwd: '/workspace/project/src',
      };

      mockTerminalManager.getTerminals.returns([terminal1, terminal2]);
      mockTerminalManager.getActiveTerminalId.returns('user-terminal-2');

      console.log('🔍 [DEBUG TEST] User created 2 terminals');
      console.log('🔍 [DEBUG TEST] Active terminal: user-terminal-2');

      // === Phase 3: セッション保存 ===
      console.log('🔍 [DEBUG TEST] === STARTING SAVE ===');
      const saveResult = await sessionManager.saveCurrentSession();

      console.log('🔍 [DEBUG TEST] Save result:', JSON.stringify(saveResult, null, 2));

      // 保存されたデータの詳細確認
      const saveCall = mockGlobalState.update.getCall(0);
      const savedData = saveCall?.args[1];

      console.log('🔍 [DEBUG TEST] Saved data:', JSON.stringify(savedData, null, 2));

      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(2, 'Should save exactly 2 terminals');
      expect(savedData?.terminals).to.have.length(2, 'Saved data should contain 2 terminals');

      // === Phase 4: VS Code再起動をシミュレート ===
      console.log('🔍 [DEBUG TEST] === SIMULATING VS CODE RESTART ===');

      // 既存のターミナルをクリア（再起動後の状態）
      mockTerminalManager.getTerminals.returns([]);
      mockGlobalState.get.returns(savedData);

      // 新しいターミナルIDを生成（復元時）
      mockTerminalManager.createTerminal.onCall(0).returns('restored-terminal-1');
      mockTerminalManager.createTerminal.onCall(1).returns('restored-terminal-2');

      console.log('🔍 [DEBUG TEST] === STARTING RESTORE ===');
      const restoreResult = await sessionManager.restoreSession();

      console.log('🔍 [DEBUG TEST] Restore result:', JSON.stringify(restoreResult, null, 2));

      // === Phase 5: 復元結果の詳細検証 ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(2, 'Should restore exactly 2 terminals');
      expect(restoreResult.skippedCount).to.equal(0, 'Should not skip any terminals');

      // createTerminalの呼び出し回数を確認
      expect(mockTerminalManager.createTerminal.callCount).to.equal(
        2,
        'createTerminal should be called exactly twice'
      );

      // アクティブターミナルの設定を確認
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledOnce;
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('restored-terminal-2');

      console.log('🔍 [DEBUG TEST] === TEST COMPLETED SUCCESSFULLY ===');
    });

    it('should verify scrollback data handling', async () => {
      console.log('🔍 [DEBUG TEST] Starting scrollback data test');

      // === Terminal with scrollback ===
      const terminalWithScrollback = {
        id: 'scrollback-terminal',
        name: 'Terminal with Scrollback',
        number: 1,
        cwd: '/workspace',
      };

      mockTerminalManager.getTerminals.returns([terminalWithScrollback]);
      mockTerminalManager.getActiveTerminalId.returns('scrollback-terminal');

      // === Save ===
      console.log('🔍 [DEBUG TEST] Saving terminal with scrollback...');
      const saveResult = await sessionManager.saveCurrentSession();

      const saveCall = mockGlobalState.update.getCall(0);
      const savedData = saveCall?.args[1];

      console.log('🔍 [DEBUG TEST] Scrollback in saved data:', savedData?.terminals[0]?.scrollback);

      expect(savedData?.terminals[0]?.scrollback).to.exist;
      expect(savedData?.terminals[0]?.scrollback).to.have.length.greaterThan(0);

      // === Restore ===
      mockGlobalState.get.returns(savedData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('restored-scrollback-terminal');

      console.log('🔍 [DEBUG TEST] Restoring terminal with scrollback...');
      const restoreResult = await sessionManager.restoreSession();

      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(1);

      console.log('🔍 [DEBUG TEST] Scrollback restoration completed');
    });

    it('should identify configuration issues', async () => {
      console.log('🔍 [DEBUG TEST] Checking configuration settings');

      // VS Code設定のモック
      const mockConfig = {
        get: sandbox.stub().withArgs('restoreScrollback', true).returns(true),
      };

      const mockWorkspace = {
        getConfiguration: sandbox.stub().withArgs('secondaryTerminal').returns(mockConfig),
      };

      // vscode.workspaceのモック（テスト環境で必要）
      (global as any).vscode = { workspace: mockWorkspace };

      const terminal = {
        id: 'config-test-terminal',
        name: 'Config Test Terminal',
        number: 1,
        cwd: '/test',
      };

      mockTerminalManager.getTerminals.returns([terminal]);

      console.log('🔍 [DEBUG TEST] Testing with scrollback enabled');
      const saveResult = await sessionManager.saveCurrentSession();

      expect(saveResult.success).to.be.true;

      // 設定値の確認
      expect(mockWorkspace.getConfiguration).to.have.been.calledWith('secondaryTerminal');
      expect(mockConfig.get).to.have.been.calledWith('restoreScrollback', true);

      console.log('🔍 [DEBUG TEST] Configuration test completed');
    });
  });

  describe('🔍 Debug: 実際の問題再現', () => {
    it('should reproduce the exact user scenario', async () => {
      console.log('🔍 [DEBUG TEST] === REPRODUCING USER SCENARIO ===');

      // === User's exact scenario ===
      console.log('🔍 [DEBUG TEST] Step 1: User opens 2 terminals');

      const userTerminal1 = {
        id: 'real-terminal-1',
        name: 'bash',
        number: 1,
        cwd: '/workspaces/dev-laplus',
      };

      const userTerminal2 = {
        id: 'real-terminal-2',
        name: 'bash',
        number: 2,
        cwd: '/workspaces/dev-laplus/src',
      };

      // シミュレート: ユーザーが2つのターミナルで作業
      mockTerminalManager.getTerminals.returns([userTerminal1, userTerminal2]);
      mockTerminalManager.getActiveTerminalId.returns('real-terminal-2');

      console.log('🔍 [DEBUG TEST] Step 2: VS Code auto-saves session');
      const saveResult = await sessionManager.saveCurrentSession();

      console.log('🔍 [DEBUG TEST] Auto-save result:', saveResult);

      expect(saveResult.success).to.be.true;
      expect(saveResult.terminalCount).to.equal(2);

      // === VS Code restart simulation ===
      console.log('🔍 [DEBUG TEST] Step 3: User restarts VS Code');

      const saveCall = mockGlobalState.update.getCall(0);
      const savedData = saveCall?.args[1];

      // 再起動後の状態
      mockTerminalManager.getTerminals.returns([]); // 空の状態
      mockGlobalState.get.returns(savedData);

      // 復元プロセス
      mockTerminalManager.createTerminal.onCall(0).returns('restored-1');
      mockTerminalManager.createTerminal.onCall(1).returns('restored-2');

      console.log('🔍 [DEBUG TEST] Step 4: Extension restores session');
      const restoreResult = await sessionManager.restoreSession();

      console.log('🔍 [DEBUG TEST] Restore result:', restoreResult);
      console.log(
        '🔍 [DEBUG TEST] createTerminal call count:',
        mockTerminalManager.createTerminal.callCount
      );

      // === Assertions ===
      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(
        2,
        'CRITICAL: Should restore 2 terminals, not 1'
      );
      expect(mockTerminalManager.createTerminal.callCount).to.equal(
        2,
        'CRITICAL: Should call createTerminal twice'
      );

      console.log('🔍 [DEBUG TEST] === USER SCENARIO REPRODUCTION COMPLETE ===');
    });

    it('should check for timing issues', async () => {
      console.log('🔍 [DEBUG TEST] Checking for timing/async issues');

      const terminals = [
        { id: 'timing-1', name: 'Terminal 1', number: 1, cwd: '/test' },
        { id: 'timing-2', name: 'Terminal 2', number: 2, cwd: '/test' },
      ];

      mockTerminalManager.getTerminals.returns(terminals);

      // 非同期操作のタイミングをテスト
      const savePromise = sessionManager.saveCurrentSession();

      // 少し待って状態を変更（レースコンディションをシミュレート）
      setTimeout(() => {
        mockTerminalManager.getTerminals.returns([terminals[0]]); // 1つに減らす
      }, 10);

      const saveResult = await savePromise;

      console.log('🔍 [DEBUG TEST] Save result with timing:', saveResult);

      // 保存処理は開始時の状態を使うべき
      expect(saveResult.terminalCount).to.equal(
        2,
        'Should save original terminal count despite timing changes'
      );
    });
  });

  describe('🔍 Debug: ログ分析', () => {
    it('should capture and analyze all logs during operations', async () => {
      console.log('🔍 [DEBUG TEST] Starting comprehensive log analysis');

      const terminal = {
        id: 'log-test-terminal',
        name: 'Log Test Terminal',
        number: 1,
        cwd: '/test',
      };

      mockTerminalManager.getTerminals.returns([terminal]);

      // Save operation
      await sessionManager.saveCurrentSession();

      // Restore operation
      mockTerminalManager.getTerminals.returns([]);
      mockGlobalState.get.returns({
        terminals: [
          {
            id: 'log-test-terminal',
            name: 'Log Test Terminal',
            number: 1,
            cwd: '/test',
            isActive: true,
            scrollback: [{ content: 'test', type: 'output', timestamp: Date.now() }],
          },
        ],
        activeTerminalId: 'log-test-terminal',
        timestamp: Date.now(),
        version: '2.0.0',
      });

      await sessionManager.restoreSession();

      // ログ分析
      console.log('🔍 [DEBUG TEST] Captured logs:');
      capturedLogs.forEach((log, index) => {
        console.log(`  ${index}: ${log}`);
      });

      // 重要なログメッセージが含まれていることを確認
      const hasSessionLogs = capturedLogs.some((log) => log.includes('[SESSION]'));
      const hasRestoreLogs = capturedLogs.some((log) => log.includes('Unified session restore'));
      const hasScrollbackLogs = capturedLogs.some((log) => log.includes('scrollback'));

      expect(hasSessionLogs).to.be.true;
      expect(hasRestoreLogs).to.be.true;
      expect(hasScrollbackLogs).to.be.true;

      console.log('🔍 [DEBUG TEST] Log analysis completed');
    });
  });
});
