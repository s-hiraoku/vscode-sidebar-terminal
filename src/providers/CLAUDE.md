# Providers CLAUDE.md - VS Code Provider実装ガイド

このファイルは VS Code WebviewViewProvider の効率的な実装をサポートします。

## 核心アーキテクチャ

### SecondaryTerminalProvider - VS Code統合の中心

**WebviewViewProvider実装** - VS Code Sidebar統合の核心クラス

- WebView HTML生成・管理
- Extension ↔ WebView 通信ブリッジ
- VS Code設定統合・監視
- WebViewコンテキスト保持（`retainContextWhenHidden: true`）

### VS Code Provider 設計パターン

#### WebviewViewProvider 実装原則

**ライフサイクル管理**

- resolveWebviewView での初期化処理
- WebView オプション設定（セキュリティ重視）
- HTML生成とリソース管理
- メッセージハンドリング設定
- 設定監視システム構築

**アーキテクチャ設計思想**

- シングルトンプロバイダーパターン
- 依存注入による疎結合
- イベント駆動型通信
- リソース効率的管理

#### ViewPaneライフサイクル管理（OpenSpec 1.3）

**VS Code ViewPane Pattern実装** - 重複レンダリング防止とパフォーマンス最適化

**`_bodyRendered`フラグパターン（決定5）**:
- VS Code `src/vs/base/browser/ui/splitview/paneview.ts`の`Pane.renderBody()`パターンを採用
- `resolveWebviewView()`は複数回呼ばれる（初回表示、パネル移動、WebView再作成）
- `_bodyRendered`フラグで初回レンダリング完了を記録
- 2回目以降の呼び出しは早期リターンで重複初期化を防止

**実装箇所**:
```typescript
// SecondaryTerminalProvider.ts

// フラグ定義（line 68）
private _bodyRendered = false;

// resolveWebviewView()内のガード（lines 169-181）
if (this._bodyRendered) {
  log('⏭️ Body already rendered, skipping duplicate initialization');
  this._view = webviewView;
  this._communicationService.setView(webviewView);
  return; // パネル移動時は早期リターン
}

// 初期化完了後にフラグセット（line 195）
this._bodyRendered = true;

// dispose()でリセット（line 2479）
this._bodyRendered = false;
```

**visibilityリスナー統合**:
- Before: 3箇所の重複リスナー（PanelLocationService, PanelLocationController, SecondaryTerminalProvider）
- After: 1箇所の統合リスナー（SecondaryTerminalProvider._registerVisibilityListener）
- 可視性変更時はHTML再初期化せず、状態保存/復元のみ実行

**パフォーマンスメトリクス（OpenSpec 1.3.4）**:
```typescript
// メトリクス定義（lines 71-78）
private _performanceMetrics = {
  resolveWebviewViewCallCount: 0,    // resolveWebviewView呼び出し回数
  htmlSetOperations: 0,              // HTML設定回数（目標: 1）
  listenerRegistrations: 0,          // リスナー登録回数（目標: 1）
  lastPanelMovementTime: 0,          // 最後のパネル移動時間（目標: <200ms）
  totalInitializationTime: 0,        // 初期化総時間（目標: <100ms）
};

// パブリックAPI（lines 2448-2457）
public getPerformanceMetrics() {
  return {
    ...this._performanceMetrics,
    meetsInitializationTarget: totalInitializationTime < 100,
    meetsPanelMovementTarget: lastPanelMovementTime < 200,
    meetsHtmlSetTarget: htmlSetOperations === 1,
    meetsListenerTarget: listenerRegistrations === 1,
  };
}
```

**パフォーマンス目標**:
| メトリクス | 目標値 | 説明 |
|-----------|--------|------|
| resolveWebviewView実行時間 | <100ms | 初回初期化時間 |
| パネル移動時間 | <200ms | sidebar ↔ auxiliary bar移動 |
| HTML設定回数 | 1回 | プロバイダーインスタンスあたり |
| リスナー登録回数 | 1回 | プロバイダーインスタンスあたり |

**テストケース（OpenSpec 1.3.3）**:
- `SecondaryTerminalProvider-ViewPaneLifecycle.test.ts`に完全なテストスイートを実装
- 重複呼び出し防止、HTML単一設定、リスナー単一登録、状態保存をカバー

**トラブルシューティング**:
- **症状**: パネル移動時にWebViewがちらつく
  - **原因**: `_bodyRendered`フラグが正しく機能していない
  - **解決**: `resolveWebviewView()`開始時にフラグをチェック、trueなら早期リターン

- **症状**: パフォーマンスが悪い
  - **診断**: `getPerformanceMetrics()`でメトリクスを確認
  - **解決**: 目標値未達成の項目を特定し、該当コードを最適化

**参考資料**:
- VS Code Source: `src/vs/base/browser/ui/splitview/paneview.ts`
- VS Code Source: `src/vs/workbench/contrib/webviewView/browser/webviewViewService.ts`
- Research Doc: `docs/vscode-webview-lifecycle-patterns.md`

#### HTML生成・セキュリティ設計

**CSP (Content Security Policy) 戦略**

- nonce ベースセキュリティ
- リソースソース制限
- スクリプト実行制御
- インライン CSS 最小化

**リソース管理思想**

- extensionUri からの相対パス解決
- WebView URI 変換の活用
- バンドル済みリソース参照
- ローカルリソースルート制限

**HTML構造設計**

- 最小限DOM構造
- レスポンシブビューポート
- 多言語対応メタデータ
- セマンティック HTML使用

