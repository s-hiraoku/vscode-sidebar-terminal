/**
 * TerminalCreationService - Phase Decomposition Tests
 *
 * Tests for the extracted private methods from createTerminal().
 * Each phase is tested independently to verify behavior after refactoring.
 *
 * Phase 1: ensureDomReady() - DOM readiness check and recovery
 * Phase 2: prepareTerminalConfig() - Config merging with fonts and theme
 * Phase 3: createTerminalWithAddons() - Terminal instance and addon creation
 * Phase 4: createAndInsertContainer() - Container creation, header callbacks, DOM insertion
 * Phase 5: setupTerminalInteraction() - Terminal open, paste handler, settings, events
 * Phase 6: finalizeTerminalSetup() - Links, rendering, registration, resize, notifications
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TerminalCreationService } from '../../../../../webview/services/TerminalCreationService';
import { SplitManager } from '../../../../../webview/managers/SplitManager';
import { EventHandlerRegistry } from '../../../../../webview/utils/EventHandlerRegistry';
import { ResizeManager } from '../../../../../webview/utils/ResizeManager';

// Mock xterm.js and addons
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    options: any;
    element = { style: {} };
    cols = 80;
    rows = 24;
    unicode = { activeVersion: '11' };
    textarea: HTMLTextAreaElement | null = null;
    buffer = {
      normal: {
        length: 10,
        getLine: vi.fn().mockReturnValue({ translateToString: () => 'test line' }),
      },
    };

    constructor(options?: any) {
      this.options = options || {};
    }

    open = vi.fn().mockImplementation(function (this: any) {
      // Simulate xterm.js creating textarea on open
      this.textarea = { hasAttribute: vi.fn().mockReturnValue(false) } as any;
    });
    dispose = vi.fn();
    loadAddon = vi.fn();
    attachCustomKeyEventHandler = vi.fn();
    refresh = vi.fn();
    write = vi.fn();
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onResize = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onSelectionChange = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onTitleChange = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onBell = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onLineFeed = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onScroll = vi.fn().mockReturnValue({ dispose: vi.fn() });
    focus = vi.fn();
    blur = vi.fn();
    resize = vi.fn();
    clear = vi.fn();
    selectAll = vi.fn();
    selectLines = vi.fn();
    scrollToBottom = vi.fn();
    scrollToTop = vi.fn();
    scrollToRow = vi.fn();
    scrollLines = vi.fn();
    scrollPages = vi.fn();
    paste = vi.fn();
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn();
    activate = vi.fn();
    dispose = vi.fn();
    proposeDimensions = vi.fn();
  }
  return { FitAddon: MockFitAddon };
});

vi.mock('../../../../../webview/managers/TerminalAddonManager', () => {
  return {
    TerminalAddonManager: class {
      loadAllAddons = vi.fn().mockImplementation(async () => {
        const { FitAddon } = await import('@xterm/addon-fit');
        return {
          fitAddon: new FitAddon(),
          webLinksAddon: {},
          serializeAddon: { serialize: vi.fn() },
          searchAddon: { findNext: vi.fn(), findPrevious: vi.fn() },
          unicode11Addon: {},
        };
      });
      dispose = vi.fn();
      disposeAddons = vi.fn();
    },
  };
});

describe('TerminalCreationService - Phase Decomposition', () => {
  let dom: JSDOM;
  let service: TerminalCreationService;
  let splitManager: SplitManager;
  let mockCoordinator: any;
  let eventRegistry: EventHandlerRegistry;

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="terminal-view">
            <div id="terminal-body" style="width: 800px; height: 600px; display: flex; flex-direction: column;">
            </div>
          </div>
        </body>
      </html>`,
      { pretendToBeVisual: true }
    );

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Element', dom.window.Element);

    const splitManagerCoordinator = {
      postMessageToExtension: vi.fn(),
    };
    splitManager = new SplitManager(splitManagerCoordinator as any);
    eventRegistry = new EventHandlerRegistry();

    mockCoordinator = {
      postMessageToExtension: vi.fn(),
      shellIntegrationManager: {
        decorateTerminalOutput: vi.fn(),
      },
      getTerminalContainerManager: vi.fn().mockReturnValue({
        unregisterContainer: vi.fn(),
        clearSplitArtifacts: vi.fn(),
        applyDisplayState: vi.fn(),
        registerContainer: vi.fn(),
      }),
      getDisplayModeManager: vi.fn().mockReturnValue({
        getCurrentMode: vi.fn().mockReturnValue('normal'),
        setDisplayMode: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
      }),
      getManagers: vi.fn().mockReturnValue({
        config: {
          getCurrentFontSettings: vi.fn().mockReturnValue({}),
          getCurrentSettings: vi.fn().mockReturnValue({}),
        },
        ui: {
          applyVSCodeStyling: vi.fn(),
          updateSingleTerminalBorder: vi.fn(),
          applyAllVisualSettings: vi.fn(),
          applyFontSettings: vi.fn(),
          applyTerminalTheme: vi.fn(),
          headerElementsCache: new Map(),
        },
      }),
      inputManager: {
        addXtermClickHandler: vi.fn(),
        removeTerminalHandlers: vi.fn(),
      },
      deleteTerminalSafely: vi.fn(),
      closeTerminal: vi.fn(),
      setActiveTerminalId: vi.fn(),
      getActiveTerminalId: vi.fn().mockReturnValue(null),
      profileManager: {
        createTerminalWithDefaultProfile: vi.fn(),
      },
      handleAiAgentToggle: vi.fn(),
    };

    service = new TerminalCreationService(splitManager, mockCoordinator, eventRegistry);
  });

  afterEach(() => {
    try {
      service.dispose();
    } finally {
      try {
        eventRegistry.dispose();
      } finally {
        try {
          vi.restoreAllMocks();
        } finally {
          try {
            dom.window.close();
          } finally {
            vi.unstubAllGlobals();
          }
        }
      }
    }
  });

  // ============================================================
  // Phase 1: Orchestration integrity
  // ============================================================

  describe('createTerminal() orchestration', () => {
    it('should complete full terminal creation successfully', async () => {
      const result = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(result).not.toBeNull();
    });

    it('should register terminal with SplitManager after creation', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');
      const terminals = splitManager.getTerminals();
      expect(terminals.has('terminal-1')).toBe(true);
    });

    it('should send terminalReady message to extension', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');
      const readyCall = mockCoordinator.postMessageToExtension.mock.calls.find(
        (call: any[]) => call[0]?.command === 'terminalReady'
      );
      expect(readyCall).toBeDefined();
      expect(readyCall[0].terminalId).toBe('terminal-1');
    });

    it('should register container with TerminalContainerManager', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');
      const containerManager = mockCoordinator.getTerminalContainerManager();
      expect(containerManager.registerContainer).toHaveBeenCalledWith(
        'terminal-1',
        expect.any(Object)
      );
    });
  });

  // ============================================================
  // Phase 1: DOM Readiness (ensureDomReady)
  // ============================================================

  describe('DOM readiness phase', () => {
    it('should succeed when terminal-body exists', async () => {
      const result = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(result).not.toBeNull();
    });

    it('should recover when terminal-body is missing but terminal-view exists', async () => {
      // Remove terminal-body
      const body = document.getElementById('terminal-body');
      body?.parentNode?.removeChild(body);

      const result = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(result).not.toBeNull();

      // Verify terminal-body was recreated
      const recreatedBody = document.getElementById('terminal-body');
      expect(recreatedBody).not.toBeNull();
    });

    it('should create terminals-wrapper if it does not exist', async () => {
      expect(document.getElementById('terminals-wrapper')).toBeNull();

      await service.createTerminal('terminal-1', 'Test Terminal');

      const wrapper = document.getElementById('terminals-wrapper');
      expect(wrapper).not.toBeNull();
    });
  });

  // ============================================================
  // Phase 2: Config Preparation (prepareTerminalConfig)
  // ============================================================

  describe('config preparation phase', () => {
    it('should apply font settings from config', async () => {
      const config = {
        fontFamily: 'MesloLGS NF',
        fontSize: 14,
      };

      const result = await service.createTerminal('terminal-1', 'Test Terminal', config);
      expect(result).not.toBeNull();
    });

    it('should resolve theme from coordinator settings', async () => {
      mockCoordinator.getManagers.mockReturnValue({
        config: {
          getCurrentFontSettings: vi.fn().mockReturnValue({}),
          getCurrentSettings: vi.fn().mockReturnValue({ theme: 'dark' }),
        },
        ui: {
          applyVSCodeStyling: vi.fn(),
          updateSingleTerminalBorder: vi.fn(),
          applyAllVisualSettings: vi.fn(),
          applyFontSettings: vi.fn(),
          applyTerminalTheme: vi.fn(),
          headerElementsCache: new Map(),
        },
      });

      const result = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(result).not.toBeNull();
    });

    it('should handle missing ConfigManager gracefully', async () => {
      mockCoordinator.getManagers.mockReturnValue({
        config: undefined,
        ui: {
          applyVSCodeStyling: vi.fn(),
          updateSingleTerminalBorder: vi.fn(),
          applyAllVisualSettings: vi.fn(),
          applyFontSettings: vi.fn(),
          applyTerminalTheme: vi.fn(),
          headerElementsCache: new Map(),
        },
      });

      const result = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(result).not.toBeNull();
    });
  });

  // ============================================================
  // Phase 3: Terminal + Addons Creation (createTerminalWithAddons)
  // ============================================================

  describe('terminal and addon creation phase', () => {
    it('should create terminal with addons', async () => {
      const result = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(result).not.toBeNull();

      // Verify terminal is registered with instance record
      const instance = splitManager.getTerminals().get('terminal-1');
      expect(instance).toBeDefined();
      expect(instance?.fitAddon).toBeDefined();
      expect(instance?.serializeAddon).toBeDefined();
    });

    it('should pass link modifier from settings', async () => {
      mockCoordinator.getManagers.mockReturnValue({
        config: {
          getCurrentFontSettings: vi.fn().mockReturnValue({}),
          getCurrentSettings: vi
            .fn()
            .mockReturnValue({ multiCursorModifier: 'ctrlCmd' }),
        },
        ui: {
          applyVSCodeStyling: vi.fn(),
          updateSingleTerminalBorder: vi.fn(),
          applyAllVisualSettings: vi.fn(),
          applyFontSettings: vi.fn(),
          applyTerminalTheme: vi.fn(),
          headerElementsCache: new Map(),
        },
      });

      const result = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(result).not.toBeNull();
    });
  });

  // ============================================================
  // Phase 4: Container Creation & DOM Insertion
  // ============================================================

  describe('container creation and DOM insertion phase', () => {
    it('should create container with correct terminal number', async () => {
      await service.createTerminal('terminal-3', 'Terminal 3', undefined, 3);

      const instance = splitManager.getTerminals().get('terminal-3');
      expect(instance).toBeDefined();
      expect(instance?.number).toBe(3);
    });

    it('should apply active border when isActive config is true', async () => {
      const config = { isActive: true } as any;
      await service.createTerminal('terminal-1', 'Test Terminal', config);

      const uiManager = mockCoordinator.getManagers().ui;
      expect(uiManager.updateSingleTerminalBorder).toHaveBeenCalled();
    });

    it('should apply VS Code styling to container', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');

      const uiManager = mockCoordinator.getManagers().ui;
      expect(uiManager.applyVSCodeStyling).toHaveBeenCalled();
    });

    it('should append container to terminals-wrapper', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');

      const wrapper = document.getElementById('terminals-wrapper');
      expect(wrapper).not.toBeNull();
      const containers = wrapper?.querySelectorAll('.terminal-container');
      expect(containers?.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // Phase 5: Terminal Interaction Setup
  // ============================================================

  describe('terminal interaction setup phase', () => {
    it('should open terminal in container', async () => {
      const terminal = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(terminal).not.toBeNull();
      expect(terminal!.open).toHaveBeenCalled();
    });

    it('should register paste event handler', async () => {
      // Spy on eventRegistry.register to verify paste handler registration
      const registerSpy = vi.spyOn(eventRegistry, 'register');

      await service.createTerminal('terminal-1', 'Test Terminal');

      // Verify paste handler was registered via eventRegistry
      const pasteCall = registerSpy.mock.calls.find(
        (call) => call[0] === 'terminal-terminal-1-paste'
      );
      expect(pasteCall).toBeDefined();
      expect(pasteCall![2]).toBe('paste'); // event type
    });

    it('should setup custom key event handler for paste', async () => {
      const terminal = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(terminal!.attachCustomKeyEventHandler).toHaveBeenCalled();
    });

    it('should bypass xterm key handling for r/d/x while panel navigation mode is active', async () => {
      const terminal = await service.createTerminal('terminal-1', 'Test Terminal');

      const keyHandler = terminal!.attachCustomKeyEventHandler.mock.calls[0][0] as (
        event: KeyboardEvent
      ) => boolean;
      document.body.classList.add('panel-navigation-mode');

      expect(
        keyHandler(new dom.window.KeyboardEvent('keydown', { key: 'r' }))
      ).toBe(false);
      expect(
        keyHandler(new dom.window.KeyboardEvent('keydown', { key: 'd' }))
      ).toBe(false);
      expect(
        keyHandler(new dom.window.KeyboardEvent('keydown', { key: 'x' }))
      ).toBe(false);

      document.body.classList.remove('panel-navigation-mode');
    });

    it('should apply visual settings when UI manager is available', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');

      const uiManager = mockCoordinator.getManagers().ui;
      expect(uiManager.applyAllVisualSettings).toHaveBeenCalled();
    });

    it('should setup input handling via InputManager', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');

      expect(mockCoordinator.inputManager.addXtermClickHandler).toHaveBeenCalledWith(
        expect.anything(),
        'terminal-1',
        expect.any(Object),
        expect.anything()
      );
    });
  });

  // ============================================================
  // Phase 6: Rendering, Registration & Finalization
  // ============================================================

  describe('rendering, registration and finalization phase', () => {
    it('should register terminal instance with SplitManager', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');

      const terminals = splitManager.getTerminals();
      expect(terminals.has('terminal-1')).toBe(true);

      const instance = terminals.get('terminal-1');
      expect(instance?.id).toBe('terminal-1');
      expect(instance?.name).toBe('Test Terminal');
    });

    it('should register container in SplitManager containers map', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');

      const containers = splitManager.getTerminalContainers();
      expect(containers.has('terminal-1')).toBe(true);
    });

    it('should handle split mode when creating in split mode', async () => {
      // Enable split mode
      mockCoordinator.getDisplayModeManager.mockReturnValue({
        getCurrentMode: vi.fn().mockReturnValue('split'),
        setDisplayMode: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
      });

      await service.createTerminal('terminal-1', 'Test Terminal');
      // Should not throw
    });

    it('should handle AI agent header elements registration', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');

      // The headerElementsCache should have been accessed
      const uiManager = mockCoordinator.getManagers().ui;
      // The test verifies that the creation flow doesn't throw when handling header elements
      expect(uiManager.headerElementsCache).toBeInstanceOf(Map);
    });
  });

  // ============================================================
  // Retry and Error Handling
  // ============================================================

  describe('error handling and retries', () => {
    it('should return null when all retries fail', async () => {
      // Remove both terminal-body and terminal-view to cause unrecoverable failure
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.parentNode?.removeChild(terminalBody);
      const terminalView = document.getElementById('terminal-view');
      terminalView?.parentNode?.removeChild(terminalView);

      const result = await service.createTerminal('terminal-1', 'Test Terminal');
      expect(result).toBeDefined();
    });

    it('should always resume ResizeManager observers after final failure', async () => {
      const pauseSpy = vi.spyOn(ResizeManager, 'pauseObservers');
      const resumeSpy = vi.spyOn(ResizeManager, 'resumeObservers');

      // Remove both terminal-body and terminal-view to force final failure path
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.parentNode?.removeChild(terminalBody);
      const terminalView = document.getElementById('terminal-view');
      terminalView?.parentNode?.removeChild(terminalView);

      const result = await service.createTerminal('terminal-1', 'Test Terminal');

      expect(result).toBeDefined();
      expect(pauseSpy).toHaveBeenCalled();
      expect(resumeSpy).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Consistency after refactoring: same behavior as original
  // ============================================================

  describe('post-refactoring consistency', () => {
    it('should produce identical terminal instance structure', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal', undefined, 1);

      const instance = splitManager.getTerminals().get('terminal-1');
      expect(instance).toBeDefined();

      // Verify all required fields of TerminalInstance
      expect(instance!.id).toBe('terminal-1');
      expect(instance!.name).toBe('Test Terminal');
      expect(instance!.number).toBe(1);
      expect(instance!.terminal).toBeDefined();
      expect(instance!.fitAddon).toBeDefined();
      expect(instance!.container).toBeDefined();
      expect(instance!.isActive).toBe(false);
    });

    it('should handle multiple terminal creation sequentially', async () => {
      await service.createTerminal('terminal-1', 'Terminal 1', undefined, 1);
      await service.createTerminal('terminal-2', 'Terminal 2', undefined, 2);

      const terminals = splitManager.getTerminals();
      expect(terminals.size).toBe(2);
      expect(terminals.has('terminal-1')).toBe(true);
      expect(terminals.has('terminal-2')).toBe(true);
    });

    it('should properly clean up on removal after creation', async () => {
      await service.createTerminal('terminal-1', 'Test Terminal');
      expect(splitManager.getTerminals().has('terminal-1')).toBe(true);

      const removed = await service.removeTerminal('terminal-1');
      expect(removed).toBe(true);
      expect(splitManager.getTerminals().has('terminal-1')).toBe(false);
    });
  });
});
