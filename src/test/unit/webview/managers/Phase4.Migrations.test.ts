/**
 * Phase 4 Manager Migrations - Display & UI Managers
 *
 * Tests for Issue #216 Phase 4: Verifies DisplayModeManager migration to
 * constructor injection pattern and UIManager verification.
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { expect } from 'chai';
import { DisplayModeManager } from '../../../../webview/managers/DisplayModeManager';
import { UIManager } from '../../../../webview/managers/UIManager';
import { IDisposable } from '../../../../webview/utils/DOMManager';

describe('Phase 4 Manager Migrations - Display & UI', () => {
  describe('DisplayModeManager - Constructor Injection', () => {
    let manager: DisplayModeManager;
    const mockCoordinator = {
      getTerminalContainerManager: () => ({}),
      getManagers: () => ({
        header: { updateSplitButtonState: () => {} },
        tabs: { updateModeIndicator: () => {} },
      }),
      splitManager: {
        isSplitMode: false,
        exitSplitMode: () => {},
      },
    } as any;

    beforeEach(() => {
      manager = new DisplayModeManager(mockCoordinator);
    });

    afterEach(() => {
      if (manager && !manager['isDisposed']) {
        manager.dispose();
      }
    });

    it('should extend BaseManager', () => {
      expect(manager).to.have.property('initialize');
      expect(manager).to.have.property('dispose');
      expect(manager).to.have.property('getStatus');
      expect(manager).to.have.property('getHealthStatus');
    });

    it('should implement IDisposable', () => {
      const disposable: IDisposable = manager;
      expect(disposable).to.have.property('dispose');
      expect(typeof disposable.dispose).to.equal('function');
    });

    it('should use constructor injection (no setCoordinator)', () => {
      // Verify coordinator is set via constructor
      expect(manager['coordinator']).to.equal(mockCoordinator);

      // Verify setCoordinator method is removed
      expect(manager).to.not.have.property('setCoordinator');
    });

    it('should initialize successfully', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).to.equal('DisplayModeManager');
      expect(status.isReady).to.be.true;
      expect(status.isDisposed).to.be.false;
    });

    it('should maintain existing display mode functionality', () => {
      expect(manager).to.have.property('setDisplayMode');
      expect(manager).to.have.property('toggleSplitMode');
      expect(manager).to.have.property('showTerminalFullscreen');
      expect(manager).to.have.property('getCurrentMode');

      expect(typeof manager.setDisplayMode).to.equal('function');
      expect(typeof manager.getCurrentMode).to.equal('function');
    });

    it('should start in normal mode', async () => {
      await manager.initialize();
      expect(manager.getCurrentMode()).to.equal('normal');
    });

    it('should provide health monitoring', async () => {
      await manager.initialize();
      const health = manager.getHealthStatus();

      expect(health.managerName).to.equal('DisplayModeManager');
      expect(health.isHealthy).to.be.true;
      expect(health.isInitialized).to.be.true;
    });

    it('should dispose properly', async () => {
      await manager.initialize();
      manager.dispose();

      const status = manager.getStatus();
      expect(status.isDisposed).to.be.true;
      expect(status.isReady).to.be.false;
    });
  });

  describe('UIManager - Already BaseManager', () => {
    let manager: UIManager;

    beforeEach(() => {
      manager = new UIManager();
    });

    afterEach(() => {
      if (manager && !manager['isDisposed']) {
        manager.dispose();
      }
    });

    it('should already extend BaseManager', () => {
      expect(manager).to.have.property('initialize');
      expect(manager).to.have.property('dispose');
      expect(manager).to.have.property('getStatus');
    });

    it('should implement IDisposable', () => {
      const disposable: IDisposable = manager;
      expect(disposable).to.have.property('dispose');
    });

    it('should not require coordinator (independent manager)', () => {
      // UIManager doesn't use coordinator, so no constructor injection needed
      expect(manager['coordinator']).to.be.undefined;
      expect(manager).to.not.have.property('setCoordinator');
    });

    it('should initialize successfully', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).to.equal('UIManager');
      expect(status.isReady).to.be.true;
    });

    it('should maintain existing UI functionality', () => {
      expect(manager).to.have.property('updateTerminalBorders');
      expect(manager).to.have.property('applyTheme');
      expect(manager).to.have.property('applyFontSettings');
      expect(manager).to.have.property('showNotification');

      expect(typeof manager.updateTerminalBorders).to.equal('function');
      expect(typeof manager.applyTheme).to.equal('function');
    });

    it('should provide performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics).to.have.property('initializationTimeMs');
      expect(metrics).to.have.property('operationCount');
      expect(metrics.initializationTimeMs).to.be.greaterThan(0);
    });
  });

  describe('Migration Pattern Verification - Phase 4', () => {
    it('should demonstrate late-binding elimination', () => {
      const mockCoordinator = {
        getTerminalContainerManager: () => ({}),
        getManagers: () => ({
          header: { updateSplitButtonState: () => {} },
          tabs: { updateModeIndicator: () => {} },
        }),
        splitManager: { isSplitMode: false, exitSplitMode: () => {} },
      } as any;

      // ❌ Old pattern (eliminated):
      // const manager = new DisplayModeManager();
      // manager.setCoordinator(coordinator);

      // ✅ New pattern (Phase 4):
      const manager = new DisplayModeManager(mockCoordinator);

      expect(manager['coordinator']).to.equal(mockCoordinator);
      expect(manager).to.not.have.property('setCoordinator');

      manager.dispose();
    });

    it('should handle managers with no coordinator dependency', () => {
      // UIManager doesn't need coordinator, so remains simple
      const uiManager = new UIManager();

      expect(uiManager['coordinator']).to.be.undefined;
      expect(uiManager).to.not.have.property('setCoordinator');
      expect(uiManager).to.be.instanceOf(UIManager);

      uiManager.dispose();
    });
  });
});
