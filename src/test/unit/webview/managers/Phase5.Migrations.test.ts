/**
 * Phase 5 Manager Migrations - Integration Tests
 *
 * Tests for Issue #216 Phase 5: Verifies TerminalContainerManager and TerminalLinkManager
 * properly extend BaseManager with constructor injection pattern.
 *
 * Phase 5 Focus:
 * - Terminal Managers migration
 * - Constructor injection (eliminating late-binding setCoordinator pattern)
 * - BaseManager lifecycle enforcement
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { expect } from 'chai';
import { TerminalContainerManager } from '../../../../webview/managers/TerminalContainerManager';
import { TerminalLinkManager } from '../../../../webview/managers/TerminalLinkManager';
import { IDisposable } from '../../../../webview/utils/DOMManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';

describe('Phase 5 Manager Migrations', () => {
  describe('TerminalContainerManager', () => {
    let manager: TerminalContainerManager;
    const mockCoordinator: IManagerCoordinator = {
      setActiveTerminalId: (_id: string) => {},
      deleteTerminalSafely: async (_id: string) => {},
      getManagers: () => ({} as any),
    } as any;

    beforeEach(() => {
      // Issue #216: Constructor injection pattern (not late-binding)
      manager = new TerminalContainerManager(mockCoordinator);
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
      expect(manager).to.have.property('getPerformanceMetrics');
    });

    it('should implement IDisposable', () => {
      const disposable: IDisposable = manager;
      expect(disposable).to.have.property('dispose');
      expect(typeof disposable.dispose).to.equal('function');
    });

    it('should use constructor injection (not late-binding)', () => {
      // ✅ Good: Constructor injection (no setCoordinator method)
      expect(manager).to.not.have.property('setCoordinator');

      // Verify coordinator was set via constructor
      expect(manager['coordinator']).to.equal(mockCoordinator);
    });

    it('should initialize successfully', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).to.equal('TerminalContainerManager');
      expect(status.isReady).to.be.true;
      expect(status.isDisposed).to.be.false;
    });

    it('should maintain existing container management functionality', () => {
      expect(manager).to.have.property('registerContainer');
      expect(manager).to.have.property('unregisterContainer');
      expect(manager).to.have.property('getContainer');
      expect(manager).to.have.property('showContainer');
      expect(manager).to.have.property('hideContainer');

      expect(typeof manager.registerContainer).to.equal('function');
      expect(typeof manager.unregisterContainer).to.equal('function');
    });

    it('should dispose gracefully', async () => {
      await manager.initialize();
      manager.dispose();

      const status = manager.getStatus();
      expect(status.isDisposed).to.be.true;
      expect(status.isReady).to.be.false;
    });

    it('should provide health monitoring', async () => {
      await manager.initialize();
      const health = manager.getHealthStatus();

      expect(health.managerName).to.equal('TerminalContainerManager');
      expect(health.isHealthy).to.be.true;
      expect(health.performanceMetrics).to.exist;
    });

    it('should provide performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics).to.have.property('initializationTimeMs');
      expect(metrics).to.have.property('operationCount');
      expect(metrics.initializationTimeMs).to.be.greaterThan(0);
    });
  });

  describe('TerminalLinkManager', () => {
    let manager: TerminalLinkManager;
    const mockCoordinator: IManagerCoordinator = {
      setActiveTerminalId: (_id: string) => {},
      getManagers: () => ({} as any),
    } as any;

    beforeEach(() => {
      // Issue #216: Constructor injection pattern
      manager = new TerminalLinkManager(mockCoordinator);
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
    });

    it('should implement IDisposable', () => {
      const disposable: IDisposable = manager;
      expect(disposable).to.have.property('dispose');
    });

    it('should use constructor injection', () => {
      // Verify no late-binding setCoordinator method
      expect(manager).to.not.have.property('setCoordinator');

      // Verify coordinator was set via constructor
      expect(manager['coordinator']).to.equal(mockCoordinator);
    });

    it('should initialize successfully', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).to.equal('TerminalLinkManager');
      expect(status.isReady).to.be.true;
    });

    it('should maintain existing link management functionality', () => {
      expect(manager).to.have.property('registerTerminalLinkHandlers');
      expect(manager).to.have.property('unregisterTerminalLinks');
      expect(manager).to.have.property('getRegisteredTerminals');

      expect(typeof manager.registerTerminalLinkHandlers).to.equal('function');
      expect(typeof manager.unregisterTerminalLinks).to.equal('function');
    });

    it('should dispose properly', async () => {
      await manager.initialize();
      manager.dispose();

      const status = manager.getStatus();
      expect(status.isDisposed).to.be.true;
    });

    it('should provide performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics).to.have.property('initializationTimeMs');
      expect(metrics).to.have.property('operationCount');
      expect(metrics.initializationTimeMs).to.be.greaterThan(0);
    });
  });

  describe('Migration Pattern Verification', () => {
    it('should follow constructor injection pattern (not late-binding)', () => {
      const mockCoordinator = {} as any;

      // ✅ Good: Constructor injection (single-step initialization)
      const containerManager = new TerminalContainerManager(mockCoordinator);
      const linkManager = new TerminalLinkManager(mockCoordinator);

      // Verify no setCoordinator method exists (late-binding eliminated)
      expect(containerManager).to.not.have.property('setCoordinator');
      expect(linkManager).to.not.have.property('setCoordinator');

      containerManager.dispose();
      linkManager.dispose();
    });

    it('should enforce BaseManager lifecycle', async () => {
      const mockCoordinator = {} as any;
      const manager = new TerminalContainerManager(mockCoordinator);

      // Before initialization
      let status = manager.getStatus();
      expect(status.isReady).to.be.false;

      // After initialization
      await manager.initialize();
      status = manager.getStatus();
      expect(status.isReady).to.be.true;

      // After disposal
      manager.dispose();
      status = manager.getStatus();
      expect(status.isDisposed).to.be.true;
    });

    it('should support multiple manager instances with different coordinators', () => {
      const coordinator1 = { id: 'coord1' } as any;
      const coordinator2 = { id: 'coord2' } as any;

      const manager1 = new TerminalContainerManager(coordinator1);
      const manager2 = new TerminalContainerManager(coordinator2);

      expect(manager1['coordinator']).to.equal(coordinator1);
      expect(manager2['coordinator']).to.equal(coordinator2);
      expect(manager1['coordinator']).to.not.equal(manager2['coordinator']);

      manager1.dispose();
      manager2.dispose();
    });
  });

  describe('Phase 5 Summary', () => {
    it('should verify all Phase 5 managers are migrated', () => {
      const mockCoordinator = {} as any;

      // Phase 5 managers: Terminal Managers
      const containerManager = new TerminalContainerManager(mockCoordinator);
      const linkManager = new TerminalLinkManager(mockCoordinator);

      // All should extend BaseManager (have these methods)
      [containerManager, linkManager].forEach((manager) => {
        expect(manager).to.have.property('initialize');
        expect(manager).to.have.property('dispose');
        expect(manager).to.have.property('getStatus');
        expect(manager).to.have.property('getHealthStatus');
        expect(manager).to.have.property('getPerformanceMetrics');
      });

      // All should use constructor injection (no setCoordinator)
      [containerManager, linkManager].forEach((manager) => {
        expect(manager).to.not.have.property('setCoordinator');
      });

      // Cleanup
      containerManager.dispose();
      linkManager.dispose();
    });
  });
});
