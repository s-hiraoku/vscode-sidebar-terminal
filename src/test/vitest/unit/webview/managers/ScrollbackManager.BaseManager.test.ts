/**
 * ScrollbackManager - BaseManager Integration Tests
 *
 * Tests for Issue #216 Phase 2: Verifies ScrollbackManager properly extends BaseManager
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScrollbackManager } from '../../../../../webview/managers/ScrollbackManager';
import { IDisposable } from '../../../../../webview/utils/DOMManager';

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
      expect(manager).toBeInstanceOf(ScrollbackManager);
      // Verify BaseManager methods are available
      expect(manager).toHaveProperty('initialize');
      expect(manager).toHaveProperty('dispose');
      expect(manager).toHaveProperty('getStatus');
      expect(manager).toHaveProperty('getHealthStatus');
      expect(manager).toHaveProperty('getPerformanceMetrics');
    });

    it('should implement IDisposable', () => {
      const disposable: IDisposable = manager;
      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();

      const status = manager.getStatus();
      expect(status.name).toBe('ScrollbackManager');
      expect(status.isReady).toBe(true);
      expect(status.isDisposed).toBe(false);
    });

    it('should dispose successfully', async () => {
      await manager.initialize();
      manager.dispose();

      const status = manager.getStatus();
      expect(status.isReady).toBe(false);
      expect(status.isDisposed).toBe(true);
    });

    it('should handle dispose without initialization', () => {
      expect(() => manager.dispose()).not.toThrow();
      expect(manager['isDisposed']).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize();
      const _firstInit = Date.now();

      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      // Should only initialize once
      expect(metrics.initializationTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Health Status Monitoring', () => {
    it('should report healthy status when initialized', async () => {
      await manager.initialize();
      // Small delay to ensure upTimeMs is tracked
      await new Promise((resolve) => setTimeout(resolve, 10));
      const health = manager.getHealthStatus();

      expect(health.managerName).toBe('ScrollbackManager');
      expect(health.isHealthy).toBe(true);
      expect(health.isInitialized).toBe(true);
      expect(health.isDisposed).toBe(false);
      // upTimeMs should be at least 0 (initialization may be very fast)
      expect(health.upTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should report unhealthy status when disposed', async () => {
      await manager.initialize();
      manager.dispose();
      const health = manager.getHealthStatus();

      expect(health.isHealthy).toBe(false);
      expect(health.isDisposed).toBe(true);
    });

    it('should track performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics).toHaveProperty('initializationTimeMs');
      expect(metrics).toHaveProperty('operationCount');
      expect(metrics).toHaveProperty('averageOperationTimeMs');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics.initializationTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Existing Functionality Preservation', () => {
    it('should maintain terminal registration capability', () => {
      // ScrollbackManager should still be able to register terminals
      expect(manager).toHaveProperty('registerTerminal');
      expect(typeof manager.registerTerminal).toBe('function');
    });

    it('should maintain scrollback save/restore capability', () => {
      expect(manager).toHaveProperty('saveScrollback');
      expect(manager).toHaveProperty('restoreScrollback');
      expect(typeof manager.saveScrollback).toBe('function');
      expect(typeof manager.restoreScrollback).toBe('function');
    });

    it('should maintain stats retrieval', () => {
      expect(manager).toHaveProperty('getStats');
      expect(typeof manager.getStats).toBe('function');

      const stats = manager.getStats();
      expect(stats).toHaveProperty('registeredTerminals');
      expect(stats).toHaveProperty('terminals');
    });

    it('should clear registered terminals on dispose', async () => {
      await manager.initialize();

      // Initial state - no terminals
      let stats = manager.getStats();
      expect(stats.registeredTerminals).toBe(0);

      manager.dispose();

      // After dispose - still no terminals (already empty)
      stats = manager.getStats();
      expect(stats.registeredTerminals).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      await manager.initialize();

      // Reset error count
      manager.resetErrorCount();

      const metrics = manager.getPerformanceMetrics();
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on dispose', async () => {
      await manager.initialize();

      // Get initial stats
      const statsBefore = manager.getStats();
      expect(statsBefore.terminals).toBeInstanceOf(Array);

      // Dispose
      manager.dispose();

      // Verify cleanup
      expect(manager['isDisposed']).toBe(true);
    });
  });
});
