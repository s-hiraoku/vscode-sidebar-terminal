import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import {
  LightweightTerminalInitializationCoordinator,
  type ILightweightTerminalInitializationDependencies,
} from '../../../../../webview/coordinators/LightweightTerminalInitializationCoordinator';

vi.mock('../../../../../webview/components/SettingsPanel', () => ({
  SettingsPanel: class {
    public show = vi.fn();
    public setVersionInfo = vi.fn();
    constructor(
      public readonly options: {
        onSettingsChange: (settings: unknown) => void;
        onClose: () => void;
      }
    ) {}
  },
}));

vi.mock('../../../../../webview/managers/NotificationManager', () => ({
  NotificationManager: class {
    public showWarning = vi.fn();
  },
}));

vi.mock('../../../../../webview/managers/PerformanceManager', () => ({
  PerformanceManager: class {
    public initializePerformance = vi.fn();
  },
}));

vi.mock('../../../../../webview/managers/UIManager', () => ({
  UIManager: class {
    public setActiveBorderMode = vi.fn();
    public setTabThemeUpdater = vi.fn();
  },
}));

vi.mock('../../../../../webview/managers/TerminalTabManager', () => ({
  TerminalTabManager: class {
    public setCoordinator = vi.fn();
    public initialize = vi.fn();
    public updateTheme = vi.fn();
  },
}));

vi.mock('../../../../../webview/managers/InputManager', () => ({
  InputManager: class {
    public initialize = vi.fn();
    public setupAltKeyVisualFeedback = vi.fn();
    public setupIMEHandling = vi.fn();
    public setupKeyboardShortcuts = vi.fn();
    public setAgentInteractionMode = vi.fn();
    constructor(public readonly coordinator: unknown) {}
  },
}));

vi.mock('../../../../../webview/managers/ConfigManager', () => ({
  ConfigManager: class {
    public setFontSettingsService = vi.fn();
    public applySettings = vi.fn();
    public getCurrentSettings = vi.fn().mockReturnValue({});
  },
}));

vi.mock('../../../../../webview/services/WebViewPersistenceService', () => ({
  WebViewPersistenceService: class {
    public saveSession = vi.fn().mockResolvedValue(true);
  },
}));

vi.mock('../../../../../webview/managers/ConsolidatedMessageManager', () => ({
  ConsolidatedMessageManager: class {
    public setCoordinator = vi.fn();
    public receiveMessage = vi.fn().mockResolvedValue(undefined);
    public postMessage = vi.fn();
  },
}));

vi.mock('../../../../../webview/managers/TerminalStateDisplayManager', () => ({
  TerminalStateDisplayManager: class {},
}));

vi.mock('../../../../../webview/managers/SessionRestoreManager', () => ({
  SessionRestoreManager: class {},
}));

vi.mock('../../../../../webview/managers/TerminalSettingsManager', () => ({
  TerminalSettingsManager: class {},
}));

function createCoordinator(): {
  coordinator: LightweightTerminalInitializationCoordinator;
  deps: ILightweightTerminalInitializationDependencies;
} {
  const managerCoordinator = {
    ensureTerminalFocus: vi.fn(),
    postMessageToExtension: vi.fn(),
  } as unknown as IManagerCoordinator;

  const deps: ILightweightTerminalInitializationDependencies = {
    managerCoordinator,
    getCurrentSettings: vi.fn().mockReturnValue({ activeBorderMode: 'multipleOnly' }),
    setCurrentSettings: vi.fn(),
    applySettings: vi.fn(),
    saveSettings: vi.fn(),
    ensureTerminalFocus: vi.fn(),
    getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
    getAllTerminalContainers: vi.fn().mockReturnValue(new Map()),
    getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
    getTerminalInstance: vi.fn(),
    createTerminal: vi.fn(),
    getSystemStatus: vi.fn().mockReturnValue({ ready: true }),
    forceSynchronization: vi.fn(),
    requestLatestState: vi.fn(),
    postMessageToExtension: vi.fn(),
    terminalLifecycleManager: {
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
      getAllTerminalContainers: vi.fn().mockReturnValue(new Map()),
    },
    splitManager: {},
    findInTerminalManager: { setCoordinator: vi.fn() },
    profileManager: {
      setCoordinator: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
    },
    shellIntegrationManager: { setCoordinator: vi.fn() },
    displayModeManager: { initialize: vi.fn() },
    terminalContainerManager: { initialize: vi.fn() },
    debugPanelManager: { setCallbacks: vi.fn() },
    fontSettingsService: { setApplicator: vi.fn() },
    eventHandlerManager: {
      setMessageEventHandler: vi.fn(),
      onPageUnload: vi.fn(),
    },
    scheduleTimeout: vi.fn().mockReturnValue(42),
    settingsVersionInfo: vi.fn().mockReturnValue('v0.1.0'),
    disposeManager: vi.fn(),
  };

  return {
    coordinator: new LightweightTerminalInitializationCoordinator(deps),
    deps,
  };
}

