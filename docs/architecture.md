# アーキテクチャ設計

## システム概要

VS Code Sidebar Terminal Extension は、VS Code のサイドパネルにターミナル機能を提供する拡張機能です。WebView API を使用してカスタムビューを作成し、xterm.js によるターミナルエミュレータを実装します。

## コンポーネント構成

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                  │
├─────────────────────────────────────────────────────────────┤
│  Extension Main Process (extension.ts)                     │
│  ├─ Terminal Manager                                        │
│  ├─ WebView Provider                                        │
│  └─ Command Handler                                         │
├─────────────────────────────────────────────────────────────┤
│  WebView Process (HTML/CSS/JS)                             │
│  ├─ Terminal Coordinator                                    │
│  ├─ Message Manager                                         │
│  ├─ Input Manager                                           │
│  ├─ UI Manager                                              │
│  ├─ Config Manager                                          │
│  ├─ Performance Manager                                     │
│  ├─ Notification Manager                                    │
│  ├─ Split Manager                                           │
│  └─ xterm.js Terminal UI                                   │
├─────────────────────────────────────────────────────────────┤
│  Node.js Backend (node-pty)                               │
│  ├─ PTY Process Management                                 │
│  └─ Shell Integration                                      │
└─────────────────────────────────────────────────────────────┘
```

## 主要コンポーネント

### 1. Extension Main Process
- **役割**: 拡張機能のメインプロセス
- **責任**:
  - VS Code API との連携
  - WebView の作成と管理
  - コマンドの登録と処理
  - ターミナルプロセスの管理

### 2. Terminal Manager
- **役割**: ターミナルインスタンスの管理
- **責任**:
  - 複数ターミナルの作成・削除
  - ターミナル間の切り替え
  - プロセス状態の監視

### 3. WebView Provider
- **役割**: WebView の提供と管理
- **責任**:
  - HTML コンテンツの生成
  - CSS/JS リソースの提供
  - セキュリティポリシーの適用

### 4. WebView Process (マネージャーベースのアーキテクチャ)
- **役割**: ユーザーインターフェースとクライアントサイドロジック
- **責任**:
  - **Terminal Coordinator**: すべてのWebViewマネージャーを調整するメインオーケストレーター。
  - **Message Manager**: ExtensionとWebView間のメッセージ通信を一元的に処理。
  - **Input Manager**: ユーザー入力（キーボード、マウス、Alt+Click）を処理し、ターミナルに送信。
  - **UI Manager**: ターミナルの視覚的な側面（テーマ、ボーダー、レイアウト）を管理。
  - **Config Manager**: ユーザー設定の読み込み、保存、適用を処理。
  - **Performance Manager**: ターミナル出力のバッファリング、デバウンス、その他のパフォーマンス最適化を管理。
  - **Notification Manager**: ユーザーへの通知（エラー、警告、情報）を表示。
  - **Split Manager**: ターミナルの分割ビューの作成、管理、レイアウト計算を処理。
  - **xterm.js Terminal UI**: 実際のターミナルエミュレーションと表示を担当。

### 5. Node-pty Backend
- **役割**: システムレベルのターミナル処理
- **責任**:
  - PTY プロセスの作成・管理
  - シェルとの通信
  - プロセス終了の処理

## データフロー

```
User Input → WebView (InputManager) → MessageManager → Extension → node-pty → Shell
                                                                       ↓
                                                                 xterm.js Display ← WebView (UIManager) ← MessageManager ← Extension ← PTY Output
```

### 1. 入力フロー
1. ユーザーが WebView 内のターミナルで入力
2. xterm.js が入力をキャプチャし、InputManager に渡す
3. InputManager が MessageManager を通じて Extension にメッセージで送信
4. Extension が node-pty を通じてシェルに送信

### 2. 出力フロー
1. シェルが出力を生成
2. node-pty が出力をキャプチャ
3. Extension が MessageManager を通じて WebView にメッセージで送信
4. MessageManager が UIManager に出力を渡し、UIManager が xterm.js で表示

## セキュリティ考慮事項

### 1. Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               script-src vscode-resource: 'unsafe-inline'; 
               style-src vscode-resource: 'unsafe-inline';">
```

### 2. メッセージ検証
- WebView からのメッセージは全て検証
- 危険なコマンドの実行防止
- 入力のサニタイズ

### 3. リソース制限
- 同時実行ターミナル数の制限
- メモリ使用量の監視
- プロセス終了時のクリーンアップ

## パフォーマンス最適化

### 1. メモリ管理
- 未使用ターミナルの自動クリーンアップ
- バッファサイズの最適化
- リソースリークの防止

### 2. レンダリング最適化
- 仮想スクロールの実装
- 差分レンダリング
- アニメーション最適化

### 3. 通信最適化
- メッセージのバッチ処理
- 不要な通信の削減
- 非同期処理の活用
- **インテリジェントなバッファリング**: Claude Codeアクティビティに基づいて動的な間隔でバッファリングを調整し、パフォーマンスを最適化します。
- **デバウンス処理**: リサイズや高頻度イベントに対してデバウンス処理を適用し、不要な再描画を削減します。

## 拡張性

### 1. プラグイン機能
- カスタムテーマの対応
- 外部ツールとの連携
- 設定の外部化

### 2. 多言語対応
- i18n による国際化
- 設定ファイルの多言語対応
- エラーメッセージの翻訳

### 3. プラットフォーム対応
- Windows/macOS/Linux 対応
- 各OS固有の機能活用
- 互換性の確保

## 技術的制約

### 1. VS Code API 制約
- WebView の制限事項
- セキュリティポリシー
- リソースアクセス制限

### 2. パフォーマンス制約
- メモリ使用量の上限
- CPU 使用率の考慮
- ネットワーク通信の制限

### 3. 互換性制約
- VS Code バージョン対応
- 拡張機能同士の競合
- OS 固有の制限事項