# Secondary Terminal - Claude Code実装ガイド

VS Code拡張機能の開発・保守・緊急対応の完全ガイドです。

## 🚀 開発環境のセットアップ

### 基本コマンド

```bash
# 開発用コンパイル
npm run compile

# ウォッチモード
npm run watch

# テスト実行
npm run test

# リリース前チェック
npm run pre-release:check
```

### 品質保証

```bash
# 包括的テスト
npm run test:all

# カバレッジ確認
npm run test:coverage

# TDD品質チェック
npm run tdd:comprehensive-check
```

## 🚨 緊急時のロールバック対応

### 完全自動化ロールバック

**問題発生時の即座対応（推奨）**

```bash
# 🚨 緊急時: 完全自動ロールバック + Marketplace公開
npm run rollback:emergency:publish
```

**実行内容:**
1. 前バージョンへの自動切り戻し
2. 安全性チェック（コンパイル・テスト・依存関係）
3. VS Code Marketplace認証確認
4. 自動パッケージ作成・公開
5. 公開成功の検証

**所要時間:** 約15分（手動対応の75%短縮）

### 段階的ロールバック

**より慎重なアプローチ**

```bash
# 1. 利用可能バージョンの確認
npm run rollback:list

# 2. ローカル環境でのロールバック
npm run rollback:emergency
# または特定バージョン指定
npm run rollback:to 0.1.95

# 3. 安全性の事前確認
npm run rollback:verify

# 4. 手動公開
npm run vsce:publish
```

### ホットフィックス対応

**緊急修正が必要な場合**

```bash
# ホットフィックスブランチ作成 + 自動リリース
npm run rollback:hotfix
```

## 📊 リリース監視システム

### リアルタイム監視

```bash
# 単発監視チェック
npm run monitor:check

# 連続監視（30分間隔）
npm run monitor:continuous

# カスタム間隔（15分間隔）
npm run monitor:continuous 15
```

### 監視項目

- **ダウンロード数動向**: 急激な減少の検出
- **ユーザー評価**: 評価4.0以下でアラート
- **バージョン整合性**: Marketplace版との一致確認
- **エラーレポート**: 5件以上でアラート

### 自動アラート設定

```bash
# 完全自動ロールバックの有効化
export AUTO_ROLLBACK_ENABLED=true

# 監視間隔のカスタマイズ
export MONITOR_INTERVAL_MINUTES=30
```

## 🔧 開発ワークフロー

### 通常の開発サイクル

1. **機能開発**
   ```bash
   git checkout -b feature/new-feature
   npm run compile
   npm run test
   ```

2. **リリース準備**
   ```bash
   npm run pre-release:check
   npm run release:patch:safe
   ```

3. **リリース後監視**
   ```bash
   npm run monitor:continuous &
   ```

### 緊急対応フロー

1. **問題報告受信**
   - ユーザーレポート
   - 自動監視アラート

2. **影響度評価**
   - Critical: 即座にロールバック
   - High: 24時間以内対応
   - Medium: 次回リリースで修正

3. **自動対応実行**
   ```bash
   npm run rollback:emergency:publish
   ```

4. **事後対応**
   - 根本原因分析
   - 修正実装
   - 改善版リリース

## 📁 ファイル構造とアーキテクチャ

### 核心コンポーネント

```
src/
├── terminals/           # ターミナル管理の中核
│   ├── TerminalManager.ts
│   └── CLAUDE.md
├── webview/            # WebView UI実装
│   ├── managers/
│   └── CLAUDE.md
├── providers/          # VS Code統合
│   ├── SecondaryTerminalProvider.ts
│   └── CLAUDE.md
└── services/           # 共通サービス
```

### 重要な設計パターン

**TerminalManager（シングルトン）**
- 全ターミナルプロセスの生命周期管理
- 1-5番のID再利用システム
- 原子性保証による安定性

**WebView Manager階層**
- MessageManager: Extension通信
- UIManager: UI制御・テーマ
- InputManager: キーボード・IME
- PerformanceManager: 出力最適化

## 🛡️ 安全性とセキュリティ

### 自動バックアップシステム

```bash
# 手動バックアップ
npm run rollback:backup

# リリース前自動バックアップ（プリフック）
npm run pre-release:check  # 自動でバックアップ実行
```

### セキュリティチェック

```bash
# 依存関係監査
npm audit

# セキュリティ脆弱性チェック
npm run security:check
```

### VS Code Marketplace認証

```bash
# 認証状態確認
npx @vscode/vsce ls-publishers

# 再認証
npx @vscode/vsce login
```

## 📈 パフォーマンス最適化

### CPU使用率最適化

**現在の設定（最適化済み）:**
- バッファフラッシュ間隔: 16ms（60fps相当）
- CLI Agent検出時: 4ms（250fps）
- セッション保存間隔: 5分

### メモリ効率化

```bash
# メモリ使用量確認
npm run monitor:memory

# ガベージコレクション強制実行
npm run cleanup:memory
```

## 🧪 テスト戦略

### TDD実装サイクル

```bash
# Red Phase: 失敗テスト作成
npm run tdd:red

# Green Phase: 最小実装
npm run tdd:green

# Refactor Phase: リファクタリング
npm run tdd:refactor

# 完全サイクル
npm run tdd:cycle
```

### テスト分類

- **Unit Tests**: 個別コンポーネント
- **Integration Tests**: コンポーネント間連携
- **Performance Tests**: 処理速度・メモリ
- **E2E Tests**: 実WebView環境

## 📝 トラブルシューティング

### よくある問題と解決法

**1. ターミナルプロンプトが表示されない**
```bash
# デバッグモードで確認
Ctrl+Shift+D  # Debug panel表示

# 強制プロンプト再生成
TerminalManager.initializeShellForTerminal()
```

**2. CPU使用率が高い**
```bash
# バッファ設定確認
webview/constants/webview.ts: BUFFER_FLUSH_INTERVAL

# パフォーマンス監視
npm run monitor:performance
```

**3. メモリリーク**
```bash
# リソース確認
npm run monitor:memory

# 強制クリーンアップ
npm run cleanup:resources
```

## 🔗 参考ドキュメント

### 詳細実装ガイド

- [Terminals CLAUDE.md](src/terminals/CLAUDE.md) - ターミナル管理
- [WebView CLAUDE.md](src/webview/CLAUDE.md) - UI実装
- [Providers CLAUDE.md](src/providers/CLAUDE.md) - VS Code統合

### 緊急対応マニュアル

- [Emergency Rollback Guide](docs/EMERGENCY_ROLLBACK.md) - 緊急時手順
- [Automated Rollback System](docs/AUTOMATED_ROLLBACK_SYSTEM.md) - 自動化システム

### 開発支援

- [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)

---

**Claude Codeでの効率的な開発とトラブル対応を実現する完全ガイドです。**