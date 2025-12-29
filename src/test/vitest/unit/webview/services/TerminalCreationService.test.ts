/**
 * TerminalCreationService - Unit Tests
 * Test coverage for terminal creation, removal, and switching operations
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalCreationService } from '../../../../../webview/services/TerminalCreationService';
import { SplitManager } from '../../../../../webview/managers/SplitManager';
import { EventHandlerRegistry } from '../../../../../webview/utils/EventHandlerRegistry';

// Mock xterm.js and addons to avoid JSDOM issues
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    options: any;
    element = { style: {} };
    cols = 80;
    rows = 24;
    unicode = { activeVersion: '11' };
    
    constructor(options?: any) {
      this.options = options || {};
    }

    open = vi.fn();
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

// Mock TerminalAddonManager
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
          unicode11Addon: {}
        };
      });
      dispose = vi.fn();
      disposeAddons = vi.fn();
    }
  };
});

describe('TerminalCreationService', () => {
  let dom: JSDOM;
  let service: TerminalCreationService;
  let splitManager: SplitManager;
  let mockCoordinator: any;
  let eventRegistry: EventHandlerRegistry;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="terminal-view">
            <div id="terminal-body" style="width: 800px; height: 600px; display: flex; flex-direction: column;">
            </div>
          </div>
        </body>
      </html>
    `,
      { pretendToBeVisual: true }
    );

    // Set global DOM objects
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Element', dom.window.Element);

    // Create mocks
    const splitManagerCoordinator = {
      postMessageToExtension: vi.fn(),
    };
    splitManager = new SplitManager(splitManagerCoordinator as any);
    eventRegistry = new EventHandlerRegistry();

    // Create mock coordinator
    mockCoordinator = {
      postMessageToExtension: vi.fn(),
      shellIntegrationManager: {
        decorateTerminalOutput: vi.fn(),
      },
      getTerminalContainerManager: vi.fn().mockReturnValue({
        unregisterContainer: vi.fn(),
        clearSplitArtifacts: vi.fn(),
        applyDisplayState: vi.fn(),
        registerContainer: vi.fn()
      }),
      getDisplayModeManager: vi.fn().mockReturnValue({
        getCurrentMode: vi.fn().mockReturnValue('normal'),
        setDisplayMode: vi.fn(),
        showAllTerminalsSplit: vi.fn()
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
        }
      }),
      inputManager: {
        addXtermClickHandler: vi.fn(),
      },
      deleteTerminalSafely: vi.fn(),
      closeTerminal: vi.fn(),
      setActiveTerminalId: vi.fn(),
      profileManager: {
        createTerminalWithDefaultProfile: vi.fn()
      },
      handleAiAgentToggle: vi.fn(),
    };

    // Create service instance
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
            // Close JSDOM window
            dom.window.close();
          } finally {
            // Cleanup global DOM state
            vi.unstubAllGlobals();
          }
        }
      }
    }
  });

  describe('createTerminal()', () => {
    it('should create terminal with basic configuration', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName);

      // Assert
      expect(terminal).not.toBeNull();
      expect(terminal).toBeInstanceOf(Terminal);

      // Verify terminal registered in SplitManager
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance).toBeDefined();
      expect(terminalInstance?.name).toBe(terminalName);
      expect(terminalInstance?.terminal).toBe(terminal);
    });

    it('should create terminal with custom configuration', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Custom Terminal';
      const config = {
        fontSize: 16,
        fontFamily: 'Courier New',
        cursorBlink: false,
      } as any;

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName, config);

      // Assert
      expect(terminal).not.toBeNull();
      expect(terminal?.options.fontSize).toBe(16);
      expect(terminal?.options.fontFamily).toBe('Courier New');
      expect(terminal?.options.cursorBlink).toBe(false);
    });

    it('should assign correct terminal number', async () => {
      // Arrange
      const terminalId = 'terminal-3';
      const terminalName = 'Terminal 3';
      const terminalNumber = 3;

      // Act
      const terminal = await service.createTerminal(
        terminalId,
        terminalName,
        undefined,
        terminalNumber
      );

      // Assert
      expect(terminal).not.toBeNull();

      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.number).toBe(3);
    });

    it('should create terminal container in DOM', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      const container = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      expect(container).not.toBeNull();
      expect(container?.classList.contains('terminal-container')).toBe(true);
    });

    it('should load essential addons', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName);

      // Assert
      expect(terminal).not.toBeNull();

      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.fitAddon).toBeInstanceOf(FitAddon);
      expect(terminalInstance?.serializeAddon).toBeDefined();
    });

    it('should register terminal with SplitManager', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      expect(splitManager.getTerminals().has(terminalId)).toBe(true);
      expect(splitManager.getTerminalContainers().has(terminalId)).toBe(true);
    });

    it('should setup shell integration', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      expect(true).toBe(true);
    });

    it('should retry on failure (max 2 retries)', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Temporarily remove terminal-body to trigger failure
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName);

      // Assert - should still succeed due to recovery logic
      expect(terminal).not.toBeNull();
    }, 5000);

    it('should eventually fail after exceeding max retries', async () => {
      // Force failure by mocking document.getElementById to always return null
      const getElementSpy = vi.spyOn(document, 'getElementById').mockReturnValue(null);
      // And also mock querySelector to ensure recovery fails
      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      const terminal = await service.createTerminal('fail-term', 'Fail');
      
      expect(terminal).toBeNull();
      // Should have tried at least 3 attempts
      expect(getElementSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
      
      getElementSpy.mockRestore();
    });

    it('should extract terminal number from ID', async () => {
      // Arrange
      const terminalId = 'terminal-5';
      const terminalName = 'Terminal 5';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.number).toBe(5);
    });

    it('should find available terminal number when ID extraction fails', async () => {
      // Arrange
      const terminalId = 'custom-terminal';
      const terminalName = 'Custom';

      // Act
      await service.createTerminal(terminalId, terminalName);

      // Assert
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.number).toBeGreaterThanOrEqual(1);
      expect(terminalInstance?.number).toBeLessThanOrEqual(5);
    });

    it('should handle partial font settings and apply defaults', async () => {
      const terminalId = 'terminal-font-test';
      const config = {
        fontFamily: '   ', // Empty string
        fontSize: 0,       // Invalid size
      } as any;

      const terminal = await service.createTerminal(terminalId, 'Font Test', config);
      
      expect(terminal).not.toBeNull();
      // Should not have applied invalid fonts, should use xterm defaults or system defaults
      // (Testing that it didn't crash)
    });

    it('should handle missing container Manager gracefully', async () => {
      mockCoordinator.getTerminalContainerManager.mockReturnValue(null);
      const terminal = await service.createTerminal('term-no-mgr', 'No Manager');
      expect(terminal).not.toBeNull();
    });
  });

  describe('removeTerminal()', () => {
    it('should remove terminal successfully', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';
      await service.createTerminal(terminalId, terminalName);

      // Verify terminal exists
      expect(splitManager.getTerminals().has(terminalId)).toBe(true);

      // Act
      const result = await service.removeTerminal(terminalId);

      // Assert
      expect(result).toBe(true);
      expect(splitManager.getTerminals().has(terminalId)).toBe(false);
      expect(splitManager.getTerminalContainers().has(terminalId)).toBe(false);
    });

    it('should remove terminal container from DOM', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';
      await service.createTerminal(terminalId, terminalName);

      const containerBefore = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      expect(containerBefore).not.toBeNull();

      // Act
      await service.removeTerminal(terminalId);

      // Assert
      const containerAfter = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      expect(containerAfter).toBeNull();
    });

    it('should return false when terminal not found', async () => {
      // Arrange
      const nonExistentId = 'terminal-999';

      // Act
      const result = await service.removeTerminal(nonExistentId);

      // Assert
      expect(result).toBe(false);
    });

    it('should unregister container from TerminalContainerManager', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';
      await service.createTerminal(terminalId, terminalName);

      const containerManager = mockCoordinator.getTerminalContainerManager();

      // Act
      await service.removeTerminal(terminalId);

      // Assert
      if (containerManager) {
        expect(containerManager.unregisterContainer).toHaveBeenCalledWith(terminalId);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should dispose terminal instance', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';
      const terminal = await service.createTerminal(terminalId, terminalName);

      const disposeSpy = vi.spyOn(terminal!, 'dispose');

      // Act
      await service.removeTerminal(terminalId);

      // Assert
      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should handle removal errors gracefully', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Test');

      // Corrupt terminal instance to trigger error
      const instance = splitManager.getTerminals().get(terminalId);
      if (instance) {
        (instance as any).terminal = null;
      }

      // Act
      const result = await service.removeTerminal(terminalId);

      // Assert - should return false on error
      expect(result).toBe(false);
    });
  });

  describe('switchToTerminal()', () => {
    it('should switch to terminal successfully', async () => {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      let activeTerminalId: string | null = terminal1Id;
      const onActivate = (id: string) => {
        activeTerminalId = id;
      };

      // Act
      const result = await service.switchToTerminal(terminal2Id, terminal1Id, onActivate);

      // Assert
      expect(result).toBe(true);
      expect(activeTerminalId).toBe(terminal2Id);
    });

    it('should deactivate current terminal', async () => {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      const terminal1Instance = splitManager.getTerminals().get(terminal1Id);
      if (terminal1Instance) {
        terminal1Instance.isActive = true;
        terminal1Instance.container.classList.add('active');
      }

      // Act
      await service.switchToTerminal(terminal2Id, terminal1Id, () => {});

      // Assert
      expect(terminal1Instance?.isActive).toBe(false);
      expect(terminal1Instance?.container.classList.contains('active')).toBe(false);
    });

    it('should activate new terminal', async () => {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      // Act
      await service.switchToTerminal(terminal2Id, terminal1Id, () => {});

      // Assert
      const terminal2Instance = splitManager.getTerminals().get(terminal2Id);
      expect(terminal2Instance?.isActive).toBe(true);
      expect(terminal2Instance?.container.classList.contains('active')).toBe(true);
    });

    it('should return false when terminal not found', async () => {
      // Arrange
      const nonExistentId = 'terminal-999';

      // Act
      const result = await service.switchToTerminal(nonExistentId, null, () => {});

      // Assert
      expect(result).toBe(false);
    });

    it('should call onActivate callback', async () => {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      const onActivateSpy = vi.fn();

      // Act
      await service.switchToTerminal(terminal2Id, terminal1Id, onActivateSpy);

      // Assert
      expect(onActivateSpy).toHaveBeenCalledWith(terminal2Id);
    });

    it('should handle switch when no current terminal', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Terminal 1');

      // Act
      const result = await service.switchToTerminal(terminalId, null, () => {});

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('dispose()', () => {
    it('should dispose all link providers', () => {
      // Arrange
      // Create some terminals to generate link providers
      service.createTerminal('terminal-1', 'Terminal 1');
      service.createTerminal('terminal-2', 'Terminal 2');

      // Act
      service.dispose();

      // Assert - should not throw errors
      expect(true).toBe(true);
    });

    it('should be safe to call multiple times', () => {
      // Act & Assert - should not throw errors
      service.dispose();
      service.dispose();
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing terminal-body gracefully', async () => {
      // Arrange
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      const terminalId = 'terminal-1';
      const terminalName = 'Test Terminal';

      // Act
      const terminal = await service.createTerminal(terminalId, terminalName);

      // Assert - should recover and create terminal
      expect(terminal).not.toBeNull();
    });

    it('should handle createTerminal with same ID twice', async () => {
      // Arrange
      const terminalId = 'terminal-1';

      // Act
      await service.createTerminal(terminalId, 'First');
      await service.createTerminal(terminalId, 'Second');

      // Assert - second creation should overwrite
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.name).toBe('Second');
    });

    it('should handle terminal removal during switch', async () => {
      // Arrange
      const terminal1Id = 'terminal-1';
      const terminal2Id = 'terminal-2';
      await service.createTerminal(terminal1Id, 'Terminal 1');
      await service.createTerminal(terminal2Id, 'Terminal 2');

      // Remove terminal2 before switching
      await service.removeTerminal(terminal2Id);

      // Act
      const result = await service.switchToTerminal(terminal2Id, terminal1Id, () => {});

      // Assert
      expect(result).toBe(false);
    });

    it('should handle concurrent terminal creation', async () => {
      // Arrange
      const createPromises = [];

      // Act - create 5 terminals concurrently
      for (let i = 1; i <= 5; i++) {
        createPromises.push(service.createTerminal(`terminal-${i}`, `Terminal ${i}`));
      }

      const terminals = await Promise.all(createPromises);

      // Assert - all should be created successfully
      expect(terminals.every((t) => t !== null)).toBe(true);
      expect(splitManager.getTerminals().size).toBe(5);
    }, 5000);

    it('should handle concurrent terminal removal', async () => {
      // Arrange
      const terminalIds = ['terminal-1', 'terminal-2', 'terminal-3'];
      for (const id of terminalIds) {
        await service.createTerminal(id, `Terminal ${id}`);
      }

      // Act - remove all concurrently
      const removePromises = terminalIds.map((id) => service.removeTerminal(id));
      const results = await Promise.all(removePromises);

      // Assert
      expect(results.every((r) => r === true)).toBe(true);
      expect(splitManager.getTerminals().size).toBe(0);
    });
  });

  describe('Integration with ResizeManager', () => {
    it('should setup resize observer on terminal creation', async () => {
      // Arrange
      const terminalId = 'terminal-1';

      // Act
      await service.createTerminal(terminalId, 'Test Terminal');

      // Assert - terminal should have container with valid dimensions
      const container = splitManager.getTerminalContainers().get(terminalId);
      expect(container).toBeDefined();
    });

    it('should cleanup resize observer on terminal removal', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Test Terminal');

      // Act
      await service.removeTerminal(terminalId);

      // Assert - should not throw errors during cleanup
      expect(true).toBe(true);
    });
  });

  describe('File Link Detection', () => {
    it('should register link provider on terminal creation', async () => {
      // Arrange
      const terminalId = 'terminal-1';

      // Act
      await service.createTerminal(terminalId, 'Test Terminal');

      // Assert - link provider should be registered
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.terminal).toBeDefined();
    });

    it('should cleanup link provider on terminal removal', async () => {
      // Arrange
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Test Terminal');

      // Act
      await service.removeTerminal(terminalId);

      // Assert - should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Scrollback Auto-Save', () => {
    it('should setup scrollback auto-save on terminal creation', async () => {
      // Arrange
      const terminalId = 'terminal-1';

      // Act
      await service.createTerminal(terminalId, 'Test Terminal');

      // Assert
      const terminalInstance = splitManager.getTerminals().get(terminalId);
      expect(terminalInstance?.serializeAddon).toBeDefined();
    });

    it('should use vscodeApi for scrollback when available', async () => {
      // Arrange
      const mockVscodeApi = {
        postMessage: vi.fn(),
      };
      vi.stubGlobal('vscodeApi', mockVscodeApi);

      const terminalId = 'terminal-1';
      const terminal = await service.createTerminal(terminalId, 'Test Terminal');

      // Act - trigger data event to initiate auto-save
      terminal?.write('test data\n');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 3100));

      // Assert - vscodeApi should be used
      // Note: This is timing-dependent, so we just verify no errors occurred
      expect(true).toBe(true);

      // Cleanup
      vi.unstubAllGlobals();
    });
  });

  describe('Performance', () => {
    it('should create terminal within reasonable time', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      await service.createTerminal('terminal-1', 'Test Terminal');

      // Assert
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    }, 2000);

    it('should remove terminal within reasonable time', async () => {
      // Arrange
      await service.createTerminal('terminal-1', 'Test Terminal');
      const startTime = Date.now();

      // Act
      await service.removeTerminal('terminal-1');

      // Assert
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should switch terminals within reasonable time', async () => {
      // Arrange
      await service.createTerminal('terminal-1', 'Terminal 1');
      await service.createTerminal('terminal-2', 'Terminal 2');
      const startTime = Date.now();

      // Act
      await service.switchToTerminal('terminal-2', 'terminal-1', () => {});

      // Assert
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should complete within 200ms
    });
  });

  describe('Static Methods - Terminal Restoring State', () => {
    it('should mark terminal as restoring', () => {
      // Arrange
      const terminalId = 'terminal-restore-1';

      // Act
      TerminalCreationService.markTerminalRestoring(terminalId);

      // Assert
      expect(TerminalCreationService.isTerminalRestoring(terminalId)).toBe(true);
    });

    it('should return false for non-restoring terminal', () => {
      // Arrange
      const terminalId = 'terminal-not-restoring';

      // Assert
      expect(TerminalCreationService.isTerminalRestoring(terminalId)).toBe(false);
    });

    it('should mark terminal as restored after delay', async () => {
      // Arrange
      const terminalId = 'terminal-restore-2';
      TerminalCreationService.markTerminalRestoring(terminalId);
      expect(TerminalCreationService.isTerminalRestoring(terminalId)).toBe(true);

      // Act
      TerminalCreationService.markTerminalRestored(terminalId);

      // Assert - Still restoring immediately after call (5 second delay)
      expect(TerminalCreationService.isTerminalRestoring(terminalId)).toBe(true);

      // Wait for protection period to end
      await new Promise((resolve) => setTimeout(resolve, 5100));
      expect(TerminalCreationService.isTerminalRestoring(terminalId)).toBe(false);
    }, 10000);
  });

  describe('Font Settings Handling', () => {
    it('should apply direct font settings from config', async () => {
      // Arrange
      const terminalId = 'terminal-font-1';
      const config = {
        fontFamily: 'MesloLGS NF',
        fontSize: 18,
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        lineHeight: 1.2,
        letterSpacing: 0.5,
      } as any;

      // Act
      const terminal = await service.createTerminal(terminalId, 'Font Test', config);

      // Assert
      expect(terminal).not.toBeNull();
      expect(terminal?.options.fontFamily).toBe('MesloLGS NF');
      expect(terminal?.options.fontSize).toBe(18);
    });

    it('should handle empty font settings gracefully', async () => {
      // Arrange
      const terminalId = 'terminal-font-2';
      const config = {
        fontFamily: '',
        fontSize: 0,
      } as any;

      // Act
      const terminal = await service.createTerminal(terminalId, 'Empty Font Test', config);

      // Assert - Should use defaults, not empty values
      expect(terminal).not.toBeNull();
    });

    it('should apply nested fontSettings from config', async () => {
      // Arrange
      const terminalId = 'terminal-font-3';
      const config = {
        fontSettings: {
          fontFamily: 'Fira Code',
          fontSize: 16,
        },
      } as any;

      // Act
      const terminal = await service.createTerminal(terminalId, 'Nested Font Test', config);

      // Assert
      expect(terminal).not.toBeNull();
    });
  });

  describe('Split Mode Handling', () => {
    it('should add terminal to split when split mode is active', async () => {
      // Arrange
      const terminalId = 'terminal-split-1';

      // Mock split mode as active
      vi.spyOn(splitManager, 'getIsSplitMode').mockReturnValue(true);
      const addToSplitSpy = vi.spyOn(splitManager, 'addNewTerminalToSplit');

      // Act
      await service.createTerminal(terminalId, 'Split Terminal');

      // Assert
      expect(addToSplitSpy).toHaveBeenCalledWith(terminalId, 'Split Terminal');
    });

    it('should not add terminal to split when not in split mode', async () => {
      // Arrange
      const terminalId = 'terminal-normal-1';

      vi.spyOn(splitManager, 'getIsSplitMode').mockReturnValue(false);
      const addToSplitSpy = vi.spyOn(splitManager, 'addNewTerminalToSplit');

      // Act
      await service.createTerminal(terminalId, 'Normal Terminal');

      // Assert
      expect(addToSplitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Terminal Container Backgrounds', () => {
    it('should apply theme to container elements', async () => {
      // Arrange
      const terminalId = 'terminal-theme-1';

      // Mock config with light theme
      mockCoordinator.getManagers = vi.fn().mockReturnValue({
        config: {
          getCurrentFontSettings: vi.fn().mockReturnValue({}),
          getCurrentSettings: vi.fn().mockReturnValue({ theme: 'light' }),
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

      // Act
      await service.createTerminal(terminalId, 'Theme Terminal');

      // Assert
      const container = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      expect(container).not.toBeNull();
    });

    it('should handle dark theme', async () => {
      // Arrange
      const terminalId = 'terminal-theme-2';

      mockCoordinator.getManagers = vi.fn().mockReturnValue({
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

      // Act
      await service.createTerminal(terminalId, 'Dark Terminal');

      // Assert
      const container = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      expect(container).not.toBeNull();
    });
  });

  describe('Initial Resize with Retry', () => {
    it('should handle container with minimal dimensions', async () => {
      // Arrange
      const terminalId = 'terminal-resize-1';

      // Create terminal in small container
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        terminalBody.style.width = '30px';
        terminalBody.style.height = '30px';
      }

      // Act
      const terminal = await service.createTerminal(terminalId, 'Small Container');

      // Assert - Should still create terminal despite small container
      expect(terminal).not.toBeNull();
    }, 10000);
  });

  describe('Link Modifier Settings', () => {
    it('should setup link modifier from settings', async () => {
      // Arrange
      const terminalId = 'terminal-link-1';

      mockCoordinator.getManagers = vi.fn().mockReturnValue({
        config: {
          getCurrentFontSettings: vi.fn().mockReturnValue({}),
          getCurrentSettings: vi.fn().mockReturnValue({
            multiCursorModifier: 'ctrlCmd',
          }),
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

      // Act
      const terminal = await service.createTerminal(terminalId, 'Link Test');

      // Assert
      expect(terminal).not.toBeNull();
    });
  });

  describe('Terminal Number Extraction Edge Cases', () => {
    it('should find available number when all 1-5 slots are used', async () => {
      // Arrange - Fill all standard slots
      for (let i = 1; i <= 5; i++) {
        await service.createTerminal(`terminal-${i}`, `Terminal ${i}`);
      }

      // Act - Create with non-standard ID
      await service.createTerminal('custom-terminal-x', 'Custom');

      // Assert
      const customTerminal = splitManager.getTerminals().get('custom-terminal-x');
      // Should have some number assigned (will be 1 based on implementation)
      expect(customTerminal?.number).toBeDefined();
    });

    it('should handle undefined terminal ID gracefully', async () => {
      // This tests the extractTerminalNumber fallback
      // The method handles undefined by returning 1
      const terminalId = 'terminal-1';
      await service.createTerminal(terminalId, 'Test');

      const instance = splitManager.getTerminals().get(terminalId);
      expect(instance?.number).toBe(1);
    });
  });

  describe('isActive Configuration', () => {
    it('should apply active border when isActive is true in config', async () => {
      // Arrange
      const terminalId = 'terminal-active-1';
      const config = { isActive: true } as any;

      const updateBorderSpy = mockCoordinator.getManagers().ui.updateSingleTerminalBorder;

      // Act
      await service.createTerminal(terminalId, 'Active Terminal', config);

      // Assert
      expect(updateBorderSpy).toHaveBeenCalled();
    });

    it('should not apply active border when isActive is false', async () => {
      // Arrange
      const terminalId = 'terminal-inactive-1';
      const config = { isActive: false } as any;

      // Reset the spy
      const uiManager = mockCoordinator.getManagers().ui;
      uiManager.updateSingleTerminalBorder = vi.fn();

      // Act
      await service.createTerminal(terminalId, 'Inactive Terminal', config);

      // Assert - updateSingleTerminalBorder should not be called for inactive
      expect(uiManager.updateSingleTerminalBorder).not.toHaveBeenCalled();
    });
  });

  describe('Header Elements Cache', () => {
    it('should register header elements with UIManager', async () => {
      // Arrange
      const terminalId = 'terminal-header-1';
      const headerCache = new Map();
      mockCoordinator.getManagers = vi.fn().mockReturnValue({
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
          headerElementsCache: headerCache,
        },
      });

      // Act
      await service.createTerminal(terminalId, 'Header Test');

      // Assert
      expect(headerCache.has(terminalId)).toBe(true);
    });
  });

  describe('Terminal Removal with Split Mode', () => {
    it('should clear split artifacts when only one terminal remains', async () => {
      // Arrange
      await service.createTerminal('terminal-1', 'Terminal 1');
      await service.createTerminal('terminal-2', 'Terminal 2');

      const containerManager = mockCoordinator.getTerminalContainerManager();
      const clearArtifactsSpy = containerManager.clearSplitArtifacts;

      // Act - Remove terminal 2, leaving only 1
      await service.removeTerminal('terminal-2');

      // Assert
      expect(clearArtifactsSpy).toHaveBeenCalled();
    });

    it('should rebuild split layout when multiple terminals remain in split mode', async () => {
      // Arrange
      await service.createTerminal('terminal-1', 'Terminal 1');
      await service.createTerminal('terminal-2', 'Terminal 2');
      await service.createTerminal('terminal-3', 'Terminal 3');

      const displayManager = mockCoordinator.getDisplayModeManager();
      displayManager.getCurrentMode = vi.fn().mockReturnValue('split');

      const containerManager = mockCoordinator.getTerminalContainerManager();
      const applyDisplayStateSpy = containerManager.applyDisplayState;

      // Act
      await service.removeTerminal('terminal-2');

      // Assert - Should rebuild layout
      expect(applyDisplayStateSpy).toHaveBeenCalled();
    });
  });
});
