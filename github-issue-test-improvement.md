# GitHub Issue: テスト環境の包括的改善提案

---

**Title**:
```
テスト環境の包括的改善: 安定性・E2E・カバレッジ・パフォーマンスの向上
```

**Labels**:
```
enhancement, testing, documentation, ci/cd, priority-high
```

**Assignees**:
```
(プロジェクトオーナーまたはメンテナーを指定)
```

---

## 概要

VS Code Sidebar Terminal拡張機能のテスト環境を包括的に改善し、以下の目標を達成する提案です：

- ✅ テスト成功率: 93% → 98%
- ✅ テスト実行時間: 50%削減（10分 → 5分）
- ✅ カバレッジ: 70% → 85%
- ✅ E2Eテスト環境の完全構築
- ✅ CI/CD実行時間: 30分 → 10分

## 背景・課題

### 現在のテスト環境の状況
- **テストフレームワーク**: Mocha + Chai + Sinon ✅
- **カバレッジツール**: nyc (Istanbul) ✅
- **テスト総数**: 275+ tests ✅
- **成功率**: 93% ⚠️
- **TDD実装**: Red-Green-Refactor実装済み ✅

### 発見された主要な課題

#### 1. テスト実行の不安定性 🔴
- **Mocha exit code 7問題**: クリーンアップ処理で定期的に発生
- **プラットフォーム依存**: Windows環境でnode-ptyモック必須
- **CI/CD回避策**: exit code 7を許容する設定で対処中（根本解決なし）

**影響**:
- CI/CDの信頼性低下
- 開発者の混乱
- デバッグ時間の増加

#### 2. E2Eテスト環境の未整備 🔴
- Playwright設定ファイルが存在しない
- ビジュアルリグレッションテスト未実装
- ユーザーシナリオベースのE2Eテストが限定的

**影響**:
- UIリグレッションの見逃し
- ユーザー体験の問題が本番で発見される
- 手動テストへの依存

#### 3. テストパフォーマンス ⚠️
- 並列実行が未設定
- タイムアウト設定が長い（30-120秒）
- CI/CDで30分のタイムアウト

**影響**:
- 開発者の待ち時間増加
- フィードバックサイクルの遅延
- CI/CDリソースの浪費

#### 4. カバレッジ目標が低い ⚠️
現在の目標:
- Lines: 70%
- Functions: 70%
- Branches: 60%

業界標準（80-90%）と比較して低い

**影響**:
- エッジケースのバグ見逃し
- リファクタリング時のリスク
- コード品質の担保不足

## 提案内容

### 📋 優先度1: 緊急・重要（1-2週間）

#### ✅ 1.1 テスト実行の安定化
**ゴール**: Mocha exit code 7問題の根本解決

**実施項目**:
- [ ] テストクリーンアップ処理の全面見直し
- [ ] グローバルリソースの適切な破棄実装
- [ ] beforeEach/afterEachの最適化
- [ ] テスト隔離の強化（テスト間の状態共有排除）

**期待効果**:
- テスト成功率: 93% → 98%
- exit code 7発生: 週数回 → 0件

**技術的アプローチ**:
```typescript
// 改善例: src/test/shared/TestSetup.ts
export function setupTestEnvironment() {
  const cleanupTasks: Array<() => void> = [];

  beforeEach(function() {
    // リソース初期化
    this.testResources = new Map();
  });

  afterEach(async function() {
    // 確実なクリーンアップ
    for (const cleanup of cleanupTasks.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    cleanupTasks.length = 0;

    // リソース解放確認
    this.testResources.clear();
  });
}
```

#### ✅ 1.2 テスト並列実行の導入
**ゴール**: テスト実行時間を50%削減

**実施項目**:
- [ ] Mocha並列実行の有効化
- [ ] テストスイートの分割最適化
- [ ] 並列実行対応のリソース管理実装

**設定変更**:
```json
// .mocharc.json
{
  "parallel": true,
  "jobs": 4,
  "timeout": 5000,
  "retries": 1,
  "require": [
    "source-map-support/register",
    "out/test/shared/TestSetup.js"
  ]
}
```

