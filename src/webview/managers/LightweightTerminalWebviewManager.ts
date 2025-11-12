/**
 * Lightweight Terminal WebView Manager
 *
 * 責務分離による軽量化されたWebViewマネージャー
 * 協調パターンを使用して各専門マネージャーを統合
 *
 * 元のTerminalWebviewManager（2,153行）から300行以下に大幅削減
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
// Removed unused imports: TerminalInteractionEvent, WebviewMessage
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
} from '../interfaces/ManagerInterfaces';

// Debug info interface
interface DebugInfo {
  totalCount: number;
  maxTerminals: number;
  availableSlots: number[];
  activeTerminalId: string | null;
  terminals: Array<{
    id: string;
    isActive: boolean;
  }>;
  timestamp: number;
  operation?: string;
}

interface ScrollbackRequestMessage {
  command: 'extractScrollbackData';
  terminalId?: string;
  requestId?: string;
  maxLines?: number;
}

interface SystemStatusSnapshot {
  ready: boolean;
  state: TerminalState | null;
  pendingOperations: {
    deletions: string[];
    creations: number;
  };
}

interface DebugCounters {
  stateUpdates: number;
  lastSync: string;
  systemStartTime: number;
}

interface SystemDiagnostics {
  timestamp: string;
  systemStatus: SystemStatusSnapshot;
  performanceCounters: DebugCounters;
  configuration: {
    debugMode: boolean;
    maxTerminals: number | 'unknown';
  };
  extensionCommunication: {
    lastStateRequest: string;
    messageQueueStatus: string;
  };
  troubleshootingInfo: {
    userAgent: string;
    platform: string;
    language: string;
    cookieEnabled: boolean;
    onLine: boolean;
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

/**
 * 軽量化されたTerminalWebviewManager
 *
 * 主な改善点：
 * - 責務分離による専門マネージャー協調
 * - 2,153行から300行以下への大幅削減
 * - 協調パターンによる疎結合設計
 * - 拡張性とメンテナンス性の向上
 */
export class LightweightTerminalWebviewManager implements IManagerCoordinator {
  // 専門マネージャーの協調
  private webViewApiManager: WebViewApiManager;
  private terminalLifecycleManager: TerminalLifecycleCoordinator;
  private cliAgentStateManager: CliAgentStateManager;
  private eventHandlerManager: EventHandlerManager;
  public shellIntegrationManager: IShellIntegrationBridge;
  public findInTerminalManager: FindInTerminalManager;
  public profileManager: ProfileManager;

  public terminalTabManager!: TerminalTabManager;

  // 🆕 新規マネージャー（Issue #198用）
  private terminalContainerManager!: TerminalContainerManager;
  private displayModeManager!: DisplayModeManager;
  private headerManager!: HeaderManager;

  // 既存マネージャー（段階的移行）
  public splitManager: SplitManager;
  private settingsPanel!: SettingsPanel;
  private notificationManager!: NotificationManager;
  private configManager!: ConfigManager;
  private performanceManager!: PerformanceManager;
  private uiManager!: UIManager;
  public inputManager!: InputManager;
  public messageManager!: ConsolidatedMessageManager;
  public persistenceManager: WebViewPersistenceService | null = null;
  public webViewPersistenceService!: WebViewPersistenceService;

  // バージョン情報
  private versionInfo: string = 'v0.1.0';

  // Split mode transition coordination
  private pendingSplitTransition: Promise<void> | null = null;
  private pendingTerminalCreations = new Set<string>();

  // 設定管理
  private currentSettings: PartialTerminalSettings = {
    theme: 'auto',
    cursorBlink: true,
    altClickMovesCursor: true,
    multiCursorModifier: 'alt',
    highlightActiveBorder: true,
  };

  private currentFontSettings: WebViewFontSettings = {
    fontSize: 14,
    fontFamily: 'monospace',
  };

  // 初期化状態
  private isInitialized = false;
  private isComposing = false;

  // Track processed scrollback requests to prevent duplicates
  private processedScrollbackRequests = new Set<string>();

  // Flag to prevent terminal clear during session restore
  private _isRestoringSession = false;

