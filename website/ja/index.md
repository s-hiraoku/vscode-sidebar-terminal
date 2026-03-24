---
layout: home

hero:
  name: Secondary Terminal
  text: サイドバー、ターミナル、AIエージェント
  tagline: VS Codeのサイドバーに常駐するフル機能のターミナル。Claude Code、Codex CLI、Gemini CLI、GitHub Copilot CLIのAIエージェント検出機能を内蔵。
  image:
    src: /images/icon.png
    alt: Secondary Terminal
  actions:
    - theme: brand
      text: はじめる
      link: /ja/guide/quick-start
    - theme: alt
      text: Marketplaceで見る
      link: https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal

features:
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'
    title: 複数ターミナル
    details: 最大10個の同時ターミナル、タブ管理、ドラッグ&ドロップによる並び替え、ダブルクリックで名前変更。
    link: /ja/features/terminal-management
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>'
    title: 分割ビュー
    details: 垂直/水平分割とドラッグリサイズ。パネル位置に応じた動的方向調整。
    link: /ja/features/split-view
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="8" rx="1"/><path d="M4 12h4"/><path d="M12 16v4"/><path d="M16 12h4"/><circle cx="4" cy="4" r="1"/><circle cx="20" cy="4" r="1"/><circle cx="4" cy="20" r="1"/><circle cx="20" cy="20" r="1"/></svg>'
    title: AIエージェント検出
    details: Claude Code、Copilot、Gemini (v0.28.2+)、Codex CLIをリアルタイムで自動検出。
    link: /ja/features/ai-integration
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'
    title: セッション永続化
    details: ANSIカラー保持による自動保存・復元。VS Code再起動後も中断したところから再開。
    link: /ja/features/session-persistence
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/><circle cx="18" cy="5" r="3"/></svg>'
    title: シェル統合
    details: コマンドステータスインジケーター、作業ディレクトリ表示、コマンド履歴追跡。
    link: /ja/features/shell-integration
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>'
    title: 豊富な入力サポート
    details: フルクリップボード、IMEサポート（日本語/中国語/韓国語）、Alt+クリックカーソル配置、画像貼り付け。
    link: /ja/features/input-interaction
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
    title: ターミナル内検索
    details: 正規表現対応のターミナル出力検索。キーボードショートカットでコマンド間をナビゲート。
    link: /ja/features/navigation
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
    title: スマートリンク検出
    details: ファイルパスはVS Codeで開き、URLはブラウザで開き、メールリンクも自動検出。
    link: /ja/features/link-detection
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><path d="M17 2h4v4"/><path d="M2 17h4v4"/><circle cx="10.5" cy="17.5" r="2.5"/><path d="M7 2H3v4"/><path d="M22 17h-4v4"/></svg>'
    title: 完全カスタマイズ
    details: フォント、カーソル、テーマ、カラー、ヘッダー、ターミナル動作の90以上の設定。
    link: /ja/features/customization
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/><path d="M8 12H4"/><path d="M20 12h-4"/></svg>'
    title: アクセシブル
    details: スクリーンリーダーサポートとWCAG準拠のコントラスト比。
    link: /ja/features/accessibility
---

## なぜ Secondary Terminal？

| | |
|---|---|
| **サイドバーネイティブ** | 編集中もターミナルを表示したまま。ボトムパネルの切り替えは不要。 |
| **AIエージェント対応** | Claude Code、Copilot、Gemini、Codexを自動検出。リアルタイム状態表示と250fpsレンダリング。 |
| **フル機能** | 分割ビュー、セッション永続化、シェル統合、90以上の設定。本番環境で使えるターミナル。 |
| **クロスプラットフォーム** | Windows、macOS、Linux対応。VS Code MarketplaceとOpen VSXで利用可能。 |

## クイックインストール

```sh
code --install-extension s-hiraoku.vscode-sidebar-terminal
```

VS Codeの拡張機能ビューで **"Secondary Terminal"** を検索。[Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)（VSCodium、Gitpod、Eclipse Theia）でも利用可能。
