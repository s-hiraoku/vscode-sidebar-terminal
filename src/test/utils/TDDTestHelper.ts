/**
 * TDD (Test-Driven Development) ヘルパーユーティリティ
 *
 * Red-Green-Refactorサイクルを支援するためのツール群
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  TDD_PHASES,
  // TEST_EXECUTION_MODES,
  PERFORMANCE_THRESHOLDS,
  type TDDPhase,
  type TestExecutionMode as _TestExecutionMode,
} from '../constants/TestConstants';

/**
 * TDDワークフローマネージャー
 * テストの実行フェーズを管理し、適切なTDDサイクルを保証する
 */
export class TDDWorkflowManager {
  private currentPhase: TDDPhase = TDD_PHASES.RED;
  private readonly testResults: Array<{
    phase: TDDPhase;
    testName: string;
    passed: boolean;
    duration: number;
  }> = [];

  /**
   * Red フェーズ: 失敗するテストを書く
   */
  public startRedPhase(testName: string): void {
    this.currentPhase = TDD_PHASES.RED;
    console.log(`🔴 [TDD-RED] Starting RED phase for: ${testName}`);
    console.log(`🔴 [TDD-RED] Expectation: Test should FAIL initially`);
  }

  /**
   * Green フェーズ: テストを通すための最小限の実装
   */
  public startGreenPhase(testName: string): void {
    this.currentPhase = TDD_PHASES.GREEN;
    console.log(`🟢 [TDD-GREEN] Starting GREEN phase for: ${testName}`);
    console.log(`🟢 [TDD-GREEN] Expectation: Test should PASS with minimal implementation`);
  }

  /**
   * Refactor フェーズ: コードの改善
   */
  public startRefactorPhase(testName: string): void {
    this.currentPhase = TDD_PHASES.REFACTOR;
    console.log(`🔵 [TDD-REFACTOR] Starting REFACTOR phase for: ${testName}`);
    console.log(`🔵 [TDD-REFACTOR] Expectation: Test should PASS with improved code`);
  }

  /**
   * テスト結果を記録
   */
  public recordTestResult(testName: string, passed: boolean, duration: number): void {
    this.testResults.push({
      phase: this.currentPhase,
      testName,
      passed,
      duration,
    });

    const phaseIcon = this.getPhaseIcon(this.currentPhase);
    const statusIcon = passed ? '✅' : '❌';
    console.log(
      `${phaseIcon} [TDD-${this.currentPhase}] ${statusIcon} ${testName} (${duration}ms)`
    );
  }

  /**
   * TDDサイクルの検証
   */
  public validateTDDCycle(testName: string): void {
    const testHistory = this.testResults.filter((r) => r.testName === testName);

    if (testHistory.length === 0) {
      throw new Error(`No test history found for: ${testName}`);
    }

    // Red-Green-Refactorサイクルの確認
    const phases = testHistory.map((r) => r.phase);
    console.log(`🔍 [TDD-VALIDATION] Test cycle for ${testName}: ${phases.join(' → ')}`);
  }

  /**
   * フェーズアイコンを取得
   */
  private getPhaseIcon(phase: TDDPhase): string {
    switch (phase) {
      case TDD_PHASES.RED:
        return '🔴';
      case TDD_PHASES.GREEN:
        return '🟢';
      case TDD_PHASES.REFACTOR:
        return '🔵';
      default:
        return '⚪';
    }
  }

  /**
   * TDDレポートを生成
   */
  public generateTDDReport(): string {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.passed).length;
    const averageDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0) / totalTests;

    return `
📊 TDD Cycle Report
==================
Total Tests: ${totalTests}
Passed: ${passedTests}
Failed: ${totalTests - passedTests}
Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%
Average Duration: ${averageDuration.toFixed(1)}ms

Phase Distribution:
- RED: ${this.testResults.filter((r) => r.phase === TDD_PHASES.RED).length}
- GREEN: ${this.testResults.filter((r) => r.phase === TDD_PHASES.GREEN).length}
- REFACTOR: ${this.testResults.filter((r) => r.phase === TDD_PHASES.REFACTOR).length}
`;
  }
}

