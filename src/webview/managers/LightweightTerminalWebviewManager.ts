/**
 * Lightweight Terminal WebView Manager
 *
 * 責務分離による軽量化されたWebViewマネージャー
 * 協調パターンを使用して各専門マネージャーを統合
 *
 * リファクタリング: コーディネーターパターンによる更なる責務分離
 * - TerminalOperationsCoordinator: ターミナルCRUD操作
 * - ResizeCoordinator: リサイズ処理
 */

import { Terminal } from '@xterm/xterm';
import { webview as log } from '../../utils/logger';
import { SPLIT_CONSTANTS } from '../constants/webview';
import {
  PartialTerminalSettings,
  WebViewFontSettings,
  TerminalConfig,
  TerminalState,
} from '../../types/shared';
import {
  IManagerCoordinator,
  TerminalInstance,
  IPerformanceManager,
  IInputManager,
  IUIManager,
  IConfigManager,
  IMessageManager,
  INotificationManager,
  IFindInTerminalManager,
  IProfileManager,
  ITerminalTabManager,
  ITerminalContainerManager,
  IDisplayModeManager,
  IHeaderManager,
  IShellIntegrationBridge,
  IPersistenceManager,
} from '../interfaces/ManagerInterfaces';

// Coordinators (リファクタリングで抽出)
import { TerminalOperationsCoordinator } from '../coordinators/TerminalOperationsCoordinator';
import { ResizeCoordinator } from '../coordinators/ResizeCoordinator';

// Managers (リファクタリングで抽出)
import { SessionRestoreManager, SessionData } from './SessionRestoreManager';
import { TerminalSettingsManager } from './TerminalSettingsManager';

// Services
import { FontSettingsService } from '../services/FontSettingsService';

// Types
import { TerminalTheme } from '../types/theme.types';

interface SystemStatusSnapshot {
  ready: boolean;
  state: TerminalState | null;
  pendingOperations: {
    deletions: string[];
    creations: number;
  };
}

const NOOP_SHELL_INTEGRATION_MANAGER: IShellIntegrationBridge = {
  setCoordinator: () => {},
  handleMessage: () => {},
  dispose: () => {},
  initializeTerminalShellIntegration: () => {},
  decorateTerminalOutput: () => {},
  updateShellStatus: () => {},
  updateCwd: () => {},
  updateWorkingDirectory: () => {},
  showCommandHistory: () => {},
};
import { SplitManager } from './SplitManager';
import { SplitResizeManager } from './SplitResizeManager';
import { SettingsPanel } from '../components/SettingsPanel';
import { NotificationManager } from './NotificationManager';
import { ConfigManager } from './ConfigManager';
import { PerformanceManager } from './PerformanceManager';
import { UIManager } from './UIManager';
import { InputManager } from './InputManager';
import { ConsolidatedMessageManager } from './ConsolidatedMessageManager';
import { WebViewPersistenceService } from '../services/WebViewPersistenceService';
import { WebViewApiManager } from './WebViewApiManager';
import { TerminalLifecycleCoordinator } from './TerminalLifecycleCoordinator';
import { TerminalTabManager } from './TerminalTabManager';
import { CliAgentStateManager } from './CliAgentStateManager';
import { EventHandlerManager } from './EventHandlerManager';
import { ShellIntegrationManager } from './ShellIntegrationManager';
import { FindInTerminalManager } from './FindInTerminalManager';
import { ProfileManager } from './ProfileManager';
import { TerminalContainerManager } from './TerminalContainerManager';
import { DisplayModeManager } from './DisplayModeManager';
import { HeaderManager } from './HeaderManager';
import { DebugPanelManager, SystemDiagnostics } from './DebugPanelManager';
import { TerminalStateDisplayManager } from './TerminalStateDisplayManager';

/**
 * 軽量化されたTerminalWebviewManager
 *
 * 主な改善点：
 * - 責務分離による専門マネージャー協調
 * - コーディネーターパターンによる更なる責務分離
 * - 拡張性とメンテナンス性の向上
 */
export class LightweightTerminalWebviewManager implements IManagerCoordinator {
  // ========================================
  // Coordinators (リファクタリングで抽出された責務)
  // ========================================
  private terminalOperations!: TerminalOperationsCoordinator;
  private resizeCoordinator!: ResizeCoordinator;

  // ========================================
  // 専門マネージャー
  // ========================================
  private webViewApiManager: WebViewApiManager;
  private terminalLifecycleManager: TerminalLifecycleCoordinator;
  private cliAgentStateManager: CliAgentStateManager;
  private eventHandlerManager: EventHandlerManager;
  public shellIntegrationManager: IShellIntegrationBridge;
  public findInTerminalManager: FindInTerminalManager;
  public profileManager: ProfileManager;

  public terminalTabManager!: TerminalTabManager;

  // UI/Display マネージャー
  private terminalContainerManager!: TerminalContainerManager;
  private displayModeManager!: DisplayModeManager;
  private headerManager!: HeaderManager;
  private debugPanelManager: DebugPanelManager;
  private terminalStateDisplayManager!: TerminalStateDisplayManager;

  // 既存マネージャー
  public splitManager: SplitManager;
  private splitResizeManager: SplitResizeManager | null = null;
  private settingsPanel!: SettingsPanel;
  private notificationManager!: NotificationManager;
  private configManager!: ConfigManager;
  private performanceManager!: PerformanceManager;
  private uiManager!: UIManager;
  public inputManager!: InputManager;
  public messageManager!: ConsolidatedMessageManager;
  public persistenceManager: WebViewPersistenceService | null = null;
  public webViewPersistenceService!: WebViewPersistenceService;

  // ========================================
  // Services (単一責任の原則)
  // ========================================
  private fontSettingsService!: FontSettingsService;

  // ========================================
  // Extracted Managers (リファクタリングで抽出)
  // ========================================
  private sessionRestoreManager!: SessionRestoreManager;
  private settingsManager!: TerminalSettingsManager;

  // ========================================
  // 状態
  // ========================================
  private versionInfo: string = 'v0.1.0';
  private pendingSplitTransition: Promise<void> | null = null;
  private forceNormalModeForNextCreate = false;
  private forceFullscreenModeForNextCreate = false;
  private isInitialized = false;
  private currentTerminalState: TerminalState | null = null;
  private currentSettings: PartialTerminalSettings = {};
  private hasProcessedInitialState = false;

  constructor() {
    log('🚀 RefactoredTerminalWebviewManager initializing...');

    // 専門マネージャーの初期化
    this.webViewApiManager = new WebViewApiManager();
    this.splitManager = new SplitManager(this);
    this.terminalLifecycleManager = new TerminalLifecycleCoordinator(this.splitManager, this);
    this.cliAgentStateManager = new CliAgentStateManager();
    this.eventHandlerManager = new EventHandlerManager();
    this.setupPanelLocationSync();
    this.findInTerminalManager = new FindInTerminalManager();
    this.profileManager = new ProfileManager();
    try {
      this.shellIntegrationManager = new ShellIntegrationManager();
    } catch (error) {
      console.error('Failed to initialize ShellIntegrationManager:', error);
      this.shellIntegrationManager = NOOP_SHELL_INTEGRATION_MANAGER;
    }

    // HeaderManager
    this.headerManager = new HeaderManager();
    this.headerManager.setCoordinator(this);

    // DisplayModeManager と TerminalContainerManager
    this.terminalContainerManager = new TerminalContainerManager(this);
    this.displayModeManager = new DisplayModeManager(this);

    // DebugPanelManager
    this.debugPanelManager = new DebugPanelManager();

    // FontSettingsService (単一責任: フォント設定の一元管理)
    this.fontSettingsService = new FontSettingsService();

    log('✅ All managers initialized');

    // 既存マネージャーの初期化
    this.initializeExistingManagers();

    // コーディネーターの初期化
    this.initializeCoordinators();

    // SplitResizeManager の初期化
    this.initializeSplitResizeManager();

    // 設定読み込み
    this.loadSettings();

    // イベントハンドラーの設定
    this.setupEventHandlers();

    // InputManager設定
    this.setupInputManager();

    this.isInitialized = true;
    log('✅ RefactoredTerminalWebviewManager initialized');
  }

