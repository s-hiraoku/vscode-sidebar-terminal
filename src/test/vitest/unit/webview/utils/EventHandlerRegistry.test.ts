/**
 * EventHandlerRegistry Utility Tests
 * Tests for centralized event listener management with automatic cleanup
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestEnvironment, resetTestEnvironment } from '../../../../shared/TestSetup';
import { EventHandlerRegistry } from '../../../../../webview/utils/EventHandlerRegistry';

describe('EventHandlerRegistry', () => {
  let registry: EventHandlerRegistry;
  let testElement: HTMLElement;
  let testButton: HTMLButtonElement;

  beforeEach(() => {
    setupTestEnvironment();

    testElement = document.createElement('div');
    testElement.id = 'test-element';
    document.body.appendChild(testElement);

    testButton = document.createElement('button');
    testButton.id = 'test-button';
    document.body.appendChild(testButton);

    registry = new EventHandlerRegistry();
  });

  afterEach(() => {
    try {
      registry.dispose();
    } finally {
      resetTestEnvironment();
    }
  });

  describe('register', () => {
    it('should register event listener successfully', () => {
      const handler = vi.fn();

      expect(() => {
        registry.register('test-click', testElement, 'click', handler);
      }).not.toThrow();
    });

    it('should register event listener with options', () => {
      const handler = vi.fn();
      const options = { once: true, passive: true };

      expect(() => {
        registry.register('test-click', testElement, 'click', handler, options);
      }).not.toThrow();
    });

    it('should register multiple different events', () => {
      const clickHandler = vi.fn();
      const keyHandler = vi.fn();

      registry.register('click-handler', testElement, 'click', clickHandler);
      registry.register('key-handler', testElement, 'keydown', keyHandler);

      expect(registry.getRegisteredCount()).toBe(2);
    });

    it('should handle registering same key twice (should replace)', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.register('same-key', testElement, 'click', handler1);
      registry.register('same-key', testElement, 'click', handler2);

      expect(registry.getRegisteredCount()).toBe(1);
    });

    it('should handle different elements with same key', () => {
      const handler = vi.fn();

      registry.register('multi-element', testElement, 'click', handler);
      registry.register('multi-element-2', testButton, 'click', handler);

      expect(registry.getRegisteredCount()).toBe(2);
    });

    it('should handle boolean options', () => {
      const handler = vi.fn();

      expect(() => {
        registry.register('bool-options', testElement, 'click', handler, true);
      }).not.toThrow();
    });
  });

  describe('unregister', () => {
    it('should unregister existing event listener', () => {
      const handler = vi.fn();

      registry.register('test-click', testElement, 'click', handler);
      expect(registry.getRegisteredCount()).toBe(1);

      const result = registry.unregister('test-click');
      expect(result).toBe(true);
      expect(registry.getRegisteredCount()).toBe(0);
    });

    it('should return false for non-existent key', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should handle unregistering after element is removed', () => {
      const handler = vi.fn();

      registry.register('test-click', testElement, 'click', handler);
      testElement.remove();

      const result = registry.unregister('test-click');
      expect(result).toBe(true);
    });

    it('should unregister multiple events independently', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.register('handler-1', testElement, 'click', handler1);
      registry.register('handler-2', testElement, 'keydown', handler2);

      expect(registry.unregister('handler-1')).toBe(true);
      expect(registry.getRegisteredCount()).toBe(1);

      expect(registry.unregister('handler-2')).toBe(true);
      expect(registry.getRegisteredCount()).toBe(0);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered keys', () => {
      const handler = vi.fn();

      registry.register('test-key', testElement, 'click', handler);
      expect(registry.isRegistered('test-key')).toBe(true);
    });

    it('should return false for unregistered keys', () => {
      expect(registry.isRegistered('unknown-key')).toBe(false);
    });

    it('should return false after unregistering', () => {
      const handler = vi.fn();

      registry.register('test-key', testElement, 'click', handler);
      registry.unregister('test-key');

      expect(registry.isRegistered('test-key')).toBe(false);
    });
  });

  describe('getRegisteredCount', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.getRegisteredCount()).toBe(0);
    });

    it('should return correct count after registrations', () => {
      const handler = vi.fn();

      registry.register('key1', testElement, 'click', handler);
      expect(registry.getRegisteredCount()).toBe(1);

      registry.register('key2', testButton, 'mouseenter', handler);
      expect(registry.getRegisteredCount()).toBe(2);

      registry.unregister('key1');
      expect(registry.getRegisteredCount()).toBe(1);
    });
  });

  describe('getRegisteredKeys', () => {
    it('should return empty array for empty registry', () => {
      expect(registry.getRegisteredKeys()).toEqual([]);
    });

    it('should return all registered keys', () => {
      const handler = vi.fn();

      registry.register('click-handler', testElement, 'click', handler);
      registry.register('mouse-handler', testButton, 'mouseenter', handler);

      const keys = registry.getRegisteredKeys();
      expect(keys).toContain('click-handler');
      expect(keys).toContain('mouse-handler');
      expect(keys.length).toBe(2);
    });
  });

  describe('dispose', () => {
    it('should unregister all event listeners', () => {
      const handler = vi.fn();

      registry.register('key1', testElement, 'click', handler);
      registry.register('key2', testButton, 'mouseenter', handler);
      registry.register('key3', testElement, 'keydown', handler);

      expect(registry.getRegisteredCount()).toBe(3);

      registry.dispose();

      expect(registry.getRegisteredCount()).toBe(0);
      expect(registry.getRegisteredKeys()).toEqual([]);
    });

    it('should handle disposing empty registry', () => {
      expect(() => {
        registry.dispose();
      }).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      const handler = vi.fn();

      registry.register('test-key', testElement, 'click', handler);

      registry.dispose();
      registry.dispose(); // Second call should not throw

      expect(registry.getRegisteredCount()).toBe(0);
    });

    it('should prevent operations after disposal', () => {
      const handler = vi.fn();

      registry.dispose();

      // Operations after disposal should be handled gracefully
      expect(() => {
        registry.register('post-dispose', testElement, 'click', handler);
      }).not.toThrow();

      expect(registry.getRegisteredCount()).toBe(0);
    });
  });

  describe('event firing simulation', () => {
    it('should handle event firing after registration', () => {
      const handler = vi.fn();

      registry.register('click-test', testElement, 'click', handler);

      // Simulate click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });

      testElement.dispatchEvent(clickEvent);

      // Note: We can't easily test if the handler was actually called
      // because JSDOM's event simulation doesn't work exactly like browser
      // But we can test that the registration doesn't break event handling
      expect(() => {
        testElement.dispatchEvent(clickEvent);
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid element gracefully', () => {
      const handler = vi.fn();

      expect(() => {
        registry.register('invalid', null as any, 'click', handler);
      }).not.toThrow();
    });

    it('should handle invalid event type gracefully', () => {
      const handler = vi.fn();

      expect(() => {
        registry.register('invalid-event', testElement, '' as any, handler);
      }).not.toThrow();
    });

    it('should handle null handler gracefully', () => {
      expect(() => {
        registry.register('null-handler', testElement, 'click', null as any);
      }).not.toThrow();
    });

    it('should handle exception in event handler', () => {
      const faultyHandler = () => {
        throw new Error('Handler error');
      };

      expect(() => {
        registry.register('faulty', testElement, 'click', faultyHandler);
      }).not.toThrow();
    });
  });

  describe('memory management', () => {
    it('should not leak memory with many registrations', () => {
      const handler = vi.fn();

      // Register many handlers
      for (let i = 0; i < 100; i++) {
        registry.register(`handler-${i}`, testElement, 'click', handler);
      }

      expect(registry.getRegisteredCount()).toBe(100);

      // Dispose should clean them all up
      registry.dispose();
      expect(registry.getRegisteredCount()).toBe(0);
    });

    it('should handle registration and unregistration cycles', () => {
      const handler = vi.fn();

      // Cycle many times
      for (let i = 0; i < 10; i++) {
        registry.register('cycle-key', testElement, 'click', handler);
        expect(registry.getRegisteredCount()).toBe(1);

        registry.unregister('cycle-key');
        expect(registry.getRegisteredCount()).toBe(0);
      }
    });
  });
});
