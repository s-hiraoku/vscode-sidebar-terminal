# TDD Test Execution Guide: Terminal Event Handler Tests

## 概要

このガイドは、TerminalManager のイベントハンドラーリファクタリングに関するTDDテストの実行方法を説明します。

## テストファイル一覧

### 新規作成されたテストファイル

1. **ユニットテスト** (RED-GREEN-REFACTOR)
   - `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/unit/terminals/TerminalManager.EventHandlers.test.ts`
   - イベントハンドラー重複防止
   - プロセス状態管理
   - メソッド一貫性検証

2. **統合テスト**
   - `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/integration/terminal/EventHandlerIntegration.test.ts`
   - 複数ターミナル間のイベント分離
   - ライフサイクル管理
   - 並行操作の安全性

3. **ドキュメント**
   - `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/tdd-test-plan-terminal-manager-refactoring.md`
   - 包括的なTDD計画書

---

## テスト実行手順

### Phase 1: ユニットテストの実行 (最優先)

#### 1.1 全ユニットテストを実行
```bash
cd /Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish

# イベントハンドラーテストのみ実行
npm run test -- --grep "Event Handler"
```

**期待される結果**:
- ✅ イベントハンドラー重複検出テストが成功
- ✅ データイベント発火回数テストが成功
- ✅ 終了イベント発火回数テストが成功
- ✅ プロセス状態遷移テストが成功

#### 1.2 特定のテストスイートを実行
```bash
# RED Phase テストのみ
npm run test -- --grep "RED Phase"

# GREEN Phase テストのみ
npm run test -- --grep "GREEN Phase"

# REFACTOR Phase テストのみ
npm run test -- --grep "REFACTOR Phase"
```

#### 1.3 ウォッチモードで開発
```bash
# ファイル変更を監視して自動的にテスト実行
npm run test:watch -- --grep "Event Handler"
```

---

### Phase 2: 統合テストの実行

#### 2.1 統合テスト実行
```bash
# イベントハンドラー統合テストのみ
npm run test -- src/test/integration/terminal/EventHandlerIntegration.test.ts
```

**期待される結果**:
- ✅ 複数ターミナルのイベント分離が成功
- ✅ ライフサイクル管理が正常動作
- ✅ 並行操作がクラッシュなく動作
- ✅ メモリリークが発生しない

#### 2.2 全統合テストを実行
```bash
npm run test -- src/test/integration/terminal/
```

---

### Phase 3: 既存テストの回帰確認

#### 3.1 TerminalManager 関連テスト全実行
```bash
# 既存の TerminalManager テスト
npm run test -- src/test/suite/terminal-manager.test.ts

# ターミナルライフサイクルテスト
npm run test -- src/test/unit/terminals/TerminalLifecycleService.test.ts
```

#### 3.2 全ターミナル関連テスト実行
```bash
npm run test -- src/test/unit/terminals/
npm run test -- src/test/integration/terminal/
```

---

### Phase 4: TDD品質ゲートの実行

#### 4.1 包括的品質チェック
```bash
# TDD品質ゲート (50%以上のTDDコンプライアンス必須)
npm run tdd:quality-gate

# カバレッジ込みの包括チェック
npm run tdd:comprehensive-check
```

**成功基準**:
- TDDコンプライアンス: 50% 以上
- テストカバレッジ: 85% 以上
- テスト成功率: 93% 以上

#### 4.2 リリース前チェック
```bash
# 全品質ゲートを実行
npm run pre-release:check
```

---

## トラブルシューティング

### 問題 1: テストがタイムアウトする

**症状**:
```
Error: Timeout of 2000ms exceeded
```

**解決策**:
```typescript
// テストファイル内でタイムアウトを延長
it('should handle long operation', function(this: Mocha.Context) {
  this.timeout(5000); // 5秒に延長
  // テストコード
});
```

または

```bash
# コマンドラインでタイムアウト設定
npm run test -- --timeout 10000 --grep "Event Handler"
```

---

### 問題 2: Mock PTY が動作しない

**症状**:
```
TypeError: Cannot read property 'onData' of undefined
```

**原因**: `TerminalSpawner` のスタブが正しく設定されていない

**解決策**:
```typescript
// スタブを確認
beforeEach(() => {
  const TerminalSpawner = require('../../../terminals/TerminalSpawner').TerminalSpawner;
  spawnStub = sinon.stub(TerminalSpawner.prototype, 'spawnTerminal').returns({
    ptyProcess: mockPty,
  });
});

afterEach(() => {
  spawnStub.restore(); // 必ずリストアする
});
```

---

### 問題 3: イベントが発火しない

**症状**: `expect(dataEventCount).to.equal(1)` が失敗する

**原因**: イベント処理が非同期で完了していない

**解決策**:
```typescript
it('should emit data event', (done) => {
  // イベントリスナー設定
  terminalManager.onData((event) => {
    // アサーション
  });

  // データ送信
  mockPty.emitData('test');

  // 非同期処理の完了を待つ
  setTimeout(() => {
    // アサーション確認
    expect(dataEventCount).to.equal(1);
    done(); // テスト完了を通知
  }, 100);
});
```

---

### 問題 4: テストが互いに干渉する

**症状**: 単独では成功するが、まとめて実行すると失敗する

**原因**: `beforeEach`/`afterEach` でのクリーンアップ不足

