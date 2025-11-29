# TDDテスト計画サマリー: TerminalManager イベントハンドラーリファクタリング

## 作成されたドキュメント・テストファイル

### 1. 包括的TDD計画書
**ファイル**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/tdd-test-plan-terminal-manager-refactoring.md`

**内容**:
- RED-GREEN-REFACTORサイクルの詳細計画
- テスト戦略とテストケース設計
- Mock/Stub実装パターン
- 成功基準とリスク管理
- 実装チェックリスト

### 2. ユニットテスト実装
**ファイル**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/unit/terminals/TerminalManager.EventHandlers.test.ts`

**テストスイート**:
- **RED Phase**: イベントハンドラー重複検出
- **RED Phase**: データイベント発火回数検証
- **GREEN Phase**: プロセス状態管理
- **REFACTOR Phase**: メソッド一貫性
- **REFACTOR Phase**: エッジケース
- **REFACTOR Phase**: ハンドラークリーンアップ
- イベント混在防止テスト

**テスト数**: 15+ テストケース

### 3. 統合テスト実装
**ファイル**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/integration/terminal/EventHandlerIntegration.test.ts`

**テストスイート**:
- 複数ターミナルのイベント分離
- ライフサイクル管理
- 並行操作の安全性
- プロセス状態統合
- ストレステスト
- メモリ管理統合
- 回帰テスト

**テスト数**: 20+ テストケース

### 4. テスト実行ガイド
**ファイル**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/tdd-test-execution-guide.md`

**内容**:
- フェーズごとのテスト実行手順
- トラブルシューティングガイド
- CI/CD統合方法
- パフォーマンスベンチマーク
- カバレッジ確認方法

---

## テスト実行クイックスタート

### ステップ1: ユニットテスト実行
```bash
cd /Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish

# イベントハンドラーテストのみ実行
npm run test -- --grep "Event Handler"
```

**期待される結果**: 15+個のテストが成功

### ステップ2: 統合テスト実行
```bash
# 統合テスト実行
npm run test -- src/test/integration/terminal/EventHandlerIntegration.test.ts
```

**期待される結果**: 20+個のテストが成功

### ステップ3: TDD品質ゲート
```bash
# 品質基準チェック
npm run tdd:quality-gate
npm run test:coverage
```

**成功基準**:
- ✅ TDDコンプライアンス: 50%以上
- ✅ テストカバレッジ: 85%以上
- ✅ テスト成功率: 93%以上

---

## テスト戦略の概要

### Phase 1: RED (失敗するテストを書く)

#### 1.1 イベントハンドラー重複検出
```typescript
it('should register onData handler exactly once in createTerminal()', () => {
  const terminalId = terminalManager.createTerminal();

  // MockPtyProcessを使ってハンドラー数をカウント
  expect(mockPty.getDataHandlerCount()).to.equal(1);
});
```

**目的**: イベントハンドラーが一度だけ登録されることを保証

#### 1.2 データイベント発火回数検証
```typescript
it('should emit data event exactly once when PTY sends data', (done) => {
  let dataEventCount = 0;

  terminalManager.onData((event) => {
    dataEventCount++;
  });

  mockPty.emitData('test');

  setTimeout(() => {
    expect(dataEventCount).to.equal(1);
    done();
  }, 100);
});
```

**目的**: 二重文字表示バグの防止

---

### Phase 2: GREEN (テストを通す最小限の実装)

#### 現在の実装検証
```typescript
// src/terminals/TerminalManager.ts

// createTerminal() - 行492
this._setupTerminalEvents(terminal);

// createTerminalWithProfile() - 行312
this._setupTerminalEvents(terminal);

// _setupTerminalEvents() - 行1574-1662
private _setupTerminalEvents(terminal: TerminalInstance): void {
  // Initialize process state
  terminal.processState = ProcessState.Launching;

  // Set up data event handler (一度だけ)
  (ptyProcess as any).onData((data: string) => {
    if (terminal.processState === ProcessState.Launching) {
      terminal.processState = ProcessState.Running;
    }
    this._bufferData(terminalId, data);
  });

  // Set up exit event handler (一度だけ)
  (ptyProcess as any).onExit((event) => {
    // Handle exit...
  });
}
```

**結論**: 現在の実装は既にリファクタリング済みで、重複ハンドラーは存在しない

---

### Phase 3: REFACTOR (テストとコードの改善)

#### 3.1 エッジケーステスト追加
- 高速ターミナル作成・削除
- 複数ターミナル間のイベント分離
- プロセス起動中の終了処理

#### 3.2 統合テスト追加
- ライフサイクル管理の検証
- 並行操作の安全性確認
- メモリリーク防止確認

---

## Mock実装パターン

### MockPtyProcess クラス
```typescript
class MockPtyProcess {
  private dataHandlers: Array<(data: string) => void> = [];
  private exitHandlers: Array<(event: any) => void> = [];

  onData(handler: (data: string) => void) {
    this.dataHandlers.push(handler);
    return { dispose: () => { /* cleanup */ } };
  }

  onExit(handler: (event: any) => void) {
    this.exitHandlers.push(handler);
    return { dispose: () => { /* cleanup */ } };
  }

  // Test helpers
  emitData(data: string) {
    this.dataHandlers.forEach(h => h(data));
  }

  getDataHandlerCount(): number {
    return this.dataHandlers.length;
  }
}
```

