# TDD運用ガイドライン

このドキュメントでは、VS Code Sidebar Terminal 拡張機能におけるTest-Driven Development（TDD）の運用ルールと実践方法について説明します。

## 🎯 TDD基本原則

### Red-Green-Refactorサイクル

```
🔴 RED    → ❌ 失敗するテストを書く
🟢 GREEN  → ✅ テストが通る最小限のコードを書く
🔵 REFACTOR → 🔧 コードを改善する（テストは通ったまま）
```

### TDD実践の必須ルール

1. **テストファースト**: 実装する前に必ずテストを書く
2. **最小限の実装**: テストを通すための最小限のコードのみ書く
3. **継続的リファクタリング**: テストが通った状態でコードを改善する
4. **品質ゲート遵守**: リリース前に必ず品質基準をクリアする

## 📊 品質基準（Quality Gate）

### 現在の品質基準

| 項目 | 基準値 | 説明 |
|-----|--------|------|
| **TDDコンプライアンス** | 50%以上 | TDD原則に従って開発されたコードの割合 |
| **テストカバレッジ** | 85%以上 | コードがテストでカバーされている割合 |
| **ESLint準拠** | 100% | ESLintエラーが0個 |
| **テスト数** | 70個以上 | 最低限のテスト数 |
| **テスト成功率** | 60%以上 | テストの成功率（現実的な初期目標） |

### 品質基準の段階的向上計画

**Phase 1（現在）**: 基盤確立
- TDDコンプライアンス: 50%
- テスト成功率: 60%
- テストカバレッジ: 85%

**Phase 2（6ヶ月後）**: 品質向上
- TDDコンプライアンス: 70%
- テスト成功率: 75%
- テストカバレッジ: 90%

**Phase 3（1年後）**: 高品質実現
- TDDコンプライアンス: 85%
- テスト成功率: 90%
- テストカバレッジ: 95%

## 🔄 開発ワークフロー

### 日常開発でのTDDサイクル

```bash
# 1. REDフェーズ: 失敗するテストを書く
npm run tdd:red

# 2. GREENフェーズ: テストを通す最小限のコードを書く
npm run tdd:green

# 3. REFACTORフェーズ: コードを改善する
npm run tdd:refactor

# 4. TDDサイクル全体を自動実行
npm run tdd:cycle
```

### 機能開発の標準手順

1. **要件分析**
   - ユーザーストーリーの理解
   - テストケースの設計
   - 期待される動作の明確化

2. **テスト作成（RED）**
   ```bash
   # テストファイル作成
   touch src/test/unit/新機能.test.ts
   
   # 失敗するテストを実行
   npm run tdd:red
   ```

3. **実装（GREEN）**
   ```bash
   # 最小限の実装でテストを通す
   npm run tdd:green
   ```

4. **リファクタリング（REFACTOR）**
   ```bash
   # コード品質を改善
   npm run tdd:refactor
   
   # 全体の品質チェック
   npm run tdd:comprehensive-check
   ```

5. **統合テスト**
   ```bash
   # 全テスト実行
   npm test
   
   # カバレッジチェック
   npm run test:coverage
   ```

## 🛠️ 実用コマンド集

### 開発時のコマンド

```bash
# TDD品質チェック（開発中）
npm run tdd:check-quality

# 包括的品質チェック（統合前）
npm run tdd:comprehensive-check

# 品質ゲートチェック（リリース前）
npm run tdd:quality-gate

# TDDレポート生成
npm run tdd:generate-report
```

### テスト実行コマンド

```bash
# 基本テスト実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# 特定テストファイル実行
npm run compile-tests
./node_modules/.bin/mocha --require out/test/shared/TestSetup.js 'out/test/unit/specific/*.test.js'

# ウォッチモード
npm run watch-tests
```

## 🚦 リリース前品質ゲート

### 自動品質チェック

リリース時（`npm run release:patch`等）に以下が自動実行されます：

1. **Pre-Release Quality Gate**
   - TDD包括的チェック実行
   - 品質基準クリアの確認
   - 失敗時はリリース自動停止

2. **品質レポート生成**
   - GitHub Release添付用レポート作成
   - TDDメトリクス記録
   - 改善提案の自動生成

### 手動品質チェック手順

リリース前に開発者が実行すべきコマンド：

```bash
# 1. 全体品質チェック
npm run tdd:comprehensive-check

# 2. 品質ゲート確認
npm run tdd:quality-gate

# 3. 問題が無い場合のみリリース実行
npm run release:patch  # または minor/major
```

## 📋 テスト組織と命名規則

### テストファイル構成

```
src/test/
├── unit/                    # ユニットテスト
│   ├── components/         # コンポーネントテスト
│   ├── managers/           # マネージャークラステスト
│   ├── utils/              # ユーティリティテスト
│   └── sessions/           # セッション管理テスト
├── integration/            # 統合テスト
└── shared/                # テスト共通設定
    └── TestSetup.ts       # モック設定
```

