# Issue Management Guide

このドキュメントでは、vscode-sidebar-terminal プロジェクトでの Issue 管理方法、ラベル体系、および GitHub CLI を使用した Issue 作成方法について説明します。

## ラベル体系

### 1. Area/Component ラベル (青系 #0052cc)

コードベースの機能領域や担当分野を示すラベル群です。

| ラベル | 説明 | 使用例 |
|--------|------|--------|
| `area/terminal` | ターミナル機能とPTY管理 | ターミナルプロセス、シェル実行、node-pty関連 |
| `area/webview` | WebView UIとフロントエンドコンポーネント | HTML/CSS/JavaScript、xterm.js、UI管理 |
| `area/api` | API統合と拡張機能互換性 | VS Code API、Terminal API、拡張機能間連携 |
| `area/integration` | 他拡張機能との統合 | Claude Code統合、キーバインド、コマンド連携 |
| `area/performance` | パフォーマンス最適化と効率性 | バッファリング、レンダリング最適化、メモリ使用量 |
| `area/testing` | テストインフラとテストケース | 単体テスト、統合テスト、CI/CD |
| `area/docs` | ドキュメントとガイド | README、API文書、ユーザーガイド |

### 2. Scope/Impact ラベル (紫系 #7057ff)

変更の規模や影響範囲を示すラベル群です。

| ラベル | 説明 | 使用例 |
|--------|------|--------|
| `scope/minor` | 最小限の影響を持つ小規模な変更 | バグ修正、タイポ修正、コメント追加 |
| `scope/major` | 大幅な影響を持つ大規模な変更 | 新機能追加、リファクタリング |
| `scope/breaking` | バージョンアップが必要な破壊的変更 | API変更、設定形式変更 |
| `scope/architecture` | アーキテクチャ変更と設計決定 | 新しいモジュール追加、設計パターン変更 |

### 3. Status ラベル (緑系 #0e8a16)

Issue の現在の状態を示すラベル群です。

| ラベル | 説明 | 使用例 |
|--------|------|--------|
| `status/needs-review` | レビューやフィードバック待ち | 提案待ち、技術検討中 |
| `status/in-progress` | 現在作業中 | 実装中、調査中 |
| `status/blocked` | 依存関係や外部要因でブロック中 | 他のIssue待ち、技術的制約 |
| `status/ready` | 実装準備完了 | 設計完了、実装可能 |

### 4. Effort ラベル (茶系 #8B4513)

作業量の見積もりを示すラベル群です。

| ラベル | 説明 | 工数目安 |
|--------|------|---------|
| `effort/small` | 1-2日の作業 | 小さなバグ修正、設定変更 |
| `effort/medium` | 1週間の作業 | 機能改善、中規模なリファクタリング |
| `effort/large` | 2-4週間の作業 | 新機能開発、大規模な変更 |
| `effort/epic` | 1ヶ月以上の大規模な取り組み | アーキテクチャ変更、メジャー機能追加 |

### 5. 既存ラベル

プロジェクトで継続使用する既存のラベル群です。

#### Type ラベル
- `bug` - バグ報告
- `enhancement` - 既存機能の改善
- `type/feature` - 新機能
- `documentation` - ドキュメント改善

#### Priority ラベル
- `priority/high` - 高優先度
- `priority/medium` - 中優先度  
- `priority/low` - 低優先度

#### Other ラベル
- `good first issue` - 初心者向け
- `help wanted` - 協力求む
- `question` - 質問
- `duplicate` - 重複
- `wontfix` - 修正しない

## Issue 作成ガイド

### GitHub CLI を使用した Issue 作成

#### 基本的な Issue 作成

```bash
# シンプルなIssue作成
gh issue create --title "Issue タイトル" --body "Issue の詳細説明"

# ラベル付きで作成
gh issue create --title "新機能: ダークモード対応" --body "ダークモード機能を追加する" --label "type/feature,area/webview,effort/medium"

# テンプレートを使用
gh issue create --title "Bug: ターミナルが応答しない" --body-file bug_template.md --label "bug,area/terminal,priority/high"
```

