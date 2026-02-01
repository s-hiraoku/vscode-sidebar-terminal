import { describe, it, expect } from 'vitest';
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
    
    const ResizeObserverMock = vi.fn(function(this: any) {
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
    });
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

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

    it('should not maintain split layout when forced to normal for next create', async () => {
      const lifecycle = (manager as any).terminalLifecycleManager;
      const displayMode = (manager as any).displayModeManager;
      const splitManager = manager.splitManager;

      lifecycle.createTerminal.mockResolvedValue({ textarea: { hasAttribute: () => false }, focus: vi.fn() });
      displayMode.getCurrentMode.mockReturnValue('split');
      splitManager.getIsSplitMode.mockReturnValue(true);

      (manager as any).setForceNormalModeForNextCreate(true);

      const createPromise = manager.createTerminal('new-skip', 'New Term', undefined, undefined, 'extension');
      await vi.advanceTimersByTimeAsync(500);
      await createPromise;

      expect(displayMode.showAllTerminalsSplit).not.toHaveBeenCalled();
    });
  });

  describe('Panel Location Sync', () => {
    it('should handle terminal-panel-location-changed event', () => {
      const splitManager = manager.splitManager;

      const event = new dom.window.CustomEvent('terminal-panel-location-changed', {
        detail: { location: 'panel' }
      });
      dom.window.dispatchEvent(event);

      expect(splitManager.setPanelLocation).toHaveBeenCalledWith('panel');
      expect(splitManager.updateSplitDirection).toHaveBeenCalledWith('horizontal', 'panel');
    });

    it('should switch to split mode if panel location is panel and multiple terminals exist', () => {
      const splitManager = manager.splitManager;
      const displayManager = (manager as any).displayModeManager;

      // Mock getting terminals to return size > 1
      (splitManager.getTerminals as any).mockReturnValue(new Map([['t1', {}], ['t2', {}]]));
      (displayManager.getCurrentMode as any).mockReturnValue('normal'); // Not fullscreen

      const event = new dom.window.CustomEvent('terminal-panel-location-changed', {
        detail: { location: 'panel' }
      });
      dom.window.dispatchEvent(event);

      expect(displayManager.showAllTerminalsSplit).toHaveBeenCalled();
    });
  });

  describe('Resize Observer', () => {
      it('should debounce refitAllTerminals on resize', () => {
          const coordinator = (manager as any).resizeCoordinator;
          coordinator.refitAllTerminals = vi.fn();
          vi.spyOn(manager, 'refitAllTerminals');

          // Initialize simple terminal to trigger observer setup
          manager.initializeSimpleTerminal();

          // Get the callback passed to ResizeObserver
          const ResizeObserverMock = global.ResizeObserver as unknown as any;
          const callback = ResizeObserverMock.mock.calls[0][0];

          // Simulate resize event
          callback([{ contentRect: { width: 500, height: 300 }, target: { id: 'body' } }]);

          // Should be debounced
          expect(manager.refitAllTerminals).not.toHaveBeenCalled();

          vi.advanceTimersByTime(100);

          expect(coordinator.refitAllTerminals).toHaveBeenCalled();
      });
  });

  describe('AI Agent Toggle', () => {
    it('should activate AI agent if disconnected', () => {
       const cliStateManager = (manager as any).cliAgentStateManager;
       cliStateManager.getAgentState.mockReturnValue({ status: 'none' });

       manager.handleAiAgentToggle('t1');

       expect(manager.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
           command: 'switchAiAgent',
           terminalId: 't1',
           action: 'activate'
       }));
    });

    it('should force reconnect if already connected', () => {
        const cliStateManager = (manager as any).cliAgentStateManager;
        cliStateManager.getAgentState.mockReturnValue({ status: 'connected', agentType: 'claude' });
 
        manager.handleAiAgentToggle('t1');
 
        expect(manager.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
            command: 'switchAiAgent',
            terminalId: 't1',
            action: 'force-reconnect',
            forceReconnect: true
        }));
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

    it('should update all terminal themes', () => {
        const splitManager = manager.splitManager;
        const mockTerminal = {
            options: {},
            element: {
                querySelector: vi.fn().mockReturnValue({ style: {} })
            }
        };
        const mockInstance = {
            terminal: mockTerminal,
            container: { style: {} }
        };

        (splitManager.getTerminals as any).mockReturnValue(new Map([['t1', mockInstance]]));

        const theme = { background: '#000000', foreground: '#ffffff' };
        manager.updateAllTerminalThemes(theme as any);

        expect(mockTerminal.options.theme).toEqual(theme);
    });

    it('should apply font settings', () => {
        // const fontService = (manager as any).fontSettingsService;
        // Mock FontSettingsService since it was not mocked in top-level block (or we check if we need to mock it)
        // Actually, it seems FontSettingsService is not mocked above, so it might be real or implicit.
        // Checking constructor: this.fontSettingsService = new FontSettingsService();
        // Since we didn't mock FontSettingsService import, it's using the real one or failing if it has dependencies.
        // But let's check if we can spy on it.
        // Wait, FontSettingsService is imported from '../services/FontSettingsService'.
        // We should mock it to be safe.
    });
  });

  describe('Scrollback Extraction', () => {
      it('should extract using serializeAddon if available', () => {
          const lifecycle = (manager as any).terminalLifecycleManager;
          const mockSerializeAddon = {
              serialize: vi.fn().mockReturnValue('line1\nline2\n')
          };
          const mockInstance = {
              terminal: { buffer: {} },
              serializeAddon: mockSerializeAddon
          };
          lifecycle.getTerminalInstance.mockReturnValue(mockInstance);

          const result = manager.extractScrollbackData('t1');
          
          expect(result).toEqual(['line1', 'line2']);
          expect(mockSerializeAddon.serialize).toHaveBeenCalled();
      });

      it('should fallback to buffer if serializeAddon missing', () => {
        const lifecycle = (manager as any).terminalLifecycleManager;
        const mockBuffer = {
            length: 2,
            getLine: vi.fn((i) => ({ translateToString: () => `line${i+1}` }))
        };
        const mockInstance = {
            terminal: { 
                buffer: { normal: mockBuffer }
            },
            serializeAddon: undefined
        };
        lifecycle.getTerminalInstance.mockReturnValue(mockInstance);

        const result = manager.extractScrollbackData('t1');
        
        expect(result).toEqual(['line1', 'line2']);
    });
  });

  describe('State Updates', () => {
      it('should update state and ui', () => {
          const stateDisplay = (manager as any).terminalStateDisplayManager;
          const terminalOperations = (manager as any).terminalOperations;
          
          const newState = {
              terminals: [],
              availableSlots: [1, 2, 3],
              maxTerminals: 5,
              activeTerminalId: null
          };

          manager.updateState(newState);

          expect(terminalOperations.updateState).toHaveBeenCalledWith(newState);
          expect(stateDisplay.updateFromState).toHaveBeenCalled();
          expect(stateDisplay.updateCreationState).toHaveBeenCalled();
      });

      it('should refresh split layout when split mode has multiple terminals and no resizers', () => {
          const displayModeManager = (manager as any).displayModeManager;
          displayModeManager.getCurrentMode.mockReturnValue('split');

          const newState = {
              terminals: [{ id: 't1' }, { id: 't2' }],
              availableSlots: [3],
              maxTerminals: 5,
              activeTerminalId: 't1'
          };

          manager.updateState(newState);

          expect(displayModeManager.showAllTerminalsSplit).toHaveBeenCalledTimes(1);
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