/**
 * パフォーマンス測定ヘルパー
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PerformanceTestHelper {
  /**
   * 関数の実行時間を測定
   */
  public static async measureExecutionTime<T>(
    fn: () => Promise<T> | T,
    testName: string
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;

    console.log(`⏱️ [PERFORMANCE] ${testName}: ${duration}ms`);
    return { result, duration };
  }

  /**
   * パフォーマンス閾値の検証
   */
  public static validatePerformance(
    duration: number,
    operation: 'save' | 'restore' | 'scrollback',
    testName: string
  ): void {
    let threshold: number;

    switch (operation) {
      case 'save':
        threshold = PERFORMANCE_THRESHOLDS.MAX_SAVE_TIME_MS;
        break;
      case 'restore':
        threshold = PERFORMANCE_THRESHOLDS.MAX_RESTORE_TIME_MS;
        break;
      case 'scrollback':
        threshold = PERFORMANCE_THRESHOLDS.MAX_SCROLLBACK_RESTORE_MS;
        break;
    }

    if (duration > threshold) {
      console.warn(
        `⚠️ [PERFORMANCE WARNING] ${testName} took ${duration}ms (threshold: ${threshold}ms)`
      );
    } else {
      console.log(`✅ [PERFORMANCE OK] ${testName} completed in ${duration}ms`);
    }

    // アサーションとしても使用可能
    expect(duration).to.be.lessThan(
      threshold,
      `Performance test failed: ${testName} took ${duration}ms (max: ${threshold}ms)`
    );
  }
}

/**
 * モックマネージャー
 * 一貫性のあるモックオブジェクトの生成と管理
 */
export class MockManager {
  private readonly sandbox: sinon.SinonSandbox;

  constructor(sandbox: sinon.SinonSandbox) {
    this.sandbox = sandbox;
  }

  /**
   * 標準的なExtensionContextモックを作成
   */
  public createMockExtensionContext(customConfig?: Record<string, unknown>): unknown {
    const mockGlobalState = {
      get: this.sandbox.stub(),
      update: this.sandbox.stub().resolves(),
      keys: this.sandbox.stub(),
      setKeysForSync: this.sandbox.stub(),
    };

    return {
      globalState: mockGlobalState,
      subscriptions: [],
      extensionPath: '/test/path',
      ...customConfig,
    };
  }

  /**
   * 標準的なTerminalManagerモックを作成
   */
  public createMockTerminalManager(customConfig?: Record<string, unknown>): unknown {
    return {
      getTerminals: this.sandbox.stub().returns([]),
      getActiveTerminalId: this.sandbox.stub().returns(undefined),
      createTerminal: this.sandbox.stub().returns('new-term-id'),
      setActiveTerminal: this.sandbox.stub(),
      ...customConfig,
    };
  }

  /**
   * SidebarProviderモックを作成
   */
  public createMockSidebarProvider(): unknown {
    return {
      _sendMessage: this.sandbox.stub(),
    };
  }
}

