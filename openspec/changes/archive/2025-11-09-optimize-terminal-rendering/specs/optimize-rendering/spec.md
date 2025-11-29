# Spec: Optimize Terminal Rendering

## ADDED Requirements

### Requirement: WebView描画の効率化

システムSHALL最適化されたレンダリング処理を実装し、不必要な再描画を削減すること。

#### Scenario: ターミナル作成時の描画最適化

**Given** ユーザーが新しいターミナルを作成する
**When** TerminalLifecycleManager.createTerminal() が呼ばれる
**Then** terminal.open() は1回のみ実行される
**And** fitAddon.fit() の呼び出し回数が最小化される（初回リサイズのみ）
**And** WebView描画回数が30%以上削減される

#### Scenario: ResizeObserverによる効率的なリサイズ処理

**Given** ターミナルがDOMにアタッチされている
**When** コンテナのサイズが変更される
**Then** ResizeObserverが変更を検知する
**And** 100msのデバウンス処理が適用される
**And** 有効な寸法（width > 50 && height > 50）の場合のみfitAddon.fit()が実行される
**And** 複数の連続したリサイズイベントが1回の処理にまとめられる

#### Scenario: 無効な寸法でのリサイズスキップ

**Given** ターミナルがDOMにアタッチされている
**When** コンテナのwidth または height が 50px 以下になる
**Then** fitAddon.fit() がスキップされる
**And** エラーログが出力される
**And** ターミナルの状態が保持される

### Requirement: GPU アクセラレーション（WebGL）の自動フォールバック

システムSHALL WebGLレンダラーを使用し、失敗時には自動的にDOMレンダラーにフォールバックすること。

#### Scenario: WebGL レンダラーの正常なロード

**Given** ターミナルがGPU アクセラレーション有効で作成される
**When** WebglAddon のロードが試行される
**Then** WebglAddon が正常にロードされる
**And** terminal.loadAddon(webglAddon) が成功する
**And** コンテキストロストイベントハンドラーが登録される
**And** レンダリングパフォーマンスが向上する

#### Scenario: WebGL失敗時のDOMレンダラーフォールバック

**Given** ターミナルがGPU アクセラレーション有効で作成される
**When** WebglAddon のロードが失敗する（例: GPUドライバー問題）
**Then** エラーが補足される
**And** 警告ログが出力される
**And** ターミナルは自動的にDOMレンダラーにフォールバックする
**And** ユーザーに通知が表示される
**And** ターミナルの基本機能は正常に動作する

#### Scenario: WebGL コンテキストロスト時の自動復旧

**Given** ターミナルがWebGLレンダラーを使用している
**When** WebGLコンテキストがロストする（例: GPUリセット）
**Then** onContextLoss イベントが発火する
**And** WebglAddon が dispose される
**And** ターミナルは自動的にDOMレンダラーに切り替わる
**And** ユーザーに通知が表示される
**And** ターミナルは引き続き使用可能

### Requirement: スムーススクロールのデバイス別最適化

システムSHALL物理マウスホイールとトラックパッドを区別し、デバイスに応じたスムーススクロール設定を適用すること。

#### Scenario: トラックパッド使用時のスムーススクロール無効化

**Given** ターミナルがアクティブ状態
**When** トラックパッドでスクロールする（event.deltaMode === 0）
**Then** デバイス検出器がトラックパッドと判定する
**And** スムーススクロール期間が0msに設定される
**And** 即座にスクロールが実行される
**And** 滑らかなスクロール体験が提供される

#### Scenario: 物理マウスホイール使用時のスムーススクロール有効化

**Given** ターミナルがアクティブ状態
**When** 物理マウスホイールでスクロールする（event.deltaMode === 1）
**Then** デバイス検出器がマウスホイールと判定する
**And** スムーススクロール期間が125msに設定される
**And** スムーススクロールアニメーションが実行される
**And** VS Code標準のスクロール体験が提供される

#### Scenario: デバイス切り替え時の動的更新

**Given** ターミナルがトラックパッドで使用されている
**When** ユーザーがマウスホイールに切り替える
**Then** デバイス検出器が変更を検知する
**And** スムーススクロール設定が動的に更新される
**And** 次のスクロールイベントから新しい設定が適用される

### Requirement: イベントリスナーのパフォーマンス最適化

システムSHALLイベントリスナーに `passive: true` を使用してスクロールパフォーマンスを向上させること。

#### Scenario: パッシブイベントリスナーの使用

