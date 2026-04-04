import {
  IInputManager,
  IMessageManager,
  IManagerCoordinator,
  TerminalInstance,
} from '../interfaces/ManagerInterfaces';
import { webview as log } from '../../utils/logger';
import { PartialTerminalSettings } from '../../types/shared';
import { SettingsPanel } from '../components/SettingsPanel';
import { NotificationManager } from '../managers/NotificationManager';
import { PerformanceManager } from '../managers/PerformanceManager';
import { UIManager } from '../managers/UIManager';
import { TerminalTabManager } from '../managers/TerminalTabManager';
import { InputManager } from '../managers/InputManager';
import { ConfigManager } from '../managers/ConfigManager';
import { WebViewPersistenceService } from '../services/WebViewPersistenceService';
import { ConsolidatedMessageManager } from '../managers/ConsolidatedMessageManager';
import { TerminalStateDisplayManager } from '../managers/TerminalStateDisplayManager';
import { SessionRestoreManager } from '../managers/SessionRestoreManager';
import { TerminalSettingsManager } from '../managers/TerminalSettingsManager';

interface ITerminalLifecycleManagerDependencies {
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  getAllTerminalContainers(): Map<string, HTMLElement>;
}

interface IManagerWithCoordinator {
  setCoordinator(coordinator: IManagerCoordinator): void;
}

interface IDisplayModeManagerDependencies {
  initialize(): void;
}

interface ITerminalContainerManagerDependencies {
  initialize(): void;
}

interface IDebugPanelManagerDependencies {
  setCallbacks(callbacks: {
    getSystemStatus: () => unknown;
    forceSynchronization: () => void;
    requestLatestState: () => void;
  }): void;
}

interface IFontSettingsServiceDependencies {
  setApplicator(applicator: UIManager): void;
}

interface IEventHandlerManagerDependencies {
  setMessageEventHandler(handler: (event: MessageEvent) => Promise<void>): void;
  onPageUnload(handler: () => void): void;
}

export interface IInitializedManagerBundle {
  settingsPanel: SettingsPanel;
  notificationManager: NotificationManager;
  performanceManager: PerformanceManager;
  uiManager: UIManager;
  terminalTabManager: TerminalTabManager;
  inputManager: InputManager;
  configManager: ConfigManager;
  webViewPersistenceService: WebViewPersistenceService;
  persistenceManager: WebViewPersistenceService;
  messageManager: ConsolidatedMessageManager;
  terminalStateDisplayManager: TerminalStateDisplayManager;
  sessionRestoreManager: SessionRestoreManager;
  settingsManager: TerminalSettingsManager;
  profileManagerInitTimer: number;
}

export interface ILightweightTerminalInitializationDependencies {
  managerCoordinator: IManagerCoordinator;
  getCurrentSettings(): PartialTerminalSettings;
  setCurrentSettings(settings: PartialTerminalSettings): void;
  applySettings(settings: PartialTerminalSettings): void;
  saveSettings(): void;
  ensureTerminalFocus(): void;
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  getAllTerminalContainers(): Map<string, HTMLElement>;
  getActiveTerminalId(): string | null;
  getTerminalInstance(terminalId: string): TerminalInstance | undefined;
  createTerminal(id: string, name: string): Promise<unknown>;
  getSystemStatus(): unknown;
  forceSynchronization(): void;
  requestLatestState(): void;
  postMessageToExtension(message: unknown): void;
  terminalLifecycleManager: ITerminalLifecycleManagerDependencies;
  splitManager: unknown;
  findInTerminalManager: IManagerWithCoordinator;
  profileManager: IManagerWithCoordinator & { initialize(): Promise<void> };
  shellIntegrationManager: IManagerWithCoordinator;
  displayModeManager: IDisplayModeManagerDependencies;
  terminalContainerManager: ITerminalContainerManagerDependencies;
  debugPanelManager: IDebugPanelManagerDependencies;
  fontSettingsService: IFontSettingsServiceDependencies;
  eventHandlerManager: IEventHandlerManagerDependencies;
  scheduleTimeout(handler: TimerHandler, timeout?: number): number;
  settingsVersionInfo(): string;
  disposeManager(): void;
}

export class LightweightTerminalInitializationCoordinator {
  constructor(private readonly dependencies: ILightweightTerminalInitializationDependencies) {}

