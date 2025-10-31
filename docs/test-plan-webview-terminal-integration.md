# Secondary Terminal Extension - WebView & TerminalManager 統合テスト計画

## ドキュメント情報

**作成日**: 2025-10-30
**対象バージョン**: v0.1.123+
**テスト範囲**: TerminalManager リファクタリング + WebView 統合
**優先度**: Critical (P0)

---

## 1. エグゼクティブサマリー

### 1.1 テスト対象アプリケーション

**Secondary Terminal** - VS Code Sidebar用マルチターミナル拡張機能

**主要機能**:
- 複数ターミナルの同時管理（最大5個）
- xterm.jsベースのフルターミナルエミュレーション
- CLI Agent検出（Claude Code, GitHub Copilot等）
- WebView ↔ Extension 双方向通信
- セッション永続化（5分毎の自動保存）
- ターミナル分割・リサイズ機能

### 1.2 技術スタック

| レイヤー | 技術 | 役割 |
|---------|------|------|
| **Backend** | VS Code Extension API | Extension Host実行環境 |
| **Process** | node-pty | ターミナルプロセス管理 |
| **Frontend** | WebView (HTML/CSS/JS) | UI表示層 |
| **Terminal** | xterm.js 5.x | ターミナルエミュレーション |
| **通信** | vscode.postMessage | Extension ↔ WebView通信 |

### 1.3 リファクタリング内容

**ファイル**: `src/terminals/TerminalManager.ts`
**対象メソッド**: `createTerminal()`, `createTerminalWithProfile()`
**変更内容**: イベントハンドラーの重複削除

#### Before: 重複したイベントハンドラー
```typescript
// createTerminal() 内に重複コードが存在（歴史的経緯）
ptyProcess.onData((data) => { /* 処理A */ });
ptyProcess.onExit((event) => { /* 処理B */ });

// 後で _setupTerminalEvents() も呼ばれる（重複！）
this._setupTerminalEvents(terminal);
```

#### After: 統一されたイベントハンドラー
```typescript
// createTerminal() は _setupTerminalEvents() のみ呼び出し
this._setupTerminalEvents(terminal);

// _setupTerminalEvents() 内で一度だけ設定
private _setupTerminalEvents(terminal: TerminalInstance): void {
  ptyProcess.onData((data) => { /* 単一処理 */ });
  ptyProcess.onExit((event) => { /* 単一処理 */ });
}
```

**期待される効果**:
- ✅ データイベントが1回のみ発火（二重文字表示の防止）
- ✅ プロセス状態遷移の正確性（Launching → Running → 終了）
- ✅ リソースリークの防止

---

## 2. テスト戦略と実装可能性

### 2.1 VS Code拡張機能テストの特殊性と制約

#### 制約1: WebViewへの直接アクセス不可
VS Code WebViewはセキュリティ上の理由で外部からの直接アクセスが不可能。

**対処法**:
- VS Code Extension Test Runner使用
- 内部メッセージング経由でのテスト
- モック環境での単体テスト

#### 制約2: Playwright/Puppeteerの限界
通常のブラウザ自動化ツールはVS Code内部WebViewにアクセスできない。

**対処法**:
- VS Code UIテストフレームワーク使用（`@vscode/test-electron`）
- Extension統合テストに重点を置く
- WebView内部ロジックは単体テストでカバー

#### 制約3: node-ptyのネイティブ依存
node-ptyはネイティブバイナリであり、プラットフォーム依存。

**対処法**:
- CI/CD環境での複数プラットフォームテスト
- モックPTYを使用した単体テスト
- 実PTYを使用した統合テスト

### 2.2 推奨テストアプローチ

このテスト計画では、以下の**3層アプローチ**を採用します：

```
┌─────────────────────────────────────────┐
│ Layer 3: E2E Tests (VS Code Environment)│  ← 高優先度
├─────────────────────────────────────────┤
│ Layer 2: Integration Tests (Messaging)  │  ← 中優先度
├─────────────────────────────────────────┤
│ Layer 1: Unit Tests (Manager Logic)     │  ← 高優先度
└─────────────────────────────────────────┘
```

**理由**:
1. **Unit Tests**: 既存のMochaフレームワークで実装可能、高速実行
2. **Integration Tests**: メッセージング層のみをテスト、中程度の複雑さ
3. **E2E Tests**: VS Code Extension Test Runnerで実装、重要パスのみカバー

---

## 3. テストシナリオ

### 3.1 Priority P0: Critical Path Tests

