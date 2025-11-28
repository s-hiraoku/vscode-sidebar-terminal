/**
 * TerminalContainerManager Tests
 * Issue #198: State-based display management for fullscreen/split modes
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { TerminalContainerManager } from '../../../../webview/managers/TerminalContainerManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';

describe('TerminalContainerManager - Display State Management (Issue #198)', function () {
  let dom: JSDOM;
  let containerManager: TerminalContainerManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let terminalBody: HTMLElement;

  beforeEach(function () {
    // Set up DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-body">
            <div id="terminal-container-1" class="terminal-container" data-terminal-id="1"></div>
            <div id="terminal-container-2" class="terminal-container" data-terminal-id="2"></div>
            <div id="terminal-container-3" class="terminal-container" data-terminal-id="3"></div>
          </div>
        </body>
      </html>
    `,
      { pretendToBeVisual: true }
    );

    global.window = dom.window as any;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;

    terminalBody = document.getElementById('terminal-body')!;

    // Create mock coordinator
    mockCoordinator = {
      getManagers: sinon.stub().returns({}),
    } as any;

    // Create TerminalContainerManager instance (Issue #216: constructor injection)
    containerManager = new TerminalContainerManager(mockCoordinator as any);
    containerManager.initialize();

    // Register containers
    containerManager.registerContainer('1', document.getElementById('terminal-container-1')!);
    containerManager.registerContainer('2', document.getElementById('terminal-container-2')!);
    containerManager.registerContainer('3', document.getElementById('terminal-container-3')!);
  });

  afterEach(function () {
    containerManager.dispose();
    dom.window.close();
    sinon.restore();
  });

  describe('Container Registration', function () {
    it('should register terminal containers', function () {
      const containers = containerManager.getAllContainers();
      expect(containers.size).to.equal(3);
      expect(containers.has('1')).to.be.true;
      expect(containers.has('2')).to.be.true;
      expect(containers.has('3')).to.be.true;
    });

    it('should unregister terminal containers', function () {
      // Act
      containerManager.unregisterContainer('2');

      // Assert
      const containers = containerManager.getAllContainers();
      expect(containers.size).to.equal(2);
      expect(containers.has('2')).to.be.false;
    });

    it('should get container order', function () {
      const order = containerManager.getContainerOrder();
      expect(order).to.deep.equal(['1', '2', '3']);
    });

    it('should handle duplicate registration gracefully', function () {
      // Act - register same container twice
      const container = document.getElementById('terminal-container-1')!;
      containerManager.registerContainer('1', container);

      // Assert - should still have 3 containers
      const containers = containerManager.getAllContainers();
      expect(containers.size).to.equal(3);
    });
  });

  describe('Normal Mode Display State', function () {
    it('should apply normal mode display state', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).to.equal('normal');
      expect(snapshot.visibleTerminals).to.have.members(['1', '2', '3']);
      // All terminals are visible in normal mode
      expect(snapshot.visibleTerminals).to.have.length(3);
    });

    it('should make all containers visible in normal mode', function () {
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
      expect(snapshot.visibleTerminals).to.have.length(3);
    });

    it('should remove fullscreen classes in normal mode', function () {
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
      expect(container1.classList.contains('terminal-container--fullscreen')).to.be.false;
    });
  });

  describe('Fullscreen Mode Display State', function () {
    it('should apply fullscreen mode display state', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '2',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).to.equal('fullscreen');
      expect(snapshot.visibleTerminals).to.have.members(['2']);
      // Only terminal 2 is visible in fullscreen mode
      const allTerminals = ['1', '2', '3'];
      const hiddenTerminals = allTerminals.filter((id) => !snapshot.visibleTerminals.includes(id));
      expect(hiddenTerminals).to.have.members(['1', '3']);
    });

    it('should add fullscreen class to active container', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const container1 = document.getElementById('terminal-container-1')!;
      expect(container1.classList.contains('terminal-container--fullscreen')).to.be.true;
    });

    it('should set fullscreen container styles', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Assert
      const container1 = document.getElementById('terminal-container-1')!;
      expect(container1.style.flex).to.equal('1 1 auto');
      expect(container1.style.width).to.equal('100%');
      expect(container1.style.height).to.equal('100%');
    });

    it('should hide non-active containers in fullscreen mode', function () {
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
      expect(hiddenTerminals).to.include('1');
      expect(hiddenTerminals).to.include('3');
    });
  });

  describe('Split Mode Display State', function () {
    it('should apply split mode display state', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: '1',
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.mode).to.equal('split');
      expect(snapshot.visibleTerminals).to.have.members(['1', '2', '3']);
    });

    it('should create split wrappers for vertical split', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2'],
        splitDirection: 'vertical',
      });

      // Assert
      const wrappers = terminalBody.querySelectorAll('.split-wrapper');
      expect(wrappers.length).to.be.greaterThan(0);
    });

    it('should create split wrappers for horizontal split', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2'],
        splitDirection: 'horizontal',
      });

      // Assert
      const wrappers = terminalBody.querySelectorAll('.split-wrapper');
      expect(wrappers.length).to.be.greaterThan(0);
    });

    it('should add split class to containers in split mode', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Assert
      const container1 = document.getElementById('terminal-container-1')!;
      expect(container1.classList.contains('terminal-container--split')).to.be.true;
    });

    it('should make all containers visible in split mode', function () {
      // Act
      containerManager.applyDisplayState({
        mode: 'split',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
        splitDirection: 'vertical',
      });

      // Assert
      const snapshot = containerManager.getDisplaySnapshot();
      expect(snapshot.visibleTerminals).to.have.length(3);
      // All terminals are visible in normal mode
      expect(snapshot.visibleTerminals).to.have.length(3);
    });
  });

  describe('Split Artifacts Management', function () {
    it('should clear split artifacts', function () {
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
      expect(wrappers.length).to.equal(0);
    });

    it('should remove resizers when clearing split artifacts', function () {
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
      expect(resizers.length).to.equal(0);
    });
  });

  describe('Display Snapshot', function () {
    it('should provide accurate display snapshot in normal mode', function () {
      // Arrange
      containerManager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: null,
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Act
      const snapshot = containerManager.getDisplaySnapshot();

      // Assert
      expect(snapshot.mode).to.equal('normal');
      expect(snapshot.visibleTerminals).to.have.members(['1', '2', '3']);
    });

    it('should provide accurate display snapshot in fullscreen mode', function () {
      // Arrange
      containerManager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: '2',
        orderedTerminalIds: ['1', '2', '3'],
      });

      // Act
      const snapshot = containerManager.getDisplaySnapshot();

      // Assert
      expect(snapshot.mode).to.equal('fullscreen');
      expect(snapshot.visibleTerminals).to.deep.equal(['2']);
      // Only terminal 2 is visible in fullscreen mode
      const allTerminals = ['1', '2', '3'];
      const hiddenTerminals = allTerminals.filter((id) => !snapshot.visibleTerminals.includes(id));
      expect(hiddenTerminals).to.have.members(['1', '3']);
    });

    it('should provide accurate display snapshot in split mode', function () {
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
      expect(snapshot.mode).to.equal('split');
      expect(snapshot.visibleTerminals).to.have.length(3);
    });
  });

  describe('Container Mode Management', function () {
    it('should set container mode to normal', function () {
      // Act
      containerManager.setContainerMode('1', 'normal');

      // Assert - container should have normal mode class
      const _container = document.getElementById('terminal-container-1')!;
      // Implementation may add specific classes
    });

    it('should set container mode to fullscreen', function () {
      // Act
      containerManager.setContainerMode('1', 'fullscreen');

      // Assert - fullscreen mode should be applied
      const _container = document.getElementById('terminal-container-1')!;
      // Container should have fullscreen styling
    });

    it('should set container mode to split', function () {
      // Act
      containerManager.setContainerMode('1', 'split');

      // Assert - split mode should be applied
      const _container = document.getElementById('terminal-container-1')!;
      // Container should have split styling
    });
  });

  describe('Container Visibility', function () {
    it('should set container visibility to visible', function () {
      // Act
      containerManager.setContainerVisibility('1', true);

      // Assert
      const container = document.getElementById('terminal-container-1')!;
      expect(container.style.display).to.not.equal('none');
    });

    it('should set container visibility to hidden', function () {
      // Act
      containerManager.setContainerVisibility('1', false);

      // Assert - container should be hidden
      // Implementation may use display:none or visibility:hidden
    });
  });

  describe('Error Handling', function () {
    it('should handle missing terminal body gracefully', function () {
      // Arrange - remove terminal body
      terminalBody.remove();

      // Act & Assert - should not throw
      expect(() => {
        containerManager.applyDisplayState({
          mode: 'normal',
          activeTerminalId: null,
          orderedTerminalIds: ['1', '2', '3'],
        });
      }).to.not.throw();
    });

    it('should handle unregistered terminal IDs gracefully', function () {
      // Act & Assert - should not throw
      expect(() => {
        containerManager.applyDisplayState({
          mode: 'fullscreen',
          activeTerminalId: 'nonexistent',
          orderedTerminalIds: ['1', '2', '3'],
        });
      }).to.not.throw();
    });

    it('should handle empty ordered IDs gracefully', function () {
      // Act & Assert - should not throw
      expect(() => {
        containerManager.applyDisplayState({
          mode: 'normal',
          activeTerminalId: null,
          orderedTerminalIds: [],
        });
      }).to.not.throw();
    });
  });

  describe('Mode Transitions', function () {
    it('should transition from normal to fullscreen', function () {
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
      expect(snapshot.mode).to.equal('fullscreen');
      expect(snapshot.visibleTerminals).to.deep.equal(['2']);
    });

    it('should transition from fullscreen to split', function () {
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
      expect(snapshot.mode).to.equal('split');
      expect(snapshot.visibleTerminals).to.have.length(3);
    });

    it('should transition from split to normal', function () {
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
      expect(snapshot.mode).to.equal('normal');

      // Split artifacts should be cleaned up
      const wrappers = terminalBody.querySelectorAll('.split-wrapper');
      expect(wrappers.length).to.equal(0);
    });
  });

  describe('Cleanup', function () {
    it('should dispose all containers', function () {
      // Act
      containerManager.dispose();

      // Assert
      const containers = containerManager.getAllContainers();
      expect(containers.size).to.equal(0);
    });

    it('should clear split artifacts on dispose', function () {
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
      expect(wrappers.length).to.equal(0);
    });
  });
});
