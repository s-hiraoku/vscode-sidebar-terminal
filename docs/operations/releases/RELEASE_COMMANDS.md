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

`standard-version` によりコンベンショナルコミットから CHANGELOG を自動生成します。

- `package.json` のバージョン更新
- `CHANGELOG.md` の自動生成（コミット履歴から）
- バージョンコミット作成
- **タグ・push は自動実行しない**（`.versionrc.cjs` で `skip.tag` / `skip.push` を設定済み）

```bash
# CHANGELOG のプレビューのみ（バージョン変更なし）
npm run changelog
```

push 後、CI が通ったらタグを作成して push します。
GitHub Actions がタグを検知してビルド・リリースを進めます。

## 🛠️ うまくいかない場合

自動化が失敗した場合は、`docs/operations/RELEASE_PROCESS.md` の手動手順に従ってください。
