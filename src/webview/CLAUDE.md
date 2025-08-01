# WebView CLAUDE.md - 実装効率化ガイド

このファイルは WebView コンポーネントの効率的な実装をサポートします。

## 最重要アーキテクチャ

### TerminalWebviewManager (main.ts)
**メインコーディネーター** - 全WebViewマネージャーを統括
- `IManagerCoordinator`インターフェース実装
- 全マネージャーのライフサイクル管理
- Extension ↔ WebView 通信の中央ハブ

### Manager階層構造
```
TerminalWebviewManager
├── MessageManager - Extension通信
├── UIManager - UI制御・テーマ・視覚フィードバック  
├── InputManager - キーボードショートカット・IME・Alt+Click
├── PerformanceManager - 出力バッファリング・デバウンス
├── NotificationManager - ユーザーフィードバック・通知
├── SplitManager - ターミナル分割・レイアウト
└── ConfigManager - 設定永続化・構成管理
```

## 実装効率化テンプレート

### 新マネージャー作成時
```typescript
// 1. interfaces/ManagerInterfaces.ts にインターフェース定義
export interface INewManager extends IManagerLifecycle {
    // メソッド定義
}

// 2. managers/NewManager.ts に実装
export class NewManager implements INewManager {
    constructor(private coordinator: IManagerCoordinator) {}
    
    initialize(): void {}
    dispose(): void {}
}

// 3. main.ts のTerminalWebviewManagerに統合
private newManager: INewManager;
this.newManager = new NewManager(this);
```

### イベント処理パターン
```typescript
// Extension → WebView メッセージ処理
handleMessage(message: VsCodeMessage): void {
    switch (message.command) {
        case 'newCommand':
            this.handleNewCommand(message);
            break;
    }
}

// WebView → Extension メッセージ送信
this.coordinator.postMessage({
    command: 'newCommand',
    data: payload
});
```

### パフォーマンス最適化
```typescript
// 高頻度出力のバッファリング
this.performanceManager.bufferOutput(terminalId, data);

// デバウンス処理
this.performanceManager.debounce('resize', () => {
    // リサイズ処理
}, 100);
```

## よく使う操作

### ターミナル操作
```typescript
// アクティブターミナル取得
const activeTerminal = this.coordinator.getActiveTerminal();

// ターミナル作成
this.coordinator.createTerminal();

// ターミナル削除
this.coordinator.deleteTerminal(terminalId);
```

### 通知表示
```typescript
// 成功通知
this.notificationManager.showSuccess('操作完了');

// エラー通知  
this.notificationManager.showError('エラーメッセージ');

// 進行状況
this.notificationManager.showProgress('処理中...');
```

### テーマ・UI操作
```typescript
// テーマ適用
this.uiManager.applyTheme(themeName);

// ボーダー制御
this.uiManager.updateBorder(terminalId, visible);

// アイコン更新
this.uiManager.updateIcon(terminalId, iconClass);
```

## デバッグ・トラブルシューティング

### よくある問題
1. **メッセージが届かない** → `MessageManager.queueMessage()`確認
2. **メモリリーク** → `dispose()`メソッド実装確認
3. **パフォーマンス低下** → `PerformanceManager`バッファリング確認

### ログ出力
```typescript
// WebView専用ログ
console.log('[WebView]', message);

// Extension側への通知
this.coordinator.postMessage({
    command: 'log',
    level: 'error',
    message: 'エラー詳細'
});
```

## テスト戦略

### テストファイル配置
- 単体テスト: `src/test/unit/webview/[component].test.ts`
- 統合テスト: `src/test/unit/webview/main.test.ts`

### モックパターン
```typescript
// WebView環境モック
const mockCoordinator: IManagerCoordinator = {
    postMessage: sinon.stub(),
    getActiveTerminal: sinon.stub(),
    // ...
};
```

## 実装チェックリスト

### 新機能実装時
- [ ] インターフェース定義 (ManagerInterfaces.ts)
- [ ] 実装クラス作成 (managers/xxx.ts)
- [ ] TerminalWebviewManagerに統合
- [ ] dispose()メソッド実装
- [ ] テストケース作成
- [ ] TypeScript型安全性確認

### リファクタリング時
- [ ] 既存インターフェース維持
- [ ] メッセージプロトコル互換性確認
- [ ] パフォーマンス劣化確認
- [ ] メモリリーク確認
- [ ] 全テスト通過確認

このガイドに従えば、WebViewコンポーネントの効率的な実装が可能です。