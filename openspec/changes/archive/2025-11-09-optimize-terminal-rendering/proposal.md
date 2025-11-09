# Proposal: Optimize Terminal Rendering and Fix Scrollback Functionality

## Overview

現在のWebViewターミナル実装は、レンダリング効率とスクロールバック機能に課題があります。このプロポーザルでは、VS Codeの標準ターミナル実装パターンを参考に、以下の最適化を実現します：

1. **レンダリング最適化**: WebView描画の重複実行を削減し、効率的なバッファリング戦略を実装
2. **スクロールバック機能修正**: 現在動作していないスクロールバック復元機能を完全に修正
3. **xterm.js統合改善**: VS Code標準パターンに基づいたアドオン管理とライフサイクル制御

## Problem Statement

### 現在の課題

#### 1. レンダリング効率の問題
- WebViewの描画が複数回実行されている（不必要な再描画）
- DOM更新のタイミングが最適化されていない
- バッファリング戦略がVS Code標準と異なる

#### 2. スクロールバック機能の不具合
- スクロールバックの復元が正常に動作していない
- ANSIカラー情報が失われる
- ラップされた行の処理が不完全
- SerializeAddonの統合が不十分

#### 3. パフォーマンス問題
- GPU アクセラレーション（WebGL）のフォールバック機構がない
- スムーススクロールの制御が不適切
- デバイス（トラックパッド vs マウスホイール）の区別がない

## Proposed Solution

### アーキテクチャ変更

VS Code標準ターミナルの実装パターンを採用：

```typescript
// Before: 複数回の描画トリガー
TerminalLifecycleManager.createTerminal()
  └─> ResizeManager.debounceResize() (initial)
  └─> setupResizeObserver()
  └─> performInitialResize()
  └─> 複数のfitAddon.fit()呼び出し

// After: VS Code標準パターン
TerminalLifecycleManager.createTerminal()
  └─> terminal.open(container) [単一レンダリング]
  └─> OptimizedResizeManager.setupResizeObserver()
      └─> デバウンス処理で重複排除
  └─> WebGLアドオンの自動フォールバック
```

### 主要な変更点

#### 1. レンダリング最適化 (`optimize-rendering` spec)

- **ResizeObserver統合**: VS Codeパターンに基づいた効率的なリサイズ処理
- **GPU アクセラレーション**: WebGLアドオンの自動フォールバック機構
- **スムーススクロール制御**: デバイス別の最適化（トラックパッド: 0ms, マウス: 125ms）
- **描画回数削減**: 不必要なfitAddon.fit()呼び出しを排除

#### 2. スクロールバック機能修正 (`fix-scrollback` spec)

- **SerializeAddon完全統合**: ANSIカラー保持のHTML シリアライゼーション
- **ラップ行処理**: `line.isWrapped`プロパティを使用した正しい行結合
- **バッファイテレーション**: 効率的な逆イテレーターパターン
- **空行トリミング**: 不要な空行削除によるパフォーマンス向上

#### 3. xterm.js ライフサイクル改善 (`improve-lifecycle` spec)

- **アドオン遅延ロード**: 必要時のみインポート（SerializeAddon, WebGLAddon）
- **コンテキストロスト処理**: WebGLコンテキストロストの自動復旧
- **Dispose パターン**: VS Code標準のリソース解放パターン

## Benefits

### パフォーマンス改善

- **描画効率**: 重複描画の削減により30-40%のレンダリング負荷軽減
- **メモリ使用量**: 不要なバッファデータ削減により20-30%のメモリ効率化
- **スクロール体験**: デバイス別最適化により滑らかなスクロール体験

### 機能改善

- **スクロールバック復元**: 完全なセッション復元（ANSIカラー保持）
- **GPU アクセラレーション**: WebGL使用時のパフォーマンス向上
- **エラーハンドリング**: WebGL失敗時の自動フォールバック

### 保守性向上

- **VS Code標準準拠**: 公式実装パターンとの一貫性
- **コード品質**: より明確な責任分離とライフサイクル管理
- **将来の拡張性**: VS Codeの更新に追従しやすい構造