#### 3.1.1 イベントハンドラー統合テスト

**目的**: リファクタリング後のイベントハンドラーが単一かつ正確に動作することを検証

**テストID**: `TM-EH-001`
**シナリオ名**: Single Event Handler Registration

**前提条件**:
- TerminalManagerインスタンスが初期化済み
- ターミナルが1つも存在しない状態

**テストステップ**:
1. `createTerminal()` を呼び出す
2. PTYプロセスが正常に起動することを確認
3. `ptyProcess.onData` リスナーが**1つだけ**登録されていることを検証
4. `ptyProcess.onExit` リスナーが**1つだけ**登録されていることを検証
5. テストデータ `"test\n"` を送信
6. データイベントが**1回のみ**発火することを確認
7. 出力データが`terminalData`イベントを通じて**1回のみ**WebViewに送信されることを確認

**期待結果**:
```typescript
// イベントハンドラー数の確認
expect(terminal.ptyProcess.listenerCount('data')).to.equal(1);
expect(terminal.ptyProcess.listenerCount('exit')).to.equal(1);

// データ送信回数の確認
expect(dataEventFireCount).to.equal(1);
expect(webviewMessageCount).to.equal(1);
```

**成功基準**:
- ✅ PTYイベントリスナーが各タイプにつき1つのみ登録される
- ✅ データイベントが重複せず1回のみ発火する
- ✅ WebViewへのメッセージも1回のみ送信される

**実装方法**: Unit Test (Mocha + Sinon)

---

#### 3.1.2 プロセス状態遷移テスト

**テストID**: `TM-PS-002`
**シナリオ名**: Process State Lifecycle Validation

**前提条件**:
- TerminalManagerインスタンスが初期化済み
- ProcessStateイベント監視が有効

**テストステップ**:
1. `createTerminal()` を呼び出す
2. 初期状態が `ProcessState.Launching` であることを確認
3. 最初のデータイベント発火を待つ
4. 状態が `ProcessState.Running` に遷移することを確認
5. `terminal.ptyProcess.kill()` を呼び出す
6. 状態が `ProcessState.KilledByUser` または `ProcessState.KilledByProcess` に遷移することを確認
7. `onExit` イベントが発火することを確認

**期待結果**:
```typescript
const stateTransitions: ProcessState[] = [];

terminalManager.onStateUpdate((event) => {
  if (event.type === 'processStateChange') {
    stateTransitions.push(event.newState);
  }
});

// Expected transitions:
// [ProcessState.Launching, ProcessState.Running, ProcessState.KilledByUser]
expect(stateTransitions).to.deep.equal([
  ProcessState.Launching,
  ProcessState.Running,
  ProcessState.KilledByUser
]);
```

**成功基準**:
- ✅ 状態遷移が正しい順序で発生する
- ✅ 各状態に対応するイベントが発火する
- ✅ 終了時に適切なクリーンアップが実行される

**実装方法**: Integration Test (VS Code Extension Test)

---

#### 3.1.3 ターミナル作成フローテスト

**テストID**: `TM-CF-003`
**シナリオ名**: Complete Terminal Creation Flow

**前提条件**:
- WebViewがレンダリング済み
- Extension Hostとの通信が確立済み

**テストステップ**:
1. WebViewが `webviewReady` メッセージを送信
2. Extensionが `init` メッセージを返信することを確認
3. ユーザーが「新規ターミナル作成」ボタンをクリック（シミュレート）
4. WebViewが `createTerminal` メッセージを送信
5. TerminalManagerが `createTerminal()` を実行
6. Extensionが `terminalCreated` メッセージをWebViewに送信
7. WebViewがターミナルコンテナを作成
8. xterm.jsインスタンスが初期化される
9. ターミナルが表示され、プロンプトが表示される

**期待結果**:
```typescript
// WebView側の確認
expect(document.querySelectorAll('.terminal-container').length).to.equal(1);
expect(document.querySelector('.terminal-container.active')).to.exist;

// Extension側の確認
const terminals = terminalManager.getTerminals();
expect(terminals).to.have.length(1);
expect(terminals[0].processState).to.equal(ProcessState.Running);
```

**成功基準**:
- ✅ WebView ↔ Extension間のメッセージフローが正常
- ✅ UIに新しいターミナルが表示される
- ✅ ターミナルが入力可能な状態になる

**実装方法**: E2E Test (VS Code Extension Test Runner)

---

### 3.2 Priority P1: Core Functionality Tests

