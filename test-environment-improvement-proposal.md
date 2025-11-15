# テスト環境改善提案

## 概要
VS Code Sidebar Terminal拡張機能のテスト環境を包括的に改善し、開発効率、品質保証、保守性を向上させる提案です。

## 現状分析

### 現在のテスト環境
- **テストフレームワーク**: Mocha + Chai + Sinon
- **カバレッジツール**: nyc (Istanbul)
- **テスト総数**: 275+ tests
- **成功率**: 93% (目標: 95%)
- **カバレッジ目標**: Lines 70%, Functions 70%, Branches 60%
- **TDD実装**: Red-Green-Refactor サイクル実装済み

### 特定された課題

#### 1. テスト実行の安定性
- **Mocha exit code 7 問題**: クリーンアップ処理で定期的にexit code 7が発生
- **プラットフォーム依存性**: Windows環境でnode-ptyモックが必要
- **表示サーバー要件**: Linux環境でxvfb必須

#### 2. E2Eテスト基盤
- **Playwright未構成**: 設定ファイルが存在しない
- **ビジュアルテスト未実装**: UIコンポーネントのビジュアルリグレッションテストがない
- **E2Eカバレッジ不足**: ユーザーシナリオベースのテストが限定的

#### 3. テストパフォーマンス
- **並列実行未対応**: テストが逐次実行されている
- **長いタイムアウト**: 30秒〜120秒の設定が多い
- **テスト実行時間**: CI/CDで30分のタイムアウト設定

#### 4. テストカバレッジ
- **目標値が低い**: 業界標準（80-90%）に比べて低い設定
- **未カバー領域**: エッジケースや例外処理のカバレッジが不足
- **カバレッジ可視化**: レポートの可視化が不十分

#### 5. ドキュメント
- **オンボーディング**: 新規開発者向けガイドが不足
- **ベストプラクティス**: 断片的なドキュメント
- **トラブルシューティング**: 既知の問題の対処法が散在

#### 6. モック・テストユーティリティ
- **モック管理**: 一元化されたモックファクトリーが不完全
- **再利用性**: テストヘルパーの再利用性が低い
- **テストデータ**: フィクスチャー管理が不明確

## 改善提案

### 優先度 1: 緊急・重要（1-2週間）

#### 1.1 テスト実行の安定化
**目標**: Mocha exit code 7問題の根本解決

**実施内容**:
- テストのクリーンアップ処理の見直し
- グローバルリソースの適切な破棄実装
- beforeEach/afterEachの最適化
- テスト隔離の強化（テスト間の状態共有排除）

**期待効果**:
- テスト成功率: 93% → 98%
- CI/CD信頼性の向上
- デバッグ時間の削減

**実装ステップ**:
```bash
# 1. 現在のクリーンアップ処理の監査
npm run compile-tests
./node_modules/.bin/mocha --reporter tap 'out/test/**/*.test.js' > test-audit.log

# 2. リソースリーク検出
npm run test:unit -- --grep "cleanup|dispose|teardown"

# 3. 修正実装
# - src/test/shared/TestSetup.ts の改善
# - 各テストファイルのafterEach見直し
```

#### 1.2 テスト並列実行の導入
**目標**: テスト実行時間を50%削減

**実施内容**:
- Mocha並列実行の有効化
- テストスイートの分割最適化
- 並列実行対応のリソース管理

**設定例**:
```json
// .mocharc.json
{
  "parallel": true,
  "jobs": 4,
  "timeout": 5000,
  "retries": 1
}
```

**package.json更新**:
```json
{
  "scripts": {
    "test:unit:parallel": "mocha --parallel --jobs 4 'out/test/unit/**/*.test.js'",
    "test:integration:parallel": "mocha --parallel --jobs 2 'out/test/integration/**/*.test.js'"
  }
}
```

**期待効果**:
- テスト実行時間: 10分 → 5分
- 開発者の待ち時間削減
- CI/CDパイプライン高速化

### 優先度 2: 重要（3-4週間）

#### 2.1 VS Code拡張機能E2Eテスト環境構築
**目標**: 完全なE2Eテスト基盤の確立

**重要**: VS Code拡張機能のE2Eテストは、通常のWebアプリケーションとは異なるアプローチが必要です。`@vscode/test-electron`を使用した拡張機能専用のテスト環境を構築します。

**実施内容**:
1. `@vscode/test-electron` ベースのE2Eテストフレームワーク構築
2. E2Eテストスイートの実装
3. VS Code APIを使用した統合テスト
4. CI/CD統合