  constructor() {
    log('🚀 RefactoredTerminalWebviewManager initializing...');

    // 専門マネージャーの初期化
    this.webViewApiManager = new WebViewApiManager();
    this.splitManager = new SplitManager();
    this.splitManager.setCoordinator(this);
    this.terminalLifecycleManager = new TerminalLifecycleCoordinator(this.splitManager, this);
    this.cliAgentStateManager = new CliAgentStateManager();
    this.eventHandlerManager = new EventHandlerManager();
    this.findInTerminalManager = new FindInTerminalManager();
    this.profileManager = new ProfileManager();
    try {
      this.shellIntegrationManager = new ShellIntegrationManager();
    } catch (error) {
      console.error('Failed to initialize ShellIntegrationManager:', error);
      this.shellIntegrationManager = NOOP_SHELL_INTEGRATION_MANAGER;
    }

    // HeaderManager（AI Status表示に必要）
    this.headerManager = new HeaderManager();
    this.headerManager.setCoordinator(this);

    // 🆕 DisplayModeManager と TerminalContainerManager の実体化（Issue #198）
    this.terminalContainerManager = new TerminalContainerManager();
    this.terminalContainerManager.setCoordinator(this);

    this.displayModeManager = new DisplayModeManager();
    this.displayModeManager.setCoordinator(this);

    log('✅ All managers initialized');

    // 既存マネージャーの初期化
    this.initializeExistingManagers();

    // 設定読み込み
    this.loadSettings();

    // イベントハンドラーの設定
    this.setupEventHandlers();

    // 🔧 Setup InputManager (keyboard shortcuts, IME, Alt+Click)
    this.setupInputManager();

    // 🆕 NEW: Setup scrollback extraction message listener
    this.setupScrollbackMessageListener();

    this.isInitialized = true;
    log('✅ RefactoredTerminalWebviewManager initialized');
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

    // UI Manager
    this.uiManager = new UIManager();
    this.uiManager.setHighlightActiveBorder(this.currentSettings.highlightActiveBorder ?? true);

    // Terminal Tab Manager
    this.terminalTabManager = new TerminalTabManager();
    this.terminalTabManager.setCoordinator(this);

    // Input Manager - 重要：入力機能のために必須
    this.inputManager = new InputManager();
    this.inputManager.setCoordinator(this); // 🔧 Set coordinator for clipboard operations
    this.inputManager.initialize(); // 🔧 Initialize InputManager to register keyboard listeners

    // Config Manager
    this.configManager = new ConfigManager();

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
   */
  private setupEventHandlers(): void {
    // メッセージイベント
    this.eventHandlerManager.setMessageEventHandler(async (event) => {
      // 🔍 DEBUG: Track message reception at the highest level
      log(`🔍 [DEBUG] WebView received message event:`, {
        type: event.type,
        origin: event.origin,
        hasData: !!event.data,
        dataType: typeof event.data,
        dataCommand: event.data?.command,
        timestamp: Date.now(),
      });

      // 🔍 FIX: Pass event.data as the message content, not the full event
      await this.messageManager.receiveMessage(event.data, this);
    });

    // Local UI events
    document.addEventListener('settings-open-requested' as keyof DocumentEventMap, () => {
      this.openSettings();
    });

    // VS Code pattern: ResizeObserver handles individual terminal container resizing
    // Window resize events are no longer needed as ResizeObserver provides more precise detection
    log('🔍 Using ResizeObserver pattern instead of window resize events');

    // ページライフサイクル
    this.eventHandlerManager.onPageUnload(() => {
      this.dispose();
    });

    log('🎭 Event handlers configured');
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

  public getSerializeAddon(terminalId: string): import('@xterm/addon-serialize').SerializeAddon | undefined {
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
    persistence: WebViewPersistenceService | null;
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
      persistence: this.persistenceManager,
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

  /**
   * Check if session restore is in progress
   */
  public isRestoringSession(): boolean {
    return this._isRestoringSession;
  }

  /**
   * Set session restore flag
   */
  public setRestoringSession(isRestoring: boolean): void {
    this._isRestoringSession = isRestoring;
    log(`🔄 [SESSION-RESTORE] isRestoringSession set to: ${isRestoring}`);
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

      if (this.pendingTerminalCreations.has(terminalId)) {
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

      await this.ensureSplitModeBeforeTerminalCreation();

      const canCreate = this.canCreateTerminal();
      if (!canCreate && requestSource !== 'extension') {
        const localCount = this.splitManager?.getTerminals()?.size ?? 0;
        const maxCount =
          this.currentTerminalState?.maxTerminals ?? SPLIT_CONSTANTS.MAX_TERMINALS ?? 5;
        log(
          `❌ [STATE] Terminal creation blocked (local count=${localCount}, max=${maxCount})`
        );
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

      this.pendingTerminalCreations.add(terminalId);

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

      // 🆕 SIMPLE: Save current session state after terminal creation
      // No complex serialization - just session metadata
      setTimeout(() => {
        if (this.webViewPersistenceService) {
          log(
            `💾 [SIMPLE-PERSISTENCE] Saving session after terminal ${terminalId} creation`
          );
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
      const shouldMaintainSplitLayout = currentMode === 'split' || splitManagerActive;

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
        if (shouldMaintainSplitLayout) {
          try {
            this.displayModeManager?.showAllTerminalsSplit();
            log(`🔄 [SPLIT] Refreshed split layout after resize`);
          } catch (layoutError) {
            log(`⚠️ [SPLIT] Failed to refresh split layout after resize: ${layoutError}`);
          }
        }
      }, 150);

      return terminal;
    } catch (error) {
      log(`❌ Error creating terminal ${terminalId}:`, error);
      return null;
    } finally {
      this.pendingTerminalCreations.delete(terminalId);
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
    // CLI Agent状態もクリーンアップ
    this.cliAgentStateManager.removeTerminalState(terminalId);

    // 🆕 SIMPLE: Update session state after terminal removal
    setTimeout(() => {
      if (this.webViewPersistenceService) {
        log(
          `💾 [SIMPLE-PERSISTENCE] Updating session after terminal ${terminalId} removal`
        );
        this.webViewPersistenceService.saveSession().then((success) => {
          if (success) {
            log(`✅ [SIMPLE-PERSISTENCE] Session updated after removal`);
          }
        });
      }
    }, 100); // Delay for DOM cleanup

    const removed = await this.terminalLifecycleManager.removeTerminal(terminalId);
    if (removed && this.terminalTabManager) {
      this.terminalTabManager.removeTab(terminalId);
    }
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
      });

      // Use buffer method for scrollback extraction
      if (terminal.buffer && terminal.buffer.normal) {
        log('📄 [EXTRACT-DEBUG] Using buffer method for scrollback extraction');
        try {
          const buffer = terminal.buffer.normal;
          const lines: string[] = [];

          log(
            `🔍 [EXTRACT-DEBUG] Buffer length: ${buffer.length}, requesting max: ${maxLines}`
          );

          const startIndex = Math.max(0, buffer.length - maxLines);
          for (let i = startIndex; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) {
              lines.push(line.translateToString());
            }
          }

          log(`📦 [EXTRACT-DEBUG] Buffer method extracted ${lines.length} lines`);
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

  /**
   * Setup scrollback extraction message listener
   * NOTE: This is now handled by ConsolidatedMessageManager to avoid duplicate listeners
   */
  private setupScrollbackMessageListener(): void {
    // Removed: Duplicate message listener
    // extractScrollbackData is now handled by ConsolidatedMessageManager
  }

  /**
   * 🆕 NEW: Handle scrollback extraction request from Extension
   */
  private async handleExtractScrollbackRequest(message: ScrollbackRequestMessage): Promise<void> {
    log('🔥 [SCROLLBACK-DEBUG] === handleExtractScrollbackRequest called ===', message);

    try {
      const { terminalId, requestId, maxLines } = message;

      if (!terminalId || !requestId) {
        console.error(
          '❌ [SCROLLBACK-DEBUG] Missing terminalId or requestId for scrollback extraction'
        );
        return;
      }

      // Check if this request has already been processed
      if (this.processedScrollbackRequests.has(requestId)) {
        log(
          `⚠️ [SCROLLBACK-DEBUG] Request ${requestId} already processed, ignoring duplicate`
        );
        return;
      }

      log(
        `🔍 [SCROLLBACK-DEBUG] Processing request for terminal: ${terminalId}, requestId: ${requestId}, maxLines: ${maxLines}`
      );

      // Mark this request as being processed
      this.processedScrollbackRequests.add(requestId);

      // Extract the scrollback data
      const scrollbackData = this.extractScrollbackData(terminalId, maxLines || 1000);

      log(
        `📦 [SCROLLBACK-DEBUG] Extracted ${scrollbackData.length} lines for terminal ${terminalId}`
      );
      log('📄 [SCROLLBACK-DEBUG] Sample scrollback data:', scrollbackData.slice(0, 3));

      // Send the response back to Extension
      this.postMessageToExtension({
        command: 'scrollbackDataCollected',
        terminalId,
        requestId,
        scrollbackData,
        timestamp: Date.now(),
      });

      log(`✅ [SCROLLBACK-DEBUG] Sent response to Extension for terminal ${terminalId}`);

      // Clean up processed requests after a timeout to prevent memory leaks
      setTimeout(() => {
        this.processedScrollbackRequests.delete(requestId);
      }, 30000); // 30 seconds timeout
    } catch (error) {
      console.error('❌ [SCROLLBACK-DEBUG] Failed to handle scrollback extraction request:', error);

      // Send error response
      this.postMessageToExtension({
        command: 'scrollbackDataCollected',
        terminalId: message.terminalId,
        requestId: message.requestId,
        scrollbackData: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });

      // Also mark as processed to prevent retries
      if (message.requestId) {
        this.processedScrollbackRequests.add(message.requestId);
        const requestId = message.requestId;
        setTimeout(() => {
          this.processedScrollbackRequests.delete(requestId);
        }, 30000);
      }
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
      const highlightActiveBorder =
        settings.highlightActiveBorder !== undefined
          ? settings.highlightActiveBorder
          : (this.currentSettings.highlightActiveBorder ?? true);

      this.currentSettings = {
        ...this.currentSettings,
        ...settings,
        highlightActiveBorder,
      };

      this.uiManager.setHighlightActiveBorder(highlightActiveBorder);

      const activeId = this.getActiveTerminalId();
      if (activeId) {
        const containers = this.terminalLifecycleManager.getAllTerminalContainers();
        if (containers.size > 0) {
          this.uiManager.updateTerminalBorders(activeId, containers);
        } else {
          this.uiManager.updateSplitTerminalBorders(activeId);
        }
      }

      log('⚙️ Settings applied:', settings);
    } catch (error) {
      log('❌ Error applying settings:', error);
    }
  }

  public applyFontSettings(fontSettings: WebViewFontSettings): void {
    try {
      this.currentFontSettings = { ...this.currentFontSettings, ...fontSettings };
      log('🔤 Font settings applied:', fontSettings);
    } catch (error) {
      log('❌ Error applying font settings:', error);
    }
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
        fontSettings: this.currentFontSettings,
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
  }

  // Compatibility methods for existing code

  public handleTerminalRemovedFromExtension(terminalId: string): void {
    this.removeTerminal(terminalId);
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

      log('🔄 [STATE] Processing state update:', {
        terminals: terminalState.terminals.length,
        availableSlots: terminalState.availableSlots,
        maxTerminals: terminalState.maxTerminals,
        activeTerminalId: terminalState.activeTerminalId,
      });

      // 🎯 [SYNC] Handle deletion synchronization FIRST
      this.handleStateUpdateWithDeletionSync(terminalState);

      // 1. Update internal state cache
      this.currentTerminalState = {
        terminals: terminalState.terminals,
        activeTerminalId: terminalState.activeTerminalId,
        maxTerminals: terminalState.maxTerminals,
        availableSlots: terminalState.availableSlots,
      };

      // 2. Update UI state immediately
      this.updateUIFromState(this.currentTerminalState);

      // 3. Update terminal creation availability
      this.updateTerminalCreationState();

      // 4. Debug visualization (if enabled)
      this.updateDebugDisplay(this.currentTerminalState);

      // 5. 🔄 [QUEUE] Process any pending creation requests
      if (this.pendingCreationRequests.length > 0) {
        log(
          `🔄 [QUEUE] State updated, processing ${this.pendingCreationRequests.length} pending requests`
        );
        setTimeout(() => this.processPendingCreationRequests(), 50);
      }

      log('✅ [STATE] State update completed successfully');
    } catch (error) {
      log('❌ [STATE] Error processing state update:', error);
    }
  }

  /**
   * Update UI elements based on current terminal state
   */
  private updateUIFromState(state: TerminalState): void {
    try {
      // Sync terminal order with Extension state
      const terminalOrder = state.terminals.map(t => t.id);
      if (terminalOrder.length > 0 && this.terminalContainerManager) {
        this.terminalContainerManager.reorderContainers(terminalOrder);
        log(`🔄 [STATE] Synced terminal container order:`, terminalOrder);
      }

      // Update terminal count display
      this.updateTerminalCountDisplay(state.terminals.length, state.maxTerminals);

      // Update available slots display
      this.updateAvailableSlotsDisplay(state.availableSlots);

      // Update active terminal highlighting
      if (state.activeTerminalId) {
        this.highlightActiveTerminal(state.activeTerminalId);
      }

      if (this.terminalTabManager) {
        this.terminalTabManager.syncTabs(
          state.terminals.map((terminal) => ({
            id: terminal.id,
            name: terminal.name,
            isActive: terminal.isActive,
            isClosable: state.terminals.length > 1,
          }))
        );
      }

      log(
        `🎨 [UI] UI updated: ${state.terminals.length}/${state.maxTerminals} terminals, slots: [${state.availableSlots.join(',')}]`
      );
    } catch (error) {
      log('❌ [UI] Error updating UI from state:', error);
    }
  }

  /**
   * Update terminal creation button state and messaging
   */
  private updateTerminalCreationState(): void {
    if (!this.currentTerminalState) {
      return;
    }

    const canCreate = this.currentTerminalState.availableSlots.length > 0;
    const currentCount = this.currentTerminalState.terminals.length;
    const maxCount = this.currentTerminalState.maxTerminals;

    // Update create button availability
    this.setCreateButtonEnabled(canCreate);

    // Update status messaging
    if (!canCreate) {
      this.showTerminalLimitMessage(currentCount, maxCount);
    } else {
      this.clearTerminalLimitMessage();
    }

    log(
      `🎯 [CREATION] Terminal creation ${canCreate ? 'ENABLED' : 'DISABLED'} (${currentCount}/${maxCount})`
    );
  }

  /**
   * Update debug display with current state information
   */
  private updateDebugDisplay(state: TerminalState): void {
    // Use the extended version with operation tracking
    this.updateDebugDisplayExtended(state, 'state-update');
  }

  /**
   * Display terminal count information
   */
  private updateTerminalCountDisplay(current: number, max: number): void {
    // Update any terminal count UI elements
    const countElements = document.querySelectorAll('[data-terminal-count]');
    countElements.forEach((element) => {
      element.textContent = `${current}/${max}`;
    });
  }

  /**
   * Display available slots information
   */
  private updateAvailableSlotsDisplay(slots: number[]): void {
    // Update available slots UI elements
    const slotElements = document.querySelectorAll('[data-available-slots]');
    slotElements.forEach((element) => {
      element.textContent =
        slots.length > 0 ? `Available: ${slots.join(', ')}` : 'No slots available';
    });
  }

  /**
   * Highlight the active terminal
   */
  private highlightActiveTerminal(terminalId: string): void {
    // Remove previous active highlighting
    document.querySelectorAll('.terminal-container.active').forEach((el) => {
      el.classList.remove('active');
    });

    // Add active highlighting to current terminal
    const activeContainer = document.querySelector(`[data-terminal-id="${terminalId}"]`);
    if (activeContainer) {
      activeContainer.classList.add('active');
    }

    this.uiManager.updateSplitTerminalBorders(terminalId);
  }

  /**
   * Enable/disable terminal creation button
   */
  private setCreateButtonEnabled(enabled: boolean): void {
    const createButtons = document.querySelectorAll('[data-action="create-terminal"]');
    createButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = !enabled;
        button.title = enabled ? 'Create new terminal' : 'Maximum terminals reached';
      }
    });
  }

  /**
   * Show terminal limit reached message
   */
  private showTerminalLimitMessage(current: number, max: number): void {
    const message = `Terminal limit reached (${current}/${max}). Delete a terminal to create new ones.`;

    // Show in notification system if available
    if (this.notificationManager) {
      this.notificationManager.showWarning(message);
    }

    // Update status bar if available
    const statusElements = document.querySelectorAll('[data-terminal-status]');
    statusElements.forEach((element) => {
      element.textContent = message;
      element.className = 'terminal-status warning';
    });
  }

  /**
   * Clear terminal limit message
   */
  private clearTerminalLimitMessage(): void {
    // Clear notifications
    if (this.notificationManager) {
      this.notificationManager.clearWarnings();
    }

    // Clear status bar
    const statusElements = document.querySelectorAll('[data-terminal-status]');
    statusElements.forEach((element) => {
      element.textContent = '';
      element.className = 'terminal-status';
    });
  }

  /**
   * Display debug information
   */
  private displayDebugInfo(info: DebugInfo): void {
    let debugElement = document.getElementById('terminal-debug-info');
    if (!debugElement) {
      debugElement = document.createElement('div');
      debugElement.id = 'terminal-debug-info';
      debugElement.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.92);
        color: #fff;
        padding: 16px;
        border-radius: 8px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 11px;
        z-index: 10000;
        max-width: 400px;
        min-width: 320px;
        border: 1px solid #444;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        line-height: 1.4;
      `;
      document.body.appendChild(debugElement);

      // Add close button
      const closeButton = document.createElement('button');
      closeButton.textContent = '×'; // Safe: fixed character
      closeButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: #fff;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      closeButton.onclick = () => {
        this.debugMode = false;
        debugElement?.remove();
      };
      debugElement.appendChild(closeButton);
    }

    // Get current system status
    const systemStatus = this.getSystemStatus();
    const ready = systemStatus.ready;

    // Color coding based on system state
    const statusColor = ready ? '#10b981' : '#ef4444'; // Green or Red
    const warningColor = '#f59e0b'; // Amber
    const infoColor = '#3b82f6'; // Blue

    debugElement.innerHTML = `
      <button style="position: absolute; top: 8px; right: 8px; background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; padding: 0; width: 20px; height: 20px;" onclick="this.parentElement.remove(); window.terminalManager && (window.terminalManager.debugMode = false);">×</button>

      <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #444;">
        <div style="color: #fbbf24; font-weight: bold; font-size: 12px;">🔍 Terminal State Debug Panel</div>
        <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Last Update: ${new Date().toLocaleTimeString()}</div>
      </div>

      <!-- System Status -->
      <div style="margin-bottom: 12px;">
        <div style="color: ${statusColor}; font-weight: bold; margin-bottom: 4px;">
          ${ready ? '✅' : '⚠️'} System Status: ${ready ? 'READY' : 'BUSY'}
        </div>
        ${
          !ready
            ? `
          <div style="color: ${warningColor}; font-size: 10px; margin-left: 16px;">
            ${systemStatus.pendingOperations.deletions.length > 0 ? `🗑️ Deletions: ${systemStatus.pendingOperations.deletions.length}` : ''}
            ${systemStatus.pendingOperations.creations > 0 ? `📥 Queued: ${systemStatus.pendingOperations.creations}` : ''}
          </div>
        `
            : ''
        }
      </div>

      <!-- Terminal Count & Slots -->
      <div style="margin-bottom: 12px;">
        <div style="color: ${infoColor}; font-weight: bold; margin-bottom: 4px;">
          📊 Terminal Management
        </div>
        <div style="margin-left: 16px; color: #e5e7eb;">
          <div>Active: <span style="color: #10b981; font-weight: bold;">${info.totalCount}</span>/<span style="color: #fbbf24;">${info.maxTerminals}</span></div>
          <div>Available Slots: <span style="color: ${info.availableSlots.length > 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">[${info.availableSlots.join(', ') || 'none'}]</span></div>
          <div>Active Terminal: <span style="color: #60a5fa;">${info.activeTerminalId || 'none'}</span></div>
        </div>
      </div>

      <!-- Terminal List -->
      <div style="margin-bottom: 12px;">
        <div style="color: ${infoColor}; font-weight: bold; margin-bottom: 4px;">
          🖥️ Terminal Instances
        </div>
        <div style="margin-left: 16px; color: #e5e7eb; max-height: 120px; overflow-y: auto;">
          ${
            info.terminals.length > 0
              ? info.terminals
                  .map(
                    (t) => `
              <div style="margin: 2px 0; padding: 2px 4px; background: ${t.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(75, 85, 99, 0.3)'}; border-radius: 3px; border-left: 2px solid ${t.isActive ? '#10b981' : '#6b7280'};">
                <span style="color: ${t.isActive ? '#10b981' : '#9ca3af'};">${t.id}</span>
                ${t.isActive ? '<span style="color: #fbbf24;">●</span>' : ''}
              </div>
            `
                  )
                  .join('')
              : '<div style="color: #6b7280; font-style: italic;">No terminals</div>'
          }
        </div>
      </div>

      <!-- Pending Operations -->
      ${
        systemStatus.pendingOperations.deletions.length > 0 ||
        systemStatus.pendingOperations.creations > 0
          ? `
        <div style="margin-bottom: 12px;">
          <div style="color: ${warningColor}; font-weight: bold; margin-bottom: 4px;">
            ⏳ Pending Operations
          </div>
          <div style="margin-left: 16px; color: #e5e7eb;">
            ${
              systemStatus.pendingOperations.deletions.length > 0
                ? `
              <div style="margin: 2px 0;">
                <span style="color: #ef4444;">🗑️ Deletions (${systemStatus.pendingOperations.deletions.length}):</span>
                <div style="margin-left: 16px; font-size: 10px; color: #fca5a5;">
                  ${systemStatus.pendingOperations.deletions.map((id) => `• ${id}`).join('<br>')}
                </div>
              </div>
            `
                : ''
            }
            ${
              systemStatus.pendingOperations.creations > 0
                ? `
              <div style="margin: 2px 0;">
                <span style="color: #f59e0b;">📥 Creations:</span>
                <span style="color: #fbbf24; font-weight: bold;">${systemStatus.pendingOperations.creations} queued</span>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `
          : ''
      }

      <!-- Number Recycling Status -->
      <div style="margin-bottom: 12px;">
        <div style="color: ${infoColor}; font-weight: bold; margin-bottom: 4px;">
          🔄 Number Recycling
        </div>
        <div style="margin-left: 16px; color: #e5e7eb;">
          <div style="display: flex; gap: 8px; margin-bottom: 4px;">
            ${[1, 2, 3, 4, 5]
              .map((num) => {
                const isUsed = info.terminals.some((t) => t.id === `terminal-${num}`);
                const isAvailable = info.availableSlots.includes(num);
                const color = isUsed ? '#ef4444' : isAvailable ? '#10b981' : '#6b7280';
                const symbol = isUsed ? '●' : isAvailable ? '○' : '◌';
                return `<span style="color: ${color}; font-weight: bold; width: 20px; text-align: center;">${num}${symbol}</span>`;
              })
              .join('')}
          </div>
          <div style="font-size: 10px; color: #9ca3af;">
            <span style="color: #ef4444;">● Used</span> |
            <span style="color: #10b981;">○ Available</span> |
            <span style="color: #6b7280;">◌ Unavailable</span>
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div style="margin-bottom: 8px;">
        <div style="color: ${infoColor}; font-weight: bold; margin-bottom: 4px;">
          ⚡ Performance
        </div>
        <div style="margin-left: 16px; color: #e5e7eb; font-size: 10px;">
          <div>State Updates: <span id="debug-state-updates">0</span></div>
          <div>Last Sync: <span id="debug-last-sync">${info.timestamp}</span></div>
          <div>System Uptime: <span id="debug-uptime">${this.getSystemUptime()}</span></div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #444;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button onclick="window.terminalManager?.forceSynchronization()" style="
            background: #ef4444; color: white; border: none; padding: 4px 8px;
            border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold;
          ">🔄 Force Sync</button>
          <button onclick="window.terminalManager?.requestLatestState()" style="
            background: #3b82f6; color: white; border: none; padding: 4px 8px;
            border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold;
          ">📡 Refresh State</button>
          <button onclick="log('Terminal System Status:', window.terminalManager?.getSystemStatus())" style="
            background: #6b7280; color: white; border: none; padding: 4px 8px;
            border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold;
          ">📋 Log Status</button>
        </div>
      </div>
    `;

    // Update performance counters
    this.updatePerformanceCounters();
  }

  /**
   * Performance tracking for debug panel
   */
  private debugCounters: DebugCounters = {
    stateUpdates: 0,
    lastSync: new Date().toISOString(),
    systemStartTime: Date.now(),
  };

  /**
   * 🔄 Initialize session restoration capability
   */
  private initializeSessionRestoration(): void {
    log('🆕 [SIMPLE-RESTORATION] Initializing simple session restoration...');

    // Immediately attempt to restore previous session
    setTimeout(() => {
      this.attemptSimpleSessionRestore();
    }, 500); // Wait for initialization to complete

    log('✅ [SIMPLE-RESTORATION] Simple session restoration capability initialized');
  }

  /**
   * 🆕 Attempt simple session restoration
   */
  private async attemptSimpleSessionRestore(): Promise<void> {
    try {
      log('🔄 [SIMPLE-RESTORATION] Attempting session restoration...');

      if (!this.webViewPersistenceService) {
        console.warn('⚠️ [SIMPLE-RESTORATION] SimplePersistenceManager not available');
        return;
      }

      // Load previous session data
      const sessionData = await this.webViewPersistenceService.loadSession();

      if (!sessionData) {
        // No previous session - show welcome message
        const welcomeMessage = this.webViewPersistenceService.getWelcomeMessage();
        this.displaySessionMessage(welcomeMessage);
        log('📭 [SIMPLE-RESTORATION] No previous session found - showing welcome message');
        return;
      }

      // Restore terminals based on session data
      log(
        `🔄 [SIMPLE-RESTORATION] Restoring ${sessionData.terminalCount} terminals from previous session`
      );

      // Create terminals one by one
      for (let i = 0; i < sessionData.terminalCount; i++) {
        const terminalName = sessionData.terminalNames[i] || `Terminal ${i + 1}`;
        const terminalId = `terminal-${i + 1}`;

        // Request terminal creation from Extension
        this.postMessageToExtension({
          command: 'createTerminal',
          terminalId: terminalId,
          terminalName: terminalName,
          isSessionRestore: true,
          timestamp: Date.now(),
        });

        log(`🔄 [SIMPLE-RESTORATION] Requested recreation of terminal: ${terminalName}`);

        // Small delay between terminal creations
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Show session restoration message
      const sessionMessage = this.webViewPersistenceService.getSessionMessage(sessionData);
      setTimeout(() => {
        this.displaySessionMessage(sessionMessage);
      }, 1000); // Delay to allow terminals to be created

      // Restore active terminal if specified
      if (sessionData.activeTerminalId) {
        setTimeout(() => {
          this.setActiveTerminalId(sessionData.activeTerminalId!);
          log(
            `🎯 [SIMPLE-RESTORATION] Restored active terminal: ${sessionData.activeTerminalId}`
          );
        }, 1500);
      }

      log('✅ [SIMPLE-RESTORATION] Session restoration completed');
    } catch (error) {
      console.error('❌ [SIMPLE-RESTORATION] Failed to restore session:', error);

      // Show welcome message as fallback
      if (this.webViewPersistenceService) {
        const welcomeMessage = this.webViewPersistenceService.getWelcomeMessage();
        this.displaySessionMessage(welcomeMessage);
      }
    }
  }

  /**
   * 🆕 Display session continuation message
   */
  private displaySessionMessage(message: {
    type: string;
    message: string;
    details?: string;
    timestamp: number;
  }): void {
    try {
      // Create a notification-style message
      const messageElement = document.createElement('div');
      messageElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 212, 170, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 13px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(0, 212, 170, 0.3);
        max-width: 400px;
        word-wrap: break-word;
      `;

      const mainMessage = document.createElement('div');
      mainMessage.textContent = message.message;
      messageElement.appendChild(mainMessage);

      if (message.details) {
        const detailsElement = document.createElement('div');
        detailsElement.style.cssText = `
          margin-top: 4px;
          opacity: 0.9;
          font-size: 11px;
        `;
        detailsElement.textContent = message.details;
        messageElement.appendChild(detailsElement);
      }

      // Add to DOM
      document.body.appendChild(messageElement);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.style.transition = 'opacity 0.3s ease-out';
          messageElement.style.opacity = '0';
          setTimeout(() => {
            if (messageElement.parentNode) {
              messageElement.parentNode.removeChild(messageElement);
            }
          }, 300);
        }
      }, 5000);

      log(`📢 [SESSION-MESSAGE] Displayed: ${message.message}`);
    } catch (error) {
      console.error('❌ [SESSION-MESSAGE] Failed to display message:', error);
      // Fallback to console log
      log(
        `📢 [SESSION-MESSAGE] ${message.message}${message.details ? ` - ${message.details}` : ''}`
      );
    }
  }

  /**
   * 🔄 Setup message listener for session restore commands
   */
  private setupSessionRestoreMessageListener(): void {
    // This will be handled by ConsolidatedMessageManager's handleSessionRestore method
    // The message handler is already set up in the message manager
    log('🔄 [RESTORATION] Session restore message listener configured');
  }

  /**
   * 🔄 PUBLIC API: Restore terminal session from Extension data
   */
  public async restoreSession(sessionData: {
    terminalId: string;
    terminalName: string;
    scrollbackData?: string[];
    sessionRestoreMessage?: string;
  }): Promise<boolean> {
    try {
      log(`🔄 [RESTORATION] Starting session restore for terminal: ${sessionData.terminalId}`);

      const { terminalId, terminalName, scrollbackData, sessionRestoreMessage } = sessionData;

      // 1. Create terminal if it doesn't exist
      let terminal = this.getTerminalInstance(terminalId);
      if (!terminal) {
        log(`🔄 [RESTORATION] Creating terminal for restore: ${terminalId}`);
        const xtermInstance = await this.createTerminal(terminalId, terminalName);
        if (!xtermInstance) {
          log(`❌ [RESTORATION] Failed to create terminal for restore: ${terminalId}`);
          return false;
        }

        // Wait for terminal to be fully created
        await new Promise((resolve) => setTimeout(resolve, 100));
        terminal = this.getTerminalInstance(terminalId);
      }

      if (!terminal?.terminal) {
        log(`❌ [RESTORATION] Terminal instance not available for restore: ${terminalId}`);
        return false;
      }

      // 2. Clear existing content
      terminal.terminal.clear();

      // 3. Restore session restore message if available
      if (sessionRestoreMessage) {
        terminal.terminal.writeln(sessionRestoreMessage);
        log(`🔄 [RESTORATION] Restored session message for terminal: ${terminalId}`);
      }

      // 4. Restore scrollback data if available
      if (scrollbackData && scrollbackData.length > 0) {
        log(
          `🔄 [RESTORATION] Restoring ${scrollbackData.length} lines of scrollback for terminal: ${terminalId}`
        );

        // Write each line to restore scrollback history
        for (const line of scrollbackData) {
          if (line.trim()) {
            terminal.terminal.writeln(line);
          }
        }

        log(
          `✅ [RESTORATION] Scrollback restored for terminal: ${terminalId} (${scrollbackData.length} lines)`
        );
      }

      // 5. Focus terminal if it's the active one
      if (this.getActiveTerminalId() === terminalId) {
        terminal.terminal.focus();
      }

      log(`✅ [RESTORATION] Session restore completed for terminal: ${terminalId}`);
      return true;
    } catch (error) {
      log(`❌ [RESTORATION] Error during session restore:`, error);
      return false;
    }
  }

  /**
   * Update performance counters
   */
  private updatePerformanceCounters(): void {
    // Update state update counter
    this.debugCounters.stateUpdates++;
    this.debugCounters.lastSync = new Date().toISOString();

    // Update DOM elements if they exist
    const stateUpdatesElement = document.getElementById('debug-state-updates');
    if (stateUpdatesElement) {
      stateUpdatesElement.textContent = this.debugCounters.stateUpdates.toString();
    }

    const lastSyncElement = document.getElementById('debug-last-sync');
    if (lastSyncElement) {
      lastSyncElement.textContent = new Date().toLocaleTimeString();
    }

    const uptimeElement = document.getElementById('debug-uptime');
    if (uptimeElement) {
      uptimeElement.textContent = this.getSystemUptime();
    }
  }

  /**
   * Get system uptime in human readable format
   */
  private getSystemUptime(): string {
    const uptimeMs = Date.now() - this.debugCounters.systemStartTime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Enhanced updateDebugDisplay with operation tracking
   */
  private updateDebugDisplayExtended(state: TerminalState, operation?: string): void {
    if (!this.debugMode) {
      return;
    }

    // Track the operation that triggered this update
    if (operation) {
      log(`🔍 [DEBUG] Display update triggered by: ${operation}`);
    }

    const debugInfo: DebugInfo = {
      timestamp: Date.now(),
      terminals: state.terminals.map((t) => ({
        id: t.id,
        isActive: t.isActive,
      })),
      availableSlots: state.availableSlots,
      activeTerminalId: state.activeTerminalId,
      totalCount: state.terminals.length,
      maxTerminals: state.maxTerminals,
      operation: operation || 'state-update',
    };

    this.displayDebugInfo(debugInfo);
  }

  /**
   * Real-time debug panel toggle
   */
  public toggleDebugPanel(): void {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      log('🔍 [DEBUG] Debug panel enabled');
      // Show current state immediately
      if (this.currentTerminalState) {
        this.updateDebugDisplayExtended(this.currentTerminalState, 'manual-toggle');
      } else {
        // Request state if not available
        this.requestLatestState();
      }
    } else {
      log('🔍 [DEBUG] Debug panel disabled');
      const debugElement = document.getElementById('terminal-debug-info');
      if (debugElement) {
        debugElement.remove();
      }
    }
  }

  /**
   * Export system diagnostics for troubleshooting
   */
  public exportSystemDiagnostics(): SystemDiagnostics {
    const diagnostics: SystemDiagnostics = {
      timestamp: new Date().toISOString(),
      systemStatus: this.getSystemStatus(),
      performanceCounters: this.debugCounters,
      configuration: {
        debugMode: this.debugMode,
        maxTerminals: this.currentTerminalState?.maxTerminals || 'unknown',
      },
      extensionCommunication: {
        lastStateRequest: 'tracked in logs',
        messageQueueStatus: 'see WebView console',
      },
      troubleshootingInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
      },
    };

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
    const maxTerminals =
      this.currentTerminalState?.maxTerminals ?? SPLIT_CONSTANTS.MAX_TERMINALS ?? 5;

    const localCount = this.splitManager?.getTerminals()?.size ?? 0;
    const pending = this.pendingTerminalCreations.size;

    if (!this.currentTerminalState) {
      log('⚠️ [STATE] No cached state available for creation check, using local count');
      return localCount + pending < maxTerminals;
    }

    if (this.currentTerminalState.availableSlots.length > 0) {
      return true;
    }

    return localCount + pending < maxTerminals;
  }

  /**
   * Get next available terminal number
   */
  public getNextAvailableNumber(): number | null {
    if (!this.currentTerminalState || this.currentTerminalState.availableSlots.length === 0) {
      return null;
    }

    return Math.min(...this.currentTerminalState.availableSlots);
  }

  /**
   * Terminal deletion tracking for state synchronization
   */
  private deletionTracker = new Set<string>();
  private deletionTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Track terminal deletion for state synchronization
   */
  private trackTerminalDeletion(terminalId: string): void {
    this.deletionTracker.add(terminalId);

    // Set timeout to automatically clear tracking
    const timeout = setTimeout(() => {
      this.clearTerminalDeletionTracking(terminalId);
    }, 5000); // 5 second timeout

    this.deletionTimeouts.set(terminalId, timeout);
    log(`🎯 [TRACK] Started tracking deletion for terminal: ${terminalId}`);
  }

  /**
   * Check if terminal deletion is being tracked
   */
  private isTerminalDeletionTracked(terminalId: string): boolean {
    return this.deletionTracker.has(terminalId);
  }

  /**
   * Clear terminal deletion tracking
   */
  private clearTerminalDeletionTracking(terminalId: string): void {
    this.deletionTracker.delete(terminalId);

    const timeout = this.deletionTimeouts.get(terminalId);
    if (timeout) {
      clearTimeout(timeout);
      this.deletionTimeouts.delete(terminalId);
    }

    log(`🎯 [TRACK] Cleared deletion tracking for terminal: ${terminalId}`);
  }

  /**
   * Enhanced state update with deletion synchronization
   */
  private handleStateUpdateWithDeletionSync(state: TerminalState): void {
    // Check if any tracked deletions have been processed
    const trackedDeletions = Array.from(this.deletionTracker);

    for (const deletedTerminalId of trackedDeletions) {
      // Check if the deleted terminal is no longer in the state
      const stillExists = state.terminals.some((terminal) => terminal.id === deletedTerminalId);

      if (!stillExists) {
        log(`✅ [SYNC] Deletion confirmed for terminal: ${deletedTerminalId}`);
        this.clearTerminalDeletionTracking(deletedTerminalId);

        // Trigger any pending creation operations
        this.processPendingCreationRequests();
      } else {
        log(`⏳ [SYNC] Terminal still exists in state, waiting: ${deletedTerminalId}`);
      }
    }
  }

  /**
   * Pending creation request queue
   */
  private pendingCreationRequests: Array<{
    id: string;
    name: string;
    timestamp: number;
    resolve: (result: boolean) => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   * Queue terminal creation request when deletion is in progress
   */
  public queueTerminalCreation(terminalId: string, terminalName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = {
        id: terminalId,
        name: terminalName,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      this.pendingCreationRequests.push(request);
      log(`📥 [QUEUE] Queued terminal creation: ${terminalId} (${terminalName})`);

      // Set timeout for request
      setTimeout(() => {
        const index = this.pendingCreationRequests.findIndex((r) => r.id === terminalId);
        if (index !== -1) {
          this.pendingCreationRequests.splice(index, 1);
          reject(new Error('Terminal creation request timed out'));
        }
      }, 10000); // 10 second timeout
    });
  }

  /**
   * Process pending creation requests
   */
  private processPendingCreationRequests(): void {
    if (this.pendingCreationRequests.length === 0) {
      return;
    }

    log(`🔄 [QUEUE] Processing ${this.pendingCreationRequests.length} pending creation requests`);

    // Process oldest request first
    const request = this.pendingCreationRequests.shift();
    if (!request) {
      return;
    }

    // Check if we can create the terminal now
    const canCreate = this.canCreateTerminal();
    if (canCreate) {
      log(`✅ [QUEUE] Processing terminal creation: ${request.id}`);

      // Send creation request to Extension
      this.postMessageToExtension({
        command: 'createTerminal',
        terminalId: request.id,
        terminalName: request.name,
        timestamp: Date.now(),
      });

      request.resolve(true);
    } else {
      log(`❌ [QUEUE] Cannot create terminal yet, re-queueing: ${request.id}`);

      // Re-queue the request
      this.pendingCreationRequests.unshift(request);

      // Request fresh state and try again later
      this.requestLatestState();
      setTimeout(() => this.processPendingCreationRequests(), 500);
    }
  }

  /**
   * Smart terminal creation with race condition protection
   */
  public async createTerminalSafely(terminalName?: string): Promise<boolean> {
    try {
      log('🛡️ [SAFE-CREATE] Starting safe terminal creation...');

      // 1. Request latest state to ensure we have current information
      this.requestLatestState();

      // 2. Wait a moment for state to update
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 3. Check if creation is possible
      if (!this.canCreateTerminal()) {
        const currentState = this.currentTerminalState;
        if (currentState) {
          const currentCount = currentState.terminals.length;
          const maxCount = currentState.maxTerminals;
          log(
            `❌ [SAFE-CREATE] Cannot create terminal: ${currentCount}/${maxCount}, slots: [${currentState.availableSlots.join(',')}]`
          );

          // Show user-friendly message
          this.showTerminalLimitMessage(currentCount, maxCount);
          return false;
        } else {
          log('❌ [SAFE-CREATE] No state available for creation check');
          return false;
        }
      }

      // 4. Check if any deletions are in progress
      if (this.deletionTracker.size > 0) {
        const trackedDeletions = Array.from(this.deletionTracker);
        log(
          `⏳ [SAFE-CREATE] Deletions in progress: [${trackedDeletions.join(',')}], queueing creation...`
        );

        // Generate terminal ID
        const nextNumber = this.getNextAvailableNumber();
        if (!nextNumber) {
          log('❌ [SAFE-CREATE] No available number for queued creation');
          return false;
        }

        const terminalId = `terminal-${nextNumber}`;
        const finalTerminalName = terminalName || `Terminal ${nextNumber}`;

        // Queue the creation request
        try {
          const result = await this.queueTerminalCreation(terminalId, finalTerminalName);
          log(`✅ [SAFE-CREATE] Queued creation completed: ${terminalId}`);
          return result;
        } catch (error) {
          log(`❌ [SAFE-CREATE] Queued creation failed:`, error);
          return false;
        }
      }

      // 5. Direct creation - no deletions in progress
      const nextNumber = this.getNextAvailableNumber();
      if (!nextNumber) {
        log('❌ [SAFE-CREATE] No available number for direct creation');
        return false;
      }

      const terminalId = `terminal-${nextNumber}`;
      const finalTerminalName = terminalName || `Terminal ${nextNumber}`;

      log(`🚀 [SAFE-CREATE] Creating terminal directly: ${terminalId} (${finalTerminalName})`);

      // Send creation request to Extension
      this.postMessageToExtension({
        command: 'createTerminal',
        terminalId,
        terminalName: finalTerminalName,
        timestamp: Date.now(),
      });

      log(`✅ [SAFE-CREATE] Creation request sent: ${terminalId}`);
      return true;
    } catch (error) {
      log('❌ [SAFE-CREATE] Error in safe terminal creation:', error);
      return false;
    }
  }

  /**
   * Enhanced terminal deletion with proper cleanup
   */
  public async deleteTerminalSafely(terminalId?: string): Promise<boolean> {
    try {
      const targetId = terminalId || this.getActiveTerminalId();
      if (!targetId) {
        log('❌ [SAFE-DELETE] No terminal to delete');
        return false;
      }

      log(`🛡️ [SAFE-DELETE] Starting safe deletion: ${targetId}`);

      // 1. Check if terminal exists
      const terminalInstance = this.getTerminalInstance(targetId);
      if (!terminalInstance) {
        log(`❌ [SAFE-DELETE] Terminal not found: ${targetId}`);
        return false;
      }

      // 🎯 FIX: Check terminal count BEFORE deletion to protect the last one
      const terminalStats = this.terminalLifecycleManager.getTerminalStats();
      const totalTerminals = terminalStats.totalTerminals;
      if (totalTerminals <= 1) {
        log(`🛡️ [SAFE-DELETE] Cannot delete last terminal: ${targetId} (total: ${totalTerminals})`);
        // Show user notification about protection
        if (this.notificationManager && 'showWarning' in this.notificationManager) {
          this.notificationManager.showWarning('Must keep at least 1 terminal open');
        }
        return false;
      }

      this.prepareDisplayForTerminalDeletion(targetId, terminalStats);

      // 2. Check if deletion is already in progress
      if (this.isTerminalDeletionTracked(targetId)) {
        log(`⏳ [SAFE-DELETE] Deletion already in progress: ${targetId}`);
        return false;
      }

      // 3. Send deletion request to Extension
      log(
        `🗑️ [SAFE-DELETE] Sending deletion request: ${targetId} (${totalTerminals} -> ${totalTerminals - 1})`
      );

      // Track the deletion
      this.trackTerminalDeletion(targetId);

      // Send delete message to Extension
      this.postMessageToExtension({
        command: 'deleteTerminal',
        terminalId: targetId,
        requestSource: 'header', // Set correct source for header X button
        timestamp: Date.now(),
      });

      // 🎯 FIX: Wait for Extension response before removing from WebView
      // Remove the immediate removal - let Extension handle validation and notify back
      // this.removeTerminal(targetId);  // ← This was causing the issue

      log(`✅ [SAFE-DELETE] Deletion request sent, awaiting Extension response: ${targetId}`);
      return true;
    } catch (error) {
      log('❌ [SAFE-DELETE] Error in safe terminal deletion:', error);
      return false;
    }
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
      const moreThanOneTerminal = stats.totalTerminals > 1;

      if (!moreThanOneTerminal) {
        return;
      }

      if (currentMode === 'fullscreen') {
        log(
          `🖥️ [SAFE-DELETE] Exiting fullscreen before deleting ${targetTerminalId}, switching to split mode`
        );
        this.displayModeManager.setDisplayMode('split');
      }
    } catch (error) {
      log('⚠️ [SAFE-DELETE] Failed to prepare display for deletion:', error);
    }
  }

  /**
   * Check if the system is in a safe state for operations
   */
  public isSystemReady(): boolean {
    const hasCachedState = !!this.currentTerminalState;
    const noPendingDeletions = this.deletionTracker.size === 0;
    const noPendingCreations = this.pendingCreationRequests.length === 0;

    const isReady = hasCachedState && noPendingDeletions && noPendingCreations;

    log(
      `🔍 [SYSTEM] System ready check: state=${hasCachedState}, deletions=${noPendingDeletions}, creations=${noPendingCreations} => ${isReady}`
    );

    return isReady;
  }

  /**
   * Force system synchronization
   */
  public forceSynchronization(): void {
    log('🔄 [FORCE-SYNC] Forcing system synchronization...');

    // Clear all pending operations
    this.deletionTracker.clear();
    this.deletionTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.deletionTimeouts.clear();

    // Reject all pending creation requests
    this.pendingCreationRequests.forEach((request) => {
      request.reject(new Error('System synchronization forced'));
    });
    this.pendingCreationRequests.length = 0;

    // Request fresh state
    this.requestLatestState();

    log('✅ [FORCE-SYNC] System synchronization completed');
  }

  /**
   * Public API: Request new terminal creation (safe)
   */
  public async requestNewTerminal(terminalName?: string): Promise<boolean> {
    log('🎯 [API] Terminal creation requested via public API');
    return await this.createTerminalSafely(terminalName);
  }

  /**
   * Public API: Request terminal deletion (safe)
   */
  public async requestTerminalDeletion(terminalId?: string): Promise<boolean> {
    log('🎯 [API] Terminal deletion requested via public API');
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
        deletions: Array.from(this.deletionTracker),
        creations: this.pendingCreationRequests.length,
      },
    };
  }

  // Add state properties
  private currentTerminalState: TerminalState | null = null;
  private debugMode: boolean = false; // Enable only when needed for debugging

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

      // 既存マネージャーのクリーンアップ
      this.messageManager.dispose();
      this.webViewPersistenceService.dispose();

      // Clean up scrollback request tracking
      this.processedScrollbackRequests.clear();

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
