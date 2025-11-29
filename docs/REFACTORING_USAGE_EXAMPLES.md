# Refactoring Usage Examples

この文書では、新しく作成されたリファクタリングツールの具体的な使用方法を示します。

## 📚 目次

1. [Enhanced Base Manager の使用方法](#enhanced-base-manager-の使用方法)
2. [Segregated Interfaces の活用](#segregated-interfaces-の活用)  
3. [Dependency Container の利用](#dependency-container-の利用)
4. [Enhanced Test Helper の使用](#enhanced-test-helper-の使用)
5. [段階的移行戦略](#段階的移行戦略)

## Enhanced Base Manager の使用方法

### 従来のマネージャークラス
```typescript
// Before: 繰り返されるボイラープレートコード
export class OldManager implements IManager {
  private isInitialized = false;
  private timers = new Map<string, NodeJS.Timeout>();
  private eventListeners: Array<{element: EventTarget, event: string, listener: EventListener}> = [];
  
  constructor() {
    // 初期化コード...
  }
  
  public initialize(coordinator: IManagerCoordinator): void {
    // 20-30行の初期化ロジック
    // ログ設定、エラーハンドリング設定など...
  }
  
  public dispose(): void {
    // 10-15行のクリーンアップコード
    // タイマー削除、イベントリスナー削除など...
  }
  
  private debounce(func: Function, delay: number): Function {
    // デバウンス実装...
  }
  
  // その他の共通メソッド...
}
```

### Enhanced Base Manager を使用したクラス
```typescript
// After: 大幅に簡素化されたコード
import { EnhancedBaseManager } from '../managers/EnhancedBaseManager';
import { ManagerDependencies } from '../interfaces/SegregatedManagerInterfaces';

export class NewManager extends EnhancedBaseManager implements INewManager {
  private dependentService?: IDependentService;
  
  constructor() {
    super('NewManager', {
      enableLogging: true,
      enablePerformanceMonitoring: true,
      enableErrorRecovery: true,
    });
  }
  
  // 必要に応じて具体的な初期化ロジックをオーバーライド
  protected async onInitialize(dependencies: ManagerDependencies): Promise<void> {
    this.dependentService = dependencies.terminalCoordinator;
    
    // 自動クリーンアップ付きイベントリスナー追加
    this.addEventListenerManaged(
      document, 
      'click', 
      this.handleClick.bind(this),
      false,
      'document-click'
    );
    
    this.log('NewManager initialized with enhanced features');
  }
  
  // ビジネスロジックに集中できる
  public doSomething(): void {
    // 自動パフォーマンス測定付きの安全な実行
    this.safeExecute(() => {
      // ビジネスロジック...
    }, 'default_value', 'doSomething operation');
  }
  
  // デバウンス機能を簡単に利用
  private debouncedUpdate = this.debounce(this.updateUI.bind(this), 300);
  
  private updateUI(): void {
    // UI更新ロジック...
  }
  
  private handleClick(): void {
    // クリックハンドリングロジック...
  }
}
```

**削減されたコード量: 約150-200行 → 50-80行 (60-70%の削減)**

## Segregated Interfaces の活用

### 従来の大きなインターフェース
```typescript
// Before: 25+メソッドの巨大なインターフェース
interface IManagerCoordinator {
  // ターミナル操作 (8メソッド)
  getActiveTerminalId(): string | null;
  setActiveTerminalId(terminalId: string): void;
  // ... その他のターミナルメソッド
  
  // 設定管理 (5メソッド)  
  applySettings(settings: unknown): void;
  // ... その他の設定メソッド
  
  // CLI Agent管理 (4メソッド)
  updateCliAgentStatus(...): void;
  // ... その他のCLI Agentメソッド
  
  // 通信管理 (3メソッド)
  postMessageToExtension(message: unknown): void;
  // ... その他の通信メソッド
  
  // セッション管理 (3メソッド)
  createTerminalFromSession(...): void;
  // ... その他のセッションメソッド
  
  // その他 (2メソッド)
  log(message: string): void;
  getManagers(): {...};
}
```

### 分離された専門的なインターフェース
```typescript
// After: 焦点を絞った小さなインターフェース
import { 
  ITerminalCoordinator,
  ISettingsCoordinator, 
  ICliAgentCoordinator,
  IExtensionCommunicator,
  ISessionCoordinator,
  ILoggingCoordinator
} from '../interfaces/SegregatedManagerInterfaces';

export class FocusedManager extends EnhancedBaseManager {
  private terminalCoordinator?: ITerminalCoordinator;
  private settingsCoordinator?: ISettingsCoordinator;
  
  protected async onInitialize(dependencies: ManagerDependencies): Promise<void> {
    // 必要な依存関係のみを取得
    this.terminalCoordinator = dependencies.terminalCoordinator;
    this.settingsCoordinator = dependencies.settingsCoordinator;
  }
  
  public manageTerminals(): void {
    // ターミナル操作のみに集中
    if (this.terminalCoordinator) {
      const activeId = this.terminalCoordinator.getActiveTerminalId();
      // ...
    }
  }
  
  public manageSettings(): void {
    // 設定管理のみに集中
    if (this.settingsCoordinator) {
      this.settingsCoordinator.applySettings({});
      // ...
    }
  }
}
```

**メリット:**
- ✅ テストが簡単（必要なメソッドのみをモック）
- ✅ 依存関係が明確
- ✅ インターフェース変更の影響範囲が限定的

## Dependency Container の利用

### 従来のハードコード依存関係
```typescript
// Before: 直接インスタンス化によるタイトカップリング
export class OldCoordinator {
  private managers: Map<string, any> = new Map();
  
  constructor() {
    // ハードコードされた依存関係
    this.managers.set('ui', new UIManager());
    this.managers.set('input', new InputManager());
    this.managers.set('performance', new PerformanceManager());
    this.managers.set('notification', new NotificationManager());
    
    // 循環依存の問題
    this.managers.get('ui').setCoordinator(this);
    this.managers.get('input').setCoordinator(this);
    // ...
  }
}
```

### Dependency Container を使用したアプローチ
```typescript
// After: 依存関係注入による疎結合
import { DependencyContainer, ServiceType } from '../core/DependencyContainer';

export class NewCoordinator {
  private container: DependencyContainer;
  
  constructor() {
    this.container = new DependencyContainer();
    this.setupServices();
  }
  
  private setupServices(): void {
    // サービス登録（依存関係を明示）
    this.container.register(
      ServiceType.UI_MANAGER,
      () => new UIManager(),
      [ServiceType.LOGGING_COORDINATOR, ServiceType.SETTINGS_COORDINATOR]
    );
    
    this.container.register(
      ServiceType.INPUT_MANAGER,
      () => new InputManager(),
      [ServiceType.TERMINAL_COORDINATOR, ServiceType.NOTIFICATION_MANAGER]
    );
    
    // コーディネーターサービスを登録
    this.container.registerInstance(ServiceType.TERMINAL_COORDINATOR, this);
    this.container.registerInstance(ServiceType.LOGGING_COORDINATOR, this);
  }
  
  public async initialize(): Promise<void> {
    // 依存関係グラフを検証
    const validation = this.container.validateDependencyGraph();
    if (!validation.isValid) {
      throw new Error(`Dependency validation failed: ${validation.errors.join(', ')}`);
    }
    
    // サービスを正しい順序で初期化
    const uiManager = await this.container.resolve<IUIManager>(ServiceType.UI_MANAGER);
    const inputManager = await this.container.resolve<IInputManager>(ServiceType.INPUT_MANAGER);
    
    this.log('All services initialized successfully');
  }
  
  public async dispose(): Promise<void> {
    await this.container.dispose();
  }
}
```

**メリット:**
- 🔧 循環依存の自動検出
- 🔧 正しい初期化順序の保証
- 🔧 テスト時のモック注入が容易
- 🔧 サービスの健全性監視

## Enhanced Test Helper の使用

### 従来のテストセットアップ
```typescript
// Before: 各テストファイルで繰り返される長いセットアップ
describe('SomeManager', () => {
  let manager: SomeManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let jsdom: JSDOM;
  let clock: sinon.SinonFakeTimers;
  let sandbox: sinon.SinonSandbox;
  
  beforeEach(() => {
    // 20-30行のJSDOMセットアップ
    jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });
    
    global.window = jsdom.window as any;
    global.document = jsdom.window.document;
    global.Event = jsdom.window.Event;
    // ... 他のグローバル設定
    
    // タイマーとサンドボックスのセットアップ
    clock = sinon.useFakeTimers();
    sandbox = sinon.createSandbox();
    
    // モックコーディネーターの作成
    mockCoordinator = {
      getActiveTerminalId: sandbox.stub().returns('terminal-1'),
      setActiveTerminalId: sandbox.stub(),
      postMessageToExtension: sandbox.stub(),
      // ... 25個のメソッドをすべてスタブ
    } as any;
    
    manager = new SomeManager();
  });
  
  afterEach(() => {
    // 10-15行のクリーンアップ
    clock.restore();
    sandbox.restore();
    jsdom.window.close();
    // ...
  });
});
```

### Enhanced Test Helper を使用したテスト
```typescript
// After: 大幅に簡素化されたテストセットアップ
import { EnhancedTestHelper } from '../../../utils/EnhancedTestHelper';

describe('SomeManager', () => {
  let testHelper: EnhancedTestHelper;
  let manager: SomeManager;
  
  beforeEach(async () => {
    // 1行でテスト環境を完全セットアップ
    testHelper = new EnhancedTestHelper({
      enableJSDOM: true,
      enableFakeTimers: true,
      enablePerformanceMonitoring: true,
    });
    
    await testHelper.setup();
    
    // 依存関係注入付きでマネージャーを作成
    manager = await testHelper.createTestManager(SomeManager, {
      enablePerformanceMonitoring: true,
    });
  });
  
  afterEach(async () => {
    // 1行で完全クリーンアップ
    await testHelper.cleanup();
  });
  
  it('should initialize properly', () => {
    // ヘルパーメソッドで簡単アサーション
    testHelper.assertManagerInitialized(manager);
    
    // パフォーマンスメトリクスの検証
    const health = manager.getHealthStatus();
    expect(health.performanceMetrics).to.exist;
  });
  
  it('should handle timer operations', () => {
    manager.startSomeOperation();
    
    // タイマー制御が簡単
    testHelper.advanceTimers(1000);
    
    // 期待される動作を検証
    expect(manager.isOperationComplete()).to.be.true;
  });
  
  it('should test multiple initialization scenarios', async () => {
    // 複数のシナリオを一度にテスト
    await testHelper.testManagerInitialization(SomeManager, [
      {
        name: 'successful initialization',
        shouldSucceed: true,
      },
      {
        name: 'initialization without coordinator',
        dependencies: { terminalCoordinator: undefined },
        shouldSucceed: false,
        expectedError: 'Coordinator required',
      },
    ]);
  });
});
```

**テストコード削減: 約50-60行 → 15-20行 (65-70%の削減)**

## 段階的移行戦略

### Phase 1: 基盤整備（既に完了）
```typescript
// ✅ 新しいインターフェースとベースクラスの作成
import { 
  EnhancedBaseManager,
  SegregatedManagerInterfaces,
  DependencyContainer,
  EnhancedTestHelper 
} from './refactoring-exports';
```

### Phase 2: 段階的マネージャー移行
```typescript
// 🚀 既存マネージャーを1つずつ移行
// 例: NotificationManager の移行

// 1. 既存クラスを残しつつ、新クラスを作成
export class EnhancedNotificationManager extends EnhancedBaseManager implements IEnhancedNotificationManager {
  // 新しい実装...
}

// 2. 既存クラスにアダプターパターンを適用
export class NotificationManager implements INotificationManager {
  private enhanced: EnhancedNotificationManager;
  
  constructor() {
    this.enhanced = new EnhancedNotificationManager();
  }
  
  // 既存メソッドを新実装にプロキシ
  public showNotificationInTerminal(message: string, type: string): void {
    return this.enhanced.showNotificationInTerminal(message, type);
  }
  
  // ... 他のメソッドも同様にプロキシ
}
```

### Phase 3: 依存関係注入の統合
```typescript
// 📦 既存のTerminalWebviewManagerに段階的に統合
export class TerminalWebviewManager {
  private container?: DependencyContainer;
  
  constructor(private useEnhancedMode = false) {
    if (this.useEnhancedMode) {
      this.container = new DependencyContainer();
      this.setupEnhancedServices();
    } else {
      this.setupLegacyServices();
    }
  }
  
  private setupEnhancedServices(): void {
    // 新しい依存関係注入システムを使用
    this.container!.register(ServiceType.NOTIFICATION_MANAGER, () => new EnhancedNotificationManager());
    // ...
  }
  
  private setupLegacyServices(): void {
    // 既存の直接インスタンス化を維持
    this.notificationManager = new NotificationManager();
    // ...
  }
}
```

### 移行の利点

**即座に得られる利点:**
- ✅ 新しい機能開発で即座に活用可能
- ✅ テストコードの大幅な簡素化
- ✅ より良いエラーハンドリングとデバッグ情報

**段階的に得られる利点:**
- 🔄 既存コードの段階的品質向上
- 🔄 メンテナンス性の大幅改善
- 🔄 パフォーマンス監視とヘルスチェック機能

**完全移行後の利点:**
- 🎯 技術的負債の大幅削減
- 🎯 新機能開発速度の向上
- 🎯 バグ発生率の低下

この段階的アプローチにより、既存システムを壊すことなく、新しいアーキテクチャの恩恵を受けることができます。