**package.json更新**:
```json
{
  "scripts": {
    "test:unit": "mocha --parallel --jobs 4 'out/test/unit/**/*.test.js'",
    "test:integration": "mocha --parallel --jobs 2 'out/test/integration/**/*.test.js'",
    "test:performance": "mocha 'out/test/performance/**/*.test.js'"
  }
}
```

**期待効果**:
- ユニットテスト実行時間: 10分 → 5分
- 開発者の待ち時間50%削減

### 📋 優先度2: 重要（3-4週間）

#### ✅ 2.1 Playwright E2Eテスト環境構築
**ゴール**: 完全なE2Eテスト基盤の確立

**実施項目**:
- [ ] Playwright設定ファイル作成
- [ ] E2Eテストスイート実装（基本シナリオ）
- [ ] ビジュアルリグレッションテスト導入
- [ ] CI/CD統合

**新規ファイル**:
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }]
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run start:test',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
```

**E2Eテスト例**:
```typescript
// e2e/terminal-operations.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Terminal Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should create new terminal', async ({ page }) => {
    await page.click('[data-testid="create-terminal"]');
    await expect(page.locator('.terminal-instance')).toHaveCount(1);

    // ビジュアルリグレッション
    await expect(page).toHaveScreenshot('terminal-created.png');
  });

  test('should split terminal vertically', async ({ page }) => {
    await page.click('[data-testid="create-terminal"]');
    await page.click('[data-testid="split-vertical"]');
    await expect(page.locator('.terminal-instance')).toHaveCount(2);

    // レイアウト検証
    const terminals = page.locator('.terminal-instance');
    await expect(terminals.first()).toBeVisible();
    await expect(terminals.last()).toBeVisible();

    await expect(page).toHaveScreenshot('terminal-split-vertical.png');
  });

  test('should preserve terminal on reload', async ({ page }) => {
    await page.click('[data-testid="create-terminal"]');
    await page.type('.terminal-input', 'echo "test content"');

    await page.reload();

    // セッション復元確認
    await expect(page.locator('.terminal-instance')).toHaveCount(1);
    await expect(page.locator('.terminal-output')).toContainText('test content');
  });
});
```

**期待効果**:
- E2Eカバレッジ: 0% → 40%
- UIリグレッション自動検出
- ユーザーシナリオの自動検証

#### ✅ 2.2 テストカバレッジ目標の段階的引き上げ
**ゴール**: 業界標準レベル（85%）のカバレッジ達成

**段階的目標**:

Phase 1 (現在):
```json
{
  "statements": 70,
  "lines": 70,
  "functions": 70,
  "branches": 60
}
```

Phase 2 (1ヶ月後):
```json
{
  "statements": 80,
  "lines": 80,
  "functions": 75,
  "branches": 70
}
```

Phase 3 (3ヶ月後 - 目標):
```json
{
  "statements": 85,
  "lines": 85,
  "functions": 80,
  "branches": 75
}
```

**実施項目**:
- [ ] 未カバー領域の特定スクリプト作成
- [ ] 重要度順の改善計画策定
- [ ] カバレッジレポートの可視化強化
- [ ] 週次カバレッジモニタリング

**カバレッジ改善スクリプト**:
```bash
#!/bin/bash
# scripts/coverage-improvement.sh

echo "📊 Generating detailed coverage report..."
npm run test:coverage

echo "🔍 Identifying uncovered critical paths..."
npx nyc report --reporter=json > coverage/coverage-summary.json

# 未カバー関数のリスト（カバレッジ80%未満）
echo "❌ Functions with < 80% coverage:"
node scripts/analyze-coverage.js

# カバレッジトレンド記録
echo "📈 Recording coverage trend..."
node scripts/record-coverage-trend.js
```

**期待効果**:
- カバレッジ: 70% → 85%
- エッジケースバグ検出率向上
- リファクタリングの安全性向上

#### ✅ 2.3 テストドキュメント体系の整備
**ゴール**: 新規開発者が迷わないテスト環境

**ドキュメント構成**:
```
docs/testing/
├── README.md                          # テスト概要・目次
├── getting-started.md                 # セットアップ〜初テスト
├── best-practices.md                  # ベストプラクティス集
├── troubleshooting.md                 # よくある問題と解決法
├── patterns/
│   ├── unit-testing.md               # ユニットテストパターン
│   ├── integration-testing.md        # 統合テストパターン
│   ├── e2e-testing.md                # E2Eテストパターン
│   └── performance-testing.md        # パフォーマンステスト
└── tools/
    ├── mocha-guide.md                # Mocha詳細ガイド
    ├── playwright-guide.md           # Playwright詳細ガイド
    └── coverage-guide.md             # カバレッジ測定ガイド