## Implementation Strategy

### Phase 1: レンダリング最適化 (Week 1-2)
1. ResizeManager のVS Codeパターン適用
2. WebGLアドオンのフォールバック機構実装
3. スムーススクロール制御実装
4. 描画回数削減のリファクタリング

### Phase 2: スクロールバック修正 (Week 2-3)
1. SerializeAddon完全統合
2. ラップ行処理ヘルパー実装
3. バッファイテレーター改善
4. スクロールバック復元テスト

### Phase 3: ライフサイクル改善 (Week 3-4)
1. アドオン遅延ロードパターン実装
2. コンテキストロスト処理追加
3. Disposeパターン標準化
4. 統合テストとパフォーマンス測定

## Success Criteria

### 機能要件
- ✅ スクロールバックが完全に復元される（ANSIカラー保持）
- ✅ WebGL失敗時に自動的にDOM レンダラーにフォールバック
- ✅ ラップされた行が正しく処理される
- ✅ デバイス別スムーススクロールが動作する

### パフォーマンス要件
- ✅ WebView描画回数が30%以上削減
- ✅ メモリ使用量が20%以上削減
- ✅ スクロールバック復元が1秒以内に完了（1000行）
- ✅ GPU アクセラレーション使用時のフレームレート向上

### 品質要件
- ✅ TypeScript コンパイルエラー0件
- ✅ ESLint エラー0件
- ✅ テストカバレッジ85%以上維持
- ✅ 既存機能の後方互換性維持

## Risks and Mitigations

### リスク1: 既存機能の破壊
**軽減策**:
- フィーチャーフラグによる段階的ロールアウト
- 包括的な統合テスト
- 既存のE2Eテストスイート実行

### リスク2: パフォーマンス回帰
**軽減策**:
- パフォーマンステストの事前実行
- ベンチマーク測定による検証
- 問題発生時の即時ロールバック計画

### リスク3: WebGL互換性問題
**軽減策**:
- 自動フォールバック機構
- DOM レンダラーの常時サポート維持
- ユーザー設定による手動制御オプション

## Dependencies

### 既存システム
- `TerminalLifecycleManager`: レンダリング最適化の主要対象
- `PerformanceManager`: バッファリング戦略の調整が必要
- `StandardTerminalPersistenceManager`: スクロールバック復元の修正対象
- `ResizeManager`: VS Codeパターンへの適応

### 外部依存
- `@xterm/addon-serialize`: SerializeAddon の完全統合
- `@xterm/addon-webgl`: GPU アクセラレーション機能
- VS Code Terminal API: 標準パターンの参照実装

## Timeline

- **Week 1**: Phase 1 開始 - レンダリング最適化
- **Week 2**: Phase 1 完了 & Phase 2 開始 - スクロールバック修正
- **Week 3**: Phase 2 完了 & Phase 3 開始 - ライフサイクル改善
- **Week 4**: Phase 3 完了 & 統合テスト・ドキュメント更新

## References

- VS Code Terminal Implementation: `microsoft/vscode` - `src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts`
- Research Document: `/docs/research/vscode-terminal-rendering-optimization.md`
- xterm.js Documentation: https://xtermjs.org/
- SerializeAddon: https://github.com/xtermjs/xterm.js/tree/master/addons/addon-serialize

## Open Questions

1. Should we implement all optimizations at once or use a feature flag for gradual rollout?
   - **Recommendation**: Use feature flags for WebGL and smooth scrolling optimizations

2. What should be the default scrollback line limit after optimization?
   - **Recommendation**: Keep current 1000 lines, but make it configurable per VS Code settings

3. Should we support both SerializeAddon and plain text scrollback for backwards compatibility?
   - **Recommendation**: Yes, automatic fallback to plain text if SerializeAddon fails

## Next Steps

1. Review and approve this proposal
2. Create detailed spec deltas for each capability
3. Break down into tasks in `tasks.md`
4. Validate with `openspec validate optimize-terminal-rendering --strict`
5. Begin Phase 1 implementation
