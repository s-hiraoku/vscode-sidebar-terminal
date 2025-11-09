# Spec: Improve xterm.js Lifecycle Management

## ADDED Requirements

### Requirement: アドオンの遅延ロード

システムSHALL xterm.js アドオンを必要時のみロードし、メモリ使用量を削減すること。

#### Scenario: SerializeAddon の遅延ロード

**Given** ターミナルが作成されている
**When** スクロールバック保存が初めて実行される
**Then** SerializeAddon が動的にインポートされる
**And** terminal.loadAddon(serializeAddon) が呼ばれる
**And** アドオンインスタンスがキャッシュされる
**And** 次回以降はキャッシュされたインスタンスが再利用される

#### Scenario: WebglAddon の遅延ロード

**Given** ターミナルがGPU アクセラレーション有効で作成される
**When** attachTerminal() が呼ばれる
**Then** WebglAddon が非同期にインポートされる
**And** インポート成功時のみ terminal.loadAddon() が呼ばれる
**And** インポート失敗時はDOMレンダラーにフォールバックする

### Requirement: 適切な Dispose 処理

システムSHALL VS Code標準の Dispose パターンに従い、リソースを適切に解放すること。

#### Scenario: ターミナル Dispose 時のリソース解放

**Given** ターミナルが複数のアドオンをロードしている
**When** disposeTerminal() が呼ばれる
**Then** すべてのアドオンが dispose される
**And** イベントリスナーが削除される
**And** ResizeObserver が disconnect される
**And** terminal.dispose() が最後に呼ばれる
**And** メモリリークが発生しない

## MODIFIED Requirements

### Requirement: ターミナルアタッチメント処理の改善

システムSHALL既存のアタッチメント処理を、VS Code標準パターンに従って改善すること。

#### Scenario: フォーカスイベントの管理

**Given** ターミナルがDOMにアタッチされる
**When** terminal.textarea にフォーカスイベントリスナーが登録される
**Then** focus, blur, focusout イベントが監視される
**And** 各イベントリスナーは Disposable として管理される
**And** デタッチ時にすべてのリスナーが削除される

## REMOVED Requirements

なし

## Related Capabilities

- **optimize-rendering**: レンダリング最適化と連携
  - WebglAddon の遅延ロード
  - コンテキストロスト時の Dispose

- **fix-scrollback**: スクロールバック修正と連携
  - SerializeAddon の遅延ロード
  - Dispose 時のスクロールバック保存

## Implementation Notes

### Key Changes

1. **LifecycleController クラスの実装**
   - `attachTerminal()`: アタッチメント処理
   - `detachTerminal()`: デタッチメント処理
   - `loadAddonLazy()`: 遅延ロード
   - `disposeTerminal()`: リソース解放

2. **Disposable パターンの統一**
   - すべてのリソースが IDisposable インターフェースを実装
   - DisposableStore での一元管理

### Performance Targets

- 初期メモリ使用量: 30%削減（不要なアドオンをロードしない）
- Dispose 時間: <100ms
- メモリリーク: 0件
