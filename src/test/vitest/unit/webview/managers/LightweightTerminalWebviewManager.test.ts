import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { LightweightTerminalWebviewManager } from '../../../../../webview/managers/LightweightTerminalWebviewManager';

// Mock all internal managers to avoid complex DOM/Logic setups
vi.mock('../../../../../webview/managers/WebViewApiManager', () => ({ WebViewApiManager: class { postMessageToExtension = vi.fn(); loadState = vi.fn().mockReturnValue(null); saveState = vi.fn(); dispose = vi.fn(); getDiagnostics = vi.fn().mockReturnValue({}); } }));
vi.mock('../../../../../webview/managers/SplitManager', () => ({ SplitManager: class { setPanelLocation = vi.fn(); updateSplitDirection = vi.fn(); getTerminals = vi.fn().mockReturnValue(new Map()); getTerminalContainers = vi.fn().mockReturnValue(new Map()); getIsSplitMode = vi.fn().mockReturnValue(false); } }));
vi.mock('../../../../../webview/managers/TerminalLifecycleCoordinator', () => ({ TerminalLifecycleCoordinator: class { createTerminal = vi.fn(); removeTerminal = vi.fn(); getActiveTerminalId = vi.fn().mockReturnValue('t1'); getTerminalInstance = vi.fn(); getAllTerminalInstances = vi.fn().mockReturnValue(new Map()); getAllTerminalContainers = vi.fn().mockReturnValue(new Map()); getTerminalStats = vi.fn().mockReturnValue({}); dispose = vi.fn(); setActiveTerminalId = vi.fn(); resizeAllTerminals = vi.fn(); initializeSimpleTerminal = vi.fn(); switchToTerminal = vi.fn().mockResolvedValue(true); writeToTerminal = vi.fn(); } }));
vi.mock('../../../../../webview/managers/TerminalTabManager', () => ({ TerminalTabManager: class { setCoordinator = vi.fn(); initialize = vi.fn(); addTab = vi.fn(); removeTab = vi.fn(); setActiveTab = vi.fn(); updateTheme = vi.fn(); updateModeIndicator = vi.fn(); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/ConsolidatedMessageManager', () => ({ ConsolidatedMessageManager: class { setCoordinator = vi.fn(); postMessage = vi.fn(); receiveMessage = vi.fn(); updatePanelLocationIfNeeded = vi.fn().mockReturnValue(false); getCurrentPanelLocation = vi.fn().mockReturnValue('sidebar'); getCurrentFlexDirection = vi.fn().mockReturnValue('column'); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/UIManager', () => ({ UIManager: class { setActiveBorderMode = vi.fn(); updateTerminalBorders = vi.fn(); updateSplitTerminalBorders = vi.fn(); applyAllVisualSettings = vi.fn(); setTabThemeUpdater = vi.fn(); applyTheme = vi.fn(); updateCliAgentStatusByTerminalId = vi.fn(); } }));
vi.mock('../../../../../webview/managers/ConfigManager', () => ({ ConfigManager: class { setFontSettingsService = vi.fn(); applySettings = vi.fn(); getCurrentSettings = vi.fn().mockReturnValue({}); } }));
vi.mock('../../../../../webview/services/WebViewPersistenceService', () => ({ WebViewPersistenceService: class { addTerminal = vi.fn(); removeTerminal = vi.fn(); saveSession = vi.fn().mockResolvedValue(true); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/DisplayModeManager', () => ({ DisplayModeManager: class { initialize = vi.fn(); getCurrentMode = vi.fn().mockReturnValue('normal'); setDisplayMode = vi.fn(); showAllTerminalsSplit = vi.fn(); showTerminalFullscreen = vi.fn(); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/TerminalContainerManager', () => ({ TerminalContainerManager: class { initialize = vi.fn(); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/HeaderManager', () => ({ HeaderManager: class { setCoordinator = vi.fn(); createWebViewHeader = vi.fn(); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/TerminalStateDisplayManager', () => ({ TerminalStateDisplayManager: class { updateFromState = vi.fn(); updateCreationState = vi.fn(); } }));
vi.mock('../../../../../webview/coordinators/TerminalOperationsCoordinator', () => ({ TerminalOperationsCoordinator: class { isTerminalCreationPending = vi.fn().mockReturnValue(false); markTerminalCreationPending = vi.fn(); clearTerminalCreationPending = vi.fn(); canCreateTerminal = vi.fn().mockReturnValue(true); updateState = vi.fn(); hasPendingCreations = vi.fn().mockReturnValue(false); getPendingCreationsCount = vi.fn().mockReturnValue(0); getPendingDeletions = vi.fn().mockReturnValue([]); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/CliAgentStateManager', () => ({ CliAgentStateManager: class { detectAgentActivity = vi.fn().mockReturnValue({ isAgentOutput: false }); removeTerminalState = vi.fn(); setAgentConnected = vi.fn(); setAgentDisconnected = vi.fn(); getAgentState = vi.fn(); getAgentStats = vi.fn().mockReturnValue({}); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/DebugPanelManager', () => ({ DebugPanelManager: class { setCallbacks = vi.fn(); updateDisplay = vi.fn(); toggle = vi.fn(); isActive = vi.fn().mockReturnValue(false); exportDiagnostics = vi.fn(); dispose = vi.fn(); } }));
vi.mock('../../../../../webview/managers/EventHandlerManager', () => ({ EventHandlerManager: class { setMessageEventHandler = vi.fn(); onPageUnload = vi.fn(); getEventStats = vi.fn().mockReturnValue({}); dispose = vi.fn(); } }));

describe('LightweightTerminalWebviewManager', () => {
  let dom: JSDOM;
  let manager: LightweightTerminalWebviewManager;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="terminal-body"></div></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', dom.window.navigator);
    vi.stubGlobal('performance', { now: () => Date.now() });
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });

    manager = new LightweightTerminalWebviewManager();
    vi.spyOn(manager, 'postMessageToExtension');
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('Integration & Delegation', () => {
    it('should initialize all major components', () => {
      expect(manager.splitManager).toBeDefined();
      expect(manager.terminalTabManager).toBeDefined();
      expect(manager.inputManager).toBeDefined();
    });

    it('should delegate message posting to webViewApiManager', () => {
      const apiManager = (manager as any).webViewApiManager;
      manager.postMessageToExtension({ hello: 'world' });
      expect(apiManager.postMessageToExtension).toHaveBeenCalledWith({ hello: 'world' });
    });

    it('should coordinate active terminal changes across components', () => {
      const lifecycle = (manager as any).terminalLifecycleManager;
      const tabs = manager.terminalTabManager;
      const ui = (manager as any).uiManager;

      manager.setActiveTerminalId('term-1');

      expect(lifecycle.setActiveTerminalId).toHaveBeenCalledWith('term-1');
      expect(tabs.setActiveTab).toHaveBeenCalledWith('term-1');
      expect(ui.updateTerminalBorders).toHaveBeenCalled();
    });
  });

  describe('Terminal Operations', () => {
    it('should coordinate terminal creation', async () => {
      const lifecycle = (manager as any).terminalLifecycleManager;
      const tabs = manager.terminalTabManager;
      
      lifecycle.createTerminal.mockResolvedValue({ textarea: { hasAttribute: () => false }, focus: vi.fn() });
      
      const createPromise = manager.createTerminal('new-t', 'New Term');
      
      // Wait for all async parts including internal setTimeouts
      await vi.advanceTimersByTimeAsync(500);
      
      const terminal = await createPromise;
      
      expect(terminal).toBeDefined();
      expect(lifecycle.createTerminal).toHaveBeenCalled();
      expect(tabs.addTab).toHaveBeenCalledWith('new-t', 'New Term', expect.anything());
      
      // Ensure createTerminal command was sent
      expect(manager.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'createTerminal',
        terminalId: 'new-t'
      }));
    });

    it('should ignore duplicate terminal creation requests', async () => {
      const ops = (manager as any).terminalOperations;
      ops.isTerminalCreationPending.mockReturnValue(true);
      
      const terminal = await manager.createTerminal('pending-t', 'Pending');
      
      expect(terminal).toBeNull();
    });

    it('should coordinate terminal removal', async () => {
      const lifecycle = (manager as any).terminalLifecycleManager;
      const tabs = manager.terminalTabManager;
      
      lifecycle.removeTerminal.mockResolvedValue(true);
      
      const result = await manager.removeTerminal('t1');
      
      expect(result).toBe(true);
      expect(tabs.removeTab).toHaveBeenCalledWith('t1');
      expect(lifecycle.removeTerminal).toHaveBeenCalledWith('t1');
    });
  });

  describe('Settings coordination', () => {
    it('should propagate settings to config and ui managers', () => {
      const config = (manager as any).configManager;
      const ui = (manager as any).uiManager;
      
      const newSettings = { fontSize: 20 };
      manager.applySettings(newSettings);

      expect(config.applySettings).toHaveBeenCalled();
      expect(ui.setActiveBorderMode).toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('should dispose all managers on dispose', () => {
      const apiManager = (manager as any).webViewApiManager;
      const lifecycle = (manager as any).terminalLifecycleManager;
      
      manager.dispose();
      
      expect(apiManager.dispose).toHaveBeenCalled();
      expect(lifecycle.dispose).toHaveBeenCalled();
    });
  });
});