  public initializeExistingManagers(): IInitializedManagerBundle {
    log('🔧 Initializing existing managers...');

    const settingsPanel = new SettingsPanel({
      onSettingsChange: (settings) => {
        try {
          const currentSettings = this.dependencies.getCurrentSettings();
          const mergedSettings = { ...currentSettings, ...settings };
          this.dependencies.applySettings(settings as PartialTerminalSettings);

          configManager.applySettings(
            mergedSettings,
            this.dependencies.terminalLifecycleManager.getAllTerminalInstances()
          );
          this.dependencies.setCurrentSettings(configManager.getCurrentSettings());
          this.dependencies.saveSettings();
        } catch (error) {
          log('❌ [SETTINGS] Error applying settings from panel:', error);
        }
      },
      onClose: () => {
        try {
          this.dependencies.ensureTerminalFocus();
        } catch (error) {
          log('❌ [SETTINGS] Error restoring focus after closing settings:', error);
        }
      },
    });

    const notificationManager = new NotificationManager();

    const performanceManager = new PerformanceManager();
    performanceManager.initializePerformance(this.dependencies.managerCoordinator);

    const uiManager = new UIManager();
    uiManager.setActiveBorderMode(
      this.dependencies.getCurrentSettings().activeBorderMode ?? 'multipleOnly'
    );
    this.dependencies.fontSettingsService.setApplicator(uiManager);

    const terminalTabManager = new TerminalTabManager();
    terminalTabManager.setCoordinator(this.dependencies.managerCoordinator);
    uiManager.setTabThemeUpdater((theme) => {
      terminalTabManager.updateTheme(theme);
    });

    const inputManager = new InputManager(this.dependencies.managerCoordinator);
    inputManager.initialize();

    const configManager = new ConfigManager();
    configManager.setFontSettingsService(this.dependencies.fontSettingsService as any);

    const webViewPersistenceService = new WebViewPersistenceService();
    const messageManager = new ConsolidatedMessageManager();
    messageManager.setCoordinator(this.dependencies.managerCoordinator);

    this.dependencies.findInTerminalManager.setCoordinator(this.dependencies.managerCoordinator);
    this.dependencies.profileManager.setCoordinator(this.dependencies.managerCoordinator);
    this.dependencies.shellIntegrationManager.setCoordinator(this.dependencies.managerCoordinator);

    const profileManagerInitTimer = this.dependencies.scheduleTimeout(async () => {
      try {
        await this.dependencies.profileManager.initialize();
        log('🎯 ProfileManager async initialization completed');
      } catch (error) {
        console.error('❌ ProfileManager initialization failed:', error);
      }
    }, 100);

    terminalTabManager.initialize();
    this.dependencies.displayModeManager.initialize();
    this.dependencies.terminalContainerManager.initialize();

    this.dependencies.debugPanelManager.setCallbacks({
      getSystemStatus: () => this.dependencies.getSystemStatus(),
      forceSynchronization: () => this.dependencies.forceSynchronization(),
      requestLatestState: () => this.dependencies.requestLatestState(),
    });

    const terminalStateDisplayManager = new TerminalStateDisplayManager(
      uiManager,
      notificationManager,
      terminalTabManager,
      this.dependencies.terminalContainerManager as never
    );

    const sessionRestoreManager = new SessionRestoreManager({
      getTerminalInstance: (id) => this.dependencies.getTerminalInstance(id),
      createTerminal: (id, name) =>
        this.dependencies.createTerminal(id, name) as Promise<
          import('@xterm/xterm').Terminal | null
        >,
      getActiveTerminalId: () => this.dependencies.getActiveTerminalId(),
    });

    const settingsManager = new TerminalSettingsManager(uiManager, configManager, {
      getAllTerminalInstances: () => this.dependencies.getAllTerminalInstances(),
      getAllTerminalContainers: () => this.dependencies.getAllTerminalContainers(),
      getActiveTerminalId: () => this.dependencies.getActiveTerminalId(),
    });

    return {
      settingsPanel,
      notificationManager,
      performanceManager,
      uiManager,
      terminalTabManager,
      inputManager,
      configManager,
      webViewPersistenceService,
      persistenceManager: webViewPersistenceService,
      messageManager,
      terminalStateDisplayManager,
      sessionRestoreManager,
      settingsManager,
      profileManagerInitTimer,
    };
  }

  public setupInputManager(inputManager: IInputManager): void {
    try {
      inputManager.setupAltKeyVisualFeedback();
      inputManager.setupIMEHandling();
      inputManager.setupKeyboardShortcuts(this.dependencies.managerCoordinator);
      inputManager.setAgentInteractionMode?.(false);

      log('✅ Input manager fully configured');
    } catch (error) {
      log('❌ Error setting up input manager:', error);
    }
  }

  public setupEventHandlers(messageManager: IMessageManager): {
    onWindowFocus: () => void;
    onWindowBlur: () => void;
  } {
    this.dependencies.eventHandlerManager.setMessageEventHandler(async (event) => {
      log(`🔍 [DEBUG] WebView received message event:`, {
        type: event.type,
        dataCommand: (event.data as { command?: unknown } | undefined)?.command,
        timestamp: Date.now(),
      });
      await messageManager.receiveMessage(event.data, this.dependencies.managerCoordinator);
    });

    document.addEventListener('settings-open-requested', () => {
      this.dependencies.managerCoordinator.openSettings();
    });

    const onWindowFocus = () => {
      this.dependencies.postMessageToExtension({
        command: 'terminalFocused',
        terminalId: this.dependencies.getActiveTerminalId() || '',
        timestamp: Date.now(),
      });
    };

    const onWindowBlur = () => {
      this.dependencies.postMessageToExtension({
        command: 'terminalBlurred',
        terminalId: this.dependencies.getActiveTerminalId() || '',
        timestamp: Date.now(),
      });
    };

    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('blur', onWindowBlur);

    this.dependencies.eventHandlerManager.onPageUnload(() => {
      this.dependencies.disposeManager();
    });

    log('🎭 Event handlers configured');

    return { onWindowFocus, onWindowBlur };
  }
}