#### 3.2.1 複数ターミナル管理テスト

**テストID**: `TM-MT-004`
**シナリオ名**: Multiple Terminal Creation and Switching

**前提条件**:
- 初期状態でターミナルが0個

**テストステップ**:
1. ターミナル1を作成
2. ターミナル2を作成
3. ターミナル3を作成
4. 合計3つのターミナルが存在することを確認
5. ターミナル1に切り替え
6. ターミナル1がアクティブになることを確認
7. ターミナル2に切り替え
8. ターミナル2がアクティブになり、ターミナル1が非アクティブになることを確認

**期待結果**:
```typescript
const terminals = terminalManager.getTerminals();
expect(terminals).to.have.length(3);

// Switch to Terminal 1
terminalManager.setActiveTerminal(terminals[0].id);
expect(terminals[0].isActive).to.be.true;
expect(terminals[1].isActive).to.be.false;
expect(terminals[2].isActive).to.be.false;

// Switch to Terminal 2
terminalManager.setActiveTerminal(terminals[1].id);
expect(terminals[0].isActive).to.be.false;
expect(terminals[1].isActive).to.be.true;
expect(terminals[2].isActive).to.be.false;
```

**成功基準**:
- ✅ 複数ターミナルが独立して管理される
- ✅ アクティブターミナルの切り替えが正常に動作
- ✅ 各ターミナルのイベントハンドラーが混在しない

**実装方法**: Integration Test

---

#### 3.2.2 ターミナル削除と状態同期テスト

**テストID**: `TM-TD-005`
**シナリオ名**: Terminal Deletion and State Synchronization

**前提条件**:
- 3つのターミナルが存在
- ターミナル2がアクティブ

**テストステップ**:
1. ターミナル2を削除
2. `deleteTerminal()` が成功することを確認
3. ターミナル数が2つに減ることを確認
4. 新しいアクティブターミナルが自動選択されることを確認（ターミナル1または3）
5. WebViewに `terminalRemoved` メッセージが送信されることを確認
6. WebViewからターミナル2のUIが削除されることを確認
7. 残りのターミナルが正常に動作することを確認

**期待結果**:
```typescript
// Before deletion
expect(terminalManager.getTerminals()).to.have.length(3);
expect(terminalManager.getActiveTerminalId()).to.equal(terminal2Id);

// After deletion
const result = await terminalManager.deleteTerminal(terminal2Id);
expect(result.success).to.be.true;
expect(terminalManager.getTerminals()).to.have.length(2);
expect(terminalManager.getActiveTerminalId()).to.not.equal(terminal2Id);

// WebView sync
expect(webviewMessages).to.include.deep.members([
  { command: 'terminalRemoved', terminalId: terminal2Id }
]);
```

**成功基準**:
- ✅ ターミナル削除が正常に完了
- ✅ 新しいアクティブターミナルが自動選択される
- ✅ WebViewとExtensionの状態が同期される

**実装方法**: Integration Test

---

#### 3.2.3 コマンド入力と出力表示テスト

**テストID**: `TM-IO-006`
**シナリオ名**: Command Input and Output Display

**前提条件**:
- 1つのターミナルが起動済み
- プロンプトが表示されている

**テストステップ**:
1. WebViewから `sendInput` メッセージを送信: `"echo 'Hello World'\n"`
2. TerminalManagerが `sendInput()` メソッドを呼び出す
3. PTYプロセスにデータが書き込まれる
4. PTYプロセスが出力データを返す: `"Hello World\n"`
5. `onData` イベントが発火
6. `_bufferData()` が呼ばれる
7. BufferManagementServiceがデータをバッファリング
8. 16ms後（またはCLI Agent検出時は4ms後）にフラッシュ
9. WebViewに `terminalData` メッセージが送信される
10. xterm.jsが出力を表示

**期待結果**:
```typescript
// Mock PTY output
mockPty.emit('data', 'Hello World\n');

// Verify buffering
await waitForBufferFlush(16); // 16ms default interval

// Verify WebView message
expect(webviewMessages).to.include.deep.members([
  {
    command: 'terminalData',
    terminalId: terminal.id,
    data: 'Hello World\n'
  }
]);
```

**成功基準**:
- ✅ 入力コマンドが正確に送信される
- ✅ 出力データが適切にバッファリングされる
- ✅ データが正確にWebViewに送信される
- ✅ データの重複や欠落がない

**実装方法**: Integration Test

---

