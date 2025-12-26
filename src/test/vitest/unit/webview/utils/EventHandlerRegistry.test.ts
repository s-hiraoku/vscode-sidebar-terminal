import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { EventHandlerRegistry } from '../../../../../webview/utils/EventHandlerRegistry';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('EventHandlerRegistry', () => {
  let dom: JSDOM;
  let registry: EventHandlerRegistry;
  let element: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="test"></div></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    
    registry = new EventHandlerRegistry();
    element = dom.window.document.getElementById('test')!;
  });

  afterEach(() => {
    registry.dispose();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('Basic Operations', () => {
    it('should register and trigger an event listener', () => {
      const handler = vi.fn();
      registry.register('test-click', element, 'click', handler);
      
      expect(registry.isRegistered('test-click')).toBe(true);
      expect(registry.getRegisteredCount()).toBe(1);

      // Trigger event
      element.dispatchEvent(new dom.window.MouseEvent('click'));
      expect(handler).toHaveBeenCalled();
    });

    it('should unregister a listener', () => {
      const handler = vi.fn();
      registry.register('test-click', element, 'click', handler);
      
      const result = registry.unregister('test-click');
      expect(result).toBe(true);
      expect(registry.isRegistered('test-click')).toBe(false);

      // Trigger event - should not call handler
      element.dispatchEvent(new dom.window.MouseEvent('click'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should overwrite existing listener with same key', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      const removeSpy = vi.spyOn(element, 'removeEventListener');
      const addSpy = vi.spyOn(element, 'addEventListener');

      registry.register('k1', element, 'click', handler1);
      registry.register('k1', element, 'click', handler2);

      expect(removeSpy).toHaveBeenCalled();
      expect(registry.getRegisteredCount()).toBe(1);
      
      element.dispatchEvent(new dom.window.MouseEvent('click'));
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Bulk Operations', () => {
    it('should register multiple listeners', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      
      registry.registerMultiple([
        { key: 'e1', element, type: 'click', listener: h1 },
        { key: 'e2', element, type: 'keydown', listener: h2 }
      ]);

      expect(registry.getRegisteredCount()).toBe(2);
      expect(registry.getRegisteredKeys()).toContain('e1');
      expect(registry.getRegisteredKeys()).toContain('e2');
    });

    it('should unregister by pattern', () => {
      registry.register('ui:btn1', element, 'click', vi.fn());
      registry.register('ui:btn2', element, 'click', vi.fn());
      registry.register('term:data', element, 'click', vi.fn());

      const removed = registry.unregisterByPattern(/^ui:/);
      expect(removed).toBe(2);
      expect(registry.getRegisteredCount()).toBe(1);
      expect(registry.isRegistered('term:data')).toBe(true);
    });
  });

  describe('Scoped Registry', () => {
    it('should prefix keys in scope', () => {
      const scope = registry.createScope('my-comp');
      const handler = vi.fn();
      
      scope.register('btn-click', element, 'click', handler);
      
      expect(registry.isRegistered('my-comp:btn-click')).toBe(true);
      expect(scope.isRegistered('btn-click')).toBe(true);
      expect(scope.getRegisteredKeys()).toEqual(['btn-click']);
      
      scope.unregister('btn-click');
      expect(registry.isRegistered('my-comp:btn-click')).toBe(false);
    });

    it('should unregister all in scope', () => {
      const scope = registry.createScope('s1');
      scope.register('k1', element, 'click', vi.fn());
      scope.register('k2', element, 'click', vi.fn());
      registry.register('other', element, 'click', vi.fn());

      const removed = scope.unregisterAll();
      expect(removed).toBe(2);
      expect(registry.getRegisteredCount()).toBe(1);
    });
  });

  describe('Stats & Info', () => {
    it('should provide accurate stats', () => {
      registry.register('k1', element, 'click', vi.fn());
      registry.register('k2', dom.window as any, 'resize', vi.fn());

      const stats = registry.getStats();
      expect(stats.totalListeners).toBe(2);
      expect(stats.eventTypes).toContain('click');
      expect(stats.eventTypes).toContain('resize');
      expect(stats.elements).toContain('div#test');
      expect(stats.elements).toContain('window');
    });

    it('should return null for non-existent listener info', () => {
      expect(registry.getListenerInfo('ghost')).toBeNull();
    });
  });

  describe('Lifecycle', () => {
    it('should remove all listeners on dispose', () => {
      const h1 = vi.fn();
      const removeSpy = vi.spyOn(element, 'removeEventListener');
      
      registry.register('k1', element, 'click', h1);
      registry.dispose();
      
      expect(removeSpy).toHaveBeenCalled();
      expect(registry.getRegisteredCount()).toBe(0);
    });

    it('should reject registration after dispose', () => {
      registry.dispose();
      registry.register('k1', element, 'click', vi.fn());
      expect(registry.getRegisteredCount()).toBe(0);
    });
  });
});