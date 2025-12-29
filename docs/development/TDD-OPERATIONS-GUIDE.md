# TDD運用ガイド

## 概要

本ドキュメントは、VS Code Sidebar Terminal プロジェクトにおけるt-wada氏のTDD手法に基づいた開発環境の運用方法を説明します。

構築されたTDDインフラストラクチャを効果的に活用して、高品質なコードを継続的に開発するための実践的なガイドです。

## 🎯 TDDインフラストラクチャの構成

### 構築済みシステム

1. **TDDメトリクス収集システム** (`src/test/utils/TDDMetrics.ts`)
2. **自動化TDDワークフロー** (`scripts/tdd-workflow-automation.js`)
3. **品質チェック機能** (`scripts/tdd-quality-checker.js`)
4. **VSCodeタスク統合** (`.vscode/tasks.json`)
5. **テスト実行スクリプト** (`scripts/tdd-test-runner.js`)

## 🚀 日常の開発ワークフロー

### 1. 基本的なTDDサイクル

#### Red Phase（失敗テスト作成）

```bash
# テストファイル作成・編集後、失敗を確認
npm run tdd:red
```

**手順：**
1. 新機能のテストを作成（必ず失敗するように）
2. 上記コマンドで失敗を確認
3. 失敗理由が期待通りであることを確認

#### Green Phase（最小実装）

```bash
# 実装を追加して、テストを通す
npm run tdd:green
```

**手順：**
1. テストを通すための最小限の実装を追加
2. 上記コマンドでテスト通過を確認
3. 実装が過剰でないことを確認

#### Refactor Phase（リファクタリング）

```bash
# リファクタリング後、品質を確認
npm run tdd:refactor
```

**手順：**
1. コードの重複除去・可読性向上
2. 上記コマンドでテストが通り続けることを確認
3. 品質メトリクスの改善を確認

### 2. 統合ワークフロー

#### インタラクティブTDDセッション

```bash
# 対話型TDDワークフローを開始
npm run tdd:interactive
```

このコマンドは：
- 現在のフェーズを判定
- 次に実行すべきアクションを提案
- 品質チェックを自動実行
- メトリクス収集を自動化

#### 品質総合チェック

```bash
# 総合的な品質評価を実行
npm run tdd:check-quality
```

出力例：
```
========== TDD Quality Report ==========
Overall Quality Score: 8.2/10

Phase Distribution:
- Red phases: 45%
- Green phases: 35% 
- Refactor phases: 20%

Test Quality:
- Test coverage: 95%
- Test count: 275
- Passing rate: 93%

Code Quality:
- ESLint score: 100%
- TypeScript compliance: 100%
- Code duplication: Low

Recommendations:
✅ Excellent TDD practice!
⚠️  Consider adding more edge case tests
========================================
```

## 📊 メトリクス活用

### TDDメトリクス確認

```bash
# 現在のTDDメトリクスを表示
node scripts/tdd-test-runner.js --show-metrics
```

**追跡される指標：**
- **TDD遵守率**: Red-Green-Refactorサイクルの遵守度
- **フェーズ時間**: 各フェーズでの滞在時間
- **テスト品質**: テストカバレッジ、テスト数、成功率
- **コード品質**: ESLint準拠率、TypeScript型安全性

### VSCodeタスク統合

VSCodeのコマンドパレット（Ctrl+Shift+P）から：

1. **Tasks: Run Task** → **TDD: Interactive Workflow**
2. **Tasks: Run Task** → **TDD: Quality Check**
3. **Tasks: Run Task** → **TDD: Red Phase**
4. **Tasks: Run Task** → **TDD: Green Phase**
5. **Tasks: Run Task** → **TDD: Refactor Phase**

## 🎨 新機能開発の実践例

### 例：新しいUI設定パネル機能の追加

#### Step 1: Red Phase
```bash
# 1. テストファイル作成
touch src/test/unit/components/NewFeaturePanel.test.ts

# 2. 失敗テストを作成
cat > src/test/unit/components/NewFeaturePanel.test.ts << 'EOF'
import { expect } from 'chai';
import { NewFeaturePanel } from '../../../webview/components/NewFeaturePanel';

describe('NewFeaturePanel', () => {
  it('should render with default settings', () => {
    const panel = new NewFeaturePanel();
    expect(panel.isVisible()).to.be.false;
  });
});
EOF

# 3. Red Phaseを実行（失敗を確認）
npm run tdd:red
```

**期待される結果**: テストが失敗し、`NewFeaturePanel`クラスが存在しないエラー

#### Step 2: Green Phase
```bash
# 1. 最小実装を作成
touch src/webview/components/NewFeaturePanel.ts

# 2. 最小限のクラスを実装
cat > src/webview/components/NewFeaturePanel.ts << 'EOF'
export class NewFeaturePanel {
  public isVisible(): boolean {
    return false;
  }
}
EOF

# 3. Green Phaseを実行（成功を確認）
npm run tdd:green
```

**期待される結果**: テストが通過

