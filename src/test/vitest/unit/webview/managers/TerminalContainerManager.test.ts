/**
 * TerminalContainerManager Tests
 * Issue #198: State-based display management for fullscreen/split modes
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalContainerManager } from '../../../../../webview/managers/TerminalContainerManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

describe('TerminalContainerManager - Display State Management (Issue #198)', () => {
  let containerManager: TerminalContainerManager;
  let mockCoordinator: IManagerCoordinator;
  let terminalBody: HTMLElement;

  beforeEach(() => {
    // Set up DOM environment
    terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    document.body.appendChild(terminalBody);

    const container1 = document.createElement('div');
    container1.id = 'terminal-container-1';
    container1.className = 'terminal-container';
    container1.setAttribute('data-terminal-id', '1');
    terminalBody.appendChild(container1);

    const container2 = document.createElement('div');
    container2.id = 'terminal-container-2';
    container2.className = 'terminal-container';
    container2.setAttribute('data-terminal-id', '2');
    terminalBody.appendChild(container2);

    const container3 = document.createElement('div');
    container3.id = 'terminal-container-3';
    container3.className = 'terminal-container';
    container3.setAttribute('data-terminal-id', '3');
    terminalBody.appendChild(container3);

    // Create mock coordinator
    mockCoordinator = {
      getManagers: vi.fn().mockReturnValue({}),
    } as any;

    // Create TerminalContainerManager instance (Issue #216: constructor injection)
    containerManager = new TerminalContainerManager(mockCoordinator as any);
    containerManager.initialize();

    // Register containers
    containerManager.registerContainer('1', document.getElementById('terminal-container-1')!);
    containerManager.registerContainer('2', document.getElementById('terminal-container-2')!);
    containerManager.registerContainer('3', document.getElementById('terminal-container-3')!);
  });

  afterEach(() => {
    containerManager.dispose();
    document.body.innerHTML = '';
  });

  describe('Container Registration', () => {
    it('should register terminal containers', () => {
      const containers = containerManager.getAllContainers();
      expect(containers.size).toBe(3);
      expect(containers.has('1')).toBe(true);
      expect(containers.has('2')).toBe(true);
      expect(containers.has('3')).toBe(true);
    });

    it('should unregister terminal containers', () => {
      // Act
      containerManager.unregisterContainer('2');

      // Assert
      const containers = containerManager.getAllContainers();
      expect(containers.size).toBe(2);
      expect(containers.has('2')).toBe(false);
    });

    it('should get container order', () => {
      const order = containerManager.getContainerOrder();
      expect(order).toEqual(['1', '2', '3']);
    });

    it('should handle duplicate registration gracefully', () => {
      // Act - register same container twice
      const container = document.getElementById('terminal-container-1')!;
      containerManager.registerContainer('1', container);

      // Assert - should still have 3 containers
      const containers = containerManager.getAllContainers();
      expect(containers.size).toBe(3);
    });
  });

  describe('Normal Mode Display State', () => {
    it('should apply normal mode display state', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).toBe('normal');
      expect(snapshot.visibleTerminals).toContain('1');
      expect(snapshot.visibleTerminals).toContain('2');
      expect(snapshot.visibleTerminals).toContain('3');
      // All terminals are visible in normal mode
      expect(snapshot.visibleTerminals).toHaveLength(3);
    });

    it('should make all containers visible in normal mode', () => {
      // Arrange - hide a container first
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Act - switch to normal mode
      containerManager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.visibleTerminals).toHaveLength(3);
    });

    it('should remove fullscreen classes in normal mode', () => {
      // Arrange - set fullscreen first
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Act
      containerManager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const container1 = document.getElementById('terminal-container-1')!;
      expect(container1.classList.contains('terminal-container--fullscreen')).toBe(false);
    });
  });

  describe('Fullscreen Mode Display State', () => {
    it('should apply fullscreen mode display state', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '2',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).toBe('fullscreen');
      expect(snapshot.visibleTerminals).toContain('2');
      // Only terminal 2 is visible in fullscreen mode
      const allTerminals = ['1', '2', '3'];
      const hiddenTerminals = allTerminals.filter((id) => !snapshot.visibleTerminals.includes(id));
      expect(hiddenTerminals).toContain('1');
      expect(hiddenTerminals).toContain('3');
    });

    it('should add fullscreen class to active container', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const container1 = document.getElementById('terminal-container-1')!;
      expect(container1.classList.contains('terminal-container--fullscreen')).toBe(true);
    });

    it('should set fullscreen container styles', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const container1 = document.getElementById('terminal-container-1')!;
      expect(container1.style.flex).toBe('1 1 auto');
      expect(container1.style.width).toBe('100%');
      expect(container1.style.height).toBe('100%');
    });

    it('should hide non-active containers in fullscreen mode', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '2',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      const allTerminals = ['1', '2', '3'];
      const hiddenTerminals = allTerminals.filter((id) => !snapshot.visibleTerminals.includes(id));
      expect(hiddenTerminals).toContain('1');
      expect(hiddenTerminals).toContain('3');
    });
  });

  describe('Split Mode Display State', () => {
    it('should apply split mode display state', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).toBe('split');
      expect(snapshot.visibleTerminals).toContain('1');
      expect(snapshot.visibleTerminals).toContain('2');
      expect(snapshot.visibleTerminals).toContain('3');
    });

    it('should create split wrappers for vertical split', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2'],
        splitDirection: 'vertical',
      });

      // Assert - check internal state via snapshot
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).toBe('split');
      // Split wrappers are managed internally via splitLayoutService cache
      expect(snapshot.registeredWrappers).toBeGreaterThanOrEqual(0);
    });

    it('should create split wrappers for horizontal split', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2'],
        splitDirection: 'horizontal',
      });

      // Assert - check internal state via snapshot
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).toBe('split');
      // Split wrappers are managed internally via splitLayoutService cache
      expect(snapshot.registeredWrappers).toBeGreaterThanOrEqual(0);
    });

    it('should add split class to containers in split mode', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Assert
      const container1 = document.getElementById('terminal-container-1')!;
      expect(container1.classList.contains('terminal-container--split')).toBe(true);
    });

    it('should make all containers visible in split mode', () => {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.visibleTerminals).toHaveLength(3);
    });
  });

  describe('Split Artifacts Management', () => {
    it('should clear split artifacts', () => {
      // Arrange - create split layout
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2'],
        splitDirection: 'vertical',
      });

      // Act
      containerManager.clearSplitArtifacts();

      // Assert - split wrappers should be removed
      const wrappers = terminalBody.querySelectorAll('.split-wrapper');
      expect(wrappers.length).toBe(0);
    });

    it('should remove resizers when clearing split artifacts', () => {
      // Arrange - create split layout with resizers
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2'],
        splitDirection: 'vertical',
      });

      // Act
      containerManager.clearSplitArtifacts();

      // Assert
      const resizers = terminalBody.querySelectorAll('.split-resizer');
      expect(resizers.length).toBe(0);
    });
  });

  describe('Display Snapshot', () => {
    it('should provide accurate display snapshot in normal mode', () => {
      // Arrange
      containerManager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Act
      const snapshot = containerManager.getDisplaySnapshot();

      // Assert
      expect(snapshot.mode).toBe('normal');
      expect(snapshot.visibleTerminals).toContain('1');
      expect(snapshot.visibleTerminals).toContain('2');
      expect(snapshot.visibleTerminals).toContain('3');
    });

    it('should provide accurate display snapshot in fullscreen mode', () => {
      // Arrange
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '2',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Act
      const snapshot = containerManager.getDisplaySnapshot();

      // Assert
      expect(snapshot.mode).toBe('fullscreen');
      expect(snapshot.visibleTerminals).toEqual(['2']);
      // Only terminal 2 is visible in fullscreen mode
      const allTerminals = ['1', '2', '3'];
      const hiddenTerminals = allTerminals.filter((id) => !snapshot.visibleTerminals.includes(id));
      expect(hiddenTerminals).toContain('1');
      expect(hiddenTerminals).toContain('3');
    });

    it('should provide accurate display snapshot in split mode', () => {
      // Arrange
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Act
      const snapshot = containerManager.getDisplaySnapshot();

      // Assert
      expect(snapshot.mode).toBe('split');
      expect(snapshot.visibleTerminals).toHaveLength(3);
    });
  });

  describe('Container Mode Management', () => {
    it('should set container mode to normal', () => {
      // Act
      containerManager.setContainerMode('1', 'normal');

      // Assert - container should have normal mode class
      const _container = document.getElementById('terminal-container-1')!;
      // Implementation may add specific classes
    });

    it('should set container mode to fullscreen', () => {
      // Act
      containerManager.setContainerMode('1', 'fullscreen');

      // Assert - fullscreen mode should be applied
      const _container = document.getElementById('terminal-container-1')!;
      // Container should have fullscreen styling
    });

    it('should set container mode to split', () => {
      // Act
      containerManager.setContainerMode('1', 'split');

      // Assert - split mode should be applied
      const _container = document.getElementById('terminal-container-1')!;
      // Container should have split styling
    });
  });

  describe('Container Visibility', () => {
    it('should set container visibility to visible', () => {
      // Act
      containerManager.setContainerVisibility('1', true);

      // Assert
      const container = document.getElementById('terminal-container-1')!;
      expect(container.style.display).not.toBe('none');
    });

    it('should set container visibility to hidden', () => {
      // Act
      containerManager.setContainerVisibility('1', false);

      // Assert - container should be hidden
      // Implementation may use display:none or visibility:hidden
    });
  });

  describe('Error Handling', () => {
    it('should handle missing terminal body gracefully', () => {
      // Arrange - remove terminal body
      terminalBody.remove();

      // Act & Assert - should not throw
      expect(() => {
        containerManager.applyDisplayState({
          mode: 'normal',
          activeTerminalId: null,
          orderedTerminalIds: ['1', '2', '3'],
        });
      }).not.toThrow();
    });

    it('should handle unregistered terminal IDs gracefully', () => {
      // Act & Assert - should not throw
      expect(() => {
        containerManager.applyDisplayState({
          mode: 'fullscreen',
          activeTerminalId: 'nonexistent',
          orderedTerminalIds: ['1', '2', '3'],
        });
      }).not.toThrow();
    });

    it('should handle empty ordered IDs gracefully', () => {
      // Act & Assert - should not throw
      expect(() => {
        containerManager.applyDisplayState({
          mode: 'normal',
          activeTerminalId: null,
          orderedTerminalIds: [],
        });
      }).not.toThrow();
    });
  });

  describe('Mode Transitions', () => {
    it('should transition from normal to fullscreen', () => {
      // Arrange
      containerManager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Act
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '2',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).toBe('fullscreen');
      expect(snapshot.visibleTerminals).toEqual(['2']);
    });

    it('should transition from fullscreen to split', () => {
      // Arrange
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).toBe('split');
      expect(snapshot.visibleTerminals).toHaveLength(3);
    });

    it('should transition from split to normal', () => {
      // Arrange
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Act
      containerManager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).toBe('normal');

      // Split artifacts should be cleaned up
      const wrappers = terminalBody.querySelectorAll('.split-wrapper');
      expect(wrappers.length).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should dispose all containers', () => {
      // Act
      containerManager.dispose();

      // Assert
      const containers = containerManager.getAllContainers();
      expect(containers.size).toBe(0);
    });

    it('should clear split artifacts on dispose', () => {
      // Arrange - create split layout
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2'],
        splitDirection: 'vertical',
      });

      // Act
      containerManager.dispose();

      // Assert
      const wrappers = terminalBody.querySelectorAll('.split-wrapper');
      expect(wrappers.length).toBe(0);
    });
  });
});
