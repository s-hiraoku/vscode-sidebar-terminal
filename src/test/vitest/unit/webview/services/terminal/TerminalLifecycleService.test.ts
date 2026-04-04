import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { SplitManager } from '../../../../../../webview/managers/SplitManager';
import { TerminalLifecycleService } from '../../../../../../webview/services/terminal/TerminalLifecycleService';

vi.mock('../../../../../../webview/optimizers/RenderingOptimizer', () => ({
  RenderingOptimizer: class {
    setupOptimizedResize = vi.fn();
    enableWebGL = vi.fn();
    setupSmoothScrolling = vi.fn();
    dispose = vi.fn();
  },
}));

describe('TerminalLifecycleService', () => {
  let dom: JSDOM;
  let splitManager: SplitManager;
  let service: TerminalLifecycleService;
  let coordinator: any;
  let terminal: any;
  let fitAddon: any;
  let container: HTMLElement;
  let terminalContent: HTMLElement;
  let containerManager: any;
  let displayModeManager: any;
  let scrollIndicatorDisposables: Map<string, () => void>;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><body></body>');
    vi.useFakeTimers();
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Element', dom.window.Element);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    splitManager = new SplitManager({ postMessageToExtension: vi.fn() } as any);
    containerManager = {
      registerContainer: vi.fn(),
      unregisterContainer: vi.fn(),
      clearSplitArtifacts: vi.fn(),
      applyDisplayState: vi.fn(),
    };
    displayModeManager = {
      getCurrentMode: vi.fn().mockReturnValue('normal'),
      setDisplayMode: vi.fn(),
      showAllTerminalsSplit: vi.fn(),
    };
    coordinator = {
      postMessageToExtension: vi.fn(),
      getTerminalContainerManager: vi.fn().mockReturnValue(containerManager),
      getDisplayModeManager: vi.fn().mockReturnValue(displayModeManager),
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      inputManager: {
        addXtermClickHandler: vi.fn(),
        removeTerminalHandlers: vi.fn(),
      },
    };
    terminal = {
      cols: 80,
      rows: 24,
      dispose: vi.fn(),
      refresh: vi.fn(),
    };
    fitAddon = {
      fit: vi.fn(),
    };
    container = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({
        width: 800,
        height: 600,
      }) as DOMRect;
    terminalContent = document.createElement('div');
    const xterm = document.createElement('div');
    xterm.className = 'xterm';
    const viewport = document.createElement('div');
    viewport.className = 'xterm-viewport';
    container.appendChild(xterm);
    container.appendChild(viewport);

    scrollIndicatorDisposables = new Map();
    service = new TerminalLifecycleService({
      splitManager,
      coordinator,
      linkManager: {
        setLinkModifier: vi.fn(),
        registerTerminalLinkHandlers: vi.fn(),
        unregisterTerminalLinkProvider: vi.fn(),
      } as any,
      scrollbarService: {
        enableScrollbarDisplay: vi.fn(),
      } as any,
      mouseTrackingService: {
        setup: vi.fn(),
        cleanup: vi.fn(),
      } as any,
      scrollIndicatorService: {
        attach: vi.fn().mockReturnValue(vi.fn()),
      } as any,
      autoSaveService: {
        setupScrollbackAutoSave: vi.fn(),
      } as any,
      lifecycleController: {
        disposeTerminal: vi.fn(),
      } as any,
      eventManager: {
        removeTerminalEvents: vi.fn(),
      } as any,
      scrollIndicatorDisposables,
    });
  });

  afterEach(() => {
    dom.window.close();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('registers the terminal instance, container, and input handlers during finalization', async () => {
    const terminalInstance = await service.finalizeTerminalSetup({
      terminalId: 'terminal-1',
      terminalName: 'Terminal 1',
      terminal,
      fitAddon,
      // @ts-expect-error - test mock type
      serializeAddon: { serialize: vi.fn() },
      searchAddon: undefined,
      container,
      terminalContent,
      containerElements: { container, body: terminalContent },
      terminalNumberToUse: 1,
      terminalConfig: { enableGpuAcceleration: false },
      linkModifier: 'alt',
      config: undefined,
      uiManager: { headerElementsCache: new Map() },
    });

    vi.runAllTimers();

    expect(splitManager.getTerminals().get('terminal-1')).toBe(terminalInstance);
    expect(splitManager.getTerminalContainers().get('terminal-1')).toBe(container);
    expect(containerManager.registerContainer).toHaveBeenCalledWith('terminal-1', container);
    expect(coordinator.inputManager.addXtermClickHandler).toHaveBeenCalledWith(
      terminal,
      'terminal-1',
      container,
      coordinator
    );
    expect(coordinator.postMessageToExtension).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'terminalReady', terminalId: 'terminal-1' })
    );
  });

  it('removes the terminal, unregisters the container, and clears split artifacts when one remains', async () => {
    splitManager.getTerminals().set('terminal-1', {
      id: 'terminal-1',
      terminal,
      fitAddon,
      container,
      name: 'Terminal 1',
      isActive: false,
      number: 1,
      renderingOptimizer: {
        dispose: vi.fn(),
      },
    } as any);
    splitManager.getTerminalContainers().set('terminal-1', container);

    const result = await service.removeTerminal('terminal-1');

    expect(result).toBe(true);
    expect(splitManager.getTerminals().has('terminal-1')).toBe(false);
    expect(splitManager.getTerminalContainers().has('terminal-1')).toBe(false);
    expect(containerManager.unregisterContainer).toHaveBeenCalledWith('terminal-1');
    expect(containerManager.clearSplitArtifacts).toHaveBeenCalled();
    expect(terminal.dispose).toHaveBeenCalled();
  });
});
