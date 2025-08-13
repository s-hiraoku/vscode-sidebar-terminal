# Terminal Text Editor - API Design & Message Protocol

## アーキテクチャ概要

```
┌─────────────────┐       Message Protocol       ┌──────────────────┐
│   Extension     │ ←─────────────────────────→ │     WebView      │
│   (Node.js)     │                              │   (Browser)      │
│                 │                              │                  │
│ TextHistoryMgr  │                              │ TextEditorModal  │
│     ↓           │                              │        ↓         │
│ GlobalState     │                              │  UI Components   │
└─────────────────┘                              └──────────────────┘
```

## Extension側API設計

### 1. TextHistoryManager

#### クラス定義
```typescript
export class TextHistoryManager {
  constructor(private context: vscode.ExtensionContext) {}

  // 履歴の保存
  async saveHistory(item: TextHistoryItem): Promise<OperationResult<string>>
  
  // 履歴の読み込み（ページネーション対応）
  async loadHistory(options?: LoadHistoryOptions): Promise<OperationResult<TextHistoryItem[]>>
  
  // 履歴の更新
  async updateHistory(id: string, updates: Partial<TextHistoryItem>): Promise<OperationResult<void>>
  
  // 履歴の削除
  async deleteHistory(id: string): Promise<OperationResult<void>>
  
  // 履歴の検索
  async searchHistory(query: SearchQuery): Promise<OperationResult<TextHistoryItem[]>>
  
  // 履歴の統計取得
  async getHistoryStats(): Promise<OperationResult<HistoryStats>>
  
  // データの圧縮・展開
  private compressData(data: string): Promise<Buffer>
  private decompressData(buffer: Buffer): Promise<string>
}
```

#### データ型定義
```typescript
interface TextHistoryItem {
  id: string;                    // UUID v4
  title: string;                 // タイトル（最大100文字）
  content: string;               // テキスト内容
  createdAt: Date;               // 作成日時
  updatedAt: Date;               // 最終更新日時
  tags: string[];                // タグ配列
  favorite: boolean;             // お気に入りフラグ
  size: number;                  // バイトサイズ
  contentHash: string;           // SHA-256ハッシュ（重複検出用）
}

interface LoadHistoryOptions {
  offset?: number;               // オフセット（デフォルト: 0）
  limit?: number;                // 取得件数（デフォルト: 20）
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  includeContent?: boolean;      // 内容も含めるか（デフォルト: false）
}

interface SearchQuery {
  text?: string;                 // テキスト検索
  tags?: string[];               // タグフィルタ
  dateFrom?: Date;               // 日付範囲（開始）
  dateTo?: Date;                 // 日付範囲（終了）
  favoriteOnly?: boolean;        // お気に入りのみ
}

interface HistoryStats {
  totalItems: number;            // 総アイテム数
  totalSize: number;             // 総サイズ（バイト）
  oldestItem: Date;              // 最古アイテムの日付
  newestItem: Date;              // 最新アイテムの日付
  favoriteCount: number;         // お気に入り数
}

interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}
```

### 2. Extension側メッセージハンドリング

#### SecondaryTerminalProvider拡張
```typescript
class SecondaryTerminalProvider implements vscode.WebviewViewProvider {
  private textHistoryManager: TextHistoryManager;

  async resolveWebviewView(webviewView: vscode.WebviewView) {
    // 既存実装 + テキストエディタメッセージハンドリング
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'textHistoryRequest':
          await this.handleTextHistoryRequest(message);
          break;
        case 'textEditorSend':
          await this.handleTextEditorSend(message);
          break;
        // 既存メッセージハンドリング...
      }
    });
  }

  private async handleTextHistoryRequest(message: TextHistoryRequestMessage) {
    const { action, data, requestId } = message;
    let result: OperationResult<any>;

    switch (action) {
      case 'load':
        result = await this.textHistoryManager.loadHistory(data);
        break;
      case 'save':
        result = await this.textHistoryManager.saveHistory(data);
        break;
      case 'update':
        result = await this.textHistoryManager.updateHistory(data.id, data.updates);
        break;
      case 'delete':
        result = await this.textHistoryManager.deleteHistory(data.id);
        break;
      case 'search':
        result = await this.textHistoryManager.searchHistory(data);
        break;
      case 'stats':
        result = await this.textHistoryManager.getHistoryStats();
        break;
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    // WebViewに結果を送信
    this.postMessage({
      command: 'textHistoryResponse',
      requestId,
      result
    });
  }

  private async handleTextEditorSend(message: TextEditorSendMessage) {
    const { terminalId, content } = message;
    
    // ターミナルにテキストを送信（既存ロジック活用）
    await this.terminalManager.sendInput(terminalId, content);
    
    this.postMessage({
      command: 'textEditorSendResponse',
      success: true
    });
  }
}
```

