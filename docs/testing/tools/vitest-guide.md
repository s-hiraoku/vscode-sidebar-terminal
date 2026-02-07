# Mocha テストフレームワークガイド

MochaはJavaScriptのテストフレームワークで、VS Code Sidebar Terminal拡張機能のテスト実行に使用しています。このガイドでは、Mochaの設定、使用方法、高度な機能を説明します。

## 目次

- [Mochaとは](#mochaとは)
- [基本設定](#基本設定)
- [テスト構造](#テスト構造)
- [フック（Hooks）](#フックhooks)
- [非同期テスト](#非同期テスト)
- [並列実行](#並列実行)
- [レポーター](#レポーター)
- [トラブルシューティング](#トラブルシューティング)

---

## Mochaとは

### 特徴

- **柔軟性**: 様々なアサーションライブラリと組み合わせ可能
- **非同期サポート**: Promise、async/await、コールバックに対応
- **並列実行**: テストを並列実行して高速化
- **豊富なレポーター**: テスト結果を様々な形式で出力

### 代替フレームワークとの比較

| フレームワーク | 特徴 | VS Code拡張での使用 |
|--------------|------|-------------------|
| Mocha | 柔軟、成熟 | ✅ 推奨 |
| Jest | オールインワン | ❌ VS Code APIと相性悪い |
| Vitest | 高速、モダン | ⚠️ 実験的 |
| Jasmine | 古典的 | ⚠️ 機能が限定的 |

---

## 基本設定

### インストール

```bash
npm install --save-dev mocha @types/mocha
```

### 設定ファイル: .mocharc.json

```json
{
  "require": [
    "source-map-support/register",
    "out/test/shared/TestSetup.js"
  ],
  "timeout": 10000,
  "recursive": true,
  "reporter": "spec",
  "ui": "bdd",
  "spec": [
    "out/test/unit/**/*.test.js",
    "out/test/integration/**/*.test.js"
  ],
  "parallel": false,
  "jobs": 4,
  "retries": 0
}
```

### 設定オプションの詳細

| オプション | 説明 | 推奨値 |
|-----------|------|--------|
| `require` | テスト実行前にロードするモジュール | TestSetup.js |
| `timeout` | デフォルトタイムアウト（ms） | 10000 |
| `recursive` | サブディレクトリを再帰的に検索 | true |
| `reporter` | レポーターの種類 | spec |
| `ui` | テストインターフェース | bdd |
| `spec` | テストファイルのパターン | *.test.js |
| `parallel` | 並列実行の有効化 | false（デフォルト） |
| `jobs` | 並列実行時のワーカー数 | 4 |
| `retries` | 失敗時のリトライ回数 | 0 |

---

## テスト構造

### BDD スタイル（推奨）

```typescript
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

### TDD スタイル

```typescript
suite('Feature Name', () => {
  test('does something', () => {
    // テストコード
  });

  test('handles edge case', () => {
    // テストコード
  });
});
```

**注**: このプロジェクトではBDDスタイルを使用します。

### describeのネスト

```typescript
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
describe('Test Suite', () => {
  // すべてのテスト前に1回だけ実行
  before(() => {
    console.log('Setting up test suite');
  });

  // すべてのテスト後に1回だけ実行
  after(() => {
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
before
  beforeEach
    test 1
  afterEach
  beforeEach
    test 2
  afterEach
after
```

### 非同期フック

```typescript
describe('Async Hooks', () => {
  before(async () => {
    // 非同期セットアップ
    await setupDatabase();
  });

  after(async () => {
    // 非同期クリーンアップ
    await teardownDatabase();
  });

  beforeEach(async () => {
    await clearData();
  });

  it('test with async setup', async () => {
    const result = await getData();
    expect(result).to.exist;
  });
});
```

### フックの名前付け

```typescript
describe('Named Hooks', () => {
  before('database setup', async () => {
    await setupDatabase();
  });

  after('database cleanup', async () => {
    await teardownDatabase();
  });

  it('should query database', () => {});
});
```

エラー時に `before "database setup"` のように表示されるため、デバッグが容易になります。

---

## 非同期テスト

### async/await（推奨）

```typescript
it('should handle async operation', async () => {
  const result = await asyncOperation();
  expect(result).to.equal('expected');
});
```

### Promise を返す

```typescript
it('should handle promise', () => {
  return asyncOperation().then(result => {
    expect(result).to.equal('expected');
  });
});
```

### done コールバック（非推奨）

```typescript
it('should handle callback', (done) => {
  asyncOperation((err, result) => {
    if (err) return done(err);
    expect(result).to.equal('expected');
    done();
  });
});
```

### タイムアウトの設定

```typescript
// テストスイート全体
describe('Slow Tests', function() {
  this.timeout(5000); // 5秒

  it('test 1', async () => {
    await slowOperation();
  });
});

// 個別のテスト
it('slow test', async function() {
  this.timeout(10000); // 10秒
  await verySlowOperation();
});

// タイムアウトを無効化（非推奨）
it('no timeout', async function() {
  this.timeout(0);
  await infiniteOperation();
});
```

---

## 並列実行

### 並列実行の有効化

```json
// .mocharc.parallel.json
{
  "parallel": true,
  "jobs": 4,
  "retries": 1
}
```

```bash
# 並列実行
npx mocha --config .mocharc.parallel.json
```

### 並列実行時の注意点

```typescript
describe('Parallel Safe Tests', () => {
  let localState: any;

  beforeEach(() => {
    // 各テストで独立した状態を作成
    localState = createFreshState();
  });

  afterEach(() => {
    // 確実にクリーンアップ
    localState.dispose();
  });

  it('test 1', () => {
    // localStateを使用
  });

  it('test 2', () => {
    // 別のlocalStateを使用（並列実行でも安全）
  });
});
```

### 並列実行を無効化する場合

```typescript
describe('Sequential Tests', () => {
  // このテストスイートは並列実行しない
  describe.serial('Database Tests', () => {
    it('test 1', async () => {
      await database.write('key', 'value');
    });

    it('test 2', async () => {
      const value = await database.read('key');
      expect(value).to.equal('value');
    });
  });
});
```

**注**: Mocha 10+ では `describe.serial` は非推奨です。代わりに別の設定ファイルを使用してください。

---

## レポーター

### 組み込みレポーター

```bash
# Spec（デフォルト、詳細な出力）
npx mocha --reporter spec

# Dot（簡潔な出力）
npx mocha --reporter dot

# TAP（Test Anything Protocol）
npx mocha --reporter tap

# JSON（機械可読）
npx mocha --reporter json > results.json

# HTML（ブラウザで表示）
npx mocha --reporter html > results.html
```

### レポーターの比較

**spec レポーター（推奨）**:
```text
  TerminalManager
    createTerminal
      ✓ should create terminal with default settings
      ✓ should create terminal with custom settings
    deleteTerminal
      ✓ should delete terminal by ID
      ✓ should throw error for invalid ID

  4 passing (125ms)
```

**dot レポーター**:
```text
  ....

  4 passing (125ms)
```

**tap レポーター**:
```text
1..4
ok 1 TerminalManager createTerminal should create terminal with default settings
ok 2 TerminalManager createTerminal should create terminal with custom settings
ok 3 TerminalManager deleteTerminal should delete terminal by ID
ok 4 TerminalManager deleteTerminal should throw error for invalid ID
```

### カスタムレポーター

```javascript
// reporters/custom-reporter.js
module.exports = MyReporter;

function MyReporter(runner) {
  const stats = runner.stats;

  runner.on('pass', (test) => {
    console.log(`✓ ${test.fullTitle()}`);
  });

  runner.on('fail', (test, err) => {
    console.log(`✗ ${test.fullTitle()}`);
    console.log(`  Error: ${err.message}`);
  });

  runner.on('end', () => {
    console.log(`${stats.passes}/${stats.tests} passed`);
  });
}
```

```bash
npx mocha --reporter ./reporters/custom-reporter.js
```

---

## テストの選択的実行

### .only() - 特定のテストのみ実行

```typescript
describe('Test Suite', () => {
  it.only('this test will run', () => {});
  it('this test will be skipped', () => {});
  it('this test will also be skipped', () => {});
});
```

**警告**: .only() をコミットしないでください！CI/CDで問題が発生します。

### .skip() - テストをスキップ

```typescript
describe('Test Suite', () => {
  it('this test will run', () => {});
  it.skip('this test will be skipped', () => {});
  it('this test will also run', () => {});
});
```

### 条件付きテスト

```typescript
const itOnWindows = process.platform === 'win32' ? it : it.skip;
const itOnUnix = process.platform !== 'win32' ? it : it.skip;

describe('Platform-specific Tests', () => {
  itOnWindows('should work on Windows', () => {
    // Windows専用のテスト
  });

  itOnUnix('should work on Unix', () => {
    // Unix専用のテスト
  });
});
```

---

## リトライ設定

### グローバルリトライ

```json
// .mocharc.json
{
  "retries": 2
}
```

### テストスイートごとのリトライ

```typescript
describe('Flaky Tests', function() {
  this.retries(3); // 失敗時に3回リトライ

  it('might fail occasionally', () => {
    // 不安定なテスト
  });
});
```

### 個別テストのリトライ

```typescript
it('specific flaky test', function() {
  this.retries(5);

  // テストコード
});
```

**注意**: リトライは最終手段です。不安定なテストの根本原因を修正することが重要です。

---

## デバッグ

### デバッグモードで実行

```bash
# Node.jsのデバッガーを使用
node --inspect-brk ./node_modules/.bin/mocha 'out/test/**/*.test.js'

# Chrome DevToolsでデバッグ
# chrome://inspect にアクセスしてデバッグ
```

### VS Code でのデバッグ

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Mocha Tests",
      "program": "${workspaceFolder}/node_modules/mocha/bin/_mocha",
      "args": [
        "--require", "out/test/shared/TestSetup.js",
        "--timeout", "999999",
        "--colors",
        "${workspaceFolder}/out/test/unit/**/*.test.js"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### デバッグログの出力

```typescript
describe('Debug Tests', () => {
  it('should log debug info', () => {
    console.log('Debug: Variable value is', someVariable);

    // またはブレークポイントを使用
    debugger;

    expect(someVariable).to.equal('expected');
  });
});
```

---

## トラブルシューティング

### Exit Code 7 エラー

**症状**:
```text
Error: Process completed with exit code 7
```

**原因**: グローバルリソースのクリーンアップ処理の問題

**解決方法**:
1. すべてのテストで適切なクリーンアップを実施
2. `afterEach` でリソースを確実に解放
3. [トラブルシューティングガイド](../troubleshooting.md#mocha-exit-code-7問題) を参照

### タイムアウトエラー

**症状**:
```text
Error: Timeout of 2000ms exceeded
```

**解決方法**:
```typescript
// タイムアウトを延長
it('slow test', async function() {
  this.timeout(10000); // 10秒
  await slowOperation();
});
```

### テストが見つからない

**症状**:
```text
Warning: Could not find any test files
```

**解決方法**:
1. `.mocharc.json` の `spec` パターンを確認
2. テストファイルがコンパイルされているか確認
3. ファイル名が `*.test.js` で終わっているか確認

```bash
# テストファイルの存在確認
ls -la out/test/unit/**/*.test.js
```

---

## ベストプラクティス

### ✅ Do

- BDDスタイル（describe/it）を使用
- 明確なテスト名を付ける
- beforeEach/afterEach でクリーンアップ
- 非同期テストは async/await を使用
- 適切なタイムアウトを設定

### ❌ Don't

- .only() をコミットしない
- タイムアウトを0に設定しない
- グローバル状態に依存しない
- リトライに頼りすぎない
- 不安定なテストを放置しない

---

## package.json スクリプト例

```json
{
  "scripts": {
    "test": "mocha",
    "test:unit": "mocha 'out/test/unit/**/*.test.js'",
    "test:integration": "mocha 'out/test/integration/**/*.test.js' --timeout 30000",
    "test:watch": "mocha --watch 'out/test/**/*.test.js'",
    "test:debug": "mocha --inspect-brk 'out/test/**/*.test.js'",
    "test:parallel": "mocha --config .mocharc.parallel.json",
    "test:coverage": "nyc mocha"
  }
}
```

---

## 参考リンク

- [Mocha公式ドキュメント](https://mochajs.org/)
- [Mocha GitHub](https://github.com/mochajs/mocha)
- [トラブルシューティング](../troubleshooting.md)
- [ベストプラクティス](../best-practices.md)

---

**最終更新**: 2025-11-08