### テスト命名規則

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should return expected result when given valid input', () => {
      // テストケース
    });
    
    it('should throw error when given invalid input', () => {
      // エラーケーステスト
    });
  });
});
```

### テスト種別とカバレッジ目標

| テスト種別 | カバレッジ目標 | 説明 |
|-----------|--------------|------|
| **ユニットテスト** | 90%以上 | 個別関数・メソッドの動作確認 |
| **統合テスト** | 80%以上 | コンポーネント間の連携確認 |
| **E2Eテスト** | 主要フロー100% | ユーザーシナリオの動作確認 |

## 🔍 品質監視と改善

### 継続的品質監視

1. **日次チェック**
   - CI/CDでの自動テスト実行
   - 品質メトリクス記録
   - 品質低下の早期発見

2. **週次レビュー**
   - TDDコンプライアンス確認
   - テストカバレッジ分析
   - 改善計画の策定

3. **月次品質レポート**
   - 品質トレンド分析
   - 開発チーム振り返り
   - 品質基準の見直し

### 品質問題への対応

#### TDD品質ゲート失敗時の対応手順

1. **問題の特定**
   ```bash
   # 詳細なレポート生成
   npm run tdd:generate-report
   
   # 失敗したテストの確認
   npm test
   ```

2. **優先度判定**
   - **Critical**: リリースブロッカー（即座に修正）
   - **High**: 品質基準未達（修正必須）
   - **Medium**: 改善推奨（次回リリースで対応）

3. **修正実施**
   ```bash
   # 問題修正後の確認
   npm run tdd:comprehensive-check
   
   # 品質ゲート再実行
   npm run tdd:quality-gate
   ```

## 📚 TDDベストプラクティス

### DO: 推奨事項

✅ **テスト先行開発**
- 機能実装前に必ずテストを書く
- テストで期待する動作を明確化する

✅ **小さな単位でのテスト**
- 1つのテストは1つの動作のみを検証
- テストケースは独立性を保つ

✅ **わかりやすいテスト名**
- テストの意図が明確になる命名
- 失敗時の原因特定が容易

✅ **継続的リファクタリング**
- テストが通った状態での改善
- 技術的負債の蓄積防止

### DON'T: 避けるべき事項

❌ **テスト後回し**
- 実装後のテスト追加は禁止
- テストファーストの原則を遵守

❌ **巨大なテストケース**
- 複数の動作を1つのテストで検証
- 失敗原因の特定が困難

❌ **テスト間の依存関係**
- テスト実行順序に依存した設計
- 他のテストの状態に依存

❌ **品質ゲート無視**
- 基準未達成でのリリース強行
- 技術的負債の意図的蓄積

## 🚀 実装例とサンプルコード

### TDD実践例：新機能開発

```typescript
// 1. REDフェーズ: テスト作成（失敗する）
describe('TerminalSplitter', () => {
  it('should split terminal horizontally', () => {
    const splitter = new TerminalSplitter();
    const result = splitter.splitHorizontally();
    expect(result.orientation).to.equal('horizontal');
    expect(result.terminals.length).to.equal(2);
  });
});

// 2. GREENフェーズ: 最小限の実装
class TerminalSplitter {
  splitHorizontally() {
    return {
      orientation: 'horizontal',
      terminals: [{}, {}]
    };
  }
}

// 3. REFACTORフェーズ: 改善
class TerminalSplitter {
  splitHorizontally(): SplitResult {
    return {
      orientation: SplitOrientation.Horizontal,
      terminals: [
        new Terminal({ id: generateId() }),
        new Terminal({ id: generateId() })
      ]
    };
  }
}
```

### テストモックの活用

```typescript
describe('MessageManager', () => {
  let mockWebview: sinon.SinonStubbedInstance<vscode.Webview>;
  
  beforeEach(() => {
    mockWebview = sinon.createStubInstance(vscode.Webview);
  });
  
  it('should send message to webview', () => {
    const manager = new MessageManager(mockWebview);
    manager.sendMessage({ type: 'test', data: 'example' });
    
    expect(mockWebview.postMessage).to.have.been.calledOnceWith({
      type: 'test',
      data: 'example'
    });
  });
});
```

## 🎓 TDD学習リソース

### 推奨書籍・記事
- 「テスト駆動開発」Kent Beck著
- 「リファクタリング」Martin Fowler著
- VS Code Extension Testing Guide

### 実践トレーニング
- TDDペアプログラミングセッション
- コードレビューでのTDD観点チェック
- 品質メトリクス分析ワークショップ

## 📈 成果測定とKPI

### 開発生産性指標
- 機能開発速度（Story Point/Sprint）
- バグ発生率（件数/リリース）
- コードレビュー時間短縮率

### 品質指標
- テストカバレッジ推移
- TDDコンプライアンス向上率
- 技術的負債削減率

### チーム満足度
- 開発者満足度調査
- TDD実践の負担感
- 品質向上実感

---

## 🔗 関連ドキュメント

- [CLAUDE.md](CLAUDE.md) - 開発ガイドライン全般
- [RELEASE_PROCESS.md](RELEASE_PROCESS.md) - リリース手順
- [テストディレクトリ](src/test/) - 実際のテストコード

## 📞 サポート・質問

TDD実践で困った場合：
1. 開発チーム内でのペアプログラミング相談
2. 品質ゲート失敗時のトラブルシューティング参照
3. GitHub Issues でのTDD関連質問投稿

**Remember**: TDDは品質向上のツールです。完璧を求めすぎず、継続的改善を心がけましょう！ 🎯