**必要な依存関係**:
```json
{
  "devDependencies": {
    "@vscode/test-electron": "^2.3.8",
    "@types/vscode": "^1.74.0"
  }
}
```

**E2Eテストランナー設定**:
```typescript
// src/test/suite/e2e/runE2ETests.ts
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
    const extensionTestsPath = path.resolve(__dirname, './index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions', // 他の拡張機能を無効化
        '--disable-gpu',
      ],
    });
  } catch (err) {
    console.error('Failed to run E2E tests');
    process.exit(1);
  }
}

main();
```

**E2Eテスト例（VS Code API使用）**:
```typescript
// src/test/suite/e2e/terminal-lifecycle.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Terminal Lifecycle E2E Tests', () => {
  test('should create and manage multiple terminals', async () => {
    // 拡張機能のコマンドを実行
    await vscode.commands.executeCommand('secondaryTerminal.createTerminal');

    // ターミナルが作成されたことを確認
    // Note: 実際のE2Eテストでは、WebViewの状態を確認する必要があります
    // これにはカスタムメッセージングやテスト用APIが必要です

    await new Promise(resolve => setTimeout(resolve, 1000)); // WebView初期化待ち

    // スプリットコマンド実行
    await vscode.commands.executeCommand('secondaryTerminal.splitTerminal');

    await new Promise(resolve => setTimeout(resolve, 500));

    // テスト用メッセージングでWebView状態を確認
    // (実装が必要)
  });

  test('should preserve terminal session on reload', async () => {
    // セッション保存のテスト
    await vscode.commands.executeCommand('secondaryTerminal.saveSession');

    // 拡張機能の再読み込みシミュレーション
    // (実装が必要: globalStateの確認など)
  });
});
```

**今後の検討事項**:
- WebViewの状態確認のためのテスト用APIの実装
- ビジュアルリグレッションテストは別のアプローチを検討（スクリーンショット撮影など）
- Playwrightとの統合は、VS Code Web版のテストでのみ有効

**期待効果**:
- ユーザーシナリオの自動検証
- VS Code APIレベルでの統合テスト
- E2Eカバレッジ向上（目標40%）

**注意**:
Phase 2では、まず基本的なE2Eテストフレームワークを構築し、WebViewの状態確認メカニズムを段階的に追加していきます。ビジュアルリグレッションテストは Phase 3以降で検討します。

#### 2.2 テストカバレッジ目標の引き上げ
**目標**: 業界標準レベルのカバレッジ達成

**実施内容**:
- カバレッジ目標の段階的引き上げ
- 未カバー領域の特定と改善
- カバレッジレポートの可視化強化

**段階的目標**:
```json
// .nycrc.json - Phase 1 (現在)
{
  "statements": 70,
  "lines": 70,
  "functions": 70,
  "branches": 60
}

// Phase 2 (1ヶ月後)
{
  "statements": 80,
  "lines": 80,
  "functions": 75,
  "branches": 70
}

// Phase 3 (3ヶ月後) - 目標
{
  "statements": 85,
  "lines": 85,
  "functions": 80,
  "branches": 75
}
```

**カバレッジ改善スクリプト**:
```bash
#!/bin/bash
# scripts/coverage-improvement.sh

echo "📊 Generating coverage report..."
npm run test:coverage

echo "🔍 Identifying uncovered code..."
npx nyc report --reporter=text --reporter=html

echo "📈 Coverage summary:"
npx nyc report --reporter=text-summary

# 未カバー関数のリスト出力
echo "❌ Uncovered functions:"
npx nyc report --reporter=json | jq '.[] | select(.functions.pct < 80) | .path'
```

**期待効果**:
- バグ検出率の向上
- リファクタリングの安全性向上
- コード品質の向上

#### 2.3 テストドキュメント体系の整備
**目標**: 開発者が迷わないテスト環境の提供

**実施内容**:
1. **新規開発者向けオンボーディングガイド**
   - テスト環境セットアップ手順
   - 最初のテスト作成チュートリアル
   - よくある質問（FAQ）

2. **テストベストプラクティスガイド**
   - テストパターン集
   - モック作成ガイドライン
   - 非同期テストのベストプラクティス

3. **トラブルシューティングガイド**
   - 既知の問題と回避策
   - デバッグ手法
   - エラーメッセージ解説