## Extension ↔ WebView 通信設計

### メッセージハンドリング アーキテクチャ

**統一メッセージシステム**

- コマンドベース メッセージ分類
- 非同期処理による応答性向上
- エラーハンドリング統合
- ログ管理とデバッグ支援

**通信プロトコル設計**

- 型安全なメッセージ構造
- コマンド拡張性確保
- エラー情報の適切な伝播
- 未知コマンドの優雅な処理

**非同期処理パターン**

- Promise ベース通信
- タイムアウト管理
- 並行処理制御
- リトライ機構

### メッセージ送信・キューイング設計

**メッセージキューイング戦略**

- WebView 未準備状態での安全な処理
- メッセージ順序保証
- 自動フラッシュ機構
- オーバーフロー防止

**信頼性確保機能**

- 送信失敗時のリトライ
- メッセージ重複除去
- 優先度ベース配信
- デッドレター処理

## VS Code設定統合アーキテクチャ

### 設定監視・同期設計思想

**リアクティブ設定管理**

- 設定変更の即座反映
- 関連設定グループ監視
- 初回設定配信保証
- 設定値の型安全性確保

**設定カテゴリ統合**

- 独自設定 (sidebarTerminal.\*)
- VS Code 標準設定連携
- エディター設定参照
- テーマ設定同期

**設定同期戦略**

- 差分ベース更新
- デフォルト値フォールバック
- 設定値検証機能
- 設定エラー通知

### コマンド登録・統合設計

**拡張機能統合パターン**

- ファクトリーメソッドによる初期化
- 依存関係の注入管理
- リソース登録の一元化
- ライフサイクル管理

**コマンド設計原則**

- 名前空間による分離
- 機能別コマンド分類
- エラーハンドリング統合
- ユーザビリティ重視

**WebView オプション戦略**

- retainContextWhenHidden: パフォーマンス vs 利便性
- localResourceRoots: セキュリティ境界
- enableScripts: 機能要件vs安全性

## リソース管理・ライフサイクル設計

### リソース解放戦略

**階層的リソース管理**

- WebView 関連リソース
- イベントリスナー群
- 外部依存オブジェクト
- 内部状態・キュー

**メモリリーク防止**

- Disposable パターン活用
- 循環参照回避設計
- 明示的 undefined 設定
- ガベージコレクション支援

**リソース追跡**

- 登録型リソース管理
- 自動収集機能
- リソース使用量監視
- リーク検出ツール

### WebView可視状態管理設計

**適応的リソース制御**

- 可視時: フル機能動作
- 非可視時: 最小限処理
- 状態遷移時の適切な処理
- ユーザー体験最適化

**パフォーマンス最適化**

- 出力頻度動的調整
- バックグラウンド処理制限
- メモリ使用量削減
- バッテリー効率向上

## セキュリティ・パフォーマンス設計

### CSP (Content Security Policy) 戦略

**多層防御セキュリティ**

- default-src 'none': 全拒否ベース
- nonce ベーススクリプト制御
- リソース種別細分化制御
- 最小権限原則適用

**セキュリティバランス**

- 機能要件 vs セキュリティ制約
- unsafe-inline の限定使用
- 外部リソース最小化
- 動的コンテンツ検証

### パフォーマンス最適化戦略

**レート制限システム**

- 60fps 基準スロットリング
- メッセージ頻度制御
- CPU 使用率管理
- バッテリー効率考慮

**最適化手法**

- デバウンス・スロットル活用
- バッチ処理による効率化
- 遅延実行による応答性向上
- メモリ使用量最小化

## デバッグ・トラブルシューティング戦略

### 一般的な問題パターンと診断手法

**WebView表示問題**

- package.json の contributes 設定確認
- ViewContainer 配置検証
- 権限・セキュリティ設定確認
- 拡張機能アクティベーション状態

**CSPセキュリティエラー**

- nonce 生成・適用確認
- リソースURI解決検証
- ポリシー設定見直し
- ブラウザ開発者ツール活用

**通信問題診断**

- WebView 初期化状態確認
- メッセージキュー状況分析
- イベントリスナー登録確認
- 非同期処理タイミング検証

## テスト戦略設計

### Provider単体テスト設計思想

**テスト分類**

- 初期化・設定テスト
- メッセージ通信テスト
- セキュリティ機能テスト
- リソース管理テスト

**モック設計戦略**

- VS Code API モック
- WebView インターフェースモック
- 依存関係注入によるテスト容易性
- 実環境近似テストデータ

**テスト重要項目**

- HTML生成・CSP確認
- メッセージ処理正確性
- リソース解放完全性
- エラーハンドリング堅牢性

## 実装チェックリスト

### 新Provider作成時

- [ ] WebviewViewProvider インターフェース実装
- [ ] package.json contributes.views 設定
- [ ] セキュアHTML生成・CSP設定
- [ ] 双方向メッセージハンドリング
- [ ] VS Code設定監視・同期機能
- [ ] 適切なリソース解放機能
- [ ] 拡張機能コマンド登録
- [ ] 包括的テストケース作成

### セキュリティ・品質確認

- [ ] CSP多層防御設定適用
- [ ] nonce ベースセキュリティ
- [ ] リソースルート制限設定
- [ ] 入力値検証・サニタイゼーション
- [ ] エラーハンドリング・復旧機能
- [ ] パフォーマンス最適化確認
- [ ] メモリリーク防止確認

このガイドでVS Code Provider統合の効率的で安全な実装が可能です。
