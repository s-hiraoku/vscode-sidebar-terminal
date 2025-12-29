/**
 * ResourceCleanupService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceCleanupService } from '../../../../../providers/services/ResourceCleanupService';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('ResourceCleanupService', () => {
  let service: ResourceCleanupService;

  beforeEach(() => {
    service = new ResourceCleanupService();
  });

  describe('Disposable Tracking', () => {
    it('should track disposables', () => {
      const mockDisposable = { dispose: vi.fn() };
      service.addDisposable(mockDisposable);
      
      expect(service.getDisposableCount()).toBe(1);
    });

    it('should add multiple disposables', () => {
      const d1 = { dispose: vi.fn() };
      const d2 = { dispose: vi.fn() };
      service.addDisposables(d1, d2);
      
      expect(service.getDisposableCount()).toBe(2);
    });

    it('should dispose added resource immediately if service is already disposed', () => {
      service.dispose();
      const mockDisposable = { dispose: vi.fn() };
      
      service.addDisposable(mockDisposable);
      
      expect(mockDisposable.dispose).toHaveBeenCalled();
      expect(service.getDisposableCount()).toBe(0);
    });
  });

  describe('Cleanup Callbacks', () => {
    it('should execute callbacks in LIFO order', async () => {
      const executionOrder: number[] = [];
      service.registerCleanupCallback(() => { executionOrder.push(1); });
      service.registerCleanupCallback(() => { executionOrder.push(2); });
      
      service.dispose();
      
      expect(executionOrder).toEqual([2, 1]);
    });

    it('should handle async callbacks', async () => {
      let executed = false;
      service.registerCleanupCallback(async () => {
        executed = true;
      });
      
      service.dispose();
      expect(executed).toBe(true);
    });

    it('should handle errors in callbacks gracefully', () => {
      service.registerCleanupCallback(() => { throw new Error('Fail'); });
      const secondCallback = vi.fn();
      service.registerCleanupCallback(secondCallback);
      
      expect(() => service.dispose()).not.toThrow();
      expect(secondCallback).toHaveBeenCalled();
    });
  });

  describe('Dispose', () => {
    it('should dispose all tracked resources', () => {
      const d1 = { dispose: vi.fn() };
      const d2 = { dispose: vi.fn() };
      service.addDisposables(d1, d2);
      
      service.dispose();
      
      expect(d1.dispose).toHaveBeenCalled();
      expect(d2.dispose).toHaveBeenCalled();
      expect(service.isDisposed()).toBe(true);
      expect(service.getDisposableCount()).toBe(0);
    });

    it('should skip if already disposed', () => {
      service.dispose();
      
      // Should not log disposal messages again (implicitly tested by logic)
      service.dispose(); 
      expect(service.isDisposed()).toBe(true);
    });
  });

  describe('WebView Messages', () => {
    it('should create cleanup message', () => {
      const msg = service.createWebViewCleanupMessage();
      expect(msg.command).toBe('saveAllTerminalSessions');
      expect(msg.timestamp).toBeDefined();
    });
  });
});
