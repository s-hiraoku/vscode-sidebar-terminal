/**
 * Phase 3 Manager Migrations - Integration Tests
 *
 * Tests for Issue #216 Phase 3: Verifies SimplePersistenceManager and TerminalEventManager
 * properly extend BaseManager with constructor injection pattern.
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { expect } from 'chai';
import { SimplePersistenceManager } from '../../../../webview/managers/SimplePersistenceManager';
import { TerminalEventManager } from '../../../../webview/managers/TerminalEventManager';
import { IDisposable } from '../../../../webview/utils/DOMManager';

describe('Phase 3 Manager Migrations', () => {
  describe('SimplePersistenceManager', () => {
    let manager: SimplePersistenceManager;
    const mockVscodeApi = {
      getState: () => ({}),
      setState: (_state: any) => {},
      postMessage: (_message: any) => {},
    };

    beforeEach(() => {
      manager = new SimplePersistenceManager(mockVscodeApi);
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

    it('should initialize successfully', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).to.equal('SimplePersistenceManager');
      expect(status.isReady).to.be.true;
      expect(status.isDisposed).to.be.false;
    });

    it('should maintain existing functionality', async () => {
      await manager.initialize();

      // Test session operations
      expect(manager).to.have.property('saveSession');
      expect(manager).to.have.property('loadSession');
      expect(manager).to.have.property('clearSession');

      expect(typeof manager.saveSession).to.equal('function');
      expect(typeof manager.loadSession).to.equal('function');
      expect(typeof manager.clearSession).to.equal('function');
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

      expect(health.managerName).to.equal('SimplePersistenceManager');
      expect(health.isHealthy).to.be.true;
      expect(health.performanceMetrics).to.exist;
    });
  });

  describe('TerminalEventManager', () => {
    let manager: TerminalEventManager;
    const mockCoordinator = {
      setActiveTerminalId: (_id: string) => {},
      deleteTerminalSafely: async (_id: string) => {},
      handleAiAgentToggle: (_id: string) => {},
    } as any;

    const mockEventRegistry = {
      register: (_id: string, _element: HTMLElement, _event: string, _handler: EventListener) => {},
    } as any;

    beforeEach(() => {
      manager = new TerminalEventManager(mockCoordinator, mockEventRegistry);
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
      // Verify dependencies are provided via constructor (not setCoordinator)
      expect(manager['coordinator']).to.equal(mockCoordinator);
      expect(manager['eventRegistry']).to.equal(mockEventRegistry);
    });

    it('should initialize successfully', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).to.equal('TerminalEventManager');
      expect(status.isReady).to.be.true;
    });

    it('should maintain existing event management functionality', () => {
      expect(manager).to.have.property('setupTerminalEvents');
      expect(manager).to.have.property('focusTerminal');
      expect(manager).to.have.property('blurTerminal');
      expect(manager).to.have.property('createContainerCallbacks');

      expect(typeof manager.setupTerminalEvents).to.equal('function');
      expect(typeof manager.focusTerminal).to.equal('function');
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
      const mockEventRegistry = {} as any;
      const mockVscodeApi = {
        getState: () => ({}),
        setState: () => {},
        postMessage: () => {},
      };

      // ✅ Good: Constructor injection
      const eventManager = new TerminalEventManager(mockCoordinator, mockEventRegistry);
      const persistenceManager = new SimplePersistenceManager(mockVscodeApi);

      // Verify no setCoordinator method exists (late-binding eliminated)
      expect(eventManager).to.not.have.property('setCoordinator');
      expect(persistenceManager).to.not.have.property('setCoordinator');

      eventManager.dispose();
      persistenceManager.dispose();
    });

    it('should enforce BaseManager lifecycle', async () => {
      const mockVscodeApi = {
        getState: () => ({}),
        setState: () => {},
        postMessage: () => {},
      };

      const manager = new SimplePersistenceManager(mockVscodeApi);

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
  });
});
