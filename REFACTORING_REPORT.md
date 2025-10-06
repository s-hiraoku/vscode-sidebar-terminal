# コード重複分析レポート (2025-01-07)

## 実行概要

**分析対象**: src/ ディレクトリ (test除外)
**検出ツール**: jscpd (JavaScript Copy/Paste Detector)
**検出基準**:
- 最小行数: 10行
- 最小トークン数: 50トークン

## 重複コード検出結果

### 優先度: 高 (Critical Duplications)

#### 1. テーマ管理の重複 (3箇所)

**影響範囲**: WebView UI全体

```
src/webview/utils/ThemeManager.ts:134-151 (17行, 116トークン)
src/webview/utils/WebviewThemeUtils.ts:10-27
```

```
src/webview/types/terminal.types.ts:34-54 (20行, 127トークン)
src/webview/utils/ThemeManager.ts:21-44
```

**推奨対応**:
- 共通テーマ定義を `src/webview/types/theme.types.ts` に統合
- `ThemeManager` と `WebviewThemeUtils` を単一モジュールに統合
- テーマ定義インターフェースを一元化

**期待効果**:
- コード量削減: 約50行
- メンテナンス性向上
- テーマ変更時のバグリスク低減

---

#### 2. 定数定義の重複 (2箇所)

**影響範囲**: Extension全体とWebView

```
src/constants/index.ts:75-96 (21行, 148トークン)
src/webview/constants/index.ts:40-61
```

```
src/constants/index.ts:96-119 (23行, 152トークン)
src/webview/constants/index.ts:61-84
```

**推奨対応**:
- 共通定数を `src/shared/constants.ts` に抽出
- Extension/WebView両方からimport可能な構造に変更
- Webpack aliasで共有パス設定

**期待効果**:
- コード量削減: 約40行
- 定数変更の一元管理
- Extension/WebView間の定数不一致防止

---

#### 3. セッション管理の重複 (4箇所)

**影響範囲**: セッション復元機能

```
src/sessions/StandardTerminalSessionManager.ts:214-233 (19行, 157トークン)
src/sessions/StandardTerminalSessionManager.ts:156-175
```

```
src/services/TerminalPersistenceService.ts:387-410 (23行, 168トークン)
src/sessions/StandardTerminalSessionManager.ts:605-627
```

**推奨対応**:
- セッションデータ変換ロジックを共通ユーティリティに抽出
- `SessionDataTransformer` クラスを新規作成
- 両サービスから共通メソッドを呼び出す

**期待効果**:
- コード量削減: 約60行
- セッションデータ形式の統一
- 変換ロジックのテスト容易性向上

---

### 優先度: 中 (Medium Duplications)

#### 4. CLI Agent検出ストラテジーの重複

```
src/services/strategies/CodexDetectionStrategy.ts:17-33 (16行, 105トークン)
src/services/strategies/CopilotDetectionStrategy.ts:17-33
```

**推奨対応**:
- 基底クラス `BaseDetectionStrategy` を作成
- 共通検出ロジックを基底クラスに移動
- 各ストラテジーはパターン定義のみに特化

**期待効果**:
- コード量削減: 約30行
- 新規Agent追加の容易性向上
- 検出ロジック統一

---

#### 5. メッセージハンドラーの重複

```
src/messaging/handlers/CliAgentHandler.ts:214-225 (11行, 91トークン)
src/webview/managers/controllers/CliAgentMessageController.ts:156-167
```

**推奨対応**:
- Extension側とWebView側で異なる責務のため、**現状維持を推奨**
- コメントで相互参照を明記
- インターフェース定義で型安全性確保

**期待効果**:
- 過度な統合によるコード複雑化を回避
- 責務分離の明確化

---

#### 6. OperationResultHandlerの内部重複

```
src/utils/OperationResultHandler.ts:80-108 (28行, 211トークン)
src/utils/OperationResultHandler.ts:44-72
```