**利点**:
- ✅ ハンドラー登録回数を正確にカウント
- ✅ イベント発火を制御可能
- ✅ クリーンアップ動作を検証可能

---

## 品質保証基準

### ユニットテスト成功基準
- ✅ イベントハンドラーが一度だけ設定される
- ✅ データイベントが正確に1回発火する
- ✅ 終了イベントが正確に1回発火する
- ✅ プロセス状態遷移が正しく行われる
- ✅ `createTerminal()` と `createTerminalWithProfile()` が同じパターンを使用

### 統合テスト成功基準
- ✅ 複数ターミナルでイベントが混在しない
- ✅ ターミナル削除時にイベントハンドラーがクリーンアップされる
- ✅ 高速作成・削除でメモリリークが発生しない
- ✅ 並行操作でクラッシュが発生しない

### TDD品質ゲート成功基準
- ✅ テストカバレッジ 85% 以上維持
- ✅ TDD品質スコア 50% 以上
- ✅ 全テスト成功率 93% 以上
- ✅ パフォーマンス劣化なし

---

## リスク管理と緩和策

### リスク1: 二重文字表示の再発
**緩和策**:
- イベントハンドラー数をカウントするテスト
- データ発火回数を厳密にテスト
- 統合テストで実際の文字表示をシミュレート

### リスク2: プロセス状態遷移の不整合
**緩和策**:
- 全ての状態遷移パターンをテスト
- 異常系 (プロセスクラッシュ) をテスト
- タイミング問題を検出するテスト

### リスク3: メモリリーク
**緩和策**:
- イベントハンドラーの dispose 確認
- 長時間実行テストでメモリ使用量監視
- GC 強制実行後のメモリチェック

---

## 実装チェックリスト

### Phase 1: RED (完了)
- ✅ `TerminalManager.EventHandlers.test.ts` 作成
- ✅ イベントハンドラー重複検出テスト実装
- ✅ プロセス状態遷移テスト実装
- ✅ メソッド一致性テスト実装
- ✅ テスト実行準備完了

### Phase 2: GREEN (確認中)
- ✅ `_setupTerminalEvents()` 実装確認
- ✅ `createTerminal()` でイベント設定確認
- ✅ `createTerminalWithProfile()` でイベント設定確認
- ✅ 重複ハンドラーが存在しないことを確認

### Phase 3: REFACTOR (完了)
- ✅ 統合テスト追加
- ✅ エッジケーステスト追加
- ✅ Mock/Stub 実装完了
- ✅ ドキュメント作成完了

### Phase 4: 品質保証 (次のステップ)
- ⏳ 全テスト実行
- ⏳ カバレッジチェック
- ⏳ パフォーマンステスト実行
- ⏳ メモリリークチェック
- ⏳ CI/CD パイプライン実行

---

## 次のアクション

### 1. テストの実行
```bash
# ユニットテスト実行
npm run test -- --grep "Event Handler"

# 統合テスト実行
npm run test -- src/test/integration/terminal/EventHandlerIntegration.test.ts

# TDD品質ゲート
npm run tdd:quality-gate
```

### 2. 結果の確認
- テスト成功率の確認
- カバレッジレポートの確認
- パフォーマンスメトリクスの確認

### 3. 必要に応じた修正
- 失敗したテストの原因調査
- コードの修正
- 再テスト

### 4. ドキュメント更新
- テスト結果の記録
- ベストプラクティスの共有
- チームへの報告

---

## まとめ

### 作成された成果物

1. **包括的TDD計画書** - 完全な戦略とロードマップ
2. **ユニットテスト実装** - 15+個のテストケース (RED-GREEN-REFACTOR)
3. **統合テスト実装** - 20+個のテストケース (実際の動作検証)
4. **テスト実行ガイド** - 詳細な実行手順とトラブルシューティング

### 重要なポイント

✅ **二重文字表示バグ防止が最優先目標**
- イベントハンドラーの重複を厳密にテスト
- データイベント発火回数を正確に検証

✅ **t-wadaのTDD手法に基づく実装**
- RED: 失敗するテストを先に書く
- GREEN: テストを通す最小限のコード
- REFACTOR: コードとテストの改善

✅ **品質基準の維持**
- TDDコンプライアンス: 50%以上
- テストカバレッジ: 85%以上
- テスト成功率: 93%以上

### 期待される効果

1. **バグ防止**: 二重文字表示などのイベントハンドラー関連バグを防止
2. **保守性向上**: 統一されたイベント設定パターンで保守が容易に
3. **品質保証**: 包括的なテストで高品質を保証
4. **ドキュメント化**: 動作仕様がテストコードとして明確に記述

---

## 参考資料

### ドキュメント
- [TDD Test Plan](/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/tdd-test-plan-terminal-manager-refactoring.md)
- [Test Execution Guide](/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/tdd-test-execution-guide.md)

### テストファイル
- [Unit Tests](/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/unit/terminals/TerminalManager.EventHandlers.test.ts)
- [Integration Tests](/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/integration/terminal/EventHandlerIntegration.test.ts)

### 実装ファイル
- [TerminalManager.ts](/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/terminals/TerminalManager.ts)

---

このTDD計画により、TerminalManagerのイベントハンドラーリファクタリングが高品質に実装され、
継続的に保守可能な状態で維持されることが保証されます。
