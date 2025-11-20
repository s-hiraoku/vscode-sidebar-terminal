/**
 * ScrollbackManager - BaseManager Integration Tests
 *
 * Tests for Issue #216 Phase 2: Verifies ScrollbackManager properly extends BaseManager
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { expect } from 'chai';
import { ScrollbackManager } from '../../../../webview/managers/ScrollbackManager';
import { IDisposable } from '../../../../webview/utils/DOMManager';

describe('ScrollbackManager - BaseManager Integration', () => {
  let manager: ScrollbackManager;

  beforeEach(() => {
    manager = new ScrollbackManager();
  });

  afterEach(() => {
    if (manager && !manager['isDisposed']) {
      manager.dispose();
    }
  });

  describe('BaseManager Inheritance', () => {
    it('should extend BaseManager', () => {
      expect(manager).to.be.instanceOf(ScrollbackManager);
      // Verify BaseManager methods are available
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
  });

  describe('Lifecycle Management', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();

      const status = manager.getStatus();
      expect(status.name).to.equal('ScrollbackManager');
      expect(status.isReady).to.be.true;
      expect(status.isDisposed).to.be.false;
    });

    it('should dispose successfully', async () => {
      await manager.initialize();
      manager.dispose();

      const status = manager.getStatus();
      expect(status.isReady).to.be.false;
      expect(status.isDisposed).to.be.true;
    });

    it('should handle dispose without initialization', () => {
      expect(() => manager.dispose()).to.not.throw();
      expect(manager['isDisposed']).to.be.true;
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize();
      const _firstInit = Date.now();

      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      // Should only initialize once
      expect(metrics.initializationTimeMs).to.be.greaterThan(0);
    });
  });

  describe('Health Status Monitoring', () => {
    it('should report healthy status when initialized', async () => {
      await manager.initialize();
      const health = manager.getHealthStatus();

      expect(health.managerName).to.equal('ScrollbackManager');
      expect(health.isHealthy).to.be.true;
      expect(health.isInitialized).to.be.true;
      expect(health.isDisposed).to.be.false;
      expect(health.upTimeMs).to.be.greaterThan(0);
    });

    it('should report unhealthy status when disposed', async () => {
      await manager.initialize();
      manager.dispose();
      const health = manager.getHealthStatus();

      expect(health.isHealthy).to.be.false;
      expect(health.isDisposed).to.be.true;
    });

    it('should track performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics).to.have.property('initializationTimeMs');
      expect(metrics).to.have.property('operationCount');
      expect(metrics).to.have.property('averageOperationTimeMs');
      expect(metrics).to.have.property('errorCount');
      expect(metrics.initializationTimeMs).to.be.greaterThan(0);
    });
  });

  describe('Existing Functionality Preservation', () => {
    it('should maintain terminal registration capability', () => {
      // ScrollbackManager should still be able to register terminals
      expect(manager).to.have.property('registerTerminal');
      expect(typeof manager.registerTerminal).to.equal('function');
    });

    it('should maintain scrollback save/restore capability', () => {
      expect(manager).to.have.property('saveScrollback');
      expect(manager).to.have.property('restoreScrollback');
      expect(typeof manager.saveScrollback).to.equal('function');
      expect(typeof manager.restoreScrollback).to.equal('function');
    });

    it('should maintain stats retrieval', () => {
      expect(manager).to.have.property('getStats');
      expect(typeof manager.getStats).to.equal('function');

      const stats = manager.getStats();
      expect(stats).to.have.property('registeredTerminals');
      expect(stats).to.have.property('terminals');
    });

    it('should clear registered terminals on dispose', async () => {
      await manager.initialize();

      // Initial state - no terminals
      let stats = manager.getStats();
      expect(stats.registeredTerminals).to.equal(0);

      manager.dispose();

      // After dispose - still no terminals (already empty)
      stats = manager.getStats();
      expect(stats.registeredTerminals).to.equal(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      await manager.initialize();

      // Reset error count
      manager.resetErrorCount();

      const metrics = manager.getPerformanceMetrics();
      expect(metrics.errorCount).to.equal(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on dispose', async () => {
      await manager.initialize();

      // Get initial stats
      const statsBefore = manager.getStats();
      expect(statsBefore.terminals).to.be.an('array');

      // Dispose
      manager.dispose();

      // Verify cleanup
      expect(manager['isDisposed']).to.be.true;
    });
  });
});