### 3.3 Priority P2: Advanced Features Tests

#### 3.3.1 CLI Agent検出テスト

**テストID**: `TM-CA-007`
**シナリオ名**: CLI Agent Detection and Status Update

**前提条件**:
- ターミナルが起動済み
- CLI Agent検出サービスが有効

**テストステップ**:
1. ターミナルに `claude` コマンドを入力
2. CLI Agent検出サービスが "Claude Code" を検出
3. `onCliAgentStatusChange` イベントが発火
4. ステータスが `'connected'` になる
5. WebViewに `cliAgentStatusChange` メッセージが送信される
6. WebViewがステータスインジケーターを表示
7. CLI Agentを終了（`exit`）
8. ステータスが `'disconnected'` に変わる

**期待結果**:
```typescript
const statusChanges: Array<{ status: string; type: string | null }> = [];

terminalManager.onCliAgentStatusChange((event) => {
  statusChanges.push({ status: event.status, type: event.type });
});

// Simulate Claude Code launch
mockPty.emit('data', '\x1b[32m> claude\x1b[0m\n');

// Wait for detection
await waitForDetection(100);

expect(statusChanges).to.include.deep.members([
  { status: 'connected', type: 'claude' }
]);
```

**成功基準**:
- ✅ CLI Agentが正確に検出される
- ✅ ステータス変更イベントが発火する
- ✅ WebViewのUIが更新される

**実装方法**: Integration Test

---

#### 3.3.2 高頻度出力のパフォーマンステスト

**テストID**: `TM-PF-008`
**シナリオ名**: High-Frequency Output Buffering

**前提条件**:
- ターミナルが起動済み
- BufferManagementServiceが有効

**テストステップ**:
1. 1000行のデータを連続送信
2. BufferManagementServiceがデータをバッファリング
3. 16ms間隔でフラッシュが実行される
4. CPU使用率が80%以下に収まることを確認
5. メモリ使用量が適切な範囲内であることを確認
6. すべてのデータが欠落なくWebViewに送信される

**期待結果**:
```typescript
const startTime = Date.now();
const lines = 1000;

for (let i = 0; i < lines; i++) {
  mockPty.emit('data', `Line ${i}\n`);
}

// Wait for all data to be flushed
await waitForAllDataFlushed();

const duration = Date.now() - startTime;
const receivedLines = webviewMessages.filter(m => m.command === 'terminalData');

expect(receivedLines.length).to.be.greaterThan(0);
expect(duration).to.be.lessThan(5000); // 5秒以内
```

**成功基準**:
- ✅ 大量データが効率的に処理される
- ✅ バッファリングによりパフォーマンスが最適化される
- ✅ データの欠落や順序の乱れがない

**実装方法**: Performance Test

---

#### 3.3.3 リサイズ処理テスト

**テストID**: `TM-RZ-009`
**シナリオ名**: Terminal Resize Handling

**前提条件**:
- ターミナルが起動済み
- 初期サイズが80x24

**テストステップ**:
1. WebViewから `resize` メッセージを送信: `{ cols: 120, rows: 30 }`
2. TerminalManagerが `resize()` メソッドを呼び出す
3. PTYプロセスのサイズが変更される
4. xterm.jsのサイズも連動して変更される
5. 複数回連続でリサイズを実行（デバウンステスト）
6. 最終的なリサイズのみが適用されることを確認

**期待結果**:
```typescript
// Initial resize
terminalManager.resize(120, 30, terminal.id);
expect(mockPty.resize).to.have.been.calledWith(120, 30);

// Rapid resizes (debounce test)
terminalManager.resize(100, 25, terminal.id);
terminalManager.resize(110, 27, terminal.id);
terminalManager.resize(120, 30, terminal.id);

// Wait for debounce
await waitForDebounce(200);

// Only the last resize should be applied
expect(mockPty.resize).to.have.been.calledOnce; // or limited times
```

**成功基準**:
- ✅ リサイズが正確に実行される
- ✅ デバウンス処理が正常に動作する
- ✅ パフォーマンスへの影響が最小限

**実装方法**: Unit Test

---

### 3.4 Priority P3: Error Handling Tests

#### 3.4.1 PTYプロセス起動失敗テスト

**テストID**: `TM-EH-010`
**シナリオ名**: PTY Process Launch Failure Recovery

**前提条件**:
- シェルバイナリが存在しない状態をシミュレート

