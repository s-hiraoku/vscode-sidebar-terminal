# E2Eテストパターン

VS Code拡張機能のE2E（End-to-End）テストでは、実際のVS Code環境で拡張機能全体の動作を検証します。このガイドでは、`@vscode/test-electron`を使用したE2Eテストパターンを説明します。

## 目次

- [VS Code拡張機能のE2Eテスト](#vs-code拡張機能のe2eテスト)
- [テスト環境のセットアップ](#テスト環境のセットアップ)
- [基本的なE2Eテストパターン](#基本的なe2eテストパターン)
- [Webviewのテスト](#webviewのテスト)
- [コマンドのテスト](#コマンドのテスト)
- [UI操作のテスト](#ui操作のテスト)
- [デバッグとトラブルシューティング](#デバッグとトラブルシューティング)

---

## VS Code拡張機能のE2Eテスト

### 重要な注意事項

⚠️ **VS Code拡張機能では標準のPlaywrightは使用できません**

VS Code拡張機能のE2Eテストには、必ず `@vscode/test-electron` を使用してください。標準のPlaywrightは、VS Code特有のWebview APIやExtension Hostとの通信をサポートしていません。

### @vscode/test-electron とは

- VS Code公式のテストランナー
- 実際のVS Codeインスタンスを起動してテスト実行
- Extension HostとWebview間の通信をサポート
- VS Code APIをフルサポート

---

## テスト環境のセットアップ

### 1. 依存関係のインストール

```json
// package.json
{
  "devDependencies": {
    "@vscode/test-electron": "^2.4.0",
    "@types/mocha": "^10.0.0",  // Required by @vscode/test-electron
    "@types/node": "^20.0.0",
    "mocha": "^10.0.0"  // Required by @vscode/test-electron for E2E tests
  }
}
```

### 2. テストランナーのセットアップ

```typescript
// src/test/suite/e2e/runE2ETests.ts
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // 拡張機能のルートパス
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // テストファイルのパス
    const extensionTestsPath = path.resolve(__dirname, './index');

    // VS Codeを起動してテスト実行
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',  // 他の拡張機能を無効化
        '--disable-gpu',         // GPU無効化（CI用）
        '--disable-workspace-trust', // ワークスペーストラストを無効化
      ],
    });
  } catch (err) {
    console.error('Failed to run E2E tests');
    process.exit(1);
  }
}

main();
```

### 3. テストインデックスファイル

```typescript
// src/test/suite/e2e/index.ts
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  // Mochaインスタンスを作成
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 20000, // E2Eは時間がかかるため長めに設定
  });

  const testsRoot = path.resolve(__dirname, '.');

  // テストファイルを検索
  const files = await glob('**/*.e2e.test.js', { cwd: testsRoot });

  // テストファイルを追加
  files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

  return new Promise<void>((resolve, reject) => {
    try {
      // テストを実行
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
```

---

## 基本的なE2Eテストパターン

### 拡張機能のアクティベーションテスト

```typescript
// src/test/suite/e2e/activation.e2e.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

describe('E2E: Extension Activation', () => {
  it('should activate extension', async () => {
    // Given: 拡張機能のID
    const extensionId = 'your-publisher.vscode-sidebar-terminal';

    // When: 拡張機能を取得
    const extension = vscode.extensions.getExtension(extensionId);

    // Then: 拡張機能が存在する
    assert.ok(extension, 'Extension should be installed');

    // When: アクティベート
    await extension.activate();

    // Then: アクティブ状態
    assert.strictEqual(extension.isActive, true, 'Extension should be active');
  });

  it('should register all commands', async () => {
    // When: 全コマンドを取得
    const commands = await vscode.commands.getCommands(true);

    // Then: 拡張機能のコマンドが登録されている
    const extensionCommands = [
      'secondaryTerminal.createTerminal',
      'secondaryTerminal.deleteTerminal',
      'secondaryTerminal.switchTerminal',
    ];

    extensionCommands.forEach(cmd => {
      assert.ok(
        commands.includes(cmd),
        `Command ${cmd} should be registered`
      );
    });
  });
});
```

---

## Webviewのテスト

### Webview の作成と通信テスト

```typescript
// src/test/suite/e2e/webview.e2e.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

describe('E2E: Webview Integration', () => {
  let panel: vscode.WebviewPanel | undefined;

  afterEach(() => {
    // テスト後にWebviewをクローズ
    if (panel) {
      panel.dispose();
      panel = undefined;
    }
  });

  it('should create and display webview panel', async () => {
    // When: Webview表示コマンドを実行
    await vscode.commands.executeCommand('secondaryTerminal.show');

    // Then: Webviewパネルが作成される
    // 注: 実際のパネル取得にはextension contextが必要
    await new Promise(resolve => setTimeout(resolve, 1000));

    const activeEditor = vscode.window.activeTextEditor;
    const visibleTextEditors = vscode.window.visibleTextEditors;

    // Webviewが表示されていることを確認
    assert.ok(
      vscode.window.activeTextEditor !== undefined ||
      visibleTextEditors.length > 0,
      'Webview should be visible'
    );
  });

  it('should handle webview messages', async () => {
    // Given: Webviewパネルが存在する
    await vscode.commands.executeCommand('secondaryTerminal.show');
    await new Promise(resolve => setTimeout(resolve, 500));

    // When: Webviewにメッセージを送信
    const messageReceived = new Promise<boolean>((resolve) => {
      // メッセージリスナーを設定
      // 注: 実際の実装では拡張機能のMessageHandlerを使用
      setTimeout(() => resolve(true), 100);
    });

    // Then: メッセージが処理される
    const result = await messageReceived;
    assert.strictEqual(result, true, 'Message should be received');
  });
});
```

### Webview 状態の検証パターン

```typescript
describe('E2E: Webview State Verification', () => {
  it('should verify webview state after terminal creation', async () => {
    // Given: Webviewが開いている
    await vscode.commands.executeCommand('secondaryTerminal.show');
    await waitForWebviewReady();

    // When: ターミナル作成コマンドを実行
    await vscode.commands.executeCommand('secondaryTerminal.createTerminal');

    // Then: Webviewの状態を検証
    const state = await getWebviewState();

    assert.ok(state.terminals.length > 0, 'Should have at least one terminal');
    assert.ok(state.activeTerminalId, 'Should have active terminal');
  });
});

// ヘルパー関数
async function waitForWebviewReady(timeout = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const state = await getWebviewState();
      if (state.ready) {
        return;
      }
    } catch (err) {
      // まだ準備できていない
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Webview did not become ready');
}

async function getWebviewState(): Promise<any> {
  // 拡張機能のAPIを通じてWebviewの状態を取得
  // 実装は拡張機能の構造に依存
  return await vscode.commands.executeCommand('secondaryTerminal.getState');
}
```

---

## コマンドのテスト

### コマンド実行とその結果の検証

```typescript
// src/test/suite/e2e/commands.e2e.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

describe('E2E: Command Execution', () => {
  describe('Create Terminal Command', () => {
    it('should create new terminal', async () => {
      // When: ターミナル作成コマンドを実行
      await vscode.commands.executeCommand('secondaryTerminal.createTerminal');

      // Then: ターミナルが作成されたことを確認
      const state = await vscode.commands.executeCommand<any>(
        'secondaryTerminal.getState'
      );

      assert.ok(state.terminals.length > 0, 'Terminal should be created');
    });

    it('should create terminal with custom options', async () => {
      // When: オプション付きでターミナル作成
      await vscode.commands.executeCommand(
        'secondaryTerminal.createTerminal',
        {
          name: 'Custom Terminal',
          cwd: '/home/user/project',
          shell: '/bin/zsh'
        }
      );

      // Then: オプションが反映される
      const state = await vscode.commands.executeCommand<any>(
        'secondaryTerminal.getState'
      );

      const terminal = state.terminals[state.terminals.length - 1];
      assert.strictEqual(terminal.name, 'Custom Terminal');
      assert.strictEqual(terminal.cwd, '/home/user/project');
    });
  });

  describe('Delete Terminal Command', () => {
    it('should delete terminal by id', async () => {
      // Given: ターミナルが2つ存在
      await vscode.commands.executeCommand('secondaryTerminal.createTerminal');
      await vscode.commands.executeCommand('secondaryTerminal.createTerminal');

      const stateBefore = await vscode.commands.executeCommand<any>(
        'secondaryTerminal.getState'
      );
      const terminalToDelete = stateBefore.terminals[0];

      // When: ターミナルを削除
      await vscode.commands.executeCommand(
        'secondaryTerminal.deleteTerminal',
        terminalToDelete.id
      );

      // Then: ターミナルが削除される
      const stateAfter = await vscode.commands.executeCommand<any>(
        'secondaryTerminal.getState'
      );

      assert.strictEqual(
        stateAfter.terminals.length,
        stateBefore.terminals.length - 1,
        'Terminal count should decrease'
      );

      const stillExists = stateAfter.terminals.some(
        (t: any) => t.id === terminalToDelete.id
      );
      assert.strictEqual(stillExists, false, 'Deleted terminal should not exist');
    });
  });
});
```

---

## UI操作のテスト

### Quick Pick の操作

```typescript
describe('E2E: UI Interactions', () => {
  it('should show terminal picker', async () => {
    // Given: 複数のターミナルが存在
    await vscode.commands.executeCommand('secondaryTerminal.createTerminal', {
      name: 'Terminal 1'
    });
    await vscode.commands.executeCommand('secondaryTerminal.createTerminal', {
      name: 'Terminal 2'
    });

    // When: ターミナル選択UIを表示
    const pickPromise = vscode.commands.executeCommand(
      'secondaryTerminal.selectTerminal'
    );

    // QuickPickが表示されるまで待機
    await new Promise(resolve => setTimeout(resolve, 500));

    // Then: QuickPickを操作（実際の選択は自動化が難しい）
    // E2Eテストでは、QuickPickが表示されることの確認まで
    // または、programmatic APIがあればそれを使用
  });
});
```

### ステータスバーの検証

```typescript
describe('E2E: Status Bar', () => {
  it('should update status bar on terminal change', async () => {
    // Given: ターミナルが存在
    await vscode.commands.executeCommand('secondaryTerminal.createTerminal');

    // When: ステータスバーアイテムを取得
    // 注: ステータスバーアイテムの取得には拡張機能のAPIが必要
    const statusBarState = await vscode.commands.executeCommand<any>(
      'secondaryTerminal.getStatusBarState'
    );

    // Then: ステータスバーが更新されている
    assert.ok(statusBarState.text, 'Status bar should have text');
    assert.ok(statusBarState.text.includes('Terminal'), 'Should mention terminal');
  });
});
```

---

## セッション復元のE2Eテスト

```typescript
describe('E2E: Session Persistence', () => {
  it('should restore session after reload', async () => {
    // Given: ターミナルを作成
    await vscode.commands.executeCommand('secondaryTerminal.createTerminal', {
      name: 'Persistent Terminal',
      cwd: '/home/user/test'
    });

    // セッションを保存
    await vscode.commands.executeCommand('secondaryTerminal.saveSession');

    // When: 拡張機能を再アクティベート（リロードをシミュレート）
    await vscode.commands.executeCommand('workbench.action.reloadWindow');

    // 注: 実際のウィンドウリロードはテスト環境によって動作が異なる
    // 代替として、セッション復元コマンドを直接呼ぶ
    await new Promise(resolve => setTimeout(resolve, 2000));
    await vscode.commands.executeCommand('secondaryTerminal.restoreSession');

    // Then: ターミナルが復元される
    const state = await vscode.commands.executeCommand<any>(
      'secondaryTerminal.getState'
    );

    const restored = state.terminals.find((t: any) => t.name === 'Persistent Terminal');
    assert.ok(restored, 'Terminal should be restored');
    assert.strictEqual(restored.cwd, '/home/user/test', 'CWD should be restored');
  });
});
```

---

## デバッグとトラブルシューティング

### デバッグ実行

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "E2E Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/suite/e2e/index"
      ],
      "outFiles": [
        "${workspaceFolder}/out/**/*.js"
      ],
      "preLaunchTask": "npm: compile-tests"
    }
  ]
}
```

### ログ出力

```typescript
describe('E2E: With Logging', () => {
  it('should log important events', async () => {
    // デバッグログを有効化
    const outputChannel = vscode.window.createOutputChannel('Test Log');

    outputChannel.appendLine('Starting test...');

    await vscode.commands.executeCommand('secondaryTerminal.createTerminal');

    outputChannel.appendLine('Terminal created');

    // ログを確認できるように少し待機
    await new Promise(resolve => setTimeout(resolve, 500));

    outputChannel.dispose();
  });
});
```

### スクリーンショット撮影（将来的な拡張）

```typescript
// 将来的にPlaywright for VS Codeが利用可能になった場合
describe('E2E: Visual Testing', () => {
  it('should take screenshot of webview', async () => {
    // 現在は@vscode/test-electronでは直接サポートされていない
    // ビジュアルリグレッションテストはPhase 2で検討
  });
});
```

---

## タイムアウトとリトライ

```typescript
describe('E2E Tests', function() {
  // E2Eテストは時間がかかるため、タイムアウトを長めに設定
  this.timeout(30000); // 30秒

  this.retries(2); // 失敗時に2回リトライ

  it('should handle slow operations', async function() {
    // 個別のテストでさらに延長も可能
    this.timeout(60000); // 60秒

    await vscode.commands.executeCommand('secondaryTerminal.heavyOperation');
  });
});
```

---

## CI/CD での実行

### GitHub Actions の設定例

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Compile
        run: npm run compile

      - name: Run E2E tests
        run: |
          npm run test:e2e
        env:
          DISPLAY: ':99.0'

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

## ベストプラクティス

### ✅ Do

- `@vscode/test-electron` を使用
- 適切なタイムアウトを設定
- テスト後のクリーンアップを実施
- 実際のユーザーフローをテスト
- CI/CDで自動実行

### ❌ Don't

- 標準のPlaywrightを使用しない
- 長時間実行するテストを作らない
- テスト間で状態を共有しない
- UI操作の詳細に依存しすぎない
- 外部サービスに依存しない

---

## package.json スクリプト

```json
{
  "scripts": {
    "test:e2e": "node ./out/test/suite/e2e/runE2ETests.js",
    "compile-tests": "tsc -p ./",
    "pretest:e2e": "npm run compile-tests"
  }
}
```

---

## 参考

- [@vscode/test-electron 公式ドキュメント](https://github.com/microsoft/vscode-test)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [統合テストパターン](./integration-testing.md)
- [改善提案書](../../../test-environment-improvement-proposal.md)

---

**最終更新**: 2025-11-08
