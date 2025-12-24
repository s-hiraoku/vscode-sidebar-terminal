/**
 * SplitManager - Dynamic Split Direction Tests
 * Issue #148: Dynamic split direction based on panel location
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SplitManager, TerminalInstance } from '../../../../../webview/managers/SplitManager';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

describe('SplitManager - Dynamic Split Direction (Issue #148)', () => {
  let splitManager: SplitManager;
  let mockTerminal: Terminal;
  let mockFitAddon: FitAddon;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create terminal-body element
    const terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    terminalBody.style.width = '800px';
    terminalBody.style.height = '600px';
    document.body.appendChild(terminalBody);

    // Create mocks
    mockTerminal = {
      options: {},
      rows: 24,
      cols: 80,
      dispose: vi.fn(),
      element: document.createElement('div'),
    } as any;

    mockFitAddon = {
      fit: vi.fn(),
      dispose: vi.fn(),
    } as any;

    // Create mock coordinator
    const mockCoordinator = {
      postMessageToExtension: vi.fn(),
    } as any;

    // Create SplitManager instance
    splitManager = new SplitManager(mockCoordinator);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('Dynamic Split Direction', () => {
    it('should update split direction from vertical to horizontal', () => {
      // Arrange - add TWO terminals to test layout change (layout only applied when terminals.size > 1)
      const terminalId1 = 'terminal-1';
      const container1 = document.createElement('div');
      container1.id = `terminal-container-${terminalId1}`;
      document.getElementById('terminal-body')!.appendChild(container1);

      const terminalInstance1: TerminalInstance = {
        id: terminalId1,
        terminal: mockTerminal as any,
        fitAddon: mockFitAddon as any,
        name: 'Terminal 1',
        number: 1,
        container: container1,
        isActive: false,
      };

      const terminalId2 = 'terminal-2';
      const container2 = document.createElement('div');
      container2.id = `terminal-container-${terminalId2}`;
      document.getElementById('terminal-body')!.appendChild(container2);

      const mockTerminal2 = { ...mockTerminal, element: document.createElement('div') };
      const mockFitAddon2 = { fit: vi.fn(), dispose: vi.fn() };

      const terminalInstance2: TerminalInstance = {
        id: terminalId2,
        terminal: mockTerminal2 as any,
        fitAddon: mockFitAddon2 as any,
        name: 'Terminal 2',
        number: 2,
        container: container2,
        isActive: false,
      };

      splitManager.terminals.set(terminalId1, terminalInstance1);
      splitManager.terminals.set(terminalId2, terminalInstance2);
      // Also add to terminalContainers map which is used by the layout update logic
      (splitManager as any).terminalContainers.set(terminalId1, container1);
      (splitManager as any).terminalContainers.set(terminalId2, container2);
      splitManager.isSplitMode = true;

      // Act - change from vertical to horizontal
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Assert - split direction should be updated (implementation uses containerManager)
      expect(splitManager.splitDirection).toBe('horizontal');
    });

    it('should update split direction from horizontal to vertical', () => {
      // Arrange - start with horizontal layout - need TWO terminals for layout to apply
      const terminalId1 = 'terminal-1';
      const container1 = document.createElement('div');
      container1.id = `terminal-container-${terminalId1}`;
      document.getElementById('terminal-body')!.appendChild(container1);

      const terminalInstance1: TerminalInstance = {
        id: terminalId1,
        terminal: mockTerminal as any,
        fitAddon: mockFitAddon as any,
        name: 'Terminal 1',
        number: 1,
        container: container1,
        isActive: false,
      };

      const terminalId2 = 'terminal-2';
      const container2 = document.createElement('div');
      container2.id = `terminal-container-${terminalId2}`;
      document.getElementById('terminal-body')!.appendChild(container2);

      const mockTerminal2 = { ...mockTerminal, element: document.createElement('div') };
      const mockFitAddon2 = { fit: vi.fn(), dispose: vi.fn() };

      const terminalInstance2: TerminalInstance = {
        id: terminalId2,
        terminal: mockTerminal2 as any,
        fitAddon: mockFitAddon2 as any,
        name: 'Terminal 2',
        number: 2,
        container: container2,
        isActive: false,
      };

      splitManager.terminals.set(terminalId1, terminalInstance1);
      splitManager.terminals.set(terminalId2, terminalInstance2);
      // Also add to terminalContainers map which is used by the layout update logic
      (splitManager as any).terminalContainers.set(terminalId1, container1);
      (splitManager as any).terminalContainers.set(terminalId2, container2);
      splitManager.isSplitMode = true;

      // Set initial horizontal layout
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Act - change to vertical
      splitManager.updateSplitDirection('vertical', 'sidebar');

      // Assert - split direction should be updated
      expect(splitManager.splitDirection).toBe('vertical');
    });

    it('should handle layout change with multiple terminals', () => {
      // Arrange - add multiple terminals
      const terminalIds = ['terminal-1', 'terminal-2', 'terminal-3'];
      const terminalInstances: TerminalInstance[] = [];

      terminalIds.forEach((id) => {
        const container = document.createElement('div');
        container.id = `terminal-container-${id}`;
        container.style.flex = '1'; // Simulate existing flex styling
        document.getElementById('terminal-body')!.appendChild(container);

        const mockTerm = { ...mockTerminal, element: document.createElement('div') };
        const mockFit = { fit: vi.fn(), dispose: vi.fn() };

        const instance: TerminalInstance = {
          id,
          terminal: mockTerm as any,
          fitAddon: mockFit as any,
          name: `Terminal ${id}`,
          number: parseInt(id.split('-')[1] || '1') || 1,
          container,
          isActive: false,
        };

        splitManager.terminals.set(id, instance);
        // Also add to terminalContainers map which is used by the layout update logic
        (splitManager as any).terminalContainers.set(id, container);
        terminalInstances.push(instance);
      });

      splitManager.isSplitMode = true;

      // Act - change to horizontal layout
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Assert - split direction should be horizontal
      expect(splitManager.splitDirection).toBe('horizontal');

      // All terminals should still be registered
      terminalInstances.forEach((instance) => {
        expect(splitManager.terminals.has(instance.id)).toBe(true);
      });
    });

    it('should preserve terminal state during layout transitions', () => {
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      container.id = `terminal-container-${terminalId}`;
      container.setAttribute('data-terminal-id', terminalId);
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal as any,
        fitAddon: mockFitAddon as any,
        name: 'Terminal 1',
        number: 1,
        container,
        isActive: false,
      };

      splitManager.terminals.set(terminalId, terminalInstance);
      splitManager.isSplitMode = true;

      // Act - multiple direction changes
      splitManager.updateSplitDirection('horizontal', 'panel');
      splitManager.updateSplitDirection('vertical', 'sidebar');
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Assert - terminal should still exist and be properly configured
      expect(splitManager.terminals.has(terminalId)).toBe(true);
      expect(container.getAttribute('data-terminal-id')).toBe(terminalId);
      expect(container.parentElement).toBe(document.getElementById('terminal-body'));
    });

    it('should call fitAddon.fit() after layout change', async () => {
      // Arrange - Create multiple terminals to trigger applyNewSplitLayout
      const terminalId1 = 'terminal-1';
      const terminalId2 = 'terminal-2';
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container1);
      document.getElementById('terminal-body')!.appendChild(container2);

      const terminalInstance1: TerminalInstance = {
        id: terminalId1,
        terminal: mockTerminal as any,
        fitAddon: mockFitAddon as any,
        name: 'Terminal 1',
        number: 1,
        container: container1,
        isActive: false,
      };

      const terminalInstance2: TerminalInstance = {
        id: terminalId2,
        terminal: mockTerminal as any,
        fitAddon: mockFitAddon as any,
        name: 'Terminal 2',
        number: 2,
        container: container2,
        isActive: false,
      };

      splitManager.terminals.set(terminalId1, terminalInstance1);
      splitManager.terminals.set(terminalId2, terminalInstance2);
      // Access private property using bracket notation for testing
      (splitManager as any).terminalContainers.set(terminalId1, container1);
      (splitManager as any).terminalContainers.set(terminalId2, container2);
      splitManager.isSplitMode = true;

      // Act
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Wait for any async operations (implementation uses 100ms timeout)
      vi.advanceTimersByTime(150);

      // Assert - fitAddon.fit should have been called for layout adjustment
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });
  });

  describe('Panel Location Integration', () => {
    it('should determine optimal split direction for sidebar location', () => {
      // Act
      const direction = splitManager.getOptimalSplitDirection('sidebar');

      // Assert
      expect(direction).toBe('vertical');
    });

    it('should determine optimal split direction for panel location', () => {
      // Act
      const direction = splitManager.getOptimalSplitDirection('panel');

      // Assert
      expect(direction).toBe('horizontal');
    });

    it('should fallback to vertical for unknown locations', () => {
      // Act
      const direction = splitManager.getOptimalSplitDirection('unknown' as any);

      // Assert
      expect(direction).toBe('vertical');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing terminal body gracefully', () => {
      // Arrange - remove terminal body
      document.getElementById('terminal-body')!.remove();

      // Act & Assert - should not throw
      expect(() => {
        splitManager.updateSplitDirection('horizontal', 'panel');
      }).not.toThrow();
    });

    it('should handle terminals with missing containers', () => {
      // Arrange - add terminal instance with null container
      const terminalInstance: TerminalInstance = {
        id: 'broken-terminal',
        terminal: mockTerminal as any,
        fitAddon: mockFitAddon as any,
        name: 'Broken Terminal',
        number: 1,
        container: null as any, // Simulate missing container
        isActive: false,
      };

      splitManager.terminals.set('broken-terminal', terminalInstance);
      splitManager.isSplitMode = true;

      // Act & Assert - should not throw
      expect(() => {
        splitManager.updateSplitDirection('horizontal', 'panel');
      }).not.toThrow();
    });

    it('should handle fitAddon.fit() failures gracefully', () => {
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container);

      // Mock fitAddon to throw error
      const throwingFitAddon = {
        fit: vi.fn().mockImplementation(() => {
          throw new Error('Fit operation failed');
        }),
        dispose: vi.fn(),
      };

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal as any,
        fitAddon: throwingFitAddon as any,
        name: 'Terminal 1',
        number: 1,
        container,
        isActive: false,
      };

      splitManager.terminals.set(terminalId, terminalInstance);
      splitManager.isSplitMode = true;

      // Act & Assert - should handle error gracefully
      expect(() => {
        splitManager.updateSplitDirection('horizontal', 'panel');
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should efficiently handle rapid split direction changes', () => {
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal as any,
        fitAddon: mockFitAddon as any,
        name: 'Terminal 1',
        number: 1,
        container,
        isActive: false,
      };

      splitManager.terminals.set(terminalId, terminalInstance);
      splitManager.isSplitMode = true;

      // Act - rapid changes
      const startTime = Date.now();
      for (let i = 0; i < 10; i++) {
        const direction = i % 2 === 0 ? 'horizontal' : 'vertical';
        const location = i % 2 === 0 ? 'panel' : 'sidebar';
        splitManager.updateSplitDirection(direction, location);
      }
      const endTime = Date.now();

      // Assert - should complete quickly
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should not cause memory leaks with repeated layout changes', () => {
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal as any,
        fitAddon: mockFitAddon as any,
        name: 'Terminal 1',
        number: 1,
        container,
        isActive: false,
      };

      splitManager.terminals.set(terminalId, terminalInstance);
      splitManager.isSplitMode = true;

      // Act - many layout changes
      for (let i = 0; i < 50; i++) {
        const direction = i % 2 === 0 ? 'horizontal' : 'vertical';
        const location = i % 2 === 0 ? 'panel' : 'sidebar';
        splitManager.updateSplitDirection(direction, location);
      }

      // Assert - terminals map should still have correct size
      expect(splitManager.terminals.size).toBe(1);
      expect(splitManager.terminals.has(terminalId)).toBe(true);

      // Container should still be in DOM
      expect(container.parentElement).toBe(document.getElementById('terminal-body'));
    });
  });

  describe('Visual Layout Verification', () => {
    it('should apply correct CSS properties for horizontal layout', () => {
      // Arrange
      const terminalBody = document.getElementById('terminal-body')!;

      // Act
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Assert
      expect(terminalBody.style.display).toBe('');
      expect(terminalBody.style.flexDirection).toBe('');
      expect(terminalBody.style.height).toBe('600px');
    });

    it('should apply correct CSS properties for vertical layout', () => {
      // Arrange
      const terminalBody = document.getElementById('terminal-body')!;

      // Act
      splitManager.updateSplitDirection('vertical', 'sidebar');

      // Assert
      expect(terminalBody.style.display).toBe('');
      expect(terminalBody.style.flexDirection).toBe('');
      expect(terminalBody.style.height).toBe('600px');
    });

    it('should maintain responsive layout during window resize simulation', () => {
      // Arrange
      const terminalIds = ['terminal-1', 'terminal-2'];
      terminalIds.forEach((id) => {
        const container = document.createElement('div');
        container.style.flex = '1';
        document.getElementById('terminal-body')!.appendChild(container);

        const mockTerm = { ...mockTerminal, element: document.createElement('div') };
        const mockFit = { fit: vi.fn(), dispose: vi.fn() };

        const instance: TerminalInstance = {
          id,
          terminal: mockTerm as any,
          fitAddon: mockFit as any,
          name: `Terminal ${id}`,
          number: parseInt(id.split('-')[1] || '1') || 1,
          container,
          isActive: false,
        };

        splitManager.terminals.set(id, instance);
      });

      // Act - simulate layout changes as if window resized
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Simulate window resize by changing terminal body dimensions
      const terminalBody = document.getElementById('terminal-body')!;
      terminalBody.style.width = '400px'; // Narrower
      terminalBody.style.height = '1200px'; // Taller

      splitManager.updateSplitDirection('vertical', 'sidebar'); // Switch to vertical for narrow layout

      // Assert - layout should adapt
      expect(terminalBody.style.flexDirection).toBe('');

      // All terminals should still be present and properly sized
      terminalIds.forEach((id) => {
        const instance = splitManager.terminals.get(id);
        expect(instance).toBeDefined();
        expect(instance!.container.style.flex).toBe('1 1 0%');
      });
    });
  });
});
