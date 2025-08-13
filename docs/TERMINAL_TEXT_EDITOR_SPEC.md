# Terminal Text Editor Feature Specification

## 概要

ターミナルヘッダにテキストエディタボタンを追加し、ポップアップエディタでテキストの編集・保存・履歴管理ができる機能を実装する。

## 主要機能

### 1. ポップアップテキストエディタ

#### 基本仕様
- **トリガー**: ターミナルヘッダの「📝」ボタンクリック
- **表示形式**: モーダルダイアログ
- **エディタ機能**:
  - マルチライン対応テキストエリア
  - シンタックスハイライト（オプション）
  - 自動保存（5秒間隔）
  - キーボードショートカット対応

#### UI/UX仕様
```
┌─ Terminal Text Editor ─────────────────────┐
│ History | New Text                          │
├───────────────────────────────────────────┤
│                                           │
│  [Text Editor Area]                       │
│                                           │
│                                           │
├───────────────────────────────────────────┤
│ [Cancel] [Save to History] [Send to Term] │
└───────────────────────────────────────────┘
```

#### 操作フロー
1. 「📝」ボタンクリック → モーダル表示
2. テキスト入力・編集
3. 操作選択:
   - **Send to Terminal**: ターミナルに即座に送信
   - **Save to History**: 履歴に保存のみ
   - **Cancel**: 破棄して閉じる

### 2. テキスト履歴管理

#### データ構造
```typescript
interface TextHistoryItem {
  id: string;           // UUID
  title: string;        // 最初の行または手動設定
  content: string;      // テキスト内容
  createdAt: Date;      // 作成日時
  updatedAt: Date;      // 最終更新日時
  tags: string[];       // タグ（将来拡張）
  favorite: boolean;    // お気に入りフラグ
}

interface TextHistoryStorage {
  items: TextHistoryItem[];
  maxItems: number;     // 最大保存件数（デフォルト: 50）
}
```

#### 履歴管理機能
- **一覧表示**: タイトル、作成日時、プレビュー（50文字）
- **検索・フィルタ**: タイトル・内容での検索
- **並び替え**: 作成日時、更新日時、タイトル順
- **CRUD操作**:
  - 新規作成（エディタから保存）
  - 読み込み（履歴アイテムクリック）
  - 更新（既存アイテムの再編集）
  - 削除（個別・一括削除）

### 3. データ永続化

#### 保存先: VS Code Extension GlobalState
- **保存キー**: `sidebarTerminal.textHistory`
- **容量制限**: 10MB（VS Code制限内）
- **データ圧縮**: LZ4アルゴリズム使用（大きなテキスト対応）

#### データ管理
```typescript
class TextHistoryManager {
  // Extension側（Node.js環境）
  async saveHistory(item: TextHistoryItem): Promise<void>
  async loadHistory(): Promise<TextHistoryItem[]>
  async deleteHistory(id: string): Promise<void>
  async searchHistory(query: string): Promise<TextHistoryItem[]>
}
```

## 技術仕様

### 1. アーキテクチャ設計

#### Extension側（Node.js）
```
src/managers/TextHistoryManager.ts
├── データ永続化（GlobalState）
├── 履歴CRUD操作
├── 検索・フィルタリング
└── WebViewとの通信
```

#### WebView側（Browser）
```
src/webview/components/TextEditorModal.ts
├── モーダルUI管理
├── エディタ機能
├── 履歴表示UI
└── Extension通信
```

#### 通信プロトコル
```typescript
// Extension → WebView
interface TextHistoryResponse {
  command: 'textHistoryResponse';
  histories: TextHistoryItem[];
}

// WebView → Extension  
interface TextHistoryRequest {
  command: 'textHistoryRequest';
  action: 'load' | 'save' | 'delete' | 'search';
  data?: any;
}
```

### 2. ファイル構成

#### 新規作成ファイル
- `src/managers/TextHistoryManager.ts` - Extension側履歴管理
- `src/webview/components/TextEditorModal.ts` - WebViewモーダル
- `src/webview/managers/TextHistoryManager.ts` - WebView側履歴管理