**解決策**:
```typescript
beforeEach(() => {
  // 完全に新しいインスタンスを作成
  terminalManager = new TerminalManager();
});

afterEach(() => {
  // 確実にリソースを解放
  terminalManager.dispose();
  if (spawnStub) {
    spawnStub.restore();
  }
});
```

---

## CI/CD統合

### GitHub Actions での自動テスト

テストは以下のワークフローで自動実行されます:

```yaml
# .github/workflows/quality-gate.yml
name: TDD Quality Gate

on:
  push:
    branches: [main, for-publish]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run Event Handler Tests
        run: npm run test -- --grep "Event Handler"

      - name: Run Integration Tests
        run: npm run test -- src/test/integration/terminal/

      - name: TDD Quality Gate
        run: npm run tdd:quality-gate

      - name: Coverage Report
        run: npm run test:coverage
```

---

## テスト結果の解釈

### 成功例

```
  TerminalManager - Event Handler Setup (TDD)
    RED Phase: Event Handler Duplication Detection
      ✓ should register onData handler exactly once in createTerminal() (45ms)
      ✓ should register onExit handler exactly once in createTerminal() (38ms)
      ✓ should register onData handler exactly once in createTerminalWithProfile() (52ms)
      ✓ should register onExit handler exactly once in createTerminalWithProfile() (41ms)

    RED Phase: Data Event Emission Count
      ✓ should emit data event exactly once when PTY sends data (105ms)
      ✓ should emit exit event exactly once when PTY process exits (98ms)

    GREEN Phase: Process State Management
      ✓ should initialize terminal with Launching state (15ms)
      ✓ should transition from Launching to Running on first data (58ms)
      ✓ should set KilledByUser state when deleteTerminal is called (112ms)

  9 passing (1.2s)
```

**解釈**:
- ✅ 全てのRED-GREEN-REFACTORフェーズが成功
- ✅ イベントハンドラーの重複なし
- ✅ プロセス状態遷移が正常

---

### 失敗例と対処

#### 失敗例 1: ハンドラー重複

```
  1) should register onData handler exactly once in createTerminal()
     Expected exactly one onData handler to be registered
     Expected: 1
     Actual: 2
```

**原因**: `createTerminal()` 内で `onData` ハンドラーが2回登録されている

**対処法**:
1. `createTerminal()` メソッドを確認
2. 重複した `ptyProcess.onData()` 呼び出しを削除
3. `_setupTerminalEvents()` のみ呼び出すように修正

---

#### 失敗例 2: 状態遷移エラー

```
  2) should transition from Launching to Running on first data
     Terminal should transition to Running after first data
     Expected: ProcessState.Running (2)
     Actual: ProcessState.Launching (1)
```

**原因**: `_setupTerminalEvents()` 内で状態遷移が正しく実装されていない

**対処法**:
1. `_setupTerminalEvents()` の `onData` ハンドラーを確認
2. 最初のデータ受信時に `ProcessState.Running` に遷移するコードがあるか確認
3. 状態遷移ロジックを修正

---

## パフォーマンスベンチマーク

### 実行時間の目安

| テストスイート | 実行時間 | 合格基準 |
|---------------|---------|---------|
| ユニットテスト (Event Handler) | 1-2秒 | < 5秒 |
| 統合テスト (Event Handler Integration) | 5-10秒 | < 30秒 |
| 全ターミナルテスト | 10-20秒 | < 60秒 |
| TDD品質ゲート | 30-60秒 | < 120秒 |

### パフォーマンス劣化の検出

```bash
# ベンチマークモードでテスト実行
npm run test -- --reporter json > test-results.json

# 結果を分析
node scripts/analyze-test-performance.js test-results.json
```

---

## テストカバレッジの確認

### カバレッジレポート生成

```bash
# HTMLレポートを生成
npm run test:coverage

# カバレッジレポートを開く
open coverage/index.html
```

### カバレッジ目標

| ファイル | 目標カバレッジ | 現在 |
|---------|--------------|------|
| TerminalManager.ts | 85%+ | 確認中 |
| _setupTerminalEvents | 100% | 確認中 |
| createTerminal | 90%+ | 確認中 |
| createTerminalWithProfile | 90%+ | 確認中 |

---

## 継続的改善

### 次のステップ

1. **カバレッジ向上** (85% → 90%)
   - エッジケースの追加テスト
   - エラーハンドリングのテスト強化

2. **TDDコンプライアンス向上** (50% → 85%)
   - 新機能は必ずテストファーストで実装
   - 既存コードのテストカバレッジ向上

3. **パフォーマンス最適化**
   - テスト実行時間の短縮
   - Mock/Stub の軽量化

4. **ドキュメント整備**
   - テストケースのドキュメント化
   - ベストプラクティスの共有

---

## まとめ

このガイドに従ってテストを実行することで、TerminalManagerのイベントハンドラーリファクタリングの品質を保証できます。

**重要なポイント**:
- ✅ ユニットテストから始める (RED-GREEN-REFACTOR)
- ✅ 統合テストで実際の動作を検証
- ✅ 回帰テストで既存機能を保護
- ✅ TDD品質ゲートで品質基準を維持

**品質基準**:
- TDDコンプライアンス: 50%以上
- テストカバレッジ: 85%以上
- テスト成功率: 93%以上
- 実行時間: 各フェーズで基準内

これらの基準を満たすことで、バグのない高品質なリファクタリングが実現できます。