  private setupPanelLocationSync(): void {
    // Panel location (sidebar/panel) changes - keep split layout direction in sync
    // Use direct window.addEventListener for custom events
    window.addEventListener(
      'terminal-panel-location-changed',
      (event: Event) => {
        const customEvent = event as CustomEvent<{ location?: unknown }>;
        const location = customEvent.detail?.location;
        if (location !== 'sidebar' && location !== 'panel') {
          return;
        }

        this.splitManager.setPanelLocation(location);

        const direction = location === 'panel' ? 'horizontal' : 'vertical';

        try {
          const terminalCount = this.splitManager.getTerminals().size;
          const currentMode = this.displayModeManager.getCurrentMode();

          // Bottom panel: if multiple terminals are visible (i.e. not fullscreen), enforce split layout immediately
          if (location === 'panel' && terminalCount > 1 && currentMode !== 'fullscreen') {
            this.displayModeManager.showAllTerminalsSplit();
            return;
          }

          // Sidebar: if already in split mode, rebuild layout to ensure vertical stacking
          if (location === 'sidebar' && currentMode === 'split') {
            this.displayModeManager.showAllTerminalsSplit();
            return;
          }
        } catch {
          // fall through
        }

        // Otherwise, just update split direction for the next activation
        this.splitManager.updateSplitDirection(direction, location);
      }
    );

    // Best-effort sync: apply the current location even if the first event fired before full UI was ready
    setTimeout(() => {
      try {
        const terminalsWrapper = document.getElementById('terminals-wrapper');
        if (!terminalsWrapper) {
          return;
        }

        const location = terminalsWrapper.classList.contains('terminal-split-horizontal')
          ? 'panel'
          : 'sidebar';
        this.splitManager.setPanelLocation(location);

        const terminalCount = this.splitManager.getTerminals().size;
        const currentMode = this.displayModeManager.getCurrentMode();
        if (location === 'panel' && terminalCount > 1 && currentMode !== 'fullscreen') {
          this.displayModeManager.showAllTerminalsSplit();
        } else if (location === 'sidebar' && currentMode === 'split') {
          this.displayModeManager.showAllTerminalsSplit();
        }
      } catch {
        // ignore
      }
    }, 250);
  }

  /**
   * コーディネーターの初期化
   */
  private initializeCoordinators(): void {
    // ResizeCoordinator
    this.resizeCoordinator = new ResizeCoordinator({
      getTerminals: () => this.splitManager.getTerminals(),
      // 🎯 VS Code Pattern: Notify PTY about terminal resize
      notifyResize: (terminalId: string, cols: number, rows: number) => {
        this.postMessageToExtension({
          command: 'resize',
          terminalId,
          cols,
          rows,
        });
      },
    });
    this.resizeCoordinator.initialize();
    this.resizeCoordinator.setupPanelLocationListener();

    // TerminalOperationsCoordinator
    this.terminalOperations = new TerminalOperationsCoordinator({
      getActiveTerminalId: () => this.getActiveTerminalId(),
      setActiveTerminalId: (id) => this.terminalLifecycleManager.setActiveTerminalId(id),
      getTerminalInstance: (id) => this.getTerminalInstance(id),
      getAllTerminalInstances: () => this.getAllTerminalInstances(),
      getTerminalStats: () => this.terminalLifecycleManager.getTerminalStats(),
      postMessageToExtension: (msg) => this.postMessageToExtension(msg),
      showWarning: (msg) => this.notificationManager?.showWarning(msg),
      createTerminalInstance: async (id, name, config, num) =>
        this.terminalLifecycleManager.createTerminal(id, name, config, num),
      removeTerminalInstance: (id) => this.terminalLifecycleManager.removeTerminal(id),
      getTerminalCount: () => this.splitManager?.getTerminals()?.size ?? 0,
      ensureSplitModeBeforeCreation: () => this.ensureSplitModeBeforeTerminalCreation(),
      refreshSplitLayout: () => this.displayModeManager?.showAllTerminalsSplit(),
      prepareDisplayForDeletion: (id, stats) => this.prepareDisplayForTerminalDeletion(id, stats),
      updateTerminalBorders: (id) =>
        this.uiManager?.updateTerminalBorders(id, this.terminalLifecycleManager.getAllTerminalContainers()),
      focusTerminal: (id) => {
        const instance = this.getTerminalInstance(id);
        instance?.terminal?.focus();
      },
      addTab: (id, name, terminal) => this.terminalTabManager?.addTab(id, name, terminal),
      setActiveTab: (id) => this.terminalTabManager?.setActiveTab(id),
      removeTab: (id) => this.terminalTabManager?.removeTab(id),
      saveSession: () => this.webViewPersistenceService?.saveSession() ?? Promise.resolve(false),
      removeCliAgentState: (id) => this.cliAgentStateManager.removeTerminalState(id),
    });

    log('✅ Coordinators initialized');
  }

  /**
   * SplitResizeManager の初期化
   */
  private initializeSplitResizeManager(): void {
    this.splitResizeManager = new SplitResizeManager({
      onResizeComplete: () => {
        // PTY に通知するためにすべてのターミナルをリサイズ
        this.refitAllTerminals();
      },
      getSplitDirection: () => {
        return this.splitManager.getSplitDirection();
      },
    });
    log('✅ SplitResizeManager initialized');
  }

  /**
   * SplitResizeManager にリサイザーを登録
   * 分割レイアウト変更時に呼び出される
   */
  public updateSplitResizers(): void {
    if (!this.splitResizeManager) {
      return;
    }

    const terminalsWrapper = document.getElementById('terminals-wrapper');
    if (!terminalsWrapper) {
      // Clear stale references when wrapper is missing
      this.splitResizeManager.reinitialize([]);
      return;
    }

    const resizers = Array.from(
      terminalsWrapper.querySelectorAll<HTMLElement>('.split-resizer')
    );

    // Always reinitialize to clear stale references, even with empty array
    this.splitResizeManager.reinitialize(resizers);
  }

  /**
   * 既存マネージャーの初期化（段階的移行のため）
   */
  private initializeExistingManagers(): void {
    log('🔧 Initializing existing managers...');

    // Settings Panel Manager
    this.settingsPanel = new SettingsPanel({
      onSettingsChange: (settings) => {
        try {
          const mergedSettings = { ...this.currentSettings, ...settings };
          this.applySettings(settings);

          if (this.configManager) {
            this.configManager.applySettings(
              mergedSettings,
              this.terminalLifecycleManager.getAllTerminalInstances()
            );
            this.currentSettings = this.configManager.getCurrentSettings();
          }

          // Settings are already applied to terminals via configManager
          // messageManager does not need to update settings

          this.saveSettings();
        } catch (error) {
          log('❌ [SETTINGS] Error applying settings from panel:', error);
        }
      },
      onClose: () => {
        try {
          this.ensureTerminalFocus();
        } catch (error) {
          log('❌ [SETTINGS] Error restoring focus after closing settings:', error);
        }
      },
    });

    // Notification Manager
    this.notificationManager = new NotificationManager();

    // Performance Manager
    this.performanceManager = new PerformanceManager();
    this.performanceManager.initializePerformance(this); // 🔧 FIX: Enable DSR response handling (Issue #341)

    // UI Manager
    this.uiManager = new UIManager();
    this.uiManager.setActiveBorderMode(this.currentSettings.activeBorderMode ?? 'multipleOnly');

    // Connect FontSettingsService with UIManager (Dependency Injection)
    this.fontSettingsService.setApplicator(this.uiManager);

    // Terminal Tab Manager
    this.terminalTabManager = new TerminalTabManager();
    this.terminalTabManager.setCoordinator(this);

    // Connect UIManager with TerminalTabManager for theme synchronization
    this.uiManager.setTabThemeUpdater((theme) => {
      this.terminalTabManager?.updateTheme(theme);
    });

    // Input Manager - 重要：入力機能のために必須 (Issue #216: constructor injection)
    this.inputManager = new InputManager(this);
    this.inputManager.initialize(); // 🔧 Initialize InputManager to register keyboard listeners

    // Config Manager
    this.configManager = new ConfigManager();
    // Connect ConfigManager to FontSettingsService for single source of truth
    this.configManager.setFontSettingsService(this.fontSettingsService);

    // 🚀 PHASE 3: Initialize persistence managers with proper API access
    this.webViewPersistenceService = new WebViewPersistenceService();
    this.persistenceManager = this.webViewPersistenceService;

    // Message Manager は後で初期化
    this.messageManager = new ConsolidatedMessageManager();
    this.messageManager.setCoordinator(this); // 🆕 Coordinator を設定（×ボタン機能に必要）
    this.persistenceManager = this.webViewPersistenceService;

    // Set up coordinator relationships for specialized managers
    this.findInTerminalManager.setCoordinator(this);
    this.profileManager.setCoordinator(this);
    this.shellIntegrationManager.setCoordinator(this);

    // Initialize ProfileManager asynchronously
    setTimeout(async () => {
      try {
        await this.profileManager.initialize();
        log('🎯 ProfileManager async initialization completed');
      } catch (error) {
        console.error('❌ ProfileManager initialization failed:', error);
      }
    }, 100);

    // Input Manager setup will be handled in setupInputManager()
    this.terminalTabManager.initialize();

    // 🆕 Initialize DisplayModeManager and TerminalContainerManager (Issue #198)
    this.displayModeManager.initialize();
    this.terminalContainerManager.initialize();

    // Setup DebugPanelManager callbacks
    this.debugPanelManager.setCallbacks({
      getSystemStatus: () => this.getSystemStatus(),
      forceSynchronization: () => this.forceSynchronization(),
      requestLatestState: () => this.requestLatestState(),
    });

    // Initialize TerminalStateDisplayManager
    this.terminalStateDisplayManager = new TerminalStateDisplayManager(
      this.uiManager,
      this.notificationManager,
      this.terminalTabManager,
      this.terminalContainerManager
    );

    // Initialize SessionRestoreManager (extracted for better separation)
    this.sessionRestoreManager = new SessionRestoreManager({
      getTerminalInstance: (id) => this.getTerminalInstance(id),
      createTerminal: (id, name) => this.createTerminal(id, name),
      getActiveTerminalId: () => this.getActiveTerminalId(),
    });

    // Initialize TerminalSettingsManager (extracted for better separation)
    this.settingsManager = new TerminalSettingsManager(this.uiManager, this.configManager, {
      getAllTerminalInstances: () => this.getAllTerminalInstances(),
      getAllTerminalContainers: () => this.getAllTerminalContainers(),
      getActiveTerminalId: () => this.getActiveTerminalId(),
    });

    log('✅ All managers initialized');
  }

