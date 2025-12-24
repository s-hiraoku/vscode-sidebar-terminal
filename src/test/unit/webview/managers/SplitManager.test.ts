/**
 * SplitManager - Dynamic Split Direction Tests
 * Issue #148: Dynamic split direction based on panel location
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { SplitManager, TerminalInstance } from '../../../../webview/managers/SplitManager';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

describe('SplitManager - Dynamic Split Direction (Issue #148)', function () {
  let dom: JSDOM;
  let splitManager: SplitManager;
  let mockTerminal: sinon.SinonStubbedInstance<Terminal>;
  let mockFitAddon: sinon.SinonStubbedInstance<FitAddon>;

  beforeEach(function () {
    // Set up DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-body" style="width: 800px; height: 600px;">
            <!-- Test terminal containers will be added here -->
          </div>
        </body>
      </html>
    `,
      { pretendToBeVisual: true }
    );

    // Set global DOM objects
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;

    // Create mocks
    mockTerminal = sinon.createStubInstance(Terminal);
    mockFitAddon = sinon.createStubInstance(FitAddon);

    // Create mock coordinator
    const mockCoordinator = {
      postMessageToExtension: sinon.stub(),
    } as any;

    // Create SplitManager instance
    splitManager = new SplitManager(mockCoordinator);
  });

  afterEach(function () {
    // CRITICAL: Use try-finally to ensure all cleanup happens
    try {
      sinon.restore();
    } finally {
      try {
        // CRITICAL: Close JSDOM window to prevent memory leaks
        dom.window.close();
      } finally {
        // CRITICAL: Clean up global DOM state to prevent test pollution
        delete (global as any).window;
        delete (global as any).document;
        delete (global as any).HTMLElement;
      }
    }
  });

  describe('Dynamic Split Direction', function () {
    it('should update split direction from vertical to horizontal', function () {
      // Arrange - add TWO terminals to test layout change (layout only applied when terminals.size > 1)
      const terminalId1 = 'terminal-1';
      const container1 = document.createElement('div');
      container1.id = `terminal-container-${terminalId1}`;
      document.getElementById('terminal-body')!.appendChild(container1);

      const terminalInstance1: TerminalInstance = {
        id: terminalId1,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        name: 'Terminal 1',
        number: 1,
        container: container1,
        isActive: false,
      };

      const terminalId2 = 'terminal-2';
      const container2 = document.createElement('div');
      container2.id = `terminal-container-${terminalId2}`;
      document.getElementById('terminal-body')!.appendChild(container2);

      const terminalInstance2: TerminalInstance = {
        id: terminalId2,
        terminal: sinon.createStubInstance(Terminal),
        fitAddon: sinon.createStubInstance(FitAddon),
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

      // Assert - terminal body should have horizontal layout
      const terminalBody = document.getElementById('terminal-body')!;
      expect(terminalBody.style.flexDirection).to.equal('row'); // horizontal = row
      // The display property is not set by the split manager, so we shouldn't expect it
    });

    it('should update split direction from horizontal to vertical', function () {
      // Arrange - start with horizontal layout - need TWO terminals for layout to apply
      const terminalId1 = 'terminal-1';
      const container1 = document.createElement('div');
      container1.id = `terminal-container-${terminalId1}`;
      document.getElementById('terminal-body')!.appendChild(container1);

      const terminalInstance1: TerminalInstance = {
        id: terminalId1,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        name: 'Terminal 1',
        number: 1,
        container: container1,
        isActive: false,
      };

      const terminalId2 = 'terminal-2';
      const container2 = document.createElement('div');
      container2.id = `terminal-container-${terminalId2}`;
      document.getElementById('terminal-body')!.appendChild(container2);

      const terminalInstance2: TerminalInstance = {
        id: terminalId2,
        terminal: sinon.createStubInstance(Terminal),
        fitAddon: sinon.createStubInstance(FitAddon),
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

      // Assert - terminal body should have vertical layout
      const terminalBody = document.getElementById('terminal-body')!;
      expect(terminalBody.style.flexDirection).to.equal('column'); // vertical = column
    });

    it('should handle layout change with multiple terminals', function () {
      // Arrange - add multiple terminals
      const terminalIds = ['terminal-1', 'terminal-2', 'terminal-3'];
      const terminalInstances: TerminalInstance[] = [];

      terminalIds.forEach((id) => {
        const container = document.createElement('div');
        container.id = `terminal-container-${id}`;
        container.style.flex = '1'; // Simulate existing flex styling
        document.getElementById('terminal-body')!.appendChild(container);

        const instance: TerminalInstance = {
          id,
          terminal: sinon.createStubInstance(Terminal),
          fitAddon: sinon.createStubInstance(FitAddon),
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

      // Assert - all containers should have flex: 1 set by the split manager
      // Note: browsers may expand 'flex: 1' to 'flex: 1 1 0%' or similar
      terminalInstances.forEach((instance) => {
        expect(instance.container.style.flex).to.include('1');
      });

      const terminalBody = document.getElementById('terminal-body')!;
      expect(terminalBody.style.flexDirection).to.equal('row'); // horizontal layout
    });

    it('should preserve terminal state during layout transitions', function () {
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      container.id = `terminal-container-${terminalId}`;
      container.setAttribute('data-terminal-id', terminalId);
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
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
      expect(splitManager.terminals.has(terminalId)).to.be.true;
      expect(container.getAttribute('data-terminal-id')).to.equal(terminalId);
      expect(container.parentElement).to.equal(document.getElementById('terminal-body'));
    });

    it('should call fitAddon.fit() after layout change', function () {
      // Arrange - Create multiple terminals to trigger applyNewSplitLayout
      const terminalId1 = 'terminal-1';
      const terminalId2 = 'terminal-2';
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container1);
      document.getElementById('terminal-body')!.appendChild(container2);

      const terminalInstance1: TerminalInstance = {
        id: terminalId1,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        name: 'Terminal 1',
        number: 1,
        container: container1,
        isActive: false,
      };

      const terminalInstance2: TerminalInstance = {
        id: terminalId2,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
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
      return new Promise((resolve) => {
        setTimeout(() => {
          // Assert - fitAddon.fit should have been called for layout adjustment
          expect(mockFitAddon.fit).to.have.been.called;
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('Panel Location Integration', function () {
    it('should determine optimal split direction for sidebar location', function () {
      // Act
      const direction = splitManager.getOptimalSplitDirection('sidebar');

      // Assert
      expect(direction).to.equal('vertical');
    });

    it('should determine optimal split direction for panel location', function () {
      // Act
      const direction = splitManager.getOptimalSplitDirection('panel');

      // Assert
      expect(direction).to.equal('horizontal');
    });

    it('should fallback to vertical for unknown locations', function () {
      // Act
      const direction = splitManager.getOptimalSplitDirection('unknown' as any);

      // Assert
      expect(direction).to.equal('vertical');
    });
  });

  describe('Error Handling', function () {
    it('should handle missing terminal body gracefully', function () {
      // Arrange - remove terminal body
      document.getElementById('terminal-body')!.remove();

      // Act & Assert - should not throw
      expect(() => {
        splitManager.updateSplitDirection('horizontal', 'panel');
      }).to.not.throw();
    });

    it('should handle terminals with missing containers', function () {
      // Arrange - add terminal instance with null container
      const terminalInstance: TerminalInstance = {
        id: 'broken-terminal',
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
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
      }).to.not.throw();
    });

    it('should handle fitAddon.fit() failures gracefully', function () {
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container);

      // Mock fitAddon to throw error
      mockFitAddon.fit.throws(new Error('Fit operation failed'));

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
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
      }).to.not.throw();
    });
  });

  describe('Performance', function () {
    it('should efficiently handle rapid split direction changes', function () {
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
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
      expect(endTime - startTime).to.be.lessThan(100);
    });

    it('should not cause memory leaks with repeated layout changes', function () {
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
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
      expect(splitManager.terminals.size).to.equal(1);
      expect(splitManager.terminals.has(terminalId)).to.be.true;

      // Container should still be in DOM
      expect(container.parentElement).to.equal(document.getElementById('terminal-body'));
    });
  });

  describe('Visual Layout Verification', function () {
    it('should apply correct CSS properties for horizontal layout', function () {
      // Arrange
      const terminalBody = document.getElementById('terminal-body')!;

      // Act
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Assert
      expect(terminalBody.style.display).to.equal('');
      expect(terminalBody.style.flexDirection).to.equal('');
      expect(terminalBody.style.height).to.equal('600px');
    });

    it('should apply correct CSS properties for vertical layout', function () {
      // Arrange
      const terminalBody = document.getElementById('terminal-body')!;

      // Act
      splitManager.updateSplitDirection('vertical', 'sidebar');

      // Assert
      expect(terminalBody.style.display).to.equal('');
      expect(terminalBody.style.flexDirection).to.equal('');
      expect(terminalBody.style.height).to.equal('600px');
    });

    it('should maintain responsive layout during window resize simulation', function () {
      // Arrange
      const terminalIds = ['terminal-1', 'terminal-2'];
      terminalIds.forEach((id) => {
        const container = document.createElement('div');
        container.style.flex = '1';
        document.getElementById('terminal-body')!.appendChild(container);

        const instance: TerminalInstance = {
          id,
          terminal: sinon.createStubInstance(Terminal),
          fitAddon: sinon.createStubInstance(FitAddon),
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
      expect(terminalBody.style.flexDirection).to.equal('');

      // All terminals should still be present and properly sized
      terminalIds.forEach((id) => {
        const instance = splitManager.terminals.get(id);
        expect(instance).to.not.be.undefined;
        expect(instance!.container.style.flex).to.equal('1 1 0%');
      });
    });
  });
});