describe('LightweightTerminalInitializationCoordinator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
    });
  });

  it('initializes and wires the existing managers bundle', () => {
    const { coordinator, deps } = createCoordinator();

    const initialized = coordinator.initializeExistingManagers();

    expect(initialized.settingsPanel).toBeDefined();
    expect(initialized.notificationManager).toBeDefined();
    expect(initialized.performanceManager.initializePerformance).toHaveBeenCalledWith(
      deps.managerCoordinator
    );
    expect(initialized.uiManager.setActiveBorderMode).toHaveBeenCalledWith('multipleOnly');
    expect(deps.fontSettingsService.setApplicator).toHaveBeenCalledWith(initialized.uiManager);
    expect(initialized.terminalTabManager.setCoordinator).toHaveBeenCalledWith(
      deps.managerCoordinator
    );
    expect(initialized.inputManager.initialize).toHaveBeenCalled();
    expect(initialized.configManager.setFontSettingsService).toHaveBeenCalledWith(
      deps.fontSettingsService
    );
    expect(initialized.messageManager.setCoordinator).toHaveBeenCalledWith(deps.managerCoordinator);
    expect(deps.findInTerminalManager.setCoordinator).toHaveBeenCalledWith(deps.managerCoordinator);
    expect(deps.profileManager.setCoordinator).toHaveBeenCalledWith(deps.managerCoordinator);
    expect(deps.shellIntegrationManager.setCoordinator).toHaveBeenCalledWith(
      deps.managerCoordinator
    );
    expect(deps.scheduleTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(initialized.profileManagerInitTimer).toBe(42);
    expect(initialized.terminalTabManager.initialize).toHaveBeenCalled();
    expect(deps.displayModeManager.initialize).toHaveBeenCalled();
    expect(deps.terminalContainerManager.initialize).toHaveBeenCalled();
    expect(deps.debugPanelManager.setCallbacks).toHaveBeenCalled();
  });

  it('applies the full input manager setup sequence', () => {
    const { coordinator } = createCoordinator();
    const inputManager = {
      setupAltKeyVisualFeedback: vi.fn(),
      setupIMEHandling: vi.fn(),
      setupKeyboardShortcuts: vi.fn(),
      setAgentInteractionMode: vi.fn(),
    };

    coordinator.setupInputManager(inputManager as never);

    expect(inputManager.setupAltKeyVisualFeedback).toHaveBeenCalled();
    expect(inputManager.setupIMEHandling).toHaveBeenCalled();
    expect(inputManager.setupKeyboardShortcuts).toHaveBeenCalled();
    expect(inputManager.setAgentInteractionMode).toHaveBeenCalledWith(false);
  });

  it('registers message, window, and unload event handlers', async () => {
    const { coordinator, deps } = createCoordinator();
    const messageManager = {
      receiveMessage: vi.fn().mockResolvedValue(undefined),
    };

    const handlers = coordinator.setupEventHandlers(messageManager as never);

    expect(deps.eventHandlerManager.setMessageEventHandler).toHaveBeenCalledWith(
      expect.any(Function)
    );
    expect(document.addEventListener).toHaveBeenCalledWith(
      'settings-open-requested',
      expect.any(Function)
    );
    expect(window.addEventListener).toHaveBeenCalledWith('focus', handlers.onWindowFocus);
    expect(window.addEventListener).toHaveBeenCalledWith('blur', handlers.onWindowBlur);
    expect(deps.eventHandlerManager.onPageUnload).toHaveBeenCalledWith(expect.any(Function));

    // @ts-expect-error - test mock type
    const messageHandler = vi!.mocked(deps.eventHandlerManager.setMessageEventHandler).mock
      .calls[0][0];
    await messageHandler({
      type: 'message',
      data: { command: 'ping' },
    } as MessageEvent);

    expect(messageManager.receiveMessage).toHaveBeenCalledWith(
      { command: 'ping' },
      deps.managerCoordinator
    );

    handlers.onWindowFocus();
    handlers.onWindowBlur();

    expect(deps.postMessageToExtension).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'terminalFocused', terminalId: 'terminal-1' })
    );
    expect(deps.postMessageToExtension).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'terminalBlurred', terminalId: 'terminal-1' })
    );
  });
});