#### 変更対象ファイル
- `src/webview/factories/TerminalHeaderFactory.ts` - ボタン追加
- `src/webview/managers/MessageManager.ts` - 通信プロトコル拡張
- `src/providers/SecandarySidebar.ts` - Extension側メッセージ処理
- `src/types/common.ts` - 型定義追加

### 3. UI/UX設計

#### ヘッダボタン統合
```typescript
// TerminalHeaderFactory.ts
const textEditorButton = this.createIconButton({
  id: `text-editor-${terminalId}`,
  iconClass: 'codicon-edit',
  title: 'Open Text Editor',
  ariaLabel: 'Open text editor for terminal input',
  onClick: () => this.openTextEditor(terminalId)
});
```

#### VS Code標準テーマ準拠
- **色**: VS Code標準カラーパレット使用
- **アイコン**: CodeIcon準拠
- **フォント**: VS Codeエディタフォント使用
- **サイズ**: レスポンシブ対応

### 4. パフォーマンス設計

#### メモリ管理
- 履歴データの遅延ロード（仮想スクロール）
- 大きなテキストの差分更新
- 不要なデータの自動削除（50件上限）

#### 通信最適化
- バッチ処理による通信回数削減
- JSON圧縮（gzip）
- 非同期処理によるUI応答性確保

## 実装計画

### Phase 1: 基本エディタ機能（1週間）
- [ ] ヘッダボタン追加
- [ ] モーダルUI実装
- [ ] テキストエディタ基本機能
- [ ] ターミナル送信機能

### Phase 2: 履歴管理機能（1週間）
- [ ] Extension側TextHistoryManager実装
- [ ] GlobalState永続化
- [ ] WebView側履歴UI
- [ ] 基本CRUD操作

### Phase 3: UX向上・最適化（1週間）
- [ ] 検索・フィルタ機能
- [ ] キーボードショートカット
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング強化

### Phase 4: テスト・リファインメント（1週間）
- [ ] ユニットテスト実装（TDD準拠）
- [ ] 統合テスト
- [ ] E2Eテスト
- [ ] UI/UX改善

## 品質保証

### テスト戦略
- **ユニットテスト**: 各コンポーネント単体テスト
- **統合テスト**: Extension-WebView通信テスト
- **E2Eテスト**: ユーザーワークフローテスト
- **パフォーマンステスト**: 大量データ処理テスト

### TDD準拠
- Red-Green-Refactorサイクル厳守
- テスト先行開発
- 95%以上のテストカバレッジ目標

## 非機能要件

### セキュリティ
- テキストデータのサニタイゼーション
- XSS攻撃対策
- ファイルサイズ制限

### 互換性
- VS Code 1.60以降対応
- Windows/macOS/Linux対応
- 既存機能との非干渉

### パフォーマンス
- モーダル表示: 100ms以内
- 履歴ロード: 200ms以内
- テキスト送信: 50ms以内

## 設定オプション

```json
{
  "sidebarTerminal.textEditor": {
    "enabled": true,
    "maxHistoryItems": 50,
    "autoSaveInterval": 5000,
    "enableSyntaxHighlight": false,
    "defaultEditorHeight": 300,
    "showLineNumbers": true
  }
}
```

## リスク分析

### 高リスク
- **メモリ使用量**: 大量のテキスト履歴による影響
- **既存機能への影響**: ヘッダUIの変更による副作用

### 中リスク  
- **パフォーマンス**: 大きなテキストの処理遅延
- **UI/UX**: モーダルとターミナル操作の競合

### 低リスク
- **データ永続化**: GlobalStateの安定性
- **プラットフォーム互換**: VS Code標準API使用

## 成功基準

### 定量基準
- [ ] テストカバレッジ: 95%以上
- [ ] パフォーマンス: 上記要件クリア
- [ ] メモリ使用量: +10MB以内

### 定性基準
- [ ] ユーザビリティ: 直感的な操作性
- [ ] デザイン: VS Code標準との一貫性
- [ ] 安定性: 既存機能への影響なし

---

本仕様書は実装進行に伴い継続的に更新します。