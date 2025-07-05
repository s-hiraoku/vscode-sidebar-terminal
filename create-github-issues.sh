#!/bin/bash

# VS Code Sidebar Terminal Extension - GitHub Issues Creation Script
# 
# このスクリプトを実行する前に、以下のコマンドで GitHub CLI の認証を行ってください：
# gh auth login
#
# また、GitHub リポジトリを作成し、リモートリポジトリを設定してください：
# gh repo create vscode-sidebar-terminal --public --clone=false
# git remote add origin https://github.com/YOUR_USERNAME/vscode-sidebar-terminal.git

echo "🚀 VS Code Sidebar Terminal Extension - GitHub Issues を作成します..."

# 1. Epic Issue
echo "📋 Epic Issue を作成中..."
gh issue create --title "📋 [Epic] VS Code Sidebar Terminal Extension Development" \
  --body "## 概要
VS Code のサイドパネルにターミナルを表示する拡張機能を開発します。

## 主な機能
- サイドパネルでのターミナル表示
- xterm.js によるターミナルエミュレーション
- 縦分割機能のサポート
- 複数ターミナルの管理
- カスタマイズ可能な設定

## 技術スタック
- TypeScript
- VS Code Extension API
- WebView API
- xterm.js
- node-pty

## マイルストーン
- [ ] プロジェクトセットアップ
- [ ] 基本的なターミナル機能の実装
- [ ] 縦分割機能の実装
- [ ] 設定管理機能
- [ ] テストとドキュメント
- [ ] リリース準備

## 関連 Issues
このEpicに関連する全てのタスクは、このIssueにリンクされます。" \
  --label "epic,enhancement"

# 2. プロジェクトの初期セットアップ
echo "⚙️ プロジェクト初期セットアップ Issue を作成中..."
gh issue create --title "⚙️ プロジェクトの初期セットアップ" \
  --body "## 説明
VS Code 拡張機能プロジェクトの初期セットアップを行います。

## タスク
- [ ] VS Code 拡張機能プロジェクトの初期化
- [ ] TypeScript の設定
- [ ] ESLint / Prettier の設定
- [ ] 基本的なディレクトリ構造の作成
- [ ] package.json の設定
- [ ] 必要な依存関係のインストール

