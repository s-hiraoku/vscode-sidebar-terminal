# Test CLAUDE.md - TDD実装効率化ガイド

このファイルはテスト駆動開発（TDD）の効率的な実装をサポートします。

## TDD実践体制

### 現在の品質レベル
- **テスト数**: 275+ テスト
- **成功率**: 93%（段階的に95%へ向上中）
- **TDDコンプライアンス**: 50%（85%まで向上予定）
- **カバレッジ**: 85%以上必須

### TDD品質ゲート（自動化済み）
```bash
# リリース前自動品質チェック
npm run pre-release:check     # 包括的品質ゲート
npm run tdd:quality-gate      # TDD品質基準チェック
npm run tdd:comprehensive-check # カバレッジ+品質+ゲート
```

## 効率的なテスト実装テンプレート

### Red-Green-Refactor サイクル
```typescript
// 1. RED - 失敗するテストを書く
describe('新機能', () => {
    it('should handle new functionality', () => {
        const result = newFeature();
        expect(result).to.equal(expectedValue); // まだ実装されていないので失敗
    });
});

// 2. GREEN - テストを通す最小限のコード
function newFeature() {
    return expectedValue; // 最小限の実装
}

// 3. REFACTOR - コードを改善
function newFeature() {
    // 適切な実装に改善
    return calculateExpectedValue();
}
```

### 高効率テストパターン

#### セッション管理テスト
```typescript
// src/test/unit/sessions/SessionManager.test.ts
describe('UnifiedSessionManager', () => {
    let sessionManager: UnifiedSessionManager;
    let mockVscode: any;
    
    beforeEach(() => {
        mockVscode = createMockVSCode();
        sessionManager = new UnifiedSessionManager(mockVscode.context);
    });
    
    afterEach(() => {
        sessionManager.dispose();
    });
    
    it('should save and restore multiple terminals', async () => {
        // Given: 複数ターミナルの状態
        const terminals = createTestTerminals(3);
        
        // When: セッション保存
        await sessionManager.saveSession(terminals);
        
        // Then: 正確に復元される
        const restored = await sessionManager.restoreSession();
        expect(restored).to.have.length(3);
        expect(restored[0].scrollback).to.equal(terminals[0].scrollback);
    });
});
```

#### WebViewマネージャーテスト
```typescript
// src/test/unit/webview/managers/MessageManager.test.ts
describe('MessageManager', () => {
    let messageManager: MessageManager;
    let mockCoordinator: IManagerCoordinator;
    
    beforeEach(() => {
        mockCoordinator = createMockCoordinator();
        messageManager = new MessageManager(mockCoordinator);
    });
    
    it('should queue messages when webview is not ready', () => {
        // Given: WebView未準備状態
        messageManager.setReady(false);
        
        // When: メッセージ送信
        messageManager.postMessage({ command: 'test', data: 'data' });
        
        // Then: キューに保存される
        expect(messageManager.getQueueSize()).to.equal(1);
    });
});
```

#### ターミナル管理テスト
```typescript
// src/test/unit/terminals/TerminalManager.test.ts
describe('TerminalManager', () => {
    let terminalManager: TerminalManager;
    
    beforeEach(() => {
        terminalManager = new TerminalManager();
    });
    
    it('should prevent infinite deletion loops', async () => {
        // Given: ターミナルが存在
        const terminal = await terminalManager.createTerminal();
        
        // When: 同時削除試行
        const deletePromises = [
            terminalManager.deleteTerminal(terminal.id),
            terminalManager.deleteTerminal(terminal.id),
            terminalManager.deleteTerminal(terminal.id)
        ];
        
        // Then: 1つだけ成功
        const results = await Promise.all(deletePromises);
        const successCount = results.filter(r => r.success).length;
        expect(successCount).to.equal(1);
    });
});
```

## テスト環境セットアップ

### TestSetup.ts パターン
```typescript
// src/test/shared/TestSetup.ts - 統一テスト環境
export function setupCompleteTestEnvironment() {
    setupJSDOMEnvironment();    // DOM環境
    setupConsoleMocks();        // Console mocking
    setupTestEnvironment();     // VS Code API mock
    
    return {
        mockVscode: getMockVscode(),
        cleanup: cleanupTestEnvironment
    };
}
```

