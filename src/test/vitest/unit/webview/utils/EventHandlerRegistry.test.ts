
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { EventHandlerRegistry } from '../../../../../webview/utils/EventHandlerRegistry';

describe('EventHandlerRegistry', () => {
  let dom: JSDOM;
  let registry: EventHandlerRegistry;
  let mockElement: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Element', dom.window.Element);

    registry = new EventHandlerRegistry();
    mockElement = document.createElement('div');
    mockElement.id = 'test-id';
    mockElement.className = 'test-class';
    
    vi.spyOn(mockElement, 'addEventListener');
    vi.spyOn(mockElement, 'removeEventListener');
  });

  afterEach(() => {
    registry.dispose();
    vi.restoreAllMocks();
    dom.window.close();
    vi.unstubAllGlobals();
  });


  describe('register', () => {
    it('should add event listener and track it', () => {
      const listener = vi.fn();
      registry.register('key1', mockElement, 'click', listener);
      
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', listener, undefined);
      expect(registry.isRegistered('key1')).toBe(true);
      expect(registry.getRegisteredCount()).toBe(1);
    });

    it('should unregister existing listener with same key before registering new one', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      registry.register('key1', mockElement, 'click', listener1);
      registry.register('key1', mockElement, 'click', listener2);
      
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('click', listener1, undefined);
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', listener2, undefined);
      expect(registry.getRegisteredCount()).toBe(1);
    });

    it('should not register if disposed', () => {
      registry.dispose();
      const listener = vi.fn();
      registry.register('key1', mockElement, 'click', listener);
      
      expect(mockElement.addEventListener).not.toHaveBeenCalled();
      expect(registry.isRegistered('key1')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should remove event listener and stop tracking', () => {
      const listener = vi.fn();
      registry.register('key1', mockElement, 'click', listener);
      
      const result = registry.unregister('key1');
      
      expect(result).toBe(true);
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('click', listener, undefined);
      expect(registry.isRegistered('key1')).toBe(false);
    });

    it('should return false if key not found', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('unregisterByPattern', () => {
    it('should remove all matching listeners', () => {
      registry.register('prefix:key1', mockElement, 'click', vi.fn());
      registry.register('prefix:key2', mockElement, 'click', vi.fn());
      registry.register('other:key1', mockElement, 'click', vi.fn());
      
      const removed = registry.unregisterByPattern(/^prefix:/);
      
      expect(removed).toBe(2);
      expect(registry.getRegisteredCount()).toBe(1);
      expect(registry.isRegistered('other:key1')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      registry.register('key1', mockElement, 'click', vi.fn());
      registry.register('key2', mockElement, 'keydown', vi.fn());
      
      const stats = registry.getStats();
      expect(stats.totalListeners).toBe(2);
      expect(stats.eventTypes).toContain('click');
      expect(stats.eventTypes).toContain('keydown');
      expect(stats.elements).toContain('div#test-id.test-class');
    });
  });

  describe('createScope', () => {
    it('should create a scoped registry that prefixes keys', () => {
      const scope = registry.createScope('my-scope');
      const listener = vi.fn();
      
      scope.register('key1', mockElement, 'click', listener);
      
      expect(registry.isRegistered('my-scope:key1')).toBe(true);
      expect(scope.isRegistered('key1')).toBe(true);
      
      scope.unregister('key1');
      expect(registry.isRegistered('my-scope:key1')).toBe(false);
    });

    it('should allow unregistering all scoped listeners', () => {
      const scope = registry.createScope('my-scope');
      scope.register('key1', mockElement, 'click', vi.fn());
      scope.register('key2', mockElement, 'click', vi.fn());
      registry.register('other:key', mockElement, 'click', vi.fn());
      
      const removed = scope.unregisterAll();
      expect(removed).toBe(2);
      expect(registry.getRegisteredCount()).toBe(1);
    });
  });

  describe('dispose', () => {
    it('should unregister all listeners', () => {
      registry.register('key1', mockElement, 'click', vi.fn());
      registry.register('key2', mockElement, 'click', vi.fn());
      
      registry.dispose();
      
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(2);
      expect(registry.getRegisteredCount()).toBe(0);
    });
  });
});