**ドキュメント構成**:
```
docs/testing/
├── README.md                          # テスト概要
├── getting-started.md                 # 初心者ガイド
├── best-practices.md                  # ベストプラクティス
├── troubleshooting.md                 # トラブルシューティング
├── patterns/
│   ├── unit-testing.md               # ユニットテストパターン
│   ├── integration-testing.md        # 統合テストパターン
│   ├── e2e-testing.md                # E2Eテストパターン
│   └── performance-testing.md        # パフォーマンステストパターン
└── tools/
    ├── mocha-guide.md                # Mocha使用ガイド
    ├── playwright-guide.md           # Playwright使用ガイド
    └── coverage-guide.md             # カバレッジ測定ガイド
```

**期待効果**:
- 新規開発者のオンボーディング時間: 2日 → 0.5日
- テスト作成時の迷い削減
- チーム全体の知識共有

### 優先度 3: 中長期（1-3ヶ月）

#### 3.1 モック・テストユーティリティの統合
**目標**: 一元化された再利用可能なテストインフラ

**実施内容**:
```typescript
// src/test/utils/MockFactory.ts
export class UnifiedMockFactory {
  static createVSCodeContext(): vscode.ExtensionContext {
    return {
      subscriptions: [],
      workspaceState: new MockMemento(),
      globalState: new MockMemento(),
      extensionPath: '/mock/path',
      storagePath: '/mock/storage',
      globalStoragePath: '/mock/global-storage',
      logPath: '/mock/log',
      extensionUri: vscode.Uri.file('/mock/path'),
      environmentVariableCollection: new MockEnvironmentVariableCollection(),
      extensionMode: vscode.ExtensionMode.Test,
      storageUri: vscode.Uri.file('/mock/storage'),
      globalStorageUri: vscode.Uri.file('/mock/global-storage'),
      logUri: vscode.Uri.file('/mock/log'),
      asAbsolutePath: (relativePath: string) => `/mock/path/${relativePath}`,
      secrets: new MockSecretStorage(),
    };
  }

  static createTerminalInstance(options?: Partial<TerminalOptions>): Terminal {
    // 再利用可能なターミナルモック
  }

  static createWebViewMock(options?: Partial<WebViewOptions>): WebView {
    // 再利用可能なWebViewモック
  }
}

// src/test/utils/TestDataBuilder.ts
export class TestDataBuilder {
  private data: any = {};

  withTerminalCount(count: number): this {
    this.data.terminals = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Terminal ${i + 1}`,
    }));
    return this;
  }

  withScrollback(lines: string[]): this {
    this.data.scrollback = lines;
    return this;
  }

  build(): TestData {
    return this.data;
  }
}
```

**期待効果**:
- テストコードの重複削減
- テスト作成時間の短縮
- テストメンテナンス性の向上

#### 3.2 テストメトリクスダッシュボード
**目標**: テスト品質の可視化と継続的監視

**実施内容**:
1. テストメトリクス収集自動化
2. ダッシュボード構築
3. アラート設定

**メトリクス項目**:
- テスト成功率（時系列）
- カバレッジトレンド
- テスト実行時間
- フレイクテスト検出
- 新規テスト追加率

**実装例**:
```typescript
// scripts/collect-test-metrics.ts
interface TestMetrics {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  flaky: string[];
}

async function collectMetrics(): Promise<TestMetrics> {
  // テスト実行とメトリクス収集
}

async function publishMetrics(metrics: TestMetrics): Promise<void> {
  // GitHub Pagesやダッシュボードサービスに公開
}
```

**期待効果**:
- テスト品質の可視化
- 問題の早期発見
- データドリブンな改善

#### 3.3 CI/CD最適化
**目標**: CI/CDパイプライン実行時間の最小化

**実施内容**:
1. テストキャッシング戦略の改善
2. マトリックスビルドの最適化
3. テスト失敗時の診断情報強化

**CI/CD改善例**:
```yaml
# .github/workflows/ci-optimized.yml
name: CI Optimized

on: [push, pull_request]

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'

      - name: Cache test dependencies
        uses: actions/cache@v3
        with:
          path: |
            node_modules
            ~/.cache/ms-playwright
          key: ${{ runner.os }}-test-${{ hashFiles('**/package-lock.json') }}

      - name: Install dependencies
        run: npm ci --prefer-offline

      - name: Run tests (parallel)
        run: npm run test:parallel
        timeout-minutes: 10

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.os }}-node${{ matrix.node }}
          path: |
            coverage/
            test-results/
            screenshots/

      - name: Publish test report
        if: always()
        uses: mikepenz/action-junit-report@v4
        with:
          report_paths: 'test-results/junit.xml'
