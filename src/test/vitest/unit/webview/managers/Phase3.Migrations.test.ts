/**
 * Phase 3 Manager Migrations - Integration Tests
 *
 * Tests for Issue #216 Phase 3: Verifies TerminalEventManager
 * properly extends BaseManager with constructor injection pattern.
 *
 * Note: SimplePersistenceManager was removed in Issue #215 persistence consolidation,
 * replaced by WebViewPersistenceService.
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalEventManager } from '../../../../../webview/managers/TerminalEventManager';
import { IDisposable } from '../../../../../webview/utils/DOMManager';

describe('Phase 3 Manager Migrations', () => {
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
      expect(manager).toHaveProperty('initialize');
      expect(manager).toHaveProperty('dispose');
      expect(manager).toHaveProperty('getStatus');
    });

    it('should implement IDisposable', () => {
      const disposable: IDisposable = manager;
      expect(disposable).toHaveProperty('dispose');
    });

    it('should use constructor injection', () => {
      // Verify dependencies are provided via constructor (not setCoordinator)
      expect(manager['coordinator']).toBe(mockCoordinator);
      expect(manager['eventRegistry']).toBe(mockEventRegistry);
    });

    it('should initialize successfully', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).toBe('TerminalEventManager');
      expect(status.isReady).toBe(true);
    });

    it('should maintain existing event management functionality', () => {
      expect(manager).toHaveProperty('setupTerminalEvents');
      expect(manager).toHaveProperty('focusTerminal');
      expect(manager).toHaveProperty('blurTerminal');
      expect(manager).toHaveProperty('createContainerCallbacks');

      expect(typeof manager.setupTerminalEvents).toBe('function');
      expect(typeof manager.focusTerminal).toBe('function');
    });

    it('should dispose properly', async () => {
      await manager.initialize();
      manager.dispose();

      const status = manager.getStatus();
      expect(status.isDisposed).toBe(true);
    });

    it('should provide performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics).toHaveProperty('initializationTimeMs');
      expect(metrics).toHaveProperty('operationCount');
      expect(metrics.initializationTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Migration Pattern Verification', () => {
    it('should follow constructor injection pattern (not late-binding)', () => {
      const mockCoordinator = {} as any;
      const mockEventRegistry = {} as any;

      // ✅ Good: Constructor injection
      const eventManager = new TerminalEventManager(mockCoordinator, mockEventRegistry);

      // Verify no setCoordinator method exists (late-binding eliminated)
      expect(eventManager).not.toHaveProperty('setCoordinator');

      eventManager.dispose();
    });

    it('should enforce BaseManager lifecycle', async () => {
      const mockCoordinator = {} as any;
      const mockEventRegistry = {} as any;

      const manager = new TerminalEventManager(mockCoordinator, mockEventRegistry);

      // Before initialization
      let status = manager.getStatus();
      expect(status.isReady).toBe(false);

      // After initialization
      await manager.initialize();
      status = manager.getStatus();
      expect(status.isReady).toBe(true);

      // After disposal
      manager.dispose();
      status = manager.getStatus();
      expect(status.isDisposed).toBe(true);
    });

    it('should support multiple manager instances with different dependencies', () => {
      const coordinator1 = { id: 'coord1' } as any;
      const coordinator2 = { id: 'coord2' } as any;
      const registry1 = { id: 'reg1' } as any;
      const registry2 = { id: 'reg2' } as any;

      const manager1 = new TerminalEventManager(coordinator1, registry1);
      const manager2 = new TerminalEventManager(coordinator2, registry2);

      expect(manager1['coordinator']).toBe(coordinator1);
      expect(manager2['coordinator']).toBe(coordinator2);
      expect(manager1['coordinator']).not.toBe(manager2['coordinator']);

      manager1.dispose();
      manager2.dispose();
    });
  });

  describe('Phase 3 Summary', () => {
    it('should verify Phase 3 migration pattern', () => {
      const mockCoordinator = {} as any;
      const mockEventRegistry = {} as any;

      // Phase 3: Constructor injection managers
      const eventManager = new TerminalEventManager(mockCoordinator, mockEventRegistry);

      // Should extend BaseManager
      expect(eventManager).toHaveProperty('initialize');
      expect(eventManager).toHaveProperty('dispose');
      expect(eventManager).toHaveProperty('getStatus');
      expect(eventManager).toHaveProperty('getHealthStatus');
      expect(eventManager).toHaveProperty('getPerformanceMetrics');

      // Should use constructor injection (no setCoordinator)
      expect(eventManager).not.toHaveProperty('setCoordinator');

      eventManager.dispose();
    });
  });
});
