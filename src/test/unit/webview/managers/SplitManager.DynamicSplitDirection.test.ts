/**
 * SplitManager - Dynamic Split Direction Tests  
 * Issue #148: Dynamic split direction based on panel location
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { SplitManager, TerminalInstance } from '../../../../webview/managers/SplitManager';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

describe('SplitManager - Dynamic Split Direction (Issue #148)', function () {
  let dom: JSDOM;
  let splitManager: SplitManager;
  let mockTerminal: sinon.SinonStubbedInstance<Terminal>;
  let mockFitAddon: sinon.SinonStubbedInstance<FitAddon>;

  beforeEach(function () {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-body" style="width: 800px; height: 600px;">
            <!-- Test terminal containers will be added here -->
          </div>
        </body>
      </html>
    `, { pretendToBeVisual: true });

    // Set global DOM objects
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;

    // Create mocks
    mockTerminal = sinon.createStubInstance(Terminal);
    mockFitAddon = sinon.createStubInstance(FitAddon);

    // Create SplitManager instance
    splitManager = new SplitManager();
  });

  afterEach(function () {
    // Clean up DOM
    dom.window.close();
    sinon.restore();
  });

  describe('Dynamic Split Direction', function () {
    it('should update split direction from vertical to horizontal', function () {
      // Arrange - add a terminal to test layout change
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      container.id = `terminal-container-${terminalId}`;
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        name: 'Terminal 1',
        container: container,
      };

      splitManager.terminals.set(terminalId, terminalInstance);
      splitManager.isSplitMode = true;

      // Act - change from vertical to horizontal
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Assert - terminal body should have horizontal layout
      const terminalBody = document.getElementById('terminal-body')!;
      expect(terminalBody.style.flexDirection).to.equal('row');
      expect(terminalBody.style.display).to.equal('flex');
    });

    it('should update split direction from horizontal to vertical', function () {
      // Arrange - start with horizontal layout
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      container.id = `terminal-container-${terminalId}`;
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        name: 'Terminal 1',
        container: container,
      };

      splitManager.terminals.set(terminalId, terminalInstance);
      splitManager.isSplitMode = true;
      
      // Set initial horizontal layout
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Act - change to vertical
      splitManager.updateSplitDirection('vertical', 'sidebar');

      // Assert - terminal body should have vertical layout
      const terminalBody = document.getElementById('terminal-body')!;
      expect(terminalBody.style.flexDirection).to.equal('column');
      expect(terminalBody.style.display).to.equal('flex');
    });

    it('should handle layout change with multiple terminals', function () {
      // Arrange - add multiple terminals
      const terminalIds = ['terminal-1', 'terminal-2', 'terminal-3'];
      const terminalInstances: TerminalInstance[] = [];

      terminalIds.forEach(id => {
        const container = document.createElement('div');
        container.id = `terminal-container-${id}`;
        container.style.flex = '1'; // Simulate existing flex styling
        document.getElementById('terminal-body')!.appendChild(container);

        const instance: TerminalInstance = {
          id,
          terminal: sinon.createStubInstance(Terminal),
          fitAddon: sinon.createStubInstance(FitAddon),
          name: `Terminal ${id}`,
          container,
        };

        splitManager.terminals.set(id, instance);
        terminalInstances.push(instance);
      });

      splitManager.isSplitMode = true;

      // Act - change to horizontal layout
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Assert - all containers should maintain flex: 1
      terminalInstances.forEach(instance => {
        expect(instance.container.style.flex).to.equal('1');
      });

      const terminalBody = document.getElementById('terminal-body')!;
      expect(terminalBody.style.flexDirection).to.equal('row');
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
        container,
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
      // Arrange
      const terminalId = 'terminal-1';
      const container = document.createElement('div');
      document.getElementById('terminal-body')!.appendChild(container);

      const terminalInstance: TerminalInstance = {
        id: terminalId,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        name: 'Terminal 1',
        container,
      };

      splitManager.terminals.set(terminalId, terminalInstance);
      splitManager.isSplitMode = true;

      // Act
      splitManager.updateSplitDirection('horizontal', 'panel');

      // Wait for any async operations
      return new Promise(resolve => {
        setTimeout(() => {
          // Assert - fitAddon.fit should have been called for layout adjustment
          expect(mockFitAddon.fit).to.have.been.called;
          resolve(undefined);
        }, 50);
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
        container: null as any, // Simulate missing container
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
        container,
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
        container,
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
        container,
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
      expect(terminalBody.style.display).to.equal('flex');
      expect(terminalBody.style.flexDirection).to.equal('row');
      expect(terminalBody.style.height).to.equal('100%');
    });

    it('should apply correct CSS properties for vertical layout', function () {
      // Arrange
      const terminalBody = document.getElementById('terminal-body')!;
      
      // Act
      splitManager.updateSplitDirection('vertical', 'sidebar');

      // Assert
      expect(terminalBody.style.display).to.equal('flex');
      expect(terminalBody.style.flexDirection).to.equal('column');
      expect(terminalBody.style.height).to.equal('100%');
    });

    it('should maintain responsive layout during window resize simulation', function () {
      // Arrange
      const terminalIds = ['terminal-1', 'terminal-2'];
      terminalIds.forEach(id => {
        const container = document.createElement('div');
        container.style.flex = '1';
        document.getElementById('terminal-body')!.appendChild(container);

        const instance: TerminalInstance = {
          id,
          terminal: sinon.createStubInstance(Terminal),
          fitAddon: sinon.createStubInstance(FitAddon),
          name: `Terminal ${id}`,
          container,
        };

        splitManager.terminals.set(id, instance);
      });

      // Act - simulate layout changes as if window resized
      splitManager.updateSplitDirection('horizontal', 'panel');
      
      // Simulate window resize by changing terminal body dimensions
      const terminalBody = document.getElementById('terminal-body')!;
      terminalBody.style.width = '400px';  // Narrower
      terminalBody.style.height = '1200px'; // Taller
      
      splitManager.updateSplitDirection('vertical', 'sidebar'); // Switch to vertical for narrow layout

      // Assert - layout should adapt
      expect(terminalBody.style.flexDirection).to.equal('column');
      
      // All terminals should still be present and properly sized
      terminalIds.forEach(id => {
        const instance = splitManager.terminals.get(id);
        expect(instance).to.not.be.undefined;
        expect(instance!.container.style.flex).to.equal('1');
      });
    });
  });
});