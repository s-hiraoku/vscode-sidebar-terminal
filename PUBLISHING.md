# VS Code Marketplace パブリッシュ手順

## 1. 事前準備

### Visual Studio Marketplace アカウント作成
1. [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) にアクセス
2. Microsoft/Azure アカウントでサインイン
3. パブリッシャーアカウントを作成（初回のみ）

### Personal Access Token (PAT) 作成
1. [Azure DevOps](https://dev.azure.com) にアクセス
2. 右上のユーザーアイコン → "Personal access tokens" をクリック
3. "New Token" をクリック
4. 設定：
   - **Name**: `vscode-extension-publishing`
   - **Organization**: All accessible organizations
   - **Expiration**: 1年間など適切な期間
   - **Scopes**: カスタム定義 → **Marketplace: Manage** をチェック
5. "Create" をクリックしてトークンをコピー（後で使用不可）

## 2. ローカルでのパブリッシュ

### 手動パブリッシュ（初回推奨）
```bash
# VSCEでPATを設定
vsce login s-hiraoku
# PATを入力

# 全プラットフォーム用パッケージを作成
npm run vsce:package:win32-x64
npm run vsce:package:win32-arm64
npm run vsce:package:linux-x64
npm run vsce:package:linux-arm64
npm run vsce:package:linux-armhf
npm run vsce:package:darwin-x64
npm run vsce:package:darwin-arm64
npm run vsce:package:alpine-x64
npm run vsce:package:alpine-arm64

# 各プラットフォーム用にパブリッシュ
vsce publish --packagePath vscode-sidebar-terminal-win32-x64-0.1.0.vsix
vsce publish --packagePath vscode-sidebar-terminal-win32-arm64-0.1.0.vsix
vsce publish --packagePath vscode-sidebar-terminal-linux-x64-0.1.0.vsix
vsce publish --packagePath vscode-sidebar-terminal-linux-arm64-0.1.0.vsix
vsce publish --packagePath vscode-sidebar-terminal-linux-armhf-0.1.0.vsix
vsce publish --packagePath vscode-sidebar-terminal-darwin-x64-0.1.0.vsix
vsce publish --packagePath vscode-sidebar-terminal-darwin-arm64-0.1.0.vsix
vsce publish --packagePath vscode-sidebar-terminal-alpine-x64-0.1.0.vsix
vsce publish --packagePath vscode-sidebar-terminal-alpine-arm64-0.1.0.vsix
```

## 3. GitHub Actions での自動パブリッシュ

### GitHub Secrets 設定
1. GitHub リポジトリの Settings → Secrets and variables → Actions
2. "New repository secret" をクリック
3. 追加するシークレット：
   - **Name**: `VSCE_PAT`
   - **Value**: 作成したPersonal Access Token

### 自動パブリッシュの流れ
1. タグをプッシュ：
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
2. GitHub Actions が自動実行
3. 各プラットフォーム用パッケージを作成
4. Marketplace に自動パブリッシュ

## 4. パブリッシュ後の確認

1. [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal) で確認
2. VS Code 内で拡張機能を検索してインストールテスト
3. 各プラットフォームでの動作確認

## 5. アップデート手順

```bash
# バージョンアップ
npm version patch  # 0.1.0 → 0.1.1
# または
npm version minor  # 0.1.0 → 0.2.0

# タグをプッシュして自動パブリッシュ
git push origin main
git push origin --tags
```

## 6. トラブルシューティング

### よくある問題
- **PAT の期限切れ**: 新しい PAT を作成して VSCE_PAT を更新
- **パブリッシャー権限エラー**: Azure DevOps でパブリッシャーアカウントを確認
- **バイナリ互換性エラー**: 各プラットフォームでのビルドが正常に完了しているか確認

### デバッグ方法
```bash
# パッケージ内容確認
vsce show s-hiraoku.vscode-sidebar-terminal

# ローカルインストールテスト
code --install-extension vscode-sidebar-terminal-darwin-x64-0.1.0.vsix
```