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
import { CliAgentCoordinator } from '../coordinators/CliAgentCoordinator';
import { DebugCoordinator } from '../coordinators/DebugCoordinator';
import { SettingsCoordinator } from '../coordinators/SettingsCoordinator';
import { TerminalStateCoordinator } from '../coordinators/TerminalStateCoordinator';
import { PanelLocationController } from '../coordinators/PanelLocationController';
import { LightweightTerminalLifecycleCoordinator } from '../coordinators/LightweightTerminalLifecycleCoordinator';
import { LightweightTerminalInitializationCoordinator } from '../coordinators/LightweightTerminalInitializationCoordinator';
import { TerminalAccessorCoordinator } from '../coordinators/TerminalAccessorCoordinator';

// Managers (リファクタリングで抽出)
import { SessionRestoreManager, SessionData } from './SessionRestoreManager';
import { TerminalSettingsManager } from './TerminalSettingsManager';

// Services
import { FontSettingsService } from '../services/FontSettingsService';
import { TerminalAutoSaveService } from '../services/terminal/TerminalAutoSaveService';

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
  private cliAgentCoordinator!: CliAgentCoordinator;
  private debugCoordinator!: DebugCoordinator;
  private settingsCoordinator!: SettingsCoordinator;
  private terminalStateCoordinator!: TerminalStateCoordinator;
  private panelLocationController!: PanelLocationController;
  private lightweightTerminalLifecycleCoordinator!: LightweightTerminalLifecycleCoordinator;
  private lightweightTerminalInitializationCoordinator!: LightweightTerminalInitializationCoordinator;
  private terminalAccessorCoordinator!: TerminalAccessorCoordinator;

  // ========================================
  // 専門マネージャー
  // ========================================
  private webViewApiManager: WebViewApiManager;
  private terminalLifecycleManager: TerminalLifecycleCoordinator;
  private cliAgentStateManager: CliAgentStateManager;
  private eventHandlerManager: EventHandlerManager;
  private _onWindowFocus: (() => void) | null = null;
  private _onWindowBlur: (() => void) | null = null;
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
  private forceNormalModeForNextCreate = false;
  private forceFullscreenModeForNextCreate = false;
  private isInitialized = false;
  private currentTerminalState: TerminalState | null = null;
  private currentSettings: PartialTerminalSettings = {};
  private hasProcessedInitialState = false;
  private profileManagerInitTimer: number | null = null;

  constructor() {
    log('🚀 RefactoredTerminalWebviewManager initializing...');

    // 専門マネージャーの初期化
    this.webViewApiManager = new WebViewApiManager();
    this.splitManager = new SplitManager(this);
    this.terminalLifecycleManager = new TerminalLifecycleCoordinator(this.splitManager, this);
    this.cliAgentStateManager = new CliAgentStateManager();
    this.eventHandlerManager = new EventHandlerManager();
    this.panelLocationController = new PanelLocationController({
      messageManagerUpdatePanelLocationIfNeeded: () =>
        this.messageManager?.updatePanelLocationIfNeeded() ?? false,
      messageManagerGetCurrentPanelLocation: () =>
        this.messageManager?.getCurrentPanelLocation() ?? null,
      messageManagerGetCurrentFlexDirection: () =>
        this.messageManager?.getCurrentFlexDirection() ?? null,
      splitManagerSetPanelLocation: (location) =>
        this.splitManager.setPanelLocation(location),
      splitManagerUpdateSplitDirection: (direction, location) =>
        this.splitManager.updateSplitDirection(direction, location),
      splitManagerGetTerminalCount: () => this.splitManager.getTerminals().size,
      displayModeManagerGetCurrentMode: () => this.displayModeManager?.getCurrentMode() ?? 'normal',
      displayModeManagerShowAllTerminalsSplit: () =>
        this.displayModeManager?.showAllTerminalsSplit(),
    });
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
    this.lightweightTerminalInitializationCoordinator =
      new LightweightTerminalInitializationCoordinator({
        managerCoordinator: this,
        getCurrentSettings: () => this.currentSettings,
        setCurrentSettings: (settings) => {
          this.currentSettings = settings;
        },
        applySettings: (settings) => this.applySettings(settings),
        saveSettings: () => this.saveSettings(),
        ensureTerminalFocus: () => this.ensureTerminalFocus(),
        getAllTerminalInstances: () => this.getAllTerminalInstances(),
        getAllTerminalContainers: () => this.getAllTerminalContainers(),
        getActiveTerminalId: () => this.getActiveTerminalId(),
        getTerminalInstance: (id) => this.getTerminalInstance(id),
        createTerminal: (id, name) => this.createTerminal(id, name),
        getSystemStatus: () => this.getSystemStatus(),
        forceSynchronization: () => this.forceSynchronization(),
        requestLatestState: () => this.requestLatestState(),
        postMessageToExtension: (message) => this.postMessageToExtension(message),
        terminalLifecycleManager: this.terminalLifecycleManager,
        splitManager: this.splitManager,
        findInTerminalManager: this.findInTerminalManager,
        profileManager: this.profileManager,
        shellIntegrationManager: this.shellIntegrationManager,
        displayModeManager: this.displayModeManager,
        terminalContainerManager: this.terminalContainerManager,
        debugPanelManager: this.debugPanelManager,
        fontSettingsService: this.fontSettingsService,
        eventHandlerManager: this.eventHandlerManager,
        scheduleTimeout: (handler, timeout) => window.setTimeout(handler, timeout),
        settingsVersionInfo: () => this.versionInfo,
        disposeManager: () => this.dispose(),
      });
    this.initializeExistingManagers();
    this.initializeAccessorCoordinator();

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

  // Panel location sync is now handled by PanelLocationController (initialized in constructor)

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

    // CliAgentCoordinator
    this.cliAgentCoordinator = new CliAgentCoordinator({
      getAgentState: (id) => this.cliAgentStateManager.getAgentState(id),
      setAgentConnected: (id, agentType, terminalName) =>
        this.cliAgentStateManager.setAgentConnected(id, agentType, terminalName),
      setAgentDisconnected: (id) => this.cliAgentStateManager.setAgentDisconnected(id),
      setAgentState: (id, state) => this.cliAgentStateManager.setAgentState(id, state),
      removeTerminalState: (id) => this.cliAgentStateManager.removeTerminalState(id),
      detectAgentActivity: (output, id) => this.cliAgentStateManager.detectAgentActivity(output, id),
      getActiveTerminalId: () => this.getActiveTerminalId(),
      getAllTerminalInstances: () => this.getAllTerminalInstances(),
      postMessageToExtension: (msg) => this.postMessageToExtension(msg),
      updateCliAgentStatusUI: (id, status, agentType) =>
        this.uiManager.updateCliAgentStatusByTerminalId(id, status, agentType),
      getAgentStats: () => this.cliAgentStateManager.getAgentStats(),
      disposeStateManager: () => this.cliAgentStateManager.dispose(),
    });

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
      ensureSplitModeBeforeCreation: () =>
        this.lightweightTerminalLifecycleCoordinator.ensureSplitModeBeforeCreation(),
      refreshSplitLayout: () => this.displayModeManager?.showAllTerminalsSplit(),
      prepareDisplayForDeletion: (id, stats) =>
        this.lightweightTerminalLifecycleCoordinator.prepareDisplayForTerminalDeletion(id, stats),
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
      removeCliAgentState: (id) => this.cliAgentCoordinator.removeTerminalState(id),
    });

    // DebugCoordinator
    this.debugCoordinator = new DebugCoordinator({
      debugPanelManager: this.debugPanelManager,
      getSystemStatus: () => this.getSystemStatus(),
      requestLatestState: () => this.requestLatestState(),
      getTerminalStats: () => this.terminalLifecycleManager.getTerminalStats(),
      getAgentStats: () => this.cliAgentCoordinator.getAgentStats(),
      getEventStats: () => this.eventHandlerManager.getEventStats(),
      getApiDiagnostics: () => this.webViewApiManager.getDiagnostics(),
      showWarning: (msg) => this.notificationManager?.showWarning(msg),
      notificationManager: this.notificationManager,
    });

    // SettingsCoordinator
    this.settingsCoordinator = new SettingsCoordinator({
      getCurrentSettings: () => this.currentSettings,
      setCurrentSettings: (settings) => {
        this.currentSettings = settings;
      },
      configManagerApplySettings: (settings, instances) =>
        this.configManager.applySettings(settings, instances),
      configManagerGetCurrentSettings: () =>
        this.configManager?.getCurrentSettings?.() ?? this.currentSettings,
      hasConfigManager: () => !!this.configManager,
      getAllTerminalInstances: () => this.terminalLifecycleManager.getAllTerminalInstances(),
      getAllTerminalContainers: () => this.terminalLifecycleManager.getAllTerminalContainers(),
      getSplitTerminals: () => this.splitManager.getTerminals(),
      setActiveBorderMode: (mode) => this.uiManager.setActiveBorderMode(mode),
      setTerminalHeaderEnhancementsEnabled: (enabled) =>
        this.uiManager.setTerminalHeaderEnhancementsEnabled(enabled),
      updateTerminalBorders: (activeId, containers) =>
        this.uiManager.updateTerminalBorders(activeId, containers),
      updateSplitTerminalBorders: (activeId) =>
        this.uiManager.updateSplitTerminalBorders(activeId),
      applyAllVisualSettings: (terminal, settings) =>
        this.uiManager.applyAllVisualSettings(terminal as any, settings),
      fontSettingsUpdateSettings: (fontSettings, terminals) =>
        this.fontSettingsService.updateSettings(fontSettings, terminals),
      fontSettingsGetCurrentSettings: () => this.fontSettingsService.getCurrentSettings(),
      loadState: () =>
        this.webViewApiManager.loadState() as {
          settings?: PartialTerminalSettings;
          fontSettings?: WebViewFontSettings;
        } | null,
      saveState: (state) => this.webViewApiManager.saveState(state),
      getActiveTerminalId: () => this.getActiveTerminalId(),
      hasSettingsPanel: () => !!this.settingsPanel,
      settingsPanelSetVersionInfo: (version) => this.settingsPanel.setVersionInfo(version),
      settingsPanelShow: (settings) => this.settingsPanel.show(settings),
      getVersionInfo: () => this.versionInfo,
    });

    // TerminalStateCoordinator
    this.terminalStateCoordinator = new TerminalStateCoordinator({
      getCurrentTerminalState: () => this.currentTerminalState,
      setCurrentTerminalState: (state) => {
        this.currentTerminalState = state;
      },
      getHasProcessedInitialState: () => this.hasProcessedInitialState,
      setHasProcessedInitialState: (value) => {
        this.hasProcessedInitialState = value;
      },
      terminalOperationsUpdateState: (state) => this.terminalOperations.updateState(state),
      hasPendingCreations: () => this.terminalOperations.hasPendingCreations(),
      getPendingCreationsCount: () => this.terminalOperations.getPendingCreationsCount(),
      processPendingCreationRequests: () => this.terminalOperations.processPendingCreationRequests(),
      hasPendingDeletions: () => this.terminalOperations.hasPendingDeletions(),
      getPendingDeletions: () => this.terminalOperations.getPendingDeletions(),
      updateFromState: (state) => this.terminalStateDisplayManager.updateFromState(state),
      updateCreationState: (state) =>
        this.terminalStateDisplayManager.updateCreationState(state),
      debugUpdateDisplay: (state, source) =>
        this.debugCoordinator.updateDebugDisplay(state, source),
      debugShowTerminalLimitMessage: (current, max) =>
        this.debugCoordinator.showTerminalLimitMessage(current, max),
      ensureSplitResizersOnInitialDisplay: (state, isInitial) =>
        this.ensureSplitResizersOnInitialDisplay(state, isInitial),
      postMessageToExtension: (msg) => this.postMessageToExtension(msg),
    });

    this.lightweightTerminalLifecycleCoordinator = new LightweightTerminalLifecycleCoordinator({
      terminalOperations: this.terminalOperations,
      terminalLifecycleManager: this.terminalLifecycleManager,
      terminalTabManager: this.terminalTabManager,
      webViewPersistenceService: this.webViewPersistenceService,
      splitManager: this.splitManager,
      displayModeManager: this.displayModeManager,
      uiManager: this.uiManager,
      cliAgentStateManager: this.cliAgentStateManager,
      performanceManager: this.performanceManager,
      getTerminalInstance: (id) => this.getTerminalInstance(id),
      getActiveTerminalId: () => this.getActiveTerminalId(),
      setActiveTerminalId: (id) => this.setActiveTerminalId(id),
      canCreateTerminal: () => this.canCreateTerminal(),
      getCurrentTerminalState: () => this.currentTerminalState,
      getForceNormalModeForNextCreate: () => this.forceNormalModeForNextCreate,
      setForceNormalModeForNextCreate: (enabled) => {
        this.forceNormalModeForNextCreate = enabled;
      },
      getForceFullscreenModeForNextCreate: () => this.forceFullscreenModeForNextCreate,
      setForceFullscreenModeForNextCreate: (enabled) => {
        this.forceFullscreenModeForNextCreate = enabled;
      },
      requestLatestState: () => this.requestLatestState(),
      showTerminalLimitMessage: (current, max) => this.showTerminalLimitMessage(current, max),
      postMessageToExtension: (message) => this.postMessageToExtension(message),
    });

    log('✅ Coordinators initialized');
  }

  /**
   * SplitResizeManager の初期化
   */
  private initializeSplitResizeManager(): void {
    this.splitResizeManager = new SplitResizeManager({
      onResizeComplete: () => this.refitAllTerminals(),
      getSplitDirection: () => this.splitManager.getSplitDirection(),
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
      this.splitResizeManager.reinitialize([]);
      return;
    }

    const resizers = Array.from(
      terminalsWrapper.querySelectorAll<HTMLElement>('.split-resizer, .grid-row-resizer')
    );

    this.splitResizeManager.reinitialize(resizers);
  }

  /**
   * 既存マネージャーの初期化（段階的移行のため）
   */
  private initializeExistingManagers(): void {
    const initializedManagers =
      this.lightweightTerminalInitializationCoordinator.initializeExistingManagers();

    this.settingsPanel = initializedManagers.settingsPanel;
    this.notificationManager = initializedManagers.notificationManager;
    this.performanceManager = initializedManagers.performanceManager;
    this.uiManager = initializedManagers.uiManager;
    this.terminalTabManager = initializedManagers.terminalTabManager;
    this.inputManager = initializedManagers.inputManager;
    this.configManager = initializedManagers.configManager;
    this.webViewPersistenceService = initializedManagers.webViewPersistenceService;
    this.persistenceManager = initializedManagers.persistenceManager;
    this.messageManager = initializedManagers.messageManager;
    this.terminalStateDisplayManager = initializedManagers.terminalStateDisplayManager;
    this.sessionRestoreManager = initializedManagers.sessionRestoreManager;
    this.settingsManager = initializedManagers.settingsManager;
    this.profileManagerInitTimer = initializedManagers.profileManagerInitTimer;

    log('✅ All managers initialized');
  }

  private initializeAccessorCoordinator(): void {
    this.terminalAccessorCoordinator = new TerminalAccessorCoordinator({
      getActiveTerminalId: () => this.terminalLifecycleManager.getActiveTerminalId(),
      getTerminalInstance: (id) => this.terminalLifecycleManager.getTerminalInstance(id),
      getAllTerminalInstances: () => this.terminalLifecycleManager.getAllTerminalInstances(),
      getAllTerminalContainers: () => this.terminalLifecycleManager.getAllTerminalContainers(),
      getTerminalElement: (id) => this.terminalLifecycleManager.getTerminalElement(id),
      managers: {
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
      },
      splitManager: this.splitManager,
    });
  }

  /**
   * 入力マネージャーの完全な設定
   */
  private setupInputManager(): void {
    this.lightweightTerminalInitializationCoordinator.setupInputManager(this.inputManager);
  }

  /**
   * イベントハンドラーの設定
   * リサイズ処理はResizeCoordinatorに委譲
   */
  private setupEventHandlers(): void {
    const handlers =
      this.lightweightTerminalInitializationCoordinator.setupEventHandlers(
        this.messageManager
      );
    this._onWindowFocus = handlers.onWindowFocus;
    this._onWindowBlur = handlers.onWindowBlur;
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
          this.webViewPersistenceService
            .saveSession()
            .then((success) => {
              if (success) {
                log(`💾 [SIMPLE-PERSISTENCE] Session saved after active terminal change`);
              }
            })
            .catch((error) => {
              console.error(
                'Failed to save session after active terminal change',
                { terminalId },
                error
              );
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
    return this.terminalAccessorCoordinator.getTerminalInstance(terminalId);
  }

  public getSerializeAddon(
    terminalId: string
  ): import('@xterm/addon-serialize').SerializeAddon | undefined {
    return this.terminalAccessorCoordinator.getSerializeAddon(terminalId);
  }

  public getAllTerminalInstances(): Map<string, TerminalInstance> {
    return this.terminalAccessorCoordinator.getAllTerminalInstances();
  }

  public getAllTerminalContainers(): Map<string, HTMLElement> {
    return this.terminalAccessorCoordinator.getAllTerminalContainers();
  }

  public getTerminalElement(terminalId: string): HTMLElement | undefined {
    return this.terminalAccessorCoordinator.getTerminalElement(terminalId);
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
    return this.terminalAccessorCoordinator.getManagers();
  }

  public getMessageManager(): IMessageManager {
    return this.terminalAccessorCoordinator.getMessageManager();
  }

  // 🆕 Getters for new managers
  public getTerminalContainerManager(): ITerminalContainerManager {
    return this.terminalAccessorCoordinator.getTerminalContainerManager();
  }

  public getDisplayModeManager(): IDisplayModeManager {
    return this.terminalAccessorCoordinator.getDisplayModeManager();
  }

  public getSplitManager(): SplitManager {
    return this.terminalAccessorCoordinator.getSplitManager();
  }

  /**
   * 🎯 PUBLIC API: Update panel location and flex-direction if changed
   * Delegates to ConsolidatedMessageManager → PanelLocationHandler
   * Single entry point for layout updates (VS Code pattern)
   *
   * @returns true if layout was updated, false if no change
   */
  public updatePanelLocationIfNeeded(): boolean {
    return this.panelLocationController.updatePanelLocationIfNeeded();
  }

  /**
   * Get current panel location
   */
  public getCurrentPanelLocation(): 'sidebar' | 'panel' | null {
    return this.panelLocationController.getCurrentPanelLocation();
  }

  /**
   * Get current flex-direction
   */
  public getCurrentFlexDirection(): 'row' | 'column' | null {
    return this.panelLocationController.getCurrentFlexDirection();
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
    terminalNumber?: number,
    requestSource: 'webview' | 'extension' = 'webview'
  ): Promise<Terminal | null> {
    return this.lightweightTerminalLifecycleCoordinator.createTerminal({
      terminalId,
      terminalName,
      config,
      terminalNumber,
      requestSource,
    });
  }

  public async removeTerminal(terminalId: string): Promise<boolean> {
    return this.lightweightTerminalLifecycleCoordinator.removeTerminal(terminalId);
  }

  public async switchToTerminal(terminalId: string): Promise<boolean> {
    return this.lightweightTerminalLifecycleCoordinator.switchToTerminal(terminalId);
  }

  public writeToTerminal(data: string, terminalId?: string): boolean {
    // CLI Agent activity detection
    const targetId = terminalId || this.getActiveTerminalId();
    if (targetId) {
      const detection = this.cliAgentCoordinator.detectAgentActivity(data, targetId);
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

  // CLI Agent state management delegation (via CliAgentCoordinator)

  public getCliAgentState(terminalId: string) {
    return this.cliAgentCoordinator.getCliAgentState(terminalId);
  }

  public setCliAgentConnected(terminalId: string, agentType: string, terminalName?: string): void {
    this.cliAgentCoordinator.setCliAgentConnected(terminalId, agentType, terminalName);
  }

  public setCliAgentDisconnected(terminalId: string): void {
    this.cliAgentCoordinator.setCliAgentDisconnected(terminalId);
  }

  /**
   * Handle AI Agent toggle button click
   * Delegates to CliAgentCoordinator
   */
  public handleAiAgentToggle(terminalId: string): void {
    this.cliAgentCoordinator.handleAiAgentToggle(terminalId);
  }

  // Settings management
  // Delegates to SettingsCoordinator

  public applySettings(settings: PartialTerminalSettings): void {
    this.settingsCoordinator.applySettings(settings);
  }

  /**
   * Update theme for all terminal instances
   * Called when VS Code theme changes and settings.theme is 'auto'
   * Delegates to SettingsCoordinator
   */
  public updateAllTerminalThemes(theme: TerminalTheme): void {
    this.settingsCoordinator.updateAllTerminalThemes(theme);
  }

  /**
   * Apply font settings to all terminals
   * Delegates to SettingsCoordinator
   */
  public applyFontSettings(fontSettings: WebViewFontSettings): void {
    this.settingsCoordinator.applyFontSettings(fontSettings);
  }

  /**
   * Get current font settings from SettingsCoordinator
   */
  public getCurrentFontSettings(): WebViewFontSettings {
    return this.settingsCoordinator.getCurrentFontSettings();
  }

  public loadSettings(): void {
    this.settingsCoordinator.loadSettings();
  }

  public saveSettings(): void {
    this.settingsCoordinator.saveSettings();
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
    await this.lightweightTerminalLifecycleCoordinator.handleTerminalRemovedFromExtension(
      terminalId
    );
  }

  public closeTerminal(terminalId?: string): void {
    // 📋 [SPEC] Panel trash button should call killTerminal to delete active terminal
    log(`🗑️ [PANEL] Panel trash button clicked - delegating to killTerminal`);

    void this.deleteTerminalSafely(terminalId);
  }

  public updateState(state: unknown): void {
    this.terminalStateCoordinator.updateState(state);
  }

  /**
   * Update UI elements based on current terminal state
   * Delegates to TerminalStateCoordinator
   */
  private updateUIFromState(state: TerminalState): void {
    this.terminalStateCoordinator.updateUIFromState(state);
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

    const currentMode = displayModeManager.getCurrentMode?.() ?? 'normal';

    // 🔧 FIX: If we are in fullscreen mode, we intentionally have no split resizers.
    // Do not trigger a split layout refresh in this case, as it would kick the user out of fullscreen.
    if (currentMode === 'fullscreen') {
      return;
    }

    const terminalsWrapper = document.getElementById('terminals-wrapper');
    const stateTerminalCount = state.terminals.length;
    const domWrapperCount = terminalsWrapper
      ? terminalsWrapper.querySelectorAll('[data-terminal-wrapper-id]').length
      : 0;
    const isGridLayout = terminalsWrapper?.classList.contains('terminal-grid-layout') ?? false;
    const resizerCount = terminalsWrapper
      ? terminalsWrapper.querySelectorAll('.split-resizer').length
      : document.querySelectorAll('.split-resizer').length;
    const gridResizerCount = terminalsWrapper
      ? terminalsWrapper.querySelectorAll('.grid-row-resizer').length
      : 0;
    const wrapperCount = domWrapperCount > 0 ? domWrapperCount : stateTerminalCount;

    const expectedResizerCount = isGridLayout ? 0 : wrapperCount - 1;
    let layoutIsValid: boolean;
    if (isGridLayout) {
      // In grid mode: wrappers should match terminal count, one grid-row-resizer
      const wrapperLayoutValid = domWrapperCount === 0 || domWrapperCount === stateTerminalCount;
      layoutIsValid = wrapperLayoutValid && gridResizerCount === 1;
    } else {
      const resizerLayoutValid = resizerCount === expectedResizerCount;
      const wrapperLayoutValid = domWrapperCount === 0 || domWrapperCount === stateTerminalCount;
      layoutIsValid = resizerLayoutValid && wrapperLayoutValid;
    }

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
   * Delegates to TerminalStateCoordinator
   */
  private updateTerminalCreationState(): void {
    this.terminalStateCoordinator.updateTerminalCreationState();
  }

  /**
   * Update debug display with current state information
   * Delegates to TerminalStateCoordinator
   */
  private updateDebugDisplay(state: TerminalState): void {
    this.terminalStateCoordinator.updateDebugDisplay(state);
  }

  /**
   * Show terminal limit reached message
   * Delegates to TerminalStateCoordinator
   */
  private showTerminalLimitMessage(current: number, max: number): void {
    this.terminalStateCoordinator.showTerminalLimitMessage(current, max);
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
   * Real-time debug panel toggle
   * Delegates to DebugCoordinator
   */
  public toggleDebugPanel(): void {
    this.debugCoordinator.toggleDebugPanel(this.currentTerminalState || undefined);
  }

  /**
   * Export system diagnostics for troubleshooting
   * Delegates to DebugCoordinator
   */
  public exportSystemDiagnostics(): SystemDiagnostics {
    return this.debugCoordinator.exportSystemDiagnostics(
      this.currentTerminalState?.maxTerminals || 'unknown'
    );
  }

  /**
   * Request latest state from Extension
   * Delegates to TerminalStateCoordinator
   */
  public requestLatestState(): void {
    this.terminalStateCoordinator.requestLatestState();
  }

  /**
   * Get current cached state
   * Delegates to TerminalStateCoordinator
   */
  public getCurrentCachedState(): TerminalState | null {
    return this.terminalStateCoordinator.getCurrentCachedState();
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

  /**
   * Check if the system is in a safe state for operations
   * Delegates to TerminalStateCoordinator
   */
  public isSystemReady(): boolean {
    return this.terminalStateCoordinator.isSystemReady();
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
   * Delegates to TerminalStateCoordinator
   */
  public getSystemStatus(): SystemStatusSnapshot {
    return this.terminalStateCoordinator.getSystemStatus();
  }

  public ensureTerminalFocus(terminalId?: string): void {
    this.lightweightTerminalLifecycleCoordinator.ensureTerminalFocus(terminalId);
  }

  // CLI Agent状態管理（レガシー互換 - CliAgentCoordinator経由）
  public updateClaudeStatus(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void {
    this.cliAgentCoordinator.updateClaudeStatus(activeTerminalName, status, agentType);
  }

  public updateCliAgentStatus(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void {
    this.cliAgentCoordinator.updateCliAgentStatus(terminalId, status, agentType);
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

  /**
   * Open settings panel
   * Delegates to SettingsCoordinator
   */
  public openSettings(): void {
    this.settingsCoordinator.openSettings();
  }

  // Statistics and diagnostics

  public getManagerStats() {
    return this.debugCoordinator.getManagerStats();
  }

  // Lifecycle management

  public dispose(): void {
    if (!this.isInitialized) {
      return;
    }

    log('🧹 Disposing RefactoredTerminalWebviewManager...');

    try {
      if (this.profileManagerInitTimer !== null) {
        window.clearTimeout(this.profileManagerInitTimer);
        this.profileManagerInitTimer = null;
      }

      // 設定を保存
      this.saveSettings();

      // Window focus/blur listeners cleanup
      if (this._onWindowFocus) {
        window.removeEventListener('focus', this._onWindowFocus);
        this._onWindowFocus = null;
      }
      if (this._onWindowBlur) {
        window.removeEventListener('blur', this._onWindowBlur);
        this._onWindowBlur = null;
      }

      // 専門マネージャーのクリーンアップ
      this.eventHandlerManager.dispose();
      this.cliAgentCoordinator.dispose();
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
      // Note: cliAgentCoordinator and debugCoordinator are lightweight wrappers
      // and don't own resources to dispose

      this.isInitialized = false;
      log('✅ RefactoredTerminalWebviewManager disposed');
    } catch (error) {
      log('❌ Error disposing RefactoredTerminalWebviewManager:', error);
    } finally {
      // Always clean up static state even if dispose partially fails
      TerminalAutoSaveService.disposeAll();
    }
  }

  // Legacy compatibility getters
  public get terminal(): Terminal | null {
    return this.terminalAccessorCoordinator.getTerminal();
  }

  public get fitAddon() {
    return this.terminalAccessorCoordinator.getFitAddon();
  }

  public get terminalContainer(): HTMLElement | null {
    return this.terminalAccessorCoordinator.getTerminalContainer();
  }

  public get activeTerminalId(): string | null {
    return this.terminalAccessorCoordinator.getActiveTerminalIdValue();
  }
}
