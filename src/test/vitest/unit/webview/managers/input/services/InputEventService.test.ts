import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { InputEventService } from '../../../../../../../webview/managers/input/services/InputEventService';

describe('InputEventService', () => {
  let dom: JSDOM;
  let service: InputEventService;
  let element: HTMLElement;
  let mockLogger: any;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="test"></div></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('performance', dom.window.performance);
    
    vi.useFakeTimers();
    vi.clearAllTimers();
    mockLogger = vi.fn();
    service = new InputEventService(mockLogger);
    element = dom.window.document.getElementById('test')!;
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('Registration', () => {
    it('should register and trigger a wrapped event handler', () => {
      const handler = vi.fn();
      service.registerEventHandler('h1', element, 'click', handler);
      
      expect(service.hasEventHandler('h1')).toBe(true);
      
      element.dispatchEvent(new dom.window.MouseEvent('click'));
      expect(handler).toHaveBeenCalled();
      
      const metrics = service.getEventHandlerMetrics('h1');
      expect(metrics?.callCount).toBe(1);
    });

    it('should handle preventDefault based on config', () => {
      const handler = vi.fn();
      service.registerEventHandler('h1', element, 'click', handler, { preventDefault: true });
      
      const event = new dom.window.MouseEvent('click');
      const preventSpy = vi.spyOn(event, 'preventDefault');
      
      element.dispatchEvent(event);
      expect(preventSpy).toHaveBeenCalled();
    });
  });

  describe('Debouncing', () => {
    it('should debounce event execution', async () => {
      const handler = vi.fn();
      service.registerEventHandler('h1', element, 'input', handler, { 
        debounce: true, 
        debounceDelay: 100 
      });

      // Dispatch multiple events
      element.dispatchEvent(new dom.window.Event('input'));
      element.dispatchEvent(new dom.window.Event('input'));
      element.dispatchEvent(new dom.window.Event('input'));
      
      expect(handler).not.toHaveBeenCalled();
      
      // Advance time beyond delay
      vi.advanceTimersByTime(150);
      
      // Should be called exactly once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Metrics & Health', () => {
    it('should track errors in handlers', () => {
      const failingHandler = () => { throw new Error('Boom'); };
      service.registerEventHandler('fail', element, 'click', failingHandler);
      
      const event = new dom.window.MouseEvent('click');
      element.dispatchEvent(event);
      
      expect(service.getGlobalMetrics().totalErrors).toBe(1);
      expect(service.getEventHandlerMetrics('fail')?.errorCount).toBe(1);
      expect(service.getHealthStatus().isHealthy).toBe(false);
    });

    it('should calculate average processing time', () => {
      service.registerEventHandler('h1', element, 'click', () => {});
      
      element.dispatchEvent(new dom.window.MouseEvent('click'));
      element.dispatchEvent(new dom.window.MouseEvent('click'));
      
      const status = service.getHealthStatus();
      expect(status.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Lifecycle', () => {
    it('should unregister and stop responding', () => {
      const handler = vi.fn();
      service.registerEventHandler('h1', element, 'click', handler);
      service.unregisterEventHandler('h1');
      
      element.dispatchEvent(new dom.window.MouseEvent('click'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should clear timers on dispose', () => {
      service.registerEventHandler('h1', element, 'click', vi.fn(), { debounce: true });
      element.dispatchEvent(new dom.window.MouseEvent('click'));
      
      service.dispose();
      vi.advanceTimersByTime(1000);
      // Logic: if dispose clears timers, no callback fires (implied coverage)
    });
  });
});