# 🚨 Emergency Rollback Procedures

VS Code拡張機能のリリース後に問題が発生した場合の緊急対応手順です。

## ⚡ 即座の対応 (5分以内)

### 1. 緊急ロールバック実行

```bash
# 前のバージョンに即座にロールバック
npm run rollback:emergency
```

### 2. 利用可能バージョンの確認

```bash
# ロールバック可能なバージョン一覧
npm run rollback:list
```

### 3. 特定バージョンへのロールバック

```bash
# 特定のバージョンにロールバック
npm run rollback:to 0.1.95
```

## 📋 段階的対応手順

### Phase 1: 問題の確認と影響範囲の把握 (0-5分)

1. **問題の特定**
   - ユーザーレポートの確認
   - エラーログの分析
   - 影響範囲の特定

2. **緊急度の判定**
   - **Critical**: 拡張機能が動作しない → 即座にロールバック
   - **High**: 主要機能に問題 → 24時間以内にロールバック
   - **Medium**: 軽微な問題 → 次回リリースで修正

### Phase 2: ロールバック実行 (5-15分)

1. **現在状態のバックアップ**
   ```bash
   npm run rollback:backup
   ```

2. **ロールバック実行**
   ```bash
   # 自動的に前バージョンにロールバック
   npm run rollback:emergency

   # または特定バージョンを指定
   npm run rollback:to 0.1.95
   ```

3. **動作確認**
   - 拡張機能の基本動作確認
   - 主要機能のテスト
   - ユーザー報告問題の解決確認

### Phase 3: リリース・通知 (15-30分)

1. **ロールバック版のパッケージ作成**
   ```bash
   npm run vsce:package
   ```

2. **マーケットプレースへの公開**
   ```bash
   npm run vsce:publish
   ```

3. **ユーザーへの通知**
   - リリースノートでの問題説明
   - ロールバック実施の告知
   - 修正予定の通知

## 🛠️ ロールバック後の修正作業

### 1. 問題の根本原因分析

```bash
# 問題があったバージョンとの差分確認
git diff v0.1.95 v0.1.98

# 特定ファイルの変更履歴確認
git log --oneline --follow src/problematic-file.ts
```

### 2. 修正ブランチの作成

```bash
# ホットフィックスブランチ作成
git checkout -b hotfix/critical-bug-fix

# 問題の修正実装
# ... 修正作業 ...

# テスト実行
npm run test:all
npm run tdd:comprehensive-check
```

### 3. 段階的リリース

```bash
# 修正版のパッチリリース
npm run release:patch:safe
```

## 📞 緊急連絡先・エスカレーション

### レベル1: 自動対応
- ロールバックスクリプトの実行
- 基本的な動作確認

### レベル2: 開発チーム対応
- 根本原因の分析
- 修正実装とテスト
- 段階的リリース

### レベル3: エスカレーション
- VS Code Marketplace サポート
- コミュニティへの告知
- 外部依存関係の確認

## 🔍 トラブルシューティング

### ロールバックが失敗する場合

1. **Git履歴が不完全**
   ```bash
   # 手動でpackage.jsonを復元
   git show v0.1.95:package.json > package.json
   npm install
   npm run compile
   ```

2. **依存関係の競合**
   ```bash
   # 依存関係のクリーンインストール
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **バックアップファイルから復元**
   ```bash
   # バックアップディレクトリから手動復元
   ls .version-backups/
   cp .version-backups/backup-v0.1.95-*.json package.json
   ```

### 緊急時のマニュアル操作

```bash
# 1. 緊急時のファイル確認
ls -la .version-backups/

# 2. 最新のバックアップを確認
cat .version-backups/emergency-rollback-plan.json

# 3. 手動でpackage.jsonを編集
# バージョン番号を前のバージョンに変更

# 4. 依存関係の再インストール
npm install

# 5. コンパイルとテスト
npm run compile
npm run test:unit

# 6. パッケージ作成
npm run vsce:package

# 7. 公開
npm run vsce:publish
```

## 📊 事後対応

### 1. インシデントレポート作成

```markdown
# インシデントレポート

## 発生日時
YYYY-MM-DD HH:MM:SS

## 問題の概要
- 影響したバージョン: v0.1.98
- 報告された問題: [問題の詳細]
- 影響範囲: [ユーザー数、機能範囲]

## 対応履歴
- XX:XX ロールバック実行
- XX:XX 動作確認完了
- XX:XX 修正版リリース

## 根本原因
[技術的な原因の詳細]

## 再発防止策
- テストケースの追加
- チェック項目の見直し
- リリースプロセスの改善
```

### 2. プロセス改善

- 自動テストの強化
- リリース前チェックリストの見直し
- ロールバック手順の最適化
- モニタリング体制の強化

## 🎯 重要なポイント

1. **速度重視**: 問題発生から15分以内のロールバック実行
2. **確実性**: 自動化されたスクリプトを使用
3. **透明性**: ユーザーへの迅速な情報提供
4. **学習**: 事後の原因分析と改善

---

**緊急時は冷静に、このドキュメントに従って段階的に対応してください。**