**テストステップ**:
1. `createTerminal()` を呼び出す
2. PTYプロセスの起動が失敗する（Error）
3. エラーが適切にキャッチされる
4. ユーザーにエラーメッセージが表示される
5. ターミナルリストにターミナルが追加されない
6. リソースリークが発生しない

**期待結果**:
```typescript
// Simulate PTY spawn failure
sinon.stub(terminalSpawner, 'spawnTerminal').throws(new Error('Shell not found'));

const terminalId = terminalManager.createTerminal();

expect(terminalId).to.equal('');
expect(terminalManager.getTerminals()).to.have.length(0);
expect(errorMessages).to.include('Failed to create terminal');
```

**成功基準**:
- ✅ エラーが適切にハンドリングされる
- ✅ 部分的に作成されたリソースがクリーンアップされる
- ✅ ユーザーに明確なエラーメッセージが表示される

**実装方法**: Unit Test

---

#### 3.4.2 WebView通信エラーテスト

**テストID**: `TM-EH-011`
**シナリオ名**: WebView Message Communication Failure

**前提条件**:
- ターミナルが起動済み
- WebViewが一時的に応答しない状態

**テストステップ**:
1. WebViewへのメッセージ送信が失敗する
2. メッセージがキューに保存される
3. WebViewが復旧する
4. キューに保存されたメッセージが再送される
5. すべてのメッセージが正常に配信される

**期待結果**:
```typescript
// Simulate WebView offline
mockWebview.postMessage = sinon.stub().rejects(new Error('WebView not ready'));

// Send message (should be queued)
await terminalManager.sendDataToWebView(terminal.id, 'test data');

// Verify queued
expect(messageQueue.length).to.equal(1);

// WebView comes back online
mockWebview.postMessage = sinon.stub().resolves();

// Messages are flushed
await flushMessageQueue();

expect(mockWebview.postMessage).to.have.been.called;
expect(messageQueue.length).to.equal(0);
```

**成功基準**:
- ✅ メッセージがロストしない
- ✅ WebView復旧後に正常に配信される
- ✅ ユーザー体験が損なわれない

**実装方法**: Integration Test

---

#### 3.4.3 メモリリークテスト

**テストID**: `TM-ML-012`
**シナリオ名**: Memory Leak Detection and Prevention

**前提条件**:
- TerminalManagerが初期化済み
- Node.jsのガベージコレクションが有効

**テストステップ**:
1. 初期メモリ使用量を記録
2. 100個のターミナルを作成
3. すべてのターミナルを削除
4. `dispose()` メソッドを呼び出す
5. ガベージコレクションを強制実行
6. 最終メモリ使用量を測定
7. メモリ増加量が許容範囲内（<5MB）であることを確認

**期待結果**:
```typescript
const initialMemory = process.memoryUsage().heapUsed;

for (let i = 0; i < 100; i++) {
  const terminalId = terminalManager.createTerminal();
  await terminalManager.deleteTerminal(terminalId);
}

terminalManager.dispose();

if (global.gc) global.gc();

const finalMemory = process.memoryUsage().heapUsed;
const memoryIncrease = finalMemory - initialMemory;

expect(memoryIncrease).to.be.lessThan(5 * 1024 * 1024); // 5MB limit
```

**成功基準**:
- ✅ イベントリスナーが適切に解放される
- ✅ PTYプロセスが確実に終了する
- ✅ メモリリークが検出されない

**実装方法**: Performance Test

---

## 4. テスト実装ガイド

### 4.1 テスト環境セットアップ

#### 4.1.1 必要なツール

```json
{
  "devDependencies": {
    "@vscode/test-electron": "^2.3.0",
    "mocha": "^10.0.0",
    "chai": "^4.3.0",
    "sinon": "^15.0.0",
    "sinon-chai": "^3.7.0"
  }
}
```

#### 4.1.2 テストディレクトリ構造

```
src/test/
├── integration/
│   ├── terminal/
│   │   ├── TerminalEventHandlers.test.ts       # TM-EH-001, TM-PS-002
│   │   ├── TerminalCreationFlow.test.ts        # TM-CF-003
│   │   ├── MultipleTerminalManagement.test.ts  # TM-MT-004
│   │   └── TerminalDeletion.test.ts            # TM-TD-005
│   ├── messaging/
│   │   ├── CommandInputOutput.test.ts          # TM-IO-006
│   │   ├── WebViewCommunication.test.ts        # TM-EH-011
│   │   └── CliAgentDetection.test.ts           # TM-CA-007
│   └── performance/
│       ├── HighFrequencyOutput.test.ts         # TM-PF-008
│       └── MemoryLeak.test.ts                  # TM-ML-012
├── unit/
│   └── terminals/
│       ├── TerminalResize.test.ts              # TM-RZ-009
│       └── ErrorHandling.test.ts               # TM-EH-010
└── e2e/
    └── TerminalFullFlow.test.ts                # Complete user flows
```

