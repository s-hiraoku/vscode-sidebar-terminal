# テストトラブルシューティングガイド

このガイドでは、VS Code Sidebar Terminal拡張機能のテスト実行時によく遭遇する問題と、その解決方法を説明します。

## 目次

- [テスト終了コードの問題](#テスト終了コードの問題)
- [テストタイムアウト](#テストタイムアウト)
- [モック関連の問題](#モック関連の問題)
- [VS Code API モックエラー](#vs-code-api-モックエラー)
- [node-ptyエラー](#node-ptyエラー)
- [JSDOM関連エラー](#jsdom関連エラー)
- [カバレッジレポート生成エラー](#カバレッジレポート生成エラー)

---

## テスト終了コードの問題

### 症状
テスト実行後にプロセスが正常終了しない場合があります。

### 原因
グローバルリソースのクリーンアップ処理で発生する問題です。主な原因：
- テスト間でリソースが適切に解放されていない
- イベントリスナーが残留している
- グローバル状態の不完全なリセット

**重要**: このエラーを単に許容するのではなく、根本原因を特定して解決することが重要です。

### 解決方法

#### 方法1: 適切なクリーンアップ処理の実装（推奨）
テストファイルで確実なクリーンアップを行う：

```typescript
import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanupTestEnvironment, resetTestEnvironment } from '../../shared/TestSetup';

describe('Test Suite', () => {
  let dom: JSDOM;

  beforeEach(() => {
    // 各テスト前にリセット
    resetTestEnvironment();
  });

  afterEach(() => {
    // 確実なクリーンアップ
    vi.restoreAllMocks();
    cleanupTestEnvironment(dom);
  });

  // テストケース
});
```

#### 方法2: リソースリークの調査

```bash
# デバッグモードでテスト実行
DEBUG=* npm run test:unit

# 特定のテストファイルのみ実行して原因を特定
npx vitest run src/test/vitest/unit/specific-file.test.ts
```

### 参考
- [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
- [改善提案書](../../test-environment-improvement-proposal.md)

---

## テストタイムアウト

### 症状
```text
Error: Timeout of 2000ms exceeded
```

### 原因
- 非同期処理の完了を待てない
- デフォルトタイムアウト（2秒）が短すぎる

### 解決方法

#### 方法1: 個別テストのタイムアウト延長
```typescript
it('should handle async operation', async () => {
  const result = await someAsyncOperation();
  expect(result).toBeTruthy();
}, 5000); // 5秒に延長
```

#### 方法2: vitest.config.tsで全体設定
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 10000,
  },
});
```

### ベストプラクティス
```typescript
// async/await を使用
it('should process data', async () => {
  const result = await asyncOperation();
  expect(result).toBe('expected');
});

// Promiseを返す
it('should save data', () => {
  return saveData().then(saved => {
    expect(saved).toBe(true);
  });
});
```

---

## モック関連の問題

### 症状1: "Attempted to wrap already wrapped function"

```text
Error: Attempted to wrap someFunction which is already wrapped
```

**原因**: 同じ関数を複数回stubしようとしている

**解決方法**:
```typescript
import { vi, beforeEach, afterEach } from 'vitest';

// beforeEachでモック作成、afterEachで復元
beforeEach(() => {
  vi.spyOn(object, 'method').mockReturnValue('value');
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### 症状2: stubが期待通りに動作しない

**原因**: stubの設定が間違っている

**解決方法**:
```typescript
// 戻り値を設定
stub.returns('value');

// 非同期の戻り値
stub.resolves('async value');
stub.rejects(new Error('async error'));

// 条件付き戻り値
stub.withArgs('arg1').returns('value1');
stub.withArgs('arg2').returns('value2');

// 呼び出し回数の検証
expect(stub.callCount).to.equal(1);
expect(stub).to.have.been.calledOnce;
expect(stub).to.have.been.calledWith('expected arg');
```

---

## VS Code API モックエラー

### 症状
```text
TypeError: Cannot read property 'workspace' of undefined
```

**原因**: VS Code APIのモックが正しくセットアップされていない

**解決方法**:
```typescript
import { mockVscode, setupTestEnvironment } from '../../shared/TestSetup';

before(() => {
  setupTestEnvironment();
});

// テスト内でVS Code APIを使用
it('should use VS Code API', () => {
  const config = mockVscode.workspace.getConfiguration('secondaryTerminal');
  expect(config.get('shell')).to.equal('/bin/bash');
});
```

### カスタム設定が必要な場合
```typescript
beforeEach(() => {
  mockVscode.workspace.getConfiguration.callsFake((section) => ({
    get: (key: string) => {
      if (section === 'secondaryTerminal' && key === 'customKey') {
        return 'customValue';
      }
      return undefined;
    },
    update: vi.fn().mockResolvedValue(undefined),
  }));
});
```

---

## node-ptyエラー

### 症状
```text
Error: Cannot find module '@homebridge/node-pty-prebuilt-multiarch'
```

**原因**: テスト環境でnode-ptyモックが正しくセットアップされていない

**解決方法**:

テストは自動的にnode-ptyをモックします（`TestSetup.ts`で設定済み）。

明示的にモックが必要な場合：
```typescript
// src/test/mocks/node-pty.ts
export const spawn = () => ({
  pid: 1234,
  onData: () => ({ dispose: () => {} }),
  onExit: () => ({ dispose: () => {} }),
  write: () => {},
  resize: () => {},
  kill: () => {},
  dispose: () => {},
});
```

---

## JSDOM関連エラー

### 症状
```text
ReferenceError: document is not defined
```

**原因**: DOM環境がセットアップされていない

**解決方法**:
```typescript
import { setupJSDOMEnvironment } from '../../shared/TestSetup';

describe('DOM Tests', () => {
  let dom: any;
  let document: Document;

  before(() => {
    const env = setupJSDOMEnvironment();
    dom = env.dom;
    document = env.document;
  });

  after(() => {
    dom.window.close();
  });

  it('should manipulate DOM', () => {
    const div = document.createElement('div');
    div.textContent = 'test';
    expect(div.textContent).to.equal('test');
  });
});
```

### カスタムHTMLが必要な場合
```typescript
const htmlContent = `
<!DOCTYPE html>
<html>
  <body>
    <div id="custom-element"></div>
  </body>
</html>
`;

const { dom, document } = setupJSDOMEnvironment(htmlContent);
```

---

## カバレッジレポート生成エラー

### 症状
```text
Error: No coverage information was collected
```

**原因**:
- テストが実行されていない
- カバレッジ対象ファイルが正しく指定されていない

**解決方法**:

#### 方法1: カバレッジ設定確認
`.nycrc.json`を確認：
```json
{
  "include": [
    "out/src/**/*.js"
  ],
  "exclude": [
    "out/src/test/**",
    "out/src/**/*.test.js"
  ]
}
```

#### 方法2: テストの実行確認
```bash
# カバレッジなしで実行（テストが動くか確認）
npm run compile-tests
npx vitest run src/test/vitest/unit

# カバレッジ付きで実行
npm run test:coverage
```

#### 方法3: キャッシュのクリア
```bash
# nycのキャッシュをクリア
rm -rf .nyc_output coverage

# 再度カバレッジ生成
npm run test:coverage
```

---

## 並列実行時の問題

### 症状
並列実行時にテストが失敗する

**原因**: テスト間で状態が共有されている

**解決方法**:
```typescript
// 各テストで独立した状態を作成
describe('Parallel Safe Tests', () => {
  let testResource: any;

  beforeEach(() => {
    testResource = createFreshResource();
  });

  afterEach(() => {
    // 確実にクリーンアップ
    vi.restoreAllMocks();
    if (testResource && testResource.dispose) {
      testResource.dispose();
    }
  });

  it('test 1', () => {
    // 独立したテスト
  });

  it('test 2', () => {
    // 独立したテスト
  });
});
```

---

## デバッグのヒント

### テストのデバッグ実行

```bash
# VS Codeのデバッガーを使用
# .vscode/launch.json に設定を追加

{
  "type": "node",
  "request": "launch",
  "name": "Vitest Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": [
    "run",
    "--reporter=verbose"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### 詳細なログ出力

```typescript
// テスト内でデバッグログ
it('should debug test', () => {
  console.log('Debug info:', someVariable);

  // またはdebuggerを使用
  debugger; // ブレークポイント

  expect(result).to.be.ok;
});
```

---

## さらにヘルプが必要な場合

- [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) - 新しい問題を報告
- [Getting Started](./getting-started.md) - 基本的なセットアップ
- [TDD実装ガイド](../../src/test/TDD-Implementation-Strategy.md) - TDD手法の詳細

---

**最終更新**: 2025-11-08