/**
 * アサーションヘルパー
 * 復元機能テスト用の共通アサーション
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RestoreAssertionHelper {
  /**
   * セッション復元の基本検証
   */
  public static validateBasicRestore(
    result: { success: boolean; restoredCount?: number },
    expectedCount: number,
    testName: string
  ): void {
    expect(result.success).to.be.true;
    expect(result.restoredCount).to.equal(expectedCount);
    console.log(`✅ [ASSERTION] ${testName}: ${expectedCount} terminals restored successfully`);
  }

  /**
   * TerminalManager呼び出しの検証
   */
  public static validateTerminalManagerCalls(
    mockTerminalManager: any,
    expectedCreateCalls: number,
    expectedSetActiveCalls: number,
    testName: string
  ): void {
    expect(mockTerminalManager.createTerminal.callCount).to.equal(expectedCreateCalls);
    if (expectedSetActiveCalls > 0) {
      expect(mockTerminalManager.setActiveTerminal.callCount).to.equal(expectedSetActiveCalls);
    }
    console.log(`✅ [ASSERTION] ${testName}: Terminal manager calls validated`);
  }

  /**
   * Scrollback復元の検証
   */
  public static async validateScrollbackRestore(
    mockSidebarProvider: any,
    expectedTerminalId: string,
    expectedLines: number,
    delayMs: number = 2000
  ): Promise<void> {
    // Scrollback復元の遅延を待つ
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    expect(mockSidebarProvider._sendMessage.calledOnce).to.be.true;
    const sentMessage = mockSidebarProvider._sendMessage.firstCall.args[0];
    expect(sentMessage.command).to.equal('restoreScrollback');
    expect(sentMessage.terminalId).to.equal(expectedTerminalId);
    expect(sentMessage.scrollbackContent).to.have.length(expectedLines);

    console.log(
      `✅ [ASSERTION] Scrollback restored: ${expectedLines} lines to ${expectedTerminalId}`
    );
  }
}

/**
 * テストデータファクトリー
 * 一貫性のあるテストデータの生成
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TestDataFactory {
  /**
   * セッションデータを生成
   */
  public static createSessionData(
    terminalCount: number,
    activeTerminalId?: string,
    includeScrollback: boolean = false
  ): unknown {
    const terminals = [];

    for (let i = 1; i <= terminalCount; i++) {
      const terminalId = `term${i}`;
      const terminal: any = {
        id: terminalId,
        name: `Terminal ${i}`,
        number: i,
        cwd: '/test',
        isActive: terminalId === (activeTerminalId || 'term1'),
      };

      if (includeScrollback) {
        terminal.scrollback = [
          { content: 'echo hello', type: 'input', timestamp: Date.now() },
          { content: 'hello', type: 'output', timestamp: Date.now() },
        ];
      }

      terminals.push(terminal);
    }

    return {
      terminals,
      activeTerminalId: activeTerminalId || 'term1',
      timestamp: Date.now(),
      version: '1.0.0',
    };
  }

  /**
   * 期限切れセッションデータを生成
   */
  public static createExpiredSessionData(daysAgo: number): unknown {
    const sessionData = this.createSessionData(1) as any;
    return {
      ...(sessionData as Record<string, unknown>),
      timestamp: Date.now() - daysAgo * 24 * 60 * 60 * 1000,
    };
  }

  /**
   * 破損したセッションデータを生成
   */
  public static createCorruptSessionData(): unknown {
    return {
      terminals: 'not-an-array',
      activeTerminalId: 123,
      timestamp: 'invalid-timestamp',
    };
  }
}

/**
 * TDDテストスイートベースクラス
 */
export abstract class TDDTestSuite {
  protected tddManager: TDDWorkflowManager;
  protected mockManager: MockManager;
  protected sandbox: sinon.SinonSandbox;

  constructor() {
    this.tddManager = new TDDWorkflowManager();
    this.sandbox = sinon.createSandbox();
    this.mockManager = new MockManager(this.sandbox);
  }

  /**
   * TDDサイクルでテストを実行
   */
  protected async runTDDCycle<T>(
    testName: string,
    testImplementation: () => Promise<T> | T
  ): Promise<T> {
    // RED phase
    this.tddManager.startRedPhase(testName);

    try {
      const { result, duration } = await PerformanceTestHelper.measureExecutionTime(
        testImplementation,
        testName
      );

      this.tddManager.recordTestResult(testName, true, duration);
      return result;
    } catch (error) {
      this.tddManager.recordTestResult(testName, false, 0);
      throw error;
    }
  }

  /**
   * クリーンアップ
   */
  protected cleanup(): void {
    this.sandbox.restore();
    console.log(this.tddManager.generateTDDReport());
  }
}
