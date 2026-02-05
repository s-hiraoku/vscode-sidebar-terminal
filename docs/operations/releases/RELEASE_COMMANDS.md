# Release Commands

VS Code Sidebar Terminal のリリースは `main` ブランチから `npm run release:*` を実行します。

## ✅ 事前チェック

- `main` が最新
- 未コミット変更がない
- 必要なテストが通っている

```bash
git checkout main
git pull origin main

git status -sb
npm run test
npm run lint
```

## 🚀 リリース実行

```bash
# パッチリリース (0.1.70 → 0.1.71)
npm run release:patch

# マイナーリリース (0.1.70 → 0.2.0)
npm run release:minor

# メジャーリリース (0.1.70 → 1.0.0)
npm run release:major
```

## 🔍 実行される処理

- 事前チェック (`npm run pre-release:check`) を実行
- `package.json` のバージョン更新
- Git タグ作成
- タグを含めて `origin` に push

GitHub Actions がタグを検知してビルド・リリースを進めます。

## 🛠️ うまくいかない場合

自動化が失敗した場合は、`docs/operations/RELEASE_PROCESS.md` の手動手順に従ってください。
