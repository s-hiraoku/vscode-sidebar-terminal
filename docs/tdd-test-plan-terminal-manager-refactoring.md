# TDD Test Plan: TerminalManager Event Handler Refactoring

## 変更概要

### リファクタリング対象
- **ファイル**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/terminals/TerminalManager.ts`
- **メソッド**: `createTerminal()` および `createTerminalWithProfile()`

### リファクタリング内容
`createTerminal()` メソッド内で重複していたイベントハンドラー設定を削除し、既存の `_setupTerminalEvents()` メソッドに統一。

#### Before (createTerminal 内の重複コード - 行490-492)
```typescript
// Set up terminal event handlers (PTY data, exit, etc.)
// This replaces the duplicate onData handler that was causing double character display
this._setupTerminalEvents(terminal);
```

現在、`createTerminal()` は `_setupTerminalEvents()` を呼び出しているが、歴史的に重複したイベントハンドラー設定が存在していた可能性がある。

#### After (期待される状態)
- `createTerminal()`: `_setupTerminalEvents()` のみ呼び出し
- `createTerminalWithProfile()`: `_setupTerminalEvents()` のみ呼び出し
- 重複したイベントハンドラー設定は一切存在しない

### リファクタリングの目的
1. コードの重複削減
2. イベントハンドラー設定の一元化
3. 保守性の向上
4. **二重文字表示バグの防止** (最重要)

---

## TDD実装戦略

### Phase 1: RED - 失敗するテストを書く

#### 1.1 イベントハンドラー重複防止テスト
**目的**: イベントハンドラーが一度だけ設定されることを保証

**テストファイル**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/unit/terminals/TerminalManager.EventHandlers.test.ts`

```typescript
describe('TerminalManager - Event Handler Setup', () => {
  describe('Event Handler Duplication Prevention', () => {
    it('should set up onData handler only once in createTerminal()', () => {
      // RED: このテストは重複ハンドラーを検出するはず
      const terminalId = terminalManager.createTerminal();
      const terminal = terminalManager.getTerminal(terminalId);

      // Mock PTY でデータイベント発火回数をカウント
      let dataEventCount = 0;
      const mockData = 'test output';

      // データイベントをリッスン
      terminalManager.onData((event) => {
        if (event.terminalId === terminalId && event.data === mockData) {
          dataEventCount++;
        }
      });

      // PTY からデータ送信をシミュレート
      terminal.ptyProcess.onData の emit をトリガー

      // 期待: データイベントは1回だけ発火
      expect(dataEventCount).to.equal(1);
    });

    it('should set up onExit handler only once in createTerminal()', () => {
      // RED: このテストは重複ハンドラーを検出するはず
      const terminalId = terminalManager.createTerminal();
      const terminal = terminalManager.getTerminal(terminalId);

      let exitEventCount = 0;

      terminalManager.onExit((event) => {
        if (event.terminalId === terminalId) {
          exitEventCount++;
        }
      });

      // PTY プロセス終了をシミュレート
      terminal.ptyProcess.onExit の emit をトリガー

      // 期待: 終了イベントは1回だけ発火
      expect(exitEventCount).to.equal(1);
    });
  });
});
```

#### 1.2 プロセス状態遷移テスト
**目的**: ProcessState が正しく遷移することを保証

```typescript
describe('TerminalManager - Process State Management', () => {
  it('should transition from Launching to Running on first data', () => {
    // RED: プロセス状態遷移が正しく行われるかテスト
    const terminalId = terminalManager.createTerminal();
    const terminal = terminalManager.getTerminal(terminalId);

    // 初期状態: Launching
    expect(terminal.processState).to.equal(ProcessState.Launching);

    // データ受信をシミュレート
    simulatePtyData(terminal, 'first output');

    // 期待: Running に遷移
    expect(terminal.processState).to.equal(ProcessState.Running);
  });

  it('should set KilledByUser state when deleteTerminal is called', async () => {
    const terminalId = terminalManager.createTerminal();

    // ターミナルを削除
    await terminalManager.deleteTerminal(terminalId);

    // 削除前の状態を確認 (onExit イベントで検証)
    expect(lastExitEvent.processState).to.equal(ProcessState.KilledByUser);
  });
});
```

#### 1.3 createTerminal vs createTerminalWithProfile 一致性テスト
**目的**: 両メソッドが同じパターンを使用することを保証

```typescript
describe('TerminalManager - Method Consistency', () => {
  it('should use same event setup pattern in both create methods', async () => {
    // createTerminal のイベントハンドラー
    const terminal1Id = terminalManager.createTerminal();
    const terminal1 = terminalManager.getTerminal(terminal1Id);

    // createTerminalWithProfile のイベントハンドラー
    const terminal2Id = await terminalManager.createTerminalWithProfile();
    const terminal2 = terminalManager.getTerminal(terminal2Id);

    // 両方のターミナルで同じイベントパターンを確認
    expect(hasDataHandler(terminal1)).to.be.true;
    expect(hasDataHandler(terminal2)).to.be.true;
    expect(hasExitHandler(terminal1)).to.be.true;
    expect(hasExitHandler(terminal2)).to.be.true;
  });
});
```