## 受け入れ基準
- \`yo code\` または手動でプロジェクトが初期化されている
- TypeScript が正しく設定されている
- リンターとフォーマッターが動作する
- 基本的な拡張機能が VS Code で起動できる

## 技術的な実装ポイント
- VS Code Extension API の最新バージョンを使用
- TypeScript 5.x を使用
- ESLint と Prettier の設定を追加
- \`.vscode\` ディレクトリに開発用設定を追加" \
  --label "setup,priority:high" \
  --assignee @me

# 3. WebView プロバイダーの実装
echo "🎨 WebView プロバイダー Issue を作成中..."
gh issue create --title "🎨 WebView プロバイダーの実装" \
  --body "## 説明
サイドパネルに表示するための WebView プロバイダーを実装します。

## タスク
- [ ] WebviewViewProvider インターフェースの実装
- [ ] WebView の HTML/CSS/JS テンプレート作成
- [ ] WebView のセキュリティ設定（CSP）
- [ ] WebView とエクステンション間の通信設定

## 受け入れ基準
- サイドパネルに WebView が表示される
- WebView のコンテンツが正しくレンダリングされる
- エクステンションと WebView 間でメッセージのやり取りができる
- CSP が適切に設定されている

## 技術的な実装ポイント
- \`vscode.window.registerWebviewViewProvider\` を使用
- Content Security Policy (CSP) の適切な設定
- \`postMessage\` API による双方向通信
- WebView のライフサイクル管理" \
  --label "feature,ui" \
  --assignee @me

# 4. ターミナルマネージャーの実装
echo "💻 ターミナルマネージャー Issue を作成中..."
gh issue create --title "💻 ターミナルマネージャーの実装" \
  --body "## 説明
複数のターミナルインスタンスを管理するマネージャークラスを実装します。

## タスク
- [ ] TerminalManager クラスの作成
- [ ] ターミナルインスタンスの作成・削除機能
- [ ] アクティブなターミナルの管理
- [ ] ターミナルのステート管理
- [ ] イベントハンドリング

## 受け入れ基準
- 複数のターミナルを作成・管理できる
- アクティブなターミナルを切り替えられる
- ターミナルの状態が正しく管理される
- ターミナルの作成・削除時にイベントが発火する

## 技術的な実装ポイント
- シングルトンパターンでの実装
- Map を使用したターミナルインスタンスの管理
- EventEmitter パターンの活用
- メモリリークの防止" \
  --label "feature,core" \
  --assignee @me

# 5. PTY プロセス管理の実装
echo "🔄 PTY プロセス管理 Issue を作成中..."
gh issue create --title "🔄 PTY プロセス管理の実装" \
  --body "## 説明
node-pty を使用して実際のターミナルプロセスを管理する機能を実装します。

## タスク
- [ ] node-pty の統合
- [ ] PTY プロセスの作成・破棄
- [ ] シェルの自動検出（bash, zsh, PowerShell等）
- [ ] 環境変数の継承
- [ ] プロセスの入出力処理

## 受け入れ基準
- 各OS（Windows, macOS, Linux）でシェルが正しく起動する
- ターミナルへの入力が正しく処理される
- ターミナルからの出力が正しく表示される
- プロセスが適切にクリーンアップされる

## 技術的な実装ポイント
- node-pty の適切な設定
- OS別のシェル検出ロジック
- バッファリングとフロー制御
- プロセスのライフサイクル管理
- エラーハンドリング" \
  --label "feature,core" \
  --assignee @me

# 6. xterm.js 統合とUI実装
echo "🎯 xterm.js 統合 Issue を作成中..."
gh issue create --title "🎯 xterm.js 統合とUI実装" \
  --body "## 説明
xterm.js をWebViewに統合し、ターミナルUIを実装します。

## タスク
- [ ] xterm.js の WebView への統合
- [ ] ターミナルのスタイリング
- [ ] フォントとテーマの設定
- [ ] リサイズ処理の実装
- [ ] スクロールバーのカスタマイズ

## 受け入れ基準
- xterm.js がWebView内で正しく動作する
- テキストが正しく表示される
- カラー出力がサポートされる
- ウィンドウのリサイズに対応する
- VS Code のテーマと調和したデザイン

## 技術的な実装ポイント
- xterm.js の最新バージョンを使用
- WebGL レンダラーの活用
- FitAddon によるサイズ調整
- VS Code のテーマ変数の活用
- パフォーマンスの最適化" \
  --label "feature,ui" \
  --assignee @me

# 7. 縦分割機能の実装
echo "➗ 縦分割機能 Issue を作成中..."
gh issue create --title "➗ 縦分割機能の実装" \
  --body "## 説明
ターミナルを縦に分割して複数のターミナルを同時に表示する機能を実装します。

## タスク
- [ ] 分割UI（スプリッター）の実装
- [ ] ドラッグによるペインサイズ調整
- [ ] 新規ペインの作成・削除
- [ ] フォーカス管理
- [ ] キーボードショートカット

## 受け入れ基準
- ターミナルを縦に分割できる
- スプリッターをドラッグしてサイズを調整できる
- 各ペインが独立して動作する
- フォーカスが正しく管理される
- 最大分割数の制限が機能する

## 技術的な実装ポイント
- CSS Grid または Flexbox による分割レイアウト
- ResizeObserver API の活用
- ドラッグ&ドロップ API
- フォーカス管理のロジック
- ペインの最小サイズ制限" \
  --label "feature,ui,priority:high" \
  --assignee @me

# 8. 設定管理機能の実装
echo "🔧 設定管理機能 Issue を作成中..."
gh issue create --title "🔧 設定管理機能の実装" \
  --body "## 説明
ユーザーがカスタマイズできる設定機能を実装します。

## タスク
- [ ] VS Code 設定スキーマの定義
- [ ] デフォルト設定の実装
- [ ] 設定変更の監視と反映
- [ ] フォント設定
- [ ] カラーテーマ設定
- [ ] シェルのカスタマイズ

## 受け入れ基準
- VS Code の設定画面から設定を変更できる
- 設定変更が即座に反映される
- デフォルト値が適切に設定される
- 無効な設定値が適切に処理される

## 技術的な実装ポイント
- package.json の contributes.configuration
- vscode.workspace.getConfiguration API
- 設定変更イベントのハンドリング
- 型安全な設定管理
- バリデーション処理" \
  --label "feature,enhancement" \
  --assignee @me

# 9. テストの実装
echo "🧪 テスト実装 Issue を作成中..."
gh issue create --title "🧪 テストの実装" \
  --body "## 説明
拡張機能の品質を保証するためのテストを実装します。

## タスク
- [ ] 単体テストの環境構築
- [ ] 統合テストの環境構築
- [ ] TerminalManager のテスト
- [ ] WebView プロバイダーのテスト
- [ ] E2E テストの実装
- [ ] CI/CD パイプラインの設定

## 受け入れ基準
- テストカバレッジが80%以上
- 全てのテストが通過する
- CI でテストが自動実行される
- モックが適切に使用されている

## 技術的な実装ポイント
- Jest または Mocha の設定
- VS Code Test API の活用
- WebView のモック
- node-pty のモック
- GitHub Actions での自動テスト" \
  --label "test,quality" \
  --assignee @me

# 10. パッケージングとリリース準備
echo "📦 パッケージング Issue を作成中..."
gh issue create --title "📦 パッケージングとリリース準備" \
  --body "## 説明
拡張機能をマーケットプレイスに公開するための準備を行います。

## タスク
- [ ] README.md の作成
- [ ] CHANGELOG.md の作成
- [ ] アイコンとバナーの作成
- [ ] vsix パッケージの作成
- [ ] パブリッシャーアカウントの設定
- [ ] マーケットプレイスへの公開

## 受け入れ基準
- README に機能説明とスクリーンショットが含まれる
- 適切なメタデータが設定される
- vsix パッケージが正しく作成される
- ライセンスが明記される
- セキュリティスキャンを通過する

## 技術的な実装ポイント
- vsce (Visual Studio Code Extension) ツールの使用
- package.json のメタデータ設定
- webpack によるバンドル最適化
- 画像アセットの最適化
- セマンティックバージョニング" \
  --label "documentation,release" \
  --assignee @me

echo "✅ 全ての GitHub Issues の作成が完了しました！"
echo ""
echo "次のステップ："
echo "1. 'gh auth login' で GitHub にログインしてください"
echo "2. GitHub リポジトリを作成してください："
echo "   gh repo create vscode-sidebar-terminal --public"
echo "3. このスクリプトを実行してください："
echo "   bash create-github-issues.sh"