#### 複数行の詳細な Issue 作成

```bash
gh issue create --title "Feature Request: VS Code Terminal API 実装" --body "$(cat <<'EOF'
## 概要
VS Code の標準 Terminal API との互換性を実装する

## 背景
現在の実装では他の拡張機能との統合に制限がある

## 提案
- Terminal インターフェースの実装
- イベントシステムの追加
- API ドキュメントの作成

## 受け入れ条件
- [ ] Claude Code との統合が動作する
- [ ] 既存機能に影響がない
- [ ] テストカバレッジ95%以上
EOF
)"
```

### Issue 編集とラベル管理

```bash
# ラベル追加
gh issue edit 123 --add-label "area/api,scope/major"

# ラベル削除
gh issue edit 123 --remove-label "priority/low"

# ラベル置換
gh issue edit 123 --label "area/terminal,effort/large,status/ready"

# Issue 状態変更
gh issue close 123
gh issue reopen 123
```

## Issue テンプレート

### Bug Report テンプレート

```markdown
## バグの説明
バグの概要を簡潔に説明してください。

## 再現手順
1. '...' に移動
2. '...' をクリック
3. '...' まで下にスクロール
4. エラーを確認

## 期待される動作
本来どのような動作が期待されるかを説明してください。

## 実際の動作
実際に何が起こったかを説明してください。

## 環境
- OS: [例: Windows 10, macOS 12.0, Ubuntu 20.04]
- VS Code バージョン: [例: 1.74.0]
- 拡張機能バージョン: [例: 0.1.25]

## 追加情報
スクリーンショット、ログ、その他関連する情報があれば追加してください。

## ラベル案
- `bug`
- `area/[該当領域]`
- `priority/[優先度]`
```

### Feature Request テンプレート

```markdown
## 機能の概要
提案する機能の概要を説明してください。

## 動機
なぜこの機能が必要なのか、どのような問題を解決するのかを説明してください。

## 詳細な説明
機能の詳細な動作や実装方法について説明してください。

## 代替案
検討した他の解決方法があれば説明してください。

## 受け入れ条件
- [ ] 条件1
- [ ] 条件2
- [ ] 条件3

## ラベル案
- `type/feature` または `enhancement`
- `area/[該当領域]`
- `effort/[工数見積もり]`
- `status/needs-review`
```

## 最適なラベル付けのガイドライン

### 必須ラベル
すべての Issue には以下のラベルを含めることを推奨します：
1. **Type**: `bug`, `type/feature`, `enhancement` のいずれか
2. **Area**: 該当する機能領域
3. **Effort**: 作業量の見積もり

### 推奨ラベル組み合わせ例

```bash
# 小さなバグ修正
--label "bug,area/webview,effort/small,priority/medium"

# 新機能開発
--label "type/feature,area/api,effort/large,scope/major,status/needs-review"

# ドキュメント改善
--label "documentation,area/docs,effort/small,scope/minor"

# 大規模なアーキテクチャ変更
--label "enhancement,area/terminal,scope/architecture,effort/epic,status/needs-review"

# Claude Code 統合関連
--label "area/integration,area/api,scope/major,effort/medium"
```

## ワークフロー

### Issue ライフサイクル

1. **作成** → `status/needs-review`
2. **検討・設計** → `status/ready`  
3. **実装開始** → `status/in-progress`
4. **完了・クローズ**

### Status ラベルの使い分け

- **新規 Issue**: `status/needs-review` (デフォルト)
- **実装待ち**: `status/ready`
- **作業中**: `status/in-progress`
- **依存関係待ち**: `status/blocked`

## 参考コマンド集

```bash
# 全ラベル一覧表示
gh label list

# 特定ラベルの Issue 一覧
gh issue list --label "area/terminal"

# 複数条件での Issue 検索
gh issue list --label "bug,priority/high" --state open

# Issue の詳細表示
gh issue view 123

# Issue 一覧をブラウザで開く
gh issue list --web
```

このガイドを参考に、効率的で一貫性のある Issue 管理を行ってください。