#### Step 3: Refactor Phase
```bash
# 1. コードの改善（例：型安全性向上）
# NewFeaturePanel.tsを編集してより堅牢にする

# 2. Refactor Phaseを実行
npm run tdd:refactor

# 3. 品質チェック
npm run tdd:check-quality
```

## 🔍 テスト実行とデバッグ

### 単体テスト実行

```bash
# 全体テスト
npm test

# 特定コンポーネントのテスト
npm run compile-tests
./node_modules/.bin/mocha --require out/test/shared/TestSetup.js 'out/test/unit/components/SettingsPanel.test.js'

# カバレッジ付きテスト
npm run test:coverage
```

### テストデバッグ

#### TypeScript設定
```bash
# TypeScriptコンパイルエラーの確認
npm run compile-tests

# 型チェックのみ
npx tsc --noEmit
```

#### ESLint設定
```bash
# コード品質チェック
npm run lint

# 自動修正
npm run lint -- --fix
```

### 一般的な問題の解決

#### 1. テスト失敗時の対処

```bash
# 詳細なテスト結果表示
npm test -- --reporter spec

# 特定のテストのみ実行
npm test -- --grep "SettingsPanel"
```

#### 2. TDDメトリクス異常時

```bash
# メトリクスリセット
rm -f tdd-metrics.json

# 新しいTDDサイクル開始
npm run tdd:interactive
```

#### 3. コンパイルエラー解決

```bash
# 段階的な修正アプローチ
npm run compile-tests  # エラー確認
# エラー修正
npm run compile-tests  # 再確認
```

## ⚙️ 設定とカスタマイズ

### TDDメトリクス設定

`src/test/utils/TDDMetrics.ts`で調整可能：

```typescript
// メトリクス収集間隔
private readonly METRICS_SAVE_INTERVAL = 5000; // 5秒

// 品質しきい値
private readonly QUALITY_THRESHOLDS = {
  tddCompliance: 0.8,    // 80%以上
  testCoverage: 0.9,     // 90%以上
  codeQuality: 0.8       // 80%以上
};
```

### ワークフロー設定

`scripts/tdd-workflow-automation.js`で調整可能：

```javascript
// TDDフェーズの自動判定設定
const TDD_PHASE_CONFIG = {
  redPhaseTimeout: 300000,      // 5分
  greenPhaseTimeout: 600000,    // 10分
  refactorPhaseTimeout: 900000  // 15分
};
```

### VSCodeタスク設定

`.vscode/tasks.json`でショートカットキー設定：

```json
{
  "key": "ctrl+shift+t",
  "command": "workbench.action.tasks.runTask",
  "args": "TDD: Interactive Workflow"
}
```

## 📈 継続的改善

### 週次品質レビュー

```bash
# 週次TDDレポート生成
npm run tdd:weekly-report
```

### メトリクス傾向分析

```bash
# TDD遵守率の傾向表示
node scripts/tdd-quality-checker.js --trend-analysis
```

### チーム共有

#### プルリクエスト時
```bash
# PR用品質レポート生成
npm run tdd:pr-report > tdd-pr-summary.md
```

#### コードレビュー時の確認項目
1. ✅ TDD遵守率が80%以上
2. ✅ テストカバレッジが90%以上  
3. ✅ ESLintエラーが0個
4. ✅ TypeScriptコンパイルエラーなし

## 🚨 よくある問題と解決策

### Q1: テストが通らない
```bash
# デバッグ用詳細実行
npm test -- --verbose
```

### Q2: TDDメトリクスが記録されない
```bash
# メトリクスシステム再初期化
node -e "require('./src/test/utils/TDDMetrics').TDDMetrics.getInstance().reset()"
```

### Q3: VSCodeタスクが動作しない
```bash
# タスク設定を再読み込み
# VS Code: Ctrl+Shift+P → "Tasks: Configure Task"
```

### Q4: パフォーマンス問題
```bash
# テスト並列実行
npm test -- --parallel

# 高速モード
npm run test:unit  # 統合テストをスキップ
```

## 📚 参考資料

### 推奨図書
- 『テスト駆動開発』by Kent Beck
- 『リファクタリング』by Martin Fowler  
- t-wada氏の講演資料・ブログ

### 社内資源
- [TDDベストプラクティス集](./TDD-BEST-PRACTICES.md)
- [テスト設計ガイドライン](./TEST-DESIGN-GUIDELINES.md)
- [CI/CD統合手順](./CI-CD-INTEGRATION.md)

### 外部リンク
- [TDD研修資料](https://github.com/twada/js-testing-tutorial)
- [JavaScript テスティングフレームワーク比較](https://github.com/twada/js-testing-best-practices)

---

## 🎉 まとめ

このTDDインフラストラクチャにより、以下が実現されます：

- **自動化されたRed-Green-Refactorサイクル**
- **リアルタイム品質メトリクス**
- **継続的な品質改善**
- **チーム全体でのTDD標準化**

継続的に活用することで、高品質で保守しやすいコードベースを維持できます。

質問や改善提案がありましたら、開発チームまでお気軽にご連絡ください。