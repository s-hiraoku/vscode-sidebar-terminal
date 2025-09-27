# 🚨 Rollback Quick Reference Guide

緊急時の即座対応のためのクイックリファレンス

## ⚡ 1分で実行：緊急コマンド

```bash
# 🚨 最優先: 完全自動ロールバック（推奨）
npm run rollback:emergency:publish

# 📋 利用可能バージョン確認
npm run rollback:list

# 🔍 現在状況の確認
npm run monitor:check
```

## 📊 状況別対応フロー

### 🔴 Critical: 拡張機能が動作しない

```bash
# 即座実行（自動公開含む）
npm run rollback:emergency:publish

# 実行時間: 約15分
# 効果: 前バージョンに完全復旧
```

### 🟡 High: 主要機能に問題

```bash
# 1. 状況確認
npm run rollback:list

# 2. 安全確認後ロールバック
npm run rollback:verify
npm run rollback:emergency:publish

# 対応時間: 24時間以内
```

### 🟢 Medium: 軽微な問題

```bash
# 監視強化
npm run monitor:continuous

# 次回リリースで修正予定
# 緊急対応不要
```

## 🛠️ コマンド詳細リファレンス

### ロールバック系

| コマンド | 用途 | 所要時間 |
|----------|------|----------|
| `npm run rollback:emergency:publish` | 完全自動ロールバック | 15分 |
| `npm run rollback:emergency` | ローカルロールバックのみ | 5分 |
| `npm run rollback:to 0.1.95` | 特定バージョンに切り戻し | 5分 |
| `npm run rollback:list` | 利用可能バージョン確認 | 即座 |
| `npm run rollback:verify` | 公開前安全性確認 | 3分 |
| `npm run rollback:backup` | 現在バージョンのバックアップ | 1分 |

### 監視系

| コマンド | 用途 | 頻度 |
|----------|------|------|
| `npm run monitor:check` | 単発ヘルスチェック | 即座 |
| `npm run monitor:continuous` | 連続監視（30分間隔） | 継続 |
| `npm run monitor:continuous 15` | 連続監視（15分間隔） | 継続 |

### 修正系

| コマンド | 用途 | 所要時間 |
|----------|------|----------|
| `npm run rollback:hotfix` | ホットフィックス自動リリース | 20分 |
| `npm run rollback:plan` | 緊急対応プラン生成 | 1分 |

## 🔧 トラブルシューティング

### ロールバックが失敗する場合

```bash
# 1. 認証確認
npx @vscode/vsce ls-publishers

# 2. 手動復旧
git show v0.1.95:package.json > package.json
npm install
npm run compile

# 3. 手動公開
npm run vsce:publish
```

### 監視が機能しない場合

```bash
# Marketplace接続確認
npm run rollback:verify

# 手動状況確認
npx @vscode/vsce show s-hiraoku.vscode-sidebar-terminal
```

## 📱 緊急連絡フロー

### レベル1: 自動対応（0-15分）
- ロールバックスクリプト実行
- 基本動作確認
- 自動公開

### レベル2: 手動対応（15-60分）
- 根本原因分析
- 手動修正
- 緊急リリース

### レベル3: エスカレーション（1時間以上）
- VS Code Marketplace サポート
- 外部依存関係確認
- 長期対応計画

## 🎯 成功確認チェックリスト

### ロールバック後の確認事項

- [ ] `npm run monitor:check` で正常状態確認
- [ ] VS Code Marketplaceでバージョン確認
- [ ] 拡張機能の基本動作テスト
- [ ] ユーザーからの問題報告停止確認

### 公開成功の確認

```bash
# 1. Marketplace確認（10分後）
npx @vscode/vsce show s-hiraoku.vscode-sidebar-terminal

# 2. ダウンロード可能性確認
# VS Codeで拡張機能インストールテスト

# 3. 継続監視開始
npm run monitor:continuous &
```

## 🚀 予防策

### リリース前の必須チェック

```bash
# 必須実行
npm run pre-release:check

# 含まれる内容:
# ✅ 自動バックアップ作成
# ✅ 包括的テスト実行
# ✅ 品質ゲート確認
# ✅ ロールバックプラン生成
```

### 継続監視の設定

```bash
# 自動ロールバック有効化
export AUTO_ROLLBACK_ENABLED=true

# 監視開始
npm run monitor:continuous &
```

## 📄 記録とレポート

### 実行記録の確認

```bash
# ロールバック履歴
ls .version-backups/

# 最新の緊急対応記録
cat .version-backups/emergency-*.json

# 監視レポート
cat .version-backups/monitoring-report-*.json
```

## 🆘 Ultimate Emergency Commands

**全てが失敗した時の最終手段**

```bash
# 1. 完全手動リセット
git checkout main
git pull origin main
npm install
npm run compile

# 2. 前回正常バージョンに強制切り戻し
git checkout v0.1.95 -- package.json
npm install
npm run vsce:publish

# 3. 緊急通知
echo "EMERGENCY ROLLBACK EXECUTED" > EMERGENCY_STATUS.txt
```

---

**🚨 緊急時はこのガイドに従って冷静に対応してください**

**📞 不明な点があれば即座にエスカレーションを**