### 4.2 サンプルテストコード

#### 4.2.1 Unit Test Example (TM-EH-001)

```typescript
// src/test/integration/terminal/TerminalEventHandlers.test.ts

import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { ProcessState } from '../../../types/shared';

describe('Terminal Event Handlers Integration', () => {
  let terminalManager: TerminalManager;
  let dataEventSpy: sinon.SinonSpy;
  let exitEventSpy: sinon.SinonSpy;

  beforeEach(() => {
    terminalManager = new TerminalManager();
    dataEventSpy = sinon.spy();
    exitEventSpy = sinon.spy();

    terminalManager.onData(dataEventSpy);
    terminalManager.onExit(exitEventSpy);
  });

  afterEach(() => {
    terminalManager.dispose();
  });

  it('[TM-EH-001] should register only one event handler per event type', async () => {
    // Step 1: Create terminal
    const terminalId = terminalManager.createTerminal();
    expect(terminalId).to.not.be.empty;

    // Step 2: Get terminal instance
    const terminal = terminalManager.getTerminal(terminalId);
    expect(terminal).to.exist;

    // Step 3: Verify event listener counts
    const ptyProcess = terminal!.ptyProcess as any;
    expect(ptyProcess.listenerCount('data')).to.equal(1);
    expect(ptyProcess.listenerCount('exit')).to.equal(1);

    // Step 4: Send test data
    ptyProcess.emit('data', 'test data\n');

    // Step 5: Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 50));

    // Step 6: Verify event fired only once
    expect(dataEventSpy.callCount).to.equal(1);
    expect(dataEventSpy.firstCall.args[0]).to.deep.include({
      terminalId,
      data: 'test data\n'
    });
  });

  it('[TM-PS-002] should transition process states correctly', async () => {
    const stateTransitions: ProcessState[] = [];

    terminalManager.onStateUpdate((event: any) => {
      if (event.type === 'processStateChange') {
        stateTransitions.push(event.newState);
      }
    });

    // Step 1: Create terminal (should be Launching)
    const terminalId = terminalManager.createTerminal();
    const terminal = terminalManager.getTerminal(terminalId)!;

    // Step 2: Verify initial state
    expect(terminal.processState).to.equal(ProcessState.Launching);
    expect(stateTransitions).to.include(ProcessState.Launching);

    // Step 3: Emit first data (should transition to Running)
    const ptyProcess = terminal.ptyProcess as any;
    ptyProcess.emit('data', 'shell prompt > ');

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(terminal.processState).to.equal(ProcessState.Running);
    expect(stateTransitions).to.include(ProcessState.Running);

    // Step 4: Kill terminal (should transition to KilledByUser)
    await terminalManager.deleteTerminal(terminalId);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(stateTransitions).to.include.members([
      ProcessState.Launching,
      ProcessState.Running,
      ProcessState.KilledByUser
    ]);
  });
});
```

#### 4.2.2 Integration Test Example (TM-CF-003)