---

### Phase 2: GREEN - テストを通す最小限の実装

#### 2.1 _setupTerminalEvents() の検証
現在の実装を検証し、重複がないことを確認:

```typescript
// src/terminals/TerminalManager.ts (lines 1574-1662)
private _setupTerminalEvents(terminal: TerminalInstance): void {
  const { id: terminalId, ptyProcess } = terminal;

  // Initialize process state
  terminal.processState = ProcessState.Launching;
  this._notifyProcessStateChange(terminal, ProcessState.Launching);

  // Set up data event handler with CLI agent detection and shell integration
  (ptyProcess as any).onData((data: string) => {
    // Update process state to running on first data
    if (terminal.processState === ProcessState.Launching) {
      terminal.processState = ProcessState.Running;
      this._notifyProcessStateChange(terminal, ProcessState.Running);
    }

    // Process data...
    this._bufferData(terminalId, data);
  });

  // Set up exit event handler
  (ptyProcess as any).onExit((event: number | { exitCode: number; signal?: number }) => {
    // Handle exit with proper state transitions...
  });
}
```

#### 2.2 createTerminal() の修正確認
既存コード (lines 492) がすでに正しいパターンを使用していることを確認:

```typescript
// Set up terminal event handlers (PTY data, exit, etc.)
// This replaces the duplicate onData handler that was causing double character display
this._setupTerminalEvents(terminal);
```

#### 2.3 createTerminalWithProfile() の修正確認
既存コード (line 312) がすでに正しいパターンを使用していることを確認:

```typescript
// Set up terminal event handlers
this._setupTerminalEvents(terminal);
```

**結論**: 現在の実装はすでにリファクタリング済みであり、重複ハンドラーは存在しない。

---

### Phase 3: REFACTOR - テストとコードの改善

#### 3.1 統合テストの追加
**テストファイル**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/integration/terminal/EventHandlerIntegration.test.ts`

```typescript
describe('Terminal Event Handler Integration', () => {
  it('should handle multiple terminals without event cross-contamination', () => {
    // 複数ターミナル作成
    const terminal1 = terminalManager.createTerminal();
    const terminal2 = terminalManager.createTerminal();

    // Terminal 1 にデータ送信
    simulatePtyData(terminal1, 'terminal1 output');

    // Terminal 1 のイベントのみ発火することを確認
    expect(lastDataEvent.terminalId).to.equal(terminal1);
    expect(lastDataEvent.data).to.equal('terminal1 output');
  });

  it('should clean up event handlers on terminal deletion', async () => {
    const terminalId = terminalManager.createTerminal();

    // ターミナル削除
    await terminalManager.deleteTerminal(terminalId);

    // イベントハンドラーがクリーンアップされていることを確認
    // (メモリリーク防止)
    expect(hasActiveEventListeners(terminalId)).to.be.false;
  });
});
```

#### 3.2 エッジケーステストの追加
```typescript
describe('Terminal Event Handler Edge Cases', () => {
  it('should handle rapid terminal creation and deletion', async () => {
    const terminalIds = [];

    // 高速で5つのターミナルを作成・削除
    for (let i = 0; i < 5; i++) {
      const id = terminalManager.createTerminal();
      terminalIds.push(id);
      await terminalManager.deleteTerminal(id);
    }

    // メモリリークがないことを確認
    expect(terminalManager.getTerminals().length).to.equal(0);
  });

  it('should handle process exit during event handler setup', () => {
    // プロセスが即座に終了する場合のテスト
    const terminalId = terminalManager.createTerminal();

    // イベントハンドラー設定中にプロセス終了
    simulateImmediateProcessExit(terminalId);

    // クラッシュせずに適切に処理されることを確認
    expect(terminalManager.getTerminal(terminalId)).to.be.undefined;
  });
});
```

---

## テスト実装ガイド

### テストファイル構造

```
src/test/unit/terminals/
├── TerminalManager.EventHandlers.test.ts      (新規: イベントハンドラーテスト)
├── TerminalManager.ProcessState.test.ts       (新規: プロセス状態管理テスト)
├── TerminalLifecycleService.test.ts           (既存)
└── CliAgentDetection.test.ts                  (既存)

src/test/integration/terminal/
├── EventHandlerIntegration.test.ts            (新規: 統合テスト)
├── TerminalCreationFlow.test.ts               (既存)
└── SplitTerminalFunctionality.test.ts         (既存)
```

### Mock/Stub実装パターン

#### PTY Process Mock
```typescript
// src/test/utils/MockPtyProcess.ts
export class MockPtyProcess {
  private dataHandlers: Array<(data: string) => void> = [];
  private exitHandlers: Array<(event: any) => void> = [];

  onData(handler: (data: string) => void) {
    this.dataHandlers.push(handler);
    return { dispose: () => {
      const index = this.dataHandlers.indexOf(handler);
      if (index > -1) this.dataHandlers.splice(index, 1);
    }};
  }