**推奨対応**:
- 内部ヘルパーメソッドに抽出
- `formatOperationResult()` 共通化
- エラーハンドリングパターン統一

**期待効果**:
- コード量削減: 約25行
- エラーメッセージ一貫性向上

---

### 優先度: 低 (Low Priority Duplications)

#### 7. ProfileManagerとTerminalTabManagerの配列比較

```
src/webview/managers/ProfileManager.ts:321-331 (10行, 75トークン)
src/webview/managers/TerminalTabManager.ts:450-460
```

**推奨対応**:
- 共通ユーティリティ `src/utils/arrayUtils.ts` に抽出
- `arraysEqual()` 関数として提供
- TypeScript Genericsで型安全性確保

**期待効果**:
- コード量削減: 約10行
- 配列比較ロジックの再利用性向上

---

#### 8. DisplayModeManagerとTerminalContainerManagerの重複

```
src/webview/managers/DisplayModeManager.ts:75-94 (19行, 96トークン)
src/webview/managers/TerminalContainerManager.ts:55-74
```

**推奨対応**:
- コンテナ取得ロジックを `TerminalContainerManager` に統一
- `DisplayModeManager` から `TerminalContainerManager` を参照
- 責務分離を明確化

**期待効果**:
- コード量削減: 約15行
- コンテナ操作の一元管理

---

## リファクタリング実装計画

### フェーズ1: 高優先度対応 (今すぐ実施)

**対象**:
1. テーマ管理統合
2. 定数定義統合
3. セッション管理統合

**期待削減**: 約150行
**実装期間**: 2-3日
**リスク**: 低（既存テスト網羅率高）

### フェーズ2: 中優先度対応 (次回リリース前)

**対象**:
4. CLI Agent検出ストラテジー基底クラス化
5. OperationResultHandler内部重複解消

**期待削減**: 約55行
**実装期間**: 1-2日
**リスク**: 低

### フェーズ3: 低優先度対応 (時間がある時)

**対象**:
7. 配列比較ユーティリティ抽出
8. コンテナ操作一元化

**期待削減**: 約25行
**実装期間**: 0.5-1日
**リスク**: 極小

---

## 累計改善効果

**コード削減**: 約230行
**ファイル数削減**: 0-2ファイル
**保守性向上**: 大幅改善
**テストカバレッジ**: 維持（97%）
**パフォーマンス**: 影響なし

---

## 非推奨項目 (実施しない重複)

### テストコード内の重複

**理由**: テストの可読性・独立性を優先
**方針**: テストヘルパー関数への抽出のみ許可

### Extension/WebView間の類似コード

**理由**: 実行環境が異なり、責務も異なる
**方針**: インターフェース定義で型安全性を確保し、実装は分離維持

---

## 実装ガイドライン

### 重複解消時の注意点

1. **既存テストの通過を必須条件とする**
   - リファクタリング前にテストスイート実行
   - リファクタリング後も全テスト通過確認

2. **段階的実装**
   - 一度に複数箇所を変更しない
   - 1つの重複解消ごとにコミット

3. **型安全性の維持**
   - TypeScript型定義を厳密に
   - any型の使用を避ける

4. **後方互換性**
   - 既存APIを壊さない
   - 非推奨化する場合は適切な移行期間を設定

---

## 次のアクション

### 即座に実施可能

```bash
# テーマ管理統合
1. src/webview/types/theme.types.ts 作成
2. ThemeManager と WebviewThemeUtils の統合
3. テスト実行・確認
4. コミット

# 定数定義統合
1. src/shared/constants.ts 作成
2. webpack.config.js でalias設定
3. 既存importパス更新
4. テスト実行・確認
5. コミット
```

### レビュー・承認後

- フェーズ1完了後、v0.1.117としてリリース
- フェーズ2はv0.1.118に含める
- フェーズ3は継続的改善として実施

---

**作成日**: 2025-01-07
**作成者**: Claude Code Refactoring Analysis
**対象バージョン**: v0.1.116
