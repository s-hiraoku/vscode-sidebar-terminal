# WebView CLAUDE.md - 実装効率化ガイド

このファイルは WebView コンポーネントの効率的な実装をサポートします。

## 最重要アーキテクチャ

### TerminalWebviewManager (main.ts)

**メインコーディネーター** - 全WebViewマネージャーを統括

- `IManagerCoordinator`インターフェース実装
- 全マネージャーのライフサイクル管理
- Extension ↔ WebView 通信の中央ハブ

### Manager階層構造

```
TerminalWebviewManager
├── MessageManager - Extension通信
├── UIManager - UI制御・テーマ・視覚フィードバック
├── InputManager - キーボードショートカット・IME・Alt+Click
├── PerformanceManager - 出力バッファリング・デバウンス
├── NotificationManager - ユーザーフィードバック・通知
├── SplitManager - ターミナル分割・レイアウト
└── ConfigManager - 設定永続化・構成管理
```

## 設計思想・実装パターン

### 新マネージャー作成の設計原則

**3段階実装パターン**

1. **インターフェース設計**: `interfaces/ManagerInterfaces.ts`で型定義
2. **実装クラス作成**: `managers/`以下に具体実装
3. **統合**: TerminalWebviewManagerへの組み込み

**必須実装要素**

- `IManagerLifecycle`継承（initialize/dispose）
- コーディネーター依存注入パターン
- 適切なリソース解放実装

### イベント処理アーキテクチャ

**双方向通信設計**

- Extension → WebView: コマンドベースメッセージング
- WebView → Extension: postMessage APIによる非同期通信
- エラーハンドリング: try-catch + フォールバック処理

**メッセージプロトコル設計思想**

- コマンド分離による拡張性
- データペイロード標準化
- バージョニング対応

### パフォーマンス最適化戦略

**バッファリング設計**

- 高頻度出力の効率的処理
- デバウンス処理による負荷軽減
- メモリ効率を考慮したバッファ管理

**レンダリング最適化**

- DOM更新の最小化
- 仮想化による大量データ処理
- CSS変更によるレイアウト回避

## 実装時の重要な考慮点

### Manager間の協調設計

**責任分離の原則**

- 各Managerの単一責任原則厳守
- 相互依存の最小化
- コーディネーター経由の疎結合

**よく使われる操作パターン**

- ターミナル操作: コーディネーター経由
- 通知表示: NotificationManager統一インターフェース
- テーマ・UI操作: UIManager集約

### デバッグ・トラブルシューティング戦略

**一般的な問題パターン**

1. **通信断絶**: メッセージキューイング機能確認
2. **メモリリーク**: dispose()パターン実装確認
3. **パフォーマンス**: バッファリング設定確認

**デバッグツール活用**

- WebView Developer Tools活用
- Extension Host ログ監視
- パフォーマンス プロファイリング

### テスト戦略設計

**テスト分類**

- 単体テスト: 各Manager個別機能
- 統合テスト: Manager間協調動作
- E2Eテスト: 実WebView環境

**モック設計思想**

- インターフェースベースモック
- 依存注入によるテスト容易性
- 実環境に近いテストデータ

## 実装チェックリスト

### 新機能実装時

- [ ] インターフェース定義 (ManagerInterfaces.ts)
- [ ] 実装クラス作成 (managers/xxx.ts)
- [ ] TerminalWebviewManagerに統合
- [ ] dispose()メソッド実装
- [ ] テストケース作成
- [ ] TypeScript型安全性確認

### リファクタリング時

- [ ] 既存インターフェース維持
- [ ] メッセージプロトコル互換性確認
- [ ] パフォーマンス劣化確認
- [ ] メモリリーク確認
- [ ] 全テスト通過確認

このガイドに従えば、WebViewコンポーネントの効率的な実装が可能です。
