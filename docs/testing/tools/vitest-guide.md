# Vitest テストフレームワークガイド

VitestはViteベースの高速テストフレームワークで、VS Code Sidebar Terminal拡張機能のテスト実行に使用しています。このガイドでは、Vitestの設定、使用方法、高度な機能を説明します。

## 目次

- [Vitestとは](#vitestとは)
- [基本設定](#基本設定)
- [テスト構造](#テスト構造)
- [フック（Hooks）](#フックhooks)
- [非同期テスト](#非同期テスト)
- [並列実行](#並列実行)
- [レポーター](#レポーター)
- [トラブルシューティング](#トラブルシューティング)

---

## Vitestとは

### 特徴

- **高速**: Viteベースのホットモジュールリプレースメント（HMR）により高速実行
- **TypeScriptネイティブ**: TypeScriptをそのまま実行可能（コンパイル不要）
- **Jest互換**: Jest互換APIで移行が容易
- **インラインモック**: `vi.fn()`, `vi.spyOn()`, `vi.mock()` による強力なモック機能

### フレームワーク比較

| フレームワーク | 特徴 | VS Code拡張での使用 |
|--------------|------|-------------------|
| Vitest | 高速、TypeScriptネイティブ | ✅ 推奨 |
| Jest | オールインワン | ⚠️ ESM対応に課題 |
| Mocha | 柔軟、成熟 | ⚠️ レガシー |
| Jasmine | 古典的 | ⚠️ 機能が限定的 |

---

## 基本設定

### インストール

```bash
npm install --save-dev vitest
```

### 設定ファイル: vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/vitest/**/*.test.ts'],
    globals: false,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
```

### 設定オプションの詳細

| オプション | 説明 | 推奨値 |
|-----------|------|--------|
| `include` | テストファイルのパターン | `['src/test/vitest/**/*.test.ts']` |
| `globals` | グローバルAPIの有効化 | false（明示的importを推奨） |
| `environment` | テスト環境 | node |
| `testTimeout` | テストのタイムアウト（ms） | 10000 |
| `reporters` | レポーターの種類 | verbose |
| `coverage.provider` | カバレッジプロバイダー | v8 |

---

## テスト構造

### BDD スタイル（推奨）

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  describe('Specific Behavior', () => {
    it('should do something', () => {
      // テストコード
    });

    it('should handle edge case', () => {
      // テストコード
    });
  });

  describe('Another Behavior', () => {
    it('should work correctly', () => {
      // テストコード
    });
  });
});
```

### describeのネスト

```typescript
import { describe, it, expect } from 'vitest';

describe('TerminalManager', () => {
  describe('Constructor', () => {
    it('should initialize with default settings', () => {});
    it('should accept custom settings', () => {});
  });

  describe('createTerminal', () => {
    describe('with valid options', () => {
      it('should create terminal', () => {});
      it('should return terminal instance', () => {});
    });

    describe('with invalid options', () => {
      it('should throw error', () => {});
    });
  });
});
```

---

## フック（Hooks）

### 基本的なフック

```typescript
import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

describe('Test Suite', () => {
  // すべてのテスト前に1回だけ実行
  beforeAll(() => {
    console.log('Setting up test suite');
  });

  // すべてのテスト後に1回だけ実行
  afterAll(() => {
    console.log('Cleaning up test suite');
  });

  // 各テスト前に実行
  beforeEach(() => {
    console.log('Setting up test');
  });

  // 各テスト後に実行
  afterEach(() => {
    console.log('Cleaning up test');
  });

  it('test 1', () => {});
  it('test 2', () => {});
});
```

### 実行順序

```text
beforeAll
  beforeEach
    test 1
  afterEach
  beforeEach
    test 2
  afterEach
afterAll
```

### 非同期フック

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

describe('Async Hooks', () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  beforeEach(async () => {
    await clearData();
  });

  it('test with async setup', async () => {
    const result = await getData();
    expect(result).toBeDefined();
  });
});
```

---

## 非同期テスト

### async/await（推奨）

```typescript
it('should handle async operation', async () => {
  const result = await asyncOperation();
  expect(result).toBe('expected');
});
```

### Promise を返す

```typescript
it('should handle promise', () => {
  return asyncOperation().then(result => {
    expect(result).toBe('expected');
  });
});
```

### タイムアウトの設定

```typescript
// 個別のテスト
it('slow test', async () => {
  await slowOperation();
}, 10000); // 10秒タイムアウト

// テストスイート全体（vitest.config.ts で設定）
```

---

## 並列実行

### 並列実行の有効化

Vitestはデフォルトでファイル単位の並列実行を行います。

```typescript
// 同一ファイル内での並列実行
describe.concurrent('Parallel Tests', () => {
  it('test 1', async () => {
    await someAsyncWork();
  });

  it('test 2', async () => {
    await otherAsyncWork();
  });
});
```

### 逐次実行が必要な場合

```typescript
describe('Sequential Tests', () => {
  // describe.sequential で順序を保証
  it('test 1', async () => {
    await database.write('key', 'value');
  });

  it('test 2', async () => {
    const value = await database.read('key');
    expect(value).toBe('value');
  });
});
```

---

## レポーター

### 組み込みレポーター

```bash
# Verbose（詳細な出力）
npx vitest --reporter=verbose

# Default（簡潔な出力）
npx vitest

# JSON（機械可読）
npx vitest --reporter=json > results.json

# JUnit（CI/CD向け）
npx vitest --reporter=junit > results.xml
```

### vitest.config.ts での設定

```typescript
export default defineConfig({
  test: {
    reporters: ['verbose'],
    // 複数のレポーターを同時使用
    // reporters: ['verbose', 'json'],
  },
});
```

---

## モック

### 関数モック

```typescript
import { vi, describe, it, expect } from 'vitest';

describe('Mocking', () => {
  it('should mock a function', () => {
    const mockFn = vi.fn().mockReturnValue('mocked');
    expect(mockFn()).toBe('mocked');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
```

### スパイ

```typescript
import { vi, describe, it, expect } from 'vitest';

describe('Spying', () => {
  it('should spy on a method', () => {
    const obj = { method: () => 'original' };
    const spy = vi.spyOn(obj, 'method').mockReturnValue('mocked');

    expect(obj.method()).toBe('mocked');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
```

### モジュールモック

```typescript
import { vi, describe, it, expect } from 'vitest';

vi.mock('../../src/module', () => ({
  someFunction: vi.fn().mockReturnValue('mocked'),
}));

describe('Module Mocking', () => {
  it('should use mocked module', () => {
    // モックされたモジュールが使われる
  });
});
```

---

## テストの選択的実行

### .only() - 特定のテストのみ実行

```typescript
describe('Test Suite', () => {
  it.only('this test will run', () => {});
  it('this test will be skipped', () => {});
});
```

**警告**: .only() をコミットしないでください！CI/CDで問題が発生します。

### .skip() - テストをスキップ

```typescript
describe('Test Suite', () => {
  it('this test will run', () => {});
  it.skip('this test will be skipped', () => {});
});
```

### .todo() - 未実装テストのマーク

```typescript
describe('Test Suite', () => {
  it.todo('should implement this later');
});
```

### 条件付きテスト

```typescript
import { it, describe } from 'vitest';

describe('Platform-specific Tests', () => {
  it.skipIf(process.platform !== 'win32')('should work on Windows', () => {});
  it.skipIf(process.platform === 'win32')('should work on Unix', () => {});
});
```

---

## デバッグ

### VS Code でのデバッグ

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Vitest Tests",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--reporter=verbose"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### コマンドラインデバッグ

```bash
# UIモード（ブラウザで確認）
npx vitest --ui

# 特定ファイルのみ実行
npx vitest run src/test/vitest/unit/specific-file.test.ts
```

---

## トラブルシューティング

### タイムアウトエラー

**症状**:
```text
Error: Test timed out in 5000ms
```

**解決方法**:
```typescript
it('slow test', async () => {
  await slowOperation();
}, 10000); // タイムアウトを延長
```

### テストが見つからない

**症状**:
```text
No test files found
```

**解決方法**:
1. `vitest.config.ts` の `include` パターンを確認
2. ファイル名が `*.test.ts` で終わっているか確認

```bash
# テストファイルの一覧確認
npx vitest --list
```

---

## ベストプラクティス

### ✅ Do

- BDDスタイル（describe/it）を使用
- 明確なテスト名を付ける
- beforeEach/afterEach でクリーンアップ
- 非同期テストは async/await を使用
- `vi.restoreAllMocks()` でモックを確実にリセット

### ❌ Don't

- .only() をコミットしない
- グローバル状態に依存しない
- 不安定なテストを放置しない
- モックのクリーンアップを忘れない

---

## package.json スクリプト例

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run src/test/vitest/unit",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## 参考リンク

- [Vitest公式ドキュメント](https://vitest.dev/)
- [Vitest GitHub](https://github.com/vitest-dev/vitest)
- [トラブルシューティング](../troubleshooting.md)
- [ベストプラクティス](../best-practices.md)

---

**最終更新**: 2026-02-07
