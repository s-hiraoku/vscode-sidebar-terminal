# GitHub Issue Template: ターミナル復元機能の設計変更

**Title**: 設計変更: ターミナル復元を現実的なセッション継続方式に変更

**Labels**: `enhancement`, `architecture`, `terminal-restoration`, `high-priority`

---

## 問題の概要

現在のターミナル復元機能は、VS Code標準ターミナルの完全復元を目指しているが、技術的制約により動作していない。

## 現在の問題

- `SerializeAddon`による完全な状態復元が失敗
- Extension ←→ WebView間の複雑なメッセージング通信
- `⚠️ [WEBVIEW-PERSISTENCE] No serialize addon found for terminal` エラー頻発
- ユーザーから「全然復元されない」との報告

## 根本的な技術的困難

### アーキテクチャの複雑性
```
Extension Host (Node.js) ←→ WebView (Browser)
     ↓                           ↓
  TerminalManager              xterm.js
     ↓                           ↓  
  node-pty processes        SerializeAddon
```

### データの断片化
- Extension側: node-ptyプロセスの実際の状態
- WebView側: xterm.jsの表示状態のみ  
- 永続化: VS Code globalStateのシリアライズデータ

### VS Code標準との乖離
- VS Code本体は統合されたIPtyServiceを使用
- 外部拡張では同等の機能実現が極めて困難

## 提案する設計変更

### 現在（失敗している）
```typescript
Extension → 複雑なシリアライゼーション → WebView SerializeAddon → 完全復元（失敗）
```

### 新しい現実的な設計
```typescript
Extension → シンプルなセッション継続 → WebView 表示復元 → ユーザー体験向上
```

## 実装すべき新しい復元フロー

```typescript
復元開始
  ↓
前回のターミナル数を取得 (globalState)
  ↓
その数だけ新しいターミナル作成
  ↓
各ターミナルに「セッション復元」メッセージ表示
  ↓
アクティブターミナルを復元
  ↓
完了 ✅
```

## 期待される効果

### 技術的利点
- ✅ **信頼性向上**: 複雑な状態復元による失敗を回避
- ✅ **保守性向上**: シンプルなコードで理解しやすい
- ✅ **性能向上**: 重いserializationを削除

### ユーザー体験の利点
- ✅ **予測可能**: 毎回同じように動作
- ✅ **高速**: 復元処理が高速化
- ✅ **明確**: 何が復元されたかがわかりやすい

## 実装タスク

### Phase 1: 分析・準備
- [ ] 現在の復元機能の使用されている部分を特定
- [ ] 削除対象のコード範囲を明確化
- [ ] 新しい設計の詳細仕様を作成

### Phase 2: 実装
- [ ] 複雑な`SerializeAddon`使用部分を削除
- [ ] シンプルなセッション情報保存機能に変更
- [ ] セッション継続メッセージの実装
- [ ] ターミナル数・アクティブ状態の保存・復元

### Phase 3: テスト・品質保証
- [ ] 新しい復元フローの単体テスト作成
- [ ] 統合テストの実装
- [ ] TDD品質ゲートの通過確認

### Phase 4: ドキュメント・リリース
- [ ] CLAUDE.mdの更新
- [ ] ユーザー向けドキュメント更新
- [ ] リリースノート作成

## 技術的詳細

### 削除対象
```typescript
// これらの複雑な機能を削除
- StandardTerminalPersistenceManager.serializeTerminal()
- SerializeAddon の詳細な使用
- スクロールバック完全復元ロジック
- 複雑なメッセージング通信
```

### 新しい実装
```typescript
// シンプルな情報のみ保存・復元
interface SimpleSessionData {
  terminalCount: number;
  activeTerminalId: string;
  timestamp: number;
}
```

## 成功基準

- [ ] VS Code再起動時に前回のターミナル数が復元される
- [ ] アクティブターミナルが正しく復元される
- [ ] セッション継続メッセージが表示される
- [ ] 復元エラーが発生しない（100%成功率）
- [ ] 復元処理が1秒以内に完了

## 参考

この変更により、VS Code標準ターミナルでも行われていない「完全復元」を諦め、ユーザーにとって価値のある「確実なセッション継続」を提供する。

---

**Priority**: High  
**Effort**: Medium (2-3日の開発期間)  
**Impact**: High user satisfaction improvement

**関連ファイル**:
- `src/webview/managers/StandardTerminalPersistenceManager.ts`
- `src/webview/managers/RefactoredTerminalWebviewManager.ts`
- `src/sessions/StandardTerminalSessionManager.ts`
- `src/providers/SecondaryTerminalProvider.ts`