### モックファクトリーパターン
```typescript
// src/test/utils/TDDTestHelper.ts
export class TestDataFactory {
    static createTerminalData(count: number = 1): TerminalInfo[] {
        return Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            name: `Terminal ${i + 1}`,
            scrollback: [`Line ${i + 1}`],
            isActive: i === 0
        }));
    }
    
    static createMockVSCode(): any {
        return {
            context: {
                globalState: new Map(),
                subscriptions: []
            },
            workspace: {
                getConfiguration: sinon.stub().returns({
                    get: sinon.stub()
                })
            }
        };
    }
}
```

## パフォーマンステスト

### 負荷テストパターン
```typescript
describe('Performance Tests', () => {
    it('should handle high-frequency terminal output', async () => {
        const startTime = Date.now();
        
        // 高頻度データ送信テスト
        for (let i = 0; i < 1000; i++) {
            await terminalManager.sendData(1, `Line ${i}\n`);
        }
        
        const duration = Date.now() - startTime;
        expect(duration).to.be.lessThan(1000); // 1秒以内
    });
    
    it('should prevent memory leaks', () => {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // 大量オブジェクト作成・削除
        for (let i = 0; i < 100; i++) {
            const terminal = createTestTerminal();
            terminal.dispose();
        }
        
        // GC強制実行
        if (global.gc) global.gc();
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        
        expect(memoryIncrease).to.be.lessThan(1024 * 1024); // 1MB以内
    });
});
```

## CI/CD統合テスト

### GitHub Actions品質ゲート
```yaml
# .github/workflows/quality-gate.yml
- name: TDD Quality Gate
  run: |
    npm run tdd:quality-gate
    if [ $? -ne 0 ]; then
      echo "TDD quality standards not met"
      exit 1
    fi
```

### リリース前自動チェック
```bash
# scripts/pre-release-check.sh
#!/bin/bash
set -e

echo "🔍 Running TDD quality checks..."
npm run tdd:quality-gate

echo "📊 Running test coverage..."
npm run test:coverage

echo "🧪 Running all tests..."
npm test

echo "✅ All quality gates passed!"
```

## デバッグ・トラブルシューティング

### テスト失敗パターン別対処法

#### 1. VS Code API関連エラー
```typescript
// Mock不備の場合
const setupMocks = () => {
    (global as any).vscode = {
        workspace: {
            getConfiguration: () => ({
                get: (key: string) => defaultConfigs[key]
            })
        }
    };
};
```

#### 2. 非同期処理タイミング問題
```typescript
// Promise解決待ち
it('should handle async operations', async () => {
    const promise = asyncOperation();
    await expect(promise).to.eventually.equal(expectedValue);
});

// タイムアウト設定
it('should complete within time limit', function(this: any) {
    this.timeout(5000);
    return longRunningTest();
});
```

#### 3. メモリリーク検出
```typescript
// リソース解放確認
afterEach(() => {
    // 全リソース解放
    if (testResource) {
        testResource.dispose();
        testResource = null;
    }
});
```

## TDD実践チェックリスト

### テスト作成時
- [ ] Red: 失敗するテストを先に書く
- [ ] Green: テストを通す最小限のコード
- [ ] Refactor: コードを改善
- [ ] テスト名が仕様を明確に表現
- [ ] 1テスト1機能の原則
- [ ] setup/teardown適切に実装

### 品質保証時
- [ ] TDD品質ゲートクリア（50%以上）
- [ ] テストカバレッジ85%以上
- [ ] 全テスト実行・成功確認
- [ ] パフォーマンステスト実行
- [ ] メモリリークチェック
- [ ] CI/CD品質ゲート通過

### リファクタリング時
- [ ] 既存テストが通ることを確認
- [ ] テストケース追加（新機能分）
- [ ] テスト実行時間確認
- [ ] モック・スタブ適切性確認
- [ ] エッジケーステスト追加

このガイドでTDD品質を維持しながら効率的な実装が可能です。