  /**
   * 入力マネージャーの完全な設定
   */
  private setupInputManager(): void {
    try {
      // Alt+Click機能の設定
      this.inputManager.setupAltKeyVisualFeedback();

      // IME処理の設定
      this.inputManager.setupIMEHandling();

      // キーボードショートカットの設定
      this.inputManager.setupKeyboardShortcuts(this);

      // Agent interaction mode を無効化（VS Code標準動作）
      this.inputManager.setAgentInteractionMode(false);

      log('✅ Input manager fully configured');
    } catch (error) {
      log('❌ Error setting up input manager:', error);
    }
  }

  /**
   * イベントハンドラーの設定
   * リサイズ処理はResizeCoordinatorに委譲
   */
  private setupEventHandlers(): void {
    // メッセージイベント
    this.eventHandlerManager.setMessageEventHandler(async (event) => {
      log(`🔍 [DEBUG] WebView received message event:`, {
        type: event.type,
        dataCommand: event.data?.command,
        timestamp: Date.now(),
      });
      await this.messageManager.receiveMessage(event.data, this);
    });

    // Local UI events
    document.addEventListener('settings-open-requested' as keyof DocumentEventMap, () => {
      this.openSettings();
    });

    // ページライフサイクル
    this.eventHandlerManager.onPageUnload(() => {
      this.dispose();
    });

    log('🎭 Event handlers configured');
  }

  /**
   * Refit all terminals to their container dimensions
   * 委譲: ResizeCoordinator
   */
  public refitAllTerminals(): void {
    this.resizeCoordinator.refitAllTerminals();
  }

  // IManagerCoordinator interface implementation

  public getActiveTerminalId(): string | null {
    return this.terminalLifecycleManager.getActiveTerminalId();
  }

  public setActiveTerminalId(terminalId: string | null): void {
    // 🔍 Enhanced debugging for active terminal setting
    log(`🔍 [WEBVIEW] ========== SET ACTIVE TERMINAL DEBUG ==========`);
    log(`🔍 [WEBVIEW] Previous active: ${this.terminalLifecycleManager.getActiveTerminalId()}`);
    log(`🔍 [WEBVIEW] New active: ${terminalId}`);

    this.terminalLifecycleManager.setActiveTerminalId(terminalId);

    if (this.terminalTabManager && terminalId) {
      this.terminalTabManager.setActiveTab(terminalId);
    }

    // アクティブターミナルが変更されたらUI境界を更新
    if (terminalId) {
      this.uiManager.updateTerminalBorders(
        terminalId,
        this.terminalLifecycleManager.getAllTerminalContainers()
      );

      // 🎯 FIX: Only focus if needed to avoid interrupting terminal output
      // This is critical for CLI agent scenarios while preserving shell prompt
      const terminals = this.splitManager.getTerminals();
      const terminalInstance = terminals.get(terminalId);
      if (terminalInstance && terminalInstance.terminal) {
        const terminal = terminalInstance.terminal;
        // Check if terminal actually needs focus
        if (!terminal.textarea?.hasAttribute('focused')) {
          // Use setTimeout to avoid interrupting terminal initialization
          setTimeout(() => {
            terminal.focus();
            log(`🎯 [WEBVIEW] Focused terminal when needed: ${terminalId}`);
          }, 20);
        } else {
          log(`🎯 [WEBVIEW] Terminal already focused, skipping: ${terminalId}`);
        }
      }

      // 🎯 Extension側にアクティブターミナルの変更を通知
      this.messageManager.postMessage({
        command: 'focusTerminal',
        terminalId: terminalId,
      });
      log(`🎯 [WEBVIEW] Notified Extension of active terminal change: ${terminalId}`);

      // 🆕 SIMPLE: Save session when active terminal changes
      if (this.webViewPersistenceService) {
        setTimeout(() => {
          this.webViewPersistenceService.saveSession().then((success) => {
            if (success) {
              log(`💾 [SIMPLE-PERSISTENCE] Session saved after active terminal change`);
            }
          });
        }, 200); // Small delay to avoid frequent saves
      }

      // Verify the setting worked
      const verifyActive = this.terminalLifecycleManager.getActiveTerminalId();
      log(`🔍 [WEBVIEW] Verified active terminal: ${verifyActive}`);
    }

    log(`🔍 [WEBVIEW] ========== SET ACTIVE TERMINAL DEBUG END ==========`);
  }

  public getTerminalInstance(terminalId: string): TerminalInstance | undefined {
    return this.terminalLifecycleManager.getTerminalInstance(terminalId);
  }

  public getSerializeAddon(
    terminalId: string
  ): import('@xterm/addon-serialize').SerializeAddon | undefined {
    const instance = this.terminalLifecycleManager.getTerminalInstance(terminalId);
    return instance?.serializeAddon;
  }

  public getAllTerminalInstances(): Map<string, TerminalInstance> {
    return this.terminalLifecycleManager.getAllTerminalInstances();
  }

  public getAllTerminalContainers(): Map<string, HTMLElement> {
    return this.terminalLifecycleManager.getAllTerminalContainers();
  }

  public getTerminalElement(terminalId: string): HTMLElement | undefined {
    return this.terminalLifecycleManager.getTerminalElement(terminalId);
  }

  public postMessageToExtension(message: unknown): void {
    this.webViewApiManager.postMessageToExtension(message);
  }

  public log(message: string, ...args: unknown[]): void {
    log(message, ...args);
  }

  public getManagers(): {
    performance: IPerformanceManager;
    input: IInputManager;
    ui: IUIManager;
    config: IConfigManager;
    message: IMessageManager;
    notification: INotificationManager;
    findInTerminal?: IFindInTerminalManager;
    profile?: IProfileManager;
    tabs?: ITerminalTabManager;
    persistence?: IPersistenceManager;
    terminalContainer?: ITerminalContainerManager;
    displayMode?: IDisplayModeManager;
    header?: IHeaderManager;
  } {
    return {
      performance: this.performanceManager,
      input: this.inputManager,
      ui: this.uiManager,
      config: this.configManager,
      message: this.messageManager,
      notification: this.notificationManager,
      findInTerminal: this.findInTerminalManager,
      profile: this.profileManager,
      tabs: this.terminalTabManager,
      persistence: (this.persistenceManager as IPersistenceManager | null) ?? undefined,
      terminalContainer: this.terminalContainerManager,
      displayMode: this.displayModeManager,
      header: this.headerManager,
    };
  }

  public getMessageManager(): IMessageManager {
    return this.messageManager;
  }

  // 🆕 Getters for new managers
  public getTerminalContainerManager(): ITerminalContainerManager {
    return this.terminalContainerManager;
  }

  public getDisplayModeManager(): IDisplayModeManager {
    return this.displayModeManager;
  }

  public getSplitManager(): SplitManager {
    return this.splitManager;
  }

  /**
   * 🎯 PUBLIC API: Update panel location and flex-direction if changed
   * Delegates to ConsolidatedMessageManager → PanelLocationHandler
   * Single entry point for layout updates (VS Code pattern)
   *
   * @returns true if layout was updated, false if no change
   */
  public updatePanelLocationIfNeeded(): boolean {
    return this.messageManager.updatePanelLocationIfNeeded();
  }

  /**
   * Get current panel location
   */
  public getCurrentPanelLocation(): 'sidebar' | 'panel' | null {
    return this.messageManager.getCurrentPanelLocation();
  }

  /**
   * Get current flex-direction
   */
  public getCurrentFlexDirection(): 'row' | 'column' | null {
    return this.messageManager.getCurrentFlexDirection();
  }

  public setForceNormalModeForNextCreate(enabled: boolean): void {
    this.forceNormalModeForNextCreate = enabled;
    log(`🧭 [MODE] Force normal mode for next create: ${enabled}`);
  }

  public setForceFullscreenModeForNextCreate(enabled: boolean): void {
    this.forceFullscreenModeForNextCreate = enabled;
    log(`🧭 [MODE] Force fullscreen mode for next create: ${enabled}`);
  }

