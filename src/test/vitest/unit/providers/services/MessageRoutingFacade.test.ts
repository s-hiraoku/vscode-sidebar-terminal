/**
 * MessageRoutingFacade Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRoutingFacade } from '../../../../../providers/services/MessageRoutingFacade';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('MessageRoutingFacade', () => {
  let facade: MessageRoutingFacade;

  beforeEach(() => {
    facade = new MessageRoutingFacade();
  });

  describe('Handler Registration', () => {
    it('should register a single handler', () => {
      const handler = vi.fn();
      facade.registerHandler('test', handler, 'terminal', 'Description');
      
      expect(facade.hasHandler('test')).toBe(true);
      expect(facade.getHandlerCount()).toBe(1);
      expect(facade.getRegisteredCommands()).toContain('test');
    });

    it('should register multiple handlers', () => {
      const handlers = [
        { command: 'cmd1', handler: vi.fn(), category: 'ui' as const },
        { command: 'cmd2', handler: vi.fn(), category: 'settings' as const }
      ];
      
      facade.registerHandlers(handlers);
      
      expect(facade.getHandlerCount()).toBe(2);
      expect(facade.getHandlersByCategory('ui')).toHaveLength(1);
      expect(facade.getHandlersByCategory('settings')).toHaveLength(1);
    });

    it('should ignore empty command registration', () => {
      facade.registerHandler('', vi.fn());
      expect(facade.getHandlerCount()).toBe(0);
    });
  });

  describe('Message Routing', () => {
    it('should handle and dispatch valid message', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      facade.registerHandler('greet', handler);
      
      const message = { command: 'greet', data: 'hello' };
      const result = await facade.handleMessage(message);
      
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should return false for invalid message format', async () => {
      const result = await facade.handleMessage({ something: 'else' });
      expect(result).toBe(false);
    });

    it('should return false if no handler found', async () => {
      const result = await facade.handleMessage({ command: 'unknown' });
      expect(result).toBe(false);
    });

    it('should throw error if handler fails', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler fail'));
      facade.registerHandler('fail', handler);
      
      await expect(facade.handleMessage({ command: 'fail' })).rejects.toThrow('Handler fail');
    });
  });

  describe('Validation and Lifecycle', () => {
    it('should validate required handlers', () => {
      facade.registerHandler('critical', vi.fn());
      
      // Should not throw and log success/failure
      facade.validateHandlers(['critical']);
      facade.validateHandlers(['missing']);
    });

    it('should manage initialization state', () => {
      expect(facade.isInitialized()).toBe(false);
      facade.setInitialized(true);
      expect(facade.isInitialized()).toBe(true);
    });

    it('should clear all handlers', () => {
      facade.registerHandler('test', vi.fn());
      facade.clear();
      
      expect(facade.getHandlerCount()).toBe(0);
      expect(facade.hasHandler('test')).toBe(false);
      expect(facade.isInitialized()).toBe(false);
    });
  });

  describe('Logging', () => {
    it('should log registered handlers without throwing', () => {
      facade.registerHandler('t1', vi.fn(), 'terminal');
      facade.registerHandler('u1', vi.fn()); // Uncategorized
      
      expect(() => facade.logRegisteredHandlers()).not.toThrow();
    });
  });
});
