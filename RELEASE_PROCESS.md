# リリース手順

このドキュメントでは、VS Code Sidebar Terminal 拡張機能のリリース手順について説明します。

## 📋 事前準備（初回のみ）

### 1. Visual Studio Marketplace アカウント設定

1. [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) にアクセス
2. Microsoft/Azure アカウントでサインイン
3. パブリッシャーアカウント `s-hiraoku` を確認/作成

### 2. Personal Access Token (PAT) 作成

1. [Azure DevOps](https://dev.azure.com) にアクセス
2. 右上のユーザーアイコン → "Personal access tokens" をクリック
3. "New Token" をクリック
4. 設定：
   - **Name**: `vscode-extension-publishing`
   - **Organization**: All accessible organizations
   - **Expiration**: 1年間（適切な期間を設定）
   - **Scopes**: Custom defined → **Marketplace: Manage** をチェック ✅
5. "Create" をクリックしてトークンをコピー（⚠️ 後で見ることができません）

### 3. GitHub Secrets 設定

1. GitHub リポジトリ → Settings → Secrets and variables → Actions
2. "New repository secret" をクリック
3. 設定：
   - **Name**: `VSCE_PAT`
   - **Value**: 上記で作成したPersonal Access Token
4. "Add secret" をクリック

## 🚀 リリース手順

### 1. 開発・テスト

```bash
# 開発ブランチで作業
git checkout -b feature/new-feature

# 開発・テスト
npm run compile
npm run test
npm run lint

# 変更をコミット
git add .
git commit -m "feat: 新機能を追加"
```

### 2. リリース準備

```bash
# リリース用ブランチ（for-publish）にマージ
git checkout for-publish
git merge feature/new-feature

# 変更をプッシュ（バージョンアップ前）
git push origin for-publish
```

### 3. リリース実行（自動化版）

```bash
# バグフィックス（パッチリリース）
npm run release:patch

# 新機能追加（マイナーリリース）
npm run release:minor

# 破壊的変更（メジャーリリース）
npm run release:major
```

**これだけで自動バージョンアップ・タグ作成・プッシュが実行され、自動リリースが開始されます！**

### 3-2. 手動リリース（従来方式）

```bash
# 手動でバージョンアップ
npm version patch   # または minor/major

# 変更をプッシュ
git push origin for-publish

# リリースタグを作成してプッシュ
git tag v$(node -p "require('./package.json').version")
git push origin --tags
```

## 🤖 自動実行される処理

### GitHub Actions ワークフローが以下を自動実行：

1. **ビルド** (並列実行)
   - Windows (win32-x64, win32-arm64)
   - macOS (darwin-x64, darwin-arm64)
   - Linux (linux-x64, linux-arm64, linux-armhf)
   - Alpine (alpine-x64, alpine-arm64)

2. **パッケージ作成**
   - 各プラットフォーム用に `npm rebuild` でネイティブバイナリを再ビルド
   - VSIX パッケージを生成
   - GitHub Artifacts にアップロード

3. **GitHub Release 作成**
   - すべてのプラットフォーム用 VSIX ファイルを添付
   - リリースノートを自動生成

4. **VS Code Marketplace パブリッシュ**
   - 各プラットフォーム用パッケージを Marketplace に自動アップロード
   - ユーザーのプラットフォームに応じて適切なバージョンが自動選択される

## 📊 進行状況の確認

### GitHub Actions

- URL: https://github.com/s-hiraoku/vscode-sidebar-terminal/actions
- ワークフローの実行状況をリアルタイム確認

### GitHub Releases

- URL: https://github.com/s-hiraoku/vscode-sidebar-terminal/releases
- 生成されたVSIXファイルの確認

### VS Code Marketplace

- URL: https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal
- 公開状況とユーザー向け情報の確認

## 🛠️ 手動リリース手順（自動化失敗時）

### GitHub Releaseとmarketplace公開が失敗した場合

```bash
# 1. Artifactsをダウンロード
gh run download [run-id]

# 2. GitHub Release作成
gh release create v[version] \
  --title "Release v[version]" \
  --notes "[リリースノート内容]" \
  ./vscode-sidebar-terminal-*/vscode-sidebar-terminal-*-[version].vsix

# 3. VS Code Marketplace公開
find . -name "*[version].vsix" -exec vsce publish --packagePath {} \;
```

### 自動化が機能しない場合の確認項目

1. **タグイベントの確認**
   - GitHub Actionsでタグイベントが正しく発火しているか
   - `startsWith(github.ref, 'refs/tags/v')`条件に合致しているか

2. **buildジョブの状態確認**
   - 全9プラットフォームのビルドが成功しているか
   - 失敗したプラットフォームがある場合は修正後に再実行

3. **GitHub Secrets確認**
   - `VSCE_PAT`が正しく設定されているか
   - Personal Access Tokenの有効期限確認

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. GitHub Actions でビルドエラー

```bash
# ローカルでプラットフォーム固有ビルドをテスト
npm run vsce:package:linux-x64
npm run vsce:package:darwin-x64
npm run vsce:package:win32-x64
```

#### 2. Personal Access Token エラー

- PAT の有効期限を確認
- Marketplace: Manage 権限があるか確認
- GitHub Secrets の `VSCE_PAT` が正しく設定されているか確認

#### 3. Marketplace パブリッシュエラー

```bash
# ローカルで手動パブリッシュをテスト
vsce login s-hiraoku
vsce publish --packagePath path/to/package.vsix
```

#### 4. 特定プラットフォームでのエラー

GitHub Actions の該当プラットフォームジョブのログを確認：

- Windows: Visual Studio Build Tools の問題
- macOS: Xcode Command Line Tools の問題
- Linux: build-essential パッケージの問題

## 📈 リリース後の確認事項

### 1. 機能確認

```bash
# 各プラットフォームでの動作確認
# - Windows: WSL環境での動作
# - macOS: Intel & Apple Silicon での動作
# - Linux: 各ディストリビューションでの動作
```

### 2. ユーザーフィードバック監視

- GitHub Issues の確認
- VS Code Marketplace のレビュー確認
- ダウンロード数・評価の監視

### 3. 次回リリースの準備

- 新機能のロードマップ更新
- 既知の問題の修正計画
- ドキュメントの更新

## 🏷️ バージョニングルール

[Semantic Versioning](https://semver.org/) に従います：

- **MAJOR**: 破壊的変更 (例: 1.0.0 → 2.0.0)
- **MINOR**: 新機能追加（後方互換性あり）(例: 1.0.0 → 1.1.0)
- **PATCH**: バグフィックス (例: 1.0.0 → 1.0.1)

### 例：

```bash
# バグフィックス
npm version patch

# 新機能
npm version minor

# 破壊的変更
npm version major
```

## 🔄 緊急リリース手順

### ホットフィックスが必要な場合：

```bash
# ホットフィックスブランチを作成
git checkout -b hotfix/critical-bug

# 修正作業
# ... fix critical bug ...

# for-publishブランチに直接マージ
git checkout for-publish
git merge hotfix/critical-bug

# 自動化されたパッチリリース
npm run release:patch
```

## 📝 リリースノート作成

GitHub Actions が自動生成しますが、手動で編集も可能：

1. GitHub Releases ページでリリースを編集
2. 以下の形式で記載：

```markdown
## 🚀 新機能

- 新しいターミナル分割機能を追加

## 🐛 バグフィックス

- macOSでのnode-pty互換性問題を修正
- Alt+Clickでのカーソル位置の問題を修正

## 🔧 改善

- パフォーマンスの向上
- エラーメッセージの改善

## 📦 技術的変更

- プラットフォーム固有拡張機能への移行
- GitHub Actions CI/CDの改善
```

---

## 🎯 まとめ

このリリース手順により：

✅ **完全自動化**: コマンド1つで全プラットフォーム対応リリース  
✅ **安全性**: 各環境でのネイティブビルドによる互換性保証  
✅ **効率性**: 並列ビルドによる高速リリース  
✅ **追跡性**: 完全なリリース履歴とアーティファクト管理  
✅ **ミス防止**: 手動タグ作成によるタイミング問題を回避

**`npm run release:patch` だけで、すべてのプラットフォーム向けの拡張機能が自動でリリースされます！** 🎉

### 自動化の流れ

```
npm run release:patch
  ↓
1. package.jsonのバージョン自動更新
2. Gitコミット自動作成
3. Gitタグ自動作成・プッシュ
4. GitHub Actions自動実行
5. 全プラットフォームビルド
6. GitHub Release自動作成
7. VS Code Marketplace自動公開
```