```

**期待効果**:
- CI/CD実行時間: 30分 → 10分
- フィードバックサイクルの高速化
- 開発者体験の向上

## 実装ロードマップ

### Phase 1: 基盤安定化 (Week 1-2)
- [ ] Mocha exit code 7問題の解決
- [ ] テスト並列実行の導入
- [ ] 基本的なドキュメント整備

**成果物**:
- 安定したテスト実行環境
- 実行時間50%削減
- オンボーディングガイド

### Phase 2: E2E強化 (Week 3-4)
- [ ] Playwright環境構築
- [ ] E2Eテストスイート実装
- [ ] ビジュアルリグレッションテスト導入

**成果物**:
- 完全なE2Eテスト環境
- ビジュアルテスト自動化
- E2Eカバレッジ40%以上

### Phase 3: カバレッジ向上 (Week 5-8)
- [ ] カバレッジ目標段階的引き上げ
- [ ] 未カバー領域の改善
- [ ] カバレッジレポート強化

**成果物**:
- カバレッジ85%達成
- エッジケーステスト充実
- カバレッジダッシュボード

### Phase 4: 継続的改善 (Week 9-12)
- [ ] モック・ユーティリティ統合
- [ ] テストメトリクスダッシュボード
- [ ] CI/CD最適化

**成果物**:
- 統合テストインフラ
- メトリクスダッシュボード
- 最適化されたCI/CD

## 期待される効果

### 定量的効果
- **テスト成功率**: 93% → 98%
- **テスト実行時間**: 10分 → 5分（並列実行）
- **CI/CD時間**: 30分 → 10分
- **カバレッジ**: 70% → 85%
- **オンボーディング時間**: 2日 → 0.5日

### 定性的効果
- 開発者の信頼性向上
- バグ早期発見率の向上
- リファクタリングの安全性向上
- チーム全体の知識共有促進
- 技術的負債の削減

## 必要なリソース

### 人的リソース
- **開発リード**: Phase 1-4 通して関与（週10-15時間）
- **開発者**: Phase別にアサイン（週5-10時間）
- **QAエンジニア**: E2Eテスト設計支援（週5時間）

### 技術的リソース
- 追加npm packages:
  - `@playwright/test` (E2Eテスト)
  - `mocha-parallel-tests` または Mocha v8+ (並列実行)
  - `nyc-config-custom` (カバレッジ設定強化)
  - テストレポートツール各種

### インフラストラクチャ
- GitHub Actions実行時間増加（現状維持で可能）
- テストレポートホスティング（GitHub Pages利用）
- メトリクスストレージ（Git LFS or 外部サービス）

## リスクと軽減策

### リスク1: 並列実行での新しい不具合
**影響**: テストが不安定になる可能性
**軽減策**:
- 段階的な導入（一部テストから開始）
- テスト隔離の徹底
- フレイクテスト検出と修正

### リスク2: E2E環境構築の複雑さ
**影響**: 実装期間が延びる可能性
**軽減策**:
- Playwright公式ドキュメントに従う
- VS Code Extension Test APIを活用
- 段階的な機能追加

### リスク3: カバレッジ向上のための工数増
**影響**: 開発速度が一時的に低下
**軽減策**:
- 段階的な目標設定
- 重要な領域から優先的に対応
- 自動化による効率化

## 成功指標（KPI）

### 短期（1-2ヶ月）
- [ ] テスト成功率 95%以上
- [ ] テスト実行時間 5分以内
- [ ] Mocha exit code 7問題 0件/週
- [ ] E2Eテストスイート構築完了

### 中期（3-6ヶ月）
- [ ] カバレッジ 85%達成
- [ ] CI/CD実行時間 10分以内
- [ ] テストフレイク率 1%以下
- [ ] ドキュメント完成度 100%

### 長期（6-12ヶ月）
- [ ] テスト成功率 98%維持
- [ ] 新規バグ検出率 向上（テストでの検出率80%以上）
- [ ] 開発者満足度 向上（サーベイ実施）
- [ ] テスト自動化率 95%以上

## まとめ

この提案は、VS Code Sidebar Terminal拡張機能のテスト環境を根本的に改善し、開発効率、品質、保守性を大幅に向上させるものです。段階的なアプローチにより、リスクを最小限に抑えながら、確実な効果を実現します。

テスト環境の改善は、短期的な投資で長期的な利益をもたらす重要な取り組みです。この提案の実装により、チーム全体の生産性向上とプロダクト品質の向上が期待できます。

---

**提案者**: Claude
**提案日**: 2025-11-08
**対象バージョン**: v0.1.94以降
**実装優先度**: High
