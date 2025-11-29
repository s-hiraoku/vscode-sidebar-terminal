# Spec: Fix Scrollback Functionality

## ADDED Requirements

### Requirement: SerializeAddon による ANSI カラー保持

システムSHALL SerializeAddon を完全統合し、スクロールバックのANSIカラー情報を保持すること。

#### Scenario: ANSI カラー付きスクロールバック保存

**Given** ターミナルにANSIカラー付き出力が表示されている
**When** スクロールバックを保存する
**Then** SerializeAddon.serialize() が使用される
**And** ANSIエスケープシーケンスが保持される
**And** カラー情報が失われない
**And** 保存されたデータはプレーンテキストとしてフォールバック可能

#### Scenario: ANSIカラー付きスクロールバック復元

**Given** ANSI カラー情報を含むスクロールバックデータが保存されている
**When** スクロールバックを復元する
**Then** 各行が terminal.writeln() で書き込まれる
**And** ANSI エスケープシーケンスが解釈される
**And** 元の色とスタイルが再現される
**And** ユーザーは視覚的に同じ出力を確認できる

### Requirement: ラップされた行の正しい処理

システムSHALLラップされた行を検出し、完全な行として結合すること。

#### Scenario: ラップ行の検出と結合

**Given** ターミナルの幅が80文字に設定されている
**When** 100文字の行が出力される
**Then** xterm.jsが自動的に行をラップする
**And** getFullBufferLine() が line.isWrapped を検出する
**And** ラップされた複数行が単一の論理行として結合される
**And** 結合された行が正しいテキストを含む

#### Scenario: ラップされていない行の処理

**Given** ターミナルの幅が80文字に設定されている
**When** 50文字の行が出力される
**Then** line.isWrapped が false になる
**And** getFullBufferLine() が単一行を返す
**And** 不要な結合処理が実行されない

### Requirement: 効率的なバッファイテレーション

システムSHALLバッファを効率的に走査し、ラップされた行をスキップすること。

#### Scenario: 逆イテレーターによるバッファ走査

**Given** ターミナルに1000行のデータがある
**When** getBufferReverseIterator() を使用する
**Then** バッファの最新行から古い行へ走査される
**And** ラップされた行は自動的にスキップされる
**And** 論理行のみがイテレートされる
**And** パフォーマンスが最適化される

## MODIFIED Requirements

### Requirement: スクロールバック保存処理の改善

システムSHALL既存のスクロールバック保存処理を、VS Code標準パターンに従って改善すること。

#### Scenario: 自動スクロールバック保存

**Given** ターミナルが出力を受信している
**When** terminal.onData イベントが発火する
**Then** 3秒のデバウンス処理が適用される
**And** SerializeAddon.serialize() でスクロールバックを取得する
**And** 最新1000行のみが保存される
**And** Extension側にpushScrollbackDataメッセージが送信される

#### Scenario: 空行のトリミング

**Given** スクロールバックデータに末尾空行が含まれる
**When** スクロールバックを保存する
**Then** 末尾の連続した空行が削除される
**And** 先頭の連続した空行も削除される
**And** データサイズが削減される
**And** 復元時のパフォーマンスが向上する

## REMOVED Requirements

なし

## Related Capabilities

- **optimize-rendering**: レンダリング最適化と連携
  - SerializeAddon のパフォーマンス最適化
  - 復元時の効率的な描画

- **improve-lifecycle**: ライフサイクル管理と連携
  - SerializeAddon の遅延ロード
  - 適切な Dispose 処理

## Implementation Notes

### Key Changes

1. **ScrollbackManager クラスの実装**
   - `saveScrollback()`: SerializeAddon 使用
   - `restoreScrollback()`: writeln() による復元
   - `getFullBufferLine()`: ラップ行処理
   - `getBufferReverseIterator()`: 効率的なイテレーション

2. **StandardTerminalPersistenceManager の更新**
   - ScrollbackManager の統合
   - VS Code globalState への保存
   - セッション復元時の自動ロード

### Performance Targets

- スクロールバック保存時間: <500ms (1000行)
- スクロールバック復元時間: <1s (1000行)
- メモリ使用量: ~3.5MB (従来 ~5MB から削減)
- ANSIカラー保持率: 100%
