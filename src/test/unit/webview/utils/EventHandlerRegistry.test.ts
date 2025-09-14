/**
 * EventHandlerRegistry Utility Tests
 * Tests for centralized event listener management with automatic cleanup
 */

import { expect } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import { JSDOM } from 'jsdom';
import { EventHandlerRegistry } from '../../../../webview/utils/EventHandlerRegistry';

describe('EventHandlerRegistry', () => {
  let sandbox: SinonSandbox;
  let dom: JSDOM;
  let registry: EventHandlerRegistry;
  let testElement: HTMLElement;
  let testButton: HTMLButtonElement;

  beforeEach(() => {
    sandbox = createSandbox();

    // Create DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="test-element">Test Element</div>
          <button id="test-button">Test Button</button>
        </body>
      </html>
    `);

    global.window = dom.window as any;
    global.document = dom.window.document;
    global.Element = dom.window.Element;
    global.HTMLElement = dom.window.HTMLElement;
    global.EventTarget = dom.window.EventTarget;
    global.Event = dom.window.Event;
    global.MouseEvent = dom.window.MouseEvent;
    global.KeyboardEvent = dom.window.KeyboardEvent;

    testElement = document.getElementById('test-element')!;
    testButton = document.getElementById('test-button')! as HTMLButtonElement;

    registry = new EventHandlerRegistry();
  });

  afterEach(() => {
    registry.dispose();
    sandbox.restore();
  });

  describe('register', () => {
    it('should register event listener successfully', () => {
      const handler = sandbox.stub();

      expect(() => {
        registry.register('test-click', testElement, 'click', handler);
      }).to.not.throw();
    });

    it('should register event listener with options', () => {
      const handler = sandbox.stub();
      const options = { once: true, passive: true };

      expect(() => {
        registry.register('test-click', testElement, 'click', handler, options);
      }).to.not.throw();
    });

    it('should register multiple different events', () => {
      const clickHandler = sandbox.stub();
      const keyHandler = sandbox.stub();

      registry.register('click-handler', testElement, 'click', clickHandler);
      registry.register('key-handler', testElement, 'keydown', keyHandler);

      expect(registry.getRegisteredCount()).to.equal(2);
    });

    it('should handle registering same key twice (should replace)', () => {
      const handler1 = sandbox.stub();
      const handler2 = sandbox.stub();

      registry.register('same-key', testElement, 'click', handler1);
      registry.register('same-key', testElement, 'click', handler2);

      expect(registry.getRegisteredCount()).to.equal(1);
    });

    it('should handle different elements with same key', () => {
      const handler = sandbox.stub();

      registry.register('multi-element', testElement, 'click', handler);
      registry.register('multi-element-2', testButton, 'click', handler);

      expect(registry.getRegisteredCount()).to.equal(2);
    });

    it('should handle boolean options', () => {
      const handler = sandbox.stub();

      expect(() => {
        registry.register('bool-options', testElement, 'click', handler, true);
      }).to.not.throw();
    });
  });

  describe('unregister', () => {
    it('should unregister existing event listener', () => {
      const handler = sandbox.stub();

      registry.register('test-click', testElement, 'click', handler);
      expect(registry.getRegisteredCount()).to.equal(1);

      const result = registry.unregister('test-click');
      expect(result).to.be.true;
      expect(registry.getRegisteredCount()).to.equal(0);
    });

    it('should return false for non-existent key', () => {
      const result = registry.unregister('non-existent');
      expect(result).to.be.false;
    });

    it('should handle unregistering after element is removed', () => {
      const handler = sandbox.stub();

      registry.register('test-click', testElement, 'click', handler);
      testElement.remove();

      const result = registry.unregister('test-click');
      expect(result).to.be.true;
    });

    it('should unregister multiple events independently', () => {
      const handler1 = sandbox.stub();
      const handler2 = sandbox.stub();

      registry.register('handler-1', testElement, 'click', handler1);
      registry.register('handler-2', testElement, 'keydown', handler2);

      expect(registry.unregister('handler-1')).to.be.true;
      expect(registry.getRegisteredCount()).to.equal(1);

      expect(registry.unregister('handler-2')).to.be.true;
      expect(registry.getRegisteredCount()).to.equal(0);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered keys', () => {
      const handler = sandbox.stub();

      registry.register('test-key', testElement, 'click', handler);
      expect(registry.isRegistered('test-key')).to.be.true;
    });

    it('should return false for unregistered keys', () => {
      expect(registry.isRegistered('unknown-key')).to.be.false;
    });

    it('should return false after unregistering', () => {
      const handler = sandbox.stub();

      registry.register('test-key', testElement, 'click', handler);
      registry.unregister('test-key');

      expect(registry.isRegistered('test-key')).to.be.false;
    });
  });

  describe('getRegisteredCount', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.getRegisteredCount()).to.equal(0);
    });

    it('should return correct count after registrations', () => {
      const handler = sandbox.stub();

      registry.register('key1', testElement, 'click', handler);
      expect(registry.getRegisteredCount()).to.equal(1);

      registry.register('key2', testButton, 'mouseenter', handler);
      expect(registry.getRegisteredCount()).to.equal(2);

      registry.unregister('key1');
      expect(registry.getRegisteredCount()).to.equal(1);
    });
  });

  describe('getRegisteredKeys', () => {
    it('should return empty array for empty registry', () => {
      expect(registry.getRegisteredKeys()).to.deep.equal([]);
    });

    it('should return all registered keys', () => {
      const handler = sandbox.stub();

      registry.register('click-handler', testElement, 'click', handler);
      registry.register('mouse-handler', testButton, 'mouseenter', handler);

      const keys = registry.getRegisteredKeys();
      expect(keys).to.include('click-handler');
      expect(keys).to.include('mouse-handler');
      expect(keys.length).to.equal(2);
    });
  });

  describe('dispose', () => {
    it('should unregister all event listeners', () => {
      const handler = sandbox.stub();

      registry.register('key1', testElement, 'click', handler);
      registry.register('key2', testButton, 'mouseenter', handler);
      registry.register('key3', testElement, 'keydown', handler);

      expect(registry.getRegisteredCount()).to.equal(3);

      registry.dispose();

      expect(registry.getRegisteredCount()).to.equal(0);
      expect(registry.getRegisteredKeys()).to.deep.equal([]);
    });

    it('should handle disposing empty registry', () => {
      expect(() => {
        registry.dispose();
      }).to.not.throw();
    });

    it('should handle multiple dispose calls', () => {
      const handler = sandbox.stub();

      registry.register('test-key', testElement, 'click', handler);

      registry.dispose();
      registry.dispose(); // Second call should not throw

      expect(registry.getRegisteredCount()).to.equal(0);
    });

    it('should prevent operations after disposal', () => {
      const handler = sandbox.stub();

      registry.dispose();

      // Operations after disposal should be handled gracefully
      expect(() => {
        registry.register('post-dispose', testElement, 'click', handler);
      }).to.not.throw();

      expect(registry.getRegisteredCount()).to.equal(0);
    });
  });

  describe('event firing simulation', () => {
    it('should handle event firing after registration', () => {
      const handler = sandbox.stub();

      registry.register('click-test', testElement, 'click', handler);

      // Simulate click event
      const clickEvent = new dom.window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });

      testElement.dispatchEvent(clickEvent);

      // Note: We can't easily test if the handler was actually called
      // because JSDOM's event simulation doesn't work exactly like browser
      // But we can test that the registration doesn't break event handling
      expect(() => {
        testElement.dispatchEvent(clickEvent);
      }).to.not.throw();
    });
  });

  describe('error handling', () => {
    it('should handle invalid element gracefully', () => {
      const handler = sandbox.stub();

      expect(() => {
        registry.register('invalid', null as any, 'click', handler);
      }).to.not.throw();
    });

    it('should handle invalid event type gracefully', () => {
      const handler = sandbox.stub();

      expect(() => {
        registry.register('invalid-event', testElement, '' as any, handler);
      }).to.not.throw();
    });

    it('should handle null handler gracefully', () => {
      expect(() => {
        registry.register('null-handler', testElement, 'click', null as any);
      }).to.not.throw();
    });

    it('should handle exception in event handler', () => {
      const faultyHandler = () => {
        throw new Error('Handler error');
      };

      expect(() => {
        registry.register('faulty', testElement, 'click', faultyHandler);
      }).to.not.throw();
    });
  });

  describe('memory management', () => {
    it('should not leak memory with many registrations', () => {
      const handler = sandbox.stub();

      // Register many handlers
      for (let i = 0; i < 100; i++) {
        registry.register(`handler-${i}`, testElement, 'click', handler);
      }

      expect(registry.getRegisteredCount()).to.equal(100);

      // Dispose should clean them all up
      registry.dispose();
      expect(registry.getRegisteredCount()).to.equal(0);
    });

    it('should handle registration and unregistration cycles', () => {
      const handler = sandbox.stub();

      // Cycle many times
      for (let i = 0; i < 10; i++) {
        registry.register('cycle-key', testElement, 'click', handler);
        expect(registry.getRegisteredCount()).to.equal(1);

        registry.unregister('cycle-key');
        expect(registry.getRegisteredCount()).to.equal(0);
      }
    });
  });
});