## WebView側API設計

### 1. TextEditorModal コンポーネント

```typescript
export class TextEditorModal {
  private element: HTMLElement;
  private editor: TextEditor;
  private historyManager: TextHistoryWebViewManager;
  private messageManager: IMessageManager;

  constructor(messageManager: IMessageManager) {
    this.messageManager = messageManager;
    this.historyManager = new TextHistoryWebViewManager(messageManager);
    this.setupModal();
    this.setupEditor();
    this.setupEventListeners();
  }

  // モーダル表示
  show(terminalId: string, initialContent?: string): void

  // モーダル非表示
  hide(): void

  // テキストエディタの内容取得
  getContent(): string

  // テキストエディタの内容設定
  setContent(content: string): void

  // 履歴から内容をロード
  loadFromHistory(historyId: string): Promise<void>

  // テキストをターミナルに送信
  private async sendToTerminal(): Promise<void>

  // 履歴に保存
  private async saveToHistory(): Promise<void>
}
```

### 2. TextHistoryWebViewManager

```typescript
export class TextHistoryWebViewManager {
  private messageManager: IMessageManager;
  private cache: Map<string, TextHistoryItem> = new Map();

  constructor(messageManager: IMessageManager) {
    this.messageManager = messageManager;
  }

  // 履歴読み込み（キャッシュ対応）
  async loadHistory(options?: LoadHistoryOptions): Promise<TextHistoryItem[]>

  // 履歴保存
  async saveHistory(item: Omit<TextHistoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>

  // 履歴更新
  async updateHistory(id: string, updates: Partial<TextHistoryItem>): Promise<void>

  // 履歴削除
  async deleteHistory(id: string): Promise<void>

  // 履歴検索
  async searchHistory(query: SearchQuery): Promise<TextHistoryItem[]>

  // 統計取得
  async getStats(): Promise<HistoryStats>

  // 非同期リクエスト管理
  private async sendRequest<T>(action: string, data?: any): Promise<T>
}
```

## メッセージプロトコル仕様

### 1. Extension → WebView メッセージ

#### 履歴レスポンス
```typescript
interface TextHistoryResponseMessage extends WebViewMessage {
  command: 'textHistoryResponse';
  requestId: string;
  result: OperationResult<any>;
}
```

#### テキスト送信レスポンス
```typescript
interface TextEditorSendResponseMessage extends WebViewMessage {
  command: 'textEditorSendResponse';
  success: boolean;
  error?: string;
}
```

#### 設定更新通知
```typescript
interface TextEditorConfigUpdateMessage extends WebViewMessage {
  command: 'textEditorConfigUpdate';
  config: TextEditorConfig;
}
```

### 2. WebView → Extension メッセージ

#### 履歴リクエスト
```typescript
interface TextHistoryRequestMessage extends WebViewMessage {
  command: 'textHistoryRequest';
  requestId: string;
  action: 'load' | 'save' | 'update' | 'delete' | 'search' | 'stats';
  data?: any;
}

// アクション別データ型
interface LoadHistoryData extends LoadHistoryOptions {}

interface SaveHistoryData {
  title: string;
  content: string;
  tags?: string[];
  favorite?: boolean;
}

interface UpdateHistoryData {
  id: string;
  updates: Partial<TextHistoryItem>;
}

interface DeleteHistoryData {
  id: string;
}

interface SearchHistoryData extends SearchQuery {}
```

