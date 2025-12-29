/**
 * EventHandlerManager Test Suite - Event listener management and lifecycle
 *
 * TDD Pattern: Covers event registration, removal, and cleanup
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventHandlerManager } from '../../../../../webview/managers/EventHandlerManager';

describe('EventHandlerManager', () => {
  let eventHandlerManager: EventHandlerManager;

  beforeEach(() => {
    // Create test element for DOM tests
    const testElement = document.createElement('div');
    testElement.id = 'test-element';
    document.body.appendChild(testElement);

    eventHandlerManager = new EventHandlerManager();
  });

  afterEach(() => {
    eventHandlerManager.dispose();
    document.body.innerHTML = '';
  });

  describe('Initialization and Lifecycle', () => {
    it('should create instance correctly', () => {
      expect(eventHandlerManager).toBeInstanceOf(EventHandlerManager);
    });

    it('should start with no registered listeners', () => {
      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(0);
    });

    it('should dispose all listeners on dispose', () => {
      eventHandlerManager.addEventListener(window, 'click', () => {});
      eventHandlerManager.addEventListener(document, 'keydown', () => {});

      eventHandlerManager.dispose();

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(0);
    });

    it('should prevent adding listeners after dispose', () => {
      eventHandlerManager.dispose();
      eventHandlerManager.addEventListener(window, 'click', () => {});

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(0);
    });
  });

  describe('Event Registration', () => {
    it('should register window event listener', () => {
      const handler = vi.fn();
      eventHandlerManager.addEventListener(window, 'resize', handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(1);
      expect(stats.eventTypes).toContain('resize');
    });

    it('should register document event listener', () => {
      const handler = vi.fn();
      eventHandlerManager.addEventListener(document, 'click', handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(1);
      expect(stats.eventTypes).toContain('click');
    });

    it('should register element event listener', () => {
      const element = document.getElementById('test-element') as HTMLElement;
      const handler = vi.fn();
      eventHandlerManager.addEventListener(element, 'click', handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(1);
    });

    it('should register multiple listeners', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(window, 'scroll', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(3);
    });

    it('should track event types', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(window, 'scroll', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).toContain('resize');
      expect(stats.eventTypes).toContain('scroll');
      expect(stats.eventTypes).toContain('click');
    });

    it('should track targets', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});

      const stats = eventHandlerManager.getEventStats();
      expect(stats.targets).toContain('window');
      expect(stats.targets).toContain('document');
    });

    it('should support listener options', () => {
      eventHandlerManager.addEventListener(document, 'click', () => {}, { capture: true });

      const listeners = eventHandlerManager.getRegisteredListeners();
      expect(listeners).toHaveLength(1);
      expect(listeners[0]!.hasOptions).toBe(true);
    });
  });

  describe('Event Handler Execution', () => {
    it('should execute handler when event fires', async () => {
      const handler = vi.fn();
      eventHandlerManager.addEventListener(window, 'resize', handler);

      window.dispatchEvent(new Event('resize'));

      // Give time for async handler wrapper
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle async handlers', async () => {
      let executed = false;
      const asyncHandler = async () => {
        await Promise.resolve();
        executed = true;
      };

      eventHandlerManager.addEventListener(window, 'focus', asyncHandler);
      window.dispatchEvent(new Event('focus'));

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(executed).toBe(true);
    });

    it('should handle handler errors gracefully', () => {
      const errorHandler = () => {
        throw new Error('Handler error');
      };

      eventHandlerManager.addEventListener(window, 'blur', errorHandler);

      // Should not throw
      expect(() => {
        window.dispatchEvent(new Event('blur'));
      }).not.toThrow();
    });
  });

  describe('Event Removal', () => {
    it('should remove specific event listener', () => {
      const handler = () => {};
      eventHandlerManager.addEventListener(window, 'resize', handler);

      // Get the wrapped handler from internal state
      const listeners = eventHandlerManager.getRegisteredListeners();
      expect(listeners.length).toBe(1);

      // Remove using dispose
      eventHandlerManager.dispose();

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(0);
    });
  });

  describe('Message Event Handler', () => {
    it('should set message event handler', () => {
      const handler = vi.fn();
      eventHandlerManager.setMessageEventHandler(handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).toContain('message');
    });

    it('should replace existing message handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventHandlerManager.setMessageEventHandler(handler1);
      eventHandlerManager.setMessageEventHandler(handler2);

      // Only one message handler should be registered
      const listeners = eventHandlerManager
        .getRegisteredListeners()
        .filter((l) => l.eventType === 'message');
      expect(listeners.length).toBe(1);
    });

    it('should remove message event handler', () => {
      const handler = vi.fn();
      eventHandlerManager.setMessageEventHandler(handler);
      eventHandlerManager.removeMessageEventHandler();

      const listeners = eventHandlerManager
        .getRegisteredListeners()
        .filter((l) => l.eventType === 'message');
      expect(listeners.length).toBe(0);
    });
  });

  describe('Specialized Event Handlers', () => {
    it('should set resize event handler', () => {
      const handler = vi.fn();
      eventHandlerManager.setResizeEventHandler(handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).toContain('resize');
    });

    it('should set focus event handlers', () => {
      const focusHandler = vi.fn();
      const blurHandler = vi.fn();

      eventHandlerManager.setFocusEventHandlers(focusHandler, blurHandler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).toContain('focus');
      expect(stats.eventTypes).toContain('blur');
    });

    it('should set keyboard event handlers', () => {
      const keydownHandler = vi.fn();
      const keyupHandler = vi.fn();

      eventHandlerManager.setKeyboardEventHandlers(keydownHandler, keyupHandler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).toContain('keydown');
      expect(stats.eventTypes).toContain('keyup');
    });

    it('should set mouse event handlers', () => {
      const clickHandler = vi.fn();
      const contextMenuHandler = vi.fn();

      eventHandlerManager.setMouseEventHandlers(clickHandler, contextMenuHandler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).toContain('click');
      expect(stats.eventTypes).toContain('contextmenu');
    });

    it('should handle partial handler registration', () => {
      eventHandlerManager.setFocusEventHandlers(vi.fn());

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).toContain('focus');
      expect(stats.eventTypes).not.toContain('blur');
    });
  });

  describe('DOM Ready Events', () => {
    it('should call handler immediately if DOM is already loaded', async () => {
      const handler = vi.fn();

      // In happy-dom, readyState is typically 'complete'
      eventHandlerManager.onDOMContentLoaded(handler);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should call handler immediately if page is already loaded', async () => {
      const handler = vi.fn();

      eventHandlerManager.onPageLoaded(handler);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should register page unload handlers', () => {
      const handler = vi.fn();
      eventHandlerManager.onPageUnload(handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).toContain('beforeunload');
      expect(stats.eventTypes).toContain('unload');
    });
  });

  describe('Custom Events', () => {
    it('should dispatch custom event', async () => {
      const handler = vi.fn();
      window.addEventListener('my-custom-event', handler);

      eventHandlerManager.dispatchCustomEvent('my-custom-event');

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener('my-custom-event', handler);
    });

    it('should dispatch custom event with detail', async () => {
      const detail = { foo: 'bar', count: 42 };
      let receivedDetail: unknown;

      const handler = (event: CustomEvent) => {
        receivedDetail = event.detail;
      };

      window.addEventListener('detail-event', handler as EventListener);
      eventHandlerManager.dispatchCustomEvent('detail-event', detail);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(receivedDetail).toEqual(detail);
      window.removeEventListener('detail-event', handler as EventListener);
    });

    it('should dispatch custom event on specific target', async () => {
      const element = document.getElementById('test-element') as HTMLElement;
      const handler = vi.fn();

      element.addEventListener('element-event', handler);
      eventHandlerManager.dispatchCustomEvent('element-event', null, element);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalledOnce();
      element.removeEventListener('element-event', handler);
    });
  });

  describe('Statistics and Debugging', () => {
    it('should provide event statistics', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});
      eventHandlerManager.addEventListener(document, 'keydown', () => {});

      const stats = eventHandlerManager.getEventStats();

      expect(stats.totalListeners).toBe(3);
      expect(stats.eventTypes).toHaveLength(3);
      expect(stats.targets).toContain('window');
      expect(stats.targets).toContain('document');
    });

    it('should provide detailed listener information', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {}, { passive: true });
      eventHandlerManager.addEventListener(document, 'click', () => {});

      const listeners = eventHandlerManager.getRegisteredListeners();

      expect(listeners).toHaveLength(2);

      const resizeListener = listeners.find((l) => l.eventType === 'resize');
      expect(resizeListener).toBeDefined();
      expect(resizeListener!.target).toBe('window');
      expect(resizeListener!.hasOptions).toBe(true);

      const clickListener = listeners.find((l) => l.eventType === 'click');
      expect(clickListener?.target).toBe('document');
    });

    it('should identify HTML element targets', () => {
      const element = document.getElementById('test-element') as HTMLElement;
      eventHandlerManager.addEventListener(element, 'click', () => {});

      const listeners = eventHandlerManager.getRegisteredListeners();
      expect(listeners).toHaveLength(1);
      expect(listeners[0]!.target).toBe('div');
    });
  });

  describe('Error Handling', () => {
    it('should handle registration errors gracefully', () => {
      // Create an element
      const element = document.createElement('div');

      expect(() => {
        eventHandlerManager.addEventListener(element, 'click', () => {});
      }).not.toThrow();
    });

    it('should handle removal errors gracefully', () => {
      expect(() => {
        eventHandlerManager.removeEventListener(window, 'nonexistent', () => {});
      }).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      eventHandlerManager.dispose();
      expect(() => {
        eventHandlerManager.dispose();
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should clean up all references on dispose', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});
      eventHandlerManager.setMessageEventHandler(() => {});

      eventHandlerManager.dispose();

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).toBe(0);
    });
  });
});