```

**実施項目**:
- [ ] 各ドキュメントの作成
- [ ] コード例の充実
- [ ] FAQセクションの追加
- [ ] ビジュアルダイアグラムの作成

**期待効果**:
- オンボーディング時間: 2日 → 0.5日
- テスト作成時の迷い削減
- チーム知識の共有促進

### 📋 優先度3: 中長期（1-3ヶ月）

#### ✅ 3.1 統合モック・テストユーティリティライブラリ
**ゴール**: 一元化された再利用可能なテストインフラ

**実施項目**:
- [ ] UnifiedMockFactory実装
- [ ] TestDataBuilder実装
- [ ] 共通テストヘルパー整備

#### ✅ 3.2 テストメトリクスダッシュボード
**ゴール**: テスト品質の可視化と継続的監視

**実施項目**:
- [ ] メトリクス収集自動化
- [ ] ダッシュボード構築（GitHub Pages）
- [ ] フレイクテスト検出システム

#### ✅ 3.3 CI/CD最適化
**ゴール**: CI/CD実行時間の最小化

**実施項目**:
- [ ] テストキャッシング戦略改善
- [ ] マトリックスビルド最適化
- [ ] 失敗時診断情報強化

## 実装ロードマップ

### 🗓 Phase 1: 基盤安定化（Week 1-2）
**ゴール**: テスト実行の信頼性確保

タスク:
- [ ] Mocha exit code 7問題の根本解決
- [ ] テスト並列実行の導入
- [ ] 基本ドキュメント作成

**成果物**:
- ✅ 安定したテスト実行（成功率98%）
- ✅ 実行時間50%削減
- ✅ getting-started.mdとtroubleshooting.md

**完了条件**:
- exit code 7が1週間発生しない
- 全テストが並列実行可能
- 新規開発者がドキュメントのみでテスト実行可能

---

### 🗓 Phase 2: E2E強化（Week 3-4）
**ゴール**: 完全なE2Eテスト環境の構築

タスク:
- [ ] Playwright環境構築
- [ ] 基本E2Eテストスイート実装（10シナリオ）
- [ ] ビジュアルリグレッションテスト導入

**成果物**:
- ✅ playwright.config.ts
- ✅ E2Eテストスイート（10+シナリオ）
- ✅ ビジュアルテスト自動化
- ✅ CI/CD統合

**完了条件**:
- E2Eテストが自動実行される
- ビジュアルリグレッション検出が機能
- E2Eカバレッジ40%達成

---

### 🗓 Phase 3: カバレッジ向上（Week 5-8）
**ゴール**: カバレッジ85%達成

タスク:
- [ ] 未カバー領域の特定と改善
- [ ] エッジケーステスト追加
- [ ] カバレッジレポート強化

**成果物**:
- ✅ カバレッジ85%達成
- ✅ エッジケーステスト充実
- ✅ カバレッジダッシュボード

**完了条件**:
- statements, lines, functions: 85%
- branches: 75%
- 重要パス100%カバレッジ

---

### 🗓 Phase 4: 継続的改善（Week 9-12）
**ゴール**: 長期的な品質維持基盤の確立

タスク:
- [ ] 統合モック・ユーティリティライブラリ
- [ ] テストメトリクスダッシュボード
- [ ] CI/CD最適化

**成果物**:
- ✅ UnifiedMockFactory
- ✅ メトリクスダッシュボード
- ✅ 最適化CI/CD（10分以内）

**完了条件**:
- テスト作成時間30%削減
- CI/CD実行時間10分以内
- メトリクス自動公開

## 期待される効果

### 📊 定量的効果

| 指標 | 現在 | 目標 | 改善率 |
|------|------|------|--------|
| テスト成功率 | 93% | 98% | +5% |
| テスト実行時間 | 10分 | 5分 | -50% |
| CI/CD実行時間 | 30分 | 10分 | -67% |
| カバレッジ (lines) | 70% | 85% | +15% |
| カバレッジ (branches) | 60% | 75% | +15% |
| E2Eカバレッジ | 0% | 40% | +40% |
| オンボーディング時間 | 2日 | 0.5日 | -75% |

### 🎯 定性的効果

- **開発者体験**: テスト実行が高速・安定し、開発フローがスムーズに
- **品質向上**: エッジケースのバグ早期発見、リグレッション防止
- **リファクタリング**: 高カバレッジにより安全なリファクタリングが可能
- **チーム効率**: ドキュメント整備により知識共有が促進
- **技術的負債**: テストインフラの整備により負債削減

## 必要なリソース

### 人的リソース
- **開発リード**: 全Phase通して関与（週10-15時間）
- **開発者**: 各Phase 1-2名（週5-10時間）
- **QAエンジニア**: E2E設計支援（Phase 2, 週5時間）

### 技術的リソース
追加npm packages:
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "mocha": "^10.8.2",  // 並列実行対応
    "playwright-lighthouse": "^3.0.0",  // パフォーマンステスト
    "axe-playwright": "^1.2.3"  // アクセシビリティテスト
  }
}
```

