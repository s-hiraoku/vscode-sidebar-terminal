# 統合テストパターン

統合テストは複数のコンポーネントが連携して動作することを検証します。このガイドでは、VS Code Sidebar Terminal拡張機能で使用する統合テストパターンを説明します。

## 目次

- [統合テストとは](#統合テストとは)
- [メッセージングテスト](#メッセージングテスト)
- [セッション管理テスト](#セッション管理テスト)
- [ターミナルライフサイクルテスト](#ターミナルライフサイクルテスト)
- [ストレージ統合テスト](#ストレージ統合テスト)
- [イベントフローテスト](#イベントフローテスト)

---

## 統合テストとは

### ユニットテストとの違い

| 観点 | ユニットテスト | 統合テスト |
|------|---------------|-----------|
| スコープ | 単一クラス/関数 | 複数コンポーネント |
| 依存関係 | すべてモック | 一部は実装を使用 |
| 実行速度 | 高速（ms単位） | 中速（秒単位） |
| 目的 | ロジックの正確性 | 連携の正確性 |

### 統合テストの範囲

```typescript
// 統合テストでテストする範囲の例
//
// [Webview] <--メッセージ--> [MessageHandler] <--イベント--> [TerminalManager] <--pty--> [Terminal]
//                                   ↓
//                            [SessionManager]
//                                   ↓
//                            [StorageService]
```

---

## メッセージングテスト

### Webview ⇔ Extension 間の通信テスト

```typescript
// src/test/integration/messaging/WebviewMessaging.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MessageHandler } from '../../../messaging/MessageHandler';
import { TerminalManager } from '../../../terminal/TerminalManager';

describe('Integration: Webview Messaging', () => {
  // Vitest mocks
  let messageHandler: MessageHandler;
  let terminalManager: TerminalManager;
  let mockWebview: any;

  beforeEach(() => {
    // Vitest handles mock lifecycle

    // Webviewのモック
    mockWebview = {
      postMessage: vi.spyOn().resolves(true),
      onDidReceiveMessage: vi.spyOn()
    };

    // 実際のTerminalManagerを使用（モックではなく）
    terminalManager = new TerminalManager();

    // MessageHandlerで連携
    messageHandler = new MessageHandler(mockWebview, terminalManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    terminalManager.dispose();
  });

  describe('Terminal Creation Flow', () => {
    it('should create terminal and notify webview', async () => {
      // Given: Webviewからターミナル作成リクエスト
      const createMessage = {
        command: 'createTerminal',
        options: { shell: '/bin/bash' }
      };

      // When: メッセージを処理
      await messageHandler.handleMessage(createMessage);

      // Then: ターミナルが作成される
      const terminals = terminalManager.getAllTerminals();
      expect(terminals).to.have.length(1);
      expect(terminals[0].shell).to.equal('/bin/bash');

      // And: Webviewに通知が送られる
      expect(mockWebview.postMessage).to.have.been.calledWith(
        expect.objectContaining({
          command: 'terminalCreated',
          terminal: expect.any(Object)
        })
      );
    });

    it('should handle creation errors and notify webview', async () => {
      // Given: 無効な設定でターミナル作成
      const invalidMessage = {
        command: 'createTerminal',
        options: { shell: null }
      };

      // When: メッセージを処理
      await messageHandler.handleMessage(invalidMessage);

      // Then: エラー通知が送られる
      expect(mockWebview.postMessage).to.have.been.calledWith(
        expect.objectContaining({
          command: 'error',
          message: expect.any(String)
        })
      );
    });
  });

  describe('Data Flow', () => {
    it('should forward terminal data to webview', async () => {
      // Given: ターミナルが作成されている
      const terminal = await terminalManager.createTerminal();

      // When: ターミナルにデータが書き込まれる
      terminal.write('test output\n');

      // Then: Webviewにデータが転送される
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockWebview.postMessage).to.have.been.calledWith(
        expect.objectContaining({
          command: 'data',
          terminalId: terminal.id,
          data: 'test output\n'
        })
      );
    });
  });
});
```

---

## セッション管理テスト

### セッション保存・復元フロー

```typescript
// src/test/integration/sessions/SessionPersistence.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SessionManager } from '../../../sessions/SessionManager';
import { TerminalManager } from '../../../terminal/TerminalManager';
import { StorageService } from '../../../services/StorageService';

describe('Integration: Session Persistence', () => {
  // Vitest mocks
  let sessionManager: SessionManager;
  let terminalManager: TerminalManager;
  let storageService: StorageService;
  let mockGlobalState: any;

  beforeEach(() => {
    // Vitest handles mock lifecycle

    // モックストレージ
    mockGlobalState = new Map();
    const mockStorage = {
      get: (key: string) => mockGlobalState.get(key),
      update: async (key: string, value: any) => {
        mockGlobalState.set(key, value);
      }
    };

    // 実際のサービスを使用して連携をテスト
    storageService = new StorageService(mockStorage);
    terminalManager = new TerminalManager();
    sessionManager = new SessionManager(terminalManager, storageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    terminalManager.dispose();
  });

  describe('Complete Session Lifecycle', () => {
    it('should save and restore terminal session', async () => {
      // Given: 複数のターミナルを作成
      const terminal1 = await terminalManager.createTerminal({
        name: 'Terminal 1',
        cwd: '/home/user/project1'
      });
      const terminal2 = await terminalManager.createTerminal({
        name: 'Terminal 2',
        cwd: '/home/user/project2'
      });

      // ターミナルにデータを書き込み
      terminal1.write('echo "test1"\n');
      terminal2.write('echo "test2"\n');

      // When: セッションを保存
      await sessionManager.saveSession();

      // 全ターミナルを破棄（再起動をシミュレート）
      terminalManager.dispose();

      // Then: 保存されたデータを確認
      const savedData = mockGlobalState.get('terminalSession');
      expect(savedData).to.exist;
      expect(savedData.terminals).to.have.length(2);
      expect(savedData.terminals[0].name).to.equal('Terminal 1');
      expect(savedData.terminals[1].name).to.equal('Terminal 2');

      // When: 新しいマネージャーでセッションを復元
      const newTerminalManager = new TerminalManager();
      const newSessionManager = new SessionManager(
        newTerminalManager,
        storageService
      );

      await newSessionManager.restoreSession();

      // Then: ターミナルが復元される
      const restoredTerminals = newTerminalManager.getAllTerminals();
      expect(restoredTerminals).to.have.length(2);
      expect(restoredTerminals[0].name).to.equal('Terminal 1');
      expect(restoredTerminals[0].cwd).to.equal('/home/user/project1');
      expect(restoredTerminals[1].name).to.equal('Terminal 2');
      expect(restoredTerminals[1].cwd).to.equal('/home/user/project2');

      // Cleanup
      newTerminalManager.dispose();
    });

    it('should handle partial session data gracefully', async () => {
      // Given: 不完全なセッションデータ
      await storageService.update('terminalSession', {
        terminals: [
          { id: 1, name: 'Valid' },
          { id: 2 }, // 名前なし
          null,      // 無効なデータ
        ]
      });

      // When: セッション復元を試みる
      await sessionManager.restoreSession();

      // Then: 有効なターミナルのみ復元される
      const terminals = terminalManager.getAllTerminals();
      expect(terminals.length).to.be.at.least(1);
      expect(terminals[0].name).to.equal('Valid');
    });
  });

  describe('Auto-save Integration', () => {
    it('should auto-save on terminal changes', async function() {
      this.timeout(3000);

      // Given: オートセーブが有効
      sessionManager.enableAutoSave(500); // 500ms間隔

      // When: ターミナルを作成
      await terminalManager.createTerminal({ name: 'Auto-saved' });

      // Then: 自動的に保存される
      await new Promise(resolve => setTimeout(resolve, 600));

      const savedData = mockGlobalState.get('terminalSession');
      expect(savedData).to.exist;
      expect(savedData.terminals).to.have.length(1);

      sessionManager.disableAutoSave();
    });
  });
});
```

---

## ターミナルライフサイクルテスト

### 作成・削除・切り替えフロー

```typescript
// src/test/integration/terminal/TerminalLifecycle.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TerminalManager } from '../../../terminal/TerminalManager';
import { ViewManager } from '../../../views/ViewManager';

describe('Integration: Terminal Lifecycle', () => {
  // Vitest mocks
  let terminalManager: TerminalManager;
  let viewManager: ViewManager;
  let mockWebview: any;

  beforeEach(() => {
    // Vitest handles mock lifecycle

    mockWebview = {
      postMessage: vi.spyOn().resolves(true)
    };

    terminalManager = new TerminalManager();
    viewManager = new ViewManager(mockWebview, terminalManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    terminalManager.dispose();
  });

  describe('Terminal Creation and Switching', () => {
    it('should create multiple terminals and switch between them', async () => {
      // Given: 初期状態（ターミナルなし）
      expect(terminalManager.getAllTerminals()).to.have.length(0);

      // When: 最初のターミナルを作成
      const terminal1 = await viewManager.createTerminal();

      // Then: アクティブになる
      expect(terminalManager.getActiveTerminal()?.id).to.equal(terminal1.id);
      expect(mockWebview.postMessage).to.have.been.calledWith(
        expect.objectContaining({ command: 'setActiveTerminal', terminalId: terminal1.id })
      );

      // When: 2つ目のターミナルを作成
      const terminal2 = await viewManager.createTerminal();

      // Then: 新しいターミナルがアクティブになる
      expect(terminalManager.getActiveTerminal()?.id).to.equal(terminal2.id);
      expect(terminalManager.getAllTerminals()).to.have.length(2);

      // When: 最初のターミナルに切り替え
      await viewManager.switchToTerminal(terminal1.id);

      // Then: アクティブターミナルが変更される
      expect(terminalManager.getActiveTerminal()?.id).to.equal(terminal1.id);
    });
  });

  describe('Terminal Deletion Flow', () => {
    it('should delete terminal and switch to another', async () => {
      // Given: 3つのターミナル
      const terminal1 = await viewManager.createTerminal();
      const terminal2 = await viewManager.createTerminal();
      const terminal3 = await viewManager.createTerminal();

      // terminal2がアクティブ
      await viewManager.switchToTerminal(terminal2.id);
      expect(terminalManager.getActiveTerminal()?.id).to.equal(terminal2.id);

      // When: アクティブなターミナルを削除
      await viewManager.deleteTerminal(terminal2.id);

      // Then: 別のターミナルがアクティブになる
      const activeId = terminalManager.getActiveTerminal()?.id;
      expect(activeId).to.be.oneOf([terminal1.id, terminal3.id]);
      expect(terminalManager.getAllTerminals()).to.have.length(2);
    });

    it('should prevent deletion of last terminal', async () => {
      // Given: 1つのターミナル
      const terminal = await viewManager.createTerminal();

      // When: 最後のターミナルを削除しようとする
      const deletePromise = viewManager.deleteTerminal(terminal.id);

      // Then: エラーが発生する
      await expect(deletePromise).to.be.rejectedWith('Cannot delete last terminal');
      expect(terminalManager.getAllTerminals()).to.have.length(1);
    });
  });
});
```

---

## ストレージ統合テスト

### グローバルステートとの統合

```typescript
// src/test/integration/storage/GlobalStateIntegration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SettingsManager } from '../../../settings/SettingsManager';
import { StorageService } from '../../../services/StorageService';

describe('Integration: Global State Storage', () => {
  // Vitest mocks
  let settingsManager: SettingsManager;
  let storageService: StorageService;
  let mockGlobalState: Map<string, any>;

  beforeEach(() => {
    // Vitest handles mock lifecycle

    // 実際のMapでストレージをシミュレート
    mockGlobalState = new Map();

    const mockStorage = {
      get: <T>(key: string): T | undefined => mockGlobalState.get(key),
      update: async (key: string, value: any): Promise<void> => {
        mockGlobalState.set(key, value);
      },
      keys: (): readonly string[] => Array.from(mockGlobalState.keys())
    };

    storageService = new StorageService(mockStorage as any);
    settingsManager = new SettingsManager(storageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Settings Persistence', () => {
    it('should save and load user preferences', async () => {
      // Given: ユーザー設定
      const preferences = {
        theme: 'dark',
        fontSize: 14,
        shell: '/bin/zsh'
      };

      // When: 設定を保存
      await settingsManager.savePreferences(preferences);

      // Then: ストレージに保存される
      expect(mockGlobalState.has('userPreferences')).to.be.true;

      // When: 新しいインスタンスで読み込み
      const newSettingsManager = new SettingsManager(storageService);
      const loaded = await newSettingsManager.loadPreferences();

      // Then: 設定が復元される
      expect(loaded).to.deep.equal(preferences);
    });

    it('should merge with default settings', async () => {
      // Given: 部分的な設定のみ保存
      await settingsManager.savePreferences({ theme: 'light' });

      // When: 設定を読み込み
      const loaded = await settingsManager.loadPreferences();

      // Then: デフォルト値とマージされる
      expect(loaded.theme).to.equal('light');
      expect(loaded.fontSize).to.equal(14); // デフォルト値
      expect(loaded.shell).to.be.a('string'); // デフォルト値
    });
  });
});
```

---

## イベントフローテスト

### イベントチェーンの検証

```typescript
// src/test/integration/events/EventFlow.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TerminalManager } from '../../../terminal/TerminalManager';
import { EventBus } from '../../../events/EventBus';
import { Logger } from '../../../utils/Logger';

describe('Integration: Event Flow', () => {
  // Vitest mocks
  let terminalManager: TerminalManager;
  let eventBus: EventBus;
  let logger: Logger;
  let eventLog: any[];

  beforeEach(() => {
    // Vitest handles mock lifecycle
    eventLog = [];

    eventBus = new EventBus();
    logger = new Logger(eventBus);
    terminalManager = new TerminalManager(eventBus);

    // イベントログを記録
    eventBus.on('*', (event) => {
      eventLog.push(event);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    terminalManager.dispose();
  });

  describe('Terminal Event Propagation', () => {
    it('should propagate events through the system', async () => {
      // When: ターミナルを作成
      const terminal = await terminalManager.createTerminal();

      // Then: イベントが発火される
      expect(eventLog).to.have.length.at.least(1);
      expect(eventLog[0].type).to.equal('terminalCreated');

      // When: データを書き込み
      eventLog.length = 0; // ログをクリア
      terminal.write('test\n');

      // Then: データイベントが発火
      await new Promise(resolve => setTimeout(resolve, 50));
      const dataEvents = eventLog.filter(e => e.type === 'terminalData');
      expect(dataEvents).to.have.length.at.least(1);
    });

    it('should handle event chain correctly', async () => {
      // Given: イベントリスナーのチェーン
      const events: string[] = [];

      eventBus.on('terminalCreated', () => {
        events.push('created');
        eventBus.emit({ type: 'terminalReady' });
      });

      eventBus.on('terminalReady', () => {
        events.push('ready');
        eventBus.emit({ type: 'terminalActivated' });
      });

      eventBus.on('terminalActivated', () => {
        events.push('activated');
      });

      // When: ターミナルを作成
      await terminalManager.createTerminal();

      // Then: イベントチェーンが正しく実行される
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(events).to.deep.equal(['created', 'ready', 'activated']);
    });
  });
});
```

---

## タイムアウト設定

統合テストは複数のコンポーネントが連携するため、ユニットテストより時間がかかります。

```typescript
describe('Integration Tests', function() {
  // テストスイート全体のタイムアウトを延長
  this.timeout(10000); // 10秒

  it('should complete complex operation', async function() {
    // 個別のテストでさらに延長も可能
    this.timeout(15000); // 15秒

    await complexIntegrationOperation();
  });
});
```

---

## ベストプラクティス

### ✅ Do

- 実際のコンポーネントを可能な限り使用
- 重要な統合ポイントをテスト
- エンドツーエンドのフローを検証
- エラーパスもテスト
- 適切なタイムアウトを設定

### ❌ Don't

- すべてをモックしない（それはユニットテスト）
- 外部サービスに依存しない
- 長時間実行するテストを作らない
- テスト間で状態を共有しない
- クリーンアップを忘れない

---

## テスト実行

```bash
# 統合テストのみ実行
npm run test:integration

# 並列実行（高速化）
npm run test:integration:parallel

# 特定のテストファイルのみ
npx vitest run src/test/vitest/unit/messaging
```

---

## 参考

- [ユニットテストパターン](./unit-testing.md)
- [E2Eテストパターン](./e2e-testing.md)
- [ベストプラクティス](../best-practices.md)

---

**最終更新**: 2025-11-08