  // Terminal management delegation

  public async createTerminal(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig,
    terminalNumber?: number, // Optional terminal number from Extension
    requestSource: 'webview' | 'extension' = 'webview'
  ): Promise<Terminal | null> {
    try {
      log(`🔍 [DEBUG] RefactoredTerminalWebviewManager.createTerminal called:`, {
        terminalId,
        terminalName,
        terminalNumber, // Log the terminal number
        hasConfig: !!config,
        timestamp: Date.now(),
      });

      if (this.terminalOperations.isTerminalCreationPending(terminalId)) {
        log(
          `⏳ [DEBUG] Terminal ${terminalId} creation already pending (source: ${requestSource}), skipping duplicate request`
        );
        return this.getTerminalInstance(terminalId)?.terminal ?? null;
      }

      const existingInstance = this.getTerminalInstance(terminalId);
      if (existingInstance) {
        log(
          `🔁 [DEBUG] Terminal ${terminalId} already exists, reusing existing instance (source: ${requestSource})`
        );
        this.terminalTabManager?.setActiveTab(terminalId);
        return existingInstance.terminal ?? null;
      }

      const displayModeOverride = (config as { displayModeOverride?: string } | undefined)
        ?.displayModeOverride;
      const shouldForceNormal =
        this.forceNormalModeForNextCreate || displayModeOverride === 'normal';
      const shouldForceFullscreen =
        this.forceFullscreenModeForNextCreate || displayModeOverride === 'fullscreen';

      log(`🔍 [MODE-DEBUG] createTerminal mode check:`, {
        terminalId,
        displayModeOverride,
        forceFullscreenModeForNextCreate: this.forceFullscreenModeForNextCreate,
        shouldForceFullscreen,
        shouldForceNormal,
        currentMode: this.displayModeManager?.getCurrentMode?.() ?? 'unknown',
      });

      if (shouldForceNormal) {
        this.forceNormalModeForNextCreate = false;
        this.displayModeManager?.setDisplayMode('normal');
        log(`🧭 [MODE] Forced normal mode before creating ${terminalId}`);
      } else if (shouldForceFullscreen) {
        this.forceFullscreenModeForNextCreate = false;
        log(`🧭 [MODE] Forced fullscreen mode before creating ${terminalId}`);
      } else {
        await this.ensureSplitModeBeforeTerminalCreation();
      }

      const canCreate = this.canCreateTerminal();
      if (!canCreate && requestSource !== 'extension') {
        const localCount = this.splitManager?.getTerminals()?.size ?? 0;
        const maxCount =
          this.currentTerminalState?.maxTerminals ?? SPLIT_CONSTANTS.MAX_TERMINALS ?? 5;
        log(`❌ [STATE] Terminal creation blocked (local count=${localCount}, max=${maxCount})`);
        this.showTerminalLimitMessage(localCount, maxCount);
        return null;
      }

      if (this.currentTerminalState) {
        const availableSlots = this.currentTerminalState.availableSlots;
        log(
          `🎯 [STATE] Terminal creation check: canCreate=${canCreate}, availableSlots=[${availableSlots.join(',')}]`
        );

        if (terminalNumber && !availableSlots.includes(terminalNumber)) {
          log(
            `⚠️ [STATE] Terminal number ${terminalNumber} not in available slots [${availableSlots.join(',')}]`
          );
          this.requestLatestState();
        }
      } else {
        log(`⚠️ [STATE] No cached state available, requesting from Extension...`);
        this.requestLatestState();
      }

      log(`🚀 Creating terminal with header: ${terminalId} (${terminalName}) #${terminalNumber}`);

      this.terminalOperations.markTerminalCreationPending(terminalId);

      // 1. ターミナルインスタンスを作成
      const terminal = await this.terminalLifecycleManager.createTerminal(
        terminalId,
        terminalName,
        config,
        terminalNumber // Pass terminal number to TerminalLifecycleCoordinator
      );

      if (!terminal) {
        log(`❌ Failed to create terminal instance: ${terminalId}`);
        return null;
      }

      // 2. ヘッダーはTerminalContainerFactoryで既に作成済み（重複作成を削除）
      log(`✅ Terminal header already created by TerminalContainerFactory: ${terminalId}`);

      // 3. 入力イベントハンドラーの設定
      // Get terminal container for potential future use
      // const terminalContainer = this.terminalLifecycleManager.getTerminalElement(terminalId);
      if (this.terminalTabManager) {
        this.terminalTabManager.addTab(terminalId, terminalName, terminal);
        this.terminalTabManager.setActiveTab(terminalId);
      }

      // 🔧 FIX #188: Register terminal with persistence service for scrollback saving
      // This was missing - terminals were never registered, so saveSession() saved nothing
      if (this.webViewPersistenceService) {
        this.webViewPersistenceService.addTerminal(terminalId, terminal, { autoSave: true });
        log(`✅ [PERSISTENCE] Terminal ${terminalId} registered with persistence service`);
      }

      // 🆕 SIMPLE: Save current session state after terminal creation
      // No complex serialization - just session metadata
      setTimeout(() => {
        if (this.webViewPersistenceService) {
          log(`💾 [SIMPLE-PERSISTENCE] Saving session after terminal ${terminalId} creation`);
          this.webViewPersistenceService.saveSession().then((success) => {
            if (success) {
              log(`✅ [SIMPLE-PERSISTENCE] Session saved successfully`);
            } else {
              console.warn(`⚠️ [SIMPLE-PERSISTENCE] Failed to save session`);
            }
          });
        }
      }, 100); // Minimal delay for DOM updates

      // 4. 🎯 FIX: 新規作成時のアクティブ設定強化
      // 確実にアクティブ状態を設定し、太い青枠を表示
      this.setActiveTerminalId(terminalId);

      // 即座にボーダー更新を実行（UIManager経由）
      const allContainers = this.splitManager.getTerminalContainers();
      if (this.uiManager) {
        // Terminal count is auto-updated inside updateTerminalBorders
        this.uiManager.updateTerminalBorders(terminalId, allContainers);
        log(`🎯 [FIX] Applied active border immediately after creation: ${terminalId}`);
      }

      // ターミナルフォーカスも確実に設定
      if (terminal && terminal.textarea) {
        setTimeout(() => {
          terminal.focus();
          log(`🎯 [FIX] Focused new terminal: ${terminalId}`);
        }, 25);
      }

      // 5. ExtensionにRegular のターミナル作成をリクエスト
      if (requestSource === 'webview') {
        this.postMessageToExtension({
          command: 'createTerminal',
          terminalId: terminalId,
          terminalName: terminalName,
          timestamp: Date.now(),
        });
      }

      log(`✅ Terminal creation completed: ${terminalId}`);

      // 🔧 FIX: Capture current mode before async operations
      const currentMode = this.displayModeManager?.getCurrentMode?.() ?? 'normal';
      const splitManager = this.splitManager;
      const splitManagerActive =
        typeof splitManager?.getIsSplitMode === 'function' && splitManager.getIsSplitMode();
      const shouldMaintainSplitLayout =
        !shouldForceNormal &&
        !shouldForceFullscreen &&
        (currentMode === 'split' || splitManagerActive);

      log(
        `🔍 [SPLIT-DEBUG] Current mode: ${currentMode}, displayModeSplit: ${currentMode === 'split'}, splitManagerActive: ${splitManagerActive}, shouldMaintainSplitLayout: ${shouldMaintainSplitLayout}`
      );

      // 🔧 FIX: Immediately refresh split layout if split mode is active via display manager or split manager
      // This prevents the terminal from showing in fullscreen mode temporarily
      if (shouldMaintainSplitLayout) {
        try {
          log(`🔄 [SPLIT] Immediately refreshing split layout after creating ${terminalId}`);
          this.displayModeManager?.showAllTerminalsSplit();
          log(`🔄 [SPLIT] ✅ Split layout refreshed successfully`);
        } catch (layoutError) {
          log(`⚠️ [SPLIT] Failed to refresh split layout immediately: ${layoutError}`);
        }
      }

      // 🔍 SAFE: Single delayed resize for reliability
      log(`🔍 [DEBUG] Scheduling delayed resize for: ${terminalId}`);

      setTimeout(() => {
        log(`🔍 [DEBUG] Delayed resize (150ms) for: ${terminalId}`);
        this.terminalLifecycleManager.resizeAllTerminals();

        // 🎯 FIX: リサイズ後もボーダーを再確認
        if (this.uiManager) {
          this.uiManager.updateTerminalBorders(terminalId, allContainers);
          log(`🎯 [FIX] Re-confirmed active border after resize: ${terminalId}`);
        }

        // 🔧 FIX: Refresh split layout again after resize (保険)
        // 🔧 CRITICAL: Re-check current mode to avoid overriding fullscreen mode
        // The mode may have changed to fullscreen after terminal creation
        const currentModeNow = this.displayModeManager?.getCurrentMode?.() ?? 'normal';
        const stillNeedsSplit = shouldMaintainSplitLayout && currentModeNow === 'split';
        if (stillNeedsSplit) {
          try {
            this.displayModeManager?.showAllTerminalsSplit();
            log(`🔄 [SPLIT] Refreshed split layout after resize`);
          } catch (layoutError) {
            log(`⚠️ [SPLIT] Failed to refresh split layout after resize: ${layoutError}`);
          }
        } else if (shouldMaintainSplitLayout && currentModeNow !== 'split') {
          log(`🔄 [SPLIT] Skipping split refresh - mode changed to ${currentModeNow}`);
        }
      }, 150);

      return terminal;
    } catch (error) {
      log(`❌ Error creating terminal ${terminalId}:`, error);
      return null;
    } finally {
      this.terminalOperations.clearTerminalCreationPending(terminalId);
    }
  }

