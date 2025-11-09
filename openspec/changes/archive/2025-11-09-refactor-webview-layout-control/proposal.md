# Refactor WebView Layout Control (VS Code Pattern)

## Why

現在のWebViewレイアウト制御には重大なタイミング問題があります：

1. **DOM検索の不確定性**: `getElementById()` によるタイミング依存の要素検索で、ResizeObserverコールバック実行時に要素が見つからない
2. **ResizeObserver の不安定性**: コールバック実行タイミングが不確定で、DOM要素の準備完了を保証できない
3. **初期化順序の未保証**: DOM要素作成とレイアウト適用のタイミング制御ができず、リトライロジック（100ms遅延）で応急処置中
4. **メモリリーク**: DOM要素参照の適切な解放がなく、dispose時にメモリが残る可能性

**具体的な問題事象**:
- 下部パネル配置時に初回レイアウトが縦並び（column）になってしまう
- `terminals-wrapper` 要素が ResizeObserver コールバック時に見つからず、警告ログが出力される
- 100msのsetTimeoutリトライで対応しているが根本解決ではない

VS Code標準ターミナルは以下のパターンで堅牢性を実現しています：
- **要素参照保持**: `getElementById()` を使わず、TypeScriptプロパティで参照管理
- **明示的レイアウト**: ResizeObserver ではなく `layout()` メソッド呼び出し
- **LayoutController**: 初期化完了フラグによる制御
- **Extension駆動**: WebView内部での推測ではなく、Extensionからの明示的通知

このリファクタリングにより、VS Code と同等の品質・パフォーマンス・保守性を実現します。

## What Changes

### 1. 基盤ユーティリティ（新規作成）

**DOMManager** (`/src/webview/utils/DOMManager.ts`)
- VS Code の `dom.ts` パターン実装
- `scheduleAtNextAnimationFrame()`: 優先度ベースのDOM操作スケジューリング
- Read/Write分離による強制レイアウト回避
- Priority constants: READ (10000), WRITE (-10000), NORMAL (0)

**LayoutController** (`/src/webview/utils/LayoutController.ts`)
- GridView の LayoutController パターン
- 初期化完了フラグ管理 (`isLayoutEnabled`)
- `enableLayout()`, `disableLayout()`, `executeIfEnabled()` メソッド
- バッチ操作用の `withLayoutDisabled()` メソッド

### 2. TerminalLifecycleManager リファクタリング (**BREAKING**)

**ファイル**: `/src/webview/managers/TerminalLifecycleManager.ts`

**追加プロパティ**:
```typescript
private _terminalsWrapper: HTMLElement | undefined;
private _terminalBody: HTMLElement | undefined;
private layoutController = new LayoutController();
```

**修正メソッド**:
- `initializeSimpleTerminal()`: 要素参照を保持、`getElementById()` 削除、`requestAnimationFrame` 削除
- `layout()`: 明示的レイアウトトリガー（新規）
- `onPanelLocationChange(location: 'panel' | 'sidebar')`: パネル位置変更ハンドラー（新規）
- `dispose()`: 要素参照クリア追加

### 3. ResizeObserver 削除 + Extension通知実装 (**BREAKING**)

**WebView側削除** (`/src/webview/main.ts`):
- `setupPanelLocationMonitoring()` 関数全体削除
- ResizeObserver による aspect ratio 計算削除
- 全てのResizeObserver関連コード削除

**Extension側追加** (`/src/providers/SecondaryTerminalProvider.ts`):
- `detectPanelPosition()`: パネル位置検出（VS Code API使用）
- WebView初期化時に `panelLocationUpdate` メッセージ送信
- パネル位置変更リスナー（APIが利用可能な場合）

### 4. PanelLocationHandler 修正

**ファイル**: `/src/webview/managers/handlers/PanelLocationHandler.ts`

**変更内容**:
- `getElementById('terminals-wrapper')` 削除
- `TerminalLifecycleManager.onPanelLocationChange()` 呼び出しに変更
- terminals-wrapper の flexDirection 直接更新ロジック削除

