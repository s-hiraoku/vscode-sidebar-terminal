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
// src/test/vitest/unit/example/MyFeature.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MyFeature } from '../../../src/features/MyFeature';

describe('MyFeature', () => {
  beforeEach(() => {
    // テスト前の準備
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    vi.restoreAllMocks();
  });

  it('should do something correctly', () => {
    // Given: 初期状態の準備
    const feature = new MyFeature();

    // When: テスト対象の操作を実行
    const result = feature.doSomething();

    // Then: 期待される結果を検証
    expect(result).toBe('expected value');
  });

  it('should handle errors gracefully', () => {
    // エラーハンドリングのテスト
    const feature = new MyFeature();

    expect(() => {
      feature.doSomethingDangerous();
    }).toThrow('Expected error message');
  });
});
```

### テストの実行

```bash
# 作成したテストをコンパイル
npm run compile-tests

# 特定のテストファイルを実行
npx vitest run src/test/vitest/unit/example/MyFeature.test.ts
```

## テスト構成

### ディレクトリ構造

```text
src/test/
├── shared/                    # 共通テストユーティリティ
│   ├── TestSetup.ts          # グローバルセットアップ
│   └── setup-exit-handler.js
├── utils/                    # テストヘルパー
│   ├── TDDTestHelper.ts
│   └── TestSetupFactory.ts
├── vitest/                   # Vitestテスト（メイン）
│   └── unit/                 # ユニットテスト
│       ├── commands/
│       ├── providers/
│       ├── services/
│       └── utils/
├── integration/              # 統合テスト（Mocha / @vscode/test-electron）
│   ├── messaging/
│   ├── sessions/
│   └── terminal/
├── e2e/                      # E2Eテスト（Playwright）
│   └── tests/
└── suite/                    # レガシーE2Eテストスイート
    ├── e2e.test.ts
    └── integration.test.ts
```

### テストフレームワーク

- **Vitest**: テストランナー/アサーション/モック（`vi.fn()`, `vi.spyOn()`, `vi.mock()`）
- **v8**: カバレッジツール（Vitest built-in）

## よくある問題

### テストがタイムアウトする

**対処法**:
```typescript
// 特定のテストのタイムアウトを延長
it('should handle long operation', async () => {
  // テストコード
}, 5000); // 5秒に延長
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

- [Vitest公式ドキュメント](https://vitest.dev/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

---

**質問やフィードバック**: [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