  private async ensureSplitModeBeforeTerminalCreation(): Promise<void> {
    const displayManager = this.displayModeManager;
    const splitManager = this.splitManager;

    if (!displayManager || !splitManager?.getTerminals) {
      return;
    }

    const currentMode = displayManager.getCurrentMode?.() ?? 'normal';

    let existingCount = 0;
    try {
      const terminals = splitManager.getTerminals();
      existingCount = terminals instanceof Map ? terminals.size : 0;
    } catch (error) {
      log('⚠️ [SPLIT] Failed to inspect existing terminals before creation:', error);
      existingCount = 0;
    }

    if (existingCount === 0) {
      return;
    }

    // 🔧 FIX: Handle both fullscreen and split modes
    // When adding a new terminal, preserve the current mode
    if (currentMode === 'fullscreen') {
      // Fullscreen mode with existing terminals → switch to split
      if (this.pendingSplitTransition) {
        await this.pendingSplitTransition;
        return;
      }

      this.pendingSplitTransition = (async () => {
        try {
          log(
            `🖥️ [SPLIT] Fullscreen detected with ${existingCount} terminals. Switching to split mode before creating new terminal.`
          );

          try {
            displayManager.showAllTerminalsSplit();
          } catch (error) {
            log('⚠️ [SPLIT] Failed to trigger split mode before creation:', error);
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 250));
        } finally {
          this.pendingSplitTransition = null;
        }
      })();

      await this.pendingSplitTransition;
    } else if (currentMode === 'split') {
      // 🆕 Already in split mode → ensure new terminal is added to split layout
      log(`🖥️ [SPLIT] Split mode detected. New terminal will be added to split layout.`);

      // Refresh split layout after new terminal is created (handled after terminal creation)
      // No need to do anything here - the split mode will be maintained
    }
  }

  public async removeTerminal(terminalId: string): Promise<boolean> {
    log(`🗑️ [REMOVAL] Starting removal for terminal: ${terminalId}`);

    // CLI Agent状態もクリーンアップ
    this.cliAgentStateManager.removeTerminalState(terminalId);

    // 🔧 FIX #188: Unregister terminal from persistence service
    if (this.webViewPersistenceService) {
      this.webViewPersistenceService.removeTerminal(terminalId);
      log(`🗑️ [PERSISTENCE] Terminal ${terminalId} unregistered from persistence service`);
    }

    // Step 1: タブを先に削除（UI即時反映のため）
    if (this.terminalTabManager) {
      log(`🗑️ [REMOVAL] Removing tab for: ${terminalId}`);
      this.terminalTabManager.removeTab(terminalId);
    }

    // Step 2: ライフサイクルマネージャーから削除
    const removed = await this.terminalLifecycleManager.removeTerminal(terminalId);
    log(`🗑️ [REMOVAL] Lifecycle removal result for ${terminalId}: ${removed}`);

    // Step 3: セッション更新（遅延実行）
    setTimeout(() => {
      if (this.webViewPersistenceService) {
        log(`💾 [SIMPLE-PERSISTENCE] Updating session after terminal ${terminalId} removal`);
        this.webViewPersistenceService.saveSession().then((success) => {
          if (success) {
            log(`✅ [SIMPLE-PERSISTENCE] Session updated after removal`);
          }
        });
      }
    }, 100); // Delay for DOM cleanup

    return removed;
  }

  public async switchToTerminal(terminalId: string): Promise<boolean> {
    const result = await this.terminalLifecycleManager.switchToTerminal(terminalId);

    // アクティブターミナルが変更されたらUI境界を更新
    if (result) {
      this.uiManager.updateTerminalBorders(
        terminalId,
        this.terminalLifecycleManager.getAllTerminalContainers()
      );
    }

    return result;
  }

  public writeToTerminal(data: string, terminalId?: string): boolean {
    // CLI Agent activity detection
    const targetId = terminalId || this.getActiveTerminalId();
    if (targetId) {
      const detection = this.cliAgentStateManager.detectAgentActivity(data, targetId);
      if (detection.isAgentOutput) {
        log(`🤖 Agent activity detected: ${detection.agentType} in terminal ${targetId}`);
      }
    }

    return this.terminalLifecycleManager.writeToTerminal(data, terminalId);
  }

  /**
   * 🆕 NEW: Extract scrollback data from a specific terminal
   * Uses SerializeAddon for ANSI color preservation when available
   */
  public extractScrollbackData(terminalId: string, maxLines: number = 1000): string[] {
    log(`🔥 [EXTRACT-DEBUG] === extractScrollbackData called for ${terminalId} ===`);

    try {
      const terminalInstance = this.getTerminalInstance(terminalId);
      log(`🔍 [EXTRACT-DEBUG] Terminal instance found:`, !!terminalInstance);

      if (!terminalInstance || !terminalInstance.terminal) {
        console.warn(`⚠️ [EXTRACT-DEBUG] Terminal ${terminalId} not found or no terminal`);
        return [];
      }

      const terminal = terminalInstance.terminal;
      log(`🔍 [EXTRACT-DEBUG] Terminal details:`, {
        hasBuffer: !!terminal.buffer,
        hasNormalBuffer: !!(terminal.buffer && terminal.buffer.normal),
        hasSerializeAddon: !!terminalInstance.serializeAddon,
      });

      // 🎨 Use SerializeAddon first (preserves ANSI color codes)
      if (terminalInstance.serializeAddon) {
        log('✅ [EXTRACT-DEBUG] Using SerializeAddon for color-preserving scrollback extraction');
        try {
          const serialized = terminalInstance.serializeAddon.serialize({ scrollback: maxLines });
          const lines = serialized.split('\n');

          // Trim trailing empty lines
          while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
            lines.pop();
          }

          log(`📦 [EXTRACT-DEBUG] SerializeAddon extracted ${lines.length} lines with ANSI colors`);
          log('📄 [EXTRACT-DEBUG] First few lines:', lines.slice(0, 3));
          return lines;
        } catch (serializeError) {
          console.warn(
            '⚠️ [EXTRACT-DEBUG] SerializeAddon extraction failed, falling back to buffer:',
            serializeError
          );
        }
      } else {
        log('⚠️ [EXTRACT-DEBUG] SerializeAddon not available - colors will be lost');
      }

      // Fallback: Use buffer method (colors will be lost)
      if (terminal.buffer && terminal.buffer.normal) {
        log('📄 [EXTRACT-DEBUG] Using buffer method for scrollback extraction (plain text)');
        try {
          const buffer = terminal.buffer.normal;
          const lines: string[] = [];

          log(`🔍 [EXTRACT-DEBUG] Buffer length: ${buffer.length}, requesting max: ${maxLines}`);

          const startIndex = Math.max(0, buffer.length - maxLines);
          for (let i = startIndex; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) {
              lines.push(line.translateToString());
            }
          }

          log(`📦 [EXTRACT-DEBUG] Buffer method extracted ${lines.length} lines (plain text)`);
          log('📄 [EXTRACT-DEBUG] First few lines:', lines.slice(0, 3));
          return lines;
        } catch (bufferError) {
          console.warn('⚠️ [EXTRACT-DEBUG] Buffer extraction failed:', bufferError);
        }
      }

      console.warn(
        `⚠️ [EXTRACT-DEBUG] No scrollback extraction method available for terminal ${terminalId}`
      );
      return [];
    } catch (error) {
      console.error(
        `❌ [EXTRACT-DEBUG] Failed to extract scrollback from terminal ${terminalId}:`,
        error
      );
      return [];
    }
  }

  // CLI Agent state management delegation

  public getCliAgentState(terminalId: string) {
    return this.cliAgentStateManager.getAgentState(terminalId);
  }

  public setCliAgentConnected(terminalId: string, agentType: string, terminalName?: string): void {
    this.cliAgentStateManager.setAgentConnected(terminalId, agentType, terminalName);
  }

  public setCliAgentDisconnected(terminalId: string): void {
    this.cliAgentStateManager.setAgentDisconnected(terminalId);
  }

  /**
   * Handle AI Agent toggle button click
   * 🎯 IMPROVED: Properly switches connected agents and moves previous connected to disconnected
   */
  public handleAiAgentToggle(terminalId: string): void {
    log(`📎 AI Agent toggle clicked for terminal: ${terminalId}`);

    try {
      // Get current CLI Agent state for the terminal
      const agentState = this.cliAgentStateManager.getAgentState(terminalId);
      const currentStatus = agentState?.status || 'none';

      log(`📎 Current AI Agent state: ${currentStatus} for terminal: ${terminalId}`);

      if (currentStatus === 'connected') {
        // 🔄 If already connected, treat as manual reset request
        log(
          `🔄 [MANUAL-RESET] Agent already connected, treating as manual reset for terminal: ${terminalId}`
        );
        this.postMessageToExtension({
          command: 'switchAiAgent',
          terminalId,
          action: 'force-reconnect',
          forceReconnect: true,
          agentType: agentState?.agentType || 'claude',
          timestamp: Date.now(),
        });
      } else {
        // 🎯 For disconnected or none state, use normal activation
        // This will properly handle moving previous connected agent to disconnected
        this.postMessageToExtension({
          command: 'switchAiAgent',
          terminalId,
          action: 'activate',
          timestamp: Date.now(),
        });

        log(
          `✅ Sent AI Agent activation request for terminal: ${terminalId} (status: ${currentStatus})`
        );
      }
    } catch (error) {
      log(`❌ Error handling AI Agent toggle for terminal ${terminalId}:`, error);

      // Try fallback activation
      this.postMessageToExtension({
        command: 'switchAiAgent',
        terminalId,
        action: 'activate',
        timestamp: Date.now(),
      });
    }
  }

  // Settings management

  public applySettings(settings: PartialTerminalSettings): void {
    try {
      const activeBorderMode =
        settings.activeBorderMode !== undefined
          ? settings.activeBorderMode
          : (this.currentSettings.activeBorderMode ?? 'multipleOnly');

      this.currentSettings = {
        ...this.currentSettings,
        ...settings,
        activeBorderMode,
      };

      // 🔧 CRITICAL FIX: Update ConfigManager with new settings
      // This ensures new terminals created later will get the correct theme
      if (this.configManager) {
        const instances = this.terminalLifecycleManager.getAllTerminalInstances();
        this.configManager.applySettings(this.currentSettings, instances);
        log(`⚙️ [SETTINGS] ConfigManager updated with theme: ${this.currentSettings.theme}`);
      }

      this.uiManager.setActiveBorderMode(activeBorderMode);
      this.uiManager.setTerminalHeaderEnhancementsEnabled(
        this.currentSettings.enableTerminalHeaderEnhancements !== false
      );

      const activeId = this.getActiveTerminalId();
      if (activeId) {
        const containers = this.terminalLifecycleManager.getAllTerminalContainers();
        if (containers.size > 0) {
          this.uiManager.updateTerminalBorders(activeId, containers);
        } else {
          this.uiManager.updateSplitTerminalBorders(activeId);
        }
      }

      // Apply theme and visual settings to all terminals
      const instances = this.terminalLifecycleManager.getAllTerminalInstances();
      instances.forEach((terminalData, terminalId) => {
        try {
          this.uiManager.applyAllVisualSettings(terminalData.terminal, this.currentSettings);
          log(`⚙️ [SETTINGS] Applied visual settings to terminal ${terminalId}`);
        } catch (error) {
          log(`❌ [SETTINGS] Error applying visual settings to terminal ${terminalId}:`, error);
        }
      });

      log('⚙️ Settings applied:', settings);
    } catch (error) {
      log('❌ Error applying settings:', error);
    }
  }

  /**
   * Update theme for all terminal instances
   * Called when VS Code theme changes and settings.theme is 'auto'
   */
  public updateAllTerminalThemes(theme: TerminalTheme): void {
    try {
      log(`🎨 [THEME] Updating all terminal themes`);

      const terminals = this.splitManager.getTerminals();
      let updatedCount = 0;

      for (const [id, instance] of terminals) {
        if (instance.terminal) {
          // Update xterm.js theme options
          instance.terminal.options.theme = theme;

          // Update container background color
          if (instance.container) {
            instance.container.style.backgroundColor = theme.background;
          }

          // Update xterm.js internal elements for immediate visual update
          const terminalElement = instance.container?.querySelector('.xterm') as HTMLElement;
          if (terminalElement) {
            terminalElement.style.backgroundColor = theme.background;

            // Update viewport background
            const viewport = terminalElement.querySelector('.xterm-viewport') as HTMLElement;
            if (viewport) {
              viewport.style.backgroundColor = theme.background;
            }

            // Update screen background
            const screen = terminalElement.querySelector('.xterm-screen') as HTMLElement;
            if (screen) {
              screen.style.backgroundColor = theme.background;
            }
          }

          updatedCount++;
          log(`🎨 [THEME] Updated theme for terminal: ${id}`);
        }
      }

      // Also update terminal-body and terminals-wrapper backgrounds
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        terminalBody.style.backgroundColor = theme.background;
      }

      const terminalsWrapper = document.getElementById('terminals-wrapper');
      if (terminalsWrapper) {
        terminalsWrapper.style.backgroundColor = theme.background;
      }

      log(`🎨 [THEME] Theme updated for ${updatedCount} terminals`);
    } catch (error) {
      log('❌ Error updating terminal themes:', error);
    }
  }

  /**
   * Apply font settings to all terminals
   *
   * Delegates to FontSettingsService for single source of truth management.
   * This method is the entry point for font settings updates from Extension.
   */
  public applyFontSettings(fontSettings: WebViewFontSettings): void {
    try {
      // Delegate to FontSettingsService (single source of truth)
      const terminals = this.splitManager.getTerminals();
      this.fontSettingsService.updateSettings(fontSettings, terminals);
    } catch (error) {
      log('❌ Error applying font settings:', error);
    }
  }

  /**
   * Get current font settings from FontSettingsService
   */
  public getCurrentFontSettings(): WebViewFontSettings {
    return this.fontSettingsService.getCurrentSettings();
  }

  public loadSettings(): void {
    try {
      const savedState = this.webViewApiManager.loadState() as {
        settings?: PartialTerminalSettings;
        fontSettings?: WebViewFontSettings;
      } | null;

      if (savedState?.settings) {
        this.applySettings(savedState.settings);
      }

      if (savedState?.fontSettings) {
        this.applyFontSettings(savedState.fontSettings);
      }

      log('📂 Settings loaded from WebView state');
    } catch (error) {
      log('❌ Error loading settings:', error);
    }
  }

  public saveSettings(): void {
    try {
      const state = {
        settings: this.currentSettings,
        fontSettings: this.fontSettingsService.getCurrentSettings(),
        timestamp: Date.now(),
      };

      this.webViewApiManager.saveState(state);
      log('💾 Settings saved to WebView state');
    } catch (error) {
      log('❌ Error saving settings:', error);
    }
  }

  // Initialization

  public initializeSimpleTerminal(): void {
    // まずターミナルを初期化
    this.terminalLifecycleManager.initializeSimpleTerminal();

    // 🆕 その後にWebView headerを作成（DOMが準備完了後）
    this.headerManager.createWebViewHeader();

    // 🔧 FIX: Setup parent container ResizeObserver to handle WebView resizing
    // This ensures terminals expand to full width when the panel is resized
    this.setupParentContainerResizeObserver();
  }

  // 🔧 FIX: Store ResizeObserver for cleanup
  private parentResizeObserver: ResizeObserver | null = null;
  private parentResizeTimer: number | null = null;

  /**
   * 🔧 FIX: Setup ResizeObserver on parent container to detect WebView resizing
   * This is critical for terminals to expand beyond their initial size
   */
  private setupParentContainerResizeObserver(): void {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) {
      log('⚠️ terminal-body not found for parent ResizeObserver');
      return;
    }

    log('🔧 Setting up ResizeObserver on document.body, terminal-body, and terminals-wrapper');

    // 🔧 FIX: Single ResizeObserver that watches multiple containers
    // document.body catches WebView panel resize
    // terminal-body catches internal layout changes
    // terminals-wrapper catches split layout changes
    this.parentResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const targetId = (entry.target as HTMLElement).id || 'body';
        log(`📐 [RESIZE] ${targetId} resized: ${width}x${height}`);

        // Debounce the refit
        if (this.parentResizeTimer !== null) {
          window.clearTimeout(this.parentResizeTimer);
        }

        this.parentResizeTimer = window.setTimeout(() => {
          log(`📐 [RESIZE] Triggering refitAllTerminals after debounce`);
          this.refitAllTerminals();
        }, 50); // Reduced debounce for faster response
      }
    });

    // Observe document.body (for WebView resize) and terminal-body (for layout changes)
    this.parentResizeObserver.observe(document.body);
    this.parentResizeObserver.observe(terminalBody);

    // 🔧 FIX: Also observe terminals-wrapper if it exists (may be created later)
    const terminalsWrapper = document.getElementById('terminals-wrapper');
    if (terminalsWrapper) {
      this.parentResizeObserver.observe(terminalsWrapper);
      log('✅ ResizeObserver also observing terminals-wrapper');
    }

    log('✅ ResizeObserver setup complete');
  }

  // Compatibility methods for existing code

  public async handleTerminalRemovedFromExtension(terminalId: string): Promise<void> {
    // ✅ await を追加して確実に削除を完了させる
    const removed = await this.removeTerminal(terminalId);
    if (removed) {
      log(`✅ Terminal cleanup confirmed for ${terminalId}`);
    } else {
      log(`⚠️ Terminal cleanup may have failed for ${terminalId}`);
    }
  }

  public closeTerminal(terminalId?: string): void {
    // 📋 [SPEC] Panel trash button should call killTerminal to delete active terminal
    log(`🗑️ [PANEL] Panel trash button clicked - delegating to killTerminal`);

    void this.deleteTerminalSafely(terminalId);
  }

  public updateState(state: unknown): void {
    try {
      // Type-safe state validation
      if (!state || typeof state !== 'object') {
        log('⚠️ [STATE] Invalid state received:', state);
        return;
      }

      // Type-safe state validation and casting
      const stateObj = state as Record<string, unknown>;
      if (
        !Array.isArray(stateObj.terminals) ||
        !Array.isArray(stateObj.availableSlots) ||
        typeof stateObj.maxTerminals !== 'number'
      ) {
        log('⚠️ [STATE] Invalid state structure:', stateObj);
        return;
      }

      const terminalState = state as TerminalState;
      const isInitialStateSync = !this.hasProcessedInitialState;

      log('🔄 [STATE] Processing state update:', {
        terminals: terminalState.terminals.length,
        availableSlots: terminalState.availableSlots,
        maxTerminals: terminalState.maxTerminals,
        activeTerminalId: terminalState.activeTerminalId,
      });

      // 🎯 [SYNC] Handle deletion synchronization FIRST (delegated to coordinator)
      this.terminalOperations.updateState(terminalState);

      // 1. Update internal state cache
      this.currentTerminalState = {
        terminals: terminalState.terminals,
        activeTerminalId: terminalState.activeTerminalId,
        maxTerminals: terminalState.maxTerminals,
        availableSlots: terminalState.availableSlots,
      };

      // 2. Update UI state immediately
      this.updateUIFromState(this.currentTerminalState);

      // 2.5. 🔧 FIX: Ensure split resizers appear on initial split display
      this.ensureSplitResizersOnInitialDisplay(terminalState, isInitialStateSync);

      // 3. Update terminal creation availability
      this.updateTerminalCreationState();

      // 4. Debug visualization (if enabled)
      this.updateDebugDisplay(this.currentTerminalState);

      // 5. 🔄 [QUEUE] Process any pending creation requests (delegated to coordinator)
      if (this.terminalOperations.hasPendingCreations()) {
        log(
          `🔄 [QUEUE] State updated, processing ${this.terminalOperations.getPendingCreationsCount()} pending requests`
        );
        setTimeout(() => this.terminalOperations.processPendingCreationRequests(), 50);
      }

      this.hasProcessedInitialState = true;
      log('✅ [STATE] State update completed successfully');
    } catch (error) {
      log('❌ [STATE] Error processing state update:', error);
    }
  }

  /**
   * Update UI elements based on current terminal state
   * Delegates to TerminalStateDisplayManager
   */
  private updateUIFromState(state: TerminalState): void {
    this.terminalStateDisplayManager.updateFromState(state);
  }

  /**
   * Ensure split resizers are shown on initial display when split mode is active.
   */
  private ensureSplitResizersOnInitialDisplay(
    state: TerminalState,
    isInitialStateSync: boolean = false
  ): void {
    const displayModeManager = this.displayModeManager;
    if (!displayModeManager || state.terminals.length <= 1) {
      return;
    }

    const terminalsWrapper = document.getElementById('terminals-wrapper');
    const stateTerminalCount = state.terminals.length;
    const domWrapperCount = terminalsWrapper
      ? terminalsWrapper.querySelectorAll('[data-terminal-wrapper-id]').length
      : 0;
    const resizerCount = terminalsWrapper
      ? terminalsWrapper.querySelectorAll('.split-resizer').length
      : document.querySelectorAll('.split-resizer').length;
    const currentMode = displayModeManager.getCurrentMode?.() ?? 'normal';
    const wrapperCount = domWrapperCount > 0 ? domWrapperCount : stateTerminalCount;
    const expectedResizerCount = wrapperCount - 1;
    const resizerLayoutValid = resizerCount === expectedResizerCount;
    const wrapperLayoutValid = domWrapperCount === 0 || domWrapperCount === stateTerminalCount;
    const layoutIsValid = resizerLayoutValid && wrapperLayoutValid;

    if (layoutIsValid) {
      return;
    }

    log(
      `🔧 [SPLIT] Layout mismatch on display - refreshing split layout (state=${stateTerminalCount}, wrappers=${wrapperCount}, resizers=${resizerCount}, expectedResizers=${expectedResizerCount}, mode=${currentMode}, initial=${isInitialStateSync})`
    );
    displayModeManager.showAllTerminalsSplit?.();
    this.updateSplitResizers();
  }

  /**
   * Update terminal creation button state and messaging
   * Delegates to TerminalStateDisplayManager
   */
  private updateTerminalCreationState(): void {
    if (!this.currentTerminalState) {
      return;
    }
    this.terminalStateDisplayManager.updateCreationState(this.currentTerminalState);
  }

  /**
   * Update debug display with current state information
   */
  private updateDebugDisplay(state: TerminalState): void {
    // Use the extended version with operation tracking
    this.updateDebugDisplayExtended(state, 'state-update');
  }

  // Note: updateTerminalCountDisplay, updateAvailableSlotsDisplay, highlightActiveTerminal,
  // setCreateButtonEnabled, clearTerminalLimitMessage moved to TerminalStateDisplayManager

  /**
   * Show terminal limit reached message
   * Kept as wrapper for backward compatibility
   */
  private showTerminalLimitMessage(current: number, max: number): void {
    // Create a temporary state for the display manager
    if (this.currentTerminalState) {
      this.terminalStateDisplayManager.updateCreationState(this.currentTerminalState);
    } else {
      // Fallback: show notification directly
      const message = `Terminal limit reached (${current}/${max}). Delete a terminal to create new ones.`;
      if (this.notificationManager) {
        this.notificationManager.showWarning(message);
      }
    }
  }

  // Note: displayDebugInfo has been moved to DebugPanelManager

  /**
   * 🔄 PUBLIC API: Restore terminal session from Extension data
   * Delegates to SessionRestoreManager for deduplication and actual restoration.
   */
  public async restoreSession(sessionData: SessionData): Promise<boolean> {
    const result = await this.sessionRestoreManager.restoreSession(sessionData);
    return result.success;
  }

  /**
   * Check if session restore is in progress
   */
  public isRestoringSession(): boolean {
    return this.sessionRestoreManager.isRestoringSession();
  }

  /**
   * Set session restore flag
   */
  public setRestoringSession(isRestoring: boolean): void {
    this.sessionRestoreManager.setRestoringSession(isRestoring);
  }

  // Note: updatePerformanceCounters and getSystemUptime moved to DebugPanelManager

  /**
   * Enhanced updateDebugDisplay with operation tracking
   * Delegates to DebugPanelManager
   */
  private updateDebugDisplayExtended(state: TerminalState, operation?: string): void {
    if (operation) {
      log(`🔍 [DEBUG] Display update triggered by: ${operation}`);
    }
    this.debugPanelManager.updateDisplay(state, operation);
  }

  /**
   * Real-time debug panel toggle
   * Delegates to DebugPanelManager
   */
  public toggleDebugPanel(): void {
    this.debugPanelManager.toggle(this.currentTerminalState || undefined);
    // Request state if not available and panel is now active
    if (this.debugPanelManager.isActive() && !this.currentTerminalState) {
      this.requestLatestState();
    }
  }

  /**
   * Export system diagnostics for troubleshooting
   * Delegates to DebugPanelManager
   */
  public exportSystemDiagnostics(): SystemDiagnostics {
    const diagnostics = this.debugPanelManager.exportDiagnostics(
      this.getSystemStatus(),
      this.currentTerminalState?.maxTerminals || 'unknown'
    );
    log('🔧 [DIAGNOSTICS] System diagnostics exported:', diagnostics);
    return diagnostics;
  }

  /**
   * Request latest state from Extension
   */
  public requestLatestState(): void {
    log('📡 [STATE] Requesting latest state from Extension...');

    this.postMessageToExtension({
      command: 'requestState',
      timestamp: Date.now(),
    });
  }

  /**
   * Get current cached state
   */
  public getCurrentCachedState(): TerminalState | null {
    return this.currentTerminalState;
  }

  /**
   * Check if terminal creation is currently allowed
   */
  public canCreateTerminal(): boolean {
    // Delegate to coordinator for consistent state management
    return this.terminalOperations.canCreateTerminal();
  }

  /**
   * Get next available terminal number
   * 委譲: TerminalOperationsCoordinator
   */
  public getNextAvailableNumber(): number | null {
    return this.terminalOperations.getNextAvailableNumber();
  }

  // ========================================
  // 委譲: TerminalOperationsCoordinator
  // ========================================

  /**
   * Queue terminal creation request
   * 委譲: TerminalOperationsCoordinator
   * 🔧 FIX: IDはExtension側で生成されるため、名前のみを受け付ける
   */
  public queueTerminalCreation(terminalName: string): Promise<boolean> {
    return this.terminalOperations.queueTerminalCreation(terminalName);
  }

  /**
   * Smart terminal creation with race condition protection
   * 委譲: TerminalOperationsCoordinator
   */
  public async createTerminalSafely(terminalName?: string): Promise<boolean> {
    return this.terminalOperations.createTerminalSafely(terminalName);
  }

  /**
   * Enhanced terminal deletion with proper cleanup
   * 委譲: TerminalOperationsCoordinator
   */
  public async deleteTerminalSafely(terminalId?: string): Promise<boolean> {
    return this.terminalOperations.deleteTerminalSafely(terminalId);
  }

  private prepareDisplayForTerminalDeletion(
    targetTerminalId: string,
    stats: { totalTerminals: number; activeTerminalId: string | null; terminalIds: string[] }
  ): void {
    try {
      if (!this.displayModeManager) {
        return;
      }
      const currentMode = this.displayModeManager.getCurrentMode();
      if (stats.totalTerminals > 1 && currentMode === 'fullscreen') {
        log(`🖥️ Exiting fullscreen before deleting ${targetTerminalId}`);
        this.displayModeManager.setDisplayMode('split');
      }
    } catch (error) {
      log('⚠️ Failed to prepare display for deletion:', error);
    }
  }

  /**
   * Check if the system is in a safe state for operations
   */
  public isSystemReady(): boolean {
    const hasCachedState = !!this.currentTerminalState;
    const noPendingDeletions = !this.terminalOperations.hasPendingDeletions();
    const noPendingCreations = !this.terminalOperations.hasPendingCreations();
    return hasCachedState && noPendingDeletions && noPendingCreations;
  }

  /**
   * Force system synchronization
   * 委譲: TerminalOperationsCoordinator
   */
  public forceSynchronization(): void {
    this.terminalOperations.forceSynchronization();
    this.requestLatestState();
  }

  /**
   * Public API: Request new terminal creation (safe)
   */
  public async requestNewTerminal(terminalName?: string): Promise<boolean> {
    return await this.createTerminalSafely(terminalName);
  }

  /**
   * Public API: Request terminal deletion (safe)
   */
  public async requestTerminalDeletion(terminalId?: string): Promise<boolean> {
    return await this.deleteTerminalSafely(terminalId);
  }

  /**
   * Public API: Get system status for external monitoring
   */
  public getSystemStatus(): SystemStatusSnapshot {
    return {
      ready: this.isSystemReady(),
      state: this.currentTerminalState,
      pendingOperations: {
        deletions: this.terminalOperations.getPendingDeletions(),
        creations: this.terminalOperations.getPendingCreationsCount(),
      },
    };
  }

  public ensureTerminalFocus(): void {
    const activeId = this.getActiveTerminalId();
    if (activeId) {
      const instance = this.getTerminalInstance(activeId);
      instance?.terminal.focus();
    }
  }

  // CLI Agent状態管理（レガシー互換）
  public updateClaudeStatus(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void {
    log(
      `🔄 [REFACTORED] UpdateClaudeStatus called: ${activeTerminalName}, ${status}, ${agentType}`
    );

    // Terminal名からターミナルIDを特定
    let targetTerminalId = this.getActiveTerminalId();

    if (activeTerminalName) {
      // Terminal名からIDを逆引き
      const allInstances = this.terminalLifecycleManager.getAllTerminalInstances();
      for (const [terminalId, instance] of allInstances) {
        if (instance.name === activeTerminalName) {
          targetTerminalId = terminalId;
          break;
        }
      }
    }

    if (targetTerminalId) {
      // CLI Agent状態を更新
      this.cliAgentStateManager.setAgentState(targetTerminalId, {
        status,
        terminalName: activeTerminalName || `Terminal ${targetTerminalId}`,
        agentType,
      });

      // UI表示を更新
      this.uiManager.updateCliAgentStatusByTerminalId(targetTerminalId, status, agentType);

      log(`✅ [REFACTORED] Claude status updated for terminal: ${targetTerminalId}`);
    } else {
      log(`❌ [REFACTORED] Could not find terminal for: ${activeTerminalName}`);
    }
  }

  public updateCliAgentStatus(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void {
    log(`🔄 [REFACTORED] UpdateCliAgentStatus called: ${terminalId}, ${status}, ${agentType}`);

    // CLI Agent状態を更新
    this.cliAgentStateManager.setAgentState(terminalId, {
      status,
      agentType,
    });

    // UI表示を更新
    this.uiManager.updateCliAgentStatusByTerminalId(terminalId, status, agentType);

    log(`✅ [REFACTORED] CLI Agent status updated for terminal: ${terminalId}`);
  }

  /**
   * バージョン情報を設定
   */
  public setVersionInfo(version: string): void {
    this.versionInfo = version;
    if (this.settingsPanel) {
      this.settingsPanel.setVersionInfo(version);
    }
  }

  public openSettings(): void {
    try {
      if (!this.settingsPanel) {
        log('⚙️ Settings panel not initialized');
        return;
      }

      const baseSettings = this.configManager?.getCurrentSettings?.() ?? this.currentSettings;
      const panelSettings = { ...baseSettings, ...this.currentSettings };

      // バージョン情報を設定
      this.settingsPanel.setVersionInfo(this.versionInfo);
      this.settingsPanel.show(panelSettings);
      log('⚙️ Opening settings panel');
    } catch (error) {
      log('❌ Error opening settings panel:', error);
    }
  }

  // Statistics and diagnostics

  public getManagerStats(): {
    terminals: ReturnType<TerminalLifecycleCoordinator['getTerminalStats']>;
    cliAgents: ReturnType<CliAgentStateManager['getAgentStats']>;
    events: ReturnType<EventHandlerManager['getEventStats']>;
    api: ReturnType<WebViewApiManager['getDiagnostics']>;
  } {
    return {
      terminals: this.terminalLifecycleManager.getTerminalStats(),
      cliAgents: this.cliAgentStateManager.getAgentStats(),
      events: this.eventHandlerManager.getEventStats(),
      api: this.webViewApiManager.getDiagnostics(),
    };
  }

  // Lifecycle management

  public dispose(): void {
    if (!this.isInitialized) {
      return;
    }

    log('🧹 Disposing RefactoredTerminalWebviewManager...');

    try {
      // 設定を保存
      this.saveSettings();

      // 専門マネージャーのクリーンアップ
      this.eventHandlerManager.dispose();
      this.cliAgentStateManager.dispose();
      this.terminalLifecycleManager.dispose();
      this.webViewApiManager.dispose();
      this.findInTerminalManager.dispose();
      this.profileManager.dispose();
      this.terminalTabManager.dispose();

      // 🆕 新規マネージャーのクリーンアップ（Issue #198）
      this.displayModeManager?.dispose();
      this.terminalContainerManager?.dispose();
      this.debugPanelManager?.dispose();
      this.splitResizeManager?.dispose();

      // 既存マネージャーのクリーンアップ
      this.messageManager.dispose();
      this.webViewPersistenceService.dispose();

      // Extracted managers のクリーンアップ
      this.sessionRestoreManager?.dispose();
      this.settingsManager?.dispose();

      // Coordinators のクリーンアップ
      this.terminalOperations.dispose();
      this.resizeCoordinator.dispose();

      this.isInitialized = false;
      log('✅ RefactoredTerminalWebviewManager disposed');
    } catch (error) {
      log('❌ Error disposing RefactoredTerminalWebviewManager:', error);
    }
  }

  // Legacy compatibility getters
  public get terminal(): Terminal | null {
    const activeId = this.getActiveTerminalId();
    if (activeId) {
      const instance = this.getTerminalInstance(activeId);
      return instance?.terminal || null;
    }
    return null;
  }

  public get fitAddon() {
    const activeId = this.getActiveTerminalId();
    if (activeId) {
      const instance = this.getTerminalInstance(activeId);
      return instance?.fitAddon || null;
    }
    return null;
  }

  public get terminalContainer(): HTMLElement | null {
    const activeId = this.getActiveTerminalId();
    if (activeId) {
      const instance = this.getTerminalInstance(activeId);
      return instance?.container || null;
    }
    return null;
  }

  public get activeTerminalId(): string | null {
    return this.getActiveTerminalId();
  }
}