**Given** ターミナルがDOMにアタッチされる
**When** wheel イベントリスナーが登録される
**Then** { passive: true } オプションが指定される
**And** ブラウザがスクロールイベントを最適化できる
**And** preventDefault() 呼び出しによるブロッキングが防止される
**And** スクロールパフォーマンスが向上する

## MODIFIED Requirements

### Requirement: ターミナル初期化プロセスの最適化

システムSHALL既存のターミナル初期化プロセスを、VS Code標準パターンに沿って最適化すること。

#### Scenario: 単一レンダリングパスでのターミナル初期化

**Given** ユーザーが新しいターミナルを作成する
**When** createTerminal() が実行される
**Then** 以下の処理が順次実行される：
  1. Terminal インスタンスの作成
  2. container要素の作成
  3. terminal.open(container) - **単一レンダリング**
  4. FitAddon のロード
  5. ResizeObserver のセットアップ（デバウンス付き）
  6. 初回リサイズ（50ms後に1回のみ）
**And** 従来の複数回の fit() 呼び出しが削減される
**And** レンダリングパフォーマンスが向上する

#### Scenario: ResizeObserver の一元管理

**Given** 複数のターミナルが存在する
**When** ResizeManager.setupOptimizedResize() が呼ばれる
**Then** 各ターミナルに対して単一のResizeObserverが作成される
**And** デバウンス処理（100ms）が適用される
**And** 重複するリサイズイベントが統合される
**And** メモリ使用量が削減される

## REMOVED Requirements

なし（既存機能の削除はありません）

## Related Capabilities

- **fix-scrollback**: スクロールバック復元機能の修正と連携
  - SerializeAddon による ANSI カラー保持
  - レンダリング最適化により復元時のパフォーマンス向上

- **improve-lifecycle**: ライフサイクル管理の改善と連携
  - アドオンの遅延ロードによるメモリ効率化
  - Dispose パターンによる適切なリソース解放

## Implementation Notes

### Technical Considerations

1. **devicePixelRatio の考慮**
   - VS Codeパターンに従い、リサイズ計算で `window.devicePixelRatio` を使用
   - 高DPIディスプレイで正確な寸法計算を実現

2. **WebGL フォールバック戦略**
   - WebglAddon のロード失敗時、エラーをキャッチして静かにDOMレンダラーにフォールバック
   - ユーザーには非侵入的な通知を表示（toast notification）

3. **スムーススクロール実装**
   - xterm.js には `smoothScrollDuration` オプションがないため、カスタム実装が必要
   - `terminal.options` を拡張するか、スクロールイベントハンドラーをカスタマイズ

### Dependencies

- `@xterm/addon-webgl`: WebGL レンダリング
- `ResizeManager`: 既存のリサイズ管理ユーティリティを拡張
- `TerminalLifecycleManager`: 主要な統合ポイント

### Migration Path

既存コードからの移行手順：

1. **Phase 1**: RenderingOptimizer クラスの実装
2. **Phase 2**: TerminalLifecycleManager での統合
3. **Phase 3**: 既存のリサイズロジックの置き換え
4. **Phase 4**: テストと検証

### Performance Targets

- WebView描画回数: 5-7回 → 2-3回（30-40%削減）
- 初回レンダリング時間: 200-300ms → 100-150ms
- GPU使用率: 0% → 40-60%（WebGL有効時）
- メモリ使用量: 変化なし（軽微な改善の可能性）

### Testing Strategy

1. **Unit Tests**
   - RenderingOptimizer.setupOptimizedResize()
   - RenderingOptimizer.enableWebGL()
   - DeviceDetector.detectDevice()

2. **Integration Tests**
   - ターミナル作成 → レンダリング最適化の確認
   - WebGL有効 → 失敗 → DOM フォールバックのテスト
   - デバイス切り替え → スムーススクロール設定変更の確認

3. **Performance Tests**
   - 描画回数のベンチマーク
   - WebGL vs DOM レンダラーのパフォーマンス比較
   - スクロールパフォーマンスの測定

### Security Considerations

- WebGL使用時、GPUドライバーの脆弱性に注意
- コンテキストロスト時の適切なエラーハンドリングが重要
- ユーザーデータの露出リスクなし（レンダリング最適化のみ）

### Accessibility Considerations

- スクリーンリーダーへの影響なし（DOM構造は変更なし）
- キーボードナビゲーションへの影響なし
- 高コントラストモードとの互換性維持

### Backward Compatibility

- 既存のターミナル機能は完全に維持
- 設定オプションの追加（`enableGpuAcceleration`, `smoothScrolling`）
- 既存の設定値はデフォルト動作を保持