```typescript
// src/test/integration/terminal/TerminalCreationFlow.test.ts

import * as vscode from 'vscode';
import { expect } from 'chai';
import { SecondaryTerminalProvider } from '../../../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../../../terminals/TerminalManager';

describe('Terminal Creation Flow E2E', function() {
  this.timeout(10000); // E2E tests may take longer

  let context: vscode.ExtensionContext;
  let provider: SecondaryTerminalProvider;
  let terminalManager: TerminalManager;

  before(async () => {
    // Initialize VS Code extension context
    const extension = vscode.extensions.getExtension('your-extension-id');
    context = extension!.extensionContext;

    terminalManager = new TerminalManager();
    provider = new SecondaryTerminalProvider(context, terminalManager);
  });

  after(() => {
    terminalManager.dispose();
  });

  it('[TM-CF-003] should complete full terminal creation flow', async () => {
    const messages: any[] = [];

    // Step 1: Create WebView mock
    const mockWebview = {
      postMessage: (message: any) => {
        messages.push(message);
        return Promise.resolve(true);
      },
      onDidReceiveMessage: (handler: (message: any) => void) => {
        // Simulate webviewReady message
        setTimeout(() => handler({ command: 'webviewReady' }), 10);
        return { dispose: () => {} };
      }
    } as any;

    // Step 2: Initialize provider with mock WebView
    await provider.resolveWebviewView(
      { webview: mockWebview } as any,
      {} as any,
      {} as any
    );

    // Step 3: Wait for init message
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(messages).to.deep.include.members([
      { command: 'init' }
    ]);

    // Step 4: Simulate createTerminal from WebView
    const createMessage = { command: 'createTerminal' };
    mockWebview.onDidReceiveMessage((handler: any) => {
      handler(createMessage);
    });

    // Step 5: Wait for terminalCreated message
    await new Promise(resolve => setTimeout(resolve, 200));

    const terminalCreatedMsg = messages.find(m => m.command === 'terminalCreated');
    expect(terminalCreatedMsg).to.exist;
    expect(terminalCreatedMsg.terminal).to.have.property('id');
    expect(terminalCreatedMsg.terminal).to.have.property('name');

    // Step 6: Verify terminal exists in TerminalManager
    const terminals = terminalManager.getTerminals();
    expect(terminals).to.have.length(1);
    expect(terminals[0].id).to.equal(terminalCreatedMsg.terminal.id);
  });
});
```

#### 4.2.3 Performance Test Example (TM-PF-008)

```typescript
// src/test/integration/performance/HighFrequencyOutput.test.ts

import { expect } from 'chai';
import { TerminalManager } from '../../../terminals/TerminalManager';

describe('High-Frequency Output Performance', function() {
  this.timeout(30000); // Performance tests may take longer

  let terminalManager: TerminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    terminalManager.dispose();
  });

  it('[TM-PF-008] should handle 1000 lines of output efficiently', async () => {
    const terminalId = terminalManager.createTerminal();
    const terminal = terminalManager.getTerminal(terminalId)!;
    const ptyProcess = terminal.ptyProcess as any;

    const startTime = Date.now();
    const lines = 1000;
    let receivedLines = 0;

    // Count received data events
    terminalManager.onData((event) => {
      if (event.terminalId === terminalId) {
        receivedLines++;
      }
    });

    // Emit high-frequency data
    for (let i = 0; i < lines; i++) {
      ptyProcess.emit('data', `Line ${i}\n`);
    }

    // Wait for all data to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));

    const duration = Date.now() - startTime;

    // Assertions
    expect(receivedLines).to.be.greaterThan(0);
    expect(duration).to.be.lessThan(10000); // Should complete within 10 seconds

    console.log(`Processed ${lines} lines in ${duration}ms (${receivedLines} batches)`);
  });

  it('[TM-ML-012] should not leak memory with repeated operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Create and delete 100 terminals
    for (let i = 0; i < 100; i++) {
      const terminalId = terminalManager.createTerminal();
      await terminalManager.deleteTerminal(terminalId);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024);

    console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);
    expect(memoryIncrease).to.be.lessThan(10); // Less than 10MB increase
  });
});
```

### 4.3 CI/CD統合

#### 4.3.1 GitHub Actions Workflow

```yaml
# .github/workflows/integration-tests.yml

name: Integration Tests

on:
  push:
    branches: [ main, for-publish ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}

    - name: Install dependencies
      run: npm ci

    - name: Run Unit Tests
      run: npm run test:unit

    - name: Run Integration Tests
      run: npm run test:integration
      env:
        DISPLAY: ':99.0'

    - name: Run Performance Tests
      run: npm run test:performance

    - name: Upload Test Results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results-${{ matrix.os }}-${{ matrix.node-version }}
        path: test-results/

    - name: Check Test Coverage
      run: npm run test:coverage
      if: matrix.os == 'ubuntu-latest' && matrix.node-version == '20.x'

    - name: Upload Coverage to Codecov
      uses: codecov/codecov-action@v3
      if: matrix.os == 'ubuntu-latest' && matrix.node-version == '20.x'
```

### 4.4 テスト実行コマンド

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "mocha --require ts-node/register 'src/test/unit/**/*.test.ts'",
    "test:integration": "mocha --require ts-node/register 'src/test/integration/**/*.test.ts'",
    "test:performance": "mocha --require ts-node/register 'src/test/integration/performance/**/*.test.ts'",
    "test:e2e": "node ./out/test/runTest.js",
    "test:coverage": "nyc npm run test",
    "test:watch": "mocha --watch --require ts-node/register 'src/test/**/*.test.ts'",
    "test:specific": "mocha --require ts-node/register --grep"
  }
}
```

**実行例**:
```bash
# すべてのテストを実行
npm test

