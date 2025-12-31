import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageHandlerRegistry } from '../../../../../../messaging/patterns/core/MessageHandlerRegistry';
import { MessageLogger, LogLevel } from '../../../../../../messaging/patterns/core/MessageLogger';
import { MessageValidator } from '../../../../../../messaging/patterns/core/MessageValidator';
import { IMessageHandler } from '../../../../../../messaging/patterns/core/IMessageHandler';
import { WebviewMessage } from '../../../../../../types/common';

describe('MessageHandlerRegistry', () => {
  let registry: MessageHandlerRegistry;
  let logger: MessageLogger;
  let validator: MessageValidator;

  beforeEach(() => {
    logger = new MessageLogger({ minLevel: LogLevel.NONE }); // Silence logs during test
    validator = new MessageValidator();
    registry = new MessageHandlerRegistry(logger, validator);
  });

  const createHandler = (name: string, commands: string[], priority: number = 50): IMessageHandler => ({
    getName: () => name,
    getPriority: () => priority,
    getSupportedCommands: () => commands,
    canHandle: vi.fn().mockReturnValue(true),
    handle: vi.fn().mockResolvedValue(undefined),
  });

  describe('register/unregister', () => {
    it('should register handlers and update command map', () => {
      const handler = createHandler('TestHandler', ['test']);
      registry.register(handler);

      expect(registry.hasHandler('test')).toBe(true);
      expect(registry.getRegisteredCommands()).toContain('test');
      expect(registry.getHandlersForCommand('test')).toContain(handler);
    });

    it('should unregister handlers and clean up command map', () => {
      const handler = createHandler('TestHandler', ['test']);
      registry.register(handler);
      registry.unregister(handler);

      expect(registry.hasHandler('test')).toBe(false);
      expect(registry.getRegisteredCommands()).not.toContain('test');
    });

    it('should handle multiple handlers for same command sorted by priority', () => {
      const high = createHandler('High', ['test'], 100);
      const low = createHandler('Low', ['test'], 10);
      const mid = createHandler('Mid', ['test'], 50);

      registry.register(low);
      registry.register(high);
      registry.register(mid);

      const handlers = registry.getHandlersForCommand('test');
      expect(handlers).toHaveLength(3);
      expect(handlers[0]).toBe(high);
      expect(handlers[1]).toBe(mid);
      expect(handlers[2]).toBe(low);
    });
  });

  describe('dispatch', () => {
    it('should dispatch to the correct handler', async () => {
      const handler = createHandler('TestHandler', ['test']);
      registry.register(handler);

      const message: WebviewMessage = { command: 'test' };
      const context = {} as any;

      const result = await registry.dispatch(message, context, { validate: false });

      expect(result.success).toBe(true);
      expect(result.handledBy).toBe('TestHandler');
      expect(handler.handle).toHaveBeenCalledWith(message, context);
    });

    it('should fall back to next handler if first declines', async () => {
      const h1 = createHandler('H1', ['test'], 100);
      const h2 = createHandler('H2', ['test'], 50);

      (h1.canHandle as any).mockReturnValue(false);

      registry.register(h1);
      registry.register(h2);

      const result = await registry.dispatch({ command: 'test' }, {} as any, { validate: false });

      expect(result.success).toBe(true);
      expect(result.handledBy).toBe('H2');
      expect(h1.handle).not.toHaveBeenCalled();
      expect(h2.handle).toHaveBeenCalled();
    });

    it('should fall back to next handler if first throws', async () => {
      const h1 = createHandler('H1', ['test'], 100);
      const h2 = createHandler('H2', ['test'], 50);

      (h1.handle as any).mockRejectedValue(new Error('Fail'));

      registry.register(h1);
      registry.register(h2);

      const result = await registry.dispatch({ command: 'test' }, {} as any, { validate: false });

      expect(result.success).toBe(true);
      expect(result.handledBy).toBe('H2');
      expect(h1.handle).toHaveBeenCalled();
      expect(h2.handle).toHaveBeenCalled();
    });

    it('should fail if no handler found', async () => {
      const result = await registry.dispatch({ command: 'unknown' }, {} as any, { validate: false });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler found');
    });

    it('should fail if all handlers decline/fail', async () => {
      const h1 = createHandler('H1', ['test']);
      (h1.canHandle as any).mockReturnValue(false);
      registry.register(h1);

      const result = await registry.dispatch({ command: 'test' }, {} as any, { validate: false });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No suitable handler found');
    });

    it('should validate message if enabled', async () => {
      const handler = createHandler('TestHandler', ['test']);
      registry.register(handler);
      
      const spy = vi.spyOn(validator, 'validate');
      
      await registry.dispatch({ command: 'test' }, {} as any, { validate: true });
      expect(spy).toHaveBeenCalled();
    });

    it('should fail if validation fails', async () => {
      const handler = createHandler('TestHandler', ['test']);
      registry.register(handler);
      
      vi.spyOn(validator, 'validate').mockImplementation(() => {
        throw new Error('Validation Error');
      });

      const result = await registry.dispatch({ command: 'test' }, {} as any, { validate: true });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(handler.handle).not.toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should track statistics', async () => {
      const handler = createHandler('TestHandler', ['test']);
      registry.register(handler);

      await registry.dispatch({ command: 'test' }, {} as any, { validate: false });
      
      const stats = registry.getStats();
      expect(stats.commandsHandled).toBe(1);
      expect(stats.totalHandlers).toBe(1);
      expect(stats.totalCommands).toBe(1);
    });
  });

  describe('clear/dispose', () => {
    it('should clear all handlers', () => {
      const handler = createHandler('TestHandler', ['test']);
      registry.register(handler);
      registry.clear();

      expect(registry.getStats().totalHandlers).toBe(0);
      expect(registry.hasHandler('test')).toBe(false);
    });
  });
});