### 5. TerminalContainerManager 修正

**ファイル**: `/src/webview/managers/TerminalContainerManager.ts`

**変更内容**:
- 全 `getElementById('terminals-wrapper')` 削除
- TerminalLifecycleManager の要素参照使用
- `clearSplitArtifacts()` での aspect ratio 計算削除

### 6. 明示的レイアウトトリガー

**ファイル**: `/src/webview/managers/LightweightTerminalWebviewManager.ts`

**追加メソッド**:
- `layout()`: TerminalLifecycleManager.layout() を呼び出し
- `handlePanelLocationChange(location)`: パネル位置変更処理
- resize/visibility change イベントで `layout()` 呼び出し

## Impact

### Affected Specs
- **webview-layout** (新規capability): WebView DOM管理とレイアウト制御の要件定義

### Affected Code
- `/src/webview/utils/DOMManager.ts` (新規 - 140行)
- `/src/webview/utils/LayoutController.ts` (新規 - 100行)
- `/src/webview/managers/TerminalLifecycleManager.ts` (大幅修正 - 約50行追加/100行削除)
- `/src/webview/managers/TerminalContainerManager.ts` (修正 - 約20行変更)
- `/src/webview/managers/handlers/PanelLocationHandler.ts` (修正 - 約15行変更)
- `/src/webview/managers/LightweightTerminalWebviewManager.ts` (修正 - 約30行追加)
- `/src/webview/main.ts` (ResizeObserver削除 - 約120行削除)
- `/src/providers/SecondaryTerminalProvider.ts` (パネル位置通知追加 - 約40行追加)

### Breaking Changes

**1. ResizeObserver削除**
- WebView側のパネル位置検出が廃止
- Extension側からの通知に依存
- 既存の aspect ratio 計算ロジック削除

**2. LayoutControllerパターン**
- 初期化完了前の `layout()` 呼び出しは無視される
- `layoutController.enableLayout()` 呼び出しが必要

**3. 要素参照管理**
- `getElementById('terminals-wrapper')` は使用不可
- TerminalLifecycleManager のプロパティ経由でアクセス

### Migration Path

1. **Phase 1** (Day 1): DOMManager, LayoutController 作成 → 既存コードに影響なし
2. **Phase 2** (Day 2): TerminalLifecycleManager リファクタリング → 段階的移行
3. **Phase 3** (Day 3): ResizeObserver削除、Extension通知実装 → 切り替え
4. **Phase 4** (Day 4): 明示的レイアウト制御追加 → 統合
5. **Phase 5** (Day 5): テスト・検証・クリーンアップ → 完了

### Risks

**Risk 1: Extension APIでパネル位置検出できない**
- **確率**: 中程度
- **影響**: パネル位置の正確な検出不可
- **対策**: WebView側のフォールバック実装（aspect ratio推定）を最終手段として残す

**Risk 2: 大規模リファクタリングによるバグ混入**
- **確率**: 中程度
- **影響**: 既存機能の破壊
- **対策**: 段階的実装、テストカバレッジ確保、E2Eテスト実施

**Risk 3: パフォーマンス劣化**
- **確率**: 低い
- **影響**: レンダリング性能低下
- **対策**: DOM検索削減により向上が期待される、ベンチマーク実施、プロファイリング

**Risk 4: 実装期間超過**
- **確率**: 中程度
- **影響**: リリーススケジュール遅延
- **対策**: フェーズ1-2を優先、フェーズ3以降は動作確認次第で調整

### Dependencies

- VS Code API（パネル位置検出 - 利用可能性要確認）
- vscode-terminal-resolver agent（実装パターン参照用）
- 既存の TerminalManager singleton パターン
- WebView ↔ Extension メッセージング機構

### Rollback Plan

- Git履歴から前バージョンに戻す
- フィーチャーフラグがあれば新機能を無効化
- DOMManager/LayoutController は削除しても影響なし（Phase 1のみ完了時）
