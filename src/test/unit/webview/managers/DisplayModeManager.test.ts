/**
 * DisplayModeManager Tests
 * Issue #198: Fullscreen terminal display when clicking tabs
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { DisplayModeManager } from '../../../../webview/managers/DisplayModeManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';
import { ISplitLayoutController } from '../../../../webview/interfaces/ISplitLayoutController';

describe('DisplayModeManager - Fullscreen Display (Issue #198)', function () {
  let dom: JSDOM;
  let displayManager: DisplayModeManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let mockSplitManager: sinon.SinonStubbedInstance<ISplitLayoutController>;
  let mockContainerManager: any;

  beforeEach(function () {
    // Set up DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-body">
            <div id="terminal-container-1" class="terminal-container"></div>
            <div id="terminal-container-2" class="terminal-container"></div>
            <div id="terminal-container-3" class="terminal-container"></div>
          </div>
        </body>
      </html>
    `,
      { pretendToBeVisual: true }
    );

    global.window = dom.window as any;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;

    // Create mock container manager
    mockContainerManager = {
      getContainerOrder: sinon.stub().returns(['1', '2', '3']),
      applyDisplayState: sinon.stub(),
      getDisplaySnapshot: sinon.stub().returns({
        mode: 'normal',
        visibleTerminals: ['1', '2', '3'],
        activeTerminalId: null,
        registeredContainers: 3,
        registeredWrappers: 0,
      }),
      getAllContainers: sinon.stub().returns(
        new Map([
          ['1', document.getElementById('terminal-container-1')],
          ['2', document.getElementById('terminal-container-2')],
          ['3', document.getElementById('terminal-container-3')],
        ])
      ),
      clearSplitArtifacts: sinon.stub(),
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
      getIsSplitMode: sinon.stub().callsFake(() => isSplitMode),
      exitSplitMode: sinon.stub().callsFake(() => {
        isSplitMode = false;
      }),
      getOptimalSplitDirection: sinon.stub().returns('vertical'),
      prepareSplitMode: sinon.stub().callsFake(() => {
        isSplitMode = true;
      }),
      redistributeSplitTerminals: sinon.stub(),
    } as any;

    // Create mock coordinator
    mockCoordinator = {
      getTerminalContainerManager: sinon.stub().returns(mockContainerManager),
      getManagers: sinon.stub().returns({
        header: {
          // Split button removed - empty interface
        },
        tabs: {
          updateModeIndicator: sinon.stub(),
        },
      }),
      splitManager: mockSplitManager,
    } as any;

    // Create DisplayModeManager instance with constructor injection (Issue #216)
    displayManager = new DisplayModeManager(mockCoordinator as any);
    displayManager.initialize();
  });

  afterEach(function () {
    // CRITICAL: Use try-finally to ensure all cleanup happens
    try {
      displayManager.dispose();
    } finally {
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
    }
  });

  describe('Initialization', function () {
    it('should initialize in normal mode', function () {
      expect(displayManager.getCurrentMode()).to.equal('normal');
    });

    it('should have no fullscreen terminal initially', function () {
      const debugInfo = displayManager.getDebugInfo();
      expect(debugInfo.fullscreenTerminalId).to.be.null;
    });
  });

  describe('Fullscreen Mode', function () {
    it('should switch to fullscreen mode when showTerminalFullscreen is called', function () {
      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(displayManager.getCurrentMode()).to.equal('fullscreen');
      expect(mockContainerManager.applyDisplayState).to.have.been.calledWith(
        sinon.match({
          mode: 'fullscreen',
          activeTerminalId: '1',
        })
      );
    });

    it('should exit split mode before entering fullscreen', function () {
      // Arrange - simulate split mode
      mockSplitManager.isSplitMode = true;

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(mockSplitManager.exitSplitMode).to.have.been.called;
      expect(mockSplitManager.isSplitMode).to.be.false;
    });

    it('should update visibility from container manager snapshot', function () {
      // Arrange
      mockContainerManager.getDisplaySnapshot.returns({
        mode: 'fullscreen',
        visibleTerminals: ['1'],
        activeTerminalId: '1',
        registeredContainers: 3,
        registeredWrappers: 0,
      });

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(displayManager.isTerminalVisible('1')).to.be.true;
      expect(displayManager.isTerminalVisible('2')).to.be.false;
      expect(displayManager.isTerminalVisible('3')).to.be.false;
    });

    it('should notify mode change to tab manager', function () {
      // Arrange
      const mockTabs = mockCoordinator.getManagers().tabs;

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      if (mockTabs) {
        expect(mockTabs.updateModeIndicator).to.have.been.calledWith('fullscreen');
      }
    });

    // Split button removed - test removed
  });

  describe('Split Mode Toggle', function () {
    it('should toggle from normal to split mode', function () {
      // Arrange - start in normal mode
      expect(displayManager.getCurrentMode()).to.equal('normal');

      // Act
      displayManager.toggleSplitMode();

      // Assert
      expect(displayManager.getCurrentMode()).to.equal('split');
      expect(mockSplitManager.prepareSplitMode).to.have.been.calledWith('vertical');
    });

    it('should toggle from split to normal mode', function () {
      // Arrange - enter split mode first
      displayManager.toggleSplitMode();
      expect(displayManager.getCurrentMode()).to.equal('split');

      // Act - toggle back
      displayManager.toggleSplitMode();

      // Assert
      expect(displayManager.getCurrentMode()).to.equal('normal');
      expect(mockSplitManager.exitSplitMode).to.have.been.called;
    });

    it('should show all terminals in split mode', function () {
      // Act
      displayManager.showAllTerminalsSplit();

      // Assert
      expect(displayManager.getCurrentMode()).to.equal('split');
      expect(mockContainerManager.applyDisplayState).to.have.been.calledWith(
        sinon.match({
          mode: 'split',
          splitDirection: 'vertical',
        })
      );
    });
  });

  describe('Mode Transitions', function () {
    it('should track previous mode when switching', function () {
      // Arrange
      displayManager.setDisplayMode('fullscreen');

      // Act
      displayManager.setDisplayMode('split');

      // Assert
      const debugInfo = displayManager.getDebugInfo();
      expect(debugInfo.previousMode).to.equal('fullscreen');
    });

    it('should handle fullscreen -> split transition', function () {
      // Arrange
      displayManager.showTerminalFullscreen('1');

      // Act
      displayManager.toggleSplitMode();

      // Assert
      expect(displayManager.getCurrentMode()).to.equal('split');
    });

    it('should handle split -> fullscreen transition', function () {
      // Arrange
      displayManager.toggleSplitMode(); // Enter split mode

      // Act
      displayManager.showTerminalFullscreen('2');

      // Assert
      expect(displayManager.getCurrentMode()).to.equal('fullscreen');
      expect(mockSplitManager.exitSplitMode).to.have.been.called;
    });
  });

  describe('Terminal Visibility', function () {
    it('should hide all terminals except specified one', function () {
      // Act
      displayManager.hideAllTerminalsExcept('2');

      // Assert
      expect(mockContainerManager.applyDisplayState).to.have.been.calledWith(
        sinon.match({
          mode: 'fullscreen',
          activeTerminalId: '2',
        })
      );
    });

    it('should show all terminals', function () {
      // Act
      displayManager.showAllTerminals();

      // Assert
      expect(mockContainerManager.applyDisplayState).to.have.been.calledWith(
        sinon.match({
          mode: 'normal',
          activeTerminalId: null,
        })
      );
    });

    it('should check terminal visibility correctly', function () {
      // Arrange
      mockContainerManager.getDisplaySnapshot.returns({
        mode: 'fullscreen',
        visibleTerminals: ['1'],
        activeTerminalId: '1',
        registeredContainers: 3,
        registeredWrappers: 0,
      });

      // Act
      displayManager.showTerminalFullscreen('1');

      // Assert
      expect(displayManager.isTerminalVisible('1')).to.be.true;
      expect(displayManager.isTerminalVisible('2')).to.be.false;
    });
  });

  describe('Error Handling', function () {
    it('should handle missing container manager gracefully', function () {
      // Arrange
      const originalGetManager = mockCoordinator.getTerminalContainerManager;
      (mockCoordinator as any).getTerminalContainerManager = sinon.stub().returns(undefined);

      // Act & Assert - should not throw
      expect(() => {
        displayManager.showTerminalFullscreen('1');
      }).to.not.throw();

      // Restore
      (mockCoordinator as any).getTerminalContainerManager = originalGetManager;
    });

    it('should handle missing split manager gracefully', function () {
      // Arrange
      (mockCoordinator as any).splitManager = null;

      // Act & Assert - should not throw
      expect(() => {
        displayManager.showAllTerminalsSplit();
      }).to.not.throw();
    });

    it('should handle missing header manager gracefully', function () {
      // Arrange
      const originalGetManagers = mockCoordinator.getManagers;
      (mockCoordinator as any).getManagers = sinon.stub().returns({
        header: undefined,
        tabs: undefined,
      });

      // Act & Assert - should not throw
      expect(() => {
        displayManager.showTerminalFullscreen('1');
      }).to.not.throw();

      // Restore
      (mockCoordinator as any).getManagers = originalGetManagers;
    });
  });

  describe('Cleanup', function () {
    it('should return to normal mode on dispose', function () {
      // Arrange
      displayManager.showTerminalFullscreen('1');
      expect(displayManager.getCurrentMode()).to.equal('fullscreen');

      // Act
      displayManager.dispose();

      // Assert - should be in normal mode after dispose
      expect(displayManager.getCurrentMode()).to.equal('normal');
    });

    it('should clear all visibility tracking on dispose', function () {
      // Arrange
      displayManager.showTerminalFullscreen('1');

      // Act
      displayManager.dispose();

      // Assert
      const debugInfo = displayManager.getDebugInfo();
      expect(debugInfo.visibleTerminals).to.have.length(0);
    });
  });

  describe('Debug Information', function () {
    it('should provide accurate debug info', function () {
      // Arrange
      displayManager.showTerminalFullscreen('2');

      // Act
      const debugInfo = displayManager.getDebugInfo();

      // Assert
      expect(debugInfo.currentMode).to.equal('fullscreen');
      expect(debugInfo.fullscreenTerminalId).to.equal('2');
      expect(debugInfo.previousMode).to.equal('normal');
    });
  });
});
