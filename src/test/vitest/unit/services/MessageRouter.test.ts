
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageRouter, MessageRouterFactory } from '../../../../services/MessageRouter';

describe('MessageRouter', () => {
  let router: MessageRouter;
  
  beforeEach(() => {
    vi.useFakeTimers();
    // Default config
    router = MessageRouterFactory.create({
      enableLogging: false,
      enableValidation: true,
      timeoutMs: 1000,
      maxConcurrentHandlers: 5
    });
  });

  afterEach(() => {
    router.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Handler Registration', () => {
    it('should register a handler', () => {
      const handler = { handle: vi.fn() };
      router.registerHandler('test', handler);
      expect(router.hasHandler('test')).toBe(true);
    });

    it('should throw when registering duplicate handler', () => {
      const handler = { handle: vi.fn() };
      router.registerHandler('test', handler);
      expect(() => router.registerHandler('test', handler)).toThrow(/already registered/);
    });

    it('should unregister a handler', () => {
      const handler = { handle: vi.fn() };
      router.registerHandler('test', handler);
      expect(router.unregisterHandler('test')).toBe(true);
      expect(router.hasHandler('test')).toBe(false);
    });

    it('should return false when unregistering non-existent handler', () => {
      expect(router.unregisterHandler('non-existent')).toBe(false);
    });

    it('should list registered commands', () => {
      router.registerHandler('cmd1', { handle: vi.fn() });
      router.registerHandler('cmd2', { handle: vi.fn() });
      expect(router.getRegisteredCommands()).toEqual(expect.arrayContaining(['cmd1', 'cmd2']));
    });

    it('should clear all handlers', () => {
      router.registerHandler('cmd1', { handle: vi.fn() });
      router.registerHandler('cmd2', { handle: vi.fn() });
      router.clearHandlers();
      expect(router.getRegisteredCommands()).toHaveLength(0);
    });
  });

  describe('Message Routing', () => {
    it('should route message to handler', async () => {
      const handler = { handle: vi.fn().mockReturnValue('result') };
      router.registerHandler('test', handler);

      const result = await router.routeMessage('test', { key: 'value' });

      expect(result.success).toBe(true);
      expect(result.data).toBe('result');
      expect(handler.handle).toHaveBeenCalledWith({ key: 'value' });
    });

    it('should return error when no handler registered', async () => {
      const result = await router.routeMessage('unknown');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
    });

    it('should return error when handler fails', async () => {
      const handler = { 
        handle: vi.fn().mockRejectedValue(new Error('Handler failed')) 
      };
      router.registerHandler('test', handler);

      const result = await router.routeMessage('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler failed');
    });

    it('should handle timeout', async () => {
      const handler = { 
        handle: () => new Promise(resolve => setTimeout(resolve, 2000)) 
      };
      router.registerHandler('slow', handler as any);

      const promise = router.routeMessage('slow');
      
      vi.advanceTimersByTime(1100); // Exceeds 1000ms timeout
      
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Concurrency & State', () => {
    it('should enforce concurrency limit', async () => {
      // Create a router with limit 1
      const limitedRouter = MessageRouterFactory.create({
        maxConcurrentHandlers: 1,
        timeoutMs: 1000
      });

      const slowHandler = {
        handle: () => new Promise(resolve => setTimeout(resolve, 100))
      };
      limitedRouter.registerHandler('slow', slowHandler as any);

      // Start one request
      const p1 = limitedRouter.routeMessage('slow');
      
      // Start second request immediately (should fail)
      const result2 = await limitedRouter.routeMessage('slow');
      
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Maximum concurrent handlers reached');

      vi.advanceTimersByTime(100);
      await p1;
    });

    it('should track active handler count', async () => {
      const handler = {
        handle: () => new Promise(resolve => setTimeout(resolve, 100))
      };
      router.registerHandler('test', handler as any);

      const p1 = router.routeMessage('test');
      expect(router.getActiveHandlerCount()).toBe(1);

      vi.advanceTimersByTime(100);
      await p1;
      expect(router.getActiveHandlerCount()).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate terminal input', async () => {
      const handler = { handle: vi.fn() };
      router.registerHandler('terminalInput', handler);

      // Invalid data
      const result1 = await router.routeMessage('terminalInput', {});
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Invalid data');

      // Valid data
      const result2 = await router.routeMessage('terminalInput', { terminalId: 't1', input: 'ls' });
      expect(result2.success).toBe(true);
    });
  });

  describe('Disposal', () => {
    it('should reject requests after disposal', async () => {
      router.dispose();
      const result = await router.routeMessage('test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('disposed');
    });

    it('should clear handlers on disposal', () => {
      router.registerHandler('test', { handle: vi.fn() });
      router.dispose();
      expect(router.hasHandler('test')).toBe(false);
    });
  });
});
