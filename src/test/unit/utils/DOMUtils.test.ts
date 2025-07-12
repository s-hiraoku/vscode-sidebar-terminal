/**
 * DOMUtils unit tests
 */
/* eslint-disable */
// @ts-nocheck
import * as sinon from 'sinon';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

use(sinonChai);
import { JSDOM } from 'jsdom';
import { DOMUtils } from '../../../webview/utils/DOMUtils';

// Mock setup for this test file
const setupTestEnvironment = () => {
  // Mock globals that might be needed
  if (typeof (global as any).vscode === 'undefined') {
    (global as any).vscode = {
      workspace: {
        getConfiguration: () => ({ get: () => undefined }),
      },
    };
  }
};

describe('DOMUtils', () => {
  let dom: JSDOM;
  let document: Document;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    // Test environment setup
    setupTestEnvironment();

    // Set up process.nextTick before JSDOM creation
    const originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      nextTick: (callback: () => void) => setImmediate(callback),
      env: { ...originalProcess.env, NODE_ENV: 'test' },
    };

    // セットアップ: JSDOM環境を作成
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;

    // グローバルに設定
    (global as Record<string, unknown>).document = document;
    (global as Record<string, unknown>).window = dom.window;
    (global as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
    (global as Record<string, unknown>).getComputedStyle = dom.window.getComputedStyle;

    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    // クリーンアップ
    delete (global as Record<string, unknown>).document;
    delete (global as Record<string, unknown>).window;
    delete (global as Record<string, unknown>).HTMLElement;
  });

  describe('createElement', () => {
    it('should create element with specified tag name', () => {
      const element = DOMUtils.createElement('div');

      expect(element.tagName.toLowerCase()).to.equal('div');
    });

    it('should apply styles when provided', () => {
      const styles = {
        backgroundColor: 'red',
        fontSize: '16px',
      };

      const element = DOMUtils.createElement('div', styles);

      expect(element.style.backgroundColor).to.equal('red');
      expect(element.style.fontSize).to.equal('16px');
    });

    it('should set attributes when provided', () => {
      const attributes = {
        'data-test': 'value',
        class: 'test-class',
      };

      const element = DOMUtils.createElement('div', undefined, attributes);

      expect(element.getAttribute('data-test')).to.equal('value');
      expect(element.getAttribute('class')).to.equal('test-class');
    });

    it('should apply both styles and attributes', () => {
      const styles = { color: 'blue' };
      const attributes = { id: 'test-id' };

      const element = DOMUtils.createElement('span', styles, attributes);

      expect(element.style.color).to.equal('blue');
      expect(element.getAttribute('id')).to.equal('test-id');
      expect(element.tagName.toLowerCase()).to.equal('span');
    });
  });

  describe('applyStyleString', () => {
    it('should apply CSS text to element', () => {
      const element = document.createElement('div');
      const cssText = 'color: red; font-size: 20px;';

      DOMUtils.applyStyleString(element, cssText);

      expect(element.style.cssText).to.include('color: red');
      expect(element.style.cssText).to.include('font-size: 20px');
    });
  });

  describe('safeRemove', () => {
    it('should remove element when element and parent exist', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);

      expect(parent.children.length).to.equal(1);

      DOMUtils.safeRemove(child);

      expect(parent.children.length).to.equal(0);
    });

    it('should not throw when element is null', () => {
      expect(() => DOMUtils.safeRemove(null)).to.not.throw();
    });

    it('should not throw when element has no parent', () => {
      const element = document.createElement('div');
      expect(() => DOMUtils.safeRemove(element)).to.not.throw();
    });
  });

  describe('exists', () => {
    it('should return true when element exists', () => {
      const element = document.createElement('div');
      element.id = 'test-element';
      document.body.appendChild(element);

      const exists = DOMUtils.exists('#test-element');

      expect(exists).to.be.true;
    });

    it('should return false when element does not exist', () => {
      const exists = DOMUtils.exists('#non-existent');

      expect(exists).to.be.false;
    });
  });

  describe('getElement', () => {
    it('should return element when it exists', () => {
      const element = document.createElement('div');
      element.className = 'test-class';
      document.body.appendChild(element);

      const found = DOMUtils.getElement<HTMLDivElement>('.test-class');

      expect(found).to.equal(element);
    });

    it('should return null when element does not exist', () => {
      const found = DOMUtils.getElement('#non-existent');

      expect(found).to.be.null;
    });
  });

  describe('getOrCreateElement', () => {
    it('should return existing element when found', () => {
      const existing = document.createElement('div');
      existing.id = 'existing';
      document.body.appendChild(existing);

      const result = DOMUtils.getOrCreateElement('#existing', 'div');

      expect(result).to.equal(existing);
    });

    it('should create new element when not found', () => {
      const result = DOMUtils.getOrCreateElement('#new-element', 'span');

      expect(result.tagName.toLowerCase()).to.equal('span');
      expect(result.id).to.equal('new-element');
    });

    it('should append to parent when specified', () => {
      const parent = document.createElement('div');
      document.body.appendChild(parent);

      const result = DOMUtils.getOrCreateElement('#child', 'p', parent);

      expect(parent.children.length).to.equal(1);
      expect(parent.children[0]).to.equal(result);
    });
  });

  describe('addEventListenerSafe', () => {
    it('should add event listener when element exists', () => {
      const element = document.createElement('button');
      const spy = sinon.spy();

      DOMUtils.addEventListenerSafe(element, 'click', spy);

      // イベントをトリガー
      element.click();

      expect(spy.calledOnce).to.be.true;
    });

    it('should not throw when element is null', () => {
      const spy = sinon.spy();

      expect(() => DOMUtils.addEventListenerSafe(null, 'click', spy)).to.not.throw();
    });
  });

  describe('appendChildren', () => {
    it('should append multiple children to parent', () => {
      const parent = document.createElement('div');
      const child1 = document.createElement('span');
      const child2 = document.createElement('p');

      DOMUtils.appendChildren(parent, child1, child2);

      expect(parent.children.length).to.equal(2);
      expect(parent.children[0]).to.equal(child1);
      expect(parent.children[1]).to.equal(child2);
    });
  });

  describe('prependChild', () => {
    it('should insert child as first element', () => {
      const parent = document.createElement('div');
      const existing = document.createElement('span');
      const newChild = document.createElement('p');

      parent.appendChild(existing);
      DOMUtils.prependChild(parent, newChild);

      expect(parent.children.length).to.equal(2);
      expect(parent.children[0]).to.equal(newChild);
      expect(parent.children[1]).to.equal(existing);
    });

    it('should append when parent is empty', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');

      DOMUtils.prependChild(parent, child);

      expect(parent.children.length).to.equal(1);
      expect(parent.children[0]).to.equal(child);
    });
  });

  describe('setCSSVariable', () => {
    it('should set CSS custom property', () => {
      DOMUtils.setCSSVariable('test-color', 'blue');

      const value = document.documentElement.style.getPropertyValue('--test-color');
      expect(value).to.equal('blue');
    });
  });

  describe('getCSSVariable', () => {
    it('should get CSS custom property value', () => {
      document.documentElement.style.setProperty('--test-var', 'test-value');

      const value = DOMUtils.getCSSVariable('test-var');
      expect(value).to.equal('test-value');
    });

    it('should return empty string for non-existent variable', () => {
      const value = DOMUtils.getCSSVariable('non-existent');
      expect(value).to.equal('');
    });
  });
});
