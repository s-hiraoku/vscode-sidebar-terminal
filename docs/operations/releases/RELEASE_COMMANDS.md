# Quality-Assured Release Commands

VS Code拡張の品質を保証したリリースを自動化するカスタムコマンドです。

## 🚀 スラッシュコマンド

Claude Codeで以下のスラッシュコマンドが使用できます：

### `/release [patch|minor|major]`
**完全自動品質チェック＆リリース**

```bash
/release patch    # パッチバージョンリリース (0.1.70 → 0.1.71)
/release minor    # マイナーバージョンリリース (0.1.70 → 0.2.0)  
/release major    # メジャーバージョンリリース (0.1.70 → 1.0.0)
```

**実行内容**:
1. 🔍 **品質チェック** - TypeScript、ESLint、ビルド、テスト、Git状態
2. 🔧 **自動修正** - 検出されたエラーの自動修正
3. 📦 **バージョン管理** - package.jsonバージョン更新とGitタグ作成
4. 🚀 **自動デプロイ** - GitHubプッシュとActions実行

### `/quality`
**品質チェックのみ実行**

```bash
/quality    # リリースせずに品質レポートのみ生成
```

### `/fix` 
**自動修正のみ実行**

```bash
/fix    # エラーの自動修正のみ実行
```

## 📋 NPMスクリプト

```bash
# 完全リリース
npm run release:patch:safe     # パッチリリース
npm run release:minor:safe     # マイナーリリース  
npm run release:major:safe     # メジャーリリース

# 品質チェックのみ
npm run quality:check          # 品質レポート生成

# 自動修正のみ  
npm run quality:fix            # エラー自動修正
```

## 🔍 品質チェック項目

| チェック項目 | 説明 | 自動修正 |
|-------------|------|----------|
| **Dependencies** | package-lock.json存在確認 | ✅ `npm install` |
| **TypeScript** | 型エラー・コンパイルエラー | ✅ 一般的パターン修正 |
| **ESLint** | コード品質・スタイル | ✅ `--fix`オプション |
| **Build** | webpack ビルド成功 | ❌ 手動確認必要 |
| **Tests** | テストコンパイル | ❌ 手動修正必要 |
| **Git Status** | 未コミット変更確認 | ❌ 手動確認必要 |

## 🔧 自動修正機能

### TypeScriptエラー自動修正
- `bellStyle`プロパティエラー → コメントアウト
- `string | null` vs `string | undefined` → 型変換
- 一般的なインターフェース不一致 → 修正提案

### ESLintエラー自動修正  
- コードフォーマット
- 未使用変数削除
- インポート整理

### 依存関係自動修正
- `package-lock.json` 再生成
- `node_modules` インストール

## 🛡️ 品質保証レベル

**Zero-Error Release**: エラーが1つでもある場合はリリースを停止

- ✅ TypeScriptコンパイルエラー: **0個必須**
- ✅ ESLintエラー: **0個必須** (警告は許可)
- ✅ ビルドエラー: **0個必須**
- ✅ Git未コミット変更: **0個必須**

## 📊 出力例

### 成功時
```
🎉 RELEASE COMPLETED SUCCESSFULLY!

📦 Version: v0.1.71
🔧 Auto-fixes applied: 2
⚠️  Warnings: 12

🚀 GitHub Actions will now build and deploy to:
   - VS Code Marketplace (all platforms)
   - GitHub Releases
```

### エラー時
```  
❌ Quality gate failed with 3 errors

📋 ERROR SUMMARY:
1. TypeScript: Property 'bellStyle' does not exist
2. ESLint: 5 errors found  
3. Git Status: 2 uncommitted files

🔧 Attempting automatic fixes...
✅ Fixed: TypeScript
✅ Fixed: ESLint  
❌ Cannot auto-fix: Git Status (manual intervention required)
```

## 🎯 使用例

### 通常のパッチリリース
```bash
/release patch
```

### リリース前の品質確認
```bash
/quality
# 問題があれば修正
/fix
# 再確認後リリース
/release patch
```

### 手動品質管理
```bash
npm run quality:check     # 品質レポート確認
npm run quality:fix       # 自動修正実行
npm run quality:check     # 修正結果確認
npm run release:patch:safe  # リリース実行
```

## ⚠️ 注意事項

1. **Git状態**: 未コミットの変更がある場合はリリースできません
2. **手動修正**: すべてのエラーが自動修正できるわけではありません
3. **テスト実行**: フルテストは時間がかかるため、コンパイルチェックのみ実行
4. **バックアップ**: 重要な変更前にはブランチ作成を推奨

このコマンドにより、品質問題による本番リリース失敗を完全に防止できます。