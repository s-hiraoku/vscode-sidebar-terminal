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
│  ├─ xterm.js Terminal UI                                   │
│  ├─ Split View Manager                                     │
│  └─ Message Handler                                        │
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

### 4. WebView Process
- **役割**: ユーザーインターフェース
- **責任**:
  - xterm.js による ターミナル表示
  - 分割ビューの管理
  - ユーザー入力の処理

### 5. Node-pty Backend
- **役割**: システムレベルのターミナル処理
- **責任**:
  - PTY プロセスの作成・管理
  - シェルとの通信
  - プロセス終了の処理

## データフロー

```
User Input → WebView → Extension → node-pty → Shell
                ↓
          xterm.js Display ← WebView ← Extension ← PTY Output
```

### 1. 入力フロー
1. ユーザーが WebView 内のターミナルで入力
2. xterm.js が入力をキャプチャ
3. WebView から Extension にメッセージで送信
4. Extension が node-pty を通じてシェルに送信

### 2. 出力フロー
1. シェルが出力を生成
2. node-pty が出力をキャプチャ
3. Extension が WebView にメッセージで送信
4. WebView が xterm.js で表示

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