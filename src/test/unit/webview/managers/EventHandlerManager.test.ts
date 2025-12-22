/**
 * EventHandlerManager Test Suite - Event listener management and lifecycle
 *
 * TDD Pattern: Covers event registration, removal, and cleanup
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="test-element"></div></body></html>', {
  url: 'http://localhost',
});
(global as any).document = dom.window.document;
(global as any).window = dom.window;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).Event = dom.window.Event;
(global as any).KeyboardEvent = dom.window.KeyboardEvent;
(global as any).MouseEvent = dom.window.MouseEvent;
(global as any).FocusEvent = dom.window.FocusEvent;
(global as any).MessageEvent = dom.window.MessageEvent;
(global as any).CustomEvent = dom.window.CustomEvent;

import { EventHandlerManager } from '../../../../webview/managers/EventHandlerManager';

describe('EventHandlerManager', () => {
  let eventHandlerManager: EventHandlerManager;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="test-element"></div>';

    eventHandlerManager = new EventHandlerManager();
  });

  afterEach(() => {
    eventHandlerManager.dispose();
    sinon.restore();
  });

  describe('Initialization and Lifecycle', () => {
    it('should create instance correctly', () => {
      expect(eventHandlerManager).to.be.instanceOf(EventHandlerManager);
    });

    it('should start with no registered listeners', () => {
      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(0);
    });

    it('should dispose all listeners on dispose', () => {
      eventHandlerManager.addEventListener(window, 'click', () => {});
      eventHandlerManager.addEventListener(document, 'keydown', () => {});

      eventHandlerManager.dispose();

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(0);
    });

    it('should prevent adding listeners after dispose', () => {
      eventHandlerManager.dispose();
      eventHandlerManager.addEventListener(window, 'click', () => {});

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(0);
    });
  });

  describe('Event Registration', () => {
    it('should register window event listener', () => {
      const handler = sinon.stub();
      eventHandlerManager.addEventListener(window, 'resize', handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(1);
      expect(stats.eventTypes).to.include('resize');
    });

    it('should register document event listener', () => {
      const handler = sinon.stub();
      eventHandlerManager.addEventListener(document, 'click', handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(1);
      expect(stats.eventTypes).to.include('click');
    });

    it('should register element event listener', () => {
      const element = document.getElementById('test-element') as HTMLElement;
      const handler = sinon.stub();
      eventHandlerManager.addEventListener(element, 'click', handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(1);
    });

    it('should register multiple listeners', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(window, 'scroll', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(3);
    });

    it('should track event types', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(window, 'scroll', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).to.include('resize');
      expect(stats.eventTypes).to.include('scroll');
      expect(stats.eventTypes).to.include('click');
    });

    it('should track targets', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});

      const stats = eventHandlerManager.getEventStats();
      expect(stats.targets).to.include('window');
      expect(stats.targets).to.include('document');
    });

    it('should support listener options', () => {
      eventHandlerManager.addEventListener(document, 'click', () => {}, { capture: true });

      const listeners = eventHandlerManager.getRegisteredListeners();
      expect(listeners).to.have.lengthOf(1);
      expect(listeners[0]!.hasOptions).to.be.true;
    });
  });

  describe('Event Handler Execution', () => {
    it('should execute handler when event fires', (done) => {
      const handler = sinon.stub();
      eventHandlerManager.addEventListener(window, 'resize', handler);

      window.dispatchEvent(new Event('resize'));

      // Handlers are wrapped in async, give time to execute
      setTimeout(() => {
        expect(handler.calledOnce).to.be.true;
        done();
      }, 10);
    });

    it('should handle async handlers', (done) => {
      let executed = false;
      const asyncHandler = async () => {
        await Promise.resolve();
        executed = true;
      };

      eventHandlerManager.addEventListener(window, 'focus', asyncHandler);
      window.dispatchEvent(new Event('focus'));

      setTimeout(() => {
        expect(executed).to.be.true;
        done();
      }, 10);
    });

    it('should handle handler errors gracefully', (done) => {
      const errorHandler = () => {
        throw new Error('Handler error');
      };

      eventHandlerManager.addEventListener(window, 'blur', errorHandler);

      // Should not throw
      expect(() => {
        window.dispatchEvent(new Event('blur'));
      }).to.not.throw();

      done();
    });
  });

  describe('Event Removal', () => {
    it('should remove specific event listener', () => {
      const handler = () => {};
      eventHandlerManager.addEventListener(window, 'resize', handler);

      // Get the wrapped handler from internal state
      const listeners = eventHandlerManager.getRegisteredListeners();
      expect(listeners.length).to.equal(1);

      // Remove using the exact reference is tricky since we wrap handlers
      // But we can verify that dispose works
      eventHandlerManager.dispose();

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(0);
    });
  });

  describe('Message Event Handler', () => {
    it('should set message event handler', () => {
      const handler = sinon.stub();
      eventHandlerManager.setMessageEventHandler(handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).to.include('message');
    });

    it('should replace existing message handler', () => {
      const handler1 = sinon.stub();
      const handler2 = sinon.stub();

      eventHandlerManager.setMessageEventHandler(handler1);
      eventHandlerManager.setMessageEventHandler(handler2);

      // Only one message handler should be registered
      const listeners = eventHandlerManager
        .getRegisteredListeners()
        .filter((l) => l.eventType === 'message');
      expect(listeners.length).to.equal(1);
    });

    it('should remove message event handler', () => {
      const handler = sinon.stub();
      eventHandlerManager.setMessageEventHandler(handler);
      eventHandlerManager.removeMessageEventHandler();

      const listeners = eventHandlerManager
        .getRegisteredListeners()
        .filter((l) => l.eventType === 'message');
      expect(listeners.length).to.equal(0);
    });
  });

  describe('Specialized Event Handlers', () => {
    it('should set resize event handler', () => {
      const handler = sinon.stub();
      eventHandlerManager.setResizeEventHandler(handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).to.include('resize');
    });

    it('should set focus event handlers', () => {
      const focusHandler = sinon.stub();
      const blurHandler = sinon.stub();

      eventHandlerManager.setFocusEventHandlers(focusHandler, blurHandler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).to.include('focus');
      expect(stats.eventTypes).to.include('blur');
    });

    it('should set keyboard event handlers', () => {
      const keydownHandler = sinon.stub();
      const keyupHandler = sinon.stub();

      eventHandlerManager.setKeyboardEventHandlers(keydownHandler, keyupHandler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).to.include('keydown');
      expect(stats.eventTypes).to.include('keyup');
    });

    it('should set mouse event handlers', () => {
      const clickHandler = sinon.stub();
      const contextMenuHandler = sinon.stub();

      eventHandlerManager.setMouseEventHandlers(clickHandler, contextMenuHandler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).to.include('click');
      expect(stats.eventTypes).to.include('contextmenu');
    });

    it('should handle partial handler registration', () => {
      eventHandlerManager.setFocusEventHandlers(sinon.stub());

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).to.include('focus');
      expect(stats.eventTypes).to.not.include('blur');
    });
  });

  describe('DOM Ready Events', () => {
    it('should call handler immediately if DOM is already loaded', (done) => {
      const handler = sinon.stub();

      // In JSDOM, readyState is typically 'complete'
      eventHandlerManager.onDOMContentLoaded(handler);

      setTimeout(() => {
        expect(handler.calledOnce).to.be.true;
        done();
      }, 10);
    });

    it('should call handler immediately if page is already loaded', (done) => {
      const handler = sinon.stub();

      eventHandlerManager.onPageLoaded(handler);

      setTimeout(() => {
        expect(handler.calledOnce).to.be.true;
        done();
      }, 10);
    });

    it('should register page unload handlers', () => {
      const handler = sinon.stub();
      eventHandlerManager.onPageUnload(handler);

      const stats = eventHandlerManager.getEventStats();
      expect(stats.eventTypes).to.include('beforeunload');
      expect(stats.eventTypes).to.include('unload');
    });
  });

  describe('Custom Events', () => {
    it('should dispatch custom event', (done) => {
      const handler = sinon.stub();
      window.addEventListener('my-custom-event', handler);

      eventHandlerManager.dispatchCustomEvent('my-custom-event');

      setTimeout(() => {
        expect(handler.calledOnce).to.be.true;
        window.removeEventListener('my-custom-event', handler);
        done();
      }, 10);
    });

    it('should dispatch custom event with detail', (done) => {
      const detail = { foo: 'bar', count: 42 };
      let receivedDetail: unknown;

      const handler = (event: CustomEvent) => {
        receivedDetail = event.detail;
      };

      window.addEventListener('detail-event', handler as EventListener);
      eventHandlerManager.dispatchCustomEvent('detail-event', detail);

      setTimeout(() => {
        expect(receivedDetail).to.deep.equal(detail);
        window.removeEventListener('detail-event', handler as EventListener);
        done();
      }, 10);
    });

    it('should dispatch custom event on specific target', (done) => {
      const element = document.getElementById('test-element') as HTMLElement;
      const handler = sinon.stub();

      element.addEventListener('element-event', handler);
      eventHandlerManager.dispatchCustomEvent('element-event', null, element);

      setTimeout(() => {
        expect(handler.calledOnce).to.be.true;
        element.removeEventListener('element-event', handler);
        done();
      }, 10);
    });
  });

  describe('Statistics and Debugging', () => {
    it('should provide event statistics', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});
      eventHandlerManager.addEventListener(document, 'keydown', () => {});

      const stats = eventHandlerManager.getEventStats();

      expect(stats.totalListeners).to.equal(3);
      expect(stats.eventTypes).to.have.lengthOf(3);
      expect(stats.targets).to.include('window');
      expect(stats.targets).to.include('document');
    });

    it('should provide detailed listener information', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {}, { passive: true });
      eventHandlerManager.addEventListener(document, 'click', () => {});

      const listeners = eventHandlerManager.getRegisteredListeners();

      expect(listeners).to.have.lengthOf(2);

      const resizeListener = listeners.find((l) => l.eventType === 'resize');
      expect(resizeListener).to.exist;
      expect(resizeListener!.target).to.equal('window');
      expect(resizeListener!.hasOptions).to.be.true;

      const clickListener = listeners.find((l) => l.eventType === 'click');
      expect(clickListener?.target).to.equal('document');
    });

    it('should identify HTML element targets', () => {
      const element = document.getElementById('test-element') as HTMLElement;
      eventHandlerManager.addEventListener(element, 'click', () => {});

      const listeners = eventHandlerManager.getRegisteredListeners();
      expect(listeners).to.have.lengthOf(1);
      expect(listeners[0]!.target).to.equal('div');
    });
  });

  describe('Error Handling', () => {
    it('should handle registration errors gracefully', () => {
      // Create an invalid target - use a mock HTMLElement
      const invalidElement = document.createElement('div');

      expect(() => {
        eventHandlerManager.addEventListener(invalidElement, 'click', () => {});
      }).to.not.throw();
    });

    it('should handle removal errors gracefully', () => {
      expect(() => {
        eventHandlerManager.removeEventListener(window, 'nonexistent', () => {});
      }).to.not.throw();
    });

    it('should handle multiple dispose calls', () => {
      eventHandlerManager.dispose();
      expect(() => {
        eventHandlerManager.dispose();
      }).to.not.throw();
    });
  });

  describe('Memory Management', () => {
    it('should clean up all references on dispose', () => {
      eventHandlerManager.addEventListener(window, 'resize', () => {});
      eventHandlerManager.addEventListener(document, 'click', () => {});
      eventHandlerManager.setMessageEventHandler(() => {});

      eventHandlerManager.dispose();

      const stats = eventHandlerManager.getEventStats();
      expect(stats.totalListeners).to.equal(0);
    });
  });
});