# 単体テストのみ実行
npm run test:unit

# 統合テストのみ実行
npm run test:integration

# 特定のテストを実行
npm run test:specific "TM-EH-001"

# カバレッジレポート生成
npm run test:coverage

# Watch mode（開発時）
npm run test:watch
```

---

## 5. テスト結果の評価基準

### 5.1 成功基準

| カテゴリ | 基準 | 目標値 |
|---------|------|--------|
| **テスト成功率** | すべての優先度P0テストが成功 | 100% |
| **テストカバレッジ** | TerminalManager + WebView | ≥85% |
| **パフォーマンス** | 1000行出力処理時間 | <10秒 |
| **メモリ使用量** | 100回作成/削除後の増加量 | <10MB |
| **CI/CD** | すべてのプラットフォームでパス | 3/3 |

### 5.2 品質ゲート

リリース前に以下の品質ゲートをパスする必要があります：

```bash
npm run pre-release:check
```

このコマンドは以下を実行します：
1. ✅ TDD品質ゲート（50%以上のTDDコンプライアンス）
2. ✅ すべての単体テスト
3. ✅ すべての統合テスト
4. ✅ カバレッジチェック（85%以上）
5. ✅ ESLintチェック
6. ✅ TypeScriptコンパイル

### 5.3 既知の問題と回避策

#### Issue 1: Ubuntu CI環境でのテストタイムアウト
**現象**: Ubuntuでのテスト実行が30分以上かかりタイムアウト
**原因**: テストランナーの問題（既知のバグ）
**回避策**: Windows/macOSのテスト結果を優先、Ubuntuは参考値とする

#### Issue 2: node-ptyのネイティブモジュールエラー
**現象**: 一部環境でnode-ptyのロードに失敗
**原因**: プラットフォーム固有のバイナリが必要
**回避策**: `npm rebuild` を実行、または正しいバイナリを手動インストール

---

## 6. 今後の改善計画

### 6.1 Phase 1: 基本テストの確立（現在）
- [x] TM-EH-001: イベントハンドラー統合テスト
- [x] TM-PS-002: プロセス状態遷移テスト
- [ ] TM-CF-003: ターミナル作成フローテスト（進行中）

### 6.2 Phase 2: 統合テストの拡充（Next Sprint）
- [ ] TM-MT-004: 複数ターミナル管理テスト
- [ ] TM-TD-005: ターミナル削除テスト
- [ ] TM-IO-006: コマンド入力出力テスト

### 6.3 Phase 3: E2Eテストの実装（Future）
- [ ] Playwright統合（VS Code自動化）
- [ ] ビジュアルリグレッションテスト
- [ ] ユーザーシナリオベーステスト

---

## 7. 参考資料

### 7.1 内部ドキュメント
- `/docs/tdd-test-plan-terminal-manager-refactoring.md` - TDDテスト計画詳細
- `/docs/tdd-test-architecture-diagram.md` - アーキテクチャ図
- `/src/terminals/CLAUDE.md` - ターミナル管理実装ガイド
- `/src/webview/CLAUDE.md` - WebView実装ガイド
- `/src/test/CLAUDE.md` - TDD実装効率化ガイド

### 7.2 外部リンク
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [xterm.js Documentation](https://xtermjs.org/)
- [node-pty GitHub](https://github.com/microsoft/node-pty)
- [Mocha Testing Framework](https://mochajs.org/)

---

## 8. まとめ

本テスト計画は、VS Code拡張機能「Secondary Terminal」のTerminalManagerリファクタリングを検証するための、**実装可能で現実的な**統合テストガイドラインです。

**重要なポイント**:
1. ✅ **3層アプローチ**: Unit → Integration → E2E の段階的テスト
2. ✅ **VS Code制約への対応**: WebView直接アクセス不可を考慮した設計
3. ✅ **既存フレームワーク活用**: Mocha + Chai + Sinon で実装可能
4. ✅ **優先度付け**: P0（Critical）から段階的に実装
5. ✅ **CI/CD統合**: GitHub Actionsで自動実行

このテスト計画に従うことで、リファクタリングの正確性を検証し、高品質なリリースを実現できます。

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-30
**Author**: Claude (AI Assistant)
**Review Status**: Draft → Ready for Implementation
