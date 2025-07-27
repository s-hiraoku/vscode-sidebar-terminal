import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SimpleSessionManager } from '../../../sessions/SimpleSessionManager';

/**
 * 🚨 CRITICAL: 無限ループ検知テスト
 * このテストが失敗した場合、VS Code再起動時に無限ループが発生している可能性があります
 */
describe('🚨 CRITICAL: Infinite Loop Detection', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockTerminalManager: any;
  let mockGlobalState: any;

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
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('🚨 CRITICAL: should prevent infinite terminal creation during restore', async function () {
    this.timeout(5000);

    // Arrange: セッションデータ（1つのターミナル）
    const sessionData = {
      terminals: [{ id: 'term1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true }],
      activeTerminalId: 'term1',
      timestamp: Date.now(),
      version: '1.0.0',
    };

    mockGlobalState.get.returns(sessionData);

    // 無限ループ検知: createTerminalの呼び出し回数を追跡
    let createTerminalCallCount = 0;
    const MAX_ALLOWED_CALLS = 3; // 許可する最大呼び出し回数

    mockTerminalManager.createTerminal.callsFake(() => {
      createTerminalCallCount++;

      if (createTerminalCallCount > MAX_ALLOWED_CALLS) {
        throw new Error(
          `🚨 INFINITE LOOP DETECTED: createTerminal called ${createTerminalCallCount} times. Expected: 1 time for 1 terminal.`
        );
      }

      return `new-term-${createTerminalCallCount}`;
    });

    // Act: 復元処理を実行
    const sessionManager = new SimpleSessionManager(mockContext, mockTerminalManager);
    const result = await sessionManager.restoreSession();

    // Assert: 無限ループが発生していないことを確認
    expect(createTerminalCallCount).to.equal(
      1,
      `🚨 CRITICAL FAILURE: Expected exactly 1 createTerminal call, but got ${createTerminalCallCount} calls`
    );

    expect(result.success).to.be.true;
    expect(result.restoredCount).to.equal(1);

    console.log(
      `✅ PASS: Restore called createTerminal ${createTerminalCallCount} time(s) - No infinite loop detected`
    );
  });

  it('🚨 CRITICAL: should complete restore within reasonable time', async function () {
    this.timeout(3000);

    // Arrange
    const sessionData = {
      terminals: [
        { id: 'term1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true },
        { id: 'term2', name: 'Terminal 2', number: 2, cwd: '/test', isActive: false },
      ],
      activeTerminalId: 'term1',
      timestamp: Date.now(),
      version: '1.0.0',
    };

    mockGlobalState.get.returns(sessionData);
    mockTerminalManager.createTerminal.returns('new-term');

    const sessionManager = new SimpleSessionManager(mockContext, mockTerminalManager);

    // Act: パフォーマンステスト
    const startTime = Date.now();
    const result = await sessionManager.restoreSession();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Assert: 性能要件
    expect(duration).to.be.lessThan(
      2000,
      `🚨 CRITICAL FAILURE: Restore took ${duration}ms - should complete within 2 seconds`
    );

    expect(result.success).to.be.true;
    expect(result.restoredCount).to.equal(2);

    console.log(`✅ PASS: Restore completed in ${duration}ms`);
  });

  it('🚨 CRITICAL: should prevent multiple simultaneous restore calls', async function () {
    this.timeout(5000);

    // Arrange
    const sessionData = {
      terminals: [{ id: 'term1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true }],
      activeTerminalId: 'term1',
      timestamp: Date.now(),
      version: '1.0.0',
    };

    mockGlobalState.get.returns(sessionData);
    mockTerminalManager.createTerminal.returns('new-term');

    const sessionManager = new SimpleSessionManager(mockContext, mockTerminalManager);

    // Act: 複数の復元を同時実行
    const promises = [
      sessionManager.restoreSession(),
      sessionManager.restoreSession(),
      sessionManager.restoreSession(),
    ];

    const results = await Promise.all(promises);

    // Assert: 複数回実行されても正常動作
    expect(results).to.have.length(3);
    results.forEach((result, index) => {
      expect(result.success).to.be.true;
      console.log(
        `Result ${index + 1}: restored=${result.restoredCount}, skipped=${result.skippedCount}`
      );
    });

    console.log('✅ PASS: Multiple restore calls handled correctly');
  });
});
