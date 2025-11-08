# テスト環境 - Getting Started

VS Code Sidebar Terminal拡張機能のテスト環境へようこそ！このガイドでは、テスト環境のセットアップから最初のテスト実行までを案内します。

## 前提条件

- Node.js 18.x以上
- npm
- Git

## セットアップ

### 1. リポジトリのクローンと依存関係のインストール

```bash
# リポジトリをクローン
git clone https://github.com/s-hiraoku/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal

# 依存関係をインストール
npm ci
```

### 2. テストのコンパイル

```bash
# TypeScriptテストファイルをJavaScriptにコンパイル
npm run compile-tests
```

## テストの実行

### 基本的なテスト実行

```bash
# すべてのユニットテストを実行
npm run test:unit

# すべての統合テストを実行
npm run test:integration

# パフォーマンステストを実行
npm run test:performance

# すべてのテストを実行
npm run test:all
```

### 並列実行（高速化）

```bash
# ユニットテストを並列実行（実行時間50%削減）
npm run test:unit:parallel

# 統合テストを並列実行
npm run test:integration:parallel

# すべてのテストを並列実行
npm run test:all:parallel
```

### カバレッジ付きテスト実行

```bash
# カバレッジレポート付きでテストを実行
npm run test:coverage

# カバレッジレポートを確認（HTML形式）
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

## 最初のテストを書く

### ユニットテストの作成

```typescript
// src/test/unit/example/MyFeature.test.ts
import { expect } from 'chai';
import * as sinon from 'sinon';
import { MyFeature } from '../../../src/features/MyFeature';

describe('MyFeature', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    // テスト前の準備
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    sandbox.restore();
  });

  it('should do something correctly', () => {
    // Given: 初期状態の準備
    const feature = new MyFeature();

    // When: テスト対象の操作を実行
    const result = feature.doSomething();

    // Then: 期待される結果を検証
    expect(result).to.equal('expected value');
  });

  it('should handle errors gracefully', () => {
    // エラーハンドリングのテスト
    const feature = new MyFeature();

    expect(() => {
      feature.doSomethingDangerous();
    }).to.throw('Expected error message');
  });
});
```

### テストの実行

```bash
# 作成したテストをコンパイル
npm run compile-tests

# 特定のテストファイルを実行
npx mocha out/test/unit/example/MyFeature.test.js
```

## テスト構成

### ディレクトリ構造

```
src/test/
├── shared/              # 共通テストユーティリティ
│   ├── TestSetup.ts    # グローバルセットアップ
│   └── setup-exit-handler.js
├── utils/              # テストヘルパー
│   ├── TDDTestHelper.ts
│   └── TestSetupFactory.ts
├── unit/               # ユニットテスト
│   ├── commands/
│   ├── providers/
│   ├── services/
│   └── utils/
├── integration/        # 統合テスト
│   ├── messaging/
│   ├── sessions/
│   └── terminal/
├── performance/        # パフォーマンステスト
│   ├── buffer/
│   └── memory/
└── suite/              # E2Eテストスイート
    ├── e2e.test.ts
    └── integration.test.ts
```

### テストフレームワーク

- **Mocha**: テストランナー
- **Chai**: アサーションライブラリ
- **Sinon**: モック・スタブライブラリ
- **nyc**: カバレッジツール

## よくある問題

### Mocha exit code 7エラー

テスト実行後に exit code 7 が発生する場合があります。これはクリーンアップ処理の既知の問題です。

**対処法**:
- テストは正常に実行されているため、通常は無視して問題ありません
- CI/CDでは exit code 7 を許容する設定になっています
- 根本的な解決策は現在開発中です（[改善提案](../../test-environment-improvement-proposal.md)参照）

### テストがタイムアウトする

**対処法**:
```typescript
// 特定のテストのタイムアウトを延長
it('should handle long operation', function(this: any) {
  this.timeout(5000); // 5秒に延長
  // テストコード
});
```

### モックが期待通りに動作しない

**対処法**:
```typescript
import { resetTestEnvironment } from '../../shared/TestSetup';

afterEach(() => {
  // テスト間でモックをリセット
  resetTestEnvironment();
});
```

## 次のステップ

- [ベストプラクティス](./best-practices.md) - テスト作成のベストプラクティス
- [トラブルシューティング](./troubleshooting.md) - よくある問題と解決法
- [TDD実装ガイド](../../src/test/TDD-Implementation-Strategy.md) - TDD手法の詳細

## 参考リンク

- [Mocha公式ドキュメント](https://mochajs.org/)
- [Chai公式ドキュメント](https://www.chaijs.com/)
- [Sinon公式ドキュメント](https://sinonjs.org/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

---

**質問やフィードバック**: [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
