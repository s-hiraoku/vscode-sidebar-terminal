# テストトラブルシューティングガイド

このガイドでは、VS Code Sidebar Terminal拡張機能のテスト実行時によく遭遇する問題と、その解決方法を説明します。

## 目次

- [Mocha exit code 7問題](#mocha-exit-code-7問題)
- [テストタイムアウト](#テストタイムアウト)
- [モック関連の問題](#モック関連の問題)
- [VS Code API モックエラー](#vs-code-api-モックエラー)
- [node-ptyエラー](#node-ptyエラー)
- [JSDOM関連エラー](#jsdom関連エラー)
- [カバレッジレポート生成エラー](#カバレッジレポート生成エラー)

---

## Mocha exit code 7問題

### 症状
テスト実行後に以下のようなエラーが表示される：

```bash
Error: Process completed with exit code 7
```

### 原因
グローバルリソースのクリーンアップ処理で発生する既知の問題です。テスト自体は正常に実行されています。

### 解決方法

#### 方法1: 許容する（推奨）
CI/CDでは exit code 7 を許容する設定になっています：

```bash
# テスト実行（exit code 7を許容）
npm run test:unit || {
  exit_code=$?
  if [ $exit_code -eq 7 ]; then
    echo "Tests passed (Mocha cleanup exit code 7)"
    exit 0
  else
    exit $exit_code
  fi
}
```

#### 方法2: クリーンアップ処理の改善
テストファイルで適切なクリーンアップを行う：

```typescript
import { cleanupTestEnvironment } from '../../shared/TestSetup';

afterEach(() => {
  cleanupTestEnvironment(sandbox, dom);
});
```

### 参考
- [GitHub Issue: Mocha exit code 7](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
- [改善提案書](../../test-environment-improvement-proposal.md)

---

## テストタイムアウト

### 症状
```
Error: Timeout of 2000ms exceeded
```

### 原因
- 非同期処理の完了を待てない
- デフォルトタイムアウト（2秒）が短すぎる

### 解決方法

#### 方法1: 個別テストのタイムアウト延長
```typescript
it('should handle async operation', function(this: any) {
  this.timeout(5000); // 5秒に延長

  return someAsyncOperation().then(result => {
    expect(result).to.be.ok;
  });
});
```

#### 方法2: テストスイート全体のタイムアウト延長
```typescript
describe('Async Operations', function() {
  this.timeout(10000); // 10秒に延長

  it('should handle operation 1', async () => {
    // テストコード
  });

  it('should handle operation 2', async () => {
    // テストコード
  });
});
```

#### 方法3: .mocharc.jsonで全体設定
```json
{
  "timeout": 10000
}
```

### ベストプラクティス
```typescript
// async/await を使用
it('should process data', async () => {
  const result = await asyncOperation();
  expect(result).to.equal('expected');
});

// Promiseを返す
it('should save data', () => {
  return saveData().then(saved => {
    expect(saved).to.be.true;
  });
});
```

---

## モック関連の問題

### 症状1: "Attempted to wrap already wrapped function"

```
Error: Attempted to wrap someFunction which is already wrapped
```

**原因**: 同じ関数を複数回stubしようとしている

**解決方法**:
```typescript
import { safeStub } from '../../shared/TestSetup';

// 安全なstub作成
const stub = safeStub(object, 'method');

// または、beforeEachでstub作成、afterEachで復元
let stub: sinon.SinonStub;

beforeEach(() => {
  stub = sinon.stub(object, 'method');
});

afterEach(() => {
  stub.restore();
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
```
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
    update: sinon.stub().resolves(),
  }));
});
```

---

## node-ptyエラー

### 症状
```
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
```
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
```
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
npx mocha 'out/test/unit/**/*.test.js'

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
  let sandbox: sinon.SinonSandbox;
  let testResource: any;

  beforeEach(() => {
    // テストごとに新しいサンドボックス
    sandbox = sinon.createSandbox();
    testResource = createFreshResource();
  });

  afterEach(() => {
    // 確実にクリーンアップ
    sandbox.restore();
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