### インフラストラクチャ
- GitHub Actions実行時間: 現状維持で可能
- GitHub Pages: テストレポート・ダッシュボードホスティング
- ストレージ: テストレポート・スクリーンショット（Git LFS検討）

## リスクと軽減策

### ⚠️ リスク1: 並列実行での新しい不具合
**影響度**: 中
**発生確率**: 高

**軽減策**:
- 段階的導入（一部テストから開始）
- テスト隔離の徹底
- フレイクテスト検出システム導入
- ロールバック計画の準備

### ⚠️ リスク2: E2E環境構築の複雑さ
**影響度**: 中
**発生確率**: 中

**軽減策**:
- Playwright公式ドキュメントに従う
- VS Code Extension Test API活用
- 段階的な機能追加（MVP→フル機能）
- 外部専門家への相談

### ⚠️ リスク3: カバレッジ向上の工数増
**影響度**: 低
**発生確率**: 中

**軽減策**:
- 段階的な目標設定
- 重要領域から優先対応
- 自動化による効率化
- ペアプログラミングでの知識共有

## 成功指標（KPI）

### 短期（1-2ヶ月）
- [ ] テスト成功率 95%以上を1週間維持
- [ ] テスト実行時間 5分以内
- [ ] Mocha exit code 7問題 0件/週
- [ ] E2Eテストスイート10シナリオ以上
- [ ] ドキュメント4ページ以上公開

### 中期（3-6ヶ月）
- [ ] カバレッジ 85%達成・維持
- [ ] CI/CD実行時間 10分以内
- [ ] テストフレイク率 1%以下
- [ ] ドキュメント完成度 100%
- [ ] E2Eカバレッジ 40%以上

### 長期（6-12ヶ月）
- [ ] テスト成功率 98%維持
- [ ] バグ検出率（テスト）80%以上
- [ ] 開発者満足度調査 4.5/5.0以上
- [ ] テスト自動化率 95%以上
- [ ] 技術的負債削減 30%

## 関連Issue・PR

- 関連Issue: #XXX（既存のテスト関連Issue）
- 参照ドキュメント:
  - `src/test/TDD-Implementation-Strategy.md`
  - `src/test/CLAUDE.md`
  - `.github/workflows/ci.yml`
  - `.github/workflows/tdd-quality-check.yml`

## 追加情報

### 詳細な技術提案
詳細な実装案は以下のドキュメントを参照:
- `test-environment-improvement-proposal.md`（このリポジトリのルートに配置）

### フィードバック
この提案に対するフィードバックや質問は、このIssueのコメントでお願いします。

---

**提案者**: @s-hiraoku
**提案日**: 2025-11-08
**対象バージョン**: v0.1.94以降
**実装優先度**: High
**推定工数**: 10-12 weeks (段階的実装)
