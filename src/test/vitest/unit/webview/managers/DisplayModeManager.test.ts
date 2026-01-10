/**
 * DisplayModeManager Tests
 * Issue #198: Fullscreen terminal display when clicking tabs
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DisplayModeManager } from '../../../../../webview/managers/DisplayModeManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import { ISplitLayoutController } from '../../../../../webview/interfaces/ISplitLayoutController';

describe('DisplayModeManager - Fullscreen Display (Issue #198)', () => {
  let displayManager: DisplayModeManager;
  let mockCoordinator: IManagerCoordinator;
  let mockSplitManager: Partial<ISplitLayoutController>;
  let mockContainerManager: any;

  beforeEach(() => {
    // Set up DOM environment
    const terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    document.body.appendChild(terminalBody);

    const container1 = document.createElement('div');
    container1.id = 'terminal-container-1';
    container1.className = 'terminal-container';
    terminalBody.appendChild(container1);

    const container2 = document.createElement('div');
    container2.id = 'terminal-container-2';
    container2.className = 'terminal-container';
    terminalBody.appendChild(container2);

    const container3 = document.createElement('div');
    container3.id = 'terminal-container-3';
    container3.className = 'terminal-container';
    terminalBody.appendChild(container3);

    // Create mock container manager
    mockContainerManager = {
      getContainerOrder: vi.fn().mockReturnValue(['1', '2', '3']),
      applyDisplayState: vi.fn(),
      getDisplaySnapshot: vi.fn().mockReturnValue({
        mode: 'normal',
        visibleTerminals: ['1', '2', '3'],
        activeTerminalId: null,
        registeredContainers: 3,
        registeredWrappers: 0,
      }),
      getAllContainers: vi.fn().mockReturnValue(
        new Map([
          ['1', document.getElementById('terminal-container-1')],
          ['2', document.getElementById('terminal-container-2')],
          ['3', document.getElementById('terminal-container-3')],
        ])
      ),
      clearSplitArtifacts: vi.fn(),
    };

    // Create mock split manager
    let isSplitMode = false;
    mockSplitManager = {
      get isSplitMode() {
        return isSplitMode;
      },
      set isSplitMode(value: boolean) {
        isSplitMode = value;
      },
      getIsSplitMode: vi.fn(() => isSplitMode),
      exitSplitMode: vi.fn(() => {
        isSplitMode = false;
      }),
      getOptimalSplitDirection: vi.fn().mockReturnValue('vertical'),
      prepareSplitMode: vi.fn(() => {
        isSplitMode = true;
      }),
      redistributeSplitTerminals: vi.fn(),
    };

    // Create mock coordinator
    mockCoordinator = {
      getTerminalContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getManagers: vi.fn().mockReturnValue({
        header: {},
        tabs: {
          updateModeIndicator: vi.fn(),
        },
      }),
      splitManager: mockSplitManager as any,
    } as any;

    // Create DisplayModeManager instance with constructor injection (Issue #216)
    displayManager = new DisplayModeManager(mockCoordinator as any);
    displayManager.initialize();
  });

  afterEach(() => {
    displayManager.dispose();
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should initialize in normal mode', () => {
      expect(displayManager.getCurrentMode()).toBe('normal');
    });

    it('should have no fullscreen terminal initially', () => {
      const debugInfo = displayManager.getDebugInfo();
      expect(debugInfo.fullscreenTerminalId).toBeNull();
    });
  });

  describe('Fullscreen Mode', () => {
    it('should switch to fullscreen mode when showTerminalFullscreen is called', () => {
      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(displayManager.getCurrentMode()).toBe('fullscreen');
      expect(mockContainerManager.applyDisplayState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'fullscreen',
          activeTerminalId: '1',
        })
      );
    });

    it('should exit split mode before entering fullscreen', () => {
      // Arrange - simulate split mode
      (mockSplitManager as any).isSplitMode = true;

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(mockSplitManager.exitSplitMode).toHaveBeenCalled();
      expect((mockSplitManager as any).isSplitMode).toBe(false);
    });

    it('should clear split artifacts when entering fullscreen', () => {
      // Arrange - simulate split mode
      (mockSplitManager as any).isSplitMode = true;

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(mockContainerManager.clearSplitArtifacts).toHaveBeenCalled();
    });

    it('should update visibility from container manager snapshot', () => {
      // Arrange
      mockContainerManager.getDisplaySnapshot.mockReturnValue({
        mode: 'fullscreen',
        visibleTerminals: ['1'],
        activeTerminalId: '1',
        registeredContainers: 3,
        registeredWrappers: 0,
      });

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(displayManager.isTerminalVisible('1')).toBe(true);
      expect(displayManager.isTerminalVisible('2')).toBe(false);
      expect(displayManager.isTerminalVisible('3')).toBe(false);
    });

    it('should notify mode change to tab manager', () => {
      // Arrange
      const mockTabs = (mockCoordinator.getManagers as any)().tabs;

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      if (mockTabs) {
        expect(mockTabs.updateModeIndicator).toHaveBeenCalledWith('fullscreen');
      }
    });
  });

  describe('Split Mode Toggle', () => {
    it('should toggle from normal to split mode', () => {
      // Arrange - start in normal mode
      expect(displayManager.getCurrentMode()).toBe('normal');

      // Act
      displayManager.toggleSplitMode();

      // Assert
      expect(displayManager.getCurrentMode()).toBe('split');
      expect(mockSplitManager.prepareSplitMode).toHaveBeenCalledWith('vertical');
    });

    it('should toggle from split to normal mode', () => {
      // Arrange - enter split mode first
      displayManager.toggleSplitMode();
      expect(displayManager.getCurrentMode()).toBe('split');

      // Act - toggle back
      displayManager.toggleSplitMode();

      // Assert
      expect(displayManager.getCurrentMode()).toBe('normal');
      expect(mockSplitManager.exitSplitMode).toHaveBeenCalled();
    });

    it('should show all terminals in split mode', () => {
      // Act
      displayManager.showAllTerminalsSplit();

      // Assert
      expect(displayManager.getCurrentMode()).toBe('split');
      expect(mockContainerManager.applyDisplayState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'split',
          splitDirection: 'vertical',
        })
      );
    });
  });

  describe('Mode Transitions', () => {
    it('should track previous mode when switching', () => {
      // Arrange
      displayManager.setDisplayMode('fullscreen');

      // Act
      displayManager.setDisplayMode('split');

      // Assert
      const debugInfo = displayManager.getDebugInfo();
      expect(debugInfo.previousMode).toBe('fullscreen');
    });

    it('should handle fullscreen -> split transition', () => {
      // Arrange
      displayManager.showTerminalFullscreen('1');

      // Act
      displayManager.toggleSplitMode();

      // Assert
      expect(displayManager.getCurrentMode()).toBe('split');
    });

    it('should handle split -> fullscreen transition', () => {
      // Arrange
      displayManager.toggleSplitMode(); // Enter split mode

      // Act
      displayManager.showTerminalFullscreen('2');

      // Assert
      expect(displayManager.getCurrentMode()).toBe('fullscreen');
      expect(mockSplitManager.exitSplitMode).toHaveBeenCalled();
    });
  });

  describe('Terminal Visibility', () => {
    it('should hide all terminals except specified one', () => {
      // Act
      displayManager.hideAllTerminalsExcept('2');

      // Assert
      expect(mockContainerManager.applyDisplayState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'fullscreen',
          activeTerminalId: '2',
        })
      );
    });

    it('should show all terminals', () => {
      // Act
      displayManager.showAllTerminals();

      // Assert
      expect(mockContainerManager.applyDisplayState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'normal',
          activeTerminalId: null,
        })
      );
    });

    it('should check terminal visibility correctly', () => {
      // Arrange
      mockContainerManager.getDisplaySnapshot.mockReturnValue({
        mode: 'fullscreen',
        visibleTerminals: ['1'],
        activeTerminalId: '1',
        registeredContainers: 3,
        registeredWrappers: 0,
      });

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(displayManager.isTerminalVisible('1')).toBe(true);
      expect(displayManager.isTerminalVisible('2')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing container manager gracefully', () => {
      // Arrange
      (mockCoordinator.getTerminalContainerManager as any).mockReturnValue(undefined);

      // Act & Assert - should not throw
      expect(() => {
        displayManager.showTerminalFullscreen('1');
      }).not.toThrow();
    });

    it('should handle missing split manager gracefully', () => {
      // Arrange
      (mockCoordinator as any).splitManager = null;

      // Act & Assert - should not throw
      expect(() => {
        displayManager.showAllTerminalsSplit();
      }).not.toThrow();
    });

    it('should handle missing header manager gracefully', () => {
      // Arrange
      (mockCoordinator.getManagers as any).mockReturnValue({
        header: undefined,
        tabs: undefined,
      });

      // Act & Assert - should not throw
      expect(() => {
        displayManager.showTerminalFullscreen('1');
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should call showAllTerminals on dispose', () => {
      // Arrange
      displayManager.showTerminalFullscreen('1');
      expect(displayManager.getCurrentMode()).toBe('fullscreen');

      // Act - store call count before dispose
      const callCountBefore = mockContainerManager.applyDisplayState.mock.calls.length;
      displayManager.dispose();

      // Assert - dispose should call applyDisplayState to reset mode
      expect(mockContainerManager.applyDisplayState.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    it('should clear all visibility tracking on dispose', () => {
      // Arrange
      displayManager.showTerminalFullscreen('1');

      // Act
      displayManager.dispose();

      // Assert
      const debugInfo = displayManager.getDebugInfo();
      expect(debugInfo.visibleTerminals).toHaveLength(0);
    });
  });

  describe('Debug Information', () => {
    it('should provide accurate debug info', () => {
      // Arrange
      displayManager.showTerminalFullscreen('2');

      // Act
      const debugInfo = displayManager.getDebugInfo();

      // Assert
      expect(debugInfo.currentMode).toBe('fullscreen');
      expect(debugInfo.fullscreenTerminalId).toBe('2');
      expect(debugInfo.previousMode).toBe('normal');
    });
  });
});