#### テキスト送信リクエスト
```typescript
interface TextEditorSendMessage extends WebViewMessage {
  command: 'textEditorSend';
  terminalId: string;
  content: string;
  saveToHistory?: boolean;
  historyTitle?: string;
}
```

#### 設定リクエスト
```typescript
interface TextEditorConfigRequestMessage extends WebViewMessage {
  command: 'textEditorConfigRequest';
}
```

### 3. エラーハンドリング

#### 共通エラーコード
```typescript
enum ErrorCode {
  // Storage関連
  STORAGE_FULL = 'STORAGE_FULL',
  STORAGE_CORRUPTED = 'STORAGE_CORRUPTED',
  STORAGE_ACCESS_DENIED = 'STORAGE_ACCESS_DENIED',
  
  // データ検証
  INVALID_DATA = 'INVALID_DATA',
  DATA_TOO_LARGE = 'DATA_TOO_LARGE',
  DUPLICATE_ITEM = 'DUPLICATE_ITEM',
  
  // 操作エラー
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  
  // システムエラー
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

interface ErrorInfo {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
}
```

### 4. リクエスト管理

#### 非同期リクエストトラッキング
```typescript
class RequestManager {
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  // リクエストID生成
  generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // リクエスト送信
  async sendRequest<T>(command: string, data?: any): Promise<T> {
    const requestId = this.generateRequestId();
    
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 10000); // 10秒タイムアウト

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      
      this.messageManager.sendMessage({
        command,
        requestId,
        data
      });
    });
  }

  // レスポンス受信処理
  handleResponse(requestId: string, result: OperationResult<any>) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    clearTimeout(request.timeout);
    this.pendingRequests.delete(requestId);

    if (result.success) {
      request.resolve(result.data);
    } else {
      request.reject(new Error(result.error || 'Unknown error'));
    }
  }
}
```

## データフロー詳細

### 1. 履歴保存フロー
```
WebView                 Extension               GlobalState
  │                        │                       │
  │ saveHistory(item)      │                       │
  ├──────────────────────→ │                       │
  │                        │ validate & compress   │
  │                        ├─────────────────────→ │
  │                        │                       │ store
  │                        │ ← success/error ───── │
  │ ← result ───────────── │                       │
```

### 2. 履歴検索フロー
```
WebView                 Extension               Cache/GlobalState
  │                        │                       │
  │ searchHistory(query)   │                       │
  ├──────────────────────→ │                       │
  │                        │ check cache           │
  │                        │ ├─────────────────────→
  │                        │ │ cache miss          │
  │                        │ ├─────────────────────→ GlobalState
  │                        │ │ search & filter     │
  │                        │ ← results ─────────── │
  │                        │ update cache          │
  │ ← filtered results ─── │                       │
```

### 3. テキスト送信フロー
```
WebView              Extension            TerminalManager
  │                     │                      │
  │ sendToTerminal()    │                      │
  ├───────────────────→ │                      │
  │                     │ route to terminal    │
  │                     ├────────────────────→ │
  │                     │                      │ send input
  │                     │ ← success/error ──── │
  │ ← response ──────── │                      │
```

## パフォーマンス最適化

### 1. データ圧縮戦略
- **LZ4圧縮**: 高速圧縮・展開
- **閾値ベース**: 1KB以上のテキストを圧縮
- **バッチ処理**: 複数アイテムの一括処理

### 2. キャッシュ戦略
- **LRUキャッシュ**: 最近使用した履歴を優先
- **部分ロード**: メタデータのみ先行取得
- **遅延展開**: 内容表示時に圧縮データを展開

### 3. リクエスト最適化
- **デバウンス**: 検索クエリの自動遅延（300ms）
- **バッチング**: 複数操作の一括送信
- **プリフェッチ**: 次ページの先読み

---

このAPI設計により、Extension-WebView間の安全で効率的な通信が実現できます。