  onExit(handler: (event: any) => void) {
    this.exitHandlers.push(handler);
    return { dispose: () => {
      const index = this.exitHandlers.indexOf(handler);
      if (index > -1) this.exitHandlers.splice(index, 1);
    }};
  }

  // Test helper: データイベントを発火
  emitData(data: string) {
    this.dataHandlers.forEach(handler => handler(data));
  }

  // Test helper: 終了イベントを発火
  emitExit(exitCode: number) {
    this.exitHandlers.forEach(handler => handler({ exitCode }));
  }

  // Test helper: ハンドラー数を取得
  getDataHandlerCount() {
    return this.dataHandlers.length;
  }

  getExitHandlerCount() {
    return this.exitHandlers.length;
  }
}
```

---

## テスト実行戦略

### 1. ユニットテスト (最優先)
```bash
# イベントハンドラーテストのみ実行
npm run test -- --grep "Event Handler"

# プロセス状態管理テストのみ実行
npm run test -- --grep "Process State"
```

### 2. 統合テスト
```bash
# 統合テスト実行
npm run test:integration -- --grep "EventHandlerIntegration"
```

### 3. 回帰テスト
```bash
# 既存のターミナル関連テストを全て実行
npm run test -- src/test/suite/terminal-manager.test.ts
npm run test -- src/test/integration/terminal/
```

### 4. TDD品質ゲート
```bash
# リファクタリング後の品質チェック
npm run tdd:quality-gate
npm run test:coverage
```

---

## 成功基準

### ユニットテスト成功基準
- ✅ イベントハンドラーが一度だけ設定される (重複なし)
- ✅ データイベントが正確に1回発火する
- ✅ 終了イベントが正確に1回発火する
- ✅ プロセス状態遷移が正しく行われる
- ✅ `createTerminal()` と `createTerminalWithProfile()` が同じパターンを使用

### 統合テスト成功基準
- ✅ 複数ターミナルでイベントが混在しない
- ✅ ターミナル削除時にイベントハンドラーがクリーンアップされる
- ✅ 高速作成・削除でメモリリークが発生しない

### 品質ゲート成功基準
- ✅ テストカバレッジ 85% 以上維持
- ✅ TDD品質スコア 50% 以上 (目標: 85%)
- ✅ 全テスト成功率 93% 以上
- ✅ パフォーマンス劣化なし

---

## リスク管理

### リスク 1: 二重文字表示の再発
**緩和策**:
- イベントハンドラー数をカウントするテスト追加
- データ発火回数を厳密にテスト
- 統合テストで実際の文字表示をシミュレート

### リスク 2: プロセス状態遷移の不整合
**緩和策**:
- 全ての状態遷移パターンをテスト
- 異常系 (プロセスクラッシュ) をテスト
- タイミング問題を検出するテスト追加

### リスク 3: メモリリーク
**緩和策**:
- イベントハンドラーの dispose 確認
- 長時間実行テストでメモリ使用量監視
- GC 強制実行後のメモリチェック

---

## 実装チェックリスト

### Phase 1: RED (失敗するテストを書く)
- [ ] `TerminalManager.EventHandlers.test.ts` 作成
- [ ] イベントハンドラー重複検出テスト実装
- [ ] プロセス状態遷移テスト実装
- [ ] メソッド一致性テスト実装
- [ ] テスト実行 → RED 確認

### Phase 2: GREEN (テストを通す)
- [ ] `_setupTerminalEvents()` 実装確認
- [ ] `createTerminal()` でイベント設定確認
- [ ] `createTerminalWithProfile()` でイベント設定確認
- [ ] 重複ハンドラーが存在しないことを確認
- [ ] テスト実行 → GREEN 確認

### Phase 3: REFACTOR (改善)
- [ ] 統合テスト追加
- [ ] エッジケーステスト追加
- [ ] Mock/Stub 実装改善
- [ ] ドキュメント更新
- [ ] TDD品質ゲート実行

### Phase 4: 品質保証
- [ ] 全テスト実行 (成功率 93% 以上)
- [ ] カバレッジチェック (85% 以上)
- [ ] パフォーマンステスト実行
- [ ] メモリリークチェック
- [ ] CI/CD パイプライン実行

---

## 参考資料

### 関連ファイル
- `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/terminals/TerminalManager.ts`
- `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/terminals/core/TerminalLifecycleService.ts`
- `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/types/shared.ts` (ProcessState enum)

### 既存テスト参考
- `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/suite/terminal-manager.test.ts`
- `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/unit/terminals/TerminalLifecycleService.test.ts`

### TDD実践ガイド
- `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/CLAUDE.md`
- `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/terminals/CLAUDE.md`

---

## まとめ

このTDDテスト計画は、TerminalManagerのイベントハンドラーリファクタリングに対する包括的なテスト戦略を提供します。

**重要なポイント**:
1. **二重文字表示バグ防止が最優先目標**
2. **イベントハンドラーの重複を厳密にテスト**
3. **プロセス状態遷移の正確性を保証**
4. **メモリリークを防止**
5. **TDD品質基準を維持**

t-wadaのTDD手法に基づき、RED-GREEN-REFACTORサイクルを厳密に守り、高品質